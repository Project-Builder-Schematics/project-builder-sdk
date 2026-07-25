# Proposal: Runner Integrity Manifest (runner-integrity-manifest)

**Triage**: L | **Persona lenses**: architect, security-engineer, business-analyst, pm (all blind, parallel) | **Council synthesis**: orchestrator

## Intent

Emit `dist/runner-manifest.json` as a product of `bun run build` — the runner's static import closure (23 emitted `.js`) plus the root `package.json`, each SHA-256'd, deterministic, sorted, and shipped in the package — so the engine can verify the integrity of `pbuilder-runner.js` before exec'ing code it does not own. Only the SDK can produce this: nobody else knows its own closure.

Engine change `PC-RUN-01` (`production-runner-selection`) is BLOCKED on it. **Owner ruling 2026-07-25: unblock means the generator on `main` + submodule pin advance — NOT `0.1.0` published to npm.** Publishing is a later, separately-owned concern.

Alongside the manifest, the change lands the **closure-sealing tripwires** the engine's acceptance box #5 requires: the build fails, loudly and by name, when the closure acquires a bare specifier, an unprefixed builtin, a stray dynamic `import()`, or an unhashed-code-execution primitive.

## Scope

### In Scope
- **Closure derivation** from the **emitted `dist/**.js`**, fail-closed on any unclassifiable import-like construct.
- **Manifest emission**: 23 + `package.json`, lowercase-hex SHA-256, byte-wise sorted, POSIX paths, pinned key order and serialisation, trailing newline.
- **Determinism**: byte-identical for the same tree across rebuilds and machines; `newLine: "lf"` pinned; differing/non-ASCII absolute build path covered.
- **Build integration**: produced by `bun run build` itself, never a separate command; the build prints the manifest's own SHA-256 (owner ruling: in this change).
- **Closure-sealing tripwires**, including the **fourth precondition** (no unhashed-code-execution primitive: `createRequire(x)(…)`, `eval`, `new Function`, `node:vm`, `Bun.plugin`) as a deny-scan with red-proofs.
- **Constraint 1** enforced as a CI-breaking structural property scoped to the closure: injective `dist → src` correspondence + committed closure-graph baseline + bundler-output disjointness. **This is the shipping mechanism, not a fallback.**
- **Packaged fidelity**: digests verified against the **extracted tarball's own bytes**; `test/fitness/pkg-surface-baseline.json` deliberately regenerated to admit the new published file.
- **Publish-ordering invariant** pinned by extending `test/fitness/fit-23-publish-workflow-guard.test.ts` — the property ("bytes published == bytes hashed"), not the mechanism.
- **Invariants documented** as invariants: five preconditions (marked by owner), the honest scope boundary, the real justification, and the formal answer to the engine's open question.

### Out of Scope
- **Editing `.github/workflows/publish.yml`** — dry-run today; that file upgrades to sensitive `high` when `--dry-run` is removed, and a go-live batch already exists. We pin the property here and register a MANDATORY-precondition ledger row; the release change owns the mechanism.
- **Publishing `0.1.0`** — owner-ruled out of the unblock definition.
- **`mustNotExist` entries / `packageVersion` field** — blocked on engine questions 3 and 4. Adding schema fields unilaterally risks a strict parser fail-closing 100% of installs. Documented as a known gap; nothing added.
- **Loader-observation for Constraint 1** — followup, conditioned on the engine's Bun-vs-Node answer. **Hard rule: if that answer has not arrived by design sign-off, the structural shape ships and is not revisited this cycle.**
- **The fifth precondition** (loader injection) — engine-owned by construction; asked in the reply.
- **Any `src/**` behaviour change.** Target a ZERO `src/**` diff. Do NOT refactor `single-instance-probe.ts` — the fourth precondition is enforceable as a scan, which is what keeps `architecture_impact: additive`.
- **Gap A / `engine-e2e-real`** (PR #49). Owner ruled its home = **(a) standalone e2e in `test/e2e/`**; it resumes once the generator merges and the FIT-14 baseline is regenerated on main.

## Capabilities (contract with sdd-spec)

| Slug | Behaviour |
|---|---|
| `runner-closure-derivation` | Derive the closure from emitted `dist/**.js`, failing closed on any unclassifiable construct — zero silent skips. |
| `manifest-emission` | Write the manifest in the contract's declared schema: 24 entries, hex digests, byte-wise sorted, normalised paths. |
| `manifest-determinism` | Byte-identical output for the same tree across rebuilds, machines and build paths. |
| `build-pipeline-integration` | Produced by `bun run build`; no artefact survives a failed derivation; the build prints the manifest's own SHA-256. |
| `closure-sealing-tripwires` | Fail loudly, naming the offender, on bare specifier / unprefixed builtin / stray dynamic import / execution primitive. |
| `bundler-disjointness-invariant` | Constraint 1 as a CI-breaking structural property scoped to the closure — never by naming a tool. |
| `packaged-manifest-fidelity` | Digests match the extracted tarball's bytes; the publish-surface baseline admits the manifest deliberately. |
| `integrity-invariants-documentation` | Five preconditions, honest scope boundary, real justification, closure-portability answer — recorded as durable invariants. |

## Approach

**One change, not two.** The candidate seam (generator vs tripwires) is wrong: both consume the same `computeClosure()`; the tripwires are extra predicates on a walk the generator already performs. Splitting buys zero parallelism and costs a second full L cycle, and the tripwires are the engine's own acceptance box #5 — shipping without them hands them a deliverable that fails their stated acceptance.

**Delivery splits; the change does not.** The generator lands in the first slices and can be handed over (merge + pin advance) before this change archives.

Structure — one shared walk, two consumers:
```
scripts/runner-closure.ts              ← the ONE computeClosure()
  ├─ scripts/generate-runner-manifest.ts  (fail-closed authority, in `bun run build`)
  └─ test/fitness/fit-42-*.test.ts        (red-proofs + baselines)
```
Split by what each can honestly assert: **specifier-KIND invariants on source** (type-erasure-independent, catches the human act with no build); **the file SET on emitted `dist`** (the verified 24-vs-23 trap — a source-derived list is wrong by construction).

Placement in `scripts/` — the baseline's discriminator is shipped vs not-shipped. `src/` would land in the tarball (`rootDir: ./src`); `bin/` signals "shipped CLI with a `#bin` entry". This is the first `scripts/` file wired into `build`: a deliberate sharpening of the convention, recorded as an ADR.

**ADR budget: 4** (owner-ratified). (1) closure from emitted `dist`, not source; (2) generator home + build wiring; (3) Constraint-1 enforcement shape; (4) fourth precondition as a build-time deny-scan. **6 ADRs triggers re-triage, not acceptance.**

## Risks

| Risk | Mitigation |
|---|---|
| Constraint-1 becomes a research project awaiting Bun-vs-Node | Structural shape ratified as THE shipping mechanism. Hard rule: no answer by design sign-off → structural ships, not revisited this cycle. |
| False tamper alarm = 100% of a release's users fail closed, no workaround | Bias permissive (security ruling). Pin `newLine: "lf"`; verify against extracted tarball bytes; prove determinism, do not assume it. |
| FIT-14 goes red on first success | Deliberate baseline regeneration is a planned task, not a build surprise. |
| Closure drift between `6e4aab7` (engine-verified) and `7ef64ac` (our base) | Confirm 23 still holds before they pin; the committed closure-graph baseline makes it a permanent test. |
| Alarm fatigue — version skew and tampering look identical | `packageVersion` is the right answer but needs engine question 4. Documented gap; nothing added unilaterally. |
| C2 planted-`dist/package.json` bypass stands | Only the engine can close it (question 3). SDK-side fitness stops US being the source; the gap is documented, not silently omitted. |
| Pack-based e2e harness ~25% flaky on CI | Known issue; re-run. **Do NOT weaken the assertion to make it green.** |

**Retired during exploration** (verified empirically, not argued): `npm pack` and `bun pm pack` both preserve `package.json` byte-for-byte (same SHA in working tree, bun tarball and npm tarball). Entry #24 is viable as specified. The requirement stays in the spec because it must remain true, not because it is doubtful.

## Rollback Plan

Additive and reversible. The generator is one script plus one chained build step: removing the step stops manifest emission; removing `dist/runner-manifest.json` from `pkg-surface-baseline.json` restores the prior publish surface. No `src/**` behaviour changes, so no runtime rollback surface. The `fit-23` extension and `newLine: "lf"` are independently revertable. Engine-side consumption is gated by their own pin, so an SDK revert cannot break a released engine.

## Success Criteria

1. `bun run build` emits a deterministic `dist/runner-manifest.json` with exactly the 23 closure files + `package.json`, sorted byte-wise, POSIX paths, lowercase digests, trailing newline — and prints its own SHA-256.
2. Rebuilding an unchanged tree produces a byte-identical manifest; mutating any closure file changes **exactly** that entry's digest and no other.
3. The build **fails**, emitting no manifest, on: a bare specifier, an unprefixed builtin, a dynamic `import()` outside the sanctioned site, or an execution primitive — each proven by a planted red-proof that names the offender.
4. Constraint 1 breaks CI structurally, scoped to the closure, proven non-vacuous by the legitimate `pbuilder-codegen.js` bundle being correctly judged outside it.
5. The manifest ships in `npm pack` and its digests match the **extracted tarball's** bytes, entry #24 included.
6. Five preconditions documented as invariants, marked by owner, with the honest scope boundary stated verbatim.
7. The engine can pin a submodule commit whose build produces a manifest their mirror check accepts.

## Open Questions Carried to Spec

- **To the engine (non-blocking except where noted)**: Bun or Node in production (blocks the Constraint-1 *followup* only — structural ships regardless); verify-once vs per-spawn; `mustNotExist` acceptance; `packageVersion` tolerance; how the engine resolves the runner's absolute path.
- **To resolve at spec sign-off (BA ambiguities)**: is "23" a contract constant or a regenerable baseline (**recommend: regenerable baseline**, engine must confirm their mirror does not hard-code 23); sort scope (all 24 together vs `package.json` appended); the exact pinned serialisation; is "the factory-import site" file-scoped or site-scoped (**recommend: site-scoped** — the only reading that preserves intent); `bun link` scope wording.
- **Push-back to carry into the spec**: acceptance box 6 ("the three Constraints") cannot be satisfied honestly — there are **five** preconditions, two unacknowledged by the engine and one theirs. The spec records five. Signing a spec documenting three would be documenting a lemma we know to be unsound.
