# Slices: Stage 1 — IR Bedrock

**Triage**: L · **Spec version**: V2 (signed) · **Total slices**: 7 (no walking skeleton)
**Revision**: 4 — plan-verify iteration 3 answers inlined (`verify-plan-3.md`, Judge B
questions; owner-authorized 4th gate iteration); self-contained wording only, no re-slicing.
(Rev 3: `verify-plan-2.md` · Rev 2: `verify-plan-1.md`.) RED-posture labels per the spec's
four-posture taxonomy (cross-cutting note 7): [must-fail-first] ·
[characterization-RED-waived] · [RED-PHASE-GATE] · [permanent-fixture].
**Test invocation**: single file `bun test <path>` · full suite `bun test` · typecheck
`bunx tsc --noEmit`. RED gating = run the named file, observe failure, then implement GREEN.

## Walking Skeleton Decision

**No S-000.** The spine already exists — `foundations-skeleton` (archived) and
`typed-options-and-read` (#2, merged, 188 tests) proved the full author→factory→fake→tree
path end-to-end. Stage 1 hardens correctness rules on that existing thread (force threading,
fail-closed, cap, round-trip, port guard); it creates no new path to walk. Precedent: #2 also
shipped without a skeleton slice.

---

## S-1.3: Move gains `force?` + fail-closed collision + self-move identity

**Scope**: happy-path · **Dimension**: R (Rule — force-override precedence dominates; force
threading is the rule's toggle) · **Covers**: REQ-KIT-03.1–.3, REQ-FAKE-04.m1–.m4,
REQ-FAKE-07.1–.3 · **Requires**: nothing · **Test layers**: unit + integration

**Acceptance**: REQ-KIT-03.1–.3, REQ-FAKE-04.m1–.m4, REQ-FAKE-07.1–.3 (all pass).

### Tasks
- [x] RED [must-fail-first]: `test/fake/move-fail-closed.test.ts` (FAKE-04.m1–m4 — m4 identity is new behavior, fails red against today's silent-overwrite fake); KIT-03.1–.3 force scenarios in the existing unit-test files (paths verified in-repo; no `force` surface on `move` exists today): KIT-03.1 free-function→factory threading in `test/skeleton/directive-factory.test.ts`; KIT-03.2 both handle forms (`WritableHandle.move` + `FoundHandle.move`) in `test/skeleton/handle-chaining.test.ts` (home of the existing rename/copy force chaining tests); KIT-03.3 force-omitted rows in both files
- [x] RED [must-fail-first]: `test/fake/modify-existence.test.ts` — ALL THREE FAKE-07 scenarios are NEW tests authored red-first (today's fake silently materializes modify-of-nonexistent; the file does not exist). 07.1 stays red until the fix; 07.2/.3 must pass once the staging-aware existence check lands (07.3 kills the seed-only mutant)
- [x] GREEN: `wire.ts` (`move.force?`), `directive-factory.ts` (`MoveArgs.force?`), `base-handle.ts` (`WriteOps.move` opts), `commons/index.ts` (free `move` + both `.move`)
- [x] GREEN: `contract-fake.ts` part (a) — move fail-closed + `dst===src` identity exclusion; modify-existence check (staging-aware)
- [x] Regenerate FIT-04 `.d.ts` baselines (commons.index, core.base-handle, core.handle-state) — mechanism: `bun run build` (tsc -p tsconfig.build.json → `dist/**/*.d.ts`), then copy each dist file over its committed baseline (`dist/commons/index.d.ts` → `test/fitness/dts-baseline/commons.index.d.ts`, `dist/core/base-handle.d.ts` → `core.base-handle.d.ts`, `dist/core/handle-state.d.ts` → `core.handle-state.d.ts`). No regen script exists today — document this exact invocation in the FIT-04 test header while touching it. Keeps FIT-04 green immediately (moved here from design's 1.6 grouping; deviation noted below)

---

## S-1.4: Batch cap contract (`BATCH_CAP_BYTES`) + content-type pin + empty-batch pin

**Scope**: edge-case · **Dimension**: R (Rule) · **Covers**: batch-cap REQ-01.1–.3, REQ-02.1,
REQ-03.1 · **Requires**: S-1.3 (contract-fake.ts sequencing) · **Test layers**: integration +
contract

**Acceptance**: batch-cap REQ-01.1–.3, REQ-02.1, REQ-03.1.

### Tasks
- [x] RED [must-fail-first]: `test/fake/batch-cap.test.ts` + `test/fake/batch-cap-fixtures.ts` (`batchOfSerializedBytes`) — REQ-01.1–.3, no cap check exists today. Boundary semantics: serialized size EXACTLY equal to `BATCH_CAP_BYTES` → ACCEPTED; strictly greater (`> BATCH_CAP_BYTES`) → REJECTED. Fixtures target `BATCH_CAP_BYTES` and `BATCH_CAP_BYTES + 1` serialized bytes
- [x] [characterization-RED-waived]: `test/types/wire-content-string.test.ts` — REQ-02.1 `expectTypeOf` string pin (wire types already declare `string`; prove+freeze)
- [x] GREEN: `wire.ts` — `BATCH_CAP_BYTES = 4 * 1024 * 1024` (value pinned by ADR-0019; SDK-chosen placeholder, provenance clause applies — cheap to change until Stage 6 freeze); `contract-fake.ts` part (b) — cap check at `emit` rejects when `Buffer.byteLength(JSON.stringify(batch), 'utf8') > BATCH_CAP_BYTES`
- [x] [characterization-RED-waived]: `test/skeleton/write-only-factory.test.ts` empty-batch commit-spy (REQ-03.1 — zero production change; prove+freeze)
- [x] Docs: create **ADR-0019: batch-cap contract** (unit = UTF-8 bytes of the serialized `Batch` via `Buffer.byteLength(JSON.stringify(batch),'utf8')`, text-only v1, fake enforces at `emit`, `BATCH_CAP_BYTES` single constant, provenance clause — SDK-chosen value, cheap to change until Stage 6 freeze) — full draft in design.md §4.5, lands in `openspec/decisions/0019-batch-cap-and-text-wire.md`; append ADR-0017 self-move Amendment

---

## S-1.7: JSON round-trip fidelity + paths verbatim + conflict order

**Scope**: edge-case · **Dimension**: R (Rule) · **Covers**: boundary REQ-01.1, REQ-02.1–.3,
REQ-03.1, REQ-04.1–.2 · **Requires**: S-1.4 · **Test layers**: integration

**Acceptance**: boundary REQ-01.1, REQ-02.1–.3, REQ-03.1, REQ-04.1–.2.

### Tasks
- [ ] RED [must-fail-first]: `test/fake/boundary-pass-through.test.ts` — REQ-01.1 + REQ-02.1–.3: round-trip mismatch reject, silent-drop family (function/undefined/Symbol), stringify-throw family (BigInt/circular). No round-trip exists in today's fake
- [ ] [characterization-RED-waived]: same file — REQ-03.1 path-verbatim (pins today's pass-through, scoped to the emitted wire directive) + REQ-04.1–.2 conflict-order (pins today's eager array-order apply)
- [ ] GREEN: `contract-fake.ts` part (c) — `emit` JSON round-trip compare
- [ ] Verify REQ-01.1 false-rejection guard + REQ-03/04 characterization rows pass unchanged

---

## S-1.1: Golden fixtures freeze — move-force, chained programs, determinism

**Scope**: happy-path · **Dimension**: D (Data — six ops × force variants, chained combos) ·
**Covers**: REQ-GIR-01, REQ-GIR-02, REQ-GIR-03 · **Requires**: S-1.7 (fixtures freeze the
finalized wire) · **Test layers**: unit + integration

**Acceptance**: REQ-GIR-01, REQ-GIR-02, REQ-GIR-03.

### Tasks
- [ ] RED [must-fail-first]: move force-present fixture in `fixtures.ts`/`golden-ir.test.ts` (GIR-01 — cannot pass until force lands); `test/golden-ir/chained-batch.test.ts` (GIR-02, new fixture shape). GIR-01 force-absent fixtures are [characterization-RED-waived] pins of existing shapes
- [ ] [characterization-RED-waived]: `test/golden-ir/determinism.test.ts` (GIR-03) — byte-equal double-run + committed golden string; determinism pre-exists, prove+freeze
- [ ] Fix phantom ADR-0028 → ADR-0013/0017 citations in `fixtures.ts`/`golden-ir.test.ts`

---

## S-1.5/1.6: Double-fault preservation + housekeeping batch

**Scope**: edge-case · **Dimension**: P (Path — failure-path variant of commit-discard;
housekeeping items carry no dimension, no REQ ceremony) · **Covers**: REQ-10.1–.3 ·
**Requires**: nothing · **Test layers**: integration (unmocked) + inspection

**Acceptance**: REQ-10.1–.3; housekeeping verified by suite-green + inspection only.

### Tasks
- [x] RED [RED-PHASE-GATE]: `test/skeleton/double-fault.test.ts` REQ-10.2 fails against today's `context.ts` (transient — historical once the fix lands); REQ-10.1 is [must-fail-first] (E2 replaces E1 today, `cause` never attached); REQ-10.3 contrast row is [characterization-RED-waived] (normal-discard path already propagates E1)
- [x] GREEN: `context.ts` — try/catch around `discard()`, attach E2 as `E1.cause`, re-throw E1; verify REQ-10.1/.3
- [x] Housekeeping (no REQ): W7 unconditional `.d.ts` rebuild in `fit-04-dts-semver-gate.test.ts` (while touching it, document the baseline-regen invocation — `bun run build` then copy `dist/**/*.d.ts` over `test/fitness/dts-baseline/*` per the S-1.3 task; no script exists); fix phantom ADR-0028 cite in `test/skeleton/directive-factory.test.ts`
- [x] Housekeeping (no REQ): harden `permissive-proof.guard.test.ts` — intent + done-bar per `openspec/pending-changes.md` JD row (verbatim): "derive the red-proof simulated line from `idiom2Lines[0]` instead of hardcoded 57; tighten `parseDiagnostics` regex / `fileMatch` for path-collision robustness (theoretical)". Concretely: (a) simulated line derived from `idiom2Lines[0]`, not literal 57; (b) tightened `parseDiagnostics` regex + `fileMatch` (endsWith). Done = both changes in `permissive-proof.guard.test.ts`, guard suite green
- [x] Housekeeping (no REQ): `test/conformance/meta.test.ts` — drop the tautological `[red-proof]` LABEL only (pending-changes row: "drop the tautological `[red-proof]` label"); pure label cleanup, no assertion removed or replaced
- [x] Housekeeping (no REQ): reconcile `objectives-plan.md` (item 1.4 wording, Coverage O1 row 6, D8 decision-table row). **Direction**: `objectives-plan.md` conforms to the RATIFIED decisions — owner ruling 2026-07-04, D8/ADR-0019 override the stale "enforced at Session.flush" text; the code/design side is authoritative, the plan text is what changes

---

## S-1.8: FIT-09 structural `EngineClient` port guard

**Scope**: edge-case · **Dimension**: R (Rule) · **Covers**: REQ-FIT-09 (4 scenarios) ·
**Requires**: nothing · **Test layers**: architectural

**Acceptance**: REQ-FIT-09 — planted-bypass flagged; `contract-fake.ts` allow-listed clean;
`Directive`/`JsonValue`-only imports clean; `commons`/`conformance` index clean.

**Naming reconciliation (spec cross-cutting note 1 — both intentional, not a typo)**: the
stable REQ-ID is **REQ-FIT-09** (the FIT domain's REQ sequence ends at REQ-FIT-08), while the
FILE is `test/fitness/fit-10-engine-client-port-guard.test.ts` (file-count convention — the
`fit-09-*` filename is already claimed by `fit-09-pkg-exports-resolution.test.ts`, which
tests REQ-PKG-01). Cite REQ-FIT-09 everywhere; never invent a "REQ-FIT-10".

**Mechanism (design, FIT-09 section)**: FIT-08-style static string scan — `readFileSync` +
regex over `src` sources; reachability = the file textually references the `EngineClient`
symbol, and the `.emit(`/`.commit(`/`.discard(` call-site scan runs ONLY inside such files
(kills the bare-EventEmitter false positive); path allow-list = exactly
`test/support/contract-fake.ts`; red-proofs = string fixtures, never committed poisoned
modules (structural `implements EngineClient` exception rejected as spoofable).

### Tasks
- [x] Create `test/fitness/fit-10-engine-client-port-guard.test.ts`: `scanPortBleed` predicate per the mechanism above. Production-scan + allow-list + `Directive`/`JsonValue`-exempt scenarios are naturally red until the file is authored, then permanently green
- [x] [permanent-fixture]: planted-bypass red-proof as a string-fixture test (FIT-01/FIT-08 style) — stays in the suite forever, never a committed poisoned module

---

## S-1.9: Test pyramid codification + author-to-tree e2e

**Scope**: happy-path · **Dimension**: P (Path — the one true e2e; REQ-01–03 are doc/CI rules
riding along) · **Covers**: pyramid REQ-01–04 · **Requires**: S-1.3 (soft — force end-state
assertion; see note) · **Test layers**: architectural + e2e

**Acceptance**: pyramid REQ-01–04.

### Tasks
- [x] [characterization-RED-waived]: `test/e2e/author-to-tree.e2e.test.ts` — happy path + move-with-force golden end-state (REQ-04; characterization through a new test file per the spec's pyramid RED note)
- [x] [must-fail-first (naturally red until authored)]: `test/pyramid/pyramid-codification.test.ts` — doc-table + CI-coverage structural checks (REQ-01–03)
- [x] Modify root `CONTRIBUTING.md` — four-layer→directory table + verb/dialect decision table. **Canonical doc-table schema (design §1.9 + pyramid REQ-01/02 — what the structural test asserts)**: layer table columns `[Layer | Directory | Runs without engine? | Example test]` with exactly the 4 fixed rows (unit / fitness / integration / e2e); contribution decision table columns `[Contribution type | Layer(s) | Home]` (row subjects: new verb / new fitness invariant / cross-module behavior / full author story). The structural check in `pyramid-codification.test.ts` asserts the headers + the 4 layer rows exist — not free-form prose; executor authors the row contents per that schema
- [x] Read-only check: `.github/workflows/ci.yml` already covers every mapped dir

---

## Build Order

1. S-1.3 → S-1.4 → S-1.7 → S-1.1 (strict sequence — shared `contract-fake.ts` bottleneck)
2. S-1.5/1.6, S-1.8 — independent, parallelizable with the chain above
3. S-1.9 — independent per PM classification; soft-depends on S-1.3 for the force end-state e2e assertion

No FIT-04 file race between the parallel groups: W7 (S-1.5/1.6) modifies the FIT-04 TEST
itself (`fit-04-dts-semver-gate.test.ts` — unconditional build-before-compare, removing the
mtime gate) and writes NO baseline files; S-1.3 alone regenerates the 3 committed baselines
under `test/fitness/dts-baseline/`. Disjoint files → safe to run in parallel.

## Coverage Check

19/19 REQ-IDs mapped, no orphans, no duplicates: S-1.3 (3) + S-1.4 (3) + S-1.7 (4) + S-1.1 (3)
+ S-1.5/1.6 (1) + S-1.8 (1) + S-1.9 (4) = 19.

## Deviations From Design's File-Changes Grouping (flagged, not silent)

1. **FIT-04 `.d.ts` baseline regen** (3 files) moved from design's grouping-column "1.6" into
   **S-1.3** — per explicit slicing instruction, so FIT-04 stays green immediately after the
   surface change lands rather than red until housekeeping.
2. **REQ-FAKE-07 (modify-existence)** kept in **S-1.3** per its own File-Changes row (test file
   + REQ-ID both tagged 1.3), despite the `contract-fake.ts` row's prose parenthetical placing
   "modify existence" under part (c)/1.7 — read as: the 1.7 round-trip pass revisits that code
   path, it does not move REQ ownership.
3. **S-1.9's "independent" tag** is honored for DAG purposes (no hard blocking edge), but its
   e2e asserts a move-force end-state — a real soft dependency on S-1.3 surfaced above rather
   than buried.
