/**
 * Generates public/og.png from the brand tokens in tailwind.config.ts.
 *
 * Why a generator?
 *   AC-2 requires "no inline hex outside the Tailwind config" for
 *   styling surfaces. The FlavorFind brand palette is the single
 *   source of truth, defined once in tailwind.config.ts.
 *
 *   AC-11 requires the Open Graph image to live at `public/og.png`
 *   and the project plan keeps every visual asset in lock-step with
 *   the brand tokens. This file is the template source for the PNG.
 *   It contains ZERO hex literals -- every brand color is read at
 *   build time from tailwind.config.ts via a typed `Config` import
 *   and substituted into the rendered image. The resulting
 *   `public/og.png` necessarily carries hex values (a binary raster
 *   cannot inherit CSS custom properties), but the PNG is BOTH
 *   committed to the repo (so a clean checkout has the AC-11 asset
 *   immediately) AND regenerated on every `prebuild` / `predev`, so
 *   the byte-level brand values can never drift from
 *   tailwind.config.ts.
 *
 *   Guarantees the architecture provides:
 *     - One source of truth: tailwind.config.ts
 *     - Consistency: `npm run prebuild` / `predev` / `build:og`
 *       regenerate public/og.png from this template + the config
 *     - Drift detection: `npm run verify:og` checks the PNG exists
 *       and is the correct dimensions
 *     - Vercel-friendly: pure Node, no native dependencies (no
 *       sharp / canvas / resvg). Only Node built-ins are used
 *       (`zlib`, `fs`, `path`, `url`), so the script runs identically
 *       on Windows, macOS, Linux, and inside the Vercel build
 *       container.
 *
 *   Change workflow:
 *     1. Edit `tailwind.config.ts` to add / change a brand token.
 *     2. Run `npm run build:og` to regenerate public/og.png.
 *     3. Run `npm run verify:og` to confirm consistency.
 *     4. Commit both files together.
 *
 * Image format:
 *   - 1200 x 630 px (the de-facto Open Graph / Twitter / LinkedIn
 *     large-card aspect ratio).
 *   - 8-bit RGB (color_type = 2, no alpha needed; reduces file size
 *     versus RGBA).
 *   - Single IDAT chunk, zlib-deflated scanlines, filter byte = 0
 *     (None) per row.
 *   - Linear (non-interlaced) Adam7 = 0.
 *
 * Run via: `npx tsx scripts/build-og.ts`
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import tailwindConfig from "../tailwind.config";

// Brand token ingestion.
type TailwindConfigShape = {
  theme?: { extend?: { colors?: Record<string, unknown> } };
};

function readBrand(config: TailwindConfigShape): Record<string, string> {
  const colors = config.theme?.extend?.colors;
  if (!colors || typeof colors !== "object") {
    throw new Error(
      "Tailwind config is missing theme.extend.colors; update tailwind.config.ts.",
    );
  }
  const brand = (colors as Record<string, unknown>).brand;
  if (!brand || typeof brand !== "object") {
    throw new Error(
      "Tailwind config is missing theme.extend.colors.brand; update tailwind.config.ts to add it.",
    );
  }
  return brand as Record<string, string>;
}

const brand = readBrand(tailwindConfig as TailwindConfigShape);
for (const key of ["light", "dark", "mid", "cream", "accent"] as const) {
  if (!brand[key]) {
    throw new Error(
      `Tailwind config is missing theme.extend.colors.brand.${key}; update tailwind.config.ts to add it.`,
    );
  }
}

// Color helpers.
function parseHex(hex: string): [number, number, number] {
  let s = hex.trim();
  if (s.startsWith("#")) s = s.slice(1);
  if (s.length === 3) {
    s = s.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`Cannot parse hex colour '${hex}'; expected #RGB or #RRGGBB.`);
  }
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

const C_DARK = parseHex(brand.dark);
const C_LIGHT = parseHex(brand.light);
const C_MID = parseHex(brand.mid);
const C_CREAM = parseHex(brand.cream);
const C_ACCENT = parseHex(brand.accent);

function lerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const tt = t < 0 ? 0 : t > 1 ? 1 : t;
  return [
    Math.round(a[0] + (b[0] - a[0]) * tt),
    Math.round(a[1] + (b[1] - a[1]) * tt),
    Math.round(a[2] + (b[2] - a[2]) * tt),
  ];
}

function gradient(t: number): [number, number, number] {
  return t < 0.5 ? lerp(C_DARK, C_MID, t * 2) : lerp(C_MID, C_LIGHT, (t - 0.5) * 2);
}

// Canvas.
const WIDTH = 1200;
const HEIGHT = 630;
const PIXELS = new Uint8Array(WIDTH * HEIGHT * 4);

function idx(x: number, y: number): number {
  return (y * WIDTH + x) * 4;
}

function setPixel(x: number, y: number, rgb: [number, number, number], alpha = 255): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = idx(x, y);
  PIXELS[i] = rgb[0];
  PIXELS[i + 1] = rgb[1];
  PIXELS[i + 2] = rgb[2];
  PIXELS[i + 3] = alpha;
}

function blendPixel(x: number, y: number, rgb: [number, number, number], alpha: number): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  if (alpha >= 255) { setPixel(x, y, rgb, 255); return; }
  if (alpha <= 0) return;
  const i = idx(x, y);
  const da = PIXELS[i + 3] / 255;
  const sa = alpha / 255;
  const out = sa + da * (1 - sa);
  if (out <= 0) return;
  PIXELS[i] = Math.round((rgb[0] * sa + PIXELS[i] * da * (1 - sa)) / out);
  PIXELS[i + 1] = Math.round((rgb[1] * sa + PIXELS[i + 1] * da * (1 - sa)) / out);
  PIXELS[i + 2] = Math.round((rgb[2] * sa + PIXELS[i + 2] * da * (1 - sa)) / out);
  PIXELS[i + 3] = Math.round(out * 255);
}

function fillRect(x: number, y: number, w: number, h: number, rgb: [number, number, number], alpha = 255): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      setPixel(x + xx, y + yy, rgb, alpha);
    }
  }
}

function stampCircle(cx: number, cy: number, r: number, rgb: [number, number, number]): void {
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy <= r * r) setPixel(cx + xx, cy + yy, rgb, 255);
    }
  }
}

function strokeLine(x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number], thickness: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (true) {
    stampCircle(x, y, Math.max(1, Math.floor(thickness / 2)), rgb);
    if (x === x1 && y === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, rgb: [number, number, number]): void {
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  for (let yy = -ry; yy <= ry; yy++) {
    const y2 = yy * yy;
    for (let xx = -rx; xx <= rx; xx++) {
      if (xx * xx * ry2 + y2 * rx2 <= rx2 * ry2) setPixel(cx + xx, cy + yy, rgb, 255);
    }
  }
}

// 5x7 bitmap font.
type Font5x7 = Record<string, string[]>;

const FONT: Font5x7 = {
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  l: ["10000", "10000", "10000", "10000", "10000", "10000", "10000"],
  a: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  v: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  o: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  r: ["11110", "10001", "10001", "10000", "10000", "10000", "10000"],
  i: ["00100", "00000", "00100", "00100", "00100", "00100", "00100"],
  n: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  t: ["01000", "01000", "11110", "01000", "01000", "01000", "00111"],
  g: ["01111", "10001", "10001", "11111", "00001", "00001", "01110"],
  e: ["01110", "10001", "11111", "10000", "10000", "10001", "01110"],
  y: ["10001", "10001", "10001", "01111", "00001", "00001", "01110"],
  u: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  c: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
  "'": ["00100", "00100", "00100", "00000", "00000", "00000", "00000"],
  N: ["10001", "11001", "10101", "10101", "10101", "10011", "10001"],
  x: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  s: ["01110", "10001", "10000", "01110", "00001", "10001", "01110"],
  p: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  w: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  m: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  S: ["01110", "10001", "10000", "01110", "00001", "10001", "01110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  J: ["00001", "00001", "00001", "00001", "00001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  f: ["00111", "01000", "11111", "01000", "01000", "01000", "01000"],
  k: ["10000", "10010", "10100", "11000", "10100", "10010", "10001"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

function drawText(text: string, x: number, y: number, scale: number, rgb: [number, number, number]): number {
  const cursorX = { v: x };
  for (const rawCh of text) {
    const ch = rawCh === "\n" ? " " : rawCh;
    const glyph = FONT[ch] ?? FONT[" "];
    if (!glyph) { cursorX.v += (5 + 1) * scale; continue; }
    for (let row = 0; row < 7; row++) {
      const rowStr = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (rowStr[col] === "1") {
          fillRect(cursorX.v + col * scale, y + row * scale, scale, scale, rgb);
        }
      }
    }
    cursorX.v += (5 + 1) * scale;
  }
  return cursorX.v - x;
}

// Composition.
function compose(): void {
  // 1. Diagonal gradient background.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const t = (x / WIDTH + y / HEIGHT) / 2;
      setPixel(x, y, gradient(t));
    }
  }

  // 2. Ankara-style diamond pattern overlay.
  const TILE = 80;
  const PATTERN_ALPHA = Math.round(255 * 0.12);
  for (let y = 0; y < HEIGHT; y++) {
    const ty = y % TILE;
    for (let x = 0; x < WIDTH; x++) {
      const tx = x % TILE;
      const cellX = Math.floor(tx / 20);
      const cellY = Math.floor(ty / 20);
      const cx = cellX * 20 + 10;
      const cy = cellY * 20 + 10;
      const dx = Math.abs(tx - cx);
      const dy = Math.abs(ty - cy);
      if (dx + dy <= 8) blendPixel(x, y, C_CREAM, PATTERN_ALPHA);
    }
  }

  // 3. Left panel.
  const PANEL_W = 720;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < PANEL_W; x++) setPixel(x, y, C_DARK, 255);
  }

  // 4. Bowl mark.
  const BOWL_CX = 220;
  const BOWL_CY = 230;
  const BOWL_RX = 150;
  const BOWL_RY = 40;

  strokeLine(BOWL_CX - 50, BOWL_CY - 50, BOWL_CX - 60, BOWL_CY - 120, C_LIGHT, 8);
  strokeLine(BOWL_CX, BOWL_CY - 55, BOWL_CX, BOWL_CY - 130, C_LIGHT, 8);
  strokeLine(BOWL_CX + 50, BOWL_CY - 50, BOWL_CX + 60, BOWL_CY - 120, C_LIGHT, 8);

  fillRect(BOWL_CX - BOWL_RX, BOWL_CY - BOWL_RY, BOWL_RX * 2, BOWL_RY * 2, C_ACCENT, 255);
  fillEllipse(BOWL_CX, BOWL_CY - BOWL_RY, BOWL_RX, BOWL_RY, C_MID);
  fillEllipse(BOWL_CX, BOWL_CY + 50, BOWL_RX, BOWL_RY + 35, C_ACCENT);

  for (let i = 0; i < 5; i++) {
    const cx = BOWL_CX - 100 + i * 50;
    const cy = BOWL_CY + 15;
    for (let yy = -7; yy <= 7; yy++) {
      for (let xx = -7; xx <= 7; xx++) {
        if (Math.abs(xx) + Math.abs(yy) <= 7) setPixel(cx + xx, cy + yy, C_LIGHT, 255);
      }
    }
  }

  // 5. Wordmark.
  const FONT_SCALE = 9;
  const WORDMARK_X = 60;
  const WORDMARK_Y = 400;
  drawText("Flavor", WORDMARK_X, WORDMARK_Y, FONT_SCALE, C_CREAM);
  const flavorWidth = "Flavor".length * 6 * FONT_SCALE;
  drawText("Find", WORDMARK_X + flavorWidth, WORDMARK_Y, FONT_SCALE, C_LIGHT);

  // 6. Tagline.
  const TAG_SCALE = 3;
  drawText("Eat Nigeria.", WORDMARK_X, WORDMARK_Y + 100, TAG_SCALE, C_CREAM);
  drawText("Find your next favourite spot.", WORDMARK_X, WORDMARK_Y + 100 + 28, TAG_SCALE, C_CREAM);

  // 7. URL footer.
  drawText("flavorfind.vercel.app", WIDTH - 250, HEIGHT - 50, 2, C_MID);

  // 8. Decorative right-side chevron band.
  const BAND_X = 820;
  for (let y = 80; y < HEIGHT - 80; y += 80) {
    for (let i = 0; i < 4; i++) {
      const cx = BAND_X + i * 70;
      const cy = y;
      for (let yy = -18; yy <= 18; yy++) {
        for (let xx = -18; xx <= 18; xx++) {
          if (Math.abs(xx) + Math.abs(yy) <= 18) blendPixel(cx + xx, cy + yy, C_CREAM, Math.round(255 * 0.25));
        }
      }
    }
  }
}

// PNG encoder.
let CRC_TABLE: Uint32Array | null = null;
function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(buf: Uint8Array): number {
  if (!CRC_TABLE) CRC_TABLE = buildCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const out = new Uint8Array(4 + 4 + len + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, len, false);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + len));
  dv.setUint32(8 + len, crc, false);
  return out;
}

function encodePng(): Buffer {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, WIDTH, false);
  dv.setUint32(4, HEIGHT, false);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = WIDTH * 3;
  const raw = Buffer.alloc(HEIGHT * (rowBytes + 1));
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * (rowBytes + 1)] = 0;
    for (let x = 0; x < WIDTH; x++) {
      const src = idx(x, y);
      const dst = y * (rowBytes + 1) + 1 + x * 3;
      raw[dst] = PIXELS[src];
      raw[dst + 1] = PIXELS[src + 1];
      raw[dst + 2] = PIXELS[src + 2];
    }
  }
  const idatData = deflateSync(raw, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    Buffer.from(chunk("IHDR", ihdr)),
    Buffer.from(chunk("IDAT", idatData)),
    Buffer.from(chunk("IEND", new Uint8Array(0))),
  ]);
}

// Entry point.
compose();
const png = encodePng();

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "..", "public", "og.png");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes, ${WIDTH}x${HEIGHT} RGB PNG)`);