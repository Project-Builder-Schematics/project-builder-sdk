# Exploration: context-singleton-fix (context-singleton-fix)

**Triage**: M
**Persona lens**: none

## Cross-Change Lessons Consulted

- Discovery `project/core-context-dual-instance-bug` (engram #1287, 2026-07-19): the engine's OWN control-experiment transcript. Root cause and RECOMMENDED fix (globalThis/Symbol.for registry in `context.ts`) match this exploration's independent code-trace exactly. Confirms: same fixture through `src/bin/pbuilder-runner.ts` → exit 0 `[tree.read, ir.emit, ir.commit]`; through `dist/bin/pbuilder-runner.js` → exit 4 `[ir.discard]` only. Alternative (compile fixture factories into the build graph) is REJECTED-leaning and is triage's own out-of-scope item.
- Architecture baseline `sdd/project-builder-sdk/architecture` (F-5 build wiring, commit `5d423b9`): `dist/bin/pbuilder-runner.js` is a THIN `tsc`-emitted module resolving sibling `dist/transport/*.js` files — never a bundle. This is WHY the dual-instance hazard exists at all: a bundle would inline its own copy of everything and never observe `src/`; the thin-emit choice is what makes cross-realm `globalThis` dedupe the correct fix shape (verified below).

## Affected Flows

Not applicable — no author-facing/public-API signature changes (`context.ts` stays `@internal`, `dist/core/**` stays unreachable via `package.json#exports`, ADR-0034). This fixes an internal engine↔runner module-identity bug and adds regression coverage for the existing runner flow; it does not create or modify any user-facing flow.

## Current State

`src/core/context.ts:74` holds `const als = new AsyncLocalStorage<RunContext>()` at plain module scope. `defineFactory` (`context.ts:310`) is called exactly once per run by `src/transport/runner.ts:310`, which imports `defineFactory` from `../core/context.ts` — always resolved relative to whichever copy `runner.ts` itself is (in the spawn topology, `dist/transport/runner.js` → `dist/core/context.js`). The conformance corpus's factory convention (`CONFORMANCE-CORPUS-HANDOFF.md:48-50`, confirmed in `test/fixtures/frame-runner/happy/factory.ts:4`) imports authoring verbs via a RELATIVE source path (`../../../../src/index.ts`, re-exporting `./commons` only, `src/index.ts:4`) — never the bare `@pbuilder/sdk` specifier. `src/commons/index.ts:99` calls `currentContext()` (`context.ts:92`), which reads `als.getStore()`. Two independent module realms (`dist/core/context.js` vs `src/core/context.ts`, transpiled on load by Bun) each own their OWN `AsyncLocalStorage` instance — `defineFactory` (dist) enters its own `als`; the factory's `find()`/`create()` (src) consult a DIFFERENT, never-entered `als` → `currentContext()` throws the "outside-run" `AuthoringError` (`context.ts:95-101`, message text confirmed byte-identical to the engine's report, `authoring-error.ts:193`).

The existing e2e (`test/fake/fake-engine-harness.e2e.test.ts:13`) spawns `src/bin/pbuilder-runner.ts` (SOURCE), not the dist artifact — both runner and factory resolve `src/core/context.ts` identically, so this suite is structurally blind to the split; it cannot have caught this.

**Empirically verified** (scratch harness, `bun run`, not committed): a `globalThis[Symbol.for(key)]`-backed singleton — including an `AsyncLocalStorage` instance — dedupes correctly across a `dist/*.js` file and a `src/*.ts` file (Bun-transpiled) in one process; `.run()` entered from one copy is visible via `.getStore()` from the other across an `await` boundary. Also verified: Bun's module cache keys by resolved absolute path, so distinct relative-import spellings of the SAME file already share one instance today — only genuinely distinct files (dist vs src) split.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/core/context.ts` (`defineFactory` ALS) | modify | swap the module-scope `als` for a `globalThis[Symbol.for(...)]`-backed lookup | deviates — first `Symbol.for` usage in the codebase (confirmed zero prior hits); new but standard idiom |
| new dist-runner e2e test file (`test/transport/` or `test/fake/`) | new | spawns `dist/bin/pbuilder-runner.js` against the SAME src-relative-import fixture the corpus uses | aligns — reuses `test/support/frame-host.ts` + `test/fake/fake-engine-harness.ts` verbatim, same shape as the existing skeleton e2e |
| `src/transport/exit-codes.ts` / `runner.ts:337-340` (`instanceof AuthoringError`) | read-only | Hazard #2: confirmed the SAME class-identity hazard, narrower scope than triage assumed (see Risks) | n/a |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/context.ts` | Modify | module-identity-safe ALS registry — the confirmed fix |
| new dist-runner e2e test file | Created | reproduces + regression-guards the exact M1 bug against the real dist artifact |
| `test/support/frame-host.ts` | Read-only | confirmed directly reusable, runner-bin-path-agnostic |
| `test/fake/fake-engine-harness.ts` | Read-only | confirmed directly reusable, delegates to `ContractFake` |
| `src/transport/single-instance-probe.ts` | Read-only | confirmed WHY SEC-07 didn't catch this (see Risks); no change proposed in-scope |
| `src/dialects/{typescript,react}/ast.ts` (`hadBom`) | Read-only | sibling sweep: benign-split (verdict below) |
| `src/core/dialect-handle.ts` (`astHandlePaths`) | Read-only | sibling sweep: benign-split |
| `src/transport/runner.ts` (`runInFlight`) | Read-only | sibling sweep: benign-split |
| `src/transport/framing.ts` (`realFd1Write`) | Read-only | sibling sweep: benign-split |
| `src/core/dialect-error.ts` (`contained` WeakSet) | Read-only | sibling sweep: benign-split |
| `src/scaffold/index.ts` / `expander.ts` (`requirePackageAnchors`) | Read-only | residual Hazard #2 gap, not M1-reachable (see Risks) |
| `package.json` (`version`) | Read-only | `"0.0.0"`, no runtime version constant exists to qualify the registry key with |

## Sensitive Areas Crosscheck

No sensitive areas touched. `dist/core/**` ships in the tarball but stays outside `package.json#exports` (ADR-0034, confirmed in `openspec/sensitive-areas.md`'s `public-api (contract)` row); the fix stays `@internal`. No auth/payments/deployment/migration surface.

## Approaches

### 1. Module-identity-safe ALS via `globalThis[Symbol.for(key)]` registry
**Description**: replace `context.ts`'s plain `const als = new AsyncLocalStorage()` with a lazily-initialized lookup keyed on a well-known `Symbol.for` string, so every module realm resolving `context.ts` (dist or src) shares ONE `AsyncLocalStorage` instance via the process-wide symbol registry.
**Pros**: matches the engine's own diagnosis and RECOMMENDED fix; empirically verified to work across the exact dist/src split (scratch experiment above); minimal surface (one file); leaves the corpus's `.ts`-source factory convention untouched (in scope's `out_of_scope` list).
**Cons**: introduces the codebase's first `Symbol.for` idiom (no precedent to match against); does not, by itself, fully close Hazard #2's `instanceof AuthoringError` mismatch for every code path (see Risks).
**Effort**: Low.
**Pattern fit**: new pattern for this codebase, but the standard idiom for cross-realm singletons; closest existing precedent is `wire-protocol.ts`'s manually-maintained version constants (same "small pinned module-level value" shape, different mechanism).

## Recommendation

Approach 1 — module-identity-safe ALS registry in `context.ts`. It is the ONLY approach scope permits (the alternative, compiling fixture factories into the build graph, is explicitly out of scope and engine-rejected), it is empirically verified to work under this repo's actual build shape (thin dist emit, not a bundle), and it fixes the M1-blocking symptom directly at its confirmed root.

## Risks

- **Hazard #2 is only PARTIALLY closed by the ALS fix, not eliminated** (finding beyond triage's framing): fixing `context.ts` makes `als.getStore()` return the SAME `RunContext` object across copies — and since `Session`/`DirectiveFactory` are instantiated ONCE by whichever copy's `defineFactory` ran (dist), the factory's SRC-side commons calls operate on DIST OBJECTS via dynamic dispatch, making `Session.flush()`'s `toAuthoringError` conversions dist-consistent too. But `AuthoringError` instances constructed DIRECTLY by SRC-copy code still cross the boundary: `requirePackageAnchors`'s `invalidInput` throw (`src/scaffold/index.ts:64`, `expander.ts:103`), reachable via `create({templateFile})`/`scaffold`/`copyIn` — NOT by M1's plain `create({template})`. `TransportFault`/`IntentRejectedError` checks are unaffected (transport-only, always dist). Design should decide: accept as a documented residual fast-follow, or harden the `instanceof` checks now.
- **`single-instance-probe.ts`'s self-contained fallback (lines 106-114) is a confirmed false-negative** for this exact repo's dogfooding topology: when the factory's own package-root walk lands on the SAME `package.json` as the runner (true here — one repo, one package), the probe reports `{ok: true}` without ever proving the two resolve the SAME module file — which is exactly how this bug shipped unnoticed past SEC-07. Not in scope per triage, but the loophole persists for any FUTURE un-registry-protected singleton.
- New e2e's dependency on a fresh `dist/` build (triage-flagged) — CI already runs `bun run build` before `bun test`; a LOCAL stale `dist/` would give a false pass. Design must specify a fail-loud missing/staleness guard.
- Registry key has no version qualification precedent (`package.json.version` is `"0.0.0"`, no runtime `SDK_VERSION` constant exists) — a hand-maintained integer constant (matching `WIRE_PROTOCOL_VERSION`'s existing pattern) is the closest fit but is a design decision, not an explore-level one.

## Open Questions

- type: technical
  question: "Should the registry key be version-qualified (and if so, via a new hand-maintained constant mirroring `WIRE_PROTOCOL_VERSION`, or left unqualified for now)?"
  why_it_matters: "Unqualified is safe for THIS repo's single-package dual-copy scenario but silently merges ALS state across genuinely different SDK major versions in a real consumer's node_modules — a shape decision design should ratify, not assume."
- type: technical
  question: "Should `single-instance-probe.ts`'s same-package-root fallback (the confirmed false-negative that let this bug ship past SEC-07) be hardened in this change, or logged as a fast-follow?"
  why_it_matters: "It's the reason the existing handshake-time gate didn't catch the bug at all; leaving it as-is means a FUTURE un-registry-protected singleton could ship the same way, undetected."
- type: technical
  question: "Is the residual Hazard #2 gap (SRC-constructed `AuthoringError` via `requirePackageAnchors`/scaffold paths, not M1-reachable) acceptable as a documented residual for this change, or does design need to close it now?"
  why_it_matters: "It's a real, evidenced misclassification (exit 4 instead of 1) for `templateFile`/`scaffold`/`copyIn` authoring under the same dual-copy topology — silent if not explicitly scoped in or out."

## Ready for Proposal

**Status**: yes
**Reason**: Root cause is confirmed with direct code evidence (exact message-text match to the engine's report) and an empirical Bun experiment proving the proposed registry mechanism works under this repo's actual build shape. The sibling-hazard sweep triage flagged as "UNCONFIRMED" now has a clean, evidenced verdict for all four: benign-split, none reachable across the copy boundary — no fast-follow M changes needed from that list. The e2e topology is trivially achievable: the existing `happy` fixture already uses the corpus's exact import convention, and `frame-host.ts`/`fake-engine-harness.ts` are directly reusable. Zero file-level conflict with `feat/conformance-corpus` (diffed: it touches only `conformance/**`, `scripts/conformance-pr-gate.ts`, `test/fitness/fit-40-*`, `test/support/conformance-*` — none overlap this change's files), though it is a downstream consumer whose live engine run depends on this fix landing.
**Recommended action**: proceed to `sdd-propose`.
