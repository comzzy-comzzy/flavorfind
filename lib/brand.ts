import type { Config } from "tailwindcss";
import tailwindConfig from "../tailwind.config";

/**
 * Brand palette tokens **derived** from the single source of truth at
 * `tailwind.config.ts`. Do NOT add new hex literals here — extend the
 * Tailwind config's `theme.extend.colors.brand` instead and this module
 * will pick them up automatically.
 *
 * This module exists so non-class consumers (e.g. Next.js viewport
 * `themeColor`, generated OG images, or any runtime CSS) can reference
 * the exact same tokens without ever hard-coding an inline hex string
 * outside the Tailwind config.
 */

// Tailwind's `Config` types `theme.extend.colors` as either a plain
// object or a function returning one. At runtime, our config supplies a
// plain object, so narrow to that branch via a runtime guard.
type BrandRecord = Record<string, string>;

function getBrandRecord(config: Config): BrandRecord {
  const colors = config.theme?.extend?.colors;
  if (!colors) {
    throw new Error(
      "Tailwind config is missing theme.extend.colors; update tailwind.config.ts.",
    );
  }
  // `colors` may be a function in advanced Tailwind configs; in this
  // project it is a plain object literal.
  if (typeof colors === "function") {
    throw new Error(
      "Tailwind config theme.extend.colors is a function; brand.ts only supports a plain object literal.",
    );
  }
  const brand = (colors as Record<string, unknown>).brand;
  if (!brand || typeof brand !== "object") {
    throw new Error(
      "Tailwind config is missing theme.extend.colors.brand; update tailwind.config.ts to add it.",
    );
  }
  return brand as BrandRecord;
}

function readBrandColor<K extends "light" | "dark" | "cream" | "mid" | "accent">(
  key: K,
): string {
  const brand = getBrandRecord(tailwindConfig);
  const value = brand[key];
  if (typeof value !== "string") {
    throw new Error(
      `Tailwind config is missing theme.extend.colors.brand.${key}; ` +
        `update tailwind.config.ts to add it.`,
    );
  }
  return value;
}

export const brandColors = {
  get light(): string {
    return readBrandColor("light");
  },
  get dark(): string {
    return readBrandColor("dark");
  },
  get cream(): string {
    return readBrandColor("cream");
  },
  get mid(): string {
    return readBrandColor("mid");
  },
  get accent(): string {
    return readBrandColor("accent");
  },
} as const;

export type BrandColorKey = keyof typeof brandColors;
