# Slices: StdioEngineClient — SDK Half of the Engine Wire

**Triage**: L | **Spec version**: V3 (signed, 41 REQs) | **Total slices**: 6 (1 walking skeleton + 5 SPIDR)
Strict TDD: every task's test lands red first. Spawn-dependent tests as late as possible per slice.

---

## Executor Context (normative inputs)

> Added by plan-verify amendment (iteration 1, gaps #4–#6, 2026-07-15). Every contract below is
> referenced by pointer elsewhere in this file — this table states where each one actually lives so
> a slices-only read is executable. Slice boundaries, task lists, dependencies, and acceptance
> criteria are UNCHANGED by this amendment except S-005.4 (ledger table embed) and S-005's REQ
> list/coverage count (LED-01, see below).

| Contract | Home | Notes |
|---|---|---|
| **Signed spec** (all 40 REQ definitions, every Given/When/Then) | `openspec/changes/stdio-engine-client/spec.md` | THE FILE IS CANONICAL — the engram copy of this artifact is truncated at 50KB, do not rely on it for REQ text. Currently V2, signed (owner, 2026-07-15). |
| **Pending V3 spec amendment** | tracked separately (`verify-plan-1.md` gaps #1–#3, routed to `sdd-spec`) | V3 will add **REQ-LED-01** (ledger reconciliation, owned by S-005.4 below) and a doc-section-presence scenario under **REQ-WPS-11**. Because S-005 is LAST in build order, V3 should be signed by the time S-005 starts — but if REQ-LED-01 is not yet in `spec.md` when S-005.4 is reached, halt and route back to the orchestrator rather than inventing the REQ text; this amendment fixes S-005's slice-level bookkeeping (Covers line + coverage count) only, not the REQ body. |
| **Design** — architecture overview, rationale | `design.md` § 4.1 Architecture Overview | — |
| **Design** — File Changes contract (path × action × purpose, the contract with this file) | `design.md` § 4.2 File Changes | Also see § 4.2b Flow Changes, § 4.2c Architecture Touchpoints |
| **Design** — data model / exported symbols (`WIRE_PROTOCOL_VERSION`, `BRIDGE_CONTRACT_VERSION`, `REVERSE_CALLBACK_METHODS`, wire frame types, `StdioEngineClient` class shape, error classes) | `design.md` § 4.3 Data Model | Literal `export const`/`export class`/`export function` signatures given verbatim |
| **Design** — interface contracts (reverse-callback wire shapes, runner argv, bridge entry, error taxonomy) | `design.md` § 4.4 Interface Contracts | The bridge entry (`bootstrap-bridge.ts`) is described ONLY in prose here and in the § 4.2 File Changes row (version check, fd-1 capture, console redirect, hands params to `runner.ts`) — design.md gives no literal exported function signature for it; derive the concrete TS signature during S-003 from this prose contract |
| **Design** — ADRs (ADR-01 transport home + FIT-10 +1, ADR-02 SDK owns read loop, ADR-03 sequential single-in-flight, ADR-04 double-wrap brand marker, ADR-05 single-instance probe, ADR-06 unmapped runner bin) | `design.md` § 4.5 Architecture Decisions | Numbered subsections `### ADR-01` … `### ADR-06` |
| **Design** — Test Derivation (outside-in, REQ → test layer → file, every REQ) | `design.md` § 4.6 Test Derivation (outside-in) | — |
| **Design** — fitness-function definitions (fit-30..35 + FIT-10 modification) | `design.md` § 4.7 Fitness Functions | **Numbering RESOLVED (orchestrator ruling, plan-verify iteration 2)**: the six new checks are fit-30 (S-000 stdout-sacred), fit-31 (S-005 superseded-term scan), fit-32 (S-001 cap-single-source), fit-33 (S-005 bridge-version pin), fit-34 (S-005 BATCH_CAP drift), **fit-35 (S-003 sequential fail-loud)**. fit-29 is NOT used — `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` pre-exists (unrelated check) and is untouched. design.md § 4.2/§ 4.7 updated to match. |
| **Design** — Migration/Rollout, rollback plan | `design.md` § 4.8 Migration / Rollout | — |
| **Design** — Architecture Impact | `design.md` § 4.10 Architecture Impact | `modifying` (not `breaking`) |
| **Error-text algorithm** (2000-char ceiling, 200-char token cap, `../`/`<outside-project>` handling) | `spec.md` REQ-WPS-07 (Given/When/Then) | `design.md` § 4.2's `error-text.ts` row is a one-line pointer only — the algorithm itself is spec-normative, not design-normative |
| **Frame grammar ground truth + interop target** | engine repo `git@github.com:Project-Builder-Schematics/project-builder-engine` (**private — SSH access required**, clone read-only), files `internal/adapter/bunipc/{framer.go,sidecar.ts,sidecar.go,gate.go,types.go}` | Cross-cited already in this change: `spec.md:123` → `framer.go:41`; `design.md:161–162` → `sidecar.go` + `sidecar.ts:80-104`; `explore.md:75` → `types.go:12` (`MaxMessageBytes`). **SSH access VERIFIED working** (read-only clone succeeded 2026-07-15 from this environment; if absent for a future executor, request Contents:Read on the repo). **Attribution correction (plan-verify iter 3)**: SEC-07's normative sources are `spec.md` REQ-SEC-07 + design ADR-05 (probe mechanism + `createRequire` fallback) — NOT `gate.go`; `gate.go` is engine-side interop background only (callback allowlist + path containment), useful context for the security envelope, never a build prerequisite for any slice. |
| **Repo seams to modify or read first** | `src/core/wire.ts` (has `BATCH_CAP_BYTES`, `serializedBatchSize` today — S-001 adds `serializedBatchBytes`/`exceedsBatchCap` beside them), `src/core/engine-client.ts` (port, read-only), `src/core/session.ts` (read-only), `src/core/context.ts` (modify — brand marker, ADR-04), `src/testing/contract-fake.ts` (modify — route cap check through `exceedsBatchCap`), `bin/pbuilder-codegen.ts` (existing MAPPED-bin precedent — contrast with ADR-06's UNMAPPED `pbuilder-runner`), `test/fitness/fit-10-engine-client-port-guard.test.ts` (modify — allow-list +1), `test/fitness/fit-18-fake-single-source-parity.test.ts` (read as precedent for FEH-02's `===` identity guard), `test/fake/batch-cap-fixtures.ts` (read-only, WPS-04 fixtures), `test/support/{canary.ts,scratch-consumer.ts,shared-build.ts}` (existing support helpers — read before writing new ones) | All paths verified present at HEAD as of 2026-07-15 |
| **Runtime/tooling facts** | `package.json` + `tsconfig.json` (repo root) | `@pbuilder/sdk`, `"type": "module"`, `"engines": {"bun": ">=1.0.0"}` — **Bun-only**, no `node` engine declared. Test runner: `bun test` (`scripts.test`). Typecheck: `tsc --noEmit`. Build: `tsc -p tsconfig.build.json && bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node`. `tsconfig.json`: `module: "Preserve"`, `moduleResolution: "bundler"`, `target: "ESNext"`, `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true` (type-only imports must say so), `types: ["bun-types"]` (no `@types/node`). |
| **Pinned constants** | `design.md` § 4.3 Data Model + `src/core/wire.ts:55` | `WIRE_PROTOCOL_VERSION = 1` (design.md:89 — `ready.protocolVersion`, transport handshake). `BRIDGE_CONTRACT_VERSION = 1` (design.md:90 — in-process JS bridge, independent of the wire, BRB-01). `BATCH_CAP_BYTES = 4194304` (4 MiB) — already live today at `src/core/wire.ts:55` as `4 * 1024 * 1024`; cross-repo pin confirmed against `spec.md:161` (SDK `BATCH_CAP_BYTES` MUST equal engine `MaxMessageBytes`). All three are pinned in existing artifacts — none of them needed inventing. |

## Executor FAQ (pre-answered)

> The three product questions Judge B raised (gap #6) are answered from rulings already on record —
> no new user decision is required to start executing.

- **Q: Is the wire contract frozen, or is this change still defining it?**
  A: FROZEN. Ratified by the 2026-07-15 cross-repo adjudication + owner rulings (engram obs #2154/#2157). Where the engine's shipped code already implements a detail (`framer.go` grammar, h/s ID namespaces, the 4 MiB cap), the SDK MATCHES it; the engine formally ratifies its own side at PC-PROTO-01. This change is not free-designing message schemas — `spec.md` is normative and the SDK conforms to it.
- **Q: What outcome is "done" measured against?**
  A: The north-star memo (`openspec/changes/stdio-engine-client/north-star.md`): both repos build against ONE normative text; the SDK half is proven conformant over real stdio; a stale-engine build fails LOUDLY at the greeting. The pre-archive steward reckoning checkpoint additionally holds this change to "doc reconciled against BUILT code" (not doc-on-faith).
- **Q: Who decided the ledger dispositions in S-005.4?**
  A: The propose-phase pm council, owner-ratified at the propose checkpoint. The L360 disposition (re-home to the public-package plan) is by explicit owner ruling (engram obs #2161). L361's "verify-then-decide" is deliberate in-change verification against the shipped `bare-factory-migration` archive, not indecision.

---

## S-000: Walking Skeleton — Spawned runner completes one framed run end-to-end

**Scope**: walking-skeleton | **Dimension**: — | **Requires**: nothing
**Covers**: WPS-01, WPS-02, WPS-05, WPS-10, RUN-05, SEC-01, SEC-03, SEC-06
**Test layers**: unit + integration + e2e (smoke) | **Fitness**: FIT-10 allow-list +1 (red-proof), fit-30 stdout-sacred

**Acceptance**:
- GIVEN the scripted fake host over REAL stdio
- WHEN it spawns the runner with `--factory` on a fixture factory
- THEN versioned `ready` (v-match) is accepted, one `tree.read` round-trips asserted BY VALUE, `ir.emit` applies, advisory `ir.commit` acks, exit 0

### Tasks (design's unit-first order; e2e LAST)
- [ ] S-000.1 RED `framing.ts` unit: encode/decode, newline-intact, UTF-8 byte-count (WPS-01)
- [ ] S-000.2 RED `wire-protocol.ts` unit: versions, closed method set, ready/frame guards (WPS-02, WPS-05)
- [ ] S-000.3 RED `frame-reader.ts` happy-path unit (full fault matrix deferred to S-001)
- [ ] S-000.4 RED `stdio-engine-client.ts` unit over in-memory channel: 4 callbacks, payload shapes, ack/`IntentRejectedError`, null→undefined/""→"", settles-once (WPS-10, SEC-01/03/06)
- [ ] S-000.5 RED FIT-10 red-proof, extend allow-list by exactly `src/transport/stdio-engine-client.ts` (ADR-01)
- [ ] S-000.6 RED `test/support/frame-host.ts` unit: async spawn+frame helper, greeting barrier, afterEach kill
- [ ] S-000.7 Minimal `runner.ts` + `bin/pbuilder-runner.ts` + `defineFactory` wrap `packageDir=dirname` parity (RUN-05) + `fake-engine-harness.ts` shell over ContractFake (happy dispatch only)
- [ ] S-000.8 e2e skeleton in `fake-engine-harness.e2e.test.ts` + fit-30 scan

---

## S-001: Wire faults fail loud and classified — never hang, never corrupt

**Scope**: edge-case | **Dimension**: P (Path — failure flows vs the skeleton's happy flow) | **Requires**: —
**Covers**: WPS-03, WPS-04, WPS-07, WPS-08, SEC-04, SEC-05, SEC-08, SEC-10
**Test layers**: unit | **Fitness**: fit-32 cap-single-source

**Acceptance**:
- GIVEN split/coalesced/EOF-mid-frame chunks, over-cap frames, malformed JSON, stale IDs, a hung host, malformed rejections
- WHEN the client processes each
- THEN exactly-one-dispatch reassembly holds; caps reject before alloc (exact-cap accepted, `0x80000000` rejected); routing discards are wire-silent + stderr-noted with liveness; faults attribute structurally; timeout is injectable; rejections map to `EmitRejection` honoring `failedIndex`, degrading to `unknown`

### Tasks
- [ ] S-001.1 RED `frame-reader` matrix (SEC-10.1–.5)
- [ ] S-001.2 RED `error-text.ts`: 2000-char ceiling, 200-char token cap, `../`/`<outside-project>` (WPS-07)
- [ ] S-001.3 RED `wire.ts` `serializedBatchBytes`/`exceedsBatchCap` + route `contract-fake.ts` cap check through it; fit-32
- [ ] S-001.4 RED `framing.ts` cap paths via `batch-cap-fixtures` (WPS-04.1–.4)
- [ ] S-001.5 RED client routing discards + liveness (WPS-03), fail-closed/desync/EOF-prompt (SEC-08)
- [ ] S-001.6 RED injectable timeout, slow-success no stray reject (SEC-05)
- [ ] S-001.7 RED rejection mapping + pointer grammar parse (WPS-08, SEC-04)

---

## S-002: Runner refuses bad input before author code runs

**Scope**: edge-case | **Dimension**: R (Rule — validation gates + exit taxonomy) | **Requires**: S-001
**Covers**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-06, RUN-07, SEC-07, EXC-01, EXC-02
**Test layers**: unit + integration + e2e | **Fitness**: — (uses S-001's error-text)

**Acceptance**:
- GIVEN bad argv, non-`file:`/non-empty-host pointers, missing/non-function exports, double-wrapped exports, oversize/malformed input-file, split SDK copies, and the four failure classes
- WHEN the runner gates each pre-import
- THEN each rejects with its distinct message and exit codes 1/2/3/4 are mutually distinct; double-fault preserves E1's class via `.cause`

### Tasks
- [ ] S-002.1 RED `exit-codes.ts` classifier (EXC-01 table, EXC-02 `.cause`)
- [ ] S-002.2 RED `factory-pointer.ts`: scheme+empty-host pre-import (RUN-02), export 3-form (RUN-03)
- [ ] S-002.3 RED `context.ts` brand marker + double-wrap reject, arity-2 negative (RUN-06, ADR-04)
- [ ] S-002.4 RED `single-instance-probe.ts` resolution-only before-import + fallback (SEC-07, ADR-05)
- [ ] S-002.5 RED runner gates: argv XOR (RUN-01), input-file size-cap-only + line/col parse (RUN-04), import-failure split 1-vs-4 (RUN-07)
- [ ] S-002.6 e2e legs: four-class exit matrix + handshake-trio-all-exit-1 (EXC-01.2/.3)

---

## S-003: Engine bootstrap enters through the versioned bridge — same gates, sealed stdout

**Scope**: happy-path | **Dimension**: I (Interface — bridge entry beside argv entry) | **Requires**: S-002
**Covers**: BRB-01, BRB-02, BRB-03, RUN-08, WPS-09, SEC-02, SEC-09
**Test layers**: unit + integration + e2e | **Fitness**: fit-35 sequential fail-loud guard

**Acceptance**:
- GIVEN entry via `bootstrap-bridge.ts` and via direct argv spawn
- WHEN version mismatch, gate-violating params, host-sent requests, author stdout/console sabotage, and a second run-entry are attempted
- THEN mismatch fails loudly naming both versions; params hit the SAME RUN-01..04 gates; host requests never dispatch a run; zero non-frame bytes reach the wire on BOTH paths; overlap rejects `OverlappingRunError` with first run intact

### Tasks
- [ ] S-003.1 RED bridge version check + handoff (BRB-01.1/.2)
- [ ] S-003.2 RED integration: bridge params traverse shared gates (BRB-01.3)
- [ ] S-003.3 RED SEC-02 overlap guard + fit-35
- [ ] S-003.4 RED harness leg: host-issued request discarded, reverse-only traffic (WPS-09)
- [ ] S-003.5 e2e both paths: fd-1 capture + console redirect pre-import, author sabotage isolated (BRB-02/03, RUN-08, SEC-09)

---

## S-004: Conformance harness proves every REQ over real stdio

**Scope**: happy-path | **Dimension**: D (Data — one scenario corpus spanning the REQ universe) | **Requires**: S-003
**Covers**: FEH-01, FEH-02, FEH-03, FEH-04, FEH-05
**Test layers**: integration + architectural + e2e

**Acceptance**:
- GIVEN the shared corpus run in-process (ContractFake) and via the spawned harness
- WHEN `harness.test.ts` + the adversarial e2e matrix run with no Go toolchain
- THEN outcomes are identical (FIT-18 green); corpus imports are `===`; every scenario cites a spec-parsed REQ (archive-safe lookup); coverage map shows zero uncovered of 40 with count tripwire armed

### Tasks
- [ ] S-004.1 RED shared corpus + `===` reference-identity guard (FEH-02)
- [ ] S-004.2 RED parity + structural no-reimpl scan: no `new EmitRejection`, no message-dictionary literals (FEH-01)
- [ ] S-004.3 RED citation guard sharing FEH-05's parse, documented post-archive path lookup (FEH-03)
- [ ] S-004.4 RED spec-parsed coverage map + expected-count tripwire (FEH-05)
- [ ] S-004.5 Complete adversarial e2e matrix; assert no-Go run (FEH-04)

---

## S-005: One normative wire text both repos build against

**Scope**: happy-path | **Dimension**: I (Interface — the cross-repo/human contract surface) | **Requires**: S-004
**Covers**: WPS-06, WPS-11, FEH-06, LED-01
**Test layers**: architectural | **Fitness**: fit-31 superseded-term scan, fit-33 bridge-version pin, fit-34 BATCH_CAP drift

**Acceptance**:
- GIVEN all code slices BUILT and green (never spec-on-faith)
- WHEN `docs/engine-sdk-wire-spec.md` is created, `engine-sdk-wire-design.md` hits rev 3, and the ledger reconciles
- THEN fit-31 finds zero live NDJSON/single-initiator/`session.init` outside superseded headings + header stamps wire-spec v1; fit-34 pins `BATCH_CAP_BYTES == 4194304` vs the doc; fit-33 pins `BRIDGE_CONTRACT_VERSION` vs the doc's bridge section; doc method/error/exit sections match built code (north-star reckoning item 2)

### Tasks
- [ ] S-005.1 Write normative `docs/engine-sdk-wire-spec.md`: methods, error shapes, pointer grammar, cap naming, exit codes, bridge-contract section — from built code
- [ ] S-005.2 Rewrite `docs/engine-sdk-wire-design.md` rev 3: superseded decisions under `## Superseded (historical)`, header stamps version
- [ ] S-005.3 RED fit-31 (doc scan + stamp), fit-34 (FEH-06/WPS-06), fit-33 (doc-declared pin)
- [ ] S-005.4 Ledger `openspec/pending-changes.md` per the reconciliation table below (REQ-LED-01 — provenance: propose-phase pm council 2026-07-15; owner-ratified at the propose checkpoint; L360 by explicit owner ruling, engram obs #2161). **Locate rows by CONTENT, not the line numbers given — `pending-changes.md` shifts as rows are edited.**

  | Row (pending-changes.md, content as of 2026-07-15) | Disposition |
  |---|---|
  | L359 `StdioEngineClient` row | CLOSE with a supersession note naming the three superseded decisions (NDJSON, `session.init`, argv-spawn) |
  | L360 factory scaffold row ("with the runner change") | RE-HOME to the public-package plan (owner ruling, obs #2161) |
  | L361 author-surface bare-factory migration row | VERIFY against the shipped `bare-factory-migration` archive → retire with a pointer if delivered; re-home to the public-package plan if partial |
  | L350–355 section header "…no change yet" + stale preamble | RE-HEAD "DELIVERED by stdio-engine-client (2026-07-15)" + annotate the stale NDJSON/single-initiator preamble |
  | L74 `EmitRejection` port conformance row | SPLIT/PARTIAL-CLOSE: SDK-side precondition enforcement delivered by this change; engine-side `SystemError`/`DeveloperError` mapping stays cross-repo (PC-PROTO-01) |
  | L56 batch-cap engine confirmation row | ADVANCE-NOTE: point at the new wire-spec cap clause; "not engine-confirmed" flag stays until PC-PROTO-01 |
  | L107 stage-2 error contract row | ADVANCE-NOTE: the wire spec formalizes the SDK-proposed shapes; still engine-unconfirmed |
  | L220 `copy` verb emit-only row | NO CHANGE + advance-note (the wire spec it needs now exists) |
  | L261–263 BRC-02/BRC-08/PRC-06 rows | NO CHANGE + advance-note (resolution anchor + frame contract now pinned) |
  | L92–100 PC-PROTO-01 gloss | UPDATE: add rev-3 doc + wire-spec version as the SDK-side inputs now available |
  | NEW row | Windows support / macOS production pins — deferred, pending row only |
  | NEW row | Cross-repo tether: engine PC-PROTO-01 MUST build against rev-3 + wire-spec vN, NOT rev-2; conformance = the Go side passes the same wire vectors the SDK harness encodes; engine `MaxMessageBytes` == SDK `BATCH_CAP_BYTES` (4 MiB) per the wire-spec clause |

---

## Build Order

| Order | Slice | Note |
|---|---|---|
| 1 | S-000 | skeleton — implicit blocker for all |
| 2 | S-001 | fault paths; supplies `error-text`/cap plumbing to S-002 |
| 3 | S-002 | gates + exit taxonomy (uses S-001's code-3 classification) |
| 4 | S-003 | bridge reuses S-002's gates (BRB-01.3) |
| 5 | S-004 | coverage map needs all code REQs landed |
| 6 | S-005 | docs LAST — reconciled against built, proven code |

Strictly linear by design: the QA council's spawn-late ordering and the "docs against BUILT code" rule leave no safe parallelism.

## Coverage Check

All 41 REQ-IDs land in exactly one slice: S-000 (8) + S-001 (8) + S-002 (9) + S-003 (7) + S-004 (5) + S-005 (4) = 41. **REQ-LED-01 is the +1** (added by the pending V3 spec amendment, see Executor Context above — S-005 owns it via S-005.4's ledger table). Zero orphan File Changes rows: all 11 `src/transport/*` + `bin` creates → S-000/S-001/S-002/S-003; `wire.ts`/`contract-fake.ts` modifies → S-001; `context.ts` modify → S-002; `test/support/frame-host.ts` + `test/transport/*` + `fake-engine-harness{,.e2e}` → S-000..S-003; `harness.test.ts` → S-004; fit-30/32/35 + FIT-10 → S-000/S-001/S-003; fit-31/33/34 + both docs + `pending-changes.md` → S-005. Scope law honored: no `package.json#bin` (ADR-06), fake-host internal-only, `--input-file` size-cap only, zero engine-repo code.
