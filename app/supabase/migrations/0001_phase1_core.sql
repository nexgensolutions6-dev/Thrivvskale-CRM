-- ThrivvSkale CRM: Phase 1 core schema (spec Section 5, Phase 1 subset).
--
-- Tenancy model
--   * Every tenant table carries workspace_id (on delete cascade from workspaces).
--   * Row-level security is enabled on every public table. Policies allow the
--     `authenticated` role to touch a row only when public.is_member(workspace_id)
--     is true. `anon` has no policies, so it reads nothing.
--   * References between tenant tables use composite (workspace_id, id) foreign
--     keys, so a row can never point at a row in another workspace (FK checks
--     bypass RLS, so a plain id FK would let a member attach rows to, or probe
--     for, another workspace's data).
--
-- Enum literals match src/lib/domain.ts.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.tier as enum ('core', 'exploratory');
create type public.priority as enum ('A', 'B', 'C');
create type public.member_role as enum ('owner'); -- more roles arrive with the team
create type public.contact_role as enum ('owner', 'decision_maker', 'manager', 'gatekeeper', 'other');
create type public.lang_code as enum ('te', 'hi', 'kn', 'ta', 'ml', 'mr', 'ur', 'en');
create type public.script as enum ('latin', 'native');
create type public.register as enum ('formal', 'casual');
create type public.phone_kind as enum ('business', 'personal', 'landline');
create type public.wa_status as enum ('verified', 'unconfirmed', 'landline', 'none');
create type public.visibility as enum ('owner_only', 'workspace');
create type public.activity_type as enum (
  'call', 'whatsapp', 'note', 'voice_note', 'status_change',
  'task_done', 'quote_sent', 'invoice_sent', 'site_recheck'
);
create type public.call_outcome as enum (
  'no_answer', 'busy', 'wrong_number', 'callback',
  'gatekeeper', 'interested', 'not_interested', 'meeting_booked'
);
create type public.task_type as enum ('callback', 'todo', 'demo', 'site_visit');
create type public.impact_type as enum ('time', 'money', 'manpower');
create type public.content_kind as enum ('opener', 'template', 'script', 'objection_response');
create type public.content_source as enum ('manual', 'ai_draft', 'ai_approved');
create type public.holiday_kind as enum ('public', 'festival', 'local');
create type public.consent_event as enum ('opted_out', 'consented', 'erased', 'exported');
create type public.import_row_status as enum ('pending', 'imported', 'skipped', 'failed');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workspaces and membership
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  home_state text,
  gst_registered boolean not null default false,
  gstin text,
  -- ISO weekday numbers, 1 = Monday ... 7 = Sunday.
  working_days smallint[] not null default '{1,2,3,4,5,6}'
    check (working_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  timezone text not null default 'Asia/Kolkata',
  -- Ordered, primary language first.
  default_language_mix public.lang_code[] not null default '{te,hi,en}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index members_user_id_idx on public.members (user_id);

-- True when the signed-in user belongs to workspace `ws`. SECURITY DEFINER so
-- policies on members (and every other table) can call it without recursing
-- into members' own RLS.
create function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Companies, contacts, phone lines
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  -- Branches of one business point at the parent.
  parent_company_id uuid,
  vertical text,
  tier public.tier not null default 'exploratory',
  area text,
  city text,
  state text,
  pincode text,
  country text,
  website_url text,
  website_status text,
  website_invalid boolean not null default false,
  google_rating numeric(2, 1) check (google_rating between 0 and 5),
  google_reviews integer check (google_reviews >= 0),
  source text,
  priority public.priority,
  base_score numeric not null default 0,
  score numeric not null default 0,
  intent_signal text,
  problem_evidence text,
  entry_offer text,
  long_term_opportunity text,
  description text,
  stage text not null default 'new',
  gstin text,
  pan text,
  dnd boolean not null default false,
  needs_number boolean not null default false,
  wrong_number boolean not null default false,
  tags text[] not null default '{}',
  last_contacted_at timestamptz,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, parent_company_id)
    references public.companies (workspace_id, id) on delete set null (parent_company_id)
);

create index companies_workspace_next_action_idx on public.companies (workspace_id, next_action_at);
create index companies_name_trgm_idx on public.companies using gin (name extensions.gin_trgm_ops);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null,
  name text,
  name_latin text,
  role public.contact_role not null default 'other',
  -- Ordered, primary language first.
  languages public.lang_code[] not null default '{}',
  mix_profile text,
  script_pref public.script,
  register public.register,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id)
    references public.companies (workspace_id, id) on delete cascade
);

create index contacts_company_idx on public.contacts (workspace_id, company_id);

-- company_id is not listed in spec Section 5, but a company-level line
-- (contact_id null) must still belong to a company.
create table public.contact_points (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null,
  contact_id uuid,
  e164 text not null check (e164 ~ '^\+[1-9][0-9]{6,14}$'),
  kind public.phone_kind not null,
  wa_status public.wa_status not null default 'unconfirmed',
  preferred_for_whatsapp boolean not null default false,
  preferred_for_calls boolean not null default false,
  visibility public.visibility not null default 'workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id)
    references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete set null (contact_id)
);

create index contact_points_company_idx on public.contact_points (workspace_id, company_id);
create index contact_points_e164_idx on public.contact_points (workspace_id, e164);

-- ---------------------------------------------------------------------------
-- Content (openers, templates, scripts, objection responses)
-- ---------------------------------------------------------------------------

create table public.content_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.content_kind not null,
  vertical text,
  stage text,
  -- Language mix, primary first, e.g. 'te+hi+en'.
  mix text not null default 'en'
    check (mix ~ '^(te|hi|kn|ta|ml|mr|ur|en)(\+(te|hi|kn|ta|ml|mr|ur|en))*$'),
  script public.script not null default 'latin',
  register public.register,
  -- Text with {placeholders}.
  body text not null,
  -- The English original this variant was rewritten from.
  parent_variant_id uuid,
  source public.content_source not null default 'manual',
  usage_count integer not null default 0 check (usage_count >= 0),
  -- Call outcome -> count, e.g. {"interested": 3, "not_interested": 5}.
  outcome_counts jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, parent_variant_id)
    references public.content_variants (workspace_id, id) on delete set null (parent_variant_id)
);

create table public.objections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  text text not null,
  mix text check (mix ~ '^(te|hi|kn|ta|ml|mr|ur|en)(\+(te|hi|kn|ta|ml|mr|ur|en))*$'),
  suggested_response_id uuid,
  vertical text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, suggested_response_id)
    references public.content_variants (workspace_id, id) on delete set null (suggested_response_id)
);

-- ---------------------------------------------------------------------------
-- Timeline: activities and calls
-- ---------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Client-generated id: retrying the same write is a no-op, never a duplicate.
  client_id uuid not null default gen_random_uuid(),
  type public.activity_type not null,
  company_id uuid not null,
  contact_id uuid,
  contact_point_id uuid,
  body text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id)
    references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete set null (contact_id),
  foreign key (workspace_id, contact_point_id)
    references public.contact_points (workspace_id, id) on delete set null (contact_point_id)
);

create unique index activities_workspace_client_id_key on public.activities (workspace_id, client_id);
create index activities_company_timeline_idx on public.activities (workspace_id, company_id, occurred_at desc);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  activity_id uuid not null unique,
  outcome public.call_outcome not null,
  duration_seconds integer check (duration_seconds >= 0),
  duration_is_estimate boolean not null default false,
  who_answered text,
  mix_used public.lang_code[] not null default '{}',
  lost_reason text,
  -- objections.id values; arrays cannot carry foreign keys.
  objection_ids uuid[] not null default '{}',
  opener_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, activity_id)
    references public.activities (workspace_id, id) on delete cascade,
  foreign key (workspace_id, opener_id)
    references public.content_variants (workspace_id, id) on delete set null (opener_id)
);

-- ---------------------------------------------------------------------------
-- Tasks and pain points
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid,
  title text not null,
  due_at timestamptz,
  type public.task_type not null default 'todo',
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, company_id)
    references public.companies (workspace_id, id) on delete cascade
);

create index tasks_open_due_idx on public.tasks (workspace_id, due_at) where done_at is null;

create table public.pain_points (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null,
  activity_id uuid,
  -- Per-vertical taxonomy key, language-independent.
  process_category text,
  current_tool text,
  impact_type public.impact_type,
  severity smallint check (severity between 1 and 5),
  frequency text,
  -- Verbatim, original mixed-language text.
  quote text,
  -- Optional English gloss.
  quote_en text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, company_id)
    references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, activity_id)
    references public.activities (workspace_id, id) on delete set null (activity_id)
);

create index pain_points_company_idx on public.pain_points (workspace_id, company_id);

-- ---------------------------------------------------------------------------
-- Calendar, consent, import audit, targets, vertical defaults
-- ---------------------------------------------------------------------------

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- State name; null means nationwide.
  region text,
  date date not null,
  name text not null,
  kind public.holiday_kind not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (workspace_id, region, date, name)
);

create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Nulled (not deleted) when the line is erased, so the erasure stays on record.
  contact_point_id uuid,
  event public.consent_event not null,
  at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, contact_point_id)
    references public.contact_points (workspace_id, id) on delete set null (contact_point_id)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  file_name text not null,
  row_count integer not null default 0 check (row_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  batch_id uuid not null,
  row_number integer not null check (row_number >= 1),
  -- The raw CSV row, preserved for audit and re-import.
  raw jsonb not null,
  status public.import_row_status not null default 'pending',
  company_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, row_number),
  foreign key (workspace_id, batch_id)
    references public.import_batches (workspace_id, id) on delete cascade,
  foreign key (workspace_id, company_id)
    references public.companies (workspace_id, id) on delete set null (company_id)
);

-- Daily targets, effective from a date until superseded by a later row.
create table public.targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  effective_from date not null default current_date,
  dials integer not null default 0 check (dials >= 0),
  connects integer not null default 0 check (connects >= 0),
  conversations integer not null default 0 check (conversations >= 0),
  meetings_booked integer not null default 0 check (meetings_booked >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, effective_from)
);

create table public.vertical_defaults (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  vertical text not null,
  entry_offer text,
  long_term_opportunity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, vertical)
);

-- ---------------------------------------------------------------------------
-- Scoreboard (a view over calls, not a table)
-- ---------------------------------------------------------------------------

-- scoreboard_daily: call actuals per workspace per local day.
--   workspace_id
--   day              calendar day of activities.occurred_at in the workspace timezone
--   dials            every logged call
--   connects         someone picked up: outcome not in (no_answer, busy, wrong_number)
--   conversations    reached the right person: callback, interested, not_interested, meeting_booked
--   meetings_booked  outcome = meeting_booked
--   talk_seconds     sum of duration_seconds (unknown durations count as 0)
-- security_invoker = true: the view runs with the caller's privileges, so the
-- RLS on calls/activities/workspaces limits it to the caller's workspaces.
create view public.scoreboard_daily
with (security_invoker = true)
as
select
  c.workspace_id,
  (a.occurred_at at time zone w.timezone)::date as day,
  count(*)::integer as dials,
  (count(*) filter (where c.outcome not in ('no_answer', 'busy', 'wrong_number')))::integer as connects,
  (count(*) filter (where c.outcome in ('callback', 'interested', 'not_interested', 'meeting_booked')))::integer as conversations,
  (count(*) filter (where c.outcome = 'meeting_booked'))::integer as meetings_booked,
  coalesce(sum(c.duration_seconds), 0)::integer as talk_seconds
from public.calls c
join public.activities a on a.workspace_id = c.workspace_id and a.id = c.activity_id
join public.workspaces w on w.id = c.workspace_id
group by c.workspace_id, (a.occurred_at at time zone w.timezone)::date;

-- ---------------------------------------------------------------------------
-- Row-level security and updated_at triggers
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;

create policy "members read their workspaces"
  on public.workspaces for select to authenticated
  using (public.is_member(id));

create policy "members update their workspaces"
  on public.workspaces for update to authenticated
  using (public.is_member(id))
  with check (public.is_member(id));

create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Membership is read-only through the API in Phase 1 (managed server-side).
alter table public.members enable row level security;

create policy "members read their workspace's members"
  on public.members for select to authenticated
  using (public.is_member(workspace_id));

create trigger set_updated_at before update on public.members
  for each row execute function public.set_updated_at();

-- Every other tenant table: full access for members of the row's workspace.
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'contacts', 'contact_points', 'activities', 'calls', 'tasks',
    'pain_points', 'content_variants', 'objections', 'holidays', 'consent_log',
    'import_batches', 'import_rows', 'targets', 'vertical_defaults'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "members manage workspace rows" on public.%I
         for all to authenticated
         using (public.is_member(workspace_id))
         with check (public.is_member(workspace_id))',
      t
    );
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;
