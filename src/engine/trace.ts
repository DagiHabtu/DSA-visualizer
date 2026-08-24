/**
 * THE STATE-TRACE FORMAT — the contract between an algorithm and the engine.
 *
 * An animation is nothing but a rendering of a sequence of states. This file
 * defines that sequence. It freezes at Gate 1, and every structure built after
 * that is written against it, so it is designed for one property above all
 * others: you can read a frame and check it against what the real algorithm
 * actually does.
 *
 * ---------------------------------------------------------------------------
 * FIVE DECISIONS, AND WHY
 * ---------------------------------------------------------------------------
 * 1. FULL SNAPSHOTS, NEVER DELTAS. Each frame carries the entire structure.
 *    Stepping backward is therefore `seek(i - 1)` and nothing else — no undo
 *    log, no replay from zero, no chance of the visual state drifting away from
 *    the algorithmic one. It costs memory that a teaching tool does not have to
 *    care about, and it buys correctness that it does.
 *
 * 2. THE SNAPSHOT IS WRITTEN IN THE GRAMMAR, NOT IN STRUCTURE SCHEMAS. There is
 *    no `kind: 'dynamic-array'` branch here and there never will be. A snapshot
 *    is banks, cells, nodes, links and marks — which is to say, it is written in
 *    the same five primitives everything is drawn in. A dynamic array uses banks
 *    and cells; a linked list uses nodes and links; both use marks. Adding a
 *    structure adds no case to this file.
 *
 * 3. IDENTITY IS A STRING, AND IT IS LOAD-BEARING. `id` is what lets frame N+1
 *    be understood as frame N moved: the view matches ids, sees that cell `a2`
 *    is now in bank `new` at index 2, and animates it. It is also what makes
 *    every wobble and freckle stable, because the primitives derive their jitter
 *    from the id. Reusing an id for a different thing is the one way to break
 *    this format.
 *
 * 4. NO POSITIONS. The trace says WHAT is true, never WHERE it is drawn. Layout
 *    is a per-structure view's job. That keeps the trace verifiable against the
 *    algorithm rather than against a picture.
 *
 * 5. EVENTS NAME THE THREE MOTIONS, AND NOTHING ELSE. `settle`, `swap`, `flow`.
 *    The particle field is reached by one flag on a settle — `via: 'field'` —
 *    and that flag is the whole of the emergence signature. A structure that
 *    never sets it never becomes a particle cloud, which is exactly the
 *    guardrail: a linked list is about the pointers between nodes.
 *
 * ---------------------------------------------------------------------------
 * WHO WRITES THESE
 * ---------------------------------------------------------------------------
 * Traces are GENERATED, never narrated. Each structure gets an `algorithm.ts`
 * carrying a real, executable implementation that emits frames as it runs, via
 * `TraceRecorder`. That is what makes a trace correct by construction, and it is
 * what makes "type your own input" possible at all — the same code, run on the
 * user's numbers, produces a different trace.
 *
 * ---------------------------------------------------------------------------
 * WORKED EXAMPLE — DSA-1, appending to a full buffer
 * ---------------------------------------------------------------------------
 * Two frames of a resize, written out, so the shape is concrete:
 *
 *   frame 6  "buffer is full — allocate a larger one"
 *     banks  [ {id:'buf0', capacity:4, size:4, label:'cap 4',  status:'live'},
 *              {id:'buf1', capacity:8, size:0, label:'cap 8',  status:'live'} ]
 *     cells  [ {id:'c0', bank:'buf0', index:0, value:3,    status:'live'}, ...
 *              {id:'n0', bank:'buf1', index:0, value:null, status:'empty'}, ... ]
 *     marks  [ {id:'m.append', label:'append 9', target:{on:'bank',id:'buf1'},
 *               tone:'focus'} ]
 *     events [ {motion:'settle', via:'field',
 *               refs:[{on:'cell',id:'n0'}, ... ]} ]     <- the emergence beat
 *
 *   frame 7  "copy element 0 into the new buffer"
 *     ... same banks, buf1.size now 1 ...
 *     events [ {motion:'flow', from:{on:'cell',id:'c0'}, to:{on:'cell',id:'n0'},
 *               carries:3} ]
 *
 * And the fast-slow pointer, which exists to exercise `node` and `link` before
 * the API freezes:
 *
 *   frame 4  "fast moves twice, slow moves once"
 *     nodes  [ {id:'n1', value:3, status:'live'}, ... ]
 *     links  [ {id:'l1', from:'n1', to:'n2', directed:true, status:'live'}, ...
 *              {id:'l6', from:'n6', to:'n3', directed:true, status:'live'} ]
 *     marks  [ {id:'m.slow', label:'slow', target:{on:'node',id:'n2'}, tone:'focus'},
 *              {id:'m.fast', label:'fast', target:{on:'node',id:'n4'}, tone:'compare'} ]
 *     events [ {motion:'flow', from:{on:'node',id:'n1'}, to:{on:'node',id:'n2'},
 *               carries:null, along:{on:'link',id:'l1'}} ]
 *
 * Nothing in this file hardcodes a duration; TIMING owns those.
 */

import { TIMING, clamp01 } from '../tokens/tokens';

// ===========================================================================
// References
// ===========================================================================

/** A displayed value. The algorithm owns semantics; the trace carries display. */
export type Value = number | string;

/** A pointer at one thing in a snapshot. */
export type Ref =
  | { readonly on: 'bank'; readonly id: string }
  | { readonly on: 'cell'; readonly id: string }
  | { readonly on: 'node'; readonly id: string }
  | { readonly on: 'link'; readonly id: string };

/**
 * What a mark is attached to: one thing, or a run of cells.
 *
 * The `span` case is what makes a region-level invariant visible — "everything
 * outside the two pointers is decided" is a claim about a range, and it has to
 * be expressible or the two-pointer target cannot be rendered honestly.
 */
export type Target =
  | Ref
  | {
      readonly on: 'span';
      readonly bank: string;
      /** Inclusive cell indices within that bank. */
      readonly from: number;
      readonly to: number;
    };

/** Present, allocated-but-empty, or released. Mirrors the primitives' `Status`. */
export type Status = 'live' | 'empty' | 'stale';

/** Which question a mark is answering. Mirrors the highlight primitive's tones. */
export type Tone = 'focus' | 'compare' | 'decided';

// ===========================================================================
// The snapshot
// ===========================================================================

/**
 * A contiguous buffer. A dynamic array has one of these; during a resize it has
 * two, and BOTH are in the snapshot at once — which is the entire point of the
 * resize animation and the reason `bank` exists rather than a single implicit
 * array.
 *
 * `size` is carried alongside the cells even though it is derivable from them.
 * That redundancy is deliberate: if `size` and the non-null cells disagree, the
 * algorithm has a bug, and `validate` will say so. A verification format should
 * be over-determined.
 */
export interface BankState {
  readonly id: string;
  /** Number of slots allocated. This is what a growth strategy changes. */
  readonly capacity: number;
  /** Number of slots in use. */
  readonly size: number;
  /** Shown to the reader: `cap 8 · size 5`. */
  readonly label: string;
  readonly status: Status;
}

export interface CellState {
  readonly id: string;
  /** Which bank this slot belongs to. */
  readonly bank: string;
  /** Slot index within that bank, 0-based. */
  readonly index: number;
  readonly value: Value | null;
  readonly status: Status;
}

export interface NodeState {
  readonly id: string;
  readonly value: Value | null;
  readonly status: Status;
  /** A permanent name under the node — `head`. Null for most nodes. */
  readonly caption: string | null;
}

export interface LinkState {
  readonly id: string;
  readonly from: string;
  /** The node pointed at, or null for a pointer that points at nothing. */
  readonly to: string | null;
  /** A directed link is a POINTER. An undirected one is an edge. */
  readonly directed: boolean;
  readonly status: Status;
}

/**
 * A named position the algorithm is holding: `left`, `right`, `slow`, `fast`,
 * `i`. Marks are the trace's side of the `highlight` primitive, and they are
 * how invariants become visible.
 */
export interface MarkState {
  readonly id: string;
  readonly label: string;
  readonly target: Target;
  readonly tone: Tone;
}

/**
 * The complete state of the structure at one step. Everything. No deltas.
 *
 * A dynamic array populates `banks` and `cells`. A linked list populates `nodes`
 * and `links`. Both populate `marks`. A structure that needed something outside
 * these five lists would be a structure this grammar does not cover — and that
 * is a conversation with the human, not a new field.
 */
export interface Snapshot {
  readonly banks: readonly BankState[];
  readonly cells: readonly CellState[];
  readonly nodes: readonly NodeState[];
  readonly links: readonly LinkState[];
  readonly marks: readonly MarkState[];
  /**
   * Where reading starts, for structures whose order lives in their links
   * rather than in an index — the head of a list, the root of a tree. Null for
   * arrays, whose order is their indices.
   */
  readonly entry: Ref | null;
}

// ===========================================================================
// Events — the three motions, and nothing else
// ===========================================================================

/**
 * Elements easing down into position.
 *
 * `via` is the single switch for the signature. `'direct'` moves the elements
 * themselves. `'field'` runs the swarm → form → swarm beat: the elements
 * dissolve into specks, the specks scatter, and they re-form as the new
 * arrangement. Reach for `'field'` where it strengthens the idea — an array's
 * values finding homes in a larger buffer, values finding buckets in a hash
 * table — and leave it alone everywhere else.
 */
export interface SettleEvent {
  readonly motion: 'settle';
  readonly refs: readonly Ref[];
  readonly via: 'direct' | 'field';
}

/** Two elements trading places along an arc. */
export interface SwapEvent {
  readonly motion: 'swap';
  readonly a: Ref;
  readonly b: Ref;
}

/**
 * A value or an activation propagating.
 *
 * Three jobs, one motion: copying an element during a resize (`carries` is the
 * value), advancing a pointer (`carries` is null), and a frontier spreading.
 * `along` names the link the flow travels down, when there is one — which is
 * what makes a pointer advance follow the drawn edge rather than cut across it.
 */
export interface FlowEvent {
  readonly motion: 'flow';
  readonly from: Ref;
  readonly to: Ref;
  readonly carries: Value | null;
  readonly along: Ref | null;
}

export type TraceEvent = SettleEvent | SwapEvent | FlowEvent;

// ===========================================================================
// Frames and traces
// ===========================================================================

export interface Frame {
  /** Index within the trace, 0-based. Redundant with position; kept for reading. */
  readonly at: number;
  /** One line: what this step DOES. `copy element 2 into the new buffer`. */
  readonly caption: string;
  /**
   * One line: what stays TRUE. `everything outside left..right is decided`.
   * Null where a step asserts nothing. This is the line the curriculum's text
   * cannot show, and it is why the highlight primitive exists.
   */
  readonly invariant: string | null;
  /** The whole structure at this step. */
  readonly snapshot: Snapshot;
  /** The motions that carry the previous frame into this one. */
  readonly events: readonly TraceEvent[];
}

export interface Trace {
  readonly title: string;
  readonly frames: readonly Frame[];
  /**
   * The input this trace was generated from. The seam for "type your own
   * input": run the same `algorithm.ts` on different numbers and you get a
   * different trace, and nothing else in the system changes.
   */
  readonly input: readonly Value[];
  /**
   * Which variant produced this run — for DSA-1, `doubling` or the measured
   * CPython over-allocation. Display and provenance only; the engine never
   * branches on it.
   */
  readonly variant: string;
  /**
   * Provenance. Where the numbers in this trace came from — the Python version
   * a measured growth sequence was read off, for instance. Display only.
   */
  readonly notes: readonly string[];
}

/**
 * The seam for "type your own input", and later for live code-editing.
 *
 * A structure exports one of these from its `algorithm.ts`. The UI calls it
 * with the user's numbers and hands the result to `TracePlayer.load`. Neither
 * the input box nor the live editor is built now — this is the shape they will
 * plug into, and it is deliberately just a function.
 */
export type TraceGenerator = (input: readonly Value[], variant: string) => Trace;

// ===========================================================================
// Recording — how an instrumented algorithm emits a trace
// ===========================================================================

/**
 * Collects frames as a real implementation runs.
 *
 * Usage, from inside an `algorithm.ts`:
 *
 *   const rec = new TraceRecorder('append 9 · doubling', input, 'doubling');
 *   rec.note('growth: capacity doubles on overflow');
 *   ...
 *   rec.emit('buffer is full — allocate a larger one', null, snap(), [
 *     { motion: 'settle', via: 'field', refs: newSlots.map(cellRef) },
 *   ]);
 *   return rec.done();
 *
 * The recorder adds nothing and infers nothing. It stamps `at` and freezes the
 * result. Everything a frame says, the algorithm said.
 */
export class TraceRecorder {
  private readonly frames: Frame[] = [];
  private readonly notes: string[] = [];

  constructor(
    private readonly title: string,
    private readonly input: readonly Value[],
    private readonly variant: string,
  ) {}

  /** Record provenance for this run. Display only; never affects rendering. */
  note(text: string): void {
    this.notes.push(text);
  }

  emit(
    caption: string,
    invariant: string | null,
    snapshot: Snapshot,
    events: readonly TraceEvent[] = [],
  ): void {
    this.frames.push({
      at: this.frames.length,
      caption,
      invariant,
      snapshot,
      events,
    });
  }

  done(): Trace {
    return {
      title: this.title,
      frames: this.frames.slice(),
      input: this.input.slice(),
      variant: this.variant,
      notes: this.notes.slice(),
    };
  }
}

// ===========================================================================
// Validation — the format's half of "verifiable against the real algorithm"
// ===========================================================================

export interface TraceProblem {
  readonly frame: number;
  readonly message: string;
}

/**
 * Structural checks that catch a trace disagreeing with itself.
 *
 * This is not a correctness proof of the algorithm — nothing here knows what a
 * dynamic array is. It catches the class of mistake that would otherwise render
 * as a plausible-looking-but-wrong animation: a bank whose `size` does not match
 * its filled cells, a cell in a bank that does not exist, a link to a missing
 * node, a mark on something that was removed, an event referring to nothing, or
 * two things sharing an id.
 *
 * Run it in a test. A trace that fails this is not worth watching.
 */
export function validate(trace: Trace): readonly TraceProblem[] {
  const problems: TraceProblem[] = [];
  const push = (frame: number, message: string): void => {
    problems.push({ frame, message });
  };

  /**
   * The ids a snapshot contains, kept so the PREVIOUS frame's ids stay in reach.
   * That is what closes the `flow.from` asymmetry — see below.
   */
  interface Ids {
    readonly banks: ReadonlySet<string>;
    readonly cells: ReadonlySet<string>;
    readonly nodes: ReadonlySet<string>;
    readonly links: ReadonlySet<string>;
  }

  const has = (ids: Ids | null, r: Ref): boolean => {
    if (ids === null) return false;
    switch (r.on) {
      case 'bank':
        return ids.banks.has(r.id);
      case 'cell':
        return ids.cells.has(r.id);
      case 'node':
        return ids.nodes.has(r.id);
      case 'link':
        return ids.links.has(r.id);
    }
  };

  let previousIds: Ids | null = null;

  trace.frames.forEach((frame, i) => {
    if (frame.at !== i) push(i, `frame.at is ${frame.at} but its position is ${i}`);

    const s = frame.snapshot;
    const bankIds = new Set<string>();
    for (const b of s.banks) {
      if (bankIds.has(b.id)) push(i, `duplicate bank id "${b.id}"`);
      bankIds.add(b.id);
      if (b.capacity < 0) push(i, `bank "${b.id}" has negative capacity ${b.capacity}`);
      if (b.size < 0 || b.size > b.capacity) {
        push(i, `bank "${b.id}" size ${b.size} is outside 0..${b.capacity}`);
      }
    }

    const cellIds = new Set<string>();
    const filled = new Map<string, number>();
    const slots = new Map<string, Set<number>>();
    for (const c of s.cells) {
      if (cellIds.has(c.id)) push(i, `duplicate cell id "${c.id}"`);
      cellIds.add(c.id);
      if (!bankIds.has(c.bank)) push(i, `cell "${c.id}" is in unknown bank "${c.bank}"`);
      const seen = slots.get(c.bank) ?? new Set<number>();
      if (seen.has(c.index)) push(i, `bank "${c.bank}" has two cells at index ${c.index}`);
      seen.add(c.index);
      slots.set(c.bank, seen);
      if (c.value !== null && c.status === 'live') {
        filled.set(c.bank, (filled.get(c.bank) ?? 0) + 1);
      }
      if (c.value === null && c.status === 'live') {
        push(i, `cell "${c.id}" is live but holds no value (use status "empty")`);
      }
    }
    for (const b of s.banks) {
      if (b.status !== 'live') continue;
      const n = filled.get(b.id) ?? 0;
      if (n !== b.size) {
        push(i, `bank "${b.id}" reports size ${b.size} but ${n} of its cells hold a value`);
      }
      const seen = slots.get(b.id);
      if (seen !== undefined) {
        for (const idx of seen) {
          if (idx < 0 || idx >= b.capacity) {
            push(i, `bank "${b.id}" has a cell at index ${idx}, outside 0..${b.capacity - 1}`);
          }
        }
      }
    }

    const nodeIds = new Set<string>();
    for (const n of s.nodes) {
      if (nodeIds.has(n.id)) push(i, `duplicate node id "${n.id}"`);
      nodeIds.add(n.id);
    }

    const linkIds = new Set<string>();
    for (const l of s.links) {
      if (linkIds.has(l.id)) push(i, `duplicate link id "${l.id}"`);
      linkIds.add(l.id);
      if (!nodeIds.has(l.from)) push(i, `link "${l.id}" starts at unknown node "${l.from}"`);
      if (l.to !== null && !nodeIds.has(l.to)) {
        push(i, `link "${l.id}" ends at unknown node "${l.to}"`);
      }
    }

    const resolve = (r: Ref): boolean => {
      switch (r.on) {
        case 'bank':
          return bankIds.has(r.id);
        case 'cell':
          return cellIds.has(r.id);
        case 'node':
          return nodeIds.has(r.id);
        case 'link':
          return linkIds.has(r.id);
      }
    };

    const markIds = new Set<string>();
    for (const m of s.marks) {
      if (markIds.has(m.id)) push(i, `duplicate mark id "${m.id}"`);
      markIds.add(m.id);
      if (m.target.on === 'span') {
        if (!bankIds.has(m.target.bank)) {
          push(i, `mark "${m.id}" spans unknown bank "${m.target.bank}"`);
        } else if (m.target.from > m.target.to) {
          push(i, `mark "${m.id}" spans ${m.target.from}..${m.target.to}, which is empty`);
        }
      } else if (!resolve(m.target)) {
        push(i, `mark "${m.id}" points at a missing ${m.target.on} "${m.target.id}"`);
      }
    }

    if (s.entry !== null && !resolve(s.entry)) {
      push(i, `entry points at a missing ${s.entry.on} "${s.entry.id}"`);
    }

    for (const e of frame.events) {
      switch (e.motion) {
        case 'settle':
          if (e.refs.length === 0) push(i, 'settle event has no refs');
          for (const r of e.refs) {
            if (!resolve(r)) push(i, `settle refers to a missing ${r.on} "${r.id}"`);
          }
          break;
        case 'swap':
          if (!resolve(e.a)) push(i, `swap refers to a missing ${e.a.on} "${e.a.id}"`);
          if (!resolve(e.b)) push(i, `swap refers to a missing ${e.b.on} "${e.b.id}"`);
          break;
        case 'flow':
          if (!resolve(e.to)) push(i, `flow refers to a missing ${e.to.on} "${e.to.id}"`);
          if (e.along !== null && !resolve(e.along)) {
            push(i, `flow travels along a missing ${e.along.on} "${e.along.id}"`);
          }
          // `from` is checked against THIS frame or the PREVIOUS one, and that
          // asymmetry with `to` is the point rather than an oversight.
          //
          // An event describes the transition INTO the current frame, so its
          // two ends live in different frames: `to` is where the flow arrives
          // and must exist now, but `from` is where it departed and may
          // legitimately be gone — a buffer released in the same step, a node
          // unlinked by the move itself. Checking `from` against the current
          // snapshot alone would reject correct traces; not checking it at all
          // would let a typo'd source through and the view would silently draw
          // the flow from nowhere. The union of the two frames is the smallest
          // set that admits every honest source and no invented one.
          if (!resolve(e.from) && !has(previousIds, e.from)) {
            push(
              i,
              `flow starts at a ${e.from.on} "${e.from.id}" that is in neither this frame nor the previous one`,
            );
          }
          break;
      }
    }

    previousIds = { banks: bankIds, cells: cellIds, nodes: nodeIds, links: linkIds };
  });

  return problems;
}

// ===========================================================================
// The player — what step / play / reset actually do
// ===========================================================================

/** How long the transition into a frame should take, from its events. */
export function durationOf(frame: Frame): number {
  if (frame.events.length === 0) return TIMING.stepQuiet;
  // Annotated: TIMING is `as const`, so an unannotated `let` would inherit the
  // literal type of the token rather than `number`.
  let longest: number = TIMING.stepQuiet;
  for (const e of frame.events) {
    let d: number;
    switch (e.motion) {
      case 'settle':
        d = e.via === 'field' ? TIMING.stepField : TIMING.stepSettle;
        break;
      case 'swap':
        d = TIMING.stepSwap;
        break;
      case 'flow':
        d = TIMING.stepFlow;
        break;
    }
    if (d > longest) longest = d;
  }
  return longest;
}

/**
 * Walks a trace. This is the whole of play/pause/step/reset.
 *
 * `index` is the frame being shown. `phase` runs 0 → 1 across the transition
 * INTO it, and a view interpolates from `previous` to `current` using it. When
 * `phase` is 1 the frame is simply being held.
 *
 * Stepping backward replays the transition into the earlier frame rather than
 * running the later one in reverse. That is a deliberate simplification and the
 * reason full snapshots are worth their memory: going back is the same code
 * path as going forward, so the two can never disagree.
 */
export class TracePlayer {
  private data: Trace;
  private cursor = 0;
  private elapsed = 0;
  private span: number;
  private hold = 0;
  private running = false;
  private heading: 1 | -1 = 1;

  constructor(trace: Trace) {
    this.data = trace;
    this.span = trace.frames.length > 0 ? durationOf(trace.frames[0]) : TIMING.stepQuiet;
    this.elapsed = this.span;
  }

  get trace(): Trace {
    return this.data;
  }

  get length(): number {
    return this.data.frames.length;
  }

  get index(): number {
    return this.cursor;
  }

  /** The frame being shown. */
  get current(): Frame | null {
    return this.data.frames[this.cursor] ?? null;
  }

  /** The frame being moved away from, for interpolation. */
  get previous(): Frame | null {
    if (this.cursor === 0) return null;
    return this.data.frames[this.cursor - 1] ?? null;
  }

  /** 0 → 1 across the transition into `current`. */
  get phase(): number {
    return this.span <= 0 ? 1 : clamp01(this.elapsed / this.span);
  }

  get playing(): boolean {
    return this.running;
  }

  /** 1 when moving forward through the trace, -1 when stepping back. */
  get direction(): 1 | -1 {
    return this.heading;
  }

  get atStart(): boolean {
    return this.cursor === 0;
  }

  get atEnd(): boolean {
    return this.cursor >= this.data.frames.length - 1;
  }

  play(): void {
    if (this.atEnd && this.phase >= 1) this.seek(0);
    this.running = true;
  }

  pause(): void {
    this.running = false;
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.play();
  }

  reset(): void {
    this.running = false;
    this.seek(0);
  }

  /** Advance one frame, animating the transition. Pauses playback. */
  stepForward(): void {
    this.running = false;
    if (this.atEnd) {
      this.elapsed = this.span;
      return;
    }
    this.heading = 1;
    this.enter(this.cursor + 1, TIMING.stepScrubScale);
  }

  /** Go back one frame, animating the transition into it. Pauses playback. */
  stepBack(): void {
    this.running = false;
    if (this.atStart) {
      this.elapsed = this.span;
      return;
    }
    this.heading = -1;
    this.enter(this.cursor - 1, TIMING.stepScrubScale);
  }

  /** Jump to a frame with no animation. */
  seek(index: number): void {
    const n = this.data.frames.length;
    if (n === 0) return;
    const i = index < 0 ? 0 : index >= n ? n - 1 : index;
    this.heading = i >= this.cursor ? 1 : -1;
    this.cursor = i;
    this.span = durationOf(this.data.frames[i]);
    this.elapsed = this.span;
    this.hold = 0;
  }

  /**
   * Swap in a different trace and start over.
   *
   * This is the "type your own input" seam and, later, the live-editing seam:
   * regenerate the trace from the algorithm and hand it here. Nothing else in
   * the engine holds trace-derived state, so nothing else needs telling.
   */
  load(trace: Trace): void {
    this.data = trace;
    this.running = false;
    this.cursor = 0;
    this.heading = 1;
    this.span = trace.frames.length > 0 ? durationOf(trace.frames[0]) : TIMING.stepQuiet;
    this.elapsed = this.span;
    this.hold = 0;
  }

  /** Advance the clock. Call once per rendered frame. */
  update(dt: number): void {
    const step = Math.min(dt, TIMING.maxDelta);

    if (this.elapsed < this.span) {
      this.elapsed = Math.min(this.span, this.elapsed + step);
      return;
    }

    if (!this.running) return;

    if (this.hold < TIMING.holdBetweenFrames) {
      this.hold += step;
      return;
    }

    if (this.atEnd) {
      this.running = false;
      return;
    }
    this.heading = 1;
    this.enter(this.cursor + 1, 1);
  }

  private enter(index: number, scale: number): void {
    this.cursor = index;
    this.span = durationOf(this.data.frames[index]) * scale;
    this.elapsed = 0;
    this.hold = 0;
  }
}

// ===========================================================================
// Reading helpers — small, and used by every structure's view
// ===========================================================================

export function cellRef(id: string): Ref {
  return { on: 'cell', id };
}

export function nodeRef(id: string): Ref {
  return { on: 'node', id };
}

export function linkRef(id: string): Ref {
  return { on: 'link', id };
}

export function bankRef(id: string): Ref {
  return { on: 'bank', id };
}

/** An empty structure. A starting point for a snapshot builder. */
export const EMPTY_SNAPSHOT: Snapshot = {
  banks: [],
  cells: [],
  nodes: [],
  links: [],
  marks: [],
  entry: null,
};

/** The cells of one bank, in index order. */
export function bankCells(snapshot: Snapshot, bank: string): readonly CellState[] {
  return snapshot.cells.filter((c) => c.bank === bank).sort((a, b) => a.index - b.index);
}

/**
 * Walk a linked structure from `entry`, following outgoing links, stopping when
 * a node repeats.
 *
 * The stopping condition is the point: a cyclic list has no end, so a view that
 * walked until null would hang on exactly the structure the fast-slow pointer
 * exists to detect. The returned `cyclic` flag is what a view uses to bend the
 * list into a loop.
 */
export function walk(snapshot: Snapshot, limit = 512): { order: string[]; cyclic: boolean } {
  const order: string[] = [];
  const entry = snapshot.entry;
  if (entry === null || entry.on !== 'node') return { order, cyclic: false };

  const next = new Map<string, string | null>();
  for (const l of snapshot.links) {
    if (l.status === 'stale') continue;
    if (!next.has(l.from)) next.set(l.from, l.to);
  }

  const seen = new Set<string>();
  let at: string | null = entry.id;
  while (at !== null && order.length < limit) {
    if (seen.has(at)) return { order, cyclic: true };
    seen.add(at);
    order.push(at);
    at = next.get(at) ?? null;
  }
  return { order, cyclic: false };
}
