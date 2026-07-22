# Design: Extensible E2E Harness + Modify Operator Coverage (modify-e2e-extensible)

**Spec**: V2 (signed 2026-07-22) | **Triage**: L | **Persona lens**: none (architect/qa/security folded in)
**Design version**: V4 (V2 council 8 findings → V3 plan-verify Judge-B 3 defects → V4 plan-verify iter-2
Judge-B 3 pins: seed provenance, containment two-stage, import-guard-over-real-modules; spec frozen
throughout) | **Architecture impact**: additive

## 4.1 Architecture Overview

A two-tier golden-committed-tree seam, confined to `test/**`, zero `src/**` diff. **Tier A** is a
data-driven coverage table (`{dialect, op, seedPath, seedGolden, expectedGolden, factory}`) driven by
ONE iterating e2e that asserts `ContractFake.committedTree()` against a golden `Map` per row — adding a
cell is one row plus two byte files. **Tier B** keeps S-002's bespoke coalescing-seam flows hand-written.
The `.modify(fn)` factory is ONE generic function dispatching `find()` on `row.dialect`, reused by every
modify row — so the React cell is a pure Tier-A addition (the extensibility proof). A net-new fitness
guard (**fit-42**) enforces a fail-closed cover-XOR-declared-gap partition against a LIVE-REFLECTED
operator universe. Two out-of-band scripts (regen + diff-oracle) mirror `scripts/*.ts` posture.

Seam surface lives under `test/support/dialect-coverage/`; the iterating e2e + canonical goldens under
`test/e2e/dialect-coverage/`; the guard under `test/fitness/`.

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `test/support/dialect-coverage/table.ts` | Create | Coverage-table rows + declared-gaps + required-set; the unit-of-addition module |
| `test/support/dialect-coverage/factory.ts` | Create | The ONE generic `.modify(fn)` factory (dialect-dispatched `find()`, shared modify callback) |
| `test/support/dialect-coverage/harness.ts` | Create | Path validation (REQ-DCS-11) + **exported symlink-aware containment validator** (reused by regen, F7) + golden loading + exported `executeRow(row)` (single-row run, reused by the loop AND the isolation test) + `iterateTierA(rows)` (one `it()`/row) + `flushScheduler` |
| `test/support/dialect-coverage/import-guard.ts` | Create | Tiered fail-closed allow-list scanner (Tier1 unit-of-addition / Tier2 infra / Tier3 scripts, §4.4); strips `import type`/`export type` first (F3); reuses `import-scan.ts` `stripComments`/`IMPORT_SPECIFIER_RE`. Invoked by fit-42's standing `describe("import allow-list")` over the real seam set |
| `test/e2e/dialect-coverage/tier-a.e2e.test.ts` | Create | The single Tier-A iterating e2e (REQ-DCS-02); one `it()` per row (per-row isolation) |
| `test/e2e/dialect-coverage/golden/typescript/{modify-seed.ts,modify-expected.ts}` | Create | TS `.modify` Tier-A goldens (script-generated) |
| `test/e2e/dialect-coverage/golden/react/{modify-seed.tsx,modify-expected.tsx}` | Create | React `.modify` Tier-A goldens (script-generated) |
| `test/e2e/dialect-modify.e2e.test.ts` | Modify | Retrofit as Tier B under the seam; add DMR-01/02/03 assertions; existing golden-byte comparisons unchanged (REQ-DCS-09) |
| `test/fitness/fit-42-dialect-coverage-completeness.test.ts` | Create | Wires reflection + disk readers into pure `checkCoverage` (REQ-DCF-01/02/03/05/06); + standing `describe("import allow-list")` scanning the REAL seam set against the tiered allow-lists (DCS-07 positive) |
| `test/fitness/fit-42-dialect-coverage-completeness.negative.test.ts` | Create | Deliberate-deletion (REQ-DCF-04) + injected-universe DCF-03.2 + import-guard + symlink/path-containment negatives — all via synthetic `checkCoverage` args, zero `src/**` touch (F6) |
| `scripts/regen-dialect-coverage-golden.ts` | Create | Single scripted golden regen (REQ-DCS-04/10); **imports the harness containment validator** (F7); outside `bun test` glob |
| `scripts/verify-react-tier-a-diff.ts` | Create | META diff oracle (REQ-RME-05): resolves the React-row commit by message trailer (F2); outside `bun test` glob |
| `openspec/pending-changes.md` | Modify | Add a `dialect-coverage` followup block with the 7 verbatim per-cell gap anchors so fit-42 declared-gap references resolve — existing "Full structured-op parity" text omits `addImport` (F5, REQ-DCF-05) |
| `src/core/define-dialect.ts` | Read-only | `RESERVED_HANDLE_NAMES` (exported, FIT-04-baselined) — the base-verb subtraction set for reflection; byte-untouched |
| `src/dialects/{typescript,react}/index.ts` | Read-only | `find()` constructs the handle fit-42 reflects; byte-untouched |
| `src/testing/index.ts`, `src/testing/contract-fake.ts` | Read-only | `runFactoryForTest` (`{tree,emitted,error}`, no `read`) + `ContractFake` (`committedTree()`/`read()` public) — the DMR oracle split |
| `test/support/spy-client.ts`, `test/support/golden.ts`, `test/support/import-scan.ts` | Read-only | `makeSpyClient` (reflection fixture), `golden(name,dir)`, scan helpers reused as-is |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| TS-dialect `.modify(fn)` universal cell | Create | DCS-01/02, RME-01 | `test/e2e/dialect-coverage/tier-a.e2e.test.ts` | Tier-A row; new goldens under canonical root |
| React-dialect `.modify(fn)` coverage | Create | RME-01/02/03/04 | `test/e2e/dialect-coverage/tier-a.e2e.test.ts` (+1 row) | Tier-A only, zero new factory — extensibility proof |
| TS-dialect coalescing behavioral flows | Modify | DCS-09, DMR-01/02/03 | `test/e2e/dialect-modify.e2e.test.ts` | Tier B; behavior preserved, assertions added |
| Future operator gains coverage | Create | DCS-02.1, DCF-01/02/03 | `test/e2e/dialect-coverage/tier-a.e2e.test.ts` | XS/S: one row + two byte files, enforced by fit-42 |
| CI extensibility-proof gate | Create | RME-05 | `scripts/verify-react-tier-a-diff.ts` | diff oracle at `sdd-verify` final / CI |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `test/e2e/` golden-committed-tree idiom | extend | generalize S-002 into a named reusable two-tier seam + React counterpart | aligns |
| `test/support/` harness cluster | new | seam modules join the existing support layer | aligns |
| `test/fitness/` guard cluster | new (fit-42) | coverage-COMPLETENESS fitness — a novel fitness KIND (fit-41 is parity) | deviates → ADR-02 |
| `scripts/` out-of-band tooling | new | regen + diff-oracle join the existing `scripts/*.ts` posture | aligns |
| `src/dialects/{typescript,react}/**`, `src/core/**` | read-only | exercised only; zero production diff | aligns |
| root `conformance/` corpus, `fit-40` | read-only | wire-directive layer; out of scope by construction (REQ-CFX-01) | aligns |

`architecture_impact = additive`: the fitness cluster and support cluster GAIN modules; no existing
boundary, dependency direction, or pattern changes; nothing in the baseline becomes wrong. The single
`deviates` row (fit-42's completeness KIND) is a new concept within an existing layer, not a boundary
shift — ADR-02 records it.

## 4.3 Data Model

```ts
// test/support/dialect-coverage/table.ts
export type DialectName = "typescript" | "react";

export interface CoverageRow {
  dialect: DialectName;
  op: string;                              // axis operator, e.g. "modify"
  seedPath: string;                        // in-tree virtual path ContractFake seeds (react: *.tsx)
  seedGolden: string;                      // POSIX-relative byte-file -> pre-run seed content
  expectedGolden: string;                  // POSIX-relative byte-file -> expected committed content
  factory: (ctx: { dialect: DialectName; seedPath: string }) => PromiseLike<void>;
}

export interface DeclaredGap {
  dialect: DialectName;
  op: string;
  followup: string;                        // verbatim substring of openspec/pending-changes.md (REQ-DCF-05)
}

export const ROWS: readonly CoverageRow[];   // today: {ts,modify}, {react,modify} — the required set
export const REQUIRED_CELLS: readonly { dialect: DialectName; op: "modify" }[]; // {ts,modify},{react,modify}

// The 7 non-modify cells, each with its exact per-cell anchor (F5). Every `followup` MUST appear
// verbatim in openspec/pending-changes.md's dialect-coverage block, else fit-42 fails closed.
export const DECLARED_GAPS: readonly DeclaredGap[] = [
  { dialect: "typescript", op: "addImport",    followup: "dialect-coverage gap: typescript/addImport" },
  { dialect: "typescript", op: "addFunction",  followup: "dialect-coverage gap: typescript/addFunction" },
  { dialect: "typescript", op: "addVariable",  followup: "dialect-coverage gap: typescript/addVariable" },
  { dialect: "typescript", op: "addClass",     followup: "dialect-coverage gap: typescript/addClass" },
  { dialect: "typescript", op: "removeImport", followup: "dialect-coverage gap: typescript/removeImport" },
  { dialect: "react",      op: "setJsxProp",   followup: "dialect-coverage gap: react/setJsxProp" },
  { dialect: "react",      op: "addImport",    followup: "dialect-coverage gap: react/addImport" },
];
```

```ts
// fit-42's check is a PURE function (F6) — the DCF-03.2 negative injects a synthetic op via
// `universe`, never by editing src/**. `readGolden` is injected so the negative can simulate
// absent/unreadable without disk.
export type GoldenRead = { ok: true; bytes: string } | { ok: false; reason: "absent" | "unreadable" };
export function checkCoverage(args: {
  universe: { dialect: DialectName; op: string }[];   // reflected registered axis (see §4.4)
  rows: readonly CoverageRow[];
  gaps: readonly DeclaredGap[];
  requiredCells: readonly { dialect: DialectName; op: string }[];
  pendingChangesText: string;
  readGolden: (dialect: DialectName, name: string) => GoldenRead;
}): string[];                                          // [] = pass; else violation messages
```

```ts
// test/support/dialect-coverage/factory.ts — the ONE generic factory (REQ-RME-03)
const DIALECTS = { typescript: ts, react } as const;
const canonicalModify = (ast: SourceFile) => ast.addStatements("export const __e2eCoverageMarker = true;");
export const modifyFactory: CoverageRow["factory"] =
  ({ dialect, seedPath }) => DIALECTS[dialect].find(seedPath).modify(canonicalModify);
```

**Seed provenance (V4 pin — blocks S-000 regen)**: the mutate-only `modifyFactory` cannot synthesize its own
input, so each row's SEED source-of-truth is an authored TypeScript constant embedded IN
`scripts/regen-dialect-coverage-golden.ts`, mirroring `scripts/regen-corpus.ts`'s authored-input pattern
(`regen-corpus.ts:10,19` — `SCENARIOS[].input` is an authored constant, e.g. `scenarios.ts:81`
`input: { port: 8080 }`; the golden is DERIVED by running, never hand-authored). The regen script (1) writes
`modify-seed.{ts,tsx}` verbatim from the constant, then (2) derives `modify-expected.{ts,tsx}` by executing
the row's factory against a `ContractFake` seeded with those bytes and reading `committedTree()`, then (3)
writes both under `test/e2e/dialect-coverage/golden/{dialect}/` THROUGH the containment validator. **DCS-04
reconciliation**: authored constants in the regen script ARE the sanctioned source; DCS-04's "no
hand-authored golden bytes" ban applies to EDITING golden-root files directly on disk — never to the
script's authored seed constant. Seed constant shapes (non-empty, REQ-DCF-06 non-vacuous): TS
`export const a = 1;\n` (`seedPath: "a.ts"`); React a JSX-bearing `.tsx` exercising `ScriptKind.Tsx`, e.g.
`export const App = () => <div />;\n` (`seedPath: "a.tsx"`). `canonicalModify` appends
`export const __e2eCoverageMarker = true;`, so expected ≠ seed (proving mutation). `seedPath` values `"a.ts"`
/ `"a.tsx"` confirmed consistent with §4.3 `CoverageRow` and the React `.tsx` gate.

## 4.4 Interface Contracts

Authoring surface a FUTURE operator author touches (the XS/S unit of addition):

- Add one `CoverageRow` to `ROWS` referencing a `factory` (the shared `modifyFactory`, or — for a genuinely
  new op — one new maintainer-authored function in `factory.ts`).
- Add two byte files under `test/e2e/dialect-coverage/golden/{dialect}/`, then run
  `bun run scripts/regen-dialect-coverage-golden.ts`.
- No edit to the iterating e2e, fit-42, `ContractFake`, `golden()`, or (for the React modify case) the
  factory module (REQ-RME-03.1).

Harness internals (not author-facing) — **reflection MIRRORS the proven precedent exactly (F1)**. The
dialect modules export `find` as a module-level function, NOT a `dialect` object, and op enumeration is
proven ONLY inside a run with a client — so fit-42 does NOT call a bare `find()`. It copies
`test/dialects/typescript/ops-exact-set.test.ts:26-38` and `test/dialects/react/ops-exact-set.test.ts:20-32`
verbatim in shape: a `defineFactory` run over a `makeSpyClient({[seedPath]: ""})` client (`test/support/
spy-client.ts:22`) whose body captures `Object.keys(find(seedPath)).filter(k => !BASE_HANDLE_KEYS.has(k))`,
where `BASE_HANDLE_KEYS = new Set(RESERVED_HANDLE_NAMES)` (`src/core/define-dialect.ts`). This is the
registered op-pack (`createDialectHandle` builds op methods from `Object.keys(ops)` of the pack `withOps`
actually merged, `dialect-handle.ts:422-430`) — a registered-but-unexported op is caught, a stray non-op
export is never a phantom cell. Enumeration is **per dialect, one run each** (one run cannot span both — a
run drives a single client): `reflectRegisteredOps(ts.find, "a.ts")` → `[addImport, addFunction, addVariable,
addClass, removeImport]`; `reflectRegisteredOps(react.find, "a.tsx")` → `[setJsxProp, addImport]`. The `.test.ts`
then assembles `universe = ts-ops×{typescript} ∪ react-ops×{react} ∪ {modify}×{typescript,react}` and passes
it to the pure `checkCoverage` (§4.3) — so the DCF-03.2 negative injects a synthetic op through that argument
alone (F6). Residual coupling: `RESERVED_HANDLE_NAMES` (exported, FIT-04-baselined, kept exhaustive by
`define-dialect.ts`'s `_reservedCoversSurface` compile guard) — named in ADR-02.

The import-guard is a **STANDING fitness assertion** (V4 pin — a `describe("import allow-list")` block inside
`fit-42-dialect-coverage-completeness.test.ts`; no separate file — it shares fit-42's seam-scope reads)
scanning REAL seam modules on every `bun test` run; S-004's synthetic fixtures in the `.negative.test.ts`
remain the negative proof of the RULES. All scanning strips `import type`/`export type` first (F3). Because
the real modules must PASS from S-000, the guard is **TIERED** (three real allow-sets, decided + justified
here):
- **Tier 1 — unit of addition (STRICT, REQ-DCS-07 verbatim)**: `table.ts`, `factory.ts`. relative ∈
  {`../../../src/dialects/typescript/index.ts`, `../../../src/dialects/react/index.ts`,
  `../../../src/testing/index.ts`, sibling `./` under `test/support/dialect-coverage/**`}; bare/builtin ∈
  {`bun:test`, `node:path`}. `ts-morph` stays OFF (its `import type { SourceFile }` is erased, skipped). This
  is the security surface a future contributor edits — `node:fs` is deliberately NOT added here (adding it
  to placate a script would blunt the guard on the exact surface it exists to protect).
- **Tier 2 — trusted infra**: `harness.ts`, `tier-a.e2e.test.ts`, both `fit-42*.ts`. Tier-1 set ∪
  {`node:fs`} (realpath/lstat containment + golden `readFileSync`, `golden.ts:5`) ∪ the sanctioned src-core
  relatives they legitimately need (`../../src/core/define-dialect.ts` for `RESERVED_HANDLE_NAMES`,
  `../../src/core/context.ts` for `defineFactory`, `../support/spy-client.ts`).
- **Tier 3 — scripts**: `regen-*.ts`, `verify-react-tier-a-diff.ts`. Tier-2 set ∪ {`node:child_process`}
  (the oracle's `execFileSync`, precedent `conformance-pr-gate.ts`). (`node:url`/`URL` is a global — no import
  statement — so `IMPORT_SPECIFIER_RE` never sees it.)

Justification for tiering (not one flat list): Tiers 2-3 are maintainer-authored, NOT the XS/S contributor
surface, and legitimately need `fs`/`child_process`/src-core — a single allow-set permissive enough for them
gives the contributor surface no security value. Tiers 2-3 are still fail-closed against anything outside
their broadened set (catches `node:net`, an npm package, a stray sibling-dialect import) and are additionally
bound by DCS-05 confinement. **Allow-set delta forced NOW**: Tier-1 unchanged; Tier-2 adds `node:fs` + the
three src-core/support relatives; Tier-3 adds `node:child_process`.

## 4.4b DMR oracle split + isolation test (code-verified pins)

**DMR oracle split (F2/Q8)** — `runFactoryForTest` returns `{tree, emitted, error}` and exposes NO
`read` (src/testing/index.ts:136); `ContractFake` exposes public `committedTree()` (line 112) and `read()`
(line 122), and `read()` binds to staging `#tree`, never `#committed` (line 37) — so after a discarded run
`read(path)` still yields the original seed. Therefore:
- **DMR-01** (op-count) → `runFactoryForTest`, asserting `result.emitted.length === 1` and
  `result.emitted[0].instructions.length === 1` (`Batch.instructions: Directive[]`, wire.ts:49).
- **DMR-02** (atomicity read-back) → a DIRECTLY-constructed `ContractFake` (as S-002 already does), dual
  oracle `fake.committedTree()` empty + `fake.read(path)` === original seed.
- **DMR-03** (rejection capture) → the existing block's `ContractFake` + `process.on("unhandledRejection")`
  harness, swapping only the `setTimeout` wait for `flushScheduler()`.

Target `it()` blocks in `test/e2e/dialect-modify.e2e.test.ts` (by FULL title — the file has duplicate
"Flow 1"/"Flow 4" labels, so identify by title string, never flow number):
- DMR-01 augments `"Flow 1: addImport + .modify() on one file coalesce into a single committed modify"`.
- DMR-02 is a NEW `it()` (awaited `.modify` that mutates the AST then throws) — distinct from
  `"Flow 4: an unawaited THROWING chain rejects the run contained, no unhandledRejection"` (that one is
  UN-awaited; DMR-02 is awaited-partial-mutation).
- DMR-03 modifies `"Flow 4: an unawaited THROWING chain rejects the run contained, no unhandledRejection"`
  (the `setTimeout(resolve, 10)` at line 151 → `flushScheduler()`).

**RME-02.2 permanent isolation (F3/Q9b)** — a PERMANENT harness-level test, not a throwaway row: a
`describe("harness — per-row failure isolation")` in `test/e2e/dialect-coverage/tier-a.e2e.test.ts` calls the
harness's exported `executeRow(row)` over an in-test synthetic table `[goodRow, failingRow, goodRow2]` — the
`failingRow` is a `react` row with a `.ts` `seedPath` (trips the synchronous `.tsx` gate) and is NEVER added
to the shipped `ROWS`. Asserts `results[1].error !== undefined` (row failed in isolation) while
`results[0].error === undefined` AND `results[2].error === undefined` (execution continued past the
failure). Proves REQ-RME-02.2 permanently without relying on bun's cross-`it()` semantics.

## 4.5 ADRs

### ADR-01: Two-tier golden-committed-tree seam
**Status**: Proposed. **Context**: S-001/S-002 prove `.modify` via committed-bytes, but as one-offs with no
reusable seam; "future operator = XS/S" needs a boundary. **Decision**: Tier A = data-driven table + ONE
iterating e2e asserting `committedTree()` vs golden `Map`; Tier B = hand-written coalescing-seam flows,
exempt from Tier-A enumeration and fit-42. **Consequences**: +one upfront table/harness cost this L absorbs;
+React cell becomes pure data; −two idioms coexist in one file family (documented in the seam module).
**Alternatives**: extend `conformance/` sync-site — infeasible (REQ-CFX-01 bars dialect-leaf imports);
new IR-transcript scenario harness — a 4th idiom, over-engineered for a handful of cells.

### ADR-02: fit-42 is a coverage-COMPLETENESS fitness (baseline deviation)
**Status**: Proposed. **Context**: fit-41 guards cross-dialect verdict PARITY; nothing enforces "every axis
op has an e2e in every dialect." **Decision**: fit-42's universe is derived by reflecting each dialect's
REGISTERED op-pack via the PROVEN precedent (`ops-exact-set.test.ts`) — a `defineFactory` run over a
`makeSpyClient` client whose body captures `Object.keys(find(seedPath))` minus `RESERVED_HANDLE_NAMES`, one
run per dialect, ∪ `{modify}` (F1) — NOT a bare `find()` and NOT the `ops.ts` module namespace. It fails
closed unless each cell is a non-vacuous
Tier-A row XOR a declared gap with a valid `openspec/pending-changes.md` followup reference; required cells
(`.modify × {ts,react}`) cannot be downgraded to gaps. The check itself is a pure
`checkCoverage({universe, rows, gaps, requiredCells, pendingChangesText, readGolden})` (F6). **Residual
coupling (named)**: `RESERVED_HANDLE_NAMES` (`src/core/define-dialect.ts`, exported for test observability,
FIT-04-baselined, kept exhaustive by that module's `_reservedCoversSurface` compile guard) — the one thing
fit-42 must import to subtract base verbs; no `ops-exact-set.test.ts` coupling (those pin per-dialect
literals, orthogonal to fit-42's cross-dialect completeness). **Consequences**: +registered-but-unexported
ops caught, stray exports never phantom-count; +silent gaps impossible; −fit-42 imports
`RESERVED_HANDLE_NAMES` and reads `pending-changes.md` at test time. **Alternatives**: `Object.keys(import *
as ops.ts)` — rejected, misses unexported registrations and phantoms stray exports; hand-listed array —
goes stale silently (finding 1); reuse fit-41 — wrong concern (parity ≠ completeness).

### ADR-03: Layer boundary — conformance corpus vs this seam
**Status**: Proposed. **Context**: two "modify" concepts risk conflation. **Decision**: the root
`conformance/` corpus owns wire-directive shape (`{op:"modify"}`), engine-authoritative and never
SDK-proven (REQ-CFX-11); this seam owns dialect-leaf-AST → committed-bytes, SDK-proven in-process via
`ContractFake`. fit-42's axis excludes `replaceContent` and any wire `{op:"modify"}` (REQ-DCF-03.1).
**Consequences**: +clean ownership, no double-count; −maintainers must know which layer a new op belongs to
(the seam module documents it). **Alternatives**: one unified matrix — conflates engine-authoritative and
SDK-proven honesty boundaries.

### ADR-04: Threat model — the seam executes maintainer-authored factories in CI
**Status**: Proposed. **Context**: unlike `conformance/`'s structural-only posture (never runner-spawned),
this seam EXECUTES factory code in-process during `bun test`/CI. **Decision**: the executable surface (table
+ factory modules) is guarded by a fail-closed import allow-list (REQ-DCS-07), path validation +
**symlink-aware** containment (REQ-DCS-11), static-reference-only factories (REQ-DCS-06, no dynamic
`import()`), and bytes-only seed/golden reads (REQ-DCS-12).
- **Type-only exemption (F3)**: the guard strips whole `import type`/`export type` declarations BEFORE
  allow-list evaluation — they are compile-time-erased with zero runtime edge, so the factory's legitimate
  `import type { SourceFile } from "ts-morph"` is exempt WITHOUT putting `ts-morph` on the runtime allow-set
  (which must stay minimal). Rationale: a type-only specifier can neither load a module nor run code.
- **Symlink-aware containment — TWO-STAGE contract (F4, V4 pin)**: one validator in `harness.ts`, imported
  by regen (F7), with a strict stage order reconciling "symlink-aware" with "fails before disk touch":
  - **Stage 1 — lexical, ZERO fs calls**: reject a backslash, a leading `/`, or any `..` segment. This is
    what satisfies REQ-DCS-11.1 ("fails before ANY file I/O") — a `..` path never reaches an fs call.
    Error identity: `PathLexicalError` (message names the offending segment/char).
  - **Stage 2 — metadata-only** (permitted validation I/O, NOT content read/write): `lstat` each EXISTING
    path component — reject if any is a symlink (`PathSymlinkError`, names the symlinked component); then
    `realpath` the deepest existing ancestor and assert it stays under `realpath(canonical root)`
    (`PathEscapeError` on failure). REQ-DCS-11.2's "before any read or write touches disk" is honored: `lstat`
    /`realpath` are metadata probes; the target's CONTENT open/read/write happens ONLY after BOTH stages pass.
  - S-004 negatives assert the three DISTINCT error identities (lexical vs symlink vs escape).
  **Residual**: a TOCTOU window between Stage 2 and the single content fs call — mitigated by running Stage 2
  immediately before that one call and by regen being a maintainer-run out-of-band script, never CI-triggered.
- **META-oracle command safety (F2)**: revisions are computed INTERNALLY (`git merge-base`, trailer grep);
  an explicit `<base> <head>` override is validated against `/^[0-9a-f]{7,40}$/`; `--` precedes revisions in
  every `git` invocation; argv/env are never interpolated raw into the command (forked-PR CI hardening).

**Consequences**: +no supply-chain/arbitrary-module vector, no symlink write-escape, no untrusted-argv
command surface; −the guard + validator grow with the allow-set. **Alternatives**: REQ-CFX-01's deny-list —
fail-open, misses `node:vm`/npm packages (finding 2); lexical containment only — symlink-defeatable (F4);
positional `HEAD~1` diff — diffs the wrong commit under §4.8 sequencing (F2).

## 4.6 Test Derivation

Level `e2e` → the Tier-A iterating e2e or Tier-B flows; `architectural` → fit-42 (+negative). One row/REQ-ID.

| REQ-ID | Scenario ref | Level | Test (path) | Flow ref |
|---|---|---|---|---|
| DCS-01 | .1/.2 row schema, seedGolden governs bytes | e2e | `dialect-coverage/tier-a.e2e.test.ts` | TS/React modify |
| DCS-02 | .1 new row, no new file | e2e | `tier-a.e2e.test.ts` | Future operator |
| DCS-03 | .1 Tier-B never flagged | architectural | `fit-42…test.ts` | — |
| DCS-04 | .1 regen touches no test file | architectural | `fit-42…test.ts` (glob-exclusion assert) | — |
| DCS-05 | .1 no export reaches harness | architectural | `fit-42…test.ts` (confinement scan) | — |
| DCS-06 | .1 factory statically resolved | architectural | `import-guard` via `fit-42.negative…test.ts` | — |
| DCS-07 | .1/.2/.3 allow-list fails closed (+ type-only exempt, F3); positive = standing scan of real seam set over tiered allow-lists | architectural | `fit-42…test.ts` (positive, real modules) + `fit-42.negative…test.ts` (synthetic) | — |
| DCS-08 | .1 ADRs recorded | architectural | this design (§4.5) | — |
| DCS-09 | .1 retrofit preserves goldens | e2e | `dialect-modify.e2e.test.ts` | TS behavioral |
| DCS-10 | .1 regen write containment | architectural | `fit-42…test.ts` + regen self-check | — |
| DCS-11 | .1 Stage-1 lexical (`..`) fails zero-fs; .2 Stage-2 metadata escape fails pre-content; 3 distinct error identities (F4) | e2e/arch | `harness.ts` two-stage validator, `fit-42.negative…test.ts` (lexical/symlink/escape) | — |
| DCS-12 | .1 bytes-only load | e2e | `tier-a.e2e.test.ts` (readFileSync path) | React modify |
| DCF-01 | .1/.2/.3 missing/unreadable/absent-row | architectural | `fit-42…test.ts` | — |
| DCF-02 | .1/.2/.3 partition + downgrade fail | architectural | `fit-42…test.ts` | — |
| DCF-03 | .1 no replaceContent cell; .2 new-op fails via INJECTED `universe` arg, zero src touch (F6) | architectural | `fit-42.negative…test.ts` (checkCoverage synthetic universe) | — |
| DCF-04 | .1 deliberate-deletion negative | architectural | `fit-42.negative…test.ts` | — |
| DCF-05 | .1/.2 followup-ref validity | architectural | `fit-42…test.ts` (reads pending-changes.md) | — |
| DCF-06 | .1/.2 vacuous row fails | architectural | `fit-42…test.ts` | — |
| RME-01 | .1 both modify rows green | e2e | `tier-a.e2e.test.ts` | TS+React modify |
| RME-02 | .1 .tsx gate rejects; .2 per-row isolation — PERMANENT harness test over a synthetic [good,failing,good] table via `executeRow` (F3 fix; synthetic row NOT in shipped ROWS) | e2e | `.2` in `tier-a.e2e.test.ts` `describe("harness — per-row failure isolation")`; `.1` in the row loop | React modify |
| RME-03 | .1 changed-file-set = table+goldens | architectural | `verify-react-tier-a-diff.ts` (trailer-resolved commit) | React modify |
| RME-04 | .1 .tsx golden byte fidelity | e2e | `tier-a.e2e.test.ts` | React modify |
| RME-05 | .1/.2 diff oracle pass/fail; commit resolved by message trailer, not `HEAD~1` (F2) | architectural | `verify-react-tier-a-diff.ts` (+ its own fixture) | CI gate |
| DMR-01 | .1 one modify directive via `runFactoryForTest().emitted` (`emitted.length===1`, `emitted[0].instructions.length===1`) — ADDED to the existing `it("Flow 1: addImport + .modify() on one file coalesce into a single committed modify")`, existing `committedTree()` comparison untouched | e2e | `dialect-modify.e2e.test.ts` | TS behavioral |
| DMR-02 | .1 atomicity via directly-constructed `ContractFake`: `committedTree()` empty AND `fake.read(path)` = original seed (dual oracle; `runFactoryForTest` exposes no read) — NEW awaited-mutate-then-throw `it()` block | e2e | `dialect-modify.e2e.test.ts` | TS behavioral |
| DMR-03 | .1 replace `setTimeout(resolve,10)` (line 151) with `flushScheduler()` in `it("Flow 4: an unawaited THROWING chain rejects the run contained, no unhandledRejection")`; `expect(unhandled).toEqual([])` unchanged | e2e | `dialect-modify.e2e.test.ts` | TS behavioral |

All 26 REQ-IDs covered. Every Create/Modify flow has ≥1 e2e row.

## 4.7 Fitness Functions

**fit-42** — the `.test.ts` REFLECTS the universe + reads disk, then delegates to the pure
`checkCoverage(args)` (F6); the `.negative.test.ts` calls `checkCoverage` with synthetic args only.
Reflection (F1, mirrors `ops-exact-set.test.ts`): `universe` = per dialect, one `defineFactory` run over
`makeSpyClient({[seed]:""})` capturing `Object.keys(find(seed))` \ `RESERVED_HANDLE_NAMES`, ∪ `{modify}` —
registered op-pack via a proven client-backed run, never a bare `find()` nor a module namespace.
`checkCoverage` list:
1. Every `{dialect,op}` in `universe` ∈ exactly one of {Tier-A row, declared gap}; else FAIL (undeclared).
2. Required cells (`.modify × {ts,react}`) MUST be Tier-A rows; a required cell as a declared gap FAILS.
3. Each Tier-A row non-vacuous: seed + expected bytes (via injected `readGolden`) non-empty AND (mutating op)
   expected ≠ seed; else FAIL (vacuous).
4. Required golden `readGolden` result present AND readable; `absent` vs `unreadable` distinguished in message.
5. Each declared gap's `followup` is a non-empty verbatim substring of `pendingChangesText`.
6. `replaceContent` / wire `{op:"modify"}` never appear (excluded from the reflected axis by construction —
   they are base/wire verbs, not registered ops).
Confinement/glob-exclusion asserts (in the `.test.ts`): no `package.json#exports`/`src/conformance`/
`src/testing` reference resolves to the seam modules; regen + oracle scripts are outside the `.test.ts` glob.

**META diff oracle** (`verify-react-tier-a-diff.ts`) — mirrors `scripts/conformance-pr-gate.ts` (not a
`.test.ts`, off the `bun test` glob). Resolves the React-row commit by a STABLE MARKER, not `HEAD~1` (F2):
`git merge-base HEAD origin/main` → `git log --format=%H%x1f%B <mergeBase>..HEAD --` → the commit whose body
contains the trailer `Coverage-Cell: react/modify` → diff `git diff --name-only <sha>^ <sha> --`. Explicit
`<base> <head>` override accepted, each validated `/^[0-9a-f]{7,40}$/`; revisions computed internally, `--`
before revisions, no raw argv/env interpolation (forked-PR CI). Assert the changed-file set ⊆
{`test/support/dialect-coverage/table.ts`, the two `…/golden/react/` files}; exit non-zero otherwise.

## 4.8 Migration / Rollout

TS retrofit sequencing (byte-identical-goldens guarantee, REQ-DCS-09): (1) land the seam
(table + factory + harness + import-guard) with the TS `.modify` Tier-A row + fresh goldens under the
canonical root; (2) wire the iterating e2e; (3) retrofit `dialect-modify.e2e.test.ts` — add a Tier-B header
referencing the seam, add DMR-01 (`runFactoryForTest` `emitted.length`), DMR-02 (`committedTree()` +
`fake.read()` dual oracle), DMR-03 (`flushScheduler` = microtask drain + one `setImmediate` macrotask tick,
replacing the `setTimeout(…,10)` at line 151) — the four existing Flow 1-4 golden-byte comparisons stay
byte-unchanged against `test/dialects/typescript/golden/*`; (4) add the React Tier-A row + `…/golden/react/` goldens as ITS OWN
dedicated commit carrying the trailer `Coverage-Cell: react/modify` (so the F2 oracle resolves it by marker,
not position); (5) land fit-42 + negative + the diff oracle; (6) add the pending-changes `dialect-coverage`
followup block (7 verbatim anchors, §4.3) so fit-42's declared-gap references resolve — this MUST land
before or with fit-42 or fit-42 fails closed on first run. Rollback is per-artefact and clean (proposal
§Rollback). No src, API, migration, or persisted-data change.

**Archive-time ADR promotion (F8)**: these design ADR-01..04 promote to global IDs at archive. `openspec/
decisions/` already carries a `0050-*` numbering COLLISION (two files:
`0050-definefactory-core-internal-removal.md` and `0050-handle-unfreeze-honest-write-verb-rename.md`), and
copy-copyin (branch `m2-copyin-banked-arm`) reserves `ADR-0074`. `sdd-archive` MUST pick the next
GENUINELY-FREE global numbers (scan for the max AND any gaps/dupes across all branches), never a positional
`max+1` — record the chosen quartet in `project/architectural-decisions` at promotion.

## 4.9 Performance

No significant impact: +a handful of in-memory `ContractFake` runs and two out-of-band scripts. Negligible.

## 4.10 Architecture Impact

**Architecture impact**: additive
**Rationale**: derived from §4.2c — the `test/support/` and `test/fitness/` layers GAIN modules (new
harness cluster + fit-42); the single `deviates` row (fit-42's completeness KIND) is a novel concept within
an existing layer, not a boundary/pattern shift; zero `src/**` diff, no dependency-direction change. Nothing
in the baseline becomes wrong; the baseline gains entries → additive (prompt a post-verify refresh, not
mandatory).

## 4.11 Open Questions

None.
