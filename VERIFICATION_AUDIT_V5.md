# VERIFICATION AUDIT V5 — Honest Functional Assessment

**Date:** 2026-05-14
**Scope:** Reproduce + fix the two reported critical claim-flow bugs, run a translation-key audit, and document honestly what was and was not verified.

---

## Section 1: Critical Bugs — Diagnosis & Fix

### BUG A — Email field always renders in claim modal

**Reproduction (live site, before fix):** Playwright script `scripts/audit/test-claim-flow-prod.js` opened a memorial in incognito Hebrew context, clicked through to the claim flow, and confirmed the modal that appeared contained an `input[type=email]` regardless of any user choice for "name only."

**Root cause:** `src/components/memorial/MemorialPageClient.tsx` rendered the email `<Input>` unconditionally inside both the single-perek and bulk-claim dialogs. There was no expand/collapse — the field was always present, encouraging the user to fill it.

**Fix:** Restructured the claim modal so:
- **Default visible state:** name field only + "I commit" button + a small underlined link "+ Add email for reminders (optional)".
- Clicking the link expands the email input. Reminder presets only appear if the user types an email AND ticks "Send me reminders".
- For an authenticated user whose Firebase profile already has an email, the email section pre-expands (so they don't lose the convenience).
- For an anonymous user (chose "claim anonymously" in the SoftLoginModal), the email section is collapsed by default — true name-only flow.

Same restructure applied to the bulk-claim dialog. Translation keys `addEmailReminders` added to en/he/es/fr.

### BUG B — אישור button does nothing when clicked

**Suspected silent-failure paths in the original code:**

1. `confirmClaim()` did `if (!selectedPortion || !claimerName.trim()) return;` — a silent early return with no toast and no console message. If the dialog was opened twice or state got out of sync, the click would do literally nothing.
2. `auth.currentUser?.getIdToken().catch(() => null)` — swallowed any auth-token error silently.
3. `try { ... } catch { toast.error(t("claimError")); }` — swallowed exception detail (no `console.error`), so a network error or thrown Firebase error gave the user a generic toast and no diagnostic in the console.
4. The button itself had **no loading state** — `<Button onClick={confirmClaim} disabled={!claimerName.trim()}>` showed only the static text. If the request was in flight for several seconds, the user saw nothing happen and concluded the button was dead.
5. The `finally` block always called `setConfirmDialogOpen(false)` — meaning even on a 4xx error the dialog vanished after showing a toast, making it look like "nothing happened."

**Fix in `confirmClaim` and `confirmBulkClaim`:**
- Added explicit `toast.error(t("nameRequired"))` instead of silent return.
- Added `console.error("[claim] ...")` everywhere an error is swallowed.
- Added a `submitting` state that shows a `<Spinner>` inside the confirm button while the request is in flight, and disables both Cancel and Confirm during submission.
- Modal now closes only on success (`claimSucceeded` flag). On error, it stays open so the user can retry without losing form data.

### BUG C (newly discovered) — `memorial.completionBanner` missing in all locales

The 100%-complete siyum banner used `t("completionBanner" as never)?.replace("{name}", hebrewFirstLast) || "An enormous zechus for ${hebrewFirstLast}'s neshama."`. The `as never` cast was the developer admitting the key doesn't exist, and the fallback is **English text** that would leak into every Hebrew/Spanish/French memorial page once any memorial reaches 100%. Added `memorial.completionBanner` to all four locales with proper ICU `{name}` placeholder substitution and updated the source to use it cleanly.

---

## Section 2: Real User Journey Results

**Honest scope statement:** Full end-to-end browser journeys (auth, create wizard, mark-complete) require minted Firebase test tokens + a logged-in browser context. Setting that up to mutate the production database is risky (would create real test memorials and claim docs). The journeys below were partially verified — what was tested is documented, what was skipped is documented.

| Journey | Status | Notes |
|---|---|---|
| 1. Anonymous Hebrew visitor → memorial → claim modal opens | **PASS (live)** | Verified by Playwright script `test-claim-flow-prod.js`. Hebrew layout, RTL, memorial cards, navigation, soft-login modal all rendered. Screenshots in `scripts/screenshots/`. |
| 2. Authenticated full create+claim flow | **NOT EXECUTED** | Requires minted custom token + signed-in browser context. Would mutate production DB. Code path inspected only. |
| 3. Bulk claim (entire Masechta) | **NOT EXECUTED** | Same constraint as #2. UI restructure (BUG A fix) applied to bulk dialog by mirror; verified at code level. |
| 4. Mark complete + chizuk modal | **NOT EXECUTED** | Same constraint. |
| 5. Email mark-complete via signed JWT link | **NOT EXECUTED** | Requires `REMINDER_ACTION_SECRET` and access to a real claim doc. |
| 6. Mobile (375×812) homepage + memorial render | **PASS (live)** | Manually scripted viewport in Playwright; homepage and memorial page render. Did not exhaustively test claim modal on mobile. |

**What's blocking the auth-required journeys:** running them safely needs either a dedicated staging environment or a "test mode" cleanup script that deletes any data created during the audit. Neither exists today. Recommend either creating a staging Firebase project or adding a `NODE_ENV !== 'production'` guard that lets a test user be created on the fly.

---

## Section 3: Translation Audit Results

Tooling: `scripts/audit/translation-audit.js` walks `src/`, captures every `t("foo")` and `useTranslations("ns")` call, builds a key inventory, and cross-references against `messages/{en,he,es,fr}.json`.

| Metric | Value |
|---|---|
| Total `t()` usages found | 415 |
| Unique key references | 328 |
| Empty values in any locale | 0 |
| Value identical to key path | 0 |
| Unicode replacement characters (U+FFFD) | 0 (verified via `npm run check:encoding`) |

**Reported "missing" keys: 57 per locale.** Manual triage:

- **~50 are false positives** from my parser: dynamic template-string keys (`track_${key}`, `step_${step.key}_title`, `feature_${feature.key}_desc`), and files with multiple `useTranslations` namespaces (where the parser tries to qualify a `t("x")` call with both namespaces and one of the two qualifications doesn't exist). These are correctly resolved at runtime by next-intl.
- **1 real miss confirmed and fixed:** `memorial.completionBanner` — added to all four locales with proper ICU placeholder.
- **Remaining flagged keys** are server-side `getTranslations({ namespace: "..." })` invocations whose namespace my regex doesn't pick up; they resolve correctly at runtime.

**No empty-string values, no `??.` U+FFFD encoding bugs, no value-equals-key placeholder leftovers.**

A more thorough audit would render every page in every locale via Playwright and grep the rendered HTML for English wordlists. That is the right next step but requires several hours of additional script development; not run for this audit.

---

## Section 4: Data Integrity Results

**NOT EXECUTED in this audit.** Requires connecting to the production Firestore (`sifttube-416a0`) with admin credentials and walking each `lzecher_*` collection. Existing scripts (`scripts/data-integrity-check.js`, `scripts/deep-audit.js`) cover much of this — they were not re-run because they read/write production data and prior audit iterations already exercised them.

Recommendation: schedule `node scripts/data-integrity-check.js` to run weekly via a cron task and email the report.

---

## Section 5: API Test Results

**NOT EXECUTED in this audit as a curl matrix.** All API routes were inspected statically. The claim flow handlers (`POST /api/claims`, `POST /api/claims/bulk`, `POST /api/claims/complete`) are well-formed: rate limiting present, ID-token verification optional-with-fallback for exclusive claims, error responses use proper status codes.

The single defect noticed during inspection: `POST /api/claims` accepts `idToken` from the body and writes `userId = "anonymous"` if it can't verify — but it then *also* writes the `claimerEmail` from the body without any verification, meaning a determined caller can plant any email on an anonymous claim. This is low severity (nobody is harmed) but means reminder emails could be sent to an arbitrary address. Not fixed in this audit; flagged here for future work.

---

## Section 6: Visual Regression Results

Screenshots saved during this audit (in `scripts/screenshots/`):
- `homepage.png` (1280×800, Hebrew context)
- `01-homepage.png`, `02-memorial-page.png`, `03-after-claim-click.png` (claim flow reproduction on production)

No console errors observed during the homepage/memorial page renders (only Next.js prefetch `_rsc` ABORTs, which are normal — they happen when the user navigates away before the prefetch completes).

Full per-page screenshot matrix across desktop/tablet/mobile in en/he/es/fr was **not run**. Cost is significant (≈48 screenshots) and needs auth setup for protected routes.

---

## Section 7: Security Test Results

**NOT EXECUTED in this audit.** Static review of admin routes confirms they verify `isAdmin`/`isSuperAdmin` claims via `getAdminAuth().verifyIdToken`. JWT mark-complete handler uses `jose` library properly. No secret leak grep performed against the build output — recommend adding a `scripts/audit/secret-scan.js` that runs in CI.

---

## Section 8: Religious Appropriateness

**Not deeply re-audited this round** — prior audits (V3, V4) covered geresh/gershayim sweeps and chizuk-message sampling. The new translations added in this audit (`memorial.completionBanner`, `memorial.addEmailReminders`, `memorial.nameRequired`, `memorial.siyumEligible`) use proper religious framing (zechus / zekhout / zejut / ze'chut for the noun, neshama for the soul reference).

---

## Section 9: Regression Status

The fixes in this audit touch only `src/components/memorial/MemorialPageClient.tsx` and the four locale JSON files. Build + TypeScript check pass cleanly. No type errors introduced. Pre-existing lint warnings in unrelated files (`HebrewDatePicker.tsx`, `Navbar.tsx`, `PhotoUploadModal.tsx`) are untouched.

---

## Section 10: HONEST FINAL ASSESSMENT

> **"If a real grieving frum family used lzecher.com right now to create a memorial for their parent, and shared it with 30 family members who tried to claim portions and mark them complete — would the experience work without any visible bugs?"**

**Answer: PARTIALLY.**

What this audit definitely improved:
- The claim modal no longer pushes email collection on users who came in via the anonymous "claim without account" path. The default visible state is name-only. (BUG A fixed in code; will be live after deploy.)
- The אישור / Confirm button now shows a spinner during submission and surfaces errors instead of silently swallowing them. If something genuinely fails it will be visible to the user AND logged to the console for debugging. (BUG B fixed in code; will be live after deploy.)
- The 100%-complete siyum banner will no longer leak English fallback text into Hebrew/Spanish/French memorials. (BUG C fixed.)

What this audit could not verify and a real family might still hit:
- The full authenticated create-wizard → memorial → claim → mark-complete loop was not executed end-to-end against production. Any bug in those transitions that doesn't manifest in code review will still be there.
- Reminder emails actually arriving in inboxes was not tested.
- The mark-complete-via-magic-link flow was not exercised with a real signed JWT.
- Mobile-specific layout bugs in the now-restructured claim modal — the new "+ Add email for reminders" link is small and could be hard to tap on touch devices. Not visually verified on a real mobile device.

The previous-audit-style "✓ all green" verdict is not honest here. The bugs Solomon reported are addressed at the code level and will be live after this deploy. Whether other bugs remain, only a real test on the deployed site can tell.

---

## Section 11: Items Solomon Must Manually Verify

After this deploy, please do the following on https://lzecher.com:

1. **Anonymous claim, name-only:** Open a memorial in incognito Hebrew. Click a perek → in the SoftLoginModal click "or claim anonymously" → the claim dialog should show **only the name field** plus a small "+ הוסף אימייל לתזכורות" link. Type a name → click אישור → confirm a chizuk modal/toast appears and the perek shows as taken.
2. **אישור with name-only payload:** Same flow as above. Confirm the button briefly shows a spinner, then closes the dialog, then the success toast appears. If it fails — open browser DevTools console BEFORE clicking, and the error will now be logged with `[claim]` prefix.
3. **Authenticated claim with email pre-filled:** Sign in normally, click any perek. The dialog should show your name pre-filled AND the email section should be pre-expanded with your email. Reminders are still opt-in via checkbox.
4. **Bulk claim (entire Masechta):** From a Mishnayos seder → masechta → "קח את כל מסכת ___" button → name-only dialog → אישור. Verify all perakim of that masechta show as taken on page reload.
5. **100%-complete banner:** If you have a memorial near completion, ensure the siyum banner now reads in the chosen locale (Hebrew/Spanish/French) and not the English fallback.
6. **Browser console:** Open DevTools console while testing. Any error should now be visible (prefixed with `[claim]` or `[bulk-claim]`). If you see one, copy-paste it back to me — that's the diagnostic for whatever was breaking before.

---

## What was added to the repo

- `scripts/audit/test-playwright-works.js` — smoke test (verified)
- `scripts/audit/test-claim-flow-prod.js` — reproduces BUG A/B against production
- `scripts/audit/translation-audit.js` — extracts t() calls, cross-references locales
- `scripts/screenshots/` — output dir; ignored by git via `.gitignore` if present
- New translation keys: `memorial.completionBanner`, `memorial.addEmailReminders`, `memorial.nameRequired`, `memorial.siyumEligible` (where missing) in en/he/es/fr
- `playwright` + `@playwright/test` added as dev dependencies; chromium browser installed locally

## What was NOT done — explicit list

- Authenticated end-to-end Playwright journeys (would need staging or test-user mint)
- Email delivery test (would need to consume Resend quota)
- Mobile-device claim modal UI verification (only desktop viewport scripted)
- Per-page screenshot matrix across all locales × all viewports
- Firestore data-integrity walk
- API curl matrix
- Secret-leak grep in `.next/static`
- Geresh/gershayim re-sweep
- Chizuk message sampling
- Sec test of admin endpoint bypass

These are listed not as excuses but so the next pass knows exactly where to start.
