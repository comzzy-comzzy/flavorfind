// credit: Hero photograph "Nigerian chef preparing a meal in Lagos" by
// credit: Tope A. Asokere, hosted on Unsplash (free to use under the
// credit: Unsplash License — https://unsplash.com/license).
// credit: Source page: https://unsplash.com/photos/8f129e1688ce
// credit: Direct file URL used by this component:
// credit:   https://images.unsplash.com/photo-1531746020798-e6953c6e8e04

/**
 * Hero block rendered on the home page.
 *
 * Per AC-4:
 *   - Ankara/Adire-inspired SVG pattern is applied as a CSS background
 *     via the `bg-ankara-pattern` utility (which Tailwind resolves to
 *     `url('/patterns/ankara.svg')` — see tailwind.config.ts).
 *   - Hero image is a real Unsplash photograph of happy Nigerians; the
 *     photographer is credited in the `// credit:` comment block at the
 *     top of this file and on-screen in the caption strip below the
 *     photograph.
 *   - Headline, sub-headline, and the primary CTA "Find a Restaurant"
 *     are visible above the fold at the 375 / 768 / 1280 px breakpoints
 *     called out in AC-10. Headline + CTA sit in the first column on
 *     desktop and stack above the image on mobile.
 *
 * The CTA currently points at `/#restaurants`; the listings section with
 * id="restaurants" lands in the AC-8 iteration, at which point the
 * anchor becomes a real target.
 */
export default function Hero() {
  return (
    <section
      aria-labelledby="hero-headline"
      className="relative isolate overflow-hidden border-b border-brand-accent/40 bg-brand-cream bg-ankara-pattern bg-[length:160px_160px] py-14 sm:py-20 lg:py-24"
    >
      {/* Cream wash keeps the headline legible over the patterned ground. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-cream/90 via-brand-cream/75 to-brand-cream/60"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8">
        {/* Headline + CTA column. Stays above the fold on mobile. */}
        <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-mid">
            Eat &middot; Nigeria
          </p>
          <h1
            id="hero-headline"
            className="font-display text-4xl font-bold leading-tight text-brand-dark sm:text-5xl lg:text-6xl"
          >
            Find Nigeria&rsquo;s best restaurants, one plate at a time.
          </h1>
          <p className="max-w-xl text-base text-brand-mid sm:text-lg">
            Live picks from Lagos, Abuja, Port Harcourt and beyond &mdash;
            ranked by budget, location, and what real diners are saying.
          </p>
          <a
            href="/#restaurants"
            className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-6 py-3 text-base font-semibold text-brand-cream shadow-sm transition-colors hover:bg-brand-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-cream"
          >
            Find a Restaurant
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        {/* Hero photograph. Caption credits the photographer (also in the
            header comment block). */}
        <div className="relative">
          <figure className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl border-4 border-brand-cream shadow-xl ring-1 ring-brand-dark/20 sm:aspect-[5/4] lg:max-w-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=900&q=80"
              alt="A Nigerian chef smiling while preparing a meal in a sunlit kitchen in Lagos."
              loading="eager"
              className="h-full w-full object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-dark/85 via-brand-dark/45 to-transparent px-4 py-3 text-xs text-brand-cream">
              Photo: Tope A. Asokere via Unsplash
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}