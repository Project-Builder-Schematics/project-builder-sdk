# Apply Progress: react-dialect

## S-000 — Walking Skeleton (COMPLETE)

Built `src/dialects/react/{ast,index}.ts`, the `./react` export subpath (5→6), FIT-04/09/14
updated + regenerated baselines, three new fitness functions (fit-36 spike-deps-absent,
fit-37 core/commons-ast-free, fit-38 parser-construction-confinement), and
`test/dialects/react/dialect.test.ts` (all REQ-RXD-02/.03 S-000 acceptance scenarios). All
tasks S-000.1–.6 marked `[x]` in `slices.md`. Suite 1639→1674, 0 fail.

## S-001 — `setJsxProp` + validator core (COMPLETE)

**Files created**: `src/core/jsx-name-validator.ts` (three grammars + frozen V4 denylist
`Set` + `validatedOp` chokepoint, kit-internal no barrel), `src/core/reject-tail.ts`
(`nameRuleTail`/`boundedFragment`, zero-echo by default), `src/dialects/react/ops.ts`
(`setJsxProp`), `test/dialects/react/ops.test.ts`, `test/dialects/react/name-validation.test.ts`,
`test/dialects/react/golden/*.txt` (10 goldens).

**Files modified**: `src/dialects/react/index.ts` (`ReactOps` widened with `setJsxProp`;
JSDoc's "future setJsxProp" phrase corrected to present tense), `test/dialects/react/dialect.test.ts`
(+REQ-RXD-10 placement describe block), `test/security/canary-no-echo.test.ts` (+REQ-RXD-13.1
react case reusing the existing `surfaceContains`), `test/fitness/dts-baseline/react.index.d.ts`
(regenerated — `ReactOps` type widened changes the emitted `.d.ts` line even though op JSDoc
doesn't reach `.d.ts`), `test/fitness/pkg-surface-baseline.json` (regenerated — +6 tarball
entries for the two new `src/core/*.ts` files and `src/dialects/react/ops.ts`).

All tasks S-001.1–.5 marked `[x]` in `slices.md`. Suite 1674→1735 (net +61), 0 fail. Full
`bun test` + `tsc --noEmit` green.

**Apply-time finding (REQ-RXD-11.5, non-blocking, routed not halted)**: the spec's literal
example — `setJsxProp("Button", "data-x", "{")`, an UNTERMINATED delimiter — cannot succeed via
ts-morph's structured API. Verified directly (ts-morph@28.0.0): `addAttribute`/`setInitializer`
reparse-and-reconcile the WHOLE file after every structural edit; an unclosed `{` swallows every
subsequent token into one broken expression, so the reconcile throws `Manipulation error: A
syntax error was inserted.` before `print()` is ever reached. This is intrinsic to ts-morph's
architecture, not an SDK choice, and staying inside ADR-03 (structured API only, text-splice
forbidden) means there is no workaround. A delimiter-BALANCED-but-semantically-malformed value
(`'{1+}'`) proves the scenario's real substance (no output re-validation of `value`) and is what
`ops.test.ts` asserts for REQ-RXD-11.5; a second, adjacent test pins that the genuinely
unterminated case still fails SAFELY — contained via the existing `#invokeContained` foreign-
error wrap, zero directives, file byte-unchanged — not a silent corruption or a leak.
**Recommendation**: amend REQ-RXD-11.5's example to a delimiter-balanced value at the next spec
touch (wording fix, not a scope/behavior change).

### Fix iteration 1 (verify-in-loop-2 NEEDS_FIX → resolved)

Both findings were additive tests — no production code changed.

1. **CRITICAL (ops.ts:59 `removeInitializer()` branch untested)**: added two tests to
   `ops.test.ts` — "REQ-RXD-11.3 (upsert half)": `<Input required={maybe} />` +
   `setJsxProp("Input", "required")` → bare `required`, byte-exact vs new golden
   `setprop-shorthand-downgrade.txt`; plus a mid-position triangulation
   (`setprop-shorthand-downgrade-mid.txt`) proving attribute position survives the downgrade.
   RED-proof: both goldens were first committed with deliberately WRONG content (initializer
   retained) and the tests observed failing on the golden comparison before the correct
   goldens landed.
2. **WARNING (REQ-RXD-06.5 end-to-end coverage 1/10 propName, 0/10 elementName)**: added a
   table-driven end-to-end describe block to `name-validation.test.ts` — all 10 hostile
   values × both name args (20 cases) through `react.find().setJsxProp()` via spy-client,
   each asserting: validator-SHAPED message (names the argument — this is what distinguishes
   a wired validator reject from an accidental zero-match reject), no value echo (non-empty,
   non-denylist), zero directives, file byte-unchanged. Discrimination proven by mutation
   probe: temporarily unwiring `assertValidElementName` failed exactly the 10 elementName
   cases; wiring restored, all green.

Suite after fix iteration: 1735→1757 (net +22), 0 fail, `tsc --noEmit` clean.

## S-002 — `addImport` + coalescing + exact op-set closes (COMPLETE)

**Files modified**: `src/dialects/react/ops.ts` (+`addImport`, `validatedOp`-wrapped on `name`
via `assertValidImportBinding`; `from` unvalidated — its safety rests on ts-morph's
string-literal escaping, per ADR-05, written fresh, not copied from the TS dialect's lax
`addImport`), `src/dialects/react/index.ts` (`ReactOps` widened to the final, closed two-op
shape — `setJsxProp` + `addImport`; op-pack composed with both), `test/dialects/react/ops.test.ts`
(+10 tests: REQ-RXD-05.1–.4 merge/create/idempotent/named-only, REQ-RXD-06.3/.4 SEC-3 breakout
reject + SEC-4 escape pin), `test/dialects/react/dialect.test.ts` (+REQ-RXD-07.1 coalescing —
`setJsxProp` + `addImport` on one handle, exactly one `modify` directive, byte-exact golden),
`test/dialects/react/name-validation.test.ts` (+REQ-RXD-13.2 addImport-validator-reject and
extension-gate-in-run-form cases, completing the four-path zero-emit matrix S-001 started),
`test/fitness/dts-baseline/react.index.d.ts` (regenerated — `ReactOps` type gains `addImport`,
additive-only diff, confirmed via `diff` against a fresh `bun run build` before committing).

**Files created**: `test/dialects/react/ops-exact-set.test.ts` (REQ-RXD-01.1 full — sorted
`Object.keys` minus `RESERVED_HANDLE_NAMES` `toEqual(["addImport", "setJsxProp"])`),
`test/dialects/react/golden/{addimport-fresh,coalesce-setprop-addimport}.txt`.

**No changes needed**: `test/fitness/pkg-surface-baseline.json` — S-002 added zero new `dist/`
files (`ops.ts`/`.js`/`.d.ts` already existed from S-001), so the tarball entry list is
unaffected; confirmed via full suite green without touching it.

**Apply-time finding (Set-key-safety static scan false positive, resolved in-slice)**:
`name-validation.test.ts`'s existing regex `/\[\s*(?:propName|elementName|name|tag)\s*\]/`
flagged `addImport`'s legitimate `([name]) => {...}` (validators-tuple destructuring) and
`namedImports: [name]` (single-element array literal) as forbidden `record[name]`-style
bracket-indexed property access — a false positive: neither shape uses `name` as an object/Map
key. Root cause: the original regex matched the bracket's CONTENTS only, blind to what
precedes `[`, so it could not distinguish `record[name]` from `[name]` occurring inside array
literals or destructuring patterns. Fixed by requiring the character immediately before `[` to
be a word character/`$`/`)`/`]`/`{` (member-access or computed-key shape) via
`FORBIDDEN_NAME_KEY_ACCESS = /[\w$)\]{]\[\s*(?:propName|elementName|name|tag)\s*\]/` — verified
with two new tests: one proving the tightened regex still catches `record[name]`,
`{[name]: value}`, `counts[tag]++`; one proving it no longer flags `namedImports: [name]`,
`([name]) => {}`, `const [name] = args;`. The Set-key-safety PROPERTY itself (never index an
object/Map by `propName`/`elementName`/`name`/`tag`) is unchanged and un-weakened — only the
scanner's precision improved.

Suite after S-002: 1757→1769 (net +12: 6 in ops.test.ts, 1 coalescing in dialect.test.ts, 4 in
name-validation.test.ts [2 REQ-RXD-13.2 cases + 2 regex self-tests], 1 in the new
ops-exact-set.test.ts). 0 fail. `tsc --noEmit` clean. All tasks S-002.1–.4 marked `[x]` in
`slices.md`.

**TDD process record (self-correction, S-002 base commit `fcd24d7`)**: the `addImport`
implementation body and its `ops.test.ts` tests were written in the same editing pass —
implementation slightly AHEAD of watching the tests fail, a Strict TDD ordering violation.
The gap was closed retroactively BEFORE the base commit, in two explicit probe steps, both
observed in real runner output:

1. **`addImport` body probe**: the mutation body was replaced with a no-op stub
   (`// TDD-RED-STUB` + early return, validators left wired) and
   `bun test test/dialects/react/ops.test.ts` run → **19 pass / 5 fail**; the five failures
   were exactly the body-dependent scenarios (REQ-RXD-05.1 "Expected: import { useState } …
   Received: undefined", 05.2 same shape, 05.3 "Expected length: 1, Received length: 0",
   05.4 and 06.4 undefined-directive failures) — assertion-level failures, not import/syntax
   errors, i.e. RED for the right reason. REQ-RXD-06.3 kept passing under the stub, correctly:
   its reject fires in the validator, before the stubbed body. Stub removed; suite green.
2. **Exact-op-set probe**: `ops-exact-set.test.ts` was RED-proven by composing the op-pack
   with `{ setJsxProp } as ReactOps` (addImport temporarily excluded) →
   `expect(opKeys).toEqual(["addImport","setJsxProp"])` failed with `- "addImport"` in the
   diff; pack restored, test green.

Why the surviving tests are discriminating despite the ordering violation: verify-in-loop-4's
own independent mutation probes (A: body no-op → exactly the 6 body-dependent tests fail;
B: idempotency guard removed → exactly REQ-RXD-05.3 fails; C: validator unwired → exactly the
two validator-shaped tests fail) triangulate every S-002 behavior branch to at least one test
that moves when that branch is broken. This paragraph exists because the event was initially
reported only in the return envelope, NOT here — verify-in-loop-4 Finding 2 correctly flagged
the omission; the record above is the reconciliation, not a new event.

### Fix iteration 1 (verify-in-loop-4 NEEDS_FIX → resolved)

Finding 1 (CRITICAL, req-coverage-gap, test-only): REQ-RXD-06.5's clause "and, where the
grammar applies, as `addImport.name`" scopes the FULL 10-value hostile battery to `addImport`
(all 10 are grammar-invalid or denylisted under `IMPORT_BINDING_GRAMMAR`), but only 1/10
values went through `addImport` end-to-end. Fixed by EXTENDING the existing table-driven
loop in `name-validation.test.ts` (not duplicating the table): the arg dimension grew from
`["propName", "elementName"]` to `["propName", "elementName", "name"]`, with the `"name"` arm
routing through `react.find("Button.tsx").addImport(hostile, "react")` — same assertions as
the S-001 arms (Error instance, message names the ARGUMENT, no value echo for
non-denylisted/non-empty values, zero directives, file byte-unchanged). 20→30 loop cases.
Test titles now carry the owning op (`setJsxProp.propName …` / `addImport.name …`).

Discrimination proven by mutation probe (behavior pre-exists, so first-run green is expected;
the probe is the RED substitute, per the S-001 fix-iteration precedent):
`assertValidImportBinding` temporarily unwired from `addImport`'s validator closure →
`bun test test/dialects/react/` = 97 pass / **12 fail** — exactly the 10 new
`addImport.name` battery cases + the 2 pre-existing addImport validator tests (REQ-RXD-06.3,
REQ-RXD-13.2 addImport path); every other test unmoved. Validator rewired → 109/0;
`git diff src/dialects/react/ops.ts` empty (probe fully reverted). The message assertion
(`toContain("name")`) is what discriminates: an unwired hostile name either splices raw (no
error) or dies inside ts-morph as a contained foreign throw (`addImport() on "…" threw`) —
neither surface contains `name`.

Finding 2 (WARNING, record reconciliation, docs-only): the TDD self-correction record above
was appended to this artefact and mirrored to engram obs #1077 — it had previously existed
only in the builder's return envelope, and obs #1077's "S-002 clean through, no fix
iteration" wording is corrected by this iteration's existence.

Zero production-code changes in this iteration. Suite after fix iteration: 1769→1779
(net +10), 0 fail, `tsc --noEmit` clean.

**Next**: S-003 (conformance corpus), S-004 (docs), S-005 (installed-consumer parity) — all
require only S-002 and are parallel-safe among themselves per Build Order.
