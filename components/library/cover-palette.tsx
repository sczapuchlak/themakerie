"use client";

import { useEffect, useState } from "react";

/**
 * Pulls a small, vivid palette out of a pattern's cover so each pattern's
 * pages glow in its own colours. Runs once per cover (cached in memory and
 * localStorage); falls back to the Makerie palette if the image can't be read.
 */

export const BRAND_PALETTE = ["#494AF4", "#F477D3", "#48D7F5", "#AE8AFF", "#8EF0D3"];
const memory = new Map<string, Promise<string[]>>();

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return { s, l };
}
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function extractPalette(src: string, cacheKey: string): Promise<string[]> {
  const key = `makerie-palette:${cacheKey}`;
  const hit = memory.get(key);
  if (hit) return hit;
  const task = new Promise<string[]>((resolve) => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return resolve(JSON.parse(stored));
    } catch {}
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const size = 64;
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        // Bucket colours (4 bits/channel), weight by how vivid they are.
        const buckets = new Map<number, { n: number; r: number; g: number; b: number; score: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          if (a < 200) continue;
          const { s, l } = rgbToHsl(r, g, b);
          if (l < 0.12 || l > 0.92 || s < 0.25) continue; // skip paper, ink, greys
          const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          const e = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0, score: 0 };
          e.n++;
          e.r += r;
          e.g += g;
          e.b += b;
          e.score += 0.4 + s * (1 - Math.abs(l - 0.55));
          buckets.set(k, e);
        }
        const ranked = [...buckets.values()].sort((a, b) => b.score - a.score).map((e) => [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round));
        const picked: number[][] = [];
        for (const c2 of ranked) {
          if (picked.every((p) => dist(p, c2) > 70)) picked.push(c2);
          if (picked.length === 5) break;
        }
        const palette = picked.length >= 2 ? picked.map(([r, g, b]) => hex(r, g, b)) : BRAND_PALETTE;
        try {
          localStorage.setItem(key, JSON.stringify(palette));
        } catch {}
        resolve(palette);
      } catch {
        resolve(BRAND_PALETTE); // cross-origin or decode failure
      }
    };
    img.onerror = () => resolve(BRAND_PALETTE);
    img.src = src;
  });
  memory.set(key, task);
  return task;
}

export function usePalette(src: string | null | undefined, cacheKey: string | null | undefined) {
  const [palette, setPalette] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    if (!src || !cacheKey) return;
    void extractPalette(src, cacheKey).then((p) => live && setPalette(p));
    return () => {
      live = false;
    };
  }, [src, cacheKey]);
  return palette ?? BRAND_PALETTE;
}

/** Soft, colourful glow behind a midnight hero, tinted by the cover. */
export function CoverAura({ src, cacheKey, className = "" }: { src: string | null; cacheKey: string | null; className?: string }) {
  const p = usePalette(src, cacheKey);
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden transition-opacity duration-700 ${className}`}>
      <div className="absolute -top-1/3 -right-1/4 size-[38rem] rounded-full opacity-55 blur-[90px]" style={{ background: p[0] }} />
      <div className="absolute -bottom-1/2 left-1/4 size-[32rem] rounded-full opacity-40 blur-[100px]" style={{ background: p[1] ?? p[0] }} />
      <div className="absolute top-1/4 right-1/3 size-[18rem] rounded-full opacity-35 blur-[80px]" style={{ background: p[2] ?? p[0] }} />
      <div className="tech-grid absolute inset-0 text-white/[0.05]" />
    </div>
  );
}

/** The cover's colours as swatches — a small "palette card". */
export function PaletteStrip({ src, cacheKey }: { src: string | null; cacheKey: string | null }) {
  const p = usePalette(src, cacheKey);
  if (!src) return null;
  return (
    <div className="flex items-center gap-3" data-testid="palette-strip">
      <div className="flex -space-x-2">
        {p.map((c, i) => (
          <span key={`${c}${i}`} title={c} className="size-8 rounded-full border-2 border-midnight shadow-md" style={{ background: c }} />
        ))}
      </div>
      <span className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">Cover palette</span>
    </div>
  );
}
