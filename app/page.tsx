import Link from "next/link";

import {
  DEFAULT_CITY,
  canQueryRestaurants,
  fetchTopRestaurantsByCity,
} from "@/lib/restaurants";
import Hero from "@/components/Hero";
import RestaurantCard from "@/components/RestaurantCard";

/**
 * Home page (AC-4 hero + AC-8 listing).
 *
 * Renders the African-themed Hero followed by the top restaurants for
 * the default city (Lagos). The page is a Server Component so the
 * Supabase query runs on the server and the response ships as static
 * HTML for visitors without JavaScript.
 *
 * When Supabase env vars are missing (e.g. a fresh clone without
 * `.env.local`), the page still renders -- it shows a one-line empty
 * state pointing the developer at README.md instead of crashing the
 * build. This keeps `next dev` and `next build` green on the
 * Vercel-deployable track the plan calls for.
 */
export default async function HomePage() {
  const restaurants = await fetchTopRestaurantsByCity(DEFAULT_CITY);
  const configured = canQueryRestaurants();

  return (
    <main>
      <Hero />

      <section
        id="restaurants"
        aria-labelledby="restaurants-heading"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-mid">
              Top picks
            </p>
            <h2
              id="restaurants-heading"
              className="font-display text-3xl font-bold text-brand-dark sm:text-4xl"
            >
              {DEFAULT_CITY}&rsquo;s best restaurants
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-mid sm:text-base">
              Ranked by real Google reviews and cross-checked against
              Nigerian food blogs. Data refreshes weekly via the
              scraper.
            </p>
          </div>
          <p className="text-xs uppercase tracking-wide text-brand-mid">
            Showing {restaurants.length} restaurant
            {restaurants.length === 1 ? "" : "s"}
          </p>
        </div>

        {restaurants.length > 0 ? (
          <ul
            aria-label="Restaurant listings"
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
              No restaurants yet for {DEFAULT_CITY}.
            </p>
            {configured ? (
              <p className="mt-2 text-sm">
                Supabase is reachable, but the table is empty. Run
                {" "}
                <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
                  npm run scrape
                </code>
                {" "}
                to populate it.
              </p>
            ) : (
              <p className="mt-2 text-sm">
                Supabase env vars are not configured for this deployment.
                Copy{" "}
                <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
                  .env.example
                </code>
                {" "}
                to{" "}
                <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
                  .env.local
                </code>
                {" "}
                and fill in{" "}
                <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>
                {" "}
                +{" "}
                <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>
                . See{" "}
                <Link
                  href="https://github.com/<owner>/flavorfind#readme"
                  className="font-semibold text-brand-dark underline underline-offset-2 hover:text-brand-light"
                >
                  the README
                </Link>{" "}
                for the full setup walkthrough.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
