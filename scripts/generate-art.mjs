#!/usr/bin/env node
/**
 * The Makerie — holographic art generator.
 *
 * Renders the app's original signature artwork into assets/art/ using only
 * Node built-ins (zlib for PNG) plus macOS `sips` for the JPEG conversion of
 * the foil textures. Deterministic: same seed, same pixels.
 *
 *   node scripts/generate-art.mjs
 *
 * Assets
 *   foil-deep.jpg      saturated foil sinking into midnight — the hero only
 *   thread-coil.png    plied-yarn coil in holographic chrome
 *
 * Technique
 *   Foils: domain-warped Perlin fbm as a height field; colour from a cyclic
 *   thin-film spectrum built from the brand palette, folds lit with a
 *   specular term. Objects: tubes around a sampled curve with three twisted
 *   plies, baked into a signed-distance grid and ray-marched; shading mixes
 *   a studio environment reflection (chrome) with a view-angle thin-film
 *   colour shift (iridescence), plus ambient occlusion.
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
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function rotate(p, rx, ry, rz) {
  let [x, y, z] = p;
  let c = Math.cos(rx);
  let s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rz);
  s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

/* ------------------------------------------------- plied tube → SDF grid */
function buildTubeGrid({ points, closed, radius, plyAmp, plies, plyPitch, voxel, band }) {
  const M = points.length;
  const segCount = closed ? M : M - 1;
  // Frenet-style frames at each sample (continuous for curves with curvature)
  const T = [];
  const N = [];
  const B = [];
  for (let i = 0; i < M; i++) {
    const prev = points[closed ? (i - 1 + M) % M : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % M : Math.min(M - 1, i + 1)];
    const t = normalize([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]);
    const acc = [next[0] - 2 * points[i][0] + prev[0], next[1] - 2 * points[i][1] + prev[1], next[2] - 2 * points[i][2] + prev[2]];
    const d = dot(acc, t);
    let n = [acc[0] - d * t[0], acc[1] - d * t[1], acc[2] - d * t[2]];
    if (Math.hypot(...n) < 1e-9) n = Math.abs(t[1]) < 0.9 ? cross(t, [0, 1, 0]) : cross(t, [1, 0, 0]);
    n = normalize(n);
    T.push(t);
    N.push(n);
    B.push(cross(t, n));
  }
  // Arc length for an even ply twist
  const cum = [0];
  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % M];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const length = cum[segCount];
  const twists = closed ? Math.round(length / plyPitch) : length / plyPitch;

  const pad = radius + plyAmp + band;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k] - pad);
      max[k] = Math.max(max[k], p[k] + pad);
    }
  const dims = [0, 1, 2].map((k) => Math.ceil((max[k] - min[k]) / voxel) + 1);
  const [nx, ny, nz] = dims;

  // Bucket segments in cells of size `band` for local nearest-segment search
  const cell = band + radius;
  const cdims = [0, 1, 2].map((k) => Math.ceil((max[k] - min[k]) / cell) + 1);
  const buckets = new Map();
  const key = (i, j, k) => (i * cdims[1] + j) * cdims[2] + k;
  for (let s = 0; s < segCount; s++) {
    const a = points[s];
    const b = points[(s + 1) % M];
    const lo = [0, 1, 2].map((k) => Math.floor((Math.min(a[k], b[k]) - min[k] - cell) / cell));
    const hi = [0, 1, 2].map((k) => Math.floor((Math.max(a[k], b[k]) - min[k] + cell) / cell));
    for (let i = lo[0]; i <= hi[0]; i++)
      for (let j = lo[1]; j <= hi[1]; j++)
        for (let k = lo[2]; k <= hi[2]; k++) {
          const kk = key(i, j, k);
          if (!buckets.has(kk)) buckets.set(kk, []);
          buckets.get(kk).push(s);
        }
  }

  const grid = new Float32Array(nx * ny * nz).fill(band);
  for (let iz = 0; iz < nz; iz++) {
    const pz = min[2] + iz * voxel;
    for (let iy = 0; iy < ny; iy++) {
      const py = min[1] + iy * voxel;
      for (let ix = 0; ix < nx; ix++) {
        const px = min[0] + ix * voxel;
        const list = buckets.get(
          key(Math.floor((px - min[0]) / cell), Math.floor((py - min[1]) / cell), Math.floor((pz - min[2]) / cell)),
        );
        if (!list) continue;
        let best = Infinity;
        let bs = 0;
        let bu = 0;
        for (const s of list) {
          const a = points[s];
          const b = points[(s + 1) % M];
          const abx = b[0] - a[0];
          const aby = b[1] - a[1];
          const abz = b[2] - a[2];
          let u = ((px - a[0]) * abx + (py - a[1]) * aby + (pz - a[2]) * abz) / (abx * abx + aby * aby + abz * abz);
          u = u < 0 ? 0 : u > 1 ? 1 : u;
          const dx = px - (a[0] + abx * u);
          const dy = py - (a[1] + aby * u);
          const dz = pz - (a[2] + abz * u);
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < best) {
            best = d2;
            bs = s;
            bu = u;
          }
        }
        const dist = Math.sqrt(best);
        if (dist - radius > band) continue;
        const a = points[bs];
        const b = points[(bs + 1) % M];
        const c = [a[0] + (b[0] - a[0]) * bu, a[1] + (b[1] - a[1]) * bu, a[2] + (b[2] - a[2]) * bu];
        const v = [px - c[0], py - c[1], pz - c[2]];
        const j = (bs + 1) % M;
        const n = normalize(mix(N[bs], N[j], bu));
        const bn = normalize(mix(B[bs], B[j], bu));
        const phi = Math.atan2(dot(v, bn), dot(v, n));
        const s = (cum[bs] + (cum[bs + 1] - cum[bs]) * bu) / length;
        const ply = Math.cos(plies * phi - twists * 2 * Math.PI * s);
        grid[(iz * ny + iy) * nx + ix] = dist - (radius + plyAmp * ply);
      }
    }
  }
  return { grid, min, dims, voxel, band };
}

function sampler({ grid, min, dims, voxel, band }) {
  const [nx, ny, nz] = dims;
  return (x, y, z) => {
    const fx = (x - min[0]) / voxel;
    const fy = (y - min[1]) / voxel;
    const fz = (z - min[2]) / voxel;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return band;
    const ix = fx | 0;
    const iy = fy | 0;
    const iz = fz | 0;
    const tx = fx - ix;
    const ty = fy - iy;
    const tz = fz - iz;
    const i000 = (iz * ny + iy) * nx + ix;
    const i010 = i000 + nx;
    const i001 = i000 + nx * ny;
    const i011 = i001 + nx;
    const c00 = grid[i000] + (grid[i000 + 1] - grid[i000]) * tx;
    const c10 = grid[i010] + (grid[i010 + 1] - grid[i010]) * tx;
    const c01 = grid[i001] + (grid[i001 + 1] - grid[i001]) * tx;
    const c11 = grid[i011] + (grid[i011 + 1] - grid[i011]) * tx;
    const c0 = c00 + (c10 - c00) * ty;
    const c1 = c01 + (c11 - c01) * ty;
    return c0 + (c1 - c0) * tz;
  };
}

/* ----------------------------------------------------------------- shading */
const KEY = normalize([-0.55, 0.75, 0.55]);
const RIM = normalize([0.75, -0.15, -0.45]);

/**
 * Studio environment *luminance*: bright sky, deep floor, a dark horizon
 * band and a softbox. Chrome contrast comes from here.
 */
function environmentLum(r) {
  const y = r[1];
  let lum = y >= 0 ? 0.62 + 0.5 * smooth(0.15, 0.95, y) : 0.16 + 0.4 * smooth(-0.95, 0, y);
  lum *= 1 - 0.62 * Math.exp(-(((y + 0.02) / 0.06) ** 2));
  lum += smooth(0.8, 0.97, dot(r, KEY)) * 0.9;
  return lum;
}

/**
 * Holographic chrome: hue from a view- and reflection-dependent thin-film
 * shift (always saturated), brightness from the environment, plus white
 * speculars and a fresnel rim.
 */
function shadeSurface(n, view, ao, filmShift) {
  const ndv = Math.max(0, dot(n, view));
  const fres = 0.04 + 0.96 * (1 - ndv) ** 5;
  const k = 2 * dot(n, view);
  const r = [k * n[0] - view[0], k * n[1] - view[1], k * n[2] - view[2]];
  const lum = environmentLum(r);
  const around = Math.atan2(r[0], -r[2]) / (2 * Math.PI);
  const hue = spectrum(0.95 * (1 - ndv) + 0.42 * r[1] + 0.3 * around + filmShift);
  let c = hue.map((v) => v * lum * 1.2);
  c = mix(c, WHITE, smooth(0.95, 1.5, lum) * 0.55);
  const spec = Math.pow(Math.max(0, dot(r, KEY)), 120) * 1.6 + Math.pow(Math.max(0, dot(r, RIM)), 26) * 0.35;
  c = c.map((v) => (v + spec + fres * 0.18) * ao);
  return c.map((v) => (v <= 0.8 ? v : 0.8 + 0.2 * (1 - Math.exp(-(v - 0.8) * 4))));
}

function renderTube({ size, grid, camZ = 16, filmShift = 0 }) {
  const sdf = sampler(grid);
  const { min, dims, voxel } = grid;
  const max = [0, 1, 2].map((k) => min[k] + (dims[k] - 1) * voxel);
  const ext = Math.max(...max.map((m, k) => Math.max(Math.abs(m), Math.abs(min[k]))));
  const tanH = (ext * 0.96) / camZ;
  const SS = 2;
  const out = Buffer.alloc(size * size * 4);
  const eps = voxel * 0.25;
  const h = voxel;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let cover = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const v = 1 - ((py + (sy + 0.5) / SS) / size) * 2;
          const dir = normalize([u * tanH, v * tanH, -1]);
          // Ray–box entry
          let t0 = 0;
          let t1 = Infinity;
          const o = [0, 0, camZ];
          for (let k = 0; k < 3; k++) {
            const inv = 1 / dir[k];
            let ta = (min[k] - o[k]) * inv;
            let tb = (max[k] - o[k]) * inv;
            if (ta > tb) [ta, tb] = [tb, ta];
            t0 = Math.max(t0, ta);
            t1 = Math.min(t1, tb);
          }
          if (t0 > t1) continue;
          let t = t0;
          let hit = false;
          for (let i = 0; i < 160 && t < t1; i++) {
            const d = sdf(o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t);
            if (d < eps) {
              hit = true;
              break;
            }
            t += d * 0.8;
          }
          if (!hit) continue;
          const p = [o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t];
          const n = normalize([
            sdf(p[0] + h, p[1], p[2]) - sdf(p[0] - h, p[1], p[2]),
            sdf(p[0], p[1] + h, p[2]) - sdf(p[0], p[1] - h, p[2]),
            sdf(p[0], p[1], p[2] + h) - sdf(p[0], p[1], p[2] - h),
          ]);
          let ao = 1;
          for (let k = 1; k <= 3; k++) {
            const dist = 0.12 * k;
            ao -= (dist - sdf(p[0] + n[0] * dist, p[1] + n[1] * dist, p[2] + n[2] * dist)) * (0.9 / k);
          }
          ao = 0.45 + 0.55 * clamp01(ao);
          const c = shadeSurface(n, [-dir[0], -dir[1], -dir[2]], ao, filmShift);
          r += c[0];
          g += c[1];
          b += c[2];
          cover++;
        }
      const o = (py * size + px) * 4;
      if (cover) {
        out[o] = to8(r / cover);
        out[o + 1] = to8(g / cover);
        out[o + 2] = to8(b / cover);
        out[o + 3] = to8(cover / (SS * SS));
      }
    }
  }
  return out;
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

time("thread-coil", () => {
  const pts = [];
  const turns = 4.5;
  const M = 900;
  for (let i = 0; i < M; i++) {
    const t = (i / (M - 1)) * turns * 2 * Math.PI;
    const p = [1.35 * Math.cos(t), (t / (2 * Math.PI)) * 0.95 - (turns * 0.95) / 2, 1.35 * Math.sin(t)];
    pts.push(rotate(p, 0.35, 0.2, -0.62));
  }
  const grid = buildTubeGrid({
    points: pts,
    closed: false,
    radius: 0.36,
    plyAmp: 0.06,
    plies: 3,
    plyPitch: 0.7,
    voxel: 0.03,
    band: 0.4,
  });
  writePNG(join(OUT, "thread-coil.png"), 720, 720, renderTube({ size: 720, grid, camZ: 16, filmShift: 0.4 }), 4);
});

