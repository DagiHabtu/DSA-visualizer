/**
 * DSA-1, linked list — the VIEW.
 *
 * This is the structure the Section 3 guardrail was written about: a linked list
 * is about the POINTERS BETWEEN NODES, so it is drawn with `node` and `link`,
 * and it is never dissolved into a particle cloud. Emergence is a signature, not
 * a law, and forcing it here would misrepresent the idea. No frame of this
 * structure's trace carries a field settle, and that is deliberate.
 *
 * ---------------------------------------------------------------------------
 * THE REGISTER — `line-figure-icon.png`
 * ---------------------------------------------------------------------------
 * Every edge is one continuous confident stroke of uneven weight, drawn in a
 * single gesture, never axis-aligned and never straight. That is the `link`
 * primitive's whole brief and it comes out of that icon.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CYCLE IS DRAWN AS A RING
 * ---------------------------------------------------------------------------
 * The list runs in from the left as a straight tail and then turns into a loop,
 * because that shape is the argument: once both pointers are on the ring, the
 * fast one is going round a closed track twice as quickly as the slow one, and
 * there is nowhere for either to get off. Drawn as a straight line with one long
 * arrow curving back, the same list looks like an accident. Drawn as a ring, the
 * conclusion is visible before the caption says it.
 */

import { COMPOSITION, EASING, SEED, clamp01 } from '../../tokens/tokens';
import { Noise } from '../../engine/noise';
import { flow, settle } from '../../engine/motions';
import { highlight, link, node } from '../../engine/primitives';
import {
  handLine,
  seedOf,
  type Path,
  type Pt,
  type Surface,
  type Viewport,
} from '../../engine/renderer';
import {
  walk,
  type FlowEvent,
  type Frame,
  type MarkState,
  type Snapshot,
  type Trace,
} from '../../engine/trace';

/**
 * What the shell hands a view on every rendered frame.
 *
 * Deliberately declared here as well as in the array's view rather than shared
 * through a fourth module: a structure must not depend on the shell, and the
 * shell's catalogue names the same shape, which is all TypeScript's structural
 * typing needs. Five fields is a cheaper duplication than a new layer.
 */
export interface RenderContext {
  readonly current: Frame;
  readonly previous: Frame | null;
  /** 0 -> 1 across the transition into `current`. */
  readonly phase: number;
  readonly clock: number;
  readonly dt: number;
}

/**
 * The primitives draw their hand-lines with one shared noise field seeded from
 * SEED. Seeding an identical field here, and trimming a link's ends the same
 * way, reproduces a link's path EXACTLY — so a pointer flowing along an edge
 * follows the wobble that was actually drawn instead of a straight line near it.
 */
const LINK_HAND = new Noise(SEED);
/** The view's own hand, for anything that is not reproducing a drawn edge. */
const HAND = new Noise(SEED ^ 0x51a3);

interface Geometry {
  readonly radius: number;
  readonly pitch: number;
}

/**
 * How far a link's ends are pulled back off the two nodes, in node radii.
 *
 * Shared by the drawing and by the path a pointer flows along, because those two
 * have to be the SAME line — a pointer that travels beside its own edge is worse
 * than one that cuts straight across. Asymmetric because the arrow end needs
 * clearance for the head.
 */
const TRIM_FROM = 1.08;
const TRIM_TO = 1.24;

interface Placed {
  readonly points: ReadonlyMap<string, Pt>;
  readonly geom: Geometry;
}

export function createListView(): ListView {
  return new ListView();
}

export class ListView {
  /**
   * Nothing to precompute. The array's view fixes its pitch from the widest
   * buffer in the trace because a buffer's capacity changes mid-run; a list's
   * node count does not, so every frame can size itself and get the same answer.
   */
  prepare(_trace: Trace): void {}

  render(surface: Surface, ctx: RenderContext): void {
    const phase = clamp01(ctx.phase);
    const here = this.place(ctx.current.snapshot, surface.view);
    const previous = ctx.previous;
    const there = previous === null ? null : this.place(previous.snapshot, surface.view);
    const geom = here.geom;

    // --- links first: the pointers are the structure ------------------------
    for (const l of ctx.current.snapshot.links) {
      const from = here.points.get(l.from);
      if (from === undefined) continue;
      const to = l.to === null ? offEnd(from, geom) : here.points.get(l.to);
      if (to === undefined) continue;
      link(surface, {
        id: l.id,
        from,
        to,
        trimFrom: geom.radius * TRIM_FROM,
        trimTo: l.to === null ? 0 : geom.radius * TRIM_TO,
        end: l.to === null ? 'terminal' : 'arrow',
        status: l.status,
        presence: 1,
        reveal: 1,
      });
    }

    // --- the nodes ---------------------------------------------------------
    for (const n of ctx.current.snapshot.nodes) {
      const at = here.points.get(n.id);
      if (at === undefined) continue;
      node(surface, {
        id: n.id,
        centre: at,
        radius: geom.radius,
        status: n.status,
        value: n.value === null ? null : String(n.value),
        caption: n.caption,
        presence: 1,
      });
    }

    // --- the two pointers ---------------------------------------------------
    for (const m of ctx.current.snapshot.marks) {
      const before = previous?.snapshot.marks.find((p) => p.id === m.id) ?? null;
      this.drawMark(
        surface,
        ctx.current,
        m,
        before,
        here,
        there,
        phase,
        before === null ? EASING.reveal(phase) : 1,
      );
    }
    if (previous !== null && there !== null) {
      const present = new Set(ctx.current.snapshot.marks.map((m) => m.id));
      for (const m of previous.snapshot.marks) {
        if (present.has(m.id)) continue;
        this.drawMark(surface, previous, m, null, there, null, phase, 1 - EASING.reveal(phase));
      }
    }
  }

  // =========================================================================
  // Layout — a straight run into a ring
  // =========================================================================

  private place(snapshot: Snapshot, view: Viewport): Placed {
    const { order, cyclic } = walk(snapshot);
    const points = new Map<string, Pt>();

    const margin = Math.min(view.width, view.height) * COMPOSITION.margin;
    const usable = Math.max(160, view.width - margin * 2);
    const centreX = view.width * COMPOSITION.centreX;
    const centreY = view.height * COMPOSITION.centreY;

    if (order.length === 0) {
      return { points, geom: { radius: 18, pitch: 60 } };
    }

    // Where the ring begins: the node the last one points back at.
    const last = order[order.length - 1];
    const closing = snapshot.links.find((l) => l.from === last && l.status !== 'stale');
    const ringStart =
      cyclic && closing !== undefined && closing.to !== null ? order.indexOf(closing.to) : -1;

    const tail = ringStart < 0 ? order.length : ringStart;
    const ring = ringStart < 0 ? 0 : order.length - ringStart;

    // Total width in units of pitch: the straight run, plus the ring's diameter
    // (a ring of m nodes at pitch p has circumference m*p, so diameter m*p/pi).
    const units = Math.max(2, tail + (ring > 0 ? ring / Math.PI : 0) + 1);
    const pitch = Math.min(96, usable / units);
    // 0.30 rather than something fatter: a node has to leave enough of the gap
    // to its neighbour visible for the link between them to read as a drawn
    // stroke. Two tokens touching with a stub between them is a chain, not a
    // list of pointers.
    const radius = Math.max(9, Math.min(pitch * 0.3, view.height * 0.06));
    const geom: Geometry = { radius, pitch };

    const totalWidth = (tail - (ring > 0 ? 0 : 1)) * pitch + (ring > 0 ? (ring * pitch) / Math.PI : 0);
    const startX = centreX - totalWidth * 0.5;

    for (let i = 0; i < tail; i++) {
      points.set(order[i], { x: startX + i * pitch, y: centreY });
    }

    if (ring > 0) {
      const ringRadius = (ring * pitch) / (Math.PI * 2);
      const ringCentre: Pt = { x: startX + tail * pitch + ringRadius, y: centreY };
      for (let j = 0; j < ring; j++) {
        // The ring is entered at its leftmost point and travelled up and over,
        // so the tail meets it head-on instead of cutting across it.
        const a = Math.PI + (j / ring) * Math.PI * 2;
        points.set(order[tail + j], {
          x: ringCentre.x + Math.cos(a) * ringRadius,
          y: ringCentre.y + Math.sin(a) * ringRadius,
        });
      }
    }

    return { points, geom };
  }

  private drawMark(
    surface: Surface,
    frame: Frame,
    mark: MarkState,
    before: MarkState | null,
    here: Placed,
    there: Placed | null,
    phase: number,
    strength: number,
  ): void {
    if (strength <= 0.002) return;
    if (mark.target.on !== 'node') return;
    const to = here.points.get(mark.target.id);
    if (to === undefined) return;

    let at = to;
    if (before !== null && before.target.on === 'node' && there !== null) {
      const from = there.points.get(before.target.id);
      if (from !== undefined && Math.hypot(to.x - from.x, to.y - from.y) > 0.5) {
        const chain = chainedPath(frame, here, before.target.id, mark.target.id);
        at =
          chain === null
            ? settle(from, to, phase, seedOf(mark.id, 0x5f), HAND)
            : flow(chain, phase).at;
      }
    }

    highlight(surface, {
      id: mark.id,
      // Standing off the node rather than tracing it — see the array view.
      shape: { kind: 'ring', centre: at, rx: here.geom.radius * 1.18, ry: here.geom.radius * 1.18 },
      tone: mark.tone,
      label: mark.label,
      strength,
    });
  }
}

// ===========================================================================
// Free functions
// ===========================================================================

/** Where a `next` that points at nothing goes: a short stub off the last node. */
function offEnd(from: Pt, geom: Geometry): Pt {
  return { x: from.x + geom.pitch * 0.66, y: from.y };
}

/**
 * The path a pointer takes this frame, following the drawn edges.
 *
 * Fast moves twice per tick, and the trace says so with two flow events in one
 * frame. Chaining their paths end to end is what turns that into one gesture: it
 * goes round the corner of the ring rather than cutting the chord.
 */
function chainedPath(frame: Frame, here: Placed, fromId: string, toId: string): Path | null {
  const flows = frame.events.filter((e): e is FlowEvent => e.motion === 'flow');
  if (flows.length === 0) return null;

  const out: Pt[] = [];
  let at = fromId;
  let guard = flows.length + 1;

  while (guard-- > 0) {
    const leg = flows.find((f) => f.from.on === 'node' && f.from.id === at);
    if (leg === undefined || leg.to.on !== 'node') break;
    const a = here.points.get(at);
    const b = here.points.get(leg.to.id);
    if (a === undefined || b === undefined) break;

    const seg =
      leg.along !== null && leg.along.on === 'link'
        ? linkPath(leg.along.id, a, b, here.geom)
        : handLine(HAND, seedOf(at + leg.to.id, 0x71), a, b);
    for (let i = out.length === 0 ? 0 : 1; i < seg.length; i++) out.push(seg[i]);

    at = leg.to.id;
    if (at === toId) return out.length >= 2 ? out : null;
  }
  return null;
}

/**
 * The exact path the `link` primitive draws for this edge.
 *
 * The primitive trims the ends along the straight chord and then hands the
 * result to `handLine` with a seed derived from the link's id; doing the same
 * here with an identically seeded noise field reproduces it point for point.
 */
function linkPath(id: string, from: Pt, to: Pt, geom: Geometry): Path {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-3) return [from, to];
  const ux = dx / dist;
  const uy = dy / dist;
  const trimFrom = geom.radius * TRIM_FROM;
  const trimTo = geom.radius * TRIM_TO;
  return handLine(
    LINK_HAND,
    seedOf(id, 0x5c),
    { x: from.x + ux * trimFrom, y: from.y + uy * trimFrom },
    { x: to.x - ux * trimTo, y: to.y - uy * trimTo },
  );
}
