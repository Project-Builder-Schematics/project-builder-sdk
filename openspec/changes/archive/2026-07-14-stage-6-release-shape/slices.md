# Slices: Stage 6 — Release shape & DX closure

**Rev 3** (plan-verify iteration 2 — appendix items 16-18 added: baseline regen procedure, SHA pin values+policy, dialect doc link target)

**Triage**: L · **Specs**: local-consumption V2, publish-pipeline-hardening V3 (07/08 deferred), author-onboarding-docs V2, factory-package-shape V2 · **6 slices** (1 skeleton + 5 SPIDR) · **Coverage**: 25/25 REQs, 52/52 scenarios

---

## S-000: Walking Skeleton — bun-link install → typed factory, end to end

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing · **Cuttable**: No · **Size**: L
**Covers**: PPH-04.1, PPH-05.1, LC-01 (1.1-.2), LC-04.2, LC-05.1
**Test layers**: e2e + unit

**Acceptance**: GIVEN a fresh build, WHEN a sibling consumer runs `bun run link:sdk`, imports 5 subpaths, invokes `dryRun()`, probes `/core`, THEN subpaths + bin resolve, `dryRun()` non-empty, `/core` unreachable, `bun unlink` clean.

### Tasks
- [x] S-000.1 Extract `test/support/scratch-consumer.ts` (build/pack/install/link + `runScratchScript`)
- [x] S-000.2 `package.json`: `prebuild` clean + `link:sdk` script (ADR-0041); `tsconfig.build.json`: `declarationMap: false`
- [x] S-000.3 `build-config.test.ts` (new, failing first)
- [x] S-000.4 `installed-consumer.e2e.test.ts`: bun-link leg — failing first

---

## S-001: Bun-link founding-bug parity + tarball `./typescript` extension

**Scope**: happy-path · **Dimension**: P (Path) · **Requires**: (S-000 implicit) · **Cuttable**: No · **Size**: M
**Covers**: LC-02 (2.1-.3), LC-03.1, LC-04.1/.3[red], LC-05.2/.3[red]
**Test layers**: e2e

**Acceptance**: GIVEN the bun-link leg, WHEN write-only-commit/all-or-nothing-rejection scenarios run and tarball resolves `./typescript`, THEN both legs assert the SAME set (count parity), red-proofs catch breakage.

### Tasks
- [x] S-001.1 Bun-link leg: write-only commit + all-or-nothing rejection — failing first
- [x] S-001.2 Tarball leg: add `./typescript` probe
- [x] S-001.3 Bin-exec + `dryRun()` red-proofs

---

## S-002: Publish pipeline hardening (never-fired, mutation-resistant)

**Scope**: happy-path · **Dimension**: R (Rule) · **Requires**: (S-000 implicit, PPH-06 sequencing) · **Cuttable**: No · **Size**: L
**Covers**: PPH-01 (1.1-.3), PPH-02 (2.1-.2), PPH-03 (3.1-.2), PPH-05.2, PPH-06.1, FPS-06.1, FPS-07 (7.1-.2)
**Test layers**: architectural

**Acceptance**: GIVEN `publish.yml`/`ci.yml` + fresh tarball, WHEN `fit-21` (Bun `YAML.parse`, job-by-predicate) and `fit-14` run, THEN guard + SHA pins + trigger-fence + `--dry-run` hold, baseline has zero `.d.ts.map`, `dist/core/**` present, no secrets.

### Tasks
- [x] S-002.1 `fit-23-publish-workflow-guard.test.ts` (renamed from `fit-21` — see note below) + `fit-14-package-surface.test.ts` additions — failing first
- [x] S-002.2 Harden `publish.yml` (guard, SHA pins, job-scoped `id-token`, trigger pin) + `ci.yml` SHA-pin
- [x] S-002.3 Regenerate `pkg-surface-baseline.json` against clean build (after S-000)

**Naming deviation (apply-time)**: `fit-21`/`fit-22` are now taken by `fit-21-context-no-dialect-handle-import.test.ts`
and `fit-22-scaffold-leaf-rule.test.ts` (landed on `main` from `stage-5b-dialect-breadth`/`schematic-local-files`
after this change's plan-verify iteration 1). Per this file's own Executor Context preamble ("trust the repo, not
this doc"), the new fitness test was created as `fit-23-publish-workflow-guard.test.ts` — same content/coverage,
next actually-free FIT number. `design.md`/ADR-0042 still reference the `fit-21` name; this is the authoritative
correction.

---

## S-003: Quickstart — docs-only path to a passing typed factory

**Scope**: happy-path · **Dimension**: I (Interface) · **Requires**: (S-000 implicit) · **Cuttable**: No · **Size**: L
**Covers**: AOD-01 (1.1-.3), AOD-02 (2.1-.2), AOD-07 (7.1-.2), AOD-11 (11.1-.2), AOD-08.1
**Test layers**: e2e + typecheck

**Acceptance**: GIVEN quickstart's fenced blocks + a scratch consumer, WHEN the machine leg runs them against the linked/installed package and `tsc --noEmit` runs inside it, THEN both pass, no `src/`-relative swap occurs, walkthrough-record template exists.

### Tasks
- [x] S-003.1 `quickstart-docs.test.ts` (new, failing first): machine leg + consumer-tsc leg + install checks
- [x] S-003.2 `docs/quickstart.md`: schema → codegen → typed `factory.ts` → passing test; link first, tarball alt
- [x] S-003.3 Scaffold `walkthrough-record.md` (owner fills at reckoning)

---

## S-004: Reference docs — verbs, errors, dry-run, index, front-door

**Scope**: happy-path · **Dimension**: D (Data) · **Requires**: S-003 · **Cuttable**: No · **Size**: M
**Covers**: AOD-03.1, AOD-04.1, AOD-05.1, AOD-06 (6.1-.2), FPS-06.2
**Test layers**: unit

**Acceptance**: GIVEN the reference doc set, WHEN scanned for the six verbs + read-trichotomy, `AuthoringError` vocabulary, `dryRun()` import/iteration, dialect link, THEN all present in author vocabulary, dialect linked not duplicated, README states the `dist/core` rationale.

### Tasks
- [x] S-004.1 `doc-set-content.test.ts` (new, failing first): verb/error/dry-run/dialect tokens + FPS-06.2
- [x] S-004.2 `docs/authoring-verbs.md`, `authoring-errors.md`, `dry-run.md`, `docs/README.md`
- [x] S-004.3 `README.md`: quickstart link, dialect front-door, `dist/core` rationale

**Vocabulary-drift note (apply-time)**: the plan's Executor Context item 6 (2026-07-12) recorded
`AuthoringVerb` at six values and `AuthoringReason` at eight. `schematic-local-files` landed on
`main` after that (merge visible in this branch's own git log) and extended them to seven
(`copyIn` added, ADR-0043) and twelve (four new `source-*` reasons, REQ-AEC-10) respectively. Per
this file's own Executor Context preamble ("trust the repo, not this doc"), `authoring-verbs.md`
documents all seven current verbs (REQ-AOD-03 names six as a floor, not a ceiling — satisfied by a
superset) and `authoring-errors.md` documents all twelve current `reason` values. Same category of
correction as S-002's fit-23 rename.

---

## S-005: Planning-doc reconciliation

**Scope**: edge-case · **Dimension**: D (Data) · **Requires**: S-002, S-004 · **Cuttable**: No · **Size**: M
**Covers**: AOD-09 (9.1-.6), AOD-10.1, AOD-12 (12.1-.3)
**Test layers**: unit

**Acceptance**: GIVEN the planning docs, WHEN inspected, THEN rows 27/33/34/35/86/143 retired, 74/56/142/175 re-tagged, ROADMAP states readiness not a release, demo calls `dryRun()` first, sensitive-areas reflects S-002's posture, drops the blanket-wrong line.

### Tasks
- [x] S-005.1 Extend `doc-set-content.test.ts`: planning-doc + sensitive-areas assertions — failing first
- [x] S-005.2 `ROADMAP.md`, `pending-changes.md`, `problem-statement.md`, `objectives-plan.md`, `sensitive-areas.md`

---

## Build Order

| Order | Slice(s) | Note |
|---|---|---|
| 1 | S-000 | skeleton — blocker for all |
| 2 | S-001, S-002, S-003 | parallel after S-000 |
| 3 | S-004 | requires S-003 |
| 4 | S-005 | requires S-002 + S-004 |

## Executor Context (read this first)

> **Note (plan-verify iteration 1 ruling)**: `sdd-slice`'s <800-word budget applies to the
> **slice blocks above** (S-000..S-005 + Build Order), not to this appendix. This section is a
> reference appendix resolving Judge B's 16 executor-self-sufficiency questions in place — it
> is expected to exceed the budget and is exempted by explicit iteration-1 ruling (see
> `verify-plan-1.md`, gap G-3).

Every item below was verified against the repo as it stands at plan-verify iteration 1
(2026-07-12). Where the repo disagreed with a first-draft assumption, the discrepancy is
flagged inline — trust the repo, not this doc, if they ever diverge again.

### 1. Where the law lives

Read these BEFORE starting any slice, in this order:

- The four signed specs, REQ bodies + Given/When/Then — this is the actual contract text,
  the slices above only cite REQ-IDs:
  - `openspec/changes/stage-6-release-shape/specs/local-consumption/spec.md` (V2, signed)
  - `openspec/changes/stage-6-release-shape/specs/publish-pipeline-hardening/spec.md` (V3, signed — REQ-PPH-07/08 present but struck through/DEFERRED, see item 12)
  - `openspec/changes/stage-6-release-shape/specs/author-onboarding-docs/spec.md` (V2, signed)
  - `openspec/changes/stage-6-release-shape/specs/factory-package-shape/spec.md` (V2, signed, delta-format — ADDED Requirements only)
- `openspec/changes/stage-6-release-shape/design.md` — **rev 3** (not rev 5; verified against
  the file's own H1). Section 4.2 File Changes and 4.6 Test Derivation are the file-level
  contract; read those two tables before touching any file.
- `openspec/decisions/0041-bun-link-consumption-contract.md` — the `link:sdk` script + no-`prepare` ritual semantics (S-000/S-001).
- `openspec/decisions/0042-publish-rehearsal-interlock.md` — the three-part guard mechanics (S-002).
- `openspec/decisions/0034-shipped-fake-containment.md` — read the **AMENDMENT** block at the bottom (draft, `stage-6-release-shape`, dated 2026-07-12): `dist/core/**` document-not-strip + `declarationMap: false` (S-000/S-002).

### 2. The 5 subpaths, by name

Verified against `package.json#exports` (current file): exactly `.`, `./commons`,
`./conformance`, `./testing`, `./typescript` — no more, no less (also pinned by
`fit-09-pkg-exports-resolution.test.ts:75-77` and FIT-14). `./typescript` resolves to
`./dist/dialects/typescript/index.js` (types: `./dist/dialects/typescript/index.d.ts`) — the
built TypeScript dialect entry, exporting the dialect surface (`ast.ts`/`ops.ts`/`index.ts`
under `src/dialects/typescript/`).

### 3. `/core` unreachable vs `dist/core/**` present — NOT a contradiction

Confirmed, not a contradiction. `dist/core/**` ships physically in the tarball (verified in
`test/fitness/pkg-surface-baseline.json`'s `tarball` array — 20 `dist/core/**` entries
present today) because `./testing`'s runtime code (`src/testing/index.ts`, re-exporting
`defineFactory`) imports `../core/context.ts` at runtime — `dist/testing/index.js` needs
`dist/core/context.js` physically on disk. But `package.json#exports` has **no `"./core"`
key** (confirmed: `fit-09-pkg-exports-resolution.test.ts:71-72` asserts
`pkgJson.exports["./core"]` is `undefined`), so subpath resolution fails — Node/Bun's
`exports` map gates resolution independently of what physically exists on disk. Ship-but-
don't-map, per the ADR-0034 amendment (item 1 above).

### 4. scratch-consumer extraction source

`test/e2e/installed-consumer.e2e.test.ts` (268 lines) is the extraction source — there is
**no** `test/support/scratch-consumer.ts` today (verified: absent from `fd` listing of
`test/support/`); S-000.1 creates it. Cite ranges in the CURRENT file:
- `ensureInstalledConsumer()` (lines 80-137): build (delegates to `ensureTscBuild()` from
  `test/support/shared-build.ts:20-32`, itself NOT part of this extraction — keep importing
  it, don't duplicate) → `bun pm pack --destination … --quiet` (93-100) → scratch
  `package.json` with a `file:<tarball>` dependency (107-120) → `bun install
  --ignore-scripts` (126-133).
- `runScratchScript()` (lines 58-65): writes a `.mjs` file into the scratch dir and
  `spawnSync("bun", ["run", fileName], { cwd: SCRATCH_DIR })`.
- The probe pattern is an inline async `probe(spec)` helper embedded in the check script's
  source (lines 156-163 inside the `check-resolution.mjs` template string) — an
  `await import(spec)` wrapped in try/catch, returning `{ resolved, hasDefineFactory }`.
  The `bun link` leg (S-000/S-001) needs an analogous probe, generalized to accept a
  `link`-vs-`pack` install mode.
- `cleanScratch()` (54-56) and `parseLastJsonLine()` (67-70) are small enough to lift verbatim.

### 5. Founding bugs (both legs assert these two)

Confirmed present TODAY in the tarball leg of `test/e2e/installed-consumer.e2e.test.ts`:
- **(a) write-only factory commits the golden tree with `error === undefined`** — test
  `"REQ-TES-06.2: a write-only factory commits to a golden tree..."`, lines 195-224. Asserts
  `errorIsUndefined === true` and `tree` equals `{ [GOLDEN_PATH]: GOLDEN_CONTENT }`.
- **(b) colliding batch → `AuthoringError` instance from the installed package's own module**
  — test `"REQ-TES-06.3: an all-or-nothing rejection..."`, lines 226-266. Asserts
  `result.error instanceof AuthoringError` (imported from `@pbuilder/sdk/commons` INSIDE the
  scratch script, line 233), `reason: "path-collision"` (line 265), `treeSize === 0` (line 261).

S-001 reproduces both through the `bun link`-installed entry (REQ-LC-02.1/02.2); S-000 only
needs the skeleton's 1.1-.2 slice of LC-01.

### 6. Six verbs + trichotomy tokens

Confirmed by direct read:
- Six author verbs, `src/core/authoring-error.ts:26` (`AuthoringVerb` type): `"create" |
  "modify" | "remove" | "rename" | "move" | "copy"`.
- Read-trichotomy: `src/commons/classify-content.ts:27` — `type ContentState = "absent" |
  "empty" | "present"`; helper `classifyContent()` at line 48.
- `AuthoringError` fields (`src/core/authoring-error.ts:199-232`): `verb`, `path`, `reason`,
  plus `origin` (derived, line 203) and `appliedCount` (line 209) — confirmed, matches the
  prompt exactly.
- `AuthoringReason` is actually **eight** values today (`authoring-error.ts:52-60`:
  `path-collision`, `path-not-found`, `unrepresentable-content`, `changes-too-large`,
  `outside-run`, `unknown`, `invalid-input`, `reserved-name` — extended six→eight by a
  V2→V3 amendment on 2026-07-10, per the file's own comment at line 34). REQ-AOD-05 only
  requires documenting `verb`/`path`/`reason` in author vocabulary, not enumerating all
  eight reason values — but if S-004's error-contract doc lists reasons, list all eight, not
  the original six.
- Never wire terms: confirmed `verbFor()` (line 112-114) translates wire op `"delete"` →
  author verb `"remove"` — the doc-scan (S-004.1) must ban `delete`/`collision`/
  `EmitRejection` and any other port-internal name, per REQ-AOD-05.1.
- Sources: `src/commons/index.ts` (re-exports `AuthoringError`/verb types at lines 9-18,
  `classifyContent`/`ContentState` at lines 23-24), `src/commons/classify-content.ts`,
  `src/core/authoring-error.ts`.

### 7. `dryRun()`

Confirmed: `src/commons/index.ts:264-266` — `export function dryRun(): DryRunEntry[]`,
imported by a consumer as `import { dryRun } from "@pbuilder/sdk/commons"` (it is a function
export on the `./commons` subpath, never its own subpath — matches REQ-AOD-06/REQ-LC-05).
The function's own JSDoc (`src/commons/index.ts:239-263`) states the buffer-drain-on-read
semantics directly: "A `read()` (or any flush) empties the pending buffer" — call `dryRun()`
before any `read()`/dialect `find()` open, exactly as REQ-AOD-10 requires for the demo
narrative too.

### 8. Codegen bin

Confirmed against `bin/pbuilder-codegen.ts`:
- Invocation: `pbuilder-codegen <package-dir>` — one positional argument (`USAGE` constant,
  lines 22-26).
- **Correction to a stricter "rejects all leading-dash args" framing**: `runCli()` (lines
  160-174) special-cases `--help`/`-h` (prints `USAGE` to stdout, **exit 0**); any OTHER
  argument starting with `-` prints `USAGE` to stderr and **exits 1** (lines 171-174). So it
  is not a blanket "rejects leading-dash args" — `--help`/`-h` are a deliberate success case.
  A no-argument invocation also exits 1 (lines 163-166).
- Output: `generateSchema()` (lines 51-64) writes `GENERATED_FILENAME = "schema.generated.ts"`
  (line 20) adjacent to `schema.json`, i.e. inside `<package-dir>` (line 61: `join(packageDir,
  GENERATED_FILENAME)`). The generated file exports `type Input` (confirmed in
  `bin/emit-type.ts:75`: `"export type Input = {"`).
- Success line: `SUCCESS_LINE = "pbuilder-codegen: wrote schema.generated.ts"` (line 21),
  printed via `console.log(SUCCESS_LINE)` on success (line 212) — verbatim match to the prompt.

### 9. Rows table home

Confirmed: `openspec/pending-changes.md`, identified by CONTENT per REQ-AOD-09's own
scenarios (the REQ text names the row numbers directly — do not rely on this doc's numbers
if the file has been edited by an earlier slice in this same change; re-locate by content
before editing). At time of writing, current file line numbers corroborate:
- **Retire** (REQ-AOD-09.1): row 27 ("W3 · `publish.yml` repo-owner guard..."), row 33
  ("Pin `actions/checkout` + `actions/setup-node`..."), row 34 ("`dist/core/**` ships in
  tarball — strip or document..."), row 35 ("Add a `prebuild` clean..."), row 86 ("Demo-moment
  narrative restructure..."), row 143 ("README front-door dialect entry...").
- **Re-tag row 74** (REQ-AOD-09.2, V1): "EmitRejection port conformance for the real engine
  client..." — currently tagged Stage **6**; move to the cross-repo engine-gated bucket (no
  real `EngineClient` exists in this repo).
- **Re-tag rows 56 and 142** (REQ-AOD-09.4, V2 addition): row 56 ("Stage 6 — confirm
  `BATCH_CAP_BYTES`..."), row 142 ("provenance go-live checklist...") — both move to the
  PC-PROTO-01/public-package bucket.
- **Re-point row 175's trigger** (REQ-AOD-09.5): "`RunResult.error`'s typed union... revisit
  at the next 0.x result-shape iteration" — re-point at the sdk-kit extraction/public-package
  plan, superseding the V1 trigger text.
- **New entry** (REQ-AOD-09.6): GitHub Environment required-reviewers gate as a MANDATORY
  precondition of removing `--dry-run` (go-live), deferred to the public-package plan — this
  is ALSO ADR-0042's residual (see ADR-0042 "go-live precondition" paragraph).

### 10. Test conventions

Confirmed: runner is `bun test` (`package.json#scripts.test`). Fitness tests live in
`test/fitness/fit-NN-<slug>.test.ts`; the highest existing is `fit-20-unawaited-join-guard.test.ts`
— **next free NN is 21**, matching `fit-21-publish-workflow-guard.test.ts` named in S-002.1
and ADR-0042. e2e tests live in `test/e2e/` (currently just
`installed-consumer.e2e.test.ts`); docs tests live in `test/docs/` (currently
`security-authoring-guard.test.ts` and `testing-story-docs.test.ts`; S-003.1 adds
`quickstart-docs.test.ts` there). `pkg-surface-baseline.json` schema
(`test/fitness/pkg-surface-baseline.json`): `{ exports, dependencies, files, bin, shebang,
tarball }` — read `fit-14-package-surface.test.ts` (lines 29-36 for the TS interface, 72-156
for the comparison rules) for the two-half comparison: (1) exports/dependencies/files/bin/
shebang equality checks against the committed baseline, and (2) a `bun pm pack --dry-run`
tarball listing diffed for new/missing entries.

### 11. Workflows current state

Read before hardening — confirmed by direct read of both files:
- `.github/workflows/publish.yml` (60 lines): trigger `on: push: branches: [main]` only
  (no `pull_request`/`workflow_dispatch` today — REQ-PPH-01.3 is already satisfied on
  trigger shape; do not accidentally "fix" what isn't broken). `permissions` block is
  currently at **workflow level** (`contents: read`, `id-token: write`, lines 12-14) — ADR-
  0042 requires moving `id-token: write` into the `publish` job's own `permissions` block
  (least privilege), so this DOES need to change. Only `oven-sh/setup-bun` is SHA-pinned
  (line 24); `actions/checkout@v4` (line 22) and `actions/setup-node@v4` (line 28) are NOT —
  confirmed, matches REQ-PPH-02.2's red-proof text exactly. `npm publish --dry-run` is
  already present (line 59) — no repo-owner `if:` guard exists yet (confirmed absent).
- `.github/workflows/ci.yml` (41 lines): only `oven-sh/setup-bun` SHA-pinned; `actions/
  checkout@v4` unpinned. No `id-token` permission (correctly absent — only `contents: read`).
- fit-21 parses with Bun NATIVE `YAML.parse` (`import { YAML } from "bun"`) per ADR-0042 —
  zero new dependency. Resolves the privileged job BY PREDICATE (the job object declaring
  `id-token: write` in its `permissions`), never by job name (`publish`) and never a raw
  regex/substring scan over the file text — a commented-out `# if:` line must be
  structurally absent from the parsed document, not merely invisible to a text scanner.

### 12. Deferred boundary

Confirmed: REQ-PPH-07 (Placeholder Publish Content Fence) and REQ-PPH-08 (Placeholder
Semver Floor Constraint) are present in the signed V3 spec but their scenario bodies are
struck through (`~~...~~`) and marked DEFERRED to the public-package plan (owner ruling at
steward foresight, 2026-07-12, CQ2). S-002 MUST NOT build any placeholder artefact,
deprecation runbook, or `fit-22`-numbered test — zero registry writes anywhere in this
change (confirmed by the spec's own Purpose: "nothing fires" is literal).

### 13. Sensitive-areas posture (S-005)

Not a judgment call — the spec text is the answer, REQ-AOD-12's three scenarios are
literal instructions:
- REQ-AOD-12.1: deployment row confidence low→medium, add `.github/workflows/publish.yml`
  to its paths, note the hardened posture (SHA-pins, repo-owner guard, trigger-surface
  restriction). Confirmed the CURRENT row (`openspec/sensitive-areas.md` line 16) reads
  confidence `low` today — this is the row to amend.
- REQ-AOD-12.2: supply-chain row notes the documented `dist/core/**` ship-not-strip decision
  (REQ-FPS-06) and the SHA-pin convention (REQ-PPH-02).
- REQ-AOD-12.3: the "Review Required" blanket sentence is corrected. Quoted verbatim from
  the current file (`openspec/sensitive-areas.md` lines 21-23): *"All entries are
  `confidence: low` and **anticipated** — none reflect existing code. Re-run `/sdd-init
  force=true` (or update this file) once `foundations-skeleton` lands real paths, and
  promote the relevant rows to `medium`/`high` with concrete paths."* This is already
  factually wrong TODAY (three rows are `medium`, not `low` — public-api, security
  supply-chain, security code-execution, security third-party-trust) — S-005 must correct
  it, not merely append to it.

### 14. Walkthrough split (S-003.3)

Deliverable is a TEMPLATE ONLY at `openspec/changes/stage-6-release-shape/walkthrough-
record.md` — sections: date, reader, pass/fail verdict, steps-followed, constraint
attestation ("never opened `src/`/`test/`" per REQ-AOD-08.1). The OWNER fills it in at
steward reckoning, not during `/build`. If `quickstart-docs.test.ts` (S-003.1) asserts
anything about this file, it asserts TEMPLATE STRUCTURE only (the sections exist, are
correctly named) — never a filled-in verdict, since none exists yet at build time. See the
G-2 ruling below — this is the plan-verify-mandated explicit acceptance of that gap.

### 15. Toolchain

Bun is the committed runtime — repo convention confirmed by `package.json#engines.bun`,
`package.json#scripts` (all Bun-native, no Node transpile step other than the codegen bin's
own `--target node` output for cross-runtime execution), and both workflow files using
`oven-sh/setup-bun`. npm/pnpm consumers are OUT of scope for the e2e legs (S-000/S-001) —
the scratch consumer in `installed-consumer.e2e.test.ts` uses `bun install`/`bun pm pack`,
and the `bun link` leg uses Bun's own linking, not `npm link`.

### 16. Baseline regeneration procedure (S-002.3)

`pkg-surface-baseline.json` has NO generator script — the established procedure (stated
verbatim in stage-5b's slices, `openspec/changes/stage-5b-dialect-breadth/slices.md:62-68`,
and reflected in fit-14's own header comment "This test REGENERATES the actual surface"):
hand-edit the JSON — `exports`/`dependencies`/`files`/`bin` copied VERBATIM from the built
`package.json` (`toEqual` — exact structural match, any drift fails); `shebang` copied from
`dist/bin/pbuilder-codegen.js`'s first line; `tarball` regenerated by running
`bun pm pack --dry-run` and copying its sorted `packed <size> <path>` listing into the array
(SET diff — every path accounted for, no stray or missing entries). Per REQ-PPH-06: run this
ONLY after the prebuild-clean + `declarationMap: false` build has landed (S-000), never
against a stale `dist/`.

### 17. SHA pin values + policy (S-002.2)

Policy (matches the existing `oven-sh/setup-bun` pin style, `publish.yml:24`): pin every
`uses:` to the full 40-hex commit SHA with a trailing `# vX.Y.Z` comment; updates happen as
reviewed diffs, never tag drift. Reference values live-resolved at design time (2026-07-12,
via `gh api repos/<owner>/<repo>/git/refs/tags/v4`):
- `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1`
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`

MANDATORY at apply time: re-resolve both (the v4 tip may have advanced) and verify each SHA
maps to a real `vX.Y.Z` tag before pinning:
`gh api repos/actions/checkout/git/refs/tags/v4 --jq .object.sha` then
`gh api "repos/actions/checkout/tags?per_page=100" --jq '.[] | select(.commit.sha=="<sha>") | .name'`
(same for `actions/setup-node`). Never pin a SHA the tag listing cannot name.

### 18. Dialect doc link target (S-004, REQ-AOD-04.1 / FPS-06.2)

`docs/authoring-a-dialect.md` EXISTS (verified — it is the ONLY file in `docs/` today) and
is the link target: the doc index (`docs/README.md`) and the quickstart's Next-steps footer
LINK it; no new dialect doc is authored and its content is never duplicated inline. The
README front-door (S-004.3) links the index, which links the dialect doc.

## G-2 ruling (plan-verify iteration 1)

REQ-AOD-08.1's execution (the recorded human walkthrough, binary pass/fail verdict, "never
opened `src/`/`test/`") is a **RECKONING-GATE deliverable** — steward reckoning MUST demand
the completed `walkthrough-record.md` (filled in, not the template) before archive; `/build`
delivers the scaffold (the template file, item 14 above) plus both automated legs (the
machine leg, REQ-AOD-07, and the consumer-side `tsc` leg, REQ-AOD-11). This is accepted by
design (Judge A finding A-2, plan-verify iteration 1) and recorded here so "build complete"
is never misread as "AOD-08 discharged" — AOD-08 is only discharged when the owner (or a
designated fresh reader) actually completes the walkthrough and the record reflects a real
verdict, which happens at steward reckoning, not inside `/build`.

## Anti-Pattern Check

✅ No horizontal/layer-named slices — each demoable end-to-end. Dimension D repeats (S-004/S-005) — allowed.

## Judgment Calls (for plan-verify)

- S-001 bundles founding-bug parity (P) with a 1-scenario tarball rider — avoids a 1-task slice.
- S-002 (Rule) concentrates ALL sensitive-surface work — larger, by design.
- AOD-08 scaffolded in S-003.3; EXECUTED by owner at reckoning, outside `/build`. See G-2 ruling above.
- S-005 depends on 2 slices (threshold); AOD-12 needs S-002's facts, extends S-004's test.
