# Triage: Engine↔SDK Real E2E via Package-Resolvable Demo Schematic (gap A)

**Classification**: M
**Decided at**: 2026-07-24T09:25:31Z
**Change name**: `engine-e2e-real`

## Problem & Scope

> WHO: engine + SDK teams proving the engine↔SDK integration is REAL, and downstream consumers needing confidence the SDK works as an installed, resolvable package. PAIN: today the "e2e" is a fiction — every conformance fixture and e2e imports the SDK by relative SOURCE path (`test/fixtures/frame-runner/happy/factory.ts` → `../../../../src/index.ts`); the SDK has never been exercised as an installed, package-resolvable dependency. The engine's work-brief names this "gap A". The CLI's "the connection can't be real" claim traces exactly here. WHY NOW: the engine's half is proven (runner honors `--factory`; #153 writtenPaths merged @ 7ef64ac); gap A is the last SDK-owned blocker before the engine bumps its pinned SDK submodule.

```yaml
scope:
  in_scope:
    - Demo schematic (SDK public authoring API) whose factory imports @pbuilder/sdk as a RESOLVABLE PACKAGE, not relative source.
    - A package-resolution path (bun link and/or tarball) resolvable from OUTSIDE the submodule.
    - A conformance fixture (engine harness manifest format) running the demo end-to-end through runner + wire.
    - Verification the demo runs green through the runner (ContractFake at minimum; real-engine leg is engine-side).
  out_of_scope:
    - Engine-side production wiring (NewExecutor real-runner selection) — engine-owned.
    - exit-code-2 and rename contract questions to the engine — followups, not code here.
    - Runner machinery changes (src/transport/runner.ts, src/bin/pbuilder-runner.ts) — already complete.
    - Production src/ behaviour. A needed package.json#exports change is a DECISION to surface, not assume.
```

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | ~5-8: demo factory, fixture dir (manifest + seed/expected), resolution wiring, one e2e/registration | M |
| Lines | small factory + manifest + resolution wiring; ≤400 | M |
| Bounded contexts | 1-2 (conformance/e2e test infra + packaging/resolution) | M |
| New patterns | one genuinely new: package-resolvable fixture (no fixture resolves the SDK as a package today) — variant scaffolding, novel core | M→L signal |
| Test types | possibly a new "package-resolution e2e" type | M→L signal |
| Precedent | PARTIAL: fixture pattern (`conformance/m*/`) + runner-spawn e2e (`test/fake/dist-runner-dual-realm.e2e.test.ts`) mirror-able; the bun link/tarball resolution core is greenfield | no reduction |

### Overrides Triggered
None. Sensitivity SUBJECT test: `package.json#files = ["dist"]` — only `dist/` ships; the demo + fixture live in `conformance/`/`test/` (NOT published) and CONSUME the existing `.` export (find/create/modify), adding none. The change does not ALTER the publish boundary, exports, the IPC wire, or CI/deploy behaviour — it consumes machinery that already exists. Proximity to the publish/IPC sensitive rows without altering them → no override. No new runtime dependency (bun link/pack are built-in tooling). No migration. Not cross-cutting.

**Final classification**: M — a bounded new capability (one demo + one fixture + one resolution mechanism) wrapped in well-precedented fixture/e2e scaffolding; the novel core (external package resolution) is real but singular, not L-scale.

## Recommended Path

- Phase: light Planner (M).
- Skills in order: `sdd-explore` → `sdd-propose` (MERGED: proposal + `## Requirements` REQ-IDs/Given-When-Then, doubles as spec) → `sdd-design` → `sdd-slice` (target 2-4 slices) → ready for `/build`. `sdd-spec` only to refine the merged spec.
- Slice target: 2-4.
- Model: sonnet in every phase (M dimension). Plan-verify gate SKIPPED (spec_source=internal, no publish).

## Recommended Personas

Personas not applicable for M (no sensitivity override → no security-engineer). Design should nonetheless treat the fixture manifest as a CROSS-REPO CONTRACT (engine `internal/conformance/harness.go` decodes with `DisallowUnknownFields`) and mind module-realm hazards (precedent: `context-singleton-fix`, the dist/src dual-realm bug).

## Spec Reference
spec_source: internal — no reference captured.

## Risks Flagged at Triage

- **Module-realm resolution hazard**: resolving `@pbuilder/sdk` as a package from a factory the runner dynamic-imports can reproduce the dual-realm identity bug (`context-singleton-fix`, ADR-0068/0069). Explore must confirm the resolution path keeps the runner's `defineFactory` realm and the factory's verb realm identity-consistent.
- **Escalation trigger → L**: if design proves it MUST add/change a `package.json#exports` key (altering the publish boundary), re-triage to L + security-engineer via `/replan`. Not evident now.
- **Cross-repo format drift**: the new fixture must satisfy the engine harness's `DisallowUnknownFields` decode exactly.

## Halt?
No.

## Notes for Next Phase
`sdd-explore` (light, M) should read: `test/fake/fake-engine-harness.ts` + `dist-runner-dual-realm.e2e.test.ts` (runner-spawn idiom to mirror), `conformance/m1-vehicle/` (schematic-lowering fixture shape), `package.json` (`files`/`exports`/`build`), and probe the concrete bun link/tarball resolution mechanism (the greenfield core). Compare the engine work-brief Deliverables 2+3 against what the corpus already provides — much scaffolding exists; the delta is the package-resolvable consumer.
