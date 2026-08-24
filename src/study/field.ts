/**
 * THROWAWAY (aesthetic study only) — the ordered form, defined as a DENSITY FIELD.
 *
 * The load-bearing idea, and the thing the checkpoint is really judging:
 * the form is a scalar function d(x, y), and speck homes are drawn from it by
 * rejection sampling. Nobody ever computes an outline. Where d is high the specks
 * pile up and read as solid; where d falls off they thin out and the edge feathers
 * on its own.
 *
 * That is how the starlings ARE the whale. A stencil would place specks ON a shape;
 * this places specks ACCORDING TO a shape, and the shape is only ever an inference
 * the eye makes about where the dots are thick.
 *
 * The form itself: a single row of seven soft cells. Ordered (a lattice) but not
 * mechanical — each cell's centre and size carries a per-cell wobble, its boundary
 * is modulated by noise, it is denser at the bottom than the top (sediment, per the
 * funnel), and a mass envelope makes the middle of the row heavier than its ends so
 * the seven cells read as ONE figure with a centre of gravity rather than as a grid.
 */

import type { Noise } from './noise';
import { smoothstep, clamp01 } from './palette';

export interface FormGeometry {
  /** Row centre, CSS px. */
  cx: number;
  cy: number;
  /** Total row width and single-cell metrics, CSS px. */
  rowWidth: number;
  cellWidth: number;
  cellHeight: number;
  cellCount: number;
  /** x of each cell's centre — the ink ticks hang off these. */
  cellCentres: number[];
}

export interface Form {
  geom: FormGeometry;
  /** Interleaved [x0, y0, x1, y1, ...] speck homes drawn from the density field. */
  homes: Float32Array;
}

const CELL_COUNT = 7;
/** Superellipse exponent — 2 is an ellipse, large is a hard rect. 4.4 is a squircle. */
const SQUIRCLE = 4.4;

interface CellJitter {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
}

/** Density of the form at a point, in CSS px space. Range roughly [0, 1.15]. */
function density(
  px: number,
  py: number,
  geom: FormGeometry,
  jitter: CellJitter[],
  noise: Noise,
): number {
  const left = geom.cx - geom.rowWidth / 2;
  const u = px - left;

  // --- the loose haze that binds the row into one figure -------------------
  // Sparse specks in the gaps and just outside the cells. Without this the row
  // is seven separate objects; with it, it is one object with seven dense knots.
  const eu = (px - geom.cx) / (geom.rowWidth * 0.58);
  const ev = (py - geom.cy) / (geom.cellHeight * 0.88);
  const hazeR = Math.sqrt(eu * eu + ev * ev);
  let d = 0.115 * (1 - smoothstep(0.3, 1.1, hazeR));

  const idx = Math.floor(u / geom.cellWidth);
  if (idx >= 0 && idx < geom.cellCount) {
    const j = jitter[idx];
    const localX = u - (idx + 0.5) * geom.cellWidth - j.dx;
    const localY = py - geom.cy - j.dy;

    // Normalised cell coordinates; 1.0 is the nominal boundary.
    const nu = localX / (geom.cellWidth * 0.43 * j.sx);
    const nv = localY / (geom.cellHeight * 0.45 * j.sy);

    const su = Math.abs(nu);
    const sv = Math.abs(nv);
    let dist = Math.pow(
      Math.pow(su, SQUIRCLE) + Math.pow(sv, SQUIRCLE),
      1 / SQUIRCLE,
    );

    // Hand-drawn boundary: the edge itself wanders, so no two cells feather alike.
    dist += noise.noise2(px * 0.024 + idx * 7.3, py * 0.024) * 0.1;

    // Feathered fill: solid inside 0.82, gone by 1.12. This band IS the drawn edge.
    let cell = 1 - smoothstep(0.82, 1.12, dist);

    // Sediment: heavier at the bottom of each cell, as in the funnel's base.
    cell *= 0.74 + 0.4 * smoothstep(-1, 1, nv);

    d += cell;
  }

  // --- mass envelope --------------------------------------------------------
  // Centre-weighted, so the row has a centre of gravity. This is the single
  // change that turns "a grid of seven boxes" into "one figure".
  const t = clamp01(Math.abs(px - geom.cx) / (geom.rowWidth * 0.5));
  const env = 0.58 + 0.42 * Math.cos(t * Math.PI * 0.5) ** 1.15;

  return d * env;
}

export function buildForm(
  width: number,
  height: number,
  count: number,
  noise: Noise,
  rand: () => number,
): Form {
  const rowWidth = Math.min(width * 0.54, 700);
  const cellWidth = rowWidth / CELL_COUNT;
  const cellHeight = cellWidth * 1.04;
  const cx = width * 0.5;
  const cy = height * 0.455; // a touch above centre — the figure sits and breathes

  const cellCentres: number[] = [];
  const jitter: CellJitter[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const dx = (rand() - 0.5) * cellWidth * 0.07;
    const dy = (rand() - 0.5) * cellHeight * 0.09;
    jitter.push({
      dx,
      dy,
      sx: 0.94 + rand() * 0.12,
      sy: 0.93 + rand() * 0.14,
    });
    cellCentres.push(cx - rowWidth / 2 + (i + 0.5) * cellWidth + dx);
  }

  const geom: FormGeometry = {
    cx,
    cy,
    rowWidth,
    cellWidth,
    cellHeight,
    cellCount: CELL_COUNT,
    cellCentres,
  };

  // --- rejection sampling ---------------------------------------------------
  const boxW = rowWidth * 1.30;
  const boxH = cellHeight * 2.6;
  const x0 = cx - boxW / 2;
  const y0 = cy - boxH / 2;
  const ceiling = 1.16;

  const homes = new Float32Array(count * 2);
  let placed = 0;
  let guard = count * 60;
  while (placed < count && guard-- > 0) {
    const px = x0 + rand() * boxW;
    const py = y0 + rand() * boxH;
    if (rand() * ceiling < density(px, py, geom, jitter, noise)) {
      homes[placed * 2] = px;
      homes[placed * 2 + 1] = py;
      placed++;
    }
  }
  // Degenerate fallback (absurdly small viewport): pack the remainder on the row.
  while (placed < count) {
    homes[placed * 2] = cx + (rand() - 0.5) * rowWidth;
    homes[placed * 2 + 1] = cy + (rand() - 0.5) * cellHeight;
    placed++;
  }

  return { geom, homes };
}
