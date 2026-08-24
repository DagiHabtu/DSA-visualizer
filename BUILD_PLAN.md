# Visual DSA Learning System — Claude Code Build Plan

**What this is.** A local, browser-based system for learning Data Structures & Algorithms *visually*, filling the gap the curriculum's text/video resources leave: seeing structures **mutate step by step** and watching **what stays invariant**. You hand this file to Claude Code. It tells Claude Code what to build, in what order, and which model runs each piece.

**Who does what, in one line:** Claude Code builds the rendering engine and the reusable visual grammar; *you* write the per-structure "state traces" (the DSA-dense part — that's where the learning is); Opus-tier builders turn each trace into an animation, and a Sonnet subagent handles the mechanical wiring.

---

## 0. Model reality check (read once)

The four tiers this plan uses, and why each one earns a place — the ladder tracks *reasoning difficulty*, not task volume:

| Tier | How to select it | Why it exists / what it does |
|---|---|---|
| **Opus 5** — foundational | `model: opus` (alias → newest Opus), or `/advisor` on demand | Decisions whose mistakes propagate through the whole system: all Phase-1 architecture (engine, visual grammar, state-trace contract, renderer/API, aesthetic-feasibility judgment, the DSA-1 reference animation), plus escalation for genuinely subtle algorithmic-correctness questions. |
| **Opus 4.8** — difficult | pin `model: claude-opus-4-8` | The genuinely hard Phase-2 structures — hashing's probe/tombstone/rehash logic and Timsort's run detection — where rendering the *correct* semantics is itself hard; plus substantial, cross-cutting reviews needing strong reasoning but not Opus-5 judgment. |
| **Opus 4.6** — complex but bounded | pin `model: claude-opus-4-6` | The default Phase-2 structure view logic (heaps, trees, graphs, plain merge/quick sort), routine implementation reviews against the frozen architecture, and contained edge-case analysis / debugging. More reasoning than boilerplate; less than the two hard structures. |
| **Sonnet 5** — mechanical | `model: sonnet` (alias → newest Sonnet) | Well-specified, repetitive work: trace→object wiring, config/menu registration, test stubs, straightforward transformations — where the correct approach is already fixed. |

**One gotcha that will silently collapse the ladder if you miss it:** the `opus` alias resolves to the *newest* Opus, which is now **Opus 5**. So `model: opus` = Opus 5. Every agent that must run on Opus **4.8** or **4.6** is therefore pinned to a full identifier (`claude-opus-4-8` / `claude-opus-4-6`) — the alias would silently route it up to Opus 5. Only the architect keeps the bare `opus` alias, *because* it should be Opus 5. (If Claude Code doesn't recognize a pinned string, copy the exact identifier shown in the `/model` picker.) Sonnet's alias is unambiguous — one newest Sonnet. Opus 5 is also what your `/advisor` command invokes, which is how the subtle questions reach it without making it a standing subagent.

**On effort levels (a second dial, independent of model).** Model is the fixed weights (how capable); effort is how much of that capability gets spent on your request. In Claude Code, `effort` is a supported subagent frontmatter field (`low`/`medium`/`high`/`xhigh`/`max`) and — this is the load-bearing fact — **frontmatter effort overrides the session effort level**. A subagent declaring `effort: high` runs at high even in a session set to medium or max; the session cannot talk it out of it. So the two dials are pinned per agent:

| Agent | Model | Effort | Why |
|---|---|---|---|
| `engine-architect` | Opus 5 | **high (FIXED)** | Foundational Phase-1 work; guaranteed high, never drifts |
| `animation-builder-hard` | Opus 4.8 | high | Difficult structures need full reasoning applied |
| `correctness-reviewer` | Opus 4.6 | high | Reviewing for subtle mismatches rewards trying harder |
| `animation-builder` | Opus 4.6 | medium | Bounded work — capable model, moderate spend |
| `trace-wirer` | Sonnet 5 | low | Mechanical; nothing to over-think |

Two rules that keep the guarantee intact: (1) **Do not put the effort instruction in `CLAUDE.md`** — it applies for the single turn that reads the file, then reverts; frontmatter is the only durable pin. (2) **Do not set a global high effort** (via `--effort high` on the whole session or the `CLAUDE_CODE_EFFORT_LEVEL` env var) to force Opus 5 high — that would drag the mechanical agents up too. The per-agent frontmatter above already guarantees Opus 5 = high in isolation. The one place to pass `--effort high` explicitly is when you escalate to Opus 5 via `/advisor`, so that on-demand call also runs at high.

---

## 1. Hard scope constraints (the guardrails that keep this from exploding)

These are non-negotiable. Put them at the top of `CLAUDE.md` so every agent obeys them.

1. **Thin engine, not a framework.** The visual grammar is capped at **5 spatial primitives + 3 motions** (Section 3). If a task seems to need a 6th primitive, that's a signal to stop and ask the human — not to add it. No plugin system, no config-driven animation DSL, no "generalized" anything.
2. **Live code-editing is deferred.** v1 supports: watch (play/pause), step forward/back, and type your own input. Editing the algorithm's code live and seeing it re-animate is a *later phase* with a clean seam left for it — not built now.
3. **Local only.** Runs in a browser on your machine with one command. No deployment, no accounts, no backend, no database.
4. **Scope is set by the curriculum, not by the books.** The curriculum decides *which* structures and *what depth*. Grokking and Wengrow inform *how it looks* and *what's rigorous* (Section 11) — they do not get to add structures the curriculum didn't gate on.
5. **No fan-out before the reference animation is done** (Section 7). This is the load-bearing rule.

---

## 2. Tech stack + run story

Chosen for: dead-simple local run, fast iteration on animations, good particle performance, minimal moving parts.

- **Vite + TypeScript** — one command to run (`npm run dev`), hot-reload so animation tweaks show instantly, type safety so `mypy`-style discipline carries over.
- **Canvas 2D** as the renderer — handles the particle-cloud scenes (murmurations, settling dots) that SVG chokes on, and draws discrete structures (cells, nodes) just as easily. The hand-drawn, textured aesthetic is *easier* to fake on Canvas than SVG.
- **No UI framework to start** — a thin vanilla-TS shell for the controls. (If the control panel later grows enough to justify one, that's a deliberate decision, not a default.)
- **Rendering seam for later:** if the particle-heavy transitions ever drop frames, the upgrade is Canvas 2D → WebGL for *just those scenes*. Leave the renderer behind one interface so this swap is local. Same discipline as deferring live-editing.

**Run story (what you type):**
```
npm install
npm run dev
```
Then open the URL it prints. That's the whole thing.

---

## 3. The visual grammar (this is the product — build it once, perfectly)

Every animation is written in this alphabet. All of it lives in **one tokens file** and **one primitives module** so the "language" is centrally controlled and consistent across every structure. That consistency is not cosmetic — it's what makes the learning strong: *a shape always means the same idea.*

**The aesthetic is defined at three levels, in priority order.** They govern how the primitives get used, so read them before the primitive list. The primitives are the *what*; these levels are the *how it should feel* — and they're what separates this from a generic visualizer that merely has a nice color scheme.

**Level 1 — Surface language (how any single element is rendered).**
- *Palette*, muted and desaturated: dusty sky-blue-grey, warm sand/cream (grounds), muted sage/olive, soft terracotta/peach (accents), charcoal (dots, line work). Nothing neon, nothing pure-primary.
- *Texture*: a subtle grain over fills; line work carries a faint hand-drawn wobble rather than crisp vector edges. Forms read as organic and drawn, not CAD.
- *Motion*: soft easing; elements breathe into place. The reference is "a murmuration settling," never a slide transition.

**Level 2 — Composition (how the frame is arranged).** One primary figure at a time, in generous negative space, against a soft, atmospheric ground (see the ship and funnel references — a single subject in a calm, slightly out-of-focus field). Restraint over density: the opposite of an edge-to-edge, gridded dashboard. Quiet, with one living thing in it.

**Level 3 — Signature principle: emergence (the move that makes it *this* aesthetic — used where it earns its place, not everywhere).** In the references, a mass of small organic things *becomes* a larger meaningful form: thousands of starlings are the whale, scattered eggs are the "5," a storm of specks is the funnel. Where it genuinely reinforces the concept, many small organic elements should be able to **collectively form, organize into, or dissolve from** the larger structure — and that **swarm → structure → swarm** transition is a meaningful visual beat, the moment you watch for, not a decorative particle effect.

> **Guardrail — signature, not law.** The algorithmic concept always takes priority over the effect. Reach for emergence where it strengthens understanding (values finding homes in a hash table; a heap settling; an array's elements resettling into a resized buffer) and **not** where it would misrepresent or clutter the idea (a linked list is about the pointers *between* nodes, not a swarm; two converging pointers are about position, not particles). Do not let the system collapse into "everything is a particle cloud" — that is both aesthetically monotonous and pedagogically weaker.

### The grammar — 5 spatial primitives

1. **Particle field** — a cloud of many small dots that can **settle into a shape** or scatter out of one. The signature Anthropic move (the murmuration becoming a whale; the funnel of dots). Used wherever "many elements find their places": hash probing, bucket distribution, the moment an array of values organizes.
2. **Cell** — a single indexed slot with hand-drawn edges and a lightly textured fill. Used for: array indices, hash-table buckets, the flat array a heap lives in.
3. **Node** — a rounded token holding a value. Used for: linked-list nodes, tree nodes, graph vertices.
4. **Link** — a connecting line between nodes, with a slight hand-drawn wobble. Directional variant (arrowhead) = a pointer. Used for: `next`/`prev` pointers, parent-child edges, graph edges.
5. **Highlight** — a transient emphasis (soft glow / ring / gentle color shift) marking *"the algorithm is looking here right now."* Used for: two-pointer positions, the current node in a traversal, the pair being compared in a sort. **This primitive is how invariants become visible** — it's the answer to "what does the curriculum leave me unable to see."

### The grammar — 3 motions (the reusable transitions)

- **settle** — elements ease *down into position* under gentle physics (not a linear slide), echoing the funnel and the eggs coming to rest. Used for: insertion, placement, heapify sinking.
- **swap** — two elements trade places along an *arc*, not a straight line. Used for: sorting swaps, heap sift up/down.
- **flow** — a value or activation *propagates along links*. Used for: copying during array resize, BFS frontier spreading, a pointer advancing.

> **Reproduction rule:** these animations are *original work inspired by* the concepts and aesthetic. Do not scan, trace, or reproduce figures from Grokking, Wengrow, or any source. The six images in `aesthetic/` are style evidence to *internalize* — the target feel — not assets to trace, embed, or copy pixel-for-pixel. The grammar above is yours; the books inform sensibility only.

---

## 4. The state-trace pattern (the learning boundary — where you stop delegating)

An animation is just a **rendering of a sequence of states**. Separate the two:

- **The state trace** = the ordered list of states the algorithm passes through, plus which primitive events fire on each step. *This is pure DSA. You write it.* Encoding a resize or a probe sequence forces you to understand it exactly — that's the retention win, and it's the reason not to hand this to a model.
- **The engine** = renders each state using the primitives. *Claude Code builds this, once.*
- **The wiring** = maps your trace to engine calls. *A Sonnet subagent does this boilerplate.*

### Concrete example — DSA-1 dynamic array `append` that triggers a resize

You write this (or something like it — the shape is the point):
```
frame 0:  cap=4 size=4  cells=[a,b,c,d]                 highlight: none
frame 1:  append(e) requested                            highlight: incoming value e
frame 2:  buffer full → allocate new buffer cap=8        motion: settle (4 empty cells appear)
frame 3:  copy a → new[0]                                motion: flow (a moves old→new)
frame 4:  copy b → new[1]                                motion: flow
frame 5:  copy c → new[2]                                motion: flow
frame 6:  copy d → new[3]                                motion: flow
frame 7:  release old buffer                             motion: old cells fade
frame 8:  place e at index 4, size=5                     motion: settle (e drops into slot 4)
```
The engine turns each frame into primitive calls. The **step forward/back** controls just move through this list. **Play** advances it on a timer. **Custom input** = you generate a *different* trace from the same algorithm run on your numbers.

This is why the trace format matters more than any single animation: it's the contract between your DSA understanding and the visual engine. Design it well in Phase 1 (Opus 5, with your sign-off) and every later structure reuses it.

---

## 5. Phased build plan (with gates)

**Phase 1 — Spine (serial, Opus 5, deep). No parallelism.**
- **First, inspect the references.** Open every image in `aesthetic/` and study them as visual evidence — surface, composition, and the emergence beat — *before* designing anything. Work from the images, not from the prose description; the images are the ground truth for the feel.
- Build the Vite/TS/Canvas skeleton and the one-command run.
- **Aesthetic-validation study — before the grammar is finalized.** Build one small, *throwaway* visual study that proves the reference's feel is achievable at all: a field of organic specks that scatters, **settles into an ordered form, and dissolves back** — on the muted palette, with grain, hand-drawn edges, soft easing, and one figure in a calm, atmospheric field. This validates *emergence + restraint + organic motion* in isolation, with zero DSA correctness in the way. **Aesthetic checkpoint (quick human look):** if it doesn't feel like the references, iterate the tokens and motion *here* — cheaply, on the throwaway — before any real grammar is built on top. This is the "probe before plan" move: settle the hardest aesthetic question first, on something disposable.
- Finalize the **5 primitives + 3 motions + the tokens file** (Section 3), carrying forward exactly what the study established.
- Define the **state-trace format** (Section 4).
- Build the **control shell**: play/pause, step forward, step back, reset, and a "type your own input" box.
- Build **one complete reference animation end to end: DSA-1 dynamic array** (Section 8). Its emergence beat is the **resize** — values lifting out of the full buffer and *settling* into the larger frame; between resizes the array rests as a plain, calm row. One structure, demonstrating emergence-where-it-fits *and* restraint everywhere else.
- **GATE 1 (human sign-off):** *You* look at the DSA-1 result and confirm two things. The DSA is right: the grammar reads correctly, and the trace format is comfortable to write by hand. And the *feel* is right: the resize lands as a genuine emergence beat, the resting array is calm rather than busy, and palette/texture/motion match the references. Does a "node," a "settle," a "highlight" read the way it should? **Nothing else gets built until you say yes.** Freeze the engine API here.

**Phase 2 — Replicate (parallel now allowed; capability-tiered — see Sections 6 and 12).**
- Add structures in the motion-heavy order (Section 9), one per unit of work, each against the *frozen* API.
- For each: you write the state trace → a builder implements the structure-specific view logic — **Opus 4.6** for the default, complex-but-bounded structures (heaps, trees, graphs, plain sort), **Opus 4.8** for the two genuinely difficult ones (hashing's probe/tombstone/rehash, Timsort's run detection) → a **Sonnet 5** agent wires trace-to-engine, registers the menu/config, and stubs tests → the **Opus 4.6** reviewer checks the implementation against the frozen architecture, escalating to **Opus 4.8** for a substantial cross-cutting review and to **Opus 5** via `/advisor` for a genuinely subtle algorithmic-correctness question.
- **GATE 2 (per structure):** the animation matches the algorithm's real behavior (reviewer-confirmed) and reuses only the existing primitives (no grammar drift).

**Phase 3 — (deferred, explicitly not now)** live code-editing wired to the renderer. The seam is left in Phase 1; the build is a future decision.

---

## 6. Subagent roster (drop these into `.claude/agents/`)

Each block is a ready-to-use subagent file. Create them as `.claude/agents/<name>.md` in the project. Frontmatter fields shown are the documented ones. Read the `model` lines carefully: the `opus` alias resolves to the *newest* Opus, which is now **Opus 5** — so every agent that must run on Opus **4.8** or **4.6** is **pinned** to a full identifier (`claude-opus-4-8` / `claude-opus-4-6`), otherwise the alias would silently promote it to Opus 5 and collapse the ladder. Only `engine-architect` keeps the bare `opus` alias, *because* it should be Opus 5.

### `.claude/agents/engine-architect.md`
```yaml
---
name: engine-architect
description: Designs and builds the core rendering engine, the visual grammar (5 primitives + 3 motions), the tokens file, and the state-trace format. Use in Phase 1 only, serially. Invoke for any change to the engine API or grammar.
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: opus            # alias → newest Opus = Opus 5
effort: high           # FIXED at high. Frontmatter effort OVERRIDES session effort, so this holds
                       # regardless of how the session is launched — never medium/low, never xhigh/max.
color: blue
---
You are the architect of a local, Canvas-2D visual engine for animating data structures.
Think carefully and design the interface before writing code. Your output is the alphabet
every later animation is written in, so coherence matters more than speed.

BEFORE designing anything, open and study every image in `aesthetic/` as primary visual
evidence — surface, composition, and the emergence beat. Do not design from the prose
description alone; the images are the ground truth for the feel. Your FIRST visual deliverable
is a small throwaway study proving that reference feel is achievable (a field of specks that
scatters, settles into an ordered form, and dissolves back), validating emergence + restraint +
organic motion — NOT merely proving that Canvas can draw the five primitives. Get that feel
right on the disposable study before finalizing the grammar.

Hard constraints (never violate):
- Exactly 5 spatial primitives (particle field, cell, node, link, highlight) and 3 motions
  (settle, swap, flow). If something seems to need a 6th, STOP and ask the human.
- No framework, no plugin system, no config-driven animation DSL.
- Everything renders through Canvas 2D behind a single renderer interface (leave a seam for a
  future WebGL swap on particle-heavy scenes).
- The aesthetic has three levels, in priority order (Section 3): (1) surface — muted palette,
  grain, hand-drawn wobble, soft easing; (2) composition — one primary figure, generous negative
  space, atmospheric stillness, restraint over dashboard density; (3) signature — emergence, the
  swarm→form→swarm beat, used ONLY where it reinforces the concept. Emergence is a signature, not
  a law: never force a structure into a particle swarm; the algorithmic concept always wins.
- All colors, textures, easing curves live in ONE tokens file. Palette is muted/desaturated
  (dusty sky-blue-grey, sand/cream, sage, terracotta, charcoal). Hand-drawn wobble on lines,
  subtle grain on fills, soft easing — reference is "a murmuration settling," not a slide transition.
- Define a state-trace format: an ordered list of frames, each a structure snapshot + primitive
  events. The step/play controls walk this list. Keep it hand-writable by a human.
Deliver working, typed TypeScript. No placeholders.
```

### `.claude/agents/animation-builder.md`
```yaml
---
name: animation-builder
description: Implements one DEFAULT, complex-but-bounded structure animation (heaps, trees, graphs, plain merge/quick sort) against the FROZEN engine API, using the human-authored state trace. Use in Phase 2, one structure at a time. For the two genuinely difficult structures (hashing, Timsort) use animation-builder-hard instead.
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: claude-opus-4-6   # pinned — the `opus` alias would route to Opus 5; this tier is the bounded default
effort: medium           # bounded work — capable model, moderate spend
color: green
---
You build a single, complex-but-bounded structure's animation against an existing, frozen engine API.
You are given: the engine's primitive/motion API, the trace format, and a human-written state
trace for this structure. Implement the view logic that renders this structure's traces.

Rules:
- Use ONLY the 5 existing primitives and 3 existing motions. If you think you need a new one,
  STOP and report it — do not add it.
- Do not modify the engine API or the tokens file. If either seems wrong, report it; don't patch it.
- Match the algorithm's real behavior exactly as described by the provided trace.
- Typed TypeScript, no placeholders, handle the empty/single-element/degenerate cases.
- If this structure turns out to hide a genuinely subtle correctness question (not just bounded
  fiddliness), STOP and flag it — route to animation-builder-hard (Opus 4.8) or an Opus-5 /advisor
  check rather than guessing past it.
```

### `.claude/agents/animation-builder-hard.md`
```yaml
---
name: animation-builder-hard
description: Implements the two genuinely DIFFICULT structure animations against the FROZEN engine API — hashing (open-addressed probe path, tombstone deletion, resize-rehash) and Timsort (run detection and merging) — where rendering the CORRECT algorithmic semantics is itself hard. Use in Phase 2 for those two only.
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: claude-opus-4-8   # pinned — difficult per-structure work; the alias would route to Opus 5
effort: high             # difficult structures get full reasoning applied
color: teal
---
You build one of the two hardest structure animations against a frozen engine API. The difficulty
here is not volume — it is getting subtle algorithmic behavior rendered FAITHFULLY: the exact probe
sequence and tombstone semantics for open-addressed hashing, or genuine run boundaries and merges
for Timsort. A plausible-looking-but-wrong animation is the failure to avoid.

Rules:
- Use ONLY the 5 existing primitives and 3 existing motions. If you think you need a new one, STOP
  and report it — do not add it.
- Do not modify the engine API or the tokens file. Report, don't patch.
- The rendered state sequence must match the real algorithm step for step. Where the correct
  behavior is genuinely subtle and you are not fully certain, STOP and escalate to Opus 5 via
  /advisor rather than shipping a confident guess.
- Typed TypeScript, no placeholders, full edge-case coverage (collision chains, tombstone reuse,
  resize-rehash; degenerate and already-sorted runs).
```

### `.claude/agents/trace-wirer.md`
```yaml
---
name: trace-wirer
description: Mechanical wiring and scaffolding. Converts a human-written state trace into the engine's trace-object format, writes per-structure config, registers the structure in the menu, and stubs tests. Fast, mechanical work.
tools: [Read, Write, Edit, Glob, Grep]
model: sonnet
effort: low
color: gray
---
You do the repetitive boilerplate. Given a human-written state trace and the existing engine
conventions, produce the trace object in the required format, the config entry, the menu
registration, and empty test stubs. Copy existing patterns exactly. Do not invent structure or
make design decisions — if something is ambiguous, leave a clearly marked TODO and report it.
Write test STUBS only: turning stubs into real correctness assertions (asserting the rendered
state sequence matches expected) is a reasoning task and belongs to the Opus 4.6 reviewer/builder,
not here.
```

### `.claude/agents/correctness-reviewer.md`
```yaml
---
name: correctness-reviewer
description: Reviews a finished Phase-2 animation against the FROZEN architecture — DSA correctness (does it match the real algorithm?), edge-case coverage, and grammar drift. Read-only. Handles ROUTINE implementation reviews; escalates substantial reviews to Opus 4.8 and genuinely subtle correctness to Opus 5 via /advisor.
tools: [Read, Grep, Glob]
model: claude-opus-4-6   # routine implementation reviews against a frozen architecture
effort: high             # reviewing for subtle mismatches rewards trying harder, even on a mid model
color: purple
---
You are a senior reviewer handling routine implementation reviews against a frozen architecture.
Think carefully. Check three things and report specifically:
1. Correctness: does the animation's state sequence match the real algorithm's behavior, step by
   step? Name any step that misrepresents what the structure actually does.
2. Edge cases: empty, single element, full/resize boundary, duplicate values, degenerate shapes.
3. Grammar drift: were any new primitives or motions introduced beyond the 5+3? Were the tokens
   bypassed with hardcoded colors/easing? Flag every instance with a file/line reference.
Two-rung escalation:
- If the review is substantial and cross-cutting (spans the engine boundary, or weighs several
  interacting concerns) rather than a contained per-structure check, hand it to Opus 4.8.
- If the algorithm's behavior is genuinely subtle — Timsort run-merging, heap sift-down ordering,
  three-color cycle detection, BST two-child deletion — and you are not fully certain your reading
  is correct, say so and tell the human to re-run via /advisor (Opus 5). Flagging your own
  uncertainty is the correct move; a confident wrong review is the failure to avoid.
Do not rewrite code — report findings with specific locations and the reasoning behind each.
```

---

## 7. The delegation rule (the one that prevents integration hell)

**Delegation depends on the phase, not on the task.**

- In **Phase 1**, there is exactly one active agent (`engine-architect`, Opus 5, serial). Parallel subagents here would build against an API that's still changing and drift apart — that's the classic greenfield failure. Do not fan out.
- Fan-out is **unlocked only by passing Gate 1** (you signed off on DSA-1, engine API frozen). After that, each structure is an independent, well-specified task and parallelism is safe and useful: builder + `trace-wirer` (Sonnet 5) pairs run against the frozen API — `animation-builder` (Opus 4.6) for default structures, `animation-builder-hard` (Opus 4.8) for the two difficult ones — with `correctness-reviewer` (Opus 4.6) checking each and escalating to Opus 4.8 for substantial reviews and Opus 5 for subtle correctness.

Reason, stated plainly: parallelism multiplies coherence you already have; it cannot create coherence you haven't built. Build the spine with one mind, then scale with many.

---

## 8. First deliverable — DSA-1 vertical slice (the whole point of Phase 1)

This is the reference. It must demonstrate the full system on one gate before anything scales.

Must show:
- **Dynamic array growth:** appending, and the **resize/reallocation** moment (allocate bigger buffer → copy elements → release old). This is the visual the curriculum's text can't show — the buffer *doubling* as motion, and it is DSA-1's **emergence beat**: values lift out of the full buffer and *settle* into the larger frame (`settle` for the new cells, `flow` for the copies). Between resizes the array rests as a plain, calm row — restraint, per Level 2 — so this one structure demonstrates emergence-where-it-fits *and* stillness everywhere else.
- **Two-pointer convergence** on a sorted array: two `highlight` markers moving inward. The invariant ("everything outside the pointers is decided") becomes visible via the highlight primitive.
- All three interaction modes working: **step** (through the trace), **play/pause** (trace on a timer), **type your own input** (generate the trace from the algorithm run on the user's numbers).

Passing = Gate 1. You look at it, confirm the grammar reads correctly and the trace is comfortable to hand-write, and freeze the API.

---

## 9. Expansion order (after Gate 1)

Ordered by *how much the structure is about state-over-time* — i.e., how much a static book fails it. This is where the visual system earns its existence.

1. **Hashing (DSA-3)** — open-addressed probing as a **particle field** scattering and settling into slots; tombstones as faded cells. The probe sequence is invisible in text; here it's the whole show.
2. **Sorting / Timsort (DSA-5)** — `swap` arcs; merge as two streams interleaving; Timsort's "runs" lighting up via `highlight`.
3. **Heaps (DSA-10)** — sift-up / sift-down as `swap` along the tree, mirrored in the flat array (`cell`s) simultaneously — the "same thing, two views" that text can't do.
4. **Trees & traversals (DSA-9)** — traversal as `flow`/`highlight` moving through `node`s; the three deletion cases as distinct restructurings.
5. **Graphs (DSA-11)** — BFS frontier spreading as `flow`; the `deque`-vs-list distinction made visible as ordered vs. mis-ordered expansion.

Lower priority (a simple highlight-overlay handles them; they're about invariants, not structural mutation): two-pointer beyond DSA-1, sliding window (DSA-2), prefix sum (DSA-4), binary search (DSA-6). DSA-0's memory/`__slots__` content is a measurement gate, not an animation target — skip it here.

---

## 10. File / folder structure

```
visual-dsa/
  CLAUDE.md                  # hard constraints (Section 1) + this plan's rules, top of file
  aesthetic/                 # the six reference images — visual evidence, inspected before design
    murmuration-whale.png
    ship-at-sea.png
    funnel-of-dots.png
    birds-over-building.png
    eggs-as-figure.png
    line-figure-icon.png
  .claude/
    agents/
      engine-architect.md         # Opus 5 (alias) · effort: high (FIXED)
      animation-builder.md        # Opus 4.6 (pinned) · effort: medium — default bounded structures
      animation-builder-hard.md   # Opus 4.8 (pinned) · effort: high — hashing, Timsort
      trace-wirer.md              # Sonnet 5 · effort: low
      correctness-reviewer.md     # Opus 4.6 (pinned) · effort: high, escalates to 4.8 / Opus 5
  src/
    engine/
      renderer.ts            # Canvas 2D behind one interface (WebGL seam)
      primitives.ts          # the 5 spatial primitives
      motions.ts             # settle, swap, flow
      trace.ts               # the state-trace format + player (step/play)
    tokens/
      tokens.ts              # palette, texture, easing — the ONLY place these live
    ui/
      controls.ts            # play/pause, step, reset, input box
      menu.ts                # structure picker
    structures/
      dynamic-array/
        trace.ts             # YOUR hand-written state trace
        view.ts              # structure-specific rendering (builder)
        config.ts            # wiring (wirer)
      hashing/
      sorting/
      ...
  index.html
  package.json
```

---

## 11. Sources rule (how the three inputs are used)

- **Curriculum** → *sequencing authority*, and the definition of the **gap this system fills**. Which structures, what order, what depth. Nothing gets built that the curriculum didn't gate on.
  **File: `reference/DSA + Backend in Python Plan.md`** (present). Two passes matter per structure: the gate definition (`### DSA-n:` — core topic, learning depth, what to study, implementation/diagnostic task, stopping rule) and the sources pass (`### DSA-n —`). Read *only* the relevant gate's sections; the file is ~154KB and must never be pulled in wholesale (Section 13).
- **Wengrow** → *rigor authority.* When an animation makes a claim about complexity or mechanics, Wengrow is the check. Where Grokking simplifies past correctness (it does, deliberately), Wengrow wins.
  **File: `reference/` — to be added before Phase 2.** Not present yet, and **Phase 1 does not block on it**: DSA-1 is built from standard dynamic-array semantics, aligned to the curriculum's depth and emphasis.
- **Grokking** → *visual sensibility.* Its friendly, hand-drawn register is a design reference for *what to draw and how it should feel* — not for scope, and not for reproduction.
  **Already covered by `aesthetic/`** — the six reference images are the operative visual evidence. No Grokking file is needed.
- **Consult one structure at a time, while building it.** Do not front-load a catalog of forty animation designs. Deciding how a specific structure should look is per-structure design work done when you reach it. This is also a context rule, not just a design rule — see Section 13.

Nothing from any book is scanned, traced, or reproduced. All animations are original.

---

## 12. Division of labor (summary)

| Work | Who | Model · Effort |
|---|---|---|
| Phase-1 engine, primitives, motions, tokens, trace-contract, renderer/API | Claude Code, Phase 1, serial | **Opus 5 · high (FIXED)** |
| Phase-1 control shell (step/play/input) | Claude Code, Phase 1 | **Opus 5 · high (FIXED)** |
| Phase-1 aesthetic study + DSA-1 reference animation | Claude Code, Phase 1 | **Opus 5 · high (FIXED)** |
| **State trace for each structure (the DSA content)** | **You, by hand** | — |
| Default structure view logic (heaps, trees, graphs, plain sort) | `animation-builder`, Phase 2 | Opus 4.6 (pinned) · medium |
| Difficult structure view logic (hashing probe/tombstone/rehash, Timsort runs) | `animation-builder-hard`, Phase 2 | Opus 4.8 (pinned) · high |
| Trace→object wiring, config/menu registration, test stubs | `trace-wirer`, Phase 2 | Sonnet 5 · low |
| Routine implementation review (architecture frozen) | `correctness-reviewer`, each gate | Opus 4.6 (pinned) · high |
| Substantial cross-cutting review | escalation | Opus 4.8 · high |
| Genuinely subtle algorithmic-correctness question | escalation | **Opus 5 via `/advisor` · high** (pass `--effort high`) |

---

## 13. Context-management protocol (persists into Phase 2)

Context is a managed resource, not an accident. These rules apply from Phase 1 onward and do not lapse when Phase 2 fans out.

**1. Isolation first.** Every build unit runs in its own subagent context. A subagent's full transcript is *never* pulled into the main session. Each returns exactly three things and nothing else:
- the file paths it wrote,
- a summary of **5 lines or fewer**,
- any flags or escalations.

The main session stays a coordinator. It holds the plan, the gate status, and the next action — not the working detail of any unit.

**2. State on disk, not in chat.** `STATE.md` at the repo root is updated at **every task boundary** with: current phase, gate status (open / frozen), frozen-API status, current structure and its correctness target, and the single next action. The source of truth is `STATE.md` + `BUILD_PLAN.md` + `CLAUDE.md` + the code — **never the conversation**. Anything that matters and lives only in chat is already lost.

**3. Compaction must be lossless.** `CLAUDE.md` carries a `## Compact Instructions` section listing what every compaction must preserve verbatim. Compaction is allowed to drop working detail; it is not allowed to drop the constraints, the frozen API, the tokens, the gate status, or the active correctness target.

**4. Triggers.**
- *Primary — task boundary.* When a sub-deliverable is done, or a structure is built and verified: write results → update `STATE.md` → reset the window (`/clear` when the next unit is independent, `/compact` when continuity matters within Phase 1's spine) → re-read `BUILD_PLAN.md`, `CLAUDE.md`, `STATE.md`.
- *Backstop — ~100k tokens.* If any single agent crosses roughly 100k tokens mid-task, checkpoint immediately: write progress **and a resume note** to `STATE.md`, then `/compact`.
- Reset at **task boundaries**, not mid-task. The 100k rule is a safety valve, not a schedule.

**5. Keep it lean.** `CLAUDE.md` stays short — constraints and compact rules only. Detail lives here in `BUILD_PLAN.md`. **Prefer a clean window over a compacted one:** `/clear` plus a re-read is more reliable than `/compact`, because re-reading reconstructs from source of truth while compaction summarizes from memory.

---

---

*The engine is built once by one mind. The grammar is signed off by you before anything scales. The algorithm content stays in your hands because encoding it is the learning. Everything else fans out only after there's a finished pattern to copy.*
