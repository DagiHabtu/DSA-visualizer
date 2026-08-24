# STATE

Live status. Updated at **every task boundary**. This file, `BUILD_PLAN.md`, `CLAUDE.md`, and the code are the source of truth — never the conversation.

**Last updated:** 2026-08-24 — Unit 3 (control shell + both DSA-1 structures) **delivered**; Gate 1 is now **reachable and awaiting the human's look**

---

## Current position

| Field | Value |
|---|---|
| **Phase** | Phase 1 — Spine |
| **Gate status** | **Gate 1 REACHED, NOT PASSED** — everything Gate 1 gates on is built and runs; it needs the human's look |
| **Frozen-API status** | **NOT FROZEN** — the engine API freezes at Gate 1 sign-off, not before |
| **Current structure** | DSA-1 — Dynamic Arrays & Two Pointers |
| **Learning depth** | Interview (curriculum's stated depth for this gate) |
| **Fan-out** | **FORBIDDEN** — one serial agent (`engine-architect`) until Gate 1 passes |

### Correctness target (DSA-1)

Three things, all driven by an executable implementation, never narrated:

1. **Reallocation on `append`** — allocate larger buffer → copy each element → release old → place new value. **Two switchable growth strategies**, so the curriculum's required written comparison can be watched side by side:
   - *Own doubling* — the `DynamicArray` the curriculum has you build from scratch.
   - *Real CPython over-allocation* — **MEASURED 2026-08-23. Done.** `src/structures/dynamic-array/growth.measured.ts` holds 16 reallocation points (target asked for ≥10) read off `sys.getsizeof` against a growing `list` on **Python 3.14.6** (`tags/v3.14.6:c63aec6`, MSC v.1944 64-bit) on this machine, with the reproduce command in the file header. `getsizeof([]) = 56`, 8-byte pointers, both measured.
     - Capacity sequence: **4, 8, 16, 24, 32, 40, 52, 64, 76, 92, 108, 128, 148, 172, 200, 232**.
     - **The 24-vs-25 question is settled: this Python gives 24.** The multiple-of-4 rounding variant is what runs here. Measured, not recalled.
   - **The formula is VERIFIED across 16 measured points** (n ≤ 201, Python 3.14.6, single platform) — no longer folklore, and not a general proof either. `newSize + (newSize >> 3) + 6`, floored to a multiple of 4, reproduces **all sixteen** measured points exactly; it is a compression of the measurement **in the measured regime**. It ships as `cpythonCapacity()` so the animation can extend past append 201 and so "type your own input" works for any n — but **past append 201 it extrapolates**, applying the same rule beyond where anything was measured. *(Unit 3 note, name only, label unchanged: the rule itself is now module-private and the exported call returns the capacity together with its `basis`, so a past-201 caller cannot fail to know. See Unit 3's carry-forward-4 decision.)* **The measurement still outranks it**: if a re-measure ever disagrees, `MEASURED` wins and the function is deleted.
   - **Scope of the discharge.** The "unverified — pending measurement" labelling rule is discharged for the **measured regime (n ≤ 201) only**. For **n > 201 it is not discharged** — that regime is accepted as an **explicit, labelled extrapolation**, and must stay labelled as one wherever it surfaces (docs, code comments, or anything the UI shows). Extending the discharge upward requires measuring upward.
   - Growth ratios, measured: doubles only twice (4→8→16), then **1.5, 1.33, 1.25, 1.30, 1.23, 1.19, …** settling near **1.16**.
   - The point the animation must land: real growth is **smaller than 2x** and still amortized O(1).
2. **Opposite-end two-pointer convergence** on a sorted array — two `highlight` markers moving inward; the invariant "everything outside the pointers is decided" becomes visible.
3. **Fast-slow pointer** on a singly linked list (own `Node` class) — cycle detection. The invariant to make visible: why a faster pointer must eventually meet a slower one inside a cycle. Exercises `node` + `link` before the API freezes.

## Single next action

**Run `npm run dev` and look at it — this is GATE 1.** Nothing else gets built until it passes. Watch, in this order:

1. **dynamic array · growth**, on `doubling`, played end to end. The resize is the beat: allocate → copy each element → the array moves in → the old buffer is released and the row re-forms *through the swarm*.
2. The same input on **CPython (measured)**. This is the curriculum's written comparison, watched: doubling jumps 16 → 32 at append 17; the measurement gives 16 → **24**.
3. **sorted array · two pointers** — does the `decided` wash actually make "everything outside left..right is eliminated" visible, or is it too quiet to read?
4. **linked list · fast-slow** — does the ring make "fast must catch slow" obvious before the caption says it? Try `: none` in the input box to watch the other branch.
5. Step ± through a resize by hand, and type your own numbers.

Then answer the two Gate 1 questions — is the DSA right, and is the feel right — and either freeze the engine API or say what to change. **The specific judgement calls waiting on you are listed under "For Gate 1" below.**

### Unit 3 — delivered (2026-08-24)

The control shell and both DSA-1 structures. `npm run dev` now mounts the real thing; the study is simply unreferenced.

| File | What it is |
|---|---|
| `src/ui/menu.ts` | structure picker + variant buttons + the input box, **and the catalogue** — the one place that knows a structure exists. Also the chrome stylesheet, built from tokens only. |
| `src/ui/controls.ts` | play/pause, step ±, reset, frame counter, keyboard (space, ← →, r) |
| `src/structures/dynamic-array/algorithm.ts` | the from-scratch `DynamicArray` (both growth strategies) **and** `twoSumSorted`. Announces each step; knows nothing about frames. |
| `src/structures/dynamic-array/trace.ts` | the recorder: steps + live machine state → frames. Also `parseNumbers`. |
| `src/structures/dynamic-array/view.ts` | row layout, the two-bank resize, the field beat. Draws `cell`, `highlight`, `particleField`. |
| `src/structures/linked-list/algorithm.ts` | own `ListNode`, `buildList`, Floyd's `detectCycle` |
| `src/structures/linked-list/trace.ts` | the recorder, and the gap measurement |
| `src/structures/linked-list/view.ts` | straight run into a ring. Draws `node`, `link`, `highlight`. **No field settle anywhere** — the guardrail, deliberately. |
| `src/main.ts` | the shell: canvas, loop, player, caption/invariant/notes, `validate()` on every trace before it is shown |
| `src/check.ts` | `npm run check` (new script) |

**Grammar cap holds: 5 primitives, 3 motions, no sixth of either, nothing came close to needing one.**

**Three interactions, all working:** watch, step ±, type your own input. Live code-editing still absent; `TraceGenerator` is still the seam.

#### What was actually run (and what was not)

- `npm run typecheck` — **clean**.
- `npm run check` — **22 generated traces, `validate()` finds 0 problems**; 1504 view renders across every frame of every trace at four phases each, **no exceptions**; the growth rule still reproduces all 16 measured points; past-201 capacities come back labelled `extrapolated`.
- `npm run build` — clean. `npm run dev` — serves; every module resolves.
- **NOT run: a browser.** No agent-side browser exists here, so nobody has watched this move. To get as close as possible, the draw calls were captured through the `Surface` seam and rasterised offline into stills — which is what the WebGL seam is for, and it did catch real layout faults — but that harness has no grain, no atmosphere, no vignette, no multiply blending and no real type. **Surface (Level 1) is therefore unverified. Composition and layout are verified. The human's look is the first real one.**

#### Two real bugs the verification caught (both fixed)

1. **Elements vanished for one frame at the pointer swap.** The recorder inferred a block's role from whether it had a sibling, which was right during the copy loop and wrong immediately after it. Replaced with four named roles (`sole` / `draining` / `filling` / `drained`). This is exactly the "plausible-looking but wrong animation" the trace format exists to prevent, and `validate()` did **not** catch it — it was self-consistent, just false.
2. **The fast-slow gap was measured backwards.** `(fast - slow) mod L` counts *up* each tick; the quantity that shrinks is `(slow - fast) mod L` — how far fast still has to travel to land on slow. The invariant line had been asserting a contradiction of the picture. Now 2 → 1 → 0.

#### Decisions this unit owns

- **Carry-forward 1 — `validate()`'s `flow.from`: validated, against the current frame OR the previous one.** An event describes the transition *into* a frame, so its two ends live in different frames: `to` must exist now, `from` may legitimately be gone (a buffer released by the same step). Checking `from` against the current snapshot alone would reject correct traces; not checking it at all lets a typo'd source render as a flow from nowhere. The union of the two frames is the smallest set that admits every honest source and no invented one.
- **Carry-forward 4 — the n ≤ 201 boundary is now ENFORCEABLE, not documentary.** `cpythonCapacity(newSize)` returns a `CapacityClaim { capacity, basis, point, measuredThroughAppend }`. `basis` is three-valued because there are genuinely three regimes: `measured` (an exact measured point backs this pair — and the MEASUREMENT is returned, not the rule's output), `verified-range` (n ≤ 201, inside the checked regime), `extrapolated` (n > 201, beyond anything measured). Reasoning: the boundary is a property of the *claim*, not of the number, so a bare `number` cannot carry it and a comment cannot be checked; a record forces the caller to have `basis` in scope. Arithmetic below 201 is untouched — `claim.capacity` is the same integer for every n. **`cpythonCapacityFor` is no longer exported** (it is the private rule), because an exported unlabelled capacity function is an escape hatch that would make the boundary documentary again. `ruleMatchesMeasurement()` still guards the rule against the data and `npm run check` runs it. The UI honours the label: an extrapolated allocation says so in its caption, and the trace notes carry it.
- **A copied element is drawn as having MOVED** — it appears in the new bank and its old slot goes `stale` and empty. A real copy loop leaves the old bytes alone, but the trace format gives each element one identity and therefore one place. This is a statement about *ownership*, which is the thing being taught. Stated at the top of `dynamic-array/trace.ts`; **worth the human's agreement at Gate 1.**
- **Emergence is used once per resize and nowhere else**: on the frame where the old buffer is released and the figure genuinely recomposes from two rows into one. The per-element copies stay as individual `flow`s, because the copies *are* the O(n) the whole lesson turns on. The linked list has no field settle at all.
- **Captions, invariants, bank labels and provenance notes are drawn with `Surface.label`**, not with a primitive. Text is chrome and typography; the five primitives are spatial. Flagging it because it is the one thing that could be argued to sit outside the grammar.

#### For Gate 1 — judgement calls that are the human's, not mine

1. **Line weight.** Every stroke in the app lands on `HAND.minStroke` (0.9px): `strokeWidthFor` scales with a figure's short side, and a 36px cell or a 60px link gives 0.6–0.8 before the floor. If the drawing reads thin or timid, the fix is a token (`HAND.minStroke` / `HAND.strokeScale`), not code. Unverified either way — see above.
2. **`focus` terracotta (#d3ae77) on sand paper is low-contrast.** `compare` (blue-grey) reads much harder. Both are measured off the eggs. If pointer rings do not pop, this is why.
3. **`ACCENT_ALPHA.wash` = 0.13** for a decided span. Deliberately near-subliminal — check whether it is *too* quiet to carry the two-pointer invariant.
4. **`TYPE.value` is a fixed 15px** while a cell shrinks with capacity (down to ~28px wide at capacity 32). Single digits are fine; 3-digit custom input will crowd. A size that scales with the cell would be a token change at the freeze.
5. **Frame counts.** 18 appends is 65 frames, and playback is ~1s a frame. Right for stepping, long for watching. Say if `play` should move faster.
6. **Input caps** — 20 values, 12 nodes, chosen so one row stays one figure (Level 2) rather than a table.

### Unit 2 — delivered and verified (2026-08-23)

`engine-architect` built, and this session verified on disk:

| File | Size | What it is |
|---|---|---|
| `src/tokens/tokens.ts` | 32KB | palette, grain, speckle, hand, easing, composition, timing, `SEED` |
| `src/engine/renderer.ts` | 28KB | `Surface` interface (WebGL seam), `handLine`/`handOutline`, path math |
| `src/engine/primitives.ts` | 20KB | **exactly 5**: `particleField`, `cell`, `node`, `link`, `highlight` |
| `src/engine/motions.ts` | 24KB | **exactly 3**: `settle`, `swap`, `flow` — plus `Swarm`/`idleCloud`/`fieldPhase`/`sampleHomes` as particle-field machinery, not new motions |
| `src/engine/trace.ts` | 27KB | `Snapshot`/`Frame`/`Trace`, `TraceRecorder`, `validate`, `TracePlayer` |
| `src/engine/noise.ts` | 5KB | engine's own copy; does **not** import the study |

**`npm run typecheck` clean.** Grammar cap holds: 5 primitives + 3 motions, no sixth of either.

**Trace format reviewed against all three DSA-1 correctness targets — it carries all three:**

1. **Reallocation** — `BankState{capacity,size,status}` lets **two banks live in one snapshot**, which is the whole resize animation; `status:'stale'` releases the old one; `FlowEvent.carries` moves each element; `Trace.variant` switches doubling vs. measured CPython; `Trace.notes` carries the Python-version provenance the measurement rule demands.
2. **Opposite-end two-pointer** — `Target` includes a `span{bank,from,to}` case, so "everything outside the pointers is decided" is expressible as a *region*, not faked with per-cell marks. `Frame.invariant` is a first-class field.
3. **Fast-slow** — `NodeState`/`LinkState{directed,to:null}`, `Snapshot.entry`, `FlowEvent.along` (pointer advances follow the drawn edge), and `walk()` returns `{order,cyclic}`. Two marks may share one node, so the meet is renderable. `events` is a list, so fast's two-step tick is two flows in one frame.

`Snapshot` is full-state, no deltas — as specified. `TraceGenerator` is the seam for "type your own input"; `TracePlayer` has `stepForward`/`stepBack`/`seek`/`toggle`/`reset`.

**Finding to fix in Unit 3 (small, real):** `validate()` resolves `flow.to` and `flow.along` but **never `flow.from`** (`src/engine/trace.ts:508-513`) — the one asymmetry in an otherwise over-determined checker. Either validate it, or comment why a source ref may legitimately be absent from the current snapshot (events describe the transition *into* this frame). Do not leave it silently uneven.

**Note, not a defect:** `src/main.ts:14` imports `./study/study`. That is the mount point that makes the study runnable and is intended; the rule "nothing outside `src/study/` may import from it" means **engine and tokens**, and that holds — `src/engine/noise.ts` explicitly keeps its own copy rather than reaching into the study. The engine is not yet wired to anything runnable, so `npm run dev` still shows the study. Expected: Unit 2 was specified as no-UI.

**Contract note, second occurrence:** Unit 2 also did not write back to `STATE.md` — this session closed the boundary on its behalf, same as Unit 1. Unit 3's dispatch must state the STATE.md write-back as an explicit deliverable, not an expectation.

### Aesthetic checkpoint — PASSED (2026-08-23)

Human watched the four-beat loop (`drift → gather → rest → dissolve`) and approved all three levels: surface, composition, and the signature emergence beat. `src/study/` is now the approved feel reference and is carried forward, not redesigned.

**Standing instruction issued with the pass: "don't forget about the other inspirations too."** Binding on every visual decision from here.

The study exercised exactly **one** of the five primitives — the particle field, from `murmuration-whale.png` and `funnel-of-dots.png`. The other four have no study behind them and must be derived from the images that actually carry them, never extrapolated from the swarm or invented from Section 3's prose:

| Primitive | Reference | What it carries |
|---|---|---|
| **cell**, **node** | `eggs-as-figure.png` | Emergence **without** particles — discrete, individually-drawn objects (varied size, irregular ellipse, speckled surface, shared colour family) whose *arrangement* is the figure. Cells and nodes are individually drawn, not stamped clones. |
| **link**, all edges | `line-figure-icon.png` | One continuous confident stroke, uneven weight, single gesture; paper rectangles with wobbly non-parallel edges, slightly offset. A drawn line — not a vector line with noise added. |
| composition (all) | `ship-at-sea.png`, `birds-over-building.png` | Level 2: one subject, generous negative space, atmospheric out-of-focus ground; countable individuals still distinct rather than texture. |

Per Section 11, Grokking's hand-drawn register is considered covered by these six images. The Section 3 guardrail stands: **emergence is a signature, not a law** — cell/node/link must not collapse into particle clouds.

### Unit 1 — delivered (not dispatched this session; found on disk, verified)

Vite 8 + TypeScript 7 skeleton, strict tsconfig, `npm run dev` works, `npm run typecheck` clean.
Throwaway study in `src/study/` — `study.ts` (beat clock), `specks.ts` (speck field, damped springs), `field.ts` (density-defined form), `paper.ts` (ground, grain, atmosphere, vignette), `palette.ts` (draft colours), `noise.ts`; entry `src/main.ts`, `index.html`.
14k–40k specks, density-scaled to viewport. All values hardcoded on purpose — this is the draft the real tokens file gets distilled from, and the study is deleted once it has been.

**Contract note:** the Unit-1 run never wrote back to `STATE.md` — the code was found on disk with this file still reading "no work started". Every future unit must close its own task boundary here before the session ends.

---

## Sources (Section 11 authorities)

| Source | Role | Location | Status |
|---|---|---|---|
| **Curriculum** | Sequencing + depth authority; defines the gap this system fills | `reference/DSA + Backend in Python Plan.md` | **Present.** ~154KB — read only the active gate's sections (`### DSA-n:` and `### DSA-n —`), never wholesale |
| **Wengrow** | Rigor authority for complexity/mechanics claims | `reference/` | **Pending** — added before Phase 2. **Phase 1 does not block on it.** |
| **Grokking** | Visual sensibility | `aesthetic/` (six images) | **Covered.** No book file needed |

---

## Decisions that override BUILD_PLAN.md

Recorded here because `BUILD_PLAN.md` still carries the superseded text. **This section wins where they conflict.**

1. **All state traces are authored by Claude, not the human** — DSA-1 and every Phase 2 structure. The human verifies finished animations; they do not author the input.
   - *Supersedes:* Section 4 ("This is pure DSA. You write it."), the Section 12 row "State trace for each structure … **You, by hand**", and the closing line "The algorithm content stays in your hands because encoding it is the learning."
2. **Traces are generated by instrumenting a real executable implementation, never narrated.** Each structure gets `algorithm.ts` emitting frames as it runs, so the trace is correct by construction. Section 8's "type your own input" already required this.
   - *Supersedes:* Section 10's `structures/<name>/trace.ts # YOUR hand-written state trace`. That file becomes the recorder/emitter; `algorithm.ts` is added alongside.
3. **Gate 1's trace criterion** is *readable enough to verify against the real algorithm*, not *comfortable to write by hand*.
4. **Gate 1 covers both DSA-1 pointer families**, not just opposite-end.
   - *Supersedes:* Section 8, which names only "two-pointer convergence on a sorted array". The curriculum (`reference/…:116`) specifies "Opposite-end two-pointer convergence on a sorted list; fast-slow pointer technique for singly linked structures", and Section 11 makes the curriculum the depth authority. Section 8 was written before the curriculum was in the repo.
   - Secondary benefit: without this, Gate 1 would freeze the engine API with `node` and `link` never once rendered.
5. **Resize models both growth strategies, switchable** — own doubling vs. real CPython over-allocation. Naive-doubling-only was rejected as teaching the folklore the curriculum's diagnostic exists to correct.

## Open items (non-blocking for Phase 1)

- ~~`claude/agents/` missing its leading dot~~ — **resolved**; moved to `.claude/agents/`. Note for future: agent definitions register at startup, so adding or moving one always costs a restart.
- `trace-wirer.md` declares `model: sonnet`; that alias resolves to Sonnet 4.6 in this build, which is **not** in the project allowlist. Pin `claude-sonnet-5` before Phase 2.
- **Deferred DSA-1 curriculum content, post-Gate-1:** `list.insert(0, x)` / `pop(0)` being O(n) because every element shifts (a natural `flow` demonstration), and the deque-vs-list distinction it motivates — introduced at DSA-1, enforced at DSA-11.
- **`npm run check` builds before it runs** (`vite build --ssr src/check.ts` into `.check/`, then `node`). That is because node cannot resolve this project's extensionless imports, and adding a runner would be a new dependency. Vite was already here, so it does the resolving. Deleting `.check/` is always safe.
- **Two-pointer and cycle inputs carry their variant after a colon** (`2 3 5 8 : 11`, `1 2 3 4 5 : 2`) rather than in buttons, because a target sum and a loop index are values, not switches. The growth strategy is a switch and gets buttons. If that reads as two different input idioms at Gate 1, unify it then.
- With traces generated rather than human-authored, `correctness-reviewer` carries more weight in Phase 2.

---

## Phase 1 checklist

- [x] Move `claude/agents/` → `.claude/agents/` — **done**; requires a Claude Code restart before `engine-architect` is dispatchable
- [x] Vite + TypeScript + Canvas 2D skeleton; `npm install && npm run dev` works
- [x] Throwaway aesthetic study (scatter → settle → dissolve, density-defined form)
- [x] **AESTHETIC CHECKPOINT** — human look; **passed** 2026-08-23
- [x] `src/tokens/tokens.ts` — palette, texture, easing (the only place these live) — **Unit 2, verified**
- [x] `src/engine/renderer.ts` — Canvas 2D behind one interface (WebGL seam) — **Unit 2, verified**
- [x] `src/engine/primitives.ts` — exactly 5: particle field, cell, node, link, highlight — **Unit 2, verified**
- [x] `src/engine/motions.ts` — exactly 3: settle, swap, flow — **Unit 2, verified**
- [x] `src/engine/trace.ts` — state-trace format (full snapshots, not deltas) + player — **Unit 2, verified**
- [x] `src/ui/controls.ts`, `src/ui/menu.ts` — play/pause, step ±, reset, custom input — **Unit 3**
- [x] **Measure CPython over-allocation on this machine** — **done 2026-08-23**, Python 3.14.6, 16 points, committed as `src/structures/dynamic-array/growth.measured.ts`; typecheck clean. Unit 3's hard prerequisite is cleared.
- [x] `src/structures/dynamic-array/` — `algorithm.ts` (instrumented, both growth strategies), `trace.ts`, `view.ts` — **Unit 3**
- [x] `src/structures/linked-list/` — `algorithm.ts` (own `Node`, fast-slow cycle detection), `trace.ts`, `view.ts` — **Unit 3**
- [x] Fix `validate()` `flow.from` asymmetry — **Unit 3**; validated against current-or-previous frame, with the reasoning in the code
- [x] Wire `src/main.ts` to the real shell — **Unit 3**
- [x] `npm run check` — `validate()` over every trace both structures generate, plus a headless render pass — **Unit 3**
- [ ] **GATE 1** — human sign-off on feel + DSA; freeze the engine API ← **here now**

## Resume note

*(Written only when a checkpoint interrupts work mid-task. Empty means no work is in flight.)*

**Nothing in flight. Waiting on a human, not on an agent.** Unit 3 returned and closed its own boundary here. The next event is the Gate 1 look (see "Single next action"); no unit is dispatched and none should be until Gate 1 passes.

Three standing facts, unchanged by Unit 3:

- `src/study/` is **not** deleted. `src/main.ts` no longer mounts it, so it is now simply unreferenced — deletion stays a Phase-1-end decision for the human. `src/main.ts` still exports the `Scene` interface the study type-imports; an interface is erased at build time, so it costs the running app nothing. Nothing in `src/engine/` or `src/tokens/` imports from the study, and nothing in `src/structures/` imports from `src/ui/` — the dependency runs one way.
- The engine API is **still not frozen**, and Unit 3 changed nothing in its shape: no primitive, motion, renderer or trace-format signature moved. The only engine edit was inside `validate()` (a new check, no format change).
- `growth.measured.ts` gained `PROVENANCE`, `MEASURED_THROUGH_APPEND`, `CapacityBasis`, `CapacityClaim` and `cpythonCapacity`, and lost the *export* of `cpythonCapacityFor`. **The 16 measured points were not touched.**
