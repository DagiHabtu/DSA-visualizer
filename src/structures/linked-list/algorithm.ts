/**
 * DSA-1, singly linked list — the executable implementation.
 *
 * The curriculum is explicit that this is written from scratch
 * (reference/DSA + Backend in Python Plan.md:116): "built here as your own
 * `Node`/`LinkedList` classes — Python has no built-in singly linked list type
 * ... you write the node class once, from scratch, and it is exactly what every
 * later linked-list problem uses." So `ListNode` below is the whole storage
 * model: a value and a `next`. Nothing else.
 *
 * The target is LC #141, cycle detection by the fast-slow pointer, and the thing
 * the animation has to make visible is not that it works but WHY it must:
 * inside a loop the fast pointer gains exactly one position on the slow one
 * every tick, and a gap that shrinks by one every tick and cannot go below zero
 * has to reach zero. A book can assert that. A picture of two pointers going
 * round a ring, with the gap counted off, shows it.
 *
 * As with the array, this file announces what it does and knows nothing about
 * frames or primitives.
 */

// ===========================================================================
// The node — written once, from scratch
// ===========================================================================

export class ListNode {
  next: ListNode | null = null;

  constructor(readonly value: number) {}
}

export interface ListShape {
  readonly head: ListNode | null;
  /** Every node, in construction order. `nodes[i].next` may point anywhere. */
  readonly nodes: readonly ListNode[];
  /** Index the last node loops back to, or null for a plain terminated list. */
  readonly cycleAt: number | null;
}

/**
 * Build a list, optionally tying the tail back to `cycleAt` to create a loop.
 *
 * A cycle is not a special kind of list — it is an ordinary list whose last
 * `next` happens to point at a node it has already been through. That is the
 * entire trick, and it is why cycle detection is needed at all: nothing about a
 * node says whether it is in a loop.
 */
export function buildList(values: readonly number[], cycleAt: number | null): ListShape {
  const nodes = values.map((v) => new ListNode(v));
  for (let i = 0; i + 1 < nodes.length; i++) nodes[i].next = nodes[i + 1];

  const valid =
    cycleAt !== null && Number.isInteger(cycleAt) && cycleAt >= 0 && cycleAt < nodes.length;
  if (valid && nodes.length > 0) {
    nodes[nodes.length - 1].next = nodes[cycleAt];
  }

  return {
    head: nodes.length > 0 ? nodes[0] : null,
    nodes,
    cycleAt: valid ? cycleAt : null,
  };
}

// ===========================================================================
// Fast-slow cycle detection
// ===========================================================================

export type WalkStep =
  | { readonly kind: 'start'; readonly at: ListNode | null }
  /**
   * One pointer followed one `next`. Fast does this twice per tick, which is the
   * entire reason it closes on slow.
   */
  | {
      readonly kind: 'advance';
      readonly who: 'slow' | 'fast';
      readonly from: ListNode;
      readonly to: ListNode | null;
      /** Which of fast's two hops this is. Slow is always leg 1. */
      readonly leg: 1 | 2;
      readonly tick: number;
    }
  /** `slow is fast` — the test at the bottom of the loop. */
  | {
      readonly kind: 'compare';
      readonly slow: ListNode;
      readonly fast: ListNode;
      readonly same: boolean;
      readonly tick: number;
    }
  | { readonly kind: 'meet'; readonly at: ListNode; readonly tick: number }
  /** Fast ran off the end: a list you can walk off has no cycle. */
  | { readonly kind: 'exhausted'; readonly tick: number };

export type WalkObserver = (step: WalkStep) => void;

/**
 * LC #141 — does this list contain a cycle?
 *
 * Slow takes one step per tick, fast takes two. If there is an end, fast finds
 * it. If there is not, both pointers are eventually inside the loop, and from
 * that moment fast closes the gap by exactly one per tick.
 *
 * @returns the node where they met, or null if the list terminates.
 */
export function detectCycle(head: ListNode | null, observe: WalkObserver): ListNode | null {
  observe({ kind: 'start', at: head });
  if (head === null) {
    observe({ kind: 'exhausted', tick: 0 });
    return null;
  }

  let slow: ListNode = head;
  let fast: ListNode | null = head;
  let tick = 0;

  while (fast !== null && fast.next !== null) {
    tick += 1;

    // Slow: one hop. `fast.next !== null` guarantees slow has somewhere to go,
    // because slow is never ahead of fast.
    const slowFrom = slow;
    const slowTo = slow.next;
    if (slowTo === null) {
      observe({ kind: 'exhausted', tick });
      return null;
    }
    slow = slowTo;
    observe({ kind: 'advance', who: 'slow', from: slowFrom, to: slow, leg: 1, tick });

    // Fast: two hops, announced separately so the two-for-one is watchable.
    const fastFrom = fast;
    const mid: ListNode = fast.next;
    observe({ kind: 'advance', who: 'fast', from: fastFrom, to: mid, leg: 1, tick });
    const end: ListNode | null = mid.next;
    observe({ kind: 'advance', who: 'fast', from: mid, to: end, leg: 2, tick });
    fast = end;

    if (fast === null) break;

    const same = fast === slow;
    observe({ kind: 'compare', slow, fast, same, tick });
    if (same) {
      observe({ kind: 'meet', at: slow, tick });
      return slow;
    }
  }

  observe({ kind: 'exhausted', tick });
  return null;
}
