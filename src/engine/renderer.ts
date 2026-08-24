/**
 * THE RENDERER — everything the engine draws goes through `Surface`, and there
 * is exactly one of it.
 *
 * `Surface` is deliberately small and deliberately *dumb*. It knows how to lay
 * ink on paper; it knows nothing about cells, nodes, traces or algorithms. The
 * five primitives are built on top of these operations, and they are the only
 * thing allowed to call them.
 *
 * ---------------------------------------------------------------------------
 * THE WebGL SEAM
 * ---------------------------------------------------------------------------
 * Exactly one operation's cost scales with element count: `specks`. Everything
 * else draws a handful of paths per frame regardless of how big the structure
 * is. So the seam is drawn precisely there, and there are two ways through it:
 *
 *   1. HYBRID (the cheap swap, and the one this is designed for). Implement
 *      `SpeckRenderer` against a WebGL canvas stacked under the 2D one and pass
 *      it to `createSurface`. Nothing else changes; the hand-drawn work stays on
 *      Canvas 2D where it belongs.
 *   2. FULL. Implement `Surface` entirely in WebGL and return it from wherever
 *      `createSurface` is called. Every method is expressible: paths are
 *      polylines, fills are triangulated polygons, grain and speckle are
 *      textures, glow is a radial sprite, and labels are an atlas.
 *
 * Neither route touches the primitives, the motions, or the trace.
 *
 * Nothing in this file hardcodes a colour, an easing curve, or a texture value.
 * Everything comes from `src/tokens/tokens.ts`.
 */

import {
  ATMOSPHERE,
  FIELD,
  FILL_GRAIN,
  GRAIN,
  GROUND,
  HAND,
  PAPER,
  SEED,
  SHAPE,
  SPECKLE,
  TYPE,
  VIGNETTE,
  clamp01,
} from '../tokens/tokens';
import { Noise, hashId, mulberry32 } from './noise';

// ===========================================================================
// Geometry and style types
// ===========================================================================

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** A drawn path is always a polyline. Curves are sampled before they arrive here. */
export type Path = readonly Pt[];

export interface Viewport {
  /** CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Device pixels per CSS pixel, already clamped. */
  readonly dpr: number;
}

export interface StrokeStyle {
  readonly color: string;
  /** Nominal width in CSS px. The hand pass structure varies it around this. */
  readonly width: number;
  readonly alpha: number;
  /** Stable id for this mark's pressure jitter, so it does not shimmer. */
  readonly seed: number;
  /** Close the polyline back to its first point. */
  readonly closed: boolean;
}

export interface SpeckleStyle {
  readonly color: string;
  /** Share of the shape's area carrying speckle, 0..1. */
  readonly coverage: number;
  /** Short side of the shape in CSS px — speckle sizes are relative to it. */
  readonly scale: number;
}

export interface FillStyle {
  readonly color: string;
  readonly alpha: number;
  /** Stable id for this shape's grain phase and speckle placement. */
  readonly seed: number;
  /** Multiplier on FILL_GRAIN.alpha. 0 disables the tooth over this fill. */
  readonly grain: number;
  /** Surface flecks, or null for a plain fill. */
  readonly speckle: SpeckleStyle | null;
}

export interface GlowStyle {
  readonly color: string;
  readonly alpha: number;
}

export interface LabelStyle {
  readonly color: string;
  /** CSS px. */
  readonly size: number;
  readonly alpha: number;
  readonly align: 'left' | 'center' | 'right';
  readonly baseline: 'top' | 'middle' | 'bottom';
}

// ===========================================================================
// The particle batch — the one structure whose size scales with the scene
// ===========================================================================

/**
 * A draw bucket: every speck in `index` shares a colour, alpha and width, so the
 * whole field renders in a few dozen stroke calls instead of one per speck.
 * Membership is computed once, at construction, and never changes.
 */
export interface SpeckBucket {
  readonly color: string;
  readonly alpha: number;
  readonly width: number;
  readonly index: Uint32Array;
}

/**
 * Struct-of-arrays speck state. This is the shape a WebGL backend wants: four
 * flat Float32Arrays that can be uploaded straight into a vertex buffer.
 */
export interface SpeckBatch {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly buckets: readonly SpeckBucket[];
}

/**
 * The swappable half of the renderer. Implement this against WebGL to take the
 * particle-heavy scenes off Canvas 2D without touching anything else.
 */
export interface SpeckRenderer {
  draw(batch: SpeckBatch, alpha: number): void;
  resize(view: Viewport): void;
  dispose(): void;
}

// ===========================================================================
// The single renderer interface
// ===========================================================================

export interface Surface {
  readonly backend: 'canvas2d' | 'webgl';
  readonly view: Viewport;

  resize(width: number, height: number, dpr: number): void;

  /** Lays the ground and the atmosphere. Call once, first, every frame. */
  begin(clock: number): void;
  /** Lays the vignette and the grain over everything. Call once, last. */
  end(): void;

  /**
   * Fill a closed shape. Body colour, then the tooth, then the flecks — the
   * order that makes a drawn object rather than a swatch.
   */
  fill(path: Path, style: FillStyle): void;

  /**
   * Stroke a polyline as a hand would: several passes at varying width and a
   * pressure profile along its length. `reveal` draws only the leading
   * fraction, so a line can be *drawn on* rather than switched on.
   */
  stroke(path: Path, style: StrokeStyle, reveal: number): void;

  /** A soft radial bloom. The `highlight` primitive's atmosphere. */
  glow(centre: Pt, radius: number, style: GlowStyle): void;

  /** Set text. Values in cells and nodes, index numbers, pointer names. */
  label(text: string, at: Pt, style: LabelStyle): void;

  /** The particle field. The only call whose cost scales with the scene. */
  specks(batch: SpeckBatch, alpha: number): void;

  dispose(): void;
}

// ===========================================================================
// Hand-drawn geometry — shared by every primitive that draws an edge
// ===========================================================================

/**
 * A straight run pushed off the straight by low-frequency noise plus a shallow
 * bow, then tilted slightly off-axis.
 *
 * A ruler-straight, axis-aligned line is the single fastest way to make this
 * look like a chart, so nothing in the grammar is allowed to be one. The wobble
 * amplitude and the tilt are both measured off `line-figure-icon.png`; see the
 * measurement log in the tokens file.
 */
export function handLine(noise: Noise, seed: number, a: Pt, b: Pt): Path {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = Math.hypot(dx, dy);
  if (span < 1e-3) return [a, b];

  const ux = dx / span;
  const uy = dy / span;
  // Perpendicular, for the wobble and the bow.
  const px = -uy;
  const py = ux;

  const steps = Math.round(
    Math.min(
      HAND.maxSamples,
      Math.max(HAND.minSamples, (span / 100) * HAND.samplesPer100px),
    ),
  );

  // Off-axis tilt: a hand does not draw along the axis. Sign comes from the seed.
  const rand = mulberry32(seed >>> 0);
  const tilt = (rand() < 0.5 ? -1 : 1) * HAND.tilt * rand();
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);

  const amp = span * HAND.wobble;
  const bow = span * HAND.bow * (rand() * 2 - 1);
  const key = (seed % 997) * 0.61;

  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Rotate the along-axis component about `a` by the tilt.
    const along = span * t;
    const rx = ux * cos - uy * sin;
    const ry = ux * sin + uy * cos;
    const wobble = noise.noise2(key + t * 3.1, key * 0.37) * amp;
    const arc = Math.sin(t * Math.PI) * bow;
    const off = wobble + arc;
    pts.push({ x: a.x + rx * along + px * off, y: a.y + ry * along + py * off });
  }
  return pts;
}

/**
 * A closed superellipse outline with a wandering boundary — the drawn edge of a
 * cell or a node.
 *
 * `exponent` is 2 for an ellipse and large for a hard rectangle; the tokens
 * carry one value for a cell (squircle) and one for a node (rounded token).
 * The eggs are irregular ellipses, and the icon's paper rectangles have edges
 * that are neither straight nor parallel — this is both of those at once.
 */
export function handOutline(
  noise: Noise,
  seed: number,
  centre: Pt,
  rx: number,
  ry: number,
  exponent: number,
): Path {
  const rand = mulberry32(seed >>> 0);
  const tilt = (rand() < 0.5 ? -1 : 1) * HAND.tilt * rand();
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const key = (seed % 991) * 0.43;
  const short = Math.min(rx, ry);
  const amp = short * HAND.wobble;

  const n = SHAPE.outlineSamples;
  const pts: Pt[] = [];
  const inv = 2 / exponent;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    // Superellipse in polar form: |cos|^(2/e) and |sin|^(2/e), signs preserved.
    const sx = Math.sign(c) * Math.pow(Math.abs(c), inv);
    const sy = Math.sign(s) * Math.pow(Math.abs(s), inv);
    // The boundary itself wanders, so no two shapes feather alike.
    const wob = 1 + noise.noise2(key + Math.cos(th) * 1.7, key + Math.sin(th) * 1.7) * (amp / short);
    const ex = sx * rx * wob;
    const ey = sy * ry * wob;
    pts.push({
      x: centre.x + ex * cos - ey * sin,
      y: centre.y + ex * sin + ey * cos,
    });
  }
  return pts;
}

/** Sample a polyline at arc-length fraction `t`. Used by `flow`. */
export function pointAlong(path: Path, t: number): Pt {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  if (total < 1e-6) return path[0];
  let want = clamp01(t) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    if (want <= seg) {
      const u = seg < 1e-9 ? 0 : want / seg;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * u,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * u,
      };
    }
    want -= seg;
  }
  return path[path.length - 1];
}

/** Unit tangent of a polyline at arc-length fraction `t`. Used for arrowheads. */
export function tangentAlong(path: Path, t: number): Pt {
  if (path.length < 2) return { x: 1, y: 0 };
  const eps = 0.02;
  const a = pointAlong(path, clamp01(t - eps));
  const b = pointAlong(path, clamp01(t + eps));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

// ===========================================================================
// Canvas 2D implementation
// ===========================================================================

function offscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function context2d(c: HTMLCanvasElement, label: string): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (g === null) throw new Error(`renderer: ${label} 2d context unavailable`);
  return g;
}

/** `ctx.letterSpacing` is not in every DOM lib; probe for it rather than assume. */
interface TrackedContext {
  letterSpacing: string;
}

class Canvas2DSurface implements Surface {
  readonly backend = 'canvas2d' as const;

  private viewport: Viewport = { width: 0, height: 0, dpr: 1 };
  private readonly ctx: CanvasRenderingContext2D;
  private noise = new Noise(SEED);

  private ground: HTMLCanvasElement | null = null;
  private grainTile: HTMLCanvasElement | null = null;
  private grainPattern: CanvasPattern | null = null;
  private fillGrainTile: HTMLCanvasElement | null = null;
  private fillGrainPattern: CanvasPattern | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly speckRenderer: SpeckRenderer | null,
  ) {
    this.ctx = context2d(canvas, 'stage');
  }

  get view(): Viewport {
    return this.viewport;
  }

  resize(width: number, height: number, dpr: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const d = dpr > 0 ? dpr : 1;
    this.viewport = { width: w, height: h, dpr: d };

    this.canvas.width = Math.round(w * d);
    this.canvas.height = Math.round(h * d);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.noise = new Noise(SEED);
    const rand = mulberry32(SEED ^ 0x9e3779b9);
    this.ground = this.bakeGround(Math.round(w * d), Math.round(h * d), rand);
    this.grainTile = this.bakeGrain(GRAIN.tile, rand);
    this.fillGrainTile = this.bakeGrain(FILL_GRAIN.tile, rand);
    this.grainPattern = null;
    this.fillGrainPattern = null;

    if (this.speckRenderer !== null) this.speckRenderer.resize(this.viewport);
  }

  // --- frame ---------------------------------------------------------------

  begin(clock: number): void {
    const { width: w, height: h } = this.viewport;
    const ctx = this.ctx;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.ground !== null) ctx.drawImage(this.ground, 0, 0);
    ctx.restore();

    this.applyTransform();
    this.drawAtmosphere(w, h, clock);
  }

  end(): void {
    const { width: w, height: h, dpr } = this.viewport;
    const ctx = this.ctx;

    this.drawVignette(w, h);

    if (this.grainTile !== null) {
      if (this.grainPattern === null) this.grainPattern = ctx.createPattern(this.grainTile, 'repeat');
      if (this.grainPattern !== null) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = GRAIN.alpha;
        ctx.fillStyle = this.grainPattern;
        ctx.fillRect(0, 0, Math.round(w * dpr), Math.round(h * dpr));
        ctx.restore();
      }
    }
    this.applyTransform();
  }

  private applyTransform(): void {
    const d = this.viewport.dpr;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  // --- shapes --------------------------------------------------------------

  fill(path: Path, style: FillStyle): void {
    if (path.length < 3 || style.alpha <= 0.001) return;
    const ctx = this.ctx;

    ctx.save();
    this.trace(path, true);
    ctx.clip();

    // 1. body
    ctx.globalAlpha = style.alpha;
    ctx.fillStyle = style.color;
    ctx.fill();

    // 2. the tooth over the fill
    if (style.grain > 0.001 && this.fillGrainTile !== null) {
      if (this.fillGrainPattern === null) {
        this.fillGrainPattern = ctx.createPattern(this.fillGrainTile, 'repeat');
      }
      if (this.fillGrainPattern !== null) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = FILL_GRAIN.alpha * style.grain * style.alpha;
        ctx.fillStyle = this.fillGrainPattern;
        const b = bounds(path);
        ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // 3. the flecks
    const sp = style.speckle;
    if (sp !== null && sp.coverage > 0.0005 && sp.scale > 1) {
      this.drawSpeckle(path, style.seed, sp, style.alpha);
    }

    ctx.restore();
  }

  private drawSpeckle(path: Path, seed: number, sp: SpeckleStyle, alpha: number): void {
    const ctx = this.ctx;
    const b = bounds(path);
    const area = (b.x1 - b.x0) * (b.y1 - b.y0);
    const meanR = sp.scale * (SPECKLE.minRadius + SPECKLE.maxRadius) * 0.5;
    const meanArea = Math.PI * meanR * meanR;
    if (meanArea < 1e-6) return;
    const count = Math.min(SPECKLE.maxCount, Math.round((area * sp.coverage) / meanArea));
    if (count <= 0) return;

    const rand = mulberry32(seed ^ 0x51ed);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = SPECKLE.alpha * alpha;
    ctx.fillStyle = sp.color;
    for (let i = 0; i < count; i++) {
      const x = b.x0 + rand() * (b.x1 - b.x0);
      const y = b.y0 + rand() * (b.y1 - b.y0);
      let r = sp.scale * (SPECKLE.minRadius + rand() * (SPECKLE.maxRadius - SPECKLE.minRadius));
      if (rand() < SPECKLE.blotChance) r *= SPECKLE.blotScale;
      // Flecks are not circles — the measured ones are irregular blots.
      const sx = 0.7 + rand() * 0.6;
      const sy = 0.7 + rand() * 0.6;
      ctx.beginPath();
      ctx.ellipse(x, y, r * sx, r * sy, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  stroke(path: Path, style: StrokeStyle, reveal: number): void {
    if (path.length < 2 || style.alpha <= 0.001) return;
    const ctx = this.ctx;
    const pts = style.closed ? [...path, path[0]] : path;
    const last = Math.max(1, Math.floor((pts.length - 1) * clamp01(reveal)));

    ctx.save();
    // Ink on paper: multiply keeps the ground's warmth visible through the mark.
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = style.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const key = (style.seed % 983) * 1.7;
    for (const [wMul, aMul, offset] of HAND.passes) {
      ctx.globalAlpha = style.alpha * aMul;
      for (let i = 0; i < last; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const t = i / (pts.length - 1);
        const press =
          HAND.pressureBase + HAND.pressureSwing * Math.pow(Math.sin(clamp01(t) * Math.PI), HAND.pressureExp);
        const jitterN = this.noise.noise2(key + t * 6.2, key) * 0.5 + 0.5;
        const jitter = HAND.widthLow + (HAND.widthHigh - HAND.widthLow) * jitterN;
        ctx.lineWidth = Math.max(HAND.minStroke * 0.4, style.width * wMul * press * jitter);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + offset);
        ctx.lineTo(b.x, b.y + offset);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  glow(centre: Pt, radius: number, style: GlowStyle): void {
    if (radius <= 0 || style.alpha <= 0.001) return;
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(centre.x, centre.y, radius * 0.15, centre.x, centre.y, radius);
    g.addColorStop(0, withAlpha(style.color, style.alpha));
    g.addColorStop(0.55, withAlpha(style.color, style.alpha * 0.45));
    g.addColorStop(1, withAlpha(style.color, 0));
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(centre.x - radius, centre.y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  label(text: string, at: Pt, style: LabelStyle): void {
    if (text.length === 0 || style.alpha <= 0.001) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = style.alpha;
    ctx.fillStyle = style.color;
    ctx.font = `${style.size}px ${TYPE.family}`;
    ctx.textAlign = style.align;
    ctx.textBaseline = style.baseline;
    const tracked = ctx as unknown as Partial<TrackedContext>;
    if (typeof tracked.letterSpacing === 'string') {
      tracked.letterSpacing = `${TYPE.tracking}em`;
    }
    ctx.fillText(text, at.x, at.y);
    ctx.restore();
  }

  // --- the seam ------------------------------------------------------------

  specks(batch: SpeckBatch, alpha: number): void {
    if (this.speckRenderer !== null) {
      this.speckRenderer.draw(batch, alpha);
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    // Overlapping buckets accumulate into the dark core; density does the tonal
    // work, exactly as in the funnel and the murmuration.
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const b of batch.buckets) {
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = b.alpha * alpha;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      const idx = b.index;
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n];
        const vx = batch.vx[i];
        const vy = batch.vy[i];
        const speed = Math.hypot(vx, vy);
        const half = Math.min(speed * FIELD.blurSeconds, FIELD.blurMax);
        const s = speed > 1e-4 ? half / speed : 0;
        const ex = vx * s;
        const ey = vy * s;
        const px = batch.x[i];
        const py = batch.y[i];
        // The 0.01 keeps a zero-length subpath from being culled: a motionless
        // speck must still render as a round dot.
        ctx.moveTo(px - ex, py - ey);
        ctx.lineTo(px + ex + 0.01, py + ey);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  dispose(): void {
    if (this.speckRenderer !== null) this.speckRenderer.dispose();
    this.ground = null;
    this.grainTile = null;
    this.grainPattern = null;
    this.fillGrainTile = null;
    this.fillGrainPattern = null;
  }

  // --- ground, atmosphere, vignette, grain ---------------------------------

  private bakeGround(deviceW: number, deviceH: number, rand: () => number): HTMLCanvasElement {
    const c = offscreen(deviceW, deviceH);
    const g = context2d(c, 'ground');

    const grad = g.createLinearGradient(0, 0, deviceW * GROUND.gradientAngleX, deviceH);
    grad.addColorStop(0, PAPER.cool);
    grad.addColorStop(GROUND.gradientMid, PAPER.base);
    grad.addColorStop(1, PAPER.warm);
    g.fillStyle = grad;
    g.fillRect(0, 0, deviceW, deviceH);

    // Low-frequency blotching, rendered small and scaled up so it arrives as
    // soft cloud rather than as noise.
    const mw = Math.max(2, Math.round(deviceW / GROUND.mottleDivisor));
    const mh = Math.max(2, Math.round(deviceH / GROUND.mottleDivisor));
    const mc = offscreen(mw, mh);
    const mg = context2d(mc, 'mottle');
    const img = mg.createImageData(mw, mh);
    const seedX = rand() * 100;
    const seedY = rand() * 100;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const n = this.noise.fbm2(
          seedX + x * GROUND.mottleFrequency,
          seedY + y * GROUND.mottleFrequency,
          GROUND.mottleOctaves,
        );
        const o = (y * mw + x) * 4;
        const v = n * GROUND.mottleAmplitude;
        img.data[o] = 128 + v * GROUND.mottleWarmR;
        img.data[o + 1] = 128 + v * GROUND.mottleWarmG;
        img.data[o + 2] = 128 + v * GROUND.mottleWarmB;
        img.data[o + 3] = 255;
      }
    }
    mg.putImageData(img, 0, 0);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = GROUND.mottleAlpha;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(mc, 0, 0, deviceW, deviceH);
    g.restore();

    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < GROUND.hazePools; i++) {
      const cx = deviceW * (0.12 + rand() * 0.76);
      const cy = deviceH * (0.05 + rand() * 0.35);
      const r = deviceW * (GROUND.hazeRadiusMin + rand() * GROUND.hazeRadiusSpan);
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, withAlpha(PAPER.haze, GROUND.hazeAlpha));
      rg.addColorStop(1, withAlpha(PAPER.haze, 0));
      g.fillStyle = rg;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();

    return c;
  }

  /**
   * The grain is deliberately static. Film grain that boils would read as
   * noise-for-effect; paper does not shimmer. Atmospheric stillness is Level 2.
   */
  private bakeGrain(size: number, rand: () => number): HTMLCanvasElement {
    const c = offscreen(size, size);
    const g = context2d(c, 'grain');
    const img = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (rand() - GRAIN.bias) * GRAIN.amplitude;
      const o = i * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  private drawAtmosphere(w: number, h: number, clock: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const ax = w * (0.34 + Math.sin(clock * ATMOSPHERE.driftA) * ATMOSPHERE.swing);
    const ay = h * (0.3 + Math.cos(clock * ATMOSPHERE.driftB) * (ATMOSPHERE.swing * 0.83));
    const ar = Math.max(w, h) * ATMOSPHERE.coolRadius;
    const ga = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar);
    ga.addColorStop(0, withAlpha(PAPER.haze, ATMOSPHERE.coolAlpha));
    ga.addColorStop(1, withAlpha(PAPER.haze, 0));
    ctx.fillStyle = ga;
    ctx.fillRect(0, 0, w, h);

    const bx = w * (0.7 + Math.cos(clock * ATMOSPHERE.driftC) * (ATMOSPHERE.swing * 1.17));
    const by = h * (0.72 + Math.sin(clock * ATMOSPHERE.driftD) * (ATMOSPHERE.swing * 0.83));
    const br = Math.max(w, h) * ATMOSPHERE.warmRadius;
    const gb = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    gb.addColorStop(0, withAlpha(PAPER.warm, ATMOSPHERE.warmAlpha));
    gb.addColorStop(1, withAlpha(PAPER.warm, 0));
    ctx.fillStyle = gb;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  private drawVignette(w: number, h: number): void {
    const ctx = this.ctx;
    const r = Math.hypot(w, h) * VIGNETTE.radius;
    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      r * VIGNETTE.innerStop,
      w * 0.5,
      h * 0.48,
      r,
    );
    g.addColorStop(0, withAlpha(PAPER.edge, 0));
    g.addColorStop(VIGNETTE.midStop, withAlpha(PAPER.edge, VIGNETTE.midAlpha));
    g.addColorStop(1, withAlpha(PAPER.edge, VIGNETTE.outerAlpha));
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private trace(path: Path, close: boolean): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    if (close) ctx.closePath();
  }
}

// ===========================================================================
// Helpers
// ===========================================================================

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function bounds(path: Path): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of path) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** `#rrggbb` + alpha -> `rgba(...)`. The tokens hold hex; canvas wants rgba. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  const n = Number.parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

/** Deterministic per-element seed. Identity in, jitter out, no state. */
export function seedOf(id: string, salt = 0): number {
  return hashId(id, SEED ^ salt);
}

// ===========================================================================
// Construction
// ===========================================================================

/**
 * Build the one renderer. Pass a `SpeckRenderer` to move the particle field
 * onto WebGL without touching anything else; pass null (the default) to run
 * everything on Canvas 2D.
 */
export function createSurface(
  canvas: HTMLCanvasElement,
  speckRenderer: SpeckRenderer | null = null,
): Surface {
  return new Canvas2DSurface(canvas, speckRenderer);
}
