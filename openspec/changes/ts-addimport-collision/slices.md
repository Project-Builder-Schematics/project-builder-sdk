# Slices: TS-dialect `addImport` collision + injection fix

**Triage**: L
**Spec version**: V3.1 signed
**Design**: rev V2 (council-applied)
**Total slices**: 6 (1 walking skeleton + 5 SPIDR)

**Fitness-number drift note**: design names the new parity guard "FIT-39" — that number is now
TAKEN on `main` (`fit-39-single-encode-site.test.ts`, `fit-40-conformance-corpus-integrity.*`
landed from other changes since design). Renumbered to **FIT-41** throughout (next free slot).
No other drift: `ops.ts`/`assertNoCollision`/`jsx-name-validator.ts` line ranges and shapes match
design's assumptions exactly against current `main` — no `architectural-conflict`.

---

## Pre-satisfied scenarios (verify-only — no new code)

Three signed scenarios are already satisfied on `main`, by an earlier change
(`author-write-surface`/`foundations-skeleton`'s repo-wide `.raw(` sweep), not by this change's
own work. They belong to no SPIDR slice — they are wired into **S-000.6** as confirm-stay-green
checks; this change must not regress them.

| REQ-ID | Status | Evidence |
|---|---|---|
| REQ-TSD-01.1 | Pre-satisfied | `test/dialects/typescript/ops-exact-set.test.ts` — exact op-set `toEqual` assertion exists; op-set membership is unchanged by this port |
| REQ-TSD-01.3 | Pre-satisfied | Collision-hint wording already reads `.modify()`, not `.raw()` — confirmed `rg '\.raw\('` over `src/dialects/typescript/` = zero hits; `fit-raw-sweep.test.ts` sweeps repo-wide and stays green |
| REQ-TSD-01.4 | Pre-satisfied | Module-level JSDoc (`typescript/index.ts`) already reads `.modify()` — same zero-hit sweep covers it |

## Executor context

Read before building any slice:
- **Spec**: `openspec/changes/ts-addimport-collision/specs/typescript-dialect/spec.md` — full
  REQ-TSD-01/03/13 bodies, all 50 scenario Given/When/Then blocks, Sign-Off Block (4 ratifications)
- **Design**: `openspec/changes/ts-addimport-collision/design.md` — §4.3 (data model/algorithm
  helpers), §4.4 (interface contract, two reject shapes), §4.8 (migration/rollout,
  pending-changes registration), ADR-01 (mirror + FIT-41 parity), ADR-02 (inline validation,
  ARCH-2 debt), ADR-03 (shebang fallback)
- **North star**: `openspec/changes/ts-addimport-collision/north-star.md` — the outcome bar
  reckoning will hold this against

**Algorithm digest** (design §4.3 / spec REQ-TSD-01, applied IN THIS ORDER — spec-level invariant):
1. Already-bound (idempotency, SAME module only): a value-bound default/namespace/unaliased-named
   or SELF-ALIASED-named specifier with matching local name → no-op. Self-alias (`{X as X}`) is a
   DELIBERATE deviation from React's V8 (owner-ratified).
2. Collision (file-wide): `name` CLAIMED anywhere — any import specifier's local name (value-bound
   or type-only) OR a top-level value-namespace declaration (`isValueNamespaceClaimed`) → reject,
   `dialectError`, BEFORE any AST mutation.
3. Merge: the FIRST declaration (source order) with a non-type-only named-import clause for `from`
   → add an unaliased named specifier.
4. Create: otherwise, insert a fresh, separate `import { name } from "from";` (directive-prologue-
   aware once S-003 lands).

S-000 builds Steps 1/3/4 only — Step 2 is DEFERRED to S-001 by design. S-000's interim `addImport`
has no collision reject until S-001 lands; that is an acceptable mid-change state, not a
shippable increment on its own.

**Reject-message shapes** (spec REQ-TSD-13, design §4.4 — TWO deliberate shapes, never unified):
- **Validation reject** (S-002): `assertValidImportBinding` (`src/core/jsx-name-validator.ts`),
  reused verbatim, PATH-LESS. Zero echo for grammar failures; ≤16-char bounded echo for
  reserved-word/denylist failures (`boundedFragment`, `src/core/reject-tail.ts`).
- **Collision reject** (S-001): TS house-style, `dialectError` (`src/core/dialect-error.ts`) built
  INLINE in `ops.ts`, carries the `on "{handlePathFor(ast)}"` clause (`src/core/dialect-handle.ts`)
  plus an "already exists"/"already bound" distinguishing substring. Full name echoed
  (post-validation, safe — REQ-TSD-01.32).
- Negative pin (S-002.4): a validation reject NEVER contains the path clause.

**Source-material pointers**:
- `src/dialects/react/ops.ts:81-234` — port source for `boundNamesIn`/`satisfiesIdempotency`/
  `isNonTypeOnlyNamedImportClause` (verbatim)
- `src/dialects/typescript/ops.ts:54-75` — existing `assertNoCollision`, host of the extracted
  `isValueNamespaceClaimed`
- `src/core/dialect-handle.ts:248-258` — `#invokeContained`, the containment boundary the shebang
  case (S-004) relies on
- Printer determinism — per-dialect `ast.ts` frozen `ManipulationSettings` + BOM `WeakMap`
  (unmodified by this change; goldens depend on this staying stable)

**Behaviour-change classes** (spec's behaviour-change note, feeds S-005's CHANGELOG):
- Class A (5 fixes, silently-broken → loud/correct): type-only merge; cross-module + value-
  namespace collisions; aliased-to-different-name collisions; same-local-name idempotency vs
  default/namespace/mixed; directive-prologue placement.
- Class B (1 member, correct → differently-correct): side-effect import preserved + separate
  named decl (`.20`), `.modify()` escape available.
- Neither class: shebang (`.33`) — its own bucket, outcome conditional on which ADR-03 arm ships
  (this change ships the fallback — see Owner-settled note below).

## Repo conventions

- Test runner: `bun test`
- Goldens: committed fixture files under `test/dialects/typescript/golden/*.txt`, referenced by
  name from the test file, asserted `toBe` (byte-exact)
- Fitness naming: `test/fitness/fit-NN-*.test.ts`; **FIT-41 confirmed next free** (39/40 taken by
  unrelated changes since design)
- Dialect imports in tests: in-repo workspace subpath entrypoints (`@pbuilder/sdk/typescript`,
  `@pbuilder/sdk/react`), matching how an installed consumer resolves them;
  `installed-consumer.e2e.test.ts` is the installed-parity check, untouched by this change

## Owner-settled product decisions (cited, not reopened)

1. **Siblings stay raw-spliced this change** — `addFunction`/`addVariable`/`addClass`'s
   `name`/`source`/`initializer` remain unvalidated. Ratified at spec V3.1 sign-off: REQ-TSD-13.5
   mandates the affirmative "still-raw" JSDoc characterization (S-002.2/.5); closure is tracked
   separately in `project/pending-changes`, out of this change's scope.
2. **Shebang ships fail-closed, permanently for this release** — ADR-03's pre-authorized fallback
   arm (spec `.33`) ships: containment pinned (S-004.2), insertion upgrade deferred as a followup
   (S-004.4). Reconfirmed by the steward foresight conscience answer, 2026-07-21: "Aceptable,
   fail-closed."

---

## S-000: Walking Skeleton — port the happy-path algorithm (no-op / merge / create)

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-TSD-01.2, .5, .10, .11, .12, .13, .19, .31; regression: REQ-TSD-03.10
**Requires**: nothing
**Test layers**: unit + integration + e2e (smoke)

**Acceptance**: GIVEN an existing named-import clause for `from`, WHEN `addImport(name, from)`
runs through the public handle, THEN the printed output is a byte-exact merge — proving the
V8 algorithm's Steps 1/3/4 thread through the dialect leaf and the coalescing controller.

### Tasks
- [x] S-000.1 Port `boundNamesIn`/`satisfiesIdempotency`/`isNonTypeOnlyNamedImportClause` from `react/ops.ts` into `typescript/ops.ts` (design §4.3)
- [x] S-000.2 Replace naive `addImport` body with idempotency-check → merge → create (Steps 1/3/4 only; Step 2 collision deferred to S-001)
- [x] S-000.3 Create `test/dialects/typescript/ops-addImport.test.ts`: merge (.5), idempotency no-op (.10/.11/.12/.13/.31), fresh create (.19)
- [x] S-000.4 Add golden fixtures for the merge/create shapes (.2/.19 byte-exact pattern)
- [x] S-000.5 Extend `dialect-modify.e2e.test.ts` with one merge-through-public-handle case (Flow 1)
- [x] S-000.6 Confirm REQ-TSD-01.2 and REQ-TSD-03.10 stay green under the new implementation; confirm the three PRE-SATISFIED scenarios stay green (verify-only, no new code) — REQ-TSD-01.1 (`ops-exact-set.test.ts`), .3/.4 (`.raw()`→`.modify()` already migrated, zero `rg '\.raw\('` hits under `src/dialects/typescript/`, `fit-raw-sweep` green)

---

## S-001: Loud collision reject — the failure path vs S-000's happy path

**Scope**: happy-path
**Dimension**: P (Path)
**Covers**: REQ-TSD-01.6, .8, .14, .16, .17, .24, .26, .27, .28, .32
**Requires**: S-000
**Test layers**: unit + integration

**Acceptance**: GIVEN `name` is CLAIMED anywhere in the file (import specifier or value-namespace
declaration), WHEN `addImport` runs, THEN it REJECTS synchronously before any AST mutation with a
path-carrying `dialectError`, zero directives, byte-unchanged.

### Tasks
- [ ] S-001.1 Extract `isValueNamespaceClaimed` from `assertNoCollision`; wire it into BOTH `assertNoCollision` and `addImport`'s new Step 2 (ADR-01)
- [ ] S-001.2 Add file-wide claimed-scan (import specifiers + value-namespace) as Step 2, AFTER Step 1; inline `dialectError` with path clause + distinguishing "already exists"/"already bound" substring
- [ ] S-001.3 Cover .6/.8/.26/.27 (type-only reject: named/inline/default/namespace), .14/.28 (aliased reject + GREEN local-name-keying pair), .16 (cross-module), .17 (8-kind value-namespace battery), .32 (full 29-char echo, uncut)
- [ ] S-001.4 Add REQ-TSD-01.24 ordering/mutant-kill test (idempotency BEFORE claimed) to `dialect.test.ts`
- [ ] S-001.5 Confirm `ops-declarations.test.ts` (addFunction/addVariable/addClass collision suite) stays green post-extraction (behaviour-preservation guard)

---

## S-002: Injection-safety validation gate (REQ-TSD-13)

**Scope**: happy-path
**Dimension**: R (Rule)
**Covers**: REQ-TSD-13.1, .2, .3, .4, .5, .6; design's 13.x-neg
**Requires**: S-001
**Test layers**: unit + integration

**Acceptance**: GIVEN a hostile or grammatically-invalid `name`, WHEN `addImport` runs, THEN it
REJECTS via `assertValidImportBinding` BEFORE Step 1/2 ever evaluate — zero directives, zero echo
for grammar failures, ≤16-char echo for reserved/denylist failures.

### Tasks
- [ ] S-002.1 Import `assertValidImportBinding` from `jsx-name-validator.ts`; call INLINE as `addImport`'s first statement (ADR-02, not `validatedOp`)
- [ ] S-002.2 Rewrite `addImport`'s JSDoc: full 4-branch behaviour + REQ-TSD-13.5 trust-boundary note affirmatively naming `addFunction`/`addVariable`/`addClass` as still raw-spliced
- [ ] S-002.3 Cover 13.1 (confirmed injection, zero echo), 13.2 (reserved-word + denylist battery + substring negatives), 13.3 (grammar battery), 13.4 (`from`-escaping regression), 13.6 (precedence vs collision)
- [ ] S-002.4 Add negative test: a validation-reject message NEVER contains the `on "{path}"` clause (13.x-neg, F12, kills the consistency-fix mutant)
- [ ] S-002.5 Guard-test 13.5's JSDoc trust-boundary assertion (scan, fails RED if weakened to passive disclaimer)

---

## S-003: Input-shape variants — merge/create branch edge data

**Scope**: edge-case
**Dimension**: D (Data)
**Covers**: REQ-TSD-01.7, .9, .15, .18, .20, .21, .22, .23, .29, .30
**Requires**: S-000
**Test layers**: unit + integration

**Acceptance**: GIVEN one of the ten pinned import-shape variants (type-only+diff-name, aliased
type-only, `type`/`interface` exemption, self-alias, side-effect import, directive prologue,
multi-declaration, empty clause, mixed default+named), WHEN `addImport` runs, THEN the outcome
matches its dedicated scenario exactly, byte-exact where applicable.

### Tasks
- [ ] S-003.1 Cover create-branch variants: .7/.9 (type-only+diff-name / aliased-type-only → create), .18 (`type`/`interface` exempt → create)
- [ ] S-003.2 Cover merge-branch variants: .22 (multi-decl → merge FIRST, scan ALL), .23 (empty `{}` clause is a valid target), .29/.30 (mixed default+named: merge to named / default-name no-op)
- [ ] S-003.3 Cover .20 (side-effect import preserved byte-unchanged + separate named decl, Class B) and .15 (self-alias `{X as X}` idempotent no-op, owner deviation)
- [ ] S-003.4 Implement directive-prologue-aware Create (`leadingDirectiveCount`; `insertImportDeclaration` after the prologue vs `addImportDeclaration`) for .21
- [ ] S-003.5 Add goldens: directive-prologue (.21) + CRLF+addImport (.8, QA strengthening note b)

---

## S-004: Explicit contract postures — asymmetry, shebang fallback, idempotency durability

**Scope**: edge-case
**Dimension**: R (Rule)
**Covers**: REQ-TSD-01.25, .33; REQ-TSD-03.11
**Requires**: S-003
**Test layers**: unit + integration

**Acceptance**: GIVEN a shebang file, WHEN `addImport` runs, THEN it stays a CONTAINED fail-closed
reject (ADR-03 fallback — `.cause` undefined, zero directives, byte-unchanged) — pinned as a
regression guard, not upgraded to insertion this change.

### Tasks
- [ ] S-004.1 Add REQ-TSD-01.25 asymmetry test: `addImport` merges FIRST-match only, `removeImport` removes ALL matches — pin as an explicit contract fact
- [ ] S-004.2 Pin ADR-03's fallback: assert shebang stays a handle-level contained fail-closed reject (`.cause` undefined, zero directives, byte-unchanged) — REQ-TSD-01.33
- [ ] S-004.3 Add REQ-TSD-03.11 seed-with-own-output test to `dialect.test.ts`: a FRESH run seeded with `addImport`'s own prior output emits ZERO directives
- [ ] S-004.4 Register the shebang-insertion upgrade as a `project/pending-changes` followup (ADR-03, design §4.8) — deferred, no code this slice

---

## S-005: Cross-dialect parity guarantee + release documentation

**Scope**: happy-path
**Dimension**: R (Rule)
**Covers**: design's "parity" fitness row (cross-references REQ-TSD-01.5–.33); "01/13 (repr.)" e2e row
**Requires**: S-002, S-004
**Test layers**: architectural (fitness) + e2e + docs

**Acceptance**: GIVEN the shared `(seed, name, from) → verdict` battery, WHEN run through BOTH
`@pbuilder/sdk/typescript` and `@pbuilder/sdk/react` `addImport`, THEN verdicts agree on every row
except the self-alias row, which asserts the KNOWN divergence explicitly (never excluded).

### Tasks
- [ ] S-005.1 Create `test/fitness/fit-41-addimport-parity.test.ts` (renumbered — see drift note above): shared battery across merge/idempotency/create/type-only-collision/cross-module-collision buckets; self-alias as a positive expected-divergence assertion (ADR-01 N1)
- [ ] S-005.2 Complete `dialect-modify.e2e.test.ts` with the collision-reject case through the public handle (Flow 1, closes the "shape-safe merge + collision reject" pair)
- [ ] S-005.3 Create `CHANGELOG.md`: Class A five-member list, Class B (.20) with its `.modify()` escape note, shebang entry CONDITIONAL on ADR-03's fallback (none shipped — followup noted instead)
- [ ] S-005.4 Confirm `installed-consumer.e2e.test.ts` op-set membership/signature parity is unaffected (proposal success criterion #6)

---

## Build Order

| Order | Slice | Requires | Parallelizable with |
|---|---|---|---|
| 1 | S-000 (skeleton) | — | — |
| 2 | S-001 (collision path) | S-000 | S-003 |
| 2 | S-003 (data variants) | S-000 | S-001 |
| 3 | S-002 (validation rule) | S-001 | S-004 |
| 3 | S-004 (posture pins) | S-003 | S-002 |
| 4 | S-005 (parity + docs) | S-002, S-004 | — |

## SPIDR Dimensions Used

| Dimension | Count | Slices |
|---|---|---|
| Path | 1 | S-001 |
| Rule | 3 | S-002, S-004, S-005 |
| Data | 1 | S-003 |
| Interface / Spike | 0 | — |

## Anti-Pattern Check

✅ Pass — no horizontal/layer-named slices (each cuts through `ops.ts` + its own tests +
goldens); every slice references ≥1 REQ-ID; no slice cross-cuts two SPIDR dimensions; no slice
depends on >2 others (max is S-005 with 2); 5 SPIDR slices for an L change is within the 3–7
target band.
