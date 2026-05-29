# VERIFICATION_AUDIT_FULL — Prompts A + B + C (kabalos/completion/dashboard already in prior work)

Audit against **real production** (https://lzecher.com). Live commit: `277d7f1` (branch `prompt-abc`), env `production`, deployed 2026-05-29.

## Deploy + migration facts
- Deployed: `npx vercel --prod --force` → https://lzecher.com (READY, production). `/api/version` commit = `277d7f16ae75a8e0601d68eaba5f4a146f95f918`.
- Migration `scripts/migrate-prompt-a.mjs --apply`: **10 lzecher_projects updated** (canonical progress + topMatmidim + safe defaults), wrote `lzecher_global_stats/totals`.
- Backups: `scripts/backups/lzecher_projects-2026-05-29T20-18-04-856Z.json` (pre-apply, 10 docs); earlier dry-run snapshots also present.
- Global aggregate computed: **585 משניות · 441 פרקי תהילים · 10 קבלות · 106 משתתפים · 10 projects**.
- Previously-"private" projects (left OPEN, flagged for Solomon to optionally password): memorial-sm1g7n, memorial-68jywm, memorial-upvad8.

Status legend: ✅ PASS · 🔧 FIXED-DURING-AUDIT · ❌ STILL-BROKEN · ⏳ NEEDS-SOLOMON-MANUAL (real browser/email/login)

_(sections filled in below as checks run)_
