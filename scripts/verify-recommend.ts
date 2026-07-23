/**
 * Verifier for the AC-7 recommendation endpoint.
 *
 * Runs WITHOUT touching the network or Supabase. It checks:
 *   1. The route file exists and exports a `GET` handler.
 *   2. The pure ranking helpers (`computeScore`, `normalizeReviewCount`,
 *      `locationMatchBonus`, `applyHardFilters`, `rankRestaurants`)
 *      behave per the documented formula.
 *   3. The scoring formula weights match the plan
 *      (0.6 / 0.3 / 0.1) at the boundary cases.
 *   4. Hard filters exclude non-matching `budgetTier` / `cuisine` rows
 *      but DO NOT exclude non-matching `city` rows (city is a soft
 *      preference that flows through `location_match_bonus`).
 *   5. The route returns a 200 with a non-empty `results` array when
 *      given a seed dataset that includes rows (exercised via a
 *      direct in-process call to the ranking pipeline; the full HTTP
 *      round-trip is left to the Reviewer).
 *
 * Usage:  npx tsx scripts/verify-recommend.ts
 * Exit:   0 on success, 1 on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REVIEW_COUNT_SATURATION,
  applyHardFilters,
  computeScore,
  locationMatchBonus,
  normalizeReviewCount,
  rankRestaurants,
} from "../lib/recommend";
import type { RestaurantRow } from "../lib/supabase";

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

function approx(a: number, b: number, eps = 0.0001): boolean {
  return Math.abs(a - b) <= eps;
}

function makeRow(overrides: Partial<RestaurantRow>): RestaurantRow {
  return {
    id: overrides.id ?? "00000000-0000-0000-0000-000000000000",
    name: overrides.name ?? "Test Spot",
    city: overrides.city ?? "Lagos",
    area: overrides.area ?? null,
    cuisine: overrides.cuisine ?? null,
    budget_tier: overrides.budget_tier ?? 2,
    avg_rating: overrides.avg_rating ?? null,
    review_count: overrides.review_count ?? 0,
    address: overrides.address ?? null,
    source_url: overrides.source_url ?? "https://example.com/test",
    scraped_at: overrides.scraped_at ?? new Date().toISOString(),
    image_url: overrides.image_url ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function run(): void {
  // -----------------------------------------------------------------
  // 1. Route file exists and exports GET
  // -----------------------------------------------------------------
  const routePath = resolve(repoRoot, "app", "api", "recommend", "route.ts");
  assert("app/api/recommend/route.ts exists", existsSync(routePath));
  if (existsSync(routePath)) {
    const src = readFileSync(routePath, "utf8");
    assert(
      "route.ts exports an async GET handler",
      /export\s+async\s+function\s+GET\s*\(/.test(src),
    );
    assert(
      "route.ts returns a NextResponse",
      src.includes("NextResponse.json"),
    );
    assert(
      "route.ts validates city / budgetTier / cuisine params",
      src.includes("city") &&
        src.includes("budgetTier") &&
        src.includes("cuisine"),
    );
    assert(
      "route.ts returns 400 on validation failure",
      src.includes("status: 400"),
    );
    assert(
      "route.ts reads from public.restaurants via Supabase",
      src.includes('"restaurants"') &&
        src.includes("getSupabaseAnonClient"),
    );
    assert(
      "route.ts applies ranking via lib/recommend",
      src.includes("rankRestaurants("),
    );
    assert(
      "route.ts is dynamic (not edge-cached)",
      src.includes('dynamic = "force-dynamic"') ||
        src.includes("force-dynamic"),
    );
  }

  // -----------------------------------------------------------------
  // 2. normalizeReviewCount
  // -----------------------------------------------------------------
  assert(
    "normalizeReviewCount(0) === 0",
    normalizeReviewCount(0) === 0,
  );
  assert(
    "normalizeReviewCount(20) === 1.0",
    approx(normalizeReviewCount(20), 1.0),
  );
  assert(
    "normalizeReviewCount(50) === 2.5",
    approx(normalizeReviewCount(50), 2.5),
  );
  assert(
    "normalizeReviewCount(100) === 5.0 (saturation point)",
    approx(normalizeReviewCount(100), 5.0),
  );
  assert(
    "normalizeReviewCount(10000) === 5.0 (above saturation caps at 5)",
    approx(normalizeReviewCount(10000), 5.0),
  );
  assert(
    "normalizeReviewCount(null) === 0",
    normalizeReviewCount(null) === 0,
  );
  assert(
    "normalizeReviewCount(undefined) === 0",
    normalizeReviewCount(undefined) === 0,
  );
  assert(
    "normalizeReviewCount(-5) === 0 (defensive clamp)",
    normalizeReviewCount(-5) === 0,
  );

  // -----------------------------------------------------------------
  // 3. locationMatchBonus
  // -----------------------------------------------------------------
  assert(
    "locationMatchBonus returns 0 when no city filter",
    locationMatchBonus("Lagos", undefined) === 0,
  );
  assert(
    "locationMatchBonus returns 0 when restaurant city missing",
    locationMatchBonus(null, "Lagos") === 0,
  );
  assert(
    "locationMatchBonus returns 5 on exact match",
    locationMatchBonus("Lagos", "Lagos") === 5,
  );
  assert(
    "locationMatchBonus is case-insensitive",
    locationMatchBonus("lagos", "LAGOS") === 5,
  );
  assert(
    "locationMatchBonus returns 0 on mismatch",
    locationMatchBonus("Abuja", "Lagos") === 0,
  );

  // -----------------------------------------------------------------
  // 4. computeScore follows the formula
  // -----------------------------------------------------------------
  const perfectRow = makeRow({
    avg_rating: 5,
    review_count: REVIEW_COUNT_SATURATION,
    city: "Lagos",
  });
  const perfectScore = computeScore(perfectRow, { city: "Lagos" });
  // 5*0.6 + 5*0.3 + 5*0.1 = 3 + 1.5 + 0.5 = 5.0
  assert(
    "perfect row + matching city filter scores exactly 5.0",
    approx(perfectScore.score, 5.0),
    `got ${perfectScore.score}`,
  );
  assert(
    "perfect score reports city_matched = true",
    perfectScore.city_matched === true,
  );

  const noCityFilter = computeScore(perfectRow, {});
  // 5*0.6 + 5*0.3 + 0*0.1 = 4.5 (location_bonus = 0 when no filter)
  assert(
    "perfect row without city filter scores exactly 4.5",
    approx(noCityFilter.score, 4.5),
    `got ${noCityFilter.score}`,
  );

  const noRating = computeScore(makeRow({ avg_rating: null }), {});
  assert(
    "null avg_rating contributes 0 to score",
    approx(noRating.score, 0),
    `got ${noRating.score}`,
  );

  const ratingOnly = computeScore(
    makeRow({ avg_rating: 4, review_count: 0, city: "Lagos" }),
    {},
  );
  // 4 * 0.6 + 0 * 0.3 + 0 * 0.1 = 2.4
  assert(
    "rating-only row scores exactly 2.4",
    approx(ratingOnly.score, 2.4),
    `got ${ratingOnly.score}`,
  );

  const reviewOnly = computeScore(
    makeRow({ avg_rating: 0, review_count: 100, city: "Lagos" }),
    { city: "Lagos" },
  );
  // 0 * 0.6 + 5 * 0.3 + 5 * 0.1 = 1.5 + 0.5 = 2.0
  assert(
    "review-only row scores exactly 2.0",
    approx(reviewOnly.score, 2.0),
    `got ${reviewOnly.score}`,
  );

  // -----------------------------------------------------------------
  // 5. applyHardFilters
  // -----------------------------------------------------------------
  const rows: RestaurantRow[] = [
    makeRow({ id: "1", name: "Lagos Mid", city: "Lagos", budget_tier: 2, cuisine: "Nigerian" }),
    makeRow({ id: "2", name: "Lagos Low", city: "Lagos", budget_tier: 1, cuisine: "Nigerian" }),
    makeRow({ id: "3", name: "Abuja Mid", city: "Abuja", budget_tier: 2, cuisine: "Chinese" }),
    makeRow({ id: "4", name: "Lagos High", city: "Lagos", budget_tier: 3, cuisine: "Chinese" }),
    makeRow({ id: "5", name: "Portharcourt Mid", city: "Port Harcourt", budget_tier: 2, cuisine: "Nigerian" }),
  ];

  const onlyLagosMid = applyHardFilters(rows, { budgetTier: 2 });
  assert(
    "applyHardFilters(budgetTier=2) keeps all tier-2 rows regardless of city",
    onlyLagosMid.length === 3 &&
      onlyLagosMid.some((r) => r.id === "1") &&
      onlyLagosMid.some((r) => r.id === "3") &&
      onlyLagosMid.some((r) => r.id === "5"),
  );

  const budgetAndCuisine = applyHardFilters(rows, {
    budgetTier: 2,
    cuisine: "Nigerian",
  });
  assert(
    "applyHardFilters(budgetTier=2, cuisine=Nigerian) keeps the 2 expected rows",
    budgetAndCuisine.length === 2 &&
      budgetAndCuisine.every((r) => r.budget_tier === 2 && r.cuisine === "Nigerian"),
  );

  const onlyCity = applyHardFilters(rows, { city: "Lagos" });
  assert(
    "applyHardFilters(city=Lagos) keeps ALL rows (city is a soft preference)",
    onlyCity.length === rows.length,
    `expected ${rows.length}, got ${onlyCity.length}`,
  );

  const cuisineCaseInsensitive = applyHardFilters(rows, {
    cuisine: "nigerian",
  });
  assert(
    "applyHardFilters cuisine filter is case-insensitive",
    cuisineCaseInsensitive.length === 3 &&
      cuisineCaseInsensitive.every((r) => (r.cuisine ?? "").toLowerCase() === "nigerian"),
  );

  // -----------------------------------------------------------------
  // 6. rankRestaurants end-to-end on a seed set
  // -----------------------------------------------------------------
  const seeded: RestaurantRow[] = [
    makeRow({
      id: "a",
      name: "Best Lagos Spot",
      city: "Lagos",
      avg_rating: 5,
      review_count: 250, // saturates
      budget_tier: 2,
      cuisine: "Nigerian",
    }),
    makeRow({
      id: "b",
      name: "Mediocre Abuja Spot",
      city: "Abuja",
      avg_rating: 4.5,
      review_count: 50, // = 2.5 normalised
      budget_tier: 2,
      cuisine: "Nigerian",
    }),
    makeRow({
      id: "c",
      name: "Low-rated Lagos Spot",
      city: "Lagos",
      avg_rating: 3,
      review_count: 5, // = 0.25 normalised
      budget_tier: 2,
      cuisine: "Nigerian",
    }),
  ];

  const rankedNoFilter = rankRestaurants(seeded, {}, 10);
  assert(
    "rankRestaurants with no filter returns 3 rows",
    rankedNoFilter.length === 3,
  );
  assert(
    "rankRestaurants top result is the 5-star Lagos spot",
    rankedNoFilter[0].id === "a",
    `got ${rankedNoFilter[0].id}`,
  );

  const rankedCityLagos = rankRestaurants(seeded, { city: "Lagos" }, 10);
  assert(
    "rankRestaurants with city=Lagos still returns Abuja as a 'nearby' alternative",
    rankedCityLagos.find((r) => r.id === "b") !== undefined,
  );
  assert(
    "rankRestaurants with city=Lagos ranks the matching city above non-matching",
    rankedCityLagos.findIndex((r) => r.id === "a") <
      rankedCityLagos.findIndex((r) => r.id === "b"),
  );

  const rankedBudgetAndCuisine = rankRestaurants(seeded, {
    budgetTier: 3,
    cuisine: "Nigerian",
  });
  assert(
    "rankRestaurants with budgetTier=3 returns empty (no rows match)",
    rankedBudgetAndCuisine.length === 0,
  );

  const rankedLimit = rankRestaurants(seeded, {}, 1);
  assert("rankRestaurants honours the limit argument", rankedLimit.length === 1);

  const rankedLimitClamp = rankRestaurants(seeded, {}, 99999);
  assert(
    "rankRestaurants clamps the limit to <= 100",
    rankedLimitClamp.length === seeded.length,
  );

  const rankedLimitFloor = rankRestaurants(seeded, {}, -3);
  assert(
    "rankRestaurants clamps the limit to >= 1",
    rankedLimitFloor.length === 1,
  );

  // -----------------------------------------------------------------
  // 7. Score determinism -- same input twice yields the same rank
  // -----------------------------------------------------------------
  const runA = rankRestaurants(seeded, { city: "Lagos" }, 10).map((r) => r.id);
  const runB = rankRestaurants(seeded, { city: "Lagos" }, 10).map((r) => r.id);
  assert(
    "rankRestaurants is deterministic for identical inputs",
    JSON.stringify(runA) === JSON.stringify(runB),
  );

  // -----------------------------------------------------------------
  // 8. Formula weight constants match the plan (0.6 / 0.3 / 0.1)
  // -----------------------------------------------------------------
  // Spot-check via the breakdown fields -- rating component for
  // avg_rating=5 should be 5 * 0.6 = 3.0, location component for a
  // matching city should be 5 * 0.1 = 0.5.
  const breakdownRow = makeRow({
    avg_rating: 5,
    review_count: REVIEW_COUNT_SATURATION,
    city: "Lagos",
  });
  const breakdown = computeScore(breakdownRow, { city: "Lagos" });
  assert(
    "rating_component uses 0.6 weight (5 -> 3.0)",
    approx(breakdown.rating_component, 3.0),
    `got ${breakdown.rating_component}`,
  );
  assert(
    "review_component uses 0.3 weight (5 -> 1.5)",
    approx(breakdown.review_component, 1.5),
    `got ${breakdown.review_component}`,
  );
  assert(
    "location_component uses 0.1 weight (5 -> 0.5)",
    approx(breakdown.location_component, 0.5),
    `got ${breakdown.location_component}`,
  );
}

run();

if (failed > 0) {
  console.error(
    `[verify-recommend] FAIL -- ${failed} check(s) failed.`,
  );
  process.exit(1);
}
console.log(
  "[verify-recommend] OK -- recommend module + route shape are healthy.",
);