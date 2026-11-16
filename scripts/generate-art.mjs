#!/usr/bin/env node
/**
 * The Makerie — holographic art generator.
 *
 * Renders the app's original holographic foil into assets/art/ using only
 * Node built-ins (zlib for PNG) plus macOS `sips` for the JPEG conversion.
 * Deterministic: same seed, same pixels.
 *
 *   node scripts/generate-art.mjs
 *
 * Assets
 *   foil-deep.jpg      saturated foil sinking into midnight — hero accent strip
 *
 * Technique
 *   Foils: domain-warped Perlin fbm as a height field; colour from a cyclic
 *   thin-film spectrum built from the brand palette, folds lit with a
 *   specular term.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "art");
mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- palette */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const MIDNIGHT = hex("#081638");
const WHITE = [1, 1, 1];
// Cyclic holographic spectrum: pink → ultraviolet → cobalt → laser → aqua → peach
const STOPS = ["#F477D3", "#AE8AFF", "#494AF4", "#48D7F5", "#8EF0D3", "#FFBC91"].map(hex);

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function spectrum(t) {
  t -= Math.floor(t);
  const x = t * STOPS.length;
  const i = Math.floor(x);
  let f = x - i;
  f = f * f * (3 - 2 * f);
  return mix(STOPS[i % STOPS.length], STOPS[(i + 1) % STOPS.length], f);
}

/* ------------------------------------------------------------------ noise */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261115);
const perm = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const GX = [1, -1, 1, -1, 1, -1, 0, 0];
const GY = [1, 1, -1, -1, 0, 0, 1, -1];
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function noise(x, y) {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const xf = x - X;
  const yf = y - Y;
  const xi = X & 255;
  const yi = Y & 255;
  const g = (h, dx, dy) => GX[h & 7] * dx + GY[h & 7] * dy;
  const aa = perm[perm[xi] + yi];
  const ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi];
  const bb = perm[perm[xi + 1] + yi + 1];
  const u = fade(xf);
  const v = fade(yf);
  const x1 = g(aa, xf, yf) + u * (g(ba, xf - 1, yf) - g(aa, xf, yf));
  const x2 = g(ab, xf, yf - 1) + u * (g(bb, xf - 1, yf - 1) - g(ab, xf, yf - 1));
  return x1 + v * (x2 - x1);
}
function fbm(x, y, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/* ---------------------------------------------------------------- writers */
function writePNG(path, w, h, data, channels) {
  const stride = w * channels;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(tb) >>> 0);
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
function writeJPEG(path, w, h, rgb, quality) {
  const dir = mkdtempSync(join(tmpdir(), "makerie-art-"));
  const png = join(dir, "tmp.png");
  writePNG(png, w, h, rgb, 3);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(quality), png, "--out", path], {
    stdio: "ignore",
  });
  rmSync(dir, { recursive: true, force: true });
}
const to8 = (v) => Math.round(clamp01(v) * 255);

/* ------------------------------------------------------------------ foils */
function renderFoil({ w, h, scale, variant }) {
  const field = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = (x / h) * scale;
      const py = (y / h) * scale;
      const q1 = fbm(px, py, 3);
      const q2 = fbm(px + 5.2, py + 1.3, 3);
      const r1 = fbm(px + 2.4 * q1 + 1.7, py + 2.4 * q2 + 9.2, 3);
      const r2 = fbm(px + 2.4 * q1 + 8.3, py + 2.4 * q2 + 2.8, 3);
      field[y * w + x] = fbm(px + 2.2 * r1, py + 2.2 * r2, 3);
    }
  }
  const out = Buffer.alloc(w * h * 3);
  const L = normalize([-0.45, -0.55, 0.7]);
  const H = normalize([L[0], L[1], L[2] + 1]);
  const k = h / scale / 1.6;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = field[y * w + x];
      const fx = field[y * w + Math.min(w - 1, x + 1)] - field[y * w + Math.max(0, x - 1)];
      const fy = field[Math.min(h - 1, y + 1) * w + x] - field[Math.max(0, y - 1) * w + x];
      const n = normalize([-fx * k, -fy * k, 1]);
      const ndl = Math.max(0, dot(n, L));
      const spec = Math.pow(Math.max(0, dot(n, H)), 46);
      const sheen = Math.pow(Math.max(0, dot(n, H)), 8);
      const t = f * 1.1 + n[0] * 0.45 + n[1] * 0.3 + (x / w) * 0.4 + (y / h) * 0.15;
      const film = spectrum(t);
      let c;
      if (variant === "luminous") {
        c = mix(film, WHITE, 0.1 + 0.3 * sheen);
        c = c.map((v) => v * (0.84 + 0.2 * ndl) + spec * 0.8);
      } else {
        const lift = smooth(-0.25, 0.75, f * 1.4 + ndl * 0.55 - 0.15);
        c = mix(MIDNIGHT, film, 0.12 + 0.88 * lift);
        c = c.map((v) => v * (0.7 + 0.45 * ndl) + spec * 0.9);
      }
      const o = (y * w + x) * 3;
      out[o] = to8(c[0]);
      out[o + 1] = to8(c[1]);
      out[o + 2] = to8(c[2]);
    }
  }
  return out;
}

/* ----------------------------------------------------------------- vector */
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function normalize(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/* ------------------------------------------------------------------- run */
const time = (label, fn) => {
  const s = performance.now();
  const r = fn();
  console.log(`${label} ${((performance.now() - s) / 1000).toFixed(1)}s`);
  return r;
};

time("foil-deep", () => {
  const w = 1400;
  const h = 1100;
  writeJPEG(join(OUT, "foil-deep.jpg"), w, h, renderFoil({ w, h, scale: 0.9, variant: "deep" }), 84);
});


