# Solomon's Manual Actions

Updated: May 3, 2026

---

## Required (Before Launch)

### 1. Add CRON_SECRET to Vercel
```bash
# Generate a secret
openssl rand -hex 32

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

### 4. Test Full Claim Flow (Logged Out)
1. Open a memorial page in incognito (logged out)
2. Click "Take this perek" on a Mishnayos portion
3. Verify the SoftLoginModal appears (friendly copy, privacy promises)
4. Test "Or claim anonymously" link → should open regular claim dialog
5. Test email path → send magic link → verify return to memorial

### 5. Test Chizuk After Completion
1. Sign in, go to a memorial
2. Claim a perek, then click "Mark Complete"
3. Verify a beautiful modal appears with:
   - Yahrzeit candle
   - Religious message mentioning the honoree's name
   - Stats and Continue button

### 6. Test Reminder Email Queue
1. Claim a portion, enter your email, check "Confirmation email now"
2. Check Firestore → lzecher_scheduled_emails → verify a doc was created
3. Once CRON_SECRET is set, the daily cron will process queued emails

---

## Recommended (Post-Launch Enhancements)

### 7. Build Duration Picker UI
Backend accepts duration/durationValue/durationEndDate. Need a radio group in the claim modal for inclusive tracks: One-time / Daily for X / Weekly for X / Until date / Indefinitely.

### 8. Build Completion Target Wizard Step
Schema supports completionTargetDate/completionTargetType. Need a wizard step with radio options: Shloshim / Year / Yahrzeit / Custom / Open-ended.

### 9. Build Certificate PDF
Generate downloadable participation certificate. Translations ready in siyum.certificateBody.

### 10. Cloud Vision SafeSearch
Add content moderation for photo uploads before saving to Storage.

---

## What's Live Now (Wired & Deployed)

| Feature | Status |
|---------|--------|
| Chizuk messages after completion | WIRED — shows modal with localized message |
| SoftLoginModal for anonymous users | WIRED — gates claim flow for logged-out users |
| Reminder email queueing | WIRED — creates scheduled_emails docs on claim |
| Reminder cron processing | READY — needs CRON_SECRET to run |
| Siyum banner at 100% | WIRED — shows Hadran text on completion |
| Email + reminder prefs in claim modal | WIRED — shows when email entered |
| Duration picker UI | NOT YET — backend ready |
| Completion target wizard step | NOT YET — schema ready |

---

## Platform Status
- Core flow (create → browse → claim → complete): **Production-ready**
- Engagement features (chizuk, reminders, soft login, siyum): **Wired and deployed**
- Advanced features (duration picker, completion target, certificates): **Backend ready, UI pending**
- Last deploy: 2026-05-03
