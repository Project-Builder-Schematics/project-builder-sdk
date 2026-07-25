# Triage: Runner Integrity Manifest (engine Deliverable 4 / PC-RUN-01)

**Classification**: L
**Decided at**: 2026-07-25
**Change name**: `runner-integrity-manifest`

## Problem & Scope

> The engine is graduating production to spawn the **real** `pbuilder-runner.js` instead of its embedded test-double. Before it execs code it does not own, it verifies that code's integrity — the same discipline it already applies to the Bun binary (digest-pinned) and its own embedded sidecar (content-keyed). It cannot reuse either mechanism: the runner is a **thin, multi-file, import-linked** module, so a single-file content key does not cover its imports and a bundle hash does not apply to a non-bundle. It therefore needs a **manifest of the runner's static import closure** — and **only the SDK knows its own closure**. Without it, engine change `PC-RUN-01` (`production-runner-selection`) is BLOCKED: the engine cannot graduate production to the real runner. This is a hard build gate on the critical path to a genuinely real engine↔SDK integration.

```yaml
scope:
  in_scope:
    - Generate dist/runner-manifest.json as part of `bun run build` — 23 closure .js files + the root package.json, each with lowercase-hex SHA-256, deterministic and sorted.
    - Derive the closure MECHANICALLY at build time (never hand-maintained) by walking static import/export-from + side-effect specifiers from the emitted entry.
    - Publish it: dist/runner-manifest.json must survive `npm pack` (package.json#files already covers `dist`, verify).
    - Fail the build loudly on a bare specifier beyond node:*, or a dynamic import() anywhere other than the factory-import site.
    - Enforce Constraint 1 (no bundler / no code-splitting) with a fitness test that breaks CI — owner ruling 2026-07-25, chosen over docs-only.
    - Document the three Constraints as build invariants (closure-sealing lemma), not folklore.
    - Answer the engine's open question in the artefact: one manifest per package (no per-platform map).
  out_of_scope:
    - Engine-side runner selection (PC-RUN-01) — engine-owned.
    - External manifest identity binding (lockfile integrity at resolve time) — the contract states nothing is required from the SDK beyond publishing normally.
    - Gap A / engine-e2e-real — PAUSED, PR #49.
    - The exit-code-2 and `rename` contract questions to the engine — separate followups.
```

## Description Received
Engine document `ENGINE-RUNNER-MANIFEST-CONTRACT.md` (2026-07-25), explicitly labelled **Deliverable 4**, additive to the earlier SDK brief. Carries 6 acceptance checkboxes and 3 Constraints.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | build script/generator, package.json, ≥2 fitness tests, unit+determinism tests, ADR, docs, CI touchpoint → ~7-10 | L |
| Lines | generator + tests + invariant enforcement + docs; ~400-800 | M-L |
| Bounded contexts | 2: build/publish pipeline + the runner closure it describes | M-L |
| New patterns | NEW: a build-emitted integrity artefact + a closure-derivation step. No precedent in this repo. | L |
| Test types | NEW type: determinism/byte-identity + tamper-detection + closure-shape fitness | L |
| Precedent | Greenfield — no existing build step emits a hashed artefact. `build:codegen` bundles, it does not hash. No reduction. | no change |

### Overrides Triggered
- **SENSITIVITY (subject test) — FIRES.** This change does not merely pass near a security boundary: the manifest **IS** an integrity-verification mechanism, and it **alters the publish boundary** by adding a new file to the published package (`security (supply-chain)` + `public-api (contract)` rows in `openspec/sensitive-areas.md`). Its correctness is what another repo's trust decision rests on: a wrong or nondeterministic manifest becomes a **false tamper alarm on a user's machine**, and a too-permissive one admits unverified code into the executed surface. The sensitive mechanism IS the core subject of the change → escalates to **L** (not merely the M floor).

**Final classification**: **L** — the sensitivity override fires with the security mechanism as the change's core subject, and the size/novelty criteria independently reach L (greenfield pattern, new test types, cross-repo contract with exact acceptance).

## Recommended Path
- Phase: full Planner with Council.
- Skills in order: `sdd-explore` → Council propose → `sdd-spec` (⇄ `sdd-design`) → `sdd-slice` → `sdd-verify --mode=plan` (L: two blind judges) → `/build`.
- Slice target: 4-7.
- Model: opus for propose/design/verify-plan/council/steward; sonnet for the rest.
- Full L ceremony ACTIVE: architecture hooks (all five), steward foresight + reckoning, plan-verify gate, adversarial judgment-day at `/evaluate`.

## Recommended Personas

| Role | Reason |
|---|---|
| Business Analyst | Always for L — the 6 acceptance checkboxes are the acceptance criteria; must become REQ-IDs verbatim |
| PM | Always for L — this is a BUILD GATE for PC-RUN-01; scope discipline against the paused gap A |
| Architect | Always for L — the closure-sealing lemma and its 3 preconditions are architectural invariants |
| QA Engineer | Always for L — determinism, tamper-detection, and negative cases (red-proofs) are the whole value |
| **Security Engineer** | Sensitivity override — this is integrity infrastructure consumed cross-repo; threat model is "malicious schematic author" |
| **Tech Writer** | Cross-repo contract + a newly published artefact; the invariants must read as durable, not folklore |

## Spec Reference
spec_source: internal — no reference captured. Cite engine `PC-RUN-01` (org project #2) as the external build gate.

## Risks Flagged at Triage

- **CRITICAL (verified, pre-empted)**: the closure walk MUST run over the **emitted `dist/*.js`**, never `src/*.ts`. A source walk yields **24** files — one extra: `src/core/engine-client.ts`, imported ONLY via `import type` (`stdio-engine-client.ts:17`, `context.ts:9`, `session.ts:11`), which `tsc` ERASES from emitted JS. The engine treats extra entries as a manifest/closure mismatch → fails closed on the user's machine. Independently verified 2026-07-25 (engram obs 1508).
- **Nondeterminism = false tamper alarm.** Sort order, path separators, digest case, key order, trailing newline all matter. A machine-dependent manifest breaks users, not CI.
- **Staleness = indistinguishable from tampering.** The generator must be wired INTO `bun run build`, never a separate forgettable command.
- **Verification baseline drift**: the engine verified against pinned submodule `6e4aab7`; this change is based on `origin/main` @ `7ef64ac`. Confirm the closure is identical across both before publishing the manifest as authoritative.
- **Constraint 1 is hard to enforce mechanically** — "no bundler with code-splitting" must be caught by a structural property (dist is 1:1 file-per-source) rather than by naming the tool. Design must pick a check that survives a tool swap.

## Halt?
No.

## Notes for Next Phase

All five of the engine's stated findings were **independently verified before triage** (engram obs 1508) and are CORRECT — do not re-litigate them, build on them:
1. closure = **23** `.js` (bin 1, transport 9, core 7, core/schema 6);
2. exactly **6** node builtins (`async_hooks, console, fs, module, path, url`);
3. **zero** bare/third-party specifiers;
4. **zero** `process.env` in the closure;
5. exactly **one** dynamic `import()` — `src/transport/runner.ts:268`, the author's factory.

The engine's open question is answerable **NO** with evidence (one manifest, no per-platform map): the build is plain `tsc`, 1:1 file-per-source, no platform conditionals, no env branching, no conditional subpath resolution in the closure. `sdd-spec` should record this as the formal reply.

Owner ruling 2026-07-25: Constraint 1 gets a **fitness test that breaks CI**, not documentation alone.
