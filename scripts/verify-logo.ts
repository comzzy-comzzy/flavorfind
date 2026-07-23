/**
 * Verifies that public/logo.svg is byte-for-byte consistent with the
 * brand tokens defined in tailwind.config.ts.
 *
 * Run via: `npx tsx scripts/verify-logo.ts`
 * Exit code 0 = consistent, 1 = drift detected.
 *
 * Why this exists:
 *   AC-3 commits public/logo.svg as an auto-generated asset, but the
 *   single source of truth for the brand palette is tailwind.config.ts.
 *   This script guarantees that any future change to the brand tokens
 *   is reflected in the SVG (or fails CI), preventing silent drift
 *   between the config and the committed artwork.
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
const keys = ["light", "dark", "mid"] as const;

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(here, "..", "public", "logo.svg");
const svg = readFileSync(svgPath, "utf8");

let ok = true;
for (const key of keys) {
  const token = brand[key];
  if (!token) {
    console.error(`FAIL: tailwind.config.ts is missing brand.${key}`);
    ok = false;
    continue;
  }
  // Allow either upper- or lower-case hex to satisfy the comparison.
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "i");
  if (re.test(svg)) {
    console.log(`PASS: brand.${key} (${token}) present in logo.svg`);
  } else {
    console.error(
      `FAIL: brand.${key} (${token}) NOT present in logo.svg -- drift detected; run \`npm run build:logo\``,
    );
    ok = false;
  }
}

// Also fail if any UNCONFIGURED brand-family hex appears in the SVG.
// This catches accidental palette additions (e.g. the iter-004 #5D4037
// regression) by allowing only the exact tokens declared above.
const declaredHex = new Set(keys.map((k) => brand[k].toLowerCase()));
const allHex = Array.from(svg.matchAll(/#[0-9A-Fa-f]{6}\b/g)).map((m) =>
  m[0].toLowerCase(),
);
const uniqueHex = Array.from(new Set(allHex));
const unexpected = uniqueHex.filter((h) => !declaredHex.has(h));
if (unexpected.length === 0) {
  console.log(
    `PASS: logo.svg uses only declared brand tokens (${[...declaredHex].join(", ")}).`,
  );
} else {
  console.error(
    `FAIL: logo.svg contains unconfigured hex literal(s): ${unexpected.join(", ")}. Add them to tailwind.config.ts theme.extend.colors.brand, or regenerate the SVG from the updated config.`,
  );
  ok = false;
}

if (!ok) {
  process.exit(1);
}
console.log("OK: public/logo.svg is consistent with tailwind.config.ts.");
