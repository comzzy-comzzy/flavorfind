import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase clients used by the recommendation API and the
 * scraper. The web app itself reads data through Server Components
 * using the public (anon) client; the scraper writes through the
 * service-role client.
 *
 * Both clients are intentionally **lazy**: we do not want to construct
 * them at module-import time, because that would crash `next build` if
 * the env vars are missing in CI (which they will be until Vercel /
 * the user wires up their own Supabase project). Returning `null`
 * lets the caller handle a missing configuration gracefully (e.g.
 * render an empty list, or log a warning from the scraper).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseEnv = Boolean(url && anonKey);
export const hasSupabaseServiceEnv = Boolean(url && serviceKey);

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Public Supabase client for read-only queries from Server Components
 * and Route Handlers. Honours RLS, which means SELECT works but writes
 * are denied -- exactly what the web app needs.
 */
export function getSupabaseAnonClient(): SupabaseClient | null {
  if (!hasSupabaseEnv) return null;
  if (!anonClient) {
    anonClient = createClient(url as string, anonKey as string, {
      auth: { persistSession: false },
    });
  }
  return anonClient;
}

/**
 * Privileged Supabase client used by the scraper (scripts/scrape.ts)
 * to upsert restaurants and reviews. The service-role key bypasses
 * RLS, so this client should NEVER be exposed to the browser.
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (!hasSupabaseServiceEnv) return null;
  if (!serviceClient) {
    serviceClient = createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

/**
 * Typed shapes for the rows returned by `public.restaurants` and
 * `public.reviews`. Kept here so the recommendation API and the
 * scraper can share a single type definition without a code-gen step.
 * Field names mirror the columns in `supabase/schema.sql` 1:1.
 */
export interface RestaurantRow {
  id: string;
  name: string;
  city: string;
  area: string | null;
  cuisine: string | null;
  budget_tier: 1 | 2 | 3;
  avg_rating: number | null;
  review_count: number;
  address: string | null;
  source_url: string;
  scraped_at: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewRow {
  id: string;
  restaurant_id: string;
  snippet: string;
  rating: number | null;
  source_url: string;
  scraped_at: string;
}
