/**
 * MEASURED CPython list over-allocation. This file is DATA, not a derivation.
 *
 * The DSA-1 correctness target requires that the real-growth strategy be
 * derived by measurement on the exact Python on this machine, and that the
 * measured numbers — not any remembered formula — are the source of truth.
 * This is that measurement, committed alongside the code that renders it.
 *
 * PROVENANCE
 *   Python   3.14.6 (tags/v3.14.6:c63aec6, Jun 10 2026, 10:26:10)
 *            [MSC v.1944 64 bit (AMD64)]
 *   Machine  Windows 11 Pro 10.0.26200, x86-64
 *   Date     2026-08-23
 *   Method   append to a list one element at a time; record every append at
 *            which `sys.getsizeof` changes. Capacity is implied:
 *              capacity = (getsizeof(list) - getsizeof([])) / 8
 *            with getsizeof([]) = 56 and 8-byte pointers, both measured.
 *
 *   Reproduce:
 *     python -c "
 *     import sys
 *     L=[]; empty=prev=sys.getsizeof(L)
 *     for i in range(300):
 *         L.append(i); s=sys.getsizeof(L)
 *         if s!=prev: print(i+1, s, (s-empty)//8); prev=s
 *     "
 *
 * WHAT IT SHOWS — the point the animation has to land:
 *   Real growth is NOT doubling. It doubles only twice (4→8→16) and then
 *   decays fast: 1.5, 1.33, 1.25, ... settling near 1.16. It is still
 *   amortized O(1) — a constant FACTOR is all that requires, and 1.125 is a
 *   constant — but the buffer grows visibly more tightly than the from-scratch
 *   `DynamicArray` the curriculum has you build.
 *
 * THE 24-vs-25 QUESTION, settled:
 *   Published accounts disagree about the capacity after 16. This Python
 *   gives **24**. Measured, not recalled.
 */

/**
 * The header above, as data, so a trace can carry its provenance into the UI
 * without anyone retyping a version number from memory.
 */
export const PROVENANCE =
  'measured on Python 3.14.6 (tags/v3.14.6:c63aec6, MSC v.1944 64-bit), Windows 11, 2026-08-23';

/** One reallocation point. */
export interface GrowthPoint {
  /** The append (1-based) at which the buffer was reallocated. */
  readonly atAppend: number;
  /** `sys.getsizeof(list)` in bytes immediately after that append. */
  readonly sizeofBytes: number;
  /** Implied slot count: (sizeofBytes - 56) / 8. */
  readonly capacity: number;
}

/** `sys.getsizeof([])` on the machine above. */
export const EMPTY_LIST_BYTES = 56;

/** Pointer width on the machine above. */
export const POINTER_BYTES = 8;

/**
 * The measurement. Sixteen reallocation points — the target asked for at
 * least ten. Do not edit these by hand; re-run the command above.
 */
export const MEASURED: readonly GrowthPoint[] = [
  { atAppend: 1, sizeofBytes: 88, capacity: 4 },
  { atAppend: 5, sizeofBytes: 120, capacity: 8 },
  { atAppend: 9, sizeofBytes: 184, capacity: 16 },
  { atAppend: 17, sizeofBytes: 248, capacity: 24 },
  { atAppend: 25, sizeofBytes: 312, capacity: 32 },
  { atAppend: 33, sizeofBytes: 376, capacity: 40 },
  { atAppend: 41, sizeofBytes: 472, capacity: 52 },
  { atAppend: 53, sizeofBytes: 568, capacity: 64 },
  { atAppend: 65, sizeofBytes: 664, capacity: 76 },
  { atAppend: 77, sizeofBytes: 792, capacity: 92 },
  { atAppend: 93, sizeofBytes: 920, capacity: 108 },
  { atAppend: 109, sizeofBytes: 1080, capacity: 128 },
  { atAppend: 129, sizeofBytes: 1240, capacity: 148 },
  { atAppend: 149, sizeofBytes: 1432, capacity: 172 },
  { atAppend: 173, sizeofBytes: 1656, capacity: 200 },
  { atAppend: 201, sizeofBytes: 1912, capacity: 232 },
];

/** The largest append the measurement reaches. Past this, nothing was measured. */
export const MEASURED_THROUGH_APPEND = 201;

/**
 * Where a capacity number came from. Three values, because there are genuinely
 * three regimes and collapsing them would state the boundary wrongly:
 *
 *   'measured'       an exact measured reallocation point backs this pair —
 *                    `point` carries the raw reading it came from.
 *   'verified-range' newSize <= 201: inside the regime where the rule was
 *                    checked against all sixteen measured points, but this
 *                    exact pair is not itself one of them.
 *   'extrapolated'   newSize > 201: the rule applied beyond anything measured.
 *                    STATE.md's labelling rule is NOT discharged here, and any
 *                    UI that shows such a capacity must say so.
 */
export type CapacityBasis = 'measured' | 'verified-range' | 'extrapolated';

/**
 * A capacity together with what backs it.
 *
 * WHY THIS SHAPE (the boundary is enforceable, not documentary). The n <= 201
 * boundary is a property of the CLAIM, not of the number — a bare `number`
 * cannot carry it, so a caller past 201 had no way to know it was extrapolating
 * and a comment could not make it know. Returning a record puts the basis in the
 * caller's hands: it must destructure `capacity` and therefore has `basis` in
 * scope, and the compiler will not let it pretend otherwise.
 *
 * The arithmetic below 201 is untouched: `capacity` is the same integer the old
 * bare-number call returned, for every n. Nothing about the growth rule changed;
 * only the label travelling beside it is new.
 */
export interface CapacityClaim {
  readonly capacity: number;
  readonly basis: CapacityBasis;
  /** The raw measured reading, when this exact pair is one. Null otherwise. */
  readonly point: GrowthPoint | null;
  /** The boundary itself, so a caller can render "measured to append 201". */
  readonly measuredThroughAppend: number;
}

/**
 * The rule. VERIFIED across 16 measured points (n <= 201, Python 3.14.6, single
 * platform), checked 2026-08-23 — a compression of the measurement IN THE
 * MEASURED REGIME, not a general proof of CPython's growth rule.
 *
 * DELIBERATELY NOT EXPORTED (Unit 3, carry-forward 4). An exported bare-number
 * capacity function is an unlabelled escape hatch around the boundary, and
 * leaving one open would make the boundary documentary again. `cpythonCapacity`
 * is the only way out of this module, and it always carries its basis.
 * `MEASURED` still outranks it: on any disagreement after a re-measure, the
 * measurement wins and this function is deleted.
 */
function cpythonCapacityFor(newSize: number): number {
  if (newSize <= 0) return 0;
  const over = newSize + (newSize >> 3) + 6;
  return over - (over % 4);
}

/**
 * The CPython capacity for a list that must now hold `newSize` items, with the
 * provenance of that number attached.
 *
 * Where a measured point exists for exactly this append, the MEASUREMENT is
 * returned — not the rule's output — because the measurement is the source of
 * truth and the rule is only its compression.
 */
export function cpythonCapacity(newSize: number): CapacityClaim {
  if (newSize <= 0) {
    return {
      capacity: 0,
      basis: 'measured',
      point: null,
      measuredThroughAppend: MEASURED_THROUGH_APPEND,
    };
  }

  const point = MEASURED.find((p) => p.atAppend === newSize) ?? null;
  if (point !== null) {
    return {
      capacity: point.capacity,
      basis: 'measured',
      point,
      measuredThroughAppend: MEASURED_THROUGH_APPEND,
    };
  }

  return {
    capacity: cpythonCapacityFor(newSize),
    basis: newSize <= MEASURED_THROUGH_APPEND ? 'verified-range' : 'extrapolated',
    point: null,
    measuredThroughAppend: MEASURED_THROUGH_APPEND,
  };
}

/**
 * The curriculum's from-scratch strategy, for the side-by-side comparison.
 * Start at 4 to match CPython's first block, then double.
 */
export function doublingCapacityFor(newSize: number): number {
  if (newSize <= 0) return 0;
  let cap = 4;
  while (cap < newSize) cap *= 2;
  return cap;
}

/**
 * Guard: does the private rule still reproduce every measured point?
 *
 * This is the check that keeps the rule honest, and it is why the rule stays in
 * this file rather than moving somewhere convenient — the compression and the
 * thing it compresses have to be able to see each other. `npm run check` runs it.
 */
export function ruleMatchesMeasurement(): boolean {
  return MEASURED.every((p) => cpythonCapacityFor(p.atAppend) === p.capacity);
}
