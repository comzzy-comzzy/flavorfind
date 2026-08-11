/**
 * Pure helpers backing the AC-9 Filters UI.
 *
 * Three responsibilities live in this module:
 *
 *   1. The supported city list, budget tier list, and cuisine catalogue
 *      (the spec calls these out explicitly in AC-9).
 *   2. A serializable `RestaurantFilter` shape that can flow from URL
 *      search params -> Server Component -> data accessor -> Supabase
 *      query.
 *   3. Pure parsers / serializers that round-trip URL search params
 *      to/from a `RestaurantFilter`, plus validation against the
 *      supported option lists so the data layer never sees a stray
 *      user-supplied value.
 *
 * The module is intentionally framework-free (no React, no Next.js
 * imports) so the verifier can exercise the math offline and so the
 * rules stay unit-testable independent of the route handler.
 */

import { budgetTierLabel } from "./restaurants";

/**
 * Cities supported by the FilterBar dropdown. The home page's
 * DEFAULT_CITY ("Lagos") is the default value when no city filter is
 * applied; ordering here is the visual order the FilterBar renders.
 */
export const SUPPORTED_CITIES = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Ibadan",
  "Enugu",
  "Kano",
] as const;

export type SupportedCity = (typeof SUPPORTED_CITIES)[number];

/**
 * Budget tiers supported by the radio group. Matches the schema's
 * `budget_tier` smallint (1=low, 2=mid, 3=high).
 */
export const SUPPORTED_BUDGET_TIERS = [1, 2, 3] as const;

export type SupportedBudgetTier = (typeof SUPPORTED_BUDGET_TIERS)[number];

/**
 * Cuisine catalogue for the multiselect.
 *
 * The scraper normalises a wider raw vocabulary into these canonical
 * values before upserting. Keeping this list short and explicit means
 * the FilterBar UI can render a deterministic checkbox set without
 * first having to query the DB for distinct values.
 */
export const SUPPORTED_CUISINES = [
  "Nigerian",
  "Chinese",
  "Continental",
  "Fast Food",
  "Seafood",
  "Indian",
  "Lebanese",
  "Pizza",
] as const;

export type SupportedCuisine = (typeof SUPPORTED_CUISINES)[number];

/**
 * The structured filter shape passed around the app. All fields are
 * optional; an empty filter object means "show everything".
 */
export interface RestaurantFilter {
  city?: SupportedCity;
  budgetTier?: SupportedBudgetTier;
  cuisines?: SupportedCuisine[];
}

export const EMPTY_FILTER: RestaurantFilter = {};

/**
 * Quick lookup sets for validation.
 */
const CITY_SET: ReadonlySet<string> = new Set(SUPPORTED_CITIES);
const BUDGET_SET: ReadonlySet<number> = new Set(SUPPORTED_BUDGET_TIERS);
const CUISINE_SET: ReadonlySet<string> = new Set(SUPPORTED_CUISINES);

/**
 * Return `true` when `value` is one of the supported city strings.
 */
export function isSupportedCity(value: unknown): value is SupportedCity {
  return typeof value === "string" && CITY_SET.has(value);
}

/**
 * Return `true` when `value` is a supported budget tier (1, 2, 3).
 */
export function isSupportedBudgetTier(
  value: unknown,
): value is SupportedBudgetTier {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    BUDGET_SET.has(value)
  );
}

/**
 * Return `true` when `value` is a supported cuisine string.
 */
export function isSupportedCuisine(value: unknown): value is SupportedCuisine {
  return typeof value === "string" && CUISINE_SET.has(value);
}

/**
 * Normalise a raw value into a `SupportedCity`, or `undefined` when
 * the value is missing or unsupported. Accepts `string | string[] |
 * undefined` so it can ingest Next.js' `searchParams` shape directly.
 */
export function normalizeCity(
  value: string | string[] | undefined,
): SupportedCity | undefined {
  const candidate = pickFirst(value);
  if (!candidate) return undefined;
  return isSupportedCity(candidate) ? candidate : undefined;
}

/**
 * Normalise a raw value into a `SupportedBudgetTier`.
 *
 * Accepts either a numeric string ("2") or a numeric value (2).
 * Anything else (including 0, 4, NaN) collapses to `undefined` so the
 * data layer never sees an out-of-range tier.
 */
export function normalizeBudgetTier(
  value: string | string[] | number | undefined,
): SupportedBudgetTier | undefined {
  const candidate = pickFirst(value);
  if (candidate === undefined || candidate === null || candidate === "") {
    return undefined;
  }
  const numeric =
    typeof candidate === "number"
      ? candidate
      : Number.parseInt(String(candidate), 10);
  if (!Number.isInteger(numeric)) return undefined;
  return isSupportedBudgetTier(numeric) ? numeric : undefined;
}

/**
 * Normalise a raw value into a deduplicated `SupportedCuisine[]`.
 *
 * The cuisines arrive as either:
 *   - A repeated `?cuisine=Nigerian&cuisine=Chinese` (array form).
 *   - A comma-separated `?cuisine=Nigerian,Chinese` (string form, used
 *     when the FilterBar needs a single URL change).
 *
 * We accept both, trim whitespace, drop empties, and dedupe. The
 * order of the first occurrence is preserved so the resulting chip
 * rail renders deterministically.
 */
export function normalizeCuisines(
  value: string | string[] | undefined,
): SupportedCuisine[] {
  if (value === undefined) return [];
  const tokens: string[] = [];
  for (const piece of Array.isArray(value) ? value : [value]) {
    if (typeof piece !== "string") continue;
    for (const segment of piece.split(",")) {
      const trimmed = segment.trim();
      if (trimmed) tokens.push(trimmed);
    }
  }
  const seen = new Set<string>();
  const out: SupportedCuisine[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (isSupportedCuisine(token)) {
      out.push(token as SupportedCuisine);
    }
  }
  return out;
}

/**
 * Parse a Next.js `searchParams` object (or a plain
 * `Record<string, string | string[]>`) into a validated
 * `RestaurantFilter`.
 *
 * Unknown keys are ignored; malformed values collapse to "no filter"
 * for that field. The function never throws so it can be called
 * unconditionally from a Server Component.
 */
export function parseFilterParams(
  raw: Record<string, string | string[] | undefined> | undefined | null,
): RestaurantFilter {
  if (!raw) return {};
  const city = normalizeCity(raw.city);
  const budgetTier = normalizeBudgetTier(raw.budgetTier);
  const cuisines = normalizeCuisines(raw.cuisine);
  const filter: RestaurantFilter = {};
  if (city) filter.city = city;
  if (budgetTier !== undefined) filter.budgetTier = budgetTier;
  if (cuisines.length > 0) filter.cuisines = cuisines;
  return filter;
}

/**
 * Serialise a `RestaurantFilter` into a URLSearchParams instance.
 *
 * The shape mirrors what `parseFilterParams` accepts, but we always
 * emit the *canonical* (camelCase, no whitespace, deduplicated) form
 * so two equal filters always serialise to the same URL -- which is
 * what keeps React from triggering a redundant re-render.
 */
export function serializeFilters(filter: RestaurantFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.city) {
    params.set("city", filter.city);
  }
  if (filter.budgetTier !== undefined) {
    params.set("budgetTier", String(filter.budgetTier));
  }
  if (filter.cuisines && filter.cuisines.length > 0) {
    // Sort for stable ordering: same set -> same URL.
    const sorted = [...filter.cuisines].sort((a, b) =>
      a.localeCompare(b),
    );
    params.set("cuisine", sorted.join(","));
  }
  return params;
}

/**
 * Convenience wrapper that returns the serialised params as a
 * `key=value&...` string (without the leading `?`). Used by the
 * FilterBar when constructing the next URL via router.push().
 */
export function filtersToQueryString(filter: RestaurantFilter): string {
  return serializeFilters(filter).toString();
}

/**
 * Pretty label for a budget tier, suitable for the radio group.
 * Returns "Any" for `undefined` so the UI can render the unfiltered
 * state without a separate code path.
 */
export function budgetTierOptionLabel(
  tier: SupportedBudgetTier | undefined,
): string {
  if (tier === undefined) return "Any";
  return budgetTierLabel(tier);
}

/**
 * "Is the filter object empty (i.e. defaults)?" -- used by the
 * FilterBar to decide whether to render a "Reset filters" link.
 */
export function isEmptyFilter(filter: RestaurantFilter): boolean {
  return (
    !filter.city &&
    filter.budgetTier === undefined &&
    (!filter.cuisines || filter.cuisines.length === 0)
  );
}

/**
 * Count of "active" filters, i.e. fields the user actually pinned.
 * Used by the FilterBar's "Clear (3)" affordance.
 */
export function activeFilterCount(filter: RestaurantFilter): number {
  let n = 0;
  if (filter.city) n += 1;
  if (filter.budgetTier !== undefined) n += 1;
  if (filter.cuisines && filter.cuisines.length > 0) n += 1;
  return n;
}

/**
 * Pick the first element of a `string | string[] | number | undefined`
 * so the callers above can treat URL params uniformly. Returns
 * `undefined` for nullish / non-string inputs so it never throws.
 */
function pickFirst(
  value: string | string[] | number | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}
