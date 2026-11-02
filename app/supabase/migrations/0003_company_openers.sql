-- ThrivvSkale CRM: per-company call openers (Task 14 fix).
--
-- A lead's CSV "Call Opener" is written around that lead's own signal, so it
-- must not show on other leads. content_variants gets an optional company_id:
-- null = a generic variant for the workspace (as before); set = written for
-- that one company, deleted with it. Same composite (workspace_id, id) foreign
-- key pattern as the other company links. Row-level security is unchanged
-- (it already filters on workspace_id).

alter table public.content_variants add column company_id uuid;

alter table public.content_variants
  add constraint content_variants_company_fkey
  foreign key (workspace_id, company_id)
  references public.companies (workspace_id, id) on delete cascade;

create index content_variants_company_idx
  on public.content_variants (workspace_id, company_id, kind)
  where company_id is not null;
