# Proposal: stdio-engine-client

**Change**: `stdio-engine-client` | **Triage**: L | **Persona lens**: none
**ready_for_proposal**: partial (caveats addressed below)

## Intent

The engine repo is about to wire its shipped bunipc transport into execution (its S5 step). The SDK-side runner seam — the `pbuilder-runner` bin plus the first real `StdioEngineClient` — is the last unbuilt integration seam, and the only shared design record (`docs/engine-sdk-wire-design.md`, rev 2) is stale on three central decisions the two repos already reconciled. A 3-judge blind adjudication (obs #2154) and owner rulings (obs #2157/#2163) unified the design: length-prefix framing, host-initiated topology with 4 allowlisted reverse callbacks, versioned `ready` fail-at-greeting, engine-embedded bootstrap dynamic-importing the project-local runner, JSON-Schema profile. If each repo builds against the stale doc, the divergence just resolved on paper re-materializes as shipped code. This change produces the normative artifact both repos build and conformance-test against, and builds the SDK half.

## Scope

### In Scope
- `docs/engine-sdk-wire-design.md` → rev 3 (the ratified unified design, three decisions reversed).
- A normative, versioned wire spec: method names, error shapes, factory-pointer syntax, shared `BATCH_CAP_BYTES == MaxMessageBytes` 4 MiB constant naming, exit-code taxonomy.
- `pbuilder-runner` bin: argv contract (`--factory <url>#<export>` / `--input` / `--input-file`), dynamic-import of the bare factory export, internal `defineFactory` wrap (`packageDir = dirname(factory)`), SDK half of the in-process bootstrap↔runner bridge.
- `StdioEngineClient`: first real `EngineClient` — length-prefix framing, the 4 port methods as reverse callbacks, engine rejections mapped to ADR-0022 `EmitRejection` honoring the `failedIndex` precondition.
- Scripted fake-engine conformance harness: a real spawned process speaking the wire over actual stdio (no Go required), internal-only.
- Ledger: `openspec/pending-changes.md` StdioEngineClient row promoted + new deferred row for Windows / macOS-production pins.

### Out of Scope
- ALL engine-repo code (sidecar `runFactory`, manifest-parser retirement, transactional apply, fd-1 redirect) — engine runs its own SDD cycle with the rev-3 doc as input.
- npm publishing / go-live (public-package plan).
- Windows support (pending row only, no implementation).
- Publishing the fake-host as a `./testing` export (owner ruling #2163: internal-only).
- Factory-scaffold DX row (re-deferred to public-package plan, obs #2161).
- TS-dialect op groups (unrelated ledger).

## Capabilities (contract with sdd-spec)

### New Capabilities
- `wire-protocol-spec`: normative versioned wire — methods, error shapes, factory-pointer syntax, length-prefix framing, shared frame-cap constant naming.
- `runner-exit-code-taxonomy`: distinct exit codes for validation-failure vs emit-rejection vs crash (owner ruling #2163).
- `pbuilder-runner-bin`: composition-root bin — argv parse, factory-URL scheme allowlist (C1), input-file size-cap + fail-closed parse (C3), dynamic-import + `defineFactory` wrap.
- `bootstrap-runner-bridge`: SDK half of the second versioned contract — the in-process JS bridge the engine's embedded bootstrap dynamic-imports.
- `stdio-engine-client`: first real `EngineClient` — framing, the 4 reverse callbacks {tree.read, ir.emit, ir.commit, ir.discard}, `EmitRejection` mapping with `failedIndex` precondition, single-instance realpath probe (C8).
- `fake-engine-conformance-harness`: spawned-process fake over real stdio, built as a transport shell over the ONE `ContractFake`.

### Modified Capabilities
None. The `EngineClient` port and `defineFactory`/ADR-0015 choreography survive unchanged in code (D2: callbacks map onto the existing 4 methods; commit/discard becoming advisory-over-wire is an ADR-0015 amendment, not a signature change). Ledger edits are bookkeeping, not spec-level behaviour.

## Approach

Reuse the existing seam wholesale — `EngineClient` port, `Session`, `DirectiveFactory`, `wire.ts`, and the normative `ContractFake` (which the process fake wraps, never re-implements). Four genuinely new patterns land: a length-prefix frame parser, host-initiated reverse-callback dispatch (first inversion of the SDK's single-initiator assumption), a dynamic-import bootstrap↔runner bridge, and a streaming spawned-process conformance harness (no such infra exists — `spawnCapture` is one-shot). The commit/discard callbacks are advisory-confirmed; the engine owns the transaction.

**Open for design (ADRs):** (1) `StdioEngineClient` home — `src/core/` (zero fitness churn) vs a new `src/transport/` (matches the ADR-0035 precedent that relocated `ContractFake` out of core, but needs a deliberate FIT-10 allowlist extension). Explore recommends `src/transport/`; the ADR is design's to write. (2) The read-loop ownership boundary between the engine's `sidecar.ts` framing and `StdioEngineClient` framing is unspecified in every source — carried as the top design question, possibly a dedicated spike slice; **not resolved here.** The cross-repo dependency is load-bearing: the SDK deliverables are inert until the engine builds its matching half (PR-1 protocolVersion + shared constant, PR-3 sidecar `runFactory`, PR-5 transactional apply + rejection-mapping REQ).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `docs/engine-sdk-wire-design.md` | Modified | rev 2 → 3: length-prefix, host-initiated + callbacks, versioned ready, embedded bootstrap, JSON-Schema |
| normative wire-spec doc | New | methods, error shapes, pointer syntax, constant naming, exit-code taxonomy |
| `bin/pbuilder-runner.ts` | New | composition root; argv, C1 URL allowlist, C3 input-file gate, dynamic-import + wrap |
| `StdioEngineClient` (`src/core/` or `src/transport/`) | New | framing + 4 reverse callbacks + EmitRejection mapping (home is an open ADR) |
| fake-engine conformance harness | New | spawned-process fake over real stdio; shell over the ONE ContractFake |
| streaming-subprocess test helper | New | genuinely new infra; `spawnCapture` is one-shot only |
| `src/core/{engine-client,context,emit-rejection,authoring-error}.ts` | Read-only | confirm no shape change; only the mapping/precondition contract to honor |
| `test/fitness/fit-10-engine-client-port-guard.test.ts` | Modified (conditional) | allowlist extension iff client lands outside `src/core` |
| `openspec/pending-changes.md` | Modified | StdioEngineClient row promoted; new Windows/macOS-pins deferred row |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Read-loop ownership boundary (engine `sidecar.ts` vs client framing) unspecified | High | Carry as top design question; likely a spike slice. NOT resolved in proposal |
| Doc staleness compounding — rev-3 doc is the engine's S5 input | High | Treat doc rewrite as normative output; reconcile against BUILT code, not spec-on-faith |
| `BATCH_CAP_BYTES` vs engine `MaxMessageBytes` drift (independent constants) | Medium | Pin the shared-naming contract in the wire spec; assert value in conformance |
| Two-contract under-scoping (wire spec + bootstrap↔runner bridge) | Medium | Split into two capabilities so sdd-spec creates both specs |
| No streaming-subprocess test infra | Medium | New helper, red-first (TDD); harness stays a shell over the ONE ContractFake |
| Factory-URL RCE if scheme allowlist not enforced (C1) | High | `file://`-only allowlist enforced before dynamic-import; adversarial guard test |
| Concurrent `runFactory` / unbounded-hang timeout posture | Medium | Design question (pending-map vs blocking; port has no deadline) — deferred to design |
| Cross-repo dependency: SDK deliverables inert without engine's half | Medium | Make sequencing (PR-1/PR-3/PR-5) explicit in design; conformance harness self-verifies SDK side |

## Rollback Plan

The change is purely additive — new files (runner bin, client, harness, wire-spec doc), a doc rev, a conditional FIT-10 allowlist line, and ledger edits. No migration, no data, no runtime consumer yet (the engine does not ship S5 against it within this change). Rollback: `git revert` the change commits — deletes the new bin/client/harness/helper, restores `docs/engine-sdk-wire-design.md` to rev 2, reverts the FIT-10 allowlist extension and the pending-changes edits. Forward-compatible to KEEP even on partial rollback: the rev-3 doc and normative wire spec are the correct shared design record regardless of whether the client lands — leave them if only the code reverts. Validate: `bun test` green (1259+ baseline) and the full fitness suite green post-revert. No unrecoverable data (no persistence introduced).

## Dependencies

- Engine repo building its matching half — PR-1 (`protocolVersion` on `ready` + name `MaxMessageBytes == BATCH_CAP_BYTES`), PR-3 (sidecar `runFactory` importing the project-local runner + fd-1 redirect), PR-5 (transactional apply + `SystemError`/`DeveloperError` ↔ wire ↔ `EmitRejection` mapping REQ). Cross-repo, out of scope, but load-bearing for end-to-end.
- No new third-party library (framing/callbacks hand-rolled per the adjudicated design).

## Success Criteria

- [ ] Walking-skeleton conformance proof green: spawn runner → versioned greeting → framed round-trip asserted BY VALUE → advisory commit → exit 0.
- [ ] Fake-engine harness is a transport shell over the ONE `ContractFake`; FIT-18 (single-fake parity) and FIT-10 (port guard) stay green.
- [ ] `StdioEngineClient` maps engine rejections to `EmitRejection` honoring the `failedIndex` precondition (adversarial test asserts directive-vs-batch level).
- [ ] Adversarial matrix green: partial-frame split, 4 MiB cap via serialized-bytes fixtures, stdout-pollution isolation, version mismatch (fail-at-greeting) + match, newline-in-payload.
- [ ] Factory-URL scheme allowlist (C1) enforced: a non-`file://` pointer is rejected before dynamic-import (RCE guard).
- [ ] `--input-file` size-cap-before-read + fail-closed JSON parse (C3); exit codes distinct for validation-failure / emit-rejection / crash.
- [ ] `docs/engine-sdk-wire-design.md` rev 3 + normative wire spec reconciled against BUILT code; `BATCH_CAP_BYTES == MaxMessageBytes` naming pinned.
- [ ] `openspec/pending-changes.md` updated: StdioEngineClient row promoted + new deferred Windows / macOS-pins row.

## Caveats from Exploration

Exploration returned `ready_for_proposal: partial`. Each caveat is addressed:

- **Read-loop ownership boundary (technical OQ1, HIGH)** → deferred to sdd-design as the top design question, possibly a spike slice. Not resolved here (explore correctly refused to invent it).
- **Concurrent `runFactory` — pending-map vs blocking-per-call (technical OQ2)** → deferred to sdd-design (constructor/dependency shape depends on it).
- **Exit-code taxonomy in scope? (product)** → RESOLVED by owner ruling #2163: IN the rev-3 doc scope; becomes the `runner-exit-code-taxonomy` capability; security harness scenario 8 is normative.
- **`--input-file` path provenance (product)** → RESOLVED: always an engine-owned temp path; SDK controls limited to size-cap + fail-closed parse (C3); path provenance is named engine assumption A1. No runner-side containment gate on the input-file path.
- **Fake-host published or internal? (product)** → RESOLVED: internal-only (owner ruling #2163); no `./testing` export, no FIT-09/FIT-14/installed-consumer surface added.
