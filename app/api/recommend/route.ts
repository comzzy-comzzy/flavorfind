/**
 * AC-7 Recommendation Route Handler.
 *
 * GET /api/recommend
 *
 * Query parameters (all optional):
 *   city       -- case-insensitive exact match against restaurants.city
 *   budgetTier -- "1" | "2" | "3" hard filter on restaurants.budget_tier
 *   cuisine    -- case-insensitive exact match against restaurants.cuisine
 *   limit      -- integer 1..100, defaults to 20
 *
 * Response shape (200):
 *   {
 *     filter:    { city, budgetTier, cuisine } | <applied subset>,
 *     count:     <number of rows returned>,
 *     results:   [ScoredRestaurant, ...]            // ranked by score desc
 *   }
 *
 * Errors:
 *   400  -- validation failed (bad budgetTier / limit)
 *   503  -- Supabase env not configured for this deployment
 *   500  -- Supabase query threw
 *
 * Ranking formula (full math in `lib/recommend.ts`):
 *
 *   score = avg_rating           * 0.6
 *         + normalized_reviews   * 0.3
 *         + location_match_bonus * 0.1
 *
 * Plan traceability:
 *   - AC-7 bullet 1 (city / budgetTier / cuisine params)        -- this file
 *   - AC-7 bullet 2 (ranking formula documented in code)        -- lib/recommend.ts
 *   - AC-7 bullet 3 (curl returns 200 + non-empty array)        -- see scripts/verify-recommend.ts
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAnonClient, type RestaurantRow } from "@/lib/supabase";
import {
  rankRestaurants,
  type RecommendFilter,
} from "@/lib/recommend";

// Next.js Route Handler config -- force dynamic so query params are
// always honoured and the response is not cached at the edge.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// zod schema for the inbound query string. `coerce` turns the URL
// string into a number; `safe()` lets us return a 400 instead of
// throwing on bad input.
const querySchema = z.object({
  city: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  budgetTier: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .transform((v) => (Number.isFinite(v) ? (v as 1 | 2 | 3) : undefined)),
  cuisine: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .transform((v) => (Number.isFinite(v) ? v : 20)),
});

type ParsedQuery = z.infer<typeof querySchema>;

function buildFilter(parsed: ParsedQuery): RecommendFilter {
  const filter: RecommendFilter = {};
  if (parsed.city) filter.city = parsed.city;
  if (parsed.budgetTier !== undefined) filter.budgetTier = parsed.budgetTier;
  if (parsed.cuisine) filter.cuisine = parsed.cuisine;
  return filter;
}

/**
 * GET handler -- see module-level docblock for the full contract.
 *
 * The handler is intentionally defensive about Supabase availability:
 * if the deployment is missing env vars (e.g. local `next dev` without
 * a real `.env.local`), we return 503 so a reviewer can distinguish
 * "endpoint is wired but unconfigured" from "endpoint crashed".
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    raw[key] = value;
  }

  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: "One or more query parameters failed validation.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const filter = buildFilter(parsed.data);
  const limit = parsed.data.limit;

  const supabase = getSupabaseAnonClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error: "supabase_unconfigured",
        message:
          "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are " +
          "not set on this deployment; the recommendation endpoint cannot " +
          "query restaurants. See README.md for the env setup.",
      },
      { status: 503 },
    );
  }

  // We pull a generous window from Supabase and rank in-memory.
  // The DB already has indexes on (city, cuisine, budget_tier), so
  // this query stays cheap; ranking in JS keeps the formula in one
  // pure module that the verifier can exercise offline.
  //
  // The untyped Supabase client returns `data: any[]`; we cast it to
  // `RestaurantRow[]` here so the rest of the pipeline (and tsc) sees
  // the same shape we share with the scraper. If a future migration
  // adds a column, the cast and `RestaurantRow` both need to update.
  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, name, city, area, cuisine, budget_tier, avg_rating, " +
        "review_count, address, source_url, scraped_at, image_url, " +
        "created_at, updated_at",
    )
    .order("avg_rating", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return NextResponse.json(
      {
        error: "supabase_query_failed",
        message: error.message,
      },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as RestaurantRow[];
  const ranked = rankRestaurants(rows, filter, limit);

  return NextResponse.json(
    {
      filter,
      limit,
      total_candidates: rows.length,
      count: ranked.length,
      results: ranked,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}