# Spec V1: Runner Integrity Manifest (runner-integrity-manifest)

**Status**: DRAFT — awaiting owner signature
**Triage**: L | **Capabilities**: 8 | **REQ-IDs**: 41 | **ADR budget**: 4

> Scenarios use Given/When/Then. Every scenario names a **concrete observable** — "is deterministic"
> is not a scenario; "the SHA-256 of the manifest's bytes is identical across both runs" is.

---

## Contract Ambiguities — resolved for signature

The engine's contract admits two readings in nine places. Each is resolved below; **A, D and I are
the ones that change behaviour and need explicit owner assent.**

| # | Ambiguity | RESOLUTION |
|---|---|---|
| **A** | Is "23" a contract constant or a derived value? | **Regenerable baseline.** The spec asserts *derived == committed baseline*, whose value is 23 today. A future legitimate closure change is a deliberate baseline edit, not a cross-repo breaking event. **The engine must confirm their mirror does not hard-code 23** (carried in the reply). |
| B | Sort scope — 23 sorted then `package.json` appended, or all 24 together? | **All 24 sorted together**, byte-wise ascending. Today both readings coincide by ASCII accident (`d` < `p`); they stop coinciding the moment a closure path sorts above `p`. |
| C | "Stable JSON key order" — which order, what whitespace? | **Pinned exactly**: top-level `manifestVersion, algorithm, entry, files`; each entry `path, sha256`; 2-space indent; exactly one trailing `\n`. Invisible to the engine (they compare digests) but observable once we publish the manifest's own SHA-256. |
| **D** | "The factory-import site" — file-scoped or site-scoped? | **Site-scoped.** A second dynamic `import()` inside `transport/runner.ts` itself must ALSO fail. File-scoped is the only other reading and it defeats the constraint's intent. |
| E | "Mutating any closure file changes exactly that file's digest" | **Reading 2**: that entry changes **and no other entry does**. Reading 1 (merely content-sensitive) is vacuous. |
| F | Is `entry` also a `files` member? | **Yes.** 24 = 23 closure + `package.json`; `entry` is one of the 23 and appears exactly once in `files`. |
| G | Is the manifest itself excluded? | **Yes** — self-inclusion is unsatisfiable. Asserted explicitly (RME-03) rather than left obvious. |
| H | "Rebuilding an unchanged tree" — same machine or any machine? | **Any machine** (the Determinism section's own wording). The weak reading is trivially satisfiable and worthless. |
| **I** | Is `bun link` in scope for verification? | **In scope, with the guarantee stated honestly**: on linked installs the same build produces both the bytes and the digests, so verification degrades to a **build-consistency check**. Documented in those words (IID-06). Our own e2e suite uses linked installs, so this is not academic. |

**Push-back recorded**: engine acceptance box 6 says "the three Constraints". There are **five**
preconditions — the engine's three, plus the fourth (no unhashed-code-execution primitive) and the
fifth (engine-side loader injection). This spec documents **five**, each marked by owner. Signing a
spec that documents three would be documenting a lemma we know to be unsound.

---

## Capability 1 — `runner-closure-derivation` (RCD)

**REQ-RCD-01** — The closure is derived by walking static `import` / `export … from` / side-effect specifiers transitively from the emitted entry, following relative specifiers and ignoring `node:` builtins.
- **RCD-01.1** — *Given* a clean `bun run build`, *when* the closure is derived from `dist/bin/pbuilder-runner.js`, *then* the resulting set equals the committed closure-graph baseline **as a set of paths** (not a count).

**REQ-RCD-02** — Derivation targets the **emitted `dist/**.js`**, never `src/**.ts`.
- **RCD-02.1** — *Given* `src/core/engine-client.ts` is reachable only via `import type` (`stdio-engine-client.ts:17`, `context.ts:9`, `session.ts:11`), *when* the closure is derived, *then* `dist/core/engine-client.js` is **absent** from the manifest, asserted **by name**.
- **RCD-02.2** — *Given* the derived closure, *when* its size is measured, *then* it is 23 — the exact count a source-derived walk would get wrong (it yields 24).

**REQ-RCD-03** — Zero silent skips: every import-like construct is classified into exactly one of {relative specifier, `node:` builtin, the sanctioned dynamic-import site} or the build fails.
- **RCD-03.1** — *Given* a closure file containing an unclassifiable construct (non-literal `import(expr)`, computed `export * from`), *when* the build runs, *then* it exits non-zero, **no `dist/runner-manifest.json` exists on disk**, and stderr names the file, the line and the construct.

**REQ-RCD-04** — `node:`-prefixed builtins are excluded from the file set without failing.
- **RCD-04.1** — *Given* the current closure, *when* derivation completes, *then* exactly six builtins are seen — `node:async_hooks, node:console, node:fs, node:module, node:path, node:url` — asserted by name.

## Capability 2 — `manifest-emission` (RME)

**REQ-RME-01** — Shape: 24 entries in the contract's declared schema.
- **RME-01.1** — *Given* a successful build, *when* `dist/runner-manifest.json` is parsed, *then* `manifestVersion === 1`, `algorithm === "sha256"`, `files.length === 24`, `entry === "dist/bin/pbuilder-runner.js"` and `entry` appears **exactly once** in `files` (ambiguity F).
- **RME-01.2** — *Given* the manifest, *when* `files` is inspected, *then* exactly one entry has `path === "package.json"` and all 23 others start with `dist/`.

**REQ-RME-02** — Digests are lowercase-hex SHA-256 over exact on-disk bytes.
- **RME-02.1** — *Given* the manifest, *when* each entry's digest is recomputed by an independent SHA-256 over the bytes at `path`, *then* every value matches and every value matches `/^[0-9a-f]{64}$/`.

**REQ-RME-03** — Exclusions are exact; extra entries are a mismatch to the engine.
- **RME-03.1** — *Given* the manifest, *when* `files[].path` is inspected, *then* no entry matches `*.d.ts`, `dist/dialects/**`, `dist/commons/**`, `dist/conformance/**`, `dist/testing/**`, `node_modules/**`, **or `dist/runner-manifest.json` itself** (ambiguity G).

**REQ-RME-04** — Paths are normalised and unique.
- **RME-04.1** — *Given* the manifest, *when* `files[].path` is inspected, *then* every path uses `/`, has no leading `./`, is not absolute, contains no `..` segment, and no path appears twice.

**REQ-RME-05** — Ordering is byte-wise over all 24 (ambiguity B).
- **RME-05.1** — *Given* the manifest, *when* consecutive `files[].path` pairs are compared with `Buffer.compare`, *then* each is strictly less than the next.
- **RME-05.2** — *Given* a path set where byte order and locale collation **disagree**, *when* the comparator sorts it, *then* the result matches byte order — proving the implementation does not use `localeCompare`.

**REQ-RME-06** — Serialisation is pinned (ambiguity C).
- **RME-06.1** — *Given* the manifest's raw bytes, *when* inspected, *then* top-level keys appear in order `manifestVersion, algorithm, entry, files`, entry keys in order `path, sha256`, indentation matches the pinned form, and the file ends with exactly one `\n`.

## Capability 3 — `manifest-determinism` (RMD)

**REQ-RMD-01** — Same tree, same bytes, across rebuilds.
- **RMD-01.1** — *Given* an unchanged tree, *when* `bun run build` runs twice, *then* the SHA-256 of the manifest's bytes is identical.

**REQ-RMD-02** — Same tree, same bytes, across **machines** (ambiguity H).
- **RMD-02.1** — *Given* two checkouts of the same commit at **different absolute paths, one containing a non-ASCII segment**, *when* each is built, *then* the two manifests' bytes are identical.

**REQ-RMD-03** — No CRLF in the closure; `newLine: "lf"` pinned.
- **RMD-03.1** — *Given* `tsconfig.build.json`, *when* read, *then* `newLine` is `"lf"`.
- **RMD-03.2** — *Given* the emitted closure files, *when* their bytes are scanned, *then* none contains `\r\n`; proven non-vacuous against a synthetic CRLF fixture.

**REQ-RMD-04** — Tamper localisation (ambiguity E).
- **RMD-04.1** — *Given* a manifest from an unchanged tree, *when* one byte is appended to `dist/core/session.js` and the manifest is regenerated, *then* **exactly one** entry's digest differs, the other 23 are byte-identical, `files.length` is unchanged and the array order is unchanged.

**REQ-RMD-05** — No machine-identifying content.
- **RMD-05.1** — *Given* the manifest's bytes, *when* scanned, *then* they contain no absolute path, no home-directory segment, no username, and no timestamp.

## Capability 4 — `build-pipeline-integration` (BPI)

**REQ-BPI-01** — Produced by `bun run build`, never a separate command.
- **BPI-01.1** — *Given* a clean checkout with no `dist/`, *when* `bun run build` completes, *then* `dist/runner-manifest.json` exists, with no additional command invoked.

**REQ-BPI-02** — No artefact survives a failed derivation.
- **BPI-02.1** — *Given* a build whose derivation fails for any RCD/CST reason, *when* the build exits, *then* it exits non-zero **and** `dist/runner-manifest.json` does not exist — including when a manifest from a previous successful run was present beforehand.

**REQ-BPI-03** — The publish-ordering **property** is pinned (mechanism is out of scope).
- **BPI-03.1** — *Given* `.github/workflows/publish.yml`, *when* its steps are parsed structurally, *then* either the `package.json` version stamp precedes the build, or a rebuild occurs between the stamp and publish — asserted against the workflow file, never against a comment. Green today via `prepublishOnly`; red the instant `--ignore-scripts`, `bun publish` or `bun pm pack` enters the workflow.

**REQ-BPI-04** — The build reports the manifest's own identity (owner ruling: in this change).
- **BPI-04.1** — *Given* a successful build, *when* stdout is captured, *then* it contains the SHA-256 of `dist/runner-manifest.json` itself, in a stable machine-parseable form a release note can copy.

## Capability 5 — `closure-sealing-tripwires` (CST)

Each rule below has a mandatory red-proof (§ Red-Proofs). A rule without its negative companion is unproven.

**REQ-CST-01** — No bare specifier in the closure.
- **CST-01.1** — *Given* a closure file importing a third-party package, *when* the build runs, *then* it fails, emits no manifest, and names the file, line, specifier and "Constraint 3 — bare specifier in the closure".

**REQ-CST-02** — Builtins must be literally `node:`-prefixed — never a name allowlist.
- **CST-02.1** — *Given* a closure file with `import { readFileSync } from "fs"`, *when* the build runs, *then* it **fails** — an unprefixed builtin occupies a `node_modules`-shadowable name and must not be silently accepted.

**REQ-CST-03** — Exactly one sanctioned dynamic `import()`, site-scoped (ambiguity D).
- **CST-03.1** — *Given* a dynamic `import()` in a closure file other than `transport/runner.ts`, *when* the build runs, *then* it fails, naming the file, line, specifier and "Constraint 2 — dynamic import outside the factory site".
- **CST-03.2** — *Given* a **second** dynamic `import()` inside `transport/runner.ts` itself, *when* the build runs, *then* it **also** fails, naming which site is the sanctioned one.
- **CST-03.3** — *Given* the single sanctioned site, *when* the scan runs, *then* it is accepted, identified by a **stable anchor** — not a line number that churns on unrelated edits.

**REQ-CST-04** — FOURTH PRECONDITION: no unhashed-code-execution primitive in the closure.
- **CST-04.1** — *Given* a closure file calling the require function returned by `createRequire(x)` (rather than `.resolve()`), *when* the build runs, *then* it fails, naming the file, line, construct and "unhashed-code-execution primitive in the closure". *Rationale: `single-instance-probe.ts:28,39` already imports `createRequire`; only calling `.resolve()` keeps it resolution-only, and that is convention, not enforcement.*
- **CST-04.2** — *Given* a closure file using `eval(…)`, `new Function(…)`, `node:vm`, `Bun.plugin(…)` or `process.binding(…)`, *when* the build runs, *then* it fails, naming which primitive.
- **CST-04.3** — *Given* the current tree, *when* the deny-scan runs, *then* it reports zero violations — and `single-instance-probe.ts`'s legitimate `.resolve()` call is **not** flagged.

**REQ-CST-05** — No `package.json` strictly between the entry and the package root (SDK-side half of C2).
- **CST-05.1** — *Given* the built tree, *when* checked, *then* neither `dist/package.json` nor `dist/bin/package.json` exists. *This does not close the C2 bypass — only the engine can (their question 3) — but it stops the SDK being the source of the file.*

**REQ-CST-06** — Failure quality is asserted, not assumed.
- **CST-06.1** — *Given* any tripwire violation, *when* the build fails, *then* the test asserts the message **by substring**, so "it fails" is never accepted as "it fails usefully".

## Capability 6 — `bundler-disjointness-invariant` (BDI)

Owner ruling 2026-07-25: Constraint 1 is a CI-breaking fitness test, not documentation. Scoped to the **closure**, not to all of `dist/` — a bundler already runs in this build (`build:codegen` → `dist/bin/pbuilder-codegen.js`).

**REQ-BDI-01** — Bundler outputs are disjoint from the closure.
- **BDI-01.1** — *Given* `package.json#scripts`, *when* every `--outfile`/`--outdir` target is extracted, *then* none is inside the closure path set — proven non-vacuous by `dist/bin/pbuilder-codegen.js` being present and correctly judged **outside** the closure.

**REQ-BDI-02** — Injective source correspondence, `dist → src` only.
- **BDI-02.1** — *Given* every closure `.js`, *when* mapped back to `src/`, *then* exactly one `.ts` exists at the corresponding path, and no two closure files map to the same source.
- **BDI-02.2** — The reverse (`src → dist`) is **NOT** asserted: `dist/core/engine-client.js` legitimately exists outside the closure.

**REQ-BDI-03** — Committed closure-graph baseline; regeneration is deliberate.
- **BDI-03.1** — *Given* the committed baseline (23 nodes + every relative edge, sorted), *when* a closure file is added, removed, or its imports change, *then* the fitness test fails naming the added/removed **node or edge**.

## Capability 7 — `packaged-manifest-fidelity` (PMF)

**REQ-PMF-01** — The manifest ships.
- **PMF-01.1** — *Given* `npm pack`, *when* the tarball's file list is read, *then* it contains `dist/runner-manifest.json`.

**REQ-PMF-02** — Digests match the **extracted tarball's** bytes, not the working tree.
- **PMF-02.1** — *Given* the packed tarball extracted to a temp directory, *when* all 24 digests are recomputed against the **extracted** bytes, *then* all match. *This is the only criterion that catches packer normalisation.*
- **PMF-02.2** — *Given* `npm pack --ignore-scripts` (so `prepublishOnly` does not fire), *when* the tarball is extracted, *then* entry #24's digest matches the packed `package.json` bytes. *This is what proves the publish-ordering property rather than relying on an accidental rescue.*

**REQ-PMF-03** — The publish-surface baseline admits the manifest deliberately.
- **PMF-03.1** — *Given* `test/fitness/pkg-surface-baseline.json`, *when* FIT-14 runs after the first successful emission, *then* it passes because the baseline was deliberately updated to include `dist/runner-manifest.json`.

> **Retired**: `npm pack` and `bun pm pack` were both verified 2026-07-25 to preserve `package.json`
> byte-for-byte (identical SHA-256 across working tree, bun tarball and npm tarball), so entry #24 is
> viable as specified. PMF-02 remains a requirement because it must **stay** true.

## Capability 8 — `integrity-invariants-documentation` (IID)

**REQ-IID-01** — Five preconditions, each with its enforcement mechanism or an explicit "unenforced, engine-owned".
- **IID-01.1** — *Given* the invariants document, *when* read, *then* it states all five: (1) no bundler with code-splitting, (2) no dynamic import on an infrastructure path, (3) no bare third-party specifier, (4) no unhashed-code-execution primitive, (5) no loader-level injection at spawn — **(5) marked engine-owned**.

**REQ-IID-02** — Honest scope boundary, verbatim.
- **IID-02.1** — *Given* the document, *when* the scope statement is read, *then* it says the manifest verifies **the pre-factory bootstrap only**, and that `dist/commons/**`, `dist/dialects/**`, `dist/testing/**` and `node_modules/**` load into the same process at the same privilege moments later.

**REQ-IID-03** — The justification that survives scrutiny.
- **IID-03.1** — *Given* the document, *when* the rationale is read, *then* it states the real value — wrong-artefact detection, the closure-sealing tripwires, and coverage of the postinstall adversary the engine's model excludes — rather than "stops a malicious schematic author", which is provably not what it does.

**REQ-IID-04** — The closure-portability answer is recorded as an invariant.
- **IID-04.1** — *Given* the document, *when* read, *then* it records "one manifest per published package, no per-platform map", with its evidence.

**REQ-IID-05** — Entry #24 is justified correctly.
- **IID-05.1** — *Given* the document, *when* entry #24 is justified, *then* the reason given is `"type": "module"` governing the parse mode of all 23 closure files — **not** `packageRootFor()`, which content hashing structurally cannot constrain.

**REQ-IID-06** — The `bun link` guarantee is stated honestly (ambiguity I).
- **IID-06.1** — *Given* the document, *when* the linked-install section is read, *then* it states that on `bun link` installs the same build produces both the bytes and the digests, so verification degrades to a **build-consistency check**.

**REQ-IID-07** — Known gaps are documented, not omitted.
- **IID-07.1** — *Given* the document, *when* read, *then* it records the C2 bypass (a planted `dist/package.json` redirects `packageRootFor` and reinterprets parse mode with zero digest change) as an **open cross-repo gap** pending the engine's answer.

---

## Red-Proofs (mandatory — a rule without its negative companion is unproven)

Precedent: `fit-40-conformance-corpus-integrity.negative.test.ts` — plant the violation, assert the failure is non-empty **and names the offender**.

| # | Planted | Must fail as | Must name |
|---|---|---|---|
| RP-1 | one byte appended to `dist/core/session.js` | digest mismatch; **exactly one** entry differs | path, expected, observed |
| RP-2 | a 24th closure file, imported by an existing one | baseline diff fails | the added node **and the edge that admitted it** |
| RP-2b | a closure file / import removed | baseline diff fails | the removed node/edge — absence fails as loudly as addition |
| RP-3 | dynamic `import()` in a closure file ≠ `runner.ts` | build fails, no manifest | file, line, specifier, Constraint 2 |
| RP-3b | a **second** dynamic `import()` inside `runner.ts` | build fails (ambiguity D) | which site is sanctioned |
| RP-4 | `import { Project } from "ts-morph"` in a closure file | build fails, no manifest | file, line, specifier, Constraint 3 |
| RP-5 | `import { readFileSync } from "fs"` | build fails — a name allowlist would wrongly pass this | file, line, `"fs"`, the `node:`-prefix rule |
| RP-6 | `dist/package.json` planted | fitness assertion fails | the path, and that it redirects `packageRootFor()` **with no digest change** |
| RP-7 | `createRequire(anchorUrl)("./x")` — the require function **called** | build fails (fourth precondition) | file, line, construct |
| RP-7b | `eval` / `new Function` / `node:vm` / `Bun.plugin` / `process.binding` | build fails | which primitive |
| RP-8 | `--outfile dist/transport/runner.js` added to a script | disjointness fails | script name, target, colliding closure file |
| RP-9 | a closure file emitted with CRLF | line-ending check fails | path and offset |
| RP-10 | paths where byte order and locale collation disagree | ordering fails if implemented with `localeCompare` | both orderings |
| RP-11 | manifest with duplicate / absolute / `..` path | shape validation fails | which rule, which entry |

---

## Out of Scope (explicit)

Editing `.github/workflows/publish.yml` (property pinned, mechanism owned by the go-live batch);
publishing `0.1.0`; `mustNotExist` entries and a `packageVersion` field (engine questions 3 and 4 —
adding schema fields unilaterally risks a strict parser fail-closing 100% of installs); loader
observation for Constraint 1 (followup, conditioned on the engine's Bun-vs-Node answer); the fifth
precondition's enforcement (engine-owned); any `src/**` behaviour change — **do not refactor
`single-instance-probe.ts`**; gap A / `engine-e2e-real`.

## Signature Block

Requires owner assent on **A** (23 as regenerable baseline, not a contract constant), **D**
(site-scoped factory-import site), **I** (`bun link` in scope with verification stated as a
build-consistency check), and the **five-preconditions push-back** against acceptance box 6.

- [ ] **Signed** — owner: ____________ date: __________
