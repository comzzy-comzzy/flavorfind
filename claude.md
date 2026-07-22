# Claude Project Standards — FlavorFind

## Purpose
FlavorFind is a Vercel-deployable Next.js 14 web app that tracks the best
restaurants in Nigeria via scraped public web data. This document is the
single source of truth for how work happens in this repo when an agent
(Claude or otherwise) is contributing code.

## Stack
- Next.js 14 (App Router, TypeScript)
- React 18, Tailwind CSS 3
- Supabase (Postgres) for persistence
- Cheerio + Google Places API for scraping (run via GitHub Actions weekly)
- Vercel for hosting

## Repo Layout
```
app/                # App Router routes and API handlers
components/         # Reusable React components
lib/                # Helpers (Supabase client, ranking, normalization)
public/             # Static assets: logo.svg, og.png, patterns/
scripts/            # Long-running scripts (scraper)
supabase/           # Database schema and migrations
.github/workflows/  # CI and scheduled jobs
```

## Coding Conventions
- **TypeScript strict mode** is on. Do not commit `any` unless documented.
- Components: PascalCase file names (`Hero.tsx`), default exports for pages,
  named exports for components.
- Tailwind: only use the `brand.*` color tokens defined in `tailwind.config.ts`.
  No inline hex outside config.
- Server components by default. Add `"use client"` only when state, effects,
  or browser APIs are required.
- Path alias `@/*` is configured and preferred over relative imports past `../`.

## Visual Identity
- Light brown `#C8A165`, dark brown `#3E2723`, cream `#F5E6D3` (see
  `tailwind.config.ts`).
- All logos live in `public/logo.svg` (original vector artwork only — no
  copyrighted marks).
- Imagery is sourced from royalty-free providers (e.g., Unsplash) with
  photographer credits in a `// credit:` comment adjacent to the usage.

## Data Discipline
- No fabricated restaurants, reviews, or copy anywhere in the repo.
- No lorem ipsum, no AI-style generic placeholder text. Hand-write the
  microcopy.
- Scraped data lives in Supabase only. Seed scripts must hit real sources.

## Verification
Before claiming a task is done, an agent must:
1. Run `npm install` (only on first build or after `package.json` changes).
2. Run `npm run lint`.
3. Run `npm run build` and confirm zero errors.
4. Run `npm run dev` and curl `http://localhost:3000/` (expect HTTP 200).
5. For API routes, exercise the endpoint with `curl`.

## Commit Hygiene
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- One acceptance criterion per commit where practical.
- Never commit `.env.local` or `node_modules`.

## Scope Discipline
- Only ship the AC in the active task.
- Update `docs/plan.md` style notes only when behavior or design intent
  changes — not for stylistic churn.
