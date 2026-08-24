/**
 * DSA-1 — the executable implementations. This file RUNS the algorithms.
 *
 * Nothing here knows what a frame, a snapshot or a primitive is. It is an
 * ordinary `DynamicArray` and an ordinary two-pointer scan, with one addition:
 * every step they take is announced to an observer, together with a live view of
 * the machine's own memory. `trace.ts` turns those announcements into frames.
 *
 * That split is the whole reason the animation can be trusted. A trace is not a
 * story someone wrote about a resize; it is a recording of a resize happening.
 * If the copy loop below were wrong, the animation would show it being wrong.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE CURRICULUM ASKED FOR (reference/DSA + Backend in Python Plan.md:118)
 * ---------------------------------------------------------------------------
 * "Build your own `DynamicArray` class from scratch, backed by a fixed-size
 *  list you manage manually (pretend `list.append` doesn't exist), implementing
 *  a doubling growth strategy. Then use `sys.getsizeof` to empirically map at
 *  least 10 real reallocation points ... and compare."
 *
 * So there are two growth strategies and they are switchable, because the
 * comparison IS the task. The doubling one is the from-scratch class. The other
 * is not a remembered formula: it is the measurement in `growth.measured.ts`,
 * taken on this machine, with the rule used only to reach past it — labelled.
 */

import {
  cpythonCapacity,
  doublingCapacityFor,
  type CapacityClaim,
} from './growth.measured';

// ===========================================================================
// Growth strategies
// ===========================================================================

export type GrowthStrategy = 'doubling' | 'cpython';

export const GROWTH_STRATEGIES: readonly GrowthStrategy[] = ['doubling', 'cpython'];

export function isGrowthStrategy(value: string): value is GrowthStrategy {
  return value === 'doubling' || value === 'cpython';
}

// ===========================================================================
// The machine
// ===========================================================================

/**
 * One allocated buffer. `slots` is the real backing store — the observer sees
 * this array, mutations and all, so a recorder can never disagree with it.
 */
export interface Block {
  readonly id: string;
  readonly capacity: number;
  readonly slots: (number | null)[];
}

/** What the observer can see at the moment a step happens. */
export interface MachineView {
  /** Every block that currently exists, in allocation order. Two during a resize. */
  readonly blocks: readonly Block[];
  /** The block the array's own pointer names right now. */
  readonly homeId: string;
  /** Elements the array holds. */
  readonly size: number;
  /** How many elements of the retiring block have been copied so far. */
  readonly copied: number;
  /** Appends completed, and elements copied, over the whole run. */
  readonly appends: number;
  readonly copies: number;
  readonly strategy: GrowthStrategy;
}

/**
 * A step the machine actually took. Every one of these corresponds to a line of
 * the implementation below — there is no step that means "and now explain
 * something".
 */
export type ArrayStep =
  /** The run begins, on an empty array with no buffer. */
  | { readonly kind: 'start' }
  /**
   * `append(value)` was called. `willGrow` is the fullness test the very next
   * line performs, reported here so a recorder can decide whether this call is
   * worth a frame of its own.
   */
  | { readonly kind: 'request'; readonly value: number; readonly willGrow: boolean }
  /** `size == capacity`: there is no room, so the buffer has to be replaced. */
  | { readonly kind: 'full'; readonly capacity: number }
  /** A larger buffer was allocated. `claim` carries provenance for CPython runs. */
  | {
      readonly kind: 'allocate';
      readonly capacity: number;
      readonly from: number;
      readonly claim: CapacityClaim | null;
    }
  /** One element was copied across. This is the O(n) of a resize, one unit at a time. */
  | { readonly kind: 'copy'; readonly index: number; readonly value: number; readonly of: number }
  /** `self._buffer = new_buffer` — the array now names the new block. */
  | { readonly kind: 'rehome' }
  /** Nothing points at the old block any more; it is gone. */
  | { readonly kind: 'release'; readonly capacity: number }
  /** The value was written into its slot. */
  | { readonly kind: 'place'; readonly index: number; readonly value: number }
  /** The run is over. */
  | { readonly kind: 'done' };

export type ArrayObserver = (step: ArrayStep, view: MachineView) => void;

/**
 * A dynamic array built from scratch over a fixed-size buffer, as the
 * curriculum's diagnostic task specifies: `append` is the only mutator, and a
 * full buffer is replaced rather than extended, because a fixed-size block
 * cannot grow in place.
 */
export class DynamicArray {
  private buffer: Block;
  private retiring: Block | null = null;
  private count = 0;
  private copiedSoFar = 0;
  private allocations = 0;
  private appendCount = 0;
  private copyCount = 0;

  constructor(
    private readonly strategy: GrowthStrategy,
    private readonly observe: ArrayObserver,
  ) {
    // An empty array holds no buffer at all. The first append allocates one, and
    // that first allocation is a measured point in its own right (append 1 -> 4).
    this.buffer = { id: 'buf0', capacity: 0, slots: [] };
    this.allocations = 1;
    this.observe({ kind: 'start' }, this.view());
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.buffer.capacity;
  }

  /** Total element copies performed across every resize so far. */
  get copies(): number {
    return this.copyCount;
  }

  get(index: number): number {
    const v = this.buffer.slots[index];
    if (v === null || v === undefined) throw new RangeError(`index ${index} is empty`);
    return v;
  }

  append(value: number): void {
    const willGrow = this.count === this.buffer.capacity;
    this.observe({ kind: 'request', value, willGrow }, this.view());

    if (willGrow) this.grow(this.count + 1);

    this.buffer.slots[this.count] = value;
    const index = this.count;
    this.count += 1;
    this.appendCount += 1;
    this.observe({ kind: 'place', index, value }, this.view());
  }

  /** Call once, after the last append, so the trace has a closing frame. */
  finish(): void {
    this.observe({ kind: 'done' }, this.view());
  }

  /**
   * Replace the buffer with a larger one.
   *
   * The four beats here are the four beats of the animation, and they are in
   * this order because this is the order the code has to do them in: you cannot
   * copy into a buffer you have not allocated, and you cannot free a buffer you
   * are still reading from.
   */
  private grow(needed: number): void {
    this.observe({ kind: 'full', capacity: this.buffer.capacity }, this.view());

    // 1. how big should the new one be? — the one line the two strategies differ on
    const claim = this.strategy === 'cpython' ? cpythonCapacity(needed) : null;
    const capacity = claim !== null ? claim.capacity : doublingCapacityFor(needed);

    // 2. allocate it
    const older = this.buffer;
    const next: Block = {
      id: `buf${this.allocations}`,
      capacity,
      slots: new Array<number | null>(capacity).fill(null),
    };
    this.allocations += 1;
    this.copiedSoFar = 0;
    // `buffer` still names the old block: the array is not moved until the copy
    // is complete. Everything below reads `older` and writes `next`.
    this.observe(
      { kind: 'allocate', capacity, from: older.capacity, claim },
      this.viewDuringResize(next),
    );

    // 3. copy every element across — this is what makes one append cost O(n)
    for (let i = 0; i < this.count; i++) {
      const value = older.slots[i];
      if (value === null || value === undefined) {
        throw new Error(`dynamic-array: slot ${i} of ${older.id} was empty during a copy`);
      }
      next.slots[i] = value;
      this.copiedSoFar = i + 1;
      this.copyCount += 1;
      this.observe(
        { kind: 'copy', index: i, value, of: this.count },
        this.viewDuringResize(next),
      );
    }

    // 4. move in, then let the old block go
    this.buffer = next;
    this.retiring = older;
    this.observe({ kind: 'rehome' }, this.view());
    this.retiring = null;
    this.copiedSoFar = 0;
    this.observe({ kind: 'release', capacity: older.capacity }, this.view());
  }

  private view(): MachineView {
    const blocks = this.retiring === null ? [this.buffer] : [this.retiring, this.buffer];
    return {
      blocks,
      homeId: this.buffer.id,
      size: this.count,
      copied: this.copiedSoFar,
      appends: this.appendCount,
      copies: this.copyCount,
      strategy: this.strategy,
    };
  }

  /** During a resize the array still lives in the old block; `next` is not home yet. */
  private viewDuringResize(next: Block): MachineView {
    return {
      blocks: [this.buffer, next],
      homeId: this.buffer.id,
      size: this.count,
      copied: this.copiedSoFar,
      appends: this.appendCount,
      copies: this.copyCount,
      strategy: this.strategy,
    };
  }
}

// ===========================================================================
// Opposite-end two pointers — the second DSA-1 correctness target
// ===========================================================================

/**
 * A step of the two-pointer scan. Same discipline: each one is a line of the
 * loop below.
 */
export type PointerStep =
  | { readonly kind: 'start'; readonly left: number; readonly right: number }
  /** The pair at (left, right) was added up and weighed against the target. */
  | {
      readonly kind: 'weigh';
      readonly left: number;
      readonly right: number;
      readonly sum: number;
      readonly verdict: 'low' | 'high' | 'hit';
    }
  /** A pointer moved inward, which DECIDES the element it left behind. */
  | {
      readonly kind: 'advance';
      readonly side: 'left' | 'right';
      readonly from: number;
      readonly to: number;
      readonly left: number;
      readonly right: number;
    }
  | { readonly kind: 'found'; readonly left: number; readonly right: number }
  | { readonly kind: 'exhausted'; readonly left: number; readonly right: number };

export type PointerObserver = (step: PointerStep) => void;

/**
 * LC #167 — two sum on a SORTED array, opposite-end convergence.
 *
 * The invariant the animation exists to show: when `values[left] + values[right]`
 * is too small, no pair using `left` can ever work, because `right` is already
 * the largest partner available — so `left` moves in and everything to its left
 * is DECIDED. Symmetrically on the right. That is why the scan is O(n) and why
 * the region outside the two pointers only ever grows.
 *
 * @param values must be sorted ascending; the caller sorts.
 * @returns the pair of indices, or null.
 */
export function twoSumSorted(
  values: readonly number[],
  target: number,
  observe: PointerObserver,
): readonly [number, number] | null {
  let left = 0;
  let right = values.length - 1;
  observe({ kind: 'start', left, right });

  while (left < right) {
    const sum = values[left] + values[right];
    const verdict = sum === target ? 'hit' : sum < target ? 'low' : 'high';
    observe({ kind: 'weigh', left, right, sum, verdict });

    if (verdict === 'hit') {
      observe({ kind: 'found', left, right });
      return [left, right];
    }
    if (verdict === 'low') {
      const from = left;
      left += 1;
      observe({ kind: 'advance', side: 'left', from, to: left, left, right });
    } else {
      const from = right;
      right -= 1;
      observe({ kind: 'advance', side: 'right', from, to: right, left, right });
    }
  }

  observe({ kind: 'exhausted', left, right });
  return null;
}
