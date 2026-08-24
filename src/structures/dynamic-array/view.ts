/**
 * DSA-1, dynamic array — the VIEW. Layout, and nothing else that matters.
 *
 * The trace says WHAT is true; this file decides WHERE it goes on the paper and
 * hands the result to the five primitives. It draws `cell` and `highlight`, and
 * during a resize it draws `particleField`. It never invents a shape: if
 * something cannot be said with a cell, a highlight or the field, it does not
 * get said here.
 *
 * ---------------------------------------------------------------------------
 * THE REGISTER — `eggs-as-figure.png`
 * ---------------------------------------------------------------------------
 * A row of cells is a clutch of eggs, not a spreadsheet. Every slot is drawn
 * individually — its own wandering edge, its own freckles, its own colour out of
 * the shared family — and it is their ARRANGEMENT that reads as "an array". So
 * the layout's whole job is restraint: one row, centred, in a lot of air, with
 * the pitch held constant across the entire trace so the figure never twitches
 * between frames. The reference's eggs vary in size by 2x; a row of array slots
 * cannot, and the tokens already hold that variation on a much tighter rein.
 *
 * The composition targets are measured and they are Level 2: the ship's subject
 * is 31% of its frame, centred at (57%, 51%); ten percent ink, ninety percent air.
 */

import { COMPOSITION, EASING, LINE, SEED, SHAPE, TYPE, clamp01 } from '../../tokens/tokens';
import { Noise } from '../../engine/noise';
import {
  Swarm,
  fieldPhase,
  flow,
  sampleHomes,
  settle,
  speckCountFor,
  type Cloud,
} from '../../engine/motions';
import { cell, highlight, particleField } from '../../engine/primitives';
import {
  handLine,
  handOutline,
  seedOf,
  type Path,
  type Pt,
  type Surface,
  type Viewport,
} from '../../engine/renderer';
import type { CellState, Frame, MarkState, Snapshot, Trace } from '../../engine/trace';

/**
 * What the shell hands a view on every rendered frame.
 *
 * Declared here rather than imported from `src/ui/` so that a structure never
 * depends on the shell; the shell's catalogue names the same shape and
 * TypeScript's structural typing joins them up.
 */
export interface RenderContext {
  readonly current: Frame;
  readonly previous: Frame | null;
  /** 0 -> 1 across the transition into `current`. */
  readonly phase: number;
  readonly clock: number;
  readonly dt: number;
}

interface Geometry {
  /** Centre-to-centre distance between slots. Constant for a whole trace. */
  readonly pitch: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly centreX: number;
  readonly centreY: number;
  readonly rowGap: number;
}

interface Rows {
  /** Bank id -> the y of its row and the x of the centre of its slot 0. */
  readonly rows: ReadonlyMap<string, { readonly y: number; readonly x0: number }>;
  /** Cell id -> where it is. */
  readonly cells: ReadonlyMap<string, Pt>;
  /**
   * `bank:index` -> where that SLOT is, whatever is in it.
   *
   * Cells are identified by what they hold, so when an element is copied out of
   * a slot the cell drawn there changes identity. This index is how the view
   * recognises that as one slot changing rather than two objects swapping in and
   * out of existence.
   */
  readonly slots: ReadonlyMap<string, Pt>;
}

const slotKey = (bank: string, index: number): string => `${bank}:${index}`;

/** The view's own hand, for the paths a value travels down. */
const HAND = new Noise(SEED ^ 0x2c1b);

export function createArrayView(): ArrayView {
  return new ArrayView();
}

export class ArrayView {
  /** The widest buffer this trace ever holds. Fixes the pitch for the run. */
  private widest = 4;
  /** Index labels become a ruler once a row is too long to number every slot. */
  private everyIndex = true;
  private swarm: Swarm | null = null;
  private swarmFrame = -1;
  private swarmCloud: Cloud = { cx: 0, cy: 0, rx: 1, ry: 1 };

  /** Per-trace constants. Called once when a trace is loaded. */
  prepare(trace: Trace): void {
    let widest = 4;
    for (const f of trace.frames) {
      for (const b of f.snapshot.banks) widest = Math.max(widest, b.capacity);
    }
    this.widest = widest;
    this.everyIndex = widest <= 16;
    this.swarm = null;
    this.swarmFrame = -1;
  }

  render(surface: Surface, ctx: RenderContext): void {
    const geom = this.geometry(surface.view);
    const cur = place(ctx.current.snapshot, geom);
    const previous = ctx.previous;
    const prev = previous === null ? null : place(previous.snapshot, geom);
    const phase = clamp01(ctx.phase);

    // The emergence beat, if this frame is one. `fieldPhase` splits it into
    // scatter and gather; the discrete cells fade out under the swarm and fade
    // back in as it arrives, so the exchange reads as the same matter moving
    // rather than as a crossfade between two pictures.
    const beat = fieldSettle(ctx.current);
    const fp = beat === null ? null : fieldPhase(phase);
    const form = fp === null ? 1 : fp.formPresence;

    // --- the cells --------------------------------------------------------
    for (const c of ctx.current.snapshot.cells) {
      const here = cur.cells.get(c.id);
      if (here === undefined) continue;
      const there = prev === null ? undefined : prev.cells.get(c.id);
      const arriving = there === undefined;
      // An arriving cell drops in from above — but only if its SLOT is new. A
      // slot whose element has just been copied out is not a new object falling
      // out of the sky; it is the same slot, now empty, and it should simply
      // become empty where it stands.
      const inherited = arriving && prev !== null ? prev.slots.get(slotKey(c.bank, c.index)) : undefined;
      const from: Pt =
        !arriving ? there : (inherited ?? { x: here.x, y: here.y - geom.cellH * 1.7 });
      const at = motionOf(ctx.current, c.id, from, here, phase);
      this.drawCell(surface, c, at, geom, (arriving ? EASING.reveal(phase) : 1) * form);
    }

    // --- cells that were here a moment ago and are not now -----------------
    if (previous !== null && prev !== null) {
      const present = new Set(ctx.current.snapshot.cells.map((c) => c.id));
      for (const c of previous.snapshot.cells) {
        if (present.has(c.id)) continue;
        const there = prev.cells.get(c.id);
        if (there === undefined) continue;
        this.drawCell(surface, c, there, geom, (1 - EASING.reveal(phase)) * form);
      }
    }

    // --- the swarm, over the fading form ----------------------------------
    if (beat !== null && fp !== null) {
      this.runField(surface, ctx, cur, prev, geom, beat, fp);
    }

    // --- bank labels -------------------------------------------------------
    for (const b of ctx.current.snapshot.banks) {
      const row = cur.rows.get(b.id);
      if (row === undefined || b.capacity === 0) continue;
      surface.label(
        b.label,
        {
          x: row.x0 + ((b.capacity - 1) * geom.pitch) * 0.5,
          // Well clear of a pointer's own label, which sits just above the row.
          y: row.y - geom.cellH * 1.75,
        },
        {
          color: LINE.ink,
          size: TYPE.index,
          alpha: 0.42 * (b.status === 'stale' ? 0.55 : 1) * form,
          align: 'center',
          baseline: 'middle',
        },
      );
    }

    // --- marks -------------------------------------------------------------
    for (const m of ctx.current.snapshot.marks) {
      const before = previous?.snapshot.marks.find((p) => p.id === m.id) ?? null;
      this.drawMark(
        surface,
        ctx.current,
        m,
        before,
        cur,
        prev,
        geom,
        (before === null ? EASING.reveal(phase) : 1) * form,
        phase,
      );
    }
    if (previous !== null && prev !== null) {
      const present = new Set(ctx.current.snapshot.marks.map((m) => m.id));
      for (const m of previous.snapshot.marks) {
        if (present.has(m.id)) continue;
        this.drawMark(
          surface,
          previous,
          m,
          null,
          prev,
          null,
          geom,
          (1 - EASING.reveal(phase)) * form,
          phase,
        );
      }
    }
  }

  // =========================================================================
  // Layout
  // =========================================================================

  private geometry(view: Viewport): Geometry {
    const margin = Math.min(view.width, view.height) * COMPOSITION.margin;
    const usable = Math.max(120, view.width - margin * 2);
    // The pitch is set by the WIDEST buffer in the whole trace, so the row never
    // resizes under the reader — only its length changes.
    //
    // The 0.86 keeps the longest row off the margins even at its widest: a row
    // that runs edge to edge has stopped being a figure in a field and become a
    // band across the paper, and Level 2 outranks fitting one more slot in. The
    // 52px ceiling does the same job from the other end — a short array is drawn
    // at a comfortable size and left small in the frame, near the measured 31%.
    const pitch = Math.max(9, Math.min(52, (usable * 0.86) / this.widest));
    const cellW = pitch * 0.8;
    // A slot stays near-square whatever the capacity. Pinning the height to an
    // absolute size instead would turn a long buffer into a row of tall thin
    // portrait tiles, which is a chart's shape, not a clutch of eggs.
    const cellH = Math.min(cellW * 1.05, view.height * 0.085);
    return {
      pitch,
      cellW,
      cellH,
      centreX: view.width * COMPOSITION.centreX,
      centreY: view.height * COMPOSITION.centreY,
      rowGap: cellH * 1.7,
    };
  }

  private drawCell(
    surface: Surface,
    state: CellState,
    at: Pt,
    geom: Geometry,
    presence: number,
  ): void {
    if (presence <= 0.002) return;
    cell(surface, {
      id: state.id,
      centre: at,
      width: geom.cellW,
      height: geom.cellH,
      status: state.status,
      value: state.value === null ? null : String(state.value),
      index: this.everyIndex || state.index % 4 === 0 ? String(state.index) : null,
      presence: clamp01(presence),
    });
  }

  private drawMark(
    surface: Surface,
    frame: Frame,
    mark: MarkState,
    before: MarkState | null,
    here: Rows,
    there: Rows | null,
    geom: Geometry,
    strength: number,
    phase: number,
  ): void {
    if (strength <= 0.002) return;
    const target = mark.target;

    // A region-level claim is drawn as a region. "Everything outside the two
    // pointers is decided" is a span, not a ring, and faking it with a mark on
    // every cell would turn the frame into a dashboard.
    if (target.on === 'span') {
      const row = here.rows.get(target.bank);
      if (row === undefined) return;
      highlight(surface, {
        id: mark.id,
        shape: {
          kind: 'span',
          x0: row.x0 + target.from * geom.pitch - geom.cellW * 0.62,
          y0: row.y - geom.cellH * 0.74,
          x1: row.x0 + target.to * geom.pitch + geom.cellW * 0.62,
          y1: row.y + geom.cellH * 0.74,
        },
        tone: mark.tone,
        label: mark.label,
        strength,
      });
      return;
    }

    if (target.on === 'bank') {
      const row = here.rows.get(target.id);
      const bank = frame.snapshot.banks.find((b) => b.id === target.id);
      if (row === undefined || bank === undefined || bank.capacity === 0) return;
      highlight(surface, {
        id: mark.id,
        shape: {
          kind: 'span',
          x0: row.x0 - geom.cellW * 0.62,
          y0: row.y - geom.cellH * 0.74,
          x1: row.x0 + (bank.capacity - 1) * geom.pitch + geom.cellW * 0.62,
          y1: row.y + geom.cellH * 0.74,
        },
        tone: mark.tone,
        label: mark.label,
        strength,
      });
      return;
    }

    if (target.on !== 'cell') return;
    const to = here.cells.get(target.id);
    if (to === undefined) return;

    // A mark that moved travels; if the trace called the move a flow, it travels
    // along a drawn path rather than sliding across the gap.
    let at = to;
    const was = before === null ? null : before.target;
    if (was !== null && was.on === 'cell' && there !== null) {
      const from = there.cells.get(was.id);
      if (from !== undefined) at = motionOf(frame, target.id, from, to, phase, was.id);
    }

    highlight(surface, {
      id: mark.id,
      // Wider than the slot: a ring that hugs a cell's own outline competes
      // with it, and the mark has to read as something laid OVER the figure.
      shape: { kind: 'ring', centre: at, rx: geom.cellW * 0.62, ry: geom.cellH * 0.62 },
      tone: mark.tone,
      label: mark.label,
      strength,
    });
  }

  // =========================================================================
  // The emergence beat
  // =========================================================================

  /**
   * Build (or reuse) this beat's swarm, integrate it, and draw it.
   *
   * The specks are born in a cloud sitting over the arrangement being dissolved,
   * and their homes are sampled from the arrangement being formed — as a
   * DENSITY, never as a stencil. Where the density is high they pile up and read
   * as solid; the edge feathers on its own. That is how a mass of dots becomes a
   * figure instead of sitting on one, and it is the single thing the approved
   * study was built to prove.
   */
  private runField(
    surface: Surface,
    ctx: RenderContext,
    cur: Rows,
    prev: Rows | null,
    geom: Geometry,
    refs: readonly string[],
    fp: ReturnType<typeof fieldPhase>,
  ): void {
    let swarm = this.swarm;

    if (swarm === null || this.swarmFrame !== ctx.current.at) {
      const shapes: Path[] = [];
      for (const id of refs) {
        const at = cur.cells.get(id);
        if (at === undefined) continue;
        shapes.push(
          handOutline(HAND, seedOf(id, 0x3d), at, geom.cellW * 0.5, geom.cellH * 0.5, SHAPE.cellExponent),
        );
      }
      if (shapes.length === 0) return;

      const count = speckCountFor(surface.view.width, surface.view.height);
      const cloud = cloudOver(prev ?? cur, geom);
      swarm = new Swarm(count, sampleHomes(shapes, count, SEED ^ ctx.current.at), cloud, SEED ^ ctx.current.at);
      this.swarm = swarm;
      this.swarmFrame = ctx.current.at;
      this.swarmCloud = cloud;
    }

    swarm.update(ctx.dt, ctx.clock, fp.pull, fp.release, this.swarmCloud);
    if (fp.fieldPresence > 0.002) {
      particleField(surface, { batch: swarm.batch(), presence: fp.fieldPresence });
    }
  }
}

// ===========================================================================
// Free functions
// ===========================================================================

/** The cell ids of this frame's field settle, or null if this frame is not the beat. */
function fieldSettle(frame: Frame): readonly string[] | null {
  for (const e of frame.events) {
    if (e.motion === 'settle' && e.via === 'field') {
      return e.refs.filter((r) => r.on === 'cell').map((r) => r.id);
    }
  }
  return null;
}

/**
 * Where every cell of a snapshot sits.
 *
 * One row per bank, each centred on the composition's centre line, so during a
 * resize the two buffers read as one figure in two parts rather than as two
 * diagrams. A single bank sits on the centre line itself.
 */
function place(snapshot: Snapshot, geom: Geometry): Rows {
  const rows = new Map<string, { y: number; x0: number }>();
  const drawn = snapshot.banks.filter((b) => b.capacity > 0);

  drawn.forEach((b, i) => {
    const span = (b.capacity - 1) * geom.pitch;
    const y =
      drawn.length <= 1 ? geom.centreY : geom.centreY + (i === 0 ? -geom.rowGap : geom.rowGap);
    rows.set(b.id, { y, x0: geom.centreX - span * 0.5 });
  });

  const cells = new Map<string, Pt>();
  const slots = new Map<string, Pt>();
  for (const c of snapshot.cells) {
    const row = rows.get(c.bank);
    if (row === undefined) continue;
    const at = { x: row.x0 + c.index * geom.pitch, y: row.y };
    cells.set(c.id, at);
    slots.set(slotKey(c.bank, c.index), at);
  }
  return { rows, cells, slots };
}

/**
 * How a thing gets from `from` to `to` this frame.
 *
 * A flow named in the trace travels along a drawn path — the hand line is the
 * road, so the value wobbles down it instead of sliding along a rail. Anything
 * else settles: down into place, with the overshoot and the lateral wander the
 * tokens describe. There is no third case here, because there are only three
 * motions and an array's cells never swap.
 */
function motionOf(
  frame: Frame,
  id: string,
  from: Pt,
  to: Pt,
  phase: number,
  fromId?: string,
): Pt {
  if (Math.hypot(to.x - from.x, to.y - from.y) < 0.5) return to;

  for (const e of frame.events) {
    if (e.motion !== 'flow') continue;
    if (e.to.on !== 'cell' || e.to.id !== id) continue;
    if (fromId !== undefined && !(e.from.on === 'cell' && e.from.id === fromId)) continue;
    return flow(handLine(HAND, seedOf(id, 0x71), from, to), phase).at;
  }

  return settle(from, to, phase, seedOf(id, 0x5f), HAND);
}

/** The cloud a beat's specks are born into: an ellipse over the figure being lost. */
function cloudOver(rows: Rows, geom: Geometry): Cloud {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of rows.cells.values()) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  if (!Number.isFinite(x0)) {
    return { cx: geom.centreX, cy: geom.centreY, rx: geom.pitch * 4, ry: geom.cellH * 2 };
  }
  return {
    cx: (x0 + x1) * 0.5,
    cy: (y0 + y1) * 0.5,
    rx: Math.max((x1 - x0) * 0.62, geom.pitch * 2),
    ry: Math.max((y1 - y0) * 0.85, geom.cellH * 1.7),
  };
}
