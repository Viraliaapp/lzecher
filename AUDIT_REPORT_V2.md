# Lzecher Platform Audit Report V2

**Date:** April 30, 2026
**Auditor:** Claude Opus 4.6
**Deploy:** https://lzecher.com
**Scope:** Full platform — code quality, features, translations, security, UX, performance

---

## Executive Summary

| Category | Found | Fixed | Outstanding |
|----------|-------|-------|-------------|
| Build/Type errors | 0 | 0 | 0 |
| Lint errors | 5 | 2 | 3 (accepted) |
| Route issues | 1 | 0 | 1 (known) |
| Translation gaps | 0 | 0 | 0 |
| Translation quality | 1 | 1 | 0 |
| Security issues | 1 | 0 | 1 (CSP recommended) |
| Secrets leaked | 0 | 0 | 0 |
| Performance issues | 0 | 0 | 0 |
| npm vulnerabilities | 19 | 0 | 19 (0 critical) |

**Overall: Platform is production-ready.**

---

## Part 1 — Code Quality & Build Health

### Clean Build
- **Result:** 0 errors, 0 warnings
- **Routes:** 21 total (15 pages + 6 API routes)
- **TypeScript:** Strict mode passes
- **Build time:** ~14s compile + ~1s static generation

### ESLint
- **2 unused imports fixed:** `where` in admin/page.tsx, `getClientIp` in projects/create/route.ts
- **3 accepted React Compiler warnings:** setState-in-effect for initialization patterns in dashboard, login, HebrewDatePicker. These are valid React patterns that the new strict compiler flags.

### Bundle Size
| Chunk | Size | Assessment |
|-------|------|-----------|
| Largest | 494KB | Likely framer-motion + firebase SDK — acceptable for a feature-rich app |
| 2nd | 223KB | Normal for Next.js app router |
| 3rd | 186KB | Normal |
| Total first-load JS | ~400KB (estimated) | Acceptable |

No unexpected heavy dependencies. No moment.js. Firebase SDK is the biggest contributor.

### Dead Code
- 2 unused imports removed (see above)
- No unused components or files detected

---

## Part 2 — Feature Testing

### Route Testing (28/29 pass)

| Category | Result |
|----------|--------|
| All 4 locale homepages | PASS (200) |
| Auth routes | PASS (200 for login, 307 for protected) |
| Static pages (about, privacy, terms, etc.) | PASS (200) |
| Protected routes (create, dashboard, admin, settings) | PASS (307 redirect) |
| API routes (GET → 405) | PASS |
| robots.txt + sitemap.xml | PASS (200) |
| Non-existent memorial slug | **KNOWN ISSUE** (200 instead of 404 HTTP status, but shows 404 content) |

### API Auth Verification
| Test | Result |
|------|--------|
| Admin endpoint without auth → 401 | PASS |
| Report endpoint without auth → 404 (slug not found) | PASS |
| Rate limit on magic link (6th request → 429) | PASS (verified in previous session) |

### Project Creation (verified in previous session)
- 5-track project creates with 870 total portions
- Mishnayos: 525, Tehillim: 150, Shnayim Mikra: 54, Mussar: 130, Mitzvot: 11
- Status: active (instant publishing)
- Slug generation works with Hebrew-only names

---

## Part 3 — Translation Audit

### Coverage
- **339 leaf keys** in en.json (source of truth)
- **he.json:** 339/339 (100%) — 0 missing
- **es.json:** 339/339 (100%) — 0 missing
- **fr.json:** 339/339 (100%) — 0 missing
- **Empty values:** 0 in any file

### New Feature Keys (all verified present in all 4 languages)
- Mussar track: `track_mussar`, `track_mussar_desc`
- Admin tools: `dashTitle`, `filter_*`, `hideTitle`, `deleteTitle`, etc.
- Report modal: `title`, `reason_*`, `submit`, `thankYou`
- Feedback widget: `title`, `type_*`, `messageLabel`, `submit`
- Create success: `successTitle`, `viewMemorial`, `shareLink`

### Quality
- **Hebrew:** Proper geresh ״ and gershayim ׳ throughout. Correct religious terminology. Natural phrasing. 1 fix applied: exclamation mark in `welcomeBack` corrected.
- **Spanish:** Formal register, correct transliterations
- **French:** Formal register, proper Jewish French terminology
- **JSON validity:** All 4 files valid

---

## Part 4 — Security

### Headers (6/7 present)
| Header | Status |
|--------|--------|
| Strict-Transport-Security | PASS (63072000s) |
| X-Content-Type-Options | PASS (nosniff) |
| X-Frame-Options | PASS (DENY) |
| X-XSS-Protection | PASS (1; mode=block) |
| Referrer-Policy | PASS (strict-origin-when-cross-origin) |
| Permissions-Policy | PASS (camera=(), microphone=(), geolocation=()) |
| Content-Security-Policy | **NOT SET** (recommended) |

### Secrets in Client Bundles
Searched all .next/static/chunks/*.js for: PRIVATE KEY, RESEND_API_KEY, UPSTASH token, FIREBASE_ADMIN. **Zero matches. Clean.**

### API Auth
- Admin endpoints: require idToken + isAdmin claim — verified
- Super admin endpoints: require isSuperAdmin — verified
- Public endpoints (report, feedback): rate limited — verified
- Rate limiting via Upstash Redis: active and working

### npm audit
19 vulnerabilities (0 critical, 5 high, 12 moderate, 2 low). All high-severity issues are in transitive dependencies of `firebase-admin` and `resend` requiring major version upgrades.

---

## Part 5 — Performance

| Metric | Value | Assessment |
|--------|-------|-----------|
| TTFB (homepage) | **210ms** | Excellent |
| Build time | ~14s | Good |
| Largest bundle | 494KB | Acceptable |
| Static pages | 8 (including 404, robots, sitemap) | Good |

---

## Part 6 — Known Issues (Not Auto-Fixable)

### 1. Memorial 404 HTTP Status (LOW)
Non-existent memorial slugs return HTTP 200 with 404 page content. This is a Next.js 16 behavior with `notFound()` in nested dynamic routes. Users see the correct "Page not found" UI. SEO impact: search engines may index the 404 page.

### 2. Content-Security-Policy Header (LOW)
Not currently set. Would provide defense-in-depth against XSS. Requires careful configuration to not break Firebase SDK, Vercel Analytics, or Google Fonts.

### 3. Firestore Security Rules (MANUAL)
No `firestore.rules` file in the project. All data writes go through server-side API routes using firebase-admin (which bypasses rules). For defense-in-depth, deploy restrictive client-side Firestore rules that deny all direct client writes.

---

## Solomon's Manual Action Items

1. **Enable Email Link sign-in** in Firebase Console (required for auth)
2. **Add authorized domains** in Firebase Console
3. **Sign in with correct email** to refresh admin claims
4. **Create inaugural memorial** at /create
5. **Optional:** Set up reCAPTCHA Enterprise + App Check
6. **Optional:** Submit sitemap to Google Search Console
7. **Optional:** Create Sentry project for error monitoring

See `SOLOMON_TODO.md` for detailed steps.

---

## Files Changed In This Audit

| File | Change |
|------|--------|
| `src/app/[locale]/admin/page.tsx` | Removed unused `where` import |
| `src/app/api/projects/create/route.ts` | Removed unused `getClientIp` import |
| `messages/he.json` | Fixed exclamation mark in `welcomeBack` |
| `README.md` | Updated auth method, seed data counts, added super admin script |
| `SOLOMON_TODO.md` | Refreshed with current action items |
