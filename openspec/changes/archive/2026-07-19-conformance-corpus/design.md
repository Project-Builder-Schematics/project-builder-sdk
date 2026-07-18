# Design: conformance-corpus

**Change**: `conformance-corpus` · **Triage**: L · **Spec**: V3 · **Design rev**: 2 · **Persona lens**: none

> **Spec-status note (risk, not a blocker here)**: V3 is unfrozen from a SIGNED V2 via an
> evidence-driven correction and is a DRAFT awaiting owner RE-SIGN (spec-summary.md). This design
> rev 2 is produced against V3 at the orchestrator's explicit direction; archive MUST gate on the
> V3 re-sign. See §4.11 risks.
> **RESOLVED**: V3 RE-SIGNED by owner 2026-07-18 (spec-summary.md Status line) — this gate is
> satisfied; the note above is retained as history only.

## 4.1 Architecture Overview

Supplies a static fixture corpus under `conformance/` at repo root — `corpus.json` +
`collection.json` marker + five fixtures — consumed cross-repo by the engine's Go harness (pinned
git submodule) which drives each `factory.ts` through the REAL runner
(`dist/bin/pbuilder-runner.js`). This repo ships DECLARATIONS (manifest + factory +
seed/expected/schematic data); every runner-driven outcome is engine-authoritative (REQ-CFX-11).
The only in-repo executable surface is a fail-closed structural self-check running under `bun test`.
Factories author exclusively through the public source umbrella `../../src/index.ts` (which
`export *`s the commons verbs); they are loaded from source by Bun and sit OUTSIDE `bun run build`
output (`tsconfig.build.json` `rootDir:"./src"` + `include:["src/**"]`).

**Architectural seam** (ADR-0063): a new root-level, cross-repo-consumed static-contract directory —
no such shape exists in the baseline. Additive (nothing existing changes) but net-new, so ADR-worthy
and forces a post-build baseline refresh. A second, SDK-runner-driven seam (ADR-0067): the corpus
must carry a `collection.json` package-anchor marker or every runner-driven fixture invocation fails
before its factory runs — an SDK requirement the engine's Go loader is unaware of.

## 4.2 File Changes (contract with sdd-slice)

Per-fixture rows consolidate their leaf inventory (manifest/factory/seed/expected/schematic) — leaf
content is pinned in `conformance-fixtures` REQ-CFX-05..09 + the handoff. **PR split**: PR#1 =
m1-vehicle + all scaffolding (corpus.json=`["m1-vehicle"]`, `collection.json`, self-check,
.gitattributes, README); PR#2 = the four m2-* + their corpus.json entries. m1-vehicle is the walking
skeleton.

| Path | Action | Purpose (REQ-IDs) |
|---|---|---|
| `conformance/corpus.json` | Create | registry `{wireSpecVersion:1, fixtures:[…]}` (CCR-01/03/07) |
| `conformance/collection.json` | Create | presence-only package-anchor marker, PR#1 scaffolding (CCR-08, ADR-0067) |
| `conformance/README.md` | Create | on-ramp + 4-way disambiguation (CCR-06, §4.3b) |
| `conformance/m1-vehicle/**` | Create | handshake+schematic; factory+manifest+schematic/+expected/ (CFX-05/12/13) |
| `conformance/m2-modify/**` | Create | wire-mutation; +seed/+expected/ (CFX-06/13) |
| `conformance/m2-delete/**` | Create | wire-mutation, 3-entry seed, 3 cases (CFX-07/13) |
| `conformance/m2-rename-move/**` | Create | wire-mutation, rename verb, 3 cases (CFX-08/13) |
| `conformance/m2-create-composition/**` | Create | composition+schematic; default modify + `createRejectProbe` named export (CFX-09/12/13); manifest gated on engine schema-delta sign-off (ADR-0065) |
| `.gitattributes` | Create | `* eol=lf` repo-wide (CDT-01/02) |
| `test/support/conformance-fixture-loader.ts` | Create | corpus/manifest loader + TS shapes (§4.3) shared by the self-check |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | Create | the self-check (CSC-01..06, CDT-03..07, CFX-01/02/03/04 structural) |
| `CONFORMANCE-CORPUS-HANDOFF.md` | Modify | append PROPOSED case-level `factory` schema delta (ADR-0065) |
| `openspec/pending-changes.md` | Modify | retire the `.gitattributes eol=lf` followup row |
| `tsconfig.json` | Read-only | NO `exclude` added — `conformance/**/*.ts` sweeps into typecheck (ADR-0066) |
| `tsconfig.build.json` | Read-only | `rootDir:./src`+`include:src/**` already exclude conformance from `dist` (CFX-14) |
| `src/index.ts` | Read-only | umbrella every factory imports (CFX-01) |
| `src/transport/wire-protocol.ts` | Read-only | `WIRE_PROTOCOL_VERSION` — source of the wireSpecVersion pin (CCR-07) |
| `package.json` | Read-only | `files`/`exports` exclude `conformance/`; `engines.bun` pin for CSC-05 |

## 4.2b Flow Changes

**Not applicable — no user-facing runtime surface in this repo.** The corpus is static data consumed
by an external Go harness; the runner drive-path executes only when the ENGINE spawns it (out of this
repo's control, REQ-CFX-11). The sole in-repo "flow" is the self-check suite assertion — a test, not
a product flow. No e2e rows follow (all Test Derivation rows are `architectural`/`contract`/`unit`).

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `conformance/` (new root layer) | new | net-new cross-repo static-contract corpus | **deviates** → ADR-0063 |
| runner package-anchor (`resolvePackageRoot`, `src/core/context.ts`, ADR-0046) | extend (satisfied, not modified) | corpus supplies the `collection.json` ancestor the runner unconditionally requires | aligns → ADR-0067 |
| commons author surface (`src/commons`, via `src/index.ts`) | extend (read-only) | every factory authors through the public umbrella | aligns |
| transport runner (`src/transport/runner.ts`, `bin/pbuilder-runner.ts`) | extend (exercised, not modified) | engine drives fixtures through the real runner | aligns |
| fitness test layer (`test/fitness/**`, `test/support/**`) | extend | self-check joins the existing fit-NN idiom | aligns |
| build/typecheck config (`tsconfig*.json`) | extend (no edit) | factories sweep into typecheck, stay out of `dist` | aligns |

`architecture_impact` derives from the single `new`/`deviates` row (a component introducing a
structure the baseline lacks) → **additive** (§4.10). ADR-0067 is an `aligns` row — the corpus
SATISFIES an existing runner precondition, it does not change the runner.

## 4.3 Data Model (self-check validation shapes — `test/support/conformance-fixture-loader.ts`)

```ts
type WireMethod = "tree.read" | "ir.emit" | "ir.commit" | "ir.discard";
interface Corpus { wireSpecVersion: number; fixtures: string[]; }
interface FactoryPointer { module: string; export: string | null; }
interface Outcome {
  exitCode: number; emitRejectionCode: string | null;
  failedIndex: number | null; writtenPaths: string[];
}
interface Transcript {
  callbacks: WireMethod[]; singleCommit: boolean;
  forbidDiscard: boolean; emitBeforeCommit: boolean;
}
interface Case {
  name: string; greetingVersion?: number;
  seed: string | null; expected: string; // dir | "zero-effect" | "empty"
  factory?: FactoryPointer;               // per-case override (see ADR-0065; PROPOSED schema delta)
  outcome: Outcome; transcript: Transcript;
}
interface Manifest {
  id: string; wireSpecVersion: number;
  class: "handshake" | "wire-mutation" | "composition";
  factory: FactoryPointer; input: unknown;
  lowering: { mode: "none" | "schematic"; schematicRoot?: string };
  cases: Case[];
}
```

**Frozen transcript values (per REQ-CFX-13, corrected V3)**: every reject-twin's `callbacks[]` ENDS
in `ir.discard` (not a halt at the rejected `ir.emit`) with `forbidDiscard: false`, because
`defineFactory`'s catch (`src/core/context.ts` ~339-361) runs `session.discard()` on ANY
`fn`/`flush`/`commit` rejection and `Session.discard()` issues `ir.discard` via the client. Positive
cases + `greeting-mismatch-twin` (decided pre-`defineFactory`, no session) pin `forbidDiscard: true`.
`m2-create-composition/wire-create-reject-twin` is FROZEN to the emit-branch `[ir.emit, ir.discard]`
per ADR-0064 (the create reaches emit before rejection). `collection.json` is a presence-only marker
with NO schema — the loader shape above never parses it (ADR-0067).

## 4.3b README Content Plan (REQ-CCR-06)

`conformance/README.md` first paragraph MUST establish, as an on-ramp for a new fixture author:
(a) **what this is** — the submodule-consumed live SDK↔engine corpus — with a four-way
disambiguation from the three same-named neighbours it is UNRELATED to: root `conformance/` (this
corpus) vs `src/conformance/**` (the published dialect-conformance kit, ADR-0012) vs
`test/fake/conformance-corpus.ts` (fake-engine unit scenarios) vs `test/e2e/author-emulation/corpus/`
(SDK-internal e2e); (b) **honesty boundary** — QUOTED or directly derived from REQ-CFX-11, never
independently paraphrased (runner-driven outcomes are engine-authoritative, first proven engine-side);
(c) **authoring conventions** — CFX-01 umbrella-only import rule, CFX-02/03 representable-ops-only +
the single `createRejectProbe`, CDT byte/eol rules; (d) **how-to-add-a-fixture checklist** mirroring
EXACTLY what fit-40 enforces — list in `corpus.json`, `id == dirname`, `factory.module` +
`collection.json` marker resolve, transcript + outcome per case, `wireSpecVersion` match; (e) the
harmless `no schema.json found` stderr warning note (REQ-CFX-11 informative note — expected, not a
defect). fit-40 asserts the README names both `conformance/` and `./conformance` (REQ-CCR-06.1).

## 4.4 Interface Contracts

No runtime/API interface changes in this repo. The corpus files ARE the interface — a data contract
consumed by the engine's loader. The self-check exposes no public export (a `bun test` file). The
`wireSpecVersion` pin reads the existing `WIRE_PROTOCOL_VERSION` constant; no new export is added.
**Cross-repo contract deltas** (both flagged to the engine team): (1) `conformance/collection.json`
presence — invisible to the Go loader, mandatory for the SDK runner (ADR-0067); (2) a PROPOSED
case-level `factory` override in `manifest.json` — the Go loader must resolve a per-case
`factory.export` pointer; HARD GATE on engine sign-off before authoring
`m2-create-composition/manifest.json` (ADR-0065).

## 4.5 Architecture Decisions

### ADR-0063: Root `conformance/` as a new cross-repo static-contract layer
**Status**: Proposed
**Context**: The corpus is a submodule-consumed contract with no baseline analog; the closest shape
(`test/e2e/author-emulation/corpus/`) is SDK-internal under `test/`. Placing it at repo root is fixed
by the engine's loader (accept-as-contract).
**Decision**: Introduce `conformance/` at repo root as a net-new architectural layer, kept OUT of
`package.json#files`/`#exports` and out of `dist`; disambiguated from the published `./conformance`
kit via README (CCR-06).
**Consequences**: (+) satisfies the engine's fixed submodule path; (+) zero packaging collision. (−)
a second corpus root in the repo (naming adjacency risk, mitigated by README). (+) triggers the
mandatory post-build baseline refresh.
**Alternatives**: `src/conformance/` — rejected, collides with the ADR-0012 published kit and would
enter `dist`. Under `test/` — rejected, the engine's loader path is repo-root-fixed.

### ADR-0064: `wire-create-reject-twin` outcome triple = exit 2 / `unrepresentable` / null (frozen)
**Status**: Proposed
**Context**: REQ-CFX-09's design-blocking precondition — does a factory-authored wire `create` get
rejected CLIENT-SIDE before emit (AuthoringError `authoring-rejected` → exit 1) or AT emit (engine
`unrepresentable` → exit 2)? Resolving it also freezes REQ-CFX-13.4's dual-branch transcript.
**Decision**: **Exit 2**. Traced from the RUN BOUNDARY: `pbuilder-runner`
(`src/transport/runner.ts:309-310`) UNCONDITIONALLY builds `packageDir = dirname(<factory URL>)` and
calls `defineFactory(fn, {packageDir})`; `resolvePackageRoot` (`src/core/context.ts:144-162`) walks
upward for a `collection.json` ancestor — ABSENT one it throws `AuthoringError{invalid-input}` →
origin `authoring-rejected` → **exit 1** BEFORE `fn` runs (this is the REQ-CCR-08 failure, NOT the
twin's rejection). With `conformance/collection.json` present, resolution succeeds and ONLY THEN does
`fn` run: the public `create()` verb (`src/commons/index.ts:193-203`) with inline `template` buffers
a representable-at-SDK `{op:"create"}` directive with NO pre-emit check (the sole pre-emit `create`
reject is `readTemplateFile`'s `invalid-input`, which an inline-content probe never triggers);
`Session.flush` emits the batch; `StdioEngineClient` reconstructs the host's batch-level
`EmitRejection{code:"unrepresentable"}`; `unrepresentable`→reason `unrepresentable-content`→origin
`write-rejected` (`src/core/authoring-error.ts:111-114`); `classifyExitCode`
(`src/transport/exit-codes.ts:22-25`) returns **2**. Triple = `(2, "unrepresentable", null)`;
transcript FROZEN to `[ir.emit, ir.discard]` (REQ-CFX-13.4 emit branch). **Conclusion: exit 2 HOLDS,
conditional on REQ-CCR-08's marker** — the handoff's exit-2 claim is satisfiable as written; no
cross-repo escalation (REQ-CFX-09.3's exit-1 branch does not fire).
**Consequences**: (+) the twin's manifest freezes to concrete values, clearing the fail-closed
placeholder; (+) lifts REQ-CFX-03 clause (d)'s "ahead of the ADR" hedge — the DO-NOT-COPY header may
now name exit 2 (§4.7). (−) exit-2 is a DECLARATION; first runner-driven proof is engine-side
(REQ-CFX-11). (−) the whole triple is contingent on `collection.json` landing in PR#1.
**Alternatives**: exit 1 (authoring-time) — rejected, no SDK layer rejects a representable inline
`create` pre-emit; the exit-1 path belongs to a MISSING marker (REQ-CCR-08), a different failure.

### ADR-0065: Per-case `factory` override for the multi-behaviour composition fixture
**Status**: Proposed
**Context**: `m2-create-composition` must carry TWO behaviours in ONE fixture — a positive `modify`
and a `wire-create-reject-twin` that emits a raw wire `create` (REQ-CFX-02's sole exception) — but
the handoff's manifest schema pins ONE fixture-level `factory` and offers NO per-case discriminator.
The handoff is UNDERSPECIFIED for this shape. Verified non-viable alternatives: (1) two fixtures —
the handoff FORBIDS it (twins are cases on the SAME fixture); (2) input-branching one default export
— also needs a schema extension AND puts a create path inside the positive factory, muddying the
CFX-02/03 representable-ops quarantine. The umbrella boundary (ADR-0009) also blocks the handoff's
`currentContext().session.buffer` alternative: it resolves into `src/core/**`, unavailable through
`../../src/index.ts` without breaching REQ-CFX-01.
**Decision**: Extend the schema with a per-case `factory` override (§4.3). The positive case uses the
DEFAULT export (`modify`); `wire-create-reject-twin` selects a SEPARATE named export
`createRejectProbe` (public `create()`, the compliant path, sufficient — representable-at-SDK,
rejected-at-engine per ADR-0064) carrying the DO-NOT-COPY header (REQ-CFX-03). Its PRICE is a
shared-schema divergence from the handoff, paid by: (a) amending `CONFORMANCE-CORPUS-HANDOFF.md`'s
manifest-schema section with the case-level `factory` field marked **PROPOSED — requires
engine-loader support + sign-off before the submodule pin advances** (this design MAKES that edit);
(b) a **HARD GATE**: engine sign-off on the schema delta BEFORE `m2-create-composition/manifest.json`
is authored in PR#2 (a wrong mechanism means re-authoring the fixture); (c) fit-40's
one-create-corpus-wide scan pins the probe as the single create site.
**Consequences**: (+) create stays quarantined in a marked, separate export; (+) umbrella-only
invariant holds. (−) introduces a schema field beyond the handoff — the engine loader must honor it,
gated on sign-off. (−) blocks PR#2's composition manifest until the engine confirms.
**Alternatives**: input-branching / two fixtures — rejected above. Naming it `wireCreateRejectProbe`
— rejected (TW): "wire" falsely implies a raw bypass the ADR rejects; it authors a legitimate public
`create()`, hence `createRejectProbe`.

### ADR-0066: Structural self-check as one fitness file; typecheck sweep; corpus.json-derived inventory
**Status**: Proposed
**Context**: Self-check depth (owner-endorsed structural-only), placement, tsconfig treatment,
wireSpecVersion pin, AND the inventory-count cadence (green at PR#1's 1 fixture AND PR#2's 5/12) are
all design's to wire.
**Decision**: (1) ONE new file `test/fitness/fit-40-conformance-corpus-integrity.test.ts` (fit-24/28
idiom), no runner spawn — the named fail-closed verifier for CSC-01..06 + CDT-03..07 + CFX-01/02/03/04
structural invariants; behavioral runner-replay is a registered followup. (2) NO tsconfig `exclude`
for `conformance/**` — factories sweep into `bun run typecheck`, a required-green gate proving each
factory typechecks against the public umbrella. (3) wireSpecVersion pinned by IMPORTING the leaf
constant `WIRE_PROTOCOL_VERSION` (`src/transport/wire-protocol.ts` — a zero-import pure-constants
module) and asserting `corpus.json` + every manifest equal it (CCR-07). (4) The **inventory check is
DERIVED FROM `corpus.json#fixtures`** — every listed id has a complete landed artefact set AND 0
orphan directories — so it is GREEN at BOTH checkpoints: PR#1 (`["m1-vehicle"]`, 1 fixture / 2 cases)
and PR#2 (5 fixtures / 12 cases). The ABSOLUTE 5-fixture/12-case count is asserted ONLY when
`corpus.json` lists 5 (post-PR#2 gate); it MUST NOT be evaluated against the PR#1 state (REQ-CCR-05).
**Consequences**: (+) one discoverable verifier; (+) typecheck catches factory API misuse pre-merge;
(+) fit-40 stays green at PR#1 without a false 5/12 failure. (−) a strict-mode typecheck error in any
factory now fails the whole suite.
**Alternatives**: dedicated `test/conformance-corpus/` cluster — rejected, breaks the fit-NN idiom.
`exclude` conformance from typecheck — rejected, forfeits the free factory-correctness gate. Absolute
5/12 count unconditionally — rejected, red at PR#1's legitimate 1-fixture state.

**Note — REQ-CCR-07 file-path**: pin target is `WIRE_PROTOCOL_VERSION` in
`src/transport/wire-protocol.ts` (the transport greeting version), DISTINCT from
`Batch.protocolVersion` in `src/core/wire.ts` (IR field). Both `1`; do not conflate.

### ADR-0067: `collection.json` package-anchor marker — single shared ancestor
**Status**: Proposed
**Context**: `src/transport/runner.ts:309-310` UNCONDITIONALLY passes `packageDir` to
`defineFactory` for every fixture; `resolvePackageRoot` (`src/core/context.ts:144-162`, ADR-0046)
walks upward for a `collection.json` ancestor and throws `AuthoringError{invalid-input}` (exit 1,
before `fn`) when none exists. The handoff never mentions this file — without it EVERY runner-driven
fixture invocation fails before its factory runs, silently defeating the corpus.
**Decision**: Ship a SINGLE `conformance/collection.json` at the corpus root (the shared ancestor of
all fixtures), presence-only (content ignored, never parsed). Consumption direction: corpus (data) →
runner (`resolvePackageRoot`) → core — the SDK reads it, never the engine's Go loader
(engine-loader-INVISIBLE, flagged for engine awareness). REQ-CSC-02 asserts its presence once per
self-check run; REQ-CCR-03 lists it as PR#1 scaffolding.
**Consequences**: (+) every fixture resolves `conformance/` as its `packageRoot`; (+) one file, one
File-Changes row, one self-check assertion. (−) an SDK-side coupling absent from the outbound handoff
— documented as a cross-repo awareness item (changes nothing engine-side).
**Alternatives**: per-fixture `collection.json` (mirroring the `test/fixtures` per-fixture precedent)
— rejected: 5 identical marker files vs 1 shared ancestor, more bytes and more determinism surface
for zero benefit since `resolvePackageRoot` stops at the FIRST ancestor and `conformance/` already is
one. Omit it and let the engine add it — rejected: it is an SDK-runner precondition, the SDK owns it.

## 4.6 Test Derivation (one row per REQ-ID; scenarios share the verifier unless noted)

| REQ-ID | Scenario ref | Level | Test |
|---|---|---|---|
| REQ-CCR-01 | .1/.2 | architectural | fit-40 › layout+corpus.json schema |
| REQ-CCR-02 | .1/.2 | architectural | fit-40 › 3 hard-failure invariants |
| REQ-CCR-03 | .1 | contract | PR#1-gate script (one-time, not suite) |
| REQ-CCR-04 | .1 | contract | commit-range script (one-time, not suite) |
| REQ-CCR-05 | .1/.2/.3 | architectural | fit-40 › corpus.json-derived inventory (green PR#1 1-fixture + PR#2 5/12); absolute 5/12 post-PR#2 only |
| REQ-CCR-06 | .1 | architectural | fit-40 › README names both surfaces |
| REQ-CCR-07 | .1/.2 | architectural | fit-40 › wireSpecVersion === WIRE_PROTOCOL_VERSION |
| REQ-CCR-08 | .1/.2 | architectural | fit-40 › `collection.json` present + resolves as ancestor for every fixture (ADR-0067) |
| REQ-CFX-01 | .1/.2 | architectural | fit-40 › import allow-list scan |
| REQ-CFX-02 | .1 | architectural | fit-40 › exactly-one-create corpus-wide (`createRejectProbe`) |
| REQ-CFX-03 | .1 | architectural | fit-40 › DO-NOT-COPY 5-clause header present (§4.7) |
| REQ-CFX-04 | .1/.2 | architectural | fit-40 › outcome-triple consistency |
| REQ-CFX-05 | .1/.2 | unit | fit-40 › m1-vehicle declared artefacts |
| REQ-CFX-06 | .1/.2 | unit | fit-40 › m2-modify declared artefacts |
| REQ-CFX-07 | .1/.2 | unit | fit-40 › m2-delete declared artefacts |
| REQ-CFX-08 | .1/.2 | unit | fit-40 › m2-rename-move declared artefacts |
| REQ-CFX-09 | .1/.2/.3 | unit | fit-40 › m2-create-composition triple frozen (ADR-0064); unresolved-placeholder → fail |
| REQ-CFX-10 | .1 | architectural | fit-40 › zero-effect vs empty distinctness |
| REQ-CFX-11 | .1/.2 | contract | fit-40 › README/success-criteria honesty markers |
| REQ-CFX-12 | .1/.2 | architectural | fit-40 › writtenPaths pins per case |
| REQ-CFX-13 | .1/.2/.3/.4 | architectural | fit-40 › transcript object + callbacks table (twins end in ir.discard) |
| REQ-CFX-14 | .1 | contract | `bun install --frozen-lockfile && bun run build` (PR gate) + fit-40 › no conformance in dist |
| REQ-CSC-01 | .1/.2 | architectural | fit-40 › loader 3-rule mirror |
| REQ-CSC-02 | .1/.2/.3 | architectural | fit-40 › seed/expected/schematic/factory + `collection.json` resolution |
| REQ-CSC-03 | .1/.2 | architectural | fit-40 › manifest+transcript+outcome schema |
| REQ-CSC-04 | .1 | architectural | fit-40 › triple consistency (tool-level) |
| REQ-CSC-05 | .1 | architectural | fit-40 › Bun-pin assertion (SHOULD, kept failing) |
| REQ-CSC-06 | .1/.2 | architectural | fit-40 › runs under `bun test`, non-zero on any CSC/CDT violation |
| REQ-CDT-01 | .1 | architectural | fit-40 › `.gitattributes` `* eol=lf` present |
| REQ-CDT-02 | .1 | contract | `git add --renormalize .` dry-check (§4.8, PR gate) |
| REQ-CDT-03 | .1 | architectural | fit-40 › zero CR-byte scan |
| REQ-CDT-04 | .1 | architectural | fit-40 › no-BOM scan |
| REQ-CDT-05 | .1 | architectural | fit-40 › POSIX-relative-path scan |
| REQ-CDT-06 | .1/.2 | architectural | fit-40 › no-trailing-`\n` over expected/**+schematic/files/** |
| REQ-CDT-07 | .1 | architectural | fit-40 › UTF-8 text / no-binary scan |

All 35 REQ-IDs covered. No Create/Modify flow exists → no e2e rows required (§4.2b).

## 4.7 Fitness Functions

- **Factory import allow-list** (CFX-01): fit-40 scans `conformance/**/factory.ts` — only
  `../../src/index.ts` (or its re-exported subpaths); bans `src/core/**`, `src/transport/**`,
  `src/testing/**`, `node:fs`/`node:net`/`node:child_process`, `fetch`, `process.env`.
- **Exactly one wire `create` corpus-wide** (CFX-02): fit-40 asserts a single create-authoring site,
  in `m2-create-composition`'s `createRejectProbe` named export.
- **DO-NOT-COPY 5-clause header** (CFX-03): fit-40 asserts the comment preceding `createRejectProbe`'s
  create conveys all five CLAUSES (per REQ-CFX-03), not a bare token: (a) violates the
  one-create-corpus-wide invariant; (b) reject PROBE, not a template; (c) MUST NOT be imitated; (d)
  the engine refuses this batch at emit — `unrepresentable`, exit 2 (now nameable, ADR-0064 lifted
  the spec's "ahead of the ADR" hedge); (e) copy the positive default export's
  `modify`/`delete`/`rename`/`move` pattern instead.
- **corpus.json-derived inventory + no orphan dirs** (CCR-05): fit-40 derives the expected set from
  `corpus.json#fixtures`; absolute 5/12 asserted only when 5 are listed (post-PR#2).
- **`collection.json` marker resolves** (CCR-08): fit-40 asserts presence + ancestor resolution.
- **Byte/line-ending determinism** (CDT-03..07): fit-40 CR/BOM/trailing-`\n`/POSIX-path/UTF-8 scans.
- **wireSpecVersion pin** (CCR-07): fit-40 equality vs `WIRE_PROTOCOL_VERSION`.
- **Failure-message contract** (CSC-01.1/02/06.2): EVERY fit-40 assertion MUST fail naming the
  offending fixture id, the case name (where case-scoped), and the rule/REQ violated — e.g. good:
  `[m2-delete/dir-target-twin] REQ-CFX-04: exitCode 2 requires non-null emitRejectionCode`; bad: a
  bare `expect(...).toBe(...)` with no fixture/rule context.

## 4.8 Migration / Rollout

No data migration. **PR#1 scaffolding** includes `conformance/collection.json` (ADR-0067) alongside
the self-check, `.gitattributes`, README, and `corpus.json=["m1-vehicle"]`. **`.gitattributes`
renormalize dry-check (CDT-02)**: after committing `.gitattributes`, run `git add --renormalize .`;
`git diff --cached` MUST show no change beyond this change's own files. Any already-tracked CRLF file
is renormalized deliberately and reviewed in this diff. **PR#2 gate**: engine sign-off on the
case-level `factory` schema delta (ADR-0065) BEFORE authoring `m2-create-composition/manifest.json`.
Two-PR rollout per ADR-0063/CCR-03.

## 4.9 Performance Considerations

No significant impact. The self-check parses ~6 small JSON files + byte-scans a handful of tiny text
fixtures — negligible added `bun test` time.

## 4.10 Architecture Impact

**Architecture impact**: additive
**Rationale**: the single non-aligning touchpoint (§4.2c) is the `new`/`deviates` root `conformance/`
layer — a structure the baseline lacks (ADR-0063). It ADDS a layer without modifying any existing
boundary, dependency direction, or pattern; every other touchpoint is `aligns`/extend-only, including
ADR-0067's `collection.json` (the corpus SATISFIES the runner's existing `resolvePackageRoot`
precondition without changing the runner). Nothing in the baseline becomes wrong. Triggers the
mandatory post-build baseline refresh (`arch_refresh_post_verify`).

## 4.11 Open Questions

None.

**Risks**:
- **Spec V3 not yet re-signed** (unfrozen from signed V2, DRAFT awaiting owner RE-SIGN). This design
  is produced against V3 at the orchestrator's direction; the archive gate MUST NOT pass until V3 is
  re-signed. Surfaced, not silently absorbed.
- **PR#2 blocked on engine sign-off** for the case-level `factory` schema delta (ADR-0065) — the
  composition manifest cannot be authored until then; PR#1 (m1-vehicle + scaffolding) is unaffected.

**Cross-Repo Verification List** (engine-authoritative, honesty boundary REQ-CFX-11 — documented):
1. **Runner-driven outcomes are engine-authoritative** — exit codes, transcripts, post-run bytes are
   proven only when the engine's Go harness runs the fixtures, never SDK-side (REQ-CFX-11).
2. **Case-level `factory` schema delta — HARD GATE** (ADR-0065): the engine's Go loader must resolve
   a per-case `factory.export` pointer; engine sign-off REQUIRED before
   `m2-create-composition/manifest.json` is authored and before the submodule pin advances.
3. **`collection.json` loader-invisibility confirm** (ADR-0067/REQ-CCR-08): the marker is presence-only
   and never parsed by the Go loader — confirm the engine ignores it (it changes nothing engine-side).
4. **Greeting exit-1 cleanup** (spec-summary Q5): `m1-vehicle`'s `greeting-mismatch-twin` pre-stages
   `out.txt` via schematic lowering before the greeting check, yet declares `expected:"empty"`.
   ASSUMPTION documented: `"empty"` describes the COMMITTED workspace; whether the engine physically
   removes pre-staged-but-uncommitted files on this exit path is engine-owned.
