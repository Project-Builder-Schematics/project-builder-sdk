# TypeScript Dialect Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-11 — V4; final-loop deltas ratified)
**Change**: `stage-5-first-dialect`

## Purpose

The TypeScript dialect at `@pbuilder/sdk/typescript`, powered by ts-morph — the first REAL
dialect, proving `dialect-generics` and `modify-coalescing` against a real AST library
(not a mock). Scope is deliberately THIN: `.raw()` plus exactly one structured op
(`addImport`) — design may argue at most one more (B1). Op-pack breadth (removeImport,
prune-unused, add function/variable/class ± export) is OUT OF SCOPE, tracked as
committed-next `stage-5b-dialect-breadth`. All proofs run against the `ContractFake` — B6,
promoted to a normative requirement in REQ-TSD-07.

## Requirements

### REQ-TSD-01: Frozen subpath + vocabulary

The TypeScript dialect MUST be reachable at the exact subpath `@pbuilder/sdk/typescript`
(frozen — not `/ts`, not `/typescript-morph`; ADR-0014 amendment). Its thin starter op-pack
MUST expose exactly `.raw()` (universal, REQ-DG-03) plus the structured op `addImport`
(frozen name and call signature) — design MAY add AT MOST one more structured op. `addImport`'s
call signature is FROZEN as `addImport(name: string, from: string)` — adds
`import { name } from "from"` to the file's import list (or merges into an existing
named-import clause from the same module — REQ-TSD-03.10). This is the ONLY dialect subpath
wired by this change — no general dialect-naming convention is established.

> Non-normative note: this REQ pins the CARDINALITY bound only (at most one more structured
> op). Naming that optional second op — if design elects to add it — is a design-time
> decision; an op-set membership test naming it specifically (REQ-DG-02.1-style) cannot be
> authored until design names it.

#### Scenario REQ-TSD-01.1: subpath resolves, thin op-pack shape

- GIVEN `package.json#exports`
- WHEN `@pbuilder/sdk/typescript` is imported
- THEN it resolves and exposes a dialect whose `ops` includes `addImport`; any op beyond
  `.raw`/`addImport`/at-most-one-more is absent

#### Scenario REQ-TSD-01.2: addImport concrete before/after byte pair

- GIVEN a seeded file `a.ts` with content `const x = 1;\n`
- WHEN `find("a.ts").addImport("readFileSync", "node:fs")` flushes
- THEN the printed content is BYTE-EXACT against a committed golden fixture — e.g.
  `import { readFileSync } from "node:fs";\n\nconst x = 1;\n` — the golden is the source of
  truth for exact insertion position/formatting; this string illustrates the shape

### REQ-TSD-02: ts-morph determinism pins

The TypeScript dialect's `ast.parse`/`ast.print` pair MUST use FROZEN `ManipulationSettings`
with an EXPLICIT `newLineKind` (never the host-OS default — nondeterministic across
WSL/CI/macOS) and MUST NOT invoke ts-morph's language-service formatter inside any op.
Running the SAME chain against a fresh `Project` TWICE MUST produce byte-identical printed
output, which MUST ALSO equal one committed golden fixture (self-consistency alone is
insufficient — REQ-GIR-03 precedent). ts-morph's pinned version MUST be gated against the
goldens.

#### Scenario REQ-TSD-02.1: fresh-Project-twice byte-identical + golden match

- GIVEN the same chain run twice against a fresh `Project` each time
- WHEN the two printed outputs are compared
- THEN they are byte-identical AND both equal a committed golden fixture string

#### Scenario REQ-TSD-02.2: explicit NewLineKind, not host default

- GIVEN the dialect's `ast.parse`/`ast.print` configuration
- WHEN inspected
- THEN `newLineKind` is set to an explicit, frozen value — never derived from the host OS

#### Scenario REQ-TSD-02.3: language-service formatter is never invoked

- GIVEN a chain exercising `addImport` and `.raw()`
- WHEN the chain runs (test-note: a spy on ts-morph's language-service formatter API, e.g.
  `Node#formatText`/the project's language service)
- THEN the spy records ZERO calls across the run — confirms REQ-TSD-02's "MUST NOT invoke
  ts-morph's language-service formatter" is actually honored, not merely asserted by omission

### REQ-TSD-03: Edge scenarios (fail-closed, fidelity, byte/size boundaries)

| # | Given | When | Then |
|---|---|---|---|
| .1 modify-after-create | a commons `create(path, { template, options })` followed by a dialect `find(path).addImport(name, from)` in the SAME run (create stages the file; the dialect's first-op read-through then observes it via read-your-own-writes — REQ-MC-02.2) | flushed | the run emits the `create` directive (flushed when the dialect read-through reads back through `Session.read`, ADR-0015) AND exactly ONE coalesced dialect `modify` for `path` at run end; the `modify`'s content is byte-exact the CREATED content with the import applied — derived from the staged create via RYOW, NEVER from a disk/tree read (no persisted tree, ADR-0008) |
| .2 modify-then-move | a chain `find(path).addImport(x).move(toDir)` | flushed | the coalesced `modify` directive targets the ORIGINAL path AND its content is byte-exact with the import applied — the modify's content survives intact alongside the trailing move; the trailing `move` directive carries `{path, toDir}` |
| .3 two-edits-one-modify | two DISTINGUISHABLE edits (named op + `.raw()`, disjoint textual footprints) with no read between them | flushed | exactly ONE `modify` directive whose `content` reflects BOTH edits — a content assertion, not a count-only assertion (REQ-MC-01, real-AST proof) |
| .4 modify-on-nonexistent | `find()` targeting an unseeded path, first op executed | the handle's first op resolves | rejects with an author-visible message using the SAME `"dialect operation failed: "` prefix as REQ-DG-05 — pinned text (the `{path}` is QUOTED, matching REQ-DG-05's three tails): `dialect operation failed: "{path}" does not exist — create it first in this run`; not merely "ADR-0017"; the fake's run-end existence check (ADR-0017, REQ-FAKE-07 precedent) is the engine-side backstop, per `modify-coalescing` REQ-MC-04's reconciled timing |
| .5 empty file | a seeded EMPTY file, `addImport` applied | flushed | round-trips byte-exact plus the import, no spurious whitespace |
| .6 CRLF/BOM | a seeded file with CRLF line endings and a UTF-8 BOM, round-tripped with no edit | round-tripped | byte-exact — BOM and CRLF both preserved |
| .7 4 MiB boundary | a seeded multibyte-UTF-8 fixture sized so RAW bytes < `BATCH_CAP_BYTES` ≤ SERIALIZED (JSON-stringified) bytes — the multibyte expansion crosses the cap only after serialization (Stage-1 lesson) | an edit is applied and flushed | accepted under the cap, or rejected AT the cap (REQ-AEC-01.5) — never silently truncated; the fixture pins that it is the SERIALIZED side that trips the check |
| .8 CRLF + addImport | a seeded file with CRLF line endings, `addImport` applied | flushed | the inserted import line uses the SAME CRLF `newLineKind` as the rest of the file (REQ-TSD-02's frozen `newLineKind` × the file's existing line ending) — deterministic, pinned against a committed golden |
| .9 modify-then-copy | a chain `find(path).addImport(x).copy(toDir)` | flushed | mirrors .2: the coalesced `modify` targets the ORIGINAL path with byte-exact import content; the trailing `copy` directive carries `{path, toDir}` — `.copy()` chains after a coalesced modify the same as `.move()` |
| .10 duplicate addImport | `find(path).addImport(x, m).addImport(x, m)` — the SAME name+module called twice on one handle | flushed | idempotent: the printed content contains a SINGLE valid import statement for `{x} from m` — no duplicate import lines (design owns the merge mechanism; this REQ pins the observable no-duplicate-output contract) |

Justification for .10's idempotent ruling: repeated `addImport` calls for the same name+module
are a common byproduct of composed schematics (two independent op invocations importing the
same helper); a naive duplicate-statement output would be redundant, and in some TS contexts
invalid, code.

### REQ-TSD-04: `.raw()` and unparseable-content containment (real-AST instance of REQ-DG-05)

Restates REQ-DG-05 against the REAL TypeScript dialect, not a mock: a `.raw()` throw and a
real ts-morph parse failure on malformed TypeScript source MUST both surface via the SAME
interim contained-error contract (pinned message prefix, no ts-morph internal leak).

#### Scenario REQ-TSD-04.1: real ts-morph parse failure is contained

- GIVEN a seeded file containing syntactically invalid TypeScript
- WHEN `find(path)` executes its first op (triggering `ast.parse`)
- THEN the run rejects per REQ-DG-05's contract — pinned prefix, no ts-morph internal leak,
  asserted against the REAL ts-morph error, including `.cause` being `undefined`/absent
  (REQ-DG-05.1's `.cause` pin) — the strongest proof of the no-leak guarantee, since the
  underlying error here is a REAL ts-morph error, not a mock

### REQ-TSD-05: Minimum smoke import/resolve test for the wired subpath

This change MUST include a minimum smoke test proving `@pbuilder/sdk/typescript` resolves
and its exported dialect is usable end-to-end. The full structural port-guard-style fitness
function covering ALL subpaths uniformly is Stage 6 scope — this change proves reachability,
not a new fitness function.

#### Scenario REQ-TSD-05.1: subpath smoke-resolves and runs

- GIVEN a minimal schematic importing `@pbuilder/sdk/typescript`
- WHEN it runs `find(path).addImport(x)` against a `ContractFake`
- THEN the run completes and the fake's tree reflects the import

### REQ-TSD-06: ts-morph — plain pinned dependency (D5)

ts-morph MUST be declared as a plain, EXACT-PINNED (no caret/tilde range) `dependencies`
entry — the FIRST runtime dependency in this repo's `package.json`. The lockfile MUST be
committed. Publish MUST carry npm provenance (REQ-PKG-03 precedent, extended to the new
dependency). FIT-01's leaf isolation (`foundations-skeleton`, MODIFIED) MUST prove ts-morph
never reaches `src/commons/**`. The two-realms hazard (authors already depending on ts-morph
directly, possibly a different version) is ACCEPTED and DOCUMENTED, not solved, per the
owner ruling.

#### Scenario REQ-TSD-06.1: dependency is pinned, lockfile committed

- GIVEN `package.json` after this change
- WHEN `dependencies.ts-morph` is inspected
- THEN it is an EXACT version (no `^`/`~`) AND a lockfile is committed in the same change

#### Scenario REQ-TSD-06.2: the release carrying ts-morph is provenance-attested

- GIVEN the CI publish job on `main` (REQ-PKG-03 precedent: `--provenance` via npm trusted
  publishing/OIDC)
- WHEN the first release carrying the `ts-morph` dependency runs through that job
- THEN it carries the SAME `--provenance` attestation as every other release — no dependency
  addition is exempt from REQ-PKG-03's publish contract

### REQ-TSD-07: All dialect proofs run against the ContractFake, never the real engine

Every test/proof exercising the TypeScript dialect (unit, conformance, golden-IR) MUST run
against the `ContractFake` — never against a real engine. This restates the boundary already
normative elsewhere (`foundations-skeleton` REQ-KIT-02/REQ-FAKE-*) as an explicit requirement
scoped to the dialect surface (normative promotion of B6): a dialect's `.raw()` sensitivity
makes an accidental real-engine dependency a live risk, not a hypothetical one.

#### Scenario REQ-TSD-07.1: dialect test suite has zero real-engine imports

- GIVEN the full test suite exercising `src/dialects/typescript/**`
- WHEN scanned for any import/instantiation of a real (non-fake) engine client
- THEN none exists — every test wires the `ContractFake`

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — `.raw()` against a real AST | REQ-TSD-04 | Yes |
| security (third-party trust) — ts-morph supply chain | REQ-TSD-06 | Yes |
