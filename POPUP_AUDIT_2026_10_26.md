# Activity popup follow-up — release review

This preflight report describes the scoped popup release. On October 26 the user
approved publication/deployment and chose to retain the latest available activity
even when older than 24 hours. No real commitments, email, SMS, or production data
writes were used for testing. The task's release result records the final deployed
commit and verification; this document records the reviewed source and checks.

## Baseline and causation

- Release base: `9eeb42ef5db65eb69f30f60fd2e199b79a641646`, branch
  `codex/full-safety-dashboard-20260531`.
- Fresh remote and live `/api/version` checks at release preflight reported that
  same revision. Existing Vercel CLI login and production deployment were verified.
- Pre-release baseline: `a9ea2afff49c71b2c6ead02fef185af78c17a9cd`.
- The activity component, settings hook, recent-activity route and formatter are
  byte-identical in these two commits. The before/after tests load the exact old
  sources with `git show`, rather than reimplementing their behavior.
- The verified defects therefore predate the prior release. This does not prove
  that an indirect runtime/configuration effect could not contribute to the
  user's live symptom. The actual production symptom was not reproduced end to end.

## Three review passes

1. Correctness and contract: delayed settings previously consumed the entire
   6.5-second popup lifetime before rendering. The effect now starts after settings
   resolve. Old burst handling marked all IDs seen but displayed only three; a
   bounded queue now displays successive batches in chronological order. The
   initial popup is the newest valid event, and repeat polls do not replay it.
   Counts can refresh while queued without creating a duplicate popup.
2. Data integrity and edge cases: the old 80-document query undercounted a
   525-chapter bulk reservation and rounded timestamps merged independent claims
   made in the same second. The new read helper expands actual child claims and
   uses reservation identity. It handles committed portions of interrupted writes,
   renamed/deleted children, mixed tracks and stale parents. Invalid, cancelled,
   future-dated and deleted-project entries are excluded. Public payloads omit
   contact fields. Existing inclusion of password-protected memorial activity is
   preserved. No authorization rules, reservation writers or schemas changed.
3. UI and regression: real React component, settings hook, formatter and Framer
   Motion are exercised, with only network responses and long application timers
   controlled. Actual opacity and exit completion are checked. Four locales,
   plaintext participant rendering, disable/re-enable on navigation, StrictMode,
   unmount, serial retry and abort behavior are covered. The new fixture does not
   replace `ActivityBubbles`; the older broader UI suite still does, and is used
   only as regression coverage for its other features.

Mishnayos portions represent chapters, so all four locale unit labels now say
chapters. Per the user's final choice, the feed has no age cutoff: it retains
the latest available activity and original timestamps even if a year old. Old
event IDs remain deduplicated. Popup wording does not say "just now" or "today".
Hung requests time out after 10 seconds; failed requests can recover on later
polls. Settings fallback remains the existing default settings.

## Checks

| Check | Final result |
| --- | --- |
| `npm run lint` | Passed; exit 0 |
| `npm run typecheck` | Passed; exit 0 |
| `npm run test:audit` | 62 passed, 0 failed/skipped; includes 4 exact-source before/after tests |
| `npm run smoke:static` | All 3 static scripts passed |
| `npm run test:audit-emulator` | 22 passed, 0 failed/skipped; isolated `demo-lzecher-audit` Firestore/Auth only |
| `npm run build` | Passed; exit 0, including final rerun after the read-budget edit; synthetic environment |
| `npm run test:audit-ui` | 20 passed, no captured errors; synthetic homepage/dashboard/login flows |
| Real popup browser fixture | 20 passed, 0 failed, no captured errors at desktop and 320px mobile; includes year-old activity and deduplication |
| Exact released popup negative control | Prior 19-scenario run: 5 pass / 14 expected negative-control failures, including missing delayed popup, lost burst, and old units; not 14 distinct production bugs |
| Mobile visual bounds | Viewport 320px; popup left 16px, right 232px, width 216px; text scroll/client width both 149px; RTL |
| `git diff --check` and encoding scan | Passed |

The emulator includes real bulk-route -> Firestore -> activity-GET -> rename
verification: 120 reserved chapters remain 120 in the feed, with one correctly
renamed child. Synthetic writer tests cover 525 chapters, separate same-second
reservations, and an interrupted 250-chapter reservation growing from 200 to 250
while retaining identity. The emulator also preserves 120 chapters and their
original timestamps after aging the synthetic records by a year. No test requested
reminder delivery.

Initial restricted runs could not open the emulator hub, launch the broader
browser runner, or download existing Google Fonts. These passed with approved
local-process/network access. A generated Turbopack cache failed; preserving it
outside the repository and rebuilding resolved the failure. Browser animation
tests initially raced a fixed 550ms sleep; the final harness waits for observable
animation completion without stubbing animation or weakening the assertions.

## Files

Application: `src/components/activity/ActivityBubbles.tsx`,
`src/lib/use-site-settings.ts`, `src/lib/activity-format.ts`,
`src/lib/activity-events.ts` (new), `src/lib/recent-activity.ts` (new),
`src/app/api/activity/recent/route.ts`.

Tests/tooling: `package.json`, `scripts/audit/support/fake-firestore.ts`,
`scripts/audit/firebase-emulator.integration.test.mjs`,
`scripts/audit/activity-regression.test.ts` (new),
`scripts/audit/activity-baseline.test.ts` (new),
`scripts/audit/activity-browser-fixture.tsx` (new),
`scripts/audit/serve-activity-browser-fixture.mjs` (new), and this report.

Evidence: `test-results/activity-browser/results.json`, `mobile-results.json`,
`baseline-results.json`, `desktop.jpg`, `mobile.jpg`; broader UI results under
`test-results/audit-ui`; emulator observations under `test-results/emulator`;
final release command logs at `../popup-release-*.log` (earlier local review logs
at `../popup-final-*.log`). Generated evidence is git-ignored.

To reproduce browser checks, run `npm run audit:activity-browser` and open the
printed loopback URL. `/?baseline=1` runs the exact released source as a negative
control. No external requests are permitted by the fixture CSP.

## Remaining limits and release recommendation

- Earlier live inspection was denied without a stated reason. After the user's
  new explicit release/live-verification authorization, the allowed retry succeeded:
  production activity was enabled, a baseline popup rendered, and no homepage
  console errors were captured. Post-deployment public checks are recorded in the
  task release result. Real reservation writes and authenticated live flows remain
  untested; no zero-regression guarantee is made.
- These popups remain a best-effort recent feed, not a complete activity history:
  discovery examines 80 documents, returns at most 20 events, shows at most three
  active popups, and queues at most 60. High sustained traffic can exceed that
  coverage. Initial load still shows only the newest event.
- Exact bulk counts cost additional Firestore reads. Expansion now has a shared
  2,000-child budget per response, with one extra sentinel read to detect overflow;
  it omits a group rather than publishing a known partial count. The original
  10-second shared-cache / 20-second stale-while-revalidate policy is retained.
  No production performance or billing estimate is asserted.
- The shared settings hook affects other consumers; static, type, build and
  broader UI checks help, but cannot establish zero regressions.
- Authorized release procedure: verify remote/live HEAD again,
  preserve intervening work, publish a scoped branch/PR, require the checks above,
  then deploy through the existing project. Check version, settings, public
  activity response, four locales and narrow layouts read-only. A new live
  reservation test would need safe test data/authorization.
- Rollback target for this follow-up is the currently released `9eeb42e`, deployment
  `dpl_APAx2pwE7XJ5CXgVQgiYDSxyfMbJ`,
  `https://lzecher-4amples0r-solomon2145-6860s-projects.vercel.app`.
  No database migration is involved; rolling back restores the old popup behavior.
