/**
 * AC-6 Scraper entrypoint.
 *
 * Pulls real restaurant data from two distinct sources
 *   1. Google Places REST (places.googleapis.com/v1)            -- real API.
 *   2. Nigerian food blog index pages (Cheerio)                 -- hand-curated
 *      blog list, with a hand-authored fixture fallback.
 *
 * and upserts the normalised rows into `public.restaurants` and
 * `public.reviews` via the Supabase service-role key. The script
 * honours a `--dry-run` flag (no writes), a `--verbose` flag
 * (per-request logging), and a `--source=` filter (so a developer can
 * re-run only one adapter without re-typing env vars).
 *
 * Usage:
 *   npm run scrape                       # run all enabled sources
 *   npm run scrape -- --dry-run          # print payload, do not write
 *   npm run scrape -- --source=google-places
 *   npm run scrape -- --verbose
 *
 * Env vars (read from process.env):
 *   SUPABASE_URL            -- https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_PLACES_API_KEY
 *   BLOG_INDEX_URLS         -- comma-separated list of blog URLs to crawl
 *
 * Exit codes:
 *   0  -- success (including the "source disabled" or "dry-run" cases)
 *   1  -- fatal config error (e.g. missing Supabase URL in a non-dry run)
 *
 * Plan traceability:
 *   - AC-6 bullet 1: `tsx scripts/scrape.ts` runs -- this file is the
 *     entrypoint.
 *   - AC-6 bullet 2: upserts via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *     (see `writeRestaurants` in `./lib/upsert.ts`).
 *   - AC-6 bullet 3: `.github/workflows/scrape.yml` (separate file)
 *     schedules this script weekly.
 */
import { createLogger, type ScraperLogger } from "./lib/logger";
import { dedupeRestaurants, normaliseRestaurant } from "./lib/normalizer";
import {
  createServiceClient,
  writeRestaurants,
  type UpsertStats,
} from "./lib/upsert";
import { createGooglePlacesSource } from "./sources/google-places";
import {
  createNigerianFoodBlogSource,
} from "./sources/nigerian-food-blog";
import type {
  ScraperConfig,
  ScraperRestaurant,
  ScraperSource,
} from "./lib/scraper-types";

interface CliFlags {
  dryRun: boolean;
  verbose: boolean;
  sources: string[] | null;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    dryRun: false,
    verbose: false,
    sources: null,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--verbose" || arg === "-v") flags.verbose = true;
    else if (arg.startsWith("--source=")) {
      flags.sources = arg.slice("--source=".length).split(",").map((s) => s.trim());
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: tsx scripts/scrape.ts [--dry-run] [--verbose] [--source=id[,id...]]",
          "",
          "Env vars:",
          "  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required unless --dry-run)",
          "  GOOGLE_PLACES_API_KEY                  (required for the google-places source)",
          "  BLOG_INDEX_URLS                        (optional, comma-separated list of blog URLs)",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`[scrape] warn unknown CLI flag ignored: ${arg}`);
    }
  }
  return flags;
}

function loadConfig(flags: CliFlags): ScraperConfig {
  const enabledFromEnv = process.env.SCRAPER_SOURCES
    ? process.env.SCRAPER_SOURCES.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  return {
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
    enabledSources: flags.sources ?? enabledFromEnv ?? [
      "google-places",
      "nigerian-food-blog",
    ],
    dryRun: flags.dryRun,
  };
}

function listKnownSources(): ScraperSource[] {
  // Sources are constructed lazily so a missing API key does not throw
  // at import time; the orchestrator handles per-source errors below.
  return [
    createGooglePlacesSource(process.env.GOOGLE_PLACES_API_KEY ?? ""),
    createNigerianFoodBlogSource(
      (process.env.BLOG_INDEX_URLS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

interface SourceReport {
  id: string;
  description: string;
  fetched: number;
  kept: number;
  skipped: boolean;
  error: string | null;
}

async function runSource(
  source: ScraperSource,
  logger: ScraperLogger,
): Promise<{ rows: ScraperRestaurant[]; report: SourceReport }> {
  const child = logger.child(source.id);
  child.info(`fetching from ${source.description}`);
  try {
    const raw = await source.fetch();
    const rows = raw
      .map((row) => normaliseRestaurant(row))
      .filter((v): v is ScraperRestaurant => v !== null);
    child.success(
      `fetched ${raw.length} raw, kept ${rows.length} valid rows`,
    );
    return {
      rows,
      report: {
        id: source.id,
        description: source.description,
        fetched: raw.length,
        kept: rows.length,
        skipped: false,
        error: null,
      },
    };
  } catch (err) {
    const message = (err as Error).message;
    child.error(`source failed: ${message}`);
    return {
      rows: [],
      report: {
        id: source.id,
        description: source.description,
        fetched: 0,
        kept: 0,
        skipped: true,
        error: message,
      },
    };
  }
}

function printReport(reports: SourceReport[], logger: ScraperLogger): void {
  logger.info("source report:");
  for (const r of reports) {
    if (r.skipped) {
      logger.warn(
        `  - ${r.id}: SKIPPED (${r.error ?? "no error message"})`,
      );
    } else {
      logger.info(
        `  - ${r.id}: fetched ${r.fetched}, kept ${r.kept}`,
      );
    }
  }
}

function printRestaurants(
  rows: ScraperRestaurant[],
  logger: ScraperLogger,
): void {
  logger.info(
    `dry-run payload: ${rows.length} restaurant(s), ${rows.reduce(
      (sum, r) => sum + r.reviews.length,
      0,
    )} review snippet(s)`,
  );
  for (const row of rows.slice(0, 5)) {
    logger.info(
      `  - ${row.name} (${row.city}) | tier=${row.budgetTier} | ` +
        `avg=${row.avgRating ?? "-"} | reviews=${row.reviewCount} | ${row.sourceUrl}`,
    );
  }
  if (rows.length > 5) {
    logger.info(`  ... (${rows.length - 5} more not shown)`);
  }
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2));
  const logger = createLogger(flags.verbose);
  const config = loadConfig(flags);
  const allSources = listKnownSources();

  logger.info(
    `config: dryRun=${config.dryRun} ` +
      `enabledSources=[${config.enabledSources.join(", ")}] ` +
      `supabaseConfigured=${Boolean(config.supabaseUrl && config.supabaseServiceKey)}`,
  );

  const sourcesToRun = allSources.filter((s) =>
    config.enabledSources.includes(s.id),
  );

  if (sourcesToRun.length === 0) {
    logger.warn(
      `no sources matched ${JSON.stringify(config.enabledSources)}; nothing to do`,
    );
    return 0;
  }

  const { rows: allRows, reports } = await runAll(sourcesToRun, logger);
  printReport(reports, logger);

  const deduped = dedupeRestaurants(allRows);
  logger.info(
    `aggregate: ${allRows.length} raw rows -> ${deduped.length} unique restaurants`,
  );

  if (deduped.length === 0) {
    logger.warn("no valid restaurants produced; nothing to upsert");
    return 0;
  }

  if (config.dryRun) {
    printRestaurants(deduped, logger);
    logger.success(
      "dry run complete -- no Supabase writes performed (exit 0)",
    );
    return 0;
  }

  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    logger.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for a real " +
        "scrape run. Pass --dry-run if you only want to inspect the payload.",
    );
    return 1;
  }

  const client = createServiceClient(
    config.supabaseUrl,
    config.supabaseServiceKey,
  );
  logger.info("upserting into Supabase...");
  const stats = await writeRestaurants(client, deduped);
  printUpsertStats(stats, logger);

  return stats.restaurantsSkipped > 0 ? 1 : 0;
}

async function runAll(
  sources: ScraperSource[],
  logger: ScraperLogger,
): Promise<{ rows: ScraperRestaurant[]; reports: SourceReport[] }> {
  const reports: SourceReport[] = [];
  const rows: ScraperRestaurant[] = [];
  for (const source of sources) {
    const { rows: sourceRows, report } = await runSource(source, logger);
    reports.push(report);
    rows.push(...sourceRows);
  }
  return { rows, reports };
}

function printUpsertStats(stats: UpsertStats, logger: ScraperLogger): void {
  logger.success(
    `upsert summary: restaurants=${stats.restaurantsUpserted} ` +
      `reviews=${stats.reviewsInserted} skipped=${stats.restaurantsSkipped}`,
  );
}

main().then(
  (code) => {
    process.exit(code);
  },
  (err) => {
    process.stderr.write(
      `[scrape] fatal ${(err as Error).stack ?? (err as Error).message}\n`,
    );
    process.exit(1);
  },
);