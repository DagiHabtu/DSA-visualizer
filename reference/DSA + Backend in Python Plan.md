# **Mastery\_Curriculum.md**

# **Competency-Driven Mastery Curriculum — V2**

### **Python DSA × Python/FastAPI Backend | Gate-Based Progression | Unified Language, Internals-First Rigor**

---

## **ARCHITECTURE OVERVIEW**

This is a full architectural migration, not a translation. V1 used Java for DSA specifically to force compile-time type discipline and expose a memory model Python doesn't show you by default. That discipline is not abandoned here — it is relocated. Where Java's compiler enforced rigor automatically, this version enforces it through three deliberate substitutes, applied at every gate without exception:

1. **Full type hints \+ `mypy --strict`, zero errors, on every implementation task in both tracks.** This is the direct replacement for Java's compile-time checking. Python will run your code whether or not the types are right; `mypy --strict` is the only mechanism restoring "wrong types don't get to run" as a gate condition.  
2. **Empirical verification via the standard profiling toolchain** (`sys.getsizeof`, `timeit`, `cProfile`, `dis`, and `memory_profiler`) wherever a stopping rule makes a claim about performance or memory. Claims about complexity or memory layout must be measured, not asserted.  
3. **Implementation-from-scratch before library use, at every gate**, exactly as in V1 — but the implementations are now built to match Python's *actual* internal algorithms (open-addressed hash tables, not Java-style chaining; array-of-blocks deques, not naive lists) rather than a copy of what Java happened to do.

The DAG below reflects a genuine re-sequencing, not a renumbering. Two changes are structural, not cosmetic:

* **DSA-0 grows** to cover the CPython object model, reference counting, the GIL, and the descriptor protocol — content Java's compiler made partially visible by construction and that Python hides entirely unless you go looking for it.  
* **A new gate, DSA-7 (Iterators, Generators & Frame Mechanics), is inserted immediately before Recursion.** A generator is a suspended stack frame you can inspect directly in Python. Understanding frame suspension here is the single highest-transfer concept available in the DSA track: it primes the call-stack mental model Recursion depends on, and it is the same mechanism `async def`/`await` in the Backend track is built from. This gate pays for itself twice.

Two tracks run concurrently after their respective prerequisites are met, exactly as in V1. Progress on one does not unlock gates on the other.

DSA TRACK (Python)  
─────────────────────────────────────────────────────────────────────────────  
\[DSA-0: CPython Object Model, Memory & Descriptors\]  
    │  
    ▼  
\[DSA-1: Dynamic Arrays & Two Pointers\] ──────────────────┐  
    │                                                      │  
    ▼                                                      ▼  
\[DSA-2: Sliding Window\]                        \[DSA-4: Prefix Sum\]  
    │                                                      │  
    └────────────────────┬───────────────────────────────────┘  
                         ▼  
              \[DSA-3: Hash-Based Structures\]  
                         │  
                         ▼  
              \[DSA-5: Sorting Algorithms & Timsort\]  
                         │  
                         ▼  
              \[DSA-6: Binary Search\]  
                         │  
                         ▼  
              \[DSA-7: Iterators, Generators & Frame Mechanics\]  
                         │  
                         ▼  
              \[DSA-8: Recursion & Backtracking\]  
                         │  
                         ▼  
              \[DSA-9: Trees (BT, BST, Traversals)\]  
                         │  
                         ▼  
              \[DSA-10: Heaps & Priority Queues\]  ◄── PROJECT 1 GATE  
                         │  
                         ▼  
              \[DSA-11: Graphs & Union-Find\]  
                         │  
                         ▼  
              \[DSA-12: Dynamic Programming\]

BACKEND TRACK (Python / FastAPI)  
─────────────────────────────────────────────────────────────────────────────  
\[BE-0: Python Internals for Backend — Types, Async, the GIL\]  
    │  
    ▼  
\[BE-1: FastAPI Core & Routing\]  
    │  
    ▼  
\[BE-2: Database Layer (PostgreSQL \+ SQLAlchemy \+ Alembic)\]  ◄── PROJECT 1 GATE  
    │  
    ▼  
\[BE-3: Layered Architecture (Controller/Service/Repository)\]  
    │  
    ▼  
\[BE-4: Testing (pytest, TestClient, Coverage)\]  
    │  
    ▼  
\[BE-5: Authentication (Basic JWT)\]  ◄── CAPSTONE GATE

**Project 1** unlocks after: DSA-10 AND BE-2 are both closed. **Capstone (Project 2\)** unlocks after: DSA-12 AND BE-5 are both closed.

**Gap this migration deliberately does not paper over:** removing Java means removing the automatic memory-layout visibility that `int[]` vs `Integer[]` gave you for free. DSA-0's `__slots__`\-vs-`__dict__` measurement task exists specifically to replace that lost visibility with an equivalent, Python-native one — measured, not assumed.

---

## **PART 1 — DSA PROGRESSION GATES (Python)**

### **DSA-0: CPython Object Model, Memory Mechanics & the Descriptor Protocol**

**Core Topic:** How CPython actually stores objects and resolves attribute access — reference counting, the cyclic garbage collector, the descriptor protocol, and the GIL.

**Learning Depth:** Implementation

**What to Study:** Identity (`is`) vs. equality (`==`); mutable vs. immutable types and the classic mutable-default-argument aliasing bug; reference counting as CPython's primary memory reclamation mechanism, and the supplementary cyclic garbage collector (`gc` module) that exists specifically because refcounting alone cannot free reference cycles. The descriptor protocol underlying `@property`, `@classmethod`, and `@staticmethod` — and the fact that a normal object's instance attributes are backed by a per-instance `__dict__`, which is itself a hash table (this foreshadows DSA-3 directly). `__slots__` as a fixed-layout alternative that removes the per-instance `__dict__` in exchange for memory savings and the loss of dynamic attribute assignment. The GIL: what invariant it protects (refcount consistency across threads), and its direct consequence — pure-Python threads do not parallelize CPU-bound work, only I/O-bound waiting.

**Implementation / Diagnostic Task:**

1. Write a script that instantiates ≥1000 objects of a plain class with 3 attributes, and ≥1000 objects of a `__slots__`\-based class with the same 3 attributes. Measure aggregate memory with `sys.getsizeof` (per-instance plus, where relevant, the `__dict__` each plain instance carries) and report the total byte delta.  
2. Construct two objects that reference each other, creating a reference cycle unreachable from any other root. Prove refcounting alone does not reclaim it (the objects persist after deleting your only external references), then use `gc.collect()` and show it returns a nonzero count of collected objects.  
3. Use `timeit` to benchmark list `.append()` across increasing N and confirm the cost stays flat (amortized O(1)) rather than growing.  
4. Use `cProfile` on a small multi-function script and identify the single hottest function by cumulative time.

**Stopping Rule:** The `__slots__` comparison script reports a positive aggregate byte delta across ≥1000 instances. The reference-cycle script demonstrates a cycle invisible to refcounting and shows `gc.collect()` reclaiming a nonzero count. You can explain, verbally, in under 90 seconds and without notes, why normal attribute access goes through a per-instance `__dict__` and how `__slots__` bypasses it. All four scripts are fully type-hinted and pass `mypy --strict` with zero errors. All claims are backed by ≥6 total pytest assertions across the four scripts — not printed output alone.

**Justification:** Every later gate implements a data structure on top of Python's actual object model. Treating objects, references, and the GIL as invisible plumbing reproduces exactly the "why is this O(1)?" black-box confusion the original Java track's DSA-0 existed to prevent — just at a different layer, since Python's compiler gives you none of the free visibility Java's stricter type system did.

---

### **DSA-1: Dynamic Arrays & Two Pointers**

**Core Topic:** How Python's `list` grows internally, index arithmetic, in-place mutation, and the two-pointer family of techniques.

**Learning Depth:** Interview

**What to Study:** Python's `list` is a dynamic array that over-allocates on growth — appending is amortized O(1), not O(1) per call, because the underlying buffer resizes by more than one slot when it fills. `list.insert(0, x)` and `list.pop(0)` are O(n) because every remaining element shifts; this is the specific, common bug that makes `collections.deque` the correct choice for queue-like access patterns, introduced here and enforced later at DSA-11's BFS implementation. Opposite-end two-pointer convergence on a sorted list; fast-slow pointer technique for singly linked structures (built here as your own `Node`/`LinkedList` classes — Python has no build-in singly linked list type, so unlike the V1 Java track there is no Translation Bridge needed: you write the node class once, from scratch, and it is exactly what every later linked-list problem uses).

**Implementation / Diagnostic Task:** Build your own `DynamicArray` class from scratch, backed by a fixed-size Python list you manage manually (pretend `list.append` doesn't exist), implementing a doubling growth strategy. Then use `sys.getsizeof` to empirically map at least 10 real reallocation points of a genuine Python `list` as you append one element at a time, and compare the observed growth pattern to your own doubling strategy. State, based on the measurement (not on memorized internals), whether real Python lists over-allocate more or less aggressively than pure doubling, and explain why a smaller-than-2x growth factor still yields amortized O(1) append.

**Problems (solve in Python, fully type-hinted, no hints, within 25 minutes each):**

* LC \#167 — Two Sum II (opposite-end, sorted array)  
* LC \#15 — 3Sum (sort \+ two-pointer, handle duplicates)  
* LC \#11 — Container With Most Water (opposite-end, greedy elimination)  
* LC \#141 — Linked List Cycle (fast-slow pointer, on your own `Node` class)  
* LC \#19 — Remove Nth Node From End of List (fast-slow with gap, on your own `Node` class)

**Stopping Rule:** All five problems: first accepted submission is the optimal time and space solution, average solve time ≤25 minutes, fully type-hinted, zero `mypy --strict` errors. You can state the loop invariant for each solution in one sentence before writing code. Your `DynamicArray`'s growth strategy is implemented and its behavior compared in writing (2–3 sentences) against your empirical measurement of real `list` growth. If 3Sum takes longer than 35 minutes, the duplicate-skipping logic is the diagnostic — redo it until automatic.

**Justification:** Two pointers is the highest-frequency pattern for reducing O(n²) array solutions to O(n), and is the mechanical prerequisite for sliding window. The `DynamicArray` task replaces Java's `ArrayList`\-doubling folklore with an empirically verified, Python-accurate account of the same idea — measurement over memorized formula, since exact CPython growth constants are an implementation detail not worth memorizing but very much worth discovering.

---

### **DSA-2: Sliding Window**

**Core Topic:** Fixed-size and variable-size window patterns on arrays and strings.

**Learning Depth:** Interview

**What to Study:** Fixed window: maintain aggregate, subtract outgoing element, add incoming element, O(n). Variable window: expand right pointer, shrink left pointer when a constraint is violated. The governing question for any variable window: "what condition forces the left pointer to move?" — answer this before coding. Distinguish "at most K distinct" (shrink when \> K) from "exactly K distinct" (at-most-K minus at-most-(K−1)).

**Problems (solve in Python, no hints, within 30 minutes each):**

* LC \#643 — Maximum Average Subarray I (fixed window warm-up)  
* LC \#3 — Longest Substring Without Repeating Characters (variable, set)  
* LC \#424 — Longest Repeating Character Replacement (variable, frequency dict)  
* LC \#76 — Minimum Window Substring (variable, two frequency dicts)

**Stopping Rule:** All four problems at optimal complexity on first accepted submission, fully type-hinted, zero `mypy --strict` errors. LC \#76 is the gate keeper — if you cannot solve Minimum Window Substring in under 35 minutes without hints, the window-contraction logic is not internalized. Solve it within that bound before advancing.

**Justification:** Sliding window converts a class of O(n²) substring/subarray problems to O(n); the variable-window pattern recurs directly in Project 1's rate-limiter, now implemented natively in the same language you learned the pattern in — no port required.

---

### **DSA-3: Hash-Based Structures**

**Core Topic:** How CPython's `dict` and `set` actually work — open addressing with pseudo-random probing, not chaining — and the frequency-counting / complement-lookup pattern family.

**Learning Depth:** Implementation \+ Interview

**What to Study:** CPython's `dict` does **not** use chaining (an array of linked lists) — it uses open addressing: a sparse table of slots, each holding an index into a dense array of key/hash/value triples, with collisions resolved by a pseudo-random probing sequence derived from the hash. Since Python 3.6/3.7 this split (sparse index table \+ dense entry array) is also why dicts preserve insertion order as a side effect of the memory layout, not as an explicit design goal bolted on afterward. Deletion in an open-addressed table requires tombstones, not simple removal, because probing sequences depend on intermediate slots staying "occupied-looking." The complement-lookup pattern: store what you've seen, look for what you need, turning O(n²) nested loops into O(n).

**Implementation Task:** Build a `HashMap[K, V]` from scratch using **open addressing with tombstone deletion** — not chaining. Implement `put`, `get`, `delete`, `__contains__`, and automatic resize-and-rehash at a load factor of 0.75. Write ≥15 pytest assertions, including a deliberate collision case (choose keys you know hash to the same bucket under your reduced table size), a deletion-then-lookup case that proves tombstones work correctly, and a resize case. Fully type-hinted, zero `mypy --strict` errors.

**Problems (solve in Python, no hints, within 30 minutes each):**

* LC \#1 — Two Sum (complement lookup, warm-up)  
* LC \#49 — Group Anagrams (frequency signature as key)  
* LC \#347 — Top K Frequent Elements (frequency dict \+ partial sort or heap)  
* LC \#128 — Longest Consecutive Sequence (set membership, O(n) with smart iteration)

**Stopping Rule:** HashMap implementation passes all ≥15 assertions and you can draw the sparse-index/dense-entry split with one collision and one tombstone example on paper. All four LeetCode problems solved at optimal complexity within time bounds. LC \#128 is the gate keeper: the O(n) solution requires a specific set-membership insight; a sorting-based solution is O(n log n) and fails this gate — redo it.

**Justification:** `dict`/`set` are the highest-ROI data structures in the language; building the actual open-addressed version — not a copy of Java's chaining design — removes the black box correctly instead of teaching a plausible-looking but architecturally wrong mental model.

---

### **DSA-4: Prefix Sum**

**Core Topic:** Precomputed cumulative sums for O(1) range queries; prefix sum combined with a hash map for subarray-sum problems.

**Learning Depth:** Interview

**What to Study:** Prefix array construction: `prefix[i] = prefix[i-1] + nums[i]`. Range sum via `sum(i, j) = prefix[j] - prefix[i-1]`. The subarray-sum-equals-K pattern: rather than O(n²) brute force, maintain a dict mapping `prefixSum → count`. The modular-arithmetic extension for divisibility variants.

**This gate unlocks immediately after DSA-1 closes** — you do not need to wait for DSA-2 or DSA-3. Run it in parallel with DSA-2: once DSA-1 passes, use DSA-2 as your primary problem-solving block and slot DSA-4 problems into your retrieval-practice block. They are independent and non-competing.

**Problems (solve in Python, no hints, within 25 minutes each):**

* LC \#303 — Range Sum Query (static prefix array, warm-up)  
* LC \#560 — Subarray Sum Equals K (prefix sum \+ dict)  
* LC \#974 — Subarray Sums Divisible by K (prefix sum \+ modular arithmetic)  
* LC \#238 — Product of Array Except Self (prefix \+ suffix product, no division, O(1) extra space)

**Stopping Rule:** All four at optimal complexity within time bounds, fully type-hinted, zero `mypy --strict` errors. LC \#238 is the gate keeper: the O(1)-extra-space solution requires using the output list itself as the running prefix — two extra arrays is a suboptimal solve. Redo it.

**Justification:** Prefix sum is the precomputation primitive behind 2D DP and matrix problems; LC \#560's dict combination is a direct analog of DSA-3's complement-lookup pattern, reinforcing that gate rather than introducing isolated knowledge.

---

### **DSA-5: Sorting Algorithms & Timsort**

**Core Topic:** Comparison-based sorting (merge, quick), sort stability, and Timsort — the adaptive, real-world algorithm behind Python's `sorted()`/`list.sort()`.

**Learning Depth:** Implementation

**What to Study:** Merge sort: divide at midpoint, merge two sorted halves, O(n log n) guaranteed, O(n) space, stable. Quicksort: partition around a pivot, O(n log n) average, O(n²) worst case, randomize the pivot to avoid the adversarial case. Timsort — Python's actual built-in sort — is a hybrid, adaptive algorithm: it detects already-ordered "runs" in the input and merges them using insertion sort for small runs and merge sort for combining runs, which is why it is dramatically faster than a generic merge sort on partially-sorted real-world data. This adaptiveness is a genuine, measurable property, not folklore — you will measure it directly rather than take it on faith.

**Implementation Task:** Implement merge sort and randomized quicksort on a Python `list[int]`. Write ≥10 pytest tests covering empty, single-element, sorted, reverse-sorted, and duplicate-heavy inputs — all passing, fully type-hinted, zero `mypy --strict` errors. Then, using `timeit`, benchmark your own merge sort against Python's built-in `sorted()` across three input shapes of the same size: random, already-sorted, and reverse-sorted. Report the measured timing ratio for each shape and explain, from the measurement, why Timsort's adaptiveness produces a large speed gap on the sorted/reverse-sorted cases that your non-adaptive merge sort does not show.

**Problems (solve in Python, within 25 minutes each):**

* LC \#912 — Sort an Array (using your own merge sort, not `sorted()`)  
* LC \#56 — Merge Intervals (sort by start time, then greedy merge)  
* LC \#179 — Largest Number (custom comparator via `functools.cmp_to_key`, string-concatenation comparison)

**Stopping Rule:** Both implementations pass all ≥10 tests. You can state the recurrence T(n) \= 2T(n/2) \+ O(n) and derive O(n log n) from it in under 2 minutes. The three-input-shape timing comparison is run and its output committed as part of your solution, with a written 2–3 sentence explanation of the adaptiveness gap. All three LeetCode problems at optimal complexity. LC \#179 is the gate keeper: the comparator `lambda a, b: (b+a > a+b) - (b+a < a+b)` (or equivalent) is non-obvious and tests whether you understand ordering contracts deeply enough to compose them with string logic.

**Justification:** Sorting underlies binary search's precondition and greedy algorithms' locally-optimal ordering step. Measuring Timsort's real adaptiveness — rather than asserting "Python's sort is fast" as received wisdom — is exactly the mechanism-first standard this migration is optimizing for.

---

### **DSA-6: Binary Search**

**Core Topic:** Classic binary search on sorted sequences; binary search on the answer space.

**Learning Depth:** Interview

**What to Study:** Invariant template: `lo = 0, hi = n-1`, exit when `lo > hi`, `mid = (lo + hi) // 2` (Python integers don't overflow, so the Java-specific `lo + (hi - lo) // 2` overflow-avoidance idiom is not required here — note this explicitly as one place Python is strictly simpler than the language this curriculum used to teach). Three variants: exact target, leftmost occurrence, rightmost occurrence. Answer-space binary search: when the problem asks "find the minimum X such that condition(X) holds" and condition is monotonic, binary search directly over X.

**Diagnostic Task:** Read the standard library's `bisect` module source (`bisect.py` — a pure-Python reference implementation ships alongside the C-accelerated version and is directly readable, unlike `dict`/`list` internals which are C-only). Compare `bisect_left`'s loop invariant to your own leftmost-occurrence implementation and write 2–3 sentences on where they match and where they diverge.

**Problems (solve in Python, no hints, within 25 minutes each):**

* LC \#704 — Binary Search (exact target, warm-up)  
* LC \#33 — Search in Rotated Sorted Array (determine which half is sorted, single pass)  
* LC \#153 — Find Minimum in Rotated Sorted Array (invariant: minimum lies in the unsorted half)  
* LC \#1011 — Capacity to Ship Packages Within D Days (answer-space binary search)  
* LC \#410 — Split Array Largest Sum (answer-space, structurally identical to \#1011)

**Stopping Rule:** All five at optimal O(log n) complexity within time bounds, fully type-hinted, zero `mypy --strict` errors. LC \#33 must use a single binary search pass, not rotation-point-then-search. The `bisect.py` comparison is written and submitted. LC \#410 is the gate keeper: you must be able to state the structural mapping between \#410 and \#1011 before advancing.

**Justification:** Answer-space binary search is where the technique becomes a design tool for optimization problems rather than a lookup function; reading `bisect.py` is a uniquely Python-native opportunity (no C-source-reading required) to verify your own invariant against a production reference implementation.

---

### **DSA-7: Iterators, Generators & Frame Mechanics**

**Core Topic:** The iterator protocol (`__iter__`/`__next__`), generator functions and `yield`, and what a generator frame actually is: a suspended stack frame you can inspect, pause, and resume.

**Learning Depth:** Implementation \+ Interview

**What to Study:** The iterator protocol as a contract: any object implementing `__iter__` (returning an iterator) and `__next__` (raising `StopIteration` when exhausted) works with `for`, `list()`, unpacking, and every other iteration context in the language. A generator function (using `yield`) is syntactic sugar that builds an object implementing this protocol automatically, backed by a genuine suspended stack frame — local variables, instruction pointer, and all — that persists between calls to `next()`. This is not a metaphor: `dis.dis` on a generator function shows real bytecode with explicit suspend/resume instructions, and this is the exact mechanism a coroutine (`async def`) is built from at a lower level — understanding generator frame suspension here is what makes `await` in the Backend track legible as a mechanism instead of magic. Lazy evaluation as the practical payoff: a generator computes values on demand instead of materializing a full sequence in memory.

**Implementation Task:** Implement a custom iterator class from scratch (`__iter__`/`__next__`) for a simple range-like object, without using `yield`. Then implement the same behavior as a generator function and compare the two implementations directly — state in 2–3 sentences what the generator syntax does for you that you had to write by hand in the class version. Use `dis.dis` on your generator function and identify the bytecode instruction responsible for suspension. Write a generator-based lazy prefix-sum stream that never materializes the full input in memory, and verify with `sys.getsizeof` that the generator object itself stays small regardless of the logical stream length.

**Problems (solve in Python, no hints, within 30 minutes each):**

* LC \#341 — Flatten Nested List Iterator (custom iterator design over a recursive structure)  
* LC \#284 — Peeking Iterator (wrapping an existing iterator to add lookahead without breaking the protocol)

**Stopping Rule:** Both problems solved as genuine iterator-protocol implementations (not by materializing the full result upfront and returning a list masquerading as an iterator). The class-based and generator-based range implementations both pass ≥8 pytest assertions each, fully type-hinted, zero `mypy --strict` errors. The `dis.dis` output is captured and the suspension instruction identified in writing. The lazy prefix-sum stream's memory footprint is verified with `sys.getsizeof` to stay constant as the logical stream length grows.

**Justification:** This gate has the highest transfer coefficient in the DSA track. It primes the "suspended stack frame" mental model Recursion (DSA-8) depends on immediately, and it is the direct conceptual ancestor of `async def`/`await` in BE-0 and BE-1 — one gate, two future payoffs, exactly the multiplier the redesign is optimizing for.

---

### **DSA-8: Recursion & Backtracking**

**Core Topic:** Recursive decomposition, the call stack as explicit state, the backtracking template (choose → explore → unchoose), and Python's specific recursion-depth constraints.

**Learning Depth:** Interview

**What to Study:** The call stack as explicit state — every recursive call pushes a frame (you just spent DSA-7 inspecting exactly this object), every return pops it. Recursion tree visualization: draw it for small inputs before coding. Backtracking template: add to path, recurse, remove from path. Pruning: eliminate branches by checking constraints before recursing. **Python-specific and load-bearing:** CPython has no tail-call optimization — this is a permanent language design decision, not a missing feature — and a default recursion limit (`sys.getrecursionlimit()`, typically 1000\) enforced via `RecursionError`. Raising the limit with `sys.setrecursionlimit()` does not raise the underlying OS thread stack size, so overly deep recursion after raising the Python-level limit can crash the interpreter instead of raising a catchable exception. The practical consequence: unbounded or very deep recursion is a Python-specific code smell in a way it is not in languages with larger default stacks, and this is precisely why DSA-11's graph traversals are required iteratively with an explicit stack, not recursively.

**Pre-coding Ritual (required for this gate):** Draw the recursion tree for a three-element input on paper before writing any code for each problem. Define what is in `path` at each node and what the base case looks like.

**Problems (solve in Python, no hints, within 35 minutes each):**

* LC \#78 — Subsets (clean enumeration template)  
* LC \#46 — Permutations (visited set, order matters)  
* LC \#39 — Combination Sum (reusable candidates, pruning on sum \> target)  
* LC \#40 — Combination Sum II (candidates not reusable, duplicate skipping required)  
* LC \#51 — N-Queens (row/column/diagonal constraint sets)

**Stopping Rule:** All five solved with the recursion tree drawn on paper first — non-negotiable, this is the diagnostic. LC \#40's duplicate-skipping (`if i > start and candidates[i] == candidates[i-1]: continue`) must be present, and you must explain in one sentence why `i > start` rather than `i > 0`. You must state, from memory, `sys.getrecursionlimit()`'s default value and the distinction between raising it safely vs. risking a segfault. **N-Queens (LC \#51) uses a 55-minute bound, not the general 35-minute gate bound** — it is Hard-classified, and a 35-minute ceiling at this stage produces a demoralizing failure rather than a calibrating one; the row/column/diagonal-set insight is the learning target, not speed. Solve it once within 55 minutes, then log it for a timed re-attempt during weekly review. All solutions fully type-hinted, zero `mypy --strict` errors.

**Justification:** Backtracking is the mechanical foundation of DFS on trees and graphs. The Python-specific recursion-depth ceiling is a genuine engineering constraint this curriculum would be dishonest to skip — it directly justifies DSA-11's iterative-DFS requirement rather than that requirement appearing as an arbitrary rule.

---

### **DSA-9: Trees (Binary Tree, BST, All Traversals)**

**Core Topic:** Binary tree structure, all four traversals (recursive and iterative), BST invariant and mutation, and memory-layout optimization via `__slots__`.

**Learning Depth:** Implementation \+ Interview

**What to Study:** BST invariant: left subtree strictly less, right subtree strictly greater. Insertion, deletion (three cases — leaf, one child, two children via in-order successor), search. In-order traversal of a BST yields sorted output. Iterative traversal using an explicit stack (do not skip — tested directly). Level-order traversal via a queue. Key patterns: height, diameter, LCA, path sum, symmetric tree. **Direct callback to DSA-0:** define your `Node` class with `__slots__` and empirically re-run the memory comparison from DSA-0 against an equivalent `Node` class without `__slots__`, across a tree of at least 500 nodes — quantify the aggregate savings on a structure you're actually using, not a toy example.

**Implementation Task:** Build a `BST` class (generic over any `Comparable`\-like key using Python's `typing.Protocol` with a `__lt__` requirement, or simple key comparison) with `insert`, `delete` (all three cases), `search`, `in_order`, `pre_order`, `post_order`, `level_order`. Implement both recursive and iterative in-order traversal. Write ≥15 pytest tests including delete-with-two-children and traversal ordering, fully type-hinted, zero `mypy --strict` errors.

**Problems (solve in Python, no hints):**

* LC \#104 — Maximum Depth (DFS, ≤15 min)  
* LC \#226 — Invert Binary Tree (recursive, ≤15 min)  
* LC \#102 — Binary Tree Level Order Traversal (BFS with a queue, ≤20 min)  
* LC \#235 — Lowest Common Ancestor of BST (BST invariant, ≤20 min)  
* LC \#98 — Validate Binary Search Tree (in-order must be strictly increasing, ≤25 min)  
* LC \#124 — Binary Tree Maximum Path Sum (post-order, ≤35 min)

**Stopping Rule:** BST implementation passes all ≥15 tests including two-child deletion. All six problems solved at optimal complexity. LC \#124 is the gate keeper: the solution requires returning the single-path maximum upward while tracking the through-path maximum in a separate variable — two independent full-tree passes is O(n²) and fails this gate. The `__slots__` memory comparison on your actual ≥500-node tree is run and its aggregate savings reported in writing.

**Justification:** Trees underlie heaps, tries, and graphs-as-DAGs. There is no Translation Bridge apparatus needed here at all — the single largest structural simplification this migration produces, since there is no foreign-language pointer syntax standing between you and the implementation.

---

### **DSA-10: Heaps & Priority Queues**

**Core Topic:** Binary heap structure via `heapq`, heapify-up/down, top-K patterns, and the two-heap technique for dynamic medians.

**Learning Depth:** Implementation \+ Interview

**What to Study:** A binary heap is a complete binary tree stored in a flat list — parent of index `i` at `(i-1)//2`, children at `2i+1` and `2i+2`. `heapq` is min-heap only and operates on a plain list via free functions (`heapq.heappush`, `heapq.heappop`), not a class — for a max-heap, negate values or push tuples with a negated priority. Top-K: maintain a min-heap of size K, pop-and-push when a new element exceeds the current minimum. Two-heap technique for sliding medians: max-heap for the lower half, min-heap for the upper half, sizes balanced within one.

**Diagnostic Task:** Read `heapq.py`'s pure-Python `_siftup`/`_siftdown` source directly (a genuine, readable reference implementation ships in the standard library) after building your own `MinHeap` from scratch, and write 2–3 sentences comparing your sift-down implementation to CPython's.

**Implementation Task:** Build `MinHeap` from scratch backed by a plain `list[int]`: `insert`, `extract_min`, `peek`, and `heapify(arr: list[int])` using O(n) sift-down — not repeated insertion. Write ≥12 pytest tests including heapify on a reverse-sorted input and extract-all producing sorted output.

**Problems (solve in Python, no hints):**

* LC \#215 — Kth Largest Element (min-heap of size K, ≤20 min)  
* LC \#347 — Top K Frequent Elements (frequency dict \+ heap, not full sort, ≤25 min)  
* LC \#373 — Find K Pairs with Smallest Sums (min-heap, ≤30 min)  
* LC \#295 — Find Median from Data Stream (two-heap technique, ≤35 min)

**Stopping Rule:** MinHeap passes all ≥12 tests; `heapify` runs in O(n) — repeated insertion is O(n log n) and fails this gate. The `heapq.py` source comparison is written and submitted. All four problems at optimal complexity. LC \#295 is the gate keeper and the conceptual anchor for Project 1 — you must explain, verbally, the invariant "lower-half max-heap size equals upper-half min-heap size, ±1" before this gate is considered valid.

**Justification:** The heap is the implementation engine of Dijkstra's algorithm and the design anchor of Project 1\. Reading `heapq.py` is a genuine Python-native advantage over the V1 Java track: CPython's own reference implementation is directly legible, where the JVM's internal `PriorityQueue` implementation was not something V1 ever asked you to read.

---

**◄ PROJECT 1 GATE: Unlock after DSA-10 AND BE-2 are both closed ►**

---

### **DSA-11: Graphs & Union-Find**

**Core Topic:** Graph representations, BFS/DFS, Union-Find, Dijkstra's algorithm, topological sort — all enforced with the correct Python container choices.

**Learning Depth:** Implementation \+ Interview

**What to Study:** Adjacency list via `dict[int, list[int]]`. BFS with a visited set — **must use `collections.deque` as the queue, never a plain list with `pop(0)`**, which is O(n) per operation and silently degrades BFS to O(V²) in the worst case; this is the direct payoff of the deque-vs-list contrast introduced back in DSA-1. DFS iterative using an explicit stack (a plain `list` is correct here — `append`/`pop` from the end are both O(1)), and recursive — bounded by DSA-8's recursion-depth ceiling, which is a real constraint on how deep an unbalanced graph's DFS can safely go before `RecursionError` or worse. Cycle detection in directed graphs via three-color marking. Union-Find with path compression and union by rank. Topological sort: Kahn's algorithm (BFS \+ in-degree array) and DFS-based (post-order). Dijkstra: min-heap \+ distance array, O((V+E) log V).

**Implementation Tasks:**

1. `UnionFind` with path compression and union by rank. ≥8 pytest tests.  
2. BFS and DFS, both iterative, on an adjacency-list graph. ≥8 pytest tests including a disconnected graph. **The BFS implementation's queue must literally be a `collections.deque`, and a pytest assertion or code comment must justify why, referencing the O(n) `list.pop(0)` cost.**

**Problems (solve in Python, no hints):**

* LC \#200 — Number of Islands (DFS/BFS on implicit grid graph, ≤25 min)  
* LC \#133 — Clone Graph (BFS \+ dict for node mapping, ≤25 min)  
* LC \#207 — Course Schedule (3-color cycle detection, ≤30 min)  
* LC \#417 — Pacific Atlantic Water Flow (reverse BFS from both oceans, ≤35 min)  
* LC \#743 — Network Delay Time (Dijkstra with `heapq`, ≤35 min)  
* LC \#269 — Alien Dictionary (topological sort from character-ordering constraints, ≤40 min)

**Stopping Rule:** Both implementations pass their tests, with the deque-based BFS requirement satisfied and justified in writing. All six problems at optimal complexity. LC \#269 is the gate keeper: your adjacency list must be built correctly from adjacent-word comparisons, topological sort run, and the cycle case handled — a solution that fails on `["z","x","z"]` has incomplete cycle detection. LC \#743 must use `heapq`, not Bellman-Ford.

**Justification:** Graphs generalize trees; topological sort is the algorithmic foundation of dependency resolution, mapping directly onto the Capstone's job-application status pipeline. The enforced `deque` requirement converts DSA-1's throwaway "here's why this matters" note into a graded, load-bearing engineering decision.

---

### **DSA-12: Dynamic Programming**

**Core Topic:** Memoization (top-down), tabulation (bottom-up), state definition, transition function, space optimization.

**Learning Depth:** Interview

**What to Study:** DP is recursion with memory — and recursion here means the exact call-stack model from DSA-8, applied with a cache. The four questions before writing any DP: what is the state, what is the base case, what is the transition, what is the answer in terms of states. 1D patterns (house robber, climb stairs, LIS). 2D patterns (LCS, edit distance, unique paths). Knapsack: 0/1 with a 2D table, space-optimized to 1D by iterating backwards.

**Required Protocol:** Write the recurrence relation on paper before opening an editor, for every problem.

**Problems (solve in Python, no hints, memoization \+ tabulation for each):**

* LC \#70 — Climbing Stairs (1D, warm-up, ≤15 min)  
* LC \#198 — House Robber (1D, no-adjacent constraint, ≤20 min)  
* LC \#300 — Longest Increasing Subsequence (1D, O(n²) form, ≤30 min)  
* LC \#1143 — Longest Common Subsequence (2D, two-sequence, ≤30 min)  
* LC \#72 — Edit Distance (2D, three transitions, ≤35 min)  
* LC \#322 — Coin Change (unbounded knapsack variant, ≤30 min)  
* LC \#416 — Partition Equal Subset Sum (0/1 knapsack, ≤35 min)

**Stopping Rule:** Every problem solved in both memoized and tabulated forms, fully type-hinted, zero `mypy --strict` errors. The recurrence written on paper before coding is mandatory. LC \#72 is the gate keeper: the three-transition recurrence must be derived by you from first principles and proven by hand on a 3×3 grid — a memorized-but-unreconstructed recurrence does not satisfy this gate.

**Justification:** DP requires recursion (DSA-8), array/dict manipulation (DSA-1 through DSA-4), and the capacity to define abstract state. It is last because it collapses into confusion without every preceding gate being solid — this dependency was never Java-specific and is fully preserved.

---

## **PART 2 — BACKEND PROGRESSION GATES (Python / FastAPI)**

### **BE-0: Python Internals for Backend — Types, Async, and the GIL in Practice**

**Core Topic:** Production-grade type hints, Pydantic's validation model, asyncio's concurrency model, and the GIL's concrete consequence for choosing between threads, processes, and async I/O.

**Learning Depth:** Implementation

**What to Study:** Type hints: `str`, `int`, `Optional[T]`/`T | None`, `Union`, `list[T]`, `dict[K, V]`. Pydantic v2: `BaseModel`, `Field` constraints (`ge`, `le`, `min_length`), nested models, discriminated unions, custom `@field_validator`. `asyncio`: the event loop, coroutines vs. plain functions, `await`, `asyncio.gather` for concurrent I/O-bound work — and, directly reinforcing DSA-7, that a coroutine is mechanically a specialized generator-derived object: suspension and resumption of a frame, exactly what you inspected with `dis` two gates ago, now applied to I/O waiting instead of lazy value production. **The GIL's concrete backend consequence:** threads do not parallelize CPU-bound Python code (DSA-0 established why); `asyncio` buys concurrency for I/O-bound waiting specifically, not CPU parallelism — CPU-bound work needs `multiprocessing` or an external process, not more `async def`.

**Diagnostic Task:** Write a short benchmark script with a genuinely CPU-bound function (e.g., a tight numeric loop) and a genuinely I/O-bound function (e.g., `time.sleep` standing in for a network call). Run the CPU-bound function across multiple `threading.Thread`s and confirm, via `timeit`, that wall-clock time does not improve over a single thread. Run the same CPU-bound function across multiple `multiprocessing.Process`es and confirm it does improve. Run the I/O-bound function across multiple threads and confirm it does improve. Write 3–4 sentences connecting this measured result to why FastAPI defaults to `async def` for I/O-bound routes.

**Stopping Rule:** Write a Pydantic `ApplicationForm` model with a nested `Address` model, a discriminated union `ContactMethod` (email or phone, distinct required fields each), a custom validator rejecting empty-after-strip strings, and an integer field bounded 1–100 inclusive. `mypy --strict`: zero errors. Write an async `fetch_all(urls: list[str])` using `asyncio.gather` returning results in input order, plus a synchronous wrapper — both fully type-hinted, zero `mypy --strict` errors. The GIL benchmark script is run, its three results (threads-CPU-bound flat, processes-CPU-bound improved, threads-I/O-bound improved) captured, and the written connection to FastAPI's async default submitted. Read the `typing.Protocol` documentation and write one practice `Protocol` interface from scratch (e.g., `Repository` with a `get_by_id` method) — this is the final item before the gate is closed; BE-3 requires this concept cold.

**Justification:** FastAPI is built on Pydantic and Starlette's async model; a shallow grasp of either produces validation surprises and concurrency misconceptions that are painful to debug once BE-2 adds a database underneath. The GIL benchmark converts DSA-0's abstract GIL explanation into a measured, backend-relevant engineering decision instead of two disconnected facts.

---

### **BE-1: FastAPI Core & Routing**

**Core Topic:** Route definition, path/query parameters, Pydantic request/response models, dependency injection, middleware, structured error handling.

**Learning Depth:** Implementation

**What to Study:** `@app.get/post/put/delete`. Path parameters (`/items/{item_id}`), query parameters with defaults. Pydantic for both request body and response shape (never return your internal model directly). `HTTPException` and `@app.exception_handler` for structured errors. `Depends()` for dependency injection. `APIRouter` for multi-file route splitting. Middleware via `@app.middleware("http")`.

**What to Build:** A fully in-memory Task CRUD API. `Task`: `id` (uuid4), `title`, `description`, `status` (enum: todo/in\_progress/done), `created_at`. Endpoints: `POST /tasks`, `GET /tasks` (query params `status`, `limit`), `GET /tasks/{id}`, `PUT /tasks/{id}`, `DELETE /tasks/{id}`. Separate input/output Pydantic models on every endpoint. A custom exception handler returning `{"error": "...", "code": ...}` JSON. Middleware injecting `X-Request-Duration-Ms`. In-memory dict storage — no database yet.

**Stopping Rule:** All five endpoints verified via pytest. A wrong-typed request body returns HTTP 422 with structured validation errors, not a 500\. A non-existent task returns HTTP 404 in your custom format. `X-Request-Duration-Ms` present on every response. `mypy --strict` across the codebase: zero errors. `id` must be `uuid4`, never an integer counter.

**Justification:** In-memory storage forces the service layer cleanly apart from data access before a database exists, so BE-2's layering transition is coherent rather than a rewrite.

---

### **BE-2: Database Layer (PostgreSQL \+ SQLAlchemy 2.0 \+ Alembic)**

**Core Topic:** SQLAlchemy ORM model definition and queries, Alembic migrations, the repository pattern, and query-performance profiling.

**Learning Depth:** Implementation

**What to Study:** SQLAlchemy 2.0 style: `DeclarativeBase`, `Mapped[T]`, `mapped_column`, `relationship`. Session-as-dependency (`Depends(get_db)`). One-to-many relationships with `back_populates`. Alembic: `alembic init`, `alembic revision --autogenerate`, `alembic upgrade head`. Repository pattern: a `TaskRepository` exposing `create`/`get_by_id`/`list_all`/`update`/`delete`, with zero FastAPI or business logic inside it. **New, mechanism-first addition:** the N+1 query problem — a naive relationship-loading implementation issues one query per parent row plus one query per child lookup, invisible in code review but visible under `cProfile`/SQL-echo logging as N nearly-identical queries where one JOIN-based query would do.

**What to Build:** Migrate the Task API to PostgreSQL. Add a `User` model (id, email, hashed\_password, created\_at) with a one-to-many relationship to `Task`. Implement `UserRepository` and `TaskRepository`. Write two Alembic migrations: initial schema, and a subsequent migration adding a `priority` integer column (default 3\) to `Task`. **Deliberately implement one endpoint's relationship loading naively first** (e.g., list all users with their task counts via a Python loop issuing one query per user), profile it with SQLAlchemy's query-count logging or `cProfile` against a seeded table of ≥50 users, observe the N+1 query pattern directly, then fix it using eager loading (`selectinload` or a single aggregated query) and re-profile to confirm the query count collapses to a small constant.

**Stopping Rule:** Both migrations run cleanly forward and back (`alembic upgrade head` / `downgrade base`). `TaskRepository` has zero FastAPI imports. `get_db` is injected via `Depends()`, no global session object. All five task endpoints function against the real database. The N+1 exercise's before/after query counts are captured and reported in writing. `mypy --strict`: zero errors.

**Justification:** Alembic migrations are the production-grade method of schema evolution. The N+1 addition replaces an abstract warning ("watch out for N+1 queries") with a measured, self-discovered production bug — the single most common real-world SQLAlchemy performance mistake, now taught as something you catch with a profiler rather than something you're told to avoid.

---

**◄ PROJECT 1 GATE: Unlock after DSA-10 AND BE-2 are both closed ►**

---

### **BE-3: Layered Architecture**

**Core Topic:** Strict Controller → Service → Repository separation via `typing.Protocol` and FastAPI's dependency injection.

**Learning Depth:** Production

**What to Study:** `Protocol` (structural typing, introduced as your final BE-0 task): `ITaskRepository(Protocol)` with abstract method signatures. `TaskService` accepts an `ITaskRepository` via constructor injection (not `Depends()`), enabling mock injection in tests. The route accepts a `TaskService` via `Depends()`. Business logic lives exclusively in the service.

**What to Build:** Refactor into strict layers: `api/routes/` (controllers only), `services/` (business logic only), `repositories/` (SQLAlchemy only, plus `interfaces.py` for the Protocols), `models/` (`db_models.py`, `schemas.py`), `core/`.

**Stopping Rule:** Write a `MockTaskRepository` implementing `ITaskRepository` with a plain dict. Instantiate `TaskService(MockTaskRepository())` and call every service method — it must work with zero database connection. This is the smoke test for correct layering; if it fails, the service is importing SQLAlchemy directly. `mypy --strict`: zero errors across all layers.

**Justification:** Production codebases without architectural boundaries become untestable within weeks. The Protocol-based inversion, now cold-started from BE-0 rather than introduced for the first time here, makes BE-4 tractable rather than painful.

---

### **BE-4: Testing (pytest, TestClient, Coverage)**

**Core Topic:** Unit tests via mocks, integration tests via FastAPI's `TestClient`, coverage measurement.

**Learning Depth:** Production

**What to Study:** pytest fixtures (`scope`, `conftest.py`). `unittest.mock.MagicMock` / `pytest-mock`'s `mocker`. `TestClient` for in-process HTTP testing. `app.dependency_overrides` for swapping live dependencies with test doubles. `pytest-cov`: `pytest --cov=app --cov-report=html`. 80% line coverage is a floor — missing exception-path coverage matters more than missing happy-path coverage.

**What to Build:** Three test layers: (1) service unit tests against `MockTaskRepository`, zero HTTP, zero database; (2) route integration tests via `TestClient` and `dependency_overrides` with a clean in-memory repository per test; (3) repository integration tests against a real test PostgreSQL schema, migrations run in fixture setup and torn down after.

**Stopping Rule:** `pytest --cov=app` reports ≥80% line coverage. Every test independent — any run order produces identical results. Service tests contain zero HTTP calls; route tests contain zero SQLAlchemy imports. `pytest -x` exits 0\.

**Justification:** A codebase without tests is not production-quality regardless of architectural cleanliness; BE-3's dependency-override pattern makes this gate executable rather than aspirational.

---

### **BE-5: Authentication (Basic JWT)**

**Core Topic:** JWT structure, signing/verification via `python-jose`, protecting routes with an OAuth2 bearer dependency — and the blocking-call gotcha inside async routes.

**Learning Depth:** Implementation

**What to Study:** JWT anatomy: header, payload (`sub`, `exp`, `iat`), signature. `python-jose[cryptography]`: `jwt.encode`/`decode`, `JWTError`. `passlib[bcrypt]` for password hashing. `OAuth2PasswordBearer` for bearer-token extraction. `get_current_user`: decode, look up, raise 401 if invalid. Scope exclusions: no refresh tokens, no OAuth2 providers, no RBAC. **New, GIL-connected addition:** `passlib`'s bcrypt hashing is a synchronous, CPU-adjacent blocking call — calling it directly inside an `async def` route blocks the entire event loop for every other concurrent request while it runs, a direct, concrete consequence of BE-0's threads-vs-async-vs-processes benchmark. The correct pattern is either a plain `def` route (FastAPI runs these in a threadpool automatically) or explicitly offloading the call via an executor.

**What to Build:** `POST /auth/register` (hash, create, return `UserResponse`), `POST /auth/login` (verify, return bearer token), all `/tasks/*` protected via `Depends(get_current_user)`, scoped to the authenticated user.

**Stopping Rule:** No token → 401\. Manually expired token → 401, not 500\. Token signed with a different secret → 401\. pytest tests for all three rejection cases plus a successful authenticated request. **Written justification (2–3 sentences) of whether your register/login routes are `def` or `async def`, referencing the bcrypt-blocking consideration from this gate's study material.** `mypy --strict`: zero errors on all auth modules.

**Justification:** JWT is the minimum viable auth layer for an externally shared API. The bcrypt-blocking addition is the single clearest place in the entire backend track where the GIL — introduced as pure theory in DSA-0 — becomes a concrete, gate-determining engineering decision.

---

**◄ CAPSTONE GATE: Unlock after DSA-12 AND BE-5 are both closed ►**

---

## **PART 3 — COGNITIVE SCIENCE & RETENTION MECHANICS**

### **3.1 Daily 4-Hour Block Structure**

Both tracks are now Python, so the cognitive contrast this structure originally relied on (Java's compiled, static-typed discipline vs. Python's dynamic, async-first backend work) shifts from a *language* contrast to a *mode* contrast: DSA remains analytical (pattern recognition, complexity proof), Backend remains constructive (system assembly, debugging pipelines). This distinction survives the migration intact — it was never really about Java vs. Python, it was about algorithmic reasoning vs. systems assembly, and that separation is preserved by keeping DSA and Backend as genuinely separate blocks with a break between them, not by the choice of language.

DAILY BLOCK TEMPLATE  
──────────────────────────────────────────────────────────  
\[08:00–08:10\]  Retrieval Warm-Up (10 min)  
               └─ Anki deck review: 10-15 cards  
                  DSA concept cards \+ Backend API cards

\[08:10–09:40\]  DSA Block — Active (90 min)  
               └─ First 20 min: Study gate concept, draw diagrams  
               └─ Remaining 70 min: Solve ≥1 gate problem, timed, no hints

\[09:40–09:50\]  Mandatory Break — No screens (10 min)

\[09:50–11:10\]  Backend Block — Active (80 min)  
               └─ First 15 min: Read your own last-built code cold  
               └─ Remaining 65 min: Build the current BE gate feature

\[11:10–11:20\]  Mandatory Break — No screens (10 min)

\[11:20–12:00\]  Interleaved Retrieval Practice (40 min)  
               └─ First 20 min: Re-solve ONE problem from ≥2 gates back,  
                  cold, compare after  
               └─ Last 20 min: Read and manually refactor 20-30 lines  
                  of prior backend code without running it; predict  
                  the output, then run it

\[12:00–12:20\]  Synthesis & Metrics Log (20 min)  
               └─ Feynman write-up: one paragraph, zero jargon  
               └─ Update metrics log (Part 4\)  
               └─ Write tomorrow's explicit goal in one sentence

**Why this order still holds:** the retrieval-practice block deliberately revisits old material right before a natural consolidation window. Reviewing prior backend code activates a different memory system (structural/visual) than DSA problem-solving (logical/algorithmic) even with both tracks in the same language — the mode contrast, not the syntax contrast, was always doing the real work here.

---

### **3.2 Spaced Repetition & Review Cycles**

**Layer 1 — Daily:** Anki review (10 min) every session. Cards now cover: CPython internals facts (dict is open-addressed, not chained; deque is block-based; GIL blocks CPU parallelism not I/O concurrency), Big-O per structure, SQL query patterns, FastAPI decorator syntax, Pydantic validator syntax. 3–5 new cards/day maximum.

**Layer 2 — Weekly:**

1. DSA: re-solve 3 problems randomly selected from any closed gate under timed conditions, no looking at prior solutions first, then compare and note drift.  
2. Backend: read your most recently completed feature cold, write 3 improvement observations, implement at least one.  
3. Gate-progress check: can you still state every closed gate's stopping rule in ≤60 seconds without notes?

**Layer 3 — Monthly:**

1. DSA: one Medium problem from each closed gate, under its original time bound. Any failure is a regression — back into weekly rotation for two more weeks.  
2. Backend: full architecture review — draw the module dependency graph on paper, find any layer importing something it shouldn't, fix it.  
3. Anki audit: retire 10-consecutive-correct cards; add cards for concepts that keep appearing in missed problems.

**The Forgetting Curve Correction:** unchanged from V1 in principle — review is scheduled for after natural forgetting occurs, because reconstructing under uncertainty is where durable learning happens, not re-reading material you still remember perfectly.

---

## **PART 4 — QUANTIFIABLE METRICS**

### **4.1 DSA Metrics**

| Metric | Formula | Target |
| ----- | ----- | ----- |
| Easy solve rate | Easy solved 1st attempt / Easy attempted | ≥95% |
| Medium solve rate | Medium solved without hint within time limit / Medium attempted | ≥65% |
| Average solve time (Easy) | Sum of times / count | ≤20 min |
| Average solve time (Medium) | Sum of times / count | ≤30 min |
| Optimal complexity match rate | Problems matching theoretical optimal / total solved | ≥80% |
| Hint dependency rate | Problems using any hint within time limit / total attempted | ≤20% |
| `mypy --strict` clean rate | Solutions passing zero-error on first check / total solutions | 100% before gate close |
| Retrieval regression rate | Weekly re-solves diverging from prior optimal approach | Track only |

**Weekly DSA Dashboard:**

Week ending: \_\_\_\_\_\_\_\_\_\_\_  
Gate in progress: \_\_\_\_\_\_\_\_\_\_\_  
Problems attempted this week: \_\_\_  
Medium solved without hints: \_\_\_ / \_\_\_  
Average Medium solve time: \_\_\_ min  
Optimal complexity matches: \_\_\_ / \_\_\_  
mypy \--strict clean on first check: \_\_\_ / \_\_\_  
Retrieval practice result (3 re-solves): pass/fail/pass  
Regression note: \_\_\_\_\_\_\_\_\_\_\_

---

### **4.2 Backend Metrics**

| Metric | Formula | Target |
| ----- | ----- | ----- |
| Endpoint coverage | Fully implemented \+ tested / planned | 100% before gate close |
| Type safety | `mypy --strict` errors | 0 before gate close |
| Test coverage (line) | `pytest-cov` line coverage | ≥80% on BE-4+ |
| Test independence rate | Tests relying on prior test state / total | 0 |
| Migration clean run rate | Alembic up/down cycles succeeding / attempted | 100% |
| Service layer purity | Service methods importing FastAPI/SQLAlchemy directly | 0 |
| N+1 query incidents caught | Naive-then-fixed relationship loads profiled / total relationship endpoints | Track, target 100% profiled |
| Bug resolution time | First failed test → green test | Track only |

**Weekly Backend Dashboard:**

Week ending: \_\_\_\_\_\_\_\_\_\_\_  
Gate in progress: \_\_\_\_\_\_\_\_\_\_\_  
mypy \--strict errors: \_\_\_  
pytest coverage: \_\_\_%  
New endpoints implemented: \_\_\_  
N+1 checks run this week: \_\_\_  
Alembic migration runs (success/total): \_\_\_/\_\_\_  
Layer violations found and fixed: \_\_\_

---

## **PART 5 — PROJECT SPECIFICATIONS**

### **Project 1: Rate-Limited Request Analytics API**

**Unlock Gate:** DSA-10 closed AND BE-2 closed.

**What it is:** A FastAPI service tracking HTTP requests per endpoint path in real time, enforcing per-endpoint rate limits via a from-scratch sliding-window counter, and exposing a top-K most-active-endpoints query backed by a from-scratch min-heap — now with an empirical justification for the heap over a naive sort, using the exact profiling toolchain from DSA-0.

**Why this project:**

* The sliding window (DSA-2) is a `collections.deque` of timestamps per path — no Redis, no library — the same pattern learned on LeetCode, now applied in the same language it was learned in.  
* The top-K query (DSA-10) uses `heapq` explicitly, not `sorted(...)[:-k-1:-1]`.  
* BE-2's PostgreSQL layer stores historical logs for the persistent analytics query.

**Endpoints:**

* `POST /track` — logs path \+ timestamp, enforces a configurable rate limit (e.g., 100 req/60s per path), returns HTTP 429 with retry-after on breach.  
* `GET /analytics/top?k=5&window_seconds=60` — top K paths by request count in the last `window_seconds`, in-memory sliding window \+ min-heap.  
* `GET /analytics/history?path=...&from=...&to=...` — PostgreSQL query for historical counts in a date range.  
* `DELETE /analytics/reset` — clears in-memory state for testing.

**New requirement (profiling tie-in):** Use `cProfile` to compare your heap-based `/analytics/top` implementation against a naive `sorted(counts.items(), key=..., reverse=True)[:k]` implementation under a seeded load of ≥10,000 tracked requests across ≥50 distinct paths. Report the measured difference and explain it in terms of the heap's O(n log k) vs. the full sort's O(n log n).

**Data structure constraints (non-negotiable):** sliding window via `collections.deque` per path, expiring by popping from the left while `timestamps[0] < now - window`. Top-K via `heapq`, not a full sort in the shipped implementation (the naive sort exists only as the profiling comparison baseline, then is removed or clearly marked as benchmark-only).

**Architecture:** BE-2's layered structure — routes, service (window \+ heap logic), repository (PostgreSQL queries), schemas. In-memory window state lives in the service layer as a module-level dict — a deliberate, acknowledged trade-off. ≥10 pytest tests: rate-limit enforcement, sliding-window expiry, top-K heap correctness, history date-range query.

**Completion Criteria:** All four endpoints functional against live PostgreSQL. Sliding window and heap are your own code. The profiling comparison is run and its result committed to the README. ≥10 passing tests. `mypy --strict`: zero errors.

---

### **Project 2: Job Application Tracker API (Capstone)**

**Unlock Gate:** DSA-12 closed AND BE-5 closed.

**What it is:** A production-quality REST API tracking job applications through a status pipeline, with analytics requiring algorithmic thinking at the query layer, plus one endpoint that puts DSA-7's generator work into production use.

**Domain model:**

* `User` — id, email, hashed\_password, created\_at  
* `Application` — id, user\_id, company, role, status (enum), applied\_date, notes, updated\_at  
* `StatusHistory` — id, application\_id, from\_status, to\_status, changed\_at (immutable audit log)  
* Status pipeline: `SAVED → APPLIED → SCREENING → INTERVIEW → OFFER → REJECTED / WITHDRAWN`

**Endpoints:**

Auth:  
  POST /auth/register  
  POST /auth/login

Applications (JWT-protected, scoped to current user):  
  POST   /applications  
  GET    /applications        ?status=INTERVIEW\&company=Google  
  GET    /applications/{id}  
  PUT    /applications/{id}  
  DELETE /applications/{id}  
  POST   /applications/{id}/transition   body: { "to\_status": "INTERVIEW" }

Analytics (JWT-protected):  
  GET /analytics/funnel         → count per status stage for current user  
  GET /analytics/weekly-rate    → applications submitted per week for last N weeks  
  GET /analytics/response-rate  → % of APPLIED that reached SCREENING or beyond

Export (NEW — DSA-7 tie-in):  
  GET /applications/export      → streams a CSV of all applications via a  
                                   generator function and FastAPI's  
                                   StreamingResponse, never materializing  
                                   the full result set in memory

**Architectural requirements (non-negotiable):** Strict Controller/Service/Repository layers with `Protocol` interfaces. `StatusHistory` is append-only — no update/delete endpoint; the service validates every status transition (no `SAVED` → `OFFER` direct jump). `weekly-rate` computes weekly counts via `DATE_TRUNC('week', applied_date)` in a single SQL query — never a Python loop. JWT auth on all `/applications/*` and `/analytics/*` routes; cross-user access is blocked in the service layer, not only via a query filter. **The `/applications/export` endpoint's CSV rows must be produced by a generator function, and its memory footprint must be verified via `sys.getsizeof` or a load test to stay flat as the exported row count grows into the thousands** — this is a direct, graded application of DSA-7's lazy-evaluation content, not a decorative feature.

**Database schema migrations (4 Alembic revisions):**

1. Initial schema: `users`, `applications`, `status_history`  
2. Index on `applications.user_id` and `applications.status`  
3. Nullable `withdrawn_reason` column on `applications`  
4. Composite index on `status_history(application_id, changed_at)`

**Testing requirements:** Service unit tests (mock repository): all transition rules, response-rate math, weekly-rate bucketing with fixture data, and the export generator's row-by-row behavior. Route integration tests: full CRUD, invalid transition → 422, cross-user access → 403\. Repository integration tests against a test PostgreSQL schema. `pytest --cov=app` ≥80%. `mypy --strict`: zero errors.

**Deployment:** Render (free tier) with managed PostgreSQL; Alembic migrations run as part of the deploy step; app reachable at a public URL.

**README must include:** architecture diagram, endpoint docs with example request/response bodies, ER diagram, status pipeline explanation, complexity notes for `weekly-rate` and `funnel`, and a short note on why the export endpoint streams instead of materializing — tying DSA-7 explicitly to a production decision.

---

## **PART 6 — ITERATION & BOTTLENECK PROTOCOLS**

### **6.1 The Wall Protocol (Stuck 45+ Minutes)**

Unchanged in structure from V1 — this protocol was never Java-specific.

TIME ELAPSED      ACTION  
─────────────────────────────────────────────────────────────────  
0–15 min          Work in silence. No external resources.  
                  Write your current understanding on paper.  
                  State the problem in one sentence.

15–30 min         Decompose aggressively. Find the smallest solvable  
                  subproblem. Solve it, verify it, extend one step.  
                  If still stuck, state what you know is NOT the  
                  answer and why — elimination counts as progress.

30–45 min         Targeted concept search ONLY. Search the CONCEPT  
                  ("how does open addressing handle deletion") never  
                  the solution ("leetcode 295 solution").

45-min mark:      WALL DETECTED. Execute the following:

  STEP 1  (5 min) Write your Stuck Summary: what you've tried, what  
                  you know it is NOT, your current best hypothesis.

  STEP 2  (5 min) For DSA: read ONLY the approach name from an  
                  editorial — not pseudocode, not code.  
                  For Backend: find the relevant official doc page,  
                  not a Stack Overflow answer with code.

  STEP 3 (20 min) 20-minute timer. Implement your understanding of  
                  that approach from scratch, no code reference.

  STEP 4  (5 min) If still failing: read pseudocode only. Reattempt  
                  15 min.

  STEP 5  (5 min) AFTER solving, regardless of how: write a 3-line  
                  Autopsy — the specific missed insight, the pattern  
                  category, the tell-tale signal for next time.

**The Autopsy is mandatory.** Problems needing Step 4 must be re-attempted from scratch the next day without looking at your solution. A second failure moves it into the weekly review rotation.

---

### **6.2 Gate Velocity Monitoring & Adjustment Rules**

**Diagnostic categories for slowness:**

* **Category A (Concept Gap):** you don't understand the underlying idea. Re-read theory, draw examples on paper, don't proceed to problems until you can explain it verbally.  
* **Category B (Implementation Friction):** you understand the idea but can't write correct Python for it. Pseudocode on paper first, then translate line by line — note that this category should now be rarer than in V1, since there is no longer a foreign-language translation layer sitting between concept and code.  
* **Category C (Pattern Recognition Failure):** you solve familiar problems but fail novel presentations of the same pattern — you memorized solutions, not structures. Re-examine prior solutions for the invariant, not the code.

**DSA gate takes 2–3× estimated time:** identify the category. Reduce the DSA block from 90 to 70 minutes, reallocate 20 minutes to targeted theory review. Do not advance regardless of time elapsed. Backend continues as scheduled; do not open a new backend gate until DSA resumes normal velocity.

**DSA gate takes \>3× estimated time:** freeze all backend gate advancement. Diagnose the specific blocking sub-skill, not the whole gate:

* Trees slow? → almost always the two-child deletion case or iterative traversal. Isolate and drill it.  
* DP slow? → almost always state definition. Drill recurrence derivation on 5 toy problems before returning to LeetCode.  
* CPython internals gates (DSA-0, DSA-3, DSA-7) slow? → this is very likely Category A, not B — the content is genuinely conceptual and has no "just grind more problems" fallback the way pattern-matching gates do. Add a daily 30-minute concept-only drill (no code) until you can explain the mechanism verbally, unaided, before returning to the implementation task.

Add a daily 30-min concept-drill block on the blocking sub-skill, before the DSA block. Resume the gate once two consecutive correct implementations are produced.

**Backend gate takes 2–3× estimated time:** continue DSA as scheduled. Reduce backend block from 80 to 60 minutes, reallocate 20 minutes to official FastAPI/SQLAlchemy/Alembic docs for the specific failing concept. Use freed time to test already-built code.

**Backend gate takes \>3× estimated time:** conceptual blocker → treat as Category A, read documentation systematically. Specific debugging blocker (Alembic failure, SQLAlchemy relationship broken) → time-box to 45 minutes via the Wall Protocol, then build a minimal reproduction and search the exact error text in quotes. Never extend the 4-hour daily limit to compensate — fatigue past 4 hours degrades retention faster than it accelerates progress.

**The Simultaneous Block Rule:** if both a DSA gate and a backend gate are blocked (both \>2× velocity), drop backend progress entirely and focus exclusively on the DSA gate. DSA's dependency chain is longer — a stalled DSA gate compounds; a stalled backend gate does not cascade the same way.

---

### **6.3 Scope Control Guardrails**

* Do not add features to a project once its completion criteria are met. Ship it and move on.  
* Do not begin a gate until all prerequisite gates have passed their stopping rules. The DAG is the authority.  
* Do not replace a from-scratch implementation task with a standard-library call (e.g., using `heapq` where the task says build `MinHeap` first, or using `dict` directly where the task says build `HashMap` first). The implementation tasks exist precisely to prevent the black-box problem this migration was designed to deepen, not shortcut.  
* Do not skip `mypy --strict` verification because "the code ran anyway." Python running without error is not the same as Python being correct — this is the entire premise of using `mypy --strict` as the compile-time-discipline replacement, and skipping it quietly reverts the curriculum to a lower rigor standard than intended.  
* Do not treat the CPython-internals gates (DSA-0, DSA-3, DSA-7) as optional trivia because they don't map to a LeetCode problem number. They are gated with the same stopping-rule rigor as every pattern-matching gate, and later gates depend on them (DSA-9's `__slots__` task depends on DSA-0; DSA-11's deque requirement depends on DSA-1; DSA-8's recursion-limit awareness depends on DSA-7).  
* The only permitted exception to the 4-hour daily limit is Project 1 and Project 2 integration weeks, where a 5-hour session is acceptable no more than twice per project.

---

## **QUICK REFERENCE: GATE STATUS TRACKER**

DSA GATES  
─────────────────────────────────────  
\[ \] DSA-0   CPython Object Model, Memory & Descriptors  
\[ \] DSA-1   Dynamic Arrays & Two Pointers  
\[ \] DSA-2   Sliding Window  
\[ \] DSA-3   Hash-Based Structures            ← depends on DSA-1, DSA-2  
\[ \] DSA-4   Prefix Sum                        ← depends on DSA-1  
\[ \] DSA-5   Sorting Algorithms & Timsort       ← depends on DSA-3  
\[ \] DSA-6   Binary Search                     ← depends on DSA-5  
\[ \] DSA-7   Iterators, Generators & Frames     ← depends on DSA-6  
\[ \] DSA-8   Recursion & Backtracking          ← depends on DSA-7  
\[ \] DSA-9   Trees & Traversals                ← depends on DSA-8  
\[ \] DSA-10  Heaps & Priority Queues           ← depends on DSA-9  
★  PROJECT 1                                  ← DSA-10 \+ BE-2 required  
\[ \] DSA-11  Graphs & Union-Find               ← depends on DSA-10  
\[ \] DSA-12  Dynamic Programming               ← depends on DSA-11

BACKEND GATES  
─────────────────────────────────────  
\[ \] BE-0    Python Internals — Types, Async, GIL  
\[ \] BE-1    FastAPI Core & Routing            ← depends on BE-0  
\[ \] BE-2    Database Layer                    ← depends on BE-1  
★  PROJECT 1                                  ← DSA-10 \+ BE-2 required  
\[ \] BE-3    Layered Architecture              ← depends on BE-2  
\[ \] BE-4    Testing                           ← depends on BE-3  
\[ \] BE-5    Authentication                    ← depends on BE-4  
★  CAPSTONE (Project 2\)                       ← DSA-12 \+ BE-5 required

---

*This is a hypothesis about how you learn, now rebuilt on one language instead of two. The bottleneck protocols exist because the hypothesis will still be wrong in at least one gate. Trust the stopping rules, not the schedule.*

---

---

# **Resource\_Companion.md**

# **Curated Resource Companion — V2**

### **Mapped to the Competency-Driven Mastery Curriculum | Python DSA × Python/FastAPI**

#### **Anti-prestige, gate-indexed, no hallucinated details**

---

## **PART 1 — PREREQUISITE BRIDGE**

**Complete this before opening any gate. Estimated time: 5–6 hours total.**

---

### **Git: Learn Git Branching**

**URL:** [learngitbranching.js.org](https://learngitbranching.js.org/) **Cost:** Free, browser-based, no install. **What to complete:** "Introduction Sequence" (levels 1–4) and "Ramping Up" (levels 1–4) in the Main section. Stop there. **Estimated time:** 2 hours. **Why this and not "Pro Git":** Pro Git is the right long-term reference; for a student who needs Git functional before Day 1, the interactive visualizer builds the DAG/branch mental model faster. **What you need from Git:** `init`, `add`, `commit`, `push`, `pull`, `branch`, `checkout`, `merge`.

---

### **HTTP: MDN Web Docs — An Overview of HTTP**

**URL:** [developer.mozilla.org/en-US/docs/Web/HTTP/Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview) **Cost:** Free. **What to read:** HTTP messages, methods, status codes. Skip caching/connection-management. **Estimated time:** 45 minutes. **Why this is not optional:** BE-1 introduces GET/POST/PUT/DELETE and status codes with no definitions. Skip only if you already know what a GET request and a 404 are.

---

### **Python: What's New in Python — Syntax Warm-Up**

**URL:** [docs.python.org/3/whatsnew/](https://docs.python.org/3/whatsnew/) — read the 3.10, 3.11, 3.12 pages **Cost:** Free. **What to read:** `match`/`case`, `X | Y` union syntax, a first pass at the async mental model (a coroutine pauses and resumes, it does not run in parallel). **Estimated time:** 2 hours. **Why this is here:** with the entire curriculum now in Python, this warm-up is no longer a niche bridge for one track — it is the single highest-leverage prerequisite in this document. DSA-0 and BE-0 both assume this vocabulary on day one.

---

## **PART 2 — TRACK-LEVEL RESOURCE ANCHORS**

---

### **DSA TRACK — Three Anchors**

---

#### **\[Primary Book\] *A Common-Sense Guide to Data Structures and Algorithms*, 2nd Edition**

**Author:** Jay Wengrow — Pragmatic Bookshelf, 2020\. \~$35–50.

**What it covers well:** Big-O intuition from first principles — the strongest available introduction to asymptotic reasoning at this level. Linear structures, recursion, hash tables. Builds *why* O(n²) is bad before showing you how to avoid it.

**What it does not cover:** Sliding Window, Prefix Sum (interview patterns — Neetcode is primary for both). Graphs (uncertain in the 2nd edition). Union-Find. Advanced tree topics beyond BST.

**Language note:** The book's example code is written in a lightweight, dynamically-typed style closer to Ruby than to any statically-typed language — translating to Python is close to direct, since both are dynamic, indentation-light scripting languages with similar list/dict primitives. This is meaningfully lower-friction than the V1 curriculum's Ruby-to-Java translation was.

**Why this over CLRS:** CLRS is rigorous and proof-heavy, correct for a student who already understands algorithms. For rebuilding foundations toward interview competency, Wengrow's examples-first, abstraction-second order is the right sequence, and costs a fraction of the reading time.

---

#### **\[Primary Video Course\] Abdul Bari — Algorithms & Data Structures**

**Platform:** YouTube (free) — search "Abdul Bari algorithms." **Udemy version:** *"Mastering Data Structures & Algorithms Using C and C++"* — YouTube content overlaps it; use YouTube unless you specifically want offline access.

**Critical caveat — language, and why the translation is now lighter than before:** Abdul Bari implements in C/C++. For sorting, recursion, backtracking, graphs, and DP, this is background noise — his whiteboard-first, pseudocode-adjacent reasoning is what you're actually learning from, not the C syntax. The two gates that used to need a heavy Translation Bridge in the Java version of this curriculum (linked lists, BST mutation) are **substantially simplified in the Python migration**: Python has no manual memory management to strip out of his C examples at all (no `malloc`/`free` concern whatsoever — every Python variable is already a reference, which maps onto a C pointer more directly than Java's mixed primitive/reference model ever did), and Python's dot-notation for attribute access (`node.next`, `node.left`) is syntactically identical to what you'll write, so the mapping is close to 1:1 with almost no interpretation layer.

**Lightweight Translation Note — C to Python, for DSA-1 and DSA-9 specifically**

| Abdul Bari's C | Your Python |
| ----- | ----- |
| `struct Node* head` | `head: Node | None` |
| `node->next` | `node.next` |
| `node->val` | `node.val` |
| `NULL` | `None` |
| `malloc(sizeof(struct Node))` | `Node(val)` |
| `free(node)` | *(omit entirely — no manual memory management exists in Python; refcounting/GC handle it, as covered in DSA-0)* |

There is no pointer-arithmetic risk here the way there was with Java's boxed/unboxed distinction — this table is nearly all you need for both gates.

**What he covers exceptionally:** Recursion, sorting, trees (including full BST deletion with all three cases), graphs (BFS/DFS/Dijkstra/Prim/Kruskal), dynamic programming, hashing — all language-agnostic in his teaching style.

**What he does not cover:** Sliding Window, Prefix Sum, Two Pointers as a named paradigm, Union-Find. Use Neetcode for these.

---

#### **\[Primary Reference\] Neetcode.io**

**URL:** [neetcode.io](https://neetcode.io/) · YouTube: [youtube.com/@NeetCode](https://www.youtube.com/@NeetCode) **Cost:** Free for the roadmap, problem list, and videos.

**What it is:** A curated LeetCode problem list by pattern, each with a free video explaining approach before code — directly aligned with this curriculum's "state the invariant before coding" discipline.

**A note specific to this migration:** Neetcode's solution walkthroughs are frequently shown in Python already, meaning this resource requires zero translation layer at all now — a genuine, if modest, friction reduction versus the V1 Java track.

**Where Neetcode is primary, not secondary:** Sliding Window (DSA-2) and Prefix Sum (DSA-4) — neither Wengrow nor Abdul Bari has a dedicated lecture for either, since both are interview-era patterns rather than classical-canon topics.

**How to use it:** Do not watch before attempting. Watch only after the 45-minute Wall Protocol threshold, or after solving, to compare approaches.

---

### **BACKEND TRACK — Three Anchors**

*(Unchanged from V1 — this track was always Python.)*

---

#### **\[Primary Book\] *Architecture Patterns with Python***

**Authors:** Harry Percival & Bob Gregory — O'Reilly, 2020\. Free at [cosmicpython.com](https://www.cosmicpython.com/).

**What it covers:** Repository pattern, layered architecture, Unit of Work, dependency injection, TDD against clean boundaries. The canonical text for BE-3 and BE-4 — the only resource explaining *why* the service layer must not import SQLAlchemy, not just *that* it must not.

**Critical caveat:** Examples use Flask \+ SQLAlchemy 1.x. The patterns are 100% transferable; translating Flask routes to FastAPI dependency-injected routes is itself part of the learning.

**What to read:** Part 1 (Chapters 1–6) in full. Stop there — Part 2 covers event-driven architecture, out of scope.

---

#### **\[Primary Video Course\] "Python API Development — Comprehensive Course for Beginners" by Sanjeev Thiyagarajan**

**Platform:** freeCodeCamp YouTube. Free. \~19 hours.

**Critical caveat — SQLAlchemy version mismatch:** Produced under SQLAlchemy 1.x style (`Column(String)`, `declarative_base()`, `db.query(...).filter(...)`). This curriculum targets SQLAlchemy 2.0 (`Mapped[str]`, `mapped_column()`, `DeclarativeBase`, `select()`). Watch for conceptual understanding of session management and model definition; write your own code against the SQLAlchemy 2.0 docs directly.

**Sections to watch:** Start through the JWT authentication section (\~14–15 of the 19 hours). **Sections to skip:** Docker deployment (out of scope), voting/likes feature (not needed for this project structure).

---

#### **\[Primary Reference\] FastAPI Official Documentation**

**URL:** [fastapi.tiangolo.com](https://fastapi.tiangolo.com/). Free.

**What makes it exceptional:** Interactive (Swagger UI), tutorial-driven, kept current, and the authoritative source for SQLAlchemy 2.0 integration patterns.

**How to use it:** The Tutorial section (First Steps → SQL Databases) replaces the freeCodeCamp course for 2.0-specific syntax. The Advanced User Guide is a lookup reference, not sequential reading.

---

## **PART 3 — GATE-BY-GATE RESOURCE MAP**

Labels: **\[Primary\]** start here · **\[Secondary\]** only if Primary leaves a gap · **\[Reference\]** lookup only.

---

## **DSA GATES**

---

### **DSA-0 — CPython Object Model, Memory Mechanics & Descriptors**

**\[Primary\] Python Official Documentation — Data Model** URL: [docs.python.org/3/reference/datamodel.html](https://docs.python.org/3/reference/datamodel.html) What to read: The sections on object identity/type/value, the descriptor protocol (`__get__`/`__set__`), and special method names relevant to `__slots__`. This is the authoritative, canonical source for exactly the mechanics DSA-0 gates on. Trade-off: Dense reference prose, not tutorial prose — pair with the `gc` module docs (below) for the cyclic-collection half of the gate.

**\[Primary\] Python Official Documentation — `gc`, `sys`, and `dis` modules** URLs: [docs.python.org/3/library/gc.html](https://docs.python.org/3/library/gc.html), [docs.python.org/3/library/sys.html\#sys.getsizeof](https://docs.python.org/3/library/sys.html), [docs.python.org/3/library/dis.html](https://docs.python.org/3/library/dis.html) What to read: `gc.collect()`, `gc.get_referrers()` for the reference-cycle task; `sys.getsizeof` for the `__slots__` measurement task; enough of `dis` to read a generator's bytecode later at DSA-7 (a first pass here is enough — return to `dis` properly at DSA-7). Why official docs specifically: these are canonical APIs with no meaningful "teaching" resource that beats reading the actual function signatures and the one or two worked examples the docs themselves provide.

**\[Reference\] Real Python — GIL and Concurrency articles** Search "Real Python GIL" and "Real Python concurrency" directly on realpython.com. What to use: Their GIL explainer and their threading-vs-multiprocessing-vs-asyncio comparison article, as a secondary confirmation of what you measure empirically in your own benchmark script. Use only if your own `timeit` results need a conceptual gap filled — the measurement, not the article, is the actual verification for this gate's stopping rule.

---

### **DSA-1 — Dynamic Arrays & Two Pointers**

**\[Primary\] Jay Wengrow — Chapters 1–5 (Big-O \+ Arrays)** Chapters 1–3 for Big-O intuition, Chapter 4 for arrays, Chapter 5 for optimization. Estimated: 3–4 hours.

**\[Reference\] Python Official Documentation — `collections.deque`** URL: [docs.python.org/3/library/collections.html\#collections.deque](https://docs.python.org/3/library/collections.html#collections.deque) What to read: The note on `deque` being implemented for fast appends/pops from both ends, explicitly contrasted against `list`'s O(n) cost for the same operation at index 0\. This is the doc page that justifies the deque-vs-list distinction this gate introduces and DSA-11 later enforces.

**\[Secondary\] Neetcode YouTube — Two Pointers Playlist** Search "Neetcode Two Pointers." Use only after the Wall Protocol's Step 2\.

---

### **DSA-2 — Sliding Window**

**\[Primary\] Neetcode YouTube — Sliding Window Playlist \+ neetcode.io Sliding Window section** Watch the conceptual intro (fixed vs. variable windows) first. Attempt every gate problem before any problem-specific video.

**\[Secondary\] Jay Wengrow — Chapter 5 (Optimizing Code)** Covers reducing nested loops to single-pass solutions — the conceptual ancestor of sliding window.

---

### **DSA-3 — Hash-Based Structures**

**\[Primary\] Python Official Documentation — `dict` design FAQ / "How are dictionaries implemented"** URL: [docs.python.org/3/faq/design.html\#how-are-dictionaries-implemented](https://docs.python.org/3/faq/design.html) What to read: The FAQ's direct answer on open addressing and why dict operations are fast on average.

**\[Secondary\] Jay Wengrow — Chapters 8–9 (Hash Tables)** Chapter 8 for hashing mechanics and collision resolution in general (note: Wengrow's own worked example may use chaining for pedagogical simplicity — treat it as the general mental model of "collisions must be resolved somehow," then use the Python doc above for the specific, correct open-addressing mechanism your implementation task requires). Chapter 9 for the complement-lookup insight in problem-solving. When to use: Read both before starting the implementation task; the Python doc above is what makes your `HashMap` implementation architecturally accurate rather than a plausible-looking but wrong copy of a different language's design.

---

### **DSA-4 — Prefix Sum**

**This gate unlocks immediately after DSA-1 closes.** Run in parallel with DSA-2.

**\[Primary\] Neetcode YouTube — Arrays & Hashing section (Prefix Sum problems)** Watch the LC \#303 conceptual video first to establish the prefix array structure, then attempt the remaining gate problems independently.

**\[Secondary\] Jay Wengrow — Chapter 5** Introduces precomputation as a general technique before the specific "how" of prefix sum.

---

### **DSA-5 — Sorting Algorithms & Timsort**

**\[Primary\] Abdul Bari — Sorting Techniques Section** Merge sort, quicksort, counting sort, derived from first principles before code. Skip radix/bucket sort — out of scope.

**\[Primary\] Python Official Documentation — "Sorting HOW TO" \+ `timeit`** URLs: [docs.python.org/3/howto/sorting.html](https://docs.python.org/3/howto/sorting.html), [docs.python.org/3/library/timeit.html](https://docs.python.org/3/library/timeit.html) What to read: The Sorting HOW TO's notes on stability and the `key=` parameter; `timeit`'s API for the three-input-shape benchmark this gate's stopping rule requires. This is the documentation that lets you correctly measure and describe Timsort's adaptiveness rather than asserting it from memory.

**\[Secondary\] Jay Wengrow — Chapters 13–16 (Sorting)** A second perspective on merge sort/quicksort trade-offs and stability.

---

### **DSA-6 — Binary Search**

**\[Primary\] Abdul Bari — Binary Search / Searching Section** The classic sorted-array case with clear invariant derivation.

**\[Primary\] Python Standard Library Source — `bisect.py`** Locate it in your local Python installation (`python -c "import bisect; print(bisect.__file__)"`) or view it via [github.com/python/cpython](https://github.com/python/cpython) under `Lib/bisect.py`. What to do: Read `bisect_left` and `bisect_right` directly — this is a genuine, readable pure-Python reference implementation, unlike `dict`/`list` internals which are C-only. Compare the loop invariant to your own leftmost/rightmost implementations.

**\[Secondary\] Neetcode YouTube — Binary Search Playlist** For LC \#1011 and \#410 (answer-space binary search), which Abdul Bari's course does not cover.

---

### **DSA-7 — Iterators, Generators & Frame Mechanics**

**\[Primary\] Python Official Documentation — "Classes" (iterator section) \+ "Generators" in the Functional Programming HOWTO** URLs: [docs.python.org/3/tutorial/classes.html\#iterators](https://docs.python.org/3/tutorial/classes.html), [docs.python.org/3/howto/functional.html\#generators](https://docs.python.org/3/howto/functional.html) What to read: The tutorial's worked iterator-class example, then the Functional Programming HOWTO's generator section for the `yield` mechanics and the frame-suspension explanation. Why official docs and not a course: this is a narrow, precisely-specified language mechanism where the canonical explanation is genuinely the clearest available — there is no video course that beats reading `__iter__`/`__next__`'s actual contract directly.

**\[Reference\] Python Official Documentation — `dis` module** URL: [docs.python.org/3/library/dis.html](https://docs.python.org/3/library/dis.html) What to use: Run `dis.dis` on your own generator function and use this page to identify the `YIELD_VALUE`/`RESUME`\-family bytecode instructions (exact opcode names vary slightly by Python version — use `dis.dis`'s own output as ground truth over any specific opcode name asserted here).

**\[Secondary\] Real Python — "How to Use Generators and yield in Python"** Search "Real Python generators yield" directly on realpython.com. When to use: If the official docs' generator section leaves a conceptual gap — this is a widely-cited, tutorial-style companion to the canonical reference above.

---

### **DSA-8 — Recursion & Backtracking**

**\[Primary\] Abdul Bari — Recursion Section \+ Backtracking Section** The call stack model and recursion tree visualization, built before any code — exactly what this gate's pre-coding ritual demands. His backtracking lectures cover N-Queens specifically; watch only after your own attempt.

**\[Primary\] Python Official Documentation — `sys.getrecursionlimit` / `sys.setrecursionlimit`** URL: [docs.python.org/3/library/sys.html\#sys.setrecursionlimit](https://docs.python.org/3/library/sys.html) What to read: The exact wording on why raising this limit does not raise the underlying C stack size — this is the documentation backing this gate's stopping-rule requirement to explain the segfault risk.

**\[Secondary\] Jay Wengrow — Chapters 11–12 (Recursion)** Use if Abdul Bari's C/C++ code creates any residual translation friction.

**N-Queens time bound:** Apply a 55-minute bound for LC \#51, not the general 35-minute gate bound — see DSA-8's stopping rule for the full reasoning.

---

### **DSA-9 — Trees (Binary Tree, BST, Traversals)**

**\[Primary\] Abdul Bari — Trees Section** Binary tree structure, full BST deletion (all three cases), all four traversals.

**\[Reference\] Python Official Documentation — `__slots__`** URL: [docs.python.org/3/reference/datamodel.html\#slots](https://docs.python.org/3/reference/datamodel.html#slots) What to use: The exact mechanics of `__slots__` for this gate's required memory-comparison callback to DSA-0, now applied to a real ≥500-node tree instead of a toy example.

**\[Secondary\] Neetcode YouTube — Trees Playlist** For LC \#124 (Binary Tree Maximum Path Sum), the gate-keeper problem requiring the split-return insight.

---

### **DSA-10 — Heaps & Priority Queues**

**\[Primary\] Abdul Bari — Heap Section** Binary heap structure, heapify-up/down, and the O(n) heapify-from-array derivation.

**\[Primary\] Python Standard Library Source — `heapq.py`** Locate via `python -c "import heapq; print(heapq.__file__)"` or the CPython GitHub mirror, `Lib/heapq.py`. What to do: Read `_siftup`/`_siftdown` directly after building your own `MinHeap` — a genuine, readable reference implementation, matching this gate's diagnostic task requirement exactly.

**\[Secondary\] Neetcode YouTube — Heap / Priority Queue Playlist** For LC \#295 (Find Median from Data Stream), the gate keeper and Project 1's conceptual anchor.

---

### **DSA-11 — Graphs & Union-Find**

**\[Primary\] Abdul Bari — Graphs Section** BFS, DFS, Dijkstra with visual correctness derivations. Prim/Kruskal not required by the stopping rule — watch only if interested.

**\[Primary\] William Fiset — Graph Theory Algorithms Playlist** Platform: YouTube. Search "William Fiset graph theory." What it covers: BFS, DFS, Union-Find (path compression \+ union by rank), topological sort, Dijkstra. Note on language: his implementations are Java, and this is retained anyway — his visual explanation of Union-Find's path-compression/union-by-rank mechanics is the clearest available regardless of implementation language, and the translation cost here is genuinely trivial (Union-Find's core logic is a handful of array operations with no pointer/reference subtlety worth a bridge table). Implement directly in Python from his explanation; a translation table would be overhead for content this short.

---

### **DSA-12 — Dynamic Programming**

**\[Primary\] Abdul Bari — Dynamic Programming Section** Recurrence relations derived visually from problem structure before any code. Watch the introductory lectures (memoization vs. tabulation), then the lecture matching each stopping-rule problem as you reach it. Note: His section includes problems outside this gate's scope (e.g., matrix chain multiplication) — skip these.

**\[Secondary\] Neetcode YouTube — Dynamic Programming Playlist** For problems where the LeetCode structure doesn't obviously map to a named DP pattern — Neetcode's videos categorize by pattern (1D, 2D, knapsack), useful for verifying your recurrence family before implementing.

---

## **BACKEND GATES**

*(Largely unchanged from V1 — this track was always Python. Additions noted explicitly.)*

---

### **BE-0 — Python Internals for Backend**

**\[Primary\] Python Official Documentation — Type System and Asyncio** URLs: [docs.python.org/3/library/typing.html](https://docs.python.org/3/library/typing.html), [mypy.readthedocs.io](https://mypy.readthedocs.io/en/stable/), [docs.python.org/3/library/asyncio.html](https://docs.python.org/3/library/asyncio.html) (Coroutines and Tasks section only).

**\[Reference\] Pydantic v2 Official Documentation** URL: [docs.pydantic.dev/latest/](https://docs.pydantic.dev/latest/) Read: Models, Fields, Validators, Discriminated Unions. Ensure you're on v2 docs — the freeCodeCamp course uses v1 syntax in places; ignore it.

**\[Reference\] Python Official Documentation — `threading` vs. `multiprocessing`** URLs: [docs.python.org/3/library/threading.html](https://docs.python.org/3/library/threading.html), [docs.python.org/3/library/multiprocessing.html](https://docs.python.org/3/library/multiprocessing.html) What to use: The API surface needed to write this gate's GIL benchmark script — `threading.Thread`, `multiprocessing.Process`, both with `.start()`/`.join()`.

**Protocol gap-fill — last item before closing this gate:** Read the mypy documentation's "Protocols" section, then write one practice `Protocol` interface from scratch. BE-3 requires this cold.

---

### **BE-1 — FastAPI Core & Routing**

**\[Primary\] FastAPI Official Documentation — Tutorial: User Guide** URL: [fastapi.tiangolo.com/tutorial/](https://fastapi.tiangolo.com/tutorial/) Read: First Steps through Bigger Applications (Multiple Files), per this gate's stopping rule. Skip Security, Background Tasks, WebSockets, Advanced User Guide for now.

**\[Secondary\] freeCodeCamp FastAPI Course — First 4 Hours** Through the CRUD section, for a "see it assembled" perspective after the docs. Do not use its SQLAlchemy code — see BE-2's caveat.

---

### **BE-2 — Database Layer**

**\[Primary\] SQLAlchemy 2.0 Documentation — ORM Tutorial** URLs: [docs.sqlalchemy.org/en/20/orm/quickstart.html](https://docs.sqlalchemy.org/en/20/orm/quickstart.html), [docs.sqlalchemy.org/en/20/tutorial/](https://docs.sqlalchemy.org/en/20/tutorial/)

**\[Reference\] Alembic Official Documentation** URL: [alembic.sqlalchemy.org/en/latest/](https://alembic.sqlalchemy.org/en/latest/)

**\[Reference\] SQLAlchemy Documentation — Relationship Loading Techniques** URL: [docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html) What to read: The section on `selectinload` and lazy vs. eager loading — the exact fix this gate's N+1 exercise requires you to apply after profiling the naive version.

**PostgreSQL setup — pick one before starting this gate:**

* **Option A — Local install:** Windows: installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/), set a password, accept default port 5432, then `CREATE DATABASE devdb;` via pgAdmin or `psql`. macOS/Linux: `brew install postgresql@16` or `sudo apt install postgresql postgresql-contrib`, then `createdb devdb`.  
* **Option B — Cloud, zero local setup:** [Neon](https://neon.tech/) or [Supabase](https://supabase.com/) — free tier, connection string ready the moment you create a project, no local service to manage.

Option B is lower-friction and the better default if you want one less thing to debug during this gate.

---

### **BE-3 — Layered Architecture**

**\[Primary\] *Architecture Patterns with Python* — Part 1 (Chapters 1–6)** Chapter 1 (Domain Modeling), Chapter 2 (Repository Pattern — read twice), Chapter 3 (Coupling and Abstractions), Chapter 4 (Flask API \+ Service Layer — translate to FastAPI mentally), Chapter 5 (TDD, relevant to BE-4), Chapter 6 (Unit of Work). Stop at Chapter 6\.

**\[Reference\] FastAPI Official Documentation — Dependencies** URL: [fastapi.tiangolo.com/tutorial/dependencies/](https://fastapi.tiangolo.com/tutorial/dependencies/) Read: "Classes as Dependencies" and "Sub-dependencies."

---

### **BE-4 — Testing**

**\[Primary\] FastAPI Official Documentation — Testing** URL: [fastapi.tiangolo.com/tutorial/testing/](https://fastapi.tiangolo.com/tutorial/testing/) Full Testing page \+ "Testing a Database" section.

**\[Reference\] pytest Official Documentation** URL: [docs.pytest.org/en/stable/](https://docs.pytest.org/en/stable/) Look up: Fixtures (`scope`, `conftest.py`), `pytest.mark`, `pytest-cov`. Lookup only, not sequential reading.

---

### **BE-5 — Authentication**

**\[Primary\] FastAPI Official Documentation — Security** URL: [fastapi.tiangolo.com/tutorial/security/](https://fastapi.tiangolo.com/tutorial/security/) Security Intro, OAuth2 with Password (and hashing), Bearer with JWT tokens.

**\[Reference\] JWT.io — Introduction** URL: [jwt.io/introduction](https://jwt.io/introduction) The "What is JSON Web Token?" page, plus the JWT Debugger tool for inspecting your own generated tokens.

**\[Reference\] FastAPI Official Documentation — "Concurrency and async / await"** URL: [fastapi.tiangolo.com/async/](https://fastapi.tiangolo.com/async/) What to read: FastAPI's own explanation of when to use `def` vs. `async def` — directly relevant to this gate's bcrypt-blocking requirement and the single clearest place the GIL becomes a real backend decision rather than trivia.

---

## **APPENDIX — COMPATIBILITY MATRIX**

| Component | Version | Source |
| ----- | ----- | ----- |
| Python | **3.14.x** | python.org |
| FastAPI | **≥ 0.128.1** | `pip install "fastapi>=0.128.1"` |
| Pydantic | **v2.12+** | installed with FastAPI by default — verify with `pip show pydantic` |
| SQLAlchemy | **2.0.x latest** | `pip install --upgrade sqlalchemy` |
| Alembic | latest stable | `pip install alembic` |
| python-jose | 3.x with `[cryptography]` extra | `pip install python-jose[cryptography]` |
| passlib | 1.7.x with `[bcrypt]` extra | `pip install passlib[bcrypt]` |
| pytest | 7.x or 8.x | `pip install pytest pytest-cov pytest-asyncio` |
| mypy | latest stable | `pip install mypy` |
| memory-profiler | latest | `pip install memory-profiler` |
| IDE | VS Code with Python extension | code.visualstudio.com |

**Environment verification — run before opening any gate:**

python \--version          \# must show 3.14.x  
pip show pydantic         \# must show Version: 2.12.x or higher  
pip show fastapi          \# must show Version: 0.128.1 or higher  
pip show sqlalchemy       \# must show Version: 2.0.x  
pip show mypy             \# confirm installed

**What was removed in this migration and why:** IntelliJ IDEA, OpenJDK, JUnit 5, `javac`, and Maven/Gradle are no longer part of this curriculum's toolchain — there is no Java track remaining. Any residual reference to these in older notes or Anki cards should be retired.

---

## **APPENDIX — WHAT IS DELIBERATELY EXCLUDED AND WHY**

**CLRS:** Proof-heavy, graduate-level rigor. Wengrow provides the same Chapters 1–10 conceptual ground in a fraction of the reading time.

**"Grokking Algorithms":** Accessible and visual, but its coverage ends before trees/graphs are fully developed — Wengrow covers the same ground with more depth, and unlike V1's reasoning, "it uses Python, not Java" is no longer a point in its favor either way, since this curriculum is Python-native now. It's still excluded on depth grounds alone.

**Gang of Four:** No design-patterns gate exists in this curriculum by design. Not applicable.

**"Clean Code":** The curriculum's architectural guidance is more precisely addressed by Architecture Patterns with Python.

**"Designing Data-Intensive Applications":** Exceptional, out of scope until after the capstone.

**Neetcode Pro (paid tier):** The free tier fully covers every gate here.

**Oracle Java Tutorials, Baeldung, JUnit documentation, IntelliJ resources:** Removed outright — no longer applicable to any gate in this curriculum following the migration to a Python-only DSA track.

**Boot.dev:** Evaluated and rejected — its DSA content is Python-only (no longer a conflict post-migration) but its production backend track is Go's `net/http`, not FastAPI, so it still offers zero coverage of this curriculum's actual backend framework. Its core value proposition (gamified motivation for undirected learners) solves a problem this gate-based curriculum's stopping rules already solve structurally.

---

*This companion is a map. The curriculum is the territory. When they conflict, the curriculum's stopping rules are the authority.*

---

---

# **Execution\_Checklist.md**

# **Execution Checklist & Pacing Guide — V2**

### **Python DSA × Python/FastAPI Backend | Daily-Use Tracker**

---

## **How To Use This Document**

Work through the Sprints in order. Check a box only when it is fully and literally true. Do not move to the next Sprint until "Sprint Complete When" is met in full. If stuck on something for more than 45 minutes, follow the Wall Protocol boxes attached to that problem — do not silently push through or silently give up.

---

## **Pacing Assumptions**

* Budget: 25–30 focused hours per week.  
* A "Sprint" is a unit of mastery, not a calendar week.  
* Every Sprint has one built-in lighter day.  
* Three Review & Buffer Checkpoints are placed through the plan. Do not skip these even if ahead.

---

# **PHASE 0 — SETUP**

## **Sprint 0: Environment & Bridges**

**Goal:** One unified Python toolchain installed, both prerequisite readings done, before opening any gate.

**Core Checklist**

* \[ \] Install VS Code with the Python extension  
* \[ \] Install Python 3.14 — confirm with `python --version` that it shows 3.14.x  
* \[ \] Create a GitHub account if you don't already have one  
* \[ \] Complete Learn Git Branching: Introduction Sequence (levels 1–4)  
* \[ \] Complete Learn Git Branching: Ramping Up (levels 1–4)  
* \[ \] Practice on a throwaway repo: `git init`, `add`, `commit`, `push`, `pull`, `branch`, `checkout`, `merge`  
* \[ \] Read MDN's "An overview of HTTP" — messages, methods, status codes only. Skip only if already fluent.  
* \[ \] Read Python's "What's New" pages for 3.10–3.12 — `match`/`case`, `|` unions, async mental model  
* \[ \] Create a Python virtual environment: `python -m venv venv`  
* \[ \] Activate it and install: `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `pydantic`, `pytest`, `pytest-cov`, `pytest-asyncio`, `python-jose[cryptography]`, `passlib[bcrypt]`, `mypy`, `memory-profiler`  
* \[ \] Run `pip show fastapi` — confirm version is 0.128.1 or higher  
* \[ \] Run `pip show pydantic` — confirm version is 2.12 or higher  
* \[ \] Run `pip show sqlalchemy` — confirm version is the latest 2.0.x  
* \[ \] Run `pip show mypy` — confirm installed  
* \[ \] Set up Anki (app or web) and create one blank deck for this plan  
* \[ \] Set up a plain-text or Obsidian folder for daily notes and Stuck Summaries  
* \[ \] Create a free Neon.tech account (or confirm a local PostgreSQL install works) — just have it ready

**Stretch Tasks**

* \[ \] Skim Jay Wengrow's table of contents  
* \[ \] Skim the FastAPI documentation homepage  
* \[ \] Skim Python's official Data Model reference page to see what DSA-0 will draw on

**Sprint Complete When...**

* Every tool above is installed and every version check passes.  
* You have made at least one commit, branch, and merge on a practice repo.  
* The HTTP and Python syntax readings are done or explicitly skipped because you already know them.  
* Anki and your notes folder both exist and are empty, ready to use.

---

# **PHASE 1 — FOUNDATIONS**

## **Sprint 1: CPython Internals \+ Python Internals for Backend (DSA-0 \+ BE-0)**

**Goal:** Get comfortable with how Python actually stores objects and runs concurrently, on both tracks at once — they're the same underlying mechanics applied to different problems.

**Core Checklist — DSA-0**

* \[ \] Read Python's Data Model docs: object identity/type/value, the descriptor protocol  
* \[ \] Read `gc` module docs: `gc.collect()`, `gc.get_referrers()`  
* \[ \] Read `sys` module docs: `sys.getsizeof`  
* \[ \] Write a script comparing memory of ≥1000 plain-class instances vs. ≥1000 `__slots__`\-based instances (3 attributes each); report the aggregate byte delta  
* \[ \] Write a script constructing a genuine reference cycle between two objects; show it survives naive refcounting  
* \[ \] Use `gc.collect()` on the cycle script and confirm a nonzero collected count  
* \[ \] Use `timeit` to benchmark `list.append()` across increasing N; confirm the cost stays flat  
* \[ \] Use `cProfile` on a small multi-function script; identify the single hottest function  
* \[ \] Out loud, in under 90 seconds: explain why normal attribute access goes through a per-instance `__dict__` and how `__slots__` bypasses it  
* \[ \] Confirm all four scripts are fully type-hinted and pass `mypy --strict` with zero errors  
* \[ \] Confirm all four scripts carry ≥6 total pytest assertions backing their claims (not printed output alone)

**Core Checklist — BE-0**

* \[ \] Confirm `python --version` is 3.14.x  
* \[ \] Confirm `pip show pydantic` is 2.12+  
* \[ \] Read the Python docs `typing` module page: `Optional`, `Union`, `list[T]`, `dict[K,V]`, `Protocol`  
* \[ \] Read the mypy "Getting Started" page  
* \[ \] Read the `asyncio` docs — "Coroutines and Tasks" section only  
* \[ \] Read the Pydantic v2 docs: Models, Fields, Validators  
* \[ \] Read the Pydantic v2 docs: Discriminated Unions section  
* \[ \] Build a Pydantic `ApplicationForm` model with a nested `Address` model  
* \[ \] Add a discriminated union `ContactMethod` (email or phone, each with its own required fields)  
* \[ \] Add a custom `@field_validator` rejecting empty strings after stripping whitespace  
* \[ \] Add an integer field constrained between 1 and 100 inclusive  
* \[ \] Run `mypy --strict` on this model — confirm zero errors  
* \[ \] Write an async `fetch_all(urls: list[str])` using `asyncio.gather`, returning results in input order  
* \[ \] Write a synchronous wrapper for `fetch_all`  
* \[ \] Run `mypy --strict` on both — confirm zero errors  
* \[ \] Write a benchmark script: run a CPU-bound function across multiple `threading.Thread`s, confirm via `timeit` that wall-clock time does NOT improve  
* \[ \] Run the same CPU-bound function across multiple `multiprocessing.Process`es, confirm it DOES improve  
* \[ \] Run an I/O-bound function (e.g., `time.sleep` stand-in) across multiple threads, confirm it DOES improve  
* \[ \] Write 3–4 sentences connecting this result to why FastAPI defaults to `async def` for I/O-bound routes  
* \[ \] Read the mypy docs "Protocols" section  
* \[ \] Write one practice `Protocol` interface from scratch, e.g. a `Repository` protocol with a `get_by_id` method

**Light Day (built into this Sprint)**

* \[ \] One full day, no new material — Anki review only, or full rest  
* \[ \] Write one paragraph in plain English explaining what a reference cycle is and why `asyncio.gather` doesn't give you CPU parallelism

**Stretch Tasks**

* \[ \] Read Real Python's GIL article as a second-pass confirmation of your own benchmark's conclusion  
* \[ \] Skim the Pydantic "Concepts" page beyond what was assigned

**Sprint Complete When...**

* Both DSA-0 scripts and both BE-0 deliverables pass `mypy --strict` with zero errors.  
* The GIL benchmark's three results are captured and the FastAPI connection is written.  
* You wrote one working `Protocol` interface.

---

## **Sprint 2: Dynamic Arrays & Two Pointers \+ FastAPI Routing Part 1 (DSA-1 \+ BE-1a)**

**Goal:** Solve array problems using two pointers, empirically verify how Python lists actually grow, and stand up the first version of a Task API.

**Core Checklist — DSA-1**

* \[ \] Read Wengrow Chapters 1–3 (Big-O intuition)  
* \[ \] Read Wengrow Chapter 4 (arrays)  
* \[ \] Read Wengrow Chapter 5 (optimization)  
* \[ \] Read `collections.deque` docs — note the O(1) both-ends guarantee vs. `list`'s O(n) at index 0  
* \[ \] Build a `DynamicArray` class from scratch with a manual doubling growth strategy  
* \[ \] Empirically map ≥10 real reallocation points of a genuine Python `list` using `sys.getsizeof` while appending one element at a time  
* \[ \] Write 2–3 sentences comparing your own doubling strategy's growth factor to the observed real growth factor  
* \[ \] Solve LC \#167 (Two Sum II) — warm-up, any time  
* \[ \] Solve LC \#11 (Container With Most Water) in under 25 minutes, no hints  
* \[ \] Solve LC \#15 (3Sum) in under 35 minutes, no hints — if longer, redo duplicate-skipping until automatic  
* \[ \] Build your own `Node` class from scratch (no bridge needed — write it directly)  
* \[ \] Solve LC \#141 (Linked List Cycle) in under 25 minutes on your own `Node` class  
* \[ \] Solve LC \#19 (Remove Nth Node From End) in under 25 minutes on your own `Node` class

**Core Checklist — BE-1 Part 1**

* \[ \] Confirm `pip show fastapi` is 0.128.1+  
* \[ \] Read FastAPI docs: First Steps  
* \[ \] Read FastAPI docs: Path Parameters and Numeric Validations  
* \[ \] Read FastAPI docs: Query Parameters and String Validations  
* \[ \] Read FastAPI docs: Request Body  
* \[ \] Read FastAPI docs: Response Model  
* \[ \] Define a `Task` entity: id (uuid4), title, description, status (enum: todo/in\_progress/done), created\_at  
* \[ \] Build `POST /tasks` with separate input and output Pydantic models (in-memory dict storage)  
* \[ \] Build `GET /tasks` with query params `status` and `limit`  
* \[ \] Build `GET /tasks/{id}`

**Light Day (built into this Sprint)**

* \[ \] One full day, no new material this Sprint  
* \[ \] Re-solve LC \#1 from memory, untimed, no notes

**Stretch Tasks**

* \[ \] Watch the Neetcode Two Pointers playlist intro video for a second perspective  
* \[ \] Add an `APIRouter` split for your Task routes ahead of schedule

**Sprint Complete When...**

* All five DSA-1 problems solved at their time bounds without hints.  
* The `DynamicArray` growth comparison is run and written up.  
* Three Task API endpoints work and return correct JSON.

---

## **Sprint 3: Sliding Window \+ FastAPI Routing Part 2 (DSA-2 \+ BE-1b)**

**Goal:** Master expanding/shrinking window problems, and finish the Task API with error handling and middleware.

**Core Checklist — DSA-2**

* \[ \] Watch the Neetcode Sliding Window conceptual intro video  
* \[ \] Solve LC \#643 (Maximum Average Subarray I) — warm-up, any time  
* \[ \] Solve LC \#3 (Longest Substring Without Repeating Characters) in under 30 minutes, no hints  
* \[ \] Solve LC \#424 (Longest Repeating Character Replacement) in under 30 minutes, no hints  
* \[ \] **Wall Protocol — LC \#76 (Minimum Window Substring)**  
  * \[ \] Attempted alone for 35 minutes, no hints, no solutions  
  * \[ \] If still stuck: looked up only the approach name via Neetcode, not the code  
  * \[ \] Re-implemented your own solution within 20 minutes, no code reference  
  * \[ \] Wrote a 3-line takeaway note

**Core Checklist — BE-1 Part 2**

* \[ \] Read FastAPI docs: Additional Responses  
* \[ \] Read FastAPI docs: Error Handling  
* \[ \] Read FastAPI docs: Dependencies (the full section)  
* \[ \] Read FastAPI docs: Bigger Applications (Multiple Files)  
* \[ \] Read FastAPI docs: Middleware page  
* \[ \] Build `PUT /tasks/{id}`  
* \[ \] Build `DELETE /tasks/{id}`  
* \[ \] Add a custom exception handler returning `{"error": "...", "code": ...}` JSON  
* \[ \] Add middleware injecting an `X-Request-Duration-Ms` response header  
* \[ \] Test: send a wrong type in the request body — confirm HTTP 422 with a structured error  
* \[ \] Test: request a non-existent task — confirm HTTP 404 with your custom error format  
* \[ \] Test: confirm the `X-Request-Duration-Ms` header appears on every response  
* \[ \] Run `mypy --strict` on the whole codebase — confirm zero errors

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#167 from Sprint 2, untimed, no notes, compare to your old solution

**Stretch Tasks**

* \[ \] Watch freeCodeCamp FastAPI course, hours 1–4, for a full walkthrough  
* \[ \] Write 3–5 early pytest smoke tests for your Task API (real testing comes later at BE-4)

**Sprint Complete When...**

* All four DSA-2 problems solved, including the gate-keeper at its time bound.  
* All five Task API endpoints work, with structured errors and the timing header confirmed.

---

## **Sprint 4: Hash-Based Structures \+ Prefix Sum \+ Database Models (DSA-3 \+ DSA-4 \+ BE-2a)**

**Goal:** Build your own open-addressed hash map, learn the prefix-sum trick, and start the database layer.

**Note:** DSA-4 can run any time after DSA-1 — no need to wait for DSA-3. This Sprint runs them side by side.

**Core Checklist — DSA-3 (Hash-Based Structures)**

* \[ \] Read the Python FAQ's "How are dictionaries implemented" answer — open addressing, not chaining  
* \[ \] Read Wengrow Chapter 8 (hash table mechanics, general model)  
* \[ \] Read Wengrow Chapter 9 (hash tables in problem-solving)  
* \[ \] Build a `HashMap[K, V]` from scratch using **open addressing with tombstone deletion** — not chaining  
* \[ \] Implement `put`, `get`, `delete`, `__contains__`  
* \[ \] Implement auto-resize at load factor 0.75  
* \[ \] Write ≥15 pytest assertions, including a deliberate collision case and a delete-then-lookup tombstone case — all passing  
* \[ \] Draw the sparse-index/dense-entry split with one collision and one tombstone example on paper  
* \[ \] Solve LC \#1 (Two Sum) — warm-up, any time  
* \[ \] Solve LC \#49 (Group Anagrams) in under 30 minutes, no hints  
* \[ \] Solve LC \#347 (Top K Frequent Elements) in under 30 minutes, no hints  
* \[ \] **Wall Protocol — LC \#128 (Longest Consecutive Sequence)**  
  * \[ \] Attempted alone for 30 minutes, no hints  
  * \[ \] If stuck: looked up only the approach name (set-based O(n) trick)  
  * \[ \] Re-implemented your own O(n) solution within 20 minutes — if you used sorting, redo it  
  * \[ \] Wrote a 3-line takeaway note

**Core Checklist — DSA-4 (Prefix Sum)**

* \[ \] Watch the Neetcode video on LC \#303 for the prefix array structure  
* \[ \] Solve LC \#303 (Range Sum Query) — warm-up, any time  
* \[ \] Solve LC \#560 (Subarray Sum Equals K) in under 25 minutes, no hints  
* \[ \] Solve LC \#974 (Subarray Sums Divisible by K) in under 25 minutes, no hints  
* \[ \] **Wall Protocol — LC \#238 (Product of Array Except Self)**  
  * \[ \] Attempted alone for 25 minutes, no hints  
  * \[ \] If stuck: looked up only the approach name via Neetcode  
  * \[ \] Re-implemented your own O(1)-extra-space solution within 20 minutes — output array as running prefix, not two extra arrays  
  * \[ \] Wrote a 3-line takeaway note

**Core Checklist — BE-2 Part 1**

* \[ \] Confirm `pip show sqlalchemy` shows the latest 2.0.x  
* \[ \] Read SQLAlchemy 2.0 docs: ORM Quickstart  
* \[ \] Read SQLAlchemy 2.0 docs: Working with ORM Related Objects (one-to-many)  
* \[ \] Read SQLAlchemy 2.0 docs: Using SELECT Statements section  
* \[ \] Define a `User` model (id, email, hashed\_password, created\_at) using `DeclarativeBase` and `Mapped[]`  
* \[ \] Define a `Task` model with a one-to-many relationship to `User` (`back_populates`)  
* \[ \] Set up `SessionLocal` and a `get_db` dependency (session via `Depends()`, no global session object)

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#3 from Sprint 3, untimed, no notes, compare to your old solution

**Stretch Tasks**

* \[ \] Read Abdul Bari's Hashing section for collision-resolution mechanics in general  
* \[ \] Skim the SQLAlchemy Core (non-ORM) tutorial for awareness only

**Sprint Complete When...**

* HashMap implementation (open-addressed) passes all 15+ tests.  
* All DSA-3 and DSA-4 problems solved at their time bounds, gate-keepers included.  
* `User` and `Task` SQLAlchemy models exist and load correctly.

---

## **🔄 Review & Buffer Checkpoint A**

**Goal:** Confirm Phase 1 actually stuck before adding more weight on top of it.

**Core Checklist**

* \[ \] Anki: review every card added so far  
* \[ \] Re-solve, untimed and from scratch, one problem each from DSA-1, DSA-2, DSA-3, and DSA-4 — compare to your old solutions, note any drift  
* \[ \] Re-read your DSA-0 memory-comparison script cold, as if seeing it for the first time — write 2 things you'd improve  
* \[ \] Confirm your Task API (BE-1) and database models (BE-2a) still run with no errors  
* \[ \] Take one full rest day with zero new material

**Stretch Tasks**

* \[ \] Re-time the DSA-0 `__slots__` comparison script from memory, no notes, just to check retention

**Sprint Complete When...**

* All four re-solved problems pass without needing your old code.  
* Nothing from Phase 1 is broken or forgotten.

---

# **PHASE 2 — CORE BUILD**

## **Sprint 5: Sorting & Timsort \+ Database Migrations (DSA-5 \+ BE-2b)**

**Goal:** Implement merge sort and quicksort from scratch, empirically measure Timsort's adaptiveness, and finish the database layer with Alembic and a first N+1 profiling exercise.

**Core Checklist — DSA-5**

* \[ \] Watch Abdul Bari's Sorting section (merge sort, quicksort, counting sort)  
* \[ \] Read the Python "Sorting HOW TO" doc page  
* \[ \] Implement merge sort on `list[int]` in Python  
* \[ \] Implement randomized quicksort on `list[int]` in Python  
* \[ \] Write ≥10 pytest tests: empty, single-element, sorted, reverse-sorted, duplicate-heavy — all passing  
* \[ \] Out loud, under 2 minutes: state T(n) \= 2T(n/2) \+ O(n) and explain why it's O(n log n)  
* \[ \] Use `timeit` to benchmark your own merge sort vs. `sorted()` on: (a) random data, (b) already-sorted data, (c) reverse-sorted data  
* \[ \] Write the measured timing ratios and a 2–3 sentence explanation of Timsort's adaptiveness gap  
* \[ \] Solve LC \#912 (Sort an Array) using your own merge sort, not `sorted()`  
* \[ \] Solve LC \#56 (Merge Intervals) in under 25 minutes, no hints  
* \[ \] **Wall Protocol — LC \#179 (Largest Number)**  
  * \[ \] Attempted alone for 25 minutes, no hints  
  * \[ \] If stuck: looked up only the approach name (custom comparator concept)  
  * \[ \] Re-implemented your own `cmp_to_key`\-based solution within 20 minutes  
  * \[ \] Wrote a 3-line takeaway note

**Core Checklist — BE-2 Part 2**

* \[ \] Create a Neon.tech database (or confirm local PostgreSQL) and get a `DATABASE_URL`  
* \[ \] Read the Alembic Tutorial page  
* \[ \] Read the Alembic Auto Generating Migrations page  
* \[ \] Run `alembic init` in your project  
* \[ \] Write Migration 1: initial schema (`users`, `tasks`)  
* \[ \] Run `alembic upgrade head` on a blank database — confirm it runs cleanly  
* \[ \] Run `alembic downgrade base` — confirm it rolls back cleanly  
* \[ \] Write Migration 2: add a `priority` integer column (default 3\) to `tasks`  
* \[ \] Run that migration up and down cleanly  
* \[ \] Build `TaskRepository`: `create`, `get_by_id`, `list_all`, `update`, `delete` — zero FastAPI imports  
* \[ \] Build `UserRepository` with equivalent methods  
* \[ \] Migrate all 5 Task API endpoints to use PostgreSQL through the repositories  
* \[ \] Seed ≥50 users with tasks, then implement a naive "list users with task counts" using one query per user in a Python loop  
* \[ \] Profile the naive version (SQL echo logging or `cProfile`) and record the query count  
* \[ \] Read SQLAlchemy's relationship-loading docs on `selectinload`  
* \[ \] Fix the naive version using eager loading and re-profile — confirm the query count collapses  
* \[ \] Run `mypy --strict` on the whole BE-2 codebase — confirm zero errors

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#560 from Sprint 4, untimed, no notes

**Stretch Tasks**

* \[ \] Read Wengrow Chapters 13–16 for a second perspective on sorting

**Sprint Complete When...**

* Both sorting implementations pass all tests, and the Timsort adaptiveness measurement is recorded.  
* All four Alembic migrations run up and down cleanly.  
* The N+1 before/after query counts are recorded and the fix confirmed.

---

## **Sprint 6: Binary Search \+ Backend Reinforcement (DSA-6 \+ BE Buffer)**

**Goal:** Master binary search, including answer-space search, and read a real standard-library source file for the first time.

**Core Checklist — DSA-6**

* \[ \] Watch Abdul Bari's Binary Search section  
* \[ \] Solve LC \#704 (Binary Search) — warm-up, any time  
* \[ \] Solve LC \#33 (Search in Rotated Sorted Array) in under 25 minutes, single pass, no hints  
* \[ \] Solve LC \#153 (Find Minimum in Rotated Sorted Array) in under 25 minutes, no hints  
* \[ \] Locate `bisect.py` on your machine (`python -c "import bisect; print(bisect.__file__)"`) and read `bisect_left`/`bisect_right`  
* \[ \] Write 2–3 sentences comparing `bisect_left`'s invariant to your own leftmost-occurrence implementation  
* \[ \] Watch Neetcode's "binary search on the answer" video  
* \[ \] Solve LC \#1011 (Capacity to Ship Packages Within D Days) in under 25 minutes, no hints  
* \[ \] **Wall Protocol — LC \#410 (Split Array Largest Sum)**  
  * \[ \] Attempted alone for 25 minutes, no hints  
  * \[ \] If stuck: looked up only the approach name via Neetcode  
  * \[ \] Re-implemented your own solution within 20 minutes  
  * \[ \] Wrote a 3-line takeaway note  
* \[ \] Out loud: explain in one sentence how LC \#410 and LC \#1011 are the same underlying problem

**Core Checklist — BE Buffer**

* \[ \] Write 5 additional exploratory pytest tests for your existing Task API endpoints  
* \[ \] Re-read your BE-2 repository code cold, as if seeing it for the first time — note 3 things you'd improve  
* \[ \] Skim *Architecture Patterns with Python* Chapter 1 (Domain Modeling) — no need to implement yet

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#11 from Sprint 2, untimed, no notes

**Stretch Tasks**

* \[ \] Try writing binary search with `lo`/`hi`/`mid` from memory, three times in a row

**Sprint Complete When...**

* All five DSA-6 problems solved at their time bounds.  
* The `bisect.py` comparison is written.  
* You can explain the LC \#410 / LC \#1011 connection out loud without notes.

---

## **Sprint 7: Iterators & Generators \+ Backend Reinforcement (DSA-7 \+ BE Buffer)**

**Goal:** Build a real mental model of frame suspension — this is the gate that makes Recursion (next Sprint) and async (already touched in BE-0) click as one mechanism instead of two.

**Core Checklist — DSA-7**

* \[ \] Read the Python tutorial's iterator-class section  
* \[ \] Read the Functional Programming HOWTO's generator section  
* \[ \] Implement a custom iterator class from scratch (`__iter__`/`__next__`) for a range-like object, no `yield`  
* \[ \] Implement the same behavior as a generator function using `yield`  
* \[ \] Write 2–3 sentences comparing the two — what did the generator syntax do for you automatically?  
* \[ \] Run `dis.dis` on your generator function and identify the suspend/resume bytecode instruction  
* \[ \] Write a generator-based lazy prefix-sum stream that never materializes the full input  
* \[ \] Use `sys.getsizeof` to confirm the generator object's size stays constant regardless of logical stream length  
* \[ \] Write ≥8 pytest assertions for the class-based iterator  
* \[ \] Write ≥8 pytest assertions for the generator-based version  
* \[ \] Solve LC \#341 (Flatten Nested List Iterator) in under 30 minutes, no hints  
* \[ \] Solve LC \#284 (Peeking Iterator) in under 30 minutes, no hints  
* \[ \] Confirm all code is fully type-hinted and passes `mypy --strict` with zero errors

**Core Checklist — BE Buffer**

* \[ \] Skim *Architecture Patterns with Python* Chapter 2 (Repository Pattern)  
* \[ \] Skim *Architecture Patterns with Python* Chapter 3 (Coupling and Abstractions)  
* \[ \] Re-run your Alembic migrations up and down once more — confirm they still work cleanly

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#49 from Sprint 4, untimed, no notes

**Stretch Tasks**

* \[ \] Read Real Python's generators article as a second-pass confirmation  
* \[ \] Rewrite your BE-0 `fetch_all` mentally as "a coroutine is a generator-derived suspended frame" and write one sentence connecting the two

**Sprint Complete When...**

* Both problems solved, both implementations pass their pytest assertions.  
* The `dis.dis` output is captured and the suspension instruction identified.  
* The lazy prefix-sum stream's constant memory footprint is verified.

---

## **Sprint 8: Recursion & Backtracking \+ Backend Reinforcement (DSA-8 \+ BE Buffer)**

**Goal:** Build the recursion-tree habit, complete the backtracking template, and learn Python's specific recursion-depth constraints. N-Queens gets extra time.

**Core Checklist — DSA-8**

* \[ \] Watch Abdul Bari's Recursion section (call stack model, recursion tree)  
* \[ \] If needed, read Wengrow Chapters 11–12 for a plain-English explainer first  
* \[ \] Read `sys.getrecursionlimit`/`sys.setrecursionlimit` docs — note why raising the limit doesn't raise the C stack size  
* \[ \] Run `sys.getrecursionlimit()` yourself and confirm the default value  
* \[ \] Draw the recursion tree on paper for a 3-element input, THEN solve LC \#78 (Subsets), no hints  
* \[ \] Draw the recursion tree on paper, THEN solve LC \#46 (Permutations) in under 35 minutes, no hints  
* \[ \] Draw the recursion tree on paper, THEN solve LC \#39 (Combination Sum) in under 35 minutes, no hints  
* \[ \] Draw the recursion tree on paper, THEN solve LC \#40 (Combination Sum II) in under 35 minutes, no hints  
* \[ \] Confirm your LC \#40 solution includes: `if i > start and candidates[i] == candidates[i-1]: continue`  
* \[ \] Out loud: explain in one sentence why it's `i > start` and not `i > 0`  
* \[ \] Draw the recursion tree on paper for N-Queens with n=4 BEFORE writing any code  
* \[ \] **Wall Protocol — LC \#51 (N-Queens) — use a 55-minute bound, not the usual 35**  
  * \[ \] Attempted alone for 55 minutes, no hints  
  * \[ \] If stuck: watched only the approach explanation in Abdul Bari's N-Queens lecture (pause before full code)  
  * \[ \] Re-implemented your own solution within 20–25 minutes  
  * \[ \] Wrote a 3-line takeaway note  
* \[ \] Add LC \#51 to a personal "re-try later" list regardless of outcome  
* \[ \] Confirm all code is fully type-hinted and passes `mypy --strict` with zero errors

**Core Checklist — BE Buffer**

* \[ \] Skim *Architecture Patterns with Python* Chapter 4 (Flask API and Service Layer) — mentally swap Flask routes for FastAPI routes  
* \[ \] Read FastAPI docs: Dependencies — "Classes as Dependencies" and "Sub-dependencies"  
* \[ \] Confirm `mypy --strict` is still zero errors across your whole BE-1/BE-2 codebase

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#15 (3Sum) from Sprint 2, untimed, no notes

**Stretch Tasks**

* \[ \] Solve one extra backtracking problem of your choosing from the Neetcode list

**Sprint Complete When...**

* All five gate problems solved, drawing the recursion tree first every time.  
* N-Queens solved within the 55-minute bound (or after the Wall Protocol steps), re-attempt logged.  
* You can state the default recursion limit and the segfault-risk caveat from memory.

---

## **Sprint 9: Trees \+ Backend Reinforcement (DSA-9 \+ BE Buffer)**

**Goal:** Build a full BST from scratch including the two-child deletion case, and empirically measure `__slots__` savings on a real tree.

**Core Checklist — DSA-9**

* \[ \] Watch Abdul Bari's Trees section (structure, BST insert/delete/search, all 4 traversals)  
* \[ \] Before writing deletion code: write the 3 deletion cases as comments first — leaf, one child, two children  
* \[ \] Build a `Node` class using `__slots__`  
* \[ \] Build a `BST` class with `insert`, `delete` (all 3 cases), `search`  
* \[ \] Implement `in_order`, `pre_order`, `post_order`, `level_order` recursively  
* \[ \] Implement `in_order` again, iteratively with an explicit stack  
* \[ \] Write ≥15 pytest tests, including the two-child deletion case and traversal ordering — all passing  
* \[ \] Build a tree of ≥500 nodes; compare its aggregate memory using `__slots__` Node vs. a non-`__slots__` equivalent Node class, using `sys.getsizeof`  
* \[ \] Report the aggregate savings in writing, tying back to your DSA-0 measurement  
* \[ \] Solve LC \#104 (Maximum Depth) in under 15 minutes  
* \[ \] Solve LC \#226 (Invert Binary Tree) in under 15 minutes  
* \[ \] Solve LC \#102 (Level Order Traversal) in under 20 minutes using a queue  
* \[ \] Solve LC \#235 (Lowest Common Ancestor of BST) in under 20 minutes using the BST property  
* \[ \] Solve LC \#98 (Validate Binary Search Tree) in under 25 minutes, no hints  
* \[ \] **Wall Protocol — LC \#124 (Binary Tree Maximum Path Sum)**  
  * \[ \] Attempted alone for 35 minutes, no hints  
  * \[ \] If stuck: watched Neetcode's video for this specific problem  
  * \[ \] Re-implemented your own solution within 20 minutes  
  * \[ \] Wrote a 3-line takeaway note  
* \[ \] Confirm your LC \#124 solution returns the single-path max upward while tracking the global max separately

**Core Checklist — BE Buffer**

* \[ \] Read Architecture Patterns with Python Chapter 4 fully if not already done  
* \[ \] Confirm `mypy --strict` is still zero errors across your whole BE-1/BE-2 codebase

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#3 from Sprint 3, untimed, no notes

**Stretch Tasks**

* \[ \] Draw the full BST deletion flowchart from memory on a blank sheet of paper

**Sprint Complete When...**

* BST class passes all 15+ tests, including two-child deletion.  
* All six tree problems solved at their time bounds, gate-keeper included.  
* The `__slots__` memory comparison on the real ≥500-node tree is recorded.

---

## **Sprint 10: Heaps \+ Project 1 Unlock Check (DSA-10)**

**Goal:** Build a heap from scratch, read `heapq.py`'s real source, and confirm both halves of the curriculum are ready for Project 1\.

**Core Checklist**

* \[ \] Watch Abdul Bari's Heap section  
* \[ \] Build `MinHeap` using a plain `list[int]`  
* \[ \] Implement `insert`, `extract_min`, `peek`  
* \[ \] Implement `heapify(arr: list[int])` using O(n) sift-down — not repeated insertions  
* \[ \] Write ≥12 pytest tests, including heapify on a reverse-sorted array and extract-all producing sorted output  
* \[ \] Locate `heapq.py` (`python -c "import heapq; print(heapq.__file__)"`) and read `_siftup`/`_siftdown`  
* \[ \] Write 2–3 sentences comparing your sift-down to CPython's  
* \[ \] Solve LC \#215 (Kth Largest Element) in under 20 minutes using a min-heap of size K  
* \[ \] Solve LC \#347 (Top K Frequent Elements) in under 25 minutes using a heap, not a full sort  
* \[ \] Solve LC \#373 (Find K Pairs with Smallest Sums) in under 30 minutes using a min-heap  
* \[ \] **Wall Protocol — LC \#295 (Find Median from Data Stream)**  
  * \[ \] Attempted alone for 35 minutes, no hints  
  * \[ \] If stuck: watched Neetcode's video on the two-heap technique  
  * \[ \] Re-implemented your own two-heap solution within 20 minutes  
  * \[ \] Wrote a 3-line takeaway note  
* \[ \] Out loud, under 60 seconds: explain the rule "lower half max-heap size equals upper half min-heap size, give or take one"

**Unlock Check**

* \[ \] Confirm DSA-10 is fully done (all boxes above checked)  
* \[ \] Confirm BE-2 is fully done (Sprint 5's BE-2 Part 2 boxes all checked, including the N+1 exercise)  
* \[ \] Both true → Project 1 is unlocked, move to Sprint 11

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#98 from Sprint 9, untimed, no notes

**Stretch Tasks**

* \[ \] Re-implement `heapify` using repeated insertion (O(n log n)) just to feel the speed difference against your O(n) version

**Sprint Complete When...**

* MinHeap passes all 12+ tests.  
* The `heapq.py` source comparison is written.  
* All four heap problems solved, gate-keeper included.  
* Both unlock conditions for Project 1 confirmed true.

---

## **Sprint 11: Project 1 Build — Rate-Limited Analytics API**

**Goal:** Build a real backend service using a sliding window and a heap in production code, with a real profiling comparison backing the design choice.

**Core Checklist**

* \[ \] Set up a new FastAPI project using your existing layered folder structure  
* \[ \] Build `POST /track` that logs an incoming request's path and timestamp  
* \[ \] Implement the rate limiter using a `collections.deque` per path — pop expired timestamps off the left as time passes  
* \[ \] Confirm `POST /track` returns HTTP 429 with a retry-after value once the limit is exceeded  
* \[ \] Build `GET /analytics/top?k=5&window_seconds=60` using a min-heap of size K via `heapq`  
* \[ \] Seed ≥10,000 tracked requests across ≥50 distinct paths  
* \[ \] Profile your heap-based top-K against a naive `sorted(...)[:k]` implementation using `cProfile`  
* \[ \] Record the measured difference and explain it in terms of O(n log k) vs. O(n log n)  
* \[ \] Build `GET /analytics/history?path=...&from=...&to=...` querying PostgreSQL for historical counts  
* \[ \] Build `DELETE /analytics/reset` to clear in-memory state for testing  
* \[ \] Write 10 pytest tests: rate-limit enforcement, sliding-window expiry, top-K heap correctness, history date-range query  
* \[ \] Run `mypy --strict` — confirm zero errors  
* \[ \] Write a README explaining your data structure choices, their time complexity, and the profiling comparison result  
* \[ \] Push the project to GitHub with a clear commit history

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#226 from Sprint 9, untimed, no notes

**Stretch Tasks**

* \[ \] Add a second rate-limit tier (e.g. per-user in addition to per-path)  
* \[ \] Add a simple in-memory cache layer in front of the history endpoint

**Sprint Complete When...**

* All four endpoints work against a live PostgreSQL instance.  
* The sliding window and heap are your own code, not a library call for the shipped implementation.  
* The profiling comparison is run and its result is in the README.  
* All 10 tests pass and `mypy --strict` is clean.

---

# **PHASE 3 — ADVANCED & CAPSTONE**

## **Sprint 12: Graphs & Union-Find \+ Layered Architecture (DSA-11 \+ BE-3)**

**Goal:** Cover graph traversal and Union-Find with the correct container choices, and rebuild your backend into a properly layered, testable structure.

**Core Checklist — DSA-11**

* \[ \] Watch Abdul Bari's Graphs section (BFS, DFS, Dijkstra)  
* \[ \] Watch William Fiset's Union-Find video  
* \[ \] Watch William Fiset's Topological Sort video  
* \[ \] Build a `UnionFind` class with path compression and union by rank  
* \[ \] Write ≥8 pytest tests for `UnionFind` — all passing  
* \[ \] Build iterative BFS on an adjacency-list graph (`dict[int, list[int]]`) — the queue MUST be a `collections.deque`  
* \[ \] Write a code comment or assertion justifying the `deque` choice, referencing `list.pop(0)`'s O(n) cost  
* \[ \] Build iterative DFS on the same graph using an explicit stack (a plain `list` is correct here)  
* \[ \] Write ≥8 pytest tests for BFS/DFS, including a disconnected graph — all passing  
* \[ \] Solve LC \#200 (Number of Islands) in under 25 minutes, no hints  
* \[ \] Solve LC \#133 (Clone Graph) in under 25 minutes, no hints  
* \[ \] Solve LC \#207 (Course Schedule) in under 30 minutes using 3-color cycle detection  
* \[ \] Solve LC \#417 (Pacific Atlantic Water Flow) in under 35 minutes, no hints  
* \[ \] Solve LC \#743 (Network Delay Time) in under 35 minutes using Dijkstra with `heapq`, not Bellman-Ford  
* \[ \] **Wall Protocol — LC \#269 (Alien Dictionary)**  
  * \[ \] Attempted alone for 40 minutes, no hints  
  * \[ \] If stuck: looked up only the approach name (topological sort from character constraints)  
  * \[ \] Re-implemented your own solution within 20–25 minutes  
  * \[ \] Wrote a 3-line takeaway note  
* \[ \] Confirm your LC \#269 solution correctly detects a cycle on the input `["z","x","z"]`

**Core Checklist — BE-3**

* \[ \] Read *Architecture Patterns with Python* Chapter 1 fully (Domain Modeling)  
* \[ \] Read Chapter 2 fully, twice (Repository Pattern)  
* \[ \] Read Chapter 3 fully (Coupling and Abstractions)  
* \[ \] Read Chapter 4 fully, translating Flask to FastAPI mentally as you go  
* \[ \] Read Chapter 6 (Unit of Work Pattern)  
* \[ \] Read FastAPI docs: Dependencies — Classes as Dependencies, Sub-dependencies  
* \[ \] Define `ITaskRepository(Protocol)` and `IUserRepository(Protocol)` interfaces  
* \[ \] Reorganize the codebase into: `api/routes`, `services`, `repositories` (with `interfaces.py`), `models` (`db_models.py`, `schemas.py`), `core`  
* \[ \] Move all business logic into `TaskService` / `UserService`, constructor-injected with a repository  
* \[ \] Confirm your route files contain zero business logic  
* \[ \] Write a `MockTaskRepository` implementing `ITaskRepository` using a plain dict  
* \[ \] Instantiate `TaskService(MockTaskRepository())` and call every method without touching a real database  
* \[ \] Run `mypy --strict` across all layers — confirm zero errors

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#1011 from Sprint 6, untimed, no notes

**Stretch Tasks**

* \[ \] Implement Dijkstra a second time from scratch with no reference, timing yourself

**Sprint Complete When...**

* All six DSA-11 problems solved, gate-keeper included.  
* Your BFS's `deque` justification is written.  
* `TaskService` works correctly given the mock repository, zero direct database access in the service layer.

---

## **Sprint 13: Dynamic Programming \+ Testing (DSA-12 \+ BE-4)**

**Goal:** Solve every DP problem by deriving the recurrence first, and build a real test suite for your backend.

**Core Checklist — DSA-12**

* \[ \] Watch Abdul Bari's introductory DP lectures (memoization vs. tabulation)  
* \[ \] Write the recurrence on paper, THEN solve LC \#70 (Climbing Stairs), both memoized and tabulated  
* \[ \] Write the recurrence on paper, THEN solve LC \#198 (House Robber) in under 20 minutes, both forms  
* \[ \] Write the recurrence on paper, THEN solve LC \#300 (Longest Increasing Subsequence) in under 30 minutes, both forms  
* \[ \] Write the recurrence on paper, THEN solve LC \#1143 (Longest Common Subsequence) in under 30 minutes, both forms  
* \[ \] **Wall Protocol — LC \#72 (Edit Distance)**  
  * \[ \] Spent 35 minutes deriving the 3-transition recurrence yourself on paper before writing any code  
  * \[ \] If stuck: looked up only the names of the three transitions, not the full recurrence  
  * \[ \] Proved the recurrence by hand on a 3×3 example grid  
  * \[ \] Implemented both memoized and tabulated versions within 20–25 minutes  
  * \[ \] Wrote a 3-line takeaway note  
* \[ \] Write the recurrence on paper, THEN solve LC \#322 (Coin Change) in under 30 minutes, both forms  
* \[ \] Write the recurrence on paper, THEN solve LC \#416 (Partition Equal Subset Sum) in under 35 minutes, both forms  
* \[ \] Confirm every problem above has both a memoized version and a tabulated version, fully type-hinted, zero `mypy --strict` errors

**Core Checklist — BE-4**

* \[ \] Read FastAPI docs: Testing page, in full  
* \[ \] Read FastAPI docs: Testing a Database section  
* \[ \] Re-read *Architecture Patterns with Python* Chapter 5 (TDD in High/Low Gear)  
* \[ \] Read pytest docs: Fixtures, including `scope` and `conftest.py`  
* \[ \] Read pytest-cov plugin documentation  
* \[ \] Write service-layer unit tests using `MockTaskRepository`, covering all business rules and edge cases — zero HTTP calls  
* \[ \] Write route integration tests using `TestClient` and `dependency_overrides` with an in-memory repository — happy paths, 404s, 422s  
* \[ \] Write repository integration tests against a real test PostgreSQL schema, running migrations before and tearing down after  
* \[ \] Run `pytest --cov=app` — confirm at least 80% line coverage  
* \[ \] Run `pytest -x` multiple times in different orders — confirm consistent results every time  
* \[ \] Confirm service tests contain zero HTTP calls and route tests contain zero SQLAlchemy imports

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#200 from Sprint 12, untimed, no notes

**Stretch Tasks**

* \[ \] Try the N-Queens re-attempt logged back in Sprint 8 — time it again

**Sprint Complete When...**

* Every DP problem solved with both forms, gate-keeper included.  
* Test coverage is at least 80% with zero flaky/order-dependent tests.

---

## **🔄 Review & Buffer Checkpoint B**

**Goal:** Confirm Phase 2 and the first half of Phase 3 are actually solid before authentication and the capstone.

**Core Checklist**

* \[ \] Anki deck audit: retire any card you've gotten right 10 times in a row  
* \[ \] For each closed DSA gate (DSA-0 through DSA-12), solve one Medium problem from that gate under its original time bound — log a pass/fail for each  
* \[ \] Any gate marked "fail" above → add it back into your re-solve rotation for the next 2 weeks  
* \[ \] Draw your current backend project's module dependency map on paper — check for any layer that imports something it shouldn't  
* \[ \] Fix any violations you find  
* \[ \] Take one full rest day with zero new material

**Stretch Tasks**

* \[ \] Re-run Project 1's full test suite once more, confirm nothing has broken

**Sprint Complete When...**

* Every DSA gate passes its re-test, or has been logged for extra review.  
* No architecture layer violations remain unfixed.

---

## **Sprint 14: Authentication \+ Capstone Unlock Check (BE-5)**

**Goal:** Add real JWT authentication, reason correctly about blocking calls inside async routes, and confirm the capstone is ready.

**Core Checklist**

* \[ \] Read FastAPI docs: Security Intro  
* \[ \] Read FastAPI docs: OAuth2 with Password (and hashing), Bearer with JWT tokens  
* \[ \] Read FastAPI docs: "Concurrency and async / await"  
* \[ \] Read jwt.io's "What is JSON Web Token?" page  
* \[ \] Build `POST /auth/register` — hash the password, create the user, return a `UserResponse`  
* \[ \] Build `POST /auth/login` — verify credentials, return `{"access_token": "...", "token_type": "bearer"}`  
* \[ \] Build a `get_current_user` dependency that decodes the JWT, looks up the user, raises 401 if invalid  
* \[ \] Protect all `/tasks/*` endpoints with `current_user: User = Depends(get_current_user)`  
* \[ \] Scope all task queries to the logged-in user only  
* \[ \] Decide and justify in writing (2–3 sentences): are your register/login routes `def` or `async def`, given bcrypt hashing blocks the event loop?  
* \[ \] Test: request `/tasks/*` with no token — confirm HTTP 401  
* \[ \] Test: request with a manually expired token — confirm HTTP 401, not a 500 error  
* \[ \] Test: request with a token signed using a different secret key — confirm HTTP 401  
* \[ \] Write pytest tests for all 3 rejection cases plus a successful authenticated request  
* \[ \] Run `mypy --strict` on all auth code — confirm zero errors

**Unlock Check**

* \[ \] Confirm DSA-12 is fully done (Sprint 13 boxes all checked)  
* \[ \] Confirm BE-5 is fully done (all boxes above checked)  
* \[ \] Both true → the Capstone is unlocked, move to Sprint 15

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#70 from Sprint 13, untimed, no notes

**Stretch Tasks**

* \[ \] Decode a token you generated using the jwt.io debugger tool

**Sprint Complete When...**

* All 4 auth tests pass, including all 3 rejection cases.  
* The `def`\-vs-`async def` justification is written.  
* Both unlock conditions for the Capstone confirmed true.

---

## **Sprint 15: Capstone Part 1 — Architecture & Backend**

**Goal:** Stand up the Job Application Tracker's data model, migrations, and core endpoints.

**Core Checklist**

* \[ \] Draw the capstone's architecture on paper or in draw.io before writing any code  
* \[ \] Define `User`, `Application` (id, user\_id, company, role, status enum, applied\_date, notes, updated\_at), and `StatusHistory` (append-only, immutable) models  
* \[ \] Write Alembic Migration 1: initial schema (`users`, `applications`, `status_history`)  
* \[ \] Write Alembic Migration 2: index on `applications.user_id` and `applications.status`  
* \[ \] Write Alembic Migration 3: add a nullable `withdrawn_reason` column to `applications`  
* \[ \] Write Alembic Migration 4: composite index on `status_history(application_id, changed_at)`  
* \[ \] Run all 4 migrations up and down cleanly  
* \[ \] Build `POST /auth/register` and `POST /auth/login`, reusing your BE-5 pattern  
* \[ \] Build `POST /applications`, `GET /applications` (with `status` and `company` filters), `GET /applications/{id}`, `PUT /applications/{id}`, `DELETE /applications/{id}` — all JWT-protected  
* \[ \] Build `POST /applications/{id}/transition` with a `{"to_status": "..."}` body  
* \[ \] In the service layer: validate every status transition — block invalid jumps like SAVED straight to OFFER  
* \[ \] Confirm `StatusHistory` has no update or delete endpoint  
* \[ \] In the service layer: explicitly block a user from accessing another user's applications, not just via a query filter  
* \[ \] Create the GitHub repo and write a README skeleton first, before finishing every feature

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#560 from Sprint 4 one more time, untimed, no notes

**Stretch Tasks**

* \[ \] Add a `notes` search/filter query param to `GET /applications`

**Sprint Complete When...**

* All 4 migrations run up and down cleanly.  
* All core endpoints work, status transitions are validated, and one user cannot see another's data.

---

## **Sprint 16: Capstone Part 2 — Analytics, Streaming Export, Testing, Deployment**

**Goal:** Add the analytics endpoints, ship a generator-backed streaming export, write a full test suite, and put the API live.

**Core Checklist**

* \[ \] Build `GET /analytics/funnel` — count of applications per status stage for the current user  
* \[ \] Build `GET /analytics/weekly-rate` — weekly counts using `DATE_TRUNC('week', applied_date)` in a single SQL query, not a Python loop  
* \[ \] Build `GET /analytics/response-rate` — percentage of APPLIED applications that reached SCREENING or beyond  
* \[ \] Build `GET /applications/export` using a generator function producing CSV rows, wired to FastAPI's `StreamingResponse`  
* \[ \] Seed ≥5,000 application rows and verify via `sys.getsizeof` or a load test that the export's memory footprint stays flat as row count grows  
* \[ \] Write service unit tests: all transition rules, response-rate math, weekly-rate bucketing with known fixture data, and the export generator's row-by-row behavior  
* \[ \] Write route integration tests: full CRUD, invalid transition returns 422, cross-user access returns 403  
* \[ \] Write repository integration tests against a test PostgreSQL schema  
* \[ \] Run `pytest --cov=app` — confirm at least 80% line coverage  
* \[ \] Run `mypy --strict` — confirm zero errors  
* \[ \] Create a Render account and set up managed PostgreSQL  
* \[ \] Add the Alembic migration run to your deploy script or start command  
* \[ \] Deploy the FastAPI app to Render  
* \[ \] Confirm the app is reachable at a public URL and every endpoint responds correctly

**Light Day (built into this Sprint)**

* \[ \] One full rest/Anki-only day  
* \[ \] Re-solve LC \#322 from Sprint 13, untimed, no notes

**Stretch Tasks**

* \[ \] Add a simple rate limit to the auth endpoints reusing your Project 1 sliding-window logic

**Sprint Complete When...**

* All 3 analytics endpoints work correctly and the weekly-rate query is one SQL statement, not a loop.  
* The export endpoint streams via a generator and its flat memory footprint is verified.  
* Test coverage is at least 80%.  
* The app is live at a public URL and fully functional there.

---

## **🔄 Review & Buffer Checkpoint C — Sprint 17: Final Polish & Wrap-Up**

**Goal:** Document everything, confirm nothing has quietly broken, and close out the plan.

**Core Checklist**

* \[ \] Write the full capstone README: architecture diagram, endpoint docs with example requests/responses, ER diagram, status pipeline explanation, complexity notes for the weekly-rate and funnel queries, and a short note on why the export endpoint streams instead of materializing  
* \[ \] Pin both Project 1 and the Capstone on your GitHub profile  
* \[ \] Record a short walkthrough video or demo of the capstone  
* \[ \] Sweep this entire document top to bottom — confirm every single box from Sprint 0 through Sprint 16 is checked  
* \[ \] Pick 3 random DSA gates and re-solve one Medium problem from each, timed, at the original bound — confirm all 3 still pass  
* \[ \] Anki: final full deck review

**Stretch Tasks**

* \[ \] Write a one-page personal retrospective: which gate took longest, which gate-keeper problem taught you the most, what you'd do differently next time

**Sprint Complete When...**

* Every box in this document, from Sprint 0 onward, is checked.  
* Both projects are live, documented, and pinned.  
* All 3 randomly re-tested Medium problems pass.

