-- ThrivvSkale CRM: privacy (Task 18) - do-not-disturb, erase and export.
--
-- consent_log gains company_id and contact_id so an opt-out, erasure or export
-- stays linked to the lead after the numbers (and the contact row) are gone.
-- contact_id is a plain uuid with no foreign key on purpose: the contact row is
-- deleted by an erasure, and the log must keep saying who was erased.
--
-- set_company_dnd and erase_contact each run in one transaction, SECURITY
-- INVOKER, so row-level security applies to every statement. Errors read
-- "[<function>] <step> failed: ..." and name only record ids, never personal data.
-- Callers: src/lib/privacy/setDnd.ts, src/lib/privacy/eraseContact.ts and
-- (contact_import_cells, read-only) src/lib/privacy/readContactExport.ts.

alter table public.consent_log
  add column company_id uuid,
  add column contact_id uuid,
  add foreign key (workspace_id, company_id)
    references public.companies (workspace_id, id) on delete set null (company_id);

create index consent_log_company_idx on public.consent_log (workspace_id, company_id);

-- ---------------------------------------------------------------------------
-- set_company_dnd: flag (or clear) do-not-disturb and log opted_out / consented
-- ---------------------------------------------------------------------------

create function public.set_company_dnd(
  p_workspace_id uuid,
  p_company_id uuid,
  p_dnd boolean,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_member(p_workspace_id) then
    raise exception '[set_company_dnd] check membership failed: not a member of workspace %', p_workspace_id
      using errcode = '42501';
  end if;

  update public.companies c
  set dnd = p_dnd
  where c.workspace_id = p_workspace_id and c.id = p_company_id;
  if not found then
    raise exception '[set_company_dnd] find company % failed: not found in workspace %', p_company_id, p_workspace_id;
  end if;

  insert into public.consent_log (workspace_id, company_id, event, note)
  values (
    p_workspace_id, p_company_id,
    case when p_dnd then 'opted_out' else 'consented' end::public.consent_event,
    p_note
  );
end;
$$;

revoke execute on function public.set_company_dnd(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.set_company_dnd(uuid, uuid, boolean, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Import-row scrubbing helpers (used by erase_contact step 3)
-- ---------------------------------------------------------------------------
-- A raw CSV cell is "the person's" when one of its numbers contains one of
-- theirs (last 9 digits, at least 7), or when the whole cell is their name
-- (case and spacing ignored). Names never match part of a cell, so a short
-- name such as "Sai" does not blank "Sai Dental Clinic".

-- The cell is cut into number runs at anything that cannot be part of a
-- written phone number (letters, "," ";" "/" ...), so "98480, 22338" is two
-- runs and never matches 9848022338. Spaces, "+", "-", "(", ")" and "." stay
-- inside a run: "+91 98480 22338" is one number. So do the Unicode dashes
-- people paste from documents: \u2010-\u2015 (hyphen to horizontal bar, which
-- includes the en and em dash) and \u2212 (minus sign).
create function public.import_cell_has_number(p_cell text, p_tails text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from regexp_split_to_table(p_cell, '[^0-9\s+().\-\u2010-\u2015\u2212]+') as run(chars)
    cross join unnest(p_tails) as tail(digits)
    where length(tail.digits) >= 7
      and strpos(regexp_replace(run.chars, '\D', '', 'g'), tail.digits) > 0
  );
$$;

-- Lower case, trimmed, inner spaces collapsed: "  Ravi   KUMAR " -> "ravi kumar".
create function public.normalise_name(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(btrim(p_text)), '\s+', ' ', 'g');
$$;

-- p_names must already be normalised (normalise_name).
create function public.import_cell_is_name(p_cell text, p_names text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.normalise_name(p_cell) = any (p_names);
$$;

-- True when any string cell of the row holds one of the numbers.
create function public.import_row_has_number(p_raw jsonb, p_tails text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from jsonb_each(p_raw) as cell
    where jsonb_typeof(cell.value) = 'string'
      and public.import_cell_has_number(cell.value #>> '{}', p_tails)
  );
$$;

-- The row with every matching string cell replaced by "[erased]".
create function public.scrub_import_cells(p_raw jsonb, p_tails text[], p_names text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(cell.key, case
    when jsonb_typeof(cell.value) <> 'string' then cell.value
    when public.import_cell_has_number(cell.value #>> '{}', p_tails) then to_jsonb('[erased]'::text)
    when public.import_cell_is_name(cell.value #>> '{}', p_names) then to_jsonb('[erased]'::text)
    else cell.value
  end), '{}'::jsonb)
  from jsonb_each(p_raw) as cell;
$$;

revoke execute on function public.normalise_name(text) from public, anon;
revoke execute on function public.import_cell_has_number(text, text[]) from public, anon;
revoke execute on function public.import_cell_is_name(text, text[]) from public, anon;
revoke execute on function public.import_row_has_number(jsonb, text[]) from public, anon;
revoke execute on function public.scrub_import_cells(jsonb, text[], text[]) from public, anon;
grant execute on function public.normalise_name(text) to authenticated, service_role;
grant execute on function public.import_cell_has_number(text, text[]) to authenticated, service_role;
grant execute on function public.import_cell_is_name(text, text[]) to authenticated, service_role;
grant execute on function public.import_row_has_number(jsonb, text[]) to authenticated, service_role;
grant execute on function public.scrub_import_cells(jsonb, text[], text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- erase_contact: remove one person's numbers and personal fields, keep the
-- company and an anonymised timeline, log erased
-- ---------------------------------------------------------------------------
--
-- Steps, in order:
--   1. note the voice-note audio paths of the person's activities (returned,
--      so the caller can remove the files from the voice-notes bucket). Only
--      paths inside this workspace's folder are returned: storagePath is
--      member-written metadata, and a path into another workspace's folder
--      must never reach the delete;
--   2. anonymise those activities (linked by contact or by one of their
--      numbers): body cleared, metadata replaced by an erased marker;
--   3. clear the free text on their calls (who_answered, lost_reason) and
--      pain points (quote, quote_en, current_tool, frequency);
--   4. scrub import_rows: the company's rows and any row holding one of the
--      numbers (skipped and failed rows too) - see scrub_import_cells;
--   5. move the consent history of the numbers onto contact_id / company_id,
--      so it is not orphaned when the numbers go;
--   6. delete the person's numbers, then the contact row;
--   7. log erased with company_id and contact_id (note: count of refused audio paths, if any).
-- Returns the voice-note storage paths, all under '<p_workspace_id>/' (may be empty).

create function public.erase_contact(p_workspace_id uuid, p_contact_id uuid)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_names text[];
  v_point_ids uuid[];
  v_number_tails text[];
  v_activity_ids uuid[];
  v_audio_paths text[];
  v_dropped_paths integer;
begin
  if not public.is_member(p_workspace_id) then
    raise exception '[erase_contact] check membership failed: not a member of workspace %', p_workspace_id
      using errcode = '42501';
  end if;

  select k.company_id,
         array_remove(array[public.normalise_name(k.name), public.normalise_name(k.name_latin)], null)
    into v_company_id, v_names
  from public.contacts k
  where k.workspace_id = p_workspace_id and k.id = p_contact_id;
  if not found then
    raise exception '[erase_contact] find contact % failed: not found in workspace %', p_contact_id, p_workspace_id;
  end if;

  select coalesce(array_agg(p.id), '{}'),
         coalesce(array_agg(right(regexp_replace(p.e164, '\D', '', 'g'), 9)), '{}')
    into v_point_ids, v_number_tails
  from public.contact_points p
  where p.workspace_id = p_workspace_id and p.contact_id = p_contact_id;

  select coalesce(array_agg(a.id), '{}') into v_activity_ids
  from public.activities a
  where a.workspace_id = p_workspace_id
    and (a.contact_id = p_contact_id or a.contact_point_id = any (v_point_ids));

  -- 1. Audio files: the path is in the metadata that step 2 replaces. Only
  --    this workspace's folder (see the step list above).
  select coalesce(array_agg(a.metadata ->> 'storagePath'), '{}') into v_audio_paths
  from public.activities a
  where a.workspace_id = p_workspace_id and a.id = any (v_activity_ids)
    and a.type = 'voice_note'
    and starts_with(a.metadata ->> 'storagePath', p_workspace_id::text || '/');

  -- Paths outside the workspace folder are not returned; count them for the log.
  select count(*) into v_dropped_paths
  from public.activities a
  where a.workspace_id = p_workspace_id and a.id = any (v_activity_ids)
    and a.type = 'voice_note'
    and a.metadata ->> 'storagePath' is not null
    and not starts_with(a.metadata ->> 'storagePath', p_workspace_id::text || '/');

  -- 2. Anonymised timeline: the row (type, time, company) stays, the content goes.
  update public.activities a
  set body = null,
      metadata = jsonb_build_object('erased', true, 'erasedContactId', p_contact_id)
  where a.workspace_id = p_workspace_id and a.id = any (v_activity_ids);

  -- 3. Free text on the call and pain-point rows of those activities.
  update public.calls c
  set who_answered = null, lost_reason = null
  where c.workspace_id = p_workspace_id and c.activity_id = any (v_activity_ids);

  update public.pain_points pp
  set quote = null, quote_en = null, current_tool = null, frequency = null
  where pp.workspace_id = p_workspace_id and pp.activity_id = any (v_activity_ids);

  -- 4. The raw CSV copies of the lead still hold the number and name.
  update public.import_rows r
  set raw = public.scrub_import_cells(r.raw, v_number_tails, v_names)
  where r.workspace_id = p_workspace_id
    and (r.company_id = v_company_id or public.import_row_has_number(r.raw, v_number_tails));

  -- 5. Per-number consent history keeps saying whose it was.
  update public.consent_log l
  set contact_id = p_contact_id, company_id = coalesce(l.company_id, v_company_id)
  where l.workspace_id = p_workspace_id and l.contact_point_id = any (v_point_ids);

  -- 6. Numbers first (their activities are already anonymised), then the person.
  delete from public.contact_points p
  where p.workspace_id = p_workspace_id and p.id = any (v_point_ids);

  delete from public.contacts k
  where k.workspace_id = p_workspace_id and k.id = p_contact_id;
  if not found then
    raise exception '[erase_contact] delete contact % failed: row was not deleted', p_contact_id;
  end if;

  -- 7. The record of the erasure, without any personal data. The note only
  --    counts the audio paths that were refused (none of them is stored).
  insert into public.consent_log (workspace_id, company_id, contact_id, event, note)
  values (p_workspace_id, v_company_id, p_contact_id, 'erased',
          case when v_dropped_paths > 0 then v_dropped_paths || ' audio path(s) outside the workspace not removed' end);

  return v_audio_paths;
end;
$$;

revoke execute on function public.erase_contact(uuid, uuid) from public, anon;
grant execute on function public.erase_contact(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- contact_import_cells: the raw import cells that hold one person's data
-- ---------------------------------------------------------------------------
-- The same rows and cells erase_contact step 4 would blank, for the data
-- export. Read-only, SECURITY INVOKER; a non-member gets error 42501, like
-- erase_contact. Caller: src/lib/privacy/readContactExport.ts.

create function public.contact_import_cells(p_workspace_id uuid, p_contact_id uuid)
returns table (import_row_id uuid, batch_id uuid, row_number integer, cell_key text, cell_value text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_member(p_workspace_id) then
    raise exception '[contact_import_cells] check membership failed: not a member of workspace %', p_workspace_id
      using errcode = '42501';
  end if;

  return query
  with person as (
    select k.company_id,
           array_remove(array[public.normalise_name(k.name), public.normalise_name(k.name_latin)], null) as names,
           coalesce((
             select array_agg(right(regexp_replace(p.e164, '\D', '', 'g'), 9))
             from public.contact_points p
             where p.workspace_id = p_workspace_id and p.contact_id = k.id
           ), '{}') as tails
    from public.contacts k
    where k.workspace_id = p_workspace_id and k.id = p_contact_id
  )
  select r.id, r.batch_id, r.row_number, cell.key, cell.value #>> '{}'
  from person
  join public.import_rows r
    on r.workspace_id = p_workspace_id
   and (r.company_id = person.company_id or public.import_row_has_number(r.raw, person.tails))
  cross join lateral jsonb_each(r.raw) as cell
  where jsonb_typeof(cell.value) = 'string'
    and (public.import_cell_has_number(cell.value #>> '{}', person.tails)
         or public.import_cell_is_name(cell.value #>> '{}', person.names))
  order by r.batch_id, r.row_number, cell.key;
end;
$$;

revoke execute on function public.contact_import_cells(uuid, uuid) from public, anon;
grant execute on function public.contact_import_cells(uuid, uuid) to authenticated, service_role;
