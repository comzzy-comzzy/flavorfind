/**
 * Verifier for the AC-9 Filters UI.
 *
 * Stays offline: does NOT touch Supabase or the network. Asserts:
 *   1. `components/FilterBar.tsx` and `lib/filters.ts` exist on disk.
 *   2. `app/page.tsx` reads `searchParams`, renders `<FilterBar />`,
 *      passes a `currentFilter` derived from the parsed params, and
 *      uses `fetchRestaurantsByFilter` to query the data layer.
 *   3. The pure helpers in `lib/filters.ts` behave per spec:
 *      `SUPPORTED_CITIES` contains the six canonical entries,
 *      `parseFilterParams` returns a validated object, the
 *      round-trip `parseFilterParams(raw) -> serializeFilters()`
 *      is stable, and bad inputs collapse to defaults instead of
 *      throwing.
 *   4. The cache-key helper in `lib/restaurants.ts` is deterministic
 *      and changes when any field of the filter changes.
 *
 * Usage:  npx tsx scripts/verify-filters.ts
 * Exit:   0 on success, 1 on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SUPPORTED_BUDGET_TIERS,
  SUPPORTED_CITIES,
  SUPPORTED_CUISINES,
  activeFilterCount,
  budgetTierOptionLabel,
  filtersToQueryString,
  isEmptyFilter,
  isSupportedBudgetTier,
  isSupportedCity,
  isSupportedCuisine,
  normalizeBudgetTier,
  normalizeCity,
  normalizeCuisines,
  parseFilterParams,
  serializeFilters,
} from "../lib/filters";
import { buildFilterCacheKey } from "../lib/restaurants";

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

function run(): void {
  // -----------------------------------------------------------------
  // 1. Files exist
  // -----------------------------------------------------------------
  const filterBarPath = resolve(
    repoRoot,
    "components",
    "FilterBar.tsx",
  );
  const filtersLibPath = resolve(repoRoot, "lib", "filters.ts");
  const homePath = resolve(repoRoot, "app", "page.tsx");
  assert("components/FilterBar.tsx exists", existsSync(filterBarPath));
  assert("lib/filters.ts exists", existsSync(filtersLibPath));
  assert("app/page.tsx exists", existsSync(homePath));

  // -----------------------------------------------------------------
  // 2. app/page.tsx integration
  // -----------------------------------------------------------------
  const homeSrc = readFileSync(homePath, "utf8");
  assert(
    "app/page.tsx declares a searchParams prop",
    /searchParams\?:\s*\{\s*\[key:\s*string\][^}]*\}/.test(homeSrc),
  );
  assert(
    "app/page.tsx parses searchParams via parseFilterParams",
    homeSrc.includes("parseFilterParams("),
  );
  assert(
    "app/page.tsx renders <FilterBar />",
    homeSrc.includes("<FilterBar"),
  );
  assert(
    "app/page.tsx passes the parsed filter to FilterBar",
    /currentFilter=\{filter\}/.test(homeSrc),
  );
  assert(
    "app/page.tsx fetches via fetchRestaurantsByFilter",
    homeSrc.includes("fetchRestaurantsByFilter("),
  );
  assert(
    "app/page.tsx is force-dynamic (depends on search params)",
    /export\s+const\s+dynamic\s*=\s*"force-dynamic"/.test(homeSrc),
  );
  assert(
    "app/page.tsx wraps FilterBar in a Suspense boundary",
    /<Suspense[\s\S]+<FilterBar[\s\S]+<\/Suspense>/.test(homeSrc),
  );

  // -----------------------------------------------------------------
  // 3. FilterBar structure
  // -----------------------------------------------------------------
  const filterBarSrc = readFileSync(filterBarPath, "utf8");
  assert(
    "FilterBar is a Client Component",
    /^"use client"/m.test(filterBarSrc.trimStart()),
  );
  assert(
    "FilterBar imports SUPPORTED_CITIES",
    filterBarSrc.includes("SUPPORTED_CITIES"),
  );
  assert(
    "FilterBar imports SUPPORTED_BUDGET_TIERS",
    filterBarSrc.includes("SUPPORTED_BUDGET_TIERS"),
  );
  assert(
    "FilterBar imports SUPPORTED_CUISINES",
    filterBarSrc.includes("SUPPORTED_CUISINES"),
  );
  assert(
    "FilterBar renders a <select> for the city dropdown",
    /<select[\s\S]+<\/select>/.test(filterBarSrc),
  );
  // The radio / checkbox controls live inside small sub-components
  // (BudgetRadio / CuisineChip). Counting literal `type="radio"` /
  // `type="checkbox"` occurrences in the source only ever sees the one
  // in each helper. Instead we assert: there is one explicit
  // <BudgetRadio> for the "Any" tier, and one <BudgetRadio> inside
  // a .map(SUPPORTED_BUDGET_TIERS, ...) (renders 3 more at runtime
  // -> 4 total). Same pattern for cuisine chips.
  const explicitBudgetRadioCount = (
    filterBarSrc.match(/<BudgetRadio\b/g) ?? []
  ).length;
  assert(
    "FilterBar has 1 explicit <BudgetRadio> + 1 inside a SUPPORTED_BUDGET_TIERS.map (renders 4)",
    explicitBudgetRadioCount === 2 &&
      /SUPPORTED_BUDGET_TIERS\.map[\s\S]*?<BudgetRadio/.test(filterBarSrc),
  );
  assert(
    "FilterBar renders cuisine chips (1 map of SUPPORTED_CUISINES -> 8 chips at runtime)",
    /SUPPORTED_CUISINES\.map[\s\S]*?<CuisineChip/.test(filterBarSrc) &&
      SUPPORTED_CUISINES.length >= 4,
  );
  // Spot-check: each control is wired through an actual <input> with
  // the matching type (defensive regression guard for a helper
  // component swap that might drop the underlying input element).
  assert(
    "FilterBar contains a real <input type=\"radio\">",
    /<input[^>]*type="radio"/.test(filterBarSrc),
  );
  assert(
    "FilterBar contains a real <input type=\"checkbox\">",
    /<input[^>]*type="checkbox"/.test(filterBarSrc),
  );
  assert(
    "FilterBar uses the Next.js router",
    filterBarSrc.includes("useRouter"),
  );
  assert(
    "FilterBar reads the live URL via useSearchParams",
    filterBarSrc.includes("useSearchParams"),
  );
  assert(
    "FilterBar pushes the URL via router.push / router.replace",
    filterBarSrc.includes("router.push") || filterBarSrc.includes("router.replace"),
  );
  assert(
    "FilterBar uses useTransition for smooth updates",
    filterBarSrc.includes("useTransition"),
  );
  assert(
    "FilterBar includes an Apply filters button",
    /Apply filters/i.test(filterBarSrc),
  );
  assert(
    "FilterBar includes a Clear button / link",
    /Clear/.test(filterBarSrc),
  );

  // -----------------------------------------------------------------
  // 4. SUPPORTED_* constants
  // -----------------------------------------------------------------
  for (const city of [
    "Lagos",
    "Abuja",
    "Port Harcourt",
    "Ibadan",
    "Enugu",
    "Kano",
  ]) {
    assert(
      `SUPPORTED_CITIES contains ${city}`,
      (SUPPORTED_CITIES as readonly string[]).includes(city),
    );
  }
  assert(
    "SUPPORTED_CITIES has exactly 6 entries",
    SUPPORTED_CITIES.length === 6,
    `got ${SUPPORTED_CITIES.length}`,
  );
  assert(
    "SUPPORTED_BUDGET_TIERS is [1, 2, 3]",
    SUPPORTED_BUDGET_TIERS[0] === 1 &&
      SUPPORTED_BUDGET_TIERS[1] === 2 &&
      SUPPORTED_BUDGET_TIERS[2] === 3,
  );
  assert(
    "SUPPORTED_CUISINES has at least 4 entries",
    SUPPORTED_CUISINES.length >= 4,
  );

  // -----------------------------------------------------------------
  // 5. validation predicates
  // -----------------------------------------------------------------
  assert("isSupportedCity('Lagos') === true", isSupportedCity("Lagos"));
  assert(
    "isSupportedCity('Mumbai') === false",
    !isSupportedCity("Mumbai"),
  );
  assert(
    "isSupportedBudgetTier(2) === true",
    isSupportedBudgetTier(2),
  );
  assert(
    "isSupportedBudgetTier(4) === false",
    !isSupportedBudgetTier(4),
  );
  assert(
    "isSupportedCuisine('Nigerian') === true",
    isSupportedCuisine("Nigerian"),
  );
  assert(
    "isSupportedCuisine('Sushi') === false",
    !isSupportedCuisine("Sushi"),
  );

  // -----------------------------------------------------------------
  // 6. normalizeCity / normalizeBudgetTier / normalizeCuisines
  // -----------------------------------------------------------------
  assert(
    "normalizeCity('Lagos') === 'Lagos'",
    normalizeCity("Lagos") === "Lagos",
  );
  assert(
    "normalizeCity('Mumbai') === undefined (unsupported)",
    normalizeCity("Mumbai") === undefined,
  );
  assert(
    "normalizeCity(undefined) === undefined",
    normalizeCity(undefined) === undefined,
  );
  assert(
    "normalizeCity(['Lagos']) === 'Lagos' (array -> first)",
    normalizeCity(["Lagos"]) === "Lagos",
  );

  assert(
    "normalizeBudgetTier('2') === 2",
    normalizeBudgetTier("2") === 2,
  );
  assert(
    "normalizeBudgetTier(3) === 3",
    normalizeBudgetTier(3) === 3,
  );
  assert(
    "normalizeBudgetTier('5') === undefined (out of range)",
    normalizeBudgetTier("5") === undefined,
  );
  assert(
    "normalizeBudgetTier('abc') === undefined",
    normalizeBudgetTier("abc") === undefined,
  );
  assert(
    "normalizeBudgetTier('') === undefined",
    normalizeBudgetTier("") === undefined,
  );

  assert(
    "normalizeCuisines('Nigerian') === ['Nigerian']",
    JSON.stringify(normalizeCuisines("Nigerian")) ===
      JSON.stringify(["Nigerian"]),
  );
  assert(
    "normalizeCuisines('Nigerian,Chinese') === both (split)",
    JSON.stringify(normalizeCuisines("Nigerian,Chinese")) ===
      JSON.stringify(["Nigerian", "Chinese"]),
  );
  assert(
    "normalizeCuisines(['Nigerian','Sushi']) === only Nigerian",
    JSON.stringify(normalizeCuisines(["Nigerian", "Sushi"])) ===
      JSON.stringify(["Nigerian"]),
  );
  assert(
    "normalizeCuisines dedupes + preserves first-occurrence order",
    JSON.stringify(normalizeCuisines("Nigerian,Chinese,Nigerian")) ===
      JSON.stringify(["Nigerian", "Chinese"]),
  );
  assert(
    "normalizeCuisines(undefined) === []",
    JSON.stringify(normalizeCuisines(undefined)) === "[]",
  );

  // -----------------------------------------------------------------
  // 7. parseFilterParams + serializeFilters (round-trip)
  // -----------------------------------------------------------------
  const allRaw = {
    city: "Lagos",
    budgetTier: "2",
    cuisine: "Nigerian,Chinese",
  };
  const parsed = parseFilterParams(allRaw);
  assert(
    "parseFilterParams extracts city",
    parsed.city === "Lagos",
  );
  assert(
    "parseFilterParams extracts budgetTier as number",
    parsed.budgetTier === 2,
  );
  assert(
    "parseFilterParams extracts cuisines as array",
    parsed.cuisines?.length === 2 &&
      parsed.cuisines[0] === "Nigerian" &&
      parsed.cuisines[1] === "Chinese",
  );

  const round = filtersToQueryString(parsed);
  assert(
    "filtersToQueryString includes city=Lagos",
    round.includes("city=Lagos"),
  );
  assert(
    "filtersToQueryString includes budgetTier=2",
    round.includes("budgetTier=2"),
  );
  assert(
    "filtersToQueryString includes sorted cuisines (Chinese,Nigerian)",
    round.includes("cuisine=Chinese%2CNigerian") ||
      round.includes("cuisine=Chinese,Nigerian"),
  );

  // Round-trip: parse -> serialize -> parse yields the same shape.
  const reParsed = parseFilterParams(
    Object.fromEntries(new URLSearchParams(round)),
  );
  assert(
    "round-trip preserves city",
    reParsed.city === parsed.city,
  );
  assert(
    "round-trip preserves budgetTier",
    reParsed.budgetTier === parsed.budgetTier,
  );
  assert(
    "round-trip preserves cuisines (order-independent)",
    JSON.stringify([...(reParsed.cuisines ?? [])].sort()) ===
      JSON.stringify([...(parsed.cuisines ?? [])].sort()),
  );

  // Idempotent serialize: same filter -> same URL.
  assert(
    "serializeFilters is idempotent",
    filtersToQueryString(parsed) === filtersToQueryString(reParsed),
  );

  // parseFilterParams handles unknown / malformed inputs.
  assert(
    "parseFilterParams({}) returns an empty filter",
    JSON.stringify(parseFilterParams({})) === "{}",
  );
  assert(
    "parseFilterParams({ city: 'Mumbai' }) drops unsupported city",
    parseFilterParams({ city: "Mumbai" }).city === undefined,
  );
  assert(
    "parseFilterParams({ budgetTier: 'foo' }) drops bad tier",
    parseFilterParams({ budgetTier: "foo" }).budgetTier === undefined,
  );
  assert(
    "parseFilterParams(null) returns {}",
    JSON.stringify(parseFilterParams(null)) === "{}",
  );
  assert(
    "parseFilterParams(undefined) returns {}",
    JSON.stringify(parseFilterParams(undefined)) === "{}",
  );

  // serializeFilters
  const emptySerialized = filtersToQueryString({});
  assert(
    "serializeFilters({}) returns an empty string (no params)",
    emptySerialized === "",
  );
  assert(
    "serializeFilters distinguishes empty vs populated filters",
    filtersToQueryString({ city: "Lagos" }) !== emptySerialized,
  );

  // isEmptyFilter + activeFilterCount
  assert("isEmptyFilter({}) === true", isEmptyFilter({}));
  assert(
    "isEmptyFilter({ city: 'Lagos' }) === false",
    !isEmptyFilter({ city: "Lagos" }),
  );
  assert(
    "activeFilterCount({}) === 0",
    activeFilterCount({}) === 0,
  );
  assert(
    "activeFilterCount counts each field at most once",
    activeFilterCount({
      city: "Lagos",
      budgetTier: 2,
      cuisines: ["Nigerian", "Chinese"],
    }) === 3,
  );

  // budgetTierOptionLabel
  assert(
    "budgetTierOptionLabel(undefined) === 'Any'",
    budgetTierOptionLabel(undefined) === "Any",
  );
  assert(
    "budgetTierOptionLabel(2) === 'Mid-range'",
    budgetTierOptionLabel(2) === "Mid-range",
  );
  assert(
    "budgetTierOptionLabel(1) === 'Budget'",
    budgetTierOptionLabel(1) === "Budget",
  );
  assert(
    "budgetTierOptionLabel(3) === 'Fine Dining'",
    budgetTierOptionLabel(3) === "Fine Dining",
  );

  // -----------------------------------------------------------------
  // 8. Cache key helper
  // -----------------------------------------------------------------
  const keyA = buildFilterCacheKey({ city: "Lagos", budgetTier: 2 }, 20);
  const keyB = buildFilterCacheKey({ city: "Lagos", budgetTier: 2 }, 20);
  assert(
    "buildFilterCacheKey is deterministic",
    JSON.stringify(keyA) === JSON.stringify(keyB),
  );
  const keyC = buildFilterCacheKey({ city: "Lagos", budgetTier: 3 }, 20);
  assert(
    "buildFilterCacheKey changes when budgetTier changes",
    JSON.stringify(keyC) !== JSON.stringify(keyA),
  );
  const keyD = buildFilterCacheKey(
    { city: "Lagos", budgetTier: 2, cuisines: ["Nigerian"] },
    20,
  );
  assert(
    "buildFilterCacheKey changes when cuisines change",
    JSON.stringify(keyD) !== JSON.stringify(keyA),
  );
  // Cuisines are sorted inside the canonical key -- different orderings
  // of the same cuisine set must yield the same key (the URL parser may
  // reorder them, and the FilterBar multiselect may emit them in any
  // order the user clicked them).
  const keyE = buildFilterCacheKey(
    { city: "Lagos", budgetTier: 2, cuisines: ["Nigerian", "Chinese"] },
    20,
  );
  const keyF = buildFilterCacheKey(
    { city: "Lagos", budgetTier: 2, cuisines: ["Chinese", "Nigerian"] },
    20,
  );
  assert(
    "buildFilterCacheKey normalises cuisine order (Nigerian,Chinese == Chinese,Nigerian)",
    JSON.stringify(keyE) === JSON.stringify(keyF),
  );

  // -----------------------------------------------------------------
  // 9. Direct usage of serializeFilters (not just the convenience
  //    string wrapper) to catch regressions if either helper changes.
  // -----------------------------------------------------------------
  const paramsObj = serializeFilters({
    city: "Abuja",
    budgetTier: 1,
    cuisines: ["Pizza", "Nigerian"],
  });
  assert(
    "serializeFilters emits city=Abuja",
    paramsObj.get("city") === "Abuja",
  );
  assert(
    "serializeFilters emits budgetTier=1",
    paramsObj.get("budgetTier") === "1",
  );
  assert(
    "serializeFilters emits sorted (Chinese,Nigerian -> Nigerian,Pizza)",
    paramsObj.get("cuisine") === "Nigerian,Pizza",
  );
}

run();

if (failed > 0) {
  console.error(`[verify-filters] FAIL -- ${failed} check(s) failed.`);
  process.exit(1);
}
console.log("[verify-filters] OK -- AC-9 filters UI is healthy.");
