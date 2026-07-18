# Proposal: context-singleton-fix

**Triage**: M · **Persona lens**: none

## Intent

The engine repo (`sdk-live-conformance`, PC-PROTO-02) is BLOCKED on M1: every authoring verb fails with `AuthoringError: authoring verbs can only be used while a schematic is running` (exit 4) when a factory is loaded from `.ts` source per the corpus convention. Confirmed root cause (engine control-experiment + independent code-trace, exact message-text match): the thin-emit `dist/bin/pbuilder-runner.js` resolves `dist/core/context.js` while the `.ts` factory's relative imports resolve `src/core/context.ts` — two `AsyncLocalStorage` instances. `defineFactory` enters one; the factory's verbs consult the other, never-entered, and throw. This is P0: the fix must reach `main`, prove itself green there, and advance the engine's pin.

## Scope

### In Scope
- Module-identity-safe run-context singleton in `src/core/context.ts` (`globalThis[Symbol.for(...)]` registry).
- A dist-runner e2e regression test spawning `dist/bin/pbuilder-runner.js` against a `.ts`-source factory using the corpus's src-relative import convention.
- Documented sibling-singleton sweep verdict (explore-produced: all four benign-split, no reachable residue).

### Out of Scope
- Corpus fixture changes; the handoff's `.ts`-source factory convention; engine-side changes; compiling fixtures into the build graph (rejected).
- Hazard #2 residual close (FU-4), `single-instance-probe` false-negative hardening (FU-5), broader dist verb coverage (FU-2), continuous dist-proof CI gate (FU-3) — all registered followups.

## Capabilities (contract with sdd-spec)

### New Capabilities
- `module-identity-safe-run-context`: run-context singleton dedupes across dist/src module realms; authoring verbs work from either.

### Modified Capabilities
- None.

## Approach

Replace the plain module-scope `const als = new AsyncLocalStorage()` with a lazily-initialised lookup keyed on a well-known `Symbol.for` string in the process-wide registry, so every realm resolving `context.ts` shares one instance. Empirically verified under this repo's actual build shape (thin `tsc` emit, not a bundle). The regression e2e MUST recreate the two-instance topology (dist runner + src-resolving `.ts` factory) or it is false-green; it reuses `test/support/frame-host.ts` + `test/fake/fake-engine-harness.ts` verbatim and requires a fail-loud fresh-`dist/` guard. `context.ts` stays `@internal` (off `package.json#exports`, ADR-0034). Design must ratify one ADR: whether the registry key is version-qualified (recommendation: unqualified now — `package.json.version` is `"0.0.0"`, no runtime version constant; qualification is a followup, not M1-reachable).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/context.ts` | Modified | ALS swapped for `globalThis[Symbol.for(...)]` registry |
| new dist-runner e2e test file | New | reproduces + regression-guards M1 against real dist artifact |
| `test/support/frame-host.ts`, `test/fake/fake-engine-harness.ts` | Read-only | reused verbatim |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| First `Symbol.for` idiom in codebase | Low | Standard cross-realm pattern; ratified via design ADR |
| Unqualified key merges ALS across SDK majors in a real consumer | Low | Not M1-reachable (single-package repo); version-qualification followup |
| Stale local `dist/` gives false pass | Medium | Fail-loud missing/staleness guard in the e2e (design-specified) |
| Residual Hazard #2 (src-constructed AuthoringError via scaffold paths) | Low | Not M1-reachable (`create({template})` unaffected); FU-4 |

## Rollback Plan

Single-commit revert of the `context.ts` change restores the prior module-scope `als` — the e2e (added in the same slice set) reverts with it. No migration, no persisted state, no schema, no data loss: the change is pure in-process module wiring. Validate rollback by re-running the existing `test/fake/fake-engine-harness.e2e.test.ts` (source runner) — green confirms no regression to the pre-fix source-path flow. The engine pin simply is not advanced. Forward-safe to leave: nothing, since the fix is atomic to one file.

## Dependencies

- Downstream (non-gating): engine M1 confirmation after pin advance — external followup, not part of done-definition's mergeable unit.

## Success Criteria

- [ ] New e2e spawning `dist/bin/pbuilder-runner.js` against a `.ts`-source factory exits 0 with `[tree.read, ir.emit, ir.commit]`.
- [ ] The same e2e FAILS on `main` before the `context.ts` fix (proves it guards the real bug).
- [ ] Full suite green on `main` post-merge (no regression to source-runner flow).
- [ ] `context.ts` remains absent from `package.json#exports` (stays `@internal`).
- [ ] Fresh-`dist/` guard fails loud on a missing/stale build rather than false-passing.
