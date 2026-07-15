# Apply Progress: stdio-engine-client

**Scope this run**: `slice:S-000` | **Mode**: Strict TDD | **Status**: halt (architectural-conflict)

## S-000 tasks completed (6/8)

| Task | Status | Files |
|---|---|---|
| S-000.1 `framing.ts` unit (WPS-01) | done | `src/transport/framing.ts`, `test/transport/framing.unit.test.ts` |
| S-000.2 `wire-protocol.ts` unit (WPS-02, WPS-05) | done | `src/transport/wire-protocol.ts`, `test/transport/wire-protocol.unit.test.ts` |
| S-000.3 `frame-reader.ts` happy-path unit | done | `src/transport/frame-reader.ts`, `test/transport/frame-reader.unit.test.ts` |
| S-000.4 `stdio-engine-client.ts` unit (WPS-10, SEC-01/03/06) | done | `src/transport/stdio-engine-client.ts`, `test/transport/stdio-engine-client.unit.test.ts` |
| S-000.5 FIT-10 allow-list +1 (ADR-01) | done | `test/fitness/fit-10-engine-client-port-guard.test.ts`, `test/fitness/pkg-surface-baseline.json` (regenerated — see Notes) |
| S-000.6 `test/support/frame-host.ts` unit | done | `test/support/frame-host.ts`, `test/support/frame-host.test.ts` |
| S-000.7 Minimal `runner.ts` + `bin/pbuilder-runner.ts` + fake-engine-harness shell | **BLOCKED** | see Halt below |
| S-000.8 e2e skeleton + fit-30 scan | blocked by S-000.7 | — |

Full suite (`bun test`) and `tsc --noEmit` both green as of the S-000.6 commit (1367 pass / 0 fail).

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.1 | `framing.unit.test.ts::JSON.parses the body back to the original value` | unit | `error: not implemented` (stub throw, structural-fix-first) | ✅ | ASCII / newline / 3-byte (€) / 4-byte surrogate-pair (😀) — 4 byte-length classes | none needed (pure arithmetic over `Buffer.byteLength`) |
| S-000.2 | `wire-protocol.unit.test.ts::rejects a greeting missing method: "ready"` | unit | `Cannot find module '../../src/transport/wire-protocol.ts'` (fixed by writing the real module directly — pure boolean guards, no risk of vacuous pass) | ✅ | match / mismatch / missing-method / missing-version / non-integer-version / non-object — 6 structural cases | none needed |
| S-000.3 | `frame-reader.unit.test.ts::decodes two frames coalesced into a single chunk, in order` | unit | `Cannot find module '../../src/transport/frame-reader.ts'` | ✅ | single-chunk / split-across-chunks / coalesced-in-one-chunk — 3 reassembly shapes | none needed |
| S-000.4 | `stdio-engine-client.unit.test.ts::commit() rejects with IntentRejectedError, never a bare Error, on a host rejection` | unit | `Cannot find module '../../src/transport/stdio-engine-client.ts'` | ✅ | ack path / host-rejection path for commit, discard, and read (null / empty-string / populated) — 3 read outcomes + 2 rejection paths | none needed |
| S-000.5 | `fit-10-...test.ts::[red-proof] ADR-01: an unrelated file inside src/transport/ naming EngineClient is still caught` | architectural | "expected `[]`, got `[names port symbol...: src/transport/stdio-engine-client.ts]`" (organic RED from the production scan once S-000.4 landed the real file) | ✅ | n/a — allow-list widening is a single boolean membership check, not a class of inputs | none needed |
| S-000.6 | `frame-host.test.ts::sends a frame and receives it echoed back, decoded` | unit (spawns a real subprocess) | `error: not implemented` (stub throw) | ✅ | single frame / sendReady frame / 3-frame ordering / kill+waitExit on a hung process — 4 mechanics | none needed |

## Halt: architectural-conflict (S-000.7)

**What**: `REQ-RUN-05` (S-000-covered) requires the runner composition root to wrap the
resolved factory export "using the internal `defineFactory`". Per `design.md` § 4.2 File
Changes, that composition root is `src/transport/runner.ts` (with `bin/pbuilder-runner.ts` as
a thin argv entry handing off to it) — neither path is under `src/core/`.

`test/fitness/fit-29-sanctioned-definefactory-caller.test.ts` (pre-existing, production
fitness function) restricts PRODUCTION imports of the `defineFactory` binding — resolving into
either `src/core/context.ts` directly or the barrel `src/core/index.ts` (which also re-exports
it, confirmed at `src/core/index.ts:9`) — to `ALLOWLISTED_ROOTS = [src/core, src/testing,
src/conformance]`. Its scan surface is `src/**` + `bin/**` (`fit-29-sanctioned-definefactory-caller.test.ts:67`).
Neither `src/transport/` nor `bin/` is allowlisted, so `runner.ts` (or `bin/pbuilder-runner.ts`)
importing `defineFactory` — as RUN-05 requires — would be flagged as an unsanctioned caller.

**Why this isn't a "just implement it" case**: `slices.md`'s Executor Context table (plan-verify
amendment, iteration 2) rules explicitly: *"fit-29 is NOT used — `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts`
pre-exists (unrelated check) and is untouched."* That ruling resolved a NUMBERING collision (a
new fitness check couldn't also be named "fit-29") — it did not anticipate that the pre-existing
fit-29 *itself* blocks RUN-05's specified implementation path. I checked for an already-sanctioned
indirection (re-export through `src/core/index.ts`, `src/testing/index.ts`'s former public
re-export — deliberately removed by an earlier `bare-factory-migration`, `src/conformance`'s
`run-vehicle.ts` — test/dev-only semantics, wrong for a production runner) and found none.

**What I did NOT do**: modify `fit-29-sanctioned-definefactory-caller.test.ts` unilaterally
(against the explicit "untouched" ruling), relocate `runner.ts` into `src/core/` (directly
reverses the already-ratified ADR-01 "land the transport cluster in a new `src/transport/`
leaf" decision + its stated alternative-rejected reasoning), or invent an unspecified new
`src/core/`-resident wrapper function not in `design.md`'s File Changes table.

**Resolution needs a Planner decision** between (at least):
1. Amend FIT-29's `ALLOWLISTED_ROOTS` to include `src/transport` (a new ADR — FIT-29 was
   "unrelated"/"untouched" only with respect to the numbering collision, not immune from this).
2. Add a small `src/core/`-resident production wrapper (e.g. exported alongside `defineFactory`)
   that `runner.ts` calls instead of `defineFactory` directly, keeping FIT-29's allow-list as-is.
3. Some other resolution the Planner/architect persona judges better.

Routing this halt as `architectural-conflict` per the orchestrator's Halt Routing table
(→ Planner, `sdd-design`).

## Notes

- `test/fitness/pkg-surface-baseline.json`'s `tarball` list was regenerated to include the 8
  new `dist/transport/*.{js,d.ts}` build outputs from S-000.1–S-000.4's new `src/transport/`
  modules — expected, authorized surface growth from `design.md`'s File Changes table (all
  four are `Create` rows), not scope creep. `exports`/`dependencies`/`files`/`bin`/`shebang`
  were untouched (transport is not publicly exported).
- Commits so far on `feat/stdio-engine-client`: `feat(transport): wire codec, protocol guards,
  and StdioEngineClient` (S-000.1–S-000.5) and `test(support): add frame-host async
  spawn+framed-stdio helper` (S-000.6).
