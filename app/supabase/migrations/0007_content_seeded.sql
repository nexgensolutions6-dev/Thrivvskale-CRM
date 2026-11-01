-- Starter content marker: when a workspace's starter content (playbooks,
-- objections, templates) was fully seeded, or deliberately left unseeded
-- (healed workspace). Null means "seed (or finish seeding) at next sign-in".
-- Existing workspaces were either seeded or healed on purpose, so they are
-- marked now. Members may update workspaces (existing policy); forging this
-- column only affects their own starter content.

alter table public.workspaces add column content_seeded_at timestamptz;

update public.workspaces set content_seeded_at = now();
