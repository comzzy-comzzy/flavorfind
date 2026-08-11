/**
 * Server-side data accessors used by the AC-8 listing + detail pages.
 *
 * Everything in this module runs on the Next.js server (Route Handlers
 * and Server Components). It uses the public Supabase client so reads
 * honour RLS, and never reaches out to the network in environments
 * where Supabase env vars are missing -- instead it returns an empty
 * list / `null` and lets the page render a friendly empty state.
 *
 * The module also exposes a handful of pure formatting helpers
 * (`budgetTierLabel`, `formatRating`, `formatReviewCount`,
 * `formatRelativeScrapedAt`) so the UI components stay declarative and
 * the verifier can exercise them offline.
 */

import { unstable_cache as nextCache } from "next/cache";

import {
  getSupabaseAnonClient,
  hasSupabaseEnv,
  type RestaurantRow,
  type ReviewRow,
} from "./supabase";
import type { RestaurantFilter } from "./filters";

/**
 * Maximum number of restaurants the listing page renders.
 */
export const LISTING_LIMIT = 20;

/**
 * The default city surfaced on the home page when the user has not
 * applied any filter.
 */
export const DEFAULT_CITY = "Lagos";

const RESTAURANT_COLUMNS =
  "id, name, city, area, cuisine, budget_tier, avg_rating, " +
  "review_count, address, source_url, scraped_at, image_url, " +
  "created_at, updated_at";

const REVIEW_COLUMNS =
  "id, restaurant_id, snippet, rating, source_url, scraped_at";

/**
 * Render the budget tier as the Naira glyph repetition.
 */
export function budgetTierLabel(
  tier: number | null | undefined,
): string {
  if (tier === 1 || tier === 2 || tier === 3) {
    return "₦".repeat(tier);
  }
  return "₦?";
}

/**
 * Pretty-print a 0..5 rating. Pin to one decimal.
 */
export function formatRating(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(1);
}

/**
 * Compact review-count formatter ("1.2k" / "34").
 */
export function formatReviewCount(count: number | null | undefined): string {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    return "0";
  }
  if (count >= 1000) {
    const thousands = count / 1000;
    const trimmed = thousands.toFixed(1).replace(/\.0$/u, "");
    return `${trimmed}k`;
  }
  return String(count);
}

/**
 * Coarse relative-time formatter for the freshness pill.
 */
export function formatRelativeScrapedAt(
  scrapedAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!scrapedAt) return "freshness unknown";
  const scraped = new Date(scrapedAt);
  if (Number.isNaN(scraped.getTime())) {
    return "freshness unknown";
  }
  const diffMs = now.getTime() - scraped.getTime();
  if (diffMs < 0) return "just now";
  const minute = 60000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) {
    const mins = Math.max(1, Math.round(diffMs / minute));
    return `${mins} min ago`;
  }
  if (diffMs < day) {
    const hrs = Math.round(diffMs / hour);
    return `${hrs} hr ago`;
  }
  if (diffMs < 30 * day) {
    const days = Math.round(diffMs / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 365 * day) {
    const months = Math.round(diffMs / (30 * day));
    return `${months} mo ago`;
  }
  const years = Math.round(diffMs / (365 * day));
  return `${years} yr ago`;
}

/**
 * Fetch the top restaurants for a city.
 *
 * This thin wrapper exists so the AC-8 listing page keeps its
 * one-argument call shape. The heavy lifting -- multi-filter support,
 * cache key derivation, Supabase query assembly -- lives in
 * `fetchRestaurantsByFilter` below.
 */
export async function fetchTopRestaurantsByCity(
  city: string,
  limit: number = LISTING_LIMIT,
  options: { useCache?: boolean } = {},
): Promise<RestaurantRow[]> {
  // The strong city typing in `RestaurantFilter` is enforced by
  // `parseFilterParams`; the legacy one-argument shape accepts any
  // string and we forward it as-is. Casting through `unknown` is the
  // narrowest way to express "we know this string is a supported city
  // because it came from our own callers".
  const filter: RestaurantFilter = {
    city: city as RestaurantFilter["city"],
  };
  return fetchRestaurantsByFilter(filter, limit, options);
}

/**
 * Fetch the restaurants matching an arbitrary `RestaurantFilter`
 * (city + budget tier + cuisine multiselect).
 *
 * `filter.city` is the dominant selector: when supplied, the query
 * constrains to that city (case-insensitive). When omitted, the
 * query still hard-filters by budget tier + cuisines (if any), but
 * does not restrict by city -- this preserves the AC-7 "soft
 * preference" semantics, where a missing city filter is treated as
 * "I'm open to anywhere".
 *
 * Caching: we key the `unstable_cache` wrapper on a stable string
 * derived from the canonical filter shape, so two equivalent filter
 * objects share the same cached page (the URL params go through
 * `filtersToQueryString` upstream which already sorts + dedupes).
 */
export async function fetchRestaurantsByFilter(
  filter: RestaurantFilter,
  limit: number = LISTING_LIMIT,
  options: { useCache?: boolean } = {},
): Promise<RestaurantRow[]> {
  const safeLimit = clampLimit(limit);
  const client = getSupabaseAnonClient();
  if (!client) {
    return [];
  }
  const useCache = options.useCache ?? true;

  const doFetch = async (): Promise<RestaurantRow[]> => {
    let query = client
      .from("restaurants")
      .select(RESTAURANT_COLUMNS);

    if (filter.city) {
      query = query.ilike("city", filter.city);
    }
    if (filter.budgetTier !== undefined) {
      query = query.eq("budget_tier", filter.budgetTier);
    }
    if (filter.cuisines && filter.cuisines.length > 0) {
      // Postgres `in (...)` accepts a string[] for text columns; we
      // forward the canonical values so a stray comma-spelling never
      // leaks into the SQL.
      query = query.in("cuisine", filter.cuisines);
    }

    const { data, error } = await query
      .order("avg_rating", { ascending: false, nullsFirst: false })
      .limit(safeLimit);

    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        `[restaurants] fetchRestaurantsByFilter(${JSON.stringify(filter)}) failed: ${error.message}`,
      );
      return [];
    }
    return (data ?? []) as unknown as RestaurantRow[];
  };

  if (useCache) {
    const cacheKey = buildFilterCacheKey(filter, safeLimit);
    const cached = nextCache(doFetch, cacheKey.parts, {
      revalidate: 300,
      tags: cacheKey.tags,
    });
    return cached();
  }
  return doFetch();
}

/**
 * Build a stable `unstable_cache` key + tag list from a filter.
 * Exported so the verifier (and any future cache-invalidation code)
 * can derive the same key without depending on the internal helper.
 */
export function buildFilterCacheKey(
  filter: RestaurantFilter,
  limit: number,
): { parts: string[]; tags: string[] } {
  // Canonical (sorted + deduped) JSON keeps semantically equal filters
  // pointing at the same cache slot.
  const sortedCuisines = (filter.cuisines ?? []).slice().sort();
  const canonical = JSON.stringify({
    city: filter.city ?? null,
    budgetTier: filter.budgetTier ?? null,
    cuisines: sortedCuisines,
    limit,
  });
  return {
    parts: ["restaurants", "by-filter", canonical],
    tags: ["restaurants", `restaurants:filter:${canonical}`],
  };
}

/**
 * Fetch a single restaurant by its UUID.
 *
 * Data flow: Supabase `restaurants` table -> anon client (honours RLS) ->
 * typed `RestaurantRow`. Detail page joins reviews via
 * `fetchReviewsByRestaurantId(restaurant.id)` (FK `reviews.restaurant_id =
 * restaurants.id`, see `supabase/schema.sql`); each snippet carries its own
 * source_url so the UI can deep-link back to the original Google / blog
 * post without re-querying.
 */
export async function fetchRestaurantById(
  id: string,
): Promise<RestaurantRow | null> {
  const client = getSupabaseAnonClient();
  if (!client) {
    return null;
  }
  const { data, error } = await client
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[restaurants] fetchRestaurantById(${id}) failed: ${error.message}`,
    );
    return null;
  }
  return (data ?? null) as RestaurantRow | null;
}

/**
 * Fetch the review snippets attached to a restaurant.
 */
export async function fetchReviewsByRestaurantId(
  restaurantId: string,
): Promise<ReviewRow[]> {
  const client = getSupabaseAnonClient();
  if (!client) {
    return [];
  }
  const { data, error } = await client
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("scraped_at", { ascending: false })
    .limit(20);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[restaurants] fetchReviewsByRestaurantId(${restaurantId}) failed: ${error.message}`,
    );
    return [];
  }
  return (data ?? []) as unknown as ReviewRow[];
}

export function canQueryRestaurants(): boolean {
  return hasSupabaseEnv;
}

/**
 * Clamp a user/URL-supplied limit into the [1, 100] range.
 */
export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return LISTING_LIMIT;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

/**
 * Raw ms delta for tests.
 */
export function scrapedAgoMs(
  scrapedAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!scrapedAt) return null;
  const scraped = new Date(scrapedAt);
  if (Number.isNaN(scraped.getTime())) return null;
  const diff = now.getTime() - scraped.getTime();
  return diff < 0 ? 0 : diff;
}
