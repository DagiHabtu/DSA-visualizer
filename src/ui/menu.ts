/**
 * THE STRUCTURE PICKER — which structure is on screen, which variant of it is
 * running, and the box you type your own input into.
 *
 * It is also the catalogue: the one place that knows a structure exists. Adding
 * a structure after Gate 1 means adding a row to `STRUCTURES` and nothing else,
 * which is the point of keeping the engine thin.
 *
 * This is chrome, not grammar. It is ordinary DOM sitting over the canvas — the
 * five primitives are for the algorithm, not for buttons — but every colour it
 * uses is read from the tokens file, so the panel belongs to the same paper as
 * the drawing.
 *
 * v1 supports exactly three interactions, per the project rules: watch, step,
 * and type your own input. Editing an algorithm's code and re-animating it is a
 * later phase; `TraceGenerator` is the seam it will plug into, and nothing here
 * needs to change to accommodate it.
 */

import { ACCENT, LINE, PAPER, TYPE } from '../tokens/tokens';
import { withAlpha, type Surface } from '../engine/renderer';
import type { Frame, Trace, TraceGenerator, Value } from '../engine/trace';
import {
  appendTrace,
  parseNumbers,
  twoPointerTrace,
  type ParsedInput,
} from '../structures/dynamic-array/trace';
import { createArrayView } from '../structures/dynamic-array/view';
import { cycleTrace, parseList } from '../structures/linked-list/trace';
import { createListView } from '../structures/linked-list/view';

// ===========================================================================
// The contract between the shell and a structure's view
// ===========================================================================

export interface RenderContext {
  readonly current: Frame;
  readonly previous: Frame | null;
  readonly phase: number;
  readonly clock: number;
  readonly dt: number;
}

/**
 * What a view has to be able to do. Views satisfy this structurally — nothing
 * under `src/structures/` imports from `src/ui/`, so the dependency runs one way
 * only: the shell knows about structures, structures know about the engine.
 */
export interface StructureView {
  prepare(trace: Trace): void;
  render(surface: Surface, ctx: RenderContext): void;
}

export interface Variant {
  readonly id: string;
  readonly label: string;
}

export interface StructureEntry {
  readonly id: string;
  readonly title: string;
  /** Shown under the input box. */
  readonly hint: string;
  readonly defaultInput: string;
  /**
   * Switchable variants offered as buttons. Empty when the variant is part of
   * the typed input instead (a two-pointer target, a list's loop index).
   */
  readonly variants: readonly Variant[];
  parse(text: string): ParsedInput;
  readonly generate: TraceGenerator;
  create(): StructureView;
}

// ===========================================================================
// The catalogue
// ===========================================================================

/** Long rows stop being one figure and start being a table. Level 2 outranks n. */
const MAX_VALUES = 20;
const MAX_NODES = 12;

export const STRUCTURES: readonly StructureEntry[] = [
  {
    id: 'array-growth',
    title: 'dynamic array · growth',
    hint: 'values to append',
    // Eighteen values, because the two strategies do not diverge until append
    // 17: doubling jumps 16 -> 32, the measured CPython goes 16 -> 24.
    defaultInput: '3 1 4 1 5 9 2 6 5 3 5 8 9 7 9 3 2 3',
    variants: [
      { id: 'doubling', label: 'doubling (from scratch)' },
      { id: 'cpython', label: 'CPython (measured)' },
    ],
    parse: (text) => parseNumbers(text, MAX_VALUES),
    generate: appendTrace,
    create: createArrayView,
  },
  {
    id: 'two-pointer',
    title: 'sorted array · two pointers',
    hint: 'values, then " : target"',
    defaultInput: '2 3 5 8 11 15 19 : 23',
    variants: [],
    parse: (text) => parseNumbers(text, MAX_VALUES),
    generate: twoPointerTrace,
    create: createArrayView,
  },
  {
    id: 'list-cycle',
    title: 'linked list · fast-slow',
    hint: 'values, then " : loop index" or " : none"',
    defaultInput: '1 2 3 4 5 6 7 8 : 3',
    variants: [],
    parse: (text) => parseList(text, MAX_NODES),
    generate: cycleTrace,
    create: createListView,
  },
];

// ===========================================================================
// The panel
// ===========================================================================

export interface MenuCallbacks {
  /** A structure, some input and a variant: everything needed to make a trace. */
  onRun(entry: StructureEntry, values: readonly Value[], variant: string): void;
}

export interface MenuHandle {
  readonly root: HTMLElement;
  /** The entry currently on screen. */
  entry(): StructureEntry;
  destroy(): void;
}

export function createMenu(host: HTMLElement, cb: MenuCallbacks): MenuHandle {
  const root = document.createElement('nav');
  root.className = 'vd-menu';

  let entry = STRUCTURES[0];
  let variant = entry.variants.length > 0 ? entry.variants[0].id : '';

  const picker = document.createElement('div');
  picker.className = 'vd-row';
  const variantRow = document.createElement('div');
  variantRow.className = 'vd-row vd-variants';

  const field = document.createElement('div');
  field.className = 'vd-field';
  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'your own input');
  const run = document.createElement('button');
  run.type = 'button';
  run.textContent = 'run';
  run.className = 'vd-run';
  field.append(input, run);

  const hint = document.createElement('p');
  hint.className = 'vd-hint';

  root.append(picker, variantRow, field, hint);
  host.append(root);

  const structureButtons = new Map<string, HTMLButtonElement>();
  for (const s of STRUCTURES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.title;
    b.addEventListener('click', () => {
      if (entry.id === s.id) return;
      entry = s;
      variant = s.variants.length > 0 ? s.variants[0].id : '';
      input.value = s.defaultInput;
      paint();
      submit();
    });
    structureButtons.set(s.id, b);
    picker.append(b);
  }

  const variantButtons = new Map<string, HTMLButtonElement>();

  function paint(): void {
    for (const [id, b] of structureButtons) b.classList.toggle('on', id === entry.id);

    variantRow.replaceChildren();
    variantButtons.clear();
    for (const v of entry.variants) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = v.label;
      b.classList.toggle('on', v.id === variant);
      b.addEventListener('click', () => {
        if (variant === v.id) return;
        variant = v.id;
        paint();
        submit();
      });
      variantButtons.set(v.id, b);
      variantRow.append(b);
    }
    variantRow.style.display = entry.variants.length > 0 ? '' : 'none';
    hint.textContent = entry.hint;
    hint.classList.remove('bad');
  }

  function submit(): void {
    const parsed = entry.parse(input.value);
    if (parsed.error !== null) {
      hint.textContent = parsed.error;
      hint.classList.add('bad');
      return;
    }
    hint.textContent = entry.hint;
    hint.classList.remove('bad');
    // A variant typed after the colon only applies where there are no buttons;
    // the growth strategy is a switch, not something you spell.
    const chosen = entry.variants.length > 0 ? variant : (parsed.variant ?? '');
    cb.onRun(entry, parsed.values, chosen);
  }

  run.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    // Space and the arrows are transport keys; inside the box they are text.
    e.stopPropagation();
  });

  input.value = entry.defaultInput;
  paint();

  return {
    root,
    entry: () => entry,
    destroy: () => root.remove(),
  };
}

// ===========================================================================
// Chrome styling — token colours only
// ===========================================================================

/**
 * Injected once. Every colour here comes from the tokens file; the panel is the
 * same paper, the same ink and the same accent as the drawing it sits over.
 */
export function installChromeStyle(): void {
  if (document.getElementById('vd-chrome') !== null) return;
  const style = document.createElement('style');
  style.id = 'vd-chrome';
  style.textContent = `
:root {
  --vd-ink: ${LINE.ink};
  --vd-paper: ${PAPER.base};
  --vd-haze: ${PAPER.haze};
  --vd-focus: ${ACCENT.focus};
  --vd-edge: ${PAPER.edge};
  --vd-type: ${TYPE.family};
}
body { background: var(--vd-paper); }
.vd-menu, .vd-controls {
  position: fixed;
  z-index: 2;
  font-family: var(--vd-type);
  color: var(--vd-ink);
  user-select: none;
}
.vd-menu { left: 22px; top: 20px; display: flex; flex-direction: column; gap: 7px; }
.vd-row { display: flex; gap: 7px; flex-wrap: wrap; }
.vd-menu button, .vd-controls button {
  font: 400 11px/1 var(--vd-type);
  letter-spacing: ${TYPE.tracking}em;
  color: var(--vd-ink);
  background: ${withAlpha(PAPER.haze, 0.34)};
  border: 1px solid ${withAlpha(PAPER.edge, 0.22)};
  border-radius: 11px;
  padding: 5px 11px;
  cursor: pointer;
  transition: background 220ms ease, border-color 220ms ease, opacity 220ms ease;
}
.vd-menu button:hover, .vd-controls button:hover { background: ${withAlpha(PAPER.haze, 0.62)}; }
.vd-menu button.on {
  background: ${withAlpha(ACCENT.focus, 0.34)};
  border-color: ${withAlpha(ACCENT.focus, 0.6)};
}
.vd-menu button:disabled, .vd-controls button:disabled { opacity: 0.34; cursor: default; }
.vd-field { display: flex; gap: 6px; }
.vd-field input {
  font: 400 11px/1 var(--vd-type);
  letter-spacing: ${TYPE.tracking}em;
  color: var(--vd-ink);
  background: ${withAlpha(PAPER.haze, 0.42)};
  border: 1px solid ${withAlpha(PAPER.edge, 0.22)};
  border-radius: 11px;
  padding: 5px 10px;
  width: 268px;
  outline: none;
}
.vd-field input:focus { border-color: ${withAlpha(ACCENT.focus, 0.7)}; }
.vd-hint {
  margin: 0;
  font: 400 10px/1.3 var(--vd-type);
  letter-spacing: ${TYPE.tracking}em;
  opacity: 0.5;
  max-width: 340px;
}
.vd-hint.bad { color: ${ACCENT.focus}; opacity: 0.95; }
.vd-controls {
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 9px;
}
.vd-count {
  font: 400 10px/1 var(--vd-type);
  letter-spacing: ${TYPE.tracking}em;
  opacity: 0.5;
  min-width: 74px;
  text-align: center;
}
`;
  document.head.append(style);
}
