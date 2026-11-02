-- ThrivvSkale CRM: playbooks and the seeded content library (Task 17).
--
-- Phase 1 has no services table, so a playbook is keyed by a service_key
-- ('ai_website', 'crm_setup', ...) per workspace. Objections and WhatsApp
-- templates reuse the existing objections and content_variants tables.
-- seed_key marks rows written by the starter content, so seeding twice
-- updates nothing and duplicates nothing: unique (workspace_id, seed_key)
-- (rows a user writes by hand have a null key, and nulls never collide).
-- title names a template in the outcome sheet's picker.

create table public.playbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_key text not null check (service_key ~ '^[a-z][a-z0-9_]*$'),
  title text not null,
  pitch text not null,
  discovery_questions jsonb not null default '[]' check (jsonb_typeof(discovery_questions) = 'array'),
  deliverables jsonb not null default '[]' check (jsonb_typeof(deliverables) = 'array'),
  -- Stays empty until the owner supplies prices.
  pricing_guidance text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, service_key)
);

alter table public.content_variants add column seed_key text;
alter table public.content_variants add column title text;
alter table public.content_variants
  add constraint content_variants_seed_key_key unique (workspace_id, seed_key);

alter table public.objections add column seed_key text;
alter table public.objections
  add constraint objections_seed_key_key unique (workspace_id, seed_key);

alter table public.playbooks enable row level security;

create policy "members manage workspace rows" on public.playbooks
  for all to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));

create trigger set_updated_at before update on public.playbooks
  for each row execute function public.set_updated_at();
