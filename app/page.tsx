import Hero from "@/components/Hero";

/**
 * Home page (AC-4).
 *
 * Renders the African-themed Hero immediately under the site Header.
 * An empty `#restaurants` anchor placeholder sits below the hero so that
 * the Hero's "Find a Restaurant" CTA already has a valid target; AC-8
 * will fill this anchor with the real listings grid.
 */
export default function HomePage() {
  return (
    <main>
      <Hero />
      {/* AC-8 will render the restaurant listings grid here. */}
      <section
        id="restaurants"
        aria-label="Restaurant listings"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8"
      >
        {/* Intentionally empty in this iteration — placeholder anchor only. */}
      </section>
    </main>
  );
}