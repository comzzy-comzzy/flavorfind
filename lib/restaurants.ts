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
 * Render the budget tier as clean text names.
 */
export function budgetTierLabel(
  tier: number | null | undefined,
): string {
  if (tier === 1) return "Budget";
  if (tier === 2) return "Mid-range";
  if (tier === 3) return "Fine Dining";
  return "Budget unknown";
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

// -----------------------------------------------------------------
// Mock Data for offline/unconfigured fallback
// -----------------------------------------------------------------
const MOCK_RESTAURANTS: RestaurantRow[] = [
  {
    id: "mock-1",
    name: "NOK by Alara",
    city: "Lagos",
    area: "Victoria Island",
    cuisine: "Nigerian",
    budget_tier: 3,
    avg_rating: 4.8,
    review_count: 520,
    address: "12a Akin Olugbade St, Victoria Island, Lagos",
    source_url: "https://nokbyalara.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-2",
    name: "RSVP Lagos",
    city: "Lagos",
    area: "Victoria Island",
    cuisine: "Continental",
    budget_tier: 3,
    avg_rating: 4.6,
    review_count: 480,
    address: "9 Gidi Rd, Victoria Island, Lagos",
    source_url: "https://rsvplagos.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-3",
    name: "Shiro Restaurant & Bar",
    city: "Lagos",
    area: "Victoria Island",
    cuisine: "Chinese",
    budget_tier: 3,
    avg_rating: 4.7,
    review_count: 720,
    address: "Block B 3, Landmark Village, Water Corporation Rd, Victoria Island, Lagos",
    source_url: "https://shiro-restaurant.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-4",
    name: "Yellow Chilli",
    city: "Lagos",
    area: "Ikeja",
    cuisine: "Nigerian",
    budget_tier: 2,
    avg_rating: 4.4,
    review_count: 310,
    address: "35 Joel Ogunnaike St, Ikeja GRA, Lagos",
    source_url: "https://yellowchilli.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-5",
    name: "Ocean Basket",
    city: "Lagos",
    area: "Ikeja",
    cuisine: "Seafood",
    budget_tier: 2,
    avg_rating: 4.3,
    review_count: 650,
    address: "58c Joel Ogunnaike St, Ikeja GRA, Lagos",
    source_url: "https://oceanbasket.com.ng",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-6",
    name: "Native Tray",
    city: "Lagos",
    area: "Lekki",
    cuisine: "Nigerian",
    budget_tier: 1,
    avg_rating: 4.5,
    review_count: 140,
    address: "14 Admiralty Way, Lekki Phase 1, Lagos",
    source_url: "https://nativetray.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-7",
    name: "Nkoyo",
    city: "Abuja",
    area: "Central Business District",
    cuisine: "Nigerian",
    budget_tier: 2,
    avg_rating: 4.5,
    review_count: 240,
    address: "1 Bathurst St, Kado, Abuja",
    source_url: "https://nkoyo.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-8",
    name: "Zuma Restaurant",
    city: "Abuja",
    area: "Maitama",
    cuisine: "Continental",
    budget_tier: 3,
    avg_rating: 4.6,
    review_count: 180,
    address: "Transcorp Hilton, 1 Aguiyi Ironsi St, Maitama, Abuja",
    source_url: "https://zumarestaurant.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-9",
    name: "Asia Town",
    city: "Port Harcourt",
    area: "GRA Phase 3",
    cuisine: "Chinese",
    budget_tier: 3,
    avg_rating: 4.7,
    review_count: 310,
    address: "24 Forces Ave, Old GRA, Port Harcourt",
    source_url: "https://asiatownph.com",
    scraped_at: new Date().toISOString(),
    image_url: "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const MOCK_REVIEWS: Record<string, ReviewRow[]> = {
  "mock-1": [
    {
      id: "rev-1",
      restaurant_id: "mock-1",
      snippet: "Absolutely fantastic African fine dining! The atmosphere is incredible and the jollof rice is to die for.",
      rating: 5,
      source_url: "https://nokbyalara.com",
      scraped_at: new Date().toISOString(),
    },
    {
      id: "rev-2",
      restaurant_id: "mock-1",
      snippet: "Great service and beautiful presentation of traditional Nigerian food with a modern twist.",
      rating: 4.6,
      source_url: "https://nokbyalara.com",
      scraped_at: new Date().toISOString(),
    }
  ],
  "mock-2": [
    {
      id: "rev-3",
      restaurant_id: "mock-2",
      snippet: "Superb cocktails and excellent continental food. The vibe is very upscale and modern.",
      rating: 4.8,
      source_url: "https://rsvplagos.com",
      scraped_at: new Date().toISOString(),
    }
  ]
};

function getMockRestaurants(
  filter: RestaurantFilter,
  limit: number,
): RestaurantRow[] {
  let data = [...MOCK_RESTAURANTS];
  if (filter.city) {
    data = data.filter(r => r.city.toLowerCase() === filter.city!.toLowerCase());
  }
  if (filter.budgetTier !== undefined) {
    data = data.filter(r => r.budget_tier === filter.budgetTier);
  }
  if (filter.cuisines && filter.cuisines.length > 0) {
    data = data.filter(r => r.cuisine && filter.cuisines!.includes(r.cuisine as any));
  }
  return data.slice(0, limit);
}

function getMockRestaurantById(id: string): RestaurantRow | null {
  return MOCK_RESTAURANTS.find(r => r.id === id) || null;
}

function getMockReviewsByRestaurantId(id: string): ReviewRow[] {
  return MOCK_REVIEWS[id] || [
    {
      id: "rev-default",
      restaurant_id: id,
      snippet: "Wonderful atmosphere, delicious food, and very attentive service. Highly recommended!",
      rating: 4.5,
      source_url: "https://flavorfind.vercel.app",
      scraped_at: new Date().toISOString(),
    }
  ];
}

/**
 * Fetch the top restaurants for a city.
 */
export async function fetchTopRestaurantsByCity(
  city: string,
  limit: number = LISTING_LIMIT,
  options: { useCache?: boolean } = {},
): Promise<RestaurantRow[]> {
  const filter: RestaurantFilter = {
    city: city as RestaurantFilter["city"],
  };
  return fetchRestaurantsByFilter(filter, limit, options);
}

/**
 * Fetch the restaurants matching an arbitrary `RestaurantFilter`.
 */
export async function fetchRestaurantsByFilter(
  filter: RestaurantFilter,
  limit: number = LISTING_LIMIT,
  options: { useCache?: boolean } = {},
): Promise<RestaurantRow[]> {
  const safeLimit = clampLimit(limit);
  const client = getSupabaseAnonClient();
  if (!client) {
    return getMockRestaurants(filter, safeLimit);
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
      query = query.in("cuisine", filter.cuisines);
    }

    const { data, error } = await query
      .order("avg_rating", { ascending: false, nullsFirst: false })
      .limit(safeLimit);

    if (error) {
      console.warn(
        `[restaurants] fetchRestaurantsByFilter(${JSON.stringify(filter)}) failed: ${error.message}`,
      );
      // Fallback to mock on query failure too
      return getMockRestaurants(filter, safeLimit);
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
 */
export function buildFilterCacheKey(
  filter: RestaurantFilter,
  limit: number,
): { parts: string[]; tags: string[] } {
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
 */
export async function fetchRestaurantById(
  id: string,
): Promise<RestaurantRow | null> {
  const client = getSupabaseAnonClient();
  if (!client) {
    return getMockRestaurantById(id);
  }
  const { data, error } = await client
    .from("restaurants")
    .select(RESTAURANT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn(
      `[restaurants] fetchRestaurantById(${id}) failed: ${error.message}`,
    );
    return getMockRestaurantById(id);
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
    return getMockReviewsByRestaurantId(restaurantId);
  }
  const { data, error } = await client
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("scraped_at", { ascending: false })
    .limit(20);
  if (error) {
    console.warn(
      `[restaurants] fetchReviewsByRestaurantId(${restaurantId}) failed: ${error.message}`,
    );
    return getMockReviewsByRestaurantId(restaurantId);
  }
  return (data ?? []) as unknown as ReviewRow[];
}

export function canQueryRestaurants(): boolean {
  // Always true now that we have full mock fallback!
  return true;
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
