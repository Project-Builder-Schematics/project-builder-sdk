# Read From Disk — Trichotomy (new capability)

**Spec version**: V1
**Status**: signed (orchestrator 2026-06-22)
**Change**: `typed-options-and-read` (#2 of l1-author-surface)
**Touches**: the read path `find(path).read()` → `Session.read` → `EngineClient.read`, and the contract fake.

## Purpose
Give schematic authors a branchable read-from-disk: `find(path).read()` returns the file content, or a
distinct sentinel for "file does not exist", or empty-string for "file exists but is empty" — so an author
can write idempotent/upsert flows without conflating absent and empty. Read-DISK only (against the engine's
`fs.readFile`); read-staged / read-your-own-writes stays engine-gated (§6) and is owned by #3.

## ADDED Requirements

### REQ-RD-01: Read Trichotomy — content / not-found→`undefined` / empty→`""`

`find(path).read()` MUST resolve to **`Promise<string | undefined>`** with exactly three outcomes:
the file's content (a string) when the path exists with content; **`undefined`** when the path does NOT
exist; and the empty string **`""`** when the path exists but is empty. `undefined` and `""` MUST be
distinguishable — a not-found MUST NOT collapse to `""`, and an empty file MUST NOT collapse to `undefined`.
Implementations MUST NOT use truthiness/`||`-coalescing to produce the sentinel (it would merge `""`, `"0"`,
`"false"` with not-found).

#### Scenario REQ-RD-01.1: Existing file returns its exact content
- GIVEN a disk seeded with `{"src/a.ts": "export const x = 1;"}`
- WHEN the author `await find("src/a.ts").read()`
- THEN the result is exactly `"export const x = 1;"`

#### Scenario REQ-RD-01.2: Not-found returns `undefined`
- GIVEN a disk with no `src/missing.ts`
- WHEN the author `await find("src/missing.ts").read()`
- THEN the result is `undefined` (strictly `=== undefined`)

#### Scenario REQ-RD-01.3: Empty file returns `""`, distinct from not-found
- GIVEN a disk seeded with `{"src/blank.ts": ""}`
- WHEN the author `await find("src/blank.ts").read()`
- THEN the result is `""` (strictly `=== ""`) AND `!== undefined`

#### Scenario REQ-RD-01.4: Whitespace-only content is preserved, not normalised
- GIVEN a disk seeded with `{"src/w.ts": "   \n"}`
- WHEN the author reads it
- THEN the result is exactly `"   \n"` (not trimmed, not `""`, not `undefined`)

#### Scenario REQ-RD-01.5: Falsy-string content is preserved (kills truthiness-collapse mutant)
- GIVEN a disk seeded with `{"src/z.ts": "0", "src/f.ts": "false"}`
- WHEN the author reads each
- THEN `read("src/z.ts") === "0"` AND `read("src/f.ts") === "false"` (neither `undefined` nor `""`)

#### Scenario REQ-RD-01.6: The three outcomes are statically branchable
- GIVEN the trichotomy fixtures (content, not-found, empty)
- WHEN the author writes `if (c === undefined) {…} else if (c === "") {…} else {…}`
- THEN each branch is reachable and hit by its corresponding fixture

### REQ-RD-02: Not-Found Is `undefined`, Not a Throw (behaviour change)

Reading a path that does NOT exist MUST resolve to `undefined`, NOT throw. This is a behaviour change from
the prior contract where the engine seam threw on not-found. Genuine read FAILURES (permission/transport
errors) are out of scope for #2 — they remain throws and their author-facing attribution is owned by #3;
#2 maps ONLY absence to `undefined`.

#### Scenario REQ-RD-02.1: Absent path does not throw
- GIVEN a disk with no `src/none.ts`
- WHEN the author `await find("src/none.ts").read()`
- THEN no error is thrown AND the resolved value is `undefined`

### REQ-RD-03: Frozen Signature + Wire→`undefined` Translation

The read return type `Promise<string | undefined>` MUST be reflected in the emitted public `.d.ts`
(`ReadOps.read`), with the FIT-04 semver baseline regenerated to match (the gate going green is the proof
the new frozen surface is intentional). Because `undefined` is not JSON-representable, the JSON-RPC wire
(`tree.read`) carries not-found as absence/null and the SDK MUST translate it to `undefined` at the TS
boundary; the contract fake MUST model `read()→undefined` on not-found (seeded `""` → `""` via key
membership, never truthiness).

#### Scenario REQ-RD-03.1: Public read signature is frozen in the .d.ts baseline
- GIVEN the emitted `dist/core/base-handle.d.ts`
- WHEN FIT-04 diffs it against the regenerated baseline
- THEN `read()` resolves `Promise<string | undefined>` and the gate is green against the new baseline

#### Scenario REQ-RD-03.2: Fake models absence as `undefined` via key membership
- GIVEN the contract fake seeded with `{"src/e.ts": ""}` and no `src/x.ts`
- WHEN `read("src/e.ts")` and `read("src/x.ts")` are evaluated
- THEN the first is `""` and the second is `undefined` (membership test, not a truthiness check)

## Out of scope (named, not smuggled)
- Read-staged / read-your-own-writes (the author's just-written, uncommitted file) — engine §6, #3.
- Typed-error attribution for genuine read failures (permission/transport) — #3.
- A standalone `read(path)` commons export — rejected (handle-only).
