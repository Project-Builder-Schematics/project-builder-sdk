# Exploration: Runner Integrity Manifest (runner-integrity-manifest)

**Triage**: L
**Persona lenses**: build/tooling (sonnet), architect (opus), security-engineer (opus) — run in PARALLEL, blind to each other

## Cross-Change Lessons Consulted
- `conformance-corpus`: baseline-diff fitness idiom (`fit-40`), red-proof discipline, ZERO-`src/**`-diff posture for test-infra changes.
- `context-singleton-fix`: the dist-vs-src realm distinction that makes the 24-vs-23 trap real.
- ADR-0058: the runner deliberately has NO `package.json#bin` entry — the engine spawns it by absolute path.

## Current State
Build is `prebuild: rm -rf dist` → `tsc -p tsconfig.build.json` → `build:codegen` (`package.json:64-74`). `tsc` emits the runner tree 1:1 file-per-source; `build:codegen` bundles ONLY `bin/pbuilder-codegen.ts` (separate entry, not in the runner closure). No manifest exists. No `scripts/` file is currently wired into `build` — `regen-corpus.ts` and `conformance-pr-gate.ts` are deliberately manual/CI-only.

## Verified Preconditions (do not re-litigate)
All 5 engine claims independently confirmed: closure = **23** emitted `.js` (bin 1, transport 9, core 7, core/schema 6); **6** node builtins; **0** bare specifiers; **0** `process.env`; exactly **1** dynamic `import()` (`src/transport/runner.ts:268`). **The walk MUST target emitted `dist/*.js`** — a source walk yields 24 (`src/core/engine-client.ts` is `import type`-only; tsc erases it).

## CONVERGENT FINDINGS (both opus lenses, independently)

### C1 — CRITICAL: `publish.yml` rewrites `package.json` AFTER the build
`.github/workflows/publish.yml`: `bun run build` (line ~49) → `npm version 0.0.0-dev.<sha> --no-git-tag-version` (line ~56, **rewrites `package.json`**) → `npm publish`. Manifest entry #24's digest is computed against bytes that no longer exist at publish time. Currently rescued **by accident** via `prepublishOnly: bun run build` re-running after the bump. That makes the explicit build redundant and puts every published manifest's correctness on an unconnected lifecycle hook. `--ignore-scripts`, `bun publish`, or `bun pm pack` (fires `prepack`, not `prepublishOnly`) each ship a broken manifest that fails closed on **100% of installs**. **Must be resolved before 0.1.0.**

### C2 — The manifest is an inclusion list and cannot express ABSENCE
`packageRootFor()` (`src/transport/single-instance-probe.ts:45-53`) walks UP from the runner and returns the FIRST dir containing `package.json`: `dist/bin/` → `dist/` → root. Planting `dist/package.json` terminates the walk early **without breaking a single digest**. Worse (architect): its `"type"` field governs the **parse mode of all 23 closure files** — `{"type":"commonjs"}` reinterprets every hashed byte without editing one. Content hashing is a content oracle; this is a **topology** problem. Needs a negative assertion (`mustNotExist`) or an engine-side no-intermediate-`package.json` rule.

### C3 — Entry #24's justification is wrong (and the right one is stronger)
The contract justifies hashing root `package.json` via `packageRootFor()`. That does not hold — content hashing cannot constrain a topology walk. The **correct** justification is `"type": "module"` (plus `exports`/`bin`): loader-controlling data in the strictest sense. Keep entry #24; fix the reason.

## ARCHITECT-ONLY FINDINGS

### A1 — THE FOURTH PRECONDITION (missing, and already live in this codebase)
The lemma is sound as an *import-graph* statement, **unsound as an *executed-code* statement**. Constraint 2 bans a second `import()` but says nothing about other execution primitives — and one is **already imported by the closure**:
```
src/transport/single-instance-probe.ts:28,39
  import { createRequire } from "node:module";
  return createRequire(anchorUrl).resolve(specifier);
```
Only the discipline of calling `.resolve()` keeps this resolution-only. `createRequire(anchor)("./x")` **executes unhashed CommonJS with no import edge anywhere** — invisible to a generator grepping for `import(`. Same family: `eval`, `new Function`, `node:vm`, `Bun.plugin`. All zero today; **none constrained by the three stated preconditions**. The file's own header argues the convention at length — i.e. exactly the folklore the contract asks us to stop relying on.
> **Fourth precondition: no unhashed-code-execution primitive inside the closure.**

### A2 — FIFTH precondition (engine-side)
The lemma's *conclusion* additionally needs a spawn with no loader injection: `NODE_OPTIONS`, `--import`, `--require`, `--preload`, `--experimental-loader`, `Bun.plugin`. These inject executing modules with **no import edge at all**. The "zero `process.env` in the closure" finding does NOT cover it — `NODE_OPTIONS` is read by the runtime, not by closure code. Engine controls the spawn and can neutralise it trivially; nobody wrote it down.

### A3 — Constraint 1 must be scoped to the CLOSURE, not to `dist/`
**A bundler already runs in this build** and writes into the runner's own directory (`build:codegen` → `dist/bin/pbuilder-codegen.js`). Any all-of-`dist` 1:1 check fails immediately on that legitimate bundle. The realistic drift is not "someone adopts a bundler" — it is "someone points the bundler already here at the runner for startup perf". Three layers: (a) **injective source correspondence** (one direction only — `src → dist` must NOT be asserted, since `dist/core/engine-client.js` legitimately exists outside the closure); (b) **committed closure-graph baseline** (23 nodes + edges, FIT-04/FIT-14 idiom); (c) **bundler-output disjointness** (every `--outfile`/`--outdir` in `package.json#scripts` disjoint from closure paths — non-vacuous today).

### A4 — Generator placement: `scripts/`, ALIGNS
The baseline's discriminator is **shipped vs not-shipped**, not build-time vs runtime. `bin/` = shipped CLI with a `#bin` entry (`pbuilder-codegen` precedent). `src/` is mechanically dangerous: `tsconfig.build.json` `rootDir: "./src"` puts anything there into `dist/` and the tarball. `scripts/` = maintainer/CI, never shipped. **But** this would be the first `scripts/` file wired INTO `build` — a deliberate sharpening of the convention, not inertia.

## SECURITY-ONLY FINDINGS

### S1 — The stated threat model does not motivate the mechanism
Under "malicious schematic author with no write access to the installed SDK tree", hashing the SDK's own 24 files defends against nothing that adversary can do — the author's whole surface (factory module, `schema.json`, argv) is on the far side of the boundary. **Stated plainly: as an anti-tamper control under the stated model, it is largely ceremonial.** Its real value: (1) **wrong-artefact detection** (partial install, corrupt extraction, version skew, stale `bun link`) — an availability/compatibility control; (2) the **closure-sealing tripwires**, which have genuine durable security value **and are independent of the manifest**; (3) coverage of the **postinstall/compromised-transitive-dependency adversary the model EXCLUDES** — the most realistic npm attack. The model is drawn narrower than the mechanism's value. Document the real value or the next engineer deletes it.

### S2 — Identity binding is near-circular; provenance is the real answer
Lockfile integrity is verified at **fetch** time, never at **exec** time; nothing re-verifies `node_modules` afterwards. And **`bun link` has zero integrity** (`test/support/scratch-consumer.ts:ensureLinkedConsumer` — symlink to the live tree; the same build produced the bytes AND the digests). Already paid for and stronger: `publish.yml` publishes with **`--provenance`** — a real cryptographic attestation verifiable on demand (`npm audit signatures`). Promote the contract's "optional nicety" (build prints the manifest's own SHA-256, release notes carry it) to a **hard requirement** — it is the only element binding identity out-of-band.

### S3 — `algorithm` and `entry` are trusted fields read from the artefact under verification
An attacker rewriting the manifest sets `algorithm` weak or repoints `entry`. Any field a verifier **dispatches on** must be an engine-side constant, with the manifest field a cross-check only. Engine must also reject absolute/non-normalised/`..`/duplicate paths, and reject **missing** entries as well as extra ones.

### S4 — Bias hard toward PERMISSIVE (inverts the usual reflex)
False tamper alarm = **100% of that release's users fail closed, no workaround** (patching files changes digests — the whole point); recovery = a full release cycle. Too-permissive = marginal delta on a defence porous by construction. Not close. Enforcement = eliminate every false-alarm source: pin `newLine: "lf"` (unset today — a Windows build emits CRLF and every digest differs); verify against the **extracted tarball's own bytes**, not the working tree; prove determinism under mutated cwd/`TZ`/`LANG`/`umask`/non-ASCII path.

### S5 — `node:` prefix is load-bearing and unguarded
All 6 builtins are `node:`-prefixed today, by convention only. `node:`-prefixed specifiers cannot be shadowed by `node_modules`; a bare `import ... from "fs"` **can**. Implement the check as "reject anything not literally `node:`-prefixed", never as a builtin-name allowlist.

## Affected Areas
| Path | Impact | Why |
|---|---|---|
| `scripts/generate-runner-manifest.ts` + `scripts/runner-closure.ts` | Created | the ONE shared `computeClosure()` + the fail-closed generator |
| `package.json` (`build` script) | Modified | chain the manifest step after `tsc` |
| `tsconfig.build.json` | Modified | pin `newLine: "lf"` (S4) |
| `test/fitness/fit-42-*.test.ts` | Created | red-proofs + closure-graph baseline diff (fit-42 is next free) |
| `test/fitness/runner-closure-baseline.json` | Created | committed 23-node graph (A3b) |
| `test/fitness/pkg-surface-baseline.json` | Modified | **MUST** add `dist/runner-manifest.json` or FIT-14 goes red on first success |
| `test/fitness/fit-23-publish-workflow-guard.test.ts` | Modified | structural ordering guard for C1 |
| `.github/workflows/publish.yml` | Modified | resolve C1 ordering |
| `docs/` + ADRs | Created | the invariants, as invariants (contract's own acceptance box) |
| `src/**` | Read-only | target ZERO `src/**` diff (conformance-corpus precedent) |

## Architecture Touchpoints (A3)
| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `scripts/` (maintainer tooling) | extend | generator joins an existing layer | aligns |
| `build` pipeline | modify | first `scripts/` file wired into `build` | aligns (convention sharpened) |
| `test/fitness/` | extend | fit-42 + two baselines, FIT-04/14 idiom | aligns |
| published package surface | **new** | `dist/runner-manifest.json` = a versioned EXTERNAL contract (`manifestVersion: 1`) | aligns (`files: ["dist"]` covers it), but must be recorded in the baseline's Public API section |

**architecture_impact**: `additive`. Escalates to `modifying` only if design must touch `src/transport/**` to neutralise the `createRequire` primitive — it should not; the fourth precondition is enforceable as a scan, not a refactor.

## Sensitive Areas Crosscheck
| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (supply-chain) — publish boundary | `package.json#files`, tarball, `publish.yml` | Yes |
| public-api (contract) | new published artefact + versioned schema | Yes |
No new sensitivity beyond triage. Note: the deployment row upgrades to **high** when `--dry-run` is removed for the first live publish; this change lands BEFORE that — sequence the two together.

## Recommendation
Single approach (no strawmen): **one shared `computeClosure()` in `scripts/`, consumed by both a fail-closed generator wired into `bun run build` and a `fit-42` fitness test supplying the red-proofs**, with the file SET derived from emitted `dist/**.js` and specifier-KIND invariants asserted on source. Constraint 1 via injective source correspondence + committed closure-graph baseline + bundler-output disjointness, scoped to the closure. Verify the manifest against the **extracted tarball's bytes**, not the working tree.

## Risks
- **C1 ordering** — publish-time `package.json` mutation invalidates entry #24. Blocks 0.1.0.
- **`package.json` byte-identity across pack→publish→install is ASSUMED, not proven.** `npm-normalize-package-bin` touches `#bin`, and this package HAS one. Re-serialisation = false tamper alarm on every install. Prove with bytes, not argument.
- **FIT-14 goes red on first success** — deliberate baseline regeneration is a design task, not a build surprise.
- **Alarm fatigue is a security failure mode** — version-skew mismatches will vastly outnumber real ones; users taught to shrug will shrug at the real one. A `packageVersion` field would separate them, but the contract fixes the schema — propose to the engine, do not add unilaterally.
- **Justification drift** — ship it documented as "stops a malicious schematic author" and the next engineer will notice it does not, then delete or over-extend it.
- **Closure baseline drift** — engine verified `6e4aab7`; we are on `7ef64ac`. The committed closure-graph baseline turns this from a one-off check into a permanent test.

## Open Questions
- **type: technical → ENGINE (blocking design)**: which runtime executes `dist/bin/pbuilder-runner.js` in production — **Bun or Node**? `engines` pins both. Decides whether loader-observation is feasible for Constraint 1 and which injection surface the engine must neutralise.
- **type: technical → ENGINE**: does the engine verify once at install/resolve, or before every spawn? Decides whether TOCTOU is in the model.
- **type: technical → ENGINE**: will it accept a negative assertion (`mustNotExist`) or an equivalent no-intermediate-`package.json` rule? Without it C2 stands.
- **type: technical → ENGINE**: is `packageVersion` (or any extra top-level field) tolerated, or does a strict parser treat it as mismatch?
- **type: product → OWNER**: is `bun link` in scope for engine verification at all? Under `bun link` the manifest is fully self-asserted. If linked development must keep working, the honest framing is "verification degrades to a build-consistency check on linked installs" — state it rather than leave it implicit.

## Ready for Proposal
**Status**: partial
**Reason**: The technical path is clear and the approach is settled. Four ENGINE questions are open, of which **one (Bun vs Node) blocks the Constraint-1 mechanism** in design. The rest can proceed in parallel: propose/spec can encode everything else, with the Constraint-1 mechanism carrying a documented fallback ((a)+(b)+(c) shape checks) if loader observation proves impractical.
**Recommended action**: send the engine a reply artefact (4 contract corrections + 4 questions), and proceed to `sdd-propose` in parallel — do not block the whole plan on the round-trip.
