# DSA Visualizer

A local, browser-based system for learning Data Structures & Algorithms *visually* — seeing
structures mutate step by step and watching what stays invariant.

## Run it

```
npm install
npm run dev
```

Then open the URL it prints. That is the whole thing — no deployment, no accounts, no backend.

Other scripts:

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | generates every trace both structures can produce, runs `validate()` over all of them, then a headless render pass across every frame |
| `npm run build` | typecheck + production build |

## Where the truth lives

The conversation is never the source of truth. These four are, in this order:

| File | Role |
|---|---|
| `CLAUDE.md` | the five hard constraints — thin engine, live-editing deferred, local only, curriculum sets scope, no fan-out before Gate 1 |
| `BUILD_PLAN.md` | the full plan: visual grammar, phases, gates, agent roster |
| `STATE.md` | live status — current phase, gate status, correctness target, single next action |
| the code | what actually runs |

## The grammar

Capped, deliberately, at **5 spatial primitives** (`particleField`, `cell`, `node`, `link`,
`highlight`) and **3 motions** (`settle`, `swap`, `flow`). A task that seems to need a sixth is a
signal to stop and ask, not to add one.

## Layout

```
src/
  tokens/tokens.ts      palette, grain, hand, easing, timing — the only place these live
  engine/               renderer (Canvas 2D behind one interface), primitives, motions, trace format + player
  structures/           per structure: algorithm.ts (instrumented, real) → trace.ts (recorder) → view.ts (layout)
  ui/                   controls (play/pause, step ±, reset) and menu (picker, variants, input box)
  study/                the approved throwaway aesthetic study — unreferenced, kept as the feel reference
aesthetic/              six reference images: style evidence, not assets
reference/              the curriculum — sequencing and depth authority
```

## Status

Phase 1 (Spine) is built: engine, grammar, tokens, trace format, control shell, and DSA-1
(dynamic arrays & two pointers — growth with two switchable strategies, opposite-end two-pointer
convergence, and fast-slow cycle detection on a linked list).

**Gate 1 — human sign-off on feel and DSA — is reached but not passed.** The engine API is not
frozen until it is, and no structure beyond DSA-1 gets built before then. See `STATE.md`.
