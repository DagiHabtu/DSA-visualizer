/**
 * DSA-1, dynamic array — the RECORDER. It turns the steps the implementation in
 * `algorithm.ts` actually took into frames of the engine's trace format.
 *
 * This file writes no algorithm and decides no outcome. Every number it puts in
 * a frame it read out of the machine at the instant the step happened; every
 * caption describes the step that was announced, not a step someone wished for.
 * If you want to know whether the animation is telling the truth, the question
 * to ask is "does `algorithm.ts` do that?", and this file is short enough to
 * check that by reading it.
 *
 * ---------------------------------------------------------------------------
 * THE ONE PRESENTATION DECISION, STATED PLAINLY
 * ---------------------------------------------------------------------------
 * A real copy loop leaves the old buffer's slots alone — after `new[i] = old[i]`
 * both blocks hold the value, until the old block is freed. The trace format
 * gives every element ONE identity and therefore one place, so an element cannot
 * be drawn in two banks at once.
 *
 * So a copied element is drawn as having MOVED: it appears in the new bank and
 * the slot it came from is drawn as a released slot (`stale`, no value). That is
 * a statement about ownership, which is the thing being taught — after the copy,
 * the new block owns that element — and not a claim that the old bytes were
 * zeroed. Nothing else about the resize is presentational: the capacities, the
 * copy count and the order are all the machine's.
 */

import {
  EMPTY_SNAPSHOT,
  TraceRecorder,
  bankRef,
  cellRef,
  type BankState,
  type CellState,
  type MarkState,
  type Snapshot,
  type Trace,
  type TraceEvent,
  type Value,
} from '../../engine/trace';
import {
  DynamicArray,
  twoSumSorted,
  type ArrayStep,
  type GrowthStrategy,
  type MachineView,
  type PointerStep,
} from './algorithm';
import { MEASURED, MEASURED_THROUGH_APPEND, PROVENANCE } from './growth.measured';

// ===========================================================================
// Ids
// ===========================================================================

/**
 * The k-th element ever appended is `e{k}`, wherever it currently lives. That is
 * what lets the view see "element 3 is now in the new bank" and animate the
 * copy, instead of seeing one cell vanish and an unrelated one appear.
 */
const element = (index: number): string => `e${index}`;

/** A slot, as opposed to whatever is in it. */
const slot = (bank: string, index: number): string => `${bank}:s${index}`;

// ===========================================================================
// Snapshots
// ===========================================================================

type Occupant =
  /** An allocated slot with nothing in it. */
  | { readonly kind: 'empty' }
  /** A slot whose element has been copied out; the block no longer owns it. */
  | { readonly kind: 'vacated' }
  /** The element with this array index. */
  | { readonly kind: 'element'; readonly index: number };

/**
 * What a block is doing right now. Four roles, which are exactly the four states
 * a resize passes through — and getting these wrong is how a buffer's contents
 * would appear to blink out of existence for one frame, so they are named rather
 * than inferred at each use.
 */
type Role =
  /** The only block: ordinary life between resizes. */
  | 'sole'
  /** Home, but a larger block exists and is taking its elements. */
  | 'draining'
  /** Allocated and filling up; not home yet. */
  | 'filling'
  /** No longer home: everything has been copied out of it. */
  | 'drained';

function roleOf(view: MachineView, blockIndex: number): Role {
  const homeIndex = view.blocks.findIndex((b) => b.id === view.homeId);
  if (blockIndex > homeIndex) return 'filling';
  if (blockIndex < homeIndex) return 'drained';
  return blockIndex < view.blocks.length - 1 ? 'draining' : 'sole';
}

/** Which element, if any, each slot of a block holds at this instant. */
function occupancyOf(view: MachineView, blockIndex: number, role: Role): readonly Occupant[] {
  const block = view.blocks[blockIndex];
  const out: Occupant[] = [];

  for (let i = 0; i < block.capacity; i++) {
    if (role === 'filling') {
      // It owns the first `copied` elements and nothing else yet.
      out.push(i < view.copied ? { kind: 'element', index: i } : { kind: 'empty' });
    } else if (role === 'draining' || role === 'drained') {
      // It still owns everything that has not been copied out of it.
      if (i < view.copied) out.push({ kind: 'vacated' });
      else if (i < view.size) out.push({ kind: 'element', index: i });
      else out.push({ kind: 'empty' });
    } else {
      out.push(i < view.size ? { kind: 'element', index: i } : { kind: 'empty' });
    }
  }
  return out;
}

function snapshotOf(view: MachineView, marks: readonly MarkState[]): Snapshot {
  const banks: BankState[] = [];
  const cells: CellState[] = [];

  view.blocks.forEach((block, bi) => {
    const role = roleOf(view, bi);
    const occupancy = occupancyOf(view, bi, role);
    let held = 0;

    occupancy.forEach((o, i) => {
      if (o.kind === 'element') {
        held += 1;
        cells.push({
          id: element(o.index),
          bank: block.id,
          index: i,
          value: block.slots[i],
          status: 'live',
        });
        return;
      }
      cells.push({
        id: slot(block.id, i),
        bank: block.id,
        index: i,
        value: null,
        status: o.kind === 'vacated' ? 'stale' : 'empty',
      });
    });

    const label =
      role === 'filling'
        ? `new · cap ${block.capacity} · ${held} copied`
        : role === 'drained'
          ? `old · cap ${block.capacity}`
          : role === 'draining'
            ? `cap ${block.capacity} · ${held} left`
            : `cap ${block.capacity} · size ${held}`;

    banks.push({
      id: block.id,
      capacity: block.capacity,
      size: held,
      label,
      // Nothing points at a drained block any more: that is what makes it
      // garbage, and `stale` is how the grammar says so.
      status: role === 'drained' ? 'stale' : 'live',
    });
  });

  return { ...EMPTY_SNAPSHOT, banks, cells, marks };
}

const appendMark = (target: MarkState['target'], value: number): MarkState => ({
  id: 'm.append',
  label: `append ${value}`,
  target,
  tone: 'focus',
});

// ===========================================================================
// The append trace — DSA-1 correctness target 1
// ===========================================================================

function ratioOf(from: number, to: number): string {
  if (from <= 0) return 'first allocation';
  return `${from} → ${to} slots · ×${(to / from).toFixed(2)}`;
}

/**
 * Run `DynamicArray.append` over the input and record what it did.
 *
 * `variant` selects the growth strategy, because the curriculum's diagnostic is
 * a COMPARISON: build doubling from scratch, measure what a real list does, and
 * say which over-allocates harder. Watching the same input under both switches
 * is that comparison.
 */
export function appendTrace(input: readonly Value[], variant: string): Trace {
  const strategy: GrowthStrategy = variant === 'cpython' ? 'cpython' : 'doubling';
  const values = input.map((v) => (typeof v === 'number' ? v : Number(v))).filter((v) => !Number.isNaN(v));

  const rec = new TraceRecorder(
    strategy === 'cpython'
      ? `append ×${values.length} · real CPython over-allocation`
      : `append ×${values.length} · doubling, built from scratch`,
    values,
    strategy,
  );

  if (strategy === 'cpython') {
    rec.note(`growth: ${PROVENANCE}`);
    rec.note(
      `capacities are the measurement for appends up to ${MEASURED_THROUGH_APPEND} ` +
        `(${MEASURED.length} reallocation points); past that they are EXTRAPOLATED from the rule.`,
    );
    rec.note(
      'CPython hands the block to the allocator, which may or may not have to move it. ' +
        'The per-element copy shown here is what the from-scratch class does; what was measured is the SIZES.',
    );
  } else {
    rec.note('growth: capacity starts at 4 and doubles whenever the buffer is full.');
    rec.note('this is the from-scratch DynamicArray the curriculum has you build.');
  }

  /** Kept across steps so a caption can say what is being appended. */
  let pending = 0;

  const observe = (step: ArrayStep, view: MachineView): void => {
    switch (step.kind) {
      case 'start':
        rec.emit(
          'an empty array — no buffer allocated yet',
          `${values.length} values to append`,
          snapshotOf(view, []),
        );
        return;

      case 'request': {
        pending = step.value;
        // A plain append gets one frame, at `place`. Only an append that has to
        // grow the buffer earns a frame of its own here.
        if (!step.willGrow) return;
        const bare = view.blocks[0].capacity === 0;
        rec.emit(
          bare
            ? `append ${step.value} — there is no buffer to put it in yet`
            : `append ${step.value} — but the buffer is full`,
          bare
            ? 'an empty array holds no block at all'
            : `size ${view.size} = capacity ${view.blocks[0].capacity}`,
          snapshotOf(view, [appendMark(bankRef(view.homeId), step.value)]),
        );
        return;
      }

      case 'full':
        // The very first allocation has no buffer to be full of; saying so would
        // be a frame about nothing.
        if (step.capacity === 0) return;
        rec.emit(
          'a fixed block cannot grow in place — it has to be replaced',
          `every slot of the ${step.capacity} is in use`,
          snapshotOf(view, [appendMark(bankRef(view.homeId), pending)]),
        );
        return;

      case 'allocate': {
        const claim = step.claim;
        const extrapolated = claim !== null && claim.basis === 'extrapolated';
        const provenance =
          claim === null
            ? ''
            : claim.basis === 'measured'
              ? ' (measured)'
              : extrapolated
                ? ` (EXTRAPOLATED — measured only to append ${claim.measuredThroughAppend})`
                : ' (inside the measured range)';
        const fresh = view.blocks[view.blocks.length - 1];
        const empties: TraceEvent[] = [
          {
            motion: 'settle',
            via: 'direct',
            refs: Array.from({ length: fresh.capacity }, (_, i) => cellRef(slot(fresh.id, i))),
          },
        ];
        rec.emit(
          `allocate a larger buffer — capacity ${step.capacity}${provenance}`,
          ratioOf(step.from, step.capacity),
          snapshotOf(view, [appendMark(bankRef(fresh.id), pending)]),
          empties,
        );
        return;
      }

      case 'copy':
        rec.emit(
          `copy element ${step.index} into the new buffer`,
          `a resize copies every element — ${step.index + 1} of ${step.of}`,
          snapshotOf(view, []),
          [
            {
              motion: 'flow',
              from: cellRef(slot(view.blocks[0].id, step.index)),
              to: cellRef(element(step.index)),
              carries: step.value,
              along: null,
            },
          ],
        );
        return;

      case 'rehome':
        if (view.blocks[0].capacity === 0) return;
        rec.emit(
          'the array now uses the new buffer',
          'nothing points at the old block any more',
          snapshotOf(view, []),
        );
        return;

      case 'release': {
        if (step.capacity === 0) return;
        // THE EMERGENCE BEAT. The old block is gone, the figure recomposes as one
        // row, and the values cross that gap as a swarm rather than sliding. It
        // is used here and nowhere else in this structure: between resizes the
        // array rests as a plain, calm row.
        const events: TraceEvent[] =
          view.size > 0
            ? [
                {
                  motion: 'settle',
                  via: 'field',
                  refs: Array.from({ length: view.size }, (_, i) => cellRef(element(i))),
                },
              ]
            : [];
        rec.emit(
          `release the old buffer — ${step.capacity} slots returned`,
          `${view.copies} copies over ${view.appends} appends so far`,
          snapshotOf(view, []),
          events,
        );
        return;
      }

      case 'place':
        rec.emit(
          `place ${step.value} at index ${step.index}`,
          `size ${view.size} · capacity ${view.blocks[0].capacity} · ` +
            `${view.blocks[0].capacity - view.size} slots spare`,
          snapshotOf(view, [appendMark(cellRef(element(step.index)), step.value)]),
          [{ motion: 'settle', via: 'direct', refs: [cellRef(element(step.index))] }],
        );
        return;

      case 'done': {
        const cap = view.blocks[0].capacity;
        const perAppend = view.appends > 0 ? view.copies / view.appends : 0;
        rec.emit(
          `${view.appends} appends · ${view.copies} copies · capacity ${cap}`,
          `${perAppend.toFixed(2)} copies per append — the cost of growth is amortized, not paid each time`,
          snapshotOf(view, []),
        );
        return;
      }
    }
  };

  const array = new DynamicArray(strategy, observe);
  for (const v of values) array.append(v);
  array.finish();
  return rec.done();
}

// ===========================================================================
// The two-pointer trace — DSA-1 correctness target 2
// ===========================================================================

const BANK = 'arr';

function pointerSnapshot(
  values: readonly number[],
  marks: readonly MarkState[],
): Snapshot {
  const cells: CellState[] = values.map((v, i) => ({
    id: element(i),
    bank: BANK,
    index: i,
    value: v,
    status: 'live',
  }));
  return {
    ...EMPTY_SNAPSHOT,
    banks: [
      {
        id: BANK,
        capacity: values.length,
        size: values.length,
        label: `sorted · ${values.length} values`,
        status: 'live',
      },
    ],
    cells,
    marks,
  };
}

/**
 * The marks for one position of the scan.
 *
 * Two rings for the pointers, and — the reason this target exists — a wash over
 * everything OUTSIDE them, in the `decided` tone. The eliminated region is a
 * claim about a range, so it is drawn as a range: `span` is in the trace format
 * for exactly this.
 */
function pointerMarks(
  n: number,
  left: number,
  right: number,
  tone: 'focus' | 'compare',
): MarkState[] {
  const marks: MarkState[] = [];
  if (left > 0) {
    marks.push({
      id: 'm.decided.left',
      label: 'decided',
      target: { on: 'span', bank: BANK, from: 0, to: left - 1 },
      tone: 'decided',
    });
  }
  if (right < n - 1) {
    marks.push({
      id: 'm.decided.right',
      label: 'decided',
      target: { on: 'span', bank: BANK, from: right + 1, to: n - 1 },
      tone: 'decided',
    });
  }
  if (left === right && left >= 0 && left < n) {
    // The two pointers have landed on the same element. One ring, one label —
    // two rings in the same place would just be a thicker ring with the two
    // names printed on top of each other.
    marks.push({
      id: 'm.left',
      label: 'left = right',
      target: cellRef(element(left)),
      tone,
    });
    return marks;
  }
  if (left >= 0 && left < n) {
    marks.push({ id: 'm.left', label: 'left', target: cellRef(element(left)), tone });
  }
  if (right >= 0 && right < n) {
    marks.push({ id: 'm.right', label: 'right', target: cellRef(element(right)), tone });
  }
  return marks;
}

/**
 * Opposite-end convergence on a sorted array, recorded.
 *
 * `variant` carries the target sum, so "type your own input" can set it:
 * `3 5 9 12 : 17`. When it is absent or unusable, a target is chosen from the
 * values so the scan has somewhere to go, and the trace says which.
 */
export function twoPointerTrace(input: readonly Value[], variant: string): Trace {
  const values = input
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b);

  const asked = Number(variant);
  const target =
    Number.isFinite(asked) && variant.trim() !== ''
      ? asked
      : values.length >= 2
        ? values[1] + values[values.length - 2]
        : 0;

  const rec = new TraceRecorder(`two pointers · target ${target}`, values, String(target));
  rec.note('the array is sorted first; opposite-end convergence needs sorted input.');
  if (!Number.isFinite(asked) || variant.trim() === '') {
    rec.note(`no target given, so one was taken from the values: ${target}.`);
  }
  rec.note('LC #167 — two sum on a sorted array.');

  const n = values.length;
  const observe = (step: PointerStep): void => {
    switch (step.kind) {
      case 'start':
        rec.emit(
          `find two values that sum to ${target}`,
          'one pointer at each end — nothing is decided yet',
          pointerSnapshot(values, pointerMarks(n, step.left, step.right, 'focus')),
        );
        return;

      case 'weigh': {
        const verdict =
          step.verdict === 'hit'
            ? `${values[step.left]} + ${values[step.right]} = ${step.sum} — that is the target`
            : step.verdict === 'low'
              ? `${values[step.left]} + ${values[step.right]} = ${step.sum}, under ${target}`
              : `${values[step.left]} + ${values[step.right]} = ${step.sum}, over ${target}`;
        const why =
          step.verdict === 'hit'
            ? 'found'
            : step.verdict === 'low'
              ? `${values[step.right]} is the largest partner left, so no pair using ${values[step.left]} can reach ${target}`
              : `${values[step.left]} is the smallest partner left, so no pair using ${values[step.right]} can come down to ${target}`;
        rec.emit(
          verdict,
          why,
          pointerSnapshot(values, pointerMarks(n, step.left, step.right, 'compare')),
        );
        return;
      }

      case 'advance': {
        const moved = step.side === 'left' ? 'left' : 'right';
        rec.emit(
          `${moved} moves inward, to index ${step.to}`,
          `everything outside left..right is decided — ${step.left} on the left, ${n - 1 - step.right} on the right`,
          pointerSnapshot(values, pointerMarks(n, step.left, step.right, 'focus')),
          [
            {
              motion: 'flow',
              from: cellRef(element(step.from)),
              to: cellRef(element(step.to)),
              carries: null,
              along: null,
            },
          ],
        );
        return;
      }

      case 'found':
        rec.emit(
          `${values[step.left]} + ${values[step.right]} = ${target}`,
          `${n} values, one pass, ${n - 1 - (step.right - step.left)} eliminated without ever being paired up`,
          pointerSnapshot(values, [
            {
              id: 'm.left',
              label: 'left',
              target: cellRef(element(step.left)),
              tone: 'compare',
            },
            {
              id: 'm.right',
              label: 'right',
              target: cellRef(element(step.right)),
              tone: 'compare',
            },
          ]),
          [
            {
              motion: 'settle',
              via: 'direct',
              refs: [cellRef(element(step.left)), cellRef(element(step.right))],
            },
          ],
        );
        return;

      case 'exhausted':
        rec.emit(
          `the pointers met — no pair sums to ${target}`,
          'every pair was eliminated in a single pass',
          pointerSnapshot(values, pointerMarks(n, step.left, step.right, 'focus')),
        );
        return;
    }
  };

  twoSumSorted(values, target, observe);
  return rec.done();
}

// ===========================================================================
// Input
// ===========================================================================

export interface ParsedInput {
  readonly values: readonly Value[];
  /** Text after a colon: the growth strategy is chosen by button, not here. */
  readonly variant: string | null;
  readonly error: string | null;
}

/** `3 1 4 1 5`, or `3 1 4 : 9` where the tail is the structure's own variant. */
export function parseNumbers(text: string, limit: number): ParsedInput {
  const [head, tail] = text.split(':');
  const tokens = head.split(/[\s,]+/).filter((t) => t.length > 0);
  const values: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (!Number.isFinite(n)) {
      return { values: [], variant: null, error: `"${t}" is not a number` };
    }
    values.push(n);
  }
  if (values.length === 0) return { values: [], variant: null, error: 'type some numbers' };
  if (values.length > limit) {
    return { values: [], variant: null, error: `at most ${limit} values — this is a picture, not a table` };
  }
  return {
    values,
    variant: tail === undefined ? null : tail.trim(),
    error: null,
  };
}
