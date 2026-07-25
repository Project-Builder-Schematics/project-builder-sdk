# Design: Runner Integrity Manifest (runner-integrity-manifest)

**Triage**: L · **Spec**: V2 SIGNED (frozen) · **ADRs**: 4 (budget 4) · **architecture_impact**: `additive`
**Inputs**: `spec.md` (contract), `review-qa.md` (binding test plan), `review-tech-writer.md` (binding names + prose),
`ENGINE-RUNNER-MANIFEST-CONTRACT.md`, `ENGINE-REPLY-TO-MANIFEST-REPLY.md`, `openspec/architecture.md`.

> **This document is the source of truth for frozen strings** (§9), per the
> `test/docs/security-authoring-guard.test.ts` precedent: the docs page and the guard test both copy
> from §9; on divergence, §9 wins and the copy is wrong. This answers review-tech-writer open Q4.

---

## 1. Architecture Overview

### 1.1 One derivation, three consumers

```
scripts/derive-runner-closure.ts          ← the ONE walk + classifier + deny-scan (pure, root-parameterised)
  ├─ scripts/generate-runner-manifest.ts     BUILD authority — fail-closed, writes dist/runner-manifest.json
  ├─ scripts/regen-closure-baseline.ts       MAINTAINER-only writer of the committed baseline
  └─ test/fitness/fit-42-*.test.ts           CI authority — baselines, disjointness, red-proofs
```

Three consumers, not two: the baseline writer is a **separate script deliberately outside the build**.
If `bun run build` regenerated `runner-closure-graph-baseline.json`, BDI-03 could never go red — the
tripwire would silently repair itself on every build. Same reasoning as FIT-27's "no in-test update
path" guard for the conformance corpus, and the reason `scripts/regen-corpus.ts` exists as its own file.

**Division of authority** (this is the load-bearing split; slices must not blur it):

| Enforced at | Constraints | Mechanism | Failure surface |
|---|---|---|---|
| **BUILD time** (`bun run build`) | 2 (one sanctioned dynamic `import()`), 3 + 3a (no bare specifier / `node:` prefix), 4 (no unhashed-code-execution primitive) | violations returned by `deriveRunnerClosure()`; the generator renders them, removes any stale manifest, exits ≠ 0 | the maintainer's own build, immediately |
| **CI time** (`bun test`) | 1 (no bundler / no code-splitting) — via injective correspondence + closure-graph baseline + bundler-output disjointness | `fit-42` | the PR |
| **Engine side** | 5 (no loader injection at spawn) | engine-owned; `enforced-by: engine-owned` in the docs page | not ours |

Constraint 1 is **not** a build-time tripwire, and that is deliberate: a bundler that rewrote the graph
would still produce a *derivable* closure, so the generator has nothing to fail on. Only a comparison
against a committed baseline sees it. The docs page states this limit (§9, `LIMIT_CONSTRAINT_1`).

### 1.2 The realm split (ambiguity J, ruling R2)

| Concern | Realm | Why |
|---|---|---|
| The file **set** and the **graph** | emitted `dist/**` | a source walk yields 24 (`engine-client.ts` is `import type`-only and tsc erases it). Verified. |
| Specifier **kind** checks (Constraints 2/3/3a/4) | emitted `dist/**` | the manifest covers emitted bytes; a kind check on source can pass while the emitted file differs |
| The path an **error names** | `src/**` | the reader must EDIT source. `dist/x/y.js → src/x/y.ts` is a pure string transform, proven injective by BDI-02 |
| The **line** an error names | emitted | see §3.6 — a source line inferred from an emitted observation is a guess; we report the line we actually observed, labelled with its realm |
| BDI-02's specifier multiset | both | the only check that reads two realms at once |

### 1.3 Parsing (ruling R1 — ts-morph, not regex)

One `ts-morph` `Project` per derivation, `{ compilerOptions: { allowJs: true }, skipAddingFilesFromTsConfig: true }`,
files added by absolute path. Verified against this repo's ts-morph (28.0.0) on 2026-07-25:

| Construct | Node visited | Notes |
|---|---|---|
| `import … from "s"`, side-effect `import "s"` | `SourceFile.getImportDeclarations()` → `getModuleSpecifierValue()` | **JSDoc-quoted imports are structurally absent** — R1's whole point; no comment stripping anywhere |
| `export … from "s"`, `export * from "s"` | `SourceFile.getExportDeclarations()` → `getModuleSpecifierValue()` (skip declarations without one) | same |
| dynamic `import(expr)` | `getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => c.getExpression().getKind() === SyntaxKind.ImportKeyword)` | must use `SyntaxKind`, not a raw kind number. JSDoc examples are not counted |
| `createRequire` (all 4 forms) | `getDescendantsOfKind(SyntaxKind.Identifier)` where `getText() === "createRequire"` | an identifier scan is what makes R3's outright ban **decidable** — it catches the import, the direct call, the indirect variable form and `.resolve()`, and excludes the JSDoc one |
| `eval`, `Function`, `node:vm`, `Bun.plugin`, `process.binding` | identifier / specifier scan, same pass | closed set, per CST-04.2 |

**Dynamic imports are never followed as edges.** Every dynamic `import()` is either *the* sanctioned
site (counted, anchored) or a Constraint-2 violation. This matters: the real sanctioned site is
`await import(moduleUrl)` (`src/transport/runner.ts:268`) — a **non-literal** specifier. Any rule that
treated a non-literal `import()` as "unclassifiable" would fail the build on the one site the contract
sanctions.

### 1.4 Layering and new edges

- `scripts/` is an **existing layer** (maintainer/CI tooling, never shipped: `files: ["dist"]`,
  `tsconfig.build.json` `rootDir: "./src"`). The generator extends it. **First `scripts/` file wired
  into `build`** — a deliberate sharpening of the convention, ADR-B.
- **New edge `test/ → scripts/`** (fit-42 imports `derive-runner-closure.ts`). This is the correct
  direction: build-time tooling is consumed by both the build and the tests. The inverse
  (`scripts/ → test/`) would make the production build depend on a tree `tsconfig.build.json`
  excludes. FIT-27 is not violated — its rule (b) names `scripts/regen-corpus.ts` literally and is
  corpus-specific; `fit-42`'s header states the sanction (§9, `FIT42_HEADER_SCRIPTS_IMPORT`).
- **New ts-morph importer outside `src/dialects/*/ast.ts`.** The baseline's "ts-morph stays
  LEAF-ISOLATED" claim gains a documented, **unshipped, build-time** exception. No fitness change is
  needed: FIT-37 walks `src/core`+`src/commons`, FIT-38 scans `src/**` only — `scripts/` is outside
  both by construction, **verified**, not assumed. Extending FIT-38's scan to `scripts/` merely to
  carve an exemption would be more code and a weaker guard. The exception is recorded here and in the
  module header (§9, `DERIVE_HEADER_REALM`), and the architecture baseline refresh must capture it.
- **No `src/**` behaviour diff.** The single permitted `src/` touch is REQ-IID-08's one-sentence
  header addition in `src/transport/single-instance-probe.ts`. Its logic is not refactored — that is
  what keeps `architecture_impact: additive` (§8).
- **FIT-30 (stdout-sacred) does not collide** with BPI-04.1's two stdout lines: FIT-30 is scoped to
  the `src/transport/**` subtree; the generator lives in `scripts/`.

### 1.5 Distinguishing the two closure walkers

`test/support/import-scan.ts` already contains a **source-realm** regex walker (FIT-15/FIT-21/FIT-25/
FIT-27) whose `walkReachable` does `catch { continue }` — the exact silent-skip idiom RCD-03.2 forbids.
It is **not** reused and **not** modified. The required mitigation is the first line of the new module's
header (§9, `DERIVE_HEADER_REALM`), naming both walkers and why they are not interchangeable.

---

## 2. File Changes

The contract with `sdd-slice`. Every path, action, and why. Delivery order is a hint, not a slice plan.

| # | Path | Action | Why | REQs | Order |
|---|---|---|---|---|---|
| 1 | `scripts/derive-runner-closure.ts` | **Created** | The one walk: closure derivation, kind classification, deny-scan, violation rendering, `comparePaths`, `serialiseManifest`, `sha256File`, `readSpecifiers` | RCD-00..05, CST-01..04, RME-05.2 | 1 |
| 2 | `scripts/generate-runner-manifest.ts` | **Created** | Fail-closed build authority: derive → render+unlink+exit≠0 on violations → hash-all → write-once → print identity lines | RME-01..07, RMD-01..05, BPI-02, BPI-04 | 1 |
| 3 | `package.json` | Modified | `scripts.build:manifest`; chained **LAST** in `scripts.build`; `scripts.regen:closure-baseline` | BPI-01.1, BPI-01.2 | 1 |
| 4 | `tsconfig.build.json` | Modified | `"newLine": "lf"` | RMD-03.1 | 1 |
| 5 | `scripts/regen-closure-baseline.ts` | **Created** | The sole writer of the committed baseline, deliberately outside `build` (§1.1) | BDI-03.1 | 2 |
| 6 | `test/fitness/runner-closure-graph-baseline.json` | **Created** | `{nodes, edges, builtins}` — generated by #5, never hand-written | RCD-01.1, RCD-04.1, BDI-03.1 | 2 |
| 7 | `test/fitness/fit-42-runner-closure-integrity.test.ts` | **Created** | Tier B: every real-built-tree assertion (manifest shape, determinism, tamper localisation, baselines, disjointness, graph-preserving emit, build wiring via subprocess) | see §5 | 3 |
| 8 | `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` | **Created** | Tier A: all 18 red-proofs + the anti-tautology scenario, on synthetic mini-closures | see §5 | 3 |
| 9 | `test/build/build-config.test.ts` | Modified | Existing home for build-script/tsconfig structural guards (already guards `prebuild` + `declarationMap`) — gains BPI-01.1/01.2, RMD-03.1, RMD-03.3 | BPI-01, RMD-03.1, RMD-03.3 | 3 |
| 10 | `test/fitness/fit-23-publish-workflow-guard.test.ts` | Modified | BPI-03.1's publish-ordering property; **no new home** (review-tech-writer §4 flag 3) | BPI-03.1 | 3 |
| 11 | `test/fitness/pkg-surface-baseline.json` | Modified | Add `dist/runner-manifest.json` to `tarball` — **FIT-14 goes red on first success without this**; a deliberate, reviewed regeneration | PMF-03 | 4 |
| 12 | `test/fitness/fit-14-package-surface.test.ts` | Modified | Route its unconditional `beforeAll` build through `ensureTscBuild()` (QA Isolation §3 — see §10 R-3) | — | 4 |
| 13 | `test/e2e/runner-manifest-packaged.e2e.test.ts` | **Created** | Tier C: `npm pack` → extract → 24 digests → version-rewrite red-proof → `npm install` round trip | PMF-01, PMF-02.1..3 | 5 |
| 14 | `docs/runner-integrity-invariants.md` | **Created** | The five Constraints with `enforced-by:`, honest scope, real justification, entry-#24 reason, `bun link` limit, C2 residual | IID-01..07, BDI-01.2 | 6 |
| 15 | `docs/README.md` | Modified | Link #14 under *Contributor notes* (the ratified home requirement) | IID (home) | 6 |
| 16 | `test/docs/runner-integrity-docs.test.ts` | **Created** | Structured + substring guard over #14, `SECURITY.md`, and the probe header | IID-01..08, BDI-01.2 | 6 |
| 17 | `SECURITY.md` | Modified | The three-sentence scope-limiting subsection (§9, `SECURITY_SUBSECTION`) | IID-02 (scope) | 6 |
| 18 | `src/transport/single-instance-probe.ts` | Modified | **The only `src/` touch**: one header sentence turning the eleven-line convention argument into a pointer at the enforced Constraint 4. **Do not refactor the logic.** | IID-08 | 6 |

**Not touched, deliberately**: `.github/workflows/publish.yml` (property pinned in #10, mechanism owned
by the go-live batch); `test/support/import-scan.ts` (§1.5); any other `src/**` file.

**`0.1.0` release-checklist row** (spec § Release Checklist): registering the MANDATORY-precondition
line in `openspec/pending-changes.md` is an archive-time action, not a file in this table.

---

## 3. Interface Contracts

### 3.1 `scripts/derive-runner-closure.ts`

```ts
/** A node of the closure graph. Paths are ALWAYS distRoot-relative, POSIX, no leading "./". */
export type ClosurePath = string;

export interface ClosureEdge {
  readonly from: ClosurePath;
  readonly to: ClosurePath;
  readonly specifier: string;   // as written in the emitted file
}

export type ViolationRule =
  | "constraint-2-dynamic-import"        // dynamic import() outside the sanctioned site
  | "constraint-2-second-site"           // a second dynamic import() inside the sanctioned FILE
  | "constraint-3-bare-specifier"
  | "constraint-3a-unprefixed-builtin"
  | "constraint-4-execution-primitive"   // createRequire (any form) | eval | Function | node:vm | Bun.plugin | process.binding
  | "unclassifiable-construct"
  | "unresolvable-specifier"
  | "unreadable-file"
  | "symlink-escape";

export interface Violation {
  readonly rule: ViolationRule;
  readonly file: ClosurePath;      // distRoot-relative — the realm we observed
  readonly line: number | null;    // emitted-realm line; null when the violation is not node-anchored
  readonly found: string;          // the offending construct's source text, single line, ≤200 chars
  readonly detail?: string;        // specifier / primitive name / attempted path / sanctioned-site ref
}

export interface ClosureDerivation {
  readonly nodes: readonly ClosurePath[];     // byte-sorted (comparePaths)
  readonly edges: readonly ClosureEdge[];     // sorted by (from, to, specifier)
  readonly builtins: readonly string[];       // sorted, each literally "node:"-prefixed
  readonly violations: readonly Violation[];  // EMPTY ⇒ the closure is sealed
}

/** REQ-RCD-00. `entryRelPath` is distRoot-relative (e.g. "bin/pbuilder-runner.js"). */
export function deriveRunnerClosure(distRoot: string, entryRelPath: string): ClosureDerivation;

/** REQ-RME-05: byte-wise, via Buffer.compare. NEVER localeCompare. */
export function comparePaths(a: string, b: string): number;

/** REQ-RME-06.1: JSON.stringify(m, null, 2) + "\n"; key order fixed by construction. */
export function serialiseManifest(manifest: RunnerManifest): string;

/** REQ-RME-02: sha256 over the file's raw BYTES (never a utf-8 round trip). Lowercase hex. */
export function sha256File(absolutePath: string): string;

/** Shared realm-agnostic extraction — the ONLY specifier reader in this change (BDI-02 needs src). */
export function readSpecifiers(absolutePath: string): {
  readonly staticSpecifiers: readonly string[];   // in source order, duplicates preserved (multiset)
  readonly typeOnlyStatic: readonly string[];     // subset erased by tsc
  readonly dynamicImportCount: number;
};

/** Renders violations into the frozen §9 form. distRoot-relative in, src-relative out. */
export function renderViolations(
  violations: readonly Violation[],
  opts: { readonly distDirName: string; readonly srcDirName: string; readonly maxShown?: number }
): string;
```

**Return value, never a throw.** Violations are **data**, for three reasons: (a) the frozen message caps
by offender count (`… and N more`), which a throw-on-first design can never produce; (b) CST-04.3 asserts
*zero* violations on the current tree — a value, not the absence of an exception; (c) Tier A red-proofs
assert on structured violations *and* on rendered text without `try`/`catch` scaffolding. The only thing
that exits non-zero is the generator (§3.2).

**Exports beyond REQ-RCD-00's four**: `readSpecifiers` (BDI-02.1 must read the `src` realm with the same
JSDoc-safe parser — re-deriving extraction in the test is exactly what R1 forbids) and `renderViolations`
(so Tier A can assert message text without spawning). RCD-00 states a minimum, not a ceiling.

**Classification is a total function.** Every static module specifier lands in exactly one class:

| Class | Rule | Outcome |
|---|---|---|
| relative (`./`, `../`) | resolve against the importing file's dir | followed as an edge; unresolvable ⇒ `unresolvable-specifier` (RCD-03.2) |
| `node:`-prefixed literal | — | recorded in `builtins`, not followed (RCD-04) |
| bare package name | — | `constraint-3-bare-specifier` (CST-01) |
| a builtin name **without** the prefix (`"fs"`) | membership in `node:`-strippable builtin names is used **only to phrase the message**, never to permit | `constraint-3a-unprefixed-builtin` (CST-02) |
| anything else — URL scheme (`file:`, `data:`, `http:`), absolute (`/…`), query/fragment (`./x.js?v=1`) | — | `unclassifiable-construct` (RCD-03.1) / query+fragment is called out in `detail` (RCD-03.4) |

> **Spec note (not a defect, no halt)**: RCD-03.1's parenthetical examples — "non-literal `import(expr)`,
> computed `export * from`" — are not realizable in the emitted-ESM realm. A static `export … from`
> specifier is syntactically required to be a string literal, and a non-literal `import(expr)` is the
> **sanctioned site's own form** (§1.3). The scenario is satisfied by the realizable unclassifiable forms
> in the table above; the red-proof fixture plants a URL-scheme specifier. Recorded so nobody "fixes" the
> fixture back to an unrepresentable construct.

**Resolution**: relative specifiers resolve to a real path; the walk does **not** filter by `.js`
(RCD-02.3) — whatever the specifier names (`.js`/`.mjs`/`.cjs`) is followed. Each resolved path is
`realpathSync`'d and rejected with `symlink-escape` if it leaves `realpathSync(distRoot)` (RCD-05.1).
An unreadable file yields `unreadable-file` naming the path (RCD-03.5) rather than an exception.

### 3.2 `scripts/generate-runner-manifest.ts`

```
usage: bun scripts/generate-runner-manifest.ts [packageRoot]
```

`packageRoot` defaults to the repo root derived from `import.meta.url`. **It is resolved with
`fileURLToPath(new URL("../", import.meta.url))`, NOT `.pathname`** — this repo's prevailing test-helper
idiom (`new URL("../../", import.meta.url).pathname`) does not percent-decode, so it breaks on a path
containing a space, which is exactly what RMD-02.1 plants. The deliberate divergence is stated in the
file header (§9, `GENERATOR_HEADER_PATH`).

Derived: `distRoot = <packageRoot>/dist`, `entryRelPath = "bin/pbuilder-runner.js"`,
`manifestPath = <distRoot>/runner-manifest.json`. The `dist/` prefix in manifest paths is computed as
`relative(packageRoot, distRoot)` — no extra parameter, and a copied root with a different layout still works.

Sequence — **hash-all-then-write-once** (BPI-02.2):

1. `deriveRunnerClosure(distRoot, entryRelPath)`.
2. `violations.length > 0` → write `renderViolations(...)` to **stderr**, `rmSync(manifestPath, { force: true })`,
   `process.exit(1)`. The unlink is not optional: BPI-02.1 asserts that when the generator is run against a
   prepared root that **already contains** a manifest, **no manifest remains**. A stale manifest surviving a
   failed derivation is indistinguishable from tampering on the user's machine.
3. Otherwise hash **all** 24 files first (any read failure here re-enters step 2 as `unreadable-file`),
   build the manifest object in pinned key order, `serialiseManifest`, then **one** `writeFileSync`.
   Nothing is opened for writing before every byte is known, so a truncated manifest has no source in this
   design. Write-then-rename (the spec's alternative) buys nothing further and adds a temp path to clean up.
4. Print exactly two lines to **stdout** (BPI-04.1, §9 `BUILD_IDENTITY_LINES`), the second being the
   SHA-256 **of the manifest file itself** — computed after the write, over the bytes on disk.

`dist/runner-manifest.json` is never a file record: it is unreachable by import edges and is asserted
absent from `files` (RME-03.1).

### 3.3 The manifest type

```ts
export interface RunnerManifest {
  readonly manifestVersion: 1;
  readonly algorithm: "sha256";
  readonly entry: string;            // "dist/bin/pbuilder-runner.js"
  readonly packageVersion: string;   // root package.json#version (RME-07.1, engine Q4)
  readonly files: ReadonlyArray<{ readonly path: string; readonly sha256: string }>;
}
```

Key order is fixed by object-literal construction order; `JSON.stringify` preserves it. The field names
are **the engine's** — not ours to improve. All 24 records sort together (ambiguity B); `package.json`
is not appended after the `dist/` ones.

### 3.4 `scripts/regen-closure-baseline.ts`

```
usage: bun scripts/regen-closure-baseline.ts     # writes test/fitness/runner-closure-graph-baseline.json
npm script: regen:closure-baseline
```

Writes `{ nodes, edges, builtins }`, each sorted, serialised with the same
`JSON.stringify(v, null, 2) + "\n"` form. It **fails** if `deriveRunnerClosure` returns violations — a
baseline must never be regenerated from a tree that cannot build.

> **Baseline shape — resolving a conflict between two binding inputs.** review-tech-writer §4 names the
> file's content `{nodes, edges}`; signed REQ-RCD-04.1 requires the observed builtin set to equal *the
> baseline's builtin row*. The **signed spec wins**: the file carries three keys. "graph" in the filename
> still earns its keep — it is the `edges` key that RP-2c needs. This answers review-qa open Q2.

### 3.5 What the build does not do

The build never writes the baseline (§1.1), never writes to `test/**`, and never runs BDI's checks.
`bun run build` on a tree whose graph drifted legitimately still succeeds and emits a correct manifest;
`bun test` is what fails, with the permissive-register message of §9 (`BASELINE_DRIFT_MESSAGE`).

### 3.6 Violation rendering — realm attribution (deliberate near-verbatim divergence)

review-tech-writer §5's drafted messages place the line on the `src` path
(`src/transport/runner.ts:12 … (emitted: dist/transport/runner.js)`). **Design ruling: the path is `src`,
the line is attributed to the realm it was observed in.**

```
runner-manifest: src/transport/runner.ts — bare specifier in the runner closure.
  found: import { Project } from "ts-morph"     (emitted: dist/transport/runner.js:12)
```

Rejected alternative — re-parse the `src` counterpart and locate the same construct to report a true
source line: it needs per-rule matching logic (a bare specifier matches by specifier text, a
`createRequire` reference by identifier, a dynamic `import()` by position), it silently degrades exactly
when the emitted file diverges from its source — the case where the message matters most — and Tier B
plants violations in a copied `dist/` whose `src/` counterpart legitimately has no such construct.
Reporting a source path with an emitted-realm line **labelled as such** is honest, costs nothing, and
still satisfies "names the src path, the line and the construct". The `found:`/`rule:`/`why:`/`fix:`
skeleton and every asserted substring from review-tech-writer §5 are preserved; §9 is the frozen form.

The `src` path is a pure string transform (`<dist>/x/y.js` → `<src>/x/y.ts`), so it works in Tier A and
Tier B roots that carry no `src/` tree at all.

---

## 4. Flow Changes

| Actor / flow | Before | After |
|---|---|---|
| **`bun run build`** | `rm -rf dist` → `tsc` → `build:codegen` | … → **`build:manifest`** (LAST). Emits `dist/runner-manifest.json` and prints two identity lines. Fails, with no manifest anywhere, on a Constraint 2/3/3a/4 violation. Runtime cost: one ts-morph parse of 23 small emitted files. |
| **`prepublishOnly` / publish** | build re-runs after `npm version` by accident | Unchanged mechanically — but the accident is now **pinned as a property** (BPI-03.1). The workflow itself is not edited; the moment `--ignore-scripts`, `bun publish` or `bun pm pack` enters `publish.yml`, `fit-23` goes red. |
| **CI (`bun test`)** | — | `fit-42` (+negative) runs; one memoized `ensureTscBuild()` shared with FIT-04/FIT-14/FIT-17 and the dist-runner e2e; one `npm pack`+`npm install` e2e (Tier C). |
| **Maintainer who adds an import to the closure** | nothing happens | Build still succeeds (the closure is allowed to grow). `bun test` fails with `BASELINE_DRIFT_MESSAGE` naming the added node **and the edge that admitted it**, and telling them to check the new file against the Constraints, run `bun run regen:closure-baseline`, and commit the baseline in the same commit. |
| **Maintainer who adds a bare specifier / a second `import()` / `createRequire`** | nothing happens | **The build fails immediately**, no manifest is written, and the message names the `src` file to edit, the rule, why the rule exists, and the fix. |
| **Maintainer who points a bundler at the runner** | nothing happens | The build still succeeds; `fit-42` fails on bundler-output disjointness (BDI-01.1) and/or graph-preserving emit (BDI-02.1) and/or the baseline (BDI-03.1). Stated as a limit in the docs page. |
| **The engine** | spawns its embedded test double | reads `dist/runner-manifest.json` before **every** spawn, cross-checks `packageVersion` (reporting version-mismatch distinctly from integrity-mismatch), verifies 24 digests, and applies its own mirror of Constraints 1–4 plus engine-owned Constraint 5. **Unblocks `PC-RUN-01`.** |
| **A user on a `bun link` install** | — | Verification degrades to a **build-consistency check** (same build produced both bytes and digests) — a wrong-artefact detector and nothing more. Stated in the docs page (IID-06). |

---

## 5. Test Derivation

**Tiers** — A/B/C are review-qa's ratified vehicles and are honoured exactly. **S** ("static read") is
not a fourth vehicle but the *absence* of one: a structural assertion over a committed artefact
(`package.json`, `tsconfig.build.json`, `.gitattributes`, YAML, markdown) that spawns and builds nothing.

| Tier | Vehicle |
|---|---|
| **A** | `mkdtempSync` root + 3–5 tiny `.js` files (+ an optional mirrored `src/` for message assertions) + `package.json`; call the exported functions **directly**. Milliseconds, hermetic. |
| **B** | `ensureTscBuild()` (memoized) → assertions on the real tree; mutating cases operate on a `cp -R` **copy** (`dist/` + `src/` + `package.json`) at a `scratchDirFactory()` root, generator invoked as a **subprocess**. |
| **C** | `npm pack` (normative for PMF) → extract, strip the `package/` prefix → digests; then `npm install ./<tarball>` into a temp project. |
| **S** | read + parse a committed file. |

Files: **F42** = `fit-42-runner-closure-integrity.test.ts` · **F42N** = `…negative.test.ts` ·
**BC** = `test/build/build-config.test.ts` · **F23** = `fit-23-publish-workflow-guard.test.ts` ·
**F14** = `fit-14-package-surface.test.ts` + its baseline · **E2E** = `test/e2e/runner-manifest-packaged.e2e.test.ts` ·
**DOC** = `test/docs/runner-integrity-docs.test.ts`.

### Capability 1 — RCD

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| REQ-RCD-00 | A | the exported surface is imported and called directly by every Tier A case; asserted explicitly as five callable exports | F42N |
| RCD-01.1 | B | derive from real `dist` → node set equals `baseline.nodes` | F42 |
| **RCD-01.2** | A | synthetic tree: entry→A,B; A→C; **D present, unimported** → result is exactly `{entry,A,B,C}`, **D asserted absent by name** | F42N |
| RCD-01.3 | A | A↔B cycle → terminates, `{entry,A,B}` | F42N |
| RCD-01.4 | A | entry with zero imports → exactly 1 | F42N |
| RCD-02.1 | B | `core/engine-client.js` absent from the closure, asserted by name | F42 |
| RCD-02.2 | B | `nodes.length === 23` (and equals the baseline row) | F42 |
| RCD-02.3 | A | synthetic `./x.mjs` specifier is followed | F42N |
| RCD-03.1 | A | URL-scheme specifier fixture → `unclassifiable-construct`; rendered text names src path, line, construct | F42N |
| RCD-03.2 | A | relative specifier resolving nowhere → `unresolvable-specifier` naming importer, specifier, attempted path (**RP-13**) | F42N |
| **RCD-03.3** | B | the two real files by name (`dist/core/authoring-error.js`, `dist/core/context.js`): **no edge added, no violation** (**RP-12**) | F42 |
| RCD-03.4 | A | `./x.js?v=1` → explicit classification failure, never a skip | F42N |
| RCD-03.5 | A | mode-000 file → `unreadable-file` naming the path; **`it.skipIf(process.getuid?.() === 0)`** | F42N |
| RCD-04.1 | B | observed builtin set equals `baseline.builtins` (never a literal list) | F42 |
| RCD-05.1 | A | specifier resolving through a symlink whose target is outside the root → `symlink-escape` | F42N |

### Capability 2 — RME

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| RME-01.1 | B | parse the emitted manifest: version, algorithm, 24 records, `entry`, `entry` appears exactly once in `files` | F42 |
| RME-01.2 | B | exactly one `package.json` record; other 23 start with `dist/` | F42 |
| RME-01.3 | B | **exact** top-level key set and per-record key set | F42 |
| RME-02.1 | B | recompute every digest with the test's **own** hasher (`test/support/scratch-consumer.ts#hashFile`), never the generator's | F42 |
| **RME-02.2** | A | known-answer vectors on `sha256File`: zero bytes → `e3b0c442…b855`; `"\n"` → `01ba4719…0b` | F42N |
| RME-03.1 | B | no record matches `*.d.ts`, `dist/{dialects,commons,conformance,testing}/**`, `node_modules/**`, or the manifest itself | F42 |
| RME-04.1 | B | POSIX separators, no leading `./`, not absolute, no `..`, no duplicates | F42 |
| RME-05.1 | B | consecutive paths strictly ascending under `Buffer.compare` | F42 |
| **RME-05.2** | A | `comparePaths` on `dist/Z.js` vs `dist/a.js` and `dist/a-b.js` vs `dist/aB.js` → byte order (**RP-10**; kills `localeCompare`) | F42N |
| RME-06.1 | B | `raw === JSON.stringify(JSON.parse(raw), null, 2) + "\n"` | F42 |
| RME-07.1 | B | `packageVersion` equals root `package.json#version` | F42 |

### Capability 3 — RMD

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| RMD-01.1 | B | generator run twice on a copied root → byte-identical | F42 |
| RMD-01.2 | B | two **child processes**, `LC_ALL=C` vs `LC_ALL=tr_TR.UTF-8` (env passed to the child, never `process.env`) → identical bytes | F42 |
| RMD-02.1 | B | copied root whose absolute path contains **a space and a non-ASCII segment**; only the generator re-runs → identical to the canonical bytes | F42 |
| RMD-03.1 | S | `tsconfig.build.json#compilerOptions.newLine === "lf"` | BC |
| RMD-03.2 | B + A | no emitted closure file contains `\r\n` (B); a **test-time-generated** CRLF fixture proves the check fires (A, **RP-9**) | F42 + F42N |
| RMD-03.3 | S | `.gitattributes` normalises `src/**` to LF with no `-text` exception covering it (the committed `-text` line covers `test/dialects/**` only — assert that scope) | BC |
| RMD-03.4 | B | no closure source or emitted file begins with `EF BB BF` | F42 |
| **RMD-04.1** | B | **copy** of the built tree; append one byte to its `dist/core/session.js`; regenerate **there** → exactly one record's digest differs, other 23 identical, length and order unchanged (**RP-1**). Never touches the real `dist/` | F42 |
| RMD-05.1 | B | manifest bytes contain neither `process.cwd()` nor `os.userInfo().username` (`os.homedir()` deliberately not scanned) | F42 |

### Capability 4 — BPI

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| BPI-01.1 | S | `package.json#scripts.build` structurally contains the `build:manifest` step; no other script mentions `generate-runner-manifest` | BC |
| BPI-01.2 | S | splitting `scripts.build` on `&&`, the **last** segment is the manifest step | BC |
| **BPI-02.1** | B | prepared root that **already contains** a manifest + a planted violation; generator invoked **directly** as a subprocess (never via `bun run build` — `prebuild: rm -rf dist` would make it vacuous) → exit ≠ 0 **and no manifest remains** | F42 |
| BPI-02.2 | B | a closure file made unreadable before the run → exit ≠ 0 and **no file at all** at the manifest path (never a truncated one) | F42 |
| BPI-03.1 | S | `publish.yml` parsed with `YAML.parse`: version stamp precedes build **or** a rebuild occurs between stamp and publish — the `prepublishOnly` leg counts only while the publish command is `npm publish` **without** `--ignore-scripts` | F23 |
| BPI-04.1 | B | generator subprocess stdout is exactly the two frozen lines; second line's digest equals a recomputation over the manifest file | F42 |

### Capability 5 — CST

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| CST-01.1 | A + B | bare third-party specifier planted synthetically (A) and in a copied real tree (B, the ONE real-tree negative) → build fails, no manifest, message names src path, line, specifier, "Constraint 3" (**RP-4**) | F42N + F42 |
| **CST-02.1** | A | one fixture containing **both** `"fs"` and `"node:fs"` → **exactly ONE** violation, naming only `"fs"` (**RP-5**; a name allowlist would wrongly pass) | F42N |
| CST-03.1 | A | dynamic `import()` in a non-sanctioned file → `constraint-2-dynamic-import` (**RP-3**) | F42N |
| CST-03.2 | A | **second** dynamic `import()` inside the sanctioned file → fails; message names the sanctioned site and the **per-SITE** clause (**RP-3b**) | F42N |
| CST-03.3 | B | real tree: dynamic-import count is exactly 1 in `dist/transport/runner.js` and 0 in every other closure file; the `SANCTIONED-FACTORY-IMPORT` marker is present at the source site | F42 |
| CST-04.1 | A | `createRequire` direct call → `constraint-4-execution-primitive` (**RP-7**) | F42N |
| CST-04.2 | A | `eval`, `new Function`, `node:vm`, `Bun.plugin`, `process.binding`, one each → each names its primitive (**RP-7c**) | F42N |
| CST-04.3 | B | real tree: deny-scan reports zero violations **and** the anchored `single-instance-probe` site is not flagged | F42 |
| **CST-04.4** | A | indirect form (`const req = createRequire(u); req("./x")`) **and** namespace form (`import * as m from "node:module"; m.createRequire(u)(…)`) → both fail, naming which form (**RP-7b**) | F42N |
| CST-05.1 | B | neither `dist/package.json` nor `dist/bin/package.json` exists; planted-`dist/package.json` red-proof states it redirects with **no digest change** (**RP-6**) | F42 + F42N |
| CST-06.1 | A | every violation's rendered text is asserted **by substring** (rule, why, fix, and the no-manifest line) — the meta-requirement each red-proof above satisfies, plus one explicit shape test over the closed `ViolationRule` set | F42N |

### Capability 6 — BDI

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| BDI-01.1 | B | every `--outfile`, `--outdir` (by **directory containment**) and `-o` target in `package.json#scripts` is outside the closure path set; non-vacuous because `dist/bin/pbuilder-codegen.js` is present and correctly judged outside. Red-proof plants `--outdir dist/transport` **and** the `-o` short form (**RP-8**) | F42 + F42N |
| BDI-01.2 | S | the docs page states that non-`scripts` surfaces (workflow steps, `Bun.build({outdir})`, `scripts/*.ts`) are out of scope | DOC |
| BDI-02.1 | B | for each closure `.js`, its relative-specifier **multiset** equals its `.ts` source's after `.ts→.js` rewriting and modulo type-only erasure (see note) | F42 |
| BDI-02.2 | B | `session.ts` and `stdio-engine-client.ts` (type-only imports) are **not** flagged, by name | F42 |
| BDI-02.3 | B | the reverse direction is deliberately unasserted — proven by `dist/core/engine-client.js` **existing on disk** while outside the closure | F42 |
| **BDI-03.1** | A + B | real derivation equals the committed `{nodes, edges, builtins}` (B); synthetic baseline diffs prove the check fires on an added node (**RP-2**), a removed node/edge (**RP-2b**) and an **edge redirected with the node set unchanged** (**RP-2c**), each naming the offender (A) | F42 + F42N |

> **BDI-02.1 comparison rule** (stated so `sdd-apply` does not invent one): the load-bearing half is
> **dist ⊆ src** — an emitted specifier absent from source means the graph was rewritten. The
> anti-vacuity half is that every `src`-only specifier must be explained by a type-only declaration
> (`isTypeOnly()`, or all named bindings type-only with no default/namespace binding). A value-syntax
> import that tsc erases because its bindings are used only in type position would false-alarm; this
> repo's convention is explicit `import type` (verified for `engine-client.ts`), and BDI-02.2 pins the
> two known cases. If a false alarm appears at build time, the fix is to make the source import
> `import type` — not to weaken the check. Recorded as risk R-5.

### Capability 7 — PMF

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| PMF-01 | C | `npm pack --dry-run` file list contains `dist/runner-manifest.json` | E2E |
| PMF-02.1 | C | extract the tarball, strip the `package/` prefix, recompute all 24 digests against the **extracted** bytes | E2E |
| **PMF-02.2** | C | build → rewrite `package.json#version` → `npm pack --ignore-scripts` → entry #24's digest **MISMATCHES**, naming the field (the behavioural red-proof for BPI-03) | E2E |
| **PMF-02.3** | C | `npm pack` → `npm install ./<tarball>` into a temp project → recompute #24 against `node_modules/@pbuilder/sdk/package.json` → matches (`npm-normalize-package-bin` is a known rewriter and this package HAS a `bin`) | E2E |
| PMF-03 | S | `pkg-surface-baseline.json#tarball` contains `dist/runner-manifest.json`; FIT-14 stays green | F14 |

### Capability 8 — IID

| REQ | Tier | Vehicle | File |
|---|---|---|---|
| **IID-01.1** | S | parse the Constraints list structurally: **five** entries, each with an `enforced-by:` field naming either a FIT id that **exists as a file on disk** (resolved with `existsSync`) or the literal `engine-owned` | DOC |
| IID-01.2 | S | Constraint 2 is stated in its resolved **site-scoped** form (frozen substring); the engine's looser "infrastructure path" wording is asserted **absent** | DOC |
| IID-01.3 | S | Constraints 4 and 5 carry `SDK-added` / `engine-owned` on first use; no `Constraint <n>` citation without its name (regex over the page) | DOC |
| IID-02.1 | S | the scope paragraph's frozen sentences are present; all five excluded trees are named | DOC |
| IID-02.2 | S | the supplied pull-quote sentence appears **exactly once** | DOC |
| IID-03 | S | the justification's three frozen claims (wrong-artefact detection, tripwires independent of the manifest, the install-script adversary) | DOC |
| IID-04 | S | "one manifest per published package, no per-platform map", with the evidence sentence | DOC |
| IID-05 | S | entry #24 justified by `"type": "module"` governing parse mode; `packageRootFor()` asserted **absent** as a justification | DOC |
| IID-06 | S | the `bun link` build-consistency-check sentence | DOC |
| IID-07 | S | the C2 residual is recorded, and noted as closed engine-side | DOC |
| **IID-08** | S | `src/transport/single-instance-probe.ts`'s header contains the frozen pointer sentence naming `fit-42` | DOC |

**Coverage note.** `spec.md`'s header states "REQ-IDs: 58". The body carries **42** capability REQ-IDs and
**65** scenario IDs, plus 9 scenario-less REQs (RCD-00, PMF-01, PMF-03, IID-03..08). Every one of those
74 addressable units appears above; the tables are written at scenario granularity precisely so the
count discrepancy cannot hide an unmapped requirement. **No REQ lacks a viable vehicle — no halt.**

---

## 6. ADRs — exactly 4 (budget 4)

Drafted change-local per the `ts-addimport-collision` precedent; promoted at archive to
`openspec/decisions/0073-0076-*` (0072 is the current maximum).

### ADR-01 — The closure is derived from the **emitted** realm by AST parse; errors name **source**

**Status**: draft (owner rulings R1, R2/J, ambiguity A).
**Context**. The engine verifies digests of emitted bytes, so the manifest's file set must be the emitted
one: a source walk yields **24** because `src/core/engine-client.ts` is `import type`-only and tsc erases
it — an extra entry the engine treats as a closure mismatch, failing closed on 100% of installs. Separately,
`removeComments` is unset, so JSDoc survives into `dist`: `authoring-error.js` quotes
`"@pbuilder/sdk/commons"` inside an `@example` (a false Constraint-3 alarm) and `context.js` quotes
`"./schema.generated.ts"` (a phantom closure node). Both files are in the 23. That is a **verified day-one
failure**, not a hypothesis.
**Decision**. Derive the file set, the graph and every specifier-kind check from `dist/**` by parsing with
**ts-morph** (already an exact-pinned dependency). Report violations against the `src/**` path the reader
must edit, with the line attributed to the emitted realm (§3.6). Treat "23" as a **regenerable baseline**,
not a contract constant.
**Rejected**:
- *Walk `src/**`.* Wrong by construction — 24 vs 23. Not close.
- *Regex scanning.* Fails on day one (above). Comment-stripping is not a repair: `/\/\/.*$/gm` truncates
  any line containing `file://`, and this repo has such lines. Verified: JSDoc-quoted imports are
  **structurally absent** from ts-morph's `getImportDeclarations()`, so parsing needs no stripping at all.
- *Reuse `test/support/import-scan.ts`.* Regex-based, source-realm, and `catch { continue }` on unreadable
  files — the precise silent-skip RCD-03.2 forbids.
- *Hard-code 23.* Makes a legitimate closure change a cross-repo breaking event; the engine confirmed their
  mirror does not hard-code it either.
**Consequences**. ts-morph gains a build-time, unshipped importer outside `src/dialects/*/ast.ts` (§1.4).
`sdd-apply` must use `SyntaxKind` for the dynamic-import filter — a raw kind number does not work.

### ADR-02 — The generator lives in `scripts/` and is chained **last** into `build`; one module, three consumers

**Status**: draft.
**Context**. The artefact must be regenerated by the same command that produces the bytes it describes —
a separate command is eventually forgotten, and a stale manifest is indistinguishable from tampering. The
module must also be importable by fitness tests, and by a maintainer-run baseline regenerator.
**Decision**. `scripts/derive-runner-closure.ts` (pure, root-parameterised) + `scripts/generate-runner-manifest.ts`
(the build authority), with `build:manifest` chained **last** in `scripts.build`. `fit-42` imports the shared
module; a third consumer, `scripts/regen-closure-baseline.ts`, is the sole writer of the committed baseline
and is deliberately **not** part of `build`.
**Rejected**:
- *`src/`.* `tsconfig.build.json`'s `rootDir: "./src"` would compile it into `dist/` and ship it in the tarball.
- *`bin/`.* That directory means "shipped CLI with a `#bin` mapping" (`pbuilder-codegen`'s precedent).
- *`test/support/`.* Inverts the dependency direction — the production build would depend on a tree
  `tsconfig.build.json` excludes.
- *A separate `bun run manifest` step.* The engine's contract explicitly rejects it; forgettable by design.
- *Chaining it before `build:codegen`.* A later failing step would leave a valid-looking manifest on a
  broken tree until the next `prebuild`.
- *Letting the build also regenerate the baseline.* It would make BDI-03 self-healing — the tripwire could
  never fire. Same reasoning as FIT-27's no-in-test-update-path guard.
**Consequences**. First `scripts/` file wired into `build` (a convention sharpened, recorded in the
architecture baseline) and the first `test/ → scripts/` import edge; `fit-42`'s header states why FIT-27's
rule does not extend to it.

### ADR-03 — Constraint 1 ships **structural**, not by loader observation and never by naming a tool

**Status**: draft (owner ruling R4).
**Context**. "No bundler with code-splitting" is the lemma's first precondition, and a bundler **already
runs in this build** (`build:codegen` writes `dist/bin/pbuilder-codegen.js`, legitimately, into the runner's
own directory). Any all-of-`dist` 1:1 check fails on it immediately. The realistic drift is not "someone
adopts a bundler" but "someone points the bundler already here at the runner for startup performance".
**Decision**. Three closure-scoped structural checks in `fit-42`: (a) **graph-preserving emit** — per-file
relative-specifier multiset equality modulo type-only erasure; (b) a committed **closure-graph baseline**
carrying `{nodes, edges, builtins}` so a redirected edge with an unchanged node set still fails; (c)
**bundler-output disjointness** — every `--outfile`/`--outdir`/`-o` target in `package.json#scripts` is
outside the closure path set, non-vacuous today.
**Rejected**:
- *Loader observation under Bun.* Now feasible (the engine confirmed Bun definitively) but ruled a
  **followup**: it would gate this change on runtime instrumentation research while the structural shape
  already breaks CI. Hard rule from the proposal: structural ships, not revisited this cycle.
- *"No bundler in `devDependencies`".* Names a tool; survives no tool swap; vacuous the day `bun build`
  (already present) is aimed at the runner.
- *An all-of-`dist` 1:1 source-correspondence check.* Fails on the legitimate codegen bundle.
- *Asserting `src → dist` too.* Would fail on `dist/core/engine-client.js`, which legitimately exists
  outside the closure (BDI-02.3).
**Consequences**. Constraint 1 is a **CI-time**, not build-time, guarantee (§1.1) — a bundler-rewritten
graph still produces a manifest; only `bun test` sees it. Stated as a limit in the docs page.

### ADR-04 — Constraint 4 is an **outright ban** on `createRequire` in the closure, exempted by anchor

**Status**: draft (owner ruling R3; engine adopted the precondition into their own mirror).
**Context**. The lemma is sound about import *edges* and was being used as a claim about executed *code*.
`createRequire(anchor)("./x")` executes unhashed CommonJS with **no import edge anywhere**, and
`createRequire` is **already imported by the closure** (`src/transport/single-instance-probe.ts`), where only
the discipline of calling `.resolve()` keeps it resolution-only — argued at length in that file's header,
i.e. exactly the folklore this exercise exists to retire.
**Decision**. Any `createRequire` **reference** in a closure file is a violation, with a single site exempted
by the same anchor idiom CST-03 uses for the sanctioned dynamic import. The same scan covers `eval`,
`new Function`, `node:vm`, `Bun.plugin` and `process.binding`. `single-instance-probe.ts`'s **logic is not
touched**; it gains one header sentence pointing at the enforced Constraint.
**Rejected**:
- *Discriminate the call form from `.resolve()`.* Defeated by one variable
  (`const req = createRequire(u); req("./x")`) and by the namespace form
  (`import * as m from "node:module"; m.createRequire(u)(…)`) — QA escape 17. A check that passes the direct
  red-proof while letting the real thing through is worse than none. An identifier scan is **verified** to
  find all four forms and to exclude the JSDoc one.
- *Refactor the probe to remove `createRequire`.* ADR-0057 records that it is the **sole** workable
  mechanism in this Bun version, and any such refactor would break the zero-`src`-diff posture that keeps
  this change `additive`.
**Consequences**. The exemption is an anchored *site*, so a second `createRequire` inside the probe file
still fails. The ban is broader than the engine's original wording, and the docs page marks Constraint 4
**SDK-added** so cross-repo numbering cannot silently diverge.

---

## 7. Fitness Functions

| Fitness | File | Enforces | Fails when |
|---|---|---|---|
| **FIT-42 — runner closure integrity** | `test/fitness/fit-42-runner-closure-integrity.test.ts` | RCD (real tree), RME, RMD, BPI-02/04, CST-03.3/04.3/05.1, BDI-01/02/03 | the closure's nodes/edges/builtins drift from the committed baseline; the manifest's shape, ordering, serialisation, digests or determinism regress; a closure file gains CRLF or a BOM; the emitted graph stops matching source; a bundler target lands inside the closure; the generator stops being fail-closed or atomic |
| **FIT-42 negative** | `…negative.test.ts` | all 18 red-proofs + RCD-01.2 | any tripwire or comparator **stops firing** — the file exists because a check exercised only against a well-formed tree can never prove it can fail |
| **FIT-23 extension** | `fit-23-publish-workflow-guard.test.ts` | BPI-03.1 | `publish.yml` stamps the version after the build **without** a rebuild between stamp and publish — i.e. the instant `--ignore-scripts`, `bun publish` or `bun pm pack` enters the workflow |
| **FIT-14 + baseline** | `fit-14-package-surface.test.ts`, `pkg-surface-baseline.json` | PMF-03 | the manifest leaves the published surface, or any *other* file silently enters it |
| **Build-config guards** | `test/build/build-config.test.ts` | BPI-01.1/01.2, RMD-03.1/03.3 | the manifest step leaves `build`, stops being last, or `newLine: "lf"` / `.gitattributes`' LF normalisation is removed |
| **Docs guard** | `test/docs/runner-integrity-docs.test.ts` | IID-01..08, BDI-01.2 | a Constraint loses its `enforced-by:` or names a FIT id with no file on disk; Constraint 2 reverts to the engine's unresolved wording; the scope/justification/`bun link`/entry-#24 sentences are reworded; the probe header's pointer sentence is deleted |

**Deliberately not a fitness function**: Constraint 5 (engine-owned) and loader observation for
Constraint 1 (followup). Both are recorded with `enforced-by: engine-owned` / an explicit limit sentence,
so the docs page cannot claim enforcement this repo does not have.

---

## 8. `architecture_impact`: `additive`

| Baseline element | Effect |
|---|---|
| Layers | none added. `scripts/` (maintainer/CI tooling) gains two members and one maintainer command. |
| Dependency direction | preserved. New edges are `scripts → ts-morph` (build-time, unshipped) and `test → scripts` (the correct direction; the inverse would make the build depend on `test/`). No `src/**` edge changes. |
| `src/**` | **zero behaviour diff.** One comment sentence in `src/transport/single-instance-probe.ts` (IID-08). No `.d.ts` change, so FIT-04's baselines are untouched. |
| Public API | **one addition**: `dist/runner-manifest.json`, a versioned (`manifestVersion: 1`) **external contract** consumed cross-repo. `files: ["dist"]` already covers it; `pkg-surface-baseline.json` records the growth deliberately. Belongs in the baseline's *Public API* section alongside `docs/engine-sdk-wire-spec.md`. |
| Conventions | one **sharpened**: `scripts/` may now be wired into `build` — previously all `scripts/` files were manual/CI-only. Recorded, with the counter-rule that a `scripts/` file which **writes committed test fixtures** must stay out of `build`. |
| Invariants | "ts-morph stays leaf-isolated" gains a documented **unshipped build-time** exception (§1.4). FIT-37/FIT-38 are `src/`-scoped and need no change — verified, not assumed. |

It would escalate to `modifying` only if the design had to touch `src/transport/**` to neutralise the
`createRequire` primitive. ADR-04 makes that unnecessary: the fourth precondition is a scan, not a refactor.

---

## 9. Frozen strings (source of truth)

The docs page, `SECURITY.md`, the module headers and the guard tests **copy from here**. Freeze 1–3
sentences per REQ, never whole passages. Where a string below differs from review-tech-writer §5, the
divergence is §3.6's realm attribution and is deliberate; every asserted substring there is preserved.

**`BUILD_IDENTITY_LINES`** (BPI-04.1) — stdout, exactly two lines:
```
runner-manifest: 24 files -> dist/runner-manifest.json
runner-manifest-sha256: <64 lowercase hex>
```

**`VIOLATION_SKELETON`** (CST-06.1) — every build-time violation renders as:
```
runner-manifest: <src path> — <one-line summary>.
  found: <construct>     (emitted: <dist path>:<line>)
  rule:  Constraint <n> — <rule statement>
  why:   <why the rule exists>
  fix:   <what to do instead>
No manifest was written; dist/runner-manifest.json does not exist.
```
Asserted substrings per rule: `runner-manifest:`, the `src` path, `Constraint 3` / `Constraint 3a` /
`Constraint 2` / `Constraint 4`, and the final `No manifest was written` line. Offenders beyond
`maxShown` collapse to `… and N more`. Full per-rule bodies: review-tech-writer §5, adopted verbatim
except for the `found:`/`(emitted: …:<line>)` placement.

**`CST02_ALLOWLIST_CLAUSE`** (CST-02.1) — must appear in the unprefixed-builtin message:
> The check is on the PREFIX, not on a list of builtin names — adding "fs" to an allowlist is not the fix.

**`CST03_PER_SITE_CLAUSE`** (CST-03.2):
> Constraint 2 — the sanction is per-SITE, not per-file. Living in runner.ts does not make an import() sanctioned.

**`BASELINE_DRIFT_MESSAGE`** (BDI-03.1) — the message maintainers meet most often; permissive register:
```
fit-42: the runner closure changed.
  <N> files are reachable from dist/bin/pbuilder-runner.js; the committed baseline has <M>.
  added node:  <path>
  added edge:  <from> -> <specifier>   (<src path>)
  removed:     <path or (none)>

This is not automatically wrong — the closure is allowed to grow. It is wrong if you did not
mean to change it. If you did mean it:
  1. check the new file against the constraints in docs/runner-integrity-invariants.md,
  2. regenerate: bun run build && bun run regen:closure-baseline,
  3. commit test/fitness/runner-closure-graph-baseline.json in the SAME commit, and say in
     the commit message why the closure grew — the engine verifies whatever we publish.
```

**`SCOPE_PULL_QUOTE`** (IID-02.2) — the one supplied paraphrase, must appear exactly once:
> the manifest covers the runner's pre-factory bootstrap — 23 closure files plus `package.json` — and nothing that loads after it.

**`SCOPE_PARAGRAPH`** (IID-02.1) — adopted verbatim from review-tech-writer §2 under the heading
`## What the manifest covers — and what it does not`. Frozen sentences: the "24 files … pre-factory
bootstrap, and nothing beyond it" opening, the excluded-trees sentence (which **must** name
`dist/commons/**`, `dist/dialects/**`, `dist/conformance/**`, `dist/testing/**`, `node_modules/**`),
and the "A manifest that verifies therefore means one specific thing" sentence.

**`JUSTIFICATION_SECTION`** (IID-03) — adopted verbatim from review-tech-writer §3 under `## Why this
exists`, with its three numbered values. Frozen: the "not ceremony … earns its place three ways"
sentence, the `wrong-artefact detection` label, "They are enforced by `fit-42`; they do not depend on
the manifest existing.", and the install-script-adversary sentence. **Build-time check**: the engine has
RETRACTED the premise the opening argues against (their round-2 reply, §4 — the CLI proved a schematic
author *can* write to the installed SDK tree; they now deny `SDKRoot`-subtree writes at ingestion). The
paragraph's conclusion survives; the first sentence must be phrased so it does not contradict their
updated threat-model ADR.

**`LIMIT_CONSTRAINT_1`** (BDI-01.2 + §1.1) — the honest limit:
> Constraint 1 is enforced in CI, not by the build: a bundler that rewrote the module graph would still
> produce a derivable closure, so the generator has nothing to fail on. `fit-42` compares against the
> committed closure-graph baseline instead. Bundler invocations outside `package.json#scripts` — workflow
> steps, `Bun.build({ outdir })`, calls from `scripts/*.ts` — are out of scope for the disjointness check.

**`LINK_DEGRADES`** (IID-06):
> On a `bun link` install the manifest is fully self-asserted — the same build produced both the bytes and
> the digests — so verification degrades to a build-consistency check: a wrong-artefact detector and
> nothing more.

**`ENTRY_24_REASON`** (IID-05):
> `package.json` is entry #24 because its `"type": "module"` field governs the parse mode of all 23 closure
> files: flipping it to `"commonjs"` reinterprets every hashed byte without editing one. It is **not**
> included because of `packageRootFor()` — hashing content cannot constrain a topology walk.

**`C2_RESIDUAL`** (IID-07):
> A planted `dist/package.json` terminates `packageRootFor()`'s upward walk early and reinterprets parse
> mode with **zero digest change**: a manifest is an inclusion list and cannot express absence. The engine
> closed this on their side with a rule that no `package.json` may exist strictly between the runner entry
> and the package root; `fit-42` stops the SDK being the source of the file.

**`PORTABILITY_ANSWER`** (IID-04):
> One manifest per published package, no per-platform map. The build is plain `tsc`, 1:1 file-per-source,
> with no platform conditionals, no env branching and no conditional subpath resolution inside the closure.

**`SECURITY_SUBSECTION`** (IID scope, `SECURITY.md`) — adopted verbatim from review-tech-writer §1 under
`## Runner integrity manifest` (three sentences + the docs link).

**`PROBE_HEADER_SENTENCE`** (IID-08) — added to `src/transport/single-instance-probe.ts`'s header, the
only `src/` change in this design:
> Constraint 4 (docs/runner-integrity-invariants.md) makes this ENFORCED, not conventional: any
> `createRequire` reference outside this anchored site fails the build (fit-42).

**`DERIVE_HEADER_REALM`** (§1.5) — first line of `scripts/derive-runner-closure.ts`'s header:
> Walks the EMITTED dist/**.js graph — never src/**.ts (a source walk yields 24: engine-client.ts is
> import-type-only and tsc erases it). The source-realm walker is test/support/import-scan.ts
> (FIT-15/FIT-21); they are not interchangeable.

**`FIT42_HEADER_SCRIPTS_IMPORT`** — in `fit-42`'s header:
> This file imports `scripts/derive-runner-closure.ts` deliberately: the build and the fitness test must
> share ONE walk. FIT-27's non-reachability rule names `scripts/regen-corpus.ts` specifically and is
> corpus-scoped; it does not extend here.

**`GENERATOR_HEADER_PATH`** — in `scripts/generate-runner-manifest.ts`'s header:
> The package root is resolved with `fileURLToPath`, NOT `new URL(...).pathname` (this repo's test-helper
> idiom): `.pathname` does not percent-decode, so it breaks on a build path containing a space —
> REQ-RMD-02.1 plants exactly that.

---

## 10. Risks, Open Questions, Recommendations

### Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-1 | **False tamper alarm** = 100% of a release's users fail closed with no workaround (patching changes digests). | **High** | Permissive bias throughout: `newLine: "lf"` + `.gitattributes`, byte-wise sort, pinned serialisation, determinism proven across locales and build paths, digests verified against **extracted tarball** and **installed** bytes. |
| R-2 | **Tier C needs the network** — `npm install ./<tarball>` resolves the real `ts-morph` dependency. The existing installed-consumer e2e already carries this posture (~25% CI flakiness on pack-based harnesses). | Medium | Reuse the memoized-fixture idiom; `--ignore-scripts`; **fail loudly** rather than skip on a missing registry — a silent skip false-passes the one scenario that covers the production install path. Do NOT weaken the assertion to make it green. |
| R-3 | **FIT-14's independent build vs `ensureTscBuild()`** — FIT-14 runs its own unconditional `bun run build`, whose `prebuild: rm -rf dist` deletes a tree other files hold paths into. This change multiplies the exposure. | Medium | See recommendation below — routed in this change. |
| R-4 | **Suite cost.** Tier B adds several `cp -R` copies + generator subprocesses; Tier C adds a pack+install. | Medium | One memoized `ensureTscBuild()` for all Tier B; each mutating case gets its own `scratchDirFactory()` root with `afterEach` teardown; Tier A (milliseconds) carries the 18 red-proofs. |
| R-5 | **BDI-02.1 false alarm** if tsc erases a value-syntax import used only in type position. | Low | Rule stated in §5; the repo's convention is explicit `import type`; the fix is to make the source import type-only, never to weaken the check. |
| R-6 | **Closure drift** between the engine-verified `6e4aab7` and this branch's base. | Low | The committed `{nodes, edges, builtins}` baseline converts a one-off check into a permanent test; RCD-02.2 pins 23. |
| R-7 | **Constraint 1 is CI-only** (§1.1) — a bundler-rewritten graph still yields a manifest. | Low (documented) | `LIMIT_CONSTRAINT_1` states it; loader observation is the registered followup. |
| R-8 | **Alarm fatigue** — version skew would look identical to tampering. | Closed | `packageVersion` (RME-07.1); the engine reports version-mismatch distinctly from integrity-mismatch. |
| R-9 | `bun run build` now imports ts-morph, so a broken/absent `node_modules` fails the build later than before. | Low | ts-morph is an exact-pinned production dependency with a committed lockfile; CI installs `--frozen-lockfile`. |

### Open questions (none blocking)

1. **RCD-03.1's example constructs are unrealizable** in the emitted-ESM realm (§3.1 note). Resolved in
   design by enumerating the realizable unclassifiable forms; recorded so a future reader does not "fix"
   the fixture back to an unrepresentable construct. **No spec defect, no halt.**
2. **Baseline carries three keys** `{nodes, edges, builtins}` — signed RCD-04.1 over review-tech-writer's
   `{nodes, edges}` shorthand (§3.4). Answers review-qa open Q2.
3. **Two packers coexist deliberately** (review-qa open Q1): `npm pack` is normative for PMF (it is what
   `publish.yml` uses); FIT-14 keeps `bun pm pack` for its own listing. Confirmed intentional and recorded
   here so a future reader does not "unify" them and prove the wrong thing.
4. **Message prefix** (review-tech-writer open Q1): `runner-manifest:` for build-time failures,
   `fit-42:` for the baseline-drift test failure. Both frozen in §9. Confirmed.
5. **Frozen-string home** (review-tech-writer open Q4): **§9 of this document**. Confirmed.
6. **`SECURITY.md` subsection** (review-tech-writer open Q3): yes — file #17.
7. **Spec header says 58 REQ-IDs**; the body carries 42 REQs / 65 scenarios / 9 scenario-less REQs. All 74
   are mapped (§5). Worth reconciling the header at the next unfreeze; not a defect.

### Recommendation on review-qa open Q3 (FIT-14's independent build)

**Route FIT-14's `beforeAll` through `ensureTscBuild()` in THIS change** (file #12). Reasons: the two
builds are the same command with identical inputs, so the memoized fixture is a drop-in; this change adds
five-plus new tests that read `dist/`, which is precisely the exposure QA flagged; and the failure mode
(a memoized tree deleted mid-suite by another file's `rm -rf`) is intermittent and gets blamed on the
wrong test. It is a three-line edit to a fitness test with zero production surface — cheaper here than as
a followup that will be reopened by the first flake. **If the slice plan disagrees**, the fallback is a
registered followup plus an explicit rule that no test may cache anything about `dist/` across files —
but that rule is unenforceable, which is why the routing is preferred.
