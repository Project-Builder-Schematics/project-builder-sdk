# Exploration: stdio-engine-client wire reconciliation + real EngineClient build (stdio-engine-client)

**Triage**: L
**Persona lens**: none

## Cross-Change Lessons Consulted

- obs #2154 (wire-protocol-adjudication): 3-judge unified design, D1-D5 verdicts, PR-1..6 build order
- obs #2157 (owner-rulings): closes 4 open decisions — advisory commit/discard, embedded bootstrap, declarative retired, Windows deferred
- obs #2152 (engine-bunipc-vs-wire-design): shipped bunipc ground truth vs stale doc, 4 divergences
- obs #2161 (triage-rulings): re-rank confirmed; factory-scaffold row deferred
- No `pattern`/`discovery` memories matched "EngineClient"/"StdioEngineClient" — first-of-kind work.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| `runFactoryForTest` + `ContractFake` (in-process author loop) | test/e2e/*.e2e.test.ts | Read-only — parity target |
| `builder exec` → embedded bootstrap → dynamic-imports project-local `pbuilder-runner` → factory runs → IR over stdio → engine applies | none — first-ever | Create |
| Fake-engine conformance run: scripted engine ↔ real spawned process, real stdio | none — `spawnCapture` is one-shot, not interactive | Create |

## Current State

`ContractFake` (`src/testing/contract-fake.ts`) is the sole `EngineClient` today — in-process, synchronous two-phase promote (ADR-01). Port (`src/core/engine-client.ts`): 4 methods (`emit`/`read`/`commit`/`discard`), `Promise<void>`, rejection MUST be an `EmitRejection{code, failedIndex?, appliedCount}` (`src/core/emit-rejection.ts`; codes: collision/not-found/unrepresentable/cap). `Session.flush` wraps raw rejections via `toAuthoringError` (`src/core/authoring-error.ts`), classifying by `code` only. `defineFactory` (`src/core/context.ts:298-351`) owns ADR-01/ADR-0037 all-or-nothing choreography: `als.run(fn)` → `dialects.drain()` → `session.flush()` → `session.commit()`, or on throw → `session.discard()` + re-throw (double-fault preserved). `wire.ts` defines `Batch`/`Directive`/`BATCH_CAP_BYTES=4MiB` (matches engine's `bunipc.MaxMessageBytes`, obs #2152). No wire code, no second bin, exist yet. `docs/engine-sdk-wire-design.md` (rev 2) describes NDJSON, single-initiator, `session.init`, argv-spawned runner — all four superseded by the ratified design.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/core/engine-client.ts` (port) | none | D2: port survives unchanged, callbacks map onto existing 4 methods | aligns |
| `src/core/context.ts` (choreography) | none (code) | commit/discard become advisory-over-wire; needs an ADR-0015 amendment, not code | aligns |
| `src/core/emit-rejection.ts` / `authoring-error.ts` | extend (consumer) | client must honor the failedIndex precondition (pending-changes.md:74) | aligns |
| StdioEngineClient home (`src/core/` vs new `src/transport/`) | new | first real, non-fake implementation | see Approaches |
| `bin/pbuilder-runner.ts` (new) | new | composition root, sibling of `pbuilder-codegen.ts` | aligns |
| `docs/engine-sdk-wire-design.md` | modify | rev 2→3: 3 central decisions reversed | aligns (doc's own header mandates it) |
| `test/fitness/fit-10-*` (port allow-list) | modify (conditional) | only if client lands outside the 1-entry allow-list | deviates if new dir |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `docs/engine-sdk-wire-design.md` | Modify | rev 3: length-prefix, host-initiated+callbacks, versioned ready, embedded bootstrap, JSON-Schema |
| new normative wire-spec doc | Created | method names, error shapes, pointer syntax, `BATCH_CAP_BYTES` naming |
| `bin/pbuilder-runner.ts` | Created | composition root — exact shape is an open question |
| StdioEngineClient (location TBD) | Created | framing + 4 reverse callbacks + EmitRejection mapping |
| `src/core/engine-client.ts`, `context.ts`, `emit-rejection.ts`, `authoring-error.ts` | Read-only | confirms no shape/code change needed, only the mapping contract to honor |
| fake-engine conformance harness (new) | Created | no interactive-spawn pattern exists yet |
| `test/fitness/fit-10-engine-client-port-guard.test.ts` | Modify (conditional) | allow-list extension iff client lands outside `src/core` |
| `test/fitness/fit-15-bin-core-direction.test.ts` | Read-only | confirms bin→core direction already enforced |
| `openspec/pending-changes.md` | Modify | StdioEngineClient row promoted; line-74 EmitRejection row absorbed; new Windows/macOS-pins row |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (IPC) | new StdioEngineClient + runner bin | Yes — the override that forced L |
| security (code execution) adjacency | `pbuilder-runner` dynamic-imports an author-controlled factory export | Yes |

## Approaches

### 1. StdioEngineClient inside `src/core/`
**Pros**: zero fitness-test changes — FIT-10 only guards *outside* core. **Cons**: contradicts the ADR-0035 precedent that RELOCATED `ContractFake` out of core-adjacent code specifically because transport/test machinery doesn't belong beside `defineFactory`'s pure choreography. **Effort**: Low. **Pattern fit**: contradicts existing precedent.

### 2. StdioEngineClient in a new `src/transport/`
**Pros**: matches the ADR-0035 precedent; keeps `src/core` pure; transport is independently testable. **Cons**: requires a deliberate, reviewed extension of FIT-10's allow-list — today exactly one entry, explicitly documented as "the ONE legitimate EngineClient implementer" (a structural `implements` exception was rejected at design time as spoofable). **Effort**: Medium. **Pattern fit**: new top-level `src/` dir — `deviates`, needs its own ADR.

## Recommendation

Approach 2. FIT-10's allow-list already frames itself as guarding against a spoofable structural shortcut, not against one more reviewed, explicit path — extending it by one line is smaller and more honest than reversing the ADR-0035 relocation. `sdd-design` should write one ADR covering both the new directory and the allow-list extension.

## Risks

- **Read-loop ownership ambiguity (HIGH)**: owner ruling #3 has engine-owned `sidecar.ts` "own[ing] framing," while triage scope assigns StdioEngineClient "length-prefix framing" and "reverse callbacks" — the multiplexing contract for routing a callback response back to StdioEngineClient over the SAME physical stdio stream sidecar.ts's own dispatch loop consumes is unspecified in every source consulted. This is the "second versioned contract" owner ruling #3 warns about. See Open Question 1.
- **EmitRejection failedIndex precondition**: pending-changes.md:74 (absorbed here) requires the client itself enforce the directive-vs-batch-level failedIndex precondition when mapping the engine's `SystemError`/`DeveloperError` taxonomy (confirmed to exist engine-side, obs #2152).
- **Constant-naming coupling**: `BATCH_CAP_BYTES` and engine `MaxMessageBytes` (`types.go:12`) are independently-defined, same-value-today 4 MiB constants with no shared source.
- **No interactive-subprocess test infra exists**: `spawnCapture` (`test/support/canary.ts`) is one-shot `spawnSync` capture; the conformance harness needs a genuinely new streaming stdin/stdout pattern.
- **Doc staleness compounding** (triage-flagged, confirmed): rev 2's Runner Contract (steps 1-5) describes an argv-spawned separate process — superseded by embedded-bootstrap (dynamic-import, no second spawn); needs a rewrite, not a patch.

## Open Questions

- type: technical
  question: "Given ruling #3 ('sidecar.ts owns framing') vs triage scope ('StdioEngineClient... framing... reverse callbacks'), what is the exact call boundary — does StdioEngineClient do its own raw stdio I/O (safe only because JS is single-threaded and the runFactory handler blocks synchronously), or does sidecar.ts inject already-framed callback functions it merely wraps?"
  why_it_matters: "Without this, sdd-design cannot specify StdioEngineClient's constructor/dependency shape — exactly the under-scoping owner ruling #3 warned about."
- type: technical
  question: "Can the engine issue a second `runFactory`-class Call to the same long-lived sidecar while a prior one is in flight?"
  why_it_matters: "Determines whether StdioEngineClient needs an ID-keyed pending-map (like the Go host's) or a simpler blocking-per-call model."
- type: product
  question: "Is the runner's exit-code taxonomy (validation failure vs. emit rejection vs. crash — flagged unresolved in the stale doc) in scope for this change's rev-3 doc, or deferred?"
  why_it_matters: "Triage scope names the argv contract but is silent on exit codes; the engine's S5 process-orchestration layer likely needs this pinned now, not assumed by design."

## Ready for Proposal

**Status**: partial
**Halt routing**: n/a
**Reason**: Investigation is complete and grounded (A1-A4 fully descended, FIT-10/FIT-15 impact evidenced) and one approach is recommended. But the read-loop ownership question is a genuine architectural fork unresolved by the adjudication, the owner rulings, or the engine's shipped code — not explore's job to invent.
**Recommended action**: Proceed to sdd-propose; carry Open Questions 1-2 (technical) into sdd-design's brief and Open Question 3 (product) to the user before the runner's exit-code contract locks. Consider a dedicated SPIDR spike slice for the read-loop ownership question in sdd-slice.
