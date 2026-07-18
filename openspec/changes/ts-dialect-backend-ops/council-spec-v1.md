# Council Review — Spec V1 (ts-dialect-backend-ops)

Reviewed 2026-07-18 by three blind personas (BA, security, QA). Verdicts: BA `approve-with-notes`,
security `request-changes`, QA `request-changes` → V2 required. Owner rulings (e)-(h) issued the
same day resolve every owner-level question raised here (see state.yaml `ratified_decisions`).

QA findings 1-2 and 5(b) are backed by EXECUTED probes against installed ts-morph@28, not reasoning.

## Owner rulings issued from this round (binding on V2)

- **(e) — amends ruling (b)'s consequence**: when a same-name VALUE import of the same module
  already exists, `addTypeImport` is a **NO-OP** (a value import already provides the type
  meaning; the need is satisfied). Ruling (b) itself stands: when the op DOES emit, it is always
  a separate `import type { X } from 'm'` statement. Recognition rule therefore covers: separate
  type statement, inline `{ type X }` specifier (incl. mixed clauses), AND same-name value import.
- **(f)**: `addVariable.kind` gets **runtime validation** against the exact `const|let|var`
  allow-list, rejecting with the same branded dialectError. The "all 12 ops" purpose claim
  becomes true.
- **(g)**: TIV grammar is **ASCII-only** `^[A-Za-z_$][A-Za-z0-9_$]*$` PLUS explicit rejection of
  ES reserved words PLUS explicit rejection of `\u`/`\u{}` escapes and non-ASCII identifiers.
  Unicode identifier support registered as pending followup.
- **(h)**: aliased export specifiers match by **SOURCE name** (exact mirror of
  `removeImport`/`getName()`); the visible-alias side is a documented non-match. Applies to
  `removeExport` targeting and `addReExport` idempotency identity.

## CRITICAL findings

| # | From | REQ | Finding | Fix direction |
|---|---|---|---|---|
| C1 | QA (probe-verified) | TSD-15.4 | Scenario pins emission of invalid TS: value `import { X }` + separate `import type { X }` = TS2300 ×2 | Re-rule per ruling (e): no-op scenario replaces 15.4; update identity-table row |
| C2 | QA (probe-verified) | TSD-15 / frozen TSD-01 | `addTypeImport("X","m")` then `addImport("y","m")` → frozen merge produces `import type { X, y }` — `y` silently type-only | New retroactive clause: `addImport` merge-target selection MUST skip whole-declaration type-only imports; scenario: given `import type { X } from "m"`, `addImport("y","m")` inserts separate value decl. Audit `addReExport` vs `export type` clauses same way (M7b) |
| C3 | QA | TSD-14/15/16/17/19 | No scenario forces the multi-declaration walk — every idempotency GIVEN is single-decl; first-match mutant survives entire suite (removeImport's own judgment-day bug class) | Multi-decl seeded variants: 14.x re-apply after 14.3's own output; 15.x value+type decls; 16.x named + side-effect; 19.x two export statements, remove one wholly |
| C4 | QA | TSD-20 | Namespace half of widening untested — mutant widening only `getDefaultImport()` passes all scenarios | Add 20.4 `import * as ns` + `addFunction("ns")` → reject; prefer table-driven {default,namespace} × {5 collision-gated ops} |
| C5 | Security | TIV-01 | Grammar unpinned — accept set IS the security boundary; two implementers diverge (unicode, escapes, reserved words) | Resolved by ruling (g): pin grammar + reserved-word + escape/non-ASCII rejection in REQ text; scenarios: reserved word, `evil`, ZWNJ, empty string, leading digit |

## MAJOR findings

| # | From | REQ | Finding | Fix direction |
|---|---|---|---|---|
| M1 | Security | TIV-01 | from-position exclusion on faith — no containment pin; export-side sink and the two from-only ops (`addSideEffectImport`/`addExportAll`) have ZERO pinned evidence | Positive containment scenarios: hostile `from` payloads → byte-exact goldens, one per sink family (import decl, export decl, side-effect, export-all) |
| M2 | Security + QA | TIV-03 | Probe corpus is one shape — blocklist theatre passes | Table-driven corpus in the REQ: statement terminator, newline+CRLF, `/*`, `//`, backtick, `'`/`"`, `\u` escape, zero-width, reserved word, empty, leading digit, interior whitespace × 10 name-bearing ops |
| M3 | Security | TIV boundary | `addVariable.kind` raw splice (ops.ts:114) | Resolved by ruling (f): runtime allow-list + scenario |
| M4 | QA | TSD-13/14 | Missing collision rows: named-only + addDefaultImport (merge vs new decl?); ns-vs-ns different name (probe: setNamespaceImport silently RENAMES — Decision-1 hazard; recommend REJECT, symmetric with Decision 1); default + addNamespaceImport | Three rows + one scenario each |
| M5 | QA | TSD-14.3/20 | Non-disjoint rows, precedence unpinned: `import { ns }` + `addNamespaceImport("ns")` matches both new-decl and reject rows | Precedence sentence: identity check (no-op) → collision check → coexistence strategy. Scenario: that case REJECTS |
| M6 | BA + QA | TSD-15 | Mixed inline clause `import { a, type X }` recognition unspecified; aliased type import identity unpinned | Mixed-clause no-op scenario; aliased matched by source name per ruling (h) |
| M7 | QA | TSD-17 | (a) addReExport when same exported name exists from ANOTHER module → duplicate exported name (invalid TS), no row; (b) type-only `export type { Y }` clause as merge target → silent type-only conversion | (a) reject fail-loud; (b) type-only export clauses never merge targets — separate value clause |
| M8 | QA | TSD-19/17 | Aliased export specifier match side ambiguous | Resolved by ruling (h): source name; scenarios for match-by-source and non-match-by-alias |
| M9 | QA | TIV-01/03 | No `__proto__`/`constructor` probe — must be ACCEPTED and pollution-free (stage-4b seed bug class) | `addImport("__proto__","m")` accepted, correct output, no pollution observable |
| M10 | BA | TSD-15 | Duplicate-binding hazard needed honest surfacing | Superseded by ruling (e) no-op — hazard no longer exists; keep a doc note that value import satisfies type need |

## MINOR findings

| # | From | REQ | Finding | Fix |
|---|---|---|---|---|
| m1 | Security | TIV-01/TSD-20 | Reject-path ordering unpinned (reject must beat idempotent no-op; collision message interpolates raw name) | Pin order validate → checks → mutate; scenario: probe on would-be-no-op state still rejects |
| m2 | Security | TIV-01 | Injection into error text (newlines/ANSI/multi-KB in echoed name) | Offending input rendered escaped (JSON.stringify) + length-capped; one scenario with `\n` + ANSI CSI |
| m3 | Security | TIV spec | Bypass routes unnamed in capability spec (.modify(fn), source/initializer code-body args, defineDialect-direct row 23) | "Boundary and residual risks" subsection cross-referencing SECURITY.md + row 23 |
| m4 | QA | Collision table | Table row says injection applies to "12 ops"; TIV-03 correctly says 10 | Fix row to 10 name-bearing ops |
| m5 | QA | TIV-02.2 | "the other three" → four | Fix count |
| m6 | QA | TSD-13/15 | Type-only default import vs addDefaultImport identity unpinned | Pin: does NOT satisfy identity; falls to Decision-1 logic |
| m7 | QA + BA | TSD-18.3 | Universal claim + AST-internal assertion | One concrete call asserted against emitted text golden |
| m8 | QA | DAS-01.4 | THEN overstates what a substring guard verifies | Reword THEN to the mechanical assertion |
| m9 | QA | TSD-19.4 | GIVEN never probes matching-module export-star untouched case | Add matching-module variant |
| m10 | BA | trace | Conformance-suite widening has no anchoring scenario | Add scenario or explicit design-phase delegation note |
| m11 | QA | TSD-03.10 precedent | Same-handle chain double-call covered only for addImport | Add for ≥1 new op (RYOW path) |

## BA trace notes (no action beyond above)

- Trace table complete; no scope smuggling. Retroactive changes (TSD-20, TIV-02) trace via
  proposal + ruling (a), not triage yaml — note for plan-verify.
- Add/remove asymmetry honesty: PASS (TSD-01.5 refuses wholesale over-claim).
- V1 baseline counts: 13 REQs / 42 scenarios (TSD 9/31, DAS 1/4, TIV 3/7). Header should carry
  counts at sign time.
