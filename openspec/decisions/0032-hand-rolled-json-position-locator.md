# ADR-0032: Hand-rolled JSON position locator (supersedes ADR-0027 Gap-8 engine-message extraction)

- Status: Accepted (2026-07-11, promoted at stage-4-typed-options archive)
- Date: 2026-07-10
- Change: `stage-4-typed-options` (in-loop fix on S-001/S-002)
- Supersedes: ADR-0027 "Parse-error locator (Gap 8)" — the `at position N` engine-message extraction
- Builds on: ADR-0027 (zero-dep hand-rolled codegen style)

## Context

ADR-0027 (Gap 8) banked the parse-error `(line L, column C)` locator on extracting an `at position N`
byte offset from `JSON.parse`'s `SyntaxError.message`. That message is V8-specific. This SDK's
guaranteed runtime is **Bun** (JavaScriptCore), whose `JSON.parse` NEVER emits a byte offset — it
produces messages like `JSON Parse error: Unexpected EOF` / `Expected '}'` / `Property name must be a
string literal`. Verified against `bun 1.3.11` with six independent malformed-JSON probes
(`verify-in-loop-2.md`): not one carried a position. Consequently `schema-parse.ts`'s
`locateFromSyntaxError` regex (`/at position (\d+)/`) is DEAD under Bun — every malformed input falls
into the `(position unknown)` fallback, so REQ-TFO-04.4 ("parse failure carries a position locator")
can never fire its position-known branch through native `JSON.parse`.

Owner ruling (2026-07-10, binding): RE-DESIGN, not re-spec. Keep the REQ-TFO-04.4 scenario as signed.
Derive the locator ourselves — consistent with this change's already-ratified zero-dep hand-rolled
style (ADR-0027).

## Decision

Add a zero-dependency, pure-function **position locator** in a new module
`src/core/schema/schema-locate.ts`, consumed by `schema-parse.ts` in its `JSON.parse` catch branch.
It replaces engine-message extraction with a re-scan of the raw text.

**Contract.**

```ts
// src/core/schema/schema-locate.ts
export function locateFirstJsonSyntaxError(
  raw: string,
): { line: number; column: number } | undefined;
```

Returns the 1-based `{ line, column }` of the FIRST offset where `raw` deviates from the JSON grammar,
or `undefined` when the scanner completes without pinning a deviation (→ the caller's pinned
`(position unknown)` fallback). Pure, no I/O, engine-independent.

**Scan strategy — a minimal JSON syntax scanner (not a value builder).** A single left-to-right walk
with a 0-based offset cursor over the JSON grammar: skips whitespace; consumes the structural
characters `{ } [ ] : ,`; consumes string literals (open `"` → to closing `"`, honoring a backslash as
"escape-next-char"); consumes number tokens and the keywords `true`/`false`/`null`. It tracks the
minimal state needed to know what token is legal next (after `{`: a string key or `}`; after a key: `:`;
after a value: `,` or the matching close; etc.). On the first character that cannot legally start or
continue a value in the current state — OR on premature EOF while a value/string/closing token is still
expected — it returns the cursor offset. Offset → `(line, column)` by counting `\n` up to the offset
(1-based line) and taking `column = offset − indexAfterLastNewline + 1` (1-based) — the same byte-offset
walk ADR-0027 already specified, now fed a scanner-derived offset instead of an engine-derived one. The
scanner never builds a value: the happy path is still native `JSON.parse` (the scanner runs ONLY in the
catch branch, on an already-rejected small dev-time file — no hot path).

**Fidelity boundary — what "best-effort" means (pinned so both branches are deterministically
testable).**

- **MUST pin a position** (the structural classes native `JSON.parse` rejects, including all six
  `verify-in-loop-2` probes): premature EOF / truncation; a character where a value, key, `:`, `,`, or
  a closing bracket is expected (unquoted key, stray/garbage token, non-string property name); a
  trailing comma; a malformed keyword or number token.
- **MAY return `undefined`** (→ `(position unknown)`): an **in-string escape-sequence violation** — a
  bad `\u` hex quad or an invalid escape char — because the scanner consumes strings structurally
  (backslash escapes the next char) and deliberately does NOT validate escape internals; and the
  defensive scanner↔`JSON.parse` divergence case (scanner finds the input grammatically complete though
  `JSON.parse` threw). This bounded boundary keeps the scanner minimal AND gives REQ-TFO-04.4 a real
  malformed fixture for its fallback branch.

**Non-syntax "invalid shape" is out of scope for the locator.** A structurally valid JSON document that
merely lacks a `"properties"` object is NOT a syntax error; `parseSchema` throws that branch with
`line/column: undefined` (unchanged) → `(position unknown)`. The scanner is not consulted there.

**One locator serves both surfaces.** `schema-parse.ts` is the single wiring point: it populates
`SchemaParseFailure.line`/`.column` from `locateFirstJsonSyntaxError(raw)`. Both consumers read those
fields unchanged — the bin CLI's `formatParseError` (`pbuilder-codegen: <file>: <problem> (line L,
column C)`, S-001) and the runtime RBV-05.1 formatter (`[pbuilder] factory at <dir>: schema.json could
not be read: <problem> (line L, column C)`, S-003+). No formatter changes; the message formats are
unchanged, the position slot is simply populated when the scanner pins one.

## Consequences

- REQ-TFO-04.4's position-known branch is now genuinely reachable under Bun with real malformed
  fixtures — no engine-dependent assumption survives.
- Both the bin and the runtime fail-closed paths gain accurate line/column for free (shared
  `SchemaParseFailure`), including multi-line schema files.
- Cost: the SDK maintains a small JSON syntax scanner. Bounded by the pinned fidelity boundary (no
  in-string escape validation) — kept honest by a fallback fixture rather than pretending full fidelity.
- `schema-parse.ts`'s `locateFromSyntaxError` (the dead regex branch) is deleted; `err.message` is no
  longer inspected for a position.

## Alternatives Considered

- **Relax REQ-TFO-04.4 to fallback-only (re-spec)**: rejected by owner — the scenario's promise (a
  locator pointing at the error) is worth keeping; the mechanism, not the requirement, was wrong.
- **A JSON-parsing dependency that reports offsets**: violates ADR-0009/0027 zero-dep stance and drags
  a supply-chain surface for a dev-time nicety.
- **Full-fidelity scanner (validate `\u` hex, all escape internals)**: more code for no user-visible
  gain, and it would leave the `(position unknown)` fallback branch with no real fixture to exercise it
  (dead-but-untestable code). The bounded boundary is deliberately chosen so both branches stay live.
