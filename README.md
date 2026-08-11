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
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run scrape` | Run the scheduled scraper locally |

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
  api/recommend/    # Recommendation endpoint
  restaurants/[id]/ # Restaurant detail pages
components/         # React components (Header, Hero, Footer, FilterBar, ...)
lib/                # Helpers (Supabase client, ranking logic, ...)
public/             # Static assets (logo.svg, og.png, patterns/...)
scripts/            # Long-running scripts (scraper, asset builders, verifiers)
supabase/           # Database schema and migrations
.github/workflows/  # CI and scheduled scraper
```

## License

MIT
