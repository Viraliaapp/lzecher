# Solomon's Remaining Manual Tasks

Updated: April 30, 2026

---

## Required Before Sharing Widely

### 1. Enable Email Link Sign-In in Firebase Console (~2 min)
- Firebase Console → project `sifttube-416a0` → Authentication → Sign-in method
- Toggle ON **"Email link (passwordless sign-in)"**
- Save
- *Without this, magic link auth doesn't work*

### 2. Add Authorized Domains in Firebase Console (~2 min)
- Authentication → Settings → Authorized domains
- Add: `lzecher.com`, `www.lzecher.com`, `lzecher.vercel.app`, `localhost`

### 3. Sign In With Correct Account (~1 min)
- If the wizard shows `roz198550@gmail.com` as creator, you're signed in as the wrong account
- Sign out → sign back in with `solomon2145tag@gmail.com` (or whichever is your primary)
- The super admin account is `solomon2145@gmail.com` — sign out/in to refresh claims

### 4. Create Your First Memorial (~10 min)
- Go to https://lzecher.com/he/create (or /en/create)
- Create the inaugural memorial for your grandfather
- The memorial goes live instantly — no moderation queue
- Share the link as the showcase

---

## Recommended (Post-Launch)

### 5. Set Up reCAPTCHA Enterprise + App Check (~10 min)
- https://console.cloud.google.com/security/recaptcha → Create key for lzecher.com
- Firebase Console → App Check → Register with reCAPTCHA Enterprise
- Give the key to Claude Code to add as `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

### 6. Submit Sitemap to Search Engines (~5 min)
- Google Search Console: verify lzecher.com, submit https://lzecher.com/sitemap.xml
- Bing Webmaster Tools: same

### 7. Create Sentry Project (~5 min)
- https://sentry.io → create Next.js project → copy DSN
- Add `NEXT_PUBLIC_SENTRY_DSN` to Vercel env vars

### 8. Social Media + Branding (~15 min)
- Create @lzecher on Instagram/X → add links to footer

### 9. Rav Haskama (~ongoing)
- Obtain halachic endorsement → add to /halachic-guidance page
