-- =====================================================================
-- FlavorFind — restaurant + reviews schema
-- ---------------------------------------------------------------------
-- Run this file once against your Supabase project to bootstrap the
-- public.restaurants and public.reviews tables used by the web app and
-- the scraper.
--
-- How to apply
--   1. Supabase dashboard:  SQL Editor → New query → paste + run
--   2. supabase-cli / psql:
--        supabase db execute --file supabase/schema.sql
--      or
--        psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- This file is idempotent (uses `IF NOT EXISTS` / `DROP ... IF EXISTS`)
-- so it is safe to re-run when adding new objects during development.
-- =====================================================================

-- ---------------------------------------------------------------------
-- pgcrypto provides gen_random_uuid(); Supabase enables it by default
-- but the explicit CREATE EXTENSION keeps this file working against
-- a vanilla Postgres too.
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------
-- One row per scraped restaurant. `source_url` points to the page on
-- the upstream source (Google Places, a Nigerian food blog, etc.) so
-- users can drill through to the original listing.
--
-- `budget_tier` is encoded as:
--   1 = low  (single ₦)    -- street food, bukas, small chops spots
--   2 = mid  (double ₦₦)   -- casual sit-down restaurants
--   3 = high (triple ₦₦₦)  -- upscale / fine dining
-- The UI in components/FilterBar.tsx maps this back to the ₦ labels.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurants (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text         NOT NULL,
  city          text         NOT NULL,
  area          text,
  cuisine       text,
  budget_tier   smallint     NOT NULL DEFAULT 2
                 CHECK (budget_tier BETWEEN 1 AND 3),
  avg_rating    numeric(3, 2)
                 CHECK (avg_rating IS NULL OR (avg_rating >= 0 AND avg_rating <= 5)),
  review_count  integer      NOT NULL DEFAULT 0
                 CHECK (review_count >= 0),
  address       text,
  source_url    text         NOT NULL,
  scraped_at    timestamptz  NOT NULL DEFAULT now(),
  image_url     text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------
-- Short review snippets (1-2 sentences) pulled alongside the
-- restaurant record. `source_url` typically mirrors the restaurant's
-- `source_url` but is kept on the row so reviews scraped from
-- independent blog posts can be linked back to their original page.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid          NOT NULL
                  REFERENCES public.restaurants(id) ON DELETE CASCADE,
  snippet        text          NOT NULL,
  rating         numeric(3, 2)
                  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  source_url     text          NOT NULL,
  scraped_at     timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Indexes -- match the filters used by the AC-7 recommendation
-- endpoint (city / cuisine / budget_tier) and the listing page sort
-- order (avg_rating DESC).
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_restaurants_city
  ON public.restaurants (lower(city));

CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine
  ON public.restaurants (lower(cuisine));

CREATE INDEX IF NOT EXISTS idx_restaurants_budget_tier
  ON public.restaurants (budget_tier);

CREATE INDEX IF NOT EXISTS idx_restaurants_avg_rating
  ON public.restaurants (avg_rating DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_restaurants_name
  ON public.restaurants (lower(name));

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id
  ON public.reviews (restaurant_id);

-- ---------------------------------------------------------------------
-- updated_at trigger -- keeps `updated_at` honest on every UPDATE so
-- the scraper can rely on it as a freshness signal.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurants_set_updated_at ON public.restaurants;
CREATE TRIGGER trg_restaurants_set_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security -- locked down by default with public read-only
-- access for the Next.js app. Writes are restricted to the Supabase
-- service-role key, which is used by scripts/scrape.ts and bypasses
-- RLS automatically. No INSERT/UPDATE/DELETE policies are created for
-- the anon role, so the public client can only SELECT.
-- ---------------------------------------------------------------------
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurants_select_public ON public.restaurants;
CREATE POLICY restaurants_select_public
  ON public.restaurants
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS reviews_select_public ON public.reviews;
CREATE POLICY reviews_select_public
  ON public.reviews
  FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------
-- Convenience view: most-recently scraped restaurants with a computed
-- freshness column. Useful for hand-checking that the scraper has
-- been feeding data in.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.recent_restaurants AS
  SELECT
    id,
    name,
    city,
    cuisine,
    budget_tier,
    avg_rating,
    review_count,
    scraped_at,
    source_url,
    scraped_at > now() - interval '7 days' AS is_fresh
  FROM public.restaurants
  ORDER BY scraped_at DESC;

COMMENT ON TABLE  public.restaurants IS 'FlavorFind -- scraped restaurants (Google Places + Nigerian food blogs).';
COMMENT ON TABLE  public.reviews     IS 'FlavorFind -- short review snippets linked to public.restaurants.';
COMMENT ON COLUMN public.restaurants.budget_tier IS '1 = low (NGN), 2 = mid (NGN NGN), 3 = high (NGN NGN NGN).';
