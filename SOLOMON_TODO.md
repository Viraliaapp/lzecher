# Solomon's Remaining Manual Tasks

Tasks that require human action (browser login, clicking through consoles, etc.) that Claude Code cannot automate.

---

## Required Before Launch

### 1. Enable Email Link Sign-In (~2 min)
- Go to https://console.firebase.google.com → project `sifttube-416a0`
- **Authentication → Sign-in method → Email/Password**
- Toggle ON **"Email link (passwordless sign-in)"**
- Click **Save**
- *Why:* Magic link auth won't work without this

### 2. Add Authorized Domains (~2 min)
- Same Firebase Console → **Authentication → Settings → Authorized domains**
- Add: `lzecher.com`, `www.lzecher.com`, `lzecher.vercel.app`, `localhost`
- *Why:* Firebase rejects magic link completion from unauthorized domains

### 3. Set Up Upstash Redis (~5 min)
- Go to https://upstash.com and sign up (GitHub/Google login works)
- Click **Create Database**
- Name: `lzecher-prod`, Type: Regional, Region: `us-east-1`
- Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** from the REST API section
- Give both values to Claude Code to add to Vercel env vars
- *Why:* Persistent rate limiting across serverless instances to prevent email spam abuse

### 4. Configure DNS (~5 min, if not done)
- In Namecheap for `lzecher.com`:
  - A Record: `@` → `76.76.21.21`
  - CNAME: `www` → `cname.vercel-dns.com`
- *Why:* Points domain to Vercel

---

## Recommended (Post-Launch)

### 5. Set Up reCAPTCHA Enterprise + App Check (~10 min)
- Go to https://console.cloud.google.com/security/recaptcha (project: sifttube-416a0)
- Enable the reCAPTCHA Enterprise API if prompted
- **Create Key**: name `lzecher-prod`, platform Website, domains: `lzecher.com`, `www.lzecher.com`, `lzecher.vercel.app`
- Uncheck "Use checkbox challenge" (we want invisible)
- Copy the **Key ID**
- Then go to Firebase Console → **App Check** → Register your web app → Choose reCAPTCHA Enterprise → Paste key → Save
- Set enforcement to **Unenforced** initially for Firestore, Storage, Auth
- Give the Key ID to Claude Code to add as `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` in Vercel
- After a few days of clean traffic in App Check metrics, flip to **Enforced**
- *Why:* Prevents automated abuse of Firebase services

### 6. Create Sentry Project (~5 min)
- Go to https://sentry.io, create account, create a Next.js project
- Copy the DSN
- Add `NEXT_PUBLIC_SENTRY_DSN` to Vercel env vars
- *Why:* Error monitoring in production

### 7. Submit Sitemap to Search Engines (~5 min)
- Go to https://search.google.com/search-console → Add Property → `lzecher.com`
- Verify via DNS TXT record
- Submit sitemap: `https://lzecher.com/sitemap.xml`
- Do the same at https://www.bing.com/webmasters
- *Why:* SEO indexing

### 8. Create First Memorial (~10 min)
- Go to https://lzecher.com/en/create (or /he/create for Hebrew)
- Create the inaugural memorial for your grandfather
- After submitting, go to /admin to approve it (you have isAdmin)
- Share the link as the showcase example
- *Why:* The platform needs its first real memorial to demonstrate the product

### 9. Social Media & Branding (~15 min)
- Create @lzecher on Instagram and X/Twitter
- Add social links to footer (update `messages/*.json` and `Footer.tsx`)
- *Why:* Brand presence

### 10. Rav Haskama (~ongoing)
- Reach out to a Rav for halachic endorsement
- Add their statement to the `/halachic-guidance` page
- *Why:* Credibility for the halachic basis of the platform
