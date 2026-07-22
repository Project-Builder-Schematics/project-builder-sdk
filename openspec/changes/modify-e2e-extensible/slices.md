# Slices: Extensible E2E Harness + Modify Operator Coverage (modify-e2e-extensible)

**Triage**: L | **Spec version**: V2 (signed) | **Design read**: V4 (§4.3 seed provenance, §4.4 tiered
standing import-guard, ADR-04 two-stage containment). **Total slices**: 6 (1 walking skeleton + 5
SPIDR), IDs/scope/dimension/order unchanged since REV 1. **Revision**: REV 4 — owner ruling at the
plan-verify ceiling: plan is READY conditioned on this revision (no further judging). Pins the three
residual executor-facing mechanisms REV 3 left underspecified: the import-guard scanner's exact
signature/semantics (§G), concrete assertion mechanisms for DCS-03/04/05/10 (S-003 tasks), and the
`checkCoverage` module's permanent home (§D/§G). All internal cross-references use this document's own
§A–§K letters — no dangling design-doc finding numbers remain.

This L change carries 26 frozen REQ-IDs, a sensitive-area (`src/dialects/**`) security posture, and
several hard sequencing constraints — acceptance criteria below trade the skill's 800-word soft budget
for traceability and self-sufficiency (both explicitly required over the budget).

---

## Inlined Contracts (source of truth, copied from design.md — executor never needs the design doc)

### A. Data model — `test/support/dialect-coverage/table.ts`

```ts
export type DialectName = "typescript" | "react";

export interface CoverageRow {
  dialect: DialectName;
  op: string;                              // axis operator, e.g. "modify"
  seedPath: string;                        // in-tree virtual path ContractFake seeds (today: "a.ts" / "a.tsx")
  seedGolden: string;                      // POSIX-relative golden filename -> PRE-run seed bytes
  expectedGolden: string;                  // POSIX-relative golden filename -> POST-run expected bytes
  factory: (ctx: { dialect: DialectName; seedPath: string }) => PromiseLike<void>;
}

export interface DeclaredGap {
  dialect: DialectName;
  op: string;
  followup: string;                        // verbatim substring of openspec/pending-changes.md
}

// today's two rows, seedPath values pinned explicitly:
// { dialect: "typescript", op: "modify", seedPath: "a.ts",  seedGolden: "modify-seed.ts",  expectedGolden: "modify-expected.ts",  factory: modifyFactory }
// { dialect: "react",      op: "modify", seedPath: "a.tsx", seedGolden: "modify-seed.tsx", expectedGolden: "modify-expected.tsx", factory: modifyFactory }
export const ROWS: readonly CoverageRow[];
export const REQUIRED_CELLS: readonly { dialect: DialectName; op: "modify" }[]; // both rows above

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

Golden-file naming convention: `seedGolden`/`expectedGolden` are POSIX-relative filenames resolved
under the canonical root `test/e2e/dialect-coverage/golden/{dialect}/`. `seedGolden` and
`expectedGolden` are NEVER the same file for a mutating op. Golden BYTES are never hand-authored on
disk — see §I for how they're produced.

### B. `checkCoverage` contract — the pure fitness function

```ts
export type GoldenRead = { ok: true; bytes: string } | { ok: false; reason: "absent" | "unreadable" };

export function checkCoverage(args: {
  universe: { dialect: DialectName; op: string }[];   // reflected registered axis, see §C
  rows: readonly CoverageRow[];
  gaps: readonly DeclaredGap[];
  requiredCells: readonly { dialect: DialectName; op: string }[];
  pendingChangesText: string;
  readGolden: (dialect: DialectName, name: string) => GoldenRead;
}): string[];   // [] = pass; each non-empty string = one violation message; ALL rules evaluated, not short-circuited
```

Pass/fail rules:
1. Every `{dialect,op}` in `universe` ∈ exactly one of {a Tier-A row, a declared gap} — else FAIL
   `"undeclared cell {dialect}/{op}"`.
2. Every cell in `requiredCells` MUST be a Tier-A row — found in `gaps` instead FAILS `"required cell
   {d}/{op} illegitimately downgraded to gap"`.
3. Each Tier-A row is non-vacuous: `readGolden(row.dialect, row.seedGolden)` and
   `readGolden(row.dialect, row.expectedGolden)` both `{ok:true}` with non-empty `bytes`, AND (mutating
   op) `expected.bytes !== seed.bytes` — else FAIL `"vacuous cell {d}/{op}"`.
4. A required cell's golden read MUST be `{ok:true}` — `{ok:false, reason:"absent"}` FAILS `"missing
   golden ({d}/{op}): absent"`; `{ok:false, reason:"unreadable"}` FAILS `"missing golden ({d}/{op}):
   unreadable"` (the two reasons are named distinctly in the message, REQ-DCF-01).
5. Each gap's `followup` MUST be a non-empty exact substring of `pendingChangesText` — else FAIL
   `"unmatched followup reference for {d}/{op}: \"{followup}\""`.
6. `replaceContent` / any wire-level `{op:"modify"}` MUST NEVER appear in `universe` — an invariant of
   how `universe` is constructed (§C only reflects registered dialect-AST ops), not a runtime branch.

`readGolden`/`pendingChangesText` consumption: S-003's `.test.ts` supplies the REAL `readGolden` (reads
`test/e2e/dialect-coverage/golden/{dialect}/{name}` bytes; ENOENT → `absent`, any other read error →
`unreadable`) and REAL `pendingChangesText` (`readFileSync("openspec/pending-changes.md", "utf8")`).
S-004's `.negative.test.ts` supplies SYNTHETIC stubs for both — it never touches real disk state to
construct a fixture.

**DCS-03's argument, made concrete (REV 4)**: the signature above is `checkCoverage`'s ENTIRE input
surface — six parameters, none of which is "scan this directory" or "read this test file." It has no
file-scanning path at all. Therefore Tier-B flows (e.g. `dialect-modify.e2e.test.ts`'s coalescing
flows) can only ever be flagged if they somehow appeared inside `universe`/`rows`/`gaps` — and they
never do, because `universe` is built exclusively from §C's reflected dialect-AST op names, never from
a file/flow name. S-003's task list turns this into an assertion (real-input check + a negative unit
proving a fake "flow" entry WOULD be caught if it existed).

### C. Reflection mechanism (per dialect, one run each — the fit-42 `universe`)

Mirrors `test/dialects/typescript/ops-exact-set.test.ts:26-38` and
`test/dialects/react/ops-exact-set.test.ts:20-32` verbatim in shape — NOT a bare `find()`, NOT the
`ops.ts` module namespace:

```ts
const BASE_HANDLE_KEYS = new Set(RESERVED_HANDLE_NAMES); // src/core/define-dialect.ts, exported
const { client } = makeSpyClient({ "a.ts": "" });         // test/support/spy-client.ts
let tsOps: string[] = [];
const run = defineFactory<void>(async () => {
  tsOps = Object.keys(ts.find("a.ts")).filter((k) => !BASE_HANDLE_KEYS.has(k));
});
await run(undefined, { client });
// tsOps -> ["addImport","addFunction","addVariable","addClass","removeImport"]

// repeat with { client } = makeSpyClient({ "a.tsx": "" }) and react.find("a.tsx")
// reactOps -> ["setJsxProp","addImport"]
```

`universe = tsOps.map(op => ({dialect:"typescript", op})) ∪ reactOps.map(op => ({dialect:"react", op}))
∪ [{dialect:"typescript",op:"modify"}, {dialect:"react",op:"modify"}]`. One `defineFactory` run per
dialect — a run drives a single client, never spans both.

### D. Module paths (confirmed exact against design §4.2 File Changes — copied verbatim)

| Path | Action |
|---|---|
| `test/support/dialect-coverage/table.ts` | Create |
| `test/support/dialect-coverage/factory.ts` | Create |
| `test/support/dialect-coverage/harness.ts` | Create |
| `test/support/dialect-coverage/import-guard.ts` | Create |
| `test/support/dialect-coverage/check-coverage.ts` | **Create — REV 4 owner-ruled addition** |
| `test/e2e/dialect-coverage/tier-a.e2e.test.ts` | Create |
| `test/e2e/dialect-coverage/golden/typescript/{modify-seed.ts,modify-expected.ts}` | Create |
| `test/e2e/dialect-coverage/golden/react/{modify-seed.tsx,modify-expected.tsx}` | Create |
| `test/e2e/dialect-modify.e2e.test.ts` | Modify |
| `test/fitness/fit-42-dialect-coverage-completeness.test.ts` | Create |
| `test/fitness/fit-42-dialect-coverage-completeness.negative.test.ts` | Create |
| `scripts/regen-dialect-coverage-golden.ts` | Create |
| `scripts/verify-react-tier-a-diff.ts` | Create |
| `openspec/pending-changes.md` | Modify |

**§D delta (REV 4, owner-ruled)**: `check-coverage.ts` is NOT a separate row in design §4.2 — the design
folds `checkCoverage` into a bare code block without naming its host file (§B). The owner pinned its
permanent home here: a dedicated module, never exported from a `.test.ts` file, so both fit-42 files
import the SAME implementation rather than one re-exporting from the other. Created in S-003 (first
consumer); see §G for its tier assignment.

Canonical golden root: `test/e2e/dialect-coverage/golden/{dialect}/` — DCS-05 confinement, DCS-10
write-containment, and RME-03's changed-file-set constraint all agree on this one location.
Read-only (never modified, exercised only): `src/core/define-dialect.ts` (`RESERVED_HANDLE_NAMES`),
`src/dialects/{typescript,react}/index.ts` (`find()`), `src/core/context.ts` (`defineFactory`),
`src/testing/index.ts` + `src/testing/contract-fake.ts` (`runFactoryForTest`, `ContractFake`),
`test/support/spy-client.ts` (`makeSpyClient`), `test/support/golden.ts`, `test/support/import-scan.ts`.

### E. `flushScheduler`

`flushScheduler()` (in `harness.ts`) = await a microtask drain, THEN one `setImmediate` macrotask
tick — the deterministic replacement for `setTimeout(resolve, 10)` at
`dialect-modify.e2e.test.ts:151`. It guarantees any stray rejection still scheduled on the run's
promise chain gets a chance to surface before the `unhandledRejection` listener is torn down, without a
real-time wait.

### F. Harness per-row contract

`executeRow(row: CoverageRow): Promise<{ error?: unknown }>` — seeds a fresh `ContractFake` with
`{[row.seedPath]: <bytes from readGolden(row.dialect, row.seedGolden)>}`, runs `row.factory({dialect,
seedPath})` through `defineFactory`, asserts `fake.committedTree()` equals `new Map([[row.seedPath,
<bytes from readGolden(row.dialect, row.expectedGolden)>]])` — catches and RETURNS any thrown error
(never rethrows), so one row's failure can never abort the caller.
`iterateTierA(rows: readonly CoverageRow[])` — `describe(...) { for (row of rows) it(label, () =>
executeRow(row)) }`, giving one bun-test `it()` per row (per-row isolation via bun's own test
boundaries). `seedGolden` governs PRE-run bytes; `expectedGolden` governs the POST-run comparison
target.

### G. Import allow-list — TIERED (REQ-DCS-07's V4 resolution) + scanner contract (REV 4 pin)

**No longer a separate always-run test file.** The scanner logic lives in `import-guard.ts`, but the
POSITIVE proof is a **standing fitness assertion**: `describe("import allow-list")` INSIDE
`test/fitness/fit-42-dialect-coverage-completeness.test.ts` (S-003) — it runs on every `bun test`,
scanning the REAL seam modules against the tiered allow-lists below. S-004's `.negative.test.ts` fixture
modules remain the negative fail-closed proof of the underlying rules.

**Scanner signature (REV 4 — concrete, non-tautological)**:

```ts
export type Tier = "unit-of-addition" | "trusted-infra" | "scripts";

// Built ONCE at module load — never re-derived per call.
interface TierAllowSet {
  relativeTargets: Set<string>;   // ABSOLUTE resolved paths (not raw specifiers)
  bareNames: Set<string>;         // matched by literal string equality
}

export function scanImports(filePath: string, tier: Tier): string[]; // [] = pass, else one message per violation
```

**Matching semantics — RESOLVE-TO-ABSOLUTE** (mirrors `test/support/import-scan.ts`'s own
`resolve(dirname(file), specifier)` pattern, reused rather than reinvented):
1. Read `filePath`'s source, strip whole `import type`/`export type` declarations FIRST (compile-time
   erased, zero runtime edge — this is why the factory's `import type { SourceFile } from "ts-morph"`
   never needs a runtime allow-set entry).
2. Extract every remaining import specifier (`IMPORT_SPECIFIER_RE`, reused from `import-scan.ts`).
3. For a RELATIVE specifier: resolve it against `dirname(filePath)` to an ABSOLUTE path, then check
   that absolute path against `tier`'s `relativeTargets` — since both sides are absolute, table.ts (in
   `test/support/dialect-coverage/`) and `tier-a.e2e.test.ts` (in `test/e2e/dialect-coverage/`) share
   ONE allow-set even though their relative specifiers to the same target differ syntactically by
   depth. The Tier-1 "sibling wildcard" is a PREFIX check: any resolved absolute path that starts with
   the resolved absolute path of `test/support/dialect-coverage/` passes, no per-file enumeration
   needed.
4. For a BARE/builtin specifier: literal string-equality match against `tier`'s `bareNames`.
5. Anything that fails both checks is a violation, named by its raw specifier + resolved path.

**Runtime tier table (declarative source, resolved to absolute paths once)**:

```ts
const TIERS_SOURCE: Record<Tier, { relativeSpecifiers: string[]; bareNames: string[] }> = {
  "unit-of-addition": {
    relativeSpecifiers: [
      "src/dialects/typescript/index.ts", "src/dialects/react/index.ts", "src/testing/index.ts",
      // sibling wildcard handled structurally (prefix check), not enumerated here
    ],
    bareNames: ["bun:test", "node:path"],
  },
  "trusted-infra": {
    relativeSpecifiers: [
      ...TIERS_SOURCE["unit-of-addition"].relativeSpecifiers,
      "src/core/define-dialect.ts", "src/core/context.ts", "test/support/spy-client.ts",
    ],
    bareNames: [...TIERS_SOURCE["unit-of-addition"].bareNames, "node:fs"],
  },
  "scripts": {
    relativeSpecifiers: [...TIERS_SOURCE["trusted-infra"].relativeSpecifiers],
    bareNames: [...TIERS_SOURCE["trusted-infra"].bareNames, "node:child_process"],
  },
};
// resolveTierTable() resolves each relativeSpecifier (repo-root-relative) to an absolute path ONCE,
// producing Record<Tier, TierAllowSet> — this is what scanImports actually consults.
```

Because the real, shipped modules must PASS their tier from the moment each is authored (S-000 onward),
every module below is a fixed, permanent tier assignment — not something later slices renegotiate:

- **Tier 1 — `"unit-of-addition"` (STRICT)**: `table.ts`, `factory.ts`. NO `node:fs` — deliberately: this
  is the contributor-facing surface the guard exists to protect; adding `fs` here would blunt it.
- **Tier 2 — `"trusted-infra"`**: `harness.ts`, `tier-a.e2e.test.ts`, both `fit-42-dialect-coverage-
  completeness{,.negative}.test.ts`, AND `check-coverage.ts` (REV 4 amendment — see below). Adds
  `node:fs` (realpath/lstat containment + golden `readFileSync`) + 3 sanctioned src-core relatives.
  Completion not spelled out verbatim in design but logically required: Tier 2's relative set ALSO
  covers each of these files' own import of the seam modules under `test/support/dialect-coverage/**`
  (`table.ts`/`factory.ts`/`harness.ts`/`check-coverage.ts`) via the sibling-wildcard prefix rule above
  — without it `tier-a.e2e.test.ts` and the fit-42 files could never wire the seam they test.
- **Tier 3 — `"scripts"`**: `regen-dialect-coverage-golden.ts`, `verify-react-tier-a-diff.ts`. Adds
  `node:child_process` (the diff oracle's `execFileSync`, precedent `conformance-pr-gate.ts`).
  (`node:url`/`URL` is a global, no import statement, so the specifier scanner never sees it.)

**§G amendment (REV 4, owner-ruled)**: `check-coverage.ts` (§D) is assigned Tier 2. The pure
`checkCoverage` function itself needs no `node:fs` (all I/O is injected via `readGolden`/
`pendingChangesText`, §B) — Tier 2 is the conservative, practical choice matching its physical
neighborhood (lives in `test/support/dialect-coverage/**` alongside `harness.ts`, consumed only by the
Tier-2 fit-42 files). Created in S-003, in the same task set that authors the standing assertion, so it
is scanned from the moment it exists.

**Scan-set derivation (implementation choice, not itself a numbered REQ-scenario)**: the standing
`describe("import allow-list")` block calls `scanImports` on each of the fixed per-tier paths above
THAT EXISTS ON DISK at the time `bun test` runs — it is not a hand-maintained literal list
re-registered by every later slice. This means S-003 (which lands before S-004's negative file and
before S-005's diff-oracle script exist) scans only the Tier-1/Tier-2 files already landed by then; the
scan naturally covers the remaining Tier-2/Tier-3 files once S-004/S-005 land, with zero edits to the
standing assertion itself.

### H. Rulings (adjudicated by the user — NOT open questions)

Per `north-star.md` (2026-07-22, user-affirmed): REQ-RME-03's extensibility proof binds ONLY to the
new-DIALECT case (React `.modify`, zero new factory, reusing `modifyFactory`). A GENUINELY NEW OPERATOR
(a future change) additionally authors one small function in `factory.ts` — that wider "unit of
addition" is documented for that future case, not a gap in this change. Do not treat this distinction
as ambiguous or escalate it mid-build — it is already decided.

### I. Seed provenance (V4 pin — blocks S-000's regen)

`modifyFactory` MUTATES; it cannot synthesize its own input. Each row's SEED source-of-truth is
therefore an AUTHORED TypeScript constant embedded directly IN
`scripts/regen-dialect-coverage-golden.ts` — mirroring `scripts/regen-corpus.ts`'s authored-input
pattern (`regen-corpus.ts:10,19`: `SCENARIOS[].input` is an authored constant, e.g. `scenarios.ts:81`
`input: { port: 8080 }`; the GOLDEN is derived by running, never hand-authored).

Regen sequence, per row: (1) write `modify-seed.{ts,tsx}` VERBATIM from the row's authored constant; (2)
DERIVE `modify-expected.{ts,tsx}` by executing the row's `factory` against a fresh `ContractFake` seeded
with those exact bytes, then reading `committedTree()`; (3) write both files under
`test/e2e/dialect-coverage/golden/{dialect}/` THROUGH §J's containment validator.

**DCS-04 reconciliation**: the authored constants living IN the regen script ARE the sanctioned source
— DCS-04's "no hand-authored golden bytes" ban applies to EDITING files under the golden root directly
on disk, never to the script's own authored seed constant.

**Pinned seed constants (both authored in S-000, non-empty per REQ-DCF-06)**:
- TypeScript (`seedPath: "a.ts"`): `export const a = 1;\n`
- React (`seedPath: "a.tsx"`, JSX-bearing to exercise `ScriptKind.Tsx`): `export const App = () => <div />;\n`

`canonicalModify` (§A's `modifyFactory`) appends `export const __e2eCoverageMarker = true;`, so
expected ≠ seed for both — proving mutation.

**Why BOTH constants land in S-000, even though the React ROW doesn't land until S-002**: REQ-RME-03
caps the React row's landing diff to `{table.ts, the two golden/react/* files}` — it must NOT touch the
regen script. If the React seed constant were authored only when the React row lands, S-002 would have
to edit the regen script, breaking that cap. Authoring BOTH constants up front in S-000 (even though
only the TS row is wired into `ROWS` at that point) means S-002 only adds a table row and re-runs the
ALREADY-CAPABLE, unmodified regen script — resolving the tension. This is the one genuine design
tension REV 3 surfaces; see the envelope's conflict note.

### J. Two-stage containment (ADR-04 V4 pin — supersedes REV 2's flat "symlink-aware" description)

One validator, in `harness.ts`, imported by regen (§I). Strict stage order, content I/O ONLY after BOTH
stages pass:

- **Stage 1 — LEXICAL, zero fs calls**: reject a backslash, a leading `/`, or any `..` path segment.
  Error identity: `PathLexicalError` (names the offending segment/char). This is what satisfies
  REQ-DCS-11.1 — a `..` path never reaches an fs call at all.
- **Stage 2 — METADATA-ONLY** (permitted validation I/O, never content read/write): `lstat` each
  EXISTING path component — any symlinked component → `PathSymlinkError` (names it). Then `realpath`
  the deepest existing ancestor and assert it stays under `realpath(canonical root)` — failure →
  `PathEscapeError`. REQ-DCS-11.2 ("before any read or write touches disk") is honored because `lstat`/
  `realpath` are metadata probes; the target's actual content open/read/write happens only once BOTH
  stages pass.
- **Three distinct error identities** (`PathLexicalError`, `PathSymlinkError`, `PathEscapeError`) are
  asserted separately by S-004's negatives — never collapsed into one generic "invalid path" error.
- **Residual**: a TOCTOU window between Stage 2 and the single content fs call — mitigated by running
  Stage 2 immediately before that call, and by regen being a maintainer-run script, never CI-triggered.

**Single-write-path rule (REV 4 pin, ties to DCS-10's concrete mechanism)**: `harness.ts` exports
`writeWithinRoot(absolutePath: string, bytes: string): void` — the ONLY sanctioned disk-write entry
point in the whole seam, running both containment stages above before writing. The regen script (§I)
MUST call ONLY `writeWithinRoot` for every write; it must contain ZERO direct fs-write identifiers
(`writeFileSync`, `appendFileSync`, `createWriteStream`, `fs.promises.writeFile`) anywhere in its own
source. S-003's standing assertion proves this MECHANICALLY (a static string/identifier scan of the
regen script's source, not a behavioral test); the validator's actual containment LOGIC (the three
error identities above) is proven behaviorally by S-004's negatives.

### K. Import-guard authoring note (V4 — ties §G to S-000's tasks)

`import-guard.ts` (created in S-000) implements the SCANNER (strip-then-match against a supplied
tier's allow-set); the tier assignment table (§G) and the standing `describe` block that INVOKES it
over real files are authored later (S-003). S-000 must still author `table.ts`/`factory.ts`/
`harness.ts`/the regen script so their OWN imports already comply with their respective tier (§G) from
day one — the standing assertion in S-003 is a proof of an already-true property, never a target the
code is retrofitted to meet.

---

## S-000: Walking Skeleton — TS `.modify` proves table→factory→ContractFake→golden

**Scope**: walking-skeleton | **Dimension**: —
**Covers**: DCS-01, DCS-02, DCS-08, DCS-12, RME-02
**Requires**: nothing
**Test-first**: author `tier-a.e2e.test.ts`'s TS-row assertion FIRST (red — table/factory/harness don't
exist) before writing the seam modules that make it pass.

**Why RME-02 lands here, not with the React row (S-002)**: REQ-RME-03 forbids S-002's landing commit
from touching the Tier-A iterating harness at all. RME-02.2's isolation test is a PERMANENT test that
must physically live inside `tier-a.e2e.test.ts` (design §4.4b) — so it has to land before or
independent of S-002's zero-other-diff commit. It uses a wholly synthetic table, never the real shipped
`ROWS`, so it has no dependency on the real React row either.

### Tasks
- [ ] `table.ts`: `ROWS` (one TS row, `seedPath:"a.ts"`), `DECLARED_GAPS` (7 rows, §A), `REQUIRED_CELLS`
      — Tier 1 imports only (§G)
- [ ] `factory.ts`: `modifyFactory` (§A) — Tier 1 imports only (§G)
- [ ] `harness.ts`: two-stage containment validator + `writeWithinRoot` (§J), bytes-only golden loader,
      `executeRow`/`iterateTierA` (§F), `flushScheduler` (§E) — `"trusted-infra"` tier imports (§G)
- [ ] `import-guard.ts`: `scanImports(filePath, tier)` (§G's exact signature/resolve-to-absolute
      semantics), strips `import type`/`export type` first
- [ ] `scripts/regen-dialect-coverage-golden.ts`: authors BOTH pinned seed constants now (§I — TS AND
      React, even though only the TS row is wired into `ROWS` yet); implements the 3-step regen sequence
      (§I); writes ONLY via `harness.ts`'s `writeWithinRoot` (§J) — zero direct fs-write identifiers in
      this file's own source — `"scripts"` tier imports (§G)
- [ ] Run regen → produce `golden/typescript/{modify-seed.ts,modify-expected.ts}` (from the TS constant)
- [ ] `tier-a.e2e.test.ts`: `describe(...)` calling `iterateTierA(ROWS)` — one `it()` for the TS row
- [ ] `tier-a.e2e.test.ts`: ALSO add `describe("harness — per-row failure isolation")` running
      `executeRow` over an in-test-only synthetic table `[goodRow, failingRow, goodRow2]`, where
      `failingRow` is a `{dialect:"react", seedPath:"a.ts", ...}` row (a `.ts` path trips React's
      synchronous `.tsx` gate) — this row is NEVER added to shipped `ROWS`. Assert
      `results[1].error !== undefined` and `results[0].error === undefined && results[2].error ===
      undefined`

**Acceptance**:
- GIVEN `table.ts`'s single TS row and its two golden files (produced via §I's regen sequence, not
  hand-authored)
- WHEN `tier-a.e2e.test.ts`'s main loop runs
- THEN `fake.committedTree()` equals the golden `Map` byte-for-byte, and the golden load path used
  bytes-only reads (DCS-12) — never `import()`/`require()`
- GIVEN the synthetic `[goodRow, failingRow, goodRow2]` table
- WHEN the isolation `describe` block runs `executeRow` over it
- THEN `failingRow`'s `.tsx` gate throws before any op executes (RME-02.1) and is reported as ITS OWN
  isolated failure while both `goodRow`/`goodRow2` still execute and report independently (RME-02.2)
- `table.ts`/`factory.ts` import only from `"unit-of-addition"`'s allow-set; `harness.ts`/
  `tier-a.e2e.test.ts` only from `"trusted-infra"`'s; the regen script only from `"scripts"`'s (§G) —
  verified manually now via `scanImports`, proven by the standing assertion once S-003 lands
- DCS-08 is already satisfied by design.md §4.5 (ADR-01..04 recorded) — no code task, closed by
  reference.

**Size**: M

---

## S-001: TS Tier-B robustness retrofit

**Scope**: happy-path | **Dimension**: P (failure-path hardening)
**Covers**: DCS-09, DMR-01, DMR-02, DMR-03
**Requires**: nothing beyond skeleton
**Test-first**: add the new assertions FIRST (red — `runFactoryForTest`/dual-oracle/`flushScheduler` not
yet wired in this file), then wire them. The four existing Flow 1-4 golden-byte comparisons are NEVER
edited (REQ-DCS-09) — every new assertion is additive.

### Tasks
- [ ] `dialect-modify.e2e.test.ts`: add a Tier-B header comment referencing the seam
- [ ] Inside `it("Flow 1: addImport + .modify() on one file coalesce into a single committed modify")`
      (exact existing title, DO NOT rename): leave the existing `defineFactory`+`ContractFake` run and
      its `committedTree()` assertion COMPLETELY UNTOUCHED; ADD a second, separate run of the SAME
      `.addImport(...).modify(...)` chain via `runFactoryForTest`, asserting
      `result.emitted.length === 1` AND `result.emitted[0].instructions.length === 1` (DMR-01)
- [ ] Add a NEW `it()` block (not modifying any existing one): an AWAITED `.modify(fn)` callback that
      mutates the AST then throws, against a directly-constructed `ContractFake` — assert
      `fake.committedTree()` is empty AND (a separate, distinctly-named oracle) `fake.read(path)`
      resolves to the ORIGINAL seeded bytes, unchanged (DMR-02 — `runFactoryForTest` exposes no `read`,
      per §D read-only row, so this test must use `ContractFake` directly)
- [ ] Inside `it("Flow 4: an unawaited THROWING chain rejects the run contained, no unhandledRejection")`
      (exact existing title): replace `setTimeout(resolve, 10)` at line 151 with `flushScheduler()`
      (§E); keep `expect(unhandled).toEqual([])` unchanged (DMR-03, scoped to these four canonical
      flows only — not a suite-wide change)
- [ ] Confirm every pre-existing Flow 1-4 golden-byte comparison is byte-unchanged (DCS-09)

**Acceptance**:
- GIVEN the pre-retrofit suite passing
- WHEN the DMR-01 second run, the DMR-02 new `it()`, and the DMR-03 `flushScheduler` swap are added
- THEN every pre-existing Flow 1-4 golden assertion still passes against unchanged golden bytes, and all
  three new/modified assertions pass: exactly 1 emitted directive (DMR-01), empty commit + unchanged
  `read()` on the awaited-throw path (DMR-02), zero unhandled rejections with no timed wait (DMR-03)

**Size**: S

---

## S-002: React `.modify` Tier-A row — the extensibility acceptance proof

**Scope**: happy-path | **Dimension**: D (Data — new dialect, same universal cell)
**Covers**: RME-01, RME-04
**Requires**: nothing beyond skeleton (independent of S-001)
**Test-first**: append the react row to `table.ts` and watch `tier-a.e2e.test.ts` pick it up and fail
(goldens absent) BEFORE running regen.
**Sequencing constraint 1 (hard)**: lands as its OWN atomic commit carrying trailer
`Coverage-Cell: react/modify` — no other slice's changes ride in this commit. `tier-a.e2e.test.ts` and
`scripts/regen-dialect-coverage-golden.ts` are NOT touched here — the isolation test already landed in
S-000, and the React seed constant was already authored in S-000 (§I), so this row only needs to
reference existing capability.

### Tasks
- [ ] `table.ts`: append ONE row `{dialect:"react", op:"modify", seedPath:"a.tsx", seedGolden:
      "modify-seed.tsx", expectedGolden:"modify-expected.tsx", factory: modifyFactory}` (§A) — zero new
      factory authored
- [ ] Run the EXISTING regen script (from S-000, unmodified) to produce
      `golden/react/{modify-seed.tsx,modify-expected.tsx}` from S-000's already-authored React constant
- [ ] Diff-check locally: `tier-a.e2e.test.ts`, `fit-42*`, `factory.ts`, `harness.ts`,
      `scripts/regen-dialect-coverage-golden.ts` all byte-unchanged
- [ ] Commit with trailer `Coverage-Cell: react/modify`

**Acceptance**:
- GIVEN the react row + its two golden files
- WHEN `tier-a.e2e.test.ts`'s existing (unmodified) main loop runs
- THEN both TS and react modify rows pass in the same run (RME-01); committed bytes equal the golden
  byte-for-byte including line endings (RME-04)
- GIVEN `git show --stat` on the landing commit
- THEN the changed-file set ⊆ {`table.ts`, the two new `golden/react/*` files} and the commit trailer
  reads `Coverage-Cell: react/modify`

**Size**: S

---

## S-003: fit-42 positive completeness guard + standing import-guard assertion + declared-gap ledger

**Scope**: happy-path | **Dimension**: R (Rule — completeness/partition/import-tier enforcement)
**Covers**: DCS-03, DCS-04, DCS-05, DCS-10, DCF-01, DCF-02, DCF-05, DCF-06
**Requires**: S-002 (`REQUIRED_CELLS` statically includes `{react, modify}`; fit-42 cannot pass until
that row is landed)
**Test-first**: write `fit-42-dialect-coverage-completeness.test.ts`'s assertions against the REAL
reflected universe FIRST (red — file doesn't exist).
**Sequencing constraint 6 (hard)**: re-verify the `fit-42` number is still free across ALL branches
(`git log --all --oneline | rg 'fit-4[0-9]'`; confirmed free as of this planning session, ceiling
`fit-41` — re-check at apply time per lesson #2086) at the START of this slice, before creating either
fit-42 file.
**Sequencing constraint 2 (hard)**: the `pending-changes.md` edit lands WITH this slice (same commit
set), never after — fit-42 fails closed on first run without it.

### Tasks
- [ ] Re-verify fit-42 unclaimed
- [ ] `test/support/dialect-coverage/check-coverage.ts` (REV 4 module hoist, §D/§G): define and export
      `checkCoverage` (§B) here — its ONLY home; never inline it in a `.test.ts` file
- [ ] `openspec/pending-changes.md`: add a `dialect-coverage` block. Each of the 7 lines MUST contain
      one of §A's exact `followup` strings as a verbatim substring, wrapped in prose that names this as
      an E2E/SEAM-level gap distinct from op-level coverage, e.g.:
      `- dialect-coverage gap: typescript/addImport — e2e (seam) coverage only; op-level`
      `  conformance/unit tests for addImport already exist and are unaffected.`
      (repeat for all 7 anchors) — confirmed absent from the file today
- [ ] `fit-42-dialect-coverage-completeness.test.ts`: build `universe` per §C; IMPORT `checkCoverage`
      from `check-coverage.ts` (never define it locally); call `checkCoverage({universe, rows: ROWS,
      gaps: DECLARED_GAPS, requiredCells: REQUIRED_CELLS, pendingChangesText, readGolden})` per §B with
      REAL disk-backed `readGolden`/`pendingChangesText`
- [ ] SAME file: add `describe("import allow-list")` — the standing positive assertion — calling
      `scanImports(filePath, tier)` (§G) once per real path: `table.ts`/`factory.ts` →
      `"unit-of-addition"`; `harness.ts`/`tier-a.e2e.test.ts`/both fit-42 files/`check-coverage.ts` →
      `"trusted-infra"` — assert `scanImports(...)` returns `[]` for each existing path (§G's
      derivation rule: skip paths that don't exist yet, e.g. S-005's script)
- [ ] DCS-03 (concrete mechanism, §B): (a) assert `checkCoverage({...REAL ROWS/DECLARED_GAPS/universe})`
      returns `[]`, THEN grep the same three REAL inputs and assert none contains the substring
      `"dialect-modify"` or any Tier-B flow name — proving Tier-B is verifiably absent from every input
      `checkCoverage` could ever see; (b) negative unit: construct a COPY of `universe` with one
      injected fake entry `{dialect:"typescript", op:"__fakeFlow"}` (not in `rows` or `gaps`) → assert
      `checkCoverage` returns exactly one violation naming it — proves a non-cell entry WOULD be
      flagged, so Tier-B flows are provably never flagged only because they never appear as an entry
- [ ] DCS-04 (concrete mechanism): assert `!/\.test\.(ts|tsx)$/.test(basename(regenScriptPath))` AND
      `regenScriptPath` resolves under `scripts/` (not any test root) — a mechanical filename/location
      check, mirroring fit-40's own corpus-placement assertion style
- [ ] DCS-05 (concrete mechanism, mirrors the FIT-08 negative-declaration precedent in
      `fit-08-no-kit-bleed.test.ts`): (a) resolve every `package.json#exports` target and assert none
      lands outside `dist/**`; (b) statically scan `src/conformance/index.ts` + `src/testing/index.ts`
      SOURCE TEXT and assert no import/re-export specifier resolves under
      `test/support/dialect-coverage/**` or `test/e2e/dialect-coverage/**`
- [ ] DCS-10 (concrete mechanism, §J): statically scan `scripts/regen-dialect-coverage-golden.ts`'s
      source text and assert ZERO occurrences of `writeFileSync`/`appendFileSync`/`createWriteStream`/
      `fs.promises.writeFile` — the single-write-path rule (§J) means every write MUST flow through the
      imported `writeWithinRoot`; behavioral proof of the validator's own logic stays in S-004

**Acceptance**:
- GIVEN the real coverage table (TS+react rows) and the pending-changes ledger with its 7 anchors
- WHEN `fit-42...test.ts` runs
- THEN `checkCoverage(...)` (imported from `check-coverage.ts`) returns `[]` (pass): the 7 non-modify
  cells resolve as declared gaps with matched followups (§B rule 5 = DCF-05, rule 1 = DCF-02.2), the
  two modify cells are non-vacuous Tier-A rows (§B rule 3 = DCF-06, rule 4 = DCF-01)
- GIVEN the mechanisms above
- WHEN each runs
- THEN: Tier-B is never flagged (DCS-03, both the real-input check and the fake-flow negative pass);
  the regen script's filename/location fails the test-glob pattern (DCS-04); no export-surface/source
  scan finds a leak (DCS-05); the regen script's source contains zero direct fs-write identifiers
  (DCS-10)
- GIVEN the real, already-landed seam modules from S-000/S-001/S-002
- WHEN `describe("import allow-list")` runs
- THEN every existing real module's imports are within its own tier's allow-set (§G) — zero failures
  (this is the standing positive half of DCS-07; S-004 carries the negative half)

**Size**: M

---

## S-004: fit-42 negative fail-closed suite

**Scope**: edge-case | **Dimension**: R (Rule — fail-closed security/completeness proof)
**Covers**: DCS-06, DCS-07, DCS-11, DCF-03, DCF-04
**Requires**: S-003 (imports the shared pure `checkCoverage` from `check-coverage.ts`, created there —
REV 4 firm dependency, no longer a co-location assumption)
**Test-first**: write each negative scenario as a failing assertion against SYNTHETIC `checkCoverage`
args and synthetic import fixtures FIRST — zero `src/**` or real-table mutation for any of them.

### Tasks
- [ ] `fit-42...negative.test.ts` — deliberate-deletion: synthetic `readGolden` stub returns
      `{ok:false, reason:"absent"}` for `{react,modify}` → §B rule 4 fails naming it (DCF-04, DCF-01.1);
      `{ok:false, reason:"unreadable"}` variant fails distinctly (DCF-01.2); a `rows` array with NO
      `{typescript,modify}` entry at all fails via rule 1 (DCF-01.3)
- [ ] Injected-universe negative: synthetic `universe` with one extra op absent from both `rows`/`gaps`
      → §B rule 1 fails naming it (DCF-03.2); assert a `universe` array is never constructed to include
      `replaceContent` or a wire `{op:"modify"}` shape (DCF-03.1, §B rule 6)
- [ ] Import-guard negative (against fixture modules, calling `scanImports(fixturePath, tier)` per §G,
      using `"unit-of-addition"`'s strict set as the test case): `node:vm` fails closed (DCS-07.1, not
      on any tier's bare/builtin list); bare npm specifier e.g. `lodash` fails closed (DCS-07.2);
      non-sanctioned relative import fails closed (DCS-07.3); `import type { SourceFile } from
      "ts-morph"` passes (§G's type-strip exemption) — a factory resolving to a string path or dynamic
      `import()` also fails (DCS-06)
- [ ] Containment negative (§J), asserting the THREE DISTINCT error identities: a `seedGolden` value
      with a `..` segment → `PathLexicalError` before any read (DCS-11.1); a symlinked path component →
      `PathSymlinkError`; a syntactically-relative path resolving outside the canonical root →
      `PathEscapeError` before any content read/write (DCS-11.2)

**Acceptance**:
- GIVEN each synthetic negative fixture above
- WHEN the corresponding check runs
- THEN it fails closed, naming the offending cell/specifier/path with the correct distinct error
  identity per §B/§J's rules, and no `src/**` file or real committed table/golden file was touched to
  construct the fixture

**Size**: M

---

## S-005: CI extensibility diff oracle

**Scope**: edge-case | **Dimension**: I (Interface — CI verification entry point, not manual review)
**Covers**: RME-03, RME-05
**Requires**: S-002 (diffs the actual React-row landing commit)
**Test-first**: write the oracle's own synthetic over-broad-diff fixture test FIRST (expect non-zero
exit), then implement the script against it. Author its imports within Tier 3 (§G) from the start —
S-003's standing assertion will pick this file up automatically once it exists (§G's derivation rule),
no edit to the standing assertion required.

### Tasks
- [ ] `scripts/verify-react-tier-a-diff.ts`: resolve the commit internally — `git merge-base HEAD
      origin/main` → `git log --format=%H%x1f%B <mergeBase>..HEAD --` → the commit whose body contains
      trailer `Coverage-Cell: react/modify`; explicit `<base> <head>` override validated
      `/^[0-9a-f]{7,40}$/`; `--` precedes revisions; no raw argv/env interpolation (forked-PR CI
      hardening)
- [ ] Diff that commit: `git diff --name-only <sha>^ <sha> --`; assert changed-file set ⊆ {`table.ts`,
      the two `golden/react/*` files}; exit non-zero otherwise
- [ ] Run against S-002's real landing commit — passes (RME-05.1)
- [ ] Synthetic fixture: a commit that ALSO edits `tier-a.e2e.test.ts` alongside the react row → oracle
      fails, naming that file (RME-05.2)

**Acceptance**:
- GIVEN S-002's actual landing commit
- WHEN the oracle runs with no override
- THEN it exits 0; on the synthetic over-broad fixture it exits non-zero naming the disallowed file
- Imports resolve within Tier 3's allow-set (§G) — proven automatically by S-003's already-landed
  standing assertion once this file exists on disk, no code change needed there

**Size**: S

---

## REQ Coverage Matrix (26/26)

| REQ-ID | Slice | REQ-ID | Slice | REQ-ID | Slice | REQ-ID | Slice |
|---|---|---|---|---|---|---|---|
| DCS-01 | S-000 | DCS-07 | S-004 | DCF-02 | S-003 | RME-03 | S-005 |
| DCS-02 | S-000 | DCS-08 | S-000 | DCF-03 | S-004 | RME-04 | S-002 |
| DCS-03 | S-003 | DCS-09 | S-001 | DCF-04 | S-004 | RME-05 | S-005 |
| DCS-04 | S-003 | DCS-10 | S-003 | DCF-05 | S-003 | DMR-01 | S-001 |
| DCS-05 | S-003 | DCS-11 | S-004 | DCF-06 | S-003 | DMR-02 | S-001 |
| DCS-06 | S-004 | DCS-12 | S-000 | RME-01 | S-002 | DMR-03 | S-001 |
| | | | | RME-02 | S-000 | | |

All 26 REQ-IDs covered exactly once. DCS-07 stays anchored at S-004 (its Scenarios 07.1-07.3 are all
negative/fail-closed proofs) even though V4 adds a NEW standing positive proof of the same underlying
tiered allow-list in S-003 — that positive proof isn't itself a distinct numbered REQ-scenario, so it
doesn't create a second coverage claim, just a second (design-mandated) task in S-003.

## Build Order

1. **S-000** (skeleton — implicit blocker for all)
2. **S-001** — independent of S-002, can build in parallel with it
3. **S-002** — independent of S-001; MUST land as its own commit (constraint 1)
4. **S-003** — requires S-002 (`REQUIRED_CELLS` includes `{react,modify}`); its `pending-changes.md`
   edit MUST land with it, never after (constraint 2)
5. **S-004** — requires S-003 (imports its `checkCoverage`)
6. **S-005** — requires S-002 (diffs its commit); independent of S-003/S-004 (§G's existence-based
   derivation means S-003 need not be re-touched when S-005 lands, in either order)

## Sequencing Risks

- **Constraint 1** (own commit + trailer, zero other diff): enforced in S-002's tasks/acceptance —
  `tier-a.e2e.test.ts` AND the regen script are both fully authored in S-000 (isolation test, both seed
  constants) and MUST NOT be touched by S-002.
- **Constraint 2** (pending-changes before/with fit-42): enforced by placing the ledger edit inside
  S-003, same commit set as the fit-42 positive test.
- **fit-42 number**: verified free against `main` and all branches as of this planning session (ceiling
  is `fit-41`); S-003 re-verifies at slice start per lesson #2086.
- **`table.ts` double-touch**: S-000 creates it (TS row), S-002 extends it (+React row) — intentional,
  the extensibility contract itself (§A/§H), not a slicing defect.
- **Seed-provenance vs. zero-diff tension (RESOLVED, §I)**: V4 requires seed constants to live embedded
  in the regen script, which would normally force S-002 to edit that script when landing the React row
  — violating REQ-RME-03's diff cap. Resolved by authoring BOTH dialects' seed constants in S-000
  up front (§I), so S-002 never needs to touch the regen script.
- **S-004's dependency on S-003 is now FIRM (REV 4)**: `checkCoverage` lives in its own module,
  `check-coverage.ts` (§D/§G, owner-ruled), created in S-003 — S-004 imports it from there, no longer a
  co-location assumption.
- **Import-guard tier assignment for `"trusted-infra"`'s cross-directory imports** (§G) is a necessary
  completion I derived, not a verbatim design quote — flagged so `sdd-apply` treats it as a load-bearing
  modeling choice, not an oversight to "correct."
- **REV 4 delta summary**: `check-coverage.ts` is a NEW file vs design §4.2's literal table (owner-ruled,
  §D); the import-guard's scanner signature (`scanImports(filePath, tier)`, resolve-to-absolute
  semantics, §G) and the four S-003 assertion mechanisms (DCS-03/04/05/10) are concrete pins that did
  not exist verbatim in design — both are owner-authorized additions, not inferences to second-guess.

## Anti-Pattern Check

Pass — no horizontal/layer-named slices; every slice references ≥1 REQ-ID; no slice cross-cuts two
SPIDR dimensions; 6 total slices (within L's 4-7 target); no slice depends on >2 others (max is 1
explicit dependency each); S-000 never listed as a dependency elsewhere.
