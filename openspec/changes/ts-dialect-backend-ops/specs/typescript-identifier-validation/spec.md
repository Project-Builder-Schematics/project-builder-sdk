# TypeScript Identifier Validation Specification

**Spec version**: V2
**Status**: draft
**Change**: `ts-dialect-backend-ops`
**REQs / Scenarios**: 3 / 11 (V1: 3/7)

## Changelog — V1 → V2 (council-spec-v1.md finding resolution)

| ID | Finding | Resolution |
|---|---|---|
| C5 | grammar unpinned — accept set IS the security boundary | APPLIED — ruling (g): ASCII-only regex + reserved-word + escape/non-ASCII rejection pinned in REQ-TIV-01; grammar-boundary corpus table (scenario .4) |
| M1 | from-position exclusion on faith — no positive containment evidence | APPLIED — scenario .7, one hostile-payload golden per sink family (import/export/side-effect/export-all) |
| M2 | TIV-03 probe corpus is one shape — blocklist theatre | APPLIED — REQ-TIV-03.2 rewritten around a 12-shape table-driven corpus |
| M3 | `addVariable.kind` raw splice (ops.ts:114) | RESOLVED ELSEWHERE — ruling (f); see `typescript-dialect` REQ-TSD-21 (different parameter position, different REQ) |
| M9 | no `__proto__`/`constructor` probe | APPLIED — folded into the grammar-boundary corpus (scenario .4), alongside a "scary name, not scary shape" ACCEPT row for `"evil"` |
| m1 | reject-path ordering unpinned | APPLIED — scenario .5: validation always precedes the identity/no-op short-circuit |
| m2 | injection into error text (newlines/ANSI/multi-KB names) | APPLIED — scenario .6: escaped (`JSON.stringify`) + length-capped |
| m3 | bypass routes unnamed in capability spec | APPLIED — new "Boundary and Residual Risks" subsection, cross-referencing SECURITY.md and pending-changes row (23) |
| m5 | REQ-TIV-02.2 said "the other three", should be "four" | APPLIED — count corrected |

Unicode identifier support (ruling g) is explicitly OUT of scope for this change and registered
as a pending followup — TypeScript's own broader identifier grammar permits it; this capability
deliberately does not.

## Purpose

Confirmed (not theoretical) injection gap: every op in the TypeScript dialect's op-pack accepts
a `name`-position string argument that is spliced into generated source. `from`-position (module
specifier) args are escaped safely by ts-morph's own string-literal serialization; `name`-position
args are NOT — a crafted `name` can break out of its syntactic position and inject arbitrary
statements. This capability defines the single shared validation boundary that closes the gap
across all 12 ops (5 existing + 7 new), folding in pending-changes row (22) after 3 prior
deferrals (owner ruling a).

## Requirements

### REQ-TIV-01: Identifier validation predicate at the name-position boundary

The TypeScript dialect MUST validate every `name`-position parameter of every op in its op-pack —
the 5 existing (`addImport`, `removeImport`, `addFunction`, `addVariable`, `addClass`) plus the 7
new Group-1 ops (`addDefaultImport`, `addNamespaceImport`, `addTypeImport`, `addReExport`,
`removeExport`; `addSideEffectImport`/`addExportAll` have no `name` param and are out of this
REQ's boundary) — against a PINNED grammar (owner ruling g, V2): the ASCII-only pattern
`^[A-Za-z_$][A-Za-z0-9_$]*$`, PLUS explicit rejection of ECMAScript reserved words (e.g. `class`,
`function`, `return`, `this`, …), PLUS explicit rejection of `\u`/`\u{}` escape sequences and any
non-ASCII character (including zero-width characters such as ZWNJ, U+200C) — BEFORE any AST
mutation, REJECTING with a branded `dialectError` on failure. Validation ALWAYS runs before any
identity/no-op short-circuit (V2, m1) — an op never skips validation because the target state
happens to already match what a valid call would produce. The boundary is `name`-position args
ONLY: `from`-position (module specifier) args are OUT of scope (ts-morph escapes them safely,
verified against ts-morph@28), and `source`/`initializer` (code-body) args are OUT of scope by
design (they are author-supplied code, not identifiers — validating them as bare identifiers is
a category error).

#### Scenario REQ-TIV-01.1: valid identifier accepted
- GIVEN `addFunction("validName", "(): void {}")`
- WHEN invoked
- THEN it succeeds, unaffected by this REQ

#### Scenario REQ-TIV-01.2: structurally invalid name rejected before mutation
- GIVEN `addFunction("not a name", "(): void {}")`
- WHEN invoked
- THEN it rejects with `dialectError`; zero AST mutation occurs

#### Scenario REQ-TIV-01.3: boundary — `from` and code-body args are not subject to this validation
- GIVEN `addImport("x", "m\" ; import \"evil")` (a `from` value containing quote/statement
  characters)
- WHEN invoked
- THEN it is NOT rejected by this predicate — ts-morph's own module-specifier string-literal
  escaping is the containment mechanism for `from`, not REQ-TIV-01

#### Scenario REQ-TIV-01.4: grammar boundary corpus — reject shape vs. merely-scary name (NEW, V2 — C5 + M9)
- GIVEN each row of the table below, applied to `addFunction`'s `name` argument
- WHEN invoked
- THEN the Outcome column holds — REJECT rows never mutate the AST; ACCEPT rows succeed
  normally, INCLUDING a follow-up check that `__proto__`/`constructor` produce no observable
  prototype pollution on the resulting AST or module object (stage-4b seed-bug class, M9)

| Input | Reason | Outcome |
|---|---|---|
| `"class"` (representative ES reserved word) | reserved word | REJECT |
| `"evil"` | syntactically valid identifier — a scary NAME is not a scary SHAPE | ACCEPT |
| `"a\u200Cb"` (embedded ZWNJ, U+200C) | non-ASCII character | REJECT |
| `""` | empty string | REJECT |
| `"1abc"` | leading digit | REJECT |
| `"__proto__"` | syntactically valid identifier, prototype-pollution-shaped name | ACCEPT, no pollution observable |
| `"constructor"` | syntactically valid identifier, prototype-pollution-shaped name | ACCEPT, no pollution observable |

#### Scenario REQ-TIV-01.5: validation precedes the idempotency/no-op check (NEW, V2 — m1)
- GIVEN a file already in the exact post-state a valid call would produce as a no-op (e.g.
  `import X from "m";` already present)
- WHEN the SAME op is called with a structurally-invalid `name` in place of the valid one (e.g.
  `addDefaultImport("not a name", "m")`)
- THEN it still rejects with `dialectError` — validation is never bypassed by a would-be no-op
  state; the fixed order is validate → identity/collision checks → mutate

#### Scenario REQ-TIV-01.6: rejected input is rendered contained in the error message (NEW, V2 — m2)
- GIVEN `addFunction("evil\nname\x1b[31m", "(): void {}")` (embeds a newline and an ANSI CSI
  escape sequence)
- WHEN it rejects
- THEN the `dialectError` message renders the offending input via `JSON.stringify` (escaped — no
  raw control characters reach a terminal or log sink) AND is length-capped (a multi-KB `name`
  is truncated in the message, never echoed in full)

#### Scenario REQ-TIV-01.7: from-position payloads are contained at each sink family (NEW, V2 — M1)
- GIVEN a hostile `from` payload is supplied to one op per sink family (table below)
- WHEN invoked
- THEN ts-morph's own module-specifier string-literal escaping renders the output BYTE-EXACT
  against a committed golden — no statement injection occurs, confirming REQ-TIV-01.3's boundary
  claim with POSITIVE evidence per sink family, not merely "the name-position predicate didn't
  fire"

| Sink family | Representative call | Hostile `from` payload shape |
|---|---|---|
| import declaration | `addImport("x", "m\"; import \"evil")` | quote + statement-terminator |
| export declaration | `addReExport("x", "m\"; export * from \"evil")` | quote + statement-terminator |
| side-effect import | `addSideEffectImport("m\"; import \"evil")` | quote + statement-terminator (the only from-only op with no `name` arg to also probe) |
| export-all | `addExportAll("m\"; export * from \"evil")` | quote + statement-terminator |

### REQ-TIV-02: Retroactive behaviour change on the 5 shipped ops (compatibility note)

Applying REQ-TIV-01 to the 5 PRE-EXISTING ops is a BEHAVIOUR CHANGE: a `name` value previously
accepted (no prior guard rejected non-identifier strings) is now REJECTED if it fails the
identifier grammar. Accepted for 0.x (no semver stability guarantee yet); MUST be stated
explicitly in design/docs, never shipped as a silent tightening.

#### Scenario REQ-TIV-02.1: addImport now rejects a previously-accepted non-identifier name
- GIVEN `addImport("not a name", "m")` — a `name` no PRIOR guard rejected
- WHEN invoked (post-this-change)
- THEN it now rejects with `dialectError` — previously it would have produced invalid or
  unexpected generated TS silently

#### Scenario REQ-TIV-02.2: the same tightening applies uniformly to the other FOUR shipped ops (CORRECTED, V2 — m5)
- GIVEN `removeImport`/`addFunction`/`addVariable`/`addClass`, each called with a
  structurally-invalid `name`
- WHEN invoked
- THEN each rejects via the SAME predicate at the SAME boundary — one representative op is
  pinned as REQ-TIV-02.1's regression proof; the other FOUR are covered by a table-driven test
  asserting the identical reject contract (design owns the table mechanism)

### REQ-TIV-03: Injection acceptance criterion — uniform across all applicable ops

For every op with a `name`-position parameter (10 of the 12 — all except `addSideEffectImport`/
`addExportAll`), an injection-shaped payload (a string that, if spliced unescaped into generated
source, would break out of its syntactic position and inject arbitrary statements — e.g.
`x } from "evil"; import { y`) MUST be rejected via the SAME branded `dialectError`, with ZERO
emitted import/export directives. None of the Group-1 ops exposes a separate `as`-alias
parameter (each is fixed-arity `name`/`from`), so this REQ's probe covers the op's sole
`name`-position argument; it does not (yet) need to cover a distinct alias position.

#### Scenario REQ-TIV-03.1: the canonical probe rejects on the existing op (regression baseline)
- GIVEN `addImport("x } from \"evil\"; import { y", "m")`
- WHEN invoked
- THEN it rejects with `dialectError`; zero emitted imports

#### Scenario REQ-TIV-03.2: the same probe shape rejects across all 10 name-bearing ops, over a table-driven injection-shape corpus (EXTENDED, V2 — M2)
- GIVEN the corpus below — one representative payload per injection SHAPE — applied,
  table-driven, to each of the 10 name-bearing ops' `name`-position argument (12 shapes × 10
  ops; design owns the cross-product test mechanism, this REQ pins the shape corpus)
- WHEN invoked
- THEN every cell rejects with `dialectError`, zero emitted directives — no cell resolves to an
  uncontained exception or a successfully-emitted malicious statement

| # | Shape | Example payload |
|---|---|---|
| 1 | statement terminator | `x; process.exit(` |
| 2 | newline | `x\ny` |
| 3 | CRLF | `x\r\ny` |
| 4 | block-comment open | `x/*` |
| 5 | line comment | `x//` |
| 6 | backtick | `` x` `` |
| 7 | single quote | `x'` |
| 8 | double quote | `x"` |
| 9 | `\u` escape | `x\u0061` |
| 10 | zero-width | `x\u200Cy` |
| 11 | reserved word (cross-referenced from REQ-TIV-01.4) | `class` |
| 12 | interior whitespace | `x y` |

(Empty string and leading digit are already covered by REQ-TIV-01.4's grammar corpus — not
duplicated here, per the scenario-budget discipline.)

## Boundary and Residual Risks (NEW, V2 — m3)

This validation boundary does NOT cover every route into generated source. Two bypass routes are
named explicitly here rather than left implicit:

- **`.modify(fn)` / `source`/`initializer` code-body arguments** — author-supplied code, not
  identifiers; validating them as bare identifiers would be a category error (see REQ-TIV-01's
  own scope carve-out above). Cross-reference: `SECURITY.md`'s explicit-trust posture for the
  escape hatch (`dialect-authoring-standards` REQ-DAS-01's two-realms hazard coverage).
- **`defineDialect`-direct reserved-name bypass** — inherited, pre-existing, registered as
  `openspec/pending-changes.md` row (23); NOT newly triggered by this change and not
  re-litigated here — named for completeness, not re-scoped.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — injection hardening on `src/dialects/typescript/**`'s op-pack | REQ-TIV-01, REQ-TIV-02, REQ-TIV-03 | Yes |
