import Link from "next/link";

import MobileMenu from "@/components/MobileMenu";

/**
 * Site-wide header rendered on every page via `app/layout.tsx`.
 *
 * Per AC-3, the FlavorFind wordmark + bowl/spoon glyph (drawn in
 * `public/logo.svg`) is rendered here as an `<img>` tag with the
 * required alt text. Using `<img>` (rather than `next/image`) keeps the
 * static-export path simple and avoids needing to whitelist the
 * self-hosted SVG in `next.config.mjs` `remotePatterns`.
 *
 * Per AC-10, the header collapses to a hamburger menu on mobile:
 *   - The desktop primary nav (`<nav>` with `Home` link) is hidden
 *     below the `md` Tailwind breakpoint (768px) via `hidden md:flex`.
 *   - The `MobileMenu` hamburger is hidden from `md` and up via the
 *     inner `md:hidden` wrapper. So at 375px only the hamburger is
 *     visible, at 768px+ only the inline nav is visible, and at 1280px
 *     the layout has the same wide inline nav.
 *   - The header container itself is `relative` so the absolutely
 *     positioned mobile menu panel anchors directly beneath it.
 */
export default function Header() {
  return (
    <header className="relative border-b border-brand-accent/40 bg-brand-cream/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="FlavorFind home"
          className="inline-flex items-center"
        >
          {/* AC-3 mandates the literal `<img src="/logo.svg" alt="FlavorFind logo" />` tag. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="FlavorFind logo"
            className="h-10 w-auto sm:h-12 md:h-14"
          />
        </Link>
        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 text-sm font-medium text-brand-dark md:flex"
        >
          <Link
            href="/"
            className="rounded-md px-2 py-1 transition-colors hover:text-brand-light focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
          >
            Home
          </Link>
        </nav>
        <MobileMenu />
      </div>
    </header>
  );
}
