-- Local development seed, applied by `npx supabase db reset` (and on first
-- `npx supabase start`). Generic demo data only: no users, no credentials,
-- no real businesses or phone numbers.
--
-- The demo workspace has a fixed id so a local dev user can be attached to it:
--   insert into public.members (workspace_id, user_id)
--   values ('00000000-0000-4000-8000-000000000001', '<auth.users id>');
-- Until then it has no members, so RLS hides it from every API client.

insert into public.workspaces (id, name, home_state, timezone, default_language_mix)
values (
  '00000000-0000-4000-8000-000000000001',
  'Demo Workspace',
  'Telangana',
  'Asia/Kolkata',
  '{te,hi,en}'
);

-- Placeholder offers per vertical (names match src/lib/domain.ts); real
-- values are entered per workspace.
insert into public.vertical_defaults (workspace_id, vertical, entry_offer, long_term_opportunity)
values
  ('00000000-0000-4000-8000-000000000001', 'Interiors & Modular',
   'Demo entry offer: free enquiry-flow review', 'Demo opportunity: project tracking and follow-ups'),
  ('00000000-0000-4000-8000-000000000001', 'Coaching & Education',
   'Demo entry offer: free admissions-funnel review', 'Demo opportunity: batch and fee management'),
  ('00000000-0000-4000-8000-000000000001', 'Clinics, Diagnostics & Pharmacies',
   'Demo entry offer: free appointment-flow review', 'Demo opportunity: patient reminders and reports'),
  ('00000000-0000-4000-8000-000000000001', 'Manufacturing & Furniture',
   'Demo entry offer: free order-tracking review', 'Demo opportunity: inventory and dispatch workflow'),
  ('00000000-0000-4000-8000-000000000001', 'Real Estate & Construction',
   'Demo entry offer: free lead-handling review', 'Demo opportunity: site-visit pipeline'),
  ('00000000-0000-4000-8000-000000000001', 'Automobile & Driving Schools',
   'Demo entry offer: free booking-flow review', 'Demo opportunity: slot booking and reminders');

-- Fixed-date holidays only (no lunar-calendar festivals to get wrong).
insert into public.holidays (workspace_id, region, date, name, kind)
values
  ('00000000-0000-4000-8000-000000000001', null, '2026-01-26', 'Republic Day', 'public'),
  ('00000000-0000-4000-8000-000000000001', 'Telangana', '2026-06-02', 'Telangana Formation Day', 'public'),
  ('00000000-0000-4000-8000-000000000001', null, '2026-08-15', 'Independence Day', 'public'),
  ('00000000-0000-4000-8000-000000000001', null, '2026-10-02', 'Gandhi Jayanti', 'public'),
  ('00000000-0000-4000-8000-000000000001', null, '2027-01-26', 'Republic Day', 'public');

insert into public.targets (workspace_id, effective_from, dials, connects, conversations, meetings_booked)
values ('00000000-0000-4000-8000-000000000001', '2026-01-01', 60, 20, 10, 2);
