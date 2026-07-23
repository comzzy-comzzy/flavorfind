import Link from "next/link";

import type { RestaurantRow } from "@/lib/supabase";
import {
  budgetTierLabel,
  formatRating,
  formatRelativeScrapedAt,
  formatReviewCount,
} from "@/lib/restaurants";

/**
 * Restaurant card rendered on the home page listing.
 *
 * Per AC-8:
 *   - Each card links to its detail page via Next.js `Link`
 *     (`/restaurants/<id>`).
 *   - Shows name, area, cuisine, budget tier, avg rating, review count,
 *     and a hero image so a user can scan the grid without opening
 *     each detail page.
 *
 * The component is a pure Server Component: no `"use client"`, no
 * hooks, no event handlers. The whole card is wrapped in `<Link>` so
 * keyboard users can tab through the grid.
 */
export default function RestaurantCard({
  restaurant,
}: {
  restaurant: RestaurantRow;
}) {
  const budget = budgetTierLabel(restaurant.budget_tier);
  const rating = formatRating(restaurant.avg_rating);
  const reviews = formatReviewCount(restaurant.review_count);
  const freshness = formatRelativeScrapedAt(restaurant.scraped_at);
  const subtitle = [restaurant.area, restaurant.cuisine]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" • ");

  return (
    <Link
      href={`/restaurants/${restaurant.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-accent/30 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-light hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-cream"
    >
      {/* Cover image -- falls back to a brown-tone gradient if the
          scraper hasn't recorded an image_url yet. */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-brand-light via-brand-accent to-brand-mid">
        {restaurant.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.image_url}
            alt={`Cover photo of ${restaurant.name}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-brand-cream/80"
          >
            <span className="font-display text-3xl font-bold tracking-tight">
              {restaurant.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-dark/85 px-2.5 py-1 text-xs font-semibold text-brand-cream">
          <span aria-hidden="true">{budget}</span>
          <span className="sr-only">
            Budget tier {restaurant.budget_tier} of 3
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <header className="flex flex-col gap-1">
          <h3 className="font-display text-lg font-semibold leading-snug text-brand-dark group-hover:text-brand-mid">
            {restaurant.name}
          </h3>
          {subtitle ? (
            <p className="text-xs uppercase tracking-wide text-brand-mid">
              {subtitle}
            </p>
          ) : (
            <p className="text-xs uppercase tracking-wide text-brand-mid">
              {restaurant.city}
            </p>
          )}
        </header>

        <dl className="mt-auto grid grid-cols-2 gap-2 text-xs text-brand-mid">
          <div className="flex flex-col">
            <dt className="font-semibold uppercase tracking-wide text-brand-dark">
              Rating
            </dt>
            <dd className="text-base font-semibold text-brand-dark">
              <span aria-hidden="true">★</span> {rating}
              <span className="ml-1 text-xs font-normal text-brand-mid">
                / 5
              </span>
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="font-semibold uppercase tracking-wide text-brand-dark">
              Reviews
            </dt>
            <dd className="text-base font-semibold text-brand-dark">
              {reviews}
            </dd>
          </div>
        </dl>

        <footer className="flex items-center justify-between border-t border-brand-accent/20 pt-3 text-[11px] text-brand-mid">
          <span>Updated {freshness}</span>
          <span
            aria-hidden="true"
            className="font-semibold text-brand-dark transition-transform group-hover:translate-x-1"
          >
            View →
          </span>
        </footer>
      </div>
    </Link>
  );
}
