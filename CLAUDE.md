@AGENTS.md

# Lzecher - Memorial Learning Platform

## Architecture
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Firebase (Auth, Firestore, Storage) - using Viralia/SiftTube project (sifttube-416a0) with `lzecher_` prefixed collections
- next-intl for i18n (en, he, es, fr)
- Radix UI primitives + CVA for component system
- Resend for transactional email

## Key Conventions
- All Firestore collections prefixed with `lzecher_`: lzecher_users, lzecher_projects, lzecher_portions, lzecher_claims, lzecher_moderation
- Documents MUST include `id` field in data, not just as document ID
- Brand colors: navy (#0F1B2D), gold (#C9A961), cream (#FAF6EC)
- Font stack: Frank Ruhl Libre (headings), Cormorant Garamond (serif accents), Inter (body)
- `cn()` utility from `@/lib/utils` for conditional classes
- Auth cookie: `__session=1` for middleware auth checks

## File Structure
- `src/app/[locale]/` - All locale-routed pages
- `src/app/[locale]/(app)/` - Protected routes (dashboard, create, settings)
- `src/app/[locale]/(auth)/` - Auth routes (login, signup)
- `src/app/[locale]/memorial/[slug]/` - Public memorial pages (SSR)
- `src/app/[locale]/admin/` - Admin moderation (requires isAdmin claim)
- `src/components/ui/` - Radix-based UI primitives
- `src/lib/firebase/` - Firebase client + admin SDK
- `src/lib/seed-data.ts` - Mishnayos, Tehillim, Parshiyot, Mitzvot data
- `messages/` - Translation JSON files (en, he, es, fr)
