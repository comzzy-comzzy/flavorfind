# AC-6 Scraper

The FlavorFind scraper pulls real restaurant data from two distinct
sources and upserts it into Supabase so the web app can recommend the
best Nigerian restaurants by budget, location, and reviews.

## Sources

1. **Google Places API (New)** -- `places.googleapis.com/v1` text
   search across `Lagos`, `Abuja`, `Port Harcourt`, `Ibadan`, `Enugu`,
   `Kano`. Each match is hydrated with a place-details lookup to
   capture the canonical address, rating, review count, price level,
   editorial summary, and up-to-five review snippets.
2. **Nigerian food blog index pages** -- a host-configurable
   comma-separated list of public blog URLs parsed with `cheerio`.
   Falls back to a hand-authored three-row fixture so the seed
   dataset always has something the web app can render.

## Architecture

```
scripts/
├── scrape.ts                     # orchestrator + CLI flag parsing
├── verify-scraper.ts             # offline regression check
├── lib/
│   ├── scraper-types.ts          # ScraperSource contract + row shapes
│   ├── normalizer.ts             # text / rating / price-level helpers
│   ├── upsert.ts                 # Supabase service-role upserts
│   ├── delay.ts                  # 1s rate-limit helper
│   └── logger.ts                 # [scrape] prefixed console logger
└── sources/
    ├── google-places.ts          # REST adapter (text + details)
    └── nigerian-food-blog.ts     # cheerio adapter (+ fixture fallback)
```

## Usage

```sh
# Full run (writes to Supabase):
npm run scrape

# Sanity-check the payload without writing:
npm run scrape -- --dry-run

# Run a single source:
npm run scrape -- --source=nigerian-food-blog

# Verbose mode (logs every upstream request):
npm run scrape -- --verbose
```

## Environment

| Variable                     | Required?         | Purpose                                    |
| ---------------------------- | ----------------- | ------------------------------------------ |
| `SUPABASE_URL`               | writes only       | `https://your-project.supabase.co`         |
| `SUPABASE_SERVICE_ROLE_KEY`  | writes only       | Service-role key (bypasses RLS)            |
| `GOOGLE_PLACES_API_KEY`      | google-places run | Google Places (New) REST                   |
| `BLOG_INDEX_URLS`            | optional          | Comma-separated list of public blog pages  |
| `SCRAPER_SOURCES`            | optional          | Comma-separated allowlist of source ids    |

When `--dry-run` is set, none of the above are required and the script
exits `0` after printing the normalised payload.

## Idempotency & cache contract

`restaurants` upserts key on the natural triple
`(name, city, source_url)`. After every successful upsert, the script
wipes the previous review snippets for that restaurant and re-inserts
the freshly scraped ones, so the cached `review_count` and `avg_rating`
columns match the `public.reviews` rows exactly. This mirrors the
cached-aggregate contract documented in `supabase/schema.sql`.

## Weekly schedule

`.github/workflows/scrape.yml` runs the scraper every **Sunday at
03:17 UTC**. It also accepts `workflow_dispatch` so a developer can
re-scrape on demand from the Actions tab. Required secrets
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`GOOGLE_PLACES_API_KEY`, `BLOG_INDEX_URLS`, `SCRAPER_SOURCES`) are
injected from GitHub Secrets.

## Verifier

`npm run verify:scraper` runs an offline regression check (no
network, no Supabase credentials) that confirms:

- both source adapters expose the `ScraperSource` contract;
- the food-blog fixture produces three valid Lagos rows;
- the normaliser drops malformed rows and clamps numeric ranges;
- the upsert module is wired to `@supabase/supabase-js` and upserts on
  `(name, city, source_url)`;
- the dedupe helper collapses case-insensitive duplicates;
- the GitHub Actions workflow file declares the cron schedule,
  `workflow_dispatch`, and the expected secrets;
- `scripts/scrape.ts --dry-run` exits `0` with no environment
  variables set.