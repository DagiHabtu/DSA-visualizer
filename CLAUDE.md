PROJECT RULES

Thin engine, not a framework. The visual grammar is capped at 5 spatial primitives + 3 motions (Section 3). If a task seems to need a 6th primitive, that's a signal to stop and ask the human — not to add it. No plugin system, no config-driven animation DSL, no "generalized" anything.
Live code-editing is deferred. v1 supports: watch (play/pause), step forward/back, and type your own input. Editing the algorithm's code live and seeing it re-animate is a later phase with a clean seam left for it — not built now.
Local only. Runs in a browser on your machine with one command. No deployment, no accounts, no backend, no database.
Scope is set by the curriculum, not by the books. The curriculum decides which structures and what depth. Grokking and Wengrow inform how it looks and what's rigorous (Section 11) — they do not get to add structures the curriculum didn't gate on.
No fan-out before the reference animation is done (Section 7). This is the load-bearing rule.

## Compact Instructions

Any compaction of this project's context — automatic or `/compact` — MUST preserve the following **verbatim**. Working detail may be dropped; these may not.

1. **The five hard constraints** (PROJECT RULES above): thin engine / 5 primitives + 3 motions cap, live-editing deferred, local only, curriculum sets scope, no fan-out before Gate 1.
2. **The frozen engine API**: the exact signatures of the 5 spatial primitives and 3 motions, and the state-trace format.
3. **The aesthetic tokens**: the three levels (surface, composition, signature-emergence) and the palette.
4. **The current gate status**: open or frozen.
5. **The active structure's correctness target**.

Keep this file short. Detailed plan lives in BUILD_PLAN.md; live status lives in STATE.md.

After any compaction or context reset, re-read BUILD_PLAN.md and STATE.md before continuing.
