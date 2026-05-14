# Auth/Email Redesign — 2026-05-14

Live commit: `3374e0a` (verified via /api/version on lzecher.com)

## Verified live (Playwright on production)

| Part | Status | Evidence |
|---|---|---|
| 1. Locale-aware emails | DEPLOYED + PARTIAL | claim doc now stores `locale` field (verified in Firestore — newest claim shows `locale: he`). queue-reminders.ts writes the schema cron expects (`toEmail`, `reminderType`, `locale`, `projectSlug`, `honoreeName`, `commitmentDesc`). End-to-end email delivery to inbox NOT tested (would consume Resend quota). |
| 2. Frictionless claiming | PASS | `redesign-p2-after-perek-click.png` confirms the claim modal opens directly without SoftLogin step. End-to-end anon claim returned `POST /api/claims → 200`. New claim doc with `locale: he` saved. |
| 2.7. Magic-link UX (no email re-prompt) | DEPLOYED | send-magic-link embeds signed email token in redirect URL `?e=<token>`. Login page auto-completes via /api/auth/verify-email-token. Cross-device prompt only triggers if BOTH the token AND localStorage are missing. End-to-end email-click → auto-signin NOT tested (requires inbox). |
| 3. Auto-signin via JWT | DEPLOYED | `/he/auto-signin?token=invalid` renders graceful error page (verified). Confirmation email template includes "View your dashboard" CTA link in all 4 locales. End-to-end click-from-email NOT tested. |
| 4. Anonymous mark-complete | PASS | Mark-complete button now visible to anonymous users on claimed perakim (verified). Confirmation modal shows religious accountability message. Rate-limited 10/IP/hour via Upstash. |
| 5. Memorials button in header | PASS (all 4 locales) | "Memorials" / "הנצחות" / "Memoriales" / "Mémoriaux" link present and active in nav, links to `/[locale]`. |

## Not verified (requires email inbox or auth setup)

- Receiving an actual confirmation email and verifying it is in HE/ES/FR
- Clicking auto-signin link from inbox, landing signed-in on dashboard
- Authenticated create-wizard flow (separate scope)
- Rate-limit hitting 11th request

## Migration consideration

Existing claims (343 in production) lack the `locale` field. The cron route
falls back to `en` when `locale` is missing on a scheduled email — so no email
will fail; older claims just get English reminders. That is the expected behavior
during transition. No migration required.

## Files added

- `src/lib/signed-tokens.ts`
- `src/app/[locale]/auto-signin/page.tsx`
- `src/app/api/auth/custom-token/route.ts`
- `src/app/api/auth/verify-email-token/route.ts`

## Files modified

- `src/lib/queue-reminders.ts` — schema fix + locale + project info
- `src/lib/reminder-templates.ts` — `dashboardLink` arg + 4-locale CTAs
- `src/lib/rate-limit.ts` — added `markCompleteAnon`
- `src/app/api/claims/route.ts` — accept + save `locale`
- `src/app/api/claims/bulk/route.ts` — accept + save `locale` + queue reminders
- `src/app/api/claims/complete/route.ts` — anonymous completion path
- `src/app/api/cron/send-reminders/route.ts` — build dashboardLink
- `src/app/api/send-magic-link/route.ts` — embed signed email token
- `src/app/[locale]/(auth)/login/page.tsx` — verify token, no prompt
- `src/components/layout/Navbar.tsx` — Memorials link
- `src/components/memorial/MemorialPageClient.tsx` — remove SoftLogin, mark-complete dialog, locale param
- `src/components/memorial/TrackHierarchy.tsx` — show mark-complete to all
- `messages/{en,he,es,fr}.json` — autoSignin* + markCompleteConfirm + markCompleteAccountability keys
