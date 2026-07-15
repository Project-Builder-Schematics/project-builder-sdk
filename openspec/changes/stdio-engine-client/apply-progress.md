# Apply Progress: stdio-engine-client

**Scope this run**: `slice:S-000` | **Mode**: Strict TDD | **Status**: complete (8/8)

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
