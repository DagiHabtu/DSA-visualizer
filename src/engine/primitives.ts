/**
 * THE FIVE SPATIAL PRIMITIVES. There are no others, and there will not be.
 *
 *   1. particleField  a cloud of many small dots that settles into a shape or
 *                     scatters out of one. The signature move.
 *   2. cell           a single indexed slot. Array indices, hash buckets, the
 *                     flat array a heap lives in.
 *   3. node           a rounded token holding a value. List nodes, tree nodes,
 *                     graph vertices.
 *   4. link           a connecting line between nodes. Directed = a pointer.
 *   5. highlight      transient emphasis: "the algorithm is looking HERE".
 *                     This is how invariants become visible.
 *
 * ---------------------------------------------------------------------------
 * THE REGISTER — where cell and node come from
 * ---------------------------------------------------------------------------
 * `eggs-as-figure.png` is the ancestor of cell and node, and its lesson is that
 * a figure can emerge from DISCRETE, individually-detailed objects and not only
 * from a swarm. Each egg is its own thing: irregular ellipse, varied size, its
 * own speckled surface, its own colourway drawn from one shared family. The "5"
 * reads only because of how they are ARRANGED. That is emergence without
 * particles, and it is the register a row of array cells and a linked-list node
 * must sit in — individually drawn, never stamped clones.
 *
 * `line-figure-icon.png` is the ancestor of link and of every drawn edge: one
 * continuous confident stroke of uneven weight laid down in a single gesture,
 * over paper rectangles whose edges are wobbly, non-parallel, and slightly
 * offset from each other. The target is a DRAWN line, not a vector line with
 * noise added to it.
 *
 * ---------------------------------------------------------------------------
 * THE GUARDRAIL
 * ---------------------------------------------------------------------------
 * Emergence is a signature, not a law. `particleField` is one primitive among
 * five, not the substrate the other four are made of. A cell is a drawn object.
 * A node is a drawn object. A linked list is about the POINTERS BETWEEN NODES,
 * and it must never be rendered as a particle cloud. The algorithmic concept
 * always wins.
 *
 * Every primitive here is a pure draw call: geometry in, ink on the surface, no
 * state kept. Where an element is at this instant is a motion's business, not a
 * primitive's. Identity comes in as a string `id`, and every wobble, freckle and
 * jitter derives from it — so a cell drawn twice is drawn identically, and
 * stepping a trace backward never re-rolls anything.
 */

import {
  ACCENT,
  ACCENT_ALPHA,
  HAND,
  LINE,
  SEED,
  SHAPE,
  SHELL,
  SHELL_ROLE,
  TYPE,
  clamp01,
  lerp,
  type Colourway,
} from '../tokens/tokens';
import { Noise, mulberry32 } from './noise';
import {
  handLine,
  handOutline,
  seedOf,
  tangentAlong,
  pointAlong,
  type FillStyle,
  type Path,
  type Pt,
  type SpeckBatch,
  type StrokeStyle,
  type Surface,
} from './renderer';

/**
 * One shared noise field for every drawn edge in the engine. Shared on purpose:
 * two cells side by side sample the same field at different places, so their
 * edges wander differently but belong to the same hand.
 */
const HAND_NOISE = new Noise(SEED);

// ===========================================================================
// Shared vocabulary
// ===========================================================================

/** What a drawn element currently is. Three states, and they mean three things. */
export type Status =
  /** Present and holding a value. */
  | 'live'
  /** Present and holding nothing — an allocated slot with no value in it. */
  | 'empty'
  /** Was here. A released buffer, a tombstone. Drawn faint, never removed abruptly. */
  | 'stale';

/** Which question a highlight is answering. Three tones, three questions. */
export type Tone =
  /** "The algorithm is looking here, now." */
  | 'focus'
  /** "These are being weighed against each other." */
  | 'compare'
  /** "This region is settled; the invariant holds here." */
  | 'decided';

const TONE_COLOR: Readonly<Record<Tone, string>> = {
  focus: ACCENT.focus,
  compare: ACCENT.compare,
  decided: ACCENT.decided,
};

/**
 * Pick this element's colourway out of the shared family.
 *
 * The eggs are individually coloured but they are unmistakably ONE clutch. So:
 * a stable choice from the measured family, plus a small drift within it, keyed
 * on the element's own id. Never a random per-frame roll.
 */
export function colourwayFor(id: string, status: Status): Colourway {
  if (status === 'stale') return SHELL_ROLE.stale;
  if (status === 'empty') return SHELL_ROLE.empty;
  const rand = mulberry32(seedOf(id, 0x1f));
  const pick = SHELL[Math.floor(rand() * SHELL.length) % SHELL.length];
  // Drift the speckle density a little so two cells sharing a body colour still
  // do not look like the same object printed twice.
  const drift = 0.75 + rand() * 0.5;
  return { body: pick.body, speck: pick.speck, speckle: clamp01(pick.speckle * drift) };
}

/** Stroke width for a figure of this size, from the measured icon ratio. */
function strokeWidthFor(shortSide: number): number {
  return Math.min(HAND.maxStroke, Math.max(HAND.minStroke, shortSide * HAND.strokeScale));
}

function fillStyle(
  seed: number,
  way: Colourway,
  alpha: number,
  shortSide: number,
): FillStyle {
  return {
    color: way.body,
    alpha,
    seed,
    grain: 1,
    speckle:
      way.speckle > 0.0005
        ? { color: way.speck, coverage: way.speckle, scale: shortSide }
        : null,
  };
}

function strokeStyle(seed: number, color: string, width: number, alpha: number, closed: boolean): StrokeStyle {
  return { color, width, alpha, seed, closed };
}

/** Per-element size and centre jitter — the eggs' varied sizes, held on a tight rein. */
interface Jitter {
  readonly sx: number;
  readonly sy: number;
  readonly dx: number;
  readonly dy: number;
}

function jitterFor(id: string): Jitter {
  const rand = mulberry32(seedOf(id, 0x2b));
  const s = SHAPE.sizeJitter;
  const a = SHAPE.aspectJitter;
  const c = SHAPE.centreJitter;
  return {
    sx: 1 + (rand() * 2 - 1) * s + (rand() * 2 - 1) * a * 0.5,
    sy: 1 + (rand() * 2 - 1) * s - (rand() * 2 - 1) * a * 0.5,
    dx: (rand() * 2 - 1) * c,
    dy: (rand() * 2 - 1) * c,
  };
}

// ===========================================================================
// 1. PARTICLE FIELD
// ===========================================================================

export interface ParticleFieldSpec {
  /**
   * Speck state, produced by `Swarm.batch()`. The primitive does not simulate;
   * the simulation is `settle` at field scale and lives in motions.
   */
  readonly batch: SpeckBatch;
  /** Presence of the whole field, 0..1. */
  readonly presence: number;
}

/**
 * Draw the swarm.
 *
 * Density does all the tonal work. Fringe specks are not more transparent than
 * core specks — there are simply fewer of them, exactly as in the funnel, where
 * the rim and the dense base are the same ink at different concentrations.
 */
export function particleField(surface: Surface, spec: ParticleFieldSpec): void {
  const a = clamp01(spec.presence);
  if (a <= 0.002) return;
  surface.specks(spec.batch, a);
}

// ===========================================================================
// 2. CELL
// ===========================================================================

export interface CellSpec {
  /** Stable identity. Drives this slot's own wobble, freckles and colourway. */
  readonly id: string;
  readonly centre: Pt;
  /** Nominal size in CSS px, before this cell's own jitter. */
  readonly width: number;
  readonly height: number;
  readonly status: Status;
  /** The value in the slot, or null for an allocated-but-empty slot. */
  readonly value: string | null;
  /** The index printed beneath the slot, or null to omit it. */
  readonly index: string | null;
  readonly presence: number;
}

/**
 * A single indexed slot: array index, hash bucket, one element of the flat
 * array a heap lives in.
 *
 * Drawn as the eggs are drawn — an irregular squircle with its own size, its own
 * wandering edge, its own freckles — over an offset paper plate, which is the
 * icon's stacked-rectangle move. Restraint keeps the variation far tighter than
 * the reference's: a row of cells is a lattice and must still read as one.
 */
export function cell(surface: Surface, spec: CellSpec): void {
  const presence = clamp01(spec.presence);
  if (presence <= 0.002) return;

  const seed = seedOf(spec.id, 0x3d);
  const j = jitterFor(spec.id);

  // Appearing elements swell into place rather than popping on.
  const swell = lerp(0.86, 1, presence);
  const rx = (spec.width * 0.5) * j.sx * swell;
  const ry = (spec.height * 0.5) * j.sy * swell;
  const centre: Pt = {
    x: spec.centre.x + j.dx * spec.width,
    y: spec.centre.y + j.dy * spec.height,
  };
  const shortSide = Math.min(rx, ry) * 2;
  const way = colourwayFor(spec.id, spec.status);
  const alpha = presence * (spec.status === 'stale' ? 0.45 : 1);

  // The offset plate — line-figure-icon's second sheet, sitting slightly under
  // and behind the first. Measured at ~7.4% of the figure.
  const off = shortSide * HAND.plateOffset;
  const plate = handOutline(
    HAND_NOISE,
    seed ^ 0x50a7,
    { x: centre.x + off, y: centre.y + off },
    rx,
    ry,
    SHAPE.cellExponent,
  );
  surface.fill(plate, {
    color: LINE.ink,
    alpha: HAND.plateAlpha * alpha,
    seed: seed ^ 0x50a7,
    grain: 0,
    speckle: null,
  });

  const outline = handOutline(HAND_NOISE, seed, centre, rx, ry, SHAPE.cellExponent);
  surface.fill(outline, fillStyle(seed, way, alpha, shortSide));
  surface.stroke(
    outline,
    strokeStyle(seed, LINE.ink, strokeWidthFor(shortSide), alpha * 0.8, true),
    1,
  );

  if (spec.value !== null) {
    surface.label(spec.value, centre, {
      color: LINE.ink,
      size: TYPE.value,
      alpha: alpha * 0.92,
      align: 'center',
      baseline: 'middle',
    });
  }

  if (spec.index !== null) {
    surface.label(
      spec.index,
      { x: centre.x, y: centre.y + ry + TYPE.index * 1.1 },
      {
        color: LINE.ink,
        size: TYPE.index,
        alpha: alpha * 0.5,
        align: 'center',
        baseline: 'middle',
      },
    );
  }
}

// ===========================================================================
// 3. NODE
// ===========================================================================

export interface NodeSpec {
  readonly id: string;
  readonly centre: Pt;
  /** Nominal radius in CSS px, before this node's own jitter. */
  readonly radius: number;
  readonly status: Status;
  readonly value: string | null;
  /** An optional name beneath the node — `head`, `entry`. Null to omit. */
  readonly caption: string | null;
  readonly presence: number;
}

/**
 * A rounded token holding a value: a list node, a tree node, a graph vertex.
 *
 * Same clutch as `cell`, rounder shape. A node is closer to an egg than a cell
 * is — a cell is a slot in a lattice, a node is a thing in its own right — so
 * its superellipse exponent sits nearer to a true ellipse.
 */
export function node(surface: Surface, spec: NodeSpec): void {
  const presence = clamp01(spec.presence);
  if (presence <= 0.002) return;

  const seed = seedOf(spec.id, 0x4e);
  const j = jitterFor(spec.id);
  const swell = lerp(0.86, 1, presence);
  const rx = spec.radius * j.sx * swell;
  const ry = spec.radius * j.sy * swell;
  const centre: Pt = {
    x: spec.centre.x + j.dx * spec.radius,
    y: spec.centre.y + j.dy * spec.radius,
  };
  const shortSide = Math.min(rx, ry) * 2;
  const way = colourwayFor(spec.id, spec.status);
  const alpha = presence * (spec.status === 'stale' ? 0.45 : 1);

  const outline = handOutline(HAND_NOISE, seed, centre, rx, ry, SHAPE.nodeExponent);
  surface.fill(outline, fillStyle(seed, way, alpha, shortSide));
  surface.stroke(
    outline,
    strokeStyle(seed, LINE.ink, strokeWidthFor(shortSide), alpha * 0.8, true),
    1,
  );

  if (spec.value !== null) {
    surface.label(spec.value, centre, {
      color: LINE.ink,
      size: TYPE.value,
      alpha: alpha * 0.92,
      align: 'center',
      baseline: 'middle',
    });
  }

  if (spec.caption !== null) {
    surface.label(
      spec.caption,
      { x: centre.x, y: centre.y + ry + TYPE.mark * 1.3 },
      {
        color: LINE.ink,
        size: TYPE.mark,
        alpha: alpha * 0.55,
        align: 'center',
        baseline: 'middle',
      },
    );
  }
}

// ===========================================================================
// 4. LINK
// ===========================================================================

/** How a link ends. Both are the same primitive; only the last few pixels differ. */
export type LinkEnd =
  /** A plain join — a tree edge, an undirected graph edge. */
  | 'plain'
  /** An arrowhead. This is what makes the link a POINTER. */
  | 'arrow'
  /** A cross-bar: this pointer points at nothing. `next` of the last node. */
  | 'terminal';

export interface LinkSpec {
  readonly id: string;
  readonly from: Pt;
  readonly to: Pt;
  /** Pull the ends back off the two elements, in CSS px. */
  readonly trimFrom: number;
  readonly trimTo: number;
  readonly end: LinkEnd;
  readonly status: Status;
  readonly presence: number;
  /**
   * Draw only the leading fraction. A link arriving under a `flow` is drawn ON
   * rather than switched on — the single confident gesture of the icon.
   */
  readonly reveal: number;
}

/**
 * A connecting line between nodes. The directed variant is a pointer.
 *
 * `line-figure-icon.png` is the whole brief for this primitive: one continuous
 * stroke, uneven weight, drawn in one gesture, never axis-aligned, never
 * straight. The stroke's wobble amplitude and its off-axis tilt are both
 * measured off that icon.
 *
 * A linked list is about the pointers between its nodes. This primitive is
 * where that lives, and it is why the list is never a particle cloud.
 */
export function link(surface: Surface, spec: LinkSpec): void {
  const presence = clamp01(spec.presence);
  if (presence <= 0.002) return;

  const dx = spec.to.x - spec.from.x;
  const dy = spec.to.y - spec.from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return;

  const ux = dx / dist;
  const uy = dy / dist;
  const a: Pt = { x: spec.from.x + ux * spec.trimFrom, y: spec.from.y + uy * spec.trimFrom };
  const b: Pt = { x: spec.to.x - ux * spec.trimTo, y: spec.to.y - uy * spec.trimTo };
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  if (span < 1e-3) return;

  const seed = seedOf(spec.id, 0x5c);
  const path = handLine(HAND_NOISE, seed, a, b);
  const width = strokeWidthFor(span * 0.5);
  const alpha = presence * (spec.status === 'stale' ? LINE.ghostAlpha : 0.9);
  const reveal = clamp01(spec.reveal);

  surface.stroke(path, strokeStyle(seed, LINE.ink, width, alpha, false), reveal);

  if (reveal > 0.985) {
    if (spec.end === 'arrow') drawArrow(surface, path, seed, width, alpha);
    else if (spec.end === 'terminal') drawTerminal(surface, path, seed, width, alpha);
  }
}

function drawArrow(surface: Surface, path: Path, seed: number, width: number, alpha: number): void {
  const tip = pointAlong(path, 1);
  const dir = tangentAlong(path, 1);
  const len = Math.max(5, width * 3.4);
  const spread = 0.42;
  const cos = Math.cos(spread);
  const sin = Math.sin(spread);
  const left: Pt = {
    x: tip.x - (dir.x * cos - dir.y * sin) * len,
    y: tip.y - (dir.x * sin + dir.y * cos) * len,
  };
  const right: Pt = {
    x: tip.x - (dir.x * cos + dir.y * sin) * len,
    y: tip.y - (-dir.x * sin + dir.y * cos) * len,
  };
  const style = strokeStyle(seed ^ 0xa77, LINE.ink, width, alpha * LINE.arrowAlpha, false);
  surface.stroke(handLine(HAND_NOISE, seed ^ 0xa77, left, tip), style, 1);
  surface.stroke(handLine(HAND_NOISE, seed ^ 0xa78, right, tip), style, 1);
}

/** A pointer that points at nothing: a short bar across the end of the stroke. */
function drawTerminal(surface: Surface, path: Path, seed: number, width: number, alpha: number): void {
  const tip = pointAlong(path, 1);
  const dir = tangentAlong(path, 1);
  const half = Math.max(4, width * 2.6);
  const a: Pt = { x: tip.x - dir.y * half, y: tip.y + dir.x * half };
  const b: Pt = { x: tip.x + dir.y * half, y: tip.y - dir.x * half };
  surface.stroke(
    handLine(HAND_NOISE, seed ^ 0xb17, a, b),
    strokeStyle(seed ^ 0xb17, LINE.ink, width, alpha * LINE.arrowAlpha, false),
    1,
  );
}

// ===========================================================================
// 5. HIGHLIGHT
// ===========================================================================

/** What a highlight is drawn around. Both shapes are the same primitive. */
export type HighlightShape =
  /** A single element: a cell, a node. */
  | { readonly kind: 'ring'; readonly centre: Pt; readonly rx: number; readonly ry: number }
  /**
   * A run of elements. This is how an invariant over a REGION becomes visible —
   * "everything outside the two pointers is decided" is a span, not a ring.
   */
  | {
      readonly kind: 'span';
      readonly x0: number;
      readonly y0: number;
      readonly x1: number;
      readonly y1: number;
    };

export interface HighlightSpec {
  readonly id: string;
  readonly shape: HighlightShape;
  readonly tone: Tone;
  /** The pointer's name: `left`, `fast`, `i`. Null to omit. */
  readonly label: string | null;
  /** 0..1. Highlights are transient; this is how present this one is. */
  readonly strength: number;
}

/**
 * Transient emphasis marking where the algorithm is looking.
 *
 * This primitive is how invariants become visible, and it is the direct answer
 * to what a book leaves you unable to see: which two things are being compared,
 * where the two pointers are, which region has already been decided. A ring for
 * one element; a wash for a region.
 *
 * Deliberately quiet. The wash alpha is near-subliminal by design — a highlight
 * that shouts turns the frame into a dashboard, and Level 2 outranks it.
 */
export function highlight(surface: Surface, spec: HighlightSpec): void {
  const s = clamp01(spec.strength);
  if (s <= 0.002) return;

  const color = TONE_COLOR[spec.tone];
  const seed = seedOf(spec.id, 0x6f);

  if (spec.shape.kind === 'ring') {
    const { centre, rx, ry } = spec.shape;
    const radius = Math.max(rx, ry) * 1.55;
    surface.glow(centre, radius, { color, alpha: ACCENT_ALPHA.glow * s });

    const ring = handOutline(
      HAND_NOISE,
      seed,
      centre,
      rx * 1.18,
      ry * 1.18,
      SHAPE.nodeExponent,
    );
    surface.stroke(
      ring,
      strokeStyle(seed, color, strokeWidthFor(Math.min(rx, ry) * 2), ACCENT_ALPHA.ring * s, true),
      1,
    );

    if (spec.label !== null) {
      surface.label(
        spec.label,
        { x: centre.x, y: centre.y - ry * 1.18 - TYPE.mark * 1.4 },
        {
          color,
          size: TYPE.mark,
          alpha: ACCENT_ALPHA.label * s,
          align: 'center',
          baseline: 'middle',
        },
      );
    }
    return;
  }

  const { x0, y0, x1, y1 } = spec.shape;
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;

  const band = handOutline(
    HAND_NOISE,
    seed,
    { x: x0 + w * 0.5, y: y0 + h * 0.5 },
    w * 0.5,
    h * 0.5,
    SHAPE.cellExponent,
  );
  surface.fill(band, {
    color,
    alpha: ACCENT_ALPHA.wash * s,
    seed,
    grain: 0.5,
    speckle: null,
  });

  // A single rule under the span, so the region has an edge without a box.
  const rule = handLine(
    HAND_NOISE,
    seed ^ 0x9a1,
    { x: x0, y: y1 },
    { x: x1, y: y1 },
  );
  surface.stroke(
    rule,
    strokeStyle(seed ^ 0x9a1, color, strokeWidthFor(h), ACCENT_ALPHA.ring * s * 0.5, false),
    1,
  );

  if (spec.label !== null) {
    surface.label(
      spec.label,
      { x: x0 + w * 0.5, y: y1 + TYPE.mark * 1.5 },
      {
        color,
        size: TYPE.mark,
        alpha: ACCENT_ALPHA.label * s * 0.8,
        align: 'center',
        baseline: 'middle',
      },
    );
  }
}
