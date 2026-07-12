# Specs Summary: stage-5b-dialect-breadth

**Spec version**: V2
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-5b-dialect-breadth`
**Triage**: L

Delta specs live under `specs/{domain}/spec.md`. This file is an index + cross-domain notes;
it is not itself a delta and carries no REQ-IDs of its own.

## Domains Affected

| Domain | File | New version | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|---|
| `typescript-dialect` | `specs/typescript-dialect/spec.md` | V4 → V5 | 4 (TSD-08..11) | 2 (TSD-01, TSD-04) | 0 |
| `dialect-generics` | `specs/dialect-generics/spec.md` | V3 → V4 | 2 (DG-06, DG-07) | 1 (DG-02) | 0 |
| `modify-coalescing` | `specs/modify-coalescing/spec.md` | V3 → V4 | 1 (MC-08) | 0 | 0 |
| `dialect-conformance` | `specs/dialect-conformance/spec.md` | V4 → V5 | 3 (DC-06..08) | 0 | 0 |
| **Total** | | | **10** | **3** | **0** |

Scenario count (V2, all scenarios currently in the delta specs): 47 across the four domains
(TSD 26, DG 13, MC 4, DC 4 — DG-02.2's edit of an existing scenario counted once). No REQ-ID
was added or removed by the V1→V2 pass; REQ-DG-07 is the only NEW REQ-ID this version
introduces (DG-* family: 06 → 07).

## V1 → V2 Changelog

V2 incorporates owner ruling #4 (post-spec-V1) and the nine-item council feedback gap list, in
full — no items deferred.

| # | Source | Change | Landed in |
|---|---|---|---|
| Ruling #4.1 | Owner | Op signatures ratified — removed "proposed, subject to confirmation" note | `typescript-dialect` REQ-TSD-01 |
| Ruling #4.2 | Owner | Add-op collision namespace pinned: value-namespace + import bindings; `type`/`interface` exempt | `typescript-dialect` REQ-TSD-09/10/11 (+ scenarios 09.7, 09.8) |
| 1 | Council | Deliberate-reject passthrough — contained error rethrown verbatim, never double-wrapped | `dialect-generics` REQ-DG-06 (+ scenario 06.5) |
| 2 | Council | Fail-closed after any reject — zero batches, chained op surfaces original rejection | `dialect-generics` REQ-DG-07 (new) |
| 3 | Council | `removeImport` RYOW (add-then-remove same chain, one directive, byte-identical to seed) | `typescript-dialect` REQ-TSD-08 (+ scenario 08.6) |
| 4 | Council | Reserved handle-name guard (`then`/`read`/`modify`/`raw`) | `dialect-generics` REQ-DG-02 (+ scenario 02.5) |
| 5 | Council | Characterisation baseline non-normative note (LWW pinned RED-phase evidence, not a shipped contract) | `modify-coalescing` REQ-MC-08 |
| 6 | Council | REQ-TSD-01.1 exact-set assertion (`toEqual`, never subset) + cut-lever coupling note | `typescript-dialect` REQ-TSD-01.1 |
| 7 | Council | DAS-01.1 guard-flip scheduling (row 138) | This file, Debt Riders table |
| 8 | Council | REQ-DG-06 leak budget (`.cause` absent, no ts-morph internals) + zero-batches on async reject | `dialect-generics` REQ-DG-06.1/06.2 |
| 9 | Council | Registry deliverable encoding as verify-final + archive-gate obligation | This file, Verification Obligations |

## Owner Policy Pins Embodied (traceability)

| Pin | Landed in |
|---|---|
| Row-136: `.modify()` after open AST op → REJECT `dialectError` | `modify-coalescing` REQ-MC-08 |
| `removeImport` of absent import → idempotent no-op | `typescript-dialect` REQ-TSD-08.4 |
| `removeImport` RYOW of an import added earlier in the same chain → one directive, byte-identical to seed | `typescript-dialect` REQ-TSD-08.6 |
| Add-op on existing same-name declaration → REJECT `dialectError`, cross-kind | `typescript-dialect` REQ-TSD-09.3/10.3/11.3 |
| Add-op collision namespace: value-namespace + import bindings; `type`/`interface` exempt (ruling #4) | `typescript-dialect` REQ-TSD-09/10/11 |
| Op signatures ratified, no further confirmation needed (ruling #4) | `typescript-dialect` REQ-TSD-01 |
| Reckoning bar: S-D/S-F class non-cuttable; addVariable/addClass cuttable, own REQ-IDs | REQ-TSD-09 (non-cuttable) vs REQ-TSD-10/11 (cuttable, separable) |
| Pack topology: one shipped pack + test-suite-only colliding fixture | `dialect-generics` REQ-DG-02 (MODIFIED description + REQ-DG-02.4) |
| Reserved base-handle vocabulary collision (`then` et al.) | `dialect-generics` REQ-DG-02.5 |
| `runOp` async containment (row 137) | `dialect-generics` REQ-DG-06 |
| Deliberate-reject passthrough, no double-wrap | `dialect-generics` REQ-DG-06.5 |
| Fail-closed run semantics after any rejection | `dialect-generics` REQ-DG-07 |
| Conformance tail (adversarial samples / leaf / real-base-dialect) | `dialect-conformance` REQ-DC-06/07/08 |
| Print-failure containment (row 140) | `typescript-dialect` REQ-TSD-04 (MODIFIED, scenario 04.2) |

## Debt Riders — No REQ Coverage (deliberate, not an omission)

Per the council acceptance seed ("give minimal REQ coverage only where behaviour is
author-observable; internal refactors need no REQs"):

| Pending row | Disposition |
|---|---|
| 138 — DAS-01.1 negative-guard broadening | **No REQ change; scheduling pinned (council feedback #7).** REQ-DAS-01.1 already requires the doc name ONLY real exports; its "(e.g. `removeImport`)" text is a non-normative illustrative example of what was unshipped at V3, not part of the tested assertion. Once `removeImport` ships, documenting it is PERMITTED, not forbidden — the REQ holds unchanged. The doc content flip itself is an apply-time task: `test/docs/security-authoring-guard.test.ts`'s "doc never names removeImport (unshipped)" assertion MUST flip to "doc SHOULD name it" IN THE SAME SLICE that ships `removeImport` (REQ-TSD-08) — landing the op without flipping the guard goes red on the wrong axis (the guard, not the feature). `dialect-authoring-standards` stays intentionally NOT one of this change's four Modified Capabilities. |
| 139 — TSD-04.1 own-property/stack sweep internals | **No REQ.** Executor-latitude refactor of `getSyntacticDiagnostics` internals; the author-observable contract (REQ-TSD-04) is unchanged. |
| 141 (kept half) — batch-grouping annotation-or-assert, `Session.isPending()` | **No REQ.** Both are kit-internal (test-authoring hygiene; a perf-motivated rename of `pendingSnapshot()` call sites never reaches the author-facing surface). |
| 145 — memoized-getter closure-ref clear | **No REQ.** Memory-only fix, visible only in in-process harnesses, not an author-observable behaviour change. |
| 146 — `deepEqual` extraction to kit-internal shared module | **No REQ.** No public symbol; internal dedup. Flagged for an architecture-baseline refresh at archive time (proposal risk table), not a spec REQ. |

## REQ-ID Family Continuation

`REQ-TSD-*` continues from 07 (V4 frozen) → 08..11. `REQ-DG-*` continues from 05 (V3 frozen) →
06..07. `REQ-MC-*` continues from 07 (V3 frozen) → 08. `REQ-DC-*` continues from 05 (V4 frozen) →
06..08. No existing REQ-ID renumbered or reused; REQ-DG-07 is the sole new ID assigned in V2
(next available after V1's REQ-DG-06).

## Call-Signature Decisions — RATIFIED (owner ruling #4)

The five new op call signatures (`removeImport`, `addFunction`, `addVariable`, `addClass`) were
V1's proposed shape, matching `addImport`'s minimal positional-args rhythm. Owner ruling #4
(2026-07-12, post-spec-V1) RATIFIES them as pinned — no further design/council confirmation is
required. `typescript-dialect` REQ-TSD-01's non-normative note carries the historical trace.
The exact `dialectError` message tails for REQ-TSD-09/10/11's collision reject and REQ-MC-08's
modify-conflict reject remain proposed text pending design/sign-off confirmation — unchanged by
ruling #4, which addressed call signatures only.

## Verification Obligations (council feedback #9)

Two items are `sdd-verify --mode=final` success criteria AND an `sdd-archive` pre-archive-gate
checklist item — not loose design edits, because the on-disk sensitive-areas registry is
already provably stale once and this change is exactly the kind of drift that would let it
stay stale a second time:

1. **Sensitive-areas registry promotion**: `openspec/sensitive-areas.md`'s `security (code
   execution)` row for `src/core/dialect-handle.ts` MUST be promoted from `confidence: medium`
   to `confidence: high` on archive — this change is the second consecutive change to touch
   that seam directly (BOM/encoding hoist deferred, but the collision diagnostic, `runOp`
   containment, and modify-reject all land here).
2. **Stale "Review Required" paragraph fix**: the registry's "Review Required" prose (dating
   from before this change's sensitivity overrides were confirmed) MUST be corrected to reflect
   the CURRENT state, not the pre-explore state, before archive.

`sdd-verify --mode=final` checks both are done; `sdd-archive`'s pre-archive checklist blocks on
either being outstanding.

## Sensitive Areas

No unflagged sensitive area surfaced — all touched REQs fall under `security (code execution)`,
`security (third-party trust)`, and `public-api (contract)`, all three already flagged at
triage. Per-domain coverage tables are in each delta file.
