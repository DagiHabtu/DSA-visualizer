/**
 * THROWAWAY (aesthetic study only) — DRAFT palette + easing.
 *
 * This is NOT src/tokens/tokens.ts. It is the sketch the real tokens file gets
 * distilled from after the aesthetic checkpoint. Nothing outside src/study/ may
 * import it.
 *
 * PROVENANCE — every hex below was measured off the reference images with a
 * PNG decoder + patch averager, not recalled. Measured values are quoted in the
 * comments; where a token differs from its measurement it is because it was
 * nudged for use as ink-on-paper, and the nudge is noted.
 *
 *   aesthetic/eggs-as-figure.png      paper ground     #d3bd9f  (71.9% of frame)
 *   aesthetic/funnel-of-dots.png      paper ground     #c8c1b4  (60.7% of frame)
 *   aesthetic/funnel-of-dots.png      dense speck core #353430
 *   aesthetic/murmuration-whale.png   sky              #b9b9c8  (27.6% of frame)
 *   aesthetic/murmuration-whale.png   dense swarm      #303753  (blue-charcoal)
 *   aesthetic/murmuration-whale.png   swarm fringe     #a09fc2  (density, not tint)
 *   aesthetic/ship-at-sea.png         horizon sand     #d1b18a
 *   aesthetic/ship-at-sea.png         sea              #52575d
 *   aesthetic/eggs-as-figure.png      egg sage         #9e9172
 *   aesthetic/eggs-as-figure.png      egg olive        #605741
 *   aesthetic/eggs-as-figure.png      egg terracotta   #d1a76f
 *   aesthetic/line-figure-icon.png    charcoal ground  #313537
 *   aesthetic/line-figure-icon.png    paper white      #faf9f5
 */

export const PAPER = {
  /** Base sheet — between the funnel's cool greige and the eggs' warm sand. */
  base: '#cfc7b6',
  /** Warm bloom, low in the frame. From ship-at-sea's horizon band #d1b18a. */
  warm: '#d6c1a1',
  /** Cool wash, high in the frame. From the whale's sky #b9b9c8, lifted. */
  cool: '#c3c2cd',
  /** Pale atmospheric haze — the out-of-focus cloud in ship/whale. */
  haze: '#e7e0d8',
  /** Vignette, as in eggs-as-figure's darkened edges. */
  edge: '#3c372e',
} as const;

/**
 * Speck inks. The swarm is NOT one flat colour: the whale reads blue-charcoal,
 * the funnel reads warm charcoal, and birds-over-building has faint green/red
 * fringing on individual birds. A few percent of off-hue specks is what keeps a
 * mass of dots from looking like a printed dot screen.
 */
export const INK = [
  { hex: '#2b3040', weight: 0.5 },  // deep blue-charcoal (whale core #303753)
  { hex: '#3f4557', weight: 0.28 }, // lifted charcoal
  { hex: '#5e6350', weight: 0.13 }, // sage/olive (eggs #605741 -> #9e9172)
  { hex: '#8a6045', weight: 0.09 }, // terracotta (eggs #d1a76f, deepened for ink)
] as const;

/** Line work. One confident dark stroke, as in line-figure-icon.png. */
export const LINE = '#2f3338';

/** Easing. Nothing here is linear and nothing here is a slide. */
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** C2-continuous — no velocity kink at either end. The default for arrivals. */
export const smootherstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Slow to let go, then gone — how a flock breaks up. Used by the dissolve. */
export const easeInCubic = (t: number): number => {
  const x = clamp01(t);
  return x * x * x;
};

export const easeOutCubic = (t: number): number => {
  const x = clamp01(t);
  const u = 1 - x;
  return 1 - u * u * u;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
