# Apply Progress — runner-integrity-manifest

**Scope**: `slice:S-000` (walking skeleton) · **Mode**: Strict TDD (double-loop) · **Triage**: L
**Branch**: `feat/runner-integrity-manifest` · **Base**: `66bc7cf`
**Suite after S-000**: `bun test` → **2191 pass / 0 fail** across 194 files · `tsc --noEmit` clean.

---

## Files changed

| File | Action | What was done |
|---|---|---|
| `scripts/derive-runner-closure.ts` | created | The one walk. ts-morph AST derivation (nodes/edges/builtins), a TOTAL specifier classifier, the Constraint-2/4 deny-scan, `comparePaths`, `serialiseManifest`, `sha256File`, `renderViolations`, and the two anchor constants. Violations are DATA — the module never throws for a violation. |
| `scripts/generate-runner-manifest.ts` | created | Build authority. derive → render+unlink+exit≠0 on any violation → hash all 24 → one `writeFileSync` → two identity lines on stdout. Package root via `fileURLToPath`, never `.pathname`. |
| `package.json` | modified | `build:manifest` script; chained LAST into `scripts.build`. |
| `tsconfig.build.json` | modified | `"newLine": "lf"`. |
| `test/fitness/fit-42-runner-closure-integrity.test.ts` | created (thin) | Tier B, 14 tests in two `describe` blocks reserved for S-000. |
| `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` | created (thin) | Tier A, 26 tests in five `describe` blocks reserved for S-000. |
| `test/build/build-config.test.ts` | modified | BPI-01.1 (×2), BPI-01.2, RMD-03.1 in one new `describe`. |
| `test/fitness/pkg-surface-baseline.json` | modified | `dist/runner-manifest.json` added to `tarball` (sorted position). |
| `test/fitness/fit-14-package-surface.test.ts` | modified | `beforeAll` routed through `ensureTscBuild()` (design R-3 / QA Isolation §3); PMF-03 assertion added. |
| `openspec/changes/runner-integrity-manifest/slices.md` | modified | S-000 marked built; its 10 criteria checked. |

`src/**`: **zero diff** — as the design requires.

## TDD Cycle Evidence — S-000

Outer loop (double-loop): `fit-42 … "the build emits dist/runner-manifest.json"`, written and run RED
before any implementation existed, held red through every inner cycle below, green only once the
generator was wired into `build`.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| **Outer loop** | `fit-42…test.ts::REQ-BPI-01.1 \`bun run build\` leaves dist/runner-manifest.json on disk` | B | `expect(received).toBe(expected) / Expected: true / Received: false` | after generator + `build:manifest` wiring | n/a (existence) | no |
| comparePaths | `…negative.test.ts::REQ-RME-05.2 orders dist/Z.js before dist/a.js` | A | `error: not implemented at comparePaths (…:7:36)` | `a < b ? -1 : a > b ? 1 : 0` | **yes** — astral-path test failed the naive comparator (`["dist/𐀀.js","dist/�.js"]` received vs `["dist/�.js","dist/𐀀.js"]` expected), forcing `Buffer.compare` | no |
| comparePaths (2nd pinned pair) | `…negative.test.ts::REQ-RME-05.2 orders dist/a-b.js before dist/aB.js` | A | (added with the triangulation run; passes under `Buffer.compare`) | same impl | spec-pinned coverage, not the discriminator | no |
| Closure walk | `…negative.test.ts::REQ-RCD-01.2 derives exactly the four transitively reachable files` | A | `error: not implemented at deriveRunnerClosure (…:42:36)` | BFS over `./`-prefixed specifiers | **yes** — nested `../` test received `["bin/entry.js"]` vs expected 3 nodes, forcing importer-dir-relative resolution | no |
| Anti-tautology | `…negative.test.ts::REQ-RCD-01.2 leaves the present-but-unimported d.js out of the closure` | A | `error: not implemented at deriveRunnerClosure` | same walk | n/a (the D-absent half of RCD-01.2) | no |
| Edges | `…negative.test.ts::REQ-BDI-03.1 reports every followed import as an edge…` | A | `expect(received).toEqual(expected)` — received `[]`, expected 2 edge objects | edge record + `(from,to,specifier)` sort | n/a (accumulator) | no |
| Builtins | `…negative.test.ts::REQ-RCD-04.1 records \`node:\`-prefixed specifiers as builtins` | A | `expect(received).toEqual(expected)` — received `[]`, expected `["node:fs","node:path"]` | `node:` branch → `builtins` set | n/a | no |
| Builtins not followed | `…negative.test.ts::REQ-RCD-04.1 excludes builtins from the closure without failing` | A | **green on arrival** — regression guard for the branch above, not its driver (disclosed) | — | — | no |
| Classifier: bare | `…negative.test.ts::REQ-CST-01.1 a bare third-party specifier is a Constraint-3 violation` | A | `expect(received).toEqual(expected)` — received `[]`, expected `[{rule:"constraint-3-bare-specifier",…}]` | total `classifySpecifier` | class covered by the 6 sibling rules below | no |
| Classifier: unprefixed builtin | `…negative.test.ts::REQ-CST-02.1 a builtin written without the \`node:\` prefix…` | A | received `[]` vs `[{rule:"constraint-3a-unprefixed-builtin"}]` | `builtinModules` membership phrases the message, never permits | **yes** — discriminates the bare rule | no |
| Classifier: URL scheme | `…negative.test.ts::REQ-RCD-03.1 a URL-scheme specifier is an unclassifiable construct` | A | received `[]` vs `[{rule:"unclassifiable-construct"}]` | scheme/absolute branch | **yes** | no |
| Classifier: query suffix | `…negative.test.ts::REQ-RCD-03.4 a relative specifier carrying a query suffix fails…` | A | received `[]` vs `[{rule:"unclassifiable-construct"}]` | `[?#]` guard before resolution | **yes** — same rule, different path through the classifier | no |
| Classifier: unresolvable | `…negative.test.ts::REQ-RCD-03.2 a relative specifier resolving nowhere fails…` | A | received `[]` vs `[{rule:"unresolvable-specifier"}]` | `existsSync` guard, never `catch { continue }` | **yes** | no |
| Classifier: symlink escape | `…negative.test.ts::REQ-RCD-05.1 a specifier resolving through a symlink out of the root…` | A | received `[]` vs `[{rule:"symlink-escape"}]` | `realpathSync` + `isInside` | **yes** | no |
| Classifier: unreadable | `…negative.test.ts::REQ-RCD-03.5 an unreadable closure file fails the derivation…` | A | received `[]` vs `[{rule:"unreadable-file",file:"locked.js"}]` | try/catch around the read → violation, `it.skipIf(uid 0)` | **yes** — file-level rather than specifier-level | no |
| Deny-scan: dynamic import | `…negative.test.ts::REQ-CST-03.1 a dynamic import() outside the sanctioned file…` | A | received `[]` vs `[{rule:"constraint-2-dynamic-import"}]` | `SyntaxKind.CallExpression` + `ImportKeyword` filter (the enum, never a raw kind number) | **yes** — second-site case below | no |
| Deny-scan: second site | `…negative.test.ts::REQ-CST-03.2 a second dynamic import() inside the sanctioned file…` | A | received `[]` vs `[{rule:"constraint-2-second-site"}]` | first-ordinal exemption at the anchor file | **yes** | no |
| Deny-scan: sanctioned site | `…negative.test.ts::REQ-CST-03.3 the single dynamic import() at the sanctioned site is not a violation` | A | **green on arrival** — exemption guard, disclosed | — | — | no |
| Deny-scan: createRequire | `…negative.test.ts::REQ-CST-04.1 a createRequire call outside the anchored site…` | A | received `[]` vs two `constraint-4-execution-primitive` records | identifier scan | **yes** — indirect + namespace below | no |
| Deny-scan: indirect form | `…negative.test.ts::REQ-CST-04.4 the indirect-variable form is caught…` | A | received `[]` vs `[{rule:"constraint-4-execution-primitive"}]` | same identifier scan (this is what makes the ban decidable) | **yes** | no |
| Deny-scan: namespace form | `…negative.test.ts::REQ-CST-04.4 the namespace form is caught` | A | received `[]` vs `[{rule:"constraint-4-execution-primitive"}]` | same | **yes** | no |
| Deny-scan: anchor exemption | `…negative.test.ts::REQ-CST-04.3 the anchored site's import binding and single…use are exempt` | A | **green on arrival** — exemption guard, disclosed | — | — | no |
| Deny-scan: anchor is per-site | `…negative.test.ts::REQ-CST-04.1 a second createRequire use inside the anchored file still fails` | A | received `[]` vs `[{rule:"constraint-4-execution-primitive"}]` | import-binding skip + first-use exemption, everything after fails | **yes** | no |
| Deny-scan: primitive set | `…negative.test.ts::REQ-CST-04.2 the closed primitive set … is denied` | A | received `[]` vs five `constraint-4-execution-primitive` records | identifier set + member-expression set + the `node:vm` specifier branch | **yes** — 5 distinct inputs | no |
| renderViolations | `…negative.test.ts::REQ-CST-06.1 a rendered violation names the src file…` | A | `error: not implemented at renderViolations (…:268:36)` | frozen §9 skeleton + per-rule bodies | n/a (one rule proven; S-003 owns the matrix) | comment corrected to state the two pinned §9 divergences |
| Manifest shape | `fit-42…test.ts::REQ-RME-01.1 ×3, REQ-RME-07.1` | B | whole file red at `beforeAll`: `ENOENT … dist/runner-manifest.json` | generator writes the manifest | n/a | no |
| Serialisation | `fit-42…test.ts::REQ-RME-06.1 raw bytes round-trip…` | B | same ENOENT | `JSON.stringify(m, null, 2) + "\n"` | n/a (identity assertion) | no |
| Digests | `fit-42…test.ts::REQ-RME-02.1 every digest recomputes…` | B | same ENOENT | `sha256File` over raw bytes; test uses `scratch-consumer#hashFile`, NOT the generator's hasher | n/a | no |
| Identity lines | `fit-42…test.ts::REQ-BPI-04.1 the generator prints exactly the two pinned identity lines` | B | same ENOENT | two `process.stdout.write`s, second hashing the written file | n/a | no |
| Real-tree derivation | `fit-42…test.ts::REQ-RCD-02.2 / RCD-03.3 ×3 / RCD-02.1 ×2` | B | same ENOENT | derivation runs against the real 23-file closure | n/a | no |
| Build wiring | `build-config.test.ts::REQ-BPI-01.1 ×2, REQ-BPI-01.2` | S | **green on arrival** — the wiring was already forced by the outer loop's RED; these are the permanent structural guards (disclosed) | — | — | no |
| LF pin | `build-config.test.ts::REQ-RMD-03.1 tsconfig.build.json pins tsc's emitted line terminator to LF` | S | `expect(received).toBe(expected) / Expected: "lf" / Received: undefined` | `"newLine": "lf"` | n/a | no |
| FIT-14 baseline | `fit-14…test.ts::REQ-PMF-03 the runner manifest is a deliberately baselined member…` | S | `expect(received).toContain(expected) / Expected to contain: "dist/runner-manifest.json"` | baseline `tarball` entry added | n/a | `beforeAll` routed through `ensureTscBuild()` while green |

**Honesty note on the four green-on-arrival rows**: they are regression guards for behaviour driven
by an adjacent RED test in the same cycle (the exemption halves of the two anchors, the
builtins-not-followed half, and the build wiring the outer loop already forced). They are marked as
guards, not drivers, rather than presented as TDD cycles they were not.

## Acceptance criteria — S-000 (all 10)

| # | Criterion | Verified how | Result |
|---|---|---|---|
| 1 | Build succeeds, exactly two identity lines | `bun run build` observed printing `runner-manifest: 24 files -> dist/runner-manifest.json` + `runner-manifest-sha256: 1d5cc95e…`; pinned by `fit-42::REQ-BPI-04.1` (asserts nothing follows the second line) | PASS |
| 2 | Manifest exists, shape, 24 records, entry, packageVersion | `fit-42::REQ-BPI-01.1`, `REQ-RME-01.1` ×3, `REQ-RME-07.1` | PASS |
| 3 | The two JSDoc-quoting files: ordinary records, no violations | `fit-42::REQ-RCD-03.3` ×3 — zero violations on the real tree, both paths present in `files`, and no `core/schema.generated.js` phantom node | PASS |
| 4 | `dist/core/engine-client.js` absent from closure and `files` | `fit-42::REQ-RCD-02.1` ×2 — asserts the file EXISTS on disk and is absent from both, so it cannot pass vacuously | PASS |
| 5 | Anti-tautology synthetic tree | `fit-42N::REQ-RCD-01.2` ×2 — exact set + D absent by name | PASS |
| 6 | Independent SHA-256 recompute | `fit-42::REQ-RME-02.1` using `test/support/scratch-consumer.ts#hashFile` | PASS |
| 7 | Serialisation round-trip identity | `fit-42::REQ-RME-06.1` | PASS |
| 8 | `comparePaths` on both discriminating pairs | `fit-42N::REQ-RME-05.2` ×2 (+ an astral-path case that killed the naive comparator) | PASS |
| 9 | Baseline carries the manifest; FIT-14 green | `fit-14::REQ-PMF-03`; the whole FIT-14 file 19/19 green. The red window was OBSERVED first (`newEntries` = `["dist/runner-manifest.json"]`) and then closed in this slice | PASS |
| 10 | `build:manifest` is the last `&&`-segment | `build-config::REQ-BPI-01.2` (plus BPI-01.1's "exactly one script invokes the generator") | PASS |

## Deviations from design

1. **`DIST_DIR_NAME` constant instead of `relative(packageRoot, distRoot)`** (design §3.2). `distRoot`
   is always `join(packageRoot, "dist")`, so the `relative()` call provably returns the literal
   `"dist"` — pass-through indirection with no behaviour. Same observable output, one import fewer.
2. **`readSpecifiers` not implemented in this slice.** Design §3.1 lists it; its only consumer is
   BDI-02.1, which lands in **S-003**. Writing it now would be implementation ahead of its driving
   test. The internal `staticSpecifierSites` is the seam it will wrap.
3. **The Constraint-4 anchor is defined as `import binding + FIRST use` in
   `transport/single-instance-probe.js`.** Spec CST-04.1 and ADR-04 say "single anchored site" and "a
   second `createRequire` inside the probe file still fails" without pinning the counting rule. The
   real probe carries exactly two identifier references (the named import + one `.resolve` call), so
   this reading is the one that both keeps today's build green and makes a second *use* fail. Recorded
   because S-003's CST-04 matrix depends on it.
4. **`SANCTIONED-FACTORY-IMPORT` marker not yet present** in `src/transport/runner.ts`. The classifier
   anchors on file + ordinal (which is exactly what CST-03.3 states the invariant is); the marker is a
   separate assertion CST-03.3 makes about the SOURCE, and adding it is a `src/` comment edit that
   belongs with S-003/S-005's `src/` touch, not here. **S-003 must add it** or its real-tree marker
   assertion fails.
5. **The `sanctioned site:` line** from review-tech-writer §5's CST-03.2 draft is folded into the
   `why:` field rather than rendered as its own line, since design §9's `VIOLATION_SKELETON` has four
   fields. The frozen `CST03_PER_SITE_CLAUSE` is reproduced verbatim in `rule:`. Forward note for
   S-003: if its assertion wants a standalone `sanctioned site:` line, that is a `RuleBody` field.

## Post-slice audit (vs `openspec/architecture.md` + ADRs)

Clean — no Bug- or Architecture-severity finding.

- **Layers**: no new layer. `scripts/` (existing maintainer/CI tooling, alongside `regen-corpus.ts`
  and `conformance-pr-gate.ts`) gains two members. Matches design §8.
- **Dependency direction**: new edges are `scripts/ → ts-morph` (build-time, unshipped) and
  `test/fitness/fit-42* → scripts/`. The inverse (`scripts/ → test/`) was avoided. FIT-27's
  non-reachability rule walks from `test/e2e/` + `test/support/` only and names `regen-corpus.ts`
  specifically — **verified by reading the file**, not assumed.
- **ts-morph leaf isolation**: FIT-01/FIT-37 walk `src/**` and FIT-38's `SRC_DIR` is
  `<repo>/src` — **verified by reading `fit-38`**, so `scripts/` is outside all three by
  construction; full suite green confirms. The baseline's "reachable ONLY from `src/dialects/**`"
  narrative now needs the documented unshipped build-time exception (design §1.4/§8).
- **`src/**`**: zero diff. `architecture_impact: additive` holds.
- **Public API**: `dist/runner-manifest.json` enters the tarball, recorded deliberately in
  `pkg-surface-baseline.json`. `exports`, `bin` and `files` untouched.
- **Sensitive areas**: `src/transport/**` (HIGH) untouched.
- **Baseline-refresh obligations** (for `arch_refresh_post_verify`, not defects): the build is now
  THREE steps, not two; `scripts/` may now be wired into `build` (ADR-02's sharpened convention, with
  the counter-rule that a `scripts/` file writing committed fixtures stays out — honoured, since
  S-001's `regen-closure-baseline.ts` is deliberately outside `build`); ts-morph gains a third,
  unshipped importer.

## Open issues / notes for later slices

- **S-001** must keep `regen:closure-baseline` out of `scripts.build` — `build-config`'s BPI-01.1
  assertion ("exactly one script invokes the generator") is scoped to `generate-runner-manifest`, so
  it will not catch that by itself.
- **S-003** must add the `SANCTIONED-FACTORY-IMPORT` marker to `src/transport/runner.ts` (deviation 4).
- The two fit-42 files are partitioned into `describe` blocks whose names begin `FIT-42 S-000 —` /
  `FIT-42N S-000 —`, per slices.md risk #1, so S-002/S-003 append their own blocks without touching
  these.

---

# S-001 — Baseline writer + committed closure-graph baseline

**Scope**: `slice:S-001` · **Mode**: Strict TDD (double-loop) · **Base**: `72b08b7` (S-000 verified, in-loop 1 PASS)
**Suite after S-001**: `bun test` → **2196 pass / 0 fail** across 194 files (+5 vs S-000) · `tsc --noEmit` clean.

## Files changed

| File | Action | What was done |
|---|---|---|
| `scripts/regen-closure-baseline.ts` | created | 38 lines. Derive → refuse on any violation (preamble + the frozen `renderViolations` output to stderr, exit 1, existing baseline left untouched) → write `{nodes, edges, builtins}`. Optional `[packageRoot]` argv, same shape as the generator. |
| `test/fitness/runner-closure-graph-baseline.json` | created | **Generated by the script**, never hand-written: `bun run build && bun run regen:closure-baseline`. 23 nodes, 43 edges, 6 builtins. |
| `package.json` | modified | `scripts.regen:closure-baseline`. **Not** chained into `scripts.build`. |
| `test/fitness/fit-42-runner-closure-integrity.test.ts` | extended | New `FIT-42 S-001 —` describe with 3 tests. |
| `test/build/build-config.test.ts` | extended | New `runner closure baseline — maintainer-only regeneration` describe with 2 tests; the package.json parse hoisted to module scope so both describes share it. |

`src/**`: zero diff. `dist/**`: unchanged content (rebuilt, byte-identical manifest).

## TDD Cycle Evidence — S-001

Outer loop: `fit-42::"the committed baseline is byte-identical to a fresh derivation of the real tree"`,
written and run RED before the script existed, green only after the maintainer command produced the
committed file.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| **Outer loop** | `fit-42…test.ts::REQ-BDI-03.1 the committed baseline is byte-identical to a fresh derivation of the real tree` | B (read-only) | `error: ENOENT: no such file or directory, open '…/test/fitness/runner-closure-graph-baseline.json'` | after `bun run build && bun run regen:closure-baseline` produced the file | n/a — byte identity | no |
| Fail-closed guard | `fit-42…test.ts::REQ-BDI-03.1 the writer refuses a tree whose derivation reports violations` | A-shaped isolated root | `expect(received).not.toBe(expected) / Expected: not 0` — the stub script exited 0, so this was a real assertion failure and **not** the vacuous "script missing ⇒ non-zero exit" pass | violation guard before any write | **yes** — discriminated against an always-fail script by the two write-path criteria below | no |
| Baseline shape | `fit-42…test.ts::REQ-BDI-03.1 the writer emits exactly {nodes, edges, builtins}, each sorted` | B (copied `dist/`) | `error: ENOENT … '/tmp/fit-42-gu9gpr/test/fitness/runner-closure-graph-baseline.json'` — the `status === 0` assertion above it passed against the stub, so the failure is the absent write | destructured write of the three keys | **yes** — exact `Object.keys` order kills the `{...derivation}` mutation that would leak `violations` into the committed oracle | no |
| npm script entry | `build-config.test.ts::REQ-BDI-03.1 \`regen:closure-baseline\` invokes the baseline writer` | S | `expect(received).toBe(expected) / … / Received: undefined` | `scripts.regen:closure-baseline` added | n/a | package.json parse hoisted to module scope, shared by both describes |
| Out of the build chain | `build-config.test.ts::REQ-BDI-03.1 the baseline writer is absent from the build chain` | S | **green on arrival** — the guard that must stay green forever; its non-vacuity comes from the entry-exists test above (disclosed) | — | — | no |

**Honesty notes.**
- The sortedness half of the baseline-shape assertion was green the moment the write existed, because
  `deriveRunnerClosure` already returns all three collections sorted. It guards that contract rather
  than driving the writer; the **key-set/order** half is what actually discriminates.
- Criterion 2 exercises the `[packageRoot]`-omitted default path only indirectly: the committed file
  was produced by `bun run regen:closure-baseline` with no argument. The explicit-argument path is
  exercised directly by the other two tests.

## Acceptance criteria — S-001 (all 4)

| # | Criterion | Verified how | Result |
|---|---|---|---|
| 1 | Writes the baseline with exactly `{nodes, edges, builtins}`, each sorted | `fit-42::"the writer emits exactly {nodes, edges, builtins}, each sorted"` — script spawned against a `cpSync` copy of the real `dist/` at a `scratchDirFactory()` root; asserts `Object.keys` exactly and in order, then nodes/builtins/edges each equal to their own sorted copy | PASS |
| 2 | Byte-identical to a fresh derivation of the current tree | `fit-42::"the committed baseline is byte-identical…"` — reads the committed bytes and compares to `JSON.stringify({nodes,edges,builtins}, null, 2) + "\n"` over a fresh `deriveRunnerClosure` of the real `dist/` | PASS |
| 3 | Fails (non-zero exit, no file written) on a violating tree | `fit-42::"the writer refuses a tree whose derivation reports violations"` — isolated root whose only closure file is `import "ts-morph";`; asserts `status !== 0` **and** `existsSync(baseline) === false` | PASS |
| 4 | `regen:closure-baseline` is not part of `scripts.build`'s `&&` chain | `build-config::"the baseline writer is absent from the build chain"` (raw-string check plus a per-segment filter), made non-vacuous by `build-config::"`regen:closure-baseline` invokes the baseline writer"` | PASS |

## Deviations from design

1. **`scripts/regen-closure-baseline.ts` accepts an optional `[packageRoot]` argv.** Design §3.4's usage
   line shows no argument. Criterion 3 ("run against a tree whose derivation returns violations")
   is otherwise unprovable without mutating the real repo, and the generator (§3.2) already has exactly
   this parameter for exactly this reason (BPI-02.1). Same shape, same default resolution.
2. **The baseline is serialised inline (`JSON.stringify(v, null, 2) + "\n"`) rather than through
   `serialiseManifest`.** That export is typed `(m: RunnerManifest) => string`; widening it to `unknown`
   to share one expression would trade a type contract for nothing. Design §3.4 pins the *form*, not the
   *function*, and the form is asserted byte-for-byte by criterion 2.
3. **No test invokes the regenerator against the real repo root.** Design §1.1 keeps the writer out of
   `build` because a build that regenerates its own oracle makes the tripwire self-healing. A *test*
   that regenerated the committed baseline against the real tree reopens that hole one level up: a
   drifted closure would be silently re-baselined and S-002's RCD-01.1 would then pass against the
   drifted file. So criteria 1 and 3 run the script at isolated roots and criterion 2 is **read-only**
   against the committed bytes. The committed baseline was produced by the documented maintainer
   command, not by a test.
4. **On failure the script does NOT unlink an existing baseline** — deliberately unlike the generator's
   `rmSync(manifestPath)`. The manifest is the build's own output (a stale one is indistinguishable from
   tampering); the baseline is the maintainer's committed oracle, and deleting it on a failed
   regeneration would destroy the very thing the drift check compares against. Criterion 3's wording
   ("no file written") is satisfied without it.

## Post-slice audit (S-001 diff)

**One Bug-severity finding, found and fixed in-slice**: the `edgeKey` helper I added to
`fit-42-runner-closure-integrity.test.ts` contained **two literal NUL bytes** as the separator instead
of spaces. Every test still passed (NUL sorts below every path character, so the ordering assertion was
sound), but `git` classified the file as **binary** — a `Bin 5613 -> 8282 bytes` diff stat instead of a
reviewable one, which would have hidden the whole slice's test changes from review. Replaced with
spaces (`file` now reports `JavaScript source, Unicode text, UTF-8 text`; `git diff --stat` reports
`65 insertions(+), 2 deletions(-)`); a control-character scan over all twelve files this change has
touched reports every other file clean; the S-000 commits never carried it (verified against the
committed blob at `72b08b7`). Suite re-run after the fix: 2196/0.

Otherwise clean — no further Bug- or Architecture-severity finding.

- **ADR-02's counter-rule is the load-bearing check for this slice** and it holds: "a `scripts/` file
  which writes committed test fixtures must stay out of `build`". `regen-closure-baseline.ts` writes a
  committed test fixture and is out of `build`, now permanently guarded by `build-config`.
- **Layers**: `scripts/` gains a third member; no new layer. Dependency direction unchanged — the new
  edge is intra-layer (`regen-closure-baseline.ts → derive-runner-closure.ts`).
- **`src/**`**: zero diff. **Public API**: unchanged; the baseline lives under `test/`, outside
  `files: ["dist"]` — FIT-14 green with no new tarball entry.
- **Sensitive areas**: untouched.

## Open issues / notes for later slices

- **Structural gap, deliberately not closed here** (no criterion, and closing it would mean inventing a
  fitness function outside design §7's table): FIT-27 forbids a *test-reachable corpus writer*, but
  nothing structurally forbids a future test from spawning `regen-closure-baseline.ts` against the real
  repo root. This slice avoids it by construction and deviation 3 records why. If S-003 wants the
  guarantee enforced rather than observed, the natural home is an assertion in the negative file that
  no `test/**` module references `regen-closure-baseline`. **Registered as a followup, not built.**
- **S-002** can now write RCD-01.1 (derived node set == `baseline.nodes`) and RCD-04.1 (observed
  builtins == `baseline.builtins`, never a literal list). The baseline's `builtins` row is the six
  `node:async_hooks`, `node:console`, `node:fs`, `node:module`, `node:path`, `node:url`.
- **S-003** owns RP-2 / RP-2b / RP-2c (the drift-fires red-proofs) plus the `BASELINE_DRIFT_MESSAGE`
  rendering; none of that exists yet — S-001 established the artefact only.

---

# S-002 — Manifest correctness, shape, determinism, build-pipeline hardening

**Scope**: `slice:S-002` · **Mode**: Strict TDD (double-loop) · **Base**: `bf2f1ad` (S-001 verified, PASS)
**Suite after S-002**: `bun test` → **2237 pass / 0 fail** across 194 files (+41 vs S-001) · `tsc --noEmit` clean.
**status**: **halt** — 17 of 18 criteria proven; criterion 10's `RMD-01.2` half is unprovable as written.

## Files changed

| File | Action | What was done |
|---|---|---|
| `test/fitness/fit-42-runner-closure-integrity.test.ts` | extended | Five new `FIT-42 S-002 —` describes, 20 tests: baseline agreement, manifest shape/exclusions/hygiene/ordering, closure byte hygiene, determinism, tamper localisation, fail-closed atomicity. Plus a `beforeAll` pristine snapshot (see Audit). |
| `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` | extended | Four new `FIT-42N S-002 —` describes, 14 tests: walk shapes, message facts, known-answer digests, checker red-proofs. |
| `test/support/closure-integrity-checks.ts` | **created** | Three dependency-free checkers shared by the pair: `findPathHygieneViolations`, `findCrlfOffenders`, `findBomOffenders`. |
| `test/build/build-config.test.ts` | extended | `.gitattributes` scope describe (RMD-03.3) + its red-proof. |
| `test/fitness/fit-23-publish-workflow-guard.test.ts` | extended | `checkPublishOrdering` + a `FIT-23 S-002 —` describe, 6 tests (BPI-03.1). |

`src/**` and `scripts/**`: **zero diff** — S-002 is test-only, as designed.

## TDD Cycle Evidence — S-002

S-002 adds **no production code**: the implementation was completed in S-000, so the RED-first
discipline applies where new *test-side* logic was written, and every other row is disclosed as
green-on-arrival with its reason. Manufacturing a fake RED for an already-correct implementation
would be the dishonest option, so none was manufactured.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Path-hygiene checker | `…negative::REQ-RME-04.1 a duplicate, an absolute and a \`..\` path each fail path hygiene` (**RP-11**) | A | `error: not implemented at findPathHygieneViolations (…closure-integrity-checks.ts:12:36)` (first run gave `ReferenceError: … is not defined` — wrong reason; import added, re-run gave the throw) | five-rule scan | **yes** — the backslash/leading-`./` case and the well-formed case discriminate a single-rule and an always-fail impl | no |
| CRLF checker | `…negative::REQ-RMD-03.2 a CRLF-bearing file is reported with its path and the offset` (**RP-9**) | A | same stub throw | first CR-LF pair per file | **yes** — a clean file in the same input must yield nothing | no |
| BOM checker | `…negative::REQ-RMD-03.4 a BOM-prefixed file is reported and a clean one is not` | A | same stub throw | `EF BB BF` prefix test | **yes** — clean file in same input | no |
| Publish ordering | `fit-23::REQ-BPI-03.1 the committed publish.yml satisfies the ordering property today` | S | none — written after `checkPublishOrdering`; **non-vacuity supplied by four red-proofs** (`--ignore-scripts`, `bun publish`, `bun pm pack`, prepublishOnly-without-build) that each drive it to `ok:false` | — | **yes** — four distinct breakages | dropped a redundant regex alternative in `classifyPublishStep` |
| `.gitattributes` scope | `build-config::REQ-RMD-03.3 every \`-text\` opt-out is scoped to test/dialects/**` | S | none — the committed file already complies | — | **yes** — `[red-proof] a -text opt-out reaching src/** is caught` | parse extracted to `parseGitAttributes` so the red-proof runs the same code |
| Walk shapes | `…negative::REQ-RCD-01.3 / 01.4 / RCD-02.3` | A | **green on arrival** — S-000 implemented a general BFS with a visited set and no extension filter; these three input classes were simply never exercised | — | n/a | no |
| Message facts | `…negative::REQ-RCD-03.1 / 03.2 / 03.4 / 03.5` (**RP-13**) | A | **green on arrival** — S-000's `renderViolations` already names every fact the criterion demands; asserted from the criterion text first, and it passed | — | n/a | no |
| Known-answer digests | `…negative::REQ-RME-02.2 ×2` | A | **green on arrival** — constants confirmed against `sha256sum` before asserting, then matched | — | **yes** — two distinct vectors | no |
| Baseline agreement | `fit-42::REQ-RCD-01.1 / RCD-04.1` | B | **green on arrival** — S-001 committed a baseline generated from this same derivation | — | n/a | no |
| Manifest shape / exclusions / hygiene / ordering | `fit-42::REQ-RME-01.2 / 01.3 ×2 / 03.1 / 04.1 / 05.1`, `RMD-05.1` | B | **green on arrival** — S-000's generator already emits the pinned shape | — | n/a | no |
| Closure byte hygiene | `fit-42::REQ-RMD-03.2 / 03.4` | B | **green on arrival** | — | n/a | non-vacuity guards added (`emitted.length === 23`, `src/` count > 0) |
| Determinism | `fit-42::REQ-RMD-01.1`, `RMD-02.1` | B | **green on arrival** | — | n/a | precondition assertions added so the spaced/non-ASCII root cannot silently be neither |
| Tamper localisation | `fit-42::REQ-RMD-04.1` (**RP-1**) | B | **green on arrival** — self-proving: with no append, `changed` is `[]` and the assertion fails | — | n/a | no |
| Fail-closed atomicity | `fit-42::REQ-BPI-02.1 / 02.2` | B | **green on arrival** — self-proving: BPI-02.1 asserts the manifest EXISTS before planting; BPI-02.2 removes it first, so absence proves no partial write | — | n/a | no |

## Acceptance criteria — S-002 (all 18)

| # | Criterion | Verified how | Result |
|---|---|---|---|
| 1 | RCD-01.1 derived closure == baseline node set | `fit-42::REQ-RCD-01.1`, both sides sorted with `comparePaths` | PASS |
| 2 | RCD-01.3 cycle / RCD-01.4 zero-import | `…negative::REQ-RCD-01.3` (A↔B cycle terminates at `{entry,a,b}`), `REQ-RCD-01.4` (exactly 1 node, zero violations) | PASS |
| 3 | RCD-02.3 `.mjs` followed | `…negative::REQ-RCD-02.3` — entry→`x.mjs`→`deep.js`, all three derived | PASS |
| 4 | RCD-03.1/03.2/03.4/03.5 name the right facts | `…negative` ×4 over `renderViolations` output: src path + emitted line + construct; importer + specifier + attempted path (RP-13); the query suffix quoted; the unreadable path. Mode-000 case runs under `it.skipIf(uid 0)` — **confirmed executing** (uid 1000, 1 pass / 2 expect() calls under `-t` filter, not skipped) | PASS |
| 5 | RCD-04.1 builtins == baseline row | `fit-42::REQ-RCD-04.1` — compares to `baseline.builtins`, never a literal | PASS |
| 6 | RCD-05.1 symlink escape | Already proven by S-000's `…negative::REQ-RCD-05.1`; not duplicated | PASS (S-000) |
| 7 | RME-01.3 exact key sets | `fit-42::REQ-RME-01.3` ×2 — top-level key ORDER pinned, per-record key set pinned | PASS |
| 8 | RME-02.2 known-answer vectors | `…negative::REQ-RME-02.2` ×2; constants independently confirmed with `sha256sum` | PASS |
| 9 | RME-03.1 / 04.1 / 05.1 | `fit-42` ×3 — exclusion patterns, the shared hygiene checker, strict ascent under `comparePaths` | PASS |
| 10 | RMD-01.1 / **01.2** | `fit-42::REQ-RMD-01.1` PASS. **`RMD-01.2` UNPROVEN — see Halt below.** | **PARTIAL** |
| 11 | RMD-02.1 spaced + non-ASCII root | `fit-42::REQ-RMD-02.1` — asserts the root really contains a space and a non-ASCII byte, then byte-equality with the canonical manifest | PASS |
| 12 | RMD-03.2 / 03.4 | Tier A: the two checker red-proofs. Tier B: all 23 emitted files CRLF-free (count asserted), no BOM across emitted + source (source count asserted > 0) | PASS |
| 13 | RMD-04.1 tamper localisation (RP-1) | `fit-42::REQ-RMD-04.1` on a copy — length, path order and 23 digests unchanged, `["dist/core/session.js"]` the only change | PASS |
| 14 | RMD-05.1 no cwd / username | `fit-42::REQ-RMD-05.1` | PASS |
| 15 | BPI-02.1 fail-closed with prior manifest | `fit-42::REQ-BPI-02.1` — generator spawned DIRECTLY with an explicit root, never `bun run build`; manifest asserted present, then a bare specifier planted; exit ≠ 0 and manifest gone | PASS |
| 16 | BPI-02.2 unreadable file, no file at all | `fit-42::REQ-BPI-02.2` — manifest removed first so absence proves no partial write; `skipIf(uid 0)` **confirmed executing** | PASS |
| 17 | BPI-03.1 publish ordering | `fit-23::REQ-BPI-03.1` ×2 + 4 red-proofs; the second test pins that it holds via `prepublishOnly`, not step order | PASS |
| 18 | RMD-03.3 `.gitattributes` scope | `build-config` ×2 + red-proof | PASS |

## Halt — criterion 10, `RMD-01.2`

`routing: spec-ambiguity` (the scenario's stated MECHANISM is inert on this runtime; its INTENT is
already met elsewhere).

**The scenario**: "the generator runs in a **child process** under `LC_ALL=C` and again under
`LC_ALL=tr_TR.UTF-8`, then the bytes are identical."

**Measured, not assumed** — a Bun child process printing `Intl.Collator().resolvedOptions().locale`
and a `localeCompare` sort of the pinned pairs:

| Env | resolved locale | `dist/Z.js` vs `dist/a.js` |
|---|---|---|
| `LC_ALL=C` | `en-US` | `a.js` first |
| `LC_ALL=tr_TR.UTF-8` | `en-US` | `a.js` first |
| `LANG=tr_TR.UTF-8` | `en-US` | `a.js` first |
| `LC_COLLATE=tr_TR.UTF-8` | `en-US` | `a.js` first |
| control: `localeCompare(b, "tr")` explicit | — | `a.js` first (differs from byte order) |

ICU data is present — the control proves collation *can* differ — but no locale environment variable
moves Bun's default collator. So the two child processes run an identical collator, and the scenario
**cannot distinguish `Buffer.compare` from `localeCompare`**. Written literally it produces a green
that means nothing.

**What was done**: the test is kept (cross-process byte-stability under a differing environment is a
real, if weaker, property) and its comment states exactly what it does and does not prove. It was
**not** weakened into something that passes while claiming more, and criterion 10 is **not** marked
done.

**Why this is not a coverage hole**: the mutation RMD-01.2 exists to kill (QA escape 7,
"`localeCompare` passed RME-05.1") is independently killed by `RME-05.2`'s two pinned discriminating
pairs, which S-000 proved and which fail under ICU order — confirmed in the table above.

**Options for the owner**: (a) accept RMD-01.2 as satisfied-in-intent by RME-05.2 and record the
runtime limitation; (b) unfreeze the spec to restate the mechanism as an explicit-locale assertion;
(c) leave it open as a followup. This needs a ruling, not a build decision.

## Post-slice audit (S-002 diff)

Clean — no Bug- or Architecture-severity finding.

- **Control-character scan** over all five delta files: clean. `git diff --numstat` reports no binary
  files, so the whole slice's diff is reviewable. (Run with the same suspicion that caught S-001's NUL
  bytes.)
- **`src/**` and `scripts/**`: zero diff.** S-002 touches only the test layer. Public API, packaging
  and sensitive areas all untouched.
- **New file outside design §2's table**: `test/support/closure-integrity-checks.ts` — see Deviations.
- **FIT-27 interaction, checked rather than assumed**: the new support module becomes an entry point
  for FIT-27's `test/support/**` walk. It is dependency-free (zero imports) and writes nothing, so it
  reaches no module and triggers neither of FIT-27's rules; the full suite confirms.
- **Vacuity sweep on my own tests.** Four passes that could have been vacuous were hardened rather
  than trusted: the CRLF check now asserts it saw 23 emitted files, the BOM check asserts it saw
  source files, the spaced-root test asserts its root really holds a space and a non-ASCII byte, and
  both `skipIf(uid 0)` tests were confirmed to actually execute (uid 1000, 2 `expect()` calls each
  under a `-t` filter) rather than silently skipping.
- **Isolation, and a window this slice initially widened.** The five copied-root cases originally
  `cpSync`'d from the live `dist/` at test-body time — five new body-time reads of the most contended
  resource in the suite. They now copy from a pristine snapshot taken once in `beforeAll`, so the real
  tree is read at the same moment `manifestRaw` already was. Residual: the derivation calls in the
  S-000/S-001 blocks still read the live `dist/` at body time; that predates this slice.

## Halt / issues

- **Criterion 10 (`RMD-01.2`)** — above.
- **One unreproduced full-suite failure, and a process failure of mine.** The first full run after the
  Tier-B additions reported 2236 pass / 1 fail of 2237. I tailed the output instead of capturing it,
  so **the failing test's identity is lost** — precisely the mistake the standing instruction warns
  against. Four subsequent runs (two of them written to log files) were 2237/0 with no `(fail)` line.
  Totals matched across the failing and passing runs, so nothing was skipped or added. **Hypothesis,
  not a diagnosis**: the registered `REQ-PPH-04.1` followup (an unmemoized `bun run build` whose
  `prebuild` clean deletes the real `dist/` mid-suite) plus this slice's then-body-time reads of that
  tree. The snapshot change above removes this slice's contribution to that window; the root cause
  remains the registered followup's.

## Notes for later slices

- **S-003** owns the twelve CST/BDI red-proofs, `BASELINE_DRIFT_MESSAGE`, and the
  `SANCTIONED-FACTORY-IMPORT` marker in `src/transport/runner.ts` (S-000 deviation 4).
- **S-003 followup carried from S-001's verify**: `renderViolations`'s trailing line says "No manifest
  was written; dist/runner-manifest.json does not exist." — the baseline writer reuses it verbatim, so
  a failed *baseline regeneration* reports something about the *manifest*. Not touched here.
- The `describe` blocks added by this slice are all prefixed `FIT-42 S-002 —` / `FIT-42N S-002 —` /
  `FIT-23 S-002 —`, leaving S-003's extensions collision-free.

---

# S-003 — Closure-sealing tripwires + bundler/graph-drift disjointness

**Scope**: `slice:S-003` · **Mode**: Strict TDD (double-loop) · **Base**: `c3d7f87` (S-002 verified, 18/18)
**Suite after S-003**: `bun test` → **2287 pass / 0 fail** across 194 files (+50 vs S-002) · `tsc --noEmit` clean.
**status**: complete — 9/9 criteria, all 12 red-proofs landed, both carried obligations discharged.

## Files changed

| File | Action | What was done |
|---|---|---|
| `src/transport/runner.ts` | modified | **The only `src/` write in the change.** Three comment lines adding the `SANCTIONED-FACTORY-IMPORT` marker at the sanctioned site. Zero logic diff — see Audit. |
| `scripts/derive-runner-closure.ts` | modified | `readSpecifiers` implemented (S-000 deferred it here); `VIOLATION_RULES` exported as the closed set with `ViolationRule` **derived** from it; `renderViolations` gains a caller-supplied `outcome`; `dynamicImportCalls` extracted (was duplicated). |
| `scripts/regen-closure-baseline.ts` | modified | Passes its own epilogue, so a failed baseline regeneration no longer reports on the manifest. |
| `test/support/closure-integrity-checks.ts` | extended | Six new checkers: `findIntermediatePackageJsons`, `findBundlerTargets`, `findDisjointnessViolations`, `diffClosureBaseline`, `hasDrift`, `renderBaselineDrift`, `findGraphEmitMismatches`. |
| `test/fitness/fit-42-…negative.test.ts` | extended | Eight `FIT-42N S-003 —` describes, 34 tests: all eleven synthetic red-proofs, the closed-rule-set shape test, the epilogue proof. |
| `test/fitness/fit-42-…test.ts` | extended | Three `FIT-42 S-003 —` describes, 11 tests: real-tree CST-03.3/04.3/05.1, BDI-01.1/02.1/02.2/03.1, the one real-tree negative (RP-4's B half), and the baseline-writer epilogue proof. |

## Red-Proof Ledger — all 12

Observed output captured by invoking each check against its planted mutation, not paraphrased.

| RP | Planted mutation | Caught by | Observed output (leading lines) |
|---|---|---|---|
| **RP-2** | a 24th closure file, imported | `…negative::REQ-BDI-03.1 an added node is reported with the edge that admitted it` | `4 files are reachable …; the committed baseline has 3.` / `added node:  c.js` / `added edge:  b.js -> ./c.js   (src/b.ts)` / `removed:     (none)` |
| **RP-2b** | closure file + its import removed | `…negative::REQ-BDI-03.1 a removed node and its edge are both reported` | `2 files are reachable …; the committed baseline has 3.` / `added node:  (none)` / `added edge:  (none)` / `removed:     b.js` |
| **RP-2c** | **edge redirected, node set constant** | `…negative::REQ-BDI-03.1 an edge redirected with the node set unchanged is still reported` | `3 files are reachable …; the committed baseline has 3.` / `added node:  (none)` / `added edge:  entry.js -> ./b.js   (src/entry.ts)` / `removed:     a.js -> ./b.js` — **node counts identical on both sides; only the edge diff fires** |
| **RP-3** | dynamic `import()` outside `runner.ts` | `…negative::REQ-CST-03.1` | `runner-manifest: src/transport/session.ts — dynamic import() outside the sanctioned factory-import site.` / `found: import(s)     (emitted: dist/transport/session.js:1)` / `rule:  Constraint 2 — the closure contains exactly one dynamic import(): … marked SANCTIONED-FACTORY-IMPORT.` |
| **RP-3b** | **second** dynamic `import()` INSIDE `runner.ts` | `…negative::REQ-CST-03.2` | `runner-manifest: src/transport/runner.ts — second dynamic import() inside the factory-import file.` / `found: import(v)     (emitted: dist/transport/runner.js:2)` / `rule:  Constraint 2 — the sanction is per-SITE, not per-file. Living in runner.ts does not make an import() sanctioned.` / `why: src/transport/runner.ts:SANCTIONED-FACTORY-IMPORT is the author-code boundary; this is a different site…` |
| **RP-4** | bare third-party specifier (A **and** the one real-tree B) | `…negative::REQ-CST-01.1` + `fit-42::REQ-CST-01.1 … copied real tree` | `runner-manifest: src/core/wire.ts — bare specifier in the runner closure.` / `found: import { Project } from "ts-morph";     (emitted: dist/core/wire.js:1)` / `rule:  Constraint 3 — no bare third-party specifier inside the closure.` — B half also asserts exit ≠ 0 and no manifest |
| **RP-5** | `"fs"` **and** `"node:fs"` in ONE fixture | `…negative::REQ-CST-02.1 … exactly ONE violation` | `violations=1  detail=fs  builtins=["node:fs"]` — one violation, naming only `fs`, while `node:fs` is recorded as an ordinary builtin. A name-allowlist implementation cannot produce this. |
| **RP-6** | `dist/package.json` planted | `…negative::REQ-CST-05.1 a planted dist/package.json is found` | `[{"path":"dist/package.json","reason":"terminates the package-root walk early and reinterprets parse mode with NO digest change"}]` |
| **RP-7** | `createRequire` direct call | `…negative::REQ-CST-04.1` | `runner-manifest: src/entry.ts — unhashed-code-execution primitive in the closure.` / `found: createRequire(a)("./x.js");` / `rule:  Constraint 4 — the closure may RESOLVE, never EXECUTE.` + `forbidden primitive: createRequire` |
| **RP-7b** | indirect-variable **and** namespace forms | `…negative::REQ-CST-04.4` ×2 | indirect: `found: const req = createRequire(a);` · namespace: `found: m.createRequire(u)("./x.js");` — both `forbidden primitive: createRequire`. The `found:` line is what names which form. |
| **RP-7c** | `eval` / `new Function` / `node:vm` / `Bun.plugin` / `process.binding` | `…negative::REQ-CST-04.2` ×5, one per primitive | e.g. `found: export const r = new Function(body);` + `forbidden primitive: Function`; each of the five names its own primitive |
| **RP-8** | `--outdir dist/transport` **and** `-o` short form | `…negative::REQ-BDI-01.1` ×2 | `[{"script":"leak","target":"dist/transport","colliding":"dist/transport/runner.js"}]` — the `--outdir` case collides by **directory containment**, which an exact-match check would miss |

## TDD Cycle Evidence — S-003

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `readSpecifiers` (production) | `…negative::REQ-BDI-02.1 returns static specifiers in source order` | A | `error: not implemented at readSpecifiers (…derive-runner-closure.ts:391:36)` | ts-morph read + `isErasedImport` | **yes** — whole-declaration `import type`, the inline `{ type Y }` form, and the mixed value+type case (must NOT be erased) | `dynamicImportCalls` extracted; `denyScan` now shares it |
| Caller-supplied epilogue (production) | `…negative::REQ-CST-06.1 a caller-supplied epilogue replaces it` | A | `Expected to contain: "No baseline was written."` / `Received: "…No manifest was written; dist/runner-manifest.json does not exist.\n"` | optional `outcome`, frozen default retained | **yes** — sibling test pins the frozen sentence still renders on the build path | `regen-closure-baseline` passes its own |
| Closed rule set (production) | `…negative::REQ-CST-06.1 the exported rule set is the nine-member closed set` | A | assertion failure against the deliberate `VIOLATION_RULES = []` stub | nine members; `ViolationRule` derived via `(typeof VIOLATION_RULES)[number]` | **yes** — the skeleton test iterates the set | duplicated union removed — the type now cannot drift from the list |
| `findIntermediatePackageJsons` | `…negative::REQ-CST-05.1` ×2 (**RP-6**) | A | `error: not implemented` | upward walk to the package root | **yes** — clean-tree case returns `[]` | no |
| `findBundlerTargets` | `…negative::REQ-BDI-01.1 --outfile, --outdir and -o are all extracted` | A | `error: not implemented` | one regex, three flags | **yes** — three flag forms in one call | no |
| `findDisjointnessViolations` | `…negative::REQ-BDI-01.1` ×3 (**RP-8**) | A | `error: not implemented` | exact match, plus directory containment for `--outdir` | **yes** — outdir vs `-o` vs an outside target | no |
| `diffClosureBaseline` / `hasDrift` | `…negative::REQ-BDI-03.1` ×4 (**RP-2/2b/2c**) | A | `error: not implemented` | node **and** edge multiset diff | **yes** — the RP-2c case (node set constant) fails a nodes-only implementation | no |
| `renderBaselineDrift` | `…negative::REQ-BDI-03.1 the rendered drift keeps the permissive register` | A | `error: not implemented` | design §9 `BASELINE_DRIFT_MESSAGE` | **yes** — `(none)` branches exercised by RP-2b/2c | no |
| `findGraphEmitMismatches` | `…negative::REQ-BDI-02.1/02.2` ×5 | A | `error: not implemented` | `.ts→.js` rewrite, type-only erasure, multiset subtraction | **yes** — emitted-only, source-only, type-only-exempt, and duplicate-collapse cases | no |
| CST message red-proofs | `…negative` RP-3 / RP-3b / RP-4 / RP-5 / RP-7 / RP-7b / RP-7c | A | **green on arrival** — S-000's renderer already names every fact; asserted from the criterion text first and it passed. RP-5's *exactly-one* count and RP-3b's per-SITE clause are new assertions, not new behaviour. | — | **yes** — RP-5 discriminates a name allowlist; RP-3b discriminates a path-scoped Constraint 2 | no |
| Real-tree Tier B | `fit-42::REQ-CST-03.3 ×2 / 04.3 ×2 / 05.1`, `BDI-01.1`, `BDI-02.1/02.2`, `BDI-03.1` | B | CST-03.3's marker assertion was **genuinely RED** until `src/transport/runner.ts` gained the marker; the rest green on arrival | marker added | n/a | reads routed through the `beforeAll` snapshot, per S-002's finding |

## Acceptance criteria — S-003 (all 9)

| # | Criterion | Verified how | Result |
|---|---|---|---|
| 1 | Bare specifier, A **and** B | `…negative::REQ-CST-01.1` (message facts incl. the specifier) + `fit-42::REQ-CST-01.1` on a copied real tree via generator subprocess: exit ≠ 0, no manifest, stderr names `src/core/wire.ts`, `"ts-morph"`, `Constraint 3` | PASS |
| 2 | RP-5 exactly-one | `…negative` ×3 — violation count is `1`, its detail is `fs`, and `node:fs` from the same fixture is recorded as an ordinary builtin; plus the frozen allowlist clause asserted verbatim | PASS |
| 3 | Constraint 2 site-scoping + real tree | `…negative` RP-3 / RP-3b; `fit-42::REQ-CST-03.3` — the per-file dynamic-import count over all 23 nodes reduces to exactly `[{transport/runner.js, 1}]`, and the source marker is asserted present | PASS |
| 4 | Constraint 4, four forms + real tree | `…negative` RP-7/7b/7c (7 tests); `fit-42::REQ-CST-04.3` ×2 — zero violations, **and** the anchored probe is asserted to genuinely hold ≥2 `createRequire` references so the exemption is exercised rather than absent | PASS |
| 5 | No intermediate `package.json` | `fit-42::REQ-CST-05.1` (checker + both `existsSync` assertions) and `…negative::REQ-CST-05.1` (RP-6) | PASS |
| 6 | Rendered text by substring + rule-set shape | `…negative::REQ-CST-06.1` ×4 — every one of the nine rules renders `found:`/`rule:`/`why:`/`fix:`/epilogue; the set is pinned at nine; both epilogue forms asserted | PASS |
| 7 | Bundler disjointness, non-vacuous | `fit-42::REQ-BDI-01.1` — asserts `dist/bin/pbuilder-codegen.js` IS among the extracted targets and IS outside the closure, then zero violations; `…negative` RP-8 ×2 | PASS |
| 8 | Graph-preserving emit | `fit-42::REQ-BDI-02.1` (all 23 entries compared, count asserted) and `REQ-BDI-02.2` (both named files asserted to actually carry type-only imports, then not flagged) | PASS |
| 9 | Drift: add / remove / **redirect** | `…negative::REQ-BDI-03.1` ×5 including the unchanged-graph control; `fit-42::REQ-BDI-03.1` proves no drift against the committed baseline with `baseline.edges.length > 0` asserted | PASS |

## Obligations discharged

1. **`SANCTIONED-FACTORY-IMPORT` marker added** to `src/transport/runner.ts`. This closed a live
   defect, not just a test gap: the renderer already told maintainers the site was "marked
   SANCTIONED-FACTORY-IMPORT" while the string existed nowhere in `src/`. Three comment lines, zero
   logic diff (full `git diff -- src/` in the Audit below).
2. **Epilogue corrected for both consumers.** `review-tech-writer.md` freezes "No manifest was written;
   dist/runner-manifest.json does not exist." (lines 177/190/207), so that text is unchanged and still
   renders on the build path. `renderViolations` gained an optional `outcome`; the baseline writer
   passes `No baseline was written; test/fitness/runner-closure-graph-baseline.json is unchanged.` —
   which is also *true*, since S-001 deliberately leaves an existing baseline in place on failure.
   Both forms are asserted, and the manifest sentence is asserted **absent** from the baseline path.
3. **`BASELINE_DRIFT_MESSAGE` landed** (design §9), closing S-001's risk note.

## Deviations from design

1. **`renderViolations` gains an optional `outcome`** beyond design §3.1's signature. Required to make
   the frozen sentence true of the tool that prints it; the frozen text itself is untouched and remains
   the default.
2. **`ViolationRule` is now derived from an exported `VIOLATION_RULES`** rather than written as a
   standalone union. Criterion 6 demands a runtime shape test over the closed set, which a type-only
   union cannot provide. Strictly less code — the list existed twice, now once.
3. **`renderBaselineDrift` omits the line number** in `added edge: … (<src path>)`. Design §9's frozen
   block shows `(<src path>)` with no line; review-tech-writer §5's example shows `:14`. Design §9 is
   the stated source of truth and wins, and the baseline carries no line numbers to render.

## Post-slice audit (S-003 diff)

Clean — no Bug- or Architecture-severity finding.

- **`src/` diff is three comment lines and nothing else** — `git diff -- src/` reproduced in full during
  the audit shows only the added marker block inside the existing `try {`. No statement, signature or
  control-flow change. `architecture_impact` stays `additive`; FIT-04's `.d.ts` baselines are untouched
  (full suite green).
- **Control-character scan** over all six delta files: clean. `git diff --numstat` reports no binary
  files.
- **FIT-27 re-checked, not assumed.** `closure-integrity-checks.ts` gained `node:fs`/`node:path`
  imports, so it is no longer literally dependency-free; its header now says "no repo imports (node
  builtins only)". FIT-27 walks relative specifiers from `test/support/**`, so node builtins add
  nothing to that graph — and FIT-27 was run directly: 8/8 green.
- **Vacuity swept as written, per the standing instruction.** Every new "must be `[]`" assertion has a
  companion pinning its input non-empty: the emit comparison asserts 23 entries; BDI-02.2 asserts both
  named files actually carry type-only imports; BDI-01.1 asserts the codegen target is really among the
  extracted targets; CST-04.3 asserts the probe really holds ≥2 `createRequire` references; BDI-03.1
  asserts `baseline.edges.length > 0`; the rule-set shape test asserts nine rules before iterating.
- **Isolation**: every new Tier-B read goes through the `beforeAll` snapshot (`snapshotDist()`), so this
  slice adds **zero** new body-time reads of the live `dist/`.
- **Manifest digest changed** (`ae3df4e3…`) because `dist/transport/runner.js` gained the marker comment.
  Expected — the manifest tracks bytes. The closure-graph baseline is unaffected (a comment adds no node
  or edge) and its self-consistency test stays green.

## Notes for later slices

- **S-005** owns BDI-01.2 — the explicit statement that non-`scripts` bundler surfaces (workflow steps,
  `Bun.build({outdir})`, `scripts/*.ts` calls) are out of scope. north-star.md judges BDI-01 the weakest
  addition in the change precisely because of that limit, so the docs page must state it rather than let
  the requirement read stronger than it is.
- **S-004** (Tier C packaging) is unblocked and independent of everything here.
- The `describe` blocks added by this slice are prefixed `FIT-42 S-003 —` / `FIT-42N S-003 —`.

---

# S-005 — Integrity-invariants documentation + `SECURITY.md` + probe header

**Scope**: `slice:S-005` · **Mode**: Strict TDD (guard-first) · **Base**: `dd9b265` (S-003 verified, 9/9)
**Suite after S-005**: 2309 pass / **1 fail** across 195 files — the one failure is a pre-existing
timeout flake in `test/conformance/react-conformance.test.ts`, diagnosed below, unrelated to this
slice. `tsc --noEmit` clean. The S-005 guard is 23/23.
**status**: complete — 10/10 criteria; IID-01..08 and BDI-01.2 closed.

## Files changed

| File | Action | What was done |
|---|---|---|
| `docs/runner-integrity-invariants.md` | **created** | The page. Honest-scope paragraph, justification, five Constraints each with `enforced-by:`, entry-#24 reason, portability, `bun link` limit, three known gaps. |
| `test/docs/runner-integrity-docs.test.ts` | **created** | The machine guard — 23 tests. Written and run RED (22 failing) **before** a word of the page existed. |
| `docs/README.md` | modified | Link under *Contributor notes*. |
| `SECURITY.md` | modified | The three-sentence subsection, verbatim. GateGuard blocked the first write; the four demanded facts were verified (`rg -l`) and stated, then the same edit retried. |
| `src/transport/single-instance-probe.ts` | modified | The frozen pointer sentence. **Second and final `src/` write in the change** — three comment lines, zero logic. |

## TDD Cycle Evidence — S-005

The inversion mattered here: IID-01.1 exists precisely because prose can pass a check the code fails,
so the guard was written first and watched fail against an absent page.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| The whole guard | `runner-integrity-docs.test.ts` (23 tests) | S | **22 of 23 failing** — `error: ENOENT … open '…/docs/runner-integrity-invariants.md'` plus `expect(received).toContain(expected)` across the frozen strings | the page, the index link, the `SECURITY.md` section and the probe header written to satisfy it | — | — |
| `enforced-by` resolver | `…::IID-01.1 the resolver rejects a fitness id with no file on disk` | S | the one test that passed at RED — it tests the resolver, not the page | `readdirSync` prefix match | **yes** — `fit-99` false, `fit-42` true; without this the structural check is theatre | — |
| Constraint parse | `…::IID-01.1 the page lists exactly five Constraints` | S | `[]` against an absent page | `### Constraint N [(marker)] — name` parse | **yes** — count, `enforced-by` presence and resolution are three separate assertions | heading regex widened to admit the `(SDK-added)` / `(engine-owned)` marker |
| Bare-number guard | `…::IID-01.3 no Constraint is cited by bare number before its named heading` | S | genuine RED, then a **second RED from my own bug** — I compared a line-start index to a word index, so all five read as premature; fixed by offsetting to the citation inside the heading | first mention of each number must be its named heading | **yes** — asserts the named heading exists per number, so it cannot pass vacuously | — |
| Probe header | `…::IID-08 the probe header carries the frozen pointer sentence, before any import` | S | `Expected to contain: "Constraint 4 (docs/…) makes this ENFORCED…"` / `Received:` the header without it | sentence added at the end of the header block | — | `flatComment()` added — `//` markers stripped before comparing words |

**On "verbatim".** Frozen strings are compared after collapsing whitespace runs (`flat()`), because a
markdown paragraph renders identically wrapped or unwrapped — every character except wrap position is
still asserted exactly. The alternative (single-line paragraphs, as `SECURITY.md` uses) would have made
the page itself unreadable. Declared rather than assumed.

## Acceptance criteria — S-005 (all 10)

| # | Criterion | Verified how | Result |
|---|---|---|---|
| 1 | Five Constraints, each `enforced-by:` resolving on disk or `engine-owned` | `IID-01.1` ×4 — structural parse yields exactly `[1,2,3,4,5]`; every entry carries the field; every value resolves via `readdirSync` against `test/fitness/`; **plus** a resolver-rejects test (`fit-99` → false) so the resolution check cannot be theatre | PASS |
| 2 | Constraint 2 site-scoped; `infrastructure path` absent | `IID-01.2` ×2 — the parsed name contains `SITE`; the page is asserted not to contain the engine's unresolved wording (independently confirmed: `rg -c` returns 0 matches) | PASS |
| 3 | `SDK-added` / `engine-owned` on first use; no bare-number citation | `IID-01.3` ×2 — markers asserted inside the headings themselves; for each of the five numbers, the FIRST occurrence in the document must be its named heading | PASS |
| 4 | Five excluded trees named; pull-quote exactly once | `IID-02.1`/`02.2` — all five trees present (list length pinned at 5 so the filter cannot be vacuous); pull-quote occurrence count is exactly 1 | PASS |
| 5 | Three frozen justification claims verbatim | `REQ-IID-03` ×4 — `not ceremony … three ways`, the `Wrong-artefact detection` label, `They are enforced by fit-42; they do not depend on the manifest existing.`, and the install-script-adversary sentence | PASS |
| 6 | Entry #24 by `"type": "module"`; `packageRootFor()` ruled out | `IID-05` — the frozen `ENTRY_24_REASON` contains both halves, including the explicit **not** because of `packageRootFor()` | PASS |
| 7 | `bun link` sentence and C2 residual both present | `IID-06` and `IID-07` | PASS |
| 8 | `SECURITY.md` three-sentence subsection unchanged | `REQ-IID-08…` — heading plus the verbatim subsection; the pre-existing `security-authoring-guard.test.ts` re-run green, so no frozen sentence there was disturbed | PASS |
| 9 | Probe header sentence; zero logic change | `IID-08` (sentence present before the first `import`) **and** `git diff -- src/transport/single-instance-probe.ts` reproduced in the audit: three added comment lines, nothing else | PASS |
| 10 | `docs/README.md` links it under *Contributor notes* | asserted against the slice of the index following that heading, not the whole file | PASS |

## Deviations from design

1. **Frozen-string comparison collapses whitespace** (`flat()` / `flatComment()`), so the page can wrap
   normally. Content is asserted character-for-character; only wrap position is free.
2. **Constraint headings carry their marker as a parenthetical** — `### Constraint 4 (SDK-added) — …` —
   rather than appending it in the body. IID-01.3 says "on first use", and the heading *is* the first
   use, so this is the strictest available placement.
3. **The justification's opening premise is rephrased**, as design §9 explicitly instructs
   ("the first sentence must be phrased so it does not contradict their updated threat-model ADR").
   review-tech-writer §3's original asserts the schematic author "has no write access to the installed
   SDK tree"; the engine retracted exactly that. The page now records that one route did reach the tree
   (a workspace `node_modules` write the containment gate did not exclude) and that the engine denies
   `SDKRoot`-subtree writes at ingestion. **All four frozen sentences in that section are untouched** —
   design §9 freezes those, not the premise.

## Post-slice audit (S-005 diff)

Clean — no Bug- or Architecture-severity finding.

- **`src/` diff is three comment lines**, above the first `import`, zero logic. This is the second and
  final `src/` write in the change; combined with S-003's marker, total `src/` diff for the whole
  program is six comment lines.
- **Control-character scan** over all five delta files: clean. No binary files in the diff.
- **`infrastructure path` independently confirmed absent** from the page by `rg`, not only by the test.
- **The pre-existing `security-authoring-guard.test.ts` re-run green** — the `SECURITY.md` edit is
  purely additive and disturbed none of its frozen strings. Checked rather than asserted.
- **Vacuity swept as written**: the `enforced-by` resolver has a rejects-test; `EXCLUDED_TREES.length`
  is pinned at 5; the bare-number check asserts each named heading exists; the Constraint-count
  assertion precedes every filter over that list.

### The one suite failure — diagnosed, not mine, and not lost this time

`test/conformance/react-conformance.test.ts::REQ-RXD-08.1` failed once at **5457.49 ms**. The log
carries **no assertion diff**, and bun's default per-test timeout is **5000 ms**. Run in isolation with
zero contention the file takes **6.12 s** wall-clock and the file declares **no custom timeout** (`rg`
found none). So the mechanism is exact: a ts-morph JSX round-trip test whose runtime sits within noise
of the default timeout, with nothing declared to give it headroom. It passed on the immediately
preceding full run and passes in isolation.

Unrelated to S-005 by construction — a docs page, an index link, a `SECURITY.md` section, three comment
lines and 23 static-read tests cannot slow a JSX corpus. **Registered as a followup, not fixed**: the
repair is a declared timeout on that file, which belongs to whoever owns the react dialect, not to a
docs slice. Recorded here with its measurement so the next person does not have to rediscover it —
unlike the S-002 flake, whose identity I lost.

## Notes for later slices

- **S-004 is the only slice left** (PMF-01, PMF-02). Nothing in S-005 blocks or affects it — no
  Constraint's `enforced-by:` names the e2e file, by design.
- Capability 8 is now closed: IID-01..08 plus BDI-01.2. After S-004 the signed spec's 42 REQs are
  fully delivered.

---

# S-004 — Packaged-manifest fidelity (Tier C: pack / extract / install)

**Scope**: `slice:S-004` · **Mode**: Strict TDD · **Base**: `01d2aa2` (S-005 committed)
**Suite after S-004**: `bun test` → **2318 pass / 0 fail** across 196 files (+8) · `tsc --noEmit` clean.
**status**: complete — 5/5 criteria. **PMF-01 and PMF-02 closed; the signed spec's 42 REQs are now fully delivered.**

## Files changed

| File | Action | What was done |
|---|---|---|
| `test/e2e/runner-manifest-packaged.e2e.test.ts` | **created** | 8 tests, Tier C exclusively. `npm pack` (normative) → extract → 24 digests → version-rewrite mismatch proof → two real `npm install` round trips → two loudness guards. |

Nothing else. The repo's `package.json`, `dist/` and `node_modules/` are untouched — confirmed by
`git status` after the run.

## Tier-C harness run accounting (the number requested for the archive)

**6 invocations, 5 green, 1 red.**

| # | Invocation | Result | Cause |
|---|---|---|---|
| 1 | standalone | **red** (8 pass / 1 fail) | **My bug, not the harness**: the no-skip guard's regex matched the `it.skipIf(offline)` written in this file's own header comment. Fixed by stripping comments and assembling the pattern so it cannot match its own source. |
| 2 | standalone | green (8/8, 5.2 s) | — |
| 3 | standalone | green (8/8) | — |
| 4 | standalone | green (8/8) | — |
| 5 | standalone | green (8/8) | — |
| 6 | inside the full suite | green (2318/0) | — |

**Zero failures attributable to network or harness instability across 6 runs.** That is a real
measurement but a weak one against R-2's ~25% figure, for a reason worth recording rather than
glossing: **npm's local cache was warm on this machine.** Verified by hand — an install into a fresh
consumer resolves the full transitive tree (`ts-morph@28.0.0`, `@ts-morph/*`, `code-block-writer`,
`tinyglobby`, `fdir`, `picomatch`, `minimatch`, `brace-expansion`, `balanced-match`,
`path-browserify`), so dependency resolution genuinely happens, but the bytes came from
`~/.npm` rather than the network. A cold CI cache is the condition R-2 measured, and these runs do
not exercise it. **Do not read 5/5 as a refutation of the 25% posture.**

## TDD Cycle Evidence — S-004

Like S-002 and S-005's page, this slice proves existing behaviour at a new boundary, so most
assertions are green-on-arrival and are disclosed as such. The genuine REDs came from the harness
itself and from the one guard that is new logic.

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| No-skip guard | `…::declares no conditional skip in executable code` | C | **genuine RED**: `expect(received).not.toMatch(expected)` — the guard matched `it.skipIf(offline)` in its own header docblock | comments stripped; pattern assembled from parts so it cannot match its own source | **yes** — the same pattern is asserted to fire on a planted `it.skipIf(offline)` sample, so a guard that matched nothing would fail | replaced a dumped-whole-file assertion with a boolean |
| Loudness runner | `…::the runner surfaces a non-zero exit as a thrown failure` | C | green on arrival — the runner was written to throw before any test used it | — | **yes** — points npm at `http://127.0.0.1:1` and asserts the throw carries `This test never skips` | — |
| Entry-#24 accessor | typecheck | — | **genuine RED**: `TS2769 … Argument of type 'string | undefined' is not assignable` under `noUncheckedIndexedAccess` | `entryTwentyFour()` throws with the observed record count rather than optional-chaining the assertion away | — | three call sites de-optionalised |
| PMF-01 file list | `…::npm pack's file list contains dist/runner-manifest.json` | C | green on arrival | — | n/a | — |
| PMF-02.1 digests | `…::all 24 digests recompute from the extracted tarball's own bytes` | C | green on arrival | — | n/a | — |
| PMF-02.2 mismatch | `…::rewriting package.json#version … makes entry #24's digest MISMATCH` | C | green on arrival | — | **yes** — asserts `version` is the ONLY differing key, so a wholesale rewrite would fail too | — |
| PMF-02.3 install | `…::entry #24 recomputes correctly against the INSTALLED package.json` ×2 | C | green on arrival | — | **yes** — the sibling test recomputes all 24 installed digests, so #24 cannot pass alone | — |

## Acceptance criteria — S-004 (all 5)

| # | Criterion | Verified how | Result |
|---|---|---|---|
| 1 | `npm pack --dry-run` lists the manifest (PMF-01) | `--dry-run --json` parsed structurally; asserts the list is longer than 24 entries (non-vacuity) **and** contains `dist/runner-manifest.json` | PASS |
| 2 | All 24 digests match the extracted bytes (PMF-02.1) | tarball extracted with `tar -xzf`, `package/` prefix stripped explicitly; every record hashed with the **test's own** `createHash`, never the generator's; record count pinned at 24 **before** the filter, so a zero-iteration loop cannot pass | PASS |
| 3 | Version rewrite makes entry #24 MISMATCH (PMF-02.2) | version rewritten in a **copy**, repacked with `--ignore-scripts`, re-extracted; digest asserted `not.toBe` the manifest's; then the differing key set asserted to be exactly `["version"]` — the field, named | PASS |
| 4 | Entry #24 matches after a real install (PMF-02.3) | `npm install <tarball>` into a temp consumer; #24 recomputed against `node_modules/@pbuilder/sdk/package.json`. `npm-normalize-package-bin` did **not** perturb it — the expected result, and now proven rather than assumed. A sibling test recomputes all 24 installed digests | PASS |
| 5 | Fails loudly, never skips (R-2) | Two independent mechanisms: (a) `run()` throws on any non-zero exit carrying npm's own stdout/stderr, proven by pointing npm at an unreachable registry; (b) a guard test asserts no conditional skip exists in this file's executable code, itself proven non-vacuous against a planted sample | PASS |

## Deviations from design

1. **`npm pack --ignore-scripts` is used for every pack, including the non-red-proof ones.** Criterion 3
   names the flag; I applied it uniformly for determinism. Verified this changes nothing: `package.json`
   declares no `prepack` and no `prepare`, and `prepublishOnly` does not run on `npm pack` — so no
   lifecycle script would have fired either way.
2. **Packing runs from a copied package root**, not the repo root. `files: ["dist"]` plus `package.json`
   is the entire publishable surface (no README/LICENSE/CHANGELOG at root — checked), so the copy packs
   byte-identical content while keeping the real tree out of reach of a rewrite.
3. **Two extra tests beyond the five criteria**: the all-24-installed-digests sibling (so PMF-02.3's #24
   assertion cannot pass alone) and the no-skip guard. Both exist to make criteria 4 and 5 non-vacuous.

## Post-slice audit (S-004 diff)

Clean — no Bug- or Architecture-severity finding.

- **One new file, nothing else.** `git status` after five harness runs shows only the untracked test;
  `package.json`, `dist/` and the repo's `node_modules/` are unmodified. Every operation ran at its own
  `mkdtemp` root with `afterAll` cleanup — verified: no `/tmp/pmf-*` roots survive the run except my own
  manual diagnostic directory, which the test never created.
- **Control-character scan** clean; no binary files in the diff.
- **The only `.skipIf` occurrence in the file is inside the header comment** explaining why there isn't
  one. The guard strips comments before scanning, which is why that is consistent rather than a loophole.
- **Timeout declared** (`300_000` ms) on the network-bearing tests and on `beforeAll`. This is the direct
  lesson from the `react-conformance` diagnosis: an undeclared timeout on a slow test is a latent flake,
  and Tier C is the slowest thing in the suite.
- **Vacuity swept as written**: record count pinned at 24 before every digest filter; the dry-run list
  asserted longer than 24 before the `toContain`; the mismatch proof asserts the differing key set
  exactly; the no-skip guard asserts its own pattern fires on a planted sample.

## Change status after S-004

All six slices are built. **42/42 signed REQs delivered**; all 18 red-proofs landed (2 in S-000, 4 in
S-002, 12 in S-003). Whole-change `src/` diff: **6 insertions across 2 files, every one a comment line.**
