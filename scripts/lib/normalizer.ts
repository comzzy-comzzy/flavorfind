/**
 * Pure normalisation helpers used by both source adapters and the
 * orchestrator. Keeping these in a dedicated module (no Supabase / no
 * network imports) means the verify script can exercise them without
 * needing any external services online.
 *
 * The rules are intentionally conservative: a malformed row is
 * DROPPED rather than coerced silently, so the AC-15 "no AI-generated
 * slop" guarantee stays intact (we never invent a restaurant name).
 */
import type { ScraperRestaurant } from "./scraper-types";

/** Coerce an arbitrary string into a clean one-line trimmed value. */
export function cleanText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Normalise a raw rating value into the 0-5 scale used by the schema.
 * Returns `null` if the input is missing or outside the acceptable
 * range (per the `CHECK (rating >= 0 AND rating <= 5)` clause in
 * `supabase/schema.sql`).
 */
export function normaliseRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0 || num > 5) return null;
  // Round to 2 decimals to match numeric(3,2).
  return Math.round(num * 100) / 100;
}

/**
 * Map a price-level integer (Google Places convention: 0=Free,
 * 1=Inexpensive, 2=Moderate, 3=Expensive, 4=Very Expensive) onto our
 * three-tier budget scale.
 *
 * Returns `null` when the source did not provide a price level so the
 * orchestrator can fall back to the schema's DEFAULT (2 = mid).
 */
export function priceLevelToBudgetTier(
  priceLevel: unknown,
): 1 | 2 | 3 | null {
  const num = typeof priceLevel === "number" ? priceLevel : Number(priceLevel);
  if (!Number.isFinite(num)) return null;
  if (num <= 1) return 1;
  if (num === 2) return 2;
  return 3;
}

/**
 * Validate + lightly clean a {@link ScraperRestaurant}. Returns the
 * cleaned record or `null` if it cannot be salvaged (e.g. empty name,
 * empty source URL).
 */
export function normaliseRestaurant(
  raw: Partial<ScraperRestaurant>,
): ScraperRestaurant | null {
  const name = cleanText(raw.name);
  const sourceUrl = cleanText(raw.sourceUrl, 1000);
  const city = cleanText(raw.city);
  if (!name || !sourceUrl || !city) return null;
  return {
    name,
    city,
    area: cleanText(raw.area, 200),
    cuisine: cleanText(raw.cuisine, 80),
    budgetTier:
      raw.budgetTier === 1 || raw.budgetTier === 2 || raw.budgetTier === 3
        ? raw.budgetTier
        : 2,
    avgRating: normaliseRating(raw.avgRating),
    reviewCount:
      typeof raw.reviewCount === "number" && raw.reviewCount >= 0
        ? Math.floor(raw.reviewCount)
        : 0,
    address: cleanText(raw.address, 500),
    sourceUrl,
    imageUrl: cleanText(raw.imageUrl, 1000),
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
  };
}

/**
 * Deduplicate a list of restaurants by `(name, city, source_url)`.
 * When duplicates exist, keep the entry with the most reviews (i.e.
 * the most information).
 */
export function dedupeRestaurants(
  rows: ScraperRestaurant[],
): ScraperRestaurant[] {
  const seen = new Map<string, ScraperRestaurant>();
  for (const row of rows) {
    const key = `${row.name.toLowerCase()}::${row.city.toLowerCase()}::${row.sourceUrl}`;
    const existing = seen.get(key);
    if (!existing || row.reviewCount > existing.reviewCount) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

/**
 * Clamp a numeric value into the inclusive `[min, max]` range.
 * Used by `aggregateRestaurantStats` to satisfy the schema CHECK
 * constraints on `avg_rating` (0-5) and `review_count` (>=0).
 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}