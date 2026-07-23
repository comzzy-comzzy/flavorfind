/**
 * Pure ranking helpers for the AC-7 recommendation endpoint.
 *
 * The ranking formula (documented in the AC-7 sub-bullet):
 *
 *   score = avg_rating           * 0.6
 *         + normalized_reviews   * 0.3
 *         + location_match_bonus * 0.1
 *
 * where:
 *   - `avg_rating` is on the 0..5 scale (NULL collapses to 0 so a
 *     restaurant without a rating still surfaces, just below peers).
 *   - `normalized_reviews` is the restaurant`s `review_count`
 *     normalised onto the same 0..5 scale (saturates at 100
 *     reviews -- a soft cap that avoids one mega-popular restaurant
 *     drowning out well-reviewed smaller spots).
 *   - `location_match_bonus` is 5 when the caller supplied a `city`
 *     filter and the restaurant`s city matches it (case-insensitive),
 *     otherwise 0. This is the "soft preference" half of the city
 *     filter: we still surface restaurants from other cities so the
 *     caller can see "close alternatives", but they rank below an
 *     exact match. With a 0.1 weight, the bonus contributes at most
 *     0.5 points to the score -- a tiebreaker, not a primary signal.
 *
 * The module is intentionally pure (no Supabase / no network imports)
 * so the verify script can exercise the math offline, and so the
 * scoring rules stay unit-testable independent of the route handler.
 */
import type { RestaurantRow } from "./supabase";

/**
 * Caps the review-count normalisation so a restaurant with thousands
 * of reviews does not saturate the bonus. Chosen at 100 because that
 * is roughly the 90th-percentile review count of mid-tier restaurant
 * listings in our two scrape sources; anything beyond that contributes
 * the same maximum score.
 */
export const REVIEW_COUNT_SATURATION = 100;

/**
 * Filters accepted by `rankRestaurants`. Each field is optional so the
 * caller can pass a partial filter (e.g. only `city`, no budget
 * constraint). The route handler is responsible for validating the
 * raw string query params into this shape.
 */
export interface RecommendFilter {
  /** Case-insensitive exact match against `restaurants.city`. */
  city?: string;
  /** 1 / 2 / 3 hard equality against `restaurants.budget_tier`. */
  budgetTier?: 1 | 2 | 3;
  /** Case-insensitive exact match against `restaurants.cuisine`. */
  cuisine?: string;
}

/**
 * The ranked, scored payload returned by the recommendation endpoint.
 * Mirrors `RestaurantRow` 1:1 plus the derived `score` and an optional
 * `match_explanations` map so the UI can surface "why this result?"
 * without re-computing on the client.
 */
export interface ScoredRestaurant extends RestaurantRow {
  /** Final score after applying the formula. Higher is better. */
  score: number;
  /** Per-component breakdown of the score, useful for debugging. */
  match_explanations: {
    rating_component: number;
    review_component: number;
    location_component: number;
    city_matched: boolean;
    city_filter_supplied: boolean;
  };
}

/**
 * Normalise a review count onto the 0..5 scale used by the rating
 * column. Saturates at `REVIEW_COUNT_SATURATION` so very popular
 * restaurants do not monopolise the bonus.
 *
 * `min(count, 100) / 100 * 5` -- a restaurant with 100 or more
 * reviews hits the 5-point cap; one with 20 reviews scores 1.0; one
 * with no reviews scores 0. We clamp negatives defensively even
 * though the DB CHECK constraint should already prevent them.
 */
export function normalizeReviewCount(
  count: number | null | undefined,
): number {
  const safe =
    typeof count === "number" && Number.isFinite(count) && count > 0
      ? count
      : 0;
  if (safe <= 0) return 0;
  const capped = Math.min(safe, REVIEW_COUNT_SATURATION);
  // Round to 4 decimals to keep floating-point drift out of the score.
  return Math.round((capped / REVIEW_COUNT_SATURATION) * 5 * 10000) / 10000;
}

/**
 * Compute the `location_match_bonus` component.
 *
 * Returns 5 when the filter includes a city and the restaurant`s
 * city matches case-insensitively; returns 0 otherwise (including
 * the case where no city filter was supplied). Exported separately
 * so the verifier can sanity-check the bonus in isolation.
 */
export function locationMatchBonus(
  restaurantCity: string | null,
  filterCity: string | undefined,
): number {
  if (!filterCity) return 0;
  if (!restaurantCity) return 0;
  return restaurantCity.toLowerCase() === filterCity.toLowerCase() ? 5 : 0;
}

/**
 * Compute the full recommendation score for a single restaurant.
 *
 *   score = avg_rating * 0.6
 *         + normalized_reviews * 0.3
 *         + location_match_bonus * 0.1
 *
 * `avg_rating` of `null` is treated as 0 so a brand-new restaurant
 * without a rating still appears in the list, just ranked lower than
 * peers. The score is rounded to 4 decimal places to keep JSON
 * responses tidy and to make the verifier`s equality assertions stable.
 */
export function computeScore(
  row: Pick<RestaurantRow, "avg_rating" | "review_count" | "city">,
  filter: RecommendFilter,
): {
  score: number;
  rating_component: number;
  review_component: number;
  location_component: number;
  city_matched: boolean;
} {
  const rating = typeof row.avg_rating === "number" ? row.avg_rating : 0;
  const reviewComponent = normalizeReviewCount(row.review_count);
  const locationComponent = locationMatchBonus(row.city, filter.city);

  const ratingComponent = Math.round(rating * 0.6 * 10000) / 10000;
  const weightedReview = Math.round(reviewComponent * 0.3 * 10000) / 10000;
  const weightedLocation =
    Math.round(locationComponent * 0.1 * 10000) / 10000;

  const score = Math.round(
    (ratingComponent + weightedReview + weightedLocation) * 10000,
  ) / 10000;

  return {
    score,
    rating_component: ratingComponent,
    review_component: weightedReview,
    location_component: weightedLocation,
    city_matched: locationComponent === 5,
  };
}

/**
 * Hard-filter the input rows against the filter (budgetTier + cuisine
 * are strict equality; city is left for the scoring pass so the
 * "soft preference" semantics in the formula are preserved).
 *
 * City is intentionally NOT hard-filtered here -- the formula`s
 * `location_match_bonus * 0.1` term is what implements the city
 * preference. Hard-filtering city would make that term meaningless
 * (every remaining row would always match) and would surprise users
 * who expected "nearby" alternatives when their exact match set was
 * empty.
 */
export function applyHardFilters(
  rows: RestaurantRow[],
  filter: RecommendFilter,
): RestaurantRow[] {
  return rows.filter((row) => {
    if (
      filter.budgetTier !== undefined &&
      row.budget_tier !== filter.budgetTier
    ) {
      return false;
    }
    if (
      filter.cuisine !== undefined &&
      (row.cuisine ?? "").toLowerCase() !== filter.cuisine.toLowerCase()
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Score, sort, and slice a list of restaurant rows.
 *
 *   1. Apply hard filters (budgetTier, cuisine).
 *   2. Compute the score for each remaining row.
 *   3. Sort by score descending, ties broken by review_count then
 *      avg_rating (so the rank is stable across minor numeric drift).
 *   4. Slice to `limit` (default 20; clamped to <= 100 to keep the
 *      payload small for Vercel edge responses).
 */
export function rankRestaurants(
  rows: RestaurantRow[],
  filter: RecommendFilter,
  limit: number = 20,
): ScoredRestaurant[] {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const filtered = applyHardFilters(rows, filter);

  const scored: ScoredRestaurant[] = filtered.map((row) => {
    const breakdown = computeScore(row, filter);
    return {
      ...row,
      score: breakdown.score,
      match_explanations: {
        rating_component: breakdown.rating_component,
        review_component: breakdown.review_component,
        location_component: breakdown.location_component,
        city_matched: breakdown.city_matched,
        city_filter_supplied: Boolean(filter.city),
      },
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.review_count !== a.review_count)
      return b.review_count - a.review_count;
    const ar = a.avg_rating ?? 0;
    const br = b.avg_rating ?? 0;
    if (br !== ar) return br - ar;
    // Final tiebreaker: alphabetical name so the rank is deterministic.
    return a.name.localeCompare(b.name);
  });

  return scored.slice(0, safeLimit);
}