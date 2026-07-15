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
