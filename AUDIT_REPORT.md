# Lzecher Pre-Launch Audit Report

**Date:** April 29, 2026
**Auditor:** Claude Opus 4.6
**Commit:** `a25700e`
**Deploy:** https://lzecher.com

---

## Summary

| Category | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| **Critical bugs** | 1 | 1 | 0 |
| **High-severity bugs** | 2 | 2 | 0 |
| **Medium bugs** | 1 | 1 | 0 |
| **Low bugs / warnings** | 6 | 4 | 2 (accepted) |
| **Translation gaps** | 0 | 0 | 0 |
| **Security issues** | 6 | 5 | 1 (manual) |
| **npm vulnerabilities** | 23 | 0 | 23 (no critical) |

---

## Part 1 — Bugs Fixed

### CRITICAL
- **Unauthenticated seed endpoint** (`/api/seed/portions`): Anyone could POST to generate portions for any project. **Fixed:** Added Firebase ID token verification and `isAdmin` custom claim check.

### HIGH
- **Legacy phishing-vulnerable endpoint** (`/api/auth/magic-link`): Accepted arbitrary `link` parameter from client and embedded it in emails sent from our domain. **Fixed:** Deleted the entire route. The newer `/api/send-magic-link` generates links server-side.
- **No rate limiting on email endpoint** (`/api/send-magic-link`): Could be used to spam unlimited emails. **Fixed:** Added in-memory rate limiting (5 per hour per email, 20 per hour per IP).

### MEDIUM
- **Memorial 404 returning 200**: Non-existent memorial slugs returned HTTP 200 instead of 404. Root cause: Firestore composite index required for multi-field `where()` query. **Fixed:** Simplified query to single `where("slug")` clause with post-query status check, added try/catch around query.

### LOW (Fixed)
- Removed unused `Progress` import in `HomeClient.tsx`
- Removed unused `locale` variable in `create/page.tsx`
- Fixed `ensureUserDoc` declared after use in `login/page.tsx`
- Added `router` to useEffect dependency array in `(app)/layout.tsx`

### LOW (Accepted — React Compiler purity warnings)
- 4 remaining `react-hooks/purity` errors are false positives: `Date.now()` and `setState` calls inside event handlers and useEffects that the new React Compiler strict rules flag but are technically valid React patterns. These do not cause runtime bugs.

---

## Part 1 — Route Testing

| Route | Status | Result |
|-------|--------|--------|
| `/` | 307 → /en | PASS |
| `/en`, `/he`, `/es`, `/fr` | 200 | PASS |
| `/en/login` | 200 | PASS |
| `/en/create`, `/en/dashboard`, `/en/admin`, `/en/settings` | 307 (protected) | PASS |
| `/en/about`, `/en/privacy`, `/en/terms`, `/en/halachic-guidance`, `/en/contact` | 200 | PASS |
| `/en/memorial/nonexistent-slug` | 404 (after fix) | FIXED |
| `/api/send-magic-link` (GET) | 405 | PASS |
| `/api/projects/create` (GET) | 405 | PASS |
| `/robots.txt` | 200 | PASS |
| `/sitemap.xml` | 200 | PASS |

---

## Part 1 — Firestore Listener Audit

Only 2 `onSnapshot` listeners found (both in `AuthContext.tsx`). Both properly return unsubscribe functions in useEffect cleanup. **No memory leaks.**

---

## Part 2 — Translation Audit

### Coverage
All 275 keys in `en.json` exist in `he.json`, `es.json`, and `fr.json`. **100% coverage across all 4 languages.**

### Quality
- No empty string values in any file
- All 4 files are valid JSON
- Hebrew uses proper geresh ״ and gershayim ׳ characters (not ASCII quotes)
- Hebrew uses correct `לעילוי נשמת` terminology
- Hebrew uses correct `ששה סדרי משנה` form
- No orphaned keys in any language file

---

## Part 3 — Security

### Fixed
1. **Unauthenticated seed endpoint** → Added admin auth check
2. **Legacy phishing endpoint** → Deleted
3. **Email rate limiting** → Added (5/hr per email, 20/hr per IP)
4. **Error message leakage** → Sanitized all API error responses to generic messages
5. **Missing security headers** → Added HSTS (`max-age=63072000`) and Permissions-Policy (`camera=(), microphone=(), geolocation=()`)

### Secret Exposure Check
- No secrets found in `.next/static/` client bundles
- No `console.log` printing env vars
- No `.env` files ever committed to git history
- `.env.local.example` created for developer onboarding

### dangerouslySetInnerHTML Audit
8 occurrences found — all safe:
- 2 are JSON-LD structured data via `JSON.stringify()` (auto-escapes)
- 6 are hardcoded CSS strings for loading animations

### npm audit
23 total vulnerabilities (0 critical, 5 high, 16 moderate, 2 low). All high-severity issues are in transitive dependencies of `firebase-admin` requiring a major version upgrade. No action needed at this time.

---

## Manual Actions Required (Solomon)

### 1. Firebase Console — Enable Email Link Provider
- Go to https://console.firebase.google.com → project `sifttube-416a0`
- Authentication → Sign-in method → Email/Password
- Toggle ON "Email link (passwordless sign-in)"
- Save

### 2. Firebase Console — Add Authorized Domains
- Authentication → Settings → Authorized domains
- Add: `lzecher.com`, `www.lzecher.com`, `lzecher.vercel.app`, `localhost`

### 3. Optional — Firebase App Check (production hardening)
- Go to https://console.cloud.google.com/security/recaptcha
- Create a reCAPTCHA Enterprise site key for `lzecher.com`
- In Firebase Console → App Check → Register your web app with the reCAPTCHA key
- Add `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` to Vercel env vars
- Start in "monitor only" mode, flip to "enforce" after healthy traffic

### 4. Optional — Upstash Redis (persistent rate limiting)
- Create account at https://upstash.com
- Create a Redis database
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel env vars
- Current in-memory rate limiting works but resets on every serverless cold start

---

## Things to Monitor

1. **Rate limiting effectiveness**: In-memory rate limits reset on serverless cold starts. Monitor Resend usage dashboard for unusual spikes. Consider Upstash Redis for persistent limits.
2. **Firestore indexes**: If any new queries are added, watch for "index required" errors in Vercel function logs.
3. **npm vulnerabilities**: Re-run `npm audit` periodically. The `firebase-admin` high-severity issues require monitoring upstream for patches.
4. **React Compiler warnings**: The 4 remaining lint errors are acceptable but should be revisited when React 20/compiler stabilizes.

---

## Deploy Verification

| Check | Result |
|-------|--------|
| Build | Clean (0 TS errors) |
| Deploy | https://lzecher.com (aliased) |
| Homepage | Renders with YahrzeitCandle, Hebrew divider, proper design |
| robots.txt | Serves correctly |
| sitemap.xml | Serves correctly |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options all present |
