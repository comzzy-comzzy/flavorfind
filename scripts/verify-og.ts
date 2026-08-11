/**
 * Verifies that public/og.png exists, is a valid PNG, and matches the
 * dimensions required by the AC-11 spec (1200 x 630 px, 8-bit RGB).
 *
 * Run via: `npx tsx scripts/verify-og.ts`
 * Exit code 0 = consistent, 1 = drift detected.
 *
 * Why this exists:
 *   AC-11 commits public/og.png as an auto-generated social-card asset.
 *   This script checks the file is the correct size and dimensions so a
 *   future change to the build-og.ts template (or an accidental
 *   overwrite) is caught before it ships.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_WIDTH = 1200;
const EXPECTED_HEIGHT = 630;
const MIN_BYTES = 1024; // sanity floor: a 1200x630 RGB PNG should be >> 1KB

const here = dirname(fileURLToPath(import.meta.url));
const pngPath = resolve(here, "..", "public", "og.png");

let ok = true;

if (!existsSync(pngPath)) {
  console.error(
    `FAIL: ${pngPath} does not exist. Run \`npm run build:og\` to generate the Open Graph image.`,
  );
  process.exit(1);
}

const buf = readFileSync(pngPath);
if (buf.length < MIN_BYTES) {
  console.error(
    `FAIL: public/og.png is only ${buf.length} bytes; expected >= ${MIN_BYTES} for a 1200x630 RGB PNG. The asset may be corrupt -- regenerate via \`npm run build:og\`.`,
  );
  ok = false;
}

// PNG signature: 89 50 4E 47 0D 0A 1A 0A
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const sigMatches = PNG_SIG.every((b, i) => buf[i] === b);
if (!sigMatches) {
  console.error(
    "FAIL: public/og.png does not have a valid PNG signature. The file is not a real PNG -- regenerate via `npm run build:og`.",
  );
  ok = false;
} else {
  console.log("PASS: public/og.png has a valid PNG signature.");
}

// IHDR is always at offset 16 (after 8-byte signature + 4 length + 4 type).
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
const bitDepth = buf[24];
const colorType = buf[25];

if (w === EXPECTED_WIDTH && h === EXPECTED_HEIGHT) {
  console.log(`PASS: public/og.png dimensions are ${w}x${h} (expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}).`);
} else {
  console.error(
    `FAIL: public/og.png dimensions are ${w}x${h}; expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}. Regenerate via \`npm run build:og\`.`,
  );
  ok = false;
}

if (bitDepth === 8) {
  console.log("PASS: public/og.png bit depth is 8.");
} else {
  console.error(`FAIL: public/og.png bit depth is ${bitDepth}; expected 8. Regenerate via \`npm run build:og\`.`);
  ok = false;
}

if (colorType === 2) {
  console.log("PASS: public/og.png color type is RGB (color_type = 2).");
} else {
  console.error(
    `FAIL: public/og.png color type is ${colorType}; expected 2 (RGB). Regenerate via \`npm run build:og\`.`,
  );
  ok = false;
}

if (!ok) {
  process.exit(1);
}
console.log("OK: public/og.png is consistent with the AC-11 spec.");