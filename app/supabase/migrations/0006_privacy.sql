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
-- Callers: src/lib/privacy/setDnd.ts and src/lib/privacy/eraseContact.ts.

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
-- erase_contact: remove one person's numbers and personal fields, keep the
-- company and an anonymised timeline, log erased
-- ---------------------------------------------------------------------------
--
-- Steps, in order:
--   1. anonymise the person's activities (linked by contact or by one of their
--      numbers): body cleared, metadata replaced by an erased marker;
--   2. clear who_answered on those calls and the quotes on their pain points;
--   3. blank import_rows cells of the company that hold one of the numbers
--      (last 9 digits) or the name / name_latin;
--   4. delete the person's numbers, then the contact row;
--   5. log erased with company_id and contact_id.

create function public.erase_contact(p_workspace_id uuid, p_contact_id uuid)
returns void
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
begin
  if not public.is_member(p_workspace_id) then
    raise exception '[erase_contact] check membership failed: not a member of workspace %', p_workspace_id
      using errcode = '42501';
  end if;

  select k.company_id,
         array_remove(array[lower(btrim(k.name)), lower(btrim(k.name_latin))], null)
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

  -- 1. Anonymised timeline: the row (type, time, company) stays, the content goes.
  update public.activities a
  set body = null,
      metadata = jsonb_build_object('erased', true, 'erasedContactId', p_contact_id)
  where a.workspace_id = p_workspace_id and a.id = any (v_activity_ids);

  -- 2. Free text on the call and pain-point rows of those activities.
  update public.calls c
  set who_answered = null
  where c.workspace_id = p_workspace_id and c.activity_id = any (v_activity_ids);

  update public.pain_points pp
  set quote = null, quote_en = null
  where pp.workspace_id = p_workspace_id and pp.activity_id = any (v_activity_ids);

  -- 3. The raw CSV copy of the lead still holds the number and name.
  update public.import_rows r
  set raw = (
    select coalesce(jsonb_object_agg(cell.key, case
      when jsonb_typeof(cell.value) = 'string' and (
        exists (
          select 1 from unnest(v_number_tails) as tail(digits)
          where length(tail.digits) >= 7
            and strpos(regexp_replace(cell.value #>> '{}', '\D', '', 'g'), tail.digits) > 0
        )
        or exists (
          select 1 from unnest(v_names) as person(name)
          where length(person.name) >= 3 and strpos(lower(cell.value #>> '{}'), person.name) > 0
        )
      ) then to_jsonb('[erased]'::text)
      else cell.value
    end), '{}'::jsonb)
    from jsonb_each(r.raw) as cell
  )
  where r.workspace_id = p_workspace_id and r.company_id = v_company_id;

  -- 4. Numbers first (their activities are already anonymised), then the person.
  delete from public.contact_points p
  where p.workspace_id = p_workspace_id and p.id = any (v_point_ids);

  delete from public.contacts k
  where k.workspace_id = p_workspace_id and k.id = p_contact_id;
  if not found then
    raise exception '[erase_contact] delete contact % failed: row was not deleted', p_contact_id;
  end if;

  -- 5. The record of the erasure, without any personal data.
  insert into public.consent_log (workspace_id, company_id, contact_id, event)
  values (p_workspace_id, v_company_id, p_contact_id, 'erased');
end;
$$;

revoke execute on function public.erase_contact(uuid, uuid) from public, anon;
grant execute on function public.erase_contact(uuid, uuid) to authenticated, service_role;
