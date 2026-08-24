/**
 * DSA-1, linked list — the RECORDER.
 *
 * Same contract as the array's: it records the walk that `algorithm.ts`
 * performed and adds nothing to it. The one thing it computes for itself is the
 * GAP between the two pointers, and that is a measurement of the structure at
 * that instant (which node each pointer is on, how long the loop is), not a
 * claim about what will happen next.
 *
 * The gap is the point of the whole target. Watching two rings go round a ring
 * of nodes is pretty; watching "fast is 3 ahead, 2 ahead, 1 ahead, 0" is the
 * proof that a faster pointer inside a cycle cannot fail to catch a slower one.
 */

import {
  EMPTY_SNAPSHOT,
  TraceRecorder,
  linkRef,
  nodeRef,
  type LinkState,
  type MarkState,
  type NodeState,
  type Snapshot,
  type Trace,
  type TraceEvent,
  type Value,
} from '../../engine/trace';
import { buildList, detectCycle, type ListNode, type WalkStep } from './algorithm';

const nodeId = (index: number): string => `n${index}`;
/** Node i's `next` pointer. One link per node, whether or not it points anywhere. */
const linkId = (index: number): string => `l${index}`;

export interface ParsedList {
  readonly values: readonly Value[];
  readonly variant: string | null;
  readonly error: string | null;
}

/** `1 2 3 4 5 6 : 2` — the tail is the index the last node loops back to. */
export function parseList(text: string, limit: number): ParsedList {
  const [head, tail] = text.split(':');
  const tokens = head.split(/[\s,]+/).filter((t) => t.length > 0);
  const values: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (!Number.isFinite(n)) return { values: [], variant: null, error: `"${t}" is not a number` };
    values.push(n);
  }
  if (values.length === 0) return { values: [], variant: null, error: 'type some numbers' };
  if (values.length > limit) {
    return { values: [], variant: null, error: `at most ${limit} nodes — one figure, not a diagram` };
  }
  const asked = tail === undefined ? null : tail.trim();
  if (asked !== null && asked !== '' && asked.toLowerCase() !== 'none') {
    const at = Number(asked);
    if (!Number.isInteger(at) || at < -1 || at >= values.length) {
      return {
        values: [],
        variant: null,
        error: `loop target must be an index in 0..${values.length - 1}, or "none"`,
      };
    }
  }
  return { values, variant: asked, error: null };
}

/** `null` means: build a plain terminated list. */
function cycleTargetFor(count: number, variant: string): number | null {
  const text = variant.trim().toLowerCase();
  if (text === 'none' || text === '-1') return null;
  if (text !== '') {
    const at = Number(text);
    if (Number.isInteger(at) && at >= 0 && at < count) return at;
    return null;
  }
  // No preference given: loop the tail back into the first third, so there is a
  // straight run into a ring rather than one big circle.
  return count >= 3 ? Math.floor(count / 3) : null;
}

// ===========================================================================
// Snapshots
// ===========================================================================

function snapshotOf(nodes: readonly ListNode[], marks: readonly MarkState[]): Snapshot {
  const index = new Map<ListNode, number>();
  nodes.forEach((n, i) => index.set(n, i));

  const nodeStates: NodeState[] = nodes.map((n, i) => ({
    id: nodeId(i),
    value: n.value,
    status: 'live',
    caption: i === 0 ? 'head' : null,
  }));

  const linkStates: LinkState[] = nodes.map((n, i) => ({
    id: linkId(i),
    from: nodeId(i),
    to: n.next === null ? null : nodeId(index.get(n.next) ?? 0),
    // Every `next` is a POINTER, so every link here is directed. An undirected
    // link would be a graph edge, and this is not that.
    directed: true,
    status: 'live',
  }));

  return {
    ...EMPTY_SNAPSHOT,
    nodes: nodeStates,
    links: linkStates,
    marks,
    entry: nodes.length > 0 ? nodeRef(nodeId(0)) : null,
  };
}

/**
 * `together` is not "are they on the same node" — the marks can see that. It is
 * whether the ALGORITHM has declared a meeting.
 *
 * The difference matters, and it is a place this could easily have lied. Slow
 * moves before fast within a tick, so slow can land on the node fast is standing
 * on without that being a meeting at all: the test happens after both have
 * moved. So a bare coincidence is drawn quietly, as "both are here", and only a
 * meeting the algorithm actually reported is drawn as `slow = fast`.
 */
function marksFor(
  index: Map<ListNode, number>,
  slow: ListNode | null,
  fast: ListNode | null,
  together: 'start' | 'met' | null,
): MarkState[] {
  const marks: MarkState[] = [];
  if (slow !== null && fast !== null && slow === fast) {
    marks.push({
      id: 'm.slow',
      label: together === 'met' ? 'slow = fast' : 'slow + fast',
      target: nodeRef(nodeId(index.get(slow) ?? 0)),
      tone: together === 'met' ? 'compare' : 'focus',
    });
    return marks;
  }
  if (slow !== null) {
    marks.push({
      id: 'm.slow',
      label: 'slow',
      target: nodeRef(nodeId(index.get(slow) ?? 0)),
      tone: 'focus',
    });
  }
  if (fast !== null) {
    marks.push({
      id: 'm.fast',
      label: 'fast',
      target: nodeRef(nodeId(index.get(fast) ?? 0)),
      tone: 'compare',
    });
  }
  return marks;
}

// ===========================================================================
// The trace — DSA-1 correctness target 3
// ===========================================================================

/**
 * Fast-slow cycle detection, recorded.
 *
 * `variant` is the index the tail loops back to — that is what makes this list
 * the interesting kind. `none` builds a terminated list instead, which is worth
 * watching too: it is where fast walks off the end and the answer is "no cycle".
 */
export function cycleTrace(input: readonly Value[], variant: string): Trace {
  const values = input
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => !Number.isNaN(v));

  const cycleAt = cycleTargetFor(values.length, variant);
  const shape = buildList(values, cycleAt);
  const nodes = shape.nodes;
  const index = new Map<ListNode, number>();
  nodes.forEach((n, i) => index.set(n, i));

  const rec = new TraceRecorder(
    cycleAt === null
      ? `fast-slow · ${values.length} nodes, no loop`
      : `fast-slow · ${values.length} nodes, tail loops to index ${cycleAt}`,
    values,
    cycleAt === null ? 'none' : String(cycleAt),
  );
  rec.note('LC #141 — cycle detection on your own Node class.');
  rec.note(
    cycleAt === null
      ? 'the tail points at nothing, so fast reaches the end and the answer is "no cycle".'
      : `the tail's next points back at node ${cycleAt}; nothing about a node says it is in a loop.`,
  );

  const loopLength = cycleAt === null ? 0 : nodes.length - cycleAt;

  /**
   * How much further fast has to travel round the loop to land on slow. Null
   * unless both pointers are inside the loop, where the question has no answer.
   *
   * The DIRECTION here is the whole argument and it is easy to get backwards.
   * Fast is not running away from slow; going round a closed ring it is coming
   * up BEHIND it. Each tick fast covers two nodes and slow covers one, so the
   * distance from fast forward to slow drops by exactly one — 2, 1, 0. Measured
   * the other way round the same numbers count UP, which would make the
   * invariant read as a contradiction of what the animation is showing.
   */
  const gapOf = (slow: ListNode, fast: ListNode): number | null => {
    if (cycleAt === null || loopLength <= 0) return null;
    const s = index.get(slow) ?? 0;
    const f = index.get(fast) ?? 0;
    if (s < cycleAt || f < cycleAt) return null;
    return (s - f + loopLength) % loopLength;
  };

  let slow: ListNode | null = shape.head;
  let fast: ListNode | null = shape.head;
  /** Fast's first hop of this tick, held so both hops land in one frame. */
  let pendingLeg: { from: ListNode; to: ListNode } | null = null;

  const flowAlong = (from: ListNode, to: ListNode): TraceEvent => ({
    motion: 'flow',
    from: nodeRef(nodeId(index.get(from) ?? 0)),
    to: nodeRef(nodeId(index.get(to) ?? 0)),
    carries: null,
    along: linkRef(linkId(index.get(from) ?? 0)),
  });

  const observe = (step: WalkStep): void => {
    switch (step.kind) {
      case 'start':
        slow = step.at;
        fast = step.at;
        rec.emit(
          nodes.length === 0
            ? 'an empty list'
            : `${nodes.length} nodes${cycleAt === null ? '' : ' — the tail loops back'}`,
          'slow and fast both start at the head',
          snapshotOf(nodes, marksFor(index, slow, fast, 'start')),
        );
        return;

      case 'advance': {
        if (step.who === 'slow') {
          slow = step.to;
          rec.emit(
            `slow follows one next — to ${step.to === null ? 'nothing' : step.to.value}`,
            'one hop per tick',
            snapshotOf(nodes, marksFor(index, slow, fast, null)),
            step.to === null ? [] : [flowAlong(step.from, step.to)],
          );
          return;
        }

        // Fast's two hops are one beat, so they are held and emitted together.
        if (step.leg === 1) {
          pendingLeg = step.to === null ? null : { from: step.from, to: step.to };
          return;
        }

        const first = pendingLeg;
        pendingLeg = null;
        fast = step.to;

        if (step.to === null) {
          rec.emit(
            'fast follows next twice — and runs out of list',
            'a list you can walk off the end of has no cycle',
            snapshotOf(nodes, marksFor(index, slow, fast, null)),
            first === null ? [] : [flowAlong(first.from, first.to)],
          );
          return;
        }

        const events: TraceEvent[] = [];
        if (first !== null) events.push(flowAlong(first.from, first.to));
        events.push(flowAlong(step.from, step.to));
        rec.emit(
          `fast follows next twice — to ${step.to.value}`,
          'two hops per tick: fast covers ground at double the rate',
          snapshotOf(nodes, marksFor(index, slow, fast, null)),
          events,
        );
        return;
      }

      case 'compare': {
        const gap = gapOf(step.slow, step.fast);
        const invariant =
          gap === null
            ? 'not both inside a loop yet — nothing can be concluded'
            : gap === 0
              ? 'the gap is closed — fast has landed exactly on slow'
              : `fast is ${gap} node${gap === 1 ? '' : 's'} short of slow around the loop — ` +
                'each tick closes that by exactly one';
        rec.emit(
          step.same ? 'slow and fast are on the same node' : 'slow and fast are still apart',
          invariant,
          snapshotOf(nodes, marksFor(index, step.slow, step.fast, step.same ? 'met' : null)),
        );
        return;
      }

      case 'meet':
        rec.emit(
          `they meet at ${step.at.value} — the list has a cycle`,
          'a gap that shrinks by one every tick and cannot go below zero must reach zero',
          snapshotOf(nodes, marksFor(index, step.at, step.at, 'met')),
          [{ motion: 'settle', via: 'direct', refs: [nodeRef(nodeId(index.get(step.at) ?? 0))] }],
        );
        return;

      case 'exhausted':
        rec.emit(
          'fast reached the end — no cycle',
          `${step.tick} ticks, and fast never had to look at a node twice`,
          snapshotOf(nodes, marksFor(index, slow, null, null)),
        );
        return;
    }
  };

  detectCycle(shape.head, observe);
  return rec.done();
}
