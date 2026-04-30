# Lzecher

**A free, multilingual memorial learning platform for Klal Yisrael.**

Honor the memory of departed loved ones through communal Torah learning. Families create memorial pages and people from around the world claim portions of Mishnayos, Tehillim, Shnayim Mikra, and Mitzvot to learn l'iluy nishmas.

**Live at [lzecher.com](https://lzecher.com)** | Hebrew, English, Spanish, French

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, CVA, Radix UI |
| Auth | Firebase Auth (Magic Link only) |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Email | Resend |
| Hosting | Vercel |
| i18n | next-intl (EN, HE, ES, FR) |
| Monitoring | Sentry (optional), Vercel Analytics |
| Fonts | Frank Ruhl Libre, Cormorant Garamond, Inter |

## Brand Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Navy | `#0F1B2D` | Primary background, headings |
| Gold | `#C9A961` | Accents, buttons, highlights |
| Cream | `#FAF6EC` | Page backgrounds |
| Charcoal | `#2A2D34` | Body text |
| Muted | `#6B6F76` | Secondary text |

Seder accent colors: Zeraim `#2F5D3E`, Moed `#1E3A5F`, Nashim `#8B3A4E`, Nezikin `#B8860B`, Kodashim `#5B3F7A`, Tahorot `#2B6E6E`

## Project Structure

```
src/
  app/
    [locale]/              # Locale-routed pages (en, he, es, fr)
      (app)/               # Protected routes (dashboard, create, settings)
      (auth)/              # Auth routes (login, signup)
      memorial/[slug]/     # Public memorial pages (SSR)
      admin/               # Admin moderation queue
      about/privacy/terms/ # Static content pages
    api/                   # API routes (seed, auth)
    sitemap.ts             # Dynamic sitemap
    robots.ts              # Robots config
  components/
    ui/                    # Radix-based primitives (Button, Card, Dialog, etc.)
    layout/                # Navbar, Footer, LanguageSwitcher
    landing/               # Hero, Features, Tracks, HowItWorks, CTA
    memorial/              # MemorialPageClient
  context/                 # AuthContext
  i18n/                    # Routing, navigation, request config
  lib/
    firebase/              # Client config, admin SDK, auth helpers
    types.ts               # TypeScript interfaces
    seed-data.ts           # Mishnayos, Tehillim, Parshiyot, Mitzvot data
    utils.ts               # cn() utility
messages/                  # Translation JSON files (en, he, es, fr)
scripts/                   # Admin CLI scripts
```

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase project with Auth + Firestore enabled

### Setup

```bash
git clone https://github.com/Viraliaapp/lzecher.git
cd lzecher
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
RESEND_API_KEY=your_resend_key

# Optional
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy

```bash
npx vercel --prod
```

## Admin Scripts

```bash
# List recent Firebase Auth users (find your UID)
npm run admin:list

# Grant admin access to a user
npm run admin:grant -- <UID>

# Grant super admin access (can delete memorials, manage admins)
npm run admin:grant-super -- <UID>
```

## Seed Data

When a memorial project is created, portions are auto-generated instantly:

| Track | Count |
|-------|-------|
| Mishnayos (by perek) | 525 perakim across 63 masechtos |
| Tehillim | 150 mizmorim |
| Shnayim Mikra | 54 parshiyot |
| Mussar | 130 units across 8 seforim |
| Mitzvot | 11 templates |

## Firestore Collections

All collections are prefixed with `lzecher_`:

- `lzecher_users` - User profiles
- `lzecher_projects` - Memorial projects
- `lzecher_portions` - Individual learning portions
- `lzecher_claims` - Claim records
- `lzecher_moderation` - Moderation queue

## License

MIT

---

*L'iluy Nishmas - Honoring memory through Torah learning*

*Pour l'elevation de l'ame - Honorer la memoire par l'etude de la Torah*

*Para la elevacion del alma - Honrar la memoria a traves del estudio de la Tora*

*לעילוי נשמת - לזכר עולם יהיה צדיק*
