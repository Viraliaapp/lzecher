# scripts/maintenance — operational scripts

These scripts perform destructive or otherwise sensitive maintenance on
production data. Run them only with explicit intent.

## wipe-test-projects.js

Wipes all test projects, portions, claims, reports, feedback, and scheduled
emails. Preserves users, mitzvot templates, admin audit, and the mussar
structure collection.

### Dry-run (safe — counts only)

```sh
node scripts/maintenance/wipe-test-projects.js --dry-run
```

Reports:
- How many docs would be deleted in each `lzecher_*` collection
- How many files in `lzecher/photos/*` and `lzecher/og/*` Storage prefixes

Does **not** delete anything.

### Execute (destructive)

```sh
node scripts/maintenance/wipe-test-projects.js --execute
```

Will prompt you to type `WIPE_ALL_LZECHER_PROJECTS` to confirm. Any other input
aborts. After confirmation:

1. Deletes every document in:
   - `lzecher_projects`
   - `lzecher_portions`
   - `lzecher_claims`
   - `lzecher_reports`
   - `lzecher_feedback`
   - `lzecher_scheduled_emails`
2. Deletes Storage files under `lzecher/photos/*` and `lzecher/og/*`.
3. Writes an audit log to `scripts/maintenance/wipe-log-<timestamp>.txt`.

### What is preserved

- `lzecher_users` — user profiles + admin/super-admin flags survive.
- `lzecher_mitzvot_templates` — kabalos seed templates.
- `lzecher_admin_audit` — historical admin actions.
- `lzecher_mussar_structure` — daily mussar curriculum.
- Firebase Auth users — never touched.
- Anything NOT prefixed with `lzecher_` — never touched (other apps share
  this Firestore instance).

### After wiping

The site will show empty memorials directory. To re-seed test memorials,
create them via the normal `/he/create` wizard. Templates and admin claims
remain intact.

### Safety

- **Never** run `--execute` against production unless explicitly told to by
  the owner.
- The dry-run is idempotent and safe to run anytime.
- If a deletion mid-run fails, the audit log shows exactly what completed
  vs what didn't.
