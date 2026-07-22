# Dialect-Modify E2E Robustness Specification

**Spec version**: V2
**Status**: signed (2026-07-22)
**Change**: `modify-e2e-extensible`
**Council review V1→V2**: blind 3/3 needs-changes, convergent findings. This domain absorbs finding 9 (naming the `ContractFake` read oracle distinctly from `committedTree()` in REQ-DMR-02). REQ-IDs 01-03 kept stable in identity — no new IDs in this domain.

## Purpose

QA hardening of the existing TS-dialect modify e2e (Tier B, `dialect-modify.e2e.test.ts` / S-002), scoped per council ruling to three fixes with verified technical grounding. Two originally-proposed fixes (no-op modify cell; multi-file build isolation) and one originally-blanket fix (rejection-capture standardization beyond the four canonical flows) are narrowed out of this change and registered as followups (see Followups). **Deviation note**: the proposal's Success Criteria listed five QA fixes; this spec formalizes the PM council's binding narrowing to three in-scope + two dropped-to-followup + one scope-narrowed — see the return envelope's Deviations section.

## Requirements

### REQ-DMR-01: Coalescing IR-op-count assertion

The chained-ops coalescing flow (S-002 Flow 1/2) MUST assert, in addition to the existing golden-byte comparison, that exactly one directive was buffered and committed for the chain.

**Pinned mechanism** (verified by direct code read this session): `test/support/ir-transcript.ts`'s `captureRun` is NOT usable here — its `normalizeDirective` recognizes only `create`/`copyIn` and throws for any other op (ITC-05 "zombie tripwire"), so it throws on a `modify` directive before it can return a transcript. The assertion MUST instead route through `src/testing/index.ts`'s `runFactoryForTest`, whose `RunResult.emitted: Batch[]` exposes one `Batch` per `emit()` call — asserting on `emitted.length` and/or `emitted[0].instructions.length` gives the op-count without touching `ir-transcript.ts`.

#### Scenario REQ-DMR-01.1: A two-op chain commits exactly one modify directive

- GIVEN `ts.find("a.ts").addImport(...).modify(...)` run via `runFactoryForTest`
- WHEN the run completes
- THEN `result.emitted` contains exactly one `Batch`, whose `instructions` array contains exactly one `modify` directive

### REQ-DMR-02: Awaited partial-mutation-throw atomicity

When an awaited op throws partway through mutating the live AST, the run MUST commit nothing for that path.

**Classification** (verified by direct code read this session): **assert-existing**, not a probe of unspecified behavior. `src/core/context.ts`'s `defineFactory` documents an explicit "All-or-nothing contract (ADR-01)": any thrown error routes to `session.discard()` before rethrow, never a partial commit. `dialect-handle.ts`'s `#invokeContained`/`#chain` guarantee the throwing op's directive is never buffered — the buffering step (`#ensureOpen()`) sits after the awaited call that threw and is never reached on that path. This requirement asserts that already-guaranteed property at the e2e seam; it MUST NOT be treated as new behavior to build.

#### Scenario REQ-DMR-02.1: A throwing op's target file is byte-unchanged and nothing commits

**Finding 9 resolved**: the assertion uses TWO distinctly-named oracles — `fake.committedTree()` (the post-commit view) and `fake.read(path)` (`ContractFake`'s own public pre-run/staging read path, independent of `committedTree()`) — never conflating the two under one name.

- GIVEN a seeded file and a `.modify(fn)` callback that mutates the AST then throws
- WHEN the run is awaited and rejects
- THEN `fake.committedTree()` is empty AND `fake.read(path)` — a separate oracle from `committedTree()` — resolves to the target's original seeded bytes, unchanged

### REQ-DMR-03: Deterministic rejection capture, four canonical flows only

The "no stray `unhandledRejection`" assertion on the four canonical flows this capability's React mirror also exercises (chain-coalesce, order-invariance, mid-chain-split, forgotten-await) MUST NOT rely on a real-time delay (`setTimeout`) to give a stray rejection a chance to surface. It MUST use a scheduler-order-safe primitive that deterministically flushes pending microtask/macrotask work the run's promise chain could still schedule. This standardization is scoped to these four flows only — it is NOT a blanket change across every e2e in the suite (the suite has dozens of pre-existing `setTimeout`-based waits outside this scope).

#### Scenario REQ-DMR-03.1: No stray unhandledRejection, asserted without a timed wait

- GIVEN an unawaited throwing `.modify()` chain (S-002 Flow 4's throwing case)
- WHEN the run rejects and the harness flushes pending scheduler work deterministically (no `setTimeout`)
- THEN no `unhandledRejection` event fired during the run

## Followups (registered, out of scope for this change)

| Item | Reason out of scope | Status |
|---|---|---|
| No-op modify cell (zero-directive assertion for a true no-op) | PM scope ruling narrowed the QA hardening set for this L change; not essential to the extensibility proof | pending-change |
| Multi-file build isolation (a chain on file A must not affect file B's committed content) | Same PM scope ruling | pending-change |
| Blanket deterministic rejection-capture across every e2e (beyond the four canonical flows) | Same PM scope ruling — standardization scoped to mirrored flows only in this change | pending-change |
| Full structured-op parity: TS's `addFunction`/`addVariable`/`addClass`/`removeImport`, and any additional React ops, each as Tier-A rows per dialect | Declared honest gap per fit-42 (REQ-DCF-02); tracked, not implemented this change | pending-change |
| e2e for `rename`/`replaceContent`/`delete` operators | Out of scope per triage/proposal — future XS/S increments on this seam | pending-change |
| `.jsx` dialect support | Pre-existing follow-up already tracked in `src/dialects/react/index.ts`'s own doc comment; not introduced by this change | pre-existing |
