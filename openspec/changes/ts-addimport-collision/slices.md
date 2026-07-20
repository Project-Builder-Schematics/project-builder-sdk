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
- [ ] S-000.1 Port `boundNamesIn`/`satisfiesIdempotency`/`isNonTypeOnlyNamedImportClause` from `react/ops.ts` into `typescript/ops.ts` (design §4.3)
- [ ] S-000.2 Replace naive `addImport` body with idempotency-check → merge → create (Steps 1/3/4 only; Step 2 collision deferred to S-001)
- [ ] S-000.3 Create `test/dialects/typescript/ops-addImport.test.ts`: merge (.5), idempotency no-op (.10/.11/.12/.13/.31), fresh create (.19)
- [ ] S-000.4 Add golden fixtures for the merge/create shapes (.2/.19 byte-exact pattern)
- [ ] S-000.5 Extend `dialect-modify.e2e.test.ts` with one merge-through-public-handle case (Flow 1)
- [ ] S-000.6 Confirm REQ-TSD-01.2 and REQ-TSD-03.10 stay green under the new implementation

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
