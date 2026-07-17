# Verification Report — react-dialect

**Change**: `react-dialect`
**Mode**: final (Strict TDD) · **Iteration**: 4
**Spec version**: V8 (`specs/react-dialect/spec.md`, owner-signed 2026-07-17) + V2 (`specs/local-consumption/spec.md`, owner-signed 2026-07-16)
**Commit under verification**: `7eeb36c` · **Delta since iteration 3**: `9a1c23c..7eeb36c` (spec V7+V8, judgment-day fix iterations 1+2, round-3 state records)
**Triage**: L · sensitive-area override in effect (security / code-execution HIGH) · Branch `feat/react-dialect`, working tree clean

---

## Verdict

### `pass-with-followups`

Code is exactly at spec V8. `isValueNamespaceClaimed` (react/ops.ts:156-164) adopts ADR-0039's
`assertNoCollision` value-namespace predicate **verbatim** (five checks: `getFunction` /
`getVariableDeclaration` / `getClass` / `getEnum` / `getModule`; `type`/`interface` exempt), ORed
with V7's file-wide import-specifier scan via `boundNamesIn` — the combined CLAIMED is a strict
**superset** of the TypeScript dialect's own import-collision coverage, not an approximation.
Full suite **1860 pass / 0 fail** reproduced by me in a fresh `/private/tmp` worktree of `7eeb36c`
(the exact claim to beat), zero environmental timeouts. Step 11b code audit over the delta: **0
gating** (no Bug/Architecture/MAJOR). I reproduced the two headline TDD kill-count claims myself.

The token is `pass-with-followups`, **not** `pass`, and this is the **CORRECT** token — the same
ruling iteration 3 established and the state mirror pins: `sdd-archive/SKILL.md:44` accepts BOTH
tokens; Step 9 (SKILL.md:392-417) registers followups into `project/pending-changes` **only** on
`pass-with-followups` and **explicitly skips** that step on `pass`. Reporting `pass` with the
followup ledger open would silently drop every tracked followup. **Do NOT upgrade to `pass`.**

**`adversarial_review`: `required`** (triage L AND sensitive area, both triggers fire) — **and
already DISCHARGED**. Judgment-day ran BLIND three rounds and reached **APPROVED** at `0ec177c`
(round 3, both judges clean of CRITICALs and real WARNINGs, suite 1860/0). This verify pass is the
comprehensive re-establishment over the post-judgment-day delta; the blind gate that Step 11b
Stage B flags does not need to run again.

---

## Iteration history — the record of why this change is trustworthy

| Iter | Commit | Verdict | What happened |
|---|---|---|---|
| **1** | `f12ffba` | **`fail`** | Gated on ONE item while four blind Council personas independently found **four real `addImport` correctness bugs it had missed**. The failure was the verify pass itself, not the code. Recorded in `council-findings.md`. Routed → spec V5 + nine-item fix pass. |
| **2** | `01ecec7` | **`pass-with-followups`** | After spec V5 + the nine-item fix. All nine items independently reproduced; Step 11b clean; suite 1824/0; TDD adherence pass. Surfaced **F-1** (`eval`/`arguments` accepted → invalid emission) plus six further followups F-2..F-7. |
| **3** | `9a1c23c` | **`pass-with-followups`** | Spec **V6** closed F-1's contract hole; verified RESOLVED (48/48 exact, both directions; V6 completeness attacked with ~194.7M parser probes and upheld). **The archive-token lesson**: the verifier refused a false launch-prompt premise ("archive requires `pass`") and cited `sdd-archive/SKILL.md` — `pass-with-followups` is the correct archive-ready token when followups remain; upgrading to `pass` would silently drop them. F-2..F-7 open + new Nit F-8. |
| **judgment-day** | `0ec177c` | **APPROVED** (round 3) | Mandatory BLIND adversarial gate (L + sensitive), 3 rounds, 2 fix iterations. **R1**: 3 real `addImport` defects (1 CRITICAL type-only silent no-op; cross-module dup; aliased silent no-op) + 2 confirmed (echo truncation; `find('.tsx')` vs JSDoc) → spec **V7** (claimed-name unification) + fix iteration 1. **R2**: CRITICAL confirmed — V7's claimed check scanned only import declarations, missing the VALUE NAMESPACE; 8/8 declaration kinds emitted duplicate bindings, and the correct predicate (`assertNoCollision`) already sat 20 lines below TS's own `addImport`, ADR-0039-ratified, unused → spec **V8** (adopt ADR-0039) + fix iteration 2 (9-kill guard vs 6-7 floor). **R3**: both judges clean; 2 unconfirmed SUGGESTIONs registered as followups, not fixed; reserved-word completeness re-swept against node's parser; suite 1860/0. |
| **4** | `7eeb36c` | **`pass-with-followups`** (this report) | Comprehensive re-establishment over `9a1c23c..7eeb36c` (V7+V8 + 9 fix commits). Code confirmed exactly at V8. Suite 1860/0 reproduced in a fresh worktree. Step 11b clean. Both TDD kill-count claims reproduced by me. Followup ledger consolidated into §9 so archive registers all of it. |

Iteration 1's lesson binds every iteration since: **a verify pass that trusts the apply record is
how four bugs got past iteration 1.** Every number below was taken by me.

---

## 1. Concentration point 1 — the spec is V8; is the code exactly V8?

**Result: YES — code is at V8, and `isValueNamespaceClaimed` genuinely adopts `assertNoCollision`.**

REQ-RXD-05's CLAIMED definition is the UNION of two syntactic, SourceFile-wide predicates:

- **V7 half (import specifiers)** — `boundNamesIn` (react/ops.ts:101-127) collects every local
  name a declaration binds across default/namespace/named clauses, tagging `kind`/`aliased`/
  `valueBound`. The `claimed` check (ops.ts:219-221) scans ALL import declarations, any module,
  value-bound or type-only alike. This is **broader** than the TS dialect's `assertNoCollision`
  import half (which only inspects named-import bindings): react also catches default, namespace,
  aliased, and type-only local-name collisions file-wide.
- **V8 half (value namespace)** — `isValueNamespaceClaimed` (ops.ts:156-164) returns
  `getFunction(name) !== undefined || getVariableDeclaration(name) !== undefined ||
  getClass(name) !== undefined || getEnum(name) !== undefined || getModule(name) !== undefined`
  — **byte-for-byte the same five checks** as `assertNoCollision`'s value-namespace half
  (`typescript/ops.ts:55-64`), including the `enum`/`namespace` additions ADR-0039 folded in at
  its own round 1. `type`/`interface` are **absent** from both predicates → exempt, matching the
  ADR-0039 carve-out and REQ-RXD-05.17. This is genuine adoption, not an approximation.

Scenarios 05.11–05.18 (new since iteration 3) each trace to a real, executed, discriminating test
in `test/dialects/react/ops.test.ts` — I confirmed them by NAME in live runner output during the
mutation probes below (05.11–.15 + 2 near-miss under the V7-half describe block; 05.16 the 8-kind
battery [function/const/let/var/class/enum/namespace/export-default-function], 05.17 the
type/interface negative boundary, 05.18 the tail-echo bound — all present and green in the 1860/0
suite). `claimedNameTail` (reject-tail.ts:71-77) routes `name` through `elementNameEcho` (100-char
marked bound), not `boundedFragment` (16-char hostile cap) — REQ-RXD-05.18's fix, confirmed in
source.

---

## 2. Concentration point 2 — REQ coverage over the full spec

**Result: all 15 REQ-IDs + REQ-LC-01..03 behaviourally covered and green; one open traceability
nit (F-2), non-gating.**

Both spec files (`react-dialect` V8, `local-consumption` V2) trace to the design's Test Derivation
table (§4.6) and to real tests. The full suite (1860/0) exercises every REQ. The V7/V8 cycle added
05.11–05.18, 09.6 (widened in place) — all present as named, discriminating tests (verified via the
kill-count probes in §5). No REQ-ID is untested at runtime.

Traceability nit **F-2** (open since iteration 2, verified still present): `ops.test.ts` has a
scenario titled `REQ-RXD-11.5` that implements 11.6, a stale "Deviation" comment, and REQ-RXD-06.8
/ 11.6 / 15.1 / 15.2 appear nowhere **by ID** in `test/`. All four behaviours ARE tested and
passing → traceability, not `req-coverage-gap`. **Non-gating.** Carried forward (§9).

---

## 3. Concentration point 3 — design conformance + ADR-01 zero-diff

**Result: File Changes match the delta; ADR-01's zero-diff on `src/dialects/typescript/**` HOLDS
after both fix rounds.**

- `git diff --stat main..7eeb36c -- 'src/dialects/typescript/'` → **empty**. ADR-01's standing
  contract survives V7 + V8. The V8 fix READ `assertNoCollision` to adopt its shape; it did not
  modify that file. Confirmed independently, not trusted from the apply record.
- `main..HEAD` src changes are confined to exactly the five files in `design.md` §4.2:
  `src/core/jsx-name-validator.ts`, `src/core/reject-tail.ts`, `src/dialects/react/{ast,index,ops}.ts`.
  No new source file, no scope creep. Docs (`authoring-a-dialect.md`, `README.md`, `docs/README.md`,
  `docs/quickstart.md`) and tests all match design §4.2 rows.
- **Documented deviations** (coherent, not violations): `reject-tail.ts` grew `zeroMatchTail`/
  `multiMatchTail`/`claimedNameTail`/`elementNameEcho` beyond design §4.2's `nameRuleTail`+
  `boundedFragment` listing — but §4.4's "Amended post-council ARCH-3" note and the V7/V8 spec
  changelogs document each; `isValueNamespaceClaimed` is a new private fn inside the design-listed
  `ops.ts`. All within design-listed files, all documented inline.

---

## 4. Concentration point 4 — Step 11b code audit (GATING) over the delta

**Stage A — code audit (`pre-pr` mode, per `code-audit.md`), scoped to `9a1c23c..7eeb36c`.**

| Group | Check | Result |
|---|---|---|
| G1 | 1.1/1.2 spec drift / coverage gap | ➖ n/a (`spec_source: internal` — the spec IS the upstream) |
| G1 | 1.3 REQ-ID test coverage | ✅ 05.16/.17/.18 + 09.6 cited by ID in `ops.test.ts`/`docs.test.ts`, discriminating (§5) |
| G2 | 2.1 layer violations | ✅ `isValueNamespaceClaimed` is inside a dialect leaf (ts-morph allowed there); `reject-tail.ts` additions import no AST lib; fit-37 (core AST-free) green in suite |
| G2 | 2.2 ADR contradictions | ✅ delta consistent with ADR-01 (TS zero-diff confirmed), ADR-02 (chokepoint intact; `claimedNameTail` routes through `reject-tail.ts`), ADR-05 (structured `addImportDeclaration`/`addNamedImport` path preserved) |
| G2 | 2.3 sensitive area uncovered | ✅ security/code-execution area covered by REQ-RXD-05/06 + the V8 collision reject |
| G2 | 2.4/2.5 SSOT / standards | ✅ none |
| G3 | 3.1 untyped casts | ✅ none in the delta (`git diff` scan: no `as any`/`as unknown`/`as never`) |
| G3 | 3.2/3.3 magic numbers / TODO / eslint-disable | ✅ none (the 100-char `ELEMENT_NAME_ECHO_CAP` is a named, documented const) |
| G3 | 3.4 dead duplicates | ➖ `isValueNamespaceClaimed` deliberately mirrors `assertNoCollision`'s predicate — V8 MANDATES adoption verbatim; parallelism, not copy-paste. (The **shared-hoist** question is a registered followup, not this change's call — ADR-01 peer-module split at dialect #3.) |
| G4 | 4.1 scope creep | ✅ every delta file is in `design.md` §4.2; TS dialect untouched |
| G4 | 4.3 migration risk | ➖ n/a (additive, no schema) |

**Findings: 0 gating.** No `Bug`, no `Architecture`, no `MAJOR`.

**Stage B — `adversarial_review`: `required`** (L + sensitive). **Already discharged** — judgment-day
APPROVED at round 3 (see iteration history). No re-run needed before archive.

---

## 5. Concentration point 5 — TDD Cycle Adherence for the two judgment-day fix iterations

**Result: PASS — I reproduced the two headline kill-count claims myself, in a fresh worktree,
reverting each mutation with a verified-clean `git diff`.**

The apply record claims genuine RED→GREEN for every behavioural fix (fix 1: 05.11–.15 + 2 near-miss
→ 4 fail against the old algorithm; fix 2: 05.16 battery ×8 + 05.18 → 9 fail/44 pass → 53/0; regex
self-test 2 fail → 84/0). Rather than trust the record, I ran mutation probes against the shipped
V8 code:

| Probe (in `/private/tmp` worktree of `7eeb36c`) | Result | Meaning |
|---|---|---|
| Neuter the **V8 value-namespace half** (`isValueNamespaceClaimed` → `return false`), run `ops.test.ts` | **9 fail / 44 pass** | Exactly the round-2 bar the apply record claims (8 value-namespace kinds + 05.18). 05.17's type/interface negative boundary correctly stayed GREEN. |
| Neuter the **V7 import-specifier half** (`claimed` import scan → `false && …`), run `ops.test.ts` | **6 fail / 47 pass** | 05.11, 05.12, 05.14, 05.15 + the 2 near-miss (type-only default/namespace) all die; 05.13 boundary correctly stays GREEN. |

Both halves of CLAIMED are backed by discriminating tests — neither is a 1-kill guard. Each probe
reverted (`git diff --stat` empty afterward). The apply record's own numbers (9 fail/44 pass →
53/0 for fix 2; genuine RED for fix 1's live defects) are consistent with what I observed.

**Near-miss-mutant amendment: honoured.** Fix 2's RED is a plausible-wrong-implementation probe
(pre-fix code actively SUCCEEDS emitting an invalid duplicate binding — a real behavioural bug
reproduced against node's ESM parser per the spec preamble), not an absence mutant. Fix 1's live
defects (type-only silent no-op, cross-module dup, aliased no-op) were genuine RED against the old
algorithm.

**Disclosed carry-forward (unchanged, still audited, not downgraded by attrition):** the S-002
Strict-TDD ordering violation (impl written in the same editing pass as tests; RED proven
retroactively via body-stub + exact-op-set probes) remains DISCLOSED in `apply-progress.md`. It was
disposed correctly at the time (verify-in-loop-4 flagged it; the apply record self-corrected in
place); it does not taint the V7/V8 delta, which had genuine or near-miss RED throughout.

**TDD Cycle Adherence for this delta: PASS.**

---

## 6. Concentration point 6 — followup-ledger audit

**Result: COMPLETE in aggregate — every followup is recorded — but several items lived ONLY in the
orchestrator-owned state mirror (`.sdd/state/react-dialect.json`) and NOT in a home `sdd-archive`
Step 9 canonically reads. Consolidated into §9 below so none can die.**

Where each was found before this report:

| Followup | Recorded in (durable) | Recorded in (mirror only) |
|---|---|---|
| F-2..F-8 (iteration 3) | iter-3 verify-report §9 ✓ | — |
| Round-3 suggestion (1): set-key-safety scan heuristics (regex matches 4 hardcoded names; greedy `//`-strip) | — | `.sdd/state` `judgment_day` field only |
| Round-3 suggestion (2): self-alias `import { X as X }` + `addImport(X)` false-positive reject | — | `.sdd/state` `judgment_day` field only |
| DOC-3 (`dialect-handle.ts:178`) | state.yaml `archive_commitments` ✓, spec Notes ✓, iter-3 §8 ✓ | — |
| ARCH-2 (validator module placement) | state.yaml `archive_commitments` ✓ | — |
| Subprocess-timeout debt | state.yaml `archive_commitments` + `carry_forward` ✓ | — |
| Element-grammar capability gap (`$`, namespaces, non-ASCII) | — | apply-progress "did-not-touch" + `.sdd/state` `next_phase` only |
| `getAttribute` first-match | design/slices/council-findings (discussed) | `.sdd/state` `next_phase` only |
| SHARPENED TS-dialect `addImport` debt (can EMIT INVALID BINDINGS, distinct from injection item 22) | spec Notes-for-archive ✓ (thorough), state.yaml, `.sdd/state` ✓ | — |
| `.tsx`/`.jsx` fold-or-reaffirm rule | state.yaml `archive_commitments` ✓, spec Notes ✓ | — |
| TS-dialect trust-boundary JSDoc backfill | spec Notes-for-archive ✓, iter-3 §9 ✓ | — |
| REQ-RXD-11.5 wording amendment | **CLOSED** as of V5 (do not re-register) | — |

**Gap identified and closed by this report**: the two Round-3 suggestions, the element-grammar
capability gap, and `getAttribute` first-match were durable only in the orchestrator state mirror
— a followup that lives only in the mirror or a commit message is at risk if Step 9 reads the
verify-report. They are now written into §9 verbatim, alongside F-2..F-8 and the pre-existing
carry-forwards. The ledger is complete.

---

## 7. Build & Tests Execution

| Check | Result | Location taken |
|---|---|---|
| **Full suite** | **1860 pass / 0 fail**, 3980 expects, 181 files, 24.56s | fresh `/private/tmp` worktree of `7eeb36c`, `bun install` + `bun test` |
| Value-namespace-neuter probe | 9 fail / 44 pass (reverted clean) | same worktree |
| V7-import-half-neuter probe | 6 fail / 47 pass (reverted clean) | same worktree |
| `src/dialects/typescript/**` diff (ADR-01) | **empty** (0 lines) | `main..7eeb36c` |
| Delta src untyped-cast / TODO / eslint-disable scan | none | `9a1c23c..7eeb36c` |

**1860 = 1844 (prior trustworthy baseline) + 16 net new** (11 in `ops.test.ts` for 05.16–.18; 2 in
`docs.test.ts` for the V8 doc sentinel + regression; 3 in `name-validation.test.ts` for the
spaced/multiline regex self-test) — exactly the claim to beat, no unexplained delta. Zero
environmental timeouts; no timeout reported as a pass; none attributed to the change. Worktree
removed after the run.

**Environmental fact (unchanged, diagnosed prior):** the full suite is unreliable under
`~/Documents` (first-touch scanning inflates the first `tsc --noEmit` ~26×; NOT a code defect). The
`/private/tmp` number above is the trustworthy one.

---

## 8. Concentration point 7 — F-4 design-header staleness (non-gating)

Verified in the current tree: `design.md:3` still reads **`Spec: V4 signed`**. The spec is now
**V8** — the marker is now **FOUR versions stale** and compounding (iteration 3 flagged it at "two
versions stale"; V7 and V8 landed without a design-header touch). `design.md:4` still reads
`Revision: 2`. No property is at risk — §4.2 correctly lists every file the delta touched, which is
why §4's scope-creep check passes. **Non-gating.** F-4's fix (§9) must now bump `Spec: V4 signed`
→ `V8 signed` and `Revision: 2` → 3.

---

## 9. Followups for `sdd-archive` to register in `project/pending-changes`

Consolidated and complete (do NOT drop any — this is the Step-9 payload; `pass-with-followups` is
what makes Step 9 fire):

1. **F-2** — relabel the `ops.test.ts` scenario titled `REQ-RXD-11.5` → `REQ-RXD-11.6`; drop the
   stale "Deviation" comment; cite `06.8`/`11.6`/`15.1`/`15.2` by ID (behaviours tested, IDs
   missing → traceability). Non-gating.
2. **F-3** — `2079023`/`5749bf2` are non-building commits (consumer landed before producer). HEAD
   typechecks clean; affects `git bisect`/`apply-progress` item-9 map only. Squash-on-merge
   resolves it. Non-gating.
3. **F-4** *(widened this iteration)* — add `docs/README.md` + `docs/quickstart.md` to `design.md`
   §4.2; bump `Revision` 2 → 3; **and** bump the header `Spec: V4 signed` → **`V8 signed`** (now
   four versions stale, §8). Non-gating.
4. **F-5** — `design.md:138`'s "every react reject routes through `reject-tail.ts`, by construction"
   is not literally true (extension-gate rejects in `index.ts` + `ast.ts:75` throw fixed literals
   directly; they interpolate nothing, so no property is at risk). Reword to the accurate universal,
   or route the permitted path echo through a bounded helper. Non-gating.
5. **F-6** — spec V5's changelog description of *how* message/spec agreement was achieved is
   inaccurate; outcome correct. Suggestion.
6. **F-7** — ADR-02 `Status: Proposed` (`design.md:180`) though fully implemented and verified; flip
   to `Accepted` at archive. Suggestion.
7. **F-8** — the `assertNotReservedWord` message (and the constant name `IMPORT_RESERVED_WORDS`, and
   test assertions) call `eval`/`arguments` "reserved words" — the exact taxonomy V6 spends a
   paragraph refuting. Spec-CONFORMANT (06.9 requires naming "the reserved-word rule"), so not a
   defect. Widening the message (e.g. "reserved word or restricted in strict mode") touches 06.9's
   assertion → needs a spec touch, not a drive-by. Nit.
8. **Round-3 suggestion (1)** *(was mirror-only; consolidated here)* — set-key-safety static scan
   heuristics: the scan regex matches only 4 hardcoded variable names and the `//`-comment strip is
   greedy past string literals containing `//`. Test-only defense-in-depth; runtime code verified
   correct (`.has()`/`===`/`.includes()` only). Suggestion, unconfirmed.
9. **Round-3 suggestion (2)** *(was mirror-only; consolidated here)* — a self-alias
   `import { X as X } from "m"` + `addImport("X", "m")` produces a false-positive collision reject
   where a no-op would be ideal. SPEC-CONFORMANT (Step 1 requires UNALIASED; a self-alias is
   syntactically aliased), extremely rare, would need its own spec touch. Suggestion.
10. **Element-grammar capability gap** *(was mirror-only; consolidated here)* — `ELEMENT_NAME_GRAMMAR`
    does not admit `$`, JSX namespace (`svg:rect`), or non-ASCII component names. Capability limit,
    not a defect; register as a React op-catalog follow-up candidate.
11. **`getAttribute` first-match** *(was discussed-only; consolidated here)* — `setJsxProp`'s upsert
    uses ts-morph `element.getAttribute(propName)`, which returns the first match; behaviour is
    correct for well-formed JSX (duplicate attributes are already invalid), but the semantics
    deserve an explicit note in the op-catalog followup.
12. **SHARPENED TS-dialect `addImport` merge-defect debt** — `src/dialects/typescript/ops.ts:22-32`'s
    `addImport` matches ANY declaration by module specifier and merges unconditionally, no shape
    check — it almost certainly carries the full Defect-1/2/3 family PLUS the V8 value-namespace
    collision, and can **EMIT INVALID BINDINGS** on ordinary non-adversarial input (a correctness
    axis). This is DISTINCT from `pending-changes` item 22 (injection/splice-validation on `name`, a
    security axis) — register both, neither eclipsing the other (full framing in the spec's
    Notes-for-archive). Out of this change's triage scope (does not own `typescript/**`).
13. **TS-dialect trust-boundary JSDoc backfill** — `addFunction`/`addVariable`/`addClass`
    `source`/`initializer` args carry no REQ-RXD-12-equivalent trust note; backfill (distinct from
    item 22's validator retrofit).
14. **Default/mixed-import support** — react `addImport` is named-only (REQ-RXD-05.4); default/mixed
    imports are React op-catalog follow-up scope.
15. **`.tsx`/`.jsx` fold-or-reaffirm** — the `.jsx` row is ALREADY registered in
    `openspec/pending-changes.md` (owner-requested, mid-plan). At archive, fold it into the React
    op-catalog plan or reaffirm standalone — **never duplicate, never orphan**.
16. **DOC-3** — `could not parse "X" as TypeScript` hardcoded in the dialect-GENERIC
    `src/core/dialect-handle.ts:178`; `test/core/dialect-handle.test.ts:328` pins the wrong text. A
    correct fix threads a per-dialect display name through the shared seam — the engine change this
    change's triage excludes. Registered pending-change.
17. **ARCH-2** — `src/core/jsx-name-validator.ts` holds JSX grammars in a file-type-agnostic layer
    with one consumer. Not a rebuild: extend ADR-01's peer-module followup — at dialect #3, split
    `validatedOp`+`reject-tail` (genuinely core) from the JSX grammars (move to the leaf).
18. **Subprocess-timeout debt** — pre-existing, out of scope: subprocess-bound tests declare no
    explicit timeout against bun's 5000ms default. Fix = explicit per-test timeouts (~30 min), NOT a
    raised global timeout. Environmental companion: Defender real-time-scan exclusion for the repo /
    `.tmp-*/` scratch dirs.

**CLOSED (do NOT re-register):** REQ-RXD-11.5 wording amendment (closed at V5); F-1 (closed at V6).

---

## 10. Explicitly NOT re-opened

Per the briefing and iteration 3's settled ground: the security surfaces swept exhaustively in prior
rounds (unicode/confusables, `from` injection, ReDoS, prototype pollution, reserved-word
completeness — the last re-swept by TWO independent judges against node's real parser at round 3);
the CLOSED rulings in `council-findings.md`; the environmental subprocess-timeout debt (registered,
not a code defect). I attacked what CHANGED: the V7+V8 CLAIMED model, the `assertNoCollision`
adoption fidelity, the two fix iterations' TDD, and the followup ledger's completeness.

---

**One-line summary**: code confirmed exactly at spec V8 (`isValueNamespaceClaimed` adopts
ADR-0039's `assertNoCollision` verbatim; import half via `boundNamesIn` is a strict superset); ADR-01
TS-dialect zero-diff holds; suite **1860/0** reproduced in a fresh worktree; both fix-iteration
kill-count claims reproduced by me (9-kill value-namespace, 6-kill V7 import half); Step 11b clean;
adversarial gate already APPROVED (judgment-day round 3); the complete followup ledger consolidated
into §9 — **`pass-with-followups`, archive-ready. Do NOT upgrade to `pass`.**
