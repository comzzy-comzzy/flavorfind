import { Suspense } from "react";
import Link from "next/link";

import {
  DEFAULT_CITY,
  canQueryRestaurants,
  fetchRestaurantsByFilter,
} from "@/lib/restaurants";
import {
  parseFilterParams,
  activeFilterCount,
  isEmptyFilter,
} from "@/lib/filters";
import FilterBar from "@/components/FilterBar";
import Hero from "@/components/Hero";
import RestaurantCard from "@/components/RestaurantCard";

/**
 * Home page (AC-4 hero + AC-8 listing + AC-9 filters).
 *
 * Renders the African-themed Hero followed by a `FilterBar` and the
 * top restaurants for the *currently filtered* set. The page is a
 * Server Component so the Supabase query runs on the server and the
 * response ships as static-ish HTML (the page is marked
 * `force-dynamic` because the rendering depends on `searchParams`).
 *
 * When Supabase env vars are missing (e.g. a fresh clone without
 * `.env.local`), the page still renders -- it shows a one-line empty
 * state pointing the developer at README.md instead of crashing the
 * build. This keeps `next dev` and `next build` green on the
 * Vercel-deployable track the plan calls for.
 */
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const filter = parseFilterParams(searchParams);
  // `city` is the dominant selector in the FilterBar -- when none is
  // supplied, fall back to the plan-mandated DEFAULT_CITY ("Lagos")
  // so the home page never serves an unfiltered countrywide list.
  const effectiveCity = filter.city ?? DEFAULT_CITY;

  const restaurants = await fetchRestaurantsByFilter(
    {
      ...filter,
      city: effectiveCity,
    },
  );
  const configured = canQueryRestaurants();
  const filterCount = activeFilterCount(filter);
  const filtersActive = !isEmptyFilter(filter);

  return (
    <main>
      <Hero />

      <section
        id="restaurants"
        aria-labelledby="restaurants-heading"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-script text-3xl text-brand-accent sm:text-4xl">
              The dining edit
            </p>
            <h2
              id="restaurants-heading"
              className="mt-1 font-display text-4xl font-normal tracking-tight text-brand-dark sm:text-5xl"
            >
              Places to know in {effectiveCity}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-brand-mid sm:text-base">
              A useful shortlist for dinner plans, quick lunches and memorable occasions—drawn from current listings and trusted local voices.
            </p>
          </div>
          <p className="border-t border-brand-dark/20 pt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-mid">
            Showing {restaurants.length} restaurant
            {restaurants.length === 1 ? "" : "s"}
            {filtersActive ? ` for ${filterCount} filter${filterCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>

        <div className="mt-6">
          {/* `useSearchParams` opts this client component into
              Next.js' dynamic rendering; wrapping it in <Suspense>
              keeps the rest of the page (hero, layout) streamable. */}
          <Suspense fallback={<FilterBarFallback />}>
            <FilterBar currentFilter={filter} />
          </Suspense>
        </div>

        {restaurants.length > 0 ? (
          <ul
            aria-label="Restaurant listings"
            className="mt-10 grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
          >
            {restaurants.map((restaurant) => (
              <li key={restaurant.id} className="h-full">
                <RestaurantCard restaurant={restaurant} />
              </li>
            ))}
          </ul>
        ) : (
          <div
            role="status"
            className="mt-8 rounded-2xl border border-dashed border-brand-accent/50 bg-white/60 p-8 text-center text-brand-mid"
          >
            <p className="font-display text-lg font-semibold text-brand-dark">
              {filtersActive
                ? `No restaurants match your filters in ${effectiveCity}.`
                : `No restaurants yet for ${effectiveCity}.`}
            </p>
            {filtersActive && (
              <p className="mt-2 text-sm">
                Try widening the budget tier or removing a cuisine.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

/**
 * Lightweight non-JS placeholder rendered while the FilterBar's
 * client bundle hydrates. Mirrors the FilterBar container so the
 * layout doesn't jump. Marked `role="status"` so AT users hear
 * "Loading filters...".
 */
function FilterBarFallback() {
  return (
    <div
      role="status"
      aria-label="Loading filters"
      className="h-[88px] animate-pulse rounded-2xl border border-brand-accent/30 bg-white/60 p-4 shadow-sm sm:h-[76px]"
    />
  );
}
