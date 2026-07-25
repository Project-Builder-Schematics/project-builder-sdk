# Slices: Runner Integrity Manifest (runner-integrity-manifest)

**Method**: SPIDR (walking skeleton + vertical slices) · **Input**: design.md §2 File Changes (18 rows,
delivery-order hint), spec.md V2 SIGNED (42 REQs / 65 scenarios / 18 red-proofs), review-qa.md (tier
plan + isolation rules), north-star.md (outcome + risks), review-tech-writer.md (frozen strings/names).

**Slice count**: **6** (S-000..S-005). Design's own Order column (1–6) maps almost 1:1 onto these six
slices — the one deliberate deviation is explained in S-000 below.

**Deviation from design's Order column, and why**: design.md line 103 states "Delivery order is a hint,
not a slice plan." Two file-changes rows are pulled OUT of their Order bucket to keep every slice
independently green:

1. **Row 11 (`pkg-surface-baseline.json`, Order 4) and row 12 (`fit-14-package-surface.test.ts`, Order
   4) move into S-000.** Reason: the moment `bun run build` first emits `dist/runner-manifest.json`
   (S-000), `fit-14-package-surface.test.ts`'s tarball-listing assertion goes red against the
   as-yet-unbaselined new file — exactly the failure design.md row 11 itself predicts ("FIT-14 goes red
   on first success without this"). If the baseline update landed in a later slice as literally ordered,
   there would be a red window between S-000 and that slice. Bundling both rows into S-000 keeps the
   suite green at every slice boundary. This is the explicit sequencing the task asked to get right.
2. **The big Order-3 bucket (rows 7, 8, 9, 10) is split into two slices (S-002, S-003)** by capability
   theme — S-002 = derivation-correctness/manifest-shape/determinism/build-pipeline (RCD, RME, RMD,
   BPI), S-003 = closure-sealing tripwires (CST, BDI) — because it is one slice's worth of *files* but
   two slices' worth of *behaviour*, and the task asks for 5–6 slices, not 4.

Everything else follows design's Order column directly: S-001 = Order 2 (rows 5–6), S-004 = Order 5
(row 13), S-005 = Order 6 (rows 14–18).

---

## Slice overview

| Slice | Title | Files (design row #) | Droppable | Status |
|---|---|---|---|---|
| **S-000** | Walking skeleton: derive → generate → build-wire → LF → FIT-14 remediation | 1, 2, 3(partial), 4, 11, 12 | **No** — foundation | **[x] built** |
| **S-001** | Baseline writer + committed closure-graph baseline | 3(partial), 5, 6 | Degraded — see below | **[x] built** |
| **S-002** | Manifest correctness, shape, determinism, build-pipeline hardening | 7(partial), 8(partial), 9(partial), 10 | **No** — core substance | **[x] built (1 criterion flagged)** |
| **S-003** | Closure-sealing tripwires + bundler/graph-drift disjointness | 7(partial), 8(partial) | **No** — the durable security value | pending |
| **S-004** | Packaged-manifest fidelity (Tier C: pack/extract/install) | 13 | Yes — cost stated below | pending |
| **S-005** | Integrity-invariants documentation + `SECURITY.md` + probe header | 14, 15, 16, 17, 18 | Yes — cost stated below | pending |

---

## S-000 — Walking skeleton: derive → generate → build-wire → LF → FIT-14 remediation

**Scope.** The thinnest real, end-to-end path: a build that derives the actual runner closure from the
actual `dist/` tree, classifies every construct in it, and emits a correct manifest — or fails closed.
This is not a stub: `deriveRunnerClosure` and `generateRunnerManifest` must be **fully correct**
implementations from the first commit, because they run against the real 23-file closure immediately.
A partial classifier would either false-positive on `authoring-error.ts`'s JSDoc `@example` (ADR-01's
verified day-one failure) or false-negative on the real `createRequire` site in
`single-instance-probe.ts` — either breaks `bun run build` itself or silently defeats the point of the
change. So the **logic** for RCD-00..05, RME-01..07 (shape/digest/ordering/serialisation), RMD-01..05
(determinism machinery), BPI-01/02/04, and CST-01..06 (deny-scan) is complete here; what's deliberately
thin is the **test surface** — a real, observable, but partial proof, with exhaustive scenario coverage
landing in S-002/S-003.

**Files touched** (design row → action):
- #1 `scripts/derive-runner-closure.ts` — **created**, full implementation.
- #2 `scripts/generate-runner-manifest.ts` — **created**, full implementation (hash-all-then-write-once,
  fail-closed, two stdout identity lines).
- #3 `package.json` — **modified, partial**: only the `build:manifest` step chained LAST into
  `scripts.build`. (The `regen:closure-baseline` half of row 3 moves to S-001, alongside the script it
  invokes — adding it here would reference a file that doesn't exist yet.)
- #4 `tsconfig.build.json` — **modified**: `"newLine": "lf"`.
- #11 `test/fitness/pkg-surface-baseline.json` — **modified** (pulled forward from Order 4): add
  `dist/runner-manifest.json` to `tarball`. **Mandatory in this slice** — see the sequencing note above.
- #12 `test/fitness/fit-14-package-surface.test.ts` — **modified** (pulled forward from Order 4): route
  its unconditional `beforeAll` build through `ensureTscBuild()` (QA Isolation §3 / design R-3). Not
  strictly required for greenness (it's a flakiness/isolation fix, not a correctness one), but bundled
  here because it's a three-line edit to a file this slice already touches, and every later slice adds
  more tests that read `dist/`, multiplying the exposure the fix closes.
- Two new test files are **created here, thin**, and **extended in S-002/S-003** (see below):
  `test/fitness/fit-42-runner-closure-integrity.test.ts` and `…negative.test.ts`.
- `test/build/build-config.test.ts` — **created/modified, partial**: the two build-wiring assertions
  only (BPI-01.1/01.2, RMD-03.1). RMD-03.3 (`.gitattributes` scope) is added later, in S-002.

**Acceptance criteria (observable)** — all 10 **[x] DONE** (see `apply-progress.md` for the proving test
per criterion):
1. [x] `bun run build` succeeds and prints exactly two stdout lines matching `BUILD_IDENTITY_LINES`
   (`runner-manifest: 24 files -> dist/runner-manifest.json` / `runner-manifest-sha256: <64 hex>`).
2. [x] `dist/runner-manifest.json` exists, parses as JSON, `manifestVersion === 1`, `algorithm === "sha256"`,
   `files.length === 24`, `entry === "dist/bin/pbuilder-runner.js"`, `packageVersion` equals root
   `package.json#version`.
3. [x] `dist/core/authoring-error.js` and `dist/core/context.js` (the two JSDoc-quoting files from ADR-01)
   appear as ordinary file records with **no violations** — the day-one false-alarm scenario, on the real
   tree, by name.
4. [x] `dist/core/engine-client.js` is **absent** from the closure and from `files`, by name (the 23-vs-24
   proof).
5. [x] A synthetic-tree unit test (`mkdtempSync`, entry→A,B; A→C; D unimported) proves `deriveRunnerClosure`
   returns exactly `{entry,A,B,C}` with **D absent, asserted by name** — the anti-tautology scenario; the
   single test QA calls "the most important addition in V2," because it's the only one a
   baseline-reading stub cannot pass.
6. [x] Independently recomputed SHA-256 (test's own hasher, not the generator's) over every file at `path`
   matches every digest in the manifest.
7. [x] The manifest's raw bytes satisfy `raw === JSON.stringify(JSON.parse(raw), null, 2) + "\n"`.
8. [x] `comparePaths` sorts the two discriminating pairs (`dist/Z.js`/`dist/a.js`,
   `dist/a-b.js`/`dist/aB.js`) in byte order, not locale order.
9. [x] `test/fitness/pkg-surface-baseline.json#tarball` contains `dist/runner-manifest.json`; FIT-14 stays
   green immediately after this slice merges — **the point of pulling row 11 forward**.
10. [x] `package.json#scripts.build` structurally contains `build:manifest` as its last `&&`-segment.

**REQ-IDs**: closes **RME-06, RME-07, BPI-01, BPI-04, PMF-03**. Partially covers (implementation
complete, exhaustive scenario matrix completed in S-002/S-003): RCD-00, RCD-01 (RCD-01.2 only), RCD-02
(RCD-02.1/02.2 only), RCD-03 (RCD-03.3 only), RME-01 (shape subset), RME-02 (RME-02.1 only), RME-05
(RME-05.2 only), RMD-03 (RMD-03.1 only).

**Red-proofs**: **RP-10** (comparePaths discriminating pairs), **RP-12** (JSDoc false-alarm inverse —
`authoring-error.ts`/`context.ts` by name).

**Test tier(s)**: A (synthetic anti-tautology tree, comparePaths pairs) + B (real `ensureTscBuild()` tree
via subprocess) + S (static reads of `package.json`, `tsconfig.build.json`, `pkg-surface-baseline.json`).

**Dependencies**: none — this is the root.

**Droppable**: **No.** Every other slice depends on the derivation/generator module existing and being
correct against the real tree.

---

## S-001 — Baseline writer + committed closure-graph baseline

**Scope.** The maintainer-only, deliberately-outside-`build` script that writes the committed
`{nodes, edges, builtins}` baseline, plus the baseline file itself (generated by that script against the
current, S-000-verified-correct closure — never hand-written).

**Files touched:**
- #5 `scripts/regen-closure-baseline.ts` — **created**. Fails if `deriveRunnerClosure` returns any
  violation (a baseline must never be regenerated from a tree that can't build).
- #6 `test/fitness/runner-closure-graph-baseline.json` — **created**, generated by #5, `{nodes, edges,
  builtins}` sorted, same `JSON.stringify(v, null, 2) + "\n"` serialisation as the manifest.
- `package.json` — **modified, remainder of row 3**: `scripts.regen:closure-baseline` entry pointing at
  #5. (Deliberately not chained into `scripts.build` — see design §1.1/ADR-02: if the build regenerated
  its own oracle, BDI-03 could never fire.)

**Acceptance criteria (observable)** — all 4 **[x] DONE** (see `apply-progress.md` for the proving test
per criterion):
1. [x] `bun run regen:closure-baseline` writes `test/fitness/runner-closure-graph-baseline.json` with exactly
   the three keys `{nodes, edges, builtins}`, each sorted.
2. [x] Run against the current (unmodified) tree, the written baseline is **byte-identical** to a fresh
   `deriveRunnerClosure` call's `{nodes, edges, builtins}` — self-consistency at creation time.
3. [x] Run against a tree whose derivation returns violations, the script **fails** (non-zero exit, no file
   written) rather than committing a broken baseline.
4. [x] `package.json#scripts.regen:closure-baseline` is **not** part of `scripts.build`'s `&&` chain.

**REQ-IDs**: partially covers **BDI-03** (the baseline artefact exists and is self-consistent at
creation; the red-proofs that prove the check **fires** on drift — RP-2/RP-2b/RP-2c — need the negative
test file and land in S-003). Unblocks (does not itself close) **RCD-01** (RCD-01.1 needs this baseline
to compare against) and **RCD-04** (RCD-04.1 needs the `builtins` row) — both close in S-002.

**Red-proofs**: none new (the drift-detection red-proofs live in S-003, once the negative-test file
exists to plant them).

**Test tier(s)**: B (invoke the script against the real tree) + S (structural check that the npm script
exists but isn't chained into `build`).

**Dependencies**: S-000 (needs `deriveRunnerClosure` to exist and be correct — a baseline regenerated
from a broken/partial derivation is worse than no baseline).

**Droppable**: **Degraded, not clean.** Dropping S-001 removes one of ADR-03's three Constraint-1 legs
(the closure-graph baseline; graph-preserving emit and bundler-output disjointness — both in S-003 —
would remain). It also blocks RCD-01.1 and RCD-04.1's real-tree scenarios in S-002 (those two scenarios
would have to be cut too, or fall back to "derived set is non-empty and contains the entry," a much
weaker assertion). The primary build-time guarantees (S-000 + S-003's CST tripwires) survive without it,
but a maintainer could silently rewrite the closure graph (add/remove/redirect edges without touching a
tripwire) and CI would not notice. Recommended only as an emergency scope cut, not a planned one.

---

## S-002 — Manifest correctness, shape, determinism, build-pipeline hardening

**Scope.** Extends the two fit-42 files (created thin in S-000) and `test/build/build-config.test.ts`
with the full RCD/RME/RMD/BPI scenario matrices; creates the FIT-23 extension for the publish-ordering
property. This is where "the manifest is correct, deterministic, and safely produced" becomes a proven
property rather than an assumption.

**Files touched:**
- #7 `test/fitness/fit-42-runner-closure-integrity.test.ts` — **extended**: remaining RCD (real-tree),
  RME, RMD, BPI-02/04 Tier-B scenarios.
- #8 `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` — **extended**: remaining RCD, RME,
  RMD Tier-A scenarios and their red-proofs.
- #9 `test/build/build-config.test.ts` — **extended**: RMD-03.3 (`.gitattributes` normalises `src/**` to
  LF, no `-text` exception covering it — assert the committed `-text` line's scope is `test/dialects/**`
  only).
- #10 `test/fitness/fit-23-publish-workflow-guard.test.ts` — **modified**: BPI-03.1's publish-ordering
  property (`publish.yml` parsed structurally; version stamp precedes build, or a rebuild occurs between
  stamp and publish). No new home — extends the existing file, per review-tech-writer §4 flag 3.

**Acceptance criteria (observable)** — 17 of 18 **[x] DONE**; criterion 10's `RMD-01.2` half is
**[!] UNPROVABLE AS WRITTEN under Bun** (see `apply-progress.md` S-002 → Halt). Proving test per
criterion in `apply-progress.md`:
1. [x] `RCD-01.1`: derived closure (real tree) equals the S-001 baseline as a set of paths.
2. [x] `RCD-01.3`/`RCD-01.4`: synthetic cycle terminates at `{entry,A,B}`; zero-import entry yields exactly 1.
3. [x] `RCD-02.3`: a synthetic `./x.mjs` specifier is followed (not filtered by `.js`-only).
4. [x] `RCD-03.1`/`03.2`/`03.4`/`03.5`: unclassifiable construct, unresolvable specifier (RP-13), query
   suffix, and unreadable file (mode 000, skipped under uid 0) each fail the build naming the right facts.
5. [x] `RCD-04.1`: observed builtin set equals the baseline's `builtins` row (never a literal list).
6. [x] `RCD-05.1`: a specifier resolving through a symlink escaping the root fails as `symlink-escape`.
   *(Already proven by the S-000 Tier-A test of the same name; not duplicated.)*
7. [x] `RME-01.3`: exact top-level and per-record key sets (kills a smuggled `generatedAt` field).
8. [x] `RME-02.2`: known-answer digest vectors (empty file, single `\n`) match published constants.
9. [x] `RME-03.1`/`RME-04.1`/`RME-05.1`: exclusions, path hygiene, and real-tree ordering all hold.
10. [x] `RMD-01.1` / **[!] `01.2`**: two consecutive builds produce byte-identical manifests **[x]**;
    two child processes under different `LC_ALL` values **[!]** — the runs agree, but under Bun no locale
    env var moves the default collator (`Intl.Collator()` resolves `en-US` under `LC_ALL`, `LANG` and
    `LC_COLLATE` alike, verified), so the scenario cannot discriminate `localeCompare` from
    `Buffer.compare`. NOT weakened, NOT claimed as passing. The mutation it targets is independently
    killed by `RME-05.2`'s pinned pairs (S-000). Needs an owner ruling.
11. [x] `RMD-02.1`: a copied root whose path contains a space AND a non-ASCII segment, generator-only re-run,
    matches the canonical bytes.
12. [x] `RMD-03.2`/`03.4`: a test-time-generated CRLF fixture and a BOM-prefixed fixture each fail the check
    (RP-9); no closure file begins with `EF BB BF`.
13. [x] `RMD-04.1`: on a **copy** of the built tree, appending one byte to `dist/core/session.js` and
    regenerating there changes exactly one record's digest, 23 others unchanged, length/order unchanged
    (RP-1) — never touches the real memoized `dist/`.
14. [x] `RMD-05.1`: manifest bytes contain neither `process.cwd()` nor `os.userInfo().username`.
15. [x] `BPI-02.1`: generator invoked **directly** (never via `bun run build`) against a prepared root that
    already has a manifest plus a planted violation → exit ≠ 0, **no manifest remains**.
16. [x] `BPI-02.2`: a closure file made unreadable mid-derivation → exit ≠ 0, **no file at all** at the
    manifest path.
17. [x] `BPI-03.1`: `publish.yml` parsed with `YAML.parse` proves the ordering property holds today.
18. [x] `RMD-03.3`: `.gitattributes` scope assertion passes.

**REQ-IDs**: closes **RCD-01, RCD-02, RCD-03, RCD-04, RCD-05, RME-01, RME-02, RME-03, RME-04, RME-05,
RMD-01, RMD-02, RMD-03, RMD-04, RMD-05, BPI-02, BPI-03**. (RCD-00 reinforced structurally via the same
Tier-A exported-surface assertion.)

**Red-proofs**: **RP-1** (byte-append tamper localisation), **RP-9** (CRLF), **RP-11** (duplicate/
absolute/`..` path), **RP-13** (unresolvable specifier).

**Test tier(s)**: A + B, per §5 of design.md. Uses the memoized `ensureTscBuild()` (now routed correctly
per S-000's FIT-14 fix) for every Tier-B case; each mutating case gets its own `scratchDirFactory()` root.

**Dependencies**: S-000 (derive/generate modules, thin fit-42 files, build-config.test.ts to extend),
S-001 (RCD-01.1 and RCD-04.1 need the committed baseline).

**Droppable**: **No.** This is the bulk of the change's correctness surface — determinism, atomicity,
fail-closed behaviour, and the publish-ordering property that makes BPI-03 more than a YAML-shape check.
Dropping it leaves a manifest that *exists* but has no proof it's correct, deterministic, or safe to
produce under failure.

---

## S-003 — Closure-sealing tripwires + bundler/graph-drift disjointness

**Scope.** Extends the same two fit-42 files with the CST deny-scan scenarios (bare specifier, unprefixed
builtin, dynamic-import site-scoping, `createRequire`/`eval`/`vm`/`Bun.plugin`/`process.binding` ban) and
the BDI scenarios (graph-preserving emit, bundler-output disjointness, and — depending on S-001's
baseline — the drift red-proofs RP-2/2b/2c). This is the slice the north-star memo names as carrying "the
durable security value... even if the manifest itself were retired tomorrow."

**Files touched:**
- #7 `test/fitness/fit-42-runner-closure-integrity.test.ts` — **extended**: CST-03.3, CST-04.3, CST-05.1
  real-tree scenarios; BDI-01.1, BDI-02.1..03, BDI-03.1 (baseline comparison, B-tier half).
- #8 `test/fitness/fit-42-runner-closure-integrity.negative.test.ts` — **extended**: CST-01.1, CST-02.1,
  CST-03.1/03.2, CST-04.1/04.2/04.4, CST-05.1, CST-06.1 synthetic scenarios; BDI-01.1's red-proof (RP-8);
  BDI-03.1's drift red-proofs (RP-2, RP-2b, RP-2c).

**Acceptance criteria (observable):**
1. A bare third-party specifier planted synthetically (A) and in a copied real tree (B, the one real-tree
   negative per QA's tier rule) both fail the build, no manifest, message names src path/line/specifier/
   "Constraint 3" (RP-4).
2. One fixture containing both `"fs"` and `"node:fs"` produces **exactly ONE** violation naming only
   `"fs"` — proves the rule is on the prefix, not a name allowlist (RP-5).
3. A dynamic `import()` outside `runner.ts` fails (RP-3); a **second** one inside `runner.ts` also fails,
   naming the sanctioned site and the per-SITE clause (RP-3b); on the real tree, the dynamic-import count
   is exactly 1 in `dist/transport/runner.js` and 0 elsewhere, with the `SANCTIONED-FACTORY-IMPORT`
   marker present.
4. `createRequire` direct call (RP-7), indirect-variable and namespace-import forms (RP-7b), and
   `eval`/`new Function`/`node:vm`/`Bun.plugin`/`process.binding` (RP-7c) all fail, naming which form; on
   the real tree the deny-scan reports zero violations and the anchored `single-instance-probe.ts` site
   is not flagged.
5. Neither `dist/package.json` nor `dist/bin/package.json` exists; a planted `dist/package.json`
   red-proof states it redirects with no digest change (RP-6).
6. Every violation's rendered text is asserted by substring (rule/why/fix/no-manifest line), plus a shape
   test over the closed `ViolationRule` set.
7. Every `--outfile`/`--outdir` (by directory containment)/`-o` target in `package.json#scripts` is
   outside the closure path set, non-vacuous because `dist/bin/pbuilder-codegen.js` is present and
   correctly judged outside; a planted `--outdir dist/transport` + `-o` short form both fail disjointness
   (RP-8).
8. For each closure `.js`, its relative-specifier multiset equals its `.ts` source's after `.ts→.js`
   rewriting, modulo type-only erasure; `session.ts`/`stdio-engine-client.ts`'s type-only imports are NOT
   flagged.
9. Adding a node (RP-2), removing a node/edge (RP-2b), or redirecting an edge with the node set unchanged
   (RP-2c — "the real closure-sealing case") each fails the baseline comparison, naming the offender.

**REQ-IDs**: closes **CST-01, CST-02, CST-03, CST-04, CST-05, CST-06, BDI-02**, and the `.1` half of
**BDI-01** (BDI-01.2, the docs out-of-scope statement, completes in S-005). Closes the remainder of
**BDI-03** (the drift-fires red-proofs; S-001 only established the artefact).

**Red-proofs**: **RP-2, RP-2b, RP-2c, RP-3, RP-3b, RP-4, RP-5, RP-6, RP-7, RP-7b, RP-7c, RP-8** (12 of
18 — the majority, matching the north-star's assessment that this is where the security value lives).

**Test tier(s)**: A (the bulk — synthetic fixtures for every deny-scan rule) + B (CST-03.3/04.3/05.1 real
tree, BDI-01.1/02.1 real tree, BDI-03.1 baseline comparison).

**Dependencies**: S-000 (deny-scan logic must already be correct against the real
`single-instance-probe.ts` anchor and the real sanctioned dynamic-import site), S-001 (BDI-03's drift
red-proofs need the committed baseline to diff against).

**Droppable**: **No.** Per north-star.md's outputs-vs-outcome finding: "the durable security value is
the tripwires... they are worth keeping even if the manifest itself were retired tomorrow." Constraint 4
in particular was adopted into the engine's own mirror check and called the correction that mattered
most. Dropping this slice ships a correct-but-unguarded manifest — S-000/S-002 prove the JSON is right,
but nothing stops the next PR from reintroducing a bare specifier or a second `createRequire`.

---

## S-004 — Packaged-manifest fidelity (Tier C: pack / extract / install)

**Scope.** The one packaging-boundary test file: `npm pack` (normative for PMF, matching `publish.yml`),
extract, verify 24 digests against extracted bytes, plant the version-rewrite red-proof, then
`npm install ./<tarball>` into a temp project and verify against the **installed** tree.

**Files touched:**
- #13 `test/e2e/runner-manifest-packaged.e2e.test.ts` — **created**.

**Acceptance criteria (observable):**
1. `npm pack --dry-run`'s file list contains `dist/runner-manifest.json` (PMF-01).
2. Extracting the tarball (stripping the `package/` prefix) and recomputing all 24 digests against the
   extracted bytes matches (PMF-02.1).
3. Build → rewrite `package.json#version` → `npm pack --ignore-scripts` → entry #24's digest
   **MISMATCHES**, naming the field — the actual behavioural proof of the publish-ordering property
   (PMF-02.2).
4. `npm pack` → `npm install ./<tarball>` into a temp project → entry #24 recomputed against
   `node_modules/@pbuilder/sdk/package.json` **matches** (`npm-normalize-package-bin` is a known rewriter
   and this package has a `bin` field) (PMF-02.3).
5. On a missing/unreachable registry, the test **fails loudly** — it never silently skips (R-2's binding
   rule: a silent skip false-passes the one scenario covering the production install path).

**REQ-IDs**: closes **PMF-01, PMF-02**. (PMF-03 already closed in S-000.)

**Red-proofs**: none of the 18 named red-proofs are Tier C — PMF-02.2/02.3 ARE the behavioural proofs for
this capability but aren't numbered RP-N in spec.md's red-proof table (they're REQ scenarios in their own
right).

**Test tier(s)**: C exclusively (`npm pack`, extract, `npm install`).

**Dependencies**: S-000 (needs the manifest emitted correctly and `pkg-surface-baseline.json` already
updated — the sequencing this plan protects). Does not depend on S-002/S-003's exhaustive scenario
coverage to run, though shipping it before those land would mean packaging a manifest whose correctness
isn't yet proven — sequence after S-002 at minimum.

**Droppable**: **Yes, at a stated cost.** Per north-star.md risk #4: "PMF-02.3 is the only scenario
covering the production install path... the outcome risk is not the flake — it is the pressure to quiet
it." Dropping this slice means the change ships without ever having proven `npm-normalize-package-bin`
(a known rewriter, and this package has a `bin` field) doesn't silently corrupt entry #24 on a real
install — the single highest-consequence escape review-qa found (escape #23). Recommended only if Tier
C's network dependency (~25% CI flakiness on pack-based harnesses per R-2) makes it genuinely unshippable
in this cycle; register as a MANDATORY pre-`0.1.0` followup if cut, per the spec's own Release Checklist.

---

## S-005 — Integrity-invariants documentation + `SECURITY.md` + probe header

**Scope.** The machine-guarded docs page (five Constraints, each with a resolvable `enforced-by:`),
its link from `docs/README.md`, the structural+substring guard test, the `SECURITY.md` scope-limiting
subsection, and the one `src/` header sentence.

**Files touched:**
- #14 `docs/runner-integrity-invariants.md` — **created**.
- #15 `docs/README.md` — **modified**: link under *Contributor notes*.
- #16 `test/docs/runner-integrity-docs.test.ts` — **created**.
- #17 `SECURITY.md` — **modified**: the three-sentence subsection (§9 `SECURITY_SUBSECTION`).
- #18 `src/transport/single-instance-probe.ts` — **modified**: one header sentence (§9
  `PROBE_HEADER_SENTENCE`). **The only `src/` change in this entire program — do not touch the file's
  logic.**

**Acceptance criteria (observable):**
1. The docs page lists exactly **five** Constraints, each with an `enforced-by:` field naming either a
   FIT id that **exists as a file on disk** (`existsSync`) or the literal `engine-owned` — resolved
   structurally, not by prose match. This requires `fit-42-*`, `fit-23-*`, and the other named files to
   already exist, which is why this slice depends on S-002/S-003.
2. Constraint 2 is stated in its resolved **site-scoped** form (ambiguity D); the engine's looser
   "infrastructure path" wording is asserted **absent**.
3. Constraints 4 and 5 carry `SDK-added`/`engine-owned` on first use; no bare-number Constraint citation
   anywhere on the page.
4. The scope paragraph names all five excluded trees (`dist/commons/**`, `dist/dialects/**`,
   `dist/conformance/**`, `dist/testing/**`, `node_modules/**`); the supplied pull-quote sentence appears
   exactly once.
5. The justification's three frozen claims (wrong-artefact detection, tripwires independent of the
   manifest, install-script adversary) are present verbatim.
6. Entry #24 is justified by `"type": "module"`; `packageRootFor()` is asserted **absent** as a
   justification.
7. The `bun link` build-consistency-check sentence and the C2 residual are both present.
8. `SECURITY.md` carries the three-sentence subsection, unchanged from review-tech-writer's draft.
9. `single-instance-probe.ts`'s header contains the frozen pointer sentence naming `fit-42`; a diff of
   the file shows **zero** logic changes, header-only.
10. `docs/README.md` links the new page under *Contributor notes*.

**REQ-IDs**: closes **IID-01, IID-02, IID-03, IID-04, IID-05, IID-06, IID-07, IID-08**, and the `.2` half
of **BDI-01** (BDI-01.2 — non-`scripts` bundler surfaces explicitly out of scope, completing the REQ that
S-003 opened).

**Red-proofs**: none — Capability 8 is entirely Tier S (structural/substring parses of committed
documents), and BDI-01.2 is a documentation assertion, not a red-proof.

**Test tier(s)**: S exclusively.

**Dependencies**: S-002 and S-003 (IID-01.1's `existsSync` check needs `fit-42-*.test.ts`,
`fit-23-*.test.ts` etc. to already be on disk — a doc that names a test file that doesn't exist yet is
exactly the "prose passes, code doesn't" escape review-qa closed with IID-01.1). Does not depend on S-004
(no Constraint's `enforced-by:` names the e2e file).

**Droppable**: **Yes, technically — but breaks spec completeness.** No runtime/build/CI mechanism depends
on this slice; dropping it costs nothing to enforcement. It does, however, leave Capability 8 (8 of the
signed spec's 42 REQs) unimplemented, which means the spec is no longer fully delivered — dropping this
requires an explicit spec unfreeze/scope renegotiation with the owner, not a silent cut. It is also the
slice review-tech-writer's whole review exists to protect: the honest-scope paragraph is what stops a
future reader from believing "the manifest verifies the SDK."

---

## Dependency order

```
S-000 (walking skeleton + FIT-14 remediation)
  │
  ├──► S-001 (baseline writer + baseline)
  │       │
  │       ▼
  ├──► S-002 (correctness/shape/determinism/build-pipeline) ◄── needs S-001 for RCD-01.1/RCD-04.1
  │       │
  │       ▼
  │    S-003 (closure-sealing tripwires + disjointness) ◄── needs S-001 for BDI-03's drift red-proofs
  │       │
  │       ├──► S-004 (Tier C packaging)              [sequence after S-002; independent of S-003/S-005]
  │       │
  │       └──► S-005 (docs) ◄── needs S-002 + S-003 for existsSync() over fit-42/fit-23 files
```

Strict merge order for a single-threaded build: **S-000 → S-001 → S-002 → S-003 → {S-004, S-005 in
either order}**. S-004 and S-005 could run in parallel once S-003 lands (S-004 only needs S-000; S-005
needs S-002+S-003) but S-004 does not need S-005 or vice versa.

---

## Requirement coverage check — all 42 REQ-IDs

| REQ | Owning slice(s) | REQ | Owning slice(s) |
|---|---|---|---|
| RCD-00 | S-000 (proof) / S-002 (reinforced) | RME-06 | **S-000 (closes)** |
| RCD-01 | S-000 (partial: .2) → **S-002 (closes)** | RME-07 | **S-000 (closes)** |
| RCD-02 | S-000 (partial: .1/.2) → **S-002 (closes)** | RMD-01 | **S-002 (closes)** |
| RCD-03 | S-000 (partial: .3) → **S-002 (closes)** | RMD-02 | **S-002 (closes)** |
| RCD-04 | **S-002 (closes)**, dep S-001 | RMD-03 | S-000 (partial: .1) → **S-002 (closes: .2/.3/.4)** |
| RCD-05 | **S-002 (closes)** | RMD-04 | **S-002 (closes)** |
| RME-01 | S-000 (partial: shape subset) → **S-002 (closes: .3)** | RMD-05 | **S-002 (closes)** |
| RME-02 | S-000 (partial: .1) → **S-002 (closes: .2)** | BPI-01 | **S-000 (closes)** |
| RME-03 | **S-002 (closes)** | BPI-02 | **S-002 (closes)** |
| RME-04 | **S-002 (closes)** | BPI-03 | **S-002 (closes)** |
| RME-05 | S-000 (partial: .2) → **S-002 (closes: .1)** | BPI-04 | **S-000 (closes)** |
| CST-01 | **S-003 (closes)** | BDI-01 | S-003 (partial: .1) → **S-005 (closes: .2)** |
| CST-02 | **S-003 (closes)** | BDI-02 | **S-003 (closes)** |
| CST-03 | **S-003 (closes)** | BDI-03 | S-001 (artefact) → **S-003 (closes: drift-fires)** |
| CST-04 | **S-003 (closes)** | PMF-01 | **S-004 (closes)** |
| CST-05 | **S-003 (closes)** | PMF-02 | **S-004 (closes)** |
| CST-06 | **S-003 (closes)** | PMF-03 | **S-000 (closes)** |
| IID-01 | **S-005 (closes)** | IID-05 | **S-005 (closes)** |
| IID-02 | **S-005 (closes)** | IID-06 | **S-005 (closes)** |
| IID-03 | **S-005 (closes)** | IID-07 | **S-005 (closes)** |
| IID-04 | **S-005 (closes)** | IID-08 | **S-005 (closes)** |

**Result: COMPLETE.** All 42 REQ-IDs appear above; every REQ has a slice where it is fully closed
(bold). No REQ is orphaned or left permanently partial. Cross-slice REQs (RCD-00..03, RME-01/02/05,
RMD-03, BDI-01, BDI-03) are compound — S-000 or S-001 lands a real down payment, the closing slice
finishes the scenario matrix — never a gap, always a documented handoff.

## Red-proof coverage check — all 18

| Tier grouping | Red-proofs | Slice |
|---|---|---|
| Anti-tautology + JSDoc inverse + ordering pairs | RP-10, RP-12 | S-000 |
| Correctness/determinism | RP-1, RP-9, RP-11, RP-13 | S-002 |
| Closure-sealing / drift | RP-2, RP-2b, RP-2c, RP-3, RP-3b, RP-4, RP-5, RP-6, RP-7, RP-7b, RP-7c, RP-8 | S-003 |

2 + 4 + 12 = **18. Complete.**

---

## Handover point (engine unblock)

**North-star.md**: "the engine, before every spawn, reads `dist/runner-manifest.json`... After this
change it finds a valid file. That is the whole gate." The owner's answer to conscience question 1
accepts the engine integrating against a **`bun link`ed build now**, with the manifest self-asserted on
that path per IID-06.

- **Technically possible after S-000**: a real, correct manifest exists and `bun link` would pick it up.
- **Recommended handover point: after S-003.** Before S-002/S-003 land, "correct" rests only on S-000's
  proof subset — determinism across locale/path (RMD-01/02), atomicity under failure (BPI-02), and every
  closure-sealing tripwire (CST-01..06) are unverified. Handing the engine a manifest before those close
  risks exactly the outcome north-star.md flags as unrecoverable (R-1: "100% of a release's users fail
  closed with no workaround"). Once S-003 merges, every mechanism the manifest's guarantee depends on has
  a red-proof behind it.
- S-004 (packaging fidelity) and S-005 (docs) are **not** required for the engine handover itself — they
  harden the release boundary and the documentation contract respectively, not the `bun link` path
  north-star.md describes as the near-term integration route.

---

## Risks introduced by the slicing itself

| # | Risk | Mitigation |
|---|---|---|
| 1 | **S-000's partial fit-42 files get merge-conflicted by S-002/S-003's extensions** if worked concurrently by different engineers. | Sequence strictly (see Dependency order); if parallelised, S-002 and S-003 should each own a clearly delimited `describe` block from the start. |
| 2 | **A reviewer sees "partial REQ coverage" on S-000/S-001 and reads it as a gap.** | This document's coverage table makes every partial→closes handoff explicit; `sdd-verify --mode=plan` should check the table, not each slice in isolation. |
| 3 | **Pulling FIT-14 rows into S-000 makes the walking skeleton touch more files than design's row count implies (6 vs. the intuitive 4).** | Justified above — the alternative is a red CI window between S-000 and whichever slice was going to carry rows 11/12; a wider S-000 is strictly better than a red build. |
| 4 | **S-003's droppable:no verdict conflicts with a scope-shrink request under real time pressure.** | If CST/BDI genuinely must be cut, the correct fallback is shipping S-000+S-001+S-002 as a manifest-only release with the docs page (S-005) stating that the tripwires are **not yet enforced** — never ship S-005's Constraint list claiming enforcement that S-003 didn't land. This is a scope call for the owner, not a silent default. |

---

## Open questions

None blocking. One forward note: S-004's droppability recommendation (register as a MANDATORY pre-`0.1.0`
followup if cut) mirrors the spec's own Release Checklist language verbatim — `sdd-slice` did not invent
new policy here, just applied the existing one to a slice-level decision.
