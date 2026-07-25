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
| `test/fitness/runner-closure-graph-baseline.json` | created | **Generated by the script**, never hand-written: `bun run build && bun run regen:closure-baseline`. 23 nodes, 22 edges, 6 builtins. |
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
