# Delta for typescript-dialect

**Spec version**: V4
**Status**: signed (owner, 2026-07-14 — V4 scope-reduction per foresight obs #2128)
**Change**: `author-write-surface`

(V4: owner-directed scope reduction at the post-design foresight gate (obs #2128) — the
importable `modify(handle, fn)` calling convention and its run-identity guard subsystem are
DEFERRED out of this change. REQ-TSD-12 (previously the sole entry under ADDED Requirements) is
RETIRED — see the tombstone under REMOVED Requirements below. No other requirement in this
domain changes; REQ-TSD-01 (incl. .3/.4), REQ-TSD-03, REQ-TSD-04 are untouched.)

## REMOVED Requirements

### REQ-TSD-12: Importable `modify(handle, fn)` — equals chained form, exports count unchanged

(Reason: DEFERRED at the post-design foresight gate — owner decision, obs #2128. Foresight
review found the importable calling convention serves ergonomics, not the honesty-rename
problem this change exists to solve, and it was the single largest source of net-new complexity
(a whole run-identity security subsystem, design.md's `#origin`/`#bindOrigin` mechanism) for a
capability the chained form `handle.modify(fn)` (`dialect-generics` REQ-DG-03) already delivers
in full. REQ-TSD-12 is RETIRED, not renumbered — this ID is never reused for a different
requirement. The V3 requirement text and all six scenarios (.1–.6, including the cross-run loud
reject and the throwing-importable containment proof) are preserved as prior art in artefact
history — engram obs #2119 (V3, signed) and this file's git history — for the standalone future
change that ships the importable form; see `project/pending-changes` "foresight gate" section.)

## MODIFIED Requirements

### REQ-TSD-01: Frozen subpath + widened op-pack vocabulary

The TypeScript dialect MUST be reachable at the exact subpath `@pbuilder/sdk/typescript`
(frozen — not `/ts`, not `/typescript-morph`; ADR-0014 amendment). Its op-pack MUST expose
`.modify(fn)` (universal, REQ-DG-03) plus SIX structured ops: `addImport` (frozen name and call
signature, unchanged), `removeImport`, `addFunction`, `addVariable`, `addClass` — WIDENING the
"at most one more" cardinality bound this REQ pinned at V4 (a prior change). `addImport`'s call
signature stays FROZEN as `addImport(name: string, from: string)`. The five new ops' call
signatures are pinned as: `removeImport(name: string, from: string)`; `addFunction(name:
string, source: string, options?: { export?: boolean })`; `addVariable(name: string,
initializer: string, options?: { export?: boolean; kind?: "const" | "let" | "var" })` (`kind`
defaults to `"const"`); `addClass(name: string, source: string, options?: { export?: boolean
})`. This is STILL the only dialect subpath wired by this change — no general dialect-naming
convention is established.

(Previously: named the universal escape hatch `.raw()`. Renamed to `.modify(fn)` —
`dialect-generics` REQ-DG-03's rename. The five structured ops and their call signatures are
UNCHANGED by this change; only the escape-hatch reference renames. V2: added the runtime
collision-hint literal's corrected wording — `src/dialects/typescript/ops.ts`'s
`addFunction`/`addVariable`/`addClass` collision guard emits an author-facing RUNTIME error
whose hint clause named `.raw()`; this reference must migrate in lockstep with the rest of the
rename, and V1 left it unpinned. V3 (this round): added the module-level JSDoc migration
(`src/dialects/typescript/index.ts` lines ~48-49) as its own pinned scenario — REQ-TSD-01.3
covered only the runtime collision-hint string; the author-facing module JSDoc naming `.raw()`
was a second, separate stale reference V2 left unpinned, now caught by `foundations-skeleton`
REQ-KIT-03's repo-wide `.raw(` sweep.)

#### Scenario REQ-TSD-01.1: subpath resolves, exact op-set shape

- GIVEN `package.json#exports`
- WHEN `@pbuilder/sdk/typescript` is imported and `Object.keys(dialect.ops)` is sorted
- THEN it resolves AND the sorted array EQUALS EXACTLY `["addClass", "addFunction", "addImport",
  "addVariable", "removeImport"]` — asserted via `toEqual`, never `toContain`/subset, so an extra
  op fails RED (anti-smuggle) and a missing op fails RED (honest cut-lever tracking)

#### Scenario REQ-TSD-01.2: addImport concrete before/after byte pair

- GIVEN a seeded file `a.ts` with content `const x = 1;\n`
- WHEN `find("a.ts").addImport("readFileSync", "node:fs")` flushes
- THEN the printed content is BYTE-EXACT against a committed golden fixture — e.g.
  `import { readFileSync } from "node:fs";\n\nconst x = 1;\n` — the golden is the source of
  truth for exact insertion position/formatting; this string illustrates the shape

#### Scenario REQ-TSD-01.3: the value-namespace collision hint names the live escape hatch, not the retired one (NEW, V2)

- GIVEN `addFunction`/`addVariable`/`addClass` invoked with a `name` that already collides with
  an existing value/import/enum/namespace binding (ADR-0039)
- WHEN the collision guard throws
- THEN the thrown `dialectError`'s message ends with the BYTE-EXACT clause `…or edit it with
  .modify().` — NOT `…or edit it with .raw().` (the retired V1-era wording still present in
  `src/dialects/typescript/ops.ts:73` before this change) — a guard test pins the corrected
  literal and fails RED if `.raw()` reappears in this runtime message

#### Scenario REQ-TSD-01.4: the module-level JSDoc names the live escape hatch, not the retired one (NEW, V3)

- GIVEN `src/dialects/typescript/index.ts`'s module-level JSDoc (lines ~48-49, above the
  `ts.find`-opening `@example`)
- WHEN scanned
- THEN it reads "...exposing the universal `.modify()` escape hatch..." — NOT "...the universal
  `.raw()` escape hatch..." (the retired V1-era wording still present at this location before
  this change) — this author-facing JSDoc flows into IntelliSense hover text and MUST migrate
  alongside the runtime collision-hint message (REQ-TSD-01.3); `foundations-skeleton`
  REQ-KIT-03's repo-wide `.raw(` sweep enforces this as a fitness check, not a one-time manual
  edit, and fails RED if `.raw()` reappears here

### REQ-TSD-03: Edge scenarios (fail-closed, fidelity, byte/size boundaries)

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

Justification for .10's idempotent ruling: repeated `addImport` calls for the same name+module
are a common byproduct of composed schematics (two independent op invocations importing the
same helper); a naive duplicate-statement output would be redundant, and in some TS contexts
invalid, code.

(Previously: row .3's example named the escape hatch `.raw()`. Renamed to `.modify(fn)` — no
other row changed; the WIRE-level `modify` directive naming used throughout this table (rows
.1/.2/.3/.4/.9) is the unchanged wire op, not the author verb.)

### REQ-TSD-04: `.modify(fn)` and unparseable/unprintable-content containment (real-AST instance of REQ-DG-05)

Restates `dialect-generics` REQ-DG-05 against the REAL TypeScript dialect, not a mock: a
`.modify(fn)` throw, a real ts-morph parse failure, AND a real ts-morph print failure on
corrupted AST state MUST all surface via the SAME interim contained-error contract (pinned
message prefix, no ts-morph internal leak).

(Previously: titled and worded over `.raw()`. Renamed to `.modify(fn)` — the containment
contract itself is unchanged; also previously noted this REQ now covers print failure in
addition to throw + parse failure, closing a followup tracked at a prior archive.)

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

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — `.modify(fn)` on the real ts-morph AST | REQ-TSD-01, REQ-TSD-03, REQ-TSD-04 | Yes |

(REQ-TSD-12's two rows — ts-morph-realm/cross-run-reuse third-party-trust coverage and the
importable-form public-api-contract coverage — are dropped in V4: both existed solely to cover
the now-deferred REQ-TSD-12. No replacement coverage is needed since the requirement itself is
retired, not reworded.)
