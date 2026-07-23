/**
 * Shared TypeScript types for the AC-6 scraper.
 *
 * The scraper pulls data from two distinct sources (Google Places REST
 * API + at least one Nigerian food blog via Cheerio). Each source
 * adapter normalises its raw payload into the {@link ScraperRestaurant}
 * shape so the upsert layer only has to handle one row format.
 *
 * These types intentionally mirror the columns in
 * `supabase/schema.sql` and `lib/supabase.ts` (`RestaurantRow` /
 * `ReviewRow`) but stop short of importing those row types because the
 * scraper has its own simple in-memory representation that does not
 * require `created_at` / `updated_at` to be set on insert (the database
 * fills those in via DEFAULT).
 */

/**
 * One normalised review snippet pulled from a source page. Multiple
 * snippets may attach to the same {@link ScraperRestaurant.reviews}
 * array; the upsert layer is responsible for chunking them into
 * `public.reviews` rows.
 */
export interface ScraperReview {
  /** Short snippet text, typically 1-2 sentences. Must be non-empty. */
  snippet: string;
  /** Optional numeric rating on the same 0-5 scale as `restaurants.avg_rating`. */
  rating: number | null;
  /** URL of the page this snippet was scraped from. */
  sourceUrl: string;
}

/**
 * One normalised restaurant ready to be upserted into
 * `public.restaurants` + `public.reviews`.
 *
 * The scraper treats `(name, city, source_url)` as the natural key for
 * "have I already inserted this row?" so subsequent runs are idempotent
 * and only refresh fields like `avg_rating`, `review_count`, and
 * `scraped_at`.
 */
export interface ScraperRestaurant {
  /** Restaurant display name, e.g. "Nkwu Eze". */
  name: string;
  /** City slug used by the UI: "Lagos" | "Abuja" | ... — must match the AC-9 city dropdown exactly. */
  city: string;
  /** Free-form area / neighbourhood, e.g. "Lekki Phase 1". May be null. */
  area: string | null;
  /** Cuisine label, e.g. "Nigerian", "Chinese". May be null if unknown. */
  cuisine: string | null;
  /** 1 = low (₦), 2 = mid (₦₦), 3 = high (₦₦₦). Defaults to 2 (mid) when unknown. */
  budgetTier: 1 | 2 | 3;
  /** Average rating on a 0-5 scale, or null if no reviews surfaced. */
  avgRating: number | null;
  /** Pre-aggregated review count for the cached `restaurants.review_count` column. */
  reviewCount: number;
  /** Street address. May be null if the source did not publish one. */
  address: string | null;
  /** Canonical page on the source (used as the dedupe key on upsert). */
  sourceUrl: string;
  /** Hero image URL. May be null if the source did not publish one. */
  imageUrl: string | null;
  /** Zero or more review snippets to attach to this restaurant. */
  reviews: ScraperReview[];
}

/**
 * A pluggable scraper source. Each adapter exposes a single `fetch()`
 * method that returns the normalised restaurants it found.
 *
 * The adapter contract is intentionally tiny so a third source can be
 * plugged in without changing the orchestrator (`scripts/scrape.ts`).
 */
export interface ScraperSource {
  /** Stable id used in log lines and the `sources` report block, e.g. "google-places". */
  readonly id: string;
  /** Short human description, e.g. "Google Places API (REST)". */
  readonly description: string;
  /**
   * Pull data from this source. May throw if the upstream is unavailable;
   * the orchestrator catches per-source errors so one failing adapter does
   * not abort the whole run.
   */
  fetch(): Promise<ScraperRestaurant[]>;
}

/**
 * Top-level config the orchestrator picks up from environment variables.
 * Keeping this as a plain interface (not a class) makes it trivially
 * testable from the verify script.
 */
export interface ScraperConfig {
  /** Supabase project URL. */
  supabaseUrl: string;
  /** Service-role key used to bypass RLS for writes. */
  supabaseServiceKey: string;
  /** Google Places API key. May be empty if the source is disabled. */
  googlePlacesApiKey: string;
  /**
   * Comma-separated list of source ids to enable. Defaults to all known
   * sources. Useful for `npm run scrape -- --source=google-places` style
   * filtering without re-typing env vars.
   */
  enabledSources: string[];
  /**
   * When true, do NOT write to Supabase -- just log the normalised
   * payload so a developer can sanity-check a new source adapter.
   */
  dryRun: boolean;
}
