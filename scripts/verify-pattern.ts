/**
 * Verifies that public/patterns/ankara.svg is consistent with the
 * brand tokens defined in tailwind.config.ts.
 *
 * Run via: `npx tsx scripts/verify-pattern.ts`
 * Exit code 0 = consistent, 1 = drift detected.
 *
 * Why this exists:
 *   AC-4 commits public/patterns/ankara.svg as an auto-generated asset,
 *   but the single source of truth for the brand palette is
 *   tailwind.config.ts. This script guarantees that any future change to
 *   the brand tokens is reflected in the SVG (or fails CI), preventing
 *   silent drift between the config and the committed artwork.
 *
 *   What "consistent" means here:
 *     - Every brand token declared in tailwind.config.ts is present in
 *       the SVG (so the pattern really is drawn from the brand palette).
 *     - Every hex literal in the SVG matches a declared brand token
 *       (so the pattern does not introduce any unconfigured color).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindConfig from "../tailwind.config";

type TailwindConfig = {
  theme?: { extend?: { colors?: Record<string, unknown> } };
};

function readBrand(config: TailwindConfig): Record<string, string> {
  const colors = config.theme?.extend?.colors;
  if (!colors || typeof colors !== "object") {
    throw new Error("tailwind.config.ts is missing theme.extend.colors");
  }
  const brand = (colors as Record<string, unknown>).brand;
  if (!brand || typeof brand !== "object") {
    throw new Error("tailwind.config.ts is missing theme.extend.colors.brand");
  }
  return brand as Record<string, string>;
}

const brand = readBrand(tailwindConfig as TailwindConfig);
const keys = ["light", "dark", "mid", "cream", "accent"] as const;

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(here, "..", "public", "patterns", "ankara.svg");
const svg = readFileSync(svgPath, "utf8");

let ok = true;

// 1. Every declared brand token must appear in the SVG.
for (const key of keys) {
  const token = brand[key];
  if (!token) {
    console.error(`FAIL: tailwind.config.ts is missing brand.${key}`);
    ok = false;
    continue;
  }
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "i");
  if (re.test(svg)) {
    console.log(`PASS: brand.${key} (${token}) present in ankara.svg`);
  } else {
    console.error(
      `FAIL: brand.${key} (${token}) NOT present in ankara.svg -- drift detected; run \`npm run build:pattern\``,
    );
    ok = false;
  }
}

// 2. Every hex literal in the SVG must be a declared brand token.
//    This blocks any unconfigured palette additions.
const declaredHex = new Set(keys.map((k) => brand[k].toLowerCase()));
const allHex = Array.from(svg.matchAll(/#[0-9A-Fa-f]{6}\b/g)).map((m) =>
  m[0].toLowerCase(),
);
const uniqueHex = Array.from(new Set(allHex));
const unexpected = uniqueHex.filter((h) => !declaredHex.has(h));
if (unexpected.length === 0) {
  console.log(
    `PASS: ankara.svg uses only declared brand tokens (${[...declaredHex].join(", ")}).`,
  );
} else {
  console.error(
    `FAIL: ankara.svg contains unconfigured hex literal(s): ${unexpected.join(", ")}. Add them to tailwind.config.ts theme.extend.colors.brand, or regenerate the SVG from the updated config.`,
  );
  ok = false;
}

if (!ok) {
  process.exit(1);
}
console.log("OK: public/patterns/ankara.svg is consistent with tailwind.config.ts.");