# FlavorFind - Implementation Plan

## Goal
Build **FlavorFind**, a Vercel-deployable web app that tracks the best restaurants in Nigeria via scraped web data and recommends them based on budget, location, and reviews, styled with a light/dark brown African-themed UI and a unique logo, then push the repo to the user's GitHub.

## Context
- Working directory `C:\Users\USER\Documents\cyopsproject\new-project` is the build target (assumed empty).
- Must be a static-friendly Next.js app ready for Vercel deployment via GitHub integration.
- Scraping must use real public sources; no AI-fabricated restaurants, reviews, or copy anywhere in the codebase.
- Visual identity: light brown + dark brown palette, African-pattern motifs, imagery of happy Nigerians (use royalty-free sources, e.g., Unsplash with photographer credit in code comments), and an original SVG logo (no copyrighted marks).
- Stack assumption (chosen approach): Next.js 14 (App Router, TypeScript) + Tailwind CSS + Supabase (Postgres) + Cheerio-based scraper run via GitHub Actions on a schedule, recommendation logic in Next.js Route Handlers.
- Alternatives considered:
  - **A. Next.js + Supabase + GitHub Actions scraper** — chosen for persistent data, cron automation, and free tier fit.
  - B. Next.js + Google Sheets as DB — simpler but harder to query/recommend.
  - C. Pure static JSON — fails the "track best restaurants" requirement because data would go stale instantly.

## Acceptance Criteria

- **AC-1: Project scaffold**
  - `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`, `README.md` exist at repo root.
  - `npm install && npm run build` completes with zero errors.
  - Sub-bullet: `npm run dev` serves `http://localhost:3000` returning HTTP 200 on `/`.

- **AC-2: Brown color palette in Tailwind**
  - `tailwind.config.ts` defines `colors.brand.light = '#C8A165'` and `colors.brand.dark = '#3E2723'` (or co-equal values) plus an accent `colors.brand.cream = '#F5E6D3'`.
  - Sub-bullet: Backgrounds, headings, buttons, and cards exclusively use these tokens — no inline hex outside config.

- **AC-3: Unique FlavorFind logo**
  - File `public/logo.svg` exists with original vector artwork combining a stylized bowl/spoon glyph and the wordmark "FlavorFind".
  - Sub-bullet: Header component renders `<img src="/logo.svg" alt="FlavorFind logo" />` and appears on every page.

- **AC-4: African-themed hero**
  - `components/Hero.tsx` includes an SVG Ankara/Adire-style pattern as a CSS background and a hero image of happy Nigerians (sourced from Unsplash, photographer credited in a `// credit:` comment in the file).
  - Sub-bullet: Headline, sub-headline, and primary CTA ("Find a Restaurant") visible above the fold on desktop and mobile.

- **AC-5: Restaurant data schema (Supabase)**
  - File `supabase/schema.sql` creates `restaurants` table with columns: `id uuid pk`, `name text`, `city text`, `area text`, `cuisine text`, `budget_tier smallint` (1=low ₦, 2=mid ₦, 3=high ₦), `avg_rating numeric(3,2)`, `review_count int`, `address text`, `source_url text`, `scraped_at timestamptz`, `image_url text`.
  - Sub-bullet: `reviews` table: `id`, `restaurant_id` (fk), `snippet text`, `rating numeric(3,2)`, `source_url text`, `scraped_at timestamptz`.

- **AC-6: Scraper**
  - File `scripts/scrape.ts` is a runnable Node script (`tsx scripts/scrape.ts`) that pulls real restaurant data from at least two distinct sources (e.g., Google Places API + a Nigerian food blog via Cheerio).
  - Sub-bullet: Upserts rows into Supabase using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`.
  - Sub-bullet: `.github/workflows/scrape.yml` runs the scraper weekly on a cron schedule.

- **AC-7: Recommendation endpoint**
  - Route `app/api/recommend/route.ts` accepts query params `city`, `budgetTier`, `cuisine`, returns ranked JSON list.
  - Sub-bullet: Ranking formula: `score = avg_rating * 0.6 + normalized_review_count * 0.3 + location_match_bonus * 0.1` (documented in code comments).
  - Sub-bullet: `curl "http://localhost:3000/api/recommend?city=Lagos&budgetTier=2"` returns 200 + non-empty array when DB has data.

- **AC-8: Restaurant listing & detail pages**
  - `app/page.tsx` shows top restaurants in default city (Lagos) using server components.
  - `app/restaurants/[id]/page.tsx` shows name, area, cuisine, budget tier (with ₦ icon), avg rating, review snippets, source link, image.
  - Sub-bullet: Each card links to its detail page using Next.js `Link`.

- **AC-9: Filters UI**
  - `components/FilterBar.tsx` exposes city dropdown (Lagos, Abuja, Port Harcourt, Ibadan, Enugu, Kano — extensible), budget tier radio (₦/₦₦/₦₦₦), cuisine multiselect.
  - Sub-bullet: Filters update URL search params and trigger a server-side re-fetch.

- **AC-10: Responsive design**
  - Layouts pass at 375px, 768px, 1280px breakpoints using Tailwind responsive utilities.
  - Sub-bullet: Header collapses to hamburger menu on mobile (`components/MobileMenu.tsx`).

- **AC-11: SEO/meta**
  - `app/layout.tsx` sets `<title>FlavorFind — Best Restaurants in Nigeria</title>`, meta description, Open Graph image (uses `public/og.png`), `lang="en"`, and `theme-color` matching `brand.dark`.

- **AC-12: Documentation**
  - `README.md` documents: setup (`npm install`, copy `.env.example` → `.env.local`, run Supabase migrations), scraping (`npm run scrape`), deploy (push to GitHub → import in Vercel → add env vars).
  - Sub-bullet: `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY` (placeholders only).

- **AC-13: Git push to user's GitHub**
  - Repo is initialized, all files committed, and a `git remote add origin <user-repo-url>` step is documented and executed once the user supplies their repo URL.
  - Sub-bullet: Initial commit message `feat: initial FlavorFind scaffold`. `.gitignore` excludes `node_modules`, `.next`, `.env.local`.

- **AC-14: Vercel-ready build**
  - `next.config.mjs` includes `output: 'standalone'` only if needed; otherwise default.
  - Sub-bullet: `npm run build` succeeds with placeholder env vars set in CI.

- **AC-15: No AI-generated slop**
  - All seeded/sampled data is sourced from real scraping; no fabricated reviews or restaurant names hardcoded in the repo.
  - Sub-bullet: No `lorem ipsum`, no AI-style generic copy in components — headlines and microcopy are hand-written.

## Implementation Notes

**Sequencing (work batches, each independently testable):**
1. **Scaffold batch** — `npm create next-app@latest .` (TS, App Router, Tailwind, ESLint, src/ off), prune defaults, create `.gitignore`, `.env.example`, `README.md`.
2. **Brand batch** — Tailwind brown palette, `public/logo.svg` (hand-authored SVG), `components/Header.tsx`, `components/Hero.tsx`, Ankara-pattern SVG in `public/patterns/ankara.svg`.
3. **Data batch** — Author `supabase/schema.sql`, write Supabase client helper in `lib/supabase.ts`.
4. **Scraper batch** — `scripts/scrape.ts` using `cheerio` + `node-fetch` for blogs and `@googlemaps/places` (or REST) for Google Places; `tsconfig.scripts.json` so it runs via `tsx`.
5. **API batch** — `app/api/recommend/route.ts`, `app/api/restaurants/route.ts` with ranking logic documented inline.
6. **UI batch** — `app/page.tsx`, `app/restaurants/[id]/page.tsx`, `components/RestaurantCard.tsx`, `components/FilterBar.tsx`, `components/Footer.tsx` (with photographer credit for hero image).
7. **Automation batch** — `.github/workflows/scrape.yml` (weekly cron), `.github/workflows/ci.yml` (lint + build on PR).
8. **Deploy batch** — `git init`, commit, push to user-supplied GitHub URL.

**Key technical decisions:**
- Use Supabase free tier; the same client is reused for both the app and the scraper.
- Server Components for listing pages to keep client JS small (Vercel-friendly).
- Avoid Puppeteer in scraper (too heavy for GitHub Actions free tier); prefer Cheerio + Google Places REST.
- Image hosting: use source URLs directly with `next/image` `remotePatterns` allowlist in `next.config.mjs` instead of re-hosting.

**Dependencies (exact versions to install):**
- `next@14`, `react@18`, `react-dom@18`, `typescript@5`, `tailwindcss@3`, `@supabase/supabase-js@2`, `cheerio@1`, `node-fetch@3`, `zod@3` (for query validation), `tsx@4` (dev), `eslint`, `eslint-config-next`.

**Verification commands (run in order):**
- `npm install`
- `npm run lint`
- `npm run build`
- `npm run dev` → open `http://localhost:3000` → confirm hero, header logo, and default Lagos listings render.
- `npx tsx scripts/scrape.ts` (with real env vars) → confirm rows appear in Supabase.
- `curl "http://localhost:3000/api/recommend?city=Lagos&budgetTier=2"` → confirm JSON array.
- `git status` clean; `git log --oneline` shows the initial commit.

**Risk controls:**
- Scraping source ToS: scrape only public pages; respect `robots.txt`; include a 1s delay between requests.
- API key leakage: never commit `.env.local`; CI uses GitHub Secrets.
- Build failure on Vercel: ensure all `process.env.X` reads are gated by `NEXT_PUBLIC_` prefix when used client-side.

## Out of Scope
- User accounts, authentication, saved favorites (no auth layer requested).
- Online reservations or order placement.
- Mobile app (PWA or native).
- Payment integration.
- Admin dashboard for manual data edits (scraper is the sole data source).
- AI-based review summarization or generative copy.
- Internationalization beyond English.