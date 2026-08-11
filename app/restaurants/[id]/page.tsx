import Link from "next/link";
import { notFound } from "next/navigation";

import type { RestaurantRow, ReviewRow } from "@/lib/supabase";
import {
  budgetTierLabel,
  canQueryRestaurants,
  fetchRestaurantById,
  fetchReviewsByRestaurantId,
  formatRating,
  formatRelativeScrapedAt,
  formatReviewCount,
} from "@/lib/restaurants";

/**
 * Restaurant detail page (AC-8).
 *
 * Renders name, area, cuisine, budget tier (with the Naira glyph), avg
 * rating, review snippets, source link, and image for a single
 * restaurant. The page is a Server Component so the Supabase query
 * runs on the server and we ship static HTML to crawlers.
 *
 * Behaviour:
 *   - 404 when the row doesn't exist.
 *   - Falls back to a friendly "Not configured" copy when Supabase env
 *     is missing (instead of crashing the build in CI / first-visit).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<{
  title: string;
  description: string;
}> {
  const restaurant = await fetchRestaurantById(params.id);
  if (!restaurant) {
    return {
      title: "Restaurant not found | FlavorFind",
      description: "That FlavorFind restaurant could not be located.",
    };
  }
  const cuisine = restaurant.cuisine ? ` ${restaurant.cuisine}` : "";
  return {
    title: `${restaurant.name} | FlavorFind`,
    description: `${restaurant.name}${cuisine ? ` - a${cuisine.trimStart()} restaurant in ${restaurant.city}` : ` - in ${restaurant.city}`}. Reviews, budget tier and contact info on FlavorFind.`,
  };
}

function ReviewItem({ review }: { review: ReviewRow }) {
  const rating = formatRating(review.rating);
  return (
    <li className="rounded-2xl border border-brand-accent/30 bg-white p-5 shadow-sm">
      <blockquote className="font-display text-sm leading-relaxed text-brand-dark">
        &ldquo;{review.snippet}&rdquo;
      </blockquote>
      <footer className="mt-3 flex items-center justify-between text-xs text-brand-mid">
        <span className="inline-flex items-center gap-1 font-semibold text-brand-dark">
          <span aria-hidden="true">★</span>
          {rating}
          <span className="ml-1 text-xs font-normal text-brand-mid">
            / 5
          </span>
        </span>
        <Link
          href={review.source_url}
          className="font-semibold text-brand-dark underline underline-offset-2 hover:text-brand-light"
          rel="noopener noreferrer"
          target="_blank"
        >
          Read on source →
        </Link>
      </footer>
    </li>
  );
}

function EmptyState({ reason }: { reason: "no_data" | "unconfigured" }) {
  if (reason === "unconfigured") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-dashed border-brand-accent/50 bg-white/60 p-6 text-sm text-brand-mid"
      >
        <p className="font-display text-base font-semibold text-brand-dark">
          Reviews will appear here once Supabase is wired up.
        </p>
        <p className="mt-1">
          Copy{" "}
          <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
            .env.local
          </code>{" "}
          and run{" "}
          <code className="rounded bg-brand-cream px-1.5 py-0.5 text-xs text-brand-dark">
            npm run scrape
          </code>
          .
        </p>
      </div>
    );
  }
  return (
    <p className="rounded-2xl border border-dashed border-brand-accent/40 bg-white/60 p-4 text-sm text-brand-mid">
      No review snippets yet for this restaurant - check back after
      the next scrape run.
    </p>
  );
}

function DetailHero({ restaurant }: { restaurant: RestaurantRow }) {
  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-br from-brand-light via-brand-accent to-brand-mid">
      {restaurant.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={restaurant.image_url}
          alt={`Cover photo of ${restaurant.name}`}
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-brand-dark/40 via-brand-dark/60 to-brand-dark/80"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-brand-cream sm:px-6 sm:py-14 lg:px-8">
        <Link
          href="/"
          className="self-start text-xs font-semibold uppercase tracking-[0.25em] text-brand-cream/80 underline-offset-4 hover:text-brand-cream hover:underline"
        >
          ? Back to Lagos
        </Link>
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          {restaurant.name}
        </h1>
        <p className="text-sm sm:text-base">
          {[restaurant.area, restaurant.cuisine, restaurant.city]
            .filter((v): v is string => Boolean(v && v.trim()))
            .join(" • ")}
        </p>
      </div>
    </div>
  );
}

export default async function RestaurantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const restaurant = await fetchRestaurantById(params.id);
  if (!restaurant) {
    notFound();
  }
  const row: RestaurantRow = restaurant;
  const reviews = await fetchReviewsByRestaurantId(row.id);
  const configured = canQueryRestaurants();

  const subtitle = [row.area, row.cuisine]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" • ");
  const budget = budgetTierLabel(row.budget_tier);
  const rating = formatRating(row.avg_rating);
  const reviewsLabel = formatReviewCount(row.review_count);
  const freshness = formatRelativeScrapedAt(row.scraped_at);

  return (
    <article>
      <DetailHero restaurant={row} />

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:gap-12 lg:px-8">
        <section aria-labelledby="about-heading" className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-mid">
              About this spot
            </p>
            <h2
              id="about-heading"
              className="font-display text-2xl font-bold text-brand-dark"
            >
              What diners say
            </h2>
          </header>

          {reviews.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {reviews.map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </ul>
          ) : (
            <EmptyState reason={configured ? "no_data" : "unconfigured"} />
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-brand-accent/30 bg-white p-6 shadow-sm">
            <h2 className="sr-only">Restaurant facts</h2>

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-mid">
                  Budget tier
                </p>
                <p
                  className="font-display text-2xl font-bold text-brand-dark"
                  aria-label={`Budget tier ${row.budget_tier} of 3`}
                >
                  {budget}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-mid">
                  Avg rating
                </p>
                <p className="font-display text-2xl font-bold text-brand-dark">
                  <span aria-hidden="true">★</span> {rating}
                  <span className="ml-1 text-base font-normal text-brand-mid">
                    / 5
                  </span>
                </p>
                <p className="text-xs text-brand-mid">
                  from {reviewsLabel} review{row.review_count === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-3 text-sm text-brand-dark sm:grid-cols-2">
              {subtitle ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-mid">
                    Cuisine / Area
                  </dt>
                  <dd>{subtitle}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-mid">
                  City
                </dt>
                <dd>{row.city}</dd>
              </div>
              {row.address ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-mid">
                    Address
                  </dt>
                  <dd>{row.address}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 flex flex-col gap-2 border-t border-brand-accent/20 pt-4 text-xs text-brand-mid">
              <p>Last scraped {freshness}.</p>
              <Link
                href={row.source_url}
                className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-dark px-4 py-2 text-sm font-semibold text-brand-cream shadow-sm transition-colors hover:bg-brand-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-cream"
                rel="noopener noreferrer"
                target="_blank"
              >
                Open source listing →
              </Link>
            </div>
          </div>

          <p className="text-xs text-brand-mid">
            <Link
              href="/"
              className="font-semibold text-brand-dark underline-offset-2 hover:underline"
            >
              ← Browse more {row.city} restaurants
            </Link>
          </p>
        </aside>
      </div>
    </article>
  );
}
