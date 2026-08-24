/**
 * THE TRANSPORT — play/pause, step forward, step back, reset.
 *
 * There is very little here on purpose. The player in `src/engine/trace.ts`
 * already knows how to walk a trace; these are four buttons and four keys wired
 * to it. Stepping backward is not an undo — it replays the transition into the
 * earlier frame, because every frame carries a full snapshot — so forward and
 * back are the same code path and cannot drift apart.
 *
 * Live code-editing is deliberately absent (project rule 2). v1 is: watch, step,
 * and type your own input.
 */

export interface ControlsCallbacks {
  onToggle(): void;
  onStepBack(): void;
  onStepForward(): void;
  onReset(): void;
}

/** What the transport needs to know to draw itself. */
export interface TransportState {
  readonly playing: boolean;
  readonly index: number;
  readonly length: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

export interface ControlsHandle {
  readonly root: HTMLElement;
  sync(state: TransportState): void;
  destroy(): void;
}

export function createControls(host: HTMLElement, cb: ControlsCallbacks): ControlsHandle {
  const root = document.createElement('div');
  root.className = 'vd-controls';

  const reset = button('reset', cb.onReset);
  const back = button('‹ step', cb.onStepBack);
  const toggle = button('play', cb.onToggle);
  const forward = button('step ›', cb.onStepForward);

  const count = document.createElement('span');
  count.className = 'vd-count';

  root.append(reset, back, toggle, forward, count);
  host.append(root);

  const onKey = (e: KeyboardEvent): void => {
    // Typing in the input box is typing, not transport.
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        cb.onToggle();
        return;
      case 'ArrowRight':
        e.preventDefault();
        cb.onStepForward();
        return;
      case 'ArrowLeft':
        e.preventDefault();
        cb.onStepBack();
        return;
      case 'r':
      case 'R':
        cb.onReset();
        return;
      default:
        return;
    }
  };
  window.addEventListener('keydown', onKey);

  return {
    root,
    sync(state) {
      toggle.textContent = state.playing ? 'pause' : 'play';
      back.disabled = state.atStart;
      forward.disabled = state.atEnd;
      reset.disabled = state.atStart && !state.playing;
      count.textContent =
        state.length === 0 ? '—' : `${state.index + 1} / ${state.length}`;
    },
    destroy() {
      window.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
