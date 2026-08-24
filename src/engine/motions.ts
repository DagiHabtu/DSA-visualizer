/**
 * THE THREE MOTIONS — settle, swap, flow. There are no others.
 *
 *   settle  elements ease DOWN into position under gentle physics, echoing the
 *           funnel and the eggs coming to rest. Insertion, placement, heapify
 *           sinking, and — through the particle field — the emergence beat.
 *   swap    two elements trade places along an ARC. Sorting swaps, sift up/down.
 *   flow    a value or an activation PROPAGATES along a path. Copying during a
 *           resize, a BFS frontier spreading, a pointer advancing.
 *
 * A motion is a pure function of time. Give it the endpoints and a phase in
 * 0..1 and it hands back geometry; it owns no state, draws nothing, and knows
 * nothing about what is being moved. That is what lets the same three motions
 * serve every structure.
 *
 * The one exception is `Swarm`, which is a *simulation* rather than a
 * function — many thousands of specks on damped springs cannot be expressed as
 * an interpolation, and the study proved that they must not be. Swarm is not a
 * fourth motion: it is `settle` at field scale. Its `pull` input is exactly the
 * settle phase, and running that phase backwards is the dissolve. Scatter and
 * gather are the same motion in two directions, which is why the grammar has
 * three motions and not five.
 *
 * Nothing here hardcodes a curve or a constant; MOTION, TIMING, SWARM, FIELD
 * and EASING all come from the tokens file.
 */

import {
  EASING,
  FIELD,
  INK,
  MOTION,
  SWARM,
  TIMING,
  clamp01,
  lerp,
} from '../tokens/tokens';
import { Noise, curl, mulberry32, type Vec2 } from './noise';
import type { Path, Pt, SpeckBatch, SpeckBucket } from './renderer';

// ===========================================================================
// 1. SETTLE
// ===========================================================================

/**
 * A single element easing down into position.
 *
 * The path is a decelerating curve with a wobble on it: horizontal progress
 * follows the soft easing, vertical progress enters from above and overshoots
 * slightly before coming to rest, and a low-frequency lateral wander keeps the
 * whole thing off the straight line between the two points.
 *
 * `seed` fixes that wander per element, so a cell settling twice settles the
 * same way, and stepping the trace backward does not re-roll its path.
 */
export function settle(from: Pt, to: Pt, phase: number, seed: number, noise: Noise): Pt {
  const t = clamp01(phase);
  if (t <= 0) return from;
  if (t >= 1) return to;

  const ease = EASING.settle(t);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  // Overshoot: a damped oscillation that has decayed to nothing by the end.
  const decay = Math.exp(-MOTION.settleDecay * t) * (1 - t);
  const ring = Math.sin(t * Math.PI * MOTION.settleBounces) * MOTION.settleOvershoot * decay;

  const x = lerp(from.x, to.x, ease + ring);
  let y = lerp(from.y, to.y, ease + ring);

  // Enter from above: a lobe that lifts the element off its chord early and is
  // gone by the time it arrives.
  const rise = Math.min(dist * MOTION.settleRise, MOTION.settleRiseMax);
  y -= EASING.lobe(ease) * rise;

  // Lateral wander, perpendicular to the chord.
  if (dist > 1e-3) {
    const px = -dy / dist;
    const py = dx / dist;
    const key = (seed % 967) * 0.37;
    const w = noise.noise2(key + t * 2.4, key * 0.71) * dist * MOTION.settleWander * (1 - ease);
    return { x: x + px * w, y: y + py * w };
  }
  return { x, y };
}

// ===========================================================================
// 2. SWAP
// ===========================================================================

export interface SwapState {
  readonly a: Pt;
  readonly b: Pt;
}

/**
 * Two elements trading places along an arc.
 *
 * The two halves take arcs of different height (MOTION.swapSplit), so one
 * clearly passes above the other and the eye can follow which value went where.
 * A straight-line swap reads as a crossfade and loses exactly that.
 */
export function swap(a: Pt, b: Pt, phase: number, seed: number, noise: Noise): SwapState {
  const t = clamp01(phase);
  const ease = EASING.swapArc(t);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return { a, b };

  const px = -dy / dist;
  const py = dx / dist;
  const lift = EASING.lobe(ease) * dist * MOTION.swapArc;
  const key = (seed % 953) * 0.29;
  const wander = noise.noise2(key + t * 2.9, key) * dist * MOTION.swapWander;

  return {
    a: {
      x: lerp(a.x, b.x, ease) + px * (lift + wander),
      y: lerp(a.y, b.y, ease) + py * (lift + wander),
    },
    b: {
      x: lerp(b.x, a.x, ease) - px * (lift * MOTION.swapSplit - wander),
      y: lerp(b.y, a.y, ease) - py * (lift * MOTION.swapSplit - wander),
    },
  };
}

// ===========================================================================
// 3. FLOW
// ===========================================================================

export interface FlowState {
  /** Where the travelling value is right now. */
  readonly at: Pt;
  /** Unit heading, for an arrowhead or a streak. */
  readonly heading: Pt;
  /** Fraction of the path that has been drawn on. Runs slightly ahead of `at`. */
  readonly reveal: number;
  /** Start of the trail behind the value, as a path fraction. */
  readonly trailFrom: number;
}

/**
 * A value or an activation propagating along a path.
 *
 * `flow` is what a pointer advancing looks like, what a copy during a resize
 * looks like, and what a BFS frontier spreading looks like. The path is
 * supplied by the caller — usually a hand-drawn link, so the value travels
 * along the wobble rather than through it.
 */
export function flow(path: Path, phase: number): FlowState {
  const t = clamp01(phase);
  const ease = EASING.flowAlong(t);
  const at = samplePath(path, ease);
  const ahead = samplePath(path, clamp01(ease + 0.02));

  let hx = ahead.x - at.x;
  let hy = ahead.y - at.y;
  const hl = Math.hypot(hx, hy);
  if (hl > 1e-6) {
    hx /= hl;
    hy /= hl;
  } else {
    hx = 1;
    hy = 0;
  }

  // The value lifts a little off its path at the midpoint — it travels, it does
  // not slide along a rail.
  const lift = EASING.lobe(ease) * pathLength(path) * MOTION.flowLift;

  return {
    at: { x: at.x - hy * lift, y: at.y + hx * lift },
    heading: { x: hx, y: hy },
    reveal: clamp01(ease + MOTION.flowLead),
    trailFrom: clamp01(ease - MOTION.flowTrail),
  };
}

// ===========================================================================
// SETTLE, at field scale — the particle field's simulation
// ===========================================================================

export interface Cloud {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * The idle cloud a swarm drifts in when it is not settled into anything, in the
 * proportions the study used. It wanders slowly, because a flock at rest is
 * still going somewhere.
 */
export function idleCloud(width: number, height: number, clock: number): Cloud {
  return {
    cx: width * (0.5 + Math.sin(clock * SWARM.cloudRateX) * SWARM.cloudDriftX),
    cy: height * (0.455 + Math.cos(clock * SWARM.cloudRateY) * SWARM.cloudDriftY),
    rx: width * SWARM.cloudWidth,
    ry: height * SWARM.cloudHeight,
  };
}

/** How many specks a viewport of this size supports. */
export function speckCountFor(width: number, height: number): number {
  return Math.round(
    Math.min(FIELD.maxSpecks, Math.max(FIELD.minSpecks, width * height * FIELD.specksPerPx)),
  );
}

/**
 * The phase of a settle rendered through the particle field — the swarm →
 * form → swarm beat.
 *
 * One event, three outputs: how strongly the specks are pulled toward their
 * homes, how hard they are being pushed apart, and how present the *discrete*
 * elements are. The discrete form fades out as the swarm takes over and fades
 * back in as it re-forms, which is what makes the exchange read as the same
 * matter rather than as a crossfade between two pictures.
 *
 * The first `TIMING.fieldScatterShare` of the event is settle running backwards.
 * That is the whole of "dissolve" — no fourth motion is needed for it.
 */
export interface FieldPhase {
  /** 0 = free-drifting flock, 1 = fully settled into the homes. */
  readonly pull: number;
  /** 0 = no impulse, 1 = the loudest moment of the break-up. */
  readonly release: number;
  /** Presence of the discrete primitives underneath, 0..1. */
  readonly formPresence: number;
  /** Presence of the speck field itself, 0..1. */
  readonly fieldPresence: number;
}

export function fieldPhase(phase: number): FieldPhase {
  const t = clamp01(phase);
  const split = TIMING.fieldScatterShare;
  if (t < split) {
    // Scatter: settle inverted.
    const u = t / split;
    return {
      pull: 1 - EASING.settle(u),
      release: EASING.lobe(u),
      formPresence: 1 - EASING.reveal(Math.min(1, u * 1.6)),
      fieldPresence: EASING.reveal(Math.min(1, u * 2.2)),
    };
  }
  // Gather: settle forwards, onto the new homes.
  const u = (t - split) / (1 - split);
  return {
    pull: EASING.settle(u),
    release: 0,
    formPresence: EASING.reveal(Math.max(0, (u - 0.55) / 0.45)),
    fieldPresence: 1 - EASING.reveal(Math.max(0, (u - 0.7) / 0.3)),
  };
}

interface MutableBucket {
  color: string;
  alpha: number;
  width: number;
  index: Uint32Array;
}

/**
 * A field of specks on damped springs under a curl-noise wind.
 *
 * Nothing here tweens. Every speck integrates a spring toward its home, a
 * gravity bias that fades as it closes, a wind that never quite stops, and a
 * cohesion force that holds the flock together when it has nowhere to be. That
 * is the difference between "a murmuration settling" and a slide transition,
 * and it is the single thing the aesthetic study was built to prove.
 */
export class Swarm {
  readonly count: number;

  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly hx: Float32Array;
  private readonly hy: Float32Array;
  private readonly stiff: Float32Array;
  private readonly zeta: Float32Array;
  private readonly gatherAt: Float32Array;
  private readonly releaseAt: Float32Array;
  private readonly phaseOf: Float32Array;
  private readonly buckets: MutableBucket[];
  private readonly wind: Vec2 = { x: 0, y: 0 };
  private readonly noise: Noise;

  constructor(count: number, homes: Float32Array, cloud: Cloud, seed: number) {
    this.count = count;
    this.noise = new Noise(seed);
    const rand = mulberry32(seed ^ 0x9e3779b9);

    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.hx = new Float32Array(count);
    this.hy = new Float32Array(count);
    this.stiff = new Float32Array(count);
    this.zeta = new Float32Array(count);
    this.gatherAt = new Float32Array(count);
    this.releaseAt = new Float32Array(count);
    this.phaseOf = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      this.px[i] = cloud.cx + Math.cos(a) * r * cloud.rx;
      this.py[i] = cloud.cy + Math.sin(a) * r * cloud.ry;
      const sa = rand() * Math.PI * 2;
      const ss = 20 + rand() * 55;
      this.vx[i] = Math.cos(sa) * ss;
      this.vy[i] = Math.sin(sa) * ss;
      this.stiff[i] = SWARM.stiffnessMin + rand() * SWARM.stiffnessSpan;
      this.zeta[i] = SWARM.zetaMin + rand() * SWARM.zetaSpan;
      this.phaseOf[i] = rand() * Math.PI * 2;
      this.releaseAt[i] = rand();
    }

    this.buckets = buildBuckets(count, rand);
    this.setHomes(homes);
  }

  /**
   * Re-target the swarm. This is how a settle changes its destination: the
   * specks that were the OLD buffer become the specks that are the NEW one, and
   * because it is the same speck array, the exchange is continuous.
   *
   * Arrival order is left-to-right across the homes, softened so the wavefront
   * is ragged rather than a ruled line sweeping the frame.
   */
  setHomes(homes: Float32Array): void {
    const n = this.count;
    const rand = mulberry32(homes.length ^ 0x2545f491);
    for (let i = 0; i < n; i++) {
      const j = (i * 2) % Math.max(2, homes.length);
      this.hx[i] = homes[j];
      this.hy[i] = homes[j + 1];
    }
    const key = new Float32Array(n);
    for (let i = 0; i < n; i++) key[i] = this.hx[i] + (rand() - 0.5) * SWARM.staggerJitter;
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    const sorted = Array.from(order).sort((a, b) => key[a] - key[b]);
    const denom = n - 1 || 1;
    for (let rank = 0; rank < n; rank++) this.gatherAt[sorted[rank]] = rank / denom;
  }

  /**
   * Integrate one step.
   *
   * `pull` is the settle phase: 0 is a free-drifting flock, 1 is fully settled.
   * `release` is the outward impulse of a break-up, loudest in the middle of it.
   * Both come from `fieldPhase`.
   */
  update(dt: number, clock: number, pull: number, release: number, cloud: Cloud): void {
    const wind = this.wind;
    const wz = clock * SWARM.windTime;
    const p0 = clamp01(pull);
    const rel = clamp01(release);

    for (let i = 0; i < this.count; i++) {
      const x = this.px[i];
      const y = this.py[i];

      // Staggered arrival: each speck reaches full pull at its own moment.
      const s = this.gatherAt[i] * SWARM.staggerSpread;
      const p = clamp01((p0 - s) / (1 - SWARM.staggerSpread));

      curl(this.noise, x * SWARM.windSpace, y * SWARM.windSpace, wz, SWARM.curlEpsilon, wind);
      const windAmp =
        SWARM.windDrift * (SWARM.windRest + (1 - SWARM.windRest) * (1 - p)) * (1 + rel * 1.6);
      let ax = wind.x * windAmp;
      let ay = wind.y * windAmp;

      // Idle cohesion — a flock holds together even when it is going nowhere.
      const free = 1 - p;
      const dcx = cloud.cx - x;
      const dcy = cloud.cy - y;
      ax += dcx * SWARM.cohesion * free;
      ay += dcy * SWARM.cohesion * free;

      const nx = dcx / cloud.rx;
      const ny = dcy / cloud.ry;
      const rr = Math.sqrt(nx * nx + ny * ny);
      if (rr > 1) {
        const k = ((rr - 1) * SWARM.contain * free) / rr;
        ax += nx * k;
        ay += ny * k;
      }

      let damp = SWARM.drag;

      if (p > 0.001) {
        // Homes breathe, so a settled form is alive rather than printed.
        const bx = this.hx[i] + Math.sin(clock * SWARM.breatheRateX + this.phaseOf[i]) * SWARM.breatheAmpX;
        const by =
          this.hy[i] + Math.cos(clock * SWARM.breatheRateY + this.phaseOf[i] * 1.7) * SWARM.breatheAmpY;
        const dx = bx - x;
        const dy = by - y;
        const k = this.stiff[i] * p;
        ax += dx * k;
        ay += dy * k;

        // Gravity bias while still far from home: specks come DOWN into place.
        const dist = Math.hypot(dx, dy);
        ay += SWARM.fallIn * p * clamp01(dist / SWARM.fallRange);

        damp += 2 * Math.sqrt(this.stiff[i]) * this.zeta[i] * p;
      }

      if (rel > 0) {
        const own = rel * (0.45 + this.releaseAt[i] * 0.9);
        ay -= SWARM.releaseUp * own;
        const ox = x - cloud.cx;
        const oy = y - cloud.cy;
        const ol = Math.hypot(ox, oy) || 1;
        ax += (ox / ol) * SWARM.releaseOut * own;
        ay += (oy / ol) * SWARM.releaseOut * own * 0.35;
      }

      let nvx = this.vx[i] + ax * dt;
      let nvy = this.vy[i] + ay * dt;
      const decay = Math.exp(-damp * dt);
      nvx *= decay;
      nvy *= decay;

      this.vx[i] = nvx;
      this.vy[i] = nvy;
      this.px[i] = x + nvx * dt;
      this.py[i] = y + nvy * dt;
    }
  }

  /** The batch handed to `Surface.specks`. Struct-of-arrays, ready for WebGL. */
  batch(): SpeckBatch {
    return {
      count: this.count,
      x: this.px,
      y: this.py,
      vx: this.vx,
      vy: this.vy,
      buckets: this.buckets as readonly SpeckBucket[],
    };
  }
}

/**
 * Style membership is computed once and never changes, so the whole field draws
 * in a few dozen stroke calls instead of one per speck.
 */
function buildBuckets(count: number, rand: () => number): MutableBucket[] {
  const sizes = FIELD.sizes;
  const alphas = FIELD.alphas;
  const styleOf = new Uint8Array(count);
  const stride = sizes.length * alphas.length;

  for (let i = 0; i < count; i++) {
    const ci = pickWeighted(rand, INK.map((k) => k.weight));
    const si = pickWeighted(rand, sizes.map((s) => s[1]));
    const ai = pickWeighted(rand, alphas.map((a) => a[1]));
    styleOf[i] = ci * stride + si * alphas.length + ai;
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const s = styleOf[i];
    const g = groups.get(s);
    if (g === undefined) groups.set(s, [i]);
    else g.push(i);
  }

  const out: MutableBucket[] = [];
  for (const [style, members] of groups) {
    const ci = Math.floor(style / stride);
    const rest = style % stride;
    const si = Math.floor(rest / alphas.length);
    const ai = rest % alphas.length;
    out.push({
      color: INK[ci].hex,
      alpha: alphas[ai][0],
      width: sizes[si][0],
      index: Uint32Array.from(members),
    });
  }
  return out;
}

function pickWeighted(rand: () => number, weights: readonly number[]): number {
  let r = rand();
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// ===========================================================================
// Homes — where a settling swarm is settling TO
// ===========================================================================

/**
 * Sample speck homes from a set of closed shapes.
 *
 * The load-bearing idea, carried straight out of the approved study: the form
 * is a DENSITY FIELD, and homes are drawn from it by rejection sampling. Nobody
 * ever computes an outline for the specks to sit on. Where the density is high
 * they pile up and read as solid; where it falls off they thin out and the edge
 * feathers on its own.
 *
 * That is how the starlings ARE the whale. A stencil would place specks ON a
 * shape; this places them ACCORDING TO a shape, and the shape is only ever an
 * inference the eye makes about where the dots are thick.
 *
 * Implementation: scanline-rasterise the union of the shapes into a coarse
 * mask, feather it, weight it with sediment (heavier at the bottom, as in the
 * funnel), then reject-sample. No DOM, no canvas — this runs where the trace
 * runs.
 */
export function sampleHomes(shapes: readonly Path[], count: number, seed: number): Float32Array {
  const homes = new Float32Array(count * 2);
  if (shapes.length === 0 || count <= 0) return homes;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of shapes) {
    for (const p of s) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
  }
  const pad = MOTION.maskCell * (MOTION.maskFeather + 1);
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;

  const cell = MOTION.maskCell;
  const gw = Math.max(2, Math.ceil((x1 - x0) / cell));
  const gh = Math.max(2, Math.ceil((y1 - y0) / cell));
  const mask = rasterise(shapes, x0, y0, cell, gw, gh);
  feather(mask, gw, gh, MOTION.maskFeather);

  // Sediment: heavier at the bottom of the form than at the top.
  for (let gy = 0; gy < gh; gy++) {
    const w = lerp(MOTION.sedimentTop, MOTION.sedimentBottom, gh > 1 ? gy / (gh - 1) : 0);
    for (let gx = 0; gx < gw; gx++) mask[gy * gw + gx] *= w;
  }

  let peak = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > peak) peak = mask[i];
  if (peak <= 0) {
    // Degenerate (a shape with no area): pack the specks on the bounding box.
    const rand = mulberry32(seed ^ 0x1d872b41);
    for (let i = 0; i < count; i++) {
      homes[i * 2] = lerp(x0, x1, rand());
      homes[i * 2 + 1] = lerp(y0, y1, rand());
    }
    return homes;
  }

  const rand = mulberry32(seed ^ 0x1d872b41);
  let placed = 0;
  let guard = count * FIELD.samplingGuard;
  while (placed < count && guard-- > 0) {
    const fx = rand() * gw;
    const fy = rand() * gh;
    const d = mask[Math.min(gh - 1, fy | 0) * gw + Math.min(gw - 1, fx | 0)];
    if (rand() * peak < d) {
      homes[placed * 2] = x0 + fx * cell;
      homes[placed * 2 + 1] = y0 + fy * cell;
      placed++;
    }
  }
  while (placed < count) {
    homes[placed * 2] = lerp(x0, x1, rand());
    homes[placed * 2 + 1] = lerp(y0, y1, rand());
    placed++;
  }
  return homes;
}

/** Even-odd scanline fill of a polygon union into a coarse float mask. */
function rasterise(
  shapes: readonly Path[],
  x0: number,
  y0: number,
  cell: number,
  gw: number,
  gh: number,
): Float32Array {
  const mask = new Float32Array(gw * gh);
  const xs: number[] = [];
  for (let gy = 0; gy < gh; gy++) {
    const wy = y0 + (gy + 0.5) * cell;
    xs.length = 0;
    for (const poly of shapes) {
      const n = poly.length;
      if (n < 3) continue;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const a = poly[j];
        const b = poly[i];
        if (a.y === b.y) continue;
        if (wy >= Math.min(a.y, b.y) && wy < Math.max(a.y, b.y)) {
          xs.push(a.x + ((wy - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.floor((xs[k] - x0) / cell));
      const to = Math.min(gw - 1, Math.ceil((xs[k + 1] - x0) / cell));
      for (let gx = from; gx <= to; gx++) mask[gy * gw + gx] = 1;
    }
  }
  return mask;
}

/** Separable box blur. This band IS the drawn edge of the form. */
function feather(mask: Float32Array, gw: number, gh: number, radius: number): void {
  if (radius <= 0) return;
  const tmp = new Float32Array(mask.length);
  const span = radius * 2 + 1;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(gw - 1, Math.max(0, gx + k));
        sum += mask[gy * gw + sx];
      }
      tmp[gy * gw + gx] = sum / span;
    }
  }
  for (let gx = 0; gx < gw; gx++) {
    for (let gy = 0; gy < gh; gy++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(gh - 1, Math.max(0, gy + k));
        sum += tmp[sy * gw + gx];
      }
      mask[gy * gw + gx] = sum / span;
    }
  }
}

// ===========================================================================
// Path helpers (local copies so motions never import the renderer's drawing)
// ===========================================================================

function pathLength(path: Path): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

function samplePath(path: Path, t: number): Pt {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  const total = pathLength(path);
  if (total < 1e-6) return path[0];
  let want = clamp01(t) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    if (want <= seg) {
      const u = seg < 1e-9 ? 0 : want / seg;
      return {
        x: lerp(path[i - 1].x, path[i].x, u),
        y: lerp(path[i - 1].y, path[i].y, u),
      };
    }
    want -= seg;
  }
  return path[path.length - 1];
}
