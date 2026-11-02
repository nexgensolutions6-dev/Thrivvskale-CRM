-- ThrivvSkale CRM: call logging (Task 15).
--
-- log_call writes one call in one transaction: activity, call, pain point,
-- task, and the company and contact updates. A retry is safe: the unique index
-- activities_workspace_client_id_key on (workspace_id, client_id) lets exactly
-- one submission insert the activity. A concurrent duplicate waits on that index,
-- inserts nothing, and hands back the winner's call with duplicate = true.
--
-- SECURITY INVOKER: every statement runs as the caller, so row-level security
-- applies. Errors read "[log_call] <step> failed: ..." and undo the whole call.
--
-- The migration also creates the private `voice-notes` bucket. Objects live at
-- <workspaceId>/<activityId>.webm; only members of that workspace can touch them.

create function public.log_call(
  p_workspace_id uuid,
  p_client_id uuid,
  p_company_id uuid,
  p_contact_point_id uuid,
  p_outcome public.call_outcome,
  p_duration_is_estimate boolean,
  p_contact_id uuid default null,
  p_duration_seconds integer default null,
  p_mix_used public.lang_code[] default '{}',
  p_objection_ids uuid[] default '{}',
  p_lost_reason text default null,
  p_opener_id uuid default null,
  p_occurred_at timestamptz default null,
  p_next_mix_profile text default null,
  p_pain_point jsonb default null,
  p_next_action jsonb default null
)
returns table (call_id uuid, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_company_name text;
  v_activity_id uuid;
  v_call_id uuid;
  v_due_at timestamptz := (p_next_action ->> 'dueAt')::timestamptz;
  v_task_type public.task_type := (p_next_action ->> 'type')::public.task_type;
begin
  if not public.is_member(p_workspace_id) then
    raise exception '[log_call] check membership failed: not a member of workspace %', p_workspace_id
      using errcode = '42501';
  end if;

  select c.name into v_company_name
  from public.companies c
  where c.workspace_id = p_workspace_id and c.id = p_company_id;
  if not found then
    raise exception '[log_call] find company % failed: not found in workspace %', p_company_id, p_workspace_id;
  end if;

  -- The one line that makes retries safe. Waits for a concurrent insert of the same client_id.
  insert into public.activities (
    workspace_id, client_id, type, company_id, contact_id, contact_point_id, occurred_at
  )
  values (
    p_workspace_id, p_client_id, 'call', p_company_id, p_contact_id, p_contact_point_id, v_occurred_at
  )
  on conflict (workspace_id, client_id) do nothing
  returning id into v_activity_id;

  if v_activity_id is null then
    select c.id into v_call_id
    from public.activities a
    join public.calls c on c.workspace_id = a.workspace_id and c.activity_id = a.id
    where a.workspace_id = p_workspace_id and a.client_id = p_client_id and a.company_id = p_company_id;
    if not found then
      raise exception '[log_call] find earlier call failed: client id % is used by something else on "%"',
        p_client_id, v_company_name;
    end if;
    return query select v_call_id, true;
    return;
  end if;

  -- Ownership checks. The composite foreign keys only prove "same workspace".
  if not exists (
    select 1 from public.contact_points p
    where p.workspace_id = p_workspace_id and p.id = p_contact_point_id and p.company_id = p_company_id
  ) then
    raise exception '[log_call] check contact point failed: % is not a number of "%"',
      p_contact_point_id, v_company_name;
  end if;

  if p_contact_id is not null and not exists (
    select 1 from public.contacts k
    where k.workspace_id = p_workspace_id and k.id = p_contact_id and k.company_id = p_company_id
  ) then
    raise exception '[log_call] check contact failed: % is not a contact of "%"', p_contact_id, v_company_name;
  end if;

  if p_opener_id is not null and not exists (
    select 1 from public.content_variants v
    where v.workspace_id = p_workspace_id and v.id = p_opener_id and v.kind = 'opener'
      and (v.company_id is null or v.company_id = p_company_id)
  ) then
    raise exception '[log_call] check opener failed: % is not an opener usable on "%"', p_opener_id, v_company_name;
  end if;

  if exists (
    select 1 from unnest(p_objection_ids) as wanted(id)
    where not exists (
      select 1 from public.objections o where o.workspace_id = p_workspace_id and o.id = wanted.id
    )
  ) then
    raise exception '[log_call] check objections failed: an objection of the call on "%" is not in this workspace',
      v_company_name;
  end if;

  insert into public.calls (
    workspace_id, activity_id, outcome, duration_seconds, duration_is_estimate,
    mix_used, lost_reason, objection_ids, opener_id
  )
  values (
    p_workspace_id, v_activity_id, p_outcome, p_duration_seconds, p_duration_is_estimate,
    p_mix_used, p_lost_reason, p_objection_ids, p_opener_id
  )
  returning id into v_call_id;

  if p_pain_point is not null then
    insert into public.pain_points (
      workspace_id, company_id, activity_id, process_category, current_tool, impact_type, severity, quote
    )
    values (
      p_workspace_id, p_company_id, v_activity_id,
      p_pain_point ->> 'processCategory',
      p_pain_point ->> 'currentTool',
      (p_pain_point ->> 'impact')::public.impact_type,
      (p_pain_point ->> 'severity')::smallint,
      p_pain_point ->> 'quote'
    );
  end if;

  -- This call is the callback that was due, so close it before scheduling the next one.
  update public.tasks t
  set done_at = now()
  where t.workspace_id = p_workspace_id and t.company_id = p_company_id
    and t.type = 'callback' and t.done_at is null;

  if p_next_action is not null then
    insert into public.tasks (workspace_id, company_id, title, due_at, type)
    values (
      p_workspace_id, p_company_id,
      case v_task_type when 'callback' then 'Call back ' else 'Follow up with ' end || v_company_name,
      v_due_at, v_task_type
    );
  end if;

  update public.companies c
  set last_contacted_at = v_occurred_at,
      next_action_at = v_due_at,
      wrong_number = c.wrong_number or p_outcome = 'wrong_number'
  where c.workspace_id = p_workspace_id and c.id = p_company_id;

  if p_contact_id is not null and p_next_mix_profile is not null then
    update public.contacts k
    set mix_profile = p_next_mix_profile
    where k.workspace_id = p_workspace_id and k.id = p_contact_id;
  end if;

  return query select v_call_id, false;
end;
$$;

revoke execute on function public.log_call(
  uuid, uuid, uuid, uuid, public.call_outcome, boolean, uuid, integer, public.lang_code[], uuid[],
  text, uuid, timestamptz, text, jsonb, jsonb
) from public, anon;
grant execute on function public.log_call(
  uuid, uuid, uuid, uuid, public.call_outcome, boolean, uuid, integer, public.lang_code[], uuid[],
  text, uuid, timestamptz, text, jsonb, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Voice notes: private bucket, 5 MB per file, webm audio only
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 5242880, array['audio/webm'])
on conflict (id) do nothing;

-- True when the first folder of `object_name` is a workspace the caller belongs
-- to. CASE guards the uuid cast: a malformed folder is a plain "no", not an error.
create function public.is_member_of_object_folder(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$'
      then public.is_member(((storage.foldername(object_name))[1])::uuid)
    else false
  end;
$$;

revoke execute on function public.is_member_of_object_folder(text) from public, anon;
grant execute on function public.is_member_of_object_folder(text) to authenticated, service_role;

create policy "members manage their workspace voice notes"
  on storage.objects for all to authenticated
  using (bucket_id = 'voice-notes' and public.is_member_of_object_folder(name))
  with check (bucket_id = 'voice-notes' and public.is_member_of_object_folder(name));
