/**
 * THE TOKENS FILE — the only place colour, texture, easing, timing and motion
 * constants are allowed to live.
 *
 * Nothing in `src/engine/` may hardcode any of them. Nothing outside this file
 * may invent one. If a later structure "needs a new colour", it needs a new
 * token here, or (more likely) it needs to reuse one that already means
 * something.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE DISCIPLINE
 * ---------------------------------------------------------------------------
 * Every value below is marked with one of exactly two labels:
 *
 *   MEASURED   — read off a reference image in `aesthetic/` with a PNG decoder
 *                and a patch/component sampler. The measurement is quoted
 *                inline, with the file and the sampling method.
 *   BY EYE     — chosen by judgement. No measurement backs it. It may be
 *                *anchored* to a measurement (and says so), but the number
 *                itself is a decision, not an observation.
 *
 * A third label appears on values carried over from the approved study:
 *
 *   STUDY      — the value that ran in `src/study/` and passed the aesthetic
 *                checkpoint. The human watched this number. Where a STUDY value
 *                differs from a MEASURED one, the study value wins for rendering
 *                and the measurement is kept alongside it so the gap is visible.
 *
 * Never assert a constant from memory. If it is not measured, say so.
 *
 * ---------------------------------------------------------------------------
 * MEASUREMENT LOG — raw readings, so every token below can be traced back
 * ---------------------------------------------------------------------------
 * Method: PNG decoded to raw RGB (no colour management applied); patch means
 * over stated rectangles; k-means / connected components where stated. Note the
 * raw values are duskier than a colour-managed viewer shows — the raw numbers
 * are what is quoted, because they are what is reproducible.
 *
 * aesthetic/eggs-as-figure.png  (795x462)
 *   ground              #d2bc9d   72.0% of frame (dominant 4-bit bucket mean)
 *   frame darkest px    #242012 · lightest px #f6ebe2
 *   figure bbox         248x350px = 31% x 76% of frame; glyph fills 41% of its
 *                       own bbox, so figure ink is ~10% of the frame
 *   per-egg body colour = mean of the top 45% luma inside a hand-placed box;
 *   per-egg speck       = mean of the bottom 6% luma in the same box;
 *   coverage            = share of box pixels >45 luma below the body:
 *     sage/blue big  body #b3a47d  speck #667066  cov  5%   box 39x32
 *     terracotta top body #d3ae77  speck #a47c58  cov  3%   box 29x22
 *     pale sage mid  body #b7a787  speck #6c5c43  cov 11%   box 45x19
 *     dark umber     body #957e5e  speck #373227  cov 37%   box 24x16
 *     olive big      body #a6905f  speck #3b352b  cov 19%   box 41x25
 *     sage-olive low body #aa9a6e  speck #a09068  cov  0%   box 39x17
 *     green/teal low body #c4b594  speck #413c31  cov 24%   box 34x20
 *     terracotta low body #d3ac76  speck #9d724f  cov  5%   box 31x12
 *     cream speckled body #c1a480  speck #48382e  cov 24%   box 31x19
 *   speckle dot extent (connected components under a per-egg luma cut):
 *     olive big      p25 1px  median 2px  p90  8px  max 14px  (4.9% of egg width)
 *     dark umber     p25 1px  median 2px  p90  7px  max 11px  (8.3%)
 *     cream          p25 2px  median 3px  p90  4px  max  5px  (9.7%)
 *     green/teal     p25 2px  median 3px  p90 10px  max 10px  (8.8%)
 *     pale sage      p25 1px  median 1px  p90  2px  max 11px  (2.2%)
 *
 * aesthetic/line-figure-icon.png  (276x276)
 *   charcoal ground     #313537   69.7% of frame
 *   paper white         #faf9f5   22.3% of frame
 *   ink (luma<45)       #171715    5.7% of frame
 *   paper rect height   168px = 61% of the icon
 *   two paper rects offset by 21px vertical / 20px horizontal = 7.6% / 7.2%
 *   ink stroke width (horizontal dark runs, n=332):
 *                       p10 3px · median 5px · p90 7px · max 11px
 *                       median = 1.8% of the icon; p90/p10 = 2.3x within one drawing
 *   ink stroke wobble (deviation from a least-squares line):
 *     vertical stroke   tilt -1.45deg  rms 3.25px  max 17.8px  over a 134px span
 *                       -> rms = 2.42% of span
 *     horizontal stroke tilt -6.85deg  rms 5.07px  max 10.3px  over a 116px span
 *                       -> rms = 4.37% of span
 *
 * aesthetic/ship-at-sea.png  (1364x767)
 *   horizontal bands, left patch / right patch:
 *     y  3%  #e5d8dc / #ccc1cb      y 38%  #b0a5a0 / #aca19e
 *     y 12%  #b4aebd / #b1afbb      y 48%  #b9a08a / #a99488
 *     y 25%  #b6b0b2 / #b4afb1      y 52%  #ab927d / #a8907c
 *     y 62%  #545c6d / #4b5467      y 78%  #5d6061 / #485059
 *     y 94%  #464f59 / #606261
 *   subject (sails, luma>215 below y=28%): bbox 424x259 = 31% x 34% of frame,
 *   centred at (57%, 51%); bright pixels are 0.1% of the frame
 *
 * aesthetic/birds-over-building.png  (1365x767)
 *   dusk sky  #8a7256 (upper mid) · #555559 (upper right) · #725f59 (lower right)
 *   building  #452f1d (lit face) · #312216 (shadow face)
 *   countable blobs in the swarm region (n=31 sampled):
 *     extent p25 6px · median 9px · p90 25px · max 38px
 *     median blob = 0.66% of frame width — individuals, not a texture
 *
 * aesthetic/funnel-of-dots.png  (1207x686)
 *   ground   #c9c0b1 (upper left) · #cac2b3 (lower right)
 *   rim      #b5afa3 · mid #b2ac9f · dense base #33322e
 *   -> tone is DENSITY, not tint: same ink, more of it
 *
 * aesthetic/murmuration-whale.png  (1365x767)
 *   sky #bcb9cb · cloud #e3dcdf · sparse fringe #a4a6c0 · dense core #555c75
 *   swarm bbox 787x434 = 58% x 57% of frame; dark pixels 9.7% of frame
 */

// ===========================================================================
// LEVEL 1 — SURFACE: palette
// ===========================================================================

/**
 * The ground. Never a flat colour: cool above, warm below, blotched, hazed,
 * vignetted. All five carried forward from the study unchanged.
 */
export const PAPER = {
  /** STUDY. Between the funnel's cool greige (#c9c0b1 MEASURED) and the eggs' warm sand (#d2bc9d MEASURED). */
  base: '#cfc7b6',
  /** STUDY. Warm bloom, low in the frame. From ship-at-sea's y=48% band #b9a08a and horizon sand, lifted. */
  warm: '#d6c1a1',
  /** STUDY. Cool wash, high in the frame. From murmuration sky #bcb9cb MEASURED, lifted. */
  cool: '#c3c2cd',
  /** STUDY. Pale atmospheric haze — the out-of-focus cloud. Anchored to whale cloud #e3dcdf MEASURED. */
  haze: '#e7e0d8',
  /** STUDY. Vignette ink, as in eggs-as-figure's darkened edges. */
  edge: '#3c372e',
} as const;

/**
 * Speck inks for the particle field. Carried from the study unchanged.
 *
 * The swarm is deliberately NOT one flat colour. The whale reads blue-charcoal,
 * the funnel reads warm charcoal, and birds-over-building carries faint colour
 * fringing on individual birds. A few percent of off-hue specks is what stops a
 * mass of dots reading as a printed dot screen.
 *
 * Weights sum to 1.0.
 */
export const INK: readonly { readonly hex: string; readonly weight: number }[] = [
  /** STUDY. Deep blue-charcoal. From murmuration dense core #555c75 / #303753 MEASURED, deepened for ink. */
  { hex: '#2b3040', weight: 0.5 },
  /** STUDY. Lifted charcoal — the mid-density body of the swarm. */
  { hex: '#3f4557', weight: 0.28 },
  /** STUDY. Sage/olive. From the eggs' olive family (#a6905f body / #605741 MEASURED). */
  { hex: '#5e6350', weight: 0.13 },
  /** STUDY. Terracotta, deepened for ink. From the eggs' terracotta #d3ae77 MEASURED. */
  { hex: '#8a6045', weight: 0.09 },
] as const;

/**
 * A shell: one drawn object's own colourway. This is the `eggs-as-figure`
 * register — a cell and a node are individually drawn objects with a body
 * colour, their own speckle ink, and their own speckle density. They are not
 * stamped clones of a single swatch.
 */
export interface Colourway {
  /** Fill colour of the body. */
  readonly body: string;
  /** Ink of the surface speckle. */
  readonly speck: string;
  /** Share of the body's area carrying speckle, 0..1. */
  readonly speckle: number;
}

/**
 * The shell family — MEASURED, one entry per egg sampled in eggs-as-figure.png.
 * See the measurement log above for the box each was read from.
 *
 * ROLE SPLIT (a design decision, stated so it is not mistaken for a measurement):
 * the two loudest measured eggs are pulled out of this family and given jobs.
 * Terracotta (#d3ae77, the brightest, near-unspeckled egg) becomes the highlight
 * accent; dark umber (#957e5e, the darkest and most heavily speckled at 37%)
 * becomes the "stale" tone for released buffers and tombstones. What remains is
 * a narrow, muted band — which is what keeps a row of twelve cells reading as
 * ONE calm figure (Level 2) instead of a bag of sweets.
 */
export const SHELL: readonly Colourway[] = [
  { body: '#b3a47d', speck: '#667066', speckle: 0.05 }, // MEASURED — sage/blue big egg
  { body: '#b7a787', speck: '#6c5c43', speckle: 0.11 }, // MEASURED — pale sage, mid figure
  { body: '#a6905f', speck: '#3b352b', speckle: 0.19 }, // MEASURED — olive, heavily flecked
  { body: '#aa9a6e', speck: '#a09068', speckle: 0.0 },  // MEASURED — sage-olive; genuinely unspeckled
  { body: '#c4b594', speck: '#413c31', speckle: 0.24 }, // MEASURED — green/grey, lower figure
  { body: '#c1a480', speck: '#48382e', speckle: 0.24 }, // MEASURED — cream, lower left
] as const;

/**
 * The two shells pulled out of the family, plus the one shell that had to be
 * invented because the references contain no such object.
 */
export const SHELL_ROLE = {
  /**
   * A slot that exists but holds nothing. BY EYE — there is no "empty egg" in
   * any reference, so nothing measures this. Anchored between PAPER.base
   * (#cfc7b6 STUDY) and the palest measured shell (#c4b594): near the paper, so
   * an empty slot is a faint absence rather than a second kind of object.
   */
  empty: { body: '#c8bfa9', speck: '#8f8674', speckle: 0.02 } as Colourway,
  /**
   * Released buffer / tombstone. MEASURED — the dark umber egg body #957e5e
   * with its speck #373227 and its 37% coverage, used at low presence so it
   * reads as something that WAS here.
   */
  stale: { body: '#957e5e', speck: '#373227', speckle: 0.37 } as Colourway,
} as const;

/** Line work. The `link` primitive and every drawn edge. */
export const LINE = {
  /**
   * STUDY (#2f3338). The icon's ink MEASURED at #171715 and its charcoal ground
   * MEASURED at #313537; the study's stroke sits between them — lifted off pure
   * black so a mark on warm paper reads as graphite, not as vector black. The
   * gap between #2f3338 and #171715 is the deliberate lift.
   */
  ink: '#2f3338',
  /** BY EYE. A pointer's arrowhead is the same ink; only its alpha differs. */
  arrowAlpha: 0.85,
  /** BY EYE. A link that no longer points anywhere (a released next-pointer). */
  ghostAlpha: 0.22,
} as const;

/**
 * Highlight accents. Exactly three tones, because the highlight primitive
 * answers exactly three questions: where is it looking, what is it weighing,
 * what has it already decided.
 */
export const ACCENT = {
  /** MEASURED — terracotta egg body #d3ae77. "The algorithm is here, now." */
  focus: '#d3ae77',
  /** MEASURED — murmuration dense core #555c75. "These two are being weighed." */
  compare: '#555c75',
  /** MEASURED — sage/blue egg body #b3a47d. "This region is settled; the invariant holds here." */
  decided: '#b3a47d',
} as const;

/** Alphas for the three tones. All BY EYE — restraint is the point. */
export const ACCENT_ALPHA = {
  /** The soft radial bloom under a focus mark. */
  glow: 0.3,
  /** The hand-drawn ring around the marked element. */
  ring: 0.72,
  /** A decided span washed over a run of cells. Deliberately near-subliminal. */
  wash: 0.13,
  /** A mark's text label. */
  label: 0.78,
} as const;

/** Type. BY EYE throughout — no reference image contains set text. */
export const TYPE = {
  /**
   * A humanist stack. Nothing is bundled, so this must degrade gracefully; the
   * fallbacks run warm and slightly informal rather than grotesque.
   */
  family: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
  /** Value inside a cell or node, in CSS px at the reference cell size. */
  value: 15,
  /** The index printed beneath a slot. Smaller — it is scaffolding, not content. */
  index: 10.5,
  /** A pointer's name: `left`, `fast`, `head`. */
  mark: 11,
  /** Letter-spacing on the small sizes, in em. */
  tracking: 0.06,
} as const;

// ===========================================================================
// LEVEL 1 — SURFACE: texture
// ===========================================================================

export const GRAIN = {
  /** STUDY. Tile edge in DEVICE pixels. */
  tile: 220,
  /** STUDY. Drawn in `overlay` at this alpha, last, in device pixels. */
  alpha: 0.3,
  /** STUDY. Amplitude of the per-pixel tooth, in 0-255 units. */
  amplitude: 46,
  /**
   * STUDY. Bias of the tooth toward dark (0.5 = neutral). Slightly dark so the
   * grain reads as fibre rather than sparkle.
   */
  bias: 0.52,
} as const;

/**
 * The grain over a *fill* (a cell or node body), as distinct from the paper
 * grain over the whole frame.
 */
export const FILL_GRAIN = {
  /** BY EYE. Alpha of the tooth laid over a body fill. */
  alpha: 0.14,
  /** BY EYE. Tile edge in CSS px — finer than the paper tile, so the two beat against each other. */
  tile: 96,
} as const;

/**
 * Surface speckle on a shell. Sizes are fractions of the object's SHORT side.
 *
 * MEASURED: on the eggs, speckle dot extent runs p25 1-2px, median 1-3px,
 * p90 4-10px against egg boxes 24-45px wide, i.e. median 2.2%-9.7% of the egg
 * width with occasional blotches 3-8x the median. The range below reproduces
 * that spread: mostly small flecks, occasionally a blot.
 */
export const SPECKLE = {
  /** MEASURED, low end of the per-egg medians (pale sage, 2.2%). */
  minRadius: 0.022,
  /** MEASURED, high end of the per-egg medians (cream, 9.7%), halved to a radius. */
  maxRadius: 0.05,
  /**
   * BY EYE. Share of flecks that come out as a larger blot instead of a dot —
   * anchored on the measured p90/median ratio of 3-8x.
   */
  blotChance: 0.12,
  /** BY EYE, anchored on that same ratio. */
  blotScale: 3.4,
  /** BY EYE. Speckle ink alpha; the measured flecks are soft-edged, not solid. */
  alpha: 0.62,
  /**
   * BY EYE. Flecks per unit area is derived from a Colourway's `speckle`
   * coverage; this caps the count so a large cell does not cost a thousand arcs.
   */
  maxCount: 90,
} as const;

/**
 * Hand-drawn geometry. This is the `line-figure-icon` register: one confident
 * stroke of uneven weight, laid down in a single gesture, and rectangles whose
 * edges are neither straight nor parallel.
 */
export const HAND = {
  /**
   * MEASURED. Wobble amplitude as a fraction of the stroke's span. The icon's
   * two long strokes measured rms 2.42% and 4.37% of span; 3.2% sits between
   * them. This is an RMS target, not a peak — the peaks land where the noise
   * puts them.
   */
  wobble: 0.032,
  /**
   * MEASURED. Off-axis tilt in radians. The icon's nominally-vertical stroke
   * measured 1.45deg off and its nominally-horizontal stroke 6.85deg off; 3deg
   * is between them, applied with a random sign per seed. Nothing in this system
   * is allowed to be exactly axis-aligned.
   */
  tilt: 0.0524,
  /**
   * MEASURED. Stroke width variation within a single mark. The icon's ink runs
   * measured p10 3px to p90 7px — a 2.3x swing inside one drawing.
   */
  widthLow: 0.62,
  widthHigh: 1.44,
  /**
   * MEASURED. Base stroke width as a fraction of the figure's short side. The
   * icon's median run was 5px on a 276px icon = 1.8%.
   */
  strokeScale: 0.018,
  /** BY EYE. Floor so a stroke never disappears on a small element. */
  minStroke: 0.9,
  /** BY EYE. Ceiling so a link across a wide frame does not become a plank. */
  maxStroke: 3.2,
  /**
   * MEASURED. Two stacked paper rectangles in the icon sit 7.6% / 7.2% of the
   * icon apart. Used for the offset shadow-plate under a cell.
   */
  plateOffset: 0.074,
  /** BY EYE. Alpha of that offset plate. */
  plateAlpha: 0.16,
  /**
   * STUDY. A hand stroke is laid down in three passes — a body pass and two
   * faint offset passes — so the mark has weight and a slightly doubled edge.
   * Each entry is [widthMultiplier, alphaMultiplier, perpendicularOffsetPx].
   */
  passes: [
    [1.0, 0.62, 0.0],
    [1.5, 0.2, 0.55],
    [0.62, 0.3, -0.45],
  ] as ReadonlyArray<readonly [number, number, number]>,
  /**
   * STUDY. Pressure profile: a stroke is thicker in its middle and lighter at
   * entry and exit. `base + swing * sin(pi*t)^exp`.
   */
  pressureBase: 0.55,
  pressureSwing: 0.45,
  pressureExp: 0.6,
  /** STUDY. Polyline resolution — samples per 100px of span. */
  samplesPer100px: 10,
  /** BY EYE. Floor and ceiling on that sample count. */
  minSamples: 8,
  maxSamples: 96,
  /**
   * STUDY. Shallow bow across a stroke's midpoint, as a fraction of span. A
   * ruler-straight line is the fastest way to make this look like a chart.
   */
  bow: 0.012,
} as const;

/**
 * Shape irregularity for cells and nodes. The eggs are irregular ellipses of
 * varied size; a row of cells inherits that, tightly.
 */
export const SHAPE = {
  /**
   * BY EYE, anchored on the eggs. The eggs vary in size by roughly 2x across
   * the figure (measured boxes ran 24x16 to 45x19), but a row of ARRAY cells is
   * a lattice and must still read as a lattice, so the variation here is far
   * smaller than the reference's — deliberately. This is restraint (Level 2)
   * outranking the surface reference.
   */
  sizeJitter: 0.045,
  /** BY EYE. Per-element centre offset, as a fraction of its own size. */
  centreJitter: 0.028,
  /**
   * BY EYE. Superellipse exponent for a cell: 2 = ellipse, large = hard rect.
   * The study used 4.4 for its density cells and it read correctly as a slot.
   */
  cellExponent: 4.4,
  /** BY EYE. A node is a rounded token, so it sits much closer to an ellipse. */
  nodeExponent: 2.4,
  /** BY EYE. Corner-to-corner aspect wobble, so no two cells are the same rectangle. */
  aspectJitter: 0.05,
  /** BY EYE. Outline samples around a closed shape. */
  outlineSamples: 44,
} as const;

// ===========================================================================
// LEVEL 1 — SURFACE: easing
// ===========================================================================

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * STUDY. C2-continuous — no velocity kink at either end. The default for any
 * arrival. This is the curve that makes an element "breathe into place".
 */
export const smootherstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** STUDY. Band-limited ramp between two edges. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** STUDY. Slow to let go, then gone — how a flock breaks up. Used by dissolve. */
export const easeInCubic = (t: number): number => {
  const x = clamp01(t);
  return x * x * x;
};

/** STUDY. Decelerating arrival, used where smootherstep would feel too soft to start. */
export const easeOutCubic = (t: number): number => {
  const x = clamp01(t);
  const u = 1 - x;
  return 1 - u * u * u;
};

/**
 * BY EYE. A single lobe, 0 -> 1 -> 0. Not an easing curve: this is the ARC
 * height profile for `swap` and the lift profile for `flow`.
 */
export const lobe = (t: number): number => Math.sin(clamp01(t) * Math.PI);

export const EASING = {
  settle: smootherstep,
  swapArc: smootherstep,
  flowAlong: smootherstep,
  release: easeInCubic,
  reveal: easeOutCubic,
  lobe,
} as const;

// ===========================================================================
// LEVEL 2 — COMPOSITION
// ===========================================================================

/**
 * One primary figure, in generous negative space, on an atmospheric ground.
 *
 * MEASURED, and the two independent references agree closely: the ship's
 * subject occupies 31% x 34% of its frame and is centred at (57%, 51%); the
 * eggs' figure occupies 31% x 76% and its ink is ~10% of the frame. The
 * murmuration's swarm is larger (58% x 57%) because a swarm is diffuse — hence
 * two separate targets below.
 */
export const COMPOSITION = {
  /** MEASURED — ship 31% wide, eggs 31% wide. A discrete figure gets a third of the frame. */
  figureWidth: 0.31,
  /** MEASURED — eggs 76% tall. Ceiling on how much vertical run a figure may take. */
  figureHeightMax: 0.76,
  /** MEASURED — murmuration swarm 58% x 57%. A particle field may spread wider than a figure. */
  swarmWidth: 0.58,
  swarmHeight: 0.57,
  /**
   * MEASURED — ship subject centre (57%, 51%). Slightly right of centre and on
   * the horizontal midline. The study sat its figure at y=45.5%.
   */
  centreX: 0.53,
  centreY: 0.47,
  /**
   * MEASURED — the eggs' figure ink is ~10% of the frame and the murmuration's
   * dark pixels are 9.7%. Ten percent ink, ninety percent air. If a scene is
   * covering much more than this, it has become a dashboard.
   */
  inkBudget: 0.1,
  /** BY EYE. Minimum margin, as a fraction of the short side. */
  margin: 0.09,
} as const;

/** STUDY throughout. The ground bake — gradient, blotching, haze pools. */
export const GROUND = {
  /** Gradient stops down the frame: cool at the top, base in the middle, warm below. */
  gradientAngleX: 0.12,
  gradientMid: 0.46,
  /** Low-frequency blotching, rendered at 1/8 scale and smoothed up so it arrives as cloud. */
  mottleDivisor: 8,
  mottleFrequency: 0.035,
  mottleOctaves: 4,
  mottleAmplitude: 26,
  mottleAlpha: 0.46,
  /** Warm/cool swing of the blotch, per channel, as multipliers of the amplitude. */
  mottleWarmR: 1.15,
  mottleWarmG: 0.55,
  mottleWarmB: -0.5,
  /**
   * Haze pools are additive and therefore dangerous: three at any real alpha
   * drive the sheet to white and it stops being mid-tone paper. Near-invisible
   * per pool, cumulative in effect.
   */
  hazePools: 3,
  hazeAlpha: 0.05,
  hazeRadiusMin: 0.28,
  hazeRadiusSpan: 0.24,
} as const;

/** STUDY throughout. Two enormous, faint, slowly drifting pools. Air, not weather. */
export const ATMOSPHERE = {
  coolAlpha: 0.055,
  warmAlpha: 0.05,
  coolRadius: 0.46,
  warmRadius: 0.4,
  /** Drift rates in radians/second — slow enough that the frame reads as still. */
  driftA: 0.031,
  driftB: 0.024,
  driftC: 0.019,
  driftD: 0.027,
  swing: 0.06,
} as const;

/** STUDY throughout. Vignette, as in eggs-as-figure's darkened edges. */
export const VIGNETTE = {
  radius: 0.62,
  innerStop: 0.34,
  midStop: 0.7,
  midAlpha: 0.07,
  outerAlpha: 0.26,
} as const;

// ===========================================================================
// LEVEL 3 — SIGNATURE: the particle field
// ===========================================================================

/**
 * STUDY throughout. The speck field's density and draw style.
 *
 * Density IS the medium. At a tenth of this count the form reads as dust rather
 * than as a figure, because there is nothing else making it solid — the funnel
 * and the whale get every bit of their tone from how many dots are in a place,
 * not from how dark each dot is.
 */
export const FIELD = {
  /** Specks per square CSS pixel of viewport, before clamping. */
  specksPerPx: 1 / 34,
  minSpecks: 14000,
  maxSpecks: 40000,
  /** Velocity -> streak half-length, in seconds. Speed reads as motion blur. */
  blurSeconds: 0.0105,
  /** Cap on that streak, in CSS px. */
  blurMax: 5.5,
  /** Speck widths in CSS px, with selection weights. Weights sum to 1. */
  sizes: [
    [0.7, 0.52],
    [1.0, 0.33],
    [1.45, 0.15],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Speck alphas, with selection weights. Weights sum to 1. */
  alphas: [
    [0.36, 0.44],
    [0.58, 0.35],
    [0.82, 0.21],
  ] as ReadonlyArray<readonly [number, number]>,
  /**
   * Rejection-sampling ceiling for the density field, and the guard multiplier
   * that stops a degenerate viewport spinning forever.
   */
  samplingCeiling: 1.16,
  samplingGuard: 60,
} as const;

/**
 * STUDY throughout. The physics. Nothing tweens: every speck is a damped spring
 * under a curl-noise wind, so the path into place is a decelerating curve with a
 * wobble on it. "A murmuration settling", never a slide transition.
 */
export const SWARM = {
  /** Spatial frequency of the wind field, and how fast it evolves. */
  windSpace: 0.0034,
  windTime: 0.085,
  /** Wind acceleration, px/s^2, and the fraction retained once settled. */
  windDrift: 118,
  windRest: 0.13,
  /** Curl sampling epsilon. */
  curlEpsilon: 0.65,
  /** Base drag, 1/s. */
  drag: 1.35,
  /** Idle cohesion toward the cloud centre, 1/s^2 — a flock holds together. */
  cohesion: 0.22,
  /** Restoring acceleration once outside the idle ellipse, 1/s^2. */
  contain: 135,
  /**
   * Downward bias while a speck is still far from home, px/s^2, and the range
   * over which it fades. Specks come DOWN into place; they do not fly at it.
   */
  fallIn: 235,
  fallRange: 115,
  /** Outward and upward impulse during a dissolve, px/s^2. */
  releaseUp: 125,
  releaseOut: 85,
  /** Per-speck spring stiffness range and damping-ratio range. */
  stiffnessMin: 24,
  stiffnessSpan: 34,
  zetaMin: 0.72,
  zetaSpan: 0.26,
  /**
   * Fraction of a beat spent staggering arrivals. The form assembles as a wave
   * crossing the frame, never as a synchronised snap.
   */
  staggerSpread: 0.55,
  /** Raggedness of the arrival wavefront, in CSS px of key jitter. */
  staggerJitter: 160,
  /** At rest the specks keep a small quiver and the homes breathe. Frozen is dead. */
  breatheAmpX: 1.25,
  breatheAmpY: 1.0,
  breatheRateX: 0.55,
  breatheRateY: 0.43,
  /** Idle cloud size as a fraction of the viewport. */
  cloudWidth: 0.29,
  cloudHeight: 0.28,
  /** Slow wander of the idle cloud's centre. */
  cloudDriftX: 0.045,
  cloudDriftY: 0.04,
  cloudRateX: 0.16,
  cloudRateY: 0.12,
} as const;

// ===========================================================================
// THE THREE MOTIONS — shape, not duration
// ===========================================================================

/**
 * The geometry of settle, swap and flow. Durations live in TIMING; these are
 * the *shapes* — how high the arc goes, how far above a slot an element enters
 * from, how much it overshoots before it comes to rest.
 *
 * All BY EYE, but every one of them is anchored on something the study proved:
 * specks in the study arrived on damped springs with a gravity bias that faded
 * as they closed on home (SWARM.fallIn / SWARM.fallRange), and at rest they kept
 * a quiver. A single discrete element must move the same way, or a cell and a
 * speck will look like they belong to different worlds.
 */
export const MOTION = {
  /**
   * How far ABOVE its slot an element enters from, as a fraction of the
   * distance it is travelling. Elements come down into place; they do not fly
   * at it sideways. Capped so a long move does not launch into orbit.
   */
  settleRise: 0.22,
  settleRiseMax: 46,
  /** Overshoot past the target before coming to rest, as a fraction of the travel. */
  settleOvershoot: 0.055,
  /** Decay rate of that overshoot. Higher = fewer visible bounces. */
  settleDecay: 5.2,
  /** Number of half-oscillations in the overshoot. Below 2 there is no bounce at all. */
  settleBounces: 1.6,
  /**
   * Lateral wander on the way in, as a fraction of the travel. This is what
   * makes the path a decelerating curve with a wobble on it rather than an
   * interpolation.
   */
  settleWander: 0.06,

  /**
   * Arc height for a swap, as a fraction of the distance between the two
   * elements. Two elements trade places along an arc, never a straight line —
   * a straight-line swap reads as a crossfade and loses which went where.
   */
  swapArc: 0.34,
  /** The two halves of a swap take different arcs, so they do not overlap. */
  swapSplit: 0.62,
  /** Lateral wobble on the arc. */
  swapWander: 0.04,

  /** How far ahead of the travelling value the link reveals itself. */
  flowLead: 0.06,
  /** Length of the trail behind a flowing value, as a fraction of the path. */
  flowTrail: 0.18,
  /** Lift of a flowing value off its path, as a fraction of the path length. */
  flowLift: 0.07,

  /**
   * Resolution of the density mask used when a settle is rendered through the
   * particle field, in CSS px per mask cell. Smaller is sharper and slower.
   */
  maskCell: 3,
  /** Feather radius of that mask, in mask cells. This is the drawn edge of the form. */
  maskFeather: 2,
  /**
   * Sediment: the density inside a form is heavier at its bottom than its top,
   * as in the funnel's base. Multiplier at the top and at the bottom.
   */
  sedimentTop: 0.74,
  sedimentBottom: 1.14,
} as const;

// ===========================================================================
// TIMING — how long each motion takes
// ===========================================================================

/**
 * The study's approved beat was drift 3.2s / gather 4.2s / rest 3.6s /
 * dissolve 3.4s, looping in 14.4s. Those four numbers are STUDY. Everything
 * below that maps a *trace step* onto a duration is BY EYE, anchored to them:
 * the emergence beat is given the study's gather+dissolve budget, and an
 * ordinary step is given roughly a quarter of a gather.
 */
export const TIMING = {
  /** STUDY. The study's four beats, kept because the field simulation is tuned to them. */
  beatDrift: 3.2,
  beatGather: 4.2,
  beatRest: 3.6,
  beatDissolve: 3.4,

  /** BY EYE. A frame with no motion event — the trace simply moved on. */
  stepQuiet: 0.55,
  /** BY EYE. A settle: one or more elements easing down into position. */
  stepSettle: 1.0,
  /** BY EYE. A swap: two elements trading places along an arc. */
  stepSwap: 0.95,
  /** BY EYE. A flow: a value or a pointer travelling. */
  stepFlow: 0.85,
  /**
   * BY EYE, anchored on the study's gather (4.2s) plus dissolve (3.4s), cut
   * down because a resize is one beat inside a longer explanation rather than a
   * standalone loop. This is the emergence beat and it must not be hurried.
   */
  stepField: 3.4,
  /** BY EYE. Share of a field step spent scattering before the re-gather begins. */
  fieldScatterShare: 0.42,

  /** BY EYE. Multiplier applied when the player is stepped by hand rather than played. */
  stepScrubScale: 0.55,
  /** BY EYE. Playback pause between frames, so a played trace can be read. */
  holdBetweenFrames: 0.35,
  /** BY EYE. Fade in/out of a primitive appearing or being released. */
  presenceFade: 0.4,
  /** BY EYE. How long a highlight takes to move to a new target. */
  markTravel: 0.5,
  /** STUDY. Never simulate more than a 30fps step, even after a tab stall. */
  maxDelta: 1 / 30,
} as const;

// ===========================================================================
// DETERMINISM
// ===========================================================================

/**
 * STUDY. Base seed. Every wobble, speckle and jitter in the engine is a pure
 * function of (this seed, an element's own stable id) — so the same trace draws
 * identically every run, and stepping backward does not re-roll a cell's
 * freckles.
 */
export const SEED = 0x5eed;
