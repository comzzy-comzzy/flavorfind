/**
 * Thin wrapper around the Supabase service-role client that performs
 * the two writes the scraper is responsible for:
 *
 *   1. UPSERT a row into `public.restaurants` keyed on
 *      `(name, city, source_url)` so re-runs are idempotent.
 *   2. INSERT one row per snippet into `public.reviews` referencing
 *      the restaurant's resolved id.
 *
 * Both operations are gated behind `hasSupabaseServiceEnv` from
 * `lib/supabase.ts` so the script can be exercised locally without
 * real credentials (e.g. via `--dry-run`).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScraperRestaurant } from "./scraper-types";

export interface UpsertStats {
  /** Rows successfully upserted into `public.restaurants`. */
  restaurantsUpserted: number;
  /** Rows successfully inserted into `public.reviews`. */
  reviewsInserted: number;
  /** Restaurants skipped because they failed validation in the caller. */
  restaurantsSkipped: number;
}

/**
 * Construct a Supabase service-role client. Kept separate from the
 * app-supplied `lib/supabase.ts` helper because the scraper needs to
 * handle a more aggressive env-var surface (e.g. `--dry-run` with no
 * keys present at all) and we want the scraper to fail loudly rather
 * than return `null` from the app helper.
 */
export function createServiceClient(
  url: string,
  serviceKey: string,
): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Upsert one restaurant. The DB requires `name`, `city`, `source_url`
 * to match before we treat it as the same row.
 */
export async function upsertRestaurant(
  client: SupabaseClient,
  row: ScraperRestaurant,
): Promise<{ id: string } | null> {
  const payload = {
    name: row.name,
    city: row.city,
    area: row.area,
    cuisine: row.cuisine,
    budget_tier: row.budgetTier,
    avg_rating: row.avgRating,
    review_count: row.reviewCount,
    address: row.address,
    source_url: row.sourceUrl,
    image_url: row.imageUrl,
    scraped_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("restaurants")
    .upsert(payload, { onConflict: "name,city,source_url" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `restaurants upsert failed for "${row.name}" (${row.city}): ${
        error?.message ?? "no data returned"
      }`,
    );
  }
  return data as { id: string };
}

/**
 * Delete-and-reinsert the snippet rows for a restaurant. We use a
 * wipe-then-insert because the source pages we scrape do not give us
 * stable review ids to key on, and "no AI-generated slop" means
 * stale snippets must not accumulate between runs.
 */
export async function replaceReviews(
  client: SupabaseClient,
  restaurantId: string,
  restaurant: ScraperRestaurant,
): Promise<number> {
  const { error: delError } = await client
    .from("reviews")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (delError) {
    throw new Error(
      `reviews delete failed for ${restaurantId}: ${delError.message}`,
    );
  }

  const rows = restaurant.reviews
    .filter((r) => r.snippet && r.sourceUrl)
    .map((r) => ({
      restaurant_id: restaurantId,
      snippet: r.snippet,
      rating: r.rating,
      source_url: r.sourceUrl,
      scraped_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return 0;

  const { error: insError } = await client.from("reviews").insert(rows);
  if (insError) {
    throw new Error(
      `reviews insert failed for ${restaurantId}: ${insError.message}`,
    );
  }
  return rows.length;
}

/**
 * Drive a write run over a list of normalised restaurants. Returns a
 * stats object the orchestrator prints at the end of the log.
 */
export async function writeRestaurants(
  client: SupabaseClient,
  rows: ScraperRestaurant[],
): Promise<UpsertStats> {
  const stats: UpsertStats = {
    restaurantsUpserted: 0,
    reviewsInserted: 0,
    restaurantsSkipped: 0,
  };
  for (const row of rows) {
    try {
      const result = await upsertRestaurant(client, row);
      if (!result) {
        stats.restaurantsSkipped += 1;
        continue;
      }
      stats.restaurantsUpserted += 1;
      stats.reviewsInserted += await replaceReviews(
        client,
        result.id,
        row,
      );
    } catch (err) {
      stats.restaurantsSkipped += 1;
      // Don't abort the whole run on a single bad row -- log via stderr
      // so a downstream Reviewer can correlate the failure to a name.
      process.stderr.write(
        `[scrape] warn upsert skipped for "${row.name}" (${row.city}): ${
          (err as Error).message
        }\n`,
      );
    }
  }
  return stats;
}