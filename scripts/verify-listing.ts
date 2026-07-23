/**
 * Verifier for the AC-8 listing + detail pages.
 *
 * Stays offline: does NOT touch Supabase or the network. Asserts:
 *   1. All new files / directories are present on disk.
 *   2. `app/page.tsx` renders the default city ("Lagos") and includes
 *      `RestaurantCard` in its grid.
 *   3. `app/restaurants/[id]/page.tsx` exists, exports a default async
 *      page, and contains every field the AC-8 spec calls out:
 *      name / area / cuisine / budget tier ("?" glyph) / avg rating /
 *      review snippets / source link / image.
 *   4. The card link wraps the cell in a Next.js `Link` pointing at
 *      `/restaurants/<id>`.
 *   5. Pure helpers in `lib/restaurants.ts` behave per spec:
 *      `budgetTierLabel`, `formatRating`, `formatReviewCount`,
 *      `formatRelativeScrapedAt`, `clampLimit`, `scrapedAgoMs`.
 *
 * Usage:  npx tsx scripts/verify-listing.ts
 * Exit:   0 on success, 1 on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_CITY,
  LISTING_LIMIT,
  budgetTierLabel,
  clampLimit,
  formatRating,
  formatRelativeScrapedAt,
  formatReviewCount,
  scrapedAgoMs,
} from "../lib/restaurants";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

let failed = 0;
function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    console.error(`FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failed += 1;
  }
}

function approx(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

function run(): void {
  // -----------------------------------------------------------------
  // 1. Files / directories exist
  // -----------------------------------------------------------------
  const cardPath = resolve(repoRoot, "components", "RestaurantCard.tsx");
  const libPath = resolve(repoRoot, "lib", "restaurants.ts");
  const homePath = resolve(repoRoot, "app", "page.tsx");
  const detailDir = resolve(repoRoot, "app", "restaurants", "[id]");
  const detailPath = resolve(detailDir, "page.tsx");

  assert("components/RestaurantCard.tsx exists", existsSync(cardPath));
  assert("lib/restaurants.ts exists", existsSync(libPath));
  assert("app/page.tsx exists", existsSync(homePath));
  assert(
    "app/restaurants/[id] directory exists",
    existsSync(detailDir),
  );
  assert(
    "app/restaurants/[id]/page.tsx exists",
    existsSync(detailPath),
  );

  // -----------------------------------------------------------------
  // 2. app/page.tsx renders the default city + grid
  // -----------------------------------------------------------------
  const homeSrc = readFileSync(homePath, "utf8");
  assert(
    "app/page.tsx is a Server Component (no 'use client')",
    !/^\s*"use client"/m.test(homeSrc) &&
      !/export\s+default\s+async/.test(homeSrc) === false,
  );
  assert(
    "app/page.tsx exports an async default function",
    /export\s+default\s+async\s+function\s+HomePage/.test(homeSrc),
  );
  assert(
    "app/page.tsx defaults the city to Lagos",
    homeSrc.includes(DEFAULT_CITY) || homeSrc.includes('"Lagos"'),
  );
  assert(
    "app/page.tsx renders the RestaurantCard component",
    homeSrc.includes("RestaurantCard"),
  );
  assert(
    "app/page.tsx still includes the Hero component",
    homeSrc.includes("Hero"),
  );
  assert(
    "app/page.tsx keeps the #restaurants anchor",
    homeSrc.includes('id="restaurants"'),
  );
  assert(
    "app/page.tsx renders a responsive grid",
    /grid-cols-1[^"]*sm:grid-cols-2[^"]*lg:grid-cols-3/.test(homeSrc) ||
      /grid-cols-1[\s\S]*sm:grid-cols-2[\s\S]*lg:grid-cols-3/.test(homeSrc),
  );

  // -----------------------------------------------------------------
  // 3. Detail page shape
  // -----------------------------------------------------------------
  const detailSrc = readFileSync(detailPath, "utf8");
  assert(
    "detail page exports an async default function",
    /export\s+default\s+async\s+function\s+RestaurantDetailPage/.test(detailSrc),
  );
  assert(
    "detail page uses Next.js notFound() when the row is missing",
    detailSrc.includes("notFound()"),
  );
  assert(
    "detail page reads params.id",
    detailSrc.includes("params") && detailSrc.includes(".id"),
  );
  assert(
    "detail page shows the name",
    /\{row\.name\}/.test(detailSrc) || /\{restaurant\.name\}/.test(detailSrc),
  );
  assert(
    "detail page shows area",
    /row\.area|restaurant\.area/.test(detailSrc),
  );
  assert(
    "detail page shows cuisine",
    /row\.cuisine|restaurant\.cuisine/.test(detailSrc),
  );
  assert(
    "detail page shows budget tier via the budgetTierLabel helper",
    detailSrc.includes("budgetTierLabel("),
  );
  assert(
    "detail page shows the avg rating via formatRating",
    detailSrc.includes("formatRating("),
  );
  assert(
    "detail page renders review snippets",
    /reviews\.map|review\.snippet/.test(detailSrc),
  );
  assert(
    "detail page links to the source listing",
    detailSrc.includes("source_url") || detailSrc.includes("sourceUrl"),
  );
  assert(
    "detail page renders an image (or placeholder)",
    /<img\b|image_url/.test(detailSrc),
  );

  // -----------------------------------------------------------------
  // 4. Card link wraps the cell in Next.js Link
  // -----------------------------------------------------------------
  const cardSrc = readFileSync(cardPath, "utf8");
  assert(
    "RestaurantCard imports Next.js Link",
    /import\s+Link\s+from\s+"next\/link"/.test(cardSrc),
  );
  assert(
    "RestaurantCard uses Link with /restaurants/<id> href",
    /href=\{?`\/restaurants\/\$\{restaurant\.id\}`?\}/.test(cardSrc) ||
      /href=\"\/restaurants\/\$\{restaurant\.id\}\"/.test(cardSrc),
  );
  assert(
    "RestaurantCard shows the budget tier",
    cardSrc.includes("budgetTierLabel"),
  );
  assert(
    "RestaurantCard shows the avg rating",
    cardSrc.includes("formatRating"),
  );
  assert(
    "RestaurantCard shows the review count",
    cardSrc.includes("formatReviewCount"),
  );
  assert(
    "RestaurantCard renders an image (or fallback initial)",
    /<img\b/.test(cardSrc),
  );

  // -----------------------------------------------------------------
  // 5. Pure helpers
  // -----------------------------------------------------------------
  // budgetTierLabel -- ₦ is U+20A6 (Naira Sign); use escapes so the
  // verifier stays ASCII-clean regardless of editor / shell encoding.
  const NAIRA = "₦";
  assert("budgetTierLabel(1) === one naira glyph", budgetTierLabel(1) === NAIRA);
  assert(
    "budgetTierLabel(2) === two naira glyphs",
    budgetTierLabel(2) === NAIRA.repeat(2),
  );
  assert(
    "budgetTierLabel(3) === three naira glyphs",
    budgetTierLabel(3) === NAIRA.repeat(3),
  );
  assert(
    "budgetTierLabel(null) falls back to placeholder",
    budgetTierLabel(null) === `${NAIRA}?`,
  );
  assert(
    "budgetTierLabel(0) falls back to placeholder",
    budgetTierLabel(0) === `${NAIRA}?`,
  );

  // formatRating -- em dash is U+2014.
  const EMDASH = "—";
  assert(
    "formatRating(4.37) === '4.4'",
    formatRating(4.37) === "4.4",
  );
  assert("formatRating(5) === '5.0'", formatRating(5) === "5.0");
  assert("formatRating(0) === '0.0'", formatRating(0) === "0.0");
  assert(
    `formatRating(null) === '${EMDASH}'`,
    formatRating(null) === EMDASH,
  );
  assert(
    `formatRating(undefined) === '${EMDASH}'`,
    formatRating(undefined) === EMDASH,
  );

  // formatReviewCount
  assert("formatReviewCount(34) === '34'", formatReviewCount(34) === "34");
  assert("formatReviewCount(0) === '0'", formatReviewCount(0) === "0");
  assert(
    "formatReviewCount(1200) === '1.2k'",
    formatReviewCount(1200) === "1.2k",
  );
  assert(
    "formatReviewCount(10000) === '10k' (trailing .0 stripped)",
    formatReviewCount(10000) === "10k",
  );
  assert(
    "formatReviewCount(null) === '0'",
    formatReviewCount(null) === "0",
  );

  // formatRelativeScrapedAt
  const now = new Date("2026-07-23T12:00:00.000Z");
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
  const twoHrsAgo = new Date(now.getTime() - 2 * 60 * 60_000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60_000).toISOString();
  const fiftyDaysAgo = new Date(now.getTime() - 50 * 24 * 60 * 60_000).toISOString();
  assert(
    "formatRelativeScrapedAt(5 min ago) === '5 min ago'",
    formatRelativeScrapedAt(fiveMinAgo, now) === "5 min ago",
  );
  assert(
    "formatRelativeScrapedAt(2 hr ago) === '2 hr ago'",
    formatRelativeScrapedAt(twoHrsAgo, now) === "2 hr ago",
  );
  assert(
    "formatRelativeScrapedAt(3 days ago) === '3 days ago'",
    formatRelativeScrapedAt(threeDaysAgo, now) === "3 days ago",
  );
  assert(
    "formatRelativeScrapedAt(50 days ago) is a months label",
    /mo ago$/.test(formatRelativeScrapedAt(fiftyDaysAgo, now)),
  );
  assert(
    "formatRelativeScrapedAt(null) === 'freshness unknown'",
    formatRelativeScrapedAt(null, now) === "freshness unknown",
  );
  assert(
    "formatRelativeScrapedAt('not-a-date') === 'freshness unknown'",
    formatRelativeScrapedAt("not-a-date", now) === "freshness unknown",
  );
  // scrapedAgoMs
  const ago = scrapedAgoMs(threeDaysAgo, now);
  assert(
    "scrapedAgoMs returns roughly 3 days in ms",
    typeof ago === "number" && approx(ago as number, 3 * 24 * 60 * 60_000, 1000),
  );
  assert(
    "scrapedAgoMs(null) returns null",
    scrapedAgoMs(null, now) === null,
  );

  // clampLimit
  assert("clampLimit(10) === 10", clampLimit(10) === 10);
  assert("clampLimit(0) === 1 (floor)", clampLimit(0) === 1);
  assert("clampLimit(200) === 100 (ceiling)", clampLimit(200) === 100);
  assert("clampLimit(-3) === 1 (clamp negative)", clampLimit(-3) === 1);
  assert(
    "clampLimit(NaN) falls back to LISTING_LIMIT",
    clampLimit(Number.NaN) === LISTING_LIMIT,
  );

  // Defaults
  assert("DEFAULT_CITY === 'Lagos'", DEFAULT_CITY === "Lagos");
  assert("LISTING_LIMIT === 20", LISTING_LIMIT === 20);
}

run();

if (failed > 0) {
  console.error(`[verify-listing] FAIL -- ${failed} check(s) failed.`);
  process.exit(1);
}
console.log("[verify-listing] OK -- AC-8 listing + detail are healthy.");
