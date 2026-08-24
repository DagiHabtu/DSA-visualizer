/**
 * THE SHELL. One canvas, one renderer, one loop, one player, one view.
 *
 * Responsibilities, deliberately few:
 *   1. own the <canvas> and keep the surface DPR-correct,
 *   2. run one requestAnimationFrame loop with a clamped delta,
 *   3. hold the `TracePlayer` and hand the current frame to the current view,
 *   4. set the caption, the invariant and the provenance notes — the reading
 *      matter around the figure, drawn with the renderer's own type so it sits
 *      on the same paper,
 *   5. regenerate the trace when the menu says the input changed.
 *
 * Point 5 is the whole of "type your own input": the same instrumented
 * algorithm, run on different numbers, produces a different trace, and
 * `TracePlayer.load` is the only thing that has to be told. It is also the seam
 * live code-editing will use, later, unchanged.
 *
 * Every generated trace is run through `validate()` before it is shown. A trace
 * that disagrees with itself is not worth watching, and this is the cheapest
 * possible place to find that out.
 */

import { COMPOSITION, EASING, LINE, TIMING, TYPE, clamp01 } from './tokens/tokens';
import { createSurface, type Surface } from './engine/renderer';
import { TracePlayer, validate, type Trace, type Value } from './engine/trace';
import { createControls, type ControlsHandle } from './ui/controls';
import {
  STRUCTURES,
  createMenu,
  installChromeStyle,
  type StructureEntry,
  type StructureView,
} from './ui/menu';

/**
 * The frame-loop contract the THROWAWAY aesthetic study was written against.
 *
 * The study is no longer mounted — this shell is — but `src/study/` stays on
 * disk as the approved feel reference until the human decides otherwise, and it
 * type-imports this. An interface is erased at build time, so keeping it costs
 * the running app nothing. It is not the shell's contract; `StructureView` is.
 */
export interface Scene {
  resize(width: number, height: number, dpr: number): void;
  update(dt: number, clock: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  restart(): void;
}

const MAX_DPR = 2;

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (canvas === null) throw new Error('main: #stage canvas not found');

installChromeStyle();

const surface: Surface = createSurface(canvas);

// ===========================================================================
// State
// ===========================================================================

function build(entry: StructureEntry, values: readonly Value[], variant: string): Trace {
  const trace = entry.generate(values, variant);
  const problems = validate(trace);
  if (problems.length > 0) {
    // Loud, and not fatal: a broken trace should be visible and inspectable
    // rather than a blank screen.
    console.error(`trace "${trace.title}" has ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  frame ${p.frame}: ${p.message}`);
  }
  return trace;
}

const first = STRUCTURES[0];
const firstParsed = first.parse(first.defaultInput);
let view: StructureView = first.create();
const player = new TracePlayer(
  build(first, firstParsed.values, first.variants[0]?.id ?? (firstParsed.variant ?? '')),
);
view.prepare(player.trace);

// ===========================================================================
// Chrome
// ===========================================================================

const controls: ControlsHandle = createControls(document.body, {
  onToggle: () => player.toggle(),
  onStepBack: () => player.stepBack(),
  onStepForward: () => player.stepForward(),
  onReset: () => player.reset(),
});

createMenu(document.body, {
  onRun(entry, values, variant) {
    view = entry.create();
    const trace = build(entry, values, variant);
    player.load(trace);
    view.prepare(trace);
  },
});

// ===========================================================================
// Size
// ===========================================================================

let resizeTimer = 0;

function applySize(): void {
  const dpr = Math.min(window.devicePixelRatio > 0 ? window.devicePixelRatio : 1, MAX_DPR);
  surface.resize(
    Math.max(360, Math.floor(window.innerWidth)),
    Math.max(280, Math.floor(window.innerHeight)),
    dpr,
  );
}

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(applySize, 140);
});

// ===========================================================================
// The reading matter
// ===========================================================================

/**
 * Caption, invariant, title and notes.
 *
 * The invariant line is the one the curriculum's text cannot show — "everything
 * outside left..right is decided", "fast is 2 ahead of slow around the loop" —
 * so it gets its own line under the caption and nothing competes with it. The
 * notes carry provenance, including the one label that is not allowed to be
 * dropped: a capacity past append 201 is EXTRAPOLATED, and it says so.
 */
function drawReading(): void {
  const frame = player.current;
  if (frame === null) return;
  const { width, height } = surface.view;
  const margin = Math.min(width, height) * COMPOSITION.margin;
  const fade = EASING.reveal(clamp01(player.phase * 1.6));

  surface.label(
    player.trace.title,
    { x: width - margin, y: margin * 0.62 },
    {
      color: LINE.ink,
      size: TYPE.mark,
      alpha: 0.42,
      align: 'right',
      baseline: 'middle',
    },
  );

  const captionY = height * 0.79;
  surface.label(
    frame.caption,
    { x: width * COMPOSITION.centreX, y: captionY },
    {
      color: LINE.ink,
      size: TYPE.value,
      alpha: 0.82 * fade,
      align: 'center',
      baseline: 'middle',
    },
  );

  if (frame.invariant !== null) {
    surface.label(
      frame.invariant,
      { x: width * COMPOSITION.centreX, y: captionY + TYPE.value * 1.55 },
      {
        color: LINE.ink,
        size: TYPE.mark,
        alpha: 0.52 * fade,
        align: 'center',
        baseline: 'middle',
      },
    );
  }

  // Provenance sits under the title, right-aligned: out of the transport's way
  // at the bottom and out of the menu's way at the left, and quiet enough to be
  // read only when looked for. One of these lines is not optional — a capacity
  // past append 201 is extrapolated, and the reader has to be told.
  player.trace.notes.forEach((note, i) => {
    surface.label(
      note,
      { x: width - margin, y: margin * 0.62 + (i + 1) * TYPE.index * 1.6 },
      {
        color: LINE.ink,
        size: TYPE.index,
        alpha: 0.3,
        align: 'right',
        baseline: 'middle',
      },
    );
  });
}

// ===========================================================================
// The loop
// ===========================================================================

let clock = 0;
let last = performance.now();

function frame(now: number): void {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw > 0 ? raw : 0, TIMING.maxDelta);
  clock += dt;

  player.update(dt);

  const current = player.current;
  surface.begin(clock);
  if (current !== null) {
    view.render(surface, {
      current,
      previous: player.previous,
      phase: player.phase,
      clock,
      dt,
    });
    drawReading();
  }
  surface.end();

  controls.sync({
    playing: player.playing,
    index: player.index,
    length: player.length,
    atStart: player.atStart,
    atEnd: player.atEnd,
  });

  requestAnimationFrame(frame);
}

applySize();
requestAnimationFrame(frame);
