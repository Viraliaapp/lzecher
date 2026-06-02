Lzecher Firebase Rules
======================

Viralia uses one shared Firebase project for multiple apps. Do not deploy these
files as a standalone Firebase configuration.

These files are Lzecher-scoped snippets to merge into the master Viralia
Firestore and Storage rules:

- `lzecher-firestore.rules`
- `lzecher-storage.rules`

Safety rules for deployment:

1. Merge these snippets into the existing Viralia master rules.
2. Keep all existing non-Lzecher match blocks intact.
3. Deploy only after reviewing the merged full ruleset.
4. Never add a root `firebase.json` for this repo unless it points to a merged
   Viralia-wide ruleset, not only Lzecher.

The snippets are intentionally limited to `lzecher_*` Firestore collections and
`lzecher/` Storage paths.
