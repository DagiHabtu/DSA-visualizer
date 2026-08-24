/**
 * THROWAWAY (aesthetic study only) — the speck field: simulation + batched draw.
 *
 * Motion notes, which are the actual deliverable of this study:
 *
 *  - Nothing tweens. Every speck is a damped spring under a curl-noise wind, so
 *    the path into place is a decelerating curve with a wobble on it, never a
 *    straight interpolation. "A murmuration settling", not a slide transition.
 *  - Arrival is staggered per speck, so the form assembles as a wave crossing the
 *    frame rather than as a synchronised snap.
 *  - While falling in, distant specks get a gravity bias that fades as they close
 *    on their home. They come DOWN into place; they do not fly at it.
 *  - Each speck is drawn as a round-capped segment stretched along its velocity,
 *    so speed reads as motion blur (see birds-over-building.png, where the birds
 *    are streaks, not dots) and stillness reads as a dot.
 *  - At rest the specks keep a small quiver and the homes breathe. Frozen is dead.
 *  - Density does all the tonal work: fringe specks are not more transparent than
 *    core specks, there are simply fewer of them.
 */

import { curl, type Noise, type Vec2 } from './noise';
import { INK, smootherstep, clamp01 } from './palette';

export type BeatMode = 'drift' | 'gather' | 'rest' | 'dissolve';

export interface Beat {
  mode: BeatMode;
  /** Progress through the current beat, 0..1. */
  p: number;
}

export interface Cloud {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface Bucket {
  color: string;
  alpha: number;
  width: number;
  idx: Uint32Array;
}

/** Spatial frequency of the wind field, and how fast it evolves. */
const WIND_SPACE = 0.0034;
const WIND_TIME = 0.085;
const WIND_DRIFT = 118; // px/s^2
const WIND_REST = 0.13; // fraction of WIND_DRIFT retained once settled
const DRAG_BASE = 1.35; // 1/s
const COHESION = 0.22; // 1/s^2 toward the idle cloud centre
const CONTAIN = 135; // 1/s^2 once outside the idle ellipse
const FALL_IN = 235; // px/s^2 downward bias while still far from home
const FALL_RANGE = 115; // px — gravity bias fades to nothing inside this
const RELEASE_UP = 125; // px/s^2 during dissolve
const RELEASE_OUT = 85; // px/s^2 during dissolve
const STAGGER_SPREAD = 0.55; // fraction of a beat spent staggering arrivals
const BLUR_SECONDS = 0.0105; // velocity -> streak half-length
const BLUR_MAX = 5.5; // px

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [0.7, 0.52],
  [1.0, 0.33],
  [1.45, 0.15],
];
const ALPHAS: ReadonlyArray<readonly [number, number]> = [
  [0.36, 0.44],
  [0.58, 0.35],
  [0.82, 0.21],
];

function pick(rand: () => number, table: ReadonlyArray<{ weight: number }>): number {
  let r = rand();
  for (let i = 0; i < table.length; i++) {
    r -= table[i].weight;
    if (r <= 0) return i;
  }
  return table.length - 1;
}

function pickPair(rand: () => number, table: ReadonlyArray<readonly [number, number]>): number {
  let r = rand();
  for (let i = 0; i < table.length; i++) {
    r -= table[i][1];
    if (r <= 0) return i;
  }
  return table.length - 1;
}

export class SpeckField {
  readonly count: number;

  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly hx: Float32Array;
  private readonly hy: Float32Array;
  private readonly stiff: Float32Array;
  private readonly zeta: Float32Array;
  private readonly gatherAt: Float32Array;
  private readonly releaseAt: Float32Array;
  private readonly phase: Float32Array;
  private readonly buckets: Bucket[];

  private readonly wind: Vec2 = { x: 0, y: 0 };

  constructor(
    count: number,
    homes: Float32Array,
    cloud: Cloud,
    private readonly noise: Noise,
    rand: () => number,
  ) {
    this.count = count;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.hx = new Float32Array(count);
    this.hy = new Float32Array(count);
    this.stiff = new Float32Array(count);
    this.zeta = new Float32Array(count);
    this.gatherAt = new Float32Array(count);
    this.releaseAt = new Float32Array(count);
    this.phase = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.hx[i] = homes[i * 2];
      this.hy[i] = homes[i * 2 + 1];

      // Start scattered across the idle cloud, with a plausible drift velocity.
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      this.x[i] = cloud.cx + Math.cos(a) * r * cloud.rx;
      this.y[i] = cloud.cy + Math.sin(a) * r * cloud.ry;
      const sa = rand() * Math.PI * 2;
      const ss = 20 + rand() * 55;
      this.vx[i] = Math.cos(sa) * ss;
      this.vy[i] = Math.sin(sa) * ss;

      this.stiff[i] = 24 + rand() * 34;
      this.zeta[i] = 0.72 + rand() * 0.26;
      this.phase[i] = rand() * Math.PI * 2;
      this.releaseAt[i] = rand();
    }

    // Arrival order: left to right across the row, softened so the wave front is
    // ragged rather than a ruled line sweeping the frame.
    const order = new Uint32Array(count);
    for (let i = 0; i < count; i++) order[i] = i;
    const key = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      key[i] = this.hx[i] + (rand() - 0.5) * 160;
    }
    const sorted = Array.from(order).sort((a, b) => key[a] - key[b]);
    for (let rank = 0; rank < count; rank++) {
      this.gatherAt[sorted[rank]] = rank / (count - 1 || 1);
    }

    // --- static draw buckets --------------------------------------------------
    // Style never changes at runtime, so membership is computed once and the whole
    // field renders in ~36 stroke calls instead of `count` of them.
    const styleOf = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const ci = pick(rand, INK);
      const si = pickPair(rand, SIZES);
      const ai = pickPair(rand, ALPHAS);
      styleOf[i] = ci * 9 + si * 3 + ai;
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < count; i++) {
      const s = styleOf[i];
      const g = groups.get(s);
      if (g === undefined) groups.set(s, [i]);
      else g.push(i);
    }
    this.buckets = [];
    for (const [style, members] of groups) {
      const ci = Math.floor(style / 9);
      const si = Math.floor((style % 9) / 3);
      const ai = style % 3;
      this.buckets.push({
        color: INK[ci].hex,
        alpha: ALPHAS[ai][0],
        width: SIZES[si][0],
        idx: Uint32Array.from(members),
      });
    }
  }

  /** Per-speck pull toward its home, 0..1, staggered within the beat. */
  private pullFor(i: number, beat: Beat): number {
    switch (beat.mode) {
      case 'drift':
        return 0;
      case 'rest':
        return 1;
      case 'gather': {
        const s = this.gatherAt[i] * STAGGER_SPREAD;
        return smootherstep((beat.p - s) / (1 - STAGGER_SPREAD));
      }
      case 'dissolve': {
        const s = this.releaseAt[i] * STAGGER_SPREAD;
        return 1 - smootherstep((beat.p - s) / (1 - STAGGER_SPREAD));
      }
    }
  }

  update(dt: number, clock: number, beat: Beat, cloud: Cloud): void {
    const wind = this.wind;
    const wz = clock * WIND_TIME;
    const dissolving = beat.mode === 'dissolve';
    // Release is loudest in the middle of the break-up, then the wind takes over.
    const releaseCurve = dissolving ? Math.sin(clamp01(beat.p) * Math.PI) : 0;

    for (let i = 0; i < this.count; i++) {
      const px = this.x[i];
      const py = this.y[i];
      const p = this.pullFor(i, beat);

      curl(this.noise, px * WIND_SPACE, py * WIND_SPACE, wz, 0.65, wind);
      const windAmp = WIND_DRIFT * (WIND_REST + (1 - WIND_REST) * (1 - p)) * (1 + releaseCurve * 1.6);
      let ax = wind.x * windAmp;
      let ay = wind.y * windAmp;

      // Idle cohesion — a flock holds together even when it is going nowhere.
      const free = 1 - p;
      const dcx = cloud.cx - px;
      const dcy = cloud.cy - py;
      ax += dcx * COHESION * free;
      ay += dcy * COHESION * free;

      const nx = dcx / cloud.rx;
      const ny = dcy / cloud.ry;
      const rr = Math.sqrt(nx * nx + ny * ny);
      if (rr > 1) {
        const k = ((rr - 1) * CONTAIN * free) / rr;
        ax += nx * k;
        ay += ny * k;
      }

      let damp = DRAG_BASE;

      if (p > 0.001) {
        // Homes breathe, so the settled form is alive rather than printed.
        const bx = this.hx[i] + Math.sin(clock * 0.55 + this.phase[i]) * 1.25;
        const by = this.hy[i] + Math.cos(clock * 0.43 + this.phase[i] * 1.7) * 1.0;
        const dx = bx - px;
        const dy = by - py;
        const k = this.stiff[i] * p;
        ax += dx * k;
        ay += dy * k;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const far = clamp01(dist / FALL_RANGE);
        ay += FALL_IN * p * far;

        damp += 2 * Math.sqrt(this.stiff[i]) * this.zeta[i] * p;
      }

      if (releaseCurve > 0) {
        const own = releaseCurve * (0.45 + this.releaseAt[i] * 0.9);
        ay -= RELEASE_UP * own;
        const ox = px - cloud.cx;
        const oy = py - cloud.cy;
        const ol = Math.sqrt(ox * ox + oy * oy) || 1;
        ax += (ox / ol) * RELEASE_OUT * own;
        ay += (oy / ol) * RELEASE_OUT * own * 0.35;
      }

      let nvx = this.vx[i] + ax * dt;
      let nvy = this.vy[i] + ay * dt;
      const decay = Math.exp(-damp * dt);
      nvx *= decay;
      nvy *= decay;

      this.vx[i] = nvx;
      this.vy[i] = nvy;
      this.x[i] = px + nvx * dt;
      this.y[i] = py + nvy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, alphaMul: number): void {
    ctx.save();
    // Ink on paper: multiply lets the ground's warmth stay visible through the
    // swarm, and overlapping buckets accumulate into the dark core.
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const b of this.buckets) {
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = b.alpha * alphaMul;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      const idx = b.idx;
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n];
        const vx = this.vx[i];
        const vy = this.vy[i];
        const speed = Math.sqrt(vx * vx + vy * vy);
        const half = Math.min(speed * BLUR_SECONDS, BLUR_MAX);
        const s = speed > 0.0001 ? half / speed : 0;
        const ex = vx * s;
        const ey = vy * s;
        const px = this.x[i];
        const py = this.y[i];
        // The 0.01 keeps a zero-length subpath from being culled: a motionless
        // speck must still render as a round dot.
        ctx.moveTo(px - ex, py - ey);
        ctx.lineTo(px + ex + 0.01, py + ey);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
