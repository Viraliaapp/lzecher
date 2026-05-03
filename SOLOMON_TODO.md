# Solomon's Manual Actions

Updated: May 3, 2026

---

## Required (Before Launch)

### 1. Add CRON_SECRET to Vercel
```bash
# Generate a secret
openssl rand -hex 32
# Output: something like a1b2c3d4e5f6...

# Add to Vercel:
# Dashboard → Settings → Environment Variables → Add
# Name: CRON_SECRET
# Value: <your generated secret>
# Environment: Production
```

### 2. Test Photo Upload
1. Sign in at https://lzecher.com/en/login
2. Go to an existing memorial you created
3. Click "Add a photograph" button in the hero
4. Upload a face photo → verify crop UI works → verify it appears on the page

### 3. Verify Firebase Storage Rules
In Firebase Console (sifttube-416a0 project):
- Storage → Rules
- Ensure `lzecher/photos/{uid}/{projectId}.jpg` is:
  - Readable by anyone (for public display)
  - Writable only by authenticated users where `request.auth.uid == uid`

### 4. Test Magic Link Return Flow
1. Open a memorial page in incognito (logged out)
2. Click "Take this perek" on a Mishnayos portion
3. Verify the soft login modal appears
4. Enter your email, send magic link
5. Check email, click link
6. Verify you return to the memorial page

---

## Recommended (Post-Launch Enhancements)

### 5. Build Completion Target Wizard Step
The schema supports `completionTargetDate` and `completionTargetType`, but the create wizard doesn't have a dedicated step for picking the completion date yet.

### 6. Build Duration Picker Modal
For inclusive claims, the backend accepts `duration`, `durationValue` etc. The claim modal needs UI radio buttons for picking commitment length.

### 7. Wire Chizuk Modal Display
After marking a portion complete, display a celebratory modal with the chizuk message. The library (69 messages, 23 scenarios) is ready.

### 8. Build Siyum Scheduling UI
When a project hits 100%, display the hadran text and a "Schedule Siyum" form.

### 9. Build Certificate PDF
Generate a downloadable certificate of participation.

### 10. Cloud Vision SafeSearch
Add content moderation for photo uploads.

---

## Status
- Categories A, B, C: Code complete and deployed
- Core flows: Production-ready
- Advanced features: Backend ready, frontend UI needed
- Last verified: 2026-05-03
