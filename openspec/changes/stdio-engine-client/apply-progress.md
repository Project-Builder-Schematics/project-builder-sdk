# Apply Progress: stdio-engine-client

**Scope this run**: `slice:S-003` | **Mode**: Strict TDD | **Status**: complete (5/5)

> History: S-000 (8/8), S-001 (7/7), S-002 (6/6) complete and verified (see their sections
> below). S-003 also closed two evaluator-mandated carried-forward items from S-002's
> verify-in-loop-3: the EXC-01.3 handshake trio (was a documented duo) and the RUN-02
> no-import runtime proof gap (was WARNING-tolerated). See "Carried-Forward Closures" below.

> History: the first apply run halted at S-000.7 (`architectural-conflict`: RUN-05's
> `defineFactory` wrap in `src/transport/runner.ts` vs the pre-existing fit-29
> sanctioned-caller guard). Resolved by **ADR-07** (design.md § 4.5): fit-29's
> `ALLOWLISTED_ROOTS` widened by exactly one FILE path, `src/transport/runner.ts`, with a
> red-proof that unrelated `src/transport/**` files stay flagged. Resumed and completed.

## S-000 tasks (8/8)

| Task | Status | Files |
|---|---|---|
| S-000.1 `framing.ts` unit (WPS-01) | done | `src/transport/framing.ts`, `test/transport/framing.unit.test.ts` |
| S-000.2 `wire-protocol.ts` unit (WPS-02, WPS-05) | done | `src/transport/wire-protocol.ts`, `test/transport/wire-protocol.unit.test.ts` |
| S-000.3 `frame-reader.ts` happy-path unit | done | `src/transport/frame-reader.ts`, `test/transport/frame-reader.unit.test.ts` |
| S-000.4 `stdio-engine-client.ts` unit (WPS-10, SEC-01/03/06) | done | `src/transport/stdio-engine-client.ts`, `test/transport/stdio-engine-client.unit.test.ts` |
| S-000.5 FIT-10 allow-list +1 (ADR-01) | done | `test/fitness/fit-10-engine-client-port-guard.test.ts`, `test/fitness/pkg-surface-baseline.json` |
| S-000.6 `test/support/frame-host.ts` unit | done | `test/support/frame-host.ts`, `test/support/frame-host.test.ts` |
| S-000.7 `runner.ts` + `bin/pbuilder-runner.ts` + RUN-05 parity + harness shell (ADR-07) | done | `src/transport/runner.ts`, `bin/pbuilder-runner.ts`, `test/fake/fake-engine-harness.ts`, `test/transport/runner.integration.test.ts`, `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts`, `test/fixtures/frame-runner/{happy,schema}/*` |
| S-000.8 e2e skeleton + fit-30 | done | `test/fake/fake-engine-harness.e2e.test.ts`, `test/fitness/fit-30-stdout-sacred.test.ts`, `src/transport/framing.ts` (`captureFd1FrameWriter`) |

Final: `bun test` → **1388 pass / 0 fail** (155 files); `tsc --noEmit` → clean.

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.1 | `framing.unit.test.ts::JSON.parses the body back to the original value` | unit | `error: not implemented` (stub throw, structural-fix-first) | ✅ | ASCII / newline / 3-byte (€) / 4-byte surrogate-pair (😀) — 4 byte-length classes | none needed |
| S-000.2 | `wire-protocol.unit.test.ts::rejects a greeting missing method: "ready"` | unit | `Cannot find module '../../src/transport/wire-protocol.ts'` | ✅ | match / mismatch / missing-method / missing-version / non-integer / non-object — 6 structural cases | none needed |
| S-000.3 | `frame-reader.unit.test.ts::decodes two frames coalesced into a single chunk, in order` | unit | `Cannot find module '../../src/transport/frame-reader.ts'` | ✅ | single-chunk / split-chunks / coalesced — 3 reassembly shapes | none needed |
| S-000.4 | `stdio-engine-client.unit.test.ts::commit() rejects with IntentRejectedError...` | unit | `Cannot find module '../../src/transport/stdio-engine-client.ts'` | ✅ | ack/rejection × commit/discard; read null/""/content | none needed |
| S-000.5 | `fit-10::[red-proof] ADR-01: unrelated src/transport file naming EngineClient still caught` | architectural | organic: "expected `[]`, got `[names port symbol...: src/transport/stdio-engine-client.ts]`" | ✅ | n/a — single path membership | none needed |
| S-000.6 | `frame-host.test.ts::sends a frame and receives it echoed back, decoded` | unit (real subprocess) | `error: not implemented` (stub throw) | ✅ | echo / sendReady / 3-frame ordering / kill+waitExit-on-hang | none needed |
| S-000.7a | `runner.integration.test.ts::completes one framed run end-to-end...` | integration (in-process io) | `Cannot find module '../../src/transport/runner.ts'` | ✅ | happy / version-mismatch / malformed greeting / RUN-05 parity valid / RUN-05 parity schema-rejected — 5 paths | none needed |
| S-000.7b | `fit-29::src/transport/runner.ts does not import defineFactory from an unsanctioned caller` | architectural | organic: `expected [], received ["../core/context.ts"]` — `(fail) ... src/transport/runner.ts` | ✅ ADR-07 FILE allow-list +1, red-proof (planted `framing.ts` import flagged) + positive control | n/a — single path membership | none needed |
| S-000.8a | `fake-engine-harness.e2e.test.ts::completes one framed run end-to-end... exit 0` | e2e (spawned, real stdio) | assertion: `Expected: 0, Received: 1`; stderr `Module not found ".../bin/pbuilder-runner.ts"` | ✅ (after the stdin-hang fix — see Discoveries) | happy-exit-0 / mismatch-exit-1-zero-callbacks — both spawn legs | none needed |
| S-000.8b | `fit-30-stdout-sacred.test.ts::src/transport/framing.ts holds no unsanctioned stdout reference` | architectural | organic (exemption set empty first): `stdout-sacred violation (\bprocess\.stdout\b): src/transport/framing.ts` | ✅ exemption = exactly `framing.ts`; write-site count pinned to 1; 3 red-proof fixtures | banned console.log / banned stdout.write / allowed stderr | none needed |

## Discoveries

- **Spawned-runner stdin hang**: after `runRunner` resolves, the still-open stdin pipe (host
  side) keeps the Bun child's event loop alive — `process.exitCode` + natural drain never
  exits. `bin/pbuilder-runner.ts` calls `process.exit(code)` explicitly; safe because every
  outbound frame is written BEFORE its response is awaited, so nothing is buffered at exit.
- `test/fitness/pkg-surface-baseline.json` regenerated twice (S-000.5, S-000.7): the 10 new
  `dist/transport/*.{js,d.ts}` entries are authorized growth per design § 4.2 Create rows.
  `bin/pbuilder-runner.ts` produces NO dist output (not in `tsconfig.build` include, not in
  `scripts.build`'s bundle step) — dist/bin build wiring is deferred to the public-package
  plan per ADR-06; FIT-14's `bin`/`shebang`/`exports` fields untouched.

## Slice Audit Notes (Step 7c, mode: slice)

Groups 1–3 run over the full S-000 diff. No `Bug`/`Architecture`/`MAJOR` findings. Two
findings remediated in-slice (commit `4f1053d`):

- **Epic AC — SEC-01 type leg**: design § 4.6 declares `test/types/*` alongside the unit
  vehicle; added `test/types/stdio-engine-client-port.test.ts` (expect-type pin of the four
  exact signatures).
- **Nit — duplicate**: `LENGTH_PREFIX_BYTES` was declared in both `framing.ts` and
  `frame-reader.ts`; now exported from `framing.ts` (single owner) and imported.

Soft-noted, deliberate scope boundaries (not findings): `stdio-engine-client.ts` casts the
raw response frame (`as ResponseFrame`) and skips WPS-03 routing/SEC-04 degrade/SEC-05
timeout — S-001's contract, flagged in the file's scope-boundary header. ADR-01/02/03/06/07
all verified honored by the diff.

## Deviations from design

None. (Coordinator's resume message said `test/support/fake-engine-harness.ts`; design § 4.2's
File Changes contract says `test/fake/fake-engine-harness.ts` — the design contract was
followed.)

---

# S-001: Wire faults fail loud and classified

**Scope this run**: `slice:S-001` | **Mode**: Strict TDD | **Status**: complete (7/7)

Closes the S-000 scope boundary documented in `stdio-engine-client.ts`'s former header: the
client no longer trusts "the next frame" as the matching response — it routes (WPS-03),
times out (SEC-05), fails closed on wire faults (SEC-08), and maps rejections with the
SEC-04 precondition/degrade rule.

## S-001 tasks (7/7)

| Task | Status | Files |
|---|---|---|
| S-001.1 `frame-reader` matrix (SEC-10.1–.5, SEC-08.2) | done | `src/transport/frame-reader.ts`, `test/transport/frame-reader.unit.test.ts` |
| S-001.2 `error-text.ts` (WPS-07) | done | `src/transport/error-text.ts`, `test/transport/error-text.unit.test.ts` |
| S-001.3 `wire.ts` cap functions + `contract-fake.ts` routing (fit-32) | done | `src/core/wire.ts`, `src/testing/contract-fake.ts`, `test/core/wire.test.ts` |
| S-001.4 `framing.ts` cap paths (WPS-04.1–.4) | done | `src/transport/framing.ts`, `test/transport/framing.unit.test.ts` |
| S-001.5 client routing/discard/liveness (WPS-03), fail-closed (SEC-08) | done | `src/transport/stdio-engine-client.ts`, `src/transport/runner.ts`, `test/transport/stdio-engine-client.unit.test.ts` |
| S-001.6 injectable timeout (SEC-05) | done | `src/transport/stdio-engine-client.ts`, `test/transport/stdio-engine-client.unit.test.ts` |
| S-001.7 rejection mapping (SEC-04) + pointer grammar (WPS-08.1) | done | `src/transport/stdio-engine-client.ts`, `src/transport/factory-pointer.ts`, `test/transport/stdio-engine-client.unit.test.ts`, `test/transport/factory-pointer.unit.test.ts` |
| fit-32 cap-single-source | done | `test/fitness/fit-32-cap-single-source.test.ts` |

Final: `bun test` → **1480 pass / 0 fail** (160 files); `tsc --noEmit` → clean.

## TDD Cycle Evidence — S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-001.3 | `wire.test.ts::exceedsBatchCap (Batch overload)` | unit | `SyntaxError: Export named 'serializedBatchBytes' not found in module 'wire.ts'` | ✅ | Batch overload / raw-byte overload / exact-cap / over-cap / `0x80000000` — 5 cases forcing the shared overloaded implementation | `serializedBatchSize` refactored to delegate (behavior-preserving, existing callers unaffected) |
| S-001.3b | `contract-fake.ts` cap-check routing | n/a (refactor, no new test) | — (behavior-preserving; `test/fake/batch-cap.test.ts` is the regression safety net) | ✅ | n/a | routed through `exceedsBatchCap`, local `>` comparison removed |
| S-001.4 | `framing.unit.test.ts::a declared length one byte over BATCH_CAP_BYTES is oversize` | unit | `SyntaxError: Export named 'isOversizeDeclaredLength' not found in module 'framing.ts'` | ✅ | oversize / exact-cap / `0x80000000` signed-read / outbound-Batch-over / outbound-Batch-exact — 5 cases | none needed |
| S-001.1a | `frame-reader.unit.test.ts::classifies transport-fault (kind: eof) when EOF arrives after a valid prefix...` | unit | `Expected constructor: [class TransportFault...] Received value: undefined` | ✅ | partial-body-EOF / partial-prefix-EOF / clean-EOF-no-fault — 3 cases | none needed |
| S-001.1b | `frame-reader.unit.test.ts::a frame whose declared length undercounts its actual body fails closed...` (SEC-08.2) | unit | organic (written after the EOF/oversize mechanism; proven failing pre-implementation via the same `TransportFault` gap) | ✅ | n/a — single mechanism (JSON.parse failure on the truncated read); documented in-code why "desync" collapses into "malformed" rather than a distinct code path | none needed |
| S-001.1c (characterization) | `frame-reader.unit.test.ts::[characterization]` × 4 (SEC-10.1–.4) | unit | N/A — pre-existing S-000 buffering already satisfies these; labeled `[characterization]` per the project's fit-10-established convention rather than treated as a RED violation | ✅ (pre-existing) | n/a | none needed |
| S-001.2 | `error-text.unit.test.ts::a message over the 2000-character ceiling is truncated...` | unit | `error: Cannot find module '../../src/transport/error-text.ts'` | ✅ | ceiling / exact-boundary / token-cap / outside-project-fallback / composeWithToken — 5+ cases | none needed |
| S-001.5a | `stdio-engine-client.unit.test.ts::Scenario REQ-WPS-03.1: an unknown-type frame is discarded...` | unit | `expect(received).toEqual(expected) Expected: "x" Received: undefined` | ✅ | unknown-type / absent-type / stale-id / liveness-after-2-discards — 4 cases | none needed |
| S-001.5b | `stdio-engine-client.unit.test.ts::Scenario REQ-SEC-08.1/.3: ...rejects the pending call, classified` | unit | organic pass-through (channel rejection already propagated pre-loop; test asserts the CLASSIFIED `TransportFault` type, proven once `TransportFault` existed) | ✅ | malformed / eof-promptness — 2 cases | none needed |
| S-001.6 | `stdio-engine-client.unit.test.ts::Scenario REQ-SEC-05.1: a hung host times out...` | unit | test timed out after 5000ms (no timeout mechanism existed; hung indefinitely) | ✅ | hung-forever / slow-but-before-bound / injected-timeoutMs-honored — 3 cases | none needed |
| S-001.7a | `factory-pointer.unit.test.ts::a pointer with a fragment splits into the url and the named export` | unit | `error: Cannot find module '../../src/transport/factory-pointer.ts'` | ✅ | fragment / no-fragment / literal-# in url / empty-fragment — 4 cases | none needed |
| S-001.7b | `stdio-engine-client.unit.test.ts::Scenario REQ-SEC-04.3: three out-of-contract payloads all degrade to unknown...` | unit | `expect(received).toEqual(expected) Expected: "unknown" Received: "bogus-code"` | ✅ | bogus-code / batch-level-with-index / negative-index — 3 forcing cases, plus directive-level/batch-level/WPS-08.2/.3 round-trip cases | none needed |
| fit-32 | `fit-32-cap-single-source.test.ts` | architectural | organic (project-wide scan; red-proof sub-tests prove the detection mechanism itself: planted `>` comparison, planted literal, reversed operand order) | ✅ (6 red-proof fixtures + full-scope scan, all pass) | n/a — single mechanism | pre-existing `test/fake/emit-rejection.test.ts` literal `4 * 1024 * 1024` fixed to import `BATCH_CAP_BYTES` (this check's own necessary consequence, not scope creep) |

## Discoveries

- **`EmitRejectionCode` stays a closed 4-member type — "unknown" reaches it via an
  established cast, not a type extension.** `core/emit-rejection.ts` is READ-ONLY per
  design. SEC-04.3 requires reconstructing `EmitRejection{code:"unknown"}`, but
  `EmitRejectionCode` has no "unknown" member. The pre-existing
  `test/skeleton/authoring-error.test.ts:235` (`new EmitRejection("quota-exceeded" as
  EmitRejectionCode, ...)`) proves this codebase's established pattern: an out-of-band code
  reaches the domain type via `as EmitRejectionCode`, and `toAuthoringError`'s
  `CODE_TO_REASON[raw.code] ?? "unknown"` lookup (unmodified) degrades it downstream. `emit-
  rejection.ts` needed ZERO changes.
- **`exceedsBatchCap` is a Batch/number overload, not Batch-only.** Design's § 4.3 gives
  `exceedsBatchCap(batch: Batch): boolean` verbatim — but WPS-04.2/.4's inbound leg has no
  Batch to construct, only a raw declared length prefix. Widened to an overload
  (`Batch | number`) so fit-32's "the `>` comparison lives only in `exceedsBatchCap`" holds
  literally — a single function, callable from both the outbound (Batch) and inbound (raw
  byte count) legs. The Batch-typed call form still matches the design's signature exactly.
- **SEC-08.1 (malformed) and SEC-08.2 (desync) collapse to one `TransportFault` kind
  (`"malformed"`) in this implementation.** Mechanically, an undercounted length prefix
  (desync) and deliberately-corrupt JSON (malformed) are indistinguishable once the
  misaligned byte range reaches `decodeFrameBody` — both manifest as a `JSON.parse` failure.
  A "valid JSON but wrong shape" structural check was considered and rejected: it would
  conflate with WPS-03's silent-discard territory (a valid `{type:"notification"}` object
  must be silently discarded, never fail-closed). `kind: "desync"` stays in the
  `TransportFault` type for documentation completeness; no code path currently produces it
  distinctly from `"malformed"`.
- **WPS-04's outbound leg lives in `stdio-engine-client.ts`'s `emit()`, not `framing.ts`.**
  Design's § 4.2 one-liner attributes the cap check to `framing.ts`, but WPS-04.1 requires
  the rejection to surface as a domain-level `EmitRejection{code:"cap"}` — only `emit()`
  (the one place that knows "this is a Batch being emitted") can throw that. `framing.ts`
  owns the INBOUND raw-length leg (`isOversizeDeclaredLength`, reject-before-alloc,
  WPS-04.2/.4) where the design's "reject-before-alloc" language fits literally.
- **`FrameChannel` gained a `writeStderr` method** (WPS-03's operator-visible discard note)
  — a minimal, additive interface extension; `runner.ts`'s channel wrapper and the test
  doubles were updated to implement it.
- **`frame-reader.ts` imports `TransportFault` from `stdio-engine-client.ts`**, matching
  design's placement of the class under that file's data-model section — an unusual
  "reader depends on the client" direction, but not circular (stdio-engine-client.ts never
  imports frame-reader.ts) and matches the design's own class placement.

## Slice Audit Notes (Step 7c, mode: slice)

Groups 1–3 run over the full S-001 diff. No `Bug`/`Architecture`/`MAJOR` findings.
- **Group 1 (spec coverage)**: every REQ-ID in S-001's Covers list (WPS-03, WPS-04, WPS-07,
  WPS-08, SEC-04, SEC-05, SEC-08, SEC-10) has at least one cited test; SEC-08.2 (desync) was
  initially missing a dedicated test and was added before closing the slice (see TDD
  evidence table, S-001.1b).
- **Group 2 (architecture)**: fit-32 built and green (7 scan tests + 6 red-proofs +
  non-vacuity check); no layer violation, no ADR contradiction, no sensitive-area gap
  (IPC boundary already covered by the sensitive-areas registry).
- **Group 3 (code quality)**: zero `as any`/`as unknown as`/TODO/FIXME introduced; the one
  precedented `as EmitRejectionCode` cast is documented above with its established-pattern
  citation, not a fresh untyped-cast smell.
- `test/fitness/pkg-surface-baseline.json` regenerated (fresh `bun run build` +
  `bun pm pack --dry-run`): 4 new entries (`dist/transport/{error-text,factory-pointer}.
  {js,d.ts}`) — authorized growth per design § 4.2 Create rows, same procedure S-000 used
  twice.

## Deviations from design

- `EmitRejection`'s "unknown" degrade target reaches the domain type via a cast, not a type
  extension — `core/emit-rejection.ts` stays unmodified (design's Read-only marking
  honored); see Discoveries.
- `exceedsBatchCap` widened to a `Batch | number` overload (design gives the Batch-typed
  form verbatim; the number overload is additive, not a replacement) — see Discoveries.
- WPS-04's outbound cap check lives in `stdio-engine-client.ts::emit()` rather than
  `framing.ts` (design's one-line file-changes summary attributes it to `framing.ts`) — see
  Discoveries for the rationale (only `emit()` can throw the domain-level `EmitRejection`).

---

# S-002: Runner refuses bad input before author code runs

**Scope this run**: `slice:S-002` | **Mode**: Strict TDD | **Status**: complete (6/6)

Closes RUN-01..04/06/07, SEC-07, and EXC-01/02: the runner now gates argv, factory pointer,
input-file, and single-instance-SDK before any author code (import OR factory body) can
run, and classifies every terminal outcome into the 0–4 exit-code taxonomy.

## S-002 tasks (6/6)

| Task | Status | Files |
|---|---|---|
| S-002.1 `exit-codes.ts` classifier (EXC-01/02) | done | `src/transport/exit-codes.ts`, `test/transport/exit-codes.unit.test.ts` |
| S-002.2 `factory-pointer.ts`: scheme+empty-host (RUN-02), export 3-form (RUN-03), double-wrap (RUN-06) | done | `src/transport/factory-pointer.ts`, `test/transport/factory-pointer.unit.test.ts` |
| S-002.3 `context.ts` brand marker (ADR-04) | done | `src/core/context.ts`, `test/skeleton/definefactory-brand-marker.test.ts` |
| S-002.4 `single-instance-probe.ts` (SEC-07, ADR-05) | done | `src/transport/single-instance-probe.ts`, `test/transport/single-instance-probe.unit.test.ts` |
| S-002.5 runner gates: argv XOR (RUN-01), input-file cap+parse (RUN-04), import-failure split (RUN-07), SEC-07 wiring, EXC-01/02 wiring | done | `src/transport/runner.ts`, `test/transport/runner.unit.test.ts`, `test/fixtures/frame-runner/import-crash/` |
| S-002.6 e2e legs: four-class exit matrix + handshake duo (EXC-01.2/.3) | done | `test/fake/exit-matrix.e2e.test.ts`, `test/fake/fake-engine-harness.ts` (ir.emit error-shaping leg added), `test/fixtures/frame-runner/{collide,crash}/` |

Final: `bun test` → **1537 pass / 0 fail** (165 files); `tsc --noEmit` → clean; `bun run build` → clean.

## TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-002.1 | `exit-codes.unit.test.ts::an authoring-rejected AuthoringError...classifies as 1` | unit | `Cannot find module '../../src/transport/exit-codes.ts'` | ✅ | authoring-rejected/write-rejected/TransportFault(×3 kinds)/plain-Error/non-Error — 4 classes + double-fault `.cause`-ignored (×2 directions) | none needed |
| S-002.3 | `definefactory-brand-marker.test.ts::a value returned by defineFactory() is recognized as wrapped` | unit | `Export named 'isDefineFactoryWrapped' not found` | ✅ | wrapped/bare-arity-1/bare-arity-2/non-function/two-independent-wraps — 5 cases (RUN-06.2 negative triangulation via genuine `.length===2`) | none needed |
| S-002.2a | `factory-pointer.unit.test.ts::Scenario REQ-RUN-02.1: file:// scheme with empty host is accepted` | unit | `Export named 'validateFactoryUrl' not found` | ✅ | empty-host/non-file×2/non-empty-host/unparseable — 5 cases | none needed |
| S-002.2b | `factory-pointer.unit.test.ts::Scenario REQ-RUN-03.1: missing default export` | unit | organic (same module-not-found gate as above) | ✅ | missing-default/missing-named/not-callable/default-ok/named-ok — 5 cases | none needed |
| S-002.2c | `factory-pointer.unit.test.ts::Scenario REQ-RUN-06.1: an already-defineFactory-wrapped export is rejected` | unit | organic | ✅ | wrapped-default/wrapped-named/bare-arity-1/bare-arity-2 — 4 cases | none needed |
| S-002.4 | `single-instance-probe.unit.test.ts::Scenario REQ-SEC-07.1: matching SDK copies proceed` | unit (real fs resolution) | `Cannot find module '../../src/transport/single-instance-probe.ts'` | ✅ | match(injected)/split(real fixture)/resolution-only(real fixture)/self-contained-fallback(real repo fixture)/unresolvable — 5 cases | resolver simplified from resolveSync+createRequire fallback to createRequire-only after the ADR-05 deviation (see Discoveries) |
| S-002.5a | `runner.unit.test.ts::Scenario REQ-RUN-01.1: both --input and --input-file rejected` | unit | organic: `Received: "pbuilder-runner: unrecognized flag"` (pre-`--input-file` support) | ✅ | both-flags/unknown-flag/neither-flag/missing-factory — 4 cases | none needed |
| S-002.5b | `runner.unit.test.ts::Scenario REQ-RUN-04.1: an input-file over the 10 MiB cap is rejected before its contents are read` | unit (real sparse/exact files) | organic: `Received: "pbuilder-runner: unrecognized flag"` | ✅ | over-cap(sparse)/exact-cap-boundary(byte-exact)/malformed-JSON(line/col, no-echo) — 3 cases | none needed |
| S-002.5c | `runner.unit.test.ts::Scenario REQ-RUN-07.1: module-not-found exits 1` | unit | organic: `Expected: 1, Received: 4` (Bun's `ResolveMessage` is not `instanceof Error`, defeating the first `isErrnoException`-based classifier attempt) | ✅ | not-found→1 / top-level-throw→4 — 2 cases | classifier rewritten from `isErrnoException`-gated to a direct `"code" in err` structural check (see Discoveries) |
| S-002.6 | `exit-matrix.e2e.test.ts::(b) a factory write collision: exit 2` | e2e (spawned, real stdio) | organic: uncaught `EmitRejection` crashing the test harness itself (`dispatchToFake` had no `ir.emit` error-shaping leg) | ✅ | argv-XOR→1 / collision→2 / corrupted-frame→3 / author-crash→4 / WPS-02-mismatch→1 / SEC-07-split→1 — 6 legs (a documented "handshake duo," not the full trio — see Deviations) | none needed |

## Discoveries

- **`import.meta.resolveSync` is Bun-only and untyped under `tsconfig.build.json`.** ADR-05
  named it primary with `createRequire(...).resolve` as fallback "if Bun's semantics prove
  unavailable" — both halves of that premise proved true: (1) `bun run build` (which types
  `src/**` against plain `"node"`, this repo's own Node-type-portable-`.d.ts` convention)
  fails on `Property 'resolveSync' does not exist on type 'ImportMeta'`; (2) empirically,
  `createRequire(anchor).resolve("@pbuilder/sdk")` does NOT support Node's package
  self-reference resolution in this Bun version (1.3.14), even though
  `import.meta.resolveSync` does. Since `resolveSync` is unusable at compile time
  regardless, `createRequire` became the SOLE mechanism (still resolution-only, still
  satisfies SEC-07.3) — a documented ADR-05 mechanism deviation, not a decision reversal.
- **`createRequire`'s self-reference gap breaks SEC-07 for THIS repo's own dogfooding
  fixtures** (`test/fixtures/frame-runner/**` factories live inside `@pbuilder/sdk`'s own
  source tree — there is no separate copy to resolve). `probeSingleInstance` recovers with
  a self-contained fallback: if the factory's OWN nearest `package.json` ancestor already
  IS the runner's package root, that's a match by construction, no specifier resolution
  needed. This is NOT a workaround for the real production shape (a consumer's factory
  resolving `@pbuilder/sdk` as an ordinary dependency always hits the primary path) — it is
  the correct behavior for a factory that literally lives inside the same package.
- **Bun's `import()` module-not-found failure (`ResolveMessage`) is NOT `instanceof
  Error`** (verified empirically), even though it carries a `.code: "ERR_MODULE_NOT_FOUND"`
  — defeating the codebase's established `isErrnoException` pattern (`err instanceof Error
  && "code" in err`). RUN-07's classifier reads `"code" in err` directly, without the
  `Error`-instance gate.
- **`Session.flush()`'s `toAuthoringError` catch-all degrades ANY non-`EmitRejection`
  rejection (including a `TransportFault`) to `AuthoringError{reason:"unknown"}`** (code 2,
  emit-rejection) — pre-existing `session.ts` behavior (read-only per design), not an S-002
  change. This means a wire fault arriving while `emit()` is in flight would misclassify as
  code 2, not code 3. The EXC-01.2 item (c) e2e leg targets the `tree.read` leg specifically
  (`Session.read()` propagates `client.read()` rejections unwrapped), where `TransportFault`
  classification is unambiguous — documented here so a future slice touching `emit()`'s
  fault path doesn't rediscover this from scratch.
- **`test/fake/fake-engine-harness.ts`'s `dispatchToFake` had NO `ir.emit` error-shaping
  leg** (S-000 explicitly deferred it: "Happy dispatch only... error-shaping legs land in
  later slices," and S-001 didn't add it either). S-002.6's collision e2e leg needed it —
  added a try/catch translating a thrown `EmitRejection` into the WPS-08 wire error
  envelope (`error:{code:-32001, message, data}`), additive to `HostResponseFrame`
  (`result` now optional, `error` added). `read`/`commit`/`discard` stay happy-dispatch-only
  — no REQ in this slice needs their error legs.
- **`bun pm pack --dry-run`/`test/fitness/pkg-surface-baseline.json` regenerated** (same
  procedure S-000/S-001 used): 4 new entries (`dist/transport/{exit-codes,single-instance-
  probe}.{js,d.ts}`) — authorized growth per design § 4.2 Create rows.

## Slice Audit Notes (Step 7c, mode: slice)

Groups 1–3 run over the full S-002 diff. No `Bug`/`Architecture` findings.

- **Group 1 (spec coverage)**: every REQ-ID in S-002's Covers list (RUN-01, RUN-02, RUN-03,
  RUN-04, RUN-06, RUN-07, SEC-07, EXC-01, EXC-02) has ≥1 test citing it directly (verified
  by grep count across `test/transport/*.ts` + `test/fake/exit-matrix.e2e.test.ts` +
  `test/skeleton/definefactory-brand-marker.test.ts`).
- **Group 2 (architecture)**: `src/transport/factory-pointer.ts` and `src/transport/
  runner.ts` importing from `src/core/schema/{schema-locate,schema-parse}.ts` mirrors the
  precedented `bin/pbuilder-codegen.ts` cross-import of the same module (RUN-04's
  line/column parse-error reporting "mirrors `formatParseError`" per spec text); no new
  layer violation. `test/fitness/` full suite (444 tests, 33 files) green, including
  fit-10/fit-29's allow-list guards (untouched by S-002 — ADR-07's fit-29 +1 was S-000's
  edit, no further widening needed here).
- **Group 3 (code quality)**: zero `as any`/`as unknown as`/TODO/FIXME introduced (verified
  by grep across the full diff, tracked and untracked). The `resolveFactoryExport`/
  `classifyExitCode` narrowing casts (`as BareFactoryFn`, `as { code?: unknown }`) are
  standard post-`typeof`/post-`in` narrowing, not untyped escapes.
- No sensitive-area-uncovered gap: the IPC boundary (already in the sensitive-areas
  registry) gained SEC-07 coverage this slice, not a new uncovered surface.

## Deviations from design

- **ADR-05 mechanism deviation** (see Discoveries): `createRequire(...).resolve` is the
  SOLE resolution mechanism (not `import.meta.resolveSync`-primary-with-fallback) — the
  DECISION (resolution-only realpath comparison, before import) is unchanged; only the
  specific API choice changed, for concrete, verified reasons (compile-time
  unavailability + a self-reference gap in this Bun version).
- **EXC-01.3's "handshake trio" ships as a documented duo this slice.** REQ-EXC-01.3 names
  three handshake-time failures (WPS-02 mismatch, BRB-01 bridge mismatch, SEC-07 split) —
  BRB-01 (the bridge) does not exist until S-003 (`bootstrap-bridge.ts`). The two legs
  testable now (WPS-02, SEC-07) are e2e-proven in `exit-matrix.e2e.test.ts`; S-003 adds the
  third leg, completing REQ-EXC-01.3's full trio at that point — not a scope gap, a build
  ordering consequence explicit in the Build Order table (S-003 "bridge reuses S-002's
  gates").
- `test/fake/fake-engine-harness.ts`'s `dispatchToFake` gained an `ir.emit` error-shaping
  leg — not in design's original S-000 File Changes row text ("Happy dispatch only"), but
  explicitly anticipated as future-slice work by that same row's comment, and needed by
  this slice's own EXC-01.2 collision leg.

---

# S-003: Engine bootstrap enters through the versioned bridge — same gates, sealed stdout

**Scope this run**: `slice:S-003` | **Mode**: Strict TDD | **Status**: complete (5/5)

The bridge (`bootstrap-bridge.ts`) hands off to the SAME `runner.ts` composition root argv
uses — BRB-01's version check, BRB-02/03's fd-1 capture + console redirect, and SEC-02's
reentrancy guard are all new; RUN-08 gives the direct-spawn path the identical fd-1/console
guarantee. WPS-09 confirms (characterization) that a pre-existing S-001 mechanism already
holds against a new attack shape.

## Carried-Forward Closures (evaluator-mandated, from S-002's verify-in-loop-3)

| Item | Status | Where |
|---|---|---|
| EXC-01.3 handshake trio (was a documented duo: WPS-02 + SEC-07) | **CLOSED** | `test/fake/exit-matrix.e2e.test.ts` — new BRB-01 mismatch leg, real spawned bridge process, `CRASH_POINTER` proves no-import (would exit 4 if ever imported) |
| RUN-02 no-import runtime proof (WARNING — test-depth gap) | **CLOSED** | `test/transport/runner.unit.test.ts` — two new tests under `REQ-RUN-02`, mirroring the `unreachedIo()` + `IMPORT_CRASH_POINTER` pattern RUN-07/SEC-07 already use |

## S-003 tasks (5/5)

| Task | Status | Files |
|---|---|---|
| S-003.1/.2 bridge version check + handoff + integration: bridge params traverse shared gates (BRB-01.1/.2/.3) | done | `src/transport/bootstrap-bridge.ts`, `test/transport/runner.integration.test.ts` |
| S-003.3 SEC-02 overlap guard + fit-35 | done | `src/transport/stdio-engine-client.ts` (`OverlappingRunError`), `src/transport/runner.ts` (reentrancy guard), `test/transport/runner.unit.test.ts`, `test/fitness/fit-35-sequential-fail-loud.test.ts` |
| S-003.4 harness leg: host-issued request discarded, reverse-only traffic (WPS-09) | done | `test/fake/harness.test.ts` |
| S-003.5 e2e both paths: fd-1 capture + console redirect pre-import, author sabotage isolated (BRB-02/03, RUN-08, SEC-09) | done | `src/transport/framing.ts` (`captureFd1FrameWriter` stub-neutering, `redirectConsoleToStderr`), `bin/pbuilder-runner.ts`, `test/fixtures/bridge-bootstrap-stub.ts`, `test/fixtures/frame-runner/sabotage/factory.ts`, `test/fake/fake-engine-harness.e2e.test.ts` |
| Shared test-support extraction (DRY, not a separate task) | done | `test/support/pushable-byte-source.ts`, `test/support/in-process-host.ts` — extracted from `test/transport/runner.integration.test.ts`'s prior local duplicates, reused by the SEC-02 tests, fit-35, and `harness.test.ts` |

Final: `bun test` → **1557 pass / 0 fail** (167 files, 3182 expect() calls); `tsc --noEmit` →
clean; `bun run build` → clean.

## TDD Cycle Evidence — S-003

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Closure: RUN-02 runtime proof | `runner.unit.test.ts::Scenario REQ-RUN-02.2/.3: ...never imports it` | unit | N/A — characterization (pre-existing `validateFactoryUrl` gate already correct; only the runtime proof was missing, per verify-in-loop-3's WARNING) | ✅ (pre-existing) | non-file-scheme / non-empty-host — 2 cases, both against `IMPORT_CRASH_POINTER` | none needed |
| S-003.1/.2 | `runner.integration.test.ts::Scenario REQ-BRB-01.1: a matching bridge version hands off cleanly...` | integration | `Cannot find module '../../src/transport/bootstrap-bridge.ts'` | ✅ | match-handoff / mismatch-rejects-loudly / bridge-params-hit-RUN-02-gate — 3 cases | none needed |
| S-003.3 | `runner.unit.test.ts::Scenario REQ-SEC-02.1: a second run-entry invocation...rejects OverlappingRunError immediately...` | unit | `Export named 'OverlappingRunError' not found in module 'stdio-engine-client.ts'` | ✅ | overlap-while-in-flight / clears-after-completion — 2 cases | none needed |
| S-003.3 (fit-35) | `fit-35-sequential-fail-loud.test.ts::a second run-entry invocation genuinely concurrent...` | architectural (real execution) | same missing-export RED as above (shared production dependency) | ✅ | second-overlap / third-overlap-while-first-still-in-flight — 2 cases (not a one-shot latch) | none needed |
| S-003.4 | `harness.test.ts::[characterization] Scenario REQ-WPS-09.2: a host-issued request frame arriving mid-run is discarded...` | integration | N/A — characterization (S-001's WPS-03 discard-unknown-frame-types loop already handles this; new attack SHAPE, pre-existing mechanism) | ✅ (pre-existing) | n/a — single mechanism, two REQ-scenario angles (WPS-09.1/.2) | none needed |
| S-003.5 | `fake-engine-harness.e2e.test.ts::direct-spawn path (RUN-08): a direct process.stdout.write(), console.log(), and a process.stdout reassignment never corrupt the wire...` | e2e (spawned, real stdio) | organic: exit 1 (`no collection.json found` — the new `sabotage/` fixture was initially missing its containment-root marker, the SAME `collection.json` every other `frame-runner/*` fixture carries) | ✅ (after adding `test/fixtures/frame-runner/sabotage/collection.json`) | direct-spawn / bridge-path — 2 cases, both against the SAME sabotage fixture | none needed |
| S-003.5 (BRB-01 mismatch, trio closure) | `exit-matrix.e2e.test.ts::BRB-01 bridge contract version mismatch: exit 1, naming both versions...` | e2e (spawned, real stdio) | `Cannot find module '../fixtures/bridge-bootstrap-stub.ts'` | ✅ | n/a — single mechanism; `CRASH_POINTER` used as a throw-on-import canary proving the mismatch check runs before any import | none needed |

## Discoveries

- **`process.stdout.write()` called DIRECTLY (no reassignment) is a real, distinct attack
  vector from `process.stdout` reassignment** (BRB-02.1's literal scenario). Capturing a
  reference to the write function alone does NOT stop a factory from calling
  `process.stdout.write(garbage)` — that call reaches the SAME underlying stream unless the
  live object is neutralized too. `captureFd1FrameWriter()` (design gives no literal
  mechanism, only "fd-1 capture") now immediately replaces `process.stdout` itself with a
  stub whose `.write` redirects to stderr, right after capturing the real reference — the
  returned writer closure is unaffected (it closed over the real reference first); any LATER
  access to `process.stdout` — direct call or reassignment — lands on the stub. Proven by the
  sabotage fixture's direct `process.stdout.write(...)` call landing on stderr, not the wire.
- **Testing BRB-02/03's fd-1/console side effects in-process would corrupt `bun test`'s own
  shared process.** Both mutate GLOBAL state (`process.stdout`, `console.*`); if
  `bootstrap-bridge.ts` ran them unconditionally at raw module-load, merely IMPORTING it for
  the BRB-01 integration test (design routes BRB-01 to `runner.integration.test.ts`, an
  in-process test) would silently redirect every subsequent test's console/stdout output in
  the same process. Resolved by making the protection INJECTABLE — `enterBridge`'s
  `protection` parameter defaults to the REAL mechanism (production/e2e path) but integration
  tests inject a no-op stand-in that forwards straight to the test's own io (mirrors
  `single-instance-probe.ts`'s injectable-resolver pattern, same rationale: real behavior by
  default, safe substitution for tests). This is a DERIVED mechanism, not given literally by
  design (design.md explicitly defers the bridge's concrete signature to S-003) — documented
  here rather than silently decided.
- **"At its own module load" (BRB-02/03's literal spec wording) is interpreted as "at the
  very start of the bridge's own entry invocation," not raw ES-module top-level code.** Given
  the in-process testing-safety conflict above, protection runs as the first statements
  inside `enterBridge()` (right after the version check), strictly before the ONLY path to a
  factory import (`runRunner`'s dynamic `import()`) — functionally equivalent for the
  requirement's actual intent ("before any factory-related code runs"), verified for real
  over real stdio in the e2e sabotage tests (not just asserted by code-read).
- **The SEC-02 overlap guard is a MODULE-level flag in `runner.ts` (the composition root),
  not per-`StdioEngineClient`-instance.** Design's Data Model places `OverlappingRunError`'s
  CLASS in `stdio-engine-client.ts` (the error-taxonomy home, alongside
  `IntentRejectedError`/`TransportFault`) but the GUARD's realistic trigger is the bridge
  being invoked twice in one long-lived engine process — the direct-spawn path can't
  realistically self-overlap (a fresh process calls `runRunner` exactly once). Scoping the
  flag to the module (the PROCESS), not an instance, matches WPS-09's "each process runs
  exactly one factory" framing exactly.
- **Overlap rejection is explicitly OUTSIDE the EXC-01 exit-code taxonomy** (spec: "produces
  no wire frame and travels no wire error code... there is nothing to send over the wire for
  it"). `runRunner` now has two distinct failure shapes: it RESOLVES to 0-4 for the run IT
  owns (EXC-01), but REJECTS (throws `OverlappingRunError`) for a call that never got to
  start at all — a second `runRunner`/`enterBridge` invocation this process never entertains.
  `exit-codes.ts::classifyExitCode` was NOT touched — it never sees an `OverlappingRunError`,
  since the guard throws before `runRunnerBody`'s try/catch is even entered.
- **The `sabotage/` fixture needed its own `collection.json`** (empty `{}`, byte-identical to
  every sibling `frame-runner/*` fixture) — the runner's containment-root resolution walks up
  from the factory looking for this marker; its absence surfaced as an unrelated-looking
  `AuthoringError` ("no collection.json found... cannot resolve the containment root")
  rather than any wire/sabotage-specific failure. Caught by running the e2e test, not by
  code-read — a genuine RED-for-the-wrong-reason moment resolved per strict-tdd.md's own
  guidance (fix the structural problem first, without touching sabotage logic).
- **`test/fitness/fit-30-stdout-sacred.test.ts`'s two pinned invariants (write-site count = 1,
  no unsanctioned `process.stdout`/`console.log(` reference outside `framing.ts`) initially
  broke from documentation prose, not runtime code**: the new JSDoc comments on
  `captureFd1FrameWriter()` and `bootstrap-bridge.ts`'s header literally contained the
  substrings `process.stdout.write(...)` and `process.stdout` respectively — fit-30 scans
  ALL text, comments included, by design (same posture as fit-10/fit-29). Reworded both
  comments to describe the mechanism without the literal dotted reference; zero code changed.
- **`test/fitness/pkg-surface-baseline.json` regenerated** (fresh `bun run build` +
  `bun pm pack --dry-run`, same procedure S-000/S-001/S-002 used): 2 new entries
  (`dist/transport/bootstrap-bridge.{js,d.ts}`) — authorized growth per design § 4.2's Create
  row for `bootstrap-bridge.ts`.

## Slice Audit Notes (Step 7c, mode: slice)

Groups 1–3 run over the full S-003 diff. No `Bug`/`Architecture`/`MAJOR` findings after the
two comment-only fit-30 fixes above (caught and resolved in-slice, not carried forward).

- **Group 1 (spec coverage)**: every REQ-ID in S-003's Covers list (BRB-01, BRB-02, BRB-03,
  RUN-08, WPS-09, SEC-02, SEC-09) has ≥1 test directly citing it, verified by grep across
  `test/transport/runner.integration.test.ts`, `test/transport/runner.unit.test.ts`,
  `test/fitness/fit-35-sequential-fail-loud.test.ts`, `test/fake/harness.test.ts`, and
  `test/fake/fake-engine-harness.e2e.test.ts`. Both carried-forward closures (EXC-01.3 trio,
  RUN-02 runtime proof) independently re-verified passing.
- **Group 2 (architecture)**: `bootstrap-bridge.ts` imports NOTHING that would trip fit-10 or
  fit-29 — no `EngineClient`/`EmitRejection` symbol reference (fit-10 scope), no
  `defineFactory` import (fit-29 scope; ADR-07's constraint — "if the bridge needs
  defineFactory, it goes THROUGH runner.ts's shared path" — honored: the bridge only calls
  `runRunner`, never wraps a factory itself). `test/fitness/` full suite (451 tests, 34 files)
  green, including the two flagged-and-fixed fit-30 comment violations. fit-15 (bin/src
  direction) unaffected — `bootstrap-bridge.ts` lives in `src/transport/`, imports only
  within `src/transport/`; `test/fixtures/bridge-bootstrap-stub.ts` is test-only, imports
  `src/` (the normal, allowed direction). No sensitive-area-uncovered gap: the IPC boundary
  (already registered) gained BRB/SEC-02/SEC-09 coverage this slice, not a new uncovered
  surface.
- **Group 3 (code quality)**: two casts introduced, both reviewed and justified rather than
  silently passed —
  1. `framing.ts:53` — `} as unknown as typeof process.stdout;` constructs a DELIBERATELY
     minimal stub (only `.write`) standing in for Node's full `WriteStream` interface; safe
     because no code anywhere in `src/` touches `process.stdout` again after capture (the
     returned writer closes over the pre-capture reference), and the stub's job is precisely
     to be a narrow black box, not a faithful `WriteStream`.
  2. `test/fixtures/frame-runner/sabotage/factory.ts:16` — `(process as unknown as {stdout:
     unknown}).stdout = {...}` bypasses `process.stdout`'s normal typing to simulate an
     ADVERSARIAL author's reassignment attempt (BRB-02.1's literal scenario); a real careless/
     malicious factory wouldn't respect our type cleanliness either, and this is test-fixture
     code, never shipped.
  Zero `TODO`/`FIXME` introduced (verified by grep across the full diff). Zero net duplication
  — the slice actively REMOVED duplication by extracting `pushableByteSource`/
  `makeInProcessHost` out of `runner.integration.test.ts`'s prior local copies into
  `test/support/`, reused by 4 call sites (that file, the SEC-02 tests, fit-35, and
  `harness.test.ts`).

## Deviations from design

- **Bridge protection (fd-1 capture, console redirect) is INJECTABLE, not raw top-level
  module code**, despite BRB-02/03's "at its own module load" wording — see Discoveries for
  the full rationale (in-process testing-safety conflict) and why this is functionally
  equivalent for the requirement's actual intent. Design gave no literal signature for
  `bootstrap-bridge.ts` and explicitly deferred deriving it to S-003.
- **`captureFd1FrameWriter()` now also neuters `process.stdout` itself** (stub replacement),
  not just captures a reference — design's § 4.2 one-line summary says only "captured-fd-1
  writer"; the neutering is this executor's derived mechanism to satisfy SEC-09's literal
  "an author's write to `process.stdout`... MUST NEVER be dispatched as a wire frame" claim
  against a DIRECT (non-reassignment) `process.stdout.write()` call — see Discoveries.
- **`test/fake/harness.test.ts` created in S-003** (not S-004, despite the file's FEH-family
  association) — design's own Test Derivation table (§ 4.6) routes WPS-09 to this exact file;
  S-004 extends it with the FEH-01..05 corpus-driven suite per its own task list. The file's
  header comment states this explicitly.
- **`OverlappingRunError`'s guard lives in `runner.ts` as module-level state**, not inside
  `StdioEngineClient` itself, though the CLASS is defined in `stdio-engine-client.ts` per
  design's Data Model (§ 4.3) — see Discoveries for why the composition-root/process scope is
  the correct trigger point, not a per-client-instance one.

---

# S-004: Conformance harness proves every REQ over real stdio

**Scope this run**: `slice:S-004` | **Mode**: Strict TDD | **Status**: complete (5/5)

FEH-01..05: the fake-engine conformance harness (design's Test Derivation table routes ALL
five to `test/fake/harness.test.ts`) proves parity between the in-process `ContractFake` run
and the process-boundary spawned run, structurally forbids the harness reimplementing
rejection semantics, ties every scenario's REQ-ID citation and the spec-item coverage map to
the SAME spec-parsed REQ-ID universe, and proves — over a real spawned process — that the
runner needs no Go toolchain. Zero `src/` changes this slice: S-004 is entirely test/
test-support work over the code S-000..S-003 already shipped.

## S-004 tasks (5/5)

| Task | Status | Files |
|---|---|---|
| S-004.1 shared corpus + `===` identity guard (FEH-02) | done | `test/fake/conformance-corpus.ts`, `test/fake/harness.test.ts` |
| S-004.2 parity + structural no-reimpl scan (FEH-01) | done | `test/fake/harness.test.ts`, `test/fake/fake-engine-harness.ts` |
| S-004.3 citation guard sharing FEH-05's parse (FEH-03) | done | `test/fake/harness.test.ts` |
| S-004.4 spec-parsed coverage map + count tripwire (FEH-05) | done | `test/fake/harness.test.ts` |
| S-004.5 adversarial matrix audit + no-Go proof (FEH-04) | done | `test/fake/harness.test.ts`, `test/support/frame-host.ts` |

Final: `bun test` → **1571 pass / 0 fail** (167 files, 3205 expect() calls); `tsc --noEmit` →
clean; `bun run build` → clean.

## TDD Cycle Evidence — S-004

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-004.1 (corpus) | [characterization] — corpus module is inert data (no dedicated RED; same posture as `test/e2e/author-emulation/scenarios.ts`, never RED-driven either) | — | n/a | n/a | n/a | n/a |
| S-004.1 (FEH-02.2) | `harness.test.ts::[characterization] REQ-FEH-02.2: a second import...identical reference` | architectural | n/a — pins an ES-module cache guarantee (mirrors fit-18's REQ-FSP-02.1, also organic) | ✅ | red-proof: reference-distinct-but-content-identical duplicate | none needed |
| S-004.2 | `harness.test.ts::Scenario REQ-FEH-01.2: the harness source contains no \`new EmitRejection\`...` | architectural | `error: not implemented` (stub throw, structural-fix-first) | ✅ | red-proof: fixture source with a planted `new EmitRejection(...)` construction is caught | none needed |
| S-004.2 (parity) | `harness.test.ts::Scenario REQ-FEH-01.1 (+FEH-02.1): every corpus scenario yields an identical outcome...` | integration (real spawned process) | `error: not implemented` (`noReimplementationViolations` stub; the parity test itself ran against pre-existing, already-proven machinery — `serveSpawnedRunner`'s new `responses` field was the only genuinely new surface, proven by the assertion on `rejection?.error?.data?.emitRejectionCode`) | ✅ | happy(committed)/collide(rejected) — 2 corpus entries, both outcome branches | none needed |
| S-004.3 | `harness.test.ts::Scenario REQ-FEH-03.1: every REQ-ID cited...resolves to a requirement...` | architectural | `error: not implemented` (`resolveSpecReqIds`/`extractCitedReqIds` stubs) | ✅ | red-proof: an invented `REQ-BOGUS-99` citation is caught as unresolved | none needed |
| S-004.3 (archive fallback) | `harness.test.ts::Scenario REQ-FEH-03.2: the spec-path resolver falls back to the post-archive per-domain layout...` | architectural (real fs fixtures) | `error: not implemented` | ✅ | pre-archive-present / pre-archive-absent-falls-back-to-post-archive-glob — 2 real tmp-dir fixtures | none needed |
| S-004.4 | `harness.test.ts::Scenario REQ-FEH-05.2: the parsed REQ-ID count matches the maintained expected count` | architectural | `error: not implemented` (`resolveSpecReqIds` stub) | ✅ | red-proof: a stale count constant vs a shorter parsed list | none needed |
| S-004.4 (coverage) | `harness.test.ts::Scenario REQ-FEH-05.1: zero uncovered REQ-IDs across the whole test suite...` | architectural | `error: not implemented` (`scanReqCitationsAcrossTests` stub) | ✅ | red-proof: an uncited, non-exempt REQ-ID surfaces via the shared `uncoveredReqIds` helper | none needed |
| S-004.5 | `harness.test.ts::Scenario REQ-FEH-04.1: the runner completes successfully with PATH restricted...` | e2e (spawned, real stdio, restricted env) | organic: `TypeError: null is not an object (evaluating 'probe.stdout.trim')` — `spawnSync`'s `sh` was unresolvable with the FIRST restricted-PATH attempt (bunDir only, no `/bin`/`/usr/bin` — `sh` itself lives there) | ✅ (after widening PATH to `bunDir:/usr/bin:/bin`, verified `/usr/bin`+`/bin` carry no `go` binary on this image) | n/a — single mechanism, but the probe sub-assertion (`command -v go` empty) triangulates that the restriction is real, not vacuous | none needed |

## Discoveries

- **`go` IS installed on this dev/CI image** (via linuxbrew, `/home/linuxbrew/.linuxbrew/bin/go`)
  — a naive FEH-04 test that just restricted PATH to bun's own directory and asserted the
  runner still exits 0 would have been a VACUOUS pass (the runner never shells out to `go`
  regardless of PATH, so removing it from PATH proves nothing on its own). Added a same-env
  `sh -c "command -v go"` probe asserting empty output ALONGSIDE the runner-still-works
  assertion — this makes the test self-validating: it fails loudly if the PATH restriction
  ever stops actually excluding `go` (e.g. a future image ships `go` under `/usr/bin`).
- **`test/fixtures/frame-runner/{happy,collide}` were reused as-is for the FEH-01 parity
  corpus** — no new fixtures needed. `runFactoryForTest` (in-process leg) and
  `serveSpawnedRunner` (spawned leg) both accept the SAME bare factory export / `file://`
  pointer respectively, so the corpus's `run`/`pointer` fields are two views of one file, not
  two definitions (REQ-FEH-02.1's literal claim).
- **FEH-01.1's "EmitRejection shape is identical" claim is proven at the LEVEL PUBLICLY
  OBSERVABLE from each side, not by reaching into `Session.flush()`'s private translation.**
  `runFactoryForTest`'s `RunResult.error` is deliberately an `AuthoringError` (never the raw
  `EmitRejection` — that's a contributor-kit-only type, per ADR-0009's two-audience
  boundary), so the in-process leg asserts `error.reason === "path-collision"`; the spawned
  leg asserts the wire error's `data.emitRejectionCode === "collision"` (the raw
  `EmitRejectionCode`, exposed verbatim by `dispatchToFake`'s existing error-shaping). These
  are the SAME classification via `authoring-error.ts`'s `CODE_TO_REASON` map (read-only, not
  re-derived here) — comparing them at their own natural altitude is more honest than forcing
  a byte-level structural diff across two different abstraction layers.
- **FEH-05's "zero uncovered" scan needed a build-ordering exemption set.** Empirically
  grepping `test/**/*.ts` for every one of the 41 spec REQ-IDs (before writing any S-004 code)
  showed exactly four uncited: `WPS-06`, `WPS-11`, `FEH-06`, `LED-01` — precisely S-005's own
  "Covers" line in slices.md. Spec.md's own REQ-LED-01 note pre-announces this exemption for
  LED-01 alone ("never harness-scenario-verified... a future FEH-05 implementation MUST
  account for this"); WPS-06/WPS-11/FEH-06 needed the SAME treatment for the SAME reason
  (their exercising fitness tests — fit-31/33/34 — are explicitly S-005 scope, not yet
  built). Documented as `PENDING_S005_COVERAGE_EXEMPTIONS` with an explicit shrink-not-grow
  instruction for S-005, rather than silently loosening REQ-FEH-05.1's "zero uncovered" bar.
- **`extractCitedReqIds`'s red-proof fixture had to be built from string fragments
  (`${"i"}${"t"}("Scenario REQ-BOGUS-99..."`) instead of a literal `it("...")` call** — a
  literal fixture would itself be textually present in `harness.test.ts`'s own source, and
  REQ-FEH-03.1's self-scan (which reads this exact file) would have flagged the red-proof's
  own invented `REQ-BOGUS-99` as an unresolved citation, false-failing the REAL guard test.
  Same self-contamination class fit-18 solves by excluding its own file path from its scan;
  here the fix is fragmenting the fixture text instead, since the file can't exclude itself
  from citing REAL REQ-IDs (it has 12 legitimate ones).
- **`serveSpawnedRunner` gained a `responses` field** (additive, `SpawnedRunSummary`) and
  `frameHostFactory`'s spawn helper gained an optional `env` passthrough (additive, defaults
  to `spawn`'s own inherit-`process.env` behavior) — both minimal, backward-compatible
  extensions to existing S-000/S-003 test-support code, not new files; every pre-existing
  caller (exit-matrix.e2e.test.ts, harness.test.ts's own WPS-09 tests) is byte-behavior
  identical.

## Slice Audit Notes (Step 7c, mode: slice)

Groups 1–3 reviewed over the full S-004 diff (two commits: `169abc3`, `e3b0276`). No
`Bug`/`Architecture`/`MAJOR` findings.

- **Group 1 (spec coverage)**: FEH-01..05 each have ≥1 test directly citing them in
  `harness.test.ts` (verified by the FEH-03.1 citation guard itself, which is now a standing
  check, not just a one-time grep). FIT-18 and FIT-10 (REQ-FEH-01's own "MUST stay green"
  clause) both green in the full-suite run.
- **Group 2 (architecture)**: zero `src/` files touched this slice — all four touched files
  are `test/`-only (`test/fake/conformance-corpus.ts` new, `test/fake/harness.test.ts`,
  `test/fake/fake-engine-harness.ts`, `test/support/frame-host.ts` extended). No new
  `src/transport/` surface, so FIT-10/FIT-29's allow-lists needed no further widening this
  slice. `test/fitness/` full suite green, unaffected.
- **Group 3 (code quality)**: zero `as any`/`as unknown as`/TODO/FIXME introduced (verified
  by grep across both commits' diffs) — an initial `as unknown as ConformanceScenario[]` cast
  in the FEH-02 red-proof was eliminated during REFACTOR by comparing two mutable spreads
  (`[...CONFORMANCE_CORPUS]`) instead of casting the readonly corpus array. Zero net
  duplication — the coverage red-proof and its real assertion share one `uncoveredReqIds`
  helper (extracted during REFACTOR) instead of duplicating the filter inline.

**Adversarial e2e matrix (S-004.5) audit**: `test/fake/exit-matrix.e2e.test.ts` (built across
S-002/S-003) already covers all four EXC-01 exit classes (1/2/3/4) plus the full EXC-01.3
handshake trio (WPS-02 mismatch, SEC-07 split, BRB-01 mismatch) — 7 legs total, matching
S-004's acceptance criteria's "adversarial e2e matrix" in full. No new legs were needed;
S-004.5's genuinely new work was the FEH-04 no-Go proof (routed to `harness.test.ts` per
design's Test Derivation table, not to `exit-matrix.e2e.test.ts`).

## Deviations from design

- **REQ-FEH-02's "shared corpus, `===` identity" guard is proven via a re-import + a
  content-identical-but-reference-distinct red-proof**, not by comparing two independently
  maintained corpus copies (there never was a second copy to compare — design specifies ONE
  corpus module from the start). This mirrors FIT-18's own precedent for pinning a
  language-level guarantee rather than testing a since-removed anti-pattern.
- **FEH-05's "zero uncovered" scan carries a documented, shrink-only exemption set
  (`PENDING_S005_COVERAGE_EXEMPTIONS`: WPS-06, WPS-11, FEH-06, LED-01)** — not in design's
  literal text (which only anticipates LED-01's exemption via spec.md's own note), but a
  direct, necessary consequence of slices.md's own Build Order ("S-005 docs LAST — against
  BUILT code") intersecting with FEH-05's REQ text ("zero uncovered... at test time"). See
  Discoveries for the empirical grep that confirmed exactly these four and no others.
