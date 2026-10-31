# ThrivvSkale CRM — Design Spec (rev 2)

Date: 2026-10-31
Status: Revised after user review, awaiting re-approval
Path: Architectural (new project, empty repo)

## 1. Purpose and intent

ThrivvSkale is an agency in Hyderabad. Its entry services are AI-powered websites, WhatsApp bots and automation, website/WhatsApp integrations, CRM setup, lead capture, and SEO/digital marketing. Those services are the way **into** businesses. The real goal is, over the first 3–4 months, to win clients, learn their operations, find the recurring processes that waste time, money or manpower, and then build automation, SaaS and industry ERPs around those problems.

This system is therefore **a cold-calling cockpit that doubles as a discovery engine**, and it is designed to grow into the company's ERP. It is not a generic HubSpot clone.

**Target verticals (core):** coaching centres, manufacturers, clinics/diagnostics/pharmacies (incl. medical stores), interior designers.
**Exploratory verticals:** real estate & construction, automobile & driving schools (present in the lead file, not in the stated target list).

**Success criteria**
1. Working through the 297 imported leads is faster and less tiring than using the CSV.
2. No follow-up is ever lost: every callback and task has a due time and shows up in Today.
3. After 3–4 months, Insights can answer "which recurring problem is most common in which vertical?" from structured call data.
4. A quotation or GST-ready invoice PDF can be produced and sent over WhatsApp in under a minute.
5. Adding a teammate later requires a permissions change, not a rewrite.
6. Calls and WhatsApp messages can be done in the user's real speaking style (Telugu/Hindi/Kannada mixed with English) without retyping.
7. The interface stays smooth on a mid-range Android phone, not only on a laptop.

## 2. Confirmed decisions

| Topic | Decision |
|---|---|
| Users | One user now, team soon; hosted web app, team-ready from day one |
| Foundation | Supabase (Postgres, Auth, Storage, RLS) + Next.js installable PWA on Vercel |
| Open-source references | Frappe CRM, ERPNext, Twenty used as **design references only** (schemas, concepts, UX patterns). They are AGPL/GPL; no code is copied into this closed codebase |
| Calling | Phone and laptop. Phone uses `tel:` links; laptop uses `tel:` through a phone-link app if available, else a QR code to the phone. Cloud telephony is a later plug-in |
| WhatsApp | One-tap click-to-chat with templates; sends to the contact point the user selects (business or personal number). Business API is a later plug-in |
| Languages | **Mixed-language profiles**, not one language per contact (Section 9) |
| Exploratory verticals | Imported and tagged `exploratory`, ranked below core verticals |
| UI | Apple-style glass, light and dark, uncluttered, with a performance-safe fallback (Section 3A) |

## 3. UX principles (apply to every screen)

1. **Five destinations only:** Today, Call, Leads, Deals, Insights. Everything else under "More" or the ⌘K palette.
2. **One navigation system.** Navigation exists once: the dock on desktop, the bottom tab bar on mobile. There is no second sidebar repeating the same items. A contextual left panel (filters, sub-sections) appears only inside a module.
3. **One primary action per screen.** Call card: "Call". After a call: the outcome buttons.
4. **Progressive disclosure.** Secondary detail lives in drawers and tabs. The call card shows only what is needed now.
5. **Smart defaults.** Next action, follow-up date, WhatsApp number and language mix are pre-filled; most outcomes take two taps.
6. **Badges only for things you must act on** (due now, overdue), never for totals.
7. **Mobile-first controls:** large touch targets, bottom sheets, thumb-reachable primary actions. Keyboard shortcuts and ⌘K on desktop.
8. **Cheap mistakes:** undo for status changes and deletes; global search; saved views; bulk actions.
9. **No dead space.** Every screen fills the viewport with something useful (e.g. Today shows "Next up", targets and the week), never a large empty panel.

## 3A. Visual design system (glass)

Goal: a glass interface clearly richer and more legible than a flat dark-purple "blurred card" look, where all panels share one tint, no wallpaper colour shows through and depth is hard to read.

**Layers (each level has a distinct blur, tint, shadow and edge):**

| Level | Used for | Treatment (starting values, tuned in build) |
|---|---|---|
| L0 Wallpaper | Background | Vivid multi-hue mesh gradient (≥3 hues so blur has colour to pick up), 6 wallpapers, auto light/dark, pre-rendered WebP/AVIF at two sizes |
| L1 Chrome | Menu bar, dock, contextual panel | blur 30–40px, saturate 160–180%, 8–14% tint |
| L2 Surface | Cards, panels, calendar | blur 20–24px, 14–20% tint |
| L3 Focus | Call card, sheets, popovers, modals, forms | blur 40px, 55–70% tint, stronger shadow, used wherever text must be read |

**Material details:** 1px gradient edge (bright at top-left, faint at bottom-right) plus an inset top highlight; 2–3% noise grain to prevent banding; concentric corner radii (12/20/28px); a soft specular highlight that follows the pointer on desktop; spring motion; accent colours derived from the active wallpaper.

**Legibility rules:**
- Body text ≥ 4.5:1 contrast and large text ≥ 3:1, measured against the **worst-case wallpaper region** under each panel, enforced by an automated check.
- Body text never sits on L1; reading surfaces are L3 or high-opacity L2.
- Event and status colours are muted, use one shared palette, and legends always match the colours actually used.
- `forced-colors` and `prefers-contrast` fall back to solid surfaces.

**OS shell (desktop):** a functional top menu bar (quick-add, ⌘K, today's targets, sync status, clock) and a floating dock as the single navigation. Decorative menu items with no function are not included.

**Calendar:** fits the width with no horizontal scrollbar and no clipped events; shows working days only (default Mon–Sat, configurable); event text is never truncated below a readable size; on mobile it becomes a day agenda.

**Performance budget (mid-range Android, about 4 GB RAM, patchy 4G):**
- At most 3 live `backdrop-filter` surfaces in any viewport on mobile; scrolling lists never use live blur (they use a pre-tinted opaque fill).
- **Lite glass** automatically replaces blur with a translucent solid when device memory is low, `prefers-reduced-transparency` is set, or frame drops are measured; the user can force it in Settings.
- Target: smooth 60 fps scroll on the lead list on a throttled CPU in test.

## 4. Architecture

- **App:** Next.js (App Router) installable PWA, hosted on Vercel.
- **Data:** Supabase Postgres, Auth, Storage. Every table carries `workspace_id`; row-level security restricts rows to workspace members.
- **Offline:** call outcomes and notes are written to a local queue and synced when the connection returns, so a dropped signal never loses a log.
- **Modules** (each one purpose, explicit interface):
  - **Import** — CSV in → normalise → dedupe → keep raw row.
  - **Queue engine** — decides who to call next.
  - **Lead workspace** — one record, all context.
  - **Call flow** — dialer card, outcomes, discovery capture.
  - **Messaging** — mix-aware WhatsApp/script templates and click-to-chat links.
  - **Language engine** — mix profiles, content matching, AI-assisted rewrite.
  - **Selling** — service catalogue, deals, quotations, invoices, PDFs.
  - **Insights** — pain-point aggregation, funnel, scoreboard.
  - **Playbooks** — service cheat sheets, discovery questions, objection library.
  - **Admin** — services, verticals, process taxonomy, templates, holidays, targets.
- **ERP path:** later modules (projects, products, purchasing) attach to the same `companies` and `deals` records. No migration of the CRM core is needed.

## 5. Data model

Core tables (all with `id`, `workspace_id`, `created_at`, `updated_at`):

- **workspaces** — name, home state, gst_registered (bool), gstin, working_days, timezone, default language mix.
- **members(role)** — owner now; roles added for team.
- **companies** — name, parent_company_id (branches of one business), vertical, tier (`core|exploratory`), area, city, state, pincode, website_url, website_status, website_invalid (bool), google_rating, google_reviews, source, priority (A/B/C), base_score, score (dynamic), intent_signal, problem_evidence, entry_offer, long_term_opportunity, description, stage, gstin, pan, dnd (bool), last_contacted_at, next_action_at.
- **contacts** — company_id, name, name_latin, role (`owner|decision_maker|manager|gatekeeper|other`), languages (ordered text[], primary first), mix_profile, script_pref (`latin|native`), register (`formal|casual`), notes.
- **contact_points** — contact_id (nullable for company-level lines), e164 phone, kind (`business|personal|landline`), wa_status (`verified|unconfirmed|landline|none`), preferred_for_whatsapp, preferred_for_calls, visibility (owner-only vs workspace).
- **activities** — single timeline: type (`call|whatsapp|note|voice_note|status_change|task_done|quote_sent|invoice_sent|site_recheck`), company_id, contact_id, contact_point_id, body, metadata, occurred_at.
- **calls** — activity_id, outcome (`no_answer|busy|wrong_number|callback|gatekeeper|interested|not_interested|meeting_booked`), duration_seconds, duration_is_estimate (bool), who_answered, mix_used (text[]), lost_reason, objection_ids, opener_id.
- **tasks** — company_id, title, due_at, type (`callback|todo|demo|site_visit`), done_at.
- **pain_points** — company_id, activity_id, process_category (per-vertical taxonomy, language-independent), current_tool, impact_type (`time|money|manpower`), severity (1–5), frequency, quote (verbatim, original mixed text), quote_en (optional gloss).
- **content_variants** — the store for openers, templates, scripts and objection responses: kind, vertical, stage, `mix` (e.g. `te+hi+en`), `script` (`latin|native`), `register`, body with `{placeholders}`, parent_variant_id (the English original it was rewritten from), source (`manual|ai_draft|ai_approved`), usage and outcome counts.
- **objections** — text, mix, suggested_response (content_variant), vertical.
- **services** — name, description, default_price, unit, SAC/HSN code, recurring (bool), playbook content.
- **deals** — company_id, service lines, stage, value, expected_close, lost_reason.
- **quotes / quote_lines** — number, version, status (`draft|sent|viewed|accepted|rejected`), totals, pdf_path, share_token.
- **invoices / invoice_lines / payments** — number per financial year (series configurable, e.g. `TS/2026-27/0001`), tax mode (`gst|non_gst`), CGST/SGST/IGST split, pdf_path, payment mode (UPI/bank/cash), part payments, TDS deducted by client, outstanding (net of TDS). Issued invoices are immutable; corrections use a credit note.
- **documents** — company_id, file_path, kind (`contract|brand_asset|signed_quote|other`).
- **holidays** — region (state), date, name, kind (`public|festival|local`).
- **consent_log** — contact_point_id, event (`opted_out|consented|erased|exported`), at, note.
- **import_batches, import_rows** — raw CSV row preserved for audit and re-import.
- **targets, scoreboard_daily** — daily call/connect/conversation/demo targets and actuals.

Later (phases 3–5): onboarding checklists and milestones, recurring-invoice schedules and renewals, projects, products.

## 6. Queue ranking

1. Callbacks and tasks due now or overdue (always first).
2. Then never-called leads ordered by: tier (core before exploratory) → priority (A, B, C) → dynamic score → intent-signal boost (hiring, broken site).
3. **Dynamic score** = imported base score adjusted by engagement (e.g. interested, asked for a quote, repeated gatekeeper block) so the ranking improves as you learn.
4. Excluded from the queue: DND-flagged, `needs_number`, and wrong-number companies.
5. User filters: vertical, area, language mix, website status. Optional "area block" mode groups calls by area.
6. Callback scheduling skips non-working days and the holiday calendar of the lead's **state** (Telangana, Karnataka and Andhra Pradesh differ), and suggests a per-vertical best-time window in IST.

## 7. Lead workspace

Header: name, vertical + tags, rating/reviews, area, Maps button, website chip, "re-check site" button, branches (if any).
Sections: why call this lead (intent signal, score breakdown, source) · what to sell (entry offer and long-term opportunity, from the vertical default with a per-lead override, plus attached catalogue services) · opener picker (versions in the contact's mix, editable) · description and notes (incl. voice notes) · people and numbers (decision-maker vs gatekeeper, multiple numbers each, chosen number for WhatsApp, language mix) · tabs: Timeline, Tasks, Deals, Discovery (pain points), Calendar, Documents.

## 8. Call flow

- **Card:** one lead at a time: big call button (contact point chosen), problem/evidence, opener in the contact's mix, discovery panel in a drawer.
- **Outcome capture:** when the user returns to the app after tapping a `tel:` link, the outcome sheet opens automatically. A `tel:` link cannot report call length, so duration is estimated from time away and labelled as an estimate, editable.
- **After the call:** outcome buttons, "mix spoken" chips pre-filled from the contact, optional pain-point capture, objection/lost-reason picker, next action with a pre-filled callback date. Auto-advances to the next queued lead.
- **WhatsApp:** one tap, mix- and script-aware, addressed to the selected contact point. Landline numbers never show a WhatsApp button. Unconfirmed numbers show a subtle badge; after trying, one tap marks the number as WhatsApp-confirmed or not, so the data improves.
- **Laptop:** the Call button uses `tel:`; whether Windows hands it to a phone-link app is verified in Phase 1. Fallback is a QR code on screen to scan with the phone.
- **Voice notes:** one-tap recording after a call; audio is always kept (Section 9).

## 9. Mixed-language support

Real calls and chats are code-mixed: Telugu+Hindi+English, Kannada+English and similar, often switching mid-sentence and often typed in Latin script ("Hinglish", "Tenglish", "Kanglish"). Language is therefore a **mix profile**, not a single value.

- **Mix profile:** an ordered set of languages (primary first) plus script preference and register. Stored per contact, defaulted from the workspace and the lead's state (e.g. Telangana → `te+hi+en`, Karnataka → `kn+en`). After each call the user taps the mix actually spoken (one tap, pre-filled); the profile follows recent calls.
- **Content variants:** openers, templates, scripts, objection responses and playbook snippets each carry `mix`, `script` and `register`. Selection falls back in order: exact mix → shares the primary language → English; the UI shows which variant was used.
- **Script:** default is **Latin/romanised** (how people actually type and how it reads fastest mid-call); native script (తెలుగు, हिन्दी, ಕನ್ನಡ) is available per template and for formal messages and PDFs. Illustrative Hinglish opener: "Sir, aapki website abhi open nahi ho rahi hai — hum isse jaldi fix kar sakte hain." The user's own real openers seed the style (Section 18).
- **AI-assisted rewrite:** one tap rewrites any English opener or template into a chosen mix and script. It is always an editable draft, saved as a new variant linked to the English original, never auto-sent. Only the template text is sent to the model, not lead personal data. The model is called server-side (API key never in the browser). Approved variants become few-shot examples so the style converges on the user's voice.
- **Honorifics and register:** `{honorific}` resolves per language (sir/madam, garu, ji, avare) and formal/casual register.
- **Unicode everywhere:** UTF-8 end to end; Noto Sans Telugu, Devanagari and Kannada with fallbacks; Indic-friendly line height; mixed scripts allowed inside one field. **PDFs embed the fonts** so Indic text never renders as empty boxes.
- **Search:** works across scripts using Postgres `simple` text search plus `pg_trgm` fuzzy matching; names also store a Latin form (`name_latin`) so typing in Latin finds native-script names.
- **Voice notes:** audio is always saved. Auto-transcription of code-mixed speech is unreliable, so a transcript is optional, labelled as a draft, editable, and never blocks saving.
- **Insights independence:** pain-point categories come from a language-independent process taxonomy; the verbatim quote is stored as spoken, with an optional English gloss. Language never splits the counts.
- **WhatsApp encoding:** message text is UTF-8 percent-encoded into the `wa.me` link; very long messages that exceed safe URL length fall back to copy-to-clipboard.
- **Language analytics:** conversation rate by mix and by opener × mix.

## 10. Selling (Phase 2)

- Service catalogue with packages, add-ons and discounts.
- Quotation and proposal PDFs: branded, versioned, status-tracked, sent as a file or share link via WhatsApp. English by default, bilingual headings optional.
- GST-ready invoices: seller state and GST registration come from workspace settings. Tax split is derived from **place of supply** (client's state): CGST+SGST if the same state as the seller, IGST otherwise. If the workspace is not GST-registered, invoices use a non-GST mode. HSN/SAC codes, sequential numbers per financial year, part payments, **TDS deducted by clients**, and an outstanding view net of TDS. The user should have a CA confirm the final legal format and the numbering series.
- PDF generation server-side from HTML templates, stored in Supabase Storage, retrievable from the deal and company pages.
- CSV/Excel export and automated backups.

## 11. Insights

- Pain-point aggregation by vertical and process category ("what to build next").
- Funnel: contacted → conversation → interested → demo → won, plus lost reasons and objection frequency.
- Opener performance and language-mix performance.
- Daily scoreboard against the user's own targets, with streaks.

## 12. Playbooks

Per service: one-line pitch, discovery questions, pricing guidance, deliverables checklist. Objection library with suggested responses for common Indian SMB replies, each available in the contact's mix. Designed so the user learns SEO/marketing while selling.

## 13. India-specific rules

+91/E.164 normalisation; mixed-language profiles (Section 9); ₹ and lakh/crore formatting; GSTIN/PAN fields; source tags (Google Maps, Justdial, IndiaMART, Apna, referral); do-not-call/opt-out flag with consent log (TRAI rules are noted as a compliance safeguard, not legal advice); per-state holiday calendar; Mon–Sat default working week; decision-maker vs gatekeeper tracking. Under India's data-protection law, prospects can ask for their data to be erased or exported: the system supports **erase** and **export** per contact and logs the event. Personal numbers a prospect gave you can be marked owner-only.

## 14. Import rules (297 leads)

| CSV column | Destination |
|---|---|
| Company Name, Industry, Area, City, State, Country | `companies` name, vertical, area, city, state, country |
| Phone | `contact_points` (kind `business`, company-level line) |
| WhatsApp (verified) | `contact_points` WhatsApp-capable number |
| WhatsApp Status | `contact_points.wa_status` (`Not verified` → `unconfirmed`) |
| WhatsApp Check Link | derived on the fly, not stored |
| Website, Website Status | `website_url`, `website_status` |
| Google Rating / Reviews | `google_rating`, `google_reviews` |
| Lead Status / Lead Source / Priority / Lead Score | `stage` / `source` / `priority` / `base_score` |
| High Intent Signal | `intent_signal` |
| Problem / Evidence | `problem_evidence` |
| Entry Offer, Long-term Opportunity | `entry_offer`, `long_term_opportunity` (per-lead override of vertical default) |
| Call Opener | English original in `content_variants` (kind `opener`); mixed-language variants are rewritten from it |
| Tags (`;`-separated) | tag records |
| Description | raw only (it duplicates other columns) |

Rules: tier set from vertical (core vs exploratory); phones normalised to +91; 4 leads without a number get `needs_number` and a "find number" task, and stay out of the queue; 7 landline numbers get no WhatsApp button; junk website values (directory pages, ChatGPT share links, bare `netlify.app`) are flagged `website_invalid` and kept as-is; default mix profile from the workspace; the raw row is stored; re-import matches on phone or domain and never duplicates.

## 15. Error handling and testing

- Offline queue for call logs and notes; conflict rule: latest write wins per field, activities are append-only.
- Unit tests: phone normalisation, import mapping, queue ranking, content-variant fallback, GST/TDS maths, invoice numbering, WhatsApp URL encoding.
- Unicode tests: Telugu, Devanagari, Kannada and mixed-script strings through storage, search, PDFs (fonts embedded) and `wa.me` links.
- Database tests: RLS isolation between workspaces.
- End-to-end (Playwright): import → queue → call → outcome → follow-up → quote PDF.
- Visual: automated contrast check against worst-case wallpaper, visual regression of glass levels, and a throttled-CPU scroll test of the lead list with Lite glass fallback.

## 16. Phases

1. **Calling cockpit** — import, queue, lead workspace, call flow, outcomes, tasks/callbacks, mix profiles with mix-aware WhatsApp templates and AI-assisted rewrite, notes and voice notes, Today, scoreboard, playbooks/objections, the glass design system with Lite fallback.
2. **Discovery and selling** — pain points, Insights, deals, quotation/invoice PDFs, documents.
3. **Delivery and recurring revenue** — onboarding tracker, renewals, recurring invoices, calendar sync, booking link.
4. **Team and telephony** — roles, lead assignment, owner-only contact points, cloud-telephony plug-in (call recording only with consent).
5. **ERP and SaaS** — projects, products, and productising the modules that prove valuable.

## 17. Out of scope for Phase 1

Quotations/invoices, telephony, WhatsApp Business API and message credits, team roles, projects/ERP modules, a client-facing portal. The schema leaves room for all of them.

## 18. Open items the user supplies later

Company logo and brand colours, GSTIN/PAN and whether the business is GST-registered, home state for GST, bank/UPI details, service pricing for the catalogue, daily scoreboard targets, 5–10 real openers or WhatsApp messages in the user's own mixed-language style (to seed the language engine), which phone the user will use (to set the performance baseline), and preferred wallpaper colours.

## 19. Revision log (rev 2)

User-requested:
1. Glass quality raised beyond the reference mockup (Section 3A).
2. Single language per contact replaced by mixed-language profiles (Section 9, data model).

Found in the audit and fixed:
3. Duplicate navigation (sidebar and dock) in the reference → one navigation system.
4. Calendar scrolled sideways and clipped events; legend colours didn't match events; large empty area → calendar and layout rules in Sections 3 and 3A.
5. Heavy blur would stutter on mid-range Android → performance budget and Lite glass.
6. Playbooks, objections and templates were English-only → content variants carry mix and script.
7. PDFs could show empty boxes for Indic text → fonts embedded, tested.
8. WhatsApp links could break on Indic text or long messages → UTF-8 encoding and clipboard fallback.
9. GST split was hard-coded to Telangana, GST registration was assumed, TDS ignored → derived from workspace and place of supply, non-GST mode, TDS tracked.
10. Holidays were not region-aware (Kannada leads imply Karnataka) → per-state holiday table.
11. Outcome logging after a `tel:` call was undefined → auto outcome sheet on return, estimated duration.
12. Laptop calling was undefined → `tel:` via phone-link app if it works, else QR to phone.
13. 278 unconfirmed WhatsApp numbers never improved → one-tap confirm after trying; landlines get no WhatsApp button.
14. Scores were static → dynamic score from engagement.
15. Multi-branch businesses (e.g. multi-centre clinics) had no model → `parent_company_id`.
16. Prospect data rights → erase and export with consent log.
17. Voice transcription of mixed speech is unreliable → audio always saved, transcript optional.
