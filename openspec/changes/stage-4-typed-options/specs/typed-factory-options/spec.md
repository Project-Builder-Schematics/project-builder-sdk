# Typed Factory Options Specification

**Spec version**: V2
**Status**: draft
**Change**: `stage-4-typed-options`

## Purpose

`defineFactory<O>` (`src/core/context.ts:38`) takes `O` as a bare, hand-supplied generic
today and invokes `fn(o)` with zero connection to `schema.json`. This capability makes
`schema.json` the genuine single source for a factory's input type: a shipped dev-time
codegen bin (D4, ADR-pending) derives a TypeScript type from it, so editing the schema is
the ONLY step required to change what the factory sees — closing the "no teeth" gap named
in the problem statement.

## Requirements

### REQ-TFO-01: Schema-Derived Input Type

The system MUST derive `defineFactory<O>`'s input type from a factory's adjacent
`schema.json` via the shipped codegen bin: running the bin against a `schema.json` MUST
produce a TypeScript type declaration that, supplied as `O`, causes the compiler to check
`fn(o)`'s body against that schema's shape. Editing a property's type in `schema.json` and
regenerating MUST be the ONLY step required to propagate the change into `O` — no second,
independently-maintained type declaration may exist for the same factory.

#### Scenario REQ-TFO-01.1: Happy path — parity flows through

- GIVEN a `schema.json` with a required property `port` of type `number`
- WHEN the bin is invoked against it and the generated type is supplied as `defineFactory<O>`'s `O`
- THEN the factory body reading `options.port` type-checks as `number`
- AND `tsc --noEmit` reports zero errors

#### Scenario REQ-TFO-01.2: Single source — no second declaration to edit (mutation-resistant)

- GIVEN a factory whose generated type declares `port: string` and a factory body that calls a `string`-only method on `options.port`
- WHEN `schema.json`'s `port` type is changed from `string` to `number` and the bin is re-run
- THEN the factory body's use of the now-`number` `options.port` FAILS to compile
- AND fixing the error requires editing ONLY the factory body — no second type declaration exists to reconcile

### REQ-TFO-02: Untyped Opt-Out Compatibility

A factory MUST be able to opt out of schema-derived typing: `defineFactory` called with a
bare/unspecified generic, or an explicit `JsonValue`-typed `O`, MUST continue to compile and
run exactly as before this change — mirroring the `create<S>` untyped-overload
compatibility already proven for the sibling `typed-create-skeleton` capability
(REQ-01.3), which this REQ deliberately parallels on the `defineFactory` plane.

#### Scenario REQ-TFO-02.1: Untyped factory still compiles and runs

- GIVEN `defineFactory(fn)` with no type parameter supplied and no `schema.json` present for that factory
- WHEN the TypeScript compiler checks the call and the factory is run
- THEN the call is accepted without a type error
- AND the runner executes `fn` exactly as it did before this change

### REQ-TFO-03: Codegen Bin Invocation & Output Discipline

The codegen bin MUST run only on explicit author invocation — it MUST NOT be wired to any
package-manager lifecycle hook (`postinstall` or otherwise). It MUST parse `schema.json`
strictly as data: a static-analysis check over the bin's own shipped source MUST confirm
the absence of `eval`, `new Function`, and any dynamic `import()`/`require()` call whose
argument is not a literal string. Any JSON-Schema-parsing or codegen library the bin
depends on MUST be declared exclusively as a `devDependency` — it MUST NOT appear under the
published package's runtime `dependencies`. Write containment for the bin's output is
governed by REQ-TFO-05.

#### Scenario REQ-TFO-03.1: No postinstall hook

- GIVEN the published package's `package.json`
- WHEN its `scripts` are inspected
- THEN no `postinstall` (or equivalent lifecycle) script invokes the codegen bin

#### Scenario REQ-TFO-03.2: Generator dependency is devDependency-only

- GIVEN the bin's implementation depends on a schema-parsing library
- WHEN the published package's `package.json` is inspected
- THEN that library appears under `devDependencies` only
- AND `package.json#dependencies` remains absent or empty (zero-runtime-deps preserved)

#### Scenario REQ-TFO-03.3: Parse-as-data is a static property of the shipped bin (SEC-M1)

- GIVEN the bin's shipped source (the built artifact that ships in the tarball)
- WHEN it is statically scanned
- THEN it contains no `eval` call, no `new Function` construction, and no dynamic
  `import()`/`require()` call whose argument is not a literal string

### REQ-TFO-04: Bin Error Path & Success/Failure Discipline

Invoking the bin against a malformed or unparseable `schema.json` MUST exit non-zero, MUST
print a message — to STDERR, never STDOUT — naming the offending file, the parse problem,
and a POSITION LOCATOR (line/column) when the parser can supply one, MUST NEVER echo the
raw contents of the invalid file NOR the underlying third-party parser's own raw error text
(the message MUST be re-expressed in this project's author vocabulary), and MUST NOT emit a
broken or empty `.ts` output file. A malformed re-run MUST NOT delete or overwrite a prior
valid generated output — the failure path is non-destructive. A SUCCESSFUL invocation MUST
exit `0` and either print a fixed, documented success line, or — if design chooses silence —
that silence itself MUST be the documented contract; one of the two, never undocumented
ambiguity.

#### Scenario REQ-TFO-04.1: Malformed schema.json rejected cleanly

- GIVEN a `schema.json` containing invalid JSON (or a shape that is not a valid schema)
- WHEN the bin is invoked against it
- THEN the process exits with a non-zero status code
- AND the printed message names the file path and the specific parse problem, on STDERR
- AND the message does not contain the file's raw invalid content
- AND no generated `.ts` file is written or left over from a prior run

#### Scenario REQ-TFO-04.2: Successful invocation signals success unambiguously (TW-F5/BA-4)

- GIVEN a valid `schema.json`
- WHEN the bin is invoked against it
- THEN it exits `0`
- AND it either prints the documented fixed success line, or — per design's pinned choice —
  produces documented silence; a test asserts whichever the design pins

#### Scenario REQ-TFO-04.3: All bin error output goes to STDERR (TW-F5)

- GIVEN the malformed-schema case from REQ-TFO-04.1
- WHEN the bin's STDOUT and STDERR streams are captured separately
- THEN the error message appears on STDERR and STDOUT is empty

#### Scenario REQ-TFO-04.4: Parse failure carries a position locator (TW-F5)

- GIVEN a `schema.json` with a syntax error at a known line/column
- WHEN the bin is invoked against it
- THEN the printed message includes a line/column locator pointing at the syntax error —
  a locator, never the offending raw content itself

#### Scenario REQ-TFO-04.5: Malformed re-run does not destroy prior valid output (TW-F5)

- GIVEN a factory with a previously-generated, valid `.ts` output committed on disk
- WHEN the bin is re-invoked against a now-malformed `schema.json` and fails
- THEN the previously-generated `.ts` file on disk is unchanged (not deleted, not truncated,
  not overwritten) after the failed invocation

#### Scenario REQ-TFO-04.6: Error language never surfaces the raw third-party parser text (TW-F5)

- GIVEN a `schema.json` parse failure produced internally by whatever JSON/schema-parsing
  library the bin depends on
- WHEN the bin's printed message is inspected
- THEN it is phrased in this project's own author vocabulary (naming file + problem +
  locator) and does not contain the dependency's own raw exception message/class name

### REQ-TFO-05: Write Containment & Fixed Output Location (SEC-B4)

The bin MUST write its generated output ONLY to a fixed location adjacent to the
`factory.ts`/`schema.json` pair it targets (the canonical package shape, REQ-FPS-01) — this
destination is NOT configurable via a CLI flag, environment variable, or any
`schema.json`-derived content. Any candidate output path that would resolve outside the
invoking project's root — an absolute path, or a path containing a `../` segment that
escapes the root — whether supplied via a CLI argument or derived from schema content, MUST
be refused before any write occurs; nothing is ever written outside the project root.

#### Scenario REQ-TFO-05.1: Normal invocation writes only to the fixed adjacent location

- GIVEN a factory package with `factory.ts` and a sibling `schema.json`
- WHEN the bin is invoked against it
- THEN the generated output is written only into that same directory, at the fixed,
  non-configurable path

#### Scenario REQ-TFO-05.2: Path-escaping argument is refused

- GIVEN the bin invoked with an output-path-shaped CLI argument containing `../../etc` or
  an absolute path outside the project root
- WHEN it runs
- THEN it refuses to write, exits non-zero, and nothing is written outside the project root

#### Scenario REQ-TFO-05.3: Schema-derived content cannot influence the output path

- GIVEN a `schema.json` containing a property whose value looks path-shaped
  (e.g. `"../../escape"`)
- WHEN the bin is invoked
- THEN no schema.json content is ever read as, or used to derive, an output destination —
  the output location is structurally fixed, never templated from schema content

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| public-api / supply-chain (new `bin` distribution primitive) | REQ-TFO-03, REQ-TFO-04, REQ-TFO-05 | Yes |

## Next Step

V2 incorporates blind spec-council feedback (QA/SEC/TW findings on bin discipline,
write containment, and static parse-as-data proof). Surface to human for review.
