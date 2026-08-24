/**
 * THROWAWAY (aesthetic study only) — the ground: paper, atmosphere, grain, vignette.
 *
 * The references never sit a figure on a flat colour. eggs-as-figure.png is mottled
 * sheet stock with a darkened edge; ship-at-sea.png and murmuration-whale.png are
 * cool blue-grey above, warm sand below, everything slightly out of focus. So:
 *
 *   ground  (baked once)  gradient + low-frequency blotching + soft haze pools
 *   atmosphere (per frame) two very large, very faint, very slowly drifting pools
 *   vignette (per frame)   darkened edge, drawn over the swarm so the fringe sinks
 *   grain    (baked once)  per-device-pixel tooth, drawn last, in DEVICE pixels
 *
 * Grain is deliberately static. Film grain that boils would read as noise-for-effect;
 * paper does not shimmer. Atmospheric stillness is Level 2.
 */

import { Noise } from './noise';
import { PAPER } from './palette';

function offscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/** Baked ground, in DEVICE pixels. */
export function bakeGround(
  deviceW: number,
  deviceH: number,
  noise: Noise,
  rand: () => number,
): HTMLCanvasElement {
  const c = offscreen(deviceW, deviceH);
  const g = c.getContext('2d');
  if (g === null) throw new Error('paper: offscreen 2d context unavailable');

  const grad = g.createLinearGradient(0, 0, deviceW * 0.12, deviceH);
  grad.addColorStop(0, PAPER.cool);
  grad.addColorStop(0.46, PAPER.base);
  grad.addColorStop(1, PAPER.warm);
  g.fillStyle = grad;
  g.fillRect(0, 0, deviceW, deviceH);

  // --- low-frequency blotching ---------------------------------------------
  // Rendered small and scaled up, so it arrives as soft cloud rather than noise.
  const mw = Math.max(2, Math.round(deviceW / 8));
  const mh = Math.max(2, Math.round(deviceH / 8));
  const mc = offscreen(mw, mh);
  const mg = mc.getContext('2d');
  if (mg === null) throw new Error('paper: mottle 2d context unavailable');
  const img = mg.createImageData(mw, mh);
  const seedX = rand() * 100;
  const seedY = rand() * 100;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const n = noise.fbm2(seedX + x * 0.035, seedY + y * 0.035, 4);
      const o = (y * mw + x) * 4;
      // warm where n > 0, cool where n < 0 — the same swing the paper stock has
      const v = n * 26;
      img.data[o] = 128 + v * 1.15;
      img.data[o + 1] = 128 + v * 0.55;
      img.data[o + 2] = 128 - v * 0.5;
      img.data[o + 3] = 255;
    }
  }
  mg.putImageData(img, 0, 0);
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.46;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(mc, 0, 0, deviceW, deviceH);
  g.restore();

  // --- haze pools -----------------------------------------------------------
  // Additive, and therefore dangerous: three overlapping pools at any real alpha
  // drive the sheet to white and the whole thing stops being mid-tone paper.
  // These are deliberately near-invisible per pool; the effect is cumulative.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const cx = deviceW * (0.12 + rand() * 0.76);
    const cy = deviceH * (0.05 + rand() * 0.35);
    const r = deviceW * (0.28 + rand() * 0.24);
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, 'rgba(231, 224, 216, 0.05)');
    rg.addColorStop(1, 'rgba(231, 224, 216, 0)');
    g.fillStyle = rg;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.restore();

  return c;
}

/** Baked grain tile, in DEVICE pixels. */
export function bakeGrain(size: number, rand: () => number): HTMLCanvasElement {
  const c = offscreen(size, size);
  const g = c.getContext('2d');
  if (g === null) throw new Error('paper: grain 2d context unavailable');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    // Slightly biased dark so the tooth reads as fibre, not as sparkle.
    const v = 128 + (rand() - 0.52) * 46;
    const o = i * 4;
    img.data[o] = v;
    img.data[o + 1] = v;
    img.data[o + 2] = v;
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Two enormous, faint, slowly drifting pools. Air, not weather. */
export function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clock: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const a1x = w * (0.34 + Math.sin(clock * 0.031) * 0.06);
  const a1y = h * (0.3 + Math.cos(clock * 0.024) * 0.05);
  const r1 = Math.max(w, h) * 0.46;
  const g1 = ctx.createRadialGradient(a1x, a1y, 0, a1x, a1y, r1);
  g1.addColorStop(0, 'rgba(233, 227, 219, 0.055)');
  g1.addColorStop(1, 'rgba(233, 227, 219, 0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  const a2x = w * (0.7 + Math.cos(clock * 0.019) * 0.07);
  const a2y = h * (0.72 + Math.sin(clock * 0.027) * 0.05);
  const r2 = Math.max(w, h) * 0.4;
  const g2 = ctx.createRadialGradient(a2x, a2y, 0, a2x, a2y, r2);
  g2.addColorStop(0, 'rgba(214, 193, 161, 0.05)');
  g2.addColorStop(1, 'rgba(214, 193, 161, 0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const r = Math.hypot(w, h) * 0.62;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.48, r * 0.34, w * 0.5, h * 0.48, r);
  g.addColorStop(0, 'rgba(60, 55, 46, 0)');
  g.addColorStop(0.7, 'rgba(60, 55, 46, 0.07)');
  g.addColorStop(1, 'rgba(60, 55, 46, 0.26)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
