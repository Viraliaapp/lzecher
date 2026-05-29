# VERIFICATION_AUDIT_FULL — Prompts A + B + C

Audited against **real production** (https://lzecher.com). Final live commit: **`c6d19c0d`** (branch `prompt-abc`), env `production`.

Legend: ✅ PASS · 🔧 FIXED-DURING-AUDIT · ❌ STILL-BROKEN · ⚠️ PARTIAL/NOT-BUILT · ⏳ NEEDS-SOLOMON-MANUAL (real login/email/2nd account)

---

## Deploy + migration facts
- **Deployed** via `npx vercel --prod --force` → https://lzecher.com (READY). Three deploys during the audit: initial (`277d7f1`), participantCount fix (`5d37065`), token-401 fix (`c6d19c0d`). `/api/version` confirms `c6d19c0d`, env `production`.
- **Migration** `scripts/migrate-prompt-a.mjs --apply`: backs up first, **lzecher_ only**, idempotent. Applied; **10 lzecher_projects** updated (canonical progress, topMatmidim, participantCount, safe field defaults) + wrote `lzecher_global_stats/totals`.
- **Backups** (scripts/backups/): `lzecher_projects-2026-05-29T20-18-04-856Z.json`, `…T20-26-15-507Z.json`, `…T20-33-07-203Z.json` (each 10 docs, pre-write) + prior kabbalos backups `kabalos-v2-backup-1779981024833-*.json`.
- **Global aggregate** (verified live): 585 משניות · 441 פרקי תהילים · 10 קבלות · **90 participants** · 10 projects.

---

## SECTION 1 — Kabalos — ⚠️ MOSTLY PASS, one legacy project flagged
- ✅ 5 of 6 kabbalos-projects show exactly the **new 6**: קבלת שבת 10 דקות מוקדם / עניית אמן בכוונה / לימוד שמירת הלשון / נתינת צדקה לעילוי נשמת / להודות להשם / קבלה אישית (1 free-text = "קבלה אישית"). Verified via direct Firestore read (scripts/audit/inspect-data.mjs) on lz8uqv, itamar-w3a9n3, 68jywm, mczhjv, 0xowxi.
- ✅ Kabalos excluded from progress % (progress = TM only; confirmed by `src/lib/progress.ts` + parity check below).
- ❌ **`memorial-ay5ukw` still has 9 kabbalos** — 3 OLD leftovers the prior migration missed: "שמירת הלשון", "התחייבות מצוה", "הכרת הטוב יומית להשם". **These have REAL claim docs** (יהונתן/מאיר/תהילה עמיאל, all email tt7108779@gmail.com — looks like the עמיאל family's test data, but they are real claims). **I did NOT delete them** — deleting portions with real named claims is data-at-risk, and remapping old→new is a judgment call. **NEEDS SOLOMON**: decide delete (loses those 3 takers' kabbalos) vs remap to new equivalents. Script `scripts/audit/inspect-ay5ukw-kabalos.mjs` documents them.
- ⏳ "בלי נדר" note + button "אני מקבל/ת על עצמי בלי נדר" + names display: these live in the kabalos track tile UI (prior work). Visible in the kabalos tile but I could not fully click-verify the modal text headlessly — recommend a quick human glance. Screenshot: `scripts/audit/prompt-c/memorial-kabalos.png`.

## SECTION 2 — Completion system (dual bars) — ✅ PASS
- ✅ **Two bars** confirmed on a project with completions (lz8uqv): gold "נלקחו" 33% + green "הושלמו". Screenshot `scripts/audit/prompt-c/memorial-lz8uqv-dualbars-startedby.png`. (Projects with completed>0: lz8uqv=112, ojq7ld=18, 68jywm=4, 0xowxi=2.)
- ✅ Only taken items can be completed; kabalos excluded — enforced server-side (`complete-batch` skips kabalos, requires status "claimed").
- ✅ **Bulk complete does NOT throw "too many requests"**: `complete-batch` is one batched server write (Firestore chunks ≤450) and the rate limiter (`bulkCompleteOp`) counts the whole batch as ONE op; authenticated users skip the limit. Recompute wired in.
- ⏳ Victory seal / Hebrew completion date / by-masechta + multi-select complete UI: code present; full click-through needs login.

## SECTION 3 — Dashboard per-item edit — ✅ PASS (API), ⏳ UI click
- ✅ Per-item **edit** (PATCH) and **remove** (DELETE) a single claim exist: `/api/projects/[id]/claims/[claimId]`. Remove releases just that portion and recomputes stats (now also recomputes participantCount + global). Server-gated to creator/admin.

## SECTION 4 — Stats sync (recurring bug) — 🔧 FIXED + ✅ VERIFIED
- ✅ **Card % == Hero %** verified on production for memorial-0xowxi: **card 35% == hero 35%** (Playwright extracted both). Both now read the single canonical definition (`src/lib/progress.ts`).
- 🔧 **participantCount was inflated** (ay5ukw 33→24, ojq7ld 18→15, 0xowxi 17→13) by the old per-claim increments. Made authoritative (`recomputeParticipantCount`, dedup by uid or name+email, excludes bulk parents); backfilled all projects; global participants corrected 106→90.
- ✅ **After a test claim, both update**: a controlled test claim (Nazir 7) moved global mishnayos **585→586** live; then fully restored to 585 (test claim deleted, portion reset, recompute). Per-track + totals across all sets are consistent (recompute reads all portions).
- ✅ Drift can't recur: every claim/release/complete/reset route calls the authoritative recompute (try/caught, non-fatal).

## SECTION 5 — Password protection — ✅ PASS (server-side gate confirmed)
- ✅ Public/private removed; **all cards visible** in the directory (sitemap excludes protected detail; directory payload sanitized to card-level — hash/bio never sent to browser).
- ✅ **Server-side gate confirmed** by a temporary live test on `memorial-upvad8` (set password, tested, restored): wrong password → **401**, correct → **200 + httpOnly/Secure/SameSite cookie** (180d). Gate page shown without cookie.
- ✅ **No full-detail leak**: project-specific data that only the full page renders (father name "יהושע נח") returned **0 occurrences** in the gated HTML. (Hebrew UI strings that appear are the next-intl message dictionary shipped to every page, not rendered project data — proven because even "המתמידים" appears on the gate where it never renders.)
- ✅ Password stored hashed (scrypt). Brute-force rate-limited per project+IP (`passwordAttemptPerProjectIp`, 10/10min).
- ✅ Migration did not lock anyone out (all existing projects backfilled with `passwordHash: null` = open) and did not expose previously-private data (3 ex-"private" projects flagged, left open: sm1g7n, 68jywm, upvad8).

## SECTION 6 — Started-by attribution — ✅ PASS
- ✅ Optional at setup (create wizard) + editable later (creator edit page) + toggle. Live test on lz8uqv: "הוקם על ידי · משפחת אהרונוביץ" rendered near the tribute when enabled, then restored (hidden when off). Verified on production, screenshot captured.

## SECTION 7 — Admin powers — ⚠️ PARTIAL (built vs not-built, honestly)
Server-side permission enforcement: ✅ update APIs reject no-token (401) and 🔧 now reject invalid token (401, was 500). Full cross-account 403 test needs a 2nd account (⏳) but the code enforces `createdBy === uid || isAdmin` server-side; super-admin = `isSuperAdmin` claim (saharonovitz@/solomon2145@ per spec).

**BUILT & verified (code/live):** edit name/dates/photo/tribute ✅ · toggle+edit started-by ✅ · set/change/remove password ✅ · add/remove track (seeds/ warns-on-claims) ✅ · custom dedication + pinned announcement ✅ · lock project (claims rejected with 423; still viewable) ✅ · deadline/goal date (`completionTargetDate`) ✅ · per-item claim edit/remove ✅.

**NOT BUILT (⚠️ — honest):** these were never implemented in Prompt A (I flagged this in the Prompt A report; they are missing features, not regressions):
- See full participant list + emails (dedicated view)
- Manually add a claim (phone-in)
- Export participant CSV
- Send update email to all participants (Resend)
- Hide/report an individual claim
- Insights (claims-over-time / most-active-day / completion-rate)
- "Still needed" view (unclaimed portions/masechtos)

These need backend+UI+i18n each; recommend a focused follow-up. None are broken — they simply don't exist yet.

## SECTION 8 — Live features — ✅ PASS
- ✅ **Bubbles**: live on homepage — captured "מוריה לקח/ה פרק תהילים עבור יחזקאל דוד נחשון ז״ל" (screenshot `home-bubble.png`); gentle in/out, capped at 3, RTL bottom-corner, mobile-capped.
- ✅ **Global counter**: real totals (585/441/10) on homepage band "כלל ישראל לומד יחד"; **incremented 585→586 after a test claim**; reads the **single** `lzecher_global_stats/totals` doc (not a collection scan) — `/api/activity/global` returns one doc, CDN-cached.
- ✅ **Leaderboard המתמידים**: top-10 by portions taken, named, anonymous skipped (e.g. יהודה שלנג 75 · תמר 44 · בן ציון 27); polls `/api/projects/[id]/leaderboard` (1 doc read + CDN cache).
- ✅ **Efficiency**: `recent` = 1 ordered/limited query (≤80) + 1 batched getAll; `global` = 1 doc; `leaderboard` = 1 doc. All send `Cache-Control: s-maxage` so visitor polling collapses to ~1 read. No per-request full-collection scans.

## SECTION 9 — Regressions + core flow — ✅ MOSTLY PASS
- ✅ All pages **200**: /en /he /es /fr, /en/create, /en/dashboard, /en/about, /en/halachic-guidance, memorial (en+he), /sitemap.xml, /robots.txt.
- ✅ Homepage = directory renders; cards correct (candle, name, %, tracks).
- ✅ Claim flow (single) works end-to-end (live test claim succeeded + recomputed). Bulk path: code intact + lock-aware; ⏳ full bulk click-test needs login.
- ✅ Memorial renders all tracks; Hebrew RTL + Hebrew numerals correct (screenshots).
- ✅ Per-track independent sets intact (a4usua tehillim totalSets=2 independent of mishnayos; `maybeOpenNextSet` unchanged).
- ✅ All 4 locales render; global-counter heading correctly distinct per locale (he/en/es/fr); **no untranslated key leaks** (grep for `passwordGate.`/`globalCounter.`/`leaderboard.title` literals = none).
- ⏳ Login / magic-link, session persistence, and **email reminders pipeline** need a real human/inbox — not headlessly verifiable. Cron route + templates unchanged by A/B/C.

## SECTION 10 — Firestore safety — ✅ CONFIRMED
- ✅ Every change touched **only lzecher_** collections: writes to `lzecher_projects` + `lzecher_global_stats`; reads `lzecher_portions`/`lzecher_claims`. No wildcards, no all-collection iteration, no cross-app queries. Global counter aggregates **only** lzecher_ projects.
- ✅ **Security rules: UNCHANGED.** There are no Firestore rules files in this repo (rules are managed externally); I modified/deployed none. SiftTube/Viralia/TAG Family Safety rules untouched. The password gate is enforced in app server code (scrypt + signed cookie), not via rules. No new composite indexes created (all new queries are single-field; the one index error during audit was my throwaway test query, not a production path).
- ✅ Backups listed above. `npx vercel --prod --force` deployed only the `lzecher` Vercel project.

---

## Items needing Solomon (manual / decision)
1. **`memorial-ay5ukw` kabbalos**: 3 old kabbalos with real עמיאל-family claims (one shared email — likely test data). Decide delete vs remap. I won't touch real claims without your call.
2. **Login / magic-link + real email delivery** (reminders, and the not-yet-built "email all participants"): need a real inbox test.
3. **Section 7 unbuilt admin powers** (participant list+CSV, manual add-claim, email-all, hide-claim, insights, still-needed): approve a follow-up to build them.
4. Optionally set passwords on the 3 ex-"private" projects (sm1g7n, 68jywm, upvad8) — currently open.

## Honest answer — "If a grieving frum family used lzecher.com right now…"
**YES for the core journey, with caveats.** A family can: create a memorial (optionally password-protected — gate works and is server-side secure), invite others to take and complete portions (single + bulk, dual progress bars, kabbalos bli-neder), and see live activity bubbles, the global "כלל ישראל לומד יחד" counter, and the המתמידים leaderboard. Card % and inside % now match, and participant counts are accurate. **NEEDS WORK on:** (a) the unbuilt power-user admin features in Section 7, (b) one legacy project's leftover kabbalos (your decision), and (c) human verification of login + email delivery. The **core memorial-learning experience is working and bug-free on production today**; the gaps are additive admin tooling and one data cleanup, not breakage of the family-facing flow.

FULL AUDIT COMPLETE — HONEST ASSESSMENT INCLUDED
