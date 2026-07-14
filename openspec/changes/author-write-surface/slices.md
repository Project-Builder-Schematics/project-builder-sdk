# Slices: Author write surface — honest write-verb rename

**Triage**: L
**Spec version**: V4 (7 domains, all signed 2026-07-14; REQ-TSD-12 tombstoned — no slice references it)
**Total slices**: 5 (1 walking skeleton + 4 SPIDR)
**Revision**: v3 — closes `verify-plan-2.md` iteration-2 gaps 1-4 (missing REQ-DG-06.6 task,
REQ-DG-06 no-refactor-implied note, 11 executor-grade technical questions, 2 rulings recorded
as decided). Slice structure, build order, and REQ coverage from v1/v2 are RATIFIED and
UNCHANGED; this revision only adds tasks, inlines verbatim spec text, and records live-verified
facts. v2 closed `verify-plan-1.md` iteration-1 gaps 1-4 (2 missing task groups + executor
self-sufficiency enrichment + pinned product answers).

**Path convention**: every path below is repo-root-relative (the directory containing `openspec/`,
`src/`, `test/`). No path in this document is a bare filename — always at least
`src/core/…`/`test/…`/`docs/…`/`openspec/…`.

**Test runner (corrected from the launch brief)**: this repo runs on **Bun's built-in test
runner**, not Vitest — `package.json`'s `"test"` script is `bun test`; every test file imports
from `"bun:test"` (confirmed live, e.g. `test/fitness/fit-04-dts-semver-gate.test.ts:29`). Run a
single file with `bun test path/to/file.test.ts`. Build with `bun run build` (runs
`tsc -p tsconfig.build.json` then bundles the codegen bin) — this is what regenerates `dist/**`
for FIT-04 baseline diffing.

**RED-first vs adapt-first (Strict TDD)**: **adapt-first** = a literal string/name swap inside an
ALREADY-GREEN test, landed in the SAME commit as the source rename it exercises (the rename and
its call-site are one mechanical unit, not two commits). **RED-first** = new behavior or a new
negative pin that has never been asserted before — write the failing test BEFORE the code/message
that makes it pass. Each task below is tagged `[adapt]` or `[RED]`. A **characterisation test**
(S-000.2) is a THIRD, one-time category: it pins CURRENT (soon-to-be-replaced) behavior GREEN
first, as rollback evidence, then is replaced by the RED-first reject scenarios in the same slice.

---

## Decided — do not re-ask (Gap 4, all four Judge-B product questions are owner-signed)

An executor MUST NOT stop to ask about any of the following — they are closed, on record:

1. **Naming is final** (engram obs #2109, #2114, #2117): `replaceContent(content)` /
   `modify(fn)` are the shipped names. No further bikeshedding.
2. **The wire-level verb label `"modify"` at the error/dry-run altitude is DELIBERATE, not a
   leftover** — `src/core/authoring-error.ts`'s `AuthoringVerb` and `src/dry-run/plan.ts`'s
   `DryRunVerb` both KEEP the literal `"modify"` for BOTH `.replaceContent()`- and
   `.modify(fn)`-produced directives (REQ-AEC-13). This is a wire-altitude label, not an
   author-call-name mirror — do not "fix" it to `"replaceContent"`.
3. **Wire IR is frozen byte-identical** — `{op:"modify", modify:{path,content}}` never changes
   shape; `test/golden-ir/fixtures.ts`'s `GOLDEN_MODIFY`/`CREATE_THEN_MODIFY` fixtures keep their
   wire content and even their fixture NAME (`create-then-modify`) unchanged. This is a hard
   contract, not a style choice — only the AUTHOR CALL inside the test changes.
4. **Clean break, ZERO deprecation aliases** — pre-1.0, no external consumers, no registry
   publish (`package.json` gains no new export subpath in this change). Do not add a `raw` or
   old-`modify` shim "for safety."
5. **REQ-TSD-12 requires NO action** — it is TOMBSTONED (retired, never implemented, obs #2128).
   No slice references it; do not hunt for code to delete — there is none, it was deferred at
   design time, never built.
6. **`RESERVED_HANDLE_NAMES` is `@internal`, not supported public API** (ORCHESTRATOR RULING R2,
   `verify-plan-2.md` gap 4, Q10): the array is exported from `src/core/define-dialect.ts` for
   TEST/CONFORMANCE OBSERVABILITY only (so `test/core/define-dialect-collision.test.ts` and
   `ops-exact-set.test.ts` can import it instead of hand-typing a second literal) — it is NOT
   semver-covered beyond the FIT-04 baseline pin it already sits inside. S-000.1's export MUST
   carry an `@internal` JSDoc tag; ADR-0050 (S-000.1b) carries exactly one line recording this
   (see that task).

---

## Commit staging & TDD discipline (ORCHESTRATOR RULING R1, `verify-plan-2.md` gap 4, Q11)

An executor MUST NOT halt to ask about commit shape or TDD sequencing for this change — both are
owner-ruled, on record:

- **S-000 lands as ONE commit.** `define-dialect.ts`'s `RESERVED_HANDLE_NAMES` array and
  `Handle`'s `raw`/`modify` member renames are DUPLICATE-KEY-CONSTRAINED: you cannot land
  `modify(fn)` alongside the still-present old `modify(content)` overload as two separate
  commits without an intermediate state that either double-declares `modify` (compile error) or
  silently drops one signature (a false-green interim state) — there is no red-then-green
  intermediate commit that isn't itself broken. This makes a classic "RED commit, then GREEN
  commit" split impossible for S-000; it ships atomically.
- **Adapt-first is SANCTIONED** for mechanical literal/name swaps inside an already-green test
  (tagged `[adapt]` throughout this document) — these are not new behavior, they are call-site
  relabeling, and forcing a synthetic RED phase on them would be theatre, not discipline.
- **RED-first authorship applies to the enumerated NEW behaviors only** — write the failing test
  BEFORE the code that makes it pass, for exactly these (tagged `[RED]` throughout): REQ-DG-02.8
  (explicit `modify`-collision scenario), REQ-DG-05.4 (async-rejecting `.modify(fn)` containment),
  REQ-DG-06.6 (foreign-coincidental-prefix killer scenario), REQ-MC-08.5 (guard-absent-from-
  `.modify(fn)` negative), REQ-MC-08.6 (`.replaceContent` string-only compile-negative), the two
  `test/fitness/` repo-wide sweeps (S-004.5), and KIT-03's compile-negative fixtures (S-001.5 and
  siblings).
- **TDD evidence = authorship order in the apply log, not broken interim commits.** Since S-000
  cannot show a red commit, the record of RED-first discipline for its enumerated new behaviors is
  the apply-progress log's task-authorship order (test written/failing locally, confirmed via
  local run output, THEN the source edit that turns it green) — not git history. `sdd-verify`
  (in-loop and final) MUST NOT raise `tdd-violation` against S-000's single-commit shape or
  against `[adapt]`-tagged tasks; this convention is the resolution of that check, not an
  exception the gate needs to independently re-litigate.

---

## Current → target verb semantics (Gap 3c)

| Call site | Current name | Target name | Argument | Semantics | ADR-0039 guard? |
|---|---|---|---|---|---|
| Dialect handle escape hatch | `.raw(fn)` | **`.modify(fn)`** | function `(ast) => void` | Mutates the SAME already-parsed, already-live AST instance the handle's named ops mutate, in place. Coalesces with named ops into ONE `modify` directive (REQ-MC-01/02). | Guard is ABSENT (REQ-MC-08.5) — never rejects, always coalesces. |
| Dialect handle wholesale replace | `.modify(content)` | **`.replaceContent(content)`** | string | Replaces the file's ENTIRE text in one shot. Distinct method, never an overload of `.modify`. | Guard PRESENT — rejects if an AST-op directive is open/undrained on the SAME handle (moved here from the old `.modify()` in this same rename). |
| Commons top-level / `WriteOps` verb | `modify(path, content)` / `handle.modify(content)` | **`replaceContent(path, content)`** / **`handle.replaceContent(content)`** | string | Schedules the SAME wire directive `{op:"modify", modify:{path,content}}` — byte-identical wire shape, only the author-facing call name changes. No coalescing/guard concept exists at this layer (no AST). | N/A — commons handles have no AST-fn verb at all. |

Guard placement detail: the reject check moves from inside `runModify(content)` to inside
`runReplaceContent(content)` in `src/core/dialect-handle.ts` — the check itself
(`#hasOpenPendingDirective`) is unchanged; only the METHOD it lives inside renames, because the
guard tracks the SEMANTICS (wholesale replace clobbering a pending structured edit), not the verb
spelling (ADR-03/ADR-0039 amendment).

---

## Exact literals (Gap 3d) — copy these verbatim, do not paraphrase

### `RESERVED_HANDLE_NAMES`

- **Current** (`src/core/define-dialect.ts:124`): private, unexported —
  `const RESERVED_HANDLE_NAMES = new Set(["then", "read", "raw", "modify", "rename", "move", "copy", "remove"]);` (8 members).
- **Target**: EXPORTED, ordered ARRAY (not a `Set`) —
  `export const RESERVED_HANDLE_NAMES = ["then", "read", "raw", "modify", "replaceContent", "rename", "move", "copy", "remove"] as const;`
  (9 members, this exact order — REQ-DG-02.7 asserts `toEqual` against this literal order).
  `assertNoCompositionCollision` (same file, `:133-146`) switches its `.has(name)` check to
  `.includes(name)` (array, not Set).
- **`raw`-collision hint** (REQ-DG-02.6, NOT byte-pinned in the spec — executor latitude on
  exact wording, but MUST retain the existing pinned prefix and MUST name `.modify(fn)`):
  keep the existing thrown-message prefix `op-pack composition failed: op "raw" collides with a
  reserved handle verb` and APPEND a hint clause naming the live escape hatch, e.g.
  `— the live AST-fn escape hatch is .modify(fn)`. Every OTHER reserved name (`then`, `read`,
  `modify`, `replaceContent`, `rename`, `move`, `copy`, `remove`) keeps the existing generic
  message with NO hint suffix — only `raw`'s collision gets the extra clause.
  **Existing test that must change its expectation, not just its input list**:
  `test/core/define-dialect-collision.test.ts:102-111` ("every base-handle verb is reserved…")
  currently loops a 7-item hand-typed array (`["read","raw","modify","rename","move","copy","remove"]`,
  missing `then` — asserted separately above it — and missing `replaceContent`) against ONE
  generic message template for every verb. Target: loop `RESERVED_HANDLE_NAMES` itself (now
  importable) so the list can never drift from the shipped array again; special-case the `raw`
  iteration to assert the hint-suffixed message, every other iteration keeps the generic
  template.

### ADR-0039 reject message (`.replaceContent` guard)

- **Current** (`src/core/dialect-handle.ts:311-313`, inside `runModify`):
  `` `cannot .modify() "${this.#path}" while a structured edit is pending on the same handle — the pending edit would be lost; call .read() to commit it first, then .modify()` ``
- **Target** (byte-exact, REQ-MC-08.1 — note it DROPS the `"on the same handle"` clause, not a
  pure verb swap):
  `` `cannot .replaceContent() "${this.#path}" while a structured edit is pending — the pending edit would be lost; call .read() to commit it first, then .replaceContent()` ``
- Pinned byte-exact at `test/core/dialect-handle.test.ts:724`.

### Foreign-wrap tail template (`.modify(fn)` throw containment)

- **Current template**: `` `raw() on "${path}" threw` `` (built in
  `src/core/dialect-handle.ts:294`, inside `runRaw`).
- **Target template**: `` `modify() on "${path}" threw` ``.
- **Exactly 4 test files pin this tail, byte-exact, prefixed by the frozen
  `"dialect operation failed: "`** — locate every occurrence via
  `rg -n 'raw\(\) on' test/` before touching:
  1. `test/e2e/dialect-modify.e2e.test.ts:114` — `'dialect operation failed: raw() on "a.ts" threw'`
  2. `test/e2e/toy-dialect-skeleton.e2e.test.ts:74` — `'dialect operation failed: raw() on "a.toy" threw'`
  3. `test/core/dialect-handle.test.ts:292` AND `:354` (TWO separate pins in this ONE file)
  4. `test/fitness/fit-20-unawaited-join-guard.test.ts:86`
- The generic `runOp` tail (named ops, e.g. `addImport`) is UNCHANGED —
  `` `${opName}() on "${path}" threw` `` in `dialect-handle.ts:279` already parameterizes
  `opName`, so `addImport() on "a.ts" threw` etc. need no edit; only the hardcoded `runRaw`
  literal renames.

### TypeScript-dialect collision hint (`ops.ts`, REQ-TSD-01.3)

- **Current** (`src/dialects/typescript/ops.ts:73`): `...or edit it with .raw().`
- **Target**: `...or edit it with .modify().`
- **6 pinned occurrences across 2 files** (`rg -n '"or edit it with \.raw\(\)\."' test/`):
  `test/dialects/typescript/ops-declarations-cuttable.test.ts:63,129` and
  `test/dialects/typescript/ops-declarations.test.ts:59,145,186,209`.

### Module JSDoc (`src/dialects/typescript/index.ts:48-49` per spec; verified live at `:19-22`)

- **Current**: `` Returns an awaitable, chainable `Handle` exposing the universal `.raw()` escape hatch... coalesce into a single `modify` at flush ``
- **Target**: same sentence with `.raw()` → `.modify()`. This text is COMMENT-ONLY in the
  compiled `.d.ts` (see FIT-04 section below) — it does not trip the semver gate, but
  REQ-TSD-01.4 pins it via the repo-wide `.raw(` sweep (S-004), not FIT-04.

### `ops-exact-set.test.ts` base-handle-keys pin

- `test/dialects/typescript/ops-exact-set.test.ts:20`:
  `const BASE_HANDLE_KEYS = new Set(["read", "raw", "modify", "rename", "move", "copy", "remove", "then"]);`
  (8 members, missing `replaceContent`) — MUST become 9 members, adding `"replaceContent"`.
  Consider importing `RESERVED_HANDLE_NAMES` directly once it is exported, instead of a
  second hand-typed literal (executor's call; not spec-mandated, but avoids a second place
  that can silently drift from the shipped array).

---

## FIT-04 mechanics (Gap 3e)

**Dist emission — VERIFIED LIVE (`bun run build`, exit 0, this revision):** the 4 paths this
section and S-000/S-001/S-002's baseline-regen tasks cite are exactly what `tsc -p
tsconfig.build.json` emits — confirmed present on disk after a real build, no discrepancy to
correct:
- `dist/core/define-dialect.d.ts` — EXISTS
- `dist/commons/index.d.ts` — EXISTS
- `dist/core/base-handle.d.ts` — EXISTS
- `dist/conformance/index.d.ts` — EXISTS

- **File**: `test/fitness/fit-04-dts-semver-gate.test.ts`. **Shape of one `DTS_PAIRS` entry**:
  `{ baselineFile: join(BASELINE_DIR, "<name>.d.ts"), distFile: join(DIST_DIR, "<path>/index.d.ts"), label: "<label>" }`
  (see lines 78-130 for all 9 existing entries).
- **Manual regen procedure** (no script exists, per the file's own header comment,
  `fit-04-dts-semver-gate.test.ts:19-24`): run `bun run build`, then hand-copy each
  `dist/**/*.d.ts` over its committed counterpart under `test/fitness/dts-baseline/`.
- **The gate's actual comparison** (`normalizeDeclarations`, same file `:49-60`) strips blank
  lines and any line starting with `//`, `*`, or `/**` — i.e. it compares DECLARATION lines only,
  never JSDoc/comment prose. A rename that only touches a JSDoc comment (not an exported
  signature) will NOT trip the gate even if the baseline file is never regenerated — but
  regenerate anyway so the committed baseline stays truthful for future diffs.
- **10th pair entry to ADD** (S-000, brand-new — `core/define-dialect.ts` has never had a
  baseline before this change):
  ```ts
  {
    baselineFile: join(BASELINE_DIR, "core.define-dialect.d.ts"),
    distFile: join(DIST_DIR, "core/define-dialect.d.ts"),
    label: "core/define-dialect",
  },
  ```
  The new baseline file's CONTENT must genuinely exhibit `Handle`'s shape — both
  `replaceContent` and `modify(fn: ...)` present among `Handle`'s members, ZERO occurrences of
  `raw` as a member name (REQ-FIT-04, `fit-04-dts-semver-gate.test.ts` gains a new
  `it(...)` via the `DTS_PAIRS` loop automatically — no separate test-body edit needed).

### Which of the 9 EXISTING baseline pairs actually churn (verified live, Gap 2)

| Baseline file | Churns? | Why | Regen lands in |
|---|---|---|---|
| `test/fitness/dts-baseline/commons.index.d.ts` | **YES** | Line 194: `export declare function modify(path: string, content: string): WritableHandle;` is a real declaration line → renames to `replaceContent`. | **S-001** |
| `test/fitness/dts-baseline/core.base-handle.d.ts` | **YES** | Line 5: `modify(content: string): WritableHandleRef;` inside the `WriteOps` interface → renames to `replaceContent`. | **S-001** |
| `test/fitness/dts-baseline/conformance.index.d.ts` | **YES** | Line 42: `readonly raw: (ast: unknown) => void;` is a real interface-member declaration (the `OpExercise.chain` union branch) → renames to `readonly modify: (ast: unknown) => void;`. | **S-002** |
| `test/fitness/dts-baseline/core.handle-state.d.ts` | no (gate-wise) | Only JSDoc comment lines (3, 8) mention `modify` — the interface bodies (`WritableHandle`/`FoundHandle`) carry no member text at all (they extend `WriteOps`). Confirmed live — matches design's "no `.d.ts` churn" note. | — (no task needed; regen is cosmetic only if done) |
| `test/fitness/dts-baseline/typescript.index.d.ts` | no (gate-wise) | Only JSDoc comment lines (19, 22) mention `.raw()`/`modify` — no exported declaration in this file names either. Design's File-Changes table listed this file among "regen renamed members"; live verification shows that's imprecise — there is no member-level rename here, only prose. | — (no task needed) |
| `core.authoring-error.d.ts`, `commons.classify-content.d.ts`, `testing.index.d.ts`, `index.d.ts` | no | Zero `modify`/`raw` occurrences at all (grep-verified). | — |

Regen commands (once per slice that needs it): `bun run build`, then
`cp dist/commons/index.d.ts test/fitness/dts-baseline/commons.index.d.ts` (S-001, plus the
`core/base-handle.d.ts` copy) / `cp dist/conformance/index.d.ts test/fitness/dts-baseline/conformance.index.d.ts` (S-002). Land the copied baseline in the SAME commit as the source rename that
dirtied it — never a separate "regen baselines" commit, and never regenerate silently without
reviewing the diff (a regen that doesn't show the expected rename is a red flag, not routine noise).

---

## Fixture formats (Gap 3f)

- **`GOLDEN_MODIFY`** (`test/golden-ir/fixtures.ts:20-26`): a single-directive
  `Extract<Directive, {op:"modify"}>` — `{op:"modify", modify:{path, content}}`. UNCHANGED by
  this slice set (wire-level, frozen).
- **`CREATE_THEN_MODIFY`** (`test/golden-ir/fixtures.ts:87-94`): a `Batch` —
  `{protocolVersion:1, force:false, instructions:[{op:"create",...},{op:"modify",...}]}`.
  UNCHANGED — the fixture DATA and its exported NAME both stay as-is (wire IR frozen, Decided
  item 3 above). Only `test/golden-ir/chained-batch.test.ts:32`'s AUTHOR CALL changes:
  `.modify("export const x = 2;")` → `.replaceContent("export const x = 2;")` — a 1-line
  `[adapt]` edit in the test body, zero fixture-file edits (S-001.4).
- **Conformance planted fixtures** (`test/conformance/planted/*.ts`): these ALL use the
  `{op: string, args: readonly unknown[]}` chain-step shape exclusively — e.g.
  `test/conformance/planted/closure-smuggle-violation.ts:42` (`chain: [{op:"smuggleClosure", args:[]}]`).
  **None of the planted fixtures use the `{raw:...}` discriminant** — verified by
  `rg -n '\{\s*raw\s*:|raw:\s*\(ast' test/conformance/*.ts test/conformance/planted/*.ts`, which
  matches ONLY `test/conformance/typescript-conformance.test.ts:76,172` (not a planted fixture —
  the main conformance test file itself). S-002.2/.4 ("planted fixtures adapt") therefore has
  ZERO actual planted-fixture files to touch for the discriminant rename; the real work is in
  `test/conformance/typescript-conformance.test.ts`'s two `{raw: (ast) => ...}` chain steps
  (lines 76, 172) → `{modify: (ast) => ...}`.

---

## `OpExercise.chain` discriminant + dispatch (Gap 3g)

**Type** (`src/conformance/index.ts:61`, current):
```ts
chain: ReadonlyArray<{ readonly op: string; readonly args: readonly unknown[] } | { readonly raw: (ast: unknown) => void }>;
```
**Target**:
```ts
chain: ReadonlyArray<{ readonly op: string; readonly args: readonly unknown[] } | { readonly modify: (ast: unknown) => void }>;
```
**Dispatch** (`src/conformance/index.ts:146`, current, inside `runExercise`):
```ts
handle = "raw" in step ? handle.raw(step.raw) : handle[step.op](...step.args);
```
**Target**:
```ts
handle = "modify" in step ? handle.modify(step.modify) : handle[step.op](...step.args);
```
The discriminant check is `"modify" in step` (a property-presence test) — this is what
REQ-DC-02.2's misroute test must exercise: a step shaped `{op:"addImport", args:[...]}` (NO
`modify` key) must route to the `handle[step.op](...)` branch, never accidentally satisfy the
`"modify" in step` check.

---

## Compile-negative convention (Gap 3, houses KIT-03/DG-03/MC-08's new negatives)

**Verified live house convention** (`test/types/define-dialect.test.ts:11-13`'s own comment
names it): a compile-negative is a "dead call in a never-invoked arrow" — a `@ts-expect-error`
directive sits above a real API call/property access wrapped inside `const _x = (h: SomeType) =>
{ /* @ts-expect-error ... */ h.badMember(); }; void _x;`. The arrow is never invoked (bun never
executes the bad access at runtime), but `tsc` still parses and type-checks the body, so the
`@ts-expect-error` is genuinely load-bearing. These live in real `test/types/*.test.ts` files,
collected by BOTH `bun test` (they run — trivially, since the arrows never execute) AND `bun run
typecheck` (`tsc --noEmit`, CI's "Typecheck (strict)" step, `.github/workflows/ci.yml:34-35`) —
the tsc pass is what actually enforces the directive; if a negative ever stops being rejected,
its `@ts-expect-error` becomes unused, tsc raises `TS2578`, and `bun run typecheck` fails CI.

**This is the mechanism for REQ-DG-03.4** (`.raw` absent, type-level) and **REQ-MC-08.6**
(`.replaceContent(fn)` compile-negative) — both are ordinary property/argument-shape negatives,
expressible with the dead-arrow pattern inside `test/types/define-dialect.test.ts` (S-000.5).

**`expectTypeOf` provenance (executor note)**: it is NOT a Vitest API in this repo — it comes
from the `expect-type` package (see `test/types/define-dialect.test.ts:15`,
`import { expectTypeOf } from "expect-type"`), fully bun-compatible and already used alongside
`bun:test` in every `test/types/*.test.ts`. Both mechanisms are house-sanctioned and
complementary: `expectTypeOf` for positive shape pins (e.g. `.modify` parameter is a function),
the dead-arrow `@ts-expect-error` for suppression-style negatives. Use whichever the existing
sibling assertion in the touched file already uses.

**REQ-KIT-03's negative is different in kind** — it asserts an IMPORT fails to resolve
(`import { modify } from "@pbuilder/sdk/commons"`, i.e. `modify` no longer exported), not a
property access. The dead-arrow trick does NOT apply: `import` declarations are hoisted,
top-level-only statements — they cannot be wrapped inside a never-invoked function. Two
consequences, verified against the repo's own precedent (`test/types/permissive-proof.ts`):

1. **Never write this as a real top-level import inside a file `bun test` collects and
   executes.** A named import that fails to resolve throws a hard ESM `SyntaxError` at module
   load ("does not provide an export named ..."), which crashes the ENTIRE file's test
   collection, not just one assertion.
2. **The working pattern**: a `.ts` fixture file WITHOUT a `.test.ts` suffix (so `bun test`'s
   glob never collects/executes it — confirmed live: `permissive-proof.ts` sits in `test/types/`
   today and is never run as a test, only type-checked) containing:
   ```ts
   // @ts-expect-error — REQ-KIT-03: `modify` is no longer exported from commons; only
   // `replaceContent` is.
   import { modify } from "../../src/commons/index.ts";
   void modify;
   ```
   Unlike `permissive-proof.ts` (which IS excluded from `tsconfig.json`'s default include,
   because ONE of its directives is deliberately UNUSED and would fail plain `tsc`), this new
   fixture needs NO exclusion: its `@ts-expect-error` correctly SUPPRESSES a genuine TS2305, so
   it produces ZERO net diagnostics and passes `bun run typecheck` cleanly as-is — only a
   regression (import starts resolving again) would ever raise anything. `void modify;` avoids
   `noUnusedLocals` (TS6133) flagging the destructured binding separately.

S-001.5 is retitled to build exactly this fixture (e.g.
`test/types/no-commons-modify-import.ts`), not a bare bullet point.

**ONE deliverable, not two (executor note, resolves the specifier ambiguity)**: the fixture
above — with the RELATIVE specifier `../../src/commons/index.ts` — IS the compile-negative pin.
REQ-KIT-03's `@pbuilder/sdk/commons` phrasing names the same author-surface contract, whose
published half is enforced separately by the FIT-04 `commons.index.d.ts` baseline diff (the
`modify` export line disappears from the emitted `.d.ts`). Do NOT author a second negative
against the bare `@pbuilder/sdk/commons` specifier: under `moduleResolution: bundler` +
package self-reference, a suppressed diagnostic there risks being a module-resolution error
rather than TS2305, making the pin vacuous.

**Repo conventions (executor note)**: work lands on the current worktree branch
(`worktree-improve-raw`), sequential commits in build order (S-000 → S-001 → S-002 → S-003 →
S-004), conventional-commit messages (`type(scope): description`, English), never `--no-verify`
— a failing hook means fix the check, never bypass it.

---

## `.raw`/`modify(` sweep implementation spec (Gap 3j)

Two DISTINCT repo-wide fitness sweeps, both NEW test files under `test/fitness/`, both housed in
**S-004** (they cannot pass green until every module's rename lands — S-004 depends on S-001/002/003
for exactly this reason):

1. **`.raw` sweep** (`foundations-skeleton` REQ-KIT-03 V3, `design.md` §4.7):
   - Pattern A: `\.raw\(` (regex, requires the paren) over `src/**` JSDoc/comments +
     `README.md` — catches `.raw(` as a call-shaped reference.
   - Pattern B: substring `.raw` (NO paren required — catches paren-less prose mentions) over
     `ROADMAP.md`, `SECURITY.md`, `docs/**` — the widened predicate that catches ROADMAP's 5
     paren-less mentions (see below).
   - Both patterns MUST return 0 hits post-change. Exclusions: none — every `.raw` occurrence in
     scope is retired vocabulary; there is no legitimate surviving `.raw` reference anywhere in
     these scanned trees.
   - **Confirmed live locations this sweep forces to migrate** (verify each is actually
     fixed, don't just trust the count): `ROADMAP.md` lines **80, 121, 142, 253, 277, 286**
     (6 total, matching design's list exactly — verified via
     `rg -n '\.raw\b' ROADMAP.md`); `SECURITY.md` lines 34 (heading `` ## `.raw()` and the
     conformance kit ``), 36, 38; `src/dialects/typescript/index.ts:19` (module JSDoc);
     `src/core/dialect-handle.ts:22` (kit-internal `isThenable` comment, lower severity but
     still in-scope).

2. **`modify(` free-call sweep** (`foundations-skeleton` REQ-KIT-03 V2/V4): bans the OLD commons
   string-form call `modify(path, content)` / `modify("...", "...")` as a FREE call (i.e. NOT
   preceded by `.`) across `docs/**`, `README.md`, and every JSDoc comment under `src/**`.
   - **Exclusions (exactly two, both by construction of the pattern itself)**: `.modify(fn)` —
     always dot-prefixed, so a free-call regex (anchored on NOT preceded by `.`) never matches it
     to begin with; `factory.modify(` — the kit-internal `DirectiveFactory` method, also always
     dot-prefixed.
   - **V4 removes** the V3 `modify(handle` exclusion (it existed only for the now-deferred
     importable form's doc snippets) — do not carry it forward; its absence is not a regression.
   - **Confirmed live locations needing migration**: `docs/authoring-verbs.md` lines 9 (seven-verbs
     summary), 27-34 (verb-list bullet + code fence), 31/33 (`import {modify}` + call example),
     96/102/104 (read-trichotomy example); `src/commons/index.ts` lines 142-143 (`find()` JSDoc
     `@example`), ~295 (top-level `modify()` function's own `@example`); `src/core/handle-state.ts`
     lines 8, 12-13, 16 (JSDoc `@example` + verb-list comments); `README.md:17`;
     `docs/quickstart.md:179`.
   - Also add the compile-negative pin (REQ-KIT-03 V2): `import { modify } from "@pbuilder/sdk/commons"`
     must not resolve/typecheck post-rename.

Both sweeps are `[RED]` (new fitness tests, never existed before) — write them failing against
the CURRENT tree first if built ahead of the docs migration, or land them green in the same
commit as the last doc migrated (S-004's own call on sequencing).

---

## S-000: Walking Skeleton — escape-hatch + wholesale rename vertical

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-FIT-04, REQ-DG-02, REQ-DG-03, REQ-DG-05, REQ-DG-06, REQ-DG-07, REQ-MC-01, REQ-MC-02, REQ-MC-03, REQ-MC-06, REQ-MC-08
**Requires**: nothing
**Test layers**: unit + type + architectural (FIT-04) + e2e

**Acceptance**: GIVEN `src/core/define-dialect.ts` + `src/core/dialect-handle.ts` renamed in ONE
commit (`raw`→`modify(fn)`, `modify`→`replaceContent`, ADR-0039 guard moved to
`runReplaceContent`), WHEN the suite runs, THEN `Handle` exposes both as distinct
non-overloaded methods, `RESERVED_HANDLE_NAMES` is the exact exported 9-array, all
containment/coalescing/fail-closed scenarios adapt cleanly, the 10th FIT-04 pair exhibits the
real shape, and `test/e2e/dialect-modify.e2e.test.ts` proves `{op:"modify"}` byte-identical.

### Per-slice REQ table

| REQ-ID | Spec file : section | Scenario text needed verbatim? |
|---|---|---|
| REQ-FIT-04 | `openspec/changes/author-write-surface/specs/foundations-skeleton/spec.md` (REQ-FIT-04, lines 80-109) | Yes — the "MUST contain both `replaceContent` and `modify(fn:...)` ... ZERO occurrences of `raw`" clause is the acceptance bar for the new baseline's CONTENT, not just its existence. |
| REQ-DG-02 (.1-.8) | `.../dialect-generics/spec.md` (REQ-DG-02, lines 13-122) | Yes for .6/.7/.8 (new scenarios) — see Exact Literals section above for the array + hint text. |
| REQ-DG-03 (.1-.4) | `.../dialect-generics/spec.md` (REQ-DG-03, lines 124-176) | Yes for .3/.4 — `.modify` fn-only compile-negative + `.raw` absent type+runtime (`'raw' in handle === false`). |
| REQ-DG-05 (.1-.4) | `.../dialect-generics/spec.md` (REQ-DG-05, lines 203-288) | Yes — byte-exact tail `modify() on "{path}" threw`, `.cause` absence, foreign-wrap-never-interpolates-caught-message (.3), async-reject parity (.4, NEW). |
| REQ-DG-06 (.1-.6) | `.../dialect-generics/spec.md` (REQ-DG-06, lines 290-384) | Pointer only — containment contract unchanged, parity with `.modify()`; .6 is the `isContained`-by-identity killer scenario (message coincidentally prefixed but foreign). |
| REQ-DG-07 (.1-.3) | `.../dialect-generics/spec.md` (REQ-DG-07, lines 385-424) | Pointer only — fail-closed run-wide consequence, triggered by REQ-MC-08's reject. |
| REQ-MC-01/02/03/06 | `.../modify-coalescing/spec.md` | Pointer only — coalescing/split/routing/run-end-join contracts unchanged, only call names rename. |
| REQ-MC-08 (.1-.6) | `.../modify-coalescing/spec.md` (REQ-MC-08, lines 138-243) | Yes for .1 (byte-exact reject tail, see Exact Literals) and .5 (NEW — guard absent from `.modify(fn)`, negative proof) and .6 (NEW — `.replaceContent` string-only compile-negative). |

**REQ-DG-06 — no refactor implied (verified live):** `src/core/dialect-error.ts` ALREADY
implements the WeakSet-brand discriminant this REQ pins — it is not new work, only a frozen
invariant this change must not disturb. Verbatim from the file's own header (lines 5-10):

```
// F1 (BLOCKING, ADR-0037 amendment): the containment discriminator is this module-private
// WeakSet brand, NEVER a `message.startsWith(prefix)` match — a buggy op interpolating a
// caught foreign error into a message that happens to start with the frozen prefix would
// otherwise be rethrown verbatim (bypassing leak sanitisation), and a coincidental foreign
// prefix would misclassify. The WeakSet is unforgeable, non-enumerable, and carries no class
// name into the error (leak budget).
```

The ONLY code change anywhere near REQ-DG-06 in this entire change is the tail literal
(`raw() on` → `modify() on`, S-000.3) — `dialect-error.ts` itself is untouched.

**REQ-DG-06.2 scenario, verbatim (Gap 3, the pattern REQ-DG-05.4's new test mirrors)** — from
`.../dialect-generics/spec.md`:

> #### Scenario REQ-DG-06.2: async op rejection is contained, zero unhandledRejection, zero batches
>
> - GIVEN an op function returning a promise that REJECTS
> - WHEN the chain runs (test-note: `process.on('unhandledRejection')` observed for the whole
>   test)
> - THEN the run rejects with the pinned-prefix contained error AND no `unhandledRejection` is
>   observed; `.cause` is `undefined`/absent AND the message contains no ts-morph internal class
>   names, stack frames, or absolute fs paths; AND ZERO batches are emitted for the run — an async
>   rejection MUST NOT commit as a false success

This scenario ALREADY EXISTS, implemented, at `test/core/dialect-handle.test.ts:418-446`
(`it("REQ-DG-06.2: an async op rejection is contained, zero unhandledRejection, zero batches"...)`
against the file's inline `synthDialect.asyncReject()` op) — REQ-DG-05.4's NEW task (S-000.6)
mirrors this EXACT shape (`process.on('unhandledRejection')`, zero-batches assertion) but for
`.modify(fn)`'s own async-rejecting callback instead of a named `runOp`.

**REQ-DG-06.6 scenario, verbatim (NEW, killer scenario)** — from
`.../dialect-generics/spec.md`:

> #### Scenario REQ-DG-06.6: a foreign error with a coincidentally-prefixed message is wrapped fresh, never rethrown verbatim (NEW, V2, killer scenario)
>
> - GIVEN an op function that throws a PLAIN, foreign `new Error('dialect operation failed: ' +
>   'a message a foreign caller happened to construct with this exact prefix, e.g. by copying it
>   from a stack trace or a log line')` — an error that was NEVER minted by this module, never
>   added to the `isContained` `WeakSet`, but whose message text happens to start with the frozen
>   prefix byte-for-byte
> - WHEN it runs via `runOp`
> - THEN it is treated as FOREIGN and wrapped FRESH — the run rejects with a NEW contained error
>   whose tail is exactly `{op}() threw` (the generic foreign-wrap shape) — it is NOT rethrown
>   verbatim, and the foreign error's own message content does NOT appear in the surfaced message
>   (REQ-DG-05's leak-budget constraint) — proving the discriminant is the `isContained` brand by
>   identity, never a `message.startsWith(...)` string test

This test does NOT exist today (verified: no `REQ-DG-06.6` hit anywhere in the test suite) — it
is an explicit S-000 task (S-000.6c below), not folded silently into the "pointer only" REQ-DG-06
row above.

### Tasks

- [x] S-000.1 `[adapt]` `src/core/define-dialect.ts`: `DialectWriteOps.modify(content)` →
  `replaceContent`; `Handle`'s `raw(fn)` member → `modify(fn:(ast)=>void)`; export
  `RESERVED_HANDLE_NAMES` as the ordered 9-array (see Exact Literals) with an `@internal` JSDoc
  tag (ORCHESTRATOR RULING R2, Decided item 6 — test/conformance observability only, not
  supported public API); `assertNoCompositionCollision` switches `.has` → `.includes`; append the
  `raw`-collision hint clause.
- [x] S-000.1b `[adapt]` **Author and commit `openspec/decisions/0050-handle-unfreeze-honest-write-verb-rename.md`** —
  next free ADR number (0049 is the last existing entry in `openspec/decisions/`). Content:
  adapt design.md §4.5 ADR-01 verbatim (Context/Decision/Consequences/Alternatives — the four
  rejected alternatives are: keep `raw`; name it `edit`; name it `transform`; polymorphic
  `modify(string|fn)`) into the repo's ADR file format (see `openspec/decisions/0039-*.md` for
  the header convention: `Status`/`Date`/`Change`/`Deciders`/`Builds on`). This is the ADR that
  formally unfreezes `Handle` — land it in the SAME commit as S-000.1 (the code change it gates).
  ADR-0050 also carries exactly ONE line recording ORCHESTRATOR RULING R2 (Decided item 6
  above): `RESERVED_HANDLE_NAMES` is exported `@internal` for test/conformance observability
  only, not a supported public API member, not semver-covered beyond the FIT-04 baseline pin.
- [x] S-000.2 `[adapt]`/`[RED]` `src/core/dialect-handle.ts`: `runRaw` → `runModify(fn)` + tail
  literal `raw() on` → `modify() on` (4 pinned test files, see Exact Literals); `runModify(content)`
  → `runReplaceContent(content)` + ADR-0039 message rewrite (byte-exact, see Exact Literals) — a
  GREEN characterisation test pinning the CURRENT silent last-write-wins lands first, then is
  REPLACED by REQ-MC-08's reject scenarios in this same slice; base dispatchers in `createDialectHandle`'s
  `base` object literal (`raw`/`modify` keys) → `modify`/`replaceContent` keys.
- [x] S-000.2b `[adapt]` **Amend `openspec/decisions/0039-fail-loud-rejection-incoherent-operations.md` IN PLACE** —
  append a new `## Amendment (2026-07-14, author-write-surface, S-000)` section (repo convention,
  see `0012-conformance-kit.md`'s two amendment sections for the pattern): guard target renames
  `.modify()`/`runModify` → `.replaceContent()`/`runReplaceContent`; the message text drops
  "on the same handle" (byte-exact new text, see Exact Literals); land in the SAME commit as S-000.2.
- [x] S-000.3 `[adapt]` Foreign-wrap tail `modify() on "{path}" threw` — update all 4 pinned test
  files listed in Exact Literals (dialect-modify.e2e, toy-dialect-skeleton.e2e, dialect-handle.test
  ×2 occurrences, fit-20-unawaited-join-guard).
- [x] S-000.4 `[RED]` Create `test/fitness/dts-baseline/core.define-dialect.d.ts` (new, 10th
  pair) + add its `DTS_PAIRS` entry to `test/fitness/fit-04-dts-semver-gate.test.ts` (exact entry
  shape in the FIT-04 Mechanics section above). Regen via `bun run build` then hand-copy
  `dist/core/define-dialect.d.ts`; verify the copied content actually shows `replaceContent` +
  `modify(fn:...)` + zero `raw` before committing (REQ-FIT-04's V2 non-vacuousness check).
- [x] S-000.5 `[adapt]`/`[RED]` `test/core/define-dialect-collision.test.ts`: reserved loop drops
  `raw` from ITS OWN non-reserved-fixture-name choice (unaffected, it uses `annotate`/`stamp`/`then`
  fixtures, not `raw` itself, as collision names) — real work is REQ-DG-02.6/.7/.8: rewrite the
  `:102-111` loop to iterate the imported `RESERVED_HANDLE_NAMES` (special-casing `raw`'s expected
  message to include the hint suffix), add the exact-9-array `toEqual` scenario (.7), add an
  explicit `modify`-name collision scenario (.8, mirrors `.6`'s `raw`/`replaceContent` pair).
  `test/types/define-dialect.test.ts`: `.modify` fn-only pin, `.replaceContent` string-only pin,
  `.raw` absent (type-level `expectTypeOf` AND `'raw' in handle === false` at runtime, REQ-DG-03.4).
- [x] S-000.6 `[adapt]`/`[RED]` `test/core/dialect-handle.test.ts`: containment scenarios
  (REQ-MC-01/02/03/06 call-site renames), REQ-DG-05.3 (foreign-wrap never interpolates caught
  message), REQ-DG-05.4 (NEW — async-rejecting `.modify(fn)` containment, mirror REQ-DG-06.2's
  pattern with `process.on('unhandledRejection')` observed), REQ-MC-08.5 (NEW — guard absent
  from `.modify(fn)`, proof chain operates on a DIALECT handle, verified via the file's
  already-imported `import * as ts from "../../src/dialects/typescript/index.ts"` (line 21):
  `ts.find(path).addImport("readFileSync", "node:fs").modify(ast => ...)` must NOT reject and
  must coalesce into ONE directive), REQ-MC-08.6 (NEW — `.replaceContent(fn)` compile-negative).
- [x] S-000.6b `[adapt]` Rename the `describe("dialect handle — runOp containment, parity with
  .raw() (REQ-DG-06)")` block title at `test/core/dialect-handle.test.ts:376` → `parity with
  .modify()` — the block name itself still names the retired verb.
- [x] S-000.6c `[RED]` REQ-DG-06.6 killer scenario (verbatim above) — add a new op to the
  inline `synthOpsPack` (`test/core/dialect-handle.test.ts:53-88`, e.g.
  `foreignPrefixedThrow: (ast: SynthAst) => { throw new Error("dialect operation failed: " +
  "a message a foreign caller happened to construct with this exact prefix"); }`) and a new
  `it("REQ-DG-06.6: ...")` inside the S-000.6b-renamed describe block (after `.5`, line ~490)
  asserting the surfaced message's tail is the generic `foreignPrefixedThrow() on "a.synth"
  threw` (NOT the foreign error's own text) and that the foreign message content never appears
  in the surfaced error — proving the `isContained` WeakSet-brand discriminant by identity, not
  by prefix-matching.
- [x] S-000.7 `[adapt]` Extend `test/e2e/dialect-modify.e2e.test.ts` — rename `.raw(` call sites
  to `.modify(` (lines 29, 45, 65, 97 per live grep), verify `{op:"modify"}` byte-identical in
  the emitted batch (wire proof, Decided item 3).
- [x] S-000.8 `[adapt]` `test/fitness/fit-19-coalescing-orphan-guard.test.ts:35`:
  `handle.raw((ast) => { (ast as ToyAst).push("second-edit"); })` → `handle.modify((ast) => {
  ... })`. Surfaced by the `test/fitness/` inventory audit below — this live call site was not
  enumerated by any prior revision's task list; it is a `[permanent-fixture]` belt-and-suspenders
  test independent of `dialect-handle.test.ts` (per its own header comment) and must not
  silently break when `.raw` is retired.

---

## S-001: Commons wholesale-replace on find/create handles

**Scope**: happy-path
**Dimension**: I (Interface — same rename, commons entry point)
**Covers**: REQ-GIR-02
**Requires**: nothing
**Test layers**: unit + integration

**Acceptance**: GIVEN `src/core/base-handle.ts`/`src/commons/index.ts`/`src/core/handle-state.ts`
renamed (`modify`→`replaceContent`, no `.modify` on commons handles), WHEN a `defineFactory` run
chains `create().replaceContent(content)`, THEN the emitted batch matches the `create-then-modify`
golden fixture (wire `op:"modify"` unchanged) and `handle.modify` fails to typecheck on commons
handles.

### Per-slice REQ table

| REQ-ID | Spec file : section | Scenario text needed verbatim? |
|---|---|---|
| REQ-GIR-02 | `.../foundations-skeleton/spec.md` (REQ-GIR-02, lines 53-78) | Yes — the fixture-name/wire-op invariance clause: "the fixture name and wire `op` both stay `\"modify\"`... only the author-facing call renamed." |
| REQ-KIT-03 (cross-referenced, owned by S-004 but the commons rename this slice does is what REQ-KIT-03 gates) | `.../foundations-skeleton/spec.md` (REQ-KIT-03, lines 31-51) | Pointer only for this slice — the "Author→factory mapping" row: `replaceContent(path,content)`→`factory.modify({path,content})` (internal factory method name UNCHANGED). |

### Tasks

- [x] S-001.1 `[adapt]` `src/core/base-handle.ts`: `WriteOps.modify(content): WritableHandleRef`
  → `replaceContent(content): WritableHandleRef`.
- [x] S-001.2 `[adapt]` `src/commons/index.ts`: 3 call sites (`buildWritableHandle`'s `modify`
  method at line 71, `buildFoundHandle`'s `modify` method at line 102, top-level `modify(path,
  content)` function at line 297) → `replaceContent`; named export renames from `modify` to
  `replaceContent`; 3 JSDoc `@example`s (lines 142-143's read-trichotomy, line 295's own
  `@example`) → `replaceContent(...)`.
- [x] S-001.3 `[adapt]` `src/core/handle-state.ts`: JSDoc `@example` (lines 8, 12-13) and
  verb-list comments (lines 3, 16, 30-31) `modify` → `replaceContent`. Confirmed NO `.d.ts`
  interface-body change (the interfaces extend `WriteOps`, carry no member text of their own) —
  do not expect `core.handle-state.d.ts` to churn structurally (see FIT-04 table above); this
  task is comment-only.
- [x] S-001.4 `[adapt]` `test/golden-ir/chained-batch.test.ts:32`: `.modify("export const x = 2;")`
  → `.replaceContent("export const x = 2;")`. The `CREATE_THEN_MODIFY` fixture in
  `test/golden-ir/fixtures.ts:87-94` is NOT edited — same data, same name (Decided item 3).
- [x] S-001.5 `[RED]` Compile-negative: create `test/types/no-commons-modify-import.ts` (NOT
  `.test.ts` — see Compile-negative Convention section above for why) with a `@ts-expect-error`
  above `import { modify } from "../../src/commons/index.ts"; void modify;` — proves the old
  commons import no longer resolves, enforced by `bun run typecheck`, never executed by `bun test`.
- [x] S-001.6 `[RED]` **Regenerate `test/fitness/dts-baseline/commons.index.d.ts` AND
  `test/fitness/dts-baseline/core.base-handle.d.ts`** — both churn (confirmed live, see FIT-04
  table above): `bun run build`, then `cp dist/commons/index.d.ts test/fitness/dts-baseline/commons.index.d.ts`
  and `cp dist/core/base-handle.d.ts test/fitness/dts-baseline/core.base-handle.d.ts`. Review
  the diff before committing — it must show exactly the `modify`→`replaceContent` rename, nothing
  else. Land in the SAME commit as S-001.1/S-001.2.
- [x] S-001.7 `[adapt]` **EXECUTOR-DISCOVERED GAP, not in the original task list** — neither this
  file's S-001 tasks nor `design.md`'s File Changes table (`~12 more test/fixture files` row)
  enumerated every consumer of the commons `modify` export/method; live grep against
  `src/commons/index.ts`'s `modify` symbol turned up 9 further files with a REAL import/call
  dependency (not just prose) plus 2 files `design.md` names but this document never turned into
  a task (`test/e2e/author-to-tree.e2e.test.ts`, `test/skeleton/handle-chaining.test.ts`).
  Left unfixed, S-001.1/.2 alone would have broken these files' imports outright (a named import
  that fails to resolve throws a hard ESM `SyntaxError` at module load — see the Compile-negative
  Convention section) — far outside the declared 10-failure S-000 baseline. Fixed as mechanical
  `[adapt]` call-site/import renames, same commit as S-001.1/.2, wire-level `op:"modify"` /
  `AuthoringVerb`/`DryRunVerb` `"modify"` literals left untouched (Decided item 2): `src/commons/index.ts` (own JSDoc — S-001.2 also covered this), `test/fake/batch-cap.test.ts`,
  `test/fake/harness-result.test.ts`, `test/fake/harness-in-memory-invariant.test.ts`,
  `test/e2e/dry-run.e2e.test.ts`, `test/e2e/author-to-tree.e2e.test.ts`,
  `test/skeleton/write-only-factory.test.ts`, `test/skeleton/dry-run-accessor.test.ts`,
  `test/skeleton/commit-discard.test.ts`, `test/skeleton/handle-chaining.test.ts`,
  `test/skeleton/error-attribution.test.ts`, `test/skeleton/doc-discoverability.test.ts` (JSDoc
  verb-anchor regex `modify:` → `replaceContent:`). `src/commons/classify-content.ts`'s JSDoc
  `@example` (comment-only, doesn't affect FIT-04's normalized diff or compilation) and
  `docs/**`/`README.md`/`SECURITY.md`/`ROADMAP.md` prose are correctly OUT of this slice —
  confirmed S-004 scope (`REQ-KIT-03`'s doc/JSDoc-migration bullets, `test/docs/doc-set-content.test.ts`
  still legitimately asserts `docs/authoring-verbs.md` contains `` `modify` `` until S-004 lands).
  Recommend `slices.md`/`design.md`'s file inventories be corrected for future slices with a
  similar shape (S-002's conformance rename, S-003's dialect rename) to avoid the same
  under-enumeration.

---

## S-002: Conformance contract `{raw}`→`{modify}`

**Scope**: happy-path
**Dimension**: I (Interface — published conformance chain-step contract)
**Covers**: REQ-DC-02, REQ-DC-03, REQ-DC-04
**Requires**: nothing
**Test layers**: integration

**Acceptance**: GIVEN `src/conformance/index.ts`'s `OpExercise.chain` discriminant renamed
`{raw}`→`{modify}` with dispatch on the discriminant key, WHEN a fixture step misroutes
(`{op,args}` accidentally handled by the modify branch), THEN the misroute test fails RED against
the real dispatcher, and closure/live-AST-node smuggling fixtures still fail the suite loudly.

### Per-slice REQ table

| REQ-ID | Spec file : section | Scenario text needed verbatim? |
|---|---|---|
| REQ-DC-02 (.1-.2) | `.../dialect-conformance/spec.md` (REQ-DC-02, lines 9-52) | Yes for .2 (NEW misroute negative) — see the "OpExercise.chain discriminant + dispatch" section above for the exact type/dispatch code. |
| REQ-DC-03 | `.../dialect-conformance/spec.md` (REQ-DC-03, lines 54-68) | Pointer only — coalescing assertion unchanged, only the example chain's call name renames. |
| REQ-DC-04 (.1-.2) | `.../dialect-conformance/spec.md` (REQ-DC-04, lines 70-101) | Pointer only — the two smuggling fixtures (`closure-smuggle-violation.ts`, `live-node-smuggle-violation.ts`) use `{op,args}` chain steps, not `{raw}`/`{modify}` — no discriminant-shape edit needed in either, only the doc comment above `OpExercise` in `conformance/index.ts` mentioning `.raw`. |

### Tasks

- [x] S-002.1 `[adapt]` `src/conformance/index.ts`: `OpExercise.chain`'s union member
  `{readonly raw: (ast:unknown)=>void}` → `{readonly modify: (ast:unknown)=>void}` (line 61);
  `runExercise`'s dispatch `"raw" in step ? handle.raw(step.raw) : ...` → `"modify" in step ?
  handle.modify(step.modify) : ...` (line 146); JSDoc comments at lines 43, 60 (`.raw` mentions
  in `OpExercise`'s own doc comment) → `.modify`.
- [x] S-002.1b `[adapt]` **Amend `openspec/decisions/0012-conformance-kit.md` IN PLACE** — append
  a new `## Amendment (2026-07-14, author-write-surface, S-002)` section (see the file's own
  two existing amendment sections for the pattern) documenting the `{raw}`→`{modify}` chain-step
  discriminant rename + the new discriminant-misroute test as an ADR-0012 amendment (design.md
  §4.5 ADR-02's Context/Decision/Consequences/Alternatives — rejected alternatives: keep `{raw}`
  as a back-compat alias; dual-accept `{raw}|{modify}`). Land in the SAME commit as S-002.1.
- [x] S-002.2 No planted fixture under `test/conformance/planted/*` uses the `{raw:...}` chain
  shape (verified — see Fixture Formats section above); this task is a NO-OP for that directory.
  Do not go looking for a `{raw}` planted fixture that doesn't exist.
- [ ] S-002.3 `[RED]` NEW discriminant-misroute test (REQ-DC-02.2): a step shaped
  `{op:"addImport", args:["readFileSync","node:fs"]}` (no `modify` key) must route to the
  named-op branch and produce the SAME golden output `addImport` alone would — add to
  `test/conformance/typescript-conformance.test.ts`.
- [x] S-002.4 `[adapt]` `test/conformance/typescript-conformance.test.ts`: the file's TWO actual
  `{raw: (ast) => ...}` chain steps at **lines 76 and 172** → `{modify: (ast) => ...}` (these are
  the only two literal `{raw:...}` chain-step usages in the entire `test/conformance/` tree —
  confirmed via `rg -n '\{\s*raw\s*:|raw:\s*\(ast' test/conformance/*.ts test/conformance/planted/*.ts`).
- [x] S-002.5 `[RED]` **Regenerate `test/fitness/dts-baseline/conformance.index.d.ts`** — churns
  (confirmed live: line 42's `readonly raw: (ast: unknown) => void;` is a real interface-member
  declaration inside `OpExercise`, not a comment). `bun run build`, then
  `cp dist/conformance/index.d.ts test/fitness/dts-baseline/conformance.index.d.ts`. Review the
  diff — it must show only the `raw`→`modify` member rename. Land in the SAME commit as S-002.1.

---

## S-003: TypeScript dialect surface — real ops, real ts-morph

**Scope**: happy-path
**Dimension**: D (Data — the concrete TS-dialect instantiation: real op-set, real byte/encoding variants)
**Covers**: REQ-DG-04, REQ-TSD-01, REQ-TSD-03, REQ-TSD-04
**Requires**: nothing
**Test layers**: integration + architectural

**Acceptance**: GIVEN `src/dialects/typescript/ops.ts:73`'s collision hint and
`src/dialects/typescript/index.ts:19-22`'s module JSDoc renamed to `.modify()`, WHEN the TS
dialect's own edge/containment suite runs against the real ts-morph AST, THEN
CRLF/BOM/4MiB-boundary/parse-failure/print-failure scenarios all still pass under the new call
names, and the sanctioned-import scan (FIT-08 inherited) stays clean.

### Per-slice REQ table

| REQ-ID | Spec file : section | Scenario text needed verbatim? |
|---|---|---|
| REQ-DG-04.1 | `.../dialect-generics/spec.md` (REQ-DG-04, lines 178-201) | Pointer only — FIT-08 inherited, no new fitness function, just re-exercised against `./typescript`. |
| REQ-TSD-01 (.1-.4) | `.../typescript-dialect/spec.md` (REQ-TSD-01, lines 30-93) | Yes for .3/.4 — see Exact Literals for the byte-exact collision-hint clause and module JSDoc sentence. |
| REQ-TSD-03 (.1-.10) | `.../typescript-dialect/spec.md` (REQ-TSD-03, table lines 95-113) | Pointer only for most rows; row .3's example call renames `.raw`→`.modify`. |
| REQ-TSD-04 (.1-.2) | `.../typescript-dialect/spec.md` (REQ-TSD-04, lines 119-144) | Pointer only — containment contract restates REQ-DG-05 against the real dialect, call names rename. |

### Tasks

- [ ] S-003.1 `[adapt]` `src/dialects/typescript/ops.ts:73` collision hint
  `...or edit it with .raw().` → `...or edit it with .modify().` (exact string, see Exact Literals).
- [ ] S-003.2 `[adapt]` `src/dialects/typescript/index.ts:19-22` module JSDoc `.raw()` → `.modify()`
  (comment-only, does not trip FIT-04 — see FIT-04 table; caught by S-004's `.raw(` sweep instead
  if left unmigrated here, but do it here in lockstep, don't rely on the sweep to catch it late).
- [ ] S-003.3 `[adapt]` `test/dialects/typescript/*` call-site adapt: `ops-declarations.test.ts`
  (lines 59,145,186,209) + `ops-declarations-cuttable.test.ts` (lines 63,129) — the 6 pinned
  `.raw()` collision-hint occurrences (see Exact Literals); `ops-exact-set.test.ts:20`'s
  `BASE_HANDLE_KEYS` Set gains `"replaceContent"` (9 members); `print-failure.test.ts:18`,
  `coalescing.test.ts` (lines 26,64,84,118), `dialect.test.ts` (lines 98,173) — all `.raw(` calls
  → `.modify(`.
- [ ] S-003.4 `[adapt]` Confirm FIT-08 import-graph scan (`test/fitness/fit-08-no-kit-bleed.test.ts`)
  unaffected by the rename — it scans import statements, not call names; should require no edit,
  only a re-run to confirm green.

---

## S-004: Docs, security posture, repo-wide honesty sweeps

**Scope**: edge-case
**Dimension**: R (Rule — repo-wide policy: zero `.raw`, zero free `modify(` remain)
**Covers**: REQ-KIT-03, REQ-STD-01, REQ-DAS-01, REQ-AEC-13
**Requires**: S-001, S-002, S-003 (justified exception — a repo-wide sweep cannot honestly go
green before every module's rename lands; see design §4.8)
**Test layers**: architectural (fitness) + unit

**Acceptance**: GIVEN all docs (`docs/authoring-a-dialect.md`, `docs/authoring-verbs.md`,
`docs/authoring-errors.md`, `docs/dry-run.md`, `docs/quickstart.md`, `README.md`, `SECURITY.md`,
`ROADMAP.md`, `openspec/decisions/0039-*.md` prose) migrated and the two repo-wide sweeps created,
WHEN `rg '\.raw\('`/substring `.raw` and the free `modify(` sweep run, THEN both return 0 hits,
`SECURITY.md`'s `.modify(fn)` trust sentence + "conformance≠safety" caveat are pinned, and
`AuthoringVerb`/`DryRunVerb` keep `"modify"` documented as a deliberate wire-altitude label in 3
places.

### Per-slice REQ table

| REQ-ID | Spec file : section | Scenario text needed verbatim? |
|---|---|---|
| REQ-KIT-03 (doc/sweep clauses) | `.../foundations-skeleton/spec.md` (REQ-KIT-03, lines 44-51) | Yes — see the Sweep Implementation Spec section above for both sweeps' exact patterns/exclusions and confirmed migration locations. |
| REQ-STD-01 | `.../foundations-skeleton/spec.md` (REQ-STD-01, lines 111-141) | Yes — see below for the byte-exact old/new trust sentences. |
| REQ-DAS-01 (.1-.3) | `.../dialect-authoring-standards/spec.md` (REQ-DAS-01, lines 24-77) | Yes — two-realms hazard + Async usage sections, byte-exact old text below. |
| REQ-AEC-13 (.1-.3) | `.../authoring-error-contract/spec.md` (REQ-AEC-13, lines 15-76) | Yes — the 3 documentation surfaces + their exact required statement (see below). No code change — `AuthoringVerb`/`DryRunVerb` are Decided item 2 above: DO NOT rename. |

**SECURITY.md / docs/authoring-a-dialect.md byte-exact old strings to rename** (verbatim from
`test/docs/security-authoring-guard.test.ts:26-46` — this test file itself must be updated in
lockstep, it is the guard):
- `RAW_TRUST_SENTENCE` (old): `` "The `.raw(ast => …)` escape hatch executes dialect and schematic code with full process privilege — it is NOT a sandbox. The serialization seam (only plain strings cross to the engine) is the ONLY containment guarantee; it bounds what data leaves a run, not what code may do while running. Vet any dialect or op-pack before importing it." ``
  → new: replace `` `.raw(ast => …)` `` with `` `.modify(ast => …)` ``, rest of the sentence
  unchanged (`SECURITY.md:36`).
- `CONFORMANCE_NOT_SAFETY_CAVEAT` (old): `` "Passing the conformance kit (`@pbuilder/sdk/conformance`) is not a security attestation: it proves a dialect keeps the seam serializable and its ops faithful, not that the dialect's `.raw()` code is safe to execute." ``
  → new: `` `.raw()` `` → `` `.modify()` `` (`SECURITY.md:38`).
- `TWO_REALMS_HAZARD` (old, `docs/authoring-a-dialect.md`): `` "Two ts-morph realms: if your schematic already depends on ts-morph directly, that is a separate realm from the SDK's internal ts-morph used inside `.raw(ast => …)`. A `Node`/`SourceFile` from your realm is not interchangeable with the AST the SDK hands your `.raw()` callback — even when both realms resolve the identical ts-morph version. Never pass ts-morph objects across the boundary; operate only on the `ast` the callback receives." ``
  → new: both `` `.raw(ast => …)` `` and `` `.raw()` `` → `` `.modify(ast => …)` `` /
  `` `.modify()` `` respectively.
- `SECURITY.md:34` heading `` ## `.raw()` and the conformance kit `` → `` ## `.modify()` and the
  conformance kit ``.
- `GENERAL_TRUST_SENTENCE` (`SECURITY.md:17`) — UNCHANGED, does not mention `.raw`/`.modify`.

**REQ-AEC-13's 3 documentation surfaces** (all MUST state that `verb`/the wire-mutation label is
shared by both calls, byte content owned by the executor but MUST cover this substance):
`docs/authoring-errors.md:28` (the `verb` field description), `docs/dry-run.md:14` (the "author
vocabulary" claim), and `AuthoringVerb`'s own JSDoc in `src/core/authoring-error.ts:15-30`.

**AEC-13 guard — verified live: no byte-exact pin exists for this substance, and no test covers
it today.** Unlike REQ-STD-01's `RAW_TRUST_SENTENCE`/`CONFORMANCE_NOT_SAFETY_CAVEAT` (frozen,
byte-exact, sourced from design.md §4.4b), `design.md` states REQ-AEC-13's 3-surface requirement
only as SUBSTANCE ("`verb` labels the WIRE mutation statement", design.md:51) — no verbatim
sentence is prescribed, so the guard is a SUBSTANCE check (mirrors REQ-DAS-01.3's "Async usage"
section check, which asserts keyword presence, not one frozen string), not a byte-exact pin.
`test/docs/security-authoring-guard.test.ts` (the EXISTING guard file — verified live, it
currently covers REQ-STD-01/DAS-01/DAS-02/TSD-06.2 and the sensitive-areas registry, but has
ZERO REQ-AEC-13 coverage) is the correct home: it already reads `SECURITY_PATH`/`DOC_PATH` via
`readFileSync` and is tagged `[permanent-fixture]`, the same pattern this guard needs.

### Tasks

- [ ] S-004.1 `[adapt]` `docs/authoring-a-dialect.md`: **verified live — EVERY REQ-DAS-01
  mandated section ALREADY EXISTS**; this is 100% rename/adapt, ZERO net-new section
  authoring. Effort note: this is a WIDE-but-SHALLOW rename — nearly the whole document's
  middle two-thirds needs a raw/modify pass, not just the two isolated byte-exact swaps called
  out elsewhere in this document. Per existing section, verified against the live file:
  - `## Two audiences` (13-21) — exists, unaffected, no edit.
  - `### For authors: using a dialect` (22-104) — exists, HEAVILY affected: top-matter (7-11)
    naming `.raw()` as the escape hatch; the `.raw()`/coalescing intro (27, 30-32); the ENTIRE
    `.modify(content)` wholesale-replace paragraph + code sample (91-103) must become
    `.replaceContent(content)` (this is the section documenting what THIS CHANGE renames — the
    heaviest-touch block in the file).
  - `### For contributors: building a dialect` (105-131) — exists, minor: the reserved-vocabulary
    array literal at line 123-124 (`then, read, raw, modify, rename, move, copy, remove`) gains
    `replaceContent` (9-array, matches Exact Literals).
  - `` ## The `.raw()` escape hatch `` (133-144) — exists, heading renames to
    `` ## The `.modify()` escape hatch `` + full paragraph rewrite (135-140);
    `### Two ts-morph realms` (142-144) gets the byte-exact `TWO_REALMS_HAZARD` replacement
    (see byte-exact strings below).
  - `` ## Coalescing: how edits become one `modify` `` (146-156) — exists, minor: line 148's
    `.raw()` mention → `.modify()`.
  - `## Async usage` (158-186) — **EXISTS ALREADY, contrary to prior task phrasing implying
    creation** — needs edits only: line 179 "not `.raw()`-specific" → "not `.modify()`-specific";
    line 184 "your `.raw()` body" → "your `.modify()` body". The awaited-chain/forgotten-await
    content itself is unchanged prose.
  - `## Testing with the conformance kit` (188-206) — exists, unaffected EXCEPT line 206, a
    **previously unflagged duplicate**: this file carries its OWN copy of the
    `CONFORMANCE_NOT_SAFETY_CAVEAT` sentence
    (`` "...not that the dialect's `.raw()` code is safe to execute." ``) — the SAME sentence
    `security-authoring-guard.test.ts` pins in SECURITY.md, but this second occurrence is NOT
    covered by that guard (it only reads `SECURITY.md`). Must be renamed `.raw()`→`.modify()`
    here too, in this task, not assumed covered by S-004.3/S-004.6's SECURITY.md-scoped work.
  - `## The leaf rule: dialect isolation` (208-226) — exists, unaffected.
  - `## Publishing and trust` (228-232) — exists, unaffected.
- [ ] S-004.2 `[adapt]` `docs/authoring-verbs.md` (verb-list bullet + code fence lines 27-34,
  seven-verbs summary line 9, read-trichotomy example lines 96-104, NEW cross-reference line to
  `.modify(fn)` in `authoring-a-dialect.md`) / `docs/authoring-errors.md:28` (REQ-AEC-13 wire-label
  statement) / `docs/dry-run.md:14` (REQ-AEC-13 wire-label statement) / `docs/quickstart.md:179`
  (verb list) / `README.md:17` (verb list).
- [ ] S-004.3 `[adapt]` `SECURITY.md`: trust sentence + heading rename (byte-exact strings above,
  `SECURITY.md:34,36,38`) + confirm zero remaining `.raw` substring anywhere in the file;
  `ROADMAP.md`: all 6 mentions (lines 80, 121, 142, 253, 277, 286) `.raw`→`.modify`.
- [ ] S-004.4 `[adapt]`/`[RED]` **AEC-13 guard — author BOTH the prose and the guard test
  TOGETHER, in the SAME commit** (never one without the other — an unguarded prose edit can
  silently rot, an guard with no matching prose is a test that can never pass). Prose:
  `src/core/authoring-error.ts:15-30`'s `AuthoringVerb` JSDoc, `docs/authoring-errors.md:28`'s
  `verb` field description, and `docs/dry-run.md:14`'s "author vocabulary" claim — all THREE
  state that `"modify"` labels the WIRE mutation shared by BOTH `.replaceContent()` and
  `.modify(fn)`, and that the mismatch is intentional (do NOT rename the `"modify"` union member
  itself, Decided item 2). Guard: extend `test/docs/security-authoring-guard.test.ts` (existing
  file, model on its own `describe("REQ-DAS-01.3 — Async usage section", ...)` substance-check
  pattern, NOT a byte-exact `toContain`) with a new `describe("REQ-AEC-13.3 — ...")` reading all
  3 files and asserting each contains the substantive statement (e.g. mentions of `modify`, the
  wire/mutation framing, and BOTH `.replaceContent()`/`.modify(fn)` by name) — fails RED if any
  of the 3 surfaces lacks it.
- [ ] S-004.5 `[RED]` NEW `test/fitness/fit-raw-sweep*.test.ts` (name/host at executor's
  discretion, e.g. mirror `fit-08-no-kit-bleed.test.ts`'s structure) implementing BOTH sweeps
  per the Sweep Implementation Spec above (`\.raw\(` + substring `.raw` + the `modify(` free-call
  ban with its 2 exclusions). Both sweeps return 0 hits only once S-001/S-002/S-003 AND this
  slice's own doc migrations (S-004.1-.3) have landed.
- [ ] S-004.6 `[adapt]` `test/docs/security-authoring-guard.test.ts`: update
  `RAW_TRUST_SENTENCE`/`CONFORMANCE_NOT_SAFETY_CAVEAT`/`TWO_REALMS_HAZARD` constants (byte-exact
  new text above) — this file is both a task target AND the enforcement mechanism, so it must
  change in the SAME commit as the docs it guards, never before (would go red against old docs)
  or after (would pass against unmigrated docs). `test/dry-run/*` adapt if any test asserts the
  old author-vocabulary doc wording (verify via `rg -n 'author vocabulary' test/dry-run/`).

---

## `test/fitness/` inventory — reactivity to rename / new export (Gap 3, so no gate surprises final verify)

Every `*.test.ts` under `test/fitness/` (28 fit-files + `definefactory-jsdoc.test.ts`), verified
live via `rg` for `raw`/`modify`/`RESERVED_HANDLE_NAMES`/`reserved` across the whole directory,
then read in context to separate real hits from false positives (e.g. `fit-13`'s `const raw =
'{"properties":...}'` is an unrelated JSON-string variable name, not the dialect verb):

| File | Subject | Affected? | Why |
|---|---|---|---|
| fit-01-commons-no-ast | commons imports zero AST libs | No | no rename/export touches import graph |
| fit-02-dialect-leaf-rule | no dialect imports a sibling dialect | No | unrelated to verb names |
| fit-03-commons-bundle-budget | /commons bundle size budget | No | rename is same-order-of-length |
| fit-04-dts-semver-gate | public `.d.ts` semver baseline diff | **YES** | 3 baselines churn + 1 new pair — already tasked (S-000.4, S-001.6, S-002.5) |
| fit-05-serializable-bytes | wire-level JSON-roundtrip of a `modify` directive | No | asserts the WIRE op `"modify"` (frozen), builds its chain via `addImport` only — no `.raw(`/`.modify(` call site |
| fit-06-example-jsdoc | every public export has `@example` | No | checks tag presence, not method names |
| fit-07-no-tree-in-core | no `Map<path,*>` in core | No | unrelated |
| fit-08-no-kit-bleed | no kit-symbol re-export leakage | No | import-graph scan, not call names (confirmed, S-003.4) |
| fit-09-pkg-exports-resolution | package.json `exports` map shape | No | its one "raw" hit is "raw file path" prose, unrelated to `.raw()` |
| fit-10-engine-client-port-guard | engine-client port direction | No | unrelated |
| fit-11-whole-object-leak-scan | `AuthoringError`/`EmitRejection` leak scan | No | its "reserved-name" hit is the FACTORY lifecycle-reserved-name domain (`pre-execute` etc.), a different reserved-name concept from `RESERVED_HANDLE_NAMES` |
| fit-12-schema-parity | schema/type digest parity | No | unrelated |
| fit-13-schema-sufficiency | schema-sufficiency hard-fail gate | No | its "raw" hits are a `const raw = '{"properties":...}'` JSON-string variable, unrelated |
| fit-14-package-surface | package-surface baseline diff | No | unrelated |
| fit-15-bin-core-direction | bin→core import direction | No | unrelated |
| fit-16-reserved-name-scan | factory LIFECYCLE reserved-name scan (`pre-execute`/`post-execute`) | No | different reserved-name domain than `RESERVED_HANDLE_NAMES` — verified zero overlap in `src/core/schema/schema-discovery.ts` |
| fit-17-testing-dev-only-bundle | dev-only bundle containment | No | unrelated |
| fit-18-fake-single-source-parity | `ContractFake` single-implementation | No | unrelated |
| fit-19-coalescing-orphan-guard | mid-chain-read re-registration | **YES — NOT previously tasked** | line 35 literally calls `handle.raw((ast) => {...})` on a `toyDialect` handle — a live call site this document's task list missed; see S-000.8 below |
| fit-20-unawaited-join-guard | run-boundary join drains outstanding handles | **YES** | already pinned in Exact Literals (4th foreign-wrap-tail file) and S-000.3 |
| fit-21-context-no-dialect-handle-import | dependency direction, context↔dialect-handle | No | unrelated |
| fit-22-scaffold-leaf-rule | scaffold leaf-rule | No | unrelated |
| fit-23-publish-workflow-guard | CI publish workflow least-privilege | No | its "raw" hit is "raw substring scan" prose (about job-name matching), unrelated |
| fit-24-corpus-purity | corpus byte/PII purity | No | its "raw" hit is "byte-preserving... raw" prose about latin1 reads, unrelated |
| fit-25-single-capture-path | single corpus-capture code path | No | its "raw" hit is the `rawDirectives` variable name, unrelated |
| fit-26-report-hygiene-citations | report/citation hygiene | No | unrelated |
| fit-27-anti-tautology-scan | anti-tautology static scan | No | unrelated |
| fit-28-corpus-determinism | corpus byte-determinism | No | unrelated |
| definefactory-jsdoc | `defineFactory` JSDoc `@remarks` reserved-lifecycle-name doc | No | same factory-lifecycle reserved-name domain as fit-16/fit-11, not `RESERVED_HANDLE_NAMES` |

**New task surfaced by this inventory**: fit-19's live `.raw(` call — folded into S-000's own
task list as **S-000.8** (not left dangling here) so `sdd-apply`'s per-slice task scan doesn't
miss it.

---

## Build Order

| Order | Slice | Parallelizable with |
|---|---|---|
| 1 | S-000 (skeleton, implicit blocker) | — |
| 2 | S-001, S-002, S-003 | each other |
| 3 | S-004 (integration gate) | — |

**Parallel-semantics rule (Gap 3)**: "parallelizable" above means LOGICALLY independent —
S-001/S-002/S-003 touch disjoint files and neither reads nor depends on the others' rename
output. It does NOT mean concurrent execution. All slices land SEQUENTIALLY on ONE branch, in
build-order, one at a time: no parallel worktrees, no simultaneous branches for S-001/S-002/S-003.
Each slice regenerates ONLY its own FIT-04 baseline(s) (S-001 → `commons.index.d.ts` +
`core.base-handle.d.ts`; S-002 → `conformance.index.d.ts`) in the SAME commit as the rename that
dirtied it — never a shared "regen all baselines" commit spanning slices, and never a baseline
regenerated ahead of its own slice's rename landing (that would either be a no-op diff or, worse,
mask a rename that hasn't actually happened yet).

## Anti-Pattern Check

✅ No horizontal/layer-named slices — each names a rename vertical or a policy gate.
✅ Every slice cites ≥1 REQ-ID; every REQ-ID across the 7 domains claimed exactly once (matrix
below); REQ-TSD-12 excluded (tombstoned).
⚠️ S-004 depends on 3 slices — flagged by the >2-dependency heuristic but JUSTIFIED: it is the
repo-wide fitness sweep: it structurally cannot pass before every module's rename lands (mirrors
design.md §4.8's own final-slice placement).
✅ 5 total slices (1 skeleton + 4 SPIDR) — within L's 4-7 target, no under/over-fragmentation.

## REQ Coverage Matrix

| REQ-ID | Domain | Slice |
|---|---|---|
| REQ-KIT-03 | foundations-skeleton | S-004 |
| REQ-GIR-02 | foundations-skeleton | S-001 |
| REQ-FIT-04 | foundations-skeleton | S-000 |
| REQ-STD-01 | foundations-skeleton | S-004 |
| REQ-DG-02 | dialect-generics | S-000 |
| REQ-DG-03 | dialect-generics | S-000 |
| REQ-DG-04 | dialect-generics | S-003 |
| REQ-DG-05 | dialect-generics | S-000 |
| REQ-DG-06 | dialect-generics | S-000 |
| REQ-DG-07 | dialect-generics | S-000 |
| REQ-MC-01 | modify-coalescing | S-000 |
| REQ-MC-02 | modify-coalescing | S-000 |
| REQ-MC-03 | modify-coalescing | S-000 |
| REQ-MC-06 | modify-coalescing | S-000 |
| REQ-MC-08 | modify-coalescing | S-000 |
| REQ-TSD-01 | typescript-dialect | S-003 |
| REQ-TSD-03 | typescript-dialect | S-003 |
| REQ-TSD-04 | typescript-dialect | S-003 |
| REQ-DC-02 | dialect-conformance | S-002 |
| REQ-DC-03 | dialect-conformance | S-002 |
| REQ-DC-04 | dialect-conformance | S-002 |
| REQ-DAS-01 | dialect-authoring-standards | S-004 |
| REQ-AEC-13 | authoring-error-contract | S-004 |

**23 of 23 REQ-IDs claimed. 0 orphans. REQ-TSD-12 (retired) intentionally excluded.**

## New ADR-authoring tasks summary (Gap 1 closure)

| ADR | Action | Home slice | Task |
|---|---|---|---|
| `openspec/decisions/0050-handle-unfreeze-honest-write-verb-rename.md` | NEW file (next free number after 0049) | S-000 | S-000.1b |
| `openspec/decisions/0012-conformance-kit.md` | Amend in place (new `## Amendment` section) | S-002 | S-002.1b |
| `openspec/decisions/0039-fail-loud-rejection-incoherent-operations.md` | Amend in place (new `## Amendment` section) | S-000 | S-000.2b |

## FIT-04 baseline regeneration tasks summary (Gap 2 closure)

| Baseline | Churns? | Home slice | Task |
|---|---|---|---|
| `test/fitness/dts-baseline/core.define-dialect.d.ts` | NEW (10th pair) | S-000 | S-000.4 |
| `test/fitness/dts-baseline/commons.index.d.ts` | YES | S-001 | S-001.6 |
| `test/fitness/dts-baseline/core.base-handle.d.ts` | YES | S-001 | S-001.6 |
| `test/fitness/dts-baseline/conformance.index.d.ts` | YES | S-002 | S-002.5 |
| `test/fitness/dts-baseline/core.handle-state.d.ts` | no (comment-only) | — | none |
| `test/fitness/dts-baseline/typescript.index.d.ts` | no (comment-only) | — | none |
