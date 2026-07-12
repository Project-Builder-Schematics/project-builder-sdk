# Delta for typescript-dialect

**Spec version**: V5
**Draft revision**: V2 (owner ruling #4 + council feedback applied 2026-07-12)
**Status**: signed (owner, 2026-07-12 — V2)
**Change**: `stage-5b-dialect-breadth`

## MODIFIED Requirements

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

(Previously: pinned exactly `.raw()` + `addImport` + at-most-one-more optional op, unnamed.)

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

## ADDED Requirements

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
`let`/`var`/`class`) OR an IMPORT BINDING already exists under `name` (owner ruling #4,
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
