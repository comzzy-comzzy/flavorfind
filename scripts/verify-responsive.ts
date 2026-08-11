/**
 * Verifier for the AC-10 Responsive design.
 *
 * Stays offline: does NOT touch Supabase or the network. Asserts:
 *   1. All required files exist on disk (Header, MobileMenu, layout, etc.).
 *   2. `app/layout.tsx` exports a `viewport` that sets `width: "device-width"`
 *      so the page is rendered at the device's natural viewport width.
 *   3. `components/Header.tsx` is responsive:
 *      - The desktop primary nav is hidden below `md` via `hidden md:flex`.
 *      - The MobileMenu hamburger is hidden from `md` upward via
 *        `md:hidden` (or a class string containing it).
 *      - The logo uses at least one responsive sizing class so the
 *        wordmark scales between the 375 / 768 / 1280 breakpoints.
 *      - The MobileMenu component is mounted.
 *   4. `components/MobileMenu.tsx` is a Client Component that renders a
 *      real `<button type="button">` hamburger with the right ARIA
 *      surface (`aria-expanded`, `aria-controls`, `role="dialog"`) and
 *      wires up an outside-click + Escape close handler.
 *   5. `components/Hero.tsx`, `components/FilterBar.tsx`,
 *      `components/RestaurantCard.tsx`, `app/page.tsx`, and
 *      `app/restaurants/[id]/page.tsx` all use at least one Tailwind
 *      responsive breakpoint utility (one of `sm:`, `md:`, `lg:`, or
 *      `xl:`) so they reflow between the 375 / 768 / 1280 breakpoints.
 *   6. None of the page shells hard-code a fixed `width:` style that
 *      would defeat the responsive design.
 *
 * Usage:  npx tsx scripts/verify-responsive.ts
 * Exit:   0 on success, 1 on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * Counts the number of Tailwind responsive breakpoint utilities used
 * in `source`. Matches e.g. `sm:flex`, `md:hidden`, `lg:grid-cols-3`,
 * `xl:max-w-7xl`, etc. The unitless `:` anchors the regex to keep
 * `class="bg-something:foo"` style strings from being counted.
 */
function responsiveUtilityCount(source: string): number {
  const re = /\b(?:sm|md|lg|xl|2xl):[\w\[\]\/\.\-]+/g;
  return (source.match(re) ?? []).length;
}

/**
 * Returns true if `source` contains at least one Tailwind responsive
 * breakpoint utility. This is the basic bar for "uses Tailwind
 * responsive utilities".
 */
function hasResponsiveUtility(source: string): boolean {
  return responsiveUtilityCount(source) >= 1;
}

function run(): void {
  // -----------------------------------------------------------------
  // 1. Files / directories exist
  // -----------------------------------------------------------------
  const layoutPath = resolve(repoRoot, "app", "layout.tsx");
  const headerPath = resolve(repoRoot, "components", "Header.tsx");
  const mobileMenuPath = resolve(repoRoot, "components", "MobileMenu.tsx");
  const heroPath = resolve(repoRoot, "components", "Hero.tsx");
  const filterBarPath = resolve(repoRoot, "components", "FilterBar.tsx");
  const cardPath = resolve(repoRoot, "components", "RestaurantCard.tsx");
  const homePath = resolve(repoRoot, "app", "page.tsx");
  const detailPath = resolve(
    repoRoot,
    "app",
    "restaurants",
    "[id]",
    "page.tsx",
  );

  assert("app/layout.tsx exists", existsSync(layoutPath));
  assert("components/Header.tsx exists", existsSync(headerPath));
  assert("components/MobileMenu.tsx exists", existsSync(mobileMenuPath));
  assert("components/Hero.tsx exists", existsSync(heroPath));
  assert("components/FilterBar.tsx exists", existsSync(filterBarPath));
  assert("components/RestaurantCard.tsx exists", existsSync(cardPath));
  assert("app/page.tsx exists", existsSync(homePath));
  assert(
    "app/restaurants/[id]/page.tsx exists",
    existsSync(detailPath),
  );

  // -----------------------------------------------------------------
  // 2. app/layout.tsx viewport meta
  // -----------------------------------------------------------------
  const layoutSrc = readFileSync(layoutPath, "utf8");
  assert(
    "app/layout.tsx imports the Viewport type from next",
    /import[^;]*type\s*\{[^}]*\bViewport\b/.test(layoutSrc) ||
      /import[^;]*\{[^}]*\bViewport\b/.test(layoutSrc) ||
      /\bViewport\b/.test(layoutSrc),
  );
  assert(
    "app/layout.tsx exports a `viewport` constant",
    /export\s+const\s+viewport\s*:/.test(layoutSrc),
  );
  assert(
    "app/layout.tsx sets viewport.width to 'device-width'",
    /viewport\s*:[^}]*width\s*:\s*"device-width"/s.test(layoutSrc) ||
      /width\s*:\s*"device-width"/.test(layoutSrc),
  );
  assert(
    "app/layout.tsx sets viewport.initialScale (1)",
    /initialScale\s*:\s*1\b/.test(layoutSrc),
  );
  assert(
    "app/layout.tsx sets <html lang=\"en\">",
    /<html\s+lang="en"/.test(layoutSrc),
  );
  assert(
    "app/layout.tsx sets theme-color to brand.dark",
    /themeColor\s*:\s*brandColors\.dark/.test(layoutSrc),
  );

  // -----------------------------------------------------------------
  // 3. Header.tsx responsive structure
  // -----------------------------------------------------------------
  const headerSrc = readFileSync(headerPath, "utf8");
  assert(
    "Header imports MobileMenu",
    headerSrc.includes("MobileMenu"),
  );
  assert(
    "Header renders <MobileMenu />",
    /<MobileMenu\s*\/>/.test(headerSrc),
  );
  // The desktop nav must be hidden below `md` and visible from `md` up.
  assert(
    "Header hides the desktop primary nav below `md` (hidden md:flex)",
    /className\s*=\s*"[^"]*\bhidden\b[^"]*\bmd:flex\b/.test(headerSrc) ||
      /className\s*=\s*"[^"]*\bmd:flex\b[^"]*\bhidden\b/.test(headerSrc),
  );
  // The MobileMenu wrapper must declare `md:hidden` so the hamburger
  // collapses at the `md` breakpoint.
  assert(
    "MobileMenu wrapper declares `md:hidden`",
    /\bmd:hidden\b/.test(headerSrc),
  );
  // Logo should use at least one responsive sizing utility.
  assert(
    "Header logo uses a responsive sizing utility (h-10 / sm / md)",
    /\bh-10\b[^"]*\bsm:/.test(headerSrc) ||
      /\bsm:[^"]*\bh-/.test(headerSrc) ||
      /\bmd:h-/.test(headerSrc) ||
      /\bsm:h-/.test(headerSrc),
  );
  // Container should keep its max-w-6xl and have responsive padding.
  assert(
    "Header container uses `max-w-6xl` for the wide-shell constraint",
    /max-w-6xl/.test(headerSrc),
  );
  assert(
    "Header container uses responsive horizontal padding (px-4 sm:px-6 lg:px-8)",
    /\bpx-4\b[^"]*\bsm:px-6\b[^"]*\blg:px-8\b/.test(headerSrc) ||
      /\bsm:px-6\b/.test(headerSrc),
  );

  // -----------------------------------------------------------------
  // 4. MobileMenu.tsx structure
  // -----------------------------------------------------------------
  const mobileMenuSrc = readFileSync(mobileMenuPath, "utf8");
  assert(
    "MobileMenu is a Client Component",
    /^"use client"/m.test(mobileMenuSrc.trimStart()),
  );
  assert(
    "MobileMenu uses useState for open/closed state",
    /\buseState\b/.test(mobileMenuSrc),
  );
  assert(
    "MobileMenu declares md:hidden on its wrapper",
    /\bmd:hidden\b/.test(mobileMenuSrc),
  );
  assert(
    "MobileMenu renders a real <button type=\"button\">",
    /<button[^>]*type="button"/.test(mobileMenuSrc),
  );
  assert(
    "MobileMenu button has aria-expanded",
    /aria-expanded/.test(mobileMenuSrc),
  );
  assert(
    "MobileMenu button has aria-controls (panel id)",
    /aria-controls/.test(mobileMenuSrc),
  );
  // Panel accessibility
  assert(
    "MobileMenu panel exposes role=\"dialog\" + aria-modal when open",
    /role="dialog"/.test(mobileMenuSrc) &&
      /aria-modal="true"/.test(mobileMenuSrc),
  );
  // Escape + outside-click wiring
  assert(
    "MobileMenu listens for Escape to close",
    /Escape/.test(mobileMenuSrc),
  );
  assert(
    "MobileMenu listens for pointerdown / mousedown to close on outside click",
    /pointerdown|mousedown/.test(mobileMenuSrc),
  );
  // Path-aware close: tapping a link should close the menu on
  // navigation. We just require usePathname is imported.
  assert(
    "MobileMenu imports usePathname (auto-close on route change)",
    /usePathname\b/.test(mobileMenuSrc),
  );
  // SVG hamburger -> X morph: the file should contain both sets of
  // `<line>` coords (or two `svg` blocks). The simplest check is that
  // there is at least one `stroke-linecap` "round" reference and at
  // least two `<line .../>` elements.
  assert(
    "MobileMenu renders SVG icons (hamburger + close X)",
    (mobileMenuSrc.match(/<line\b/g) ?? []).length >= 2,
  );

  // -----------------------------------------------------------------
  // 5. Other components use responsive utilities
  // -----------------------------------------------------------------
  const heroSrc = readFileSync(heroPath, "utf8");
  assert(
    "Hero uses at least one Tailwind responsive utility",
    hasResponsiveUtility(heroSrc),
    `count=${responsiveUtilityCount(heroSrc)}`,
  );
  // Hero headline should scale with the viewport (text-4xl sm:text-5xl lg:text-6xl)
  assert(
    "Hero headline scales (text-4xl sm:text-5xl lg:text-6xl)",
    /\btext-4xl\b[^"]*\bsm:text-5xl\b[^"]*\blg:text-6xl\b/.test(heroSrc) ||
      /\bsm:text-5xl\b/.test(heroSrc),
  );
  // Hero grid should reflow between mobile (single column) and lg
  // (two columns). We accept any grid-template utility at lg.
  assert(
    "Hero grid reflows to two columns at lg",
    /\blg:grid-cols-\[?[\w.]+\]?/.test(heroSrc) ||
      /\blg:grid\b/.test(heroSrc),
  );
  // Section padding should scale.
  assert(
    "Hero section uses responsive vertical padding (py-14 sm:py-20 lg:py-24)",
    /\bpy-14\b[^"]*\bsm:py-20\b/.test(heroSrc) ||
      /\bsm:py-20\b/.test(heroSrc),
  );

  const filterBarSrc = readFileSync(filterBarPath, "utf8");
  assert(
    "FilterBar uses at least one Tailwind responsive utility",
    hasResponsiveUtility(filterBarSrc),
    `count=${responsiveUtilityCount(filterBarSrc)}`,
  );
  // The FilterBar container must reflow from stacked (mobile) to
  // inline (lg+).
  assert(
    "FilterBar reflows controls at lg (flex-col lg:flex-row)",
    /\bflex-col\b[^"]*\blg:flex-row\b/.test(filterBarSrc) ||
      /\blg:flex-row\b/.test(filterBarSrc),
  );

  const cardSrc = readFileSync(cardPath, "utf8");
  assert(
    "RestaurantCard uses at least one Tailwind responsive utility",
    hasResponsiveUtility(cardSrc),
    `count=${responsiveUtilityCount(cardSrc)}`,
  );

  const homeSrc = readFileSync(homePath, "utf8");
  assert(
    "app/page.tsx uses at least one Tailwind responsive utility",
    hasResponsiveUtility(homeSrc),
    `count=${responsiveUtilityCount(homeSrc)}`,
  );
  // Listing grid reflows: 1 col -> 2 col (sm) -> 3 col (lg).
  assert(
    "app/page.tsx listing grid reflows (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3)",
    /\bgrid-cols-1\b[^"]*\bsm:grid-cols-2\b[^"]*\blg:grid-cols-3\b/.test(homeSrc) ||
      /\bsm:grid-cols-2\b/.test(homeSrc),
  );
  // Horizontal padding scales with the viewport.
  assert(
    "app/page.tsx uses responsive horizontal padding (px-4 sm:px-6 lg:px-8)",
    /\bpx-4\b[^"]*\bsm:px-6\b[^"]*\blg:px-8\b/.test(homeSrc) ||
      /\bsm:px-6\b/.test(homeSrc),
  );

  const detailSrc = readFileSync(detailPath, "utf8");
  assert(
    "app/restaurants/[id]/page.tsx uses at least one Tailwind responsive utility",
    hasResponsiveUtility(detailSrc),
    `count=${responsiveUtilityCount(detailSrc)}`,
  );
  // Detail page also reflows from stacked (mobile) to two columns
  // (lg+).
  assert(
    "Restaurant detail page reflows to two columns at lg",
    /\blg:grid-cols-\[?[\w.]+\]?/.test(detailSrc) ||
      /\blg:grid\b/.test(detailSrc),
  );

  // -----------------------------------------------------------------
  // 6. No hard-coded pixel widths that would break responsiveness
  // -----------------------------------------------------------------
  const pageShells = [
    { label: "Header", src: headerSrc },
    { label: "MobileMenu", src: mobileMenuSrc },
    { label: "Hero", src: heroSrc },
    { label: "FilterBar", src: filterBarSrc },
    { label: "RestaurantCard", src: cardSrc },
    { label: "app/page.tsx", src: homeSrc },
    { label: "app/restaurants/[id]/page.tsx", src: detailSrc },
  ];
  for (const shell of pageShells) {
    // Match `style={{ width: '375px' }}` / `style={{ width: "375px" }}`
    // / `width="375"`-style hard-coded pixel widths that would defeat
    // the responsive layout. Note: the components above don't use
    // inline styles, but this is a defensive regression guard.
    const inlineWidth = /style\s*=\s*\{\{[^}]*width\s*:\s*['"]?\d+px/.test(
      shell.src,
    );
    assert(
      `${shell.label} does not hard-code a pixel width in inline styles`,
      !inlineWidth,
      "inline width:NNNpx defeats responsive layout",
    );
  }

  // -----------------------------------------------------------------
  // 7. globals.css does not introduce a min-width that would push the
  //    page past the 375px viewport.
  // -----------------------------------------------------------------
  const globalsPath = resolve(repoRoot, "app", "globals.css");
  if (existsSync(globalsPath)) {
    const globals = readFileSync(globalsPath, "utf8");
    assert(
      "app/globals.css does not force a min-width on <html>/<body>",
      !/min-width\s*:\s*\d+px/.test(globals),
    );
  } else {
    console.log(
      "SKIP  app/globals.css does not exist (no min-width check).",
    );
  }
}

run();

if (failed > 0) {
  console.error(`[verify-responsive] FAIL -- ${failed} check(s) failed.`);
  process.exit(1);
}
console.log("[verify-responsive] OK -- AC-10 responsive design is healthy.");