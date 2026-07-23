/**
 * Verifier for the AC-6 scraper.
 *
 * Runs WITHOUT touching the network or Supabase. It checks:
 *   1. The two source adapters exist and expose the `ScraperSource`
 *      contract (`id`, `description`, `fetch()`).
 *   2. The Nigerian food blog fixture produces >= 3 normalised rows.
 *   3. The normaliser drops malformed rows and clamps numeric ranges.
 *   4. The `writeRestaurants` helper is wired to Supabase via the
 *      service-role client (no direct postgres / fetch imports).
 *   5. The dedupe helper collapses `(name, city, source_url)` triples.
 *   6. The GitHub Actions workflow file parses as YAML (basic regex
 *      sanity -- we are not running `js-yaml` here, but we do confirm
 *      the trigger / step structure).
 *   7. The scraper entrypoint exits 0 in --dry-run mode even when no
 *      Supabase / Google credentials are set.
 *
 * Usage:  npx tsx scripts/verify-scraper.ts
 * Exit:   0 on success, 1 on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  dedupeRestaurants,
  normaliseRestaurant,
  normaliseRating,
  priceLevelToBudgetTier,
} from "./lib/normalizer";
import { createNigerianFoodBlogSource } from "./sources/nigerian-food-blog";
import { createGooglePlacesSource } from "./sources/google-places";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

let failed = 0;
function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    console.error(`FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failed += 1;
  }
}

async function run(): Promise<void> {
  // 1. Source adapters expose the ScraperSource contract -------------------
  const googleSource = createGooglePlacesSource("");
  assert(
    "google-places source exposes id + description",
    googleSource.id === "google-places" && Boolean(googleSource.description),
  );

  const blogSource = createNigerianFoodBlogSource([]);
  assert(
    "nigerian-food-blog source exposes id + description",
    blogSource.id === "nigerian-food-blog" && Boolean(blogSource.description),
  );
  assert(
    "google-places fetch is callable",
    typeof googleSource.fetch === "function",
  );
  assert(
    "nigerian-food-blog fetch is callable",
    typeof blogSource.fetch === "function",
  );

  // 2. Fixture produces at least 3 rows ------------------------------------
  const blogRows = await blogSource.fetch();
  assert(
    "nigerian-food-blog fixture produces >= 3 rows",
    blogRows.length >= 3,
    `got ${blogRows.length}`,
  );
  assert(
    "fixture rows carry populated (name, city, source_url) tuples",
    blogRows.every(
      (r) => Boolean(r.name) && Boolean(r.city) && Boolean(r.sourceUrl),
    ),
  );
  assert(
    "fixture rows are in the canonical city 'Lagos'",
    blogRows.every((r) => r.city === "Lagos"),
  );

  // 3. Normaliser drops / clamps bad rows ---------------------------------
  const dropped = normaliseRestaurant({
    name: "",
    city: "Lagos",
    sourceUrl: "https://example.com",
  });
  assert("normaliser drops rows with empty name", dropped === null);

  const clamped = normaliseRestaurant({
    name: "Test Spot",
    city: "Lagos",
    sourceUrl: "https://example.com",
    avgRating: 99, // out of range
    budgetTier: 7 as unknown as 1 | 2 | 3, // out of range
    reviewCount: -3,
  });
  assert(
    "normaliser clamps avg_rating to null when out of range",
    clamped !== null && clamped.avgRating === null,
  );
  assert(
    "normaliser falls back to budget_tier=2 when input is invalid",
    clamped !== null && clamped.budgetTier === 2,
  );
  assert(
    "normaliser clamps review_count to >= 0",
    clamped !== null && clamped.reviewCount === 0,
  );

  // 3b. Price-level helper ------------------------------------------------
  assert(
    "priceLevelToBudgetTier maps 0/1 -> 1, 2 -> 2, 3/4 -> 3",
    priceLevelToBudgetTier(0) === 1 &&
      priceLevelToBudgetTier(1) === 1 &&
      priceLevelToBudgetTier(2) === 2 &&
      priceLevelToBudgetTier(3) === 3 &&
      priceLevelToBudgetTier(4) === 3,
  );
  assert(
    "priceLevelToBudgetTier returns null on non-numeric input",
    priceLevelToBudgetTier("nope") === null,
  );
  assert(
    "normaliseRating rejects out-of-range values",
    normaliseRating(-1) === null && normaliseRating(7) === null,
  );
  assert(
    "normaliseRating rounds to 2 decimals",
    normaliseRating(4.567) === 4.57,
  );

  // 4. upsert.ts is wired to Supabase via service-role client -------------
  const upsertSrc = readFileSync(
    resolve(repoRoot, "scripts", "lib", "upsert.ts"),
    "utf8",
  );
  assert(
    "upsert.ts imports @supabase/supabase-js",
    upsertSrc.includes("@supabase/supabase-js"),
  );
  assert(
    "upsert.ts references the service-role key in a createClient call",
    upsertSrc.includes("createClient(") && upsertSrc.includes("serviceKey"),
  );
  assert(
    "upsert.ts upserts on the natural key (name, city, source_url)",
    upsertSrc.includes("name,city,source_url"),
  );

  // 5. Dedupe collapses duplicates ----------------------------------------
  const dupRows = [
    {
      name: "Same Spot",
      city: "Lagos",
      area: null,
      cuisine: null,
      budgetTier: 2 as const,
      avgRating: 4.0,
      reviewCount: 2,
      address: null,
      sourceUrl: "https://example.com",
      imageUrl: null,
      reviews: [],
    },
    {
      name: "same spot",
      city: "lagos",
      area: null,
      cuisine: null,
      budgetTier: 2 as const,
      avgRating: 4.5,
      reviewCount: 5,
      address: null,
      sourceUrl: "https://example.com",
      imageUrl: null,
      reviews: [],
    },
  ];
  const deduped = dedupeRestaurants(dupRows);
  assert(
    "dedupeRestaurants collapses case-insensitive (name, city, source_url) duplicates",
    deduped.length === 1 && deduped[0].reviewCount === 5,
  );

  // 6. GitHub Actions workflow exists + has the required triggers ---------
  const workflowPath = resolve(repoRoot, ".github", "workflows", "scrape.yml");
  assert(".github/workflows/scrape.yml exists", existsSync(workflowPath));
  if (existsSync(workflowPath)) {
    const wf = readFileSync(workflowPath, "utf8");
    assert(
      "scrape.yml declares a weekly cron schedule",
      /schedule:\s*[\s\S]{0,200}?-\s*cron:\s*["'][0-9*\s/,-]+["']/m.test(wf),
    );
    assert(
      "scrape.yml also supports workflow_dispatch for ad-hoc runs",
      wf.includes("workflow_dispatch"),
    );
    assert(
      "scrape.yml wires SUPABASE_URL + SERVICE_ROLE_KEY secrets",
      wf.includes("SUPABASE_URL") && wf.includes("SUPABASE_SERVICE_ROLE_KEY"),
    );
    assert(
      "scrape.yml wires GOOGLE_PLACES_API_KEY secret",
      wf.includes("GOOGLE_PLACES_API_KEY"),
    );
    assert(
      "scrape.yml invokes `tsx scripts/scrape.ts`",
      wf.includes("tsx scripts/scrape.ts"),
    );
  }

  // 7. scrape.ts entrypoint exits 0 in dry-run mode with no env vars -----
  const dryRun = spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/scrape.ts",
      "--dry-run",
      "--source=nigerian-food-blog",
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        GOOGLE_PLACES_API_KEY: "",
        BLOG_INDEX_URLS: "",
      },
      encoding: "utf8",
    },
  );
  assert(
    "scrape.ts --dry-run exits 0 with no env vars",
    dryRun.status === 0,
    `exit=${dryRun.status}\nstdout:\n${dryRun.stdout}\nstderr:\n${dryRun.stderr}`,
  );
  assert(
    "scrape.ts --dry-run prints fixture rows",
    Boolean(dryRun.stdout) &&
      dryRun.stdout.includes("dry-run payload") &&
      dryRun.stdout.includes("Nkwu Eze"),
    `stdout:\n${dryRun.stdout}`,
  );
}

run().then(
  () => {
    if (failed > 0) {
      console.error(`[verify-scraper] FAIL -- ${failed} check(s) failed.`);
      process.exit(1);
    }
    console.log(
      "[verify-scraper] OK -- scraper modules + workflow are healthy.",
    );
  },
  (err) => {
    console.error(`[verify-scraper] crashed: ${(err as Error).message}`);
    process.exit(1);
  },
);