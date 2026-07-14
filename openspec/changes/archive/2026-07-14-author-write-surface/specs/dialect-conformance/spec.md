# Delta for dialect-conformance

**Spec version**: V2
**Status**: signed (owner, 2026-07-14)
**Change**: `author-write-surface`

## MODIFIED Requirements

### REQ-DC-02: Single-op fidelity + unchanged-elsewhere

`testOpPack(fixture)` MUST assert, for each op the fixture exercises, that the op's intended
effect is present in the printed output AND every OTHER region of the source is byte-stable
(catches over-broad mutations). The op-pack MUST be exercised against `fixture.baseDialect`,
a REAL dialect instance — never a mock (ADR-0012).

The fixture supplies these exercises via the REQUIRED `OpPackFixture.exercises` array. Each
exercise declares a `seed` (initial file content), an op `chain` (named ops from the pack
and/or the universal `.modify(fn)`), and the BYTE-EXACT `expect`ed printed content of the
resulting coalesced `modify` — a FULL-output comparison, never a substring, so a single
assertion proves BOTH the op's intended effect AND that every other region is byte-stable.
`exercises` is REQUIRED at the type level: a fixture omitting it does not compile, so the kit
can never silently skip its per-op assertions. Each chain step is typed as `{op: string, args:
readonly unknown[]} | {modify: (ast: unknown) => void}` (renamed from `{raw: ...}`); the
dispatcher routes on the DISCRIMINANT key present on the step — a step carrying `op`/`args`
MUST route to the named-op branch (`handle[op](...args)`) and MUST NEVER be misrouted into the
`.modify()` branch, and vice versa.

(Previously: the chain step's AST-escape-hatch variant was typed `{raw: (ast: unknown) =>
void}` and dispatched via `handle.raw(step.raw)`. Renamed to `{modify: (ast: unknown) => void}`
dispatched via `handle.modify(step.modify)` — the discriminated-union dispatch mechanism is
unchanged, only the discriminant key and target method rename. NEW: an explicit
discriminant-misroute negative test, closing a gap this change's council review surfaced.)

#### Scenario REQ-DC-02.1: addImport changes only the import region

- GIVEN a multi-statement TS sample and `addImport` applied via `testOpPack`
- WHEN the printed output is diffed against the original
- THEN only the import-list region differs; every other line is byte-identical

#### Scenario REQ-DC-02.2: discriminant-misroute negative — an `{op,args}` step never routes into the modify branch (NEW; V2 pins the concrete post-condition)

- GIVEN a chain step correctly shaped as `{op: "addImport", args: ["readFileSync", "node:fs"]}`
  (no `modify` key present)
- WHEN the dispatcher processes the step
- THEN it routes to the named-op branch (`handle.addImport("readFileSync", "node:fs")`) — AND
  the concrete post-condition holds: the printed output contains the added import statement
  (`addImport`'s effect is present), and the output is BYTE-EXACT against the SAME committed
  golden `addImport` alone would produce (`typescript-dialect` REQ-TSD-01.2's golden) — a planted
  mutant that routes `{op,args}` steps through `handle.modify(...)` instead FAILS this assertion
  because `.modify()` receives a step object, not a callable AST-fn, and its attempted
  invocation either throws or produces no import effect — proving the assertion tests ROUTING
  itself, not merely that SOMETHING throws

### REQ-DC-03: Coalescing to ONE modify (triangulated, content-verified)

`testDialect`/`testOpPack` MUST assert that a chain of ≥2 DISTINGUISHABLE ops (never N=1,
never a count-only assertion) coalesces to exactly one `modify` directive whose content
reflects ALL ops in the chain.

(Previously: the example chain paired `addImport` with `.raw()`. Renamed to `.modify(fn)` —
the coalescing assertion itself is unchanged.)

#### Scenario REQ-DC-03.1: two distinguishable ops, one modify, content-verified

- GIVEN a chain of `addImport` + `.modify(fn)` (2 distinguishable ops) run through `testOpPack`
- WHEN the emitted batch is inspected
- THEN exactly one `modify` directive exists AND its content contains BOTH ops' effects —
  not merely `instructions.length === 1`

### REQ-DC-04: Seam-serializability (security core assertion)

`testDialect`/`testOpPack` MUST assert that only serializable bytes cross the seam:
`JSON.parse(JSON.stringify(directive))` deep-equals the directive for every op exercised
(`foundations-skeleton` REQ-FIT-05 precedent, extended to the coalesced path). A planted
`.modify(fn)` op that attempts to smuggle a closure or a live AST node reference onto directive
content MUST cause the conformance suite to FAIL LOUDLY — a MANDATORY negative fixture, not
optional. **Caveat (mirrored from `foundations-skeleton` REQ-STD-01)**: passing this suite is
NOT a safety attestation — it proves the seam stays serializable, not that a dialect's
`.modify(fn)` code is safe to execute; "conformance ≠ safety" holds for the kit itself, not
only for SECURITY.md's prose.

(Previously: named the smuggling vector `.raw()`. Renamed to `.modify(fn)` — the
serializability assertion and its two distinct planted-failure-mode requirement are
unchanged.)

#### Scenario REQ-DC-04.1: planted closure-smuggling `.modify(fn)` fails the suite

- GIVEN a deliberately malformed op that attaches a closure reference to what would become
  directive content
- WHEN `testOpPack` runs against it
- THEN the suite FAILS — proving the assertion is live, not a no-op

#### Scenario REQ-DC-04.2: planted live-AST-node smuggling `.modify(fn)` fails the suite (distinct failure mode)

- GIVEN a SECOND deliberately malformed op — distinct from REQ-DC-04.1's closure — that
  attaches a LIVE ts-morph `Node` reference (with circular parent pointers) to what would
  become directive content
- WHEN `testOpPack` runs against it
- THEN the suite FAILS — via a DISTINCT failure mode from REQ-DC-04.1: `JSON.stringify`
  THROWS on the circular structure (vs. a closure silently dropping to `{}`/`undefined`) —
  both smuggling modes MUST be caught, not just one

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — chain-step discriminant rename + misroute negative, `.modify(fn)` smuggling proofs | REQ-DC-02, REQ-DC-04 | Yes |
