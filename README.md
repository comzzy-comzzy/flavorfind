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

## Deployment (Vercel)

1. Push this repo to your GitHub account.
2. In Vercel, click **Import Project** and pick the repo.
3. Add the four env vars from `.env.example` to the Vercel project settings.
4. Deploy. Vercel will detect Next.js automatically.

## Project Structure

```
app/                # Next.js App Router pages and API routes
  api/recommend/    # Recommendation endpoint
  restaurants/[id]/ # Restaurant detail pages
components/         # React components (Header, Hero, Footer, FilterBar, ...)
lib/                # Helpers (Supabase client, ranking logic, ...)
public/             # Static assets (logo.svg, og.png, patterns/...)
scripts/            # Long-running scripts (scraper)
supabase/           # Database schema and migrations
.github/workflows/  # CI and scheduled scraper
```

## License

MIT
