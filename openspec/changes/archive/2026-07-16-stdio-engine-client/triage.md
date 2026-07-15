# Triage: stdio-engine-client

**Classification**: L
**Decided at**: 2026-07-15T00:00:00Z
**Change name**: `stdio-engine-client`

## Problem & Scope

> The engine repo (project-builder-engine, Go) is about to wire its shipped bunipc transport into execution (its S5 step: bunipc → ExecutionOrchestrator), and the runner seam (`pbuilder-runner` bin + `StdioEngineClient`) is the last unbuilt integration seam on the SDK side. The two repos held divergent wire designs (NDJSON vs 4-byte length-prefix framing; single-initiator vs host-initiated topology; `session.init` vs unversioned `ready`; project-local runner vs embedded sidecar; JSON Schema vs custom manifest). A 3-judge blind adjudication plus four owner rulings (2026-07-15) unified the design — but no NORMATIVE artifact exists that both repos can build against and conformance-test; the only shared record (`docs/engine-sdk-wire-design.md`) is stale on its three central decisions. If each repo builds against its stale record, the divergence just resolved on paper re-materializes as shipped code.

```yaml
scope:
  in_scope:
    - "docs/engine-sdk-wire-design.md -> rev 3: ratified unified design (length-prefix framing; host-initiated topology with 4 allowlisted reverse callbacks {tree.read, ir.emit, ir.commit, ir.discard}, commit/discard advisory-confirmed and engine-owned transaction; versioned `ready`, fail-at-greeting; engine-embedded bootstrap dynamic-importing the project-local runner; JSON-Schema properties format under a security-constrained profile)"
    - "normative, versioned wire spec (method names, error shapes, factory-pointer syntax, shared 4 MiB frame-cap constant naming BATCH_CAP_BYTES == MaxMessageBytes)"
    - "pbuilder-runner bin: argv contract (--factory <url>#<export> / --input / --input-file), dynamic-import of the bare factory export, internal defineFactory wrap with packageDir = dirname(factory), SDK half of the in-process bootstrap<->runner bridge contract"
    - "StdioEngineClient: first real EngineClient implementation - length-prefix framing, the four port methods as reverse callbacks, engine rejections mapped to ADR-0022 EmitRejection"
    - "scripted fake-engine conformance harness: a real spawned process speaking the wire over actual stdio (no Go required)"
    - "ledger updates: StdioEngineClient row in openspec/pending-changes.md, plus a new pending row for Windows support / macOS production pins (deferred)"
  out_of_scope:
    - "ALL engine-repo code (sidecar runFactory handler, manifest-parser retirement, transactional apply, fd-1 redirect) - the engine runs its own SDD cycle with the rev-3 doc as input"
    - "npm publishing / go-live (public-package plan)"
    - "Windows support (pending row only, not implementation)"
    - "TS-dialect op groups (unrelated ledger)"
```

## Description Received

> Reconcile the SDK-side wire design doc and build the last unbuilt SDK-side integration seam (`pbuilder-runner` bin + `StdioEngineClient`) against the wire design unified by a 3-judge blind adjudication (engram obs #2154) and four owner rulings (obs #2157) on 2026-07-15: length-prefix framing (not NDJSON), host-initiated topology with 4 allowlisted reverse callbacks (not single-initiator), versioned `ready` handshake (not `session.init`), engine-embedded bootstrap dynamic-importing the project-local runner (not direct-spawn), and JSON-Schema properties format (not a custom manifest). The existing `docs/engine-sdk-wire-design.md` is stale on exactly these three central decisions and is the cross-repo handoff vehicle — the engine's own build (S5 bunipc-to-ExecutionOrchestrator wiring) depends on this doc being correct. Also ships a scripted fake-engine conformance harness so the SDK can self-verify the wire without a Go dependency, and pulls forward the pre-existing L-sized `StdioEngineClient` pending-changes row (previously staged "not now — later engine-backed milestone").

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | `docs/engine-sdk-wire-design.md` (rewrite) + new normative wire-spec doc + `pbuilder-runner` bin (argv parsing, dynamic import, `defineFactory` wrap) ~3-4 files + `StdioEngineClient` (framing, callback dispatch, rejection mapping) ~3-4 files + fake-engine conformance harness (spawned-process fixture + test files) ~3-5 files + `openspec/pending-changes.md` ledger edit ≈ 12-18 files | L |
| Lines affected (estimated) | First real `EngineClient` implementation + a new bin + a new process-spawning test harness from near-zero — well past the M ceiling (~400) | L |
| Bounded contexts | 1 (the SDK-side half of the engine-integration seam: docs, runner bin, client implementation, conformance harness, ledger — all within this repo; engine-repo code explicitly out of scope) | L |
| New patterns | Multiple: length-prefix frame parser, host-initiated reverse-callback dispatch (first-ever inversion of the SDK's single-initiator assumption), dynamic-import bare-factory bootstrap bridge, first real (non-fake) `EngineClient`, a spawned-process conformance harness | L |
| Test types | New type certain: a scripted fake-engine speaking real stdio to a real spawned process (distinct from the existing `contract-fake.ts` in-process fake) | L |

### Overrides Triggered

- **Sensitivity — security (IPC)**: `openspec/sensitive-areas.md` already registers "JSON-RPC wire to the Go engine sidecar" as a sensitive area, currently at `confidence: low` specifically because "no concrete code in this repo yet; re-run `/sdd-init force=true` (or update this file) once it lands for real." This change is exactly that landing — first real `EngineClient`, first process-spawning runner. Forces **L minimum** regardless of size, and the registry itself should be refreshed once this change ships.
- **Sensitivity — security (code execution) adjacency**: the `pbuilder-runner` dynamic-imports an author-controlled bare factory export (`packageDir = dirname(factory)`) inside the same trust model already flagged for `.raw()` (`security (code execution)` row) — process boundary, not AST boundary, but the same "boundary discipline must be enforced" concern applies to what crosses the wire.
- **New pattern class, not new external dependency**: no new third-party library is introduced (framing/callbacks are hand-rolled per the adjudicated design), so the "new external dependency -> minimum M" override does not independently fire — the sensitivity override already dominates at L.

**Final classification**: **L** — sensitivity override (IPC wire landing for real) is sufficient alone to force L; independently corroborated by files-affected, new-patterns, and new-test-type criteria all landing at L. Not XL: everything in scope stays within one bounded context (this repo's half of the integration seam) and explicitly excludes all engine-repo code.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices) → ready for `/build`
- Slice target: 4-7

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| Architect | Always for L — this is a cross-repo contract seam with an ADR-shaped decision already made upstream (adjudication + owner rulings) that needs faithful translation into design |
| QA Engineer | Always for L — the fake-engine conformance harness IS the test strategy for this change |
| Tech Writer | Conditional — `docs/engine-sdk-wire-design.md` rev 3 and the normative wire spec are the cross-repo handoff artifact; `pbuilder-runner`'s argv contract and `StdioEngineClient` are effectively a public contract the engine team builds against |
| Security Engineer | Conditional — sensitivity override triggered (security IPC); reverse-callback allowlist, advisory-confirmed commit/discard, and the bootstrap↔runner bridge are all trust-boundary decisions |

Not triggered: UX Designer (no UI surface), DBA (no schema/migration).

## Spec Reference

`spec_source: internal` — no reference captured (per session bundle and `sdd-init/{project}/spec-source`, obs #2000).

## Risks Flagged at Triage

- **Staleness compounding**: `docs/engine-sdk-wire-design.md` is explicitly the cross-repo handoff vehicle the engine reads for its own S5 work — any gap between this change's rev-3 doc and what `sdd-design` actually specifies will re-materialize the exact divergence the adjudication just closed. `sdd-design` must treat the doc rewrite as normative output, not incidental documentation.
- **Two-contract surface**: owner ruling #4 (embedded bootstrap, obs #2157) explicitly calls out "a second versioned contract (the in-process JS bridge bootstrap↔runner) that must be specified alongside the wire spec" — this is easy to under-scope as "just write the client" when it is actually two coupled contracts (wire spec + bootstrap↔runner bridge).
- **Constant-naming coupling**: the shared `BATCH_CAP_BYTES == MaxMessageBytes` frame-cap constant is a literal cross-repo naming contract (per owner ruling PR-1/PR-2 build order, obs #2154) — a drift here breaks at runtime, not at review time.
- **Sensitive-areas registry currently understates this**: the IPC row is at `confidence: low` specifically pending real code; `sdd-design` or `sdd-archive` should trigger a `sdd-init force=true` refresh once this change lands so the registry reflects reality (concrete paths, raised confidence).
- **Out-of-scope boundary is load-bearing**: all engine-repo code is explicitly out of scope, but several in-scope deliverables (wire spec, bootstrap↔runner bridge) are meaningless without the engine building its matching half (PC-PROTO-01, PR-1/PR-3 in the adjudication's build order) — `sdd-propose`/`sdd-design` should make the cross-repo dependency and its sequencing explicit rather than implying this change is self-sufficient.

## Halt?

No

## Notes for Next Phase

- `sdd-explore` should read engram obs #2154 (3-judge adjudication, full unified design + PR-1..PR-6 build order) and obs #2157 (owner rulings, closes all 4 open decisions) in full — both are already fetched and summarized in this triage's Risks section, but `sdd-explore` needs the complete text for the D1-D5 rationale and the rejected-alternatives reasoning behind each ratified choice.
- Consult obs #2152 (engine bunipc reality-check) for the engine-side ground truth (`framer.go`, `session.ts:40-43` read-flush semantics, `context.ts:74` ALS single-instance pin) that the SDK-side implementation must respect.
- The existing `openspec/pending-changes.md` § "From engine↔SDK wire design (2026-07-14)" row already scoped `StdioEngineClient` at L with the same file bundle (runner bin, wire spec, conformance harness) — this triage pulls that row forward rather than re-deriving scope from zero; `sdd-slice` should reconcile against it directly.
- `docs/engine-sdk-wire-design.md`'s own header states updating it "is in scope of that change's archive, not optional" — `sdd-archive` must not skip the doc reconciliation as a formality.
