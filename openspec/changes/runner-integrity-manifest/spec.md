# Spec V2: Runner Integrity Manifest (runner-integrity-manifest)

**Status**: **SIGNED** — Daniel Ramirez, 2026-07-25. Frozen; changes require `unfreeze=true`.
**Triage**: L | **Capabilities**: 8 | **REQs**: 42 (65 scenarios, 9 REQs scenario-less) | **Red-proofs**: 18 | **ADR budget**: 4

> *Header count corrected 2026-07-25 (was "58 REQ-IDs" — a figure matching neither the REQ nor the
> scenario count). Metadata only; no requirement text changed, so the signature stands.*

**V2 changes**: QA adversarial review (11 mutation escapes closed), tech-writer review (Capability 8
was unverifiable — no REQ named the file), and the engine's round-2 reply (all four corrections
accepted; `packageVersion` now welcomed; **Bun confirmed** as the production runtime).

> Every scenario names a **concrete observable**. Terminology is pinned in § Terminology — in
> particular `entry` (the JSON field) and **file record** (a member of `files`) are different things.

---

## Contract Ambiguities — resolved for signature

| # | Ambiguity | RESOLUTION |
|---|---|---|
| **A** | Is "23" a contract constant or derived? | **Regenerable baseline.** Assert *derived == committed baseline* (23 today). A legitimate closure change is a deliberate baseline edit, not a cross-repo breaking event. Engine confirmed their mirror does not hard-code it. |
| B | Sort scope | **All 24 file records sorted together**, byte-wise ascending. |
| C | Key order / whitespace | **Pinned via a round-trip identity** (RME-06.1) — not prose. |
| **D** | Factory-import site: file- or site-scoped? | **Site-scoped.** A second dynamic `import()` inside `runner.ts` itself must also fail. |
| E | "Mutating any closure file changes exactly that file's digest" | **Exactly that file record changes and no other.** |
| F | Is `entry` also a file record? | **Yes** — 24 = 23 closure + `package.json`; `entry` names one of the 23 and appears exactly once in `files`. |
| G | Manifest excludes itself | **Yes**, asserted explicitly (RME-03.1). |
| H | "Rebuilding an unchanged tree" | **Any machine.** |
| **I** | `bun link` scope | **In scope, guarantee stated honestly**: same build produces both bytes and digests → verification degrades to a **build-consistency check** (IID-06). Engine agreed: "useful there as a wrong-artefact detector and nothing more." |
| **J** *(new — found by QA + tech-writer)* | Which realm do specifier-KIND checks scan, and which path do errors name? | **Set from emitted `dist/**.js`; kind checks on `dist` via AST; errors name the `src/**` path the reader must EDIT** (emitted counterpart named second). BDI-02 already asserts the `dist → src` map is injective, so this costs nothing. Reporting a `dist` line to someone who must edit `src` fails at the one job the message has. |

**Engine round-2 outcomes folded in**: all four SDK corrections accepted; the fourth precondition
adopted into the engine's own mirror check; the fifth stated as an explicit loader-injection control
on their side; entry #24 re-justified on `"type": "module"`; verifier-dispatched fields pinned
engine-side; **omissions rejected as firmly as extras**; `packageVersion` **welcomed** (Q4);
**Bun is the production runtime, definitively** (Q1); verification runs **before every spawn** (Q2);
the no-intermediate-`package.json` rule is adopted **engine-side** rather than as a manifest field (Q3).

---

## Design Rulings (owner, 2026-07-25)

- **R1 — AST, not regex.** Derivation and kind checks parse with **ts-morph** (already a project
  dependency; the generator lives in unshipped `scripts/`). *Forced by a verified day-one failure:
  `removeComments` is unset, so JSDoc survives into `dist`; `src/core/authoring-error.ts:229` carries
  `import { AuthoringError } from "@pbuilder/sdk/commons"` inside an `@example` (a bare specifier →
  false Constraint-3 alarm) and `src/core/context.ts:352` carries `import type { Input } from
  "./schema.generated.ts"` (relative → **phantom closure node**). Both files are in the 23.*
- **R2 — Realm split** per ambiguity J.
- **R3 — Constraint 4 is an outright ban on `createRequire` in the closure**, with the single
  legitimate site exempted by the same anchor idiom as CST-03. The call-vs-`.resolve()` rule is
  evadable by one variable (`const req = createRequire(u); req("./x")`) and by the namespace form.
- **R4 — Constraint 1 ships structural** (owner, after Bun was confirmed): injective correspondence +
  closure-graph baseline + bundler-output disjointness. Loader observation is a followup.

---

## Capability 1 — `runner-closure-derivation` (RCD)

**REQ-RCD-00 — Root-parameterised and unit-addressable.** `scripts/derive-runner-closure.ts` exports
`deriveRunnerClosure(distRoot, entryRelPath)`, `comparePaths`, `serialiseManifest` and `sha256File`.
*Rationale: without this, every red-proof, RMD-04 and RMD-02's cheap form are unimplementable.*

**REQ-RCD-01 — Transitive static walk.**
- **RCD-01.1** — *Given* a clean build, *when* the closure is derived from `dist/bin/pbuilder-runner.js`, *then* the result equals the committed closure-graph baseline **as a set of paths**.
- **RCD-01.2 — THE ANTI-TAUTOLOGY SCENARIO.** *Given* a synthetic tree at a temp root (entry imports A and B; A imports C; D present but unimported), *when* `deriveRunnerClosure(root, entry)` runs, *then* the result is exactly `{entry, A, B, C}` and **D is absent, asserted by name**. *Every other RCD scenario is satisfiable by a generator that merely reads the committed baseline; this one is not.*
- **RCD-01.3** — *Given* a synthetic tree with a cycle (A↔B), *when* derivation runs, *then* it terminates and yields `{entry, A, B}`.
- **RCD-01.4** — *Given* an entry with zero imports, *then* the closure is exactly 1 file.

**REQ-RCD-02 — Emitted realm only.**
- **RCD-02.1** — *Given* `src/core/engine-client.ts` is reachable only via `import type`, *then* `dist/core/engine-client.js` is **absent**, asserted by name.
- **RCD-02.2** — *Given* the derived closure, *then* its size is 23 — the count a source walk gets wrong (it yields 24).
- **RCD-02.3** — The closure set is **not** filtered by `.js`: a specifier resolving to `.mjs`/`.cjs` is followed. *(`module: NodeNext` can emit `.mjs`; an `endsWith(".js")` filter silently loses a subtree.)*

**REQ-RCD-03 — Zero silent skips, parser-grade (R1).**
- **RCD-03.1** — *Given* an unclassifiable construct (non-literal `import(expr)`, computed `export * from`), *then* the build exits non-zero, **no manifest exists**, and stderr names the **`src` path**, the line and the construct.
- **RCD-03.2** — *Given* a relative specifier resolving to a nonexistent path, *then* the build fails naming importer, specifier and attempted path. **No silent subset** — never `catch { continue }`.
- **RCD-03.3 — THE DAY-ONE SCENARIO.** *Given* `dist/core/authoring-error.js` (JSDoc `@example` quoting `@pbuilder/sdk/commons`) and `dist/core/context.js` (JSDoc quoting `./schema.generated.ts`), *when* derivation runs, *then* **neither is treated as an edge and neither reports a violation** — asserted against those two files **by name**, so it can never be "fixed" by deleting the examples.
- **RCD-03.4** — *Given* a specifier carrying a query or fragment (`./x.js?v=1`), *then* it is an explicit classification failure, never a silent skip.
- **RCD-03.5** — *Given* an unreadable closure file (mode 000), *then* the build fails naming the path. *Test skips under uid 0, else it false-passes in containers.*

**REQ-RCD-04 — `node:` builtins excluded without failing.**
- **RCD-04.1** — *Given* the current closure, *then* the observed builtin set equals the **baseline's** builtin row (six today), not a literal in-test list. *A literal turns a legitimate future `node:buffer` into a red build — against the spec's permissive bias.*

**REQ-RCD-05 — Symlinks do not escape the package.**
- **RCD-05.1** — *Given* a closure specifier resolving through a symlink whose target lies outside the package root, *then* the build fails rather than hashing foreign bytes under an in-package path. *(`bun link` makes this non-academic.)*

## Capability 2 — `manifest-emission` (RME)

**REQ-RME-01 — Shape.**
- **RME-01.1** — `manifestVersion === 1`, `algorithm === "sha256"`, `files.length === 24`, `entry === "dist/bin/pbuilder-runner.js"`, and `entry` appears exactly once among the file records.
- **RME-01.2** — Exactly one file record has `path === "package.json"`; the other 23 start with `dist/`.
- **RME-01.3** — The top-level key set is **exactly** `{manifestVersion, algorithm, entry, packageVersion, files}` and every file record's key set is **exactly** `{path, sha256}`. *Closes the "a `generatedAt` field slips past everything" escape.*

**REQ-RME-02 — Digests.**
- **RME-02.1** — Each digest recomputed over the bytes at `path` matches, and matches `/^[0-9a-f]{64}$/`.
- **RME-02.2 — Known-answer.** *Given* a zero-byte file and a file containing exactly `\n`, *then* `sha256File` returns `e3b0c442…b855` and `01ba4719…0b`. *An external oracle — RME-02.1 alone is `f(x) === f(x)` if the test imports the generator's own hasher.*

**REQ-RME-03 — Exclusions.**
- **RME-03.1** — No file record matches `*.d.ts`, `dist/dialects/**`, `dist/commons/**`, `dist/conformance/**`, `dist/testing/**`, `node_modules/**`, or `dist/runner-manifest.json` itself.

**REQ-RME-04 — Path hygiene.**
- **RME-04.1** — Every `path` uses `/`, no leading `./`, not absolute, no `..` segment, no duplicates.

**REQ-RME-05 — Byte-wise ordering.**
- **RME-05.1** — Consecutive paths compare strictly ascending under `Buffer.compare`.
- **RME-05.2** — *Given* the discriminating pairs `dist/Z.js` vs `dist/a.js` (byte: `Z`=0x5A < `a`=0x61; ICU: `a` first) **and** `dist/a-b.js` vs `dist/aB.js` (ICU ignores punctuation), *when* the exported `comparePaths` sorts them, *then* the result matches byte order. *Kills `localeCompare`.*

**REQ-RME-06 — Serialisation pinned by identity, not prose.**
- **RME-06.1** — *Given* the manifest's raw text, *then* `raw === JSON.stringify(JSON.parse(raw), null, 2) + "\n"`. *One assertion kills 4-space, tabs, CRLF, missing trailing newline and key reordering.*

**REQ-RME-07 — `packageVersion` (engine Q4: accepted and welcomed).**
- **RME-07.1** — The manifest carries a top-level `packageVersion` equal to the root `package.json`'s `version`. *Lets the engine report **version-mismatch** distinctly from **integrity-mismatch** — version skew will vastly outnumber genuine tampering, and collapsing them manufactures alarm fatigue against the one signal that must never be routine.*

## Capability 3 — `manifest-determinism` (RMD)

**REQ-RMD-01 — Reproducible.**
- **RMD-01.1** — Two consecutive builds of an unchanged tree yield byte-identical manifests.
- **RMD-01.2 — Locale.** *Given* the same tree, *when* the generator runs in a **child process** under `LC_ALL=C` and again under `LC_ALL=tr_TR.UTF-8`, *then* the bytes are identical. *Never mutate `process.env` in-test.*

**REQ-RMD-02 — Path-independent.**
- **RMD-02.1** — *Given* the built `dist/` + `package.json` copied to a temp root whose absolute path contains **both a non-ASCII segment and a space**, *when* only the generator is re-run there, *then* the bytes are identical to the canonical run. *The cheap form is sufficient because `declarationMap: false` and no source maps mean tsc output cannot carry a path — the generator is the only component that can leak one. Recorded so the limitation is explicit.*

**REQ-RMD-03 — Line endings and BOM.**
- **RMD-03.1** — `tsconfig.build.json` sets `newLine: "lf"`.
- **RMD-03.2** — No emitted closure file contains `\r\n`; proven against a **test-time-generated** CRLF fixture (a committed one is normalised by `.gitattributes` on the next `git add`).
- **RMD-03.3** — `.gitattributes` normalises `src/**` to LF with no `-text` exception covering it. *This is the real cross-machine guard: `newLine` governs only tsc-emitted terminators, while newlines inside template literals pass through verbatim from source.*
- **RMD-03.4** — No closure source or emitted file begins with `EF BB BF`.

**REQ-RMD-04 — Tamper localisation, on a copied root.**
- **RMD-04.1** — *Given* a **copy** of the built tree at a temp root, *when* one byte is appended to its `dist/core/session.js` and the manifest is regenerated there, *then* exactly one file record's digest differs, the other 23 are identical, and length and order are unchanged. *Must not touch the real `dist/` — `ensureTscBuild()` is memoized and FIT-04/FIT-14/the dist-runner e2e all read that tree afterwards.*

**REQ-RMD-05 — No machine-identifying content.**
- **RMD-05.1** — The manifest's bytes contain neither `process.cwd()` nor `os.userInfo().username`, and the exact-key-set assertion (RME-01.3) structurally excludes a timestamp field. *`os.homedir()` is deliberately NOT scanned: on GitHub runners the checkout lives under `/home/runner`, so a homedir substring scan fires on any legitimate relative path.*

## Capability 4 — `build-pipeline-integration` (BPI)

**REQ-BPI-01 — Produced by the build.**
- **BPI-01.1** — *Given* `package.json#scripts.build` parsed structurally, *then* it contains the `build:manifest` step and no other script is required to produce the manifest. *(Observable — "no additional command invoked" is not.)*
- **BPI-01.2** — The generator is the **last** step in the chain. *Otherwise a later failing `build:codegen` leaves a valid-looking manifest on a broken tree until the next `prebuild`.*

**REQ-BPI-02 — Fail-closed and atomic.**
- **BPI-02.1** — *Given* the generator invoked **directly against a prepared root that already contains a manifest**, *when* derivation fails, *then* exit ≠ 0 and no manifest remains. *Must not go through `bun run build` — `prebuild: rm -rf dist` would make the assertion vacuous.*
- **BPI-02.2 — Atomicity.** *Given* a file that becomes unreadable mid-derivation, *then* exit ≠ 0 and **no file at all** at `dist/runner-manifest.json` — never a truncated one. Implementation: hash-all-then-write-once, or write-then-rename.

**REQ-BPI-03 — Publish-ordering property (mechanism out of scope).**
- **BPI-03.1** — *Given* `publish.yml` parsed structurally, *then* either the version stamp precedes the build, or a rebuild occurs between stamp and publish. Green today via `prepublishOnly`; red the instant `--ignore-scripts`, `bun publish` or `bun pm pack` enters the workflow.

**REQ-BPI-04 — Manifest identity printed (pinned form).**
- **BPI-04.1** — *Given* a successful build, *then* stdout contains exactly two lines: `runner-manifest: 24 files -> dist/runner-manifest.json` and `runner-manifest-sha256: <64 lowercase hex>`. *The key must contain `manifest` — the failure mode is a release note pasting one of the 24 file digests instead of the digest **of** the manifest. Check for collision with FIT-30 (stdout-sacred).*

## Capability 5 — `closure-sealing-tripwires` (CST)

Realm per ambiguity J: kind checks on `dist` via AST; **errors name the `src` path**. Message prefix
`runner-manifest:`; every message states rule, why, and **fix**. Project-relative paths always; no
character ceiling (REQ-WPS-07's wire budget does not govern build tooling) — cap by offender count
(`… and N more`).

**REQ-CST-01 — No bare specifier.**
- **CST-01.1** — A third-party import in a closure file fails the build, emits no manifest, and names the `src` path, line, specifier and "Constraint 3".

**REQ-CST-02 — Builtins literally `node:`-prefixed.**
- **CST-02.1** — `import { readFileSync } from "fs"` **fails**. The rule is on the PREFIX, never a builtin-name allowlist, and the message says so — *the wrong repair (adding `"fs"` to an allowlist) is more likely than the right one.*

**REQ-CST-03 — Exactly one sanctioned dynamic `import()`, site-scoped.**
- **CST-03.1** — A dynamic `import()` in any closure file other than `runner.ts` fails, naming "Constraint 2".
- **CST-03.2** — A **second** dynamic `import()` inside `runner.ts` **also** fails, and the message names the sanctioned site and states the sanction is **per-SITE, not per-file**.
- **CST-03.3 — Anchor defined.** The invariant is: the count of dynamic `import()` in `dist/transport/runner.js` is **exactly 1**, and in every other closure file **exactly 0**; the sanctioned site carries the source marker `SANCTIONED-FACTORY-IMPORT`. *(CST-03.2 falls out of the count.)*

**REQ-CST-04 — Constraint 4: outright ban (R3).**
- **CST-04.1** — Any `createRequire` reference in a closure file fails the build, **except** at the single anchored site in `single-instance-probe.ts`. *A call-vs-`.resolve()` rule is evaded by `const req = createRequire(u); req("./x")` and by the namespace form.*
- **CST-04.2** — `eval`, `new Function`, `node:vm`, `Bun.plugin`, `process.binding` in a closure file fail, naming which primitive.
- **CST-04.3** — *Given* the current tree, *then* the deny-scan reports zero violations and the anchored `single-instance-probe.ts` site is **not** flagged.
- **CST-04.4** — *Given* a **synthetic** closure file with the indirect form and another with the namespace form, *then* both fail. *(CST-04.3 alone only proves the check does not fire on the one real file that happens to be shaped right.)*

**REQ-CST-05 — No `package.json` between entry and package root (SDK-side hygiene).**
- **CST-05.1** — Neither `dist/package.json` nor `dist/bin/package.json` exists. *The engine adopted this as an engine-side rule (their Q3), keeping the manifest a pure inclusion list; this half stops the SDK being the source of the file.*

**REQ-CST-06 — Failure quality asserted.**
- **CST-06.1** — Every tripwire message is asserted **by substring**, so "it fails" is never accepted as "it fails usefully".

## Capability 6 — `bundler-disjointness-invariant` (BDI)

**REQ-BDI-01 — Bundler outputs disjoint from the closure.**
- **BDI-01.1** — Every `--outfile`, `--outdir` (by **directory containment**) and `-o` target in `package.json#scripts` is outside the closure path set — proven non-vacuous by `dist/bin/pbuilder-codegen.js` being present and correctly judged outside.
- **BDI-01.2** — Non-`scripts` invocation surfaces (workflow steps, `Bun.build({outdir})`, `scripts/*.ts` calls) are **explicitly out of scope**, stated so the requirement does not read stronger than it is.

**REQ-BDI-02 — Graph-preserving emit.**
- **BDI-02.1** — For each closure `.js`, its relative-specifier **multiset** equals its `.ts` source's, after `.ts→.js` rewriting and **modulo type-only erasure**. *Replaces the near-vacuous "exactly one source exists" check — this goes red the instant a module is inlined.*
- **BDI-02.2** — *Given* a source with a type-only import (`session.ts`, `stdio-engine-client.ts`), *then* it is **not** flagged.
- **BDI-02.3** — The reverse (`src → dist`) is NOT asserted: `dist/core/engine-client.js` legitimately exists outside the closure.

**REQ-BDI-03 — Closure-graph baseline (nodes AND edges).**
- **BDI-03.1** — *Given* the committed `runner-closure-graph-baseline.json` (`{nodes, edges}`), *when* a node is added or removed, *or an edge is redirected with the node set unchanged*, *then* the fitness test fails naming the added/removed/redirected node or edge.

## Capability 7 — `packaged-manifest-fidelity` (PMF)

**Normative packer: `npm pack`** (what `publish.yml` uses). FIT-14 continues to use `bun pm pack` for
its own listing; PMF assertions are `npm`. The `package/` tarball prefix is stripped explicitly.

**REQ-PMF-01** — `npm pack`'s file list contains `dist/runner-manifest.json`.

**REQ-PMF-02 — Verified against packed and installed bytes.**
- **PMF-02.1** — All 24 digests recomputed against the **extracted tarball's** bytes match.
- **PMF-02.2 — Red-proof for BPI-03.** *Given* a build, *when* `package.json#version` is rewritten and `npm pack --ignore-scripts` runs, *then* entry #24's digest **MISMATCHES**, naming the field. *This is the actual behavioural proof of the publish-ordering property. The V1 form of this scenario could not fail: with `--ignore-scripts` the packed `package.json` IS the one the manifest hashed.*
- **PMF-02.3 — Registry-install round trip.** *Given* `npm pack` then `npm install ./<tarball>` into a temp project, *when* entry #24 is recomputed against `node_modules/@pbuilder/sdk/package.json`, *then* it matches. *`npm-normalize-package-bin` is a known rewriter and this package HAS a `bin` field; the release target makes registry install the production path. Being wrong here fails closed on 100% of users.*

**REQ-PMF-03** — `test/fitness/pkg-surface-baseline.json` is deliberately updated to include the manifest, so FIT-14 passes.

> **Verified 2026-07-25, not assumed**: `npm pack` and `bun pm pack` both preserve `package.json`
> byte-for-byte at **pack** time (identical SHA-256 across working tree and both tarballs). PMF-02.1
> and PMF-02.3 remain requirements because this must **stay** true, and because pack-time identity
> says nothing about the **install** boundary.

## Capability 8 — `integrity-invariants-documentation` (IID)

**Home**: `docs/runner-integrity-invariants.md`, linked from `docs/README.md` (*Contributor notes*),
matching the `docs/engine-sdk-wire-spec.md` cross-repo-normative precedent. Guarded by
`test/docs/runner-integrity-docs.test.ts` (precedent: `test/docs/security-authoring-guard.test.ts` —
frozen strings are copied from `design.md`, which wins on divergence). Freeze 1–3 sentences per REQ,
never whole passages. Plus a three-sentence `SECURITY.md` subsection that **subtracts** (scope-limits)
rather than announces.

**REQ-IID-01 — Five Constraints, structurally enforced.**
- **IID-01.1** — *Given* `docs/runner-integrity-invariants.md`, *then* it lists five Constraints, each with an `enforced-by:` field naming **either a FIT id that exists as a file on disk, or the literal `engine-owned`**. *A prose-only assertion passes against a document that says the right words while the code does something else; this one cannot.*
- **IID-01.2** — Constraint 2 is stated in its **resolved site-scoped form**, not the engine's original "no dynamic import on an infrastructure path". *That looser wording contradicts ambiguity D and would ship a document our own build enforces more strictly than it describes.*
- **IID-01.3** — Constraints 4 and 5 are marked **SDK-added** and **engine-owned** respectively on first use, and no Constraint is cited by bare number. *Guards against silent cross-repo numbering divergence.*

**REQ-IID-02 — Honest scope.**
- **IID-02.1** — The document states that the manifest **covers** the pre-factory bootstrap only, and that the engine's verification therefore attests only to those bytes — listing `dist/commons/**`, `dist/dialects/**`, `dist/conformance/**`, `dist/testing/**` and `node_modules/**` as loading into the same process at the same privilege moments later. *(“The manifest verifies X” is itself the error the paragraph exists to prevent: a JSON file verifies nothing; the engine verifies.)*
- **IID-02.2** — A single supplied pull-quote sentence exists, so paraphrases are controlled rather than invented.

**REQ-IID-03** — The justification states the real value (wrong-artefact detection; the tripwires, which are independent of the manifest; the install-script adversary the engine's model excludes) rather than "stops a malicious schematic author".

**REQ-IID-04** — Records "one manifest per published package, no per-platform map", with evidence.

**REQ-IID-05** — Entry #24 is justified by `"type": "module"` governing parse mode of all 23 files — **not** `packageRootFor()`.

**REQ-IID-06** — States that on `bun link` installs verification degrades to a **build-consistency check**.

**REQ-IID-07** — Records the C2 residual (a planted `dist/package.json` redirects `packageRootFor` and reinterprets parse mode with zero digest change) and notes the engine closed it engine-side (their Q3).

**REQ-IID-08** — `src/transport/single-instance-probe.ts`'s header gains one sentence converting its eleven-line convention argument into a pointer: Constraint 4 is **enforced** (naming `fit-42`), not conventional.

---

## Red-Proofs (18)

Tier A = synthetic mini-closure at a temp root (unit, milliseconds). Tier B = one real-tree negative
(copied `dist/`, generator as subprocess). Tier C = packaging.

| # | Tier | Planted | Must fail as | Must name |
|---|---|---|---|---|
| RP-1 | A | byte appended to a closure file | exactly one file record differs | path, expected, observed |
| RP-2 | A | a 24th closure file, imported | baseline diff | added node **and the edge that admitted it** |
| RP-2b | A | closure file / import removed | baseline diff | removed node/edge |
| **RP-2c** | A | **edge redirected, node set constant** | baseline diff | the redirected edge — *the real closure-sealing case* |
| RP-3 | A | dynamic `import()` outside `runner.ts` | build fails, no manifest | src path, line, specifier, Constraint 2 |
| RP-3b | A | second dynamic `import()` **inside** `runner.ts` | build fails | sanctioned site; per-SITE clause |
| RP-4 | A+B | bare third-party specifier | build fails, no manifest | src path, line, specifier, Constraint 3 |
| RP-5 | A | `"fs"` **and** `"node:fs"` in one fixture | exactly ONE violation | only `"fs"` — *a name allowlist would wrongly pass* |
| RP-6 | A | `dist/package.json` planted | fitness fails | path; that it redirects with **no digest change** |
| RP-7 | A | `createRequire` direct call | build fails | src path, line, Constraint 4 |
| **RP-7b** | A | `createRequire` **indirect variable** + **namespace import** forms | build fails | which form |
| RP-7c | A | `eval` / `new Function` / `node:vm` / `Bun.plugin` / `process.binding` | build fails | which primitive |
| RP-8 | A | `--outdir dist/transport` **and** `-o` short form | disjointness fails | script, target, colliding file |
| RP-9 | A | CRLF (generated at test time) | line-ending check fails | path, offset |
| RP-10 | A | the two discriminating path pairs | ordering fails under `localeCompare` | both orderings |
| RP-11 | A | duplicate / absolute / `..` path | shape validation fails | which rule, which record |
| **RP-12** | A | JSDoc `@example` quoting a bare specifier **and** a relative one | **must NOT fail and must NOT add a node** | *inverse red-proof — the day-one false alarm* |
| RP-13 | A | unresolvable relative specifier | build fails | importer, specifier, attempted path |

---

## Out of Scope

Editing `publish.yml` (property pinned, mechanism owned by the go-live batch); loader observation for
Constraint 1 (followup — Bun is confirmed, so it is now feasible, but structural ships per R4); the
fifth precondition's enforcement (engine-owned); any `src/**` behaviour change beyond IID-08's header
sentence — **do not refactor `single-instance-probe.ts`'s logic**; gap A.

## Release Checklist (engine round-2, item 2)

**`0.1.0` MUST ship `dist/runner-manifest.json`** — a `0.1.0` published without it cannot be executed
by a production engine; it fails closed by design. Same owner owns both, so this is a
release-checklist line, not a cross-team dependency — but a **hard-fail** one. Registered in
`openspec/pending-changes.md` alongside the go-live batch.

## Terminology

`entry` (code font) = the JSON field. **File record** = a member of `files` — never "entry" for these.
**Runner closure** = the 23 emitted `.js`. **Pre-factory bootstrap** = the 23 + `package.json` as
executed code. **Constraint N — `<name>`** = always named and numbered. **Tripwire** = the build check;
**Constraint** = the rule. **The sanctioned factory-import site** = one canonical phrase, matching the
`SANCTIONED-FACTORY-IMPORT` marker. **Covers / attests** — the engine verifies; the manifest covers.

## Signature Block

Owner assent given on all eight:

| Item | Ruling | Assented |
|---|---|---|
| **A** | "23" is a **regenerable baseline**, not a contract constant | ✅ 2026-07-25 |
| **D** | Factory-import site is **site-scoped** — a second `import()` inside `runner.ts` also fails | ✅ 2026-07-25 |
| **I** | `bun link` in scope; verification stated as a **build-consistency check** | ✅ 2026-07-25 |
| **J** | Set from `dist`, kind checks on `dist` via AST, **errors name `src`** | ✅ 2026-07-25 |
| **R1** | Parse with **ts-morph**, not regex | ✅ 2026-07-25 |
| **R3** | Constraint 4 is an **outright ban** on `createRequire`, legitimate site anchored | ✅ 2026-07-25 |
| **R4** | Constraint 1 ships **structural**; loader observation is a followup | ✅ 2026-07-25 |
| — | **Five Constraints**, not the contract's three (engine accepted in round 2) | ✅ 2026-07-25 |

- [x] **SIGNED** — owner: **Daniel Ramirez** — date: **2026-07-25**

Frozen. Any change requires `sdd-spec unfreeze=true` and re-signature.
