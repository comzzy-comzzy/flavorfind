"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Site-wide mobile navigation menu (AC-10).
 *
 * Renders a hamburger button on small screens. Tapping the button
 * toggles a slide-down panel with the same primary navigation links
 * the desktop `Header` exposes. On `md` and up the button is hidden
 * via `md:hidden` so the desktop nav remains the canonical surface
 * for those viewports.
 *
 * Behaviour:
 *   - Button is a real `<button type="button">` with `aria-expanded`
 *     and `aria-controls` so screen readers announce the open/closed
 *     state and the controlled panel id.
 *   - Menu panel uses `role="dialog"` with `aria-modal="true"` when
 *     open and is wired to `aria-labelledby` of the hamburger for
 *     assistive tech.
 *   - The hamburger icon morphs into a close (X) icon when the panel
 *     is open so the affordance is visible without reading screen
 *     reader text.
 *   - Pressing Escape, clicking outside, or navigating to a new route
 *     closes the panel.
 *   - The panel moves focus to the first link on open; Escape
 *     restores focus to the hamburger button.
 *   - The component is fully client-rendered; the parent `Header`
 *     passes nothing, the menu owns its own state and reads the
 *     current pathname via `usePathname` so the active link can be
 *     highlighted.
 */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const buttonId = useId();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape; close on outside click.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (
        target &&
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  // Auto-close on route change so the panel does not linger across
  // navigations.
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Move focus into the panel when it opens so keyboard users land
  // somewhere sensible. (Restored to the button on Escape above.)
  useEffect(() => {
    if (open && panelRef.current) {
      const firstLink =
        panelRef.current.querySelector<HTMLAnchorElement>("a[href]");
      firstLink?.focus();
    }
  }, [open]);

  const links: Array<{ href: string; label: string }> = [
    { href: "/", label: "Home" },
  ];

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center border border-brand-dark/25 bg-transparent text-brand-dark transition-colors hover:border-brand-accent hover:text-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
      >
        <span aria-hidden="true" className="sr-only">
          {open ? "Close menu" : "Open menu"}
        </span>
        {open ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        )}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={buttonId}
          className="absolute inset-x-0 top-full z-30 border-y border-brand-dark/20 bg-brand-paper p-5 shadow-xl"
        >
          <nav aria-label="Mobile primary">
            <ul className="flex flex-col gap-1 text-base font-semibold text-brand-dark">
              {links.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "block rounded-lg px-3 py-2 transition-colors",
                        active
                          ? "bg-brand-dark text-brand-cream"
                          : "hover:bg-brand-light/30 focus:bg-brand-light/30 focus:outline-none",
                      ].join(" ")}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
