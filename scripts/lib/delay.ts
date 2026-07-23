/**
 * Rate-limit helper -- sleeps for `ms` milliseconds.
 *
 * Why a dedicated helper?
 *   - Standardises the delay window across all source adapters (plan
 *     risk-control: "include a 1s delay between requests").
 *   - Lets the verify script stub the delay in tests without monkey-
 *     patching `setTimeout` globally.
 *   - Keeps `scripts/scrape.ts` free of `setTimeout` boilerplate.
 *
 * Returns a Promise<void> so callers can `await` it inside async
 * adapters without nesting callbacks.
 */
export function delay(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}