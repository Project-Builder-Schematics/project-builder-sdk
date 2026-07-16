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

**Next**: S-002 (`addImport` — merge/create/idempotent, coalescing, exact op-set closes).
Requires S-001 (shares `validatedOp`/the three-grammar validator module).
