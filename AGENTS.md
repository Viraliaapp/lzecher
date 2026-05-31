<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lzecher Firestore Safety Rule

Firebase project `sifttube-416a0` is shared with other live Solomon apps, including Viralia, SiftTube, TAG Family Safety, and possibly others. Every Firestore or Storage change must be triple-checked before it runs:

- Only touch `lzecher_*` Firestore collections and `lzecher/` Storage prefixes.
- Never run broad deletes, migrations, or scripts against unprefixed collections.
- Prefer dry-run diagnostics before any production data write.
- If a script writes production data, print the exact `lzecher_*` collections/prefixes it will touch and require an explicit confirmation path.
- Keep all non-Lzecher app data out of queries, backups, migrations, and cleanup code.
