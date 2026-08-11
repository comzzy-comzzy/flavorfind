# FlavorFind

FlavorFind tracks the best restaurants in Nigeria by pulling live data from public web sources and recommending spots by budget, city, and reviews. It is a Vercel-deployable Next.js app styled with a light/dark brown African-themed UI.

## Features

- Ranked restaurant recommendations by city, cuisine, and budget tier.
- Live data scraping from Google Places and Nigerian food blogs (Cheerio).
- Brown African-themed UI with an original SVG logo and Ankara-inspired background patterns.
- Fully responsive layout (375px, 768px, 1280px breakpoints).

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Supabase (Postgres)
- Cheerio + Google Places API for scraping
- GitHub Actions for scheduled scraping

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# fill in Supabase URL/keys and Google Places API key
```

### 3. Run Supabase migrations

Apply `supabase/schema.sql` to your Supabase project (SQL editor or `supabase db push`).

### 4. Run the scraper (optional — populates your DB)

```bash
npm run scrape
```

### 5. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local dev server on port 3000 |
| `npm run build` | Production build (also runs `prebuild` asset generators) |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run scrape` | Run the scraper locally (writes to Supabase) |
| `npm run scrape -- --dry-run` | Validate the scraper payload without writing |
| `npm run scrape -- --source=google-places` | Run a single source |
| `npm run build:logo` | Regenerate `public/logo.svg` from brand tokens |
| `npm run build:pattern` | Regenerate `public/patterns/ankara.svg` |
| `npm run build:og` | Regenerate `public/og.png` (Open Graph image) |
| `npm run verify:logo` | Verify the SVG logo passes spec |
| `npm run verify:pattern` | Verify the Ankara pattern passes spec |
| `npm run verify:og` | Verify the OG image is 1200x630 RGB PNG |
| `npm run verify:schema-sql` | Verify `supabase/schema.sql` parses and contains required tables |
| `npm run verify:recommend` | Verify the recommend API ranking logic |
| `npm run verify:listing` | Verify the home listing page |
| `npm run verify:filters` | Verify the filter bar contract |
| `npm run verify:responsive` | Verify responsive breakpoints render |
| `npm run verify:scraper` | Verify scraper normalization (offline) |

## Documentation

The repo ships with focused docs alongside this README:

- [`docs/scraper.md`](docs/scraper.md) — AC-6 scraper architecture, sources, schedule, idempotency contract.
- [`docs/recommend.md`](docs/recommend.md) — AC-7 ranking formula, query params, response shape, error codes.
- [`docs/plan.md`](docs/plan.md) — original FlavorFind implementation plan and acceptance criteria.
- [`claude.md`](claude.md) — project standards for contributing agents (coding conventions, verification protocol, commit hygiene).

## Supabase setup

The `restaurants` and `reviews` schema lives in `supabase/schema.sql`. To
provision your database:

1. Create a free project at https://supabase.com.
2. In **SQL Editor**, paste the contents of `supabase/schema.sql` and run it.
   This creates both tables, their indexes, and the cached-aggregate
   triggers documented in the file header.
3. Copy **Project URL** (`Settings → API`) into `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy the **anon public** key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Copy the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY`
   (server-only; never expose to the browser).
6. (Optional) Run `npm run scrape` once to seed the `restaurants` table
   with real Google Places / blog data.

Vercel needs all four env vars (plus `NEXT_PUBLIC_SITE_URL`, set after
first deploy) — see the **Deployment** section below.

## Deployment helpers

Two opt-in scripts are checked in next to the README:

| Script | Purpose |
| --- | --- |
| `./deploy-github.sh` / `.\deploy-github.ps1` | Validate a GitHub URL, set the `origin` remote, `git push -u origin master`, and print the public URL. |
| `./deploy-vercel.sh` / `.\deploy-vercel.ps1` | Run `vercel login` → `vercel` (preview) → optional `vercel --prod`. |

Both are idempotent (they replace an existing `origin` remote if present)
and refuse to push on a dirty tree unless you confirm.

## Deployment

### A. Deploy to Vercel from a fresh GitHub repo (3 steps)

> **Important:** the assistant cannot push to GitHub on your behalf without your
> credentials and repo URL. The repo is committed and ready locally — you just
> need to do the following three commands once you have a GitHub repo URL
> (https://github.com/<you>/<repo>.git).

1. **Create an empty repo on GitHub**
   - Go to https://github.com/new
   - Name it `flavorfind` (or anything you like)
   - **Do not** initialize with README, .gitignore, or license — this repo
     already has those.
   - Copy the HTTPS URL (e.g. `https://github.com/yourname/flavorfind.git`).

2. **Push the local repo to GitHub** (run in the project root):

   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin master
   ```

   After this, your GitHub URL will look like
   `https://github.com/<your-username>/<your-repo>` — that is the link the
   assistant cannot produce on your behalf.

3. **Import the repo into Vercel**
   - Go to https://vercel.com/new
   - Click **Import** next to your new `flavorfind` repo.
   - Vercel auto-detects Next.js. Framework preset: **Next.js**. Build
     command: `npm run build`. Output directory: leave default.
   - Add environment variables (Project Settings → Environment Variables):

     | Name | Value |
     | --- | --- |
     | `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project>.supabase.co` |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
     | `SUPABASE_SERVICE_ROLE_KEY` | your service role key (server only) |
     | `GOOGLE_PLACES_API_KEY` | your Google Places API key (server only) |
     | `NEXT_PUBLIC_SITE_URL` | `https://<your-vercel-domain>.vercel.app` |

   - Click **Deploy**. Vercel builds and serves your site at
     `https://<your-vercel-domain>.vercel.app` within ~60 seconds.

### B. Deploy to Vercel via the CLI (alternative, no GitHub repo needed)

If you don't want to push to GitHub right now, you can deploy directly with the
Vercel CLI from this folder:

```bash
npm i -g vercel
vercel login          # opens browser to authenticate
vercel                # preview deploy (prompts to set up project + env vars)
vercel --prod         # production deploy
```

Vercel will give you a `*.vercel.app` URL at the end of `vercel --prod`. That
URL is the link to the live site.

### C. Build Vercel-ready locally

To confirm the project builds cleanly the same way Vercel will build it:

```bash
npm install
npm run lint
npm run build
```

The current `next.config.mjs` uses the default output (no `output:
'standalone'`) — Vercel handles routing and ISR automatically. All `process.env`
reads are gated by `NEXT_PUBLIC_` when used in client code, so a Vercel build
with placeholder env vars succeeds without runtime crashes.

## Project Structure

```
app/                # Next.js App Router pages and API routes
  api/recommend/    # Recommendation endpoint (GET ?city=&budgetTier=&cuisine=&limit=)
  restaurants/[id]/ # Restaurant detail pages (server-rendered)
components/         # React components (Header, Hero, Footer, FilterBar, MobileMenu, RestaurantCard)
lib/                # Helpers (Supabase client, ranking, normalization, brand tokens)
public/             # Static assets (logo.svg, og.png, patterns/ankara.svg)
scripts/            # Long-running scripts (scraper, asset builders, verifiers)
  lib/              # Scraper helpers (delay, logger, normalizer, upsert, types)
  sources/          # Scraper source adapters (google-places, nigerian-food-blog)
supabase/           # Database schema (schema.sql)
.github/workflows/  # Weekly scraper cron (scrape.yml)
docs/               # Detailed module docs (scraper, recommend, plan)
deploy-*.sh/.ps1    # One-shot GitHub + Vercel deployment helpers
```

## Troubleshooting

### `npm run build` fails with `metadataBase not set in metadata`
This is fixed by the `metadataBase` URL in `app/layout.tsx`. If you see it
again after editing `layout.tsx`, make sure the export still starts with
`metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://flavorfind.vercel.app")`.

### `npm run scrape` exits with `supabase_unconfigured`
Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your shell (or in
GitHub Actions secrets). For a dry run that does not require any env
vars, use `npm run scrape -- --dry-run`.

### Recommend API returns `503 supabase_unconfigured`
The route handler is wired but the build did not have Supabase URL/key
env vars. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
to your Vercel project settings and redeploy.

### Images render as broken icons on the deployed site
`next.config.mjs` only whitelists `images.unsplash.com`,
`lh3.googleusercontent.com`, and `source.unsplash.com`. If a future
source serves images from a different hostname, add it to
`images.remotePatterns` and redeploy.

### Vercel build fails with `Error: Environment variable not found: NEXT_PUBLIC_SUPABASE_URL`
The placeholder values in `.env.example` are fine for local builds
because the Supabase client returns `503 supabase_unconfigured` instead
of crashing. On Vercel, add the real values in
**Project Settings → Environment Variables** before deploying.

### Vercel deploy succeeds but the page is empty
Run the smoke test from your local terminal against the deployed URL:
```bash
curl -i https://<your-domain>.vercel.app/api/recommend?city=Lagos
```
A `503` response means the env vars are missing on Vercel. A `200` with
zero results means the database is empty — run `npm run scrape` once
your local env vars are configured.

### Local dev server exits with `EADDRINUSE :::3000`
Another process is holding port 3000. Either stop it
(`taskkill /IM node.exe /F` on Windows, `lsof -ti:3000 | xargs kill` on
macOS/Linux) or run `npm run dev -- -p 3001` to use a different port.

### `next/image` complains about hostname
The image URL host is not in the `remotePatterns` allowlist. Add it
to `next.config.mjs` `images.remotePatterns` and restart `npm run dev`.

## License

MIT
