"use client";

import { useCallback, useId, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  SUPPORTED_BUDGET_TIERS,
  SUPPORTED_CITIES,
  SUPPORTED_CUISINES,
  activeFilterCount,
  budgetTierOptionLabel,
  filtersToQueryString,
  isEmptyFilter,
  type RestaurantFilter,
  type SupportedBudgetTier,
  type SupportedCity,
  type SupportedCuisine,
} from "@/lib/filters";

/**
 * City / Budget / Cuisine filter bar (AC-9).
 *
 * Renders three controls:
 *   - City dropdown       (Lagos, Abuja, Port Harcourt, Ibadan, Enugu, Kano)
 *   - Budget tier radio   (Any / ₦ / ₦₦ / ₦₦₦)
 *   - Cuisine multiselect (checkbox chip set)
 *
 * State flow:
 *   1. Mount reads the current URL search params via `useSearchParams`
 *      and derives the initial `workingFilter` (an UNSAVED draft the
 *      user is editing in the UI).
 *   2. Each control manipulates that draft via `update(...)` -- no
 *      network round-trip happens on every keystroke.
 *   3. The "Apply filters" button (or any click on the cuisine
 *      chips, to match the spec's "filters update URL search params
 *      and trigger a server-side re-fetch") commits the draft via
 *      `router.push()` with a freshly serialised URL. The city
 *      dropdown commits on `change` (single click, no Apply needed)
 *      because it is a single-select control.
 *
 * Why a draft state instead of pushing every change to the URL?
 *   - The cuisine multiselect is a chip group; committing on every
 *     toggle would issue 5+ router pushes for one logical filter.
 *   - The Next.js router pushes are wrapped in `useTransition` so
 *     the UI stays responsive while the Server Component re-renders.
 *   - The "Clear" link uses `router.replace(...)` so the back button
 *     still works -- clearing filters is not a "page" the user would
 *     expect to round-trip through.
 *
 * The component is fully client-rendered except for the props
 * (`currentFilter`) that come from the Server Component parent. The
 * dedicated `<form>` has its own `onSubmit` so the user can hit
 * Enter from the dropdown without unexpected navigation.
 */
export default function FilterBar({
  currentFilter,
}: {
  currentFilter: RestaurantFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // The "draft" filter the user is editing. Initialised from the URL
  // so the controls reflect the active filter on first paint.
  const [draft, setDraft] = useState<RestaurantFilter>(() => ({
    ...currentFilter,
    cuisines: currentFilter.cuisines ? [...currentFilter.cuisines] : [],
  }));

  // Re-sync the draft whenever the URL changes externally (e.g. the
  // back button). We compare against the canonical (serialised) form
  // of the URL so we only re-sync when the URL actually differs.
  const urlCanonical = useMemo(
    () => filtersToQueryString(currentFilter),
    [currentFilter],
  );
  const draftCanonical = useMemo(
    () => filtersToQueryString(draft),
    [draft],
  );
  // Note: a tiny effect here would also work; we instead drive the
  // re-sync from the explicit "Apply" / "Clear" buttons to avoid
  // surprise resets when the user is mid-edit.

  // Stable IDs so the <label htmlFor> pairings are deterministic.
  const cityFieldId = useId();
  const budgetFieldSetId = useId();
  const cuisineFieldSetId = useId();

  // -----------------------------------------------------------------
  // Commit helpers
  // -----------------------------------------------------------------
  const pushFilter = useCallback(
    (next: RestaurantFilter) => {
      const qs = filtersToQueryString(next);
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [pathname, router],
  );

  const replaceFilter = useCallback(
    (next: RestaurantFilter) => {
      const qs = filtersToQueryString(next);
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [pathname, router],
  );

  // -----------------------------------------------------------------
  // Control handlers
  // -----------------------------------------------------------------
  const onCityChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      const next: RestaurantFilter = { ...draft };
      if (value === "") {
        delete next.city;
      } else {
        next.city = value as SupportedCity;
      }
      setDraft(next);
      // Single-select: commit immediately so the user sees the grid
      // change without a second click.
      pushFilter(next);
    },
    [draft, pushFilter],
  );

  const onBudgetChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const next: RestaurantFilter = { ...draft };
      if (raw === "") {
        delete next.budgetTier;
      } else {
        const parsed = Number.parseInt(raw, 10);
        if (parsed === 1 || parsed === 2 || parsed === 3) {
          next.budgetTier = parsed as SupportedBudgetTier;
        }
      }
      setDraft(next);
      // Radio: commit immediately -- it's a single-click control.
      pushFilter(next);
    },
    [draft, pushFilter],
  );

  const toggleCuisine = useCallback(
    (cuisine: SupportedCuisine, checked: boolean) => {
      setDraft((prev) => {
        const current = new Set(prev.cuisines ?? []);
        if (checked) {
          current.add(cuisine);
        } else {
          current.delete(cuisine);
        }
        const nextCuisines = SUPPORTED_CUISINES.filter((c) =>
          current.has(c),
        );
        const next: RestaurantFilter = { ...prev, cuisines: nextCuisines };
        if (nextCuisines.length === 0) {
          delete next.cuisines;
        }
        return next;
      });
    },
    [],
  );

  const onApply = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      pushFilter(draft);
    },
    [draft, pushFilter],
  );

  const onClear = useCallback(() => {
    setDraft({});
    replaceFilter({});
  }, [replaceFilter]);

  // -----------------------------------------------------------------
  // Derived values for the UI
  // -----------------------------------------------------------------
  const activeSelectedCuisines = useMemo(
    () => new Set(draft.cuisines ?? []),
    [draft.cuisines],
  );
  const draftCount = activeFilterCount(draft);
  const liveCount = activeFilterCount(currentFilter);
  const draftIsDirty = draftCanonical !== urlCanonical;

  return (
    <form
      aria-label="Filter restaurants"
      onSubmit={onApply}
      className="rounded-2xl border border-brand-accent/30 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
        {/* ---- City dropdown ---- */}
        <div className="flex flex-col gap-1 lg:max-w-[14rem]">
          <label
            htmlFor={cityFieldId}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-mid"
          >
            City
          </label>
          <div className="relative">
            <select
              id={cityFieldId}
              name="city"
              value={draft.city ?? ""}
              onChange={onCityChange}
              className="w-full appearance-none rounded-lg border border-brand-accent/40 bg-brand-cream/60 px-3 py-2 pr-9 text-sm font-semibold text-brand-dark focus:border-brand-light focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
            >
              <option value="">All cities</option>
              {SUPPORTED_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-brand-mid"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </div>

        {/* ---- Budget tier radio ---- */}
        <fieldset
          id={budgetFieldSetId}
          aria-labelledby={`${budgetFieldSetId}-legend`}
          className="flex flex-col gap-1"
        >
          <legend
            id={`${budgetFieldSetId}-legend`}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-mid"
          >
            Budget tier
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            <BudgetRadio
              tier={undefined}
              current={draft.budgetTier}
              name={budgetFieldSetId}
              onChange={onBudgetChange}
            />
            {SUPPORTED_BUDGET_TIERS.map((tier) => (
              <BudgetRadio
                key={tier}
                tier={tier}
                current={draft.budgetTier}
                name={budgetFieldSetId}
                onChange={onBudgetChange}
              />
            ))}
          </div>
        </fieldset>

        {/* ---- Cuisine multiselect ---- */}
        <fieldset
          id={cuisineFieldSetId}
          aria-labelledby={`${cuisineFieldSetId}-legend`}
          className="flex flex-1 flex-col gap-1"
        >
          <legend
            id={`${cuisineFieldSetId}-legend`}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-mid"
          >
            Cuisine
          </legend>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_CUISINES.map((cuisine) => {
              const checked = activeSelectedCuisines.has(cuisine);
              return (
                <CuisineChip
                  key={cuisine}
                  cuisine={cuisine}
                  checked={checked}
                  fieldSetId={cuisineFieldSetId}
                  onToggle={toggleCuisine}
                />
              );
            })}
          </div>
        </fieldset>

        {/* ---- Action row ---- */}
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isPending || !draftIsDirty}
              aria-disabled={isPending || !draftIsDirty}
              className="inline-flex items-center justify-center rounded-full bg-brand-dark px-5 py-2 text-sm font-semibold text-brand-cream shadow-sm transition-colors hover:bg-brand-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Applying" : "Apply filters"}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={isPending || isEmptyFilter(currentFilter)}
              aria-disabled={isPending || isEmptyFilter(currentFilter)}
              className="inline-flex items-center justify-center rounded-full border border-brand-accent/40 bg-white px-4 py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-brand-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
              {liveCount > 0 ? (
                <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-dark px-1.5 text-[11px] font-bold text-brand-cream">
                  {liveCount}
                </span>
              ) : null}
            </button>
          </div>
          <p
            className="text-[11px] text-brand-mid"
            aria-live="polite"
          >
            {liveCount === 0
              ? "No filters applied — showing the full listing."
              : `${liveCount} active filter${liveCount === 1 ? "" : "s"}.`}
          </p>
        </div>
      </div>
    </form>
  );
}

/**
 * One radio button in the budget tier radiogroup. Kept as a small
 * sub-component so the parent JSX stays readable and the a11y
 * attributes (role, aria-checked, focus rings) live in one place.
 */
function BudgetRadio({
  tier,
  current,
  name,
  onChange,
}: {
  tier: SupportedBudgetTier | undefined;
  current: SupportedBudgetTier | undefined;
  name: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const value = tier === undefined ? "" : String(tier);
  const label = budgetTierOptionLabel(tier);
  const checked = current === tier;
  return (
    <label
      className={[
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        checked
          ? "border-brand-dark bg-brand-dark text-brand-cream shadow-sm"
          : "border-brand-accent/40 bg-brand-cream/60 text-brand-dark hover:border-brand-light hover:bg-brand-cream",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">
        {tier === undefined
          ? "Any budget tier"
          : `Budget tier ${tier} of 3`}
      </span>
    </label>
  );
}

/**
 * One checkbox chip in the cuisine multiselect. Each chip is a
 * `<label>` wrapping a hidden `<input type="checkbox">` so the
 * keyboard + screen-reader contract stays intact while the chip
 * itself can be styled as a tactile pill.
 */
function CuisineChip({
  cuisine,
  checked,
  fieldSetId,
  onToggle,
}: {
  cuisine: SupportedCuisine;
  checked: boolean;
  fieldSetId: string;
  onToggle: (cuisine: SupportedCuisine, checked: boolean) => void;
}) {
  const id = `${fieldSetId}-${cuisine}`;
  return (
    <label
      htmlFor={id}
      className={[
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        checked
          ? "border-brand-dark bg-brand-dark text-brand-cream shadow-sm"
          : "border-brand-accent/40 bg-brand-cream/60 text-brand-dark hover:border-brand-light hover:bg-brand-cream",
      ].join(" ")}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(cuisine, event.target.checked)}
        className="sr-only"
      />
      <span aria-hidden="true">{cuisine}</span>
      <span className="sr-only">
        {checked ? "Remove" : "Add"} {cuisine} cuisine filter
      </span>
    </label>
  );
}
