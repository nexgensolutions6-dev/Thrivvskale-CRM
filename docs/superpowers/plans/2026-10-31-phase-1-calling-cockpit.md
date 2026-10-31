# ThrivvSkale CRM — Phase 1: Calling Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hosted, phone-and-laptop cold-calling cockpit that imports the 297 leads and lets one user call them in a mixed-language, glass-styled interface without losing a follow-up.

**Architecture:** A Next.js App Router PWA on Vercel talks to Supabase (Postgres, Auth, Storage) with row-level security on every table. Business logic (phone, import mapping, queue ranking, scheduling, language matching, WhatsApp links, glass mode) lives in pure, unit-tested TypeScript modules under `src/lib`; screens in `src/app` and `src/components` are thin and call them. Call logging goes through an offline outbox with idempotency keys.

**Tech Stack:** TypeScript, Next.js (App Router), Tailwind CSS, Supabase (local CLI + hosted), papaparse, Vitest, Playwright, Anthropic SDK (server-side only). Local database tests need Docker Desktop for `supabase start`. Pin versions with the lockfile at scaffold time.

**Spec:** `docs/superpowers/specs/2026-10-31-thrivvskale-crm-design.md` (rev 2). Phase 1 only (spec Section 16, item 1). Deals, Insights, quotes, invoices, telephony, team roles and the client portal are out of scope (spec Section 17).

## Global Constraints

- Hosting and stack: Next.js (App Router) installable PWA on Vercel; Supabase Postgres, Auth, Storage.
- Every table carries `id`, `workspace_id`, `created_at`, `updated_at`; row-level security restricts rows to workspace members.
- Frappe CRM, ERPNext and Twenty are design references only; no code is copied (AGPL/GPL).
- Phones are E.164 `+91…`; timezone is IST (`Asia/Kolkata`); default working week is Mon–Sat.
- Tier: core = Interiors & Modular, Coaching & Education, Clinics, Diagnostics & Pharmacies, Manufacturing & Furniture; exploratory = Real Estate & Construction, Automobile & Driving Schools.
- Queue excludes DND-flagged, `needs_number` and wrong-number companies; callbacks and tasks due now or overdue always come first.
- Landline numbers never show a WhatsApp button.
- A mix profile is an ordered set of languages, primary first, plus script (`latin` default, `native`) and register (`formal|casual`).
- Content fallback order: exact mix → shares the primary language → English; the UI shows which was used.
- WhatsApp text is UTF-8 percent-encoded into `wa.me` links; over-long messages fall back to copy-to-clipboard.
- AI rewrite runs server-side only, sends only template text (no lead personal data), always produces an editable draft, and is never auto-sent.
- Body text contrast ≥ 4.5:1 and large text ≥ 3:1 against the worst-case wallpaper region under each panel.
- At most 3 live `backdrop-filter` surfaces in any mobile viewport; scrolling lists never use live blur; Lite glass replaces blur with a translucent solid when needed.
- Navigation exists once: dock on desktop, bottom tab bar on mobile. Phase 1 destinations: Today, Call, Leads, plus More (Playbooks, Import, Settings). Deals and Insights are added in Phase 2.
- Call outcomes use the exact set: `no_answer|busy|wrong_number|callback|gatekeeper|interested|not_interested|meeting_booked`.

## Review Focus

Failure modes the spec implies that no spec line tests; each is pinned in the named task.

1. CSV exported from Excel starts with a BOM and has quoted commas or newlines inside fields → import must still map every column (Task 5).
2. Junk or platform domains (`netlify.app`, `justdial.com`, `chatgpt.com`, `business.site`) used as a dedupe key would merge unrelated businesses → never a match key (Task 6).
3. Device timezone not IST (laptop travelling, CI in UTC) must not shift callback times or the "today" boundary (Task 8).
4. The same outcome submitted twice (double tap, offline flush retry) must create one call (Task 15).
5. Returning from the dialer after cancelling the call (a few seconds away) must not log a call (Task 15).

---

### Task 1: Scaffold, tooling and domain types

**Files:**
- Create: Next.js + Tailwind project in `A:\ThrivvSkale\CRM`, `src/lib/domain.ts`, `vitest.config.ts`, `playwright.config.ts`, `package.json` scripts, `.gitignore`, `.env.example`
- Test: `tests/unit/smoke.test.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces in `src/lib/domain.ts`: `Tier = 'core'|'exploratory'`; `Priority = 'A'|'B'|'C'`; `WaStatus = 'verified'|'unconfirmed'|'landline'|'none'`; `LangCode = 'te'|'hi'|'kn'|'ta'|'ml'|'mr'|'ur'|'en'`; `Mix = LangCode[]`; `Script = 'latin'|'native'`; `Register = 'formal'|'casual'`; `Outcome` (the exact eight values above); `CORE_VERTICALS: readonly string[]`; `tierForVertical(v: string): Tier`.
- Produces npm scripts: `test` (Vitest unit), `test:db`, `test:e2e`, `check` (typecheck + lint + test).

- [ ] **Step 1: Write the failing test** `tests/unit/smoke.test.ts`: `tierForVertical('Interiors & Modular') === 'core'`, `tierForVertical('Real Estate & Construction') === 'exploratory'`, `tierForVertical('Automobile & Driving Schools') === 'exploratory'`, and an unknown vertical returns `'exploratory'`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/smoke.test.ts` → FAIL (module missing).
- [ ] **Step 3: Scaffold** the project, `git init`, add Vitest and Playwright, implement `src/lib/domain.ts`.
- [ ] **Step 4: Run** `npm run check` → PASS.
- [ ] **Step 5: Add** `tests/e2e/smoke.spec.ts` asserting the home page responds 200; run `npx playwright test tests/e2e/smoke.spec.ts` → PASS.
- [ ] **Step 6: Commit** `chore: scaffold app, tooling and domain types`.

### Task 2: Phone normalisation

**Files:**
- Create: `src/lib/phone.ts`
- Test: `tests/unit/phone.test.ts`

**Interfaces:**
- Produces: `normalizePhone(raw: string): { e164: string; kind: 'mobile' | 'landline' } | null`.

- [ ] **Step 1: Write failing tests**: `'+919866139900'` → `{e164:'+919866139900', kind:'mobile'}`; `'09866139900'`, `'98661 39900'`, `'+91 98661-39900'`, `'919866139900'` all → same e164; `'+914023456789'` → `kind:'landline'`; `'12345'`, `''`, `'abc'` → `null`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/phone.test.ts` → FAIL.
- [ ] **Step 3: Implement** `normalizePhone`: strip non-digits, drop leading `0` or `91`, accept 10 national digits; mobile if the first digit is 6–9, landline if 2–5 (Hyderabad `40…` is landline), else `null`.
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `feat: Indian phone normalisation`.

### Task 3: Database schema, RLS and seed

**Files:**
- Create: `supabase/config.toml` (via CLI), `supabase/migrations/0001_phase1_core.sql`, `supabase/seed/seed.sql`, `src/lib/db/types.ts` (generated)
- Test: `tests/db/rls.test.ts`

**Interfaces:**
- Produces tables per spec Section 5, Phase 1 subset: `workspaces`, `members`, `companies`, `contacts`, `contact_points`, `activities`, `calls`, `tasks`, `pain_points`, `content_variants`, `objections`, `holidays`, `consent_log`, `import_batches`, `import_rows`, `targets`, `vertical_defaults(vertical, entry_offer, long_term_opportunity)`, plus a `scoreboard_daily` **view** (computed from `calls`, not a table).
- Produces SQL function `is_member(ws uuid) returns boolean`; unique index on `activities(workspace_id, client_id)` for idempotency; `pg_trgm` enabled.
- Produces generated TypeScript types in `src/lib/db/types.ts` via `supabase gen types`.

- [ ] **Step 1: Write failing tests** in `tests/db/rls.test.ts` using two Supabase users on the local stack: (a) every public table that has a `workspace_id` column has `relrowsecurity = true` (query `pg_class`/`information_schema`; result list must be empty); (b) user A cannot `select` user B's company; (c) an anonymous client reads zero rows from `companies`; (d) user A cannot insert a company with B's `workspace_id`; (e) inserting two `activities` with the same `(workspace_id, client_id)` fails.
- [ ] **Step 2: Run** `npx supabase start && npm run test:db` → FAIL.
- [ ] **Step 3: Write** the migration with RLS policies using `is_member`, column sets exactly as spec Section 5, and `updated_at` triggers.
- [ ] **Step 4: Run** `npx supabase db reset && npm run test:db` → PASS.
- [ ] **Step 5: Generate types**, run `npm run check` → PASS.
- [ ] **Step 6: Commit** `feat: phase 1 schema with row-level security`.

### Task 4: Auth and workspace bootstrap

**Files:**
- Create: `src/lib/workspace.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`
- Test: `tests/db/workspace.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: schema from Task 3; `Mix` from Task 1.
- Produces: `ensureWorkspace(userId: string): Promise<{ workspaceId: string }>` (idempotent; creates workspace with `home_state='Telangana'`, default mix `['te','hi','en']`, working days Mon–Sat, timezone `Asia/Kolkata`, and an owner `members` row); `getSessionWorkspace(): Promise<{ userId: string; workspaceId: string }>` for server components.

- [ ] **Step 1: Write failing tests**: calling `ensureWorkspace` twice for one user yields one workspace and one member row with role `owner`; a visitor to `/leads` unauthenticated is redirected to `/login`.
- [ ] **Step 2: Run** both tests → FAIL.
- [ ] **Step 3: Implement** Supabase email magic-link login, the auth callback that calls `ensureWorkspace`, and the middleware guarding `(app)` routes.
- [ ] **Step 4: Run** `npm run test:db && npx playwright test tests/e2e/auth.spec.ts` → PASS.
- [ ] **Step 5: Commit** `feat: auth and workspace bootstrap`.

### Task 5: CSV parsing and row mapping

**Files:**
- Create: `src/lib/import/parseLeadsCsv.ts`, `src/lib/import/mapLeadRow.ts`, `tests/fixtures/leads-sample.csv` (first 24 rows of the real file plus one synthetic landline row)
- Test: `tests/unit/import.test.ts`

**Interfaces:**
- Consumes: `normalizePhone` (Task 2), `tierForVertical` (Task 1).
- Produces: `parseLeadsCsv(text: string): Record<string, string>[]`; `MappedLead = { company: { name; vertical; tier; area; city; state; websiteUrl: string|null; websiteStatus; websiteInvalid: boolean; googleRating: number|null; googleReviews: number|null; source; priority: Priority; baseScore: number; intentSignal: string|null; problemEvidence: string|null; entryOffer: string|null; longTermOpportunity: string|null; stage: string }; points: { e164: string; kind: 'business'|'landline'; waStatus: WaStatus }[]; tags: string[]; opener: string|null; needsNumber: boolean }`; `mapLeadRow(row: Record<string,string>): MappedLead`.

- [ ] **Step 1: Write failing tests** (spec Section 14):
  - Divyank row → company `{name:'Divyank Industries (Water Purification)', vertical:'Manufacturing & Furniture', tier:'core', priority:'A', baseScore:65}`, `points` equal `[{e164:'+919866139900', kind:'business', waStatus:'unconfirmed'}]`, `tags` equal `['Manufacturing & Furniture','Priority A','High intent']`.
  - Abhinav row (phone `+919154755802`, WhatsApp `+918989545454`, status Verified) → two points; the WhatsApp number has `waStatus:'verified'`, the phone `'unconfirmed'`.
  - AluBest row (WhatsApp equals phone, Verified) → exactly one point, `waStatus:'verified'`.
  - Dr. Satish row (no phone) → `needsNumber:true`, `points:[]`.
  - Synthetic landline row (`+914023456789`, status Landline) → `kind:'landline'`, `waStatus:'landline'`.
  - Vision VVK Farms (Real Estate) → `tier:'exploratory'`.
  - `websiteInvalid` is true for `justdial.com/Ahmedabad/...`, `chatgpt.com/share/...`, `https://netlify.app`; false for `https://alubestinteriors.netlify.app` and `https://divyankindustries.com`.
  - **Review Focus 1:** `parseLeadsCsv('\uFEFF' + csv)` returns the same first header `'Company Name'`; a field containing `"a, b"` and a field containing a newline inside quotes parse as single values.
- [ ] **Step 2: Run** `npx vitest run tests/unit/import.test.ts` → FAIL.
- [ ] **Step 3: Implement** `parseLeadsCsv` with papaparse (strip BOM, `skipEmptyLines`) and `mapLeadRow`. The `Description` column is ignored (spec Section 14). `Not verified` → `unconfirmed`, `Verified` → `verified`, `Landline` → `landline`, `No number yet` → `none`.
- [ ] **Step 4: Run** the tests → PASS.
- [ ] **Step 5: Commit** `feat: lead CSV parsing and mapping`.

### Task 6: Import runner and Import screen

**Files:**
- Create: `src/lib/import/importLeads.ts`, `src/lib/import/platformDomains.ts`, `src/app/(app)/more/import/page.tsx`, `data/Thrivvskale_Leads_CRM_Import.csv` (copy of the user's file)
- Test: `tests/db/import.test.ts`, `tests/e2e/import.spec.ts`

**Interfaces:**
- Consumes: `parseLeadsCsv`, `mapLeadRow` (Task 5); schema (Task 3); `getSessionWorkspace` (Task 4).
- Produces: `PLATFORM_DOMAINS: readonly string[]` (includes `netlify.app`, `justdial.com`, `chatgpt.com`, `business.site`, `facebook.com`, `instagram.com`, `wixsite.com`); `importLeads(db: SupabaseClient, workspaceId: string, rows: MappedLead[], rawRows: Record<string,string>[]): Promise<ImportReport>`; `ImportReport = { inserted: number; updated: number; needsNumber: number; websiteInvalid: number }`.

- [ ] **Step 1: Write failing tests** in `tests/db/import.test.ts`: importing the full real CSV gives 297 companies, `needsNumber` 4, and stores 297 `import_rows` with the raw row; importing it a second time yields `inserted:0` and still 297 companies; two synthetic companies with different phones but the same website `https://netlify.app` stay two companies (**Review Focus 2**); a third with the same phone as an existing company is `updated`, not duplicated; `vertical_defaults` holds the most frequent entry offer per vertical, and a company whose offer equals its vertical default has `entry_offer = null`.
- [ ] **Step 2: Run** `npm run test:db -- import` → FAIL.
- [ ] **Step 3: Implement** `importLeads`: match on any normalised phone, else on website domain only when the domain is valid and not in `PLATFORM_DOMAINS`; set the 4 no-number companies `needs_number` and create a `find number` task for each.
- [ ] **Step 4: Run** the DB test → PASS.
- [ ] **Step 5: Build** the Import screen (upload, preview counts, confirm); write `tests/e2e/import.spec.ts` that uploads the fixture and sees "inserted" counts; run → PASS.
- [ ] **Step 6: Commit** `feat: idempotent lead import`.

### Task 7: Queue ranking and dynamic score

**Files:**
- Create: `src/lib/queue/rank.ts`, `src/lib/queue/dynamicScore.ts`, `src/lib/queue/weights.ts`
- Test: `tests/unit/queue.test.ts`

**Interfaces:**
- Consumes: `Tier`, `Priority`, `Mix`, `Outcome` (Task 1).
- Produces: `QueueItem = { companyId: string; tier: Tier; priority: Priority; score: number; dueAt: Date|null; dnd: boolean; needsNumber: boolean; wrongNumber: boolean; vertical: string; area: string; mix: Mix; websiteStatus: string }`; `QueueFilters = { vertical?: string; area?: string; primaryLang?: string; websiteStatus?: string }`; `rankQueue(items: QueueItem[], opts: { now: Date; filters?: QueueFilters }): QueueItem[]`; `dynamicScore(base: number, signals: { intent: boolean; outcomes: Outcome[] }): number`.
- Pinned weights in `weights.ts` (adjustable constants): intent +10, `interested` +15, `meeting_booked` +20, each `gatekeeper` −5 (cap −15), each `no_answer` −2 (cap −10).

- [ ] **Step 1: Write failing tests**: an item with `dueAt <= now` ranks before any never-called item regardless of tier; among never-called, core before exploratory, then A before B before C, then higher score first; DND, `needsNumber` and `wrongNumber` items are absent; filtering by `vertical` removes others; `dynamicScore(50, {intent:true, outcomes:['interested']}) === 75`; four `no_answer` outcomes lower the score by 8, ten by at most 10.
- [ ] **Step 2: Run** `npx vitest run tests/unit/queue.test.ts` → FAIL.
- [ ] **Step 3: Implement** both functions per the signatures; the intent boost lives inside `dynamicScore` (decision recorded: boost is a score input, not a separate sort key).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: queue ranking and dynamic score`.

### Task 8: Callback scheduling and holidays

**Files:**
- Create: `src/lib/calendar/schedule.ts`, `src/lib/calendar/windows.ts`, `supabase/seed/holidays.json`
- Test: `tests/unit/schedule.test.ts`

**Interfaces:**
- Produces: `Holiday = { region: string; date: string /* YYYY-MM-DD */; name: string }`; `BEST_WINDOWS: Record<string, { start: string; end: string }>` (starting defaults, editable later, to be tuned from connect data: clinics `14:00–16:00`, coaching `11:00–15:00`, manufacturing `10:30–12:30`, interiors `11:00–13:00`, other `11:00–13:00`); `nextCallbackSlot(from: Date, opts: { state: string; holidays: Holiday[]; workingDays: number[] /* 1=Mon..7=Sun */; window: { start: string; end: string }; minDays?: number }): Date` (default `minDays` 1; all date logic in `Asia/Kolkata`).

- [ ] **Step 1: Write failing tests** with fixture holidays: Saturday evening → Monday at window start (Sunday skipped); a Telangana holiday on the next weekday is skipped for state `Telangana` but not for `Karnataka`; **Review Focus 3:** the same input gives the same result when `process.env.TZ` is `UTC` and `America/New_York` (run through `vi.stubEnv`/child run), and `from = 2026-11-01T20:00:00Z` (already Nov 2 in IST) is treated as Nov 2.
- [ ] **Step 2: Run** `npx vitest run tests/unit/schedule.test.ts` → FAIL.
- [ ] **Step 3: Implement** with `Intl.DateTimeFormat` and `timeZone: 'Asia/Kolkata'`, no dependency on the process timezone. Populate `holidays.json` from the official Telangana, Karnataka and Andhra Pradesh government holiday lists for the current and next year; the user verifies the dates before release (Task 19).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: holiday-aware callback scheduling`.

### Task 9: Language engine

**Files:**
- Create: `src/lib/language/mix.ts`, `src/lib/language/variants.ts`
- Test: `tests/unit/language.test.ts`

**Interfaces:**
- Consumes: `Mix`, `Script`, `Register` (Task 1).
- Produces: `ContentVariant = { id: string; kind: 'opener'|'template'|'script'|'objection'; mix: Mix; script: Script; register: Register; body: string; parentVariantId: string|null }`; `pickVariant(variants: ContentVariant[], want: { mix: Mix; script: Script; register: Register }): { variant: ContentVariant; match: 'exact'|'primary'|'english' } | null`; `fillTemplate(body: string, ctx: { name?: string; company?: string; honorific?: string }): string` (replaces `{name}`, `{company}`, `{honorific}`, leaves unknown placeholders untouched); `honorificFor(primary: LangCode, register: Register): string` (formal: te `garu`, hi `ji`, kn `avare`, en `sir/madam`; casual: `sir` for all); `nextMixProfile(current: Mix, recentSpoken: Mix[]): Mix` (most frequent among the last 3 spoken mixes; ties go to the most recent; empty list keeps current).

- [ ] **Step 1: Write failing tests**: wanted `['te','hi','en']` with a variant of the exact mix → `match:'exact'`; only `['te','en']` available → `'primary'`; only `['en']` → `'english'`; none → `null`; script mismatch prefers the same-script variant at the same match level; `fillTemplate('Hi {name}{honorific}, {company}', …)` fills all three and keeps `{unknown}`; `nextMixProfile(['te','hi','en'], [['kn','en'],['kn','en'],['te','en']])` → `['kn','en']`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/language.test.ts` → FAIL.
- [ ] **Step 3: Implement** the four functions per the signatures.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: mixed-language profile and variant matching`.

### Task 10: WhatsApp links and number confirmation

**Files:**
- Create: `src/lib/whatsapp/link.ts`, `src/app/actions/whatsapp.ts`
- Test: `tests/unit/whatsapp.test.ts`, `tests/db/whatsapp.test.ts`

**Interfaces:**
- Consumes: `WaStatus` (Task 1); schema (Task 3).
- Produces: `buildWaLink(point: { e164: string; waStatus: WaStatus }, text: string): { url: string; copyOnly: boolean } | null` (null for `landline` and `none`; `copyOnly:true` and a URL without `text` when the encoded URL exceeds 2000 characters); server action `confirmWhatsApp(contactPointId: string, hasWhatsApp: boolean): Promise<void>` (sets `verified` or `none`, appends an activity).

- [ ] **Step 1: Write failing tests**: Telugu text `'నమస్తే sir'` yields a URL whose `text` parameter decodes back to the same string; landline and `none` → `null`; a 3000-character message → `copyOnly:true`; a Hinglish message with an emoji round-trips; DB test: `confirmWhatsApp(id, false)` sets status `none`, and the point no longer yields a link.
- [ ] **Step 2: Run** unit and DB tests → FAIL.
- [ ] **Step 3: Implement** `buildWaLink` (`https://wa.me/<digits>?text=<encodeURIComponent>`) and the action.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: whatsapp click-to-chat links`.

### Task 11: AI-assisted rewrite

**Files:**
- Create: `src/lib/language/rewrite.server.ts`, `src/app/actions/rewrite.ts`
- Test: `tests/unit/rewrite.test.ts`

**Interfaces:**
- Consumes: `ContentVariant` (Task 9); schema (Task 3).
- Produces: `rewriteVariant(input: { text: string; mix: Mix; script: Script; register: Register; examples: { from: string; to: string }[] }, client?: Pick<Anthropic, 'messages'>): Promise<string>` (`Anthropic` from the SDK; the parameter lets tests inject a mock); server actions `createAiDraft(variantId: string, mix: Mix, script: Script, register: Register): Promise<{ variantId: string }>` (inserts a `content_variants` row with `source='ai_draft'` and `parent_variant_id`) and `approveDraft(variantId: string): Promise<void>` (sets `ai_approved`). Few-shot examples are the 5 most recent `ai_approved` variants with the same mix and script.

Executor: load the `claude-api` skill before this task. Read the model id from env `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`).

- [ ] **Step 1: Write failing tests** with a mocked client: the prompt includes the English text, the target mix/script and the examples; it contains no company, contact or phone strings; the module imports `server-only`; `createAiDraft` stores `source='ai_draft'` with the parent id; `approveDraft` flips it and the next call's examples include it.
- [ ] **Step 2: Run** `npx vitest run tests/unit/rewrite.test.ts` → FAIL.
- [ ] **Step 3: Implement** with the Anthropic SDK; the API key is read only on the server.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: ai-assisted mixed-language rewrite`.

### Task 12: Glass design system

**Files:**
- Create: `src/styles/glass.css`, `src/lib/glass/mode.ts`, `src/lib/glass/contrast.ts`, `src/components/glass/Surface.tsx`, `public/wallpapers/*.avif|webp` (6), `src/lib/glass/wallpapers.json` (worst-case sample colour per wallpaper region)
- Test: `tests/unit/glass.test.ts`, `tests/e2e/glass.spec.ts`

**Interfaces:**
- Produces: `chooseGlassMode(env: { deviceMemoryGb?: number; prefersReducedTransparency: boolean; forcedColors: boolean; measuredFps?: number; userOverride?: 'full'|'lite' }): 'full'|'lite'|'solid'` (`forcedColors` → `solid`; `userOverride` next; reduced transparency → `lite`; `deviceMemoryGb <= 2` → `lite`; `measuredFps < 40` → `lite`; else `full`); `contrastRatio(fg: string, bg: string): number`; `compositeOver(tint: { r; g; b; a }, bg: { r; g; b }): { r; g; b }`; `<Surface level="L1"|"L2"|"L3" />`. Level values per spec Section 3A table; text tokens defined in `glass.css`.

- [ ] **Step 1: Write failing tests**: `chooseGlassMode` for each rule above; `contrastRatio('#000','#fff')` = 21 (±0.01); for every text token × every wallpaper worst-case sample, the composited L3 and L2 backgrounds give ratio ≥ 4.5 (body) and ≥ 3 for large-text tokens, in both light and dark themes.
- [ ] **Step 2: Run** `npx vitest run tests/unit/glass.test.ts` → FAIL.
- [ ] **Step 3: Implement** the functions, tokens and `Surface` (gradient edge, inset highlight, grain, concentric radii, pointer-following highlight on desktop only). Provide `lite` and `solid` variants of every level.
- [ ] **Step 4: Run** the unit test → PASS.
- [ ] **Step 5: Write** `tests/e2e/glass.spec.ts`: at 390px width a page with the dock, one card and a 50-row list has ≤ 3 elements whose computed `backdrop-filter` is not `none`; list rows have none; `forced-colors: active` renders with solid surfaces; take baseline screenshots of L1, L2, L3 in light and dark. Run → PASS.
- [ ] **Step 6: Commit** `feat: glass design system with lite fallback`.

### Task 13: App shell and PWA

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/shell/{MenuBar,Dock,TabBar,CommandPalette}.tsx`, `public/manifest.webmanifest`, `public/sw.js`, `src/app/(app)/more/page.tsx`
- Test: `tests/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `Surface`, `chooseGlassMode` (Task 12); `getSessionWorkspace` (Task 4).
- Produces: routes `/today`, `/call`, `/leads`, `/more`; a ⌘K/Ctrl+K command palette with `registerCommand(c: { id: string; label: string; run: () => void }): () => void`; MenuBar items: quick-add, ⌘K, today's targets, sync status, clock.

- [ ] **Step 1: Write failing tests**: at 1280px width a dock with Today, Call, Leads, More is visible and no tab bar; at 390px the tab bar is visible and the dock is not; there is exactly one `nav` landmark per viewport size; `document.scrollingElement.scrollWidth <= window.innerWidth` at both sizes; Ctrl+K opens the palette and typing "leads" navigates; the manifest is linked and a service worker registers; the Settings page (`/more/settings`) has a "Lite glass" toggle whose choice persists across reloads (stored in `localStorage` inside try/catch) and sets `userOverride` for `chooseGlassMode`.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/shell.spec.ts` → FAIL.
- [ ] **Step 3: Implement** the shell and Settings page; the service worker caches the app shell and serves an offline fallback page.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: app shell, dock, tab bar and PWA`.

### Task 14: Leads list, search and lead workspace

**Files:**
- Create: `supabase/migrations/0002_search.sql`, `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/[id]/page.tsx`, `src/components/lead/{LeadHeader,WhyCall,WhatToSell,OpenerPicker,PeoplePanel,LeadTabs}.tsx`
- Test: `tests/db/search.test.ts`, `tests/e2e/lead.spec.ts`

**Interfaces:**
- Consumes: schema (Task 3), `pickVariant` (Task 9), `buildWaLink` (Task 10), `Surface` (Task 12).
- Produces: SQL function `search_leads(ws uuid, q text, lim int default 30) returns setof companies` (matches company name, area, tags, contact `name` and `name_latin` using `simple` text search plus `pg_trgm`); `getLead(id: string): Promise<LeadView>` where `LeadView` includes `entryOffer` resolved as `company.entry_offer ?? vertical_defaults.entry_offer`.

- [ ] **Step 1: Write failing tests**: a contact `రమేష్` with `name_latin='ramesh'` and one `रमेश` with `name_latin='ramesh'` are both found by `search_leads(…, 'ramesh')`; a typo `'ramsh'` still finds them; `'Uppal'` finds companies by area; e2e: opening Divyank shows its Problem/Evidence, Entry Offer and opener; a lead with `entry_offer = null` shows the vertical default; a landline contact point shows no WhatsApp button; the lead page has no horizontal scroll at 390px; `recheckSite(companyId: string): Promise<{ websiteStatus: string }>` (server action in `src/app/actions/recheckSite.ts`, fetch injected for tests) with a mocked 200 response sets `Own site - loads`, a mocked timeout or 5xx sets `Own site - failed to load in check`, and a status change from failed to loads removes the `Broken/wrong website…` intent signal and appends a `site_recheck` activity.
- [ ] **Step 2: Run** DB and e2e tests → FAIL.
- [ ] **Step 3: Implement** the migration, list with filters (vertical, area, priority, website status) and the workspace: header with Maps and website chip, why-call with score breakdown, what-to-sell, opener picker in the contact's mix, notes, people and numbers with decision-maker/gatekeeper roles, tabs Timeline and Tasks. Contact form has a `name_latin` field.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: lead list, search and workspace`.

### Task 15: Call flow and offline outbox

**Files:**
- Create: `src/lib/call/duration.ts`, `src/lib/offline/outbox.ts`, `src/app/actions/logCall.ts`, `src/components/call/{CallCard,OutcomeSheet,MixChips,PainPointForm}.tsx`, `src/app/(app)/call/page.tsx`
- Test: `tests/unit/duration.test.ts`, `tests/unit/outbox.test.ts`, `tests/db/logCall.test.ts`, `tests/e2e/call.spec.ts`

**Interfaces:**
- Consumes: `rankQueue` (Task 7), `nextCallbackSlot`/`BEST_WINDOWS` (Task 8), `pickVariant`/`nextMixProfile` (Task 9), `buildWaLink` (Task 10), `Surface` (Task 12), schema (Task 3).
- Produces: `estimateDurationSeconds(leftAt: number, returnedAt: number): number | null` (`null` when away under 5 seconds, meaning the call was not placed); `LogCallInput = { clientId: string; companyId: string; contactPointId: string; outcome: Outcome; durationSeconds: number | null; durationIsEstimate: boolean; mixUsed: Mix; objectionIds: string[]; lostReason?: string; openerId?: string; painPoint?: { processCategory: string; currentTool?: string; impact: 'time'|'money'|'manpower'; severity: 1|2|3|4|5; quote?: string }; nextAction?: { type: 'callback'|'todo'; dueAt: string } }`; server action `logCall(input: LogCallInput): Promise<{ callId: string; duplicate: boolean }>`; `outbox.enqueue(op: { clientId: string; type: 'logCall'; payload: LogCallInput }): Promise<void>`, `outbox.flush(send: (op) => Promise<void>): Promise<{ sent: number; failed: number }>` (IndexedDB, FIFO, stops at the first failure and keeps order).

- [ ] **Step 1: Write failing tests**:
  - `estimateDurationSeconds(1000, 1000+185_000) === 185`; `(1000, 1000+3_000) === null` (**Review Focus 5**).
  - Outbox: three ops enqueued offline flush in order; a failure on op 2 leaves ops 2 and 3 queued with `{sent:1, failed:1}`.
  - DB: `logCall` creates one `calls` row, one `activities` row and (for `callback`) one `tasks` row; calling it again with the same `clientId` returns `duplicate:true` and adds nothing (**Review Focus 4**); a `wrong_number` outcome sets the company excluded from the queue; an `interested` outcome raises the dynamic score; a pain point is stored with its verbatim `quote`; the contact's mix follows `nextMixProfile`.
  - E2E: `/call` shows the top-ranked lead; clicking Call (the `tel:` click is stubbed) then firing `visibilitychange` after 20 s opens the outcome sheet; choosing "Didn't call" closes it and logs nothing; choosing Callback logs the call, creates a task at the next working slot and advances to the next lead; with the network offline the outcome is queued and appears after reconnect; the empty queue shows "All caught up"; at 1280px width the call card offers "Show QR for my phone" whose QR decodes to the `tel:` URL of the chosen number; the voice-note button (`recordVoiceNote(companyId: string, audio: Blob): Promise<{ activityId: string }>` in `src/app/actions/voiceNote.ts`, audio stored in the private Storage bucket `voice-notes` at `<workspaceId>/<activityId>.webm`) creates an activity of type `voice_note` even when no transcript exists, and a user in another workspace cannot read the file.
- [ ] **Step 2: Run** unit, DB and e2e tests → FAIL.
- [ ] **Step 3: Implement** the pure helpers first, then `logCall` (single transaction, idempotent on `clientId`), then the components. The outcome sheet pre-fills mix chips from the contact and the callback date from `nextCallbackSlot`; the opener shown comes from `pickVariant`.
- [ ] **Step 4: Run** all four test groups → PASS.
- [ ] **Step 5: Commit** `feat: call flow with idempotent logging and offline outbox`.

### Task 16: Today, scoreboard and targets

**Files:**
- Create: `src/app/(app)/today/page.tsx`, `src/components/today/{Due,NextUp,WeekCalendar,Scoreboard}.tsx`, `src/app/(app)/more/targets/page.tsx`
- Test: `tests/db/scoreboard.test.ts`, `tests/e2e/today.spec.ts`

**Interfaces:**
- Consumes: `logCall` outputs (Task 15), `scoreboard_daily` view and `targets` table (Task 3), `Surface` (Task 12).
- Produces: `getScoreboard(day: string): Promise<{ calls: number; connects: number; conversations: number; demos: number; streakDays: number; targets: { calls: number; conversations: number; demos: number } }>` where connects = outcomes other than `no_answer|busy|wrong_number`, conversations = `interested|not_interested|callback|meeting_booked`, demos = `meeting_booked`.

- [ ] **Step 1: Write failing tests**: after logging five calls with mixed outcomes, `getScoreboard` returns the correct counts and a streak of 1 on day one and 2 after a second day meeting the call target; e2e: Today lists due callbacks first, then tasks, "Next up" shows the top queue lead, the week calendar shows Mon–Sat with no horizontal scrollbar at 1280px and 390px (agenda list on mobile), and badges appear only for due-now/overdue counts.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the view logic and Today screen; targets are editable on a small settings page.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: today screen and scoreboard`.

### Task 17: Playbooks and objections

**Files:**
- Create: `supabase/seed/playbooks.json`, `supabase/seed/objections.json`, `src/app/(app)/more/playbooks/page.tsx`, `src/components/call/ObjectionDrawer.tsx`
- Test: `tests/db/playbooks.test.ts`, `tests/e2e/objections.spec.ts`

**Interfaces:**
- Consumes: `pickVariant` (Task 9), `createAiDraft` (Task 11), call card (Task 15).
- Produces: seed for six entry services (AI website, WhatsApp bots and automation, website + WhatsApp integration, CRM setup, lead capture and tracking, SEO/digital marketing) each with `{ pitch, discoveryQuestions: string[], deliverables: string[], pricingGuidance: '' }` (pricing stays empty until the user supplies it); five objections with English responses: "send details on WhatsApp", "we already have someone", "too expensive", "not now", "call back later"; four English WhatsApp follow-up templates (`supabase/seed/templates.json`, kind `template`): thanks after the call, brochure/details, demo reminder, "your website is not loading" — using `{name}`, `{honorific}`, `{company}`. The outcome sheet gets a template picker (via `pickVariant`) that opens `buildWaLink` for the chosen contact point.

- [ ] **Step 1: Write failing tests**: after seeding, 6 playbooks, 5 objections and 4 templates exist per workspace; choosing a template in the outcome sheet opens a `wa.me` link with the `{name}` placeholder filled; e2e: the call card's Objections drawer lists the five, shows the response in the contact's mix when a variant exists, otherwise English with a "Rewrite in your mix" button that creates a draft; selecting an objection attaches it to the outcome.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** seeds (written content, not placeholders) and the drawer and playbook pages.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: playbooks and objection library`.

### Task 18: Privacy — DND, opt-out, erase and export

**Files:**
- Create: `src/app/actions/privacy.ts`, `src/components/lead/PrivacyMenu.tsx`
- Test: `tests/db/privacy.test.ts`

**Interfaces:**
- Consumes: schema (Task 3), `rankQueue` (Task 7).
- Produces: server actions `setDnd(companyId: string, dnd: boolean, note?: string): Promise<void>`; `eraseContact(contactId: string): Promise<void>` (deletes the contact's points and personal fields, keeps anonymised activities, writes `consent_log` event `erased`); `exportContact(contactId: string): Promise<object>` (JSON of everything held, logs `exported`); `setPointVisibility(contactPointId: string, v: 'owner_only'|'workspace'): Promise<void>`.

- [ ] **Step 1: Write failing tests**: `setDnd(true)` makes the company disappear from `rankQueue` input query and writes a `consent_log` row `opted_out`; `eraseContact` leaves no phone, name or `name_latin` for that contact, keeps the company, and logs `erased`; `exportContact` returns the contact's numbers, activities and notes and logs `exported`.
- [ ] **Step 2: Run** `npm run test:db -- privacy` → FAIL.
- [ ] **Step 3: Implement** the actions and menu.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: dnd, erase and export`.

### Task 19: Release hardening and deploy

**Files:**
- Create: `tests/e2e/golden-path.spec.ts`, `tests/e2e/perf.spec.ts`, `README.md` (runbook), `.github/workflows/check.yml` (optional)
- Modify: `.env.example`

**Interfaces:**
- Consumes: everything above.
- Produces: a deploy runbook covering the Supabase hosted project, Vercel project and env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. The user creates the external accounts and enters the keys; the executor never handles real secrets.

- [ ] **Step 1: Write failing tests**: golden path — log in, import the real CSV, open the queue, place a stubbed call, log `callback`, see it on Today, send a Hinglish WhatsApp template link; perf — with CPU throttled 4× and Lite glass auto-selected, scrolling the 297-row lead list keeps median frame time under 20 ms.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/golden-path.spec.ts tests/e2e/perf.spec.ts` → FAIL.
- [ ] **Step 3: Fix** whatever fails; run `npm run check` and the full Playwright suite → all PASS.
- [ ] **Step 4: Ask the user** to verify `holidays.json` against the official state lists and to supply 5–10 real openers (spec Section 18); record them in `supabase/seed/openers.json` as the few-shot seed.
- [ ] **Step 5: Deploy** per the runbook (user performs the account steps), run the import on production, smoke-test on the user's phone, and write the "Phase 1 shipped" note in `README.md`.
- [ ] **Step 6: Commit** `chore: release hardening and runbook`.
