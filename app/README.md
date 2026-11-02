# ThrivvSkale CRM (Phase 1: calling cockpit)

A cold-calling CRM for ThrivvSkale, built as an installable phone app (PWA).
Next.js 16 + Supabase (Postgres, Auth, Storage) + Tailwind. Phase 1 gives you:
sign in by email link, import the lead CSV, a ranked call queue, a one-tap
calling screen with outcome logging, WhatsApp follow-up templates, a Today
screen (due callbacks, week, scoreboard) and privacy tools (do-not-disturb,
export, erase).

Everything in this folder (`app/`) is the CRM. The repository root also holds an
older, unrelated app (`backend/`, `frontend/`, the root `README.md`); ignore it.

## Run it on your computer

Needs Node 22 (20.19 is the minimum) and Docker (for the local database).

```bash
cd app
npm ci
npx supabase start          # local database, auth and mail inbox
npm run env:local           # fills the Supabase values in .env.local from the local stack
npm run dev                 # http://localhost:3000
```

Sign-in emails from the local stack arrive in Mailpit at http://127.0.0.1:54324.

## Checks

| Command | What it checks |
|---|---|
| `npm run check` | typecheck + lint + unit tests (runs in CI) |
| `npm run build` | the production build (runs in CI) |
| `npm run test:db` | database tests; needs `npx supabase start` |
| `npx playwright install chromium` | one-time download of the browser the e2e tests use |
| `npm run test:e2e -- --workers=1` | browser tests; needs `npx supabase start` |

Notes for the browser tests:

- They run against the dev server (`next dev`), not `next start`: the glass design
  fixture page is built in production too but returns 404 there. Playwright starts the server for you on port 3100.
- The sign-in link (magic link) must open in the same browser that requested it; the tests do this in one page.
- Use `--workers=1`. The local sign-in email limit is hit with more workers.
- A cold first run takes several minutes (the dev server compiles each page on demand).
- Not in CI: they need the local Supabase stack and the dev server.

## Environment variables

Defined in `.env.example`. Real values go in `.env.local` (local) or in the Vercel
project settings (production). Never commit them.

| Variable | Where it is used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and server | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser and server; row-level security protects the data | no |
| `SUPABASE_SERVICE_ROLE_KEY` | server only; bypasses security, creates workspaces | YES |
| `ANTHROPIC_API_KEY` | server only; AI rewrite of templates | YES |
| `ANTHROPIC_MODEL` | server only; the model used for rewrites. Set it to `claude-sonnet-5-5`. Leave it out and the same value is used. | no |

## Deploy runbook

Steps marked **USER ACTION** need you: they create accounts, handle keys, or need
a person to judge something. Do them in order. Never paste a key into chat, a
commit or a screenshot.

### A. Hosted database (Supabase)

1. **USER ACTION** Create a Supabase account and a new project (pick a region
   near India, for example Mumbai). Save the database password in your password
   manager.
2. **USER ACTION** From `app/`, link and push the schema. This applies migrations
   `0001` to `0007` in order and nothing else:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Do NOT run `supabase/seed/seed.sql` on the hosted project. It only creates a
   demo workspace for local development. Your real workspace is created when you
   first sign in, and it receives the starter playbooks, objections and WhatsApp
   templates automatically. The holiday calendar is read from
   `supabase/seed/holidays.json` inside the app; the `holidays` table is not used
   for it, so there is nothing to load.
3. **USER ACTION** In the Supabase dashboard open Project Settings, API, and note
   the project URL, the `anon` key and the `service_role` key (you will paste them
   into Vercel in section B).
4. **USER ACTION** Authentication, URL Configuration: set Site URL to your final
   site address (for example `https://crm.yourdomain.com`, or the `.vercel.app`
   address until you have one). Under Redirect URLs add all of these (the email
   link comes back through `/auth/callback`, and a `next` value may follow it):
   - `https://<your-site>/auth/callback`
   - `https://<your-site>/auth/callback?next=*`
   - `https://*-<your-vercel-team-or-account>.vercel.app/auth/callback` (Vercel preview deployments)
   Without these, the sign-in link in the email is refused.
5. **USER ACTION** Authentication, Emails: the built-in mailer is limited to a few
   emails an hour. Before relying on it daily, add your own SMTP provider under
   Authentication, SMTP Settings.
6. Storage: migrations `0004` and `0006` create the private `voice-notes`
   bucket. Check in the dashboard, Storage, that it exists and is private.

### B. Hosting (Vercel)

0. **USER ACTION** This folder has no Git remote yet. Create an empty PRIVATE repository on GitHub, then from the repository root run `git remote add origin <url>` and `git push -u origin phase-1-calling-cockpit` (merge to main when you are happy).
1. **USER ACTION** Create a Vercel account and import that GitHub repository.
2. **USER ACTION** In the import screen set **Root Directory** to `app`. This is
   required: the repository root holds the older unrelated app. The framework
   preset should say Next.js; leave build and install commands as they are.
3. **USER ACTION** Add the five environment variables from the table above, for
   Production and Preview. Paste `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from step A3;
   `ANTHROPIC_API_KEY` from your Anthropic console; `ANTHROPIC_MODEL` =
   `claude-sonnet-5-5`. Do not give the service-role or Anthropic key a
   `NEXT_PUBLIC_` prefix.
4. **USER ACTION** Deploy. Open the site, sign in with your email, open the link
   from the email. You should land on Today.
5. Optional: Node version. The app runs on Node 20.19+. Consider setting the Vercel
   project to Node 22 and, once on Node 22 everywhere (also your computer and CI),
   deleting the `ws` WebSocket fallback in
   `src/lib/supabase/node-websocket-fallback.ts` and the `ws` dependency.

### C. Load the real leads

1. **USER ACTION** Signed in on the production site, open More, Import leads.
2. **USER ACTION** Choose `app/data/Thrivvskale_Leads_CRM_Import.csv`, press
   Preview, check the counts (about 297 leads), then Confirm import.
3. Importing the same file again changes nothing twice, so a failed or doubled
   attempt is safe.

### D. Before you rely on it (USER ACTION checks)

1. **Holidays.** `supabase/seed/holidays.json` holds the 2026 dates and
   PROVISIONAL 2027 rows (names end in "(provisional)", taken from Google
   Calendar's India feed). Compare the 2026 Andhra Pradesh, Telangana and
   Karnataka dates with each state's official government list (see
   `supabase/seed/holidays.sources.md` for what was and was not read from an
   official source, and the "points to check by hand" list there). Replace the
   2027 provisional rows with the official Telangana/AP G.O. and Karnataka DPAR
   lists once published (late Nov to Dec 2026). Then make
   `supabase/seed/seed.sql` agree: its demo holiday rows are local-only samples
   and differ from `holidays.json`; either trim them or copy the verified dates.
   The app only reads `holidays.json`.
2. **Real openers.** Send 5 to 10 real opening lines you actually use. They will
   be saved as the few-shot examples for the AI rewrite in
   `supabase/seed/openers.json` (not created yet; the format is decided when you
   supply them).
3. **Do-not-disturb on the hosted database.** The Today screen hides tasks of
   do-not-disturb companies with a database filter (`readOpenTasks`, an
   "embedded null" filter) that was only proven on the local database. On the
   hosted project: mark one lead do-not-disturb, give it a task due now, and
   check it does not appear under "Due now". Clear the flag afterwards.
4. **Phone smoke test.** On your phone open the site in Chrome, sign in, choose
   Add to Home screen. Then: open the call queue, press Call (your dialer opens),
   come back, log an outcome, check the callback shows on Today, and open a
   WhatsApp follow-up link. Try one outcome with the phone in airplane mode and
   confirm it sends when you are back online.

5. **Run the browser tests once cold.** Before the first deploy run `npm run test:e2e -- --workers=1` on your computer (about 10 minutes) and confirm all pass. CI does not run them; if you later add them to CI, run them against a production build (`next build` + `next start`) where possible, noting the glass design fixture page returns 404 in production.

### E. Phase 1 shipped

_This section is filled in after the deploy (production address, deploy date,
what the smoke test showed, anything left over). Not shipped yet._

## Troubleshooting

- **Sign-in link says invalid or expired.** Open it in the same browser that asked
  for it, and check the redirect URLs in step A4.
- **"Too many emails" on sign-in.** The email limit was reached; wait an hour or
  add SMTP (step A5).
- **Build or sign-in error naming a module.** Server errors are written as
  `[module] step: reason`; search the code for the module name in brackets.
