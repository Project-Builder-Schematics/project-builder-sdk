# Delta for typescript-dialect

**Spec version**: V2
**Status**: draft
**Change**: `ts-dialect-backend-ops`
**REQs / Scenarios**: 11 / 51 headed scenarios + 1 table-driven edge-scenario matrix (REQ-TSD-03, 11 rows) + 1 collision cross-product table (REQ-TSD-20) (V1: 9/31)

**Terminology note**: the AST escape hatch's shipped name is `.modify(fn)` (renamed from the
retired `.raw()` by `author-write-surface`, ADR-0050). `docs/authoring-a-dialect.md`'s guard
(`REQ-DAS-01.1`) fails RED if `.raw(` reappears. This change's own predecessor artefacts
(proposal/explore/triage) use `.raw()` colloquially — every scenario below uses the CURRENT
name; design/apply MUST NOT copy the stale name forward.

## Changelog — V1 → V2 (council-spec-v1.md finding resolution)

Owner rulings (e)-(h), issued 2026-07-18, are BINDING and applied throughout (see `state.yaml`
`ratified_decisions`). Every finding below is APPLIED unless marked REBUTTED.

| ID | Finding | Resolution |
|---|---|---|
| C1 | TSD-15.4 pinned TS2300-invalid emission | APPLIED — ruling (e): scenario replaced with a NO-OP; Idempotency/Collision tables updated |
| C2 | frozen `addImport` merge silently type-only-izes a value import | APPLIED — new retroactive Spec Decision 7 + REQ-TSD-01.6; mirrored on export side (M7b) |
| C3 | no scenario forces the multi-declaration walk (14/15/16/17/19) | APPLIED — multi-decl scenarios added: TSD-14.6, TSD-15.6, TSD-16.4, TSD-19.6 |
| C4 | namespace half of collision widening untested | APPLIED — REQ-TSD-20 anchor scenario .4 + Collision Widening Verification Table |
| C5 | TIV-01 grammar unpinned | APPLIED in `typescript-identifier-validation` (ruling g) — cross-referenced here where TSD ops depend on it |
| M3 | `addVariable.kind` raw splice | APPLIED — ruling (f), new REQ-TSD-21 |
| M4 | missing collision rows (named+default merge, ns-vs-ns different name, default+namespace merge) | APPLIED — Spec Decisions 5/6/9 + REQ-TSD-13.5, REQ-TSD-14.4/.7, Collision Widening Table |
| M5 | TSD-14.3/20 precedence unpinned | APPLIED — REQ-TSD-14 precedence sentence + anchor scenario .5 |
| M6 | mixed inline clause + aliased type-import identity unpinned | APPLIED — REQ-TSD-15.5 |
| M7 | (a) addReExport cross-module duplicate name; (b) type-only export clause as merge target | APPLIED — Spec Decision 10, REQ-TSD-17.4/.5 |
| M8 | aliased export specifier match side ambiguous | APPLIED — ruling (h), REQ-TSD-17.6, REQ-TSD-19.7 |
| M10 | duplicate-binding hazard (TSD-15) | SUPERSEDED — ruling (e)'s no-op removes the hazard; doc note only, no new scenario |
| m4 | Collision Outcome Table row said "12 ops", should be 10 | APPLIED — row corrected |
| m6 | type-only default vs `addDefaultImport` identity unpinned | APPLIED — REQ-TSD-13.4 |
| m7 | TSD-18.3 universal claim + AST-internal assertion | APPLIED — reworded to a concrete golden-text assertion |
| m9 | TSD-19.4 never probes matching-module `export *` untouched | APPLIED — REQ-TSD-19.5 |
| m10 | conformance-suite widening has no anchor | APPLIED — explicit design-phase delegation note (not a spec-level scenario, deliberately) |
| m11 | same-handle chain double-call precedent only pinned for `addImport` | APPLIED — REQ-TSD-03.11 (`addReExport`) |

## Spec Decisions (V1 items 1-4 UNCHANGED; V2 adds 5-11)

1. **Default-vs-default collision** (`addDefaultImport`): REJECT when an existing default import
   under a DIFFERENT name is found (branded `dialectError`, ADR-0039-consistent fail-loud
   posture). Same name → idempotent no-op.
2. **Namespace-vs-named coexistence** (`addNamespaceImport`): open a NEW separate import
   declaration when the existing same-module declaration already carries named imports (never
   reject, never let ts-morph's `InvalidOperationError` escape uncontained) — two declarations
   from one module is legal TS, already precedented by `removeImport`'s multi-declaration walk.
3. **`assertNoCollision` widening**: widens to inspect `getDefaultImport()`/`getNamespaceImport()`
   identifiers. The widened predicate is shared by the 3 existing collision-gated ops
   (`addFunction`/`addVariable`/`addClass`) AND the 2 new ops that introduce a value-namespace
   binding (`addDefaultImport`/`addNamespaceImport`) — one predicate, symmetric guarantee across
   all 5. This IS a retroactive behaviour change on the 3 existing ops (REQ-TSD-20).
4. **`removeExport` whole-statement-deletion guard**: mirrors `removeImport`'s last-specifier
   guard. `ExportDeclaration`'s `namespaceExport`/`namedExports` are mutually exclusive (simpler
   than import's 3-way mix — no default binding to protect), so deleting the sole named export
   deletes the whole statement; an absent name+module target is a no-op, never a throw.
5. **(NEW, V2 — M4a)** `addDefaultImport` against an existing same-module declaration that holds
   ONLY named imports (no default) MERGES — `setDefaultImport` is called on that existing
   declaration, mirroring `addImport`'s own "merge into the existing same-module clause" posture
   rather than opening a redundant second declaration.
6. **(NEW, V2 — M4c, FLAGGED non-probe-verified)** `addNamespaceImport` against an existing
   same-module declaration that holds ONLY a default import (no named, no namespace) MERGES —
   `setNamespaceImport` is called on that existing declaration, producing the legal combined form
   `import Def, * as ns from "m";`. This is reasoned from explore's PROBED fact that
   `setNamespaceImport` throws only "if a named import already exists" (no mention of default) —
   it is NOT independently probe-verified against ts-morph@28 in this round. Flagged explicitly:
   `sdd-design`/`sdd-apply` MUST probe-verify before implementation; if disproven, this decision
   is corrected via design's own finding, never a silent implementation deviation.
7. **(NEW, V2 — C2, retroactive, PROBE-VERIFIED)** frozen `addImport`'s merge-target selection
   MUST SKIP a whole-declaration type-only import (`import type { X } from "m"`) when choosing
   which existing declaration to merge a value import into. QA's probe confirmed the pre-fix
   behaviour produces `import type { X, y } from "m"` — silently making the caller's requested
   VALUE import (`y`) type-only, which downstream code consuming `y` as a value fails against
   (TS2300-class defect class). A new separate value declaration is inserted instead. Mirrored
   on the export side for `addReExport` vs. `export type { … }` clauses (Decision 10 / M7b).
8. **(NEW, V2 — ruling e)** `addTypeImport` is a NO-OP when a same-name VALUE import of the same
   module already exists — a value import already provides the type meaning the caller is asking
   for. This AMENDS ruling (b)'s consequence for this specific case only; ruling (b) itself still
   governs the EMITTING case (always a separate `import type { X } from 'm'` statement, never the
   inline `{ type X }` form).
9. **(NEW, V2 — M4)** `addNamespaceImport` REJECTS (does not merge, does not open a new
   declaration) when the existing same-module declaration already has a namespace import under a
   DIFFERENT name — symmetric with Decision 1's default-vs-default reject. Un-guarded, ts-morph's
   `setNamespaceImport` SILENTLY RENAMES the existing binding (QA probe-verified) — the same
   silent-desired-state-mutation hazard Decision 1 already rejects for defaults.
10. **(NEW, V2 — M7)** `addReExport` REJECTS when the requested exported name is already exported
    under the SAME name from a DIFFERENT module (duplicate exported name is invalid TS — fail
    loud, never silently emit unparseable output). Separately, `addReExport`'s merge-target
    selection SKIPS a whole-declaration type-only export clause (`export type { Y } from "m"`),
    mirroring Decision 7's import-side fix — a new separate value export declaration is inserted.
11. **(NEW, V2 — ruling f)** `addVariable`'s `options.kind` parameter gets RUNTIME validation
    against the exact allow-list `"const" | "let" | "var"`, rejecting with the same branded
    `dialectError` — see new REQ-TSD-21. Closes the sibling raw-splice gap alongside REQ-TIV-01's
    name-position hardening (a different parameter position, hence its own REQ).

**Conformance corpus note (m10)**: `test/conformance/typescript-conformance.test.ts`'s op-pack
fixture MUST widen to exercise all 7 new ops in at least one composed chain. The specific
composition and fixture shape is DELEGATED to `sdd-design` — this is a design-phase obligation,
not a spec-level behavioural contract, so it deliberately carries no anchoring REQ-ID scenario
here (explicit delegation, not a silent gap).

## Idempotency Identity Table (pinned before tests, Strict TDD)

| Op | Identity |
|---|---|
| `addDefaultImport` | name+module |
| `addNamespaceImport` | name+module |
| `addTypeImport` | name+module — recognized across THREE forms (V2, M6): inline `import { type X }` (specifier-level `isTypeOnly`, INCLUDING mixed clauses `import { a, type X }`), separate `import type { X } from 'm'` (declaration-level), AND a same-name VALUE import of the same module (ruling e amendment — a value import already satisfies the type need, so the op NO-OPs against it rather than emitting) |
| `addSideEffectImport` | module-only |
| `addReExport` | name+module — aliased specifiers matched by SOURCE name only (ruling h); the visible-alias side is a documented non-match |
| `addExportAll` | module-only |
| `removeExport` | name+module (mirrors `removeImport`); aliased specifiers matched by SOURCE name only (ruling h) |

## Collision Outcome Table (every row resolves binary — no uncontained ts-morph exception)

| Op | Conflicting state | Outcome |
|---|---|---|
| `addDefaultImport` | same name already the module's default import | no-op (idempotent) |
| `addDefaultImport` | different name already the module's default import | reject (`dialectError`) |
| `addDefaultImport` | existing same-module declaration has ONLY named imports (no default) | merges — `setDefaultImport` on the existing declaration (Spec Decision 5, V2) |
| `addDefaultImport` / `addNamespaceImport` | `name` collides with an existing value-namespace binding (function/var/class/enum/namespace/named-import) — widened `assertNoCollision` | reject (`dialectError`) |
| `addNamespaceImport` | existing same-module declaration already has named imports | new separate declaration (never reject, never throw) |
| `addNamespaceImport` | existing same-module declaration already has a namespace import under a DIFFERENT name | reject (`dialectError`) — Spec Decision 9, V2, symmetric with default-vs-default |
| `addNamespaceImport` | existing same-module declaration has ONLY a default import (no named, no namespace) | merges — `setNamespaceImport` on the existing declaration (Spec Decision 6, V2, FLAGGED non-probe-verified) |
| `addTypeImport` | type-only binding for name+module already present (any of the three recognized forms) | no-op (idempotent) |
| `addTypeImport` | a VALUE (non-type) import of the same name+module exists | no-op (idempotent) — ruling (e) amendment, V2. REPLACES V1's "proceeds to emit" row, which QA probe-verified produces TS2300-invalid output (C1) |
| `addImport` | existing same-module declaration is WHOLE-declaration type-only (`import type {...} from 'm'`) | merge-target selection SKIPS it; a NEW separate value declaration is inserted (Spec Decision 7, V2, retroactive, probe-verified — C2) |
| `addSideEffectImport` | `import "m";` already present | no-op (idempotent) |
| `addReExport` | `export { name } from "m"` already present | no-op (idempotent) |
| `addReExport` | export decl for `m` exists with OTHER named exports | merges `name` into it (mirrors `addImport`'s merge shape) |
| `addReExport` | same exported name already exported from a DIFFERENT module | reject (`dialectError`) — Spec Decision 10, V2 (M7a) |
| `addReExport` | existing same-module export declaration is WHOLE-declaration type-only (`export type {...} from 'm'`) | merge-target selection SKIPS it; a NEW separate value export declaration is inserted (Spec Decision 10, V2, mirrors C2 — M7b) |
| `addExportAll` | `export * from "m"` already present | no-op (idempotent) |
| `removeExport` | matching name+module is the sole named export in its clause | whole statement deleted |
| `removeExport` | matching name+module coexists with other named exports | only the matched specifier removed |
| `removeExport` | no matching name+module found | no-op (never throws) |
| any of the 10 name-bearing ops (2 of the 12 shipped ops — `addSideEffectImport`/`addExportAll` — take no `name` argument, per REQ-TIV-01/03's own boundary) | injection-shaped `name` payload | reject (`dialectError`), zero emitted directives — see `typescript-identifier-validation` REQ-TIV-03 (m4 fix: row previously miscounted as "12 ops") |

**Precedence (M5, V2)**: for every collision-gated op, resolution order is FIXED: (1) identifier
validation (`typescript-identifier-validation` REQ-TIV-01) (2) `assertNoCollision` identity +
collision check across the full value namespace, INCLUDING named-import bindings (pre-existing)
and default/namespace bindings (REQ-TSD-20 widening) (3) only if collision-clear, any
same-module coexistence/merge-target-selection rule decides new-declaration vs. merge vs. no-op.
A `name` that collides via step 2 NEVER reaches step 3 — see REQ-TSD-14.5 for a concrete pin.

## MODIFIED Requirements

### REQ-TSD-01: Frozen subpath + widened op-pack vocabulary

The TypeScript dialect MUST be reachable at the exact subpath `@pbuilder/sdk/typescript`
(frozen — not `/ts`, not `/typescript-morph`; ADR-0014 amendment). Its op-pack MUST expose
`.modify(fn)` (universal, REQ-DG-03) plus TWELVE structured ops: the five FROZEN existing ops
(`addImport`, `removeImport`, `addFunction`, `addVariable`, `addClass` — call signatures
unchanged) plus seven NEW ops with call signatures: `addDefaultImport(name: string, from:
string)`, `addNamespaceImport(name: string, from: string)`, `addTypeImport(name: string, from:
string)`, `addSideEffectImport(from: string)`, `addReExport(name: string, from: string)`,
`addExportAll(from: string)`, `removeExport(name: string, from: string)`. This is STILL the only
dialect subpath wired by this change. Frozen `addImport`'s merge-target selection ALSO gains a
retroactive constraint this round (Spec Decision 7, V2): it MUST skip whole-declaration type-only
import declarations when choosing a merge target.

(Previously: pinned the five-op vocabulary at V4 of `author-write-surface`. This change widens
the op-pack 5→12 — additive only, no existing call-signature changes. Scenario .1 (below) is
UPDATED in place — the sorted allow-list array grows from 5 to 12 entries; scenarios .2/.3/.4 are
UNCHANGED, carried forward verbatim from the main spec per the MODIFIED-workflow full-copy rule.
V2 adds scenario .6 — `addImport`'s merge-target selection now skips whole-declaration type-only
imports, a SECOND retroactive behaviour change on this frozen op alongside REQ-TSD-20's collision
widening.)

#### Scenario REQ-TSD-01.1: subpath resolves, exact op-set shape (UPDATED — 5→12)

- GIVEN `package.json#exports`
- WHEN `@pbuilder/sdk/typescript` is imported and `Object.keys(dialect.ops)` is sorted
- THEN it resolves AND the sorted array EQUALS EXACTLY the 12 op names — `addClass`,
  `addDefaultImport`, `addExportAll`, `addFunction`, `addImport`, `addNamespaceImport`,
  `addReExport`, `addSideEffectImport`, `addTypeImport`, `addVariable`, `removeExport`,
  `removeImport` — asserted via `toEqual`, never `toContain`/subset, so an extra op fails RED
  (anti-smuggle) and a missing op fails RED (honest cut-lever tracking)
  (Previously: EQUALS EXACTLY `["addClass", "addFunction", "addImport", "addVariable",
  "removeImport"]` — the 5-op allow-list this change widens.)

#### Scenario REQ-TSD-01.2: addImport concrete before/after byte pair (UNCHANGED)

- GIVEN a seeded file `a.ts` with content `const x = 1;\n`
- WHEN `find("a.ts").addImport("readFileSync", "node:fs")` flushes
- THEN the printed content is BYTE-EXACT against a committed golden fixture — e.g.
  `import { readFileSync } from "node:fs";\n\nconst x = 1;\n` — the golden is the source of
  truth for exact insertion position/formatting; this string illustrates the shape

#### Scenario REQ-TSD-01.3: the value-namespace collision hint names the live escape hatch, not the retired one (UNCHANGED)

- GIVEN `addFunction`/`addVariable`/`addClass` invoked with a `name` that already collides with
  an existing value/import/enum/namespace binding (ADR-0039, widened by REQ-TSD-20)
- WHEN the collision guard throws
- THEN the thrown `dialectError`'s message ends with the BYTE-EXACT clause `…or edit it with
  .modify().` — NOT `…or edit it with .raw().` — a guard test pins the corrected literal and
  fails RED if `.raw()` reappears in this runtime message

#### Scenario REQ-TSD-01.4: the module-level JSDoc names the live escape hatch, not the retired one (UNCHANGED)

- GIVEN `src/dialects/typescript/index.ts`'s module-level JSDoc
- WHEN scanned
- THEN it reads "...exposing the universal `.modify()` escape hatch..." — NOT "...the universal
  `.raw()` escape hatch..." — this author-facing JSDoc flows into IntelliSense hover text and
  MUST migrate alongside the runtime collision-hint message (REQ-TSD-01.3); the repo-wide
  `.raw(` sweep enforces this as a fitness check, fails RED if `.raw()` reappears here

#### Scenario REQ-TSD-01.5: E2E — a Group-1 gesture that today forces `.modify(fn)` completes with zero escape-hatch calls (UNCHANGED)

- GIVEN `test/e2e/dialect-modify.e2e.test.ts`'s style, extended with a chain that TODAY (before
  this change) requires `.modify(ast => ast.addImportDeclaration({ moduleSpecifier: "m",
  defaultImport: "X" }))` to add a default import
- WHEN the SAME outcome is authored via `ts.find(path).addDefaultImport("X", "m")`
- THEN the committed tree is byte-identical to the `.modify(fn)`-authored equivalent AND the
  chain contains ZERO `.modify(fn)`-as-escape-hatch calls for that gesture
- AND this does NOT generalize to a claim that `.modify(fn)` is eliminated wholesale — REMOVAL
  gestures for default/namespace/side-effect/export-all forms still require `.modify(fn)` in v1
  (decision c's add/remove asymmetry, REQ-TSD-19, documented at point of use)

#### Scenario REQ-TSD-01.6: retroactive — `addImport` skips a whole-declaration type-only merge target (NEW, V2 — C2, probe-verified)

- GIVEN a file holding `import type { X } from "m";` (a whole-declaration type-only import)
- WHEN `addImport("y", "m")` is called (previously: merged into this declaration, producing
  `import type { X, y } from "m";` — QA's ts-morph@28 probe confirmed this is TS2300-invalid
  when a separate value binding for the same name is also expected elsewhere)
- THEN a NEW separate `import { y } from "m";` value declaration is inserted; the existing
  `import type { X } from "m";` is untouched

### REQ-TSD-03: Edge scenarios (fail-closed, fidelity, byte/size boundaries) (NEW MODIFICATION, V2 — m11)

| # | Given | When | Then |
|---|---|---|---|
| .1 modify-after-create | a commons `create(path, { template, options })` followed by a dialect `find(path).addImport(name, from)` in the SAME run (create stages the file; the dialect's first-op read-through then observes it via read-your-own-writes — `modify-coalescing` REQ-MC-02.2) | flushed | the run emits the `create` directive (flushed when the dialect read-through reads back through `Session.read`, ADR-0015) AND exactly ONE coalesced dialect `modify` for `path` at run end; the `modify`'s content is byte-exact the CREATED content with the import applied — derived from the staged create via RYOW, NEVER from a disk/tree read (no persisted tree, ADR-0008) |
| .2 modify-then-move | a chain `find(path).addImport(x).move(toDir)` | flushed | the coalesced `modify` directive targets the ORIGINAL path AND its content is byte-exact with the import applied — the modify's content survives intact alongside the trailing move; the trailing `move` directive carries `{path, toDir}` |
| .3 two-edits-one-modify | two DISTINGUISHABLE edits (named op + `.modify(fn)`, disjoint textual footprints) with no read between them | flushed | exactly ONE `modify` directive whose `content` reflects BOTH edits — a content assertion, not a count-only assertion (`modify-coalescing` REQ-MC-01, real-AST proof) |
| .4 modify-on-nonexistent | `find()` targeting an unseeded path, first op executed | the handle's first op resolves | rejects with an author-visible message using the SAME `"dialect operation failed: "` prefix as `dialect-generics` REQ-DG-05 — pinned text (the `{path}` is QUOTED, matching REQ-DG-05's three tails): `dialect operation failed: "{path}" does not exist — create it first in this run`; not merely "ADR-0017"; the fake's run-end existence check (ADR-0017, REQ-FAKE-07 precedent) is the engine-side backstop, per `modify-coalescing` REQ-MC-04's reconciled timing |
| .5 empty file | a seeded EMPTY file, `addImport` applied | flushed | round-trips byte-exact plus the import, no spurious whitespace |
| .6 CRLF/BOM | a seeded file with CRLF line endings and a UTF-8 BOM, round-tripped with no edit | round-tripped | byte-exact — BOM and CRLF both preserved |
| .7 4 MiB boundary | a seeded multibyte-UTF-8 fixture sized so RAW bytes < `BATCH_CAP_BYTES` ≤ SERIALIZED (JSON-stringified) bytes — the multibyte expansion crosses the cap only after serialization (Stage-1 lesson) | an edit is applied and flushed | accepted under the cap, or rejected AT the cap (REQ-AEC-01.5) — never silently truncated; the fixture pins that it is the SERIALIZED side that trips the check |
| .8 CRLF + addImport | a seeded file with CRLF line endings, `addImport` applied | flushed | the inserted import line uses the SAME CRLF `newLineKind` as the rest of the file (REQ-TSD-02's frozen `newLineKind` × the file's existing line ending) — deterministic, pinned against a committed golden |
| .9 modify-then-copy | a chain `find(path).addImport(x).copy(toDir)` | flushed | mirrors .2: the coalesced `modify` targets the ORIGINAL path with byte-exact import content; the trailing `copy` directive carries `{path, toDir}` — `.copy()` chains after a coalesced modify the same as `.move()` |
| .10 duplicate addImport | `find(path).addImport(x, m).addImport(x, m)` — the SAME name+module called twice on one handle | flushed | idempotent: the printed content contains a SINGLE valid import statement for `{x} from m` — no duplicate import lines (design owns the merge mechanism; this REQ pins the observable no-duplicate-output contract) |
| .11 duplicate addReExport (NEW, V2 — m11) | `find(path).addReExport(x, m).addReExport(x, m)` — the SAME name+module called twice on one handle, extending .10's precedent to a Group-1 op | flushed | idempotent: the printed content contains a SINGLE `export { x } from "m";` clause — no duplicate export lines |

Justification for .10's idempotent ruling: repeated `addImport` calls for the same name+module
are a common byproduct of composed schematics (two independent op invocations importing the
same helper); a naive duplicate-statement output would be redundant, and in some TS contexts
invalid, code. The same justification applies to .11 — repeated `addReExport` calls for the same
name+module are an equally plausible byproduct of composed barrel schematics.

(Previously: row .3's example named the escape hatch `.raw()`. Renamed to `.modify(fn)` — no
other row changed; the WIRE-level `modify` directive naming used throughout this table (rows
.1/.2/.3/.4/.9) is the unchanged wire op, not the author verb. V2: row .11 added — same-handle
chain double-call idempotency, previously pinned only for `addImport`, now proven for a Group-1
op — the pattern must not be assumed to generalize without at least one extension proof, per m11.)

## ADDED Requirements (new to this domain — the 7 Group-1 ops + the retroactive collision widening + kind validation)

### REQ-TSD-13: `addDefaultImport(name, from)`

Inserts `import {name} from "{from}";` when no default import exists for `from`. Idempotent on
the SAME name (no-op). REJECTS (`dialectError`) when `from` already has a default import under a
DIFFERENT name (Spec Decision 1) — ts-morph's `setDefaultImport` silently overwrites and is
never called for a rename. MERGES into an existing same-module declaration that holds ONLY named
imports (Spec Decision 5, V2). Also rejects under the widened collision predicate (REQ-TSD-20).

#### Scenario REQ-TSD-13.1: happy — clean insert
- GIVEN a file with no import from `"m"`
- WHEN `addDefaultImport("X", "m")`
- THEN `import X from "m";` is inserted

#### Scenario REQ-TSD-13.2: alternate — idempotent re-apply
- GIVEN a file already holding `import X from "m";` (this op's own prior output)
- WHEN `addDefaultImport("X", "m")` re-applies
- THEN zero directives are emitted — the file is unchanged

#### Scenario REQ-TSD-13.3: error — default-vs-default collision
- GIVEN a file already holding `import Y from "m";`
- WHEN `addDefaultImport("X", "m")`
- THEN rejects with `dialectError`; the original `Y` default import is untouched

#### Scenario REQ-TSD-13.4: independent — a type-only default does not satisfy identity (NEW, V2 — m6)
- GIVEN a file already holding `import type X from "m";` (a type-only default import)
- WHEN `addDefaultImport("X", "m")`
- THEN this does NOT satisfy the op's own no-op identity — a VALUE default import for `X` from
  `"m"` does not yet exist, so the call falls through to Spec Decision 1's normal logic (clean
  insert alongside the type-only import, since no VALUE default currently exists under any name)

#### Scenario REQ-TSD-13.5: alternate — merges into an existing named-only declaration (NEW, V2 — M4a)
- GIVEN a file already holding `import { a } from "m";` (named imports only, no default)
- WHEN `addDefaultImport("X", "m")`
- THEN the SAME declaration becomes `import X, { a } from "m";` — no second declaration is opened
  (Spec Decision 5)

### REQ-TSD-14: `addNamespaceImport(name, from)`

Inserts `import * as {name} from "{from}";`. Idempotent on the SAME name with no coexisting named
imports on that declaration. When the existing same-module declaration already carries named
imports, opens a NEW separate declaration (Spec Decision 2) — never calls `setNamespaceImport` on
a declaration that would throw. REJECTS when the existing same-module declaration already has a
namespace import under a DIFFERENT name (Spec Decision 9, V2). MERGES into an existing same-module
declaration that holds ONLY a default import (Spec Decision 6, V2, flagged non-probe-verified).
Resolution follows the fixed precedence stated above the requirement tables: validation →
collision check → coexistence/merge-target rule.

#### Scenario REQ-TSD-14.1: happy — clean insert
- GIVEN a file with no import from `"m"`
- WHEN `addNamespaceImport("ns", "m")`
- THEN `import * as ns from "m";` is inserted

#### Scenario REQ-TSD-14.2: alternate — idempotent re-apply
- GIVEN a file already holding `import * as ns from "m";` with no named imports on that decl
- WHEN `addNamespaceImport("ns", "m")` re-applies
- THEN zero directives are emitted

#### Scenario REQ-TSD-14.3: edge — named-import coexistence never throws
- GIVEN a file already holding `import { a } from "m";`
- WHEN `addNamespaceImport("ns", "m")`
- THEN a NEW separate `import * as ns from "m";` declaration is inserted; the existing
  `{ a }` declaration is untouched; no `InvalidOperationError` escapes

#### Scenario REQ-TSD-14.4: error — namespace-vs-namespace different-name collision rejects (NEW, V2 — M4, Spec Decision 9)
- GIVEN a file already holding `import * as other from "m";`
- WHEN `addNamespaceImport("ns", "m")`
- THEN rejects with `dialectError`; the original `other` namespace binding is untouched — no
  silent rename occurs (ts-morph's own `setNamespaceImport`, un-guarded, would silently rename
  `other` to `ns`, QA probe-verified)

#### Scenario REQ-TSD-14.5: precedence — an identifier collision is caught BEFORE the coexistence check (NEW, V2 — M5)
- GIVEN a file already holding `import { ns } from "m";` (a NAMED import literally called `ns`)
- WHEN `addNamespaceImport("ns", "m")`
- THEN rejects with `dialectError` via the widened `assertNoCollision` predicate — it NEVER
  reaches the "does this declaration already have named imports" coexistence check that would
  otherwise open a new declaration; collision detection always runs first

#### Scenario REQ-TSD-14.6: multi-declaration — re-apply after this op's own two-declaration output (NEW, V2 — C3)
- GIVEN a file produced by REQ-TSD-14.3's own output: `import { a } from "m";\nimport * as ns
  from "m";` (two separate declarations from the same module)
- WHEN `addNamespaceImport("ns", "m")` re-applies
- THEN zero directives are emitted — the walk correctly identifies the SECOND declaration as the
  existing namespace binding and does not open a third declaration

#### Scenario REQ-TSD-14.7: alternate — merges into an existing default-only declaration (NEW, V2 — M4c, Spec Decision 6, flagged non-probe-verified)
- GIVEN a file already holding `import Def from "m";` (default only, no named, no namespace)
- WHEN `addNamespaceImport("ns", "m")`
- THEN the SAME declaration becomes `import Def, * as ns from "m";` — no second declaration is
  opened (Spec Decision 6; `sdd-design`/`sdd-apply` MUST probe-verify this exact ts-morph
  behaviour before implementation)

### REQ-TSD-15: `addTypeImport(name, from)`

ALWAYS emits a separate `import type { name } from "from";` declaration when it emits at all
(Spec Decision from ruling b) — never merges into an existing value-import declaration, never
emits the inline `{ type X }` form. Idempotency recognizes an ALREADY-satisfied type-only binding
for name+module in EITHER surface form, INCLUDING a mixed inline clause (`import { a, type X }
from "m"`, M6). Is ALSO a NO-OP when a same-name VALUE import of the same module exists (ruling
e, V2) — a value import already provides the type meaning being requested.

#### Scenario REQ-TSD-15.1: happy — clean insert
- GIVEN a file with no type-only binding for `X`/`"m"` in any recognized form
- WHEN `addTypeImport("X", "m")`
- THEN a NEW `import type { X } from "m";` is inserted

#### Scenario REQ-TSD-15.2: alternate — idempotent against the SEPARATE-statement form
- GIVEN a file already holding `import type { X } from "m";` (this op's own prior output)
- WHEN `addTypeImport("X", "m")` re-applies
- THEN zero directives are emitted

#### Scenario REQ-TSD-15.3: alternate — idempotent against the INLINE form (BA council finding)
- GIVEN a file already holding `import { type X } from "m";` (a valid, common hand-authored form
  this op never produces but MUST recognize)
- WHEN `addTypeImport("X", "m")`
- THEN zero directives are emitted — recognition spans both surface forms

#### Scenario REQ-TSD-15.4: alternate — a same-name VALUE import satisfies identity as a NO-OP (REPLACED, V2 — ruling e, C1)
- GIVEN a file already holding `import { X } from "m";` (a VALUE import, not type-only)
- WHEN `addTypeImport("X", "m")`
- THEN ZERO directives are emitted — the value import already provides the type meaning; this
  REPLACES V1's scenario, which pinned emission of a separate `import type { X } from "m";`
  alongside the value import. QA's ts-morph@28 probe confirmed the V1 pin produced TS2300
  ("Duplicate identifier") when both statements coexist — ruling (e) resolves this by making the
  op a no-op against an existing value import, closing the gap rather than working around it

#### Scenario REQ-TSD-15.5: alternate — a mixed inline clause satisfies identity (NEW, V2 — M6)
- GIVEN a file already holding `import { a, type X } from "m";` (a mixed clause — `a` is a value
  specifier, `X` is an inline type-only specifier on the SAME declaration)
- WHEN `addTypeImport("X", "m")`
- THEN zero directives are emitted — recognition inspects EACH specifier's own `isTypeOnly()`
  independently of its siblings on the same clause

#### Scenario REQ-TSD-15.6: multi-declaration — the match may be on a NON-FIRST declaration (NEW, V2 — C3)
- GIVEN a file holding TWO separate declarations from the same module: `import { a } from
  "m";\nimport type { X } from "m";` (the type-only match is on the SECOND declaration)
- WHEN `addTypeImport("X", "m")`
- THEN zero directives are emitted — the walk inspects every declaration for module `"m"`, not
  only the first

### REQ-TSD-16: `addSideEffectImport(from)`

Inserts `import "from";`. Idempotent on the module (module-only identity). Never merges with or
replaces a named/default/namespace import declaration from the same module — a side-effect
import is its own declaration.

#### Scenario REQ-TSD-16.1: happy — clean insert
- GIVEN a file with no `import "m";`
- WHEN `addSideEffectImport("m")`
- THEN `import "m";` is inserted

#### Scenario REQ-TSD-16.2: alternate — idempotent re-apply
- GIVEN a file already holding `import "m";`
- WHEN `addSideEffectImport("m")` re-applies
- THEN zero directives are emitted

#### Scenario REQ-TSD-16.3: independent — coexists with a named import from the same module
- GIVEN a file already holding `import { a } from "m";`
- WHEN `addSideEffectImport("m")`
- THEN `import "m";` is inserted as its OWN declaration; the named-import declaration is untouched

#### Scenario REQ-TSD-16.4: multi-declaration — re-apply correctly identifies the side-effect declaration among siblings (NEW, V2 — C3)
- GIVEN a file holding BOTH `import { a } from "m";` AND `import "m";` (two separate declarations
  from the same module, the second being this op's own prior output)
- WHEN `addSideEffectImport("m")` re-applies
- THEN zero directives are emitted — the module-only identity walk correctly distinguishes the
  side-effect declaration from the sibling named-import declaration and does not duplicate it

### REQ-TSD-17: `addReExport(name, from)`

Inserts `export { name } from "from";`, mirroring `addImport`'s merge shape on the export side:
merges into an existing same-module named-export clause when present, otherwise inserts fresh.
REJECTS when the requested name is already exported under the SAME name from a DIFFERENT module
(Spec Decision 10, V2 — duplicate exported name is invalid TS). Merge-target selection SKIPS a
whole-declaration type-only export clause (`export type { … } from "m"`, Spec Decision 10, V2,
mirrors REQ-TSD-01.6's import-side fix). Aliased export specifiers are matched by SOURCE name
only (ruling h) — the visible-alias side is a documented non-match.

#### Scenario REQ-TSD-17.1: happy — clean insert
- GIVEN a file with no export from `"./x"`
- WHEN `addReExport("X", "./x")`
- THEN `export { X } from "./x";` is inserted

#### Scenario REQ-TSD-17.2: alternate — idempotent re-apply
- GIVEN a file already holding `export { X } from "./x";`
- WHEN `addReExport("X", "./x")` re-applies
- THEN zero directives are emitted

#### Scenario REQ-TSD-17.3: alternate — merges into an existing named-export clause
- GIVEN a file already holding `export { Y } from "./x";`
- WHEN `addReExport("X", "./x")`
- THEN the SAME clause becomes `export { Y, X } from "./x";` — no second declaration

#### Scenario REQ-TSD-17.4: error — duplicate exported name from a different module rejects (NEW, V2 — M7a)
- GIVEN a file already holding `export { X } from "./other";`
- WHEN `addReExport("X", "./x")` (a DIFFERENT module)
- THEN rejects with `dialectError`; the existing export from `"./other"` is untouched — TypeScript
  forbids two exported bindings sharing the name `X`

#### Scenario REQ-TSD-17.5: alternate — a whole-declaration type-only export clause is never a merge target (NEW, V2 — M7b, Spec Decision 10)
- GIVEN a file already holding `export type { Y } from "m";` (whole-declaration type-only export)
- WHEN `addReExport("X", "m")`
- THEN a NEW separate `export { X } from "m";` value declaration is inserted; the existing
  `export type { Y } from "m";` is untouched — mirrors REQ-TSD-01.6's import-side fix

#### Scenario REQ-TSD-17.6: alternate — identity is matched by SOURCE name, not the visible alias (NEW, V2 — M8, ruling h)
- GIVEN a file already holding `export { X as Y } from "m";` (`X` is the source name, `Y` the
  visible alias)
- WHEN `addReExport("X", "m")`
- THEN zero directives are emitted — source-name match, no-op
- AND a separate call `addReExport("Y", "m")` does NOT match this existing specifier — `Y` is
  treated as an unseen name and merged/inserted as its OWN specifier (the visible-alias side is a
  documented non-match, ruling h)

### REQ-TSD-18: `addExportAll(from)`

Inserts `export * from "from";`. Idempotent on the module (module-only identity, no collision
surface). Covers ONLY the bare `export *` form — `export * as ns from 'm'` is explicitly deferred
(Spec Decision d, pending followup).

#### Scenario REQ-TSD-18.1: happy — clean insert
- GIVEN a file with no `export * from "m";`
- WHEN `addExportAll("m")`
- THEN `export * from "m";` is inserted

#### Scenario REQ-TSD-18.2: alternate — idempotent re-apply
- GIVEN a file already holding `export * from "m";`
- WHEN `addExportAll("m")` re-applies
- THEN zero directives are emitted

#### Scenario REQ-TSD-18.3: boundary — the `as ns` form is never produced (REWORDED, V2 — m7)
- GIVEN a call `addExportAll("m")` against an empty seeded file
- WHEN the result is printed
- THEN the emitted text is BYTE-EXACT `export * from "m";\n` — no `as` clause appears anywhere
  in the printed output (the golden fixture is the source of truth; this is a concrete
  text-level assertion against one call, not a universal AST-internal `namespaceExport`
  inspection claim)

### REQ-TSD-19: `removeExport(name, from)`

Removes the named re-export binding matching name+module (mirror of `removeImport`, Spec
Decision 4). Scope is named re-exports ONLY (`export { x } from 'm'`) — local `export { x }`
(no `from` clause) and `export * from` are OUT of scope for removal (decision c's accepted
add/remove asymmetry: 4 new add-forms ship with no remove counterpart beyond this one). Aliased
export specifiers are matched by SOURCE name only (ruling h, mirrors `removeImport`).

#### Scenario REQ-TSD-19.1: happy — sole specifier, whole statement deleted
- GIVEN a file holding `export { X } from "m";` as the ONLY named export in that clause
- WHEN `removeExport("X", "m")`
- THEN the entire export statement is deleted — no dangling `export {} from "m"`

#### Scenario REQ-TSD-19.2: alternate — one of several specifiers, statement survives
- GIVEN a file holding `export { X, Y } from "m";`
- WHEN `removeExport("X", "m")`
- THEN the clause becomes `export { Y } from "m";` — the statement is not deleted

#### Scenario REQ-TSD-19.3: no-op — absent target
- GIVEN a file with no `X` re-export from `"m"`
- WHEN `removeExport("X", "m")`
- THEN nothing is thrown and nothing is changed (mirrors `removeImport`'s absent-binding no-op)

#### Scenario REQ-TSD-19.4: scope boundary — local re-exports and `export *` FROM A DIFFERENT MODULE are untouched
- GIVEN a file holding `export { X };` (local, no `from`) and `export * from "n";`
- WHEN `removeExport("X", "m")` (a non-matching module)
- THEN neither statement is affected — `removeExport` never inspects local re-exports or
  `export *` clauses

#### Scenario REQ-TSD-19.5: scope boundary — a matching-module `export *` is ALSO untouched (NEW, V2 — m9)
- GIVEN a file holding `export { X } from "m";` AND `export * from "m";` (the SAME module,
  unlike .4's non-matching-module probe)
- WHEN `removeExport("X", "m")`
- THEN the named export statement is removed as usual; `export * from "m";` is untouched —
  scope exclusion holds even when the module matches, not only when it doesn't

#### Scenario REQ-TSD-19.6: multi-declaration — walks multiple export statements, removing only the match (NEW, V2 — C3)
- GIVEN a file holding TWO SEPARATE export declarations from the same module: `export { a } from
  "m";\nexport { X } from "m";`
- WHEN `removeExport("X", "m")`
- THEN the SECOND statement (X's sole clause) is deleted wholly; the FIRST (`export { a } from
  "m";`) is untouched — the walk inspects every declaration for module `"m"`, not only the first

#### Scenario REQ-TSD-19.7: alternate — identity is matched by SOURCE name, not the visible alias (NEW, V2 — M8, ruling h)
- GIVEN a file holding `export { X as Y } from "m";`
- WHEN `removeExport("X", "m")` (source name)
- THEN the specifier is removed (whole statement, since it is the sole specifier)
- AND a separate call `removeExport("Y", "m")` against the same starting state is a NO-OP — the
  visible-alias side does not match (ruling h, mirrors `removeImport`'s own matched-by-exported-
  name behaviour)

### REQ-TSD-20: `assertNoCollision` widening (retroactive behaviour change)

The shared `assertNoCollision` predicate (`ops.ts`) widens to ALSO inspect
`getDefaultImport()`/`getNamespaceImport()` identifiers, in addition to its existing checks
(function/variable/class/enum/module/named-import bindings). The SAME widened predicate is used
by `addFunction`/`addVariable`/`addClass` (existing, Spec Decision 3) AND by
`addDefaultImport`/`addNamespaceImport` (new) — one predicate, symmetric guarantee. This IS a
behaviour change on the 3 existing ops, accepted for 0.x and stated explicitly here (not silently
shipped): a `name` that collides ONLY with a default/namespace import binding was previously
ACCEPTED by `addFunction`/`addVariable`/`addClass` and is now REJECTED.

#### Scenario REQ-TSD-20.1: retroactive — addFunction now rejects a default-import collision it previously accepted
- GIVEN a file holding `import X from "m";` (a default import)
- WHEN `addFunction("X", "(): void {}")` (previously: succeeded, silently occupying a name
  already bound in the value namespace)
- THEN it now rejects with `dialectError` — the SAME rule `addVariable`/`addClass` follow

#### Scenario REQ-TSD-20.2: new-op protection — addDefaultImport rejects a function-name collision
- GIVEN a file holding `function X(): void {}`
- WHEN `addDefaultImport("X", "m")`
- THEN rejects with `dialectError` — the new ops carry the SAME guarantee as their siblings

#### Scenario REQ-TSD-20.3: exemption preserved — type/interface never collide
- GIVEN a file holding `interface X {}`
- WHEN `addDefaultImport("X", "m")` or `addFunction("X", "(): void {}")`
- THEN neither rejects — `type`/`interface` remain exempt (legal TS coexistence, unchanged from
  the pre-widening rule)

#### Scenario REQ-TSD-20.4: retroactive — addFunction rejects a NAMESPACE-import collision (anchor, NEW, V2 — C4)
- GIVEN a file holding `import * as ns from "m";` (a namespace import)
- WHEN `addFunction("ns", "(): void {}")`
- THEN it rejects with `dialectError` — the namespace half of the widened predicate, previously
  untested (C4: a mutant that widened only `getDefaultImport()` passed the full V1 suite); see
  the Collision Widening Verification Table below for the full cross-product

**Collision Widening Verification Table (C4/M4, table-driven per the scenario-budget rule)** —
the widened `assertNoCollision` predicate applied across all 5 collision-gated ops × both new
binding kinds:

| Op | Existing binding | Same name as call? | Outcome |
|---|---|---|---|
| `addFunction` | default import | — | reject (.1) |
| `addFunction` | namespace import | — | reject (.4, anchor) |
| `addVariable` | default import | — | reject |
| `addVariable` | namespace import | — | reject |
| `addClass` | default import | — | reject |
| `addClass` | namespace import | — | reject |
| `addDefaultImport` | function/var/class declaration | — | reject (.2) |
| `addDefaultImport` | namespace import (any name) | — | reject |
| `addDefaultImport` | default import | same | no-op (REQ-TSD-13.2) |
| `addDefaultImport` | default import | different | reject (REQ-TSD-13.3) |
| `addNamespaceImport` | function/var/class declaration | — | reject |
| `addNamespaceImport` | default import (any name) | — | merge (REQ-TSD-14.7 — NOT a collision; default+namespace coexist legally) |
| `addNamespaceImport` | namespace import | same | no-op (REQ-TSD-14.2) |
| `addNamespaceImport` | namespace import | different | reject (REQ-TSD-14.4) |

## ADDED Requirements — continued

### REQ-TSD-21: `addVariable`'s `kind` option gets runtime validation (NEW, V2 — ruling f, M3)

`addVariable`'s `options.kind` parameter (existing op, frozen call signature) is validated at
runtime against the EXACT allow-list `"const" | "let" | "var"` before any AST mutation,
REJECTING with the same branded `dialectError` used elsewhere in the op-pack when the value is
absent from the allow-list. Closes the sibling raw-splice gap (`ops.ts:114`, security finding)
alongside REQ-TIV-01's name-position hardening — this REQ covers a DIFFERENT parameter position
(`kind`, not `name`), so it lives in `typescript-dialect` rather than
`typescript-identifier-validation`.

(Retroactive: `kind` was previously spliced into the generated `{kind} {name} = {initializer};`
statement with no validation — a caller passing anything other than the three legal TS keywords
would silently emit invalid or attacker-controlled TypeScript. Accepted for 0.x, same
compatibility posture as REQ-TIV-02.)

#### Scenario REQ-TSD-21.1: happy — all three legal kinds accepted
- GIVEN `addVariable("x", "1", { kind: "let" })`
- WHEN invoked
- THEN `let x = 1;` is inserted; the same holds for `"const"` and `"var"`

#### Scenario REQ-TSD-21.2: reject — value outside the allow-list
- GIVEN `addVariable("x", "1", { kind: "function () {}; //" })`
- WHEN invoked
- THEN it rejects with `dialectError` before any AST mutation; zero directives are emitted

#### Scenario REQ-TSD-21.3: default unaffected
- GIVEN `addVariable("x", "1")` (no `kind` supplied)
- WHEN invoked
- THEN `kind` defaults to `"const"`, unchanged from existing behaviour — this REQ tightens
  validation, not the default

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — op-pack widening on `src/dialects/typescript/**` | REQ-TSD-01, REQ-TSD-13 through REQ-TSD-21 | Yes |
