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
