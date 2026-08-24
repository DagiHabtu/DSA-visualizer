/**
 * `npm run check` — generate every trace both structures can produce and run the
 * format's own validator over them.
 *
 * This is not a test framework and Unit 3 does not add one. It is a script: it
 * runs the real generators, prints what `validate()` found, and exits non-zero
 * if anything is wrong. It imports nothing that touches the DOM, so it runs
 * under plain node once Vite has bundled it.
 *
 * It also re-checks the one claim in this project that is a compression of a
 * measurement rather than a measurement: that the CPython growth rule still
 * reproduces all sixteen measured points.
 */

/**
 * Node's global, declared locally. This project has no `@types/node` and does
 * not want one for a script that sets an exit code.
 */
declare const process: { exitCode: number };

import { validate, type Trace } from './engine/trace';
import type {
  FillStyle,
  GlowStyle,
  LabelStyle,
  Path,
  Pt,
  SpeckBatch,
  StrokeStyle,
  Surface,
  Viewport,
} from './engine/renderer';
import { appendTrace, twoPointerTrace } from './structures/dynamic-array/trace';
import { createArrayView } from './structures/dynamic-array/view';
import { cycleTrace } from './structures/linked-list/trace';
import { createListView } from './structures/linked-list/view';
import {
  MEASURED,
  MEASURED_THROUGH_APPEND,
  cpythonCapacity,
  ruleMatchesMeasurement,
} from './structures/dynamic-array/growth.measured';

interface Case {
  readonly what: string;
  readonly trace: Trace;
  /** Which view draws it, so the render pass can walk every frame of it. */
  readonly view: 'array' | 'list';
}

const cases: Case[] = [];

const inputs: readonly (readonly number[])[] = [
  [7],
  [1, 2],
  [3, 1, 4, 1, 5],
  [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3],
  [5, 5, 5, 5, 5, 5, 5, 5, 5],
];

for (const values of inputs) {
  for (const variant of ['doubling', 'cpython']) {
    cases.push({
      what: `append [${values.join(' ')}] · ${variant}`,
      trace: appendTrace(values, variant),
      view: 'array',
    });
  }
}

const sorted: readonly (readonly [readonly number[], string])[] = [
  [[2, 3, 5, 8, 11, 15, 19], '23'],
  [[2, 3, 5, 8, 11, 15, 19], '4'],
  [[2, 3, 5, 8, 11, 15, 19], '100'],
  [[1, 2], '3'],
  [[9, 1, 5, 3], ''],
];
for (const [values, target] of sorted) {
  cases.push({
    what: `two-pointer [${values.join(' ')}] target "${target}"`,
    trace: twoPointerTrace(values, target),
    view: 'array',
  });
}

const lists: readonly (readonly [readonly number[], string])[] = [
  [[1, 2, 3, 4, 5, 6, 7, 8], '3'],
  [[1, 2, 3, 4, 5, 6, 7, 8], 'none'],
  [[1, 2, 3, 4], '0'],
  [[1, 2, 3, 4, 5], '4'],
  [[1], '0'],
  [[1], 'none'],
  [[1, 2], ''],
];
for (const [values, at] of lists) {
  cases.push({
    what: `cycle [${values.join(' ')}] loop "${at}"`,
    trace: cycleTrace(values, at),
    view: 'list',
  });
}

let failures = 0;

for (const c of cases) {
  const problems = validate(c.trace);
  const frames = c.trace.frames.length;
  if (problems.length === 0) {
    console.log(`  ok    ${frames.toString().padStart(3)} frames   ${c.what}`);
    continue;
  }
  failures += problems.length;
  console.log(`  FAIL  ${frames.toString().padStart(3)} frames   ${c.what}`);
  for (const p of problems) console.log(`          frame ${p.frame}: ${p.message}`);
}

// ===========================================================================
// The render pass
// ===========================================================================

/**
 * A surface that counts ink instead of laying it.
 *
 * Validating a trace proves it does not contradict itself; it says nothing about
 * whether the code that DRAWS it survives contact with it. So every frame of
 * every trace is walked through its real view at four points across the
 * transition, on a stub that implements the one renderer interface and draws
 * nothing. It catches the whole class of "that snapshot has no bank for this
 * cell" faults, which would otherwise first appear as a blank browser window.
 *
 * That the stub can stand in for the canvas at all is the WebGL seam doing its
 * job: everything goes through `Surface`, so anything can be behind it.
 */
class NullSurface implements Surface {
  readonly backend = 'canvas2d' as const;
  view: Viewport = { width: 1440, height: 860, dpr: 1 };
  calls = 0;

  resize(width: number, height: number, dpr: number): void {
    this.view = { width, height, dpr };
  }
  begin(_clock: number): void {}
  end(): void {}
  fill(_path: Path, _style: FillStyle): void {
    this.calls += 1;
  }
  stroke(_path: Path, _style: StrokeStyle, _reveal: number): void {
    this.calls += 1;
  }
  glow(_centre: Pt, _radius: number, _style: GlowStyle): void {
    this.calls += 1;
  }
  label(_text: string, _at: Pt, _style: LabelStyle): void {
    this.calls += 1;
  }
  specks(batch: SpeckBatch, _alpha: number): void {
    this.calls += batch.count;
  }
  dispose(): void {}
}

const PHASES = [0, 0.35, 0.7, 1];
const stub = new NullSurface();
let drawn = 0;

for (const c of cases) {
  const view = c.view === 'array' ? createArrayView() : createListView();
  try {
    view.prepare(c.trace);
    c.trace.frames.forEach((current, i) => {
      for (const phase of PHASES) {
        view.render(stub, {
          current,
          previous: i > 0 ? c.trace.frames[i - 1] : null,
          phase,
          clock: i + phase,
          dt: 1 / 60,
        });
        drawn += 1;
      }
    });
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  rendering ${c.what}: ${String(err)}`);
  }
}
console.log(`  ok    ${drawn} view renders, ${stub.calls} draw calls, no exceptions`);

// --- the measurement guard -------------------------------------------------

if (!ruleMatchesMeasurement()) {
  failures += 1;
  console.log('  FAIL  the CPython growth rule no longer reproduces the measurement');
} else {
  console.log(`  ok    growth rule reproduces all ${MEASURED.length} measured points`);
}

// Every measured reallocation point must come back labelled as a MEASUREMENT,
// and anything past the boundary must come back labelled as an extrapolation.
for (const p of MEASURED) {
  const claim = cpythonCapacity(p.atAppend);
  if (claim.basis !== 'measured' || claim.capacity !== p.capacity) {
    failures += 1;
    console.log(
      `  FAIL  append ${p.atAppend}: expected measured ${p.capacity}, got ${claim.capacity} (${claim.basis})`,
    );
  }
}
const past = cpythonCapacity(MEASURED_THROUGH_APPEND + 1);
if (past.basis !== 'extrapolated') {
  failures += 1;
  console.log(`  FAIL  append ${MEASURED_THROUGH_APPEND + 1} claims basis "${past.basis}"`);
} else {
  console.log(`  ok    capacities past append ${MEASURED_THROUGH_APPEND} are labelled extrapolated`);
}

console.log('');
if (failures === 0) {
  console.log(`${cases.length} traces, no problems.`);
} else {
  console.log(`${failures} problem(s).`);
  process.exitCode = 1;
}
