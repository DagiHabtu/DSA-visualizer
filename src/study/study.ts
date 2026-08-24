/**
 * THROWAWAY (aesthetic study only) — scatter -> settle -> dissolve, on a loop.
 *
 * This file exists to answer one question before any grammar is designed:
 * can Canvas 2D carry the feel of aesthetic/*.png? Specifically —
 *
 *   surface     muted measured palette, paper grain, hand-drawn wobble, soft easing
 *   composition ONE figure, generous negative space, atmospheric and still
 *   signature   the swarm -> form -> swarm beat, with the form DENSITY-DEFINED
 *
 * It is disposable. It is not engine code, it defines no primitives, it exports no
 * API anyone should build on, and it will be deleted once src/tokens/ and
 * src/engine/ carry these values properly. Hardcoded numbers here are correct:
 * they are the draft the real tokens file gets distilled from.
 *
 * THE BEAT
 *   drift     a loose flock idles in the negative space, going nowhere
 *   gather    homes light up left to right; specks fall in on damped springs
 *   rest      the form holds, quivering; hand-drawn line work is laid under it
 *   dissolve  the flock lets go in a ragged order and drifts back up into air
 */

import type { Scene } from '../main';
import { Noise, mulberry32 } from './noise';
import { buildForm, type Form } from './field';
import { SpeckField, type Beat, type BeatMode, type Cloud } from './specks';
import { bakeGrain, bakeGround, drawAtmosphere, drawVignette } from './paper';
import { LINE, clamp01, smoothstep, smootherstep } from './palette';

const BEATS: ReadonlyArray<{ mode: BeatMode; dur: number }> = [
  { mode: 'drift', dur: 3.2 },
  { mode: 'gather', dur: 4.2 },
  { mode: 'rest', dur: 3.6 },
  { mode: 'dissolve', dur: 3.4 },
];
const LOOP = BEATS.reduce((s, b) => s + b.dur, 0);

const GRAIN_TILE = 220;
const GRAIN_ALPHA = 0.3;
const BASE_SEED = 0x5eed;

/**
 * Specks per square CSS pixel of viewport, then clamped. Density IS the medium:
 * at a tenth of this count the form reads as dust rather than as a solid figure,
 * because there is nothing else making it solid.
 */
const SPECKS_PER_PX = 1 / 34;
const SPECK_MIN = 14000;
const SPECK_MAX = 40000;

interface Pt {
  x: number;
  y: number;
}

function beatAt(t: number): Beat {
  let acc = t % LOOP;
  for (const b of BEATS) {
    if (acc < b.dur) return { mode: b.mode, p: acc / b.dur };
    acc -= b.dur;
  }
  const last = BEATS[BEATS.length - 1];
  return { mode: last.mode, p: 1 };
}

/**
 * A straight run of points, pushed off the straight by low-frequency noise plus a
 * shallow bow. A ruler-straight line is the single fastest way to make this look
 * like a chart, so nothing in the study is allowed to be straight.
 */
function wobblePath(
  noise: Noise,
  seed: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  amp: number,
  bow: number,
  steps: number,
): Pt[] {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const n = noise.noise2(seed + t * 3.1, seed * 0.37);
    const arc = Math.sin(t * Math.PI) * bow;
    const off = n * amp + arc;
    pts.push({ x: ax + dx * t + px * off, y: ay + dy * t + py * off });
  }
  return pts;
}

/**
 * Stroke a path segment by segment with a pressure-varying width and a couple of
 * faint offset passes — a mark laid down by a hand, not a 1px vector edge.
 * `reveal` draws only the leading fraction, so line work arrives with the form.
 */
function strokeHand(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  noise: Noise,
  seed: number,
  width: number,
  alpha: number,
  reveal: number,
): void {
  const last = Math.max(1, Math.floor((pts.length - 1) * clamp01(reveal)));
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = LINE;
  ctx.lineCap = 'round';

  const passes: ReadonlyArray<readonly [number, number, number]> = [
    [1, 0.62, 0],
    [1.5, 0.2, 0.55],
    [0.62, 0.3, -0.45],
  ];

  for (const [wMul, aMul, offset] of passes) {
    ctx.globalAlpha = alpha * aMul;
    for (let i = 0; i < last; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const t = i / (pts.length - 1);
      // Pressure: thicker in the middle of the stroke, thinner at the entry/exit.
      const press = 0.55 + 0.45 * Math.sin(clamp01(t) * Math.PI) ** 0.6;
      const jitter = 0.75 + 0.5 * (noise.noise2(seed * 1.7 + t * 6.2, seed) * 0.5 + 0.5);
      ctx.lineWidth = Math.max(0.35, width * wMul * press * jitter);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + offset);
      ctx.lineTo(b.x, b.y + offset);
      ctx.stroke();
    }
  }
  ctx.restore();
}

class AestheticStudy implements Scene {
  private width = 0;
  private height = 0;
  private dpr = 1;
  private t = 0;
  private run = 0;

  private noise = new Noise(BASE_SEED);
  private form: Form | null = null;
  private specks: SpeckField | null = null;
  private ground: HTMLCanvasElement | null = null;
  private grain: HTMLCanvasElement | null = null;
  private grainPattern: CanvasPattern | null = null;
  private underline: Pt[] = [];
  private ticks: Pt[][] = [];

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.build();
  }

  restart(): void {
    this.t = 0;
    this.run++;
    this.build();
  }

  private cloudAt(t: number): Cloud {
    return {
      cx: this.width * (0.5 + Math.sin(t * 0.16) * 0.045),
      cy: this.height * (0.455 + Math.cos(t * 0.12) * 0.04),
      rx: this.width * 0.29,
      ry: this.height * 0.28,
    };
  }

  private build(): void {
    if (this.width <= 0 || this.height <= 0) return;
    const seed = BASE_SEED + this.run * 7919;
    this.noise = new Noise(seed);
    const rand = mulberry32(seed ^ 0x9e3779b9);

    const count = Math.round(
      Math.min(SPECK_MAX, Math.max(SPECK_MIN, this.width * this.height * SPECKS_PER_PX)),
    );

    this.form = buildForm(this.width, this.height, count, this.noise, rand);
    this.specks = new SpeckField(count, this.form.homes, this.cloudAt(this.t), this.noise, rand);

    this.ground = bakeGround(
      Math.round(this.width * this.dpr),
      Math.round(this.height * this.dpr),
      this.noise,
      rand,
    );
    this.grain = bakeGrain(GRAIN_TILE, rand);
    this.grainPattern = null;

    // --- line work ------------------------------------------------------------
    const g = this.form.geom;
    const baseY = g.cy + g.cellHeight * 0.68;
    const halfW = g.rowWidth * 0.53;
    this.underline = wobblePath(
      this.noise,
      3.7,
      g.cx - halfW,
      baseY,
      g.cx + halfW,
      baseY + 1.8,
      2.2,
      2.6,
      72,
    );

    this.ticks = [];
    const tickLen = g.cellHeight * 0.17;
    for (let i = 0; i <= g.cellCount; i++) {
      const x = g.cx - g.rowWidth / 2 + i * g.cellWidth;
      this.ticks.push(
        wobblePath(this.noise, 11.3 + i * 2.9, x, baseY + 1.5, x + 1.1, baseY + tickLen, 0.8, 0.9, 8),
      );
    }
  }

  update(dt: number, _clock: number): void {
    if (this.specks === null) return;
    this.t += dt;
    this.specks.update(dt, this.t, beatAt(this.t), this.cloudAt(this.t));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h, dpr } = this;
    if (w <= 0 || h <= 0) return;

    // --- ground (device pixels) ----------------------------------------------
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.ground !== null) ctx.drawImage(this.ground, 0, 0);
    ctx.restore();

    drawAtmosphere(ctx, w, h, this.t);

    const beat = beatAt(this.t);

    if (this.specks !== null) this.specks.draw(ctx, 1);

    // --- hand-drawn line work -------------------------------------------------
    const ink = this.inkPresence(beat);
    if (ink.alpha > 0.002) {
      strokeHand(ctx, this.underline, this.noise, 3.7, 1.35, 0.5 * ink.alpha, ink.reveal);
      const revealX = clamp01(ink.reveal);
      for (let i = 0; i < this.ticks.length; i++) {
        const at = i / (this.ticks.length - 1);
        if (at > revealX) continue;
        const local = clamp01((revealX - at) * 6);
        strokeHand(ctx, this.ticks[i], this.noise, 11.3 + i * 2.9, 1.1, 0.4 * ink.alpha, local);
      }
    }

    drawVignette(ctx, w, h);

    // --- grain (device pixels, 1:1 with the display) --------------------------
    if (this.grain !== null) {
      if (this.grainPattern === null) {
        this.grainPattern = ctx.createPattern(this.grain, 'repeat');
      }
      if (this.grainPattern !== null) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = GRAIN_ALPHA;
        ctx.fillStyle = this.grainPattern;
        ctx.fillRect(0, 0, Math.round(w * dpr), Math.round(h * dpr));
        ctx.restore();
      }
    }
  }

  /** Line work belongs to the settled form: it arrives late and leaves early. */
  private inkPresence(beat: Beat): { alpha: number; reveal: number } {
    switch (beat.mode) {
      case 'drift':
        return { alpha: 0, reveal: 0 };
      case 'gather': {
        const r = smootherstep((beat.p - 0.5) / 0.5);
        return { alpha: r, reveal: r };
      }
      case 'rest':
        return { alpha: 1, reveal: 1 };
      case 'dissolve':
        return { alpha: 1 - smoothstep(0, 0.3, beat.p), reveal: 1 };
    }
  }
}

export function createStudy(): Scene {
  return new AestheticStudy();
}
