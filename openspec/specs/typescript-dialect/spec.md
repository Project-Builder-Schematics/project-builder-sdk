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

### REQ-TSD-01: Frozen subpath + widened op-pack vocabulary

The TypeScript dialect MUST be reachable at the exact subpath `@pbuilder/sdk/typescript`
(frozen — not `/ts`, not `/typescript-morph`; ADR-0014 amendment). Its op-pack MUST expose
`.raw()` (universal, REQ-DG-03) plus SIX structured ops: `addImport` (frozen name and call
signature, unchanged), `removeImport`, `addFunction`, `addVariable`, `addClass` — WIDENING the
"at most one more" cardinality bound this REQ pinned at V4 (this change is the widening named
in that bound's own non-normative note). `addImport`'s call signature stays FROZEN as
`addImport(name: string, from: string)`. The five new ops' call signatures are pinned as:
`removeImport(name: string, from: string)`; `addFunction(name: string, source: string,
options?: { export?: boolean })`; `addVariable(name: string, initializer: string, options?: {
export?: boolean; kind?: "const" | "let" | "var" })` (`kind` defaults to `"const"`);
`addClass(name: string, source: string, options?: { export?: boolean })`. This is STILL the
only dialect subpath wired by this change — no general dialect-naming convention is
established.

> Non-normative note (historical trace, ratified owner ruling #4): the five new ops' call
> signatures were originally drafted as this spec's proposed shape, matching `addImport`'s
> minimal positional-args rhythm. Owner ruling #4 (2026-07-12, post-spec-V1) RATIFIES them as
> pinned — no further design/council confirmation is required; the signatures above are frozen
> for this change.

#### Scenario REQ-TSD-01.1: subpath resolves, exact op-set shape

- GIVEN `package.json#exports`
- WHEN `@pbuilder/sdk/typescript` is imported and `Object.keys(dialect.ops)` is sorted
- THEN it resolves AND the sorted array EQUALS EXACTLY `["addClass", "addFunction", "addImport",
  "addVariable", "removeImport"]` — asserted via `toEqual`, never `toContain`/subset, so an extra
  op fails RED (anti-smuggle) and a missing op fails RED (honest cut-lever tracking)

> Cut-lever coupling note: if `addVariable`/`addClass` are cut per REQ-TSD-10/11's
> owner-authorised cut lever, this exact-set array is edited in the SAME slice that cuts them —
> the allow-list is the source of truth for what actually shipped, never a stale aspiration.

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

### REQ-TSD-04: `.raw()` and unparseable/unprintable-content containment (real-AST instance of REQ-DG-05)

Restates REQ-DG-05 against the REAL TypeScript dialect, not a mock: a `.raw()` throw, a real
ts-morph parse failure, AND a real ts-morph print failure on corrupted AST state MUST all
surface via the SAME interim contained-error contract (pinned message prefix, no ts-morph
internal leak).

(Previously: covered only `.raw()` throw + parse failure; now also covers print failure,
closing the print-failure containment gap tracked as a followup at stage-5 archive.)

#### Scenario REQ-TSD-04.1: real ts-morph parse failure is contained

- GIVEN a seeded file containing syntactically invalid TypeScript
- WHEN `find(path)` executes its first op (triggering `ast.parse`)
- THEN the run rejects per REQ-DG-05's contract — pinned prefix, no ts-morph internal leak,
  asserted against the REAL ts-morph error, including `.cause` being `undefined`/absent

#### Scenario REQ-TSD-04.2: real ts-morph print failure is contained

- GIVEN a live AST driven into a state that makes the dialect's print step throw (design
  selects the concrete mechanism to induce this against the REAL ts-morph printer)
- WHEN the handle's chain settles and print executes
- THEN the run rejects with the pinned prefix and the tail `could not print "{path}"`
  (REQ-DG-05's ratified tail structure), no ts-morph internal leak

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

### REQ-TSD-08: `removeImport` structured op

`removeImport(name: string, from: string): void` MUST remove the named binding from `from`'s
import clause. Idempotent: removing an ABSENT binding is a no-op that emits ZERO directives
(mirrors `addImport`'s idempotency, REQ-TSD-03.10). Removing the LAST remaining named binding
in an import clause MUST delete the entire import statement — no dangling
`import {} from "from"`. An aliased specifier (`{ readFileSync as rf }`) MUST be matched by the
module-EXPORTED name (`readFileSync`), not the local alias. Scope: NAMED-binding imports only
— default and namespace imports are OUT OF SCOPE for this change.

#### Scenario REQ-TSD-08.1: sibling-binding survives byte-exact

- GIVEN a seeded file `import { a, b } from "m";`
- WHEN `find(path).removeImport("a", "m")` flushes
- THEN the printed output retains `import { b } from "m";` byte-exact — `a` is gone, `b`'s
  formatting is untouched

#### Scenario REQ-TSD-08.2: last binding deletes the whole import statement

- GIVEN a seeded file whose ONLY import is `import { a } from "m";`
- WHEN `find(path).removeImport("a", "m")` flushes
- THEN no `import ... from "m"` statement remains anywhere in the printed output — no dangling
  `import {} from "m"`

#### Scenario REQ-TSD-08.3: aliased specifier matched by module-exported name

- GIVEN a seeded file `import { readFileSync as rf } from "node:fs";`
- WHEN `find(path).removeImport("readFileSync", "node:fs")` flushes
- THEN the aliased specifier is removed — matching succeeded via the exported name, not the
  local alias `rf`

#### Scenario REQ-TSD-08.4: absent import is an idempotent no-op

- GIVEN a seeded file with NO import from `"m"`
- WHEN `find(path).removeImport("a", "m")` is the ONLY op in the chain and it flushes
- THEN ZERO directives are emitted for this handle — no `modify` directive at all

#### Scenario REQ-TSD-08.5: dryRun() preview before commit

- GIVEN `find(path).removeImport("a", "m")` left mid-chain, uncommitted
- WHEN `dryRun()` (`dry-run-plan-exposure` REQ-DRE-01) is called before the run resolves
- THEN it shows the planned `modify` (verb + path) for that handle — the author sees a
  destructive op is queued before commit (REQ-MC-05's existing contract, exercised here for a
  destructive op)

#### Scenario REQ-TSD-08.6: removeImport of an import added earlier in the same chain (RYOW)

- GIVEN a seeded file with NO import from `"m"`, and a chain
  `find(path).addImport("x", "m").removeImport("x", "m")`
- WHEN the chain flushes
- THEN exactly ONE `modify` directive is emitted for the handle, and its content is
  BYTE-IDENTICAL to the seed — the pending in-chain AST already sees the add before the remove
  is applied (read-your-own-writes); this is NOT retroactive directive cancellation, which
  zero-directive emission would require as new machinery

### REQ-TSD-09: `addFunction` structured op (± export)

`addFunction(name: string, source: string, options?: { export?: boolean }): void` MUST insert
a new top-level function declaration `{export }function {name}{source}` at a deterministic
position — ONE documented, stated insertion rule (the exact rule is a design decision; output
MUST be byte-exact against committed goldens and identical across repeated runs of the same
chain). `addFunction` MUST REJECT with a `dialectError` (pinned message, frozen
`"dialect operation failed: "` prefix) when a VALUE-NAMESPACE declaration (`function`/`const`/
`let`/`var`/`class`/`enum`/`namespace`) OR an IMPORT BINDING already exists under `name` (owner ruling #4,
collision-namespace pin) — CROSS-KIND within that namespace: an existing `const foo` MUST reject
`addFunction("foo", …)`, and an existing `import { foo } from "m"` MUST also reject. A
`type`/`interface` declaration under the SAME name does NOT collide — TypeScript legally permits
a value and a type/interface to share an identifier, so `addFunction` proceeds normally when
only a `type`/`interface` exists under `name`. This asymmetry with `addImport`'s merge/idempotent
semantics is DELIBERATE: imports merge naturally (multiple modules can safely import the same
name), but two value-namespace declarations (or a value declaration shadowing an import binding)
sharing a name produce invalid or surprising TypeScript — almost always author error, not a case
to silently resolve. This op class is NON-CUTTABLE — it types the named pain ("export a
function") this change exists to close. REQ-TSD-10 and REQ-TSD-11 share this SAME
collision-namespace rule verbatim; only this REQ pins its exhaustive scenarios.

#### Scenario REQ-TSD-09.1: non-exported function added

- GIVEN an empty seeded file
- WHEN `find(path).addFunction("hi", "(): void {}")` flushes
- THEN the printed content is byte-exact against a committed golden containing
  `function hi(): void {}`

#### Scenario REQ-TSD-09.2: exported function added (separate export arm)

- GIVEN an empty seeded file
- WHEN `find(path).addFunction("hi", "(): void {}", { export: true })` flushes
- THEN the printed content is byte-exact against a committed golden containing
  `export function hi(): void {}`

#### Scenario REQ-TSD-09.3: cross-kind collision rejects

- GIVEN a seeded file `const foo = 1;`
- WHEN `find(path).addFunction("foo", "(): void {}")` runs
- THEN the run REJECTS with the pinned `dialectError` message naming `foo`

#### Scenario REQ-TSD-09.4: comment-only-file seed

- GIVEN a seeded file containing only a comment, no statements
- WHEN `addFunction` is applied
- THEN the comment is preserved byte-exact and the function is inserted per the deterministic
  position rule

#### Scenario REQ-TSD-09.5: CRLF newline preservation

- GIVEN a seeded file with CRLF line endings
- WHEN `addFunction` is applied
- THEN the inserted declaration's line endings match the file's existing CRLF convention
  (mirrors REQ-TSD-02.8's `addImport` precedent)

#### Scenario REQ-TSD-09.6: run-twice byte-identical

- GIVEN the same chain run twice against a fresh `Project` each time
- WHEN the two printed outputs are compared
- THEN they are byte-identical to each other AND both equal the committed golden (mirrors
  REQ-TSD-02.1)

#### Scenario REQ-TSD-09.7: import-binding collision rejects (owner ruling #4)

- GIVEN a seeded file `import { foo } from "m";`
- WHEN `find(path).addFunction("foo", "(): void {}")` runs
- THEN the run REJECTS with the pinned `dialectError` message naming `foo` — an import binding
  is in the collision namespace

#### Scenario REQ-TSD-09.8: type-alias declaration does NOT collide (owner ruling #4)

- GIVEN a seeded file `type foo = string;`
- WHEN `find(path).addFunction("foo", "(): void {}")` flushes
- THEN it does NOT reject — the function is added, and the printed content is byte-exact
  against a committed golden containing both the untouched `type foo = string;` and the new
  `function foo(): void {}`

### REQ-TSD-10: `addVariable` structured op (± export) — cuttable

`addVariable(name: string, initializer: string, options?: { export?: boolean; kind?: "const" |
"let" | "var" }): void` MUST insert `{export }{kind} {name} = {initializer};` at the SAME
documented deterministic position rule as `addFunction` (REQ-TSD-09). `kind` defaults to
`"const"`. MUST REJECT with the same pinned `dialectError` on a same-name collision against the
SAME value-namespace + import-binding rule as REQ-TSD-09 (own scenario, separable; `type`/
`interface` do not collide, per REQ-TSD-09's namespace pin). **Cut lever**:
this REQ is CUTTABLE FIRST if apply-time size trends toward the parent's XL estimate
(owner-authorised, no re-ask needed).

#### Scenario REQ-TSD-10.1: non-exported const added (default kind)

- GIVEN an empty seeded file
- WHEN `find(path).addVariable("PI", "3.14159")` flushes
- THEN the printed content is byte-exact against a committed golden containing
  `const PI = 3.14159;`

#### Scenario REQ-TSD-10.2: exported variable, explicit kind

- GIVEN an empty seeded file
- WHEN `find(path).addVariable("counter", "0", { export: true, kind: "let" })` flushes
- THEN the printed content is byte-exact against a committed golden containing
  `export let counter = 0;`

#### Scenario REQ-TSD-10.3: same-name collision rejects (own scenario)

- GIVEN a seeded file `function bar() {}`
- WHEN `find(path).addVariable("bar", "1")` runs
- THEN the run REJECTS with the pinned `dialectError` message naming `bar`

#### Scenario REQ-TSD-10.4: empty-file seed

- GIVEN a completely empty seeded file
- WHEN `addVariable` is applied
- THEN the output is byte-exact against a committed golden, no spurious whitespace

### REQ-TSD-11: `addClass` structured op (± export) — cuttable

`addClass(name: string, source: string, options?: { export?: boolean }): void` MUST insert
`{export }class {name} {\n{source}\n}` at the SAME documented deterministic position rule as
REQ-TSD-09. MUST REJECT with the same pinned `dialectError` on a same-name collision (own
scenario), governed by the SAME value-namespace + import-binding rule as REQ-TSD-09 (`type`/
`interface` exempt). **Cut lever**: CUTTABLE FIRST alongside REQ-TSD-10 (owner-authorised, no
re-ask needed).

#### Scenario REQ-TSD-11.1: non-exported class added

- GIVEN an empty seeded file
- WHEN `find(path).addClass("Point", "  x = 0;\n  y = 0;")` flushes
- THEN the printed content is byte-exact against a committed golden containing the class
  declaration with both members

#### Scenario REQ-TSD-11.2: exported class added

- GIVEN an empty seeded file
- WHEN `find(path).addClass("Point", "  x = 0;", { export: true })` flushes
- THEN the printed content is byte-exact against a committed golden beginning `export class Point`

#### Scenario REQ-TSD-11.3: same-name collision rejects (own scenario)

- GIVEN a seeded file `const Baz = 1;`
- WHEN `find(path).addClass("Baz", "")` runs
- THEN the run REJECTS with the pinned `dialectError` message naming `Baz`

#### Scenario REQ-TSD-11.4: empty-file seed

- GIVEN a completely empty seeded file
- WHEN `addClass` is applied
- THEN the output is byte-exact against a committed golden, no spurious whitespace

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — new ops execute against the live ts-morph AST | REQ-TSD-08..11 | Yes |
| security (third-party trust) — ts-morph realm | REQ-TSD-08..11 | Yes |
| public-api (contract) — 5 new exported ops on the frozen `./typescript` subpath | REQ-TSD-01, REQ-TSD-08..11 | Yes |
