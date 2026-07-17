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

**CORRECTION (2026-07-17, council QA-5 fix pass) — the paragraph above is WRONG.** `toContain("name")`
does NOT discriminate: `"propName"` contains the substring `"name"`, so pointing `addImport` at
the WRONG validator (`assertValidAttributeName` instead of `assertValidImportBinding`) still
produces a `propName`-shaped message that satisfies `.toContain("name")`. The claim above was
reached by generalising from a single ABSENCE-mutant probe (validator unwired entirely) to a
broader claim that probe never tested — the exact self-selected-exam failure the Council's
mutation-probe amendment names. See `council-findings.md` QA-5 and the "Fix Pass" section below
for the NEAR-MISS mutant that actually reproduces and then closes this gap (backtick-bounded
`.toContain(\`${argName}\`)`, since every react reject tail names its argument as `` `${argName}` ``,
and `` `name` `` is not a substring of `` `propName` ``).

Finding 2 (WARNING, record reconciliation, docs-only): the TDD self-correction record above
was appended to this artefact and mirrored to engram obs #1077 — it had previously existed
only in the builder's return envelope, and obs #1077's "S-002 clean through, no fix
iteration" wording is corrected by this iteration's existence.

Zero production-code changes in this iteration. Suite after fix iteration: 1769→1779
(net +10), 0 fail, `tsc --noEmit` clean.

## S-003 — Conformance: 20-sample JSX adversarial corpus (COMPLETE)

**Files created**: `test/conformance/react-conformance.test.ts` — fixture dialect/op-pack
assembled from the real production building blocks (`defineDialect`/`defineOpPack`/`withOps`
over `react/ast.ts`'s parse/print + `react/ops.ts`'s `setJsxProp`/`addImport`), per ADR-0012,
mirroring `test/conformance/typescript-conformance.test.ts`'s own pattern.

- **REQ-RXD-08.1**: 19 round-trip corpus samples (fragments, self-closing, expression
  containers, spread props, namespaced attribute, HTML entities, `{/* comment */}`,
  logical-AND, ternary, parenthesised return, template-literal JSX-lookalike, string-child
  JSX-lookalike, `<br />`/`<br/>` whitespace fidelity, TSX generic-arrow, `<Menu.Item/>`,
  multi-line-attribute element, CRLF, BOM, 4 MiB) driven through `testDialect` (which also
  injects the 6 kit-mandatory samples). The 20th corpus class — the angle-bracket-cast
  divergence probe (`const x = <string>y;`) — is DELIBERATELY excluded from the round-trip
  array (it is a parse-REJECT sample per its own contract, not a round-trip one) and asserted
  separately via a direct `dialect.ast.parse(...).toThrow()` check.
- **REQ-RXD-08.2**: `testOpPack` fixture with three exercises — `<Menu.Item/>` as a
  boolean-shorthand insertion target, the multi-line-attribute element as an insertion target
  (both reusing the S-001 goldens `setprop-boolean-namespaced.txt` /
  `setprop-multiline-before/after.txt` — the same fixture proven again through the
  conformance kit's distinct execution path), and a heterogeneous `setJsxProp`+`addImport`
  chain (reusing the S-002 golden `coalesce-setprop-addimport.txt`) that satisfies
  `testOpPack`'s own mandatory multi-op-exercise rule and REQ-RXD-07's coalescing proof per
  the slice's own Contracts note.

**TDD note (disclosed, not a violation)**: every op/parse/print this slice's tests exercise
was already implemented in S-000–S-002 — this slice wires EXISTING, already-verified
behaviour into a new corpus/conformance surface, not new production code. Writing the tests
first and running them passed immediately on first run (3/3), which Strict TDD's own RED
phase flags as suspect ("either the behaviour already exists, or the test asserts nothing
real"). Per the precedent this change already established at S-002's fix iteration
(`verify-in-loop-4`/`-5`: "Discrimination proven by mutation probe... the probe is the RED
substitute" for slices wiring pre-existing behaviour), three independent mutation probes were
run and reverted, each isolating ONE describe block:

1. `react/ast.ts print()` appended a marker suffix → round-trip test (19+6 samples) AND the
   op-pack fidelity test both failed (2/3); the divergence-probe test was correctly unmoved.
   Reverted; `git status --porcelain`/`diff` empty.
2. `react/ast.ts parse()`'s syntactic-diagnostic throw was short-circuited (`if (false && ...)`)
   → ONLY the divergence-probe test failed (1/3); round-trip and op-pack tests unmoved.
   Reverted; clean.
3. `react/ops.ts setJsxProp`'s `element.addAttribute(...)` call was replaced with a no-op →
   ONLY the op-pack fidelity test failed (1/3); round-trip and divergence-probe tests unmoved.
   Reverted; clean.

Each probe touched exactly the mechanism its corresponding test claims to prove, and only that
test moved — confirming the three describe blocks are independently discriminating, not
mutually redundant or vacuous.

Suite: scoped run (`test/dialects/react/`, `test/conformance/`, the six relevant fitness
files, `test/security/canary-no-echo.test.ts`) — 229 pass / 0 fail. `tsc --noEmit` clean. All
tasks S-003.1–.2 marked `[x]` in `slices.md`.

## S-004 — Docs: worked example, trust posture, honest limitations (COMPLETE)

**Files created**: `test/dialects/react/docs.test.ts` — 15 tests, guard-asserting: the
two-dialect intro reframe (REQ-RXD-09.4, no sentence describes `./typescript` as the only
shipped dialect); the React section names both shipped ops, v1 minimality, the op-catalog
follow-up, and `.modify(fn)` (REQ-RXD-09.1); the coalesced `addImport`+`setJsxProp` worked
example with `// ->` output (REQ-RXD-09.2); the `value`-trust and spread-precedence pinned
sentinel sections, each with a red-proof that fails if the section is removed (REQ-RXD-09.3,
mirrors `test/docs/security-authoring-guard.test.ts`'s REQ-DAS-01.2 pattern); the
explicit-`.tsx`-extension requirement in BOTH `find`'s JSDoc and the worked-example section
(REQ-RXD-09.5); and README's doc-index line naming `@pbuilder/sdk/react`.

**Files modified**: `docs/authoring-a-dialect.md` (intro paragraph reframed to name both
shipped dialects; new `### \`@pbuilder/sdk/react\` — a second dialect` section — minimality
framing, the coalesced worked example, `value`-trust and spread-precedence subsections),
`README.md` (line-12 doc-index example gains `@pbuilder/sdk/react`).

**True TDD cycle (RED was genuine here — no mutation probe needed)**: unlike S-003, this
slice's tests assert prose that did not exist yet. `docs.test.ts` was written FIRST and run —
11/15 failed for the right reason (missing sections/sentences: `error: missing the "###
\`@pbuilder/sdk/react\` — a second dialect" section`, `Expected to contain: "The SDK performs
no validation..."`, etc.). Two test bugs surfaced and were fixed BEFORE any doc content was
written (README paragraph-boundary detection was line-scoped but the target sentence wraps
across two source lines; the intro-paragraph check indexed the wrong `\n\n`-split segment) —
both are test-file corrections, not implementation written ahead of a test. The doc content
was then written to match; two further RED iterations surfaced REAL wording mismatches
(the spread-precedence sentinel ended its clause with `):` in the doc vs `).` in the pinned
constant; two pinned sentences were markdown-wrapped across lines, so `toContain` legitimately
failed against the wrapped text) — each was fixed by adjusting the DOC prose to stay unwrapped
for the pinned sentence, matching this repo's existing precedent (`SECURITY.md`'s own pinned
sentences are single unwrapped lines, per `test/docs/security-authoring-guard.test.ts`), never
by loosening the test assertion. Final run: 15/15 pass.

Suite: `docs.test.ts` 15/15; `test/dialects/react/` + `test/docs/` 187/188 (1 unrelated
subprocess-timeout flake in `testing-story-docs.test.ts`'s `dry-run.md` fence-compile check —
reproduced GREEN in isolation immediately after, confirming the environmental-flakiness
pattern already diagnosed for this working directory, not a regression from this slice).
`tsc --noEmit` clean. All tasks S-004.1–.4 marked `[x]` in `slices.md` (S-004.4 is N/A: `find`'s
JSDoc text was not touched by this slice, so no `.d.ts` baseline regen was needed).

## S-005 — Installed-consumer six-subpath parity (COMPLETE)

**Files modified**: `test/e2e/installed-consumer.e2e.test.ts` — both legs' `check-resolution.mjs`
probe object gained a `react: await probe("@pbuilder/sdk/react")` entry; both legs' assertions
gained `expect(results.react?.resolved).toBe(true)` (tarball leg also asserts
`hasDefineFactory === false`, matching the `./typescript` probe's own shape); both `it()` titles
and the bun-link leg's inline comments updated from "five" to "six" subpaths. REQ-LC-02.3's
own count-parity check needed NO edit — it is already STRUCTURAL (scans both legs'
`describe` blocks for calls to the five shared scenario helpers + counts top-level `it()`s),
not a hardcoded subpath count.

**TDD note (disclosed, mutation-probe RED substitute — same posture as S-003)**: `./react`
already resolved via both install vehicles (the `./react` export was added in S-000, proven at
the unit level by `fit-09`/`fit-14`); this slice wires that pre-existing capability into the
e2e installed-consumer proof, so the new assertions passed on first run (16/16). Mutation
probe: temporarily removed the `./react` entry from `package.json#exports`, re-ran the full
e2e file — exactly the two new `results.react?.resolved` assertions failed (one per leg, tarball
+ bun-link), all 14 other scenarios (including the cross-leg structural red-proofs) stayed
green. Reverted `package.json`; `git diff --stat`/`git status --porcelain package.json` empty;
re-ran — 16/16 green again.

**Environmental note**: this e2e file triggers `bun run build` (full `prebuild`+`tsc -p
tsconfig.build.json`) plus `bun pm pack`/`bun install --ignore-scripts` (tarball leg) and `bun
link` (bun-link leg) per process — the exact subprocess-bound shape flagged as flaky in this
working directory. Both the pre-mutation and post-revert runs completed cleanly in ~6-7s with
no timeout (`bun test --timeout 180000` used defensively; the runs never approached it) — no
flakiness observed for this slice's own scope.

Suite: `test/e2e/installed-consumer.e2e.test.ts` 16/16, `tsc --noEmit` clean. All tasks
S-005.1–.2 marked `[x]` in `slices.md`.

## Batch summary (S-003 + S-004 + S-005)

All three slices DONE. Scoped combined suite (`test/dialects/react/`, `test/conformance/`,
`test/e2e/installed-consumer.e2e.test.ts`, the react-relevant fitness files,
`test/security/canary-no-echo.test.ts`) is green throughout; `tsc --noEmit` clean throughout.
No production code was changed by this batch — S-003/S-004/S-005 are test- and docs-only
slices per their own Tasks lists; every mutation probe above was reverted with a verified-empty
diff before moving to the next slice. This closes ALL six slices of `react-dialect`
(S-000..S-005) — the change is now complete pending in-loop re-verification of this batch and
the final `sdd-verify --mode=final` gate.

**Full-suite number, from a trustworthy location** (per the known ~/Documents subprocess-timeout
flakiness — `bun install`/`tsc --noEmit` blocking-`spawnSync` calls hitting bun's default
5000ms test timeout under first-touch file-scanning contention, pre-existing debt, out of this
change's scope): `git worktree add /private/tmp/react-dialect-verify-worktree HEAD` at commit
`0257e5c` (this batch's bookkeeping commit) + `bun install` there, then `bun test` run TWICE —
**1797 pass / 0 fail** both times (1779 baseline + 18 net new: 3 in `react-conformance.test.ts`,
15 in `docs.test.ts`, 0 net-new `it`s in the e2e file since S-005 extended 2 existing `it`s
rather than adding new ones — verified via `git diff --stat` across the batch's 4 commits).
Worktree removed after (`git worktree remove --force`). No failures, no flakiness, in either run.

## Fix Pass — Council V5 corrections (spec V5 owner-signed 2026-07-17)

Owner ruling: spec-first, then apply. All nine routed items applied against V5. Commits:
`2079023` (item 1), `5749bf2` (items 2 + most of item 5/QA-5 — see note below), `e142c3d`
(item 9), `24b8227` (item 4), `5a7c719` (items 6, 7, 8), `610650a` (apply-progress correction).

### Status per item

1. **`addImport` shape bug (REQ-RXD-05 V5) — DONE.** Rewrote the merge-target lookup around a
   LOCAL NAME concept (`localNamesBoundBy`) and scoped the merge target to non-type-only
   `NamedImports` clauses (`isNonTypeOnlyNamedImportClause`), per the spec's three-step
   algorithm. `src/dialects/react/ops.ts`. Fixes QA-1 (type-only clause), QA-2 (default-import
   duplicate binding), QA-3 (namespace hard-throw), QA-4 (aliased silent no-op).
2. **SEC-1 reserved words (REQ-RXD-06.7) — DONE.** `IMPORT_RESERVED_WORDS` (46 entries: 36
   always-reserved + 9 strict-mode-reserved + `await`), `.has()` equality, wired into
   `assertValidImportBinding` alongside the existing grammar/denylist checks.
   `src/core/jsx-name-validator.ts`.
3. **SEC-2 Set-key-safety (REQ-RXD-06.8) — ALREADY SATISFIED, verified not re-broken.** The
   static scan (`test/dialects/react/name-validation.test.ts`, "Set-key-safety static scan"
   describe block) was built in S-001 and already covers `src/core/jsx-name-validator.ts` +
   every file under `src/dialects/react/**` — a superset of the scenario's stated scope. My new
   `addImport` code (item 1) uses `.includes()`/`.find()` on plain arrays, never bracket-indexed
   object access by name — re-ran the scan after the rewrite, still 0 matches.
4. **F-01/DOC-1 false `@example` — DONE.** Rewrote to the coalesced `addImport`+`setJsxProp`
   journey, `bun run build` + regenerated `test/fitness/dts-baseline/react.index.d.ts`. Added a
   guard in `docs.test.ts` reading `src/dialects/react/index.ts` directly (fit-04 exempts
   `@example` edits by design; the existing doc guards only grep `.md` files — that seam is now
   closed for this specific regression).
5. **QA-5 assertion leak — DONE, with a genuine near-miss mutant (see below).** Fixed the two
   `toContain(argName)` / `toContain("name")` assertions to `toContain(\`${argName}\`)` /
   `toContain("\`name\`")` (backtick-bounded — every react reject tail names its argument as
   `` `${argName}` ``). Also pinned the grammar-divergence runner-up (`addImport("$", ...)`
   accepts, `addImport("data-testid", ...)` rejects) as permanent tests in `ops.test.ts`.
   Corrected `apply-progress.md:158-161`'s false discrimination claim (see the inline correction
   above). **Disclosure**: this fix landed in commit `5749bf2` together with item 2 — both touch
   `test/dialects/react/name-validation.test.ts` and were staged together before I split commits;
   the commit message only describes item 2. Recorded here so the omission is visible.
6. **DOC-2 `.tsx`-only doc gap — DONE.** `docs/authoring-a-dialect.md`'s react intro now states
   `.jsx` is explicitly rejected by `find()`, not silently accepted.
7. **DOC-4 doc-index rot — DONE.** `docs/README.md:16` and `docs/quickstart.md:186` now name
   both `@pbuilder/sdk/typescript` and `@pbuilder/sdk/react`. No new guard added for these two
   lines specifically (kept to the textual fix asked for; the existing guards in
   `test/docs/doc-set-content.test.ts` target different files and were not extended).
8. **REQ-RXD-15 `validatedOp` contributor docs — DONE.** New pinned `####` subsection under
   "For contributors: building a dialect" naming `validatedOp`, the chokepoint pattern, the raw-
   splice vulnerability class it closes, and a pointer to `src/core/jsx-name-validator.ts`.
   Guard-asserted in `docs.test.ts` (presence + verbatim-sentinel + red-proof-on-removal, mirrors
   REQ-RXD-09.3's pattern). Hit the same line-wrap trap S-004 recorded: the sentinel sentence
   had to stay on one unwrapped markdown line to survive a literal `.toContain()`.
9. **ARCH-3 — DONE, chose "fix the code" over "weaken the ADR".** `ops.ts:55`/`:60` interpolated
   `` `${elementName}` `` directly into `dialectError`, bypassing `reject-tail.ts` — the ADR's
   "by construction" claim was false. Routed both call sites through new `zeroMatchTail`/
   `multiMatchTail` helpers (`src/core/reject-tail.ts`), which apply the existing
   `boundedFragment` to `elementName`. **Justification**: the security property was never at
   risk (`elementName` is post-validation, grammar-constrained — no quotes/newlines/injection
   vector) but the echo WAS unbounded in length (`ELEMENT_NAME_GRAMMAR` has no length ceiling),
   which is the concrete thing ARCH-3 flagged as actually lost. Bounding it is a real, if small,
   hardening — cheaper and more honest than loosening the ADR's language to permit unbounded
   echoes. Also amended `design.md`'s wording (it still is not literally "never interpolates" —
   match-count rejects are the one class that echoes a value at all, by design/UX necessity —
   but the claim now accurately describes routing through the chokepoint and the bound, instead
   of describing a property the code never had).

### TDD sequence, honestly, per item

- **Item 1 (addImport V5)**: genuine RED — six new scenarios (05.5-05.10) written and run
  against the unfixed code first; all six failed for the right reason (three assertion
  mismatches on expected byte content, three contained-throw failures reproducing QA-3's
  hard-throw and QA-2's incorrect merge) — a direct reproduction of QA-1..QA-4. Then GREEN:
  all 32 tests in `ops.test.ts` passed after the rewrite, including the unchanged 05.1-05.4
  baseline (no regression). Triangulation is inherent to the six new scenarios themselves (each
  exercises a distinct declaration shape).
- **Item 2 (reserved words)**: genuine RED — 9 reserved-word cases + 3 substring-lookalike
  cases written first; 9 failed (`toBeInstanceOf(Error)` received `undefined`) before
  `IMPORT_RESERVED_WORDS` existed. GREEN: 76/76 after wiring. Triangulation: 9 distinct reserved
  words across all three grammar families (keywords/strict-mode/`await`) plus 3 lookalikes
  proving exact-membership, not substring matching.
- **Item 5 (QA-5) — mutation probe, WITH a near-miss mutant (the amendment's actual point)**:
  behaviour (the wiring) pre-exists, so genuine RED was not coherent here — this is a test
  CORRECTNESS fix, not new behaviour. Ran the near-miss mutant BEFORE fixing the assertion:
  `assertValidAttributeName` wired into `addImport`'s validator closure instead of
  `assertValidImportBinding` → `bun test test/dialects/react/name-validation.test.ts` = **76
  pass / 0 fail** — the OLD weak assertion could not tell the difference (bug reproduced,
  exactly as QA-5 describes). Fixed the assertion to backtick-bounded matching, RE-RAN THE SAME
  MUTANT → **65 pass / 11 fail** (10 `addImport.name` battery cases + 1 discrete validator-reject
  test) — now correctly discriminates. Reverted the mutant (`git diff src/dialects/react/ops.ts`
  empty) → 76/0 clean. This is the near-miss mutant the mutation-probe amendment requires: a
  PLAUSIBLE WRONG implementation (right shape, wrong grammar), not an absence mutant.
- **Item 9 (ARCH-3 bound)**: genuine RED — two new tests (long dotted `elementName`, zero-match
  and multi-match) written first against the unfixed code; both failed (`not.toContain(longName)`
  received the full 19-char name in the message) — a real gap, not a probe. GREEN after routing
  through `zeroMatchTail`/`multiMatchTail`; the pre-existing exact-message pins for `Missing`/
  `Button` (both <16 chars) stayed byte-identical, confirming no regression to short names.
- **Items 4, 6, 7, 8 (docs)**: genuine RED where content did not yet exist (items 4 and 8 —
  guard tests written and run against the stale/absent text first, confirmed failing for the
  right reason, then the doc/JSDoc content written to match). Items 6 and 7 are textual
  corrections with no new guard, so no RED/GREEN cycle applies — verified only by reading the
  edited file back and re-running the existing doc-set suite.

### Near-miss mutant record (mutation-probe amendment compliance)

One near-miss mutant used, reused across two purposes: `addImport`'s validator closure pointed
at `assertValidAttributeName` instead of `assertValidImportBinding` (same shape as QA-5's own
reproduction — a plausible WRONG wiring, not an absence). It proved two things in one session:
(a) the OLD `toContain(argName)`/`toContain("name")` assertions are blind to it (76/0, false
pass) and the NEW backtick-bounded assertions catch it (65/11, correct fail) — QA-5's fix; (b)
`addImport("$", ...)` would flip to REJECTED and `addImport("data-testid", ...)` would flip to
ACCEPTED under the same mutant — the grammar-divergence pin QA named as the "cheap runner-up".
Reverted after each use; `git diff`/`git status --porcelain src/dialects/react/ops.ts` empty
both times.

### Real test numbers observed

| Scope | Result | Location |
|---|---|---|
| `test/dialects/react/` (post item 1+2+9) | 147 pass / 0 fail | `~/Documents` (working dir) |
| `test/dialects/` + `test/conformance/` + `test/fitness/` + `test/docs/doc-set-content.test.ts` + `test/security/canary-no-echo.test.ts` (final sweep) | 795 pass / 0 fail | `~/Documents` (working dir) |
| `tsc --noEmit` | clean | `~/Documents` (working dir) |
| **Full suite, trustworthy location** | **1824 pass / 0 fail** | fresh `/private/tmp/react-dialect-verify-worktree` of HEAD `610650a`, `bun install` + `bun test`, worktree removed after |

1824 = 1797 (pre-fix baseline, per verify-report.md) + 27 net new tests (12 reserved-word battery
+ lookalikes, 10 in `ops.test.ts` [6 shape scenarios + 2 grammar-divergence + 2 ARCH-3 bound-echo],
5 in `docs.test.ts` [2 F-01 guard + 3 REQ-RXD-15 guard]) — verified against `git diff --stat`
across this fix pass's 6 commits, not asserted from memory. No environmental timeout was
observed or reported as a pass in either the working-directory runs or the worktree run; the
working-directory scoped runs above deliberately excluded the known-flaky subprocess-bound files
(`test/docs/quickstart-docs.test.ts`, `test/e2e/installed-consumer.e2e.test.ts`) — those are
covered by the trustworthy full-suite number instead.

### What is still open (not mine, per the task's explicit exclusions)

DOC-3 (`dialect-handle.ts:178`), ARCH-2 (validator module placement), the subprocess-timeout
debt, and the `.jsx` pending-changes row are unchanged — none were touched. The CLOSED rulings
in `council-findings.md` were not re-opened.

## F-1 Fix — REQ-RXD-06.9, `IMPORT_RESERVED_WORDS` 46 → 48 (spec V6, COMPLETE)

Owner-signed V6 amended REQ-RXD-06 to add `eval`/`arguments` to `IMPORT_RESERVED_WORDS` and
retire the "at minimum" floor language for this set, and to add scenario REQ-RXD-06.9. This
closes `verify-report.md`'s iteration-2 F-1 (the one open followup — everything else in that
report was left exactly as recorded, per scope). Commit `9a92944`.

**Files modified**: `src/core/jsx-name-validator.ts` (`IMPORT_RESERVED_WORDS` widened with
`"eval", "arguments"` + comment recording the V6 rationale — the two are a different grammar
category, strict-mode-restricted `BindingIdentifier`s, not reserved words),
`test/dialects/react/name-validation.test.ts` (+REQ-RXD-06.9 describe block — 2 reject cases +
3 substring-lookalike accept cases, matching REQ-RXD-06.7's shape exactly).

**Set count verification (48/48, zero drift)**: parsed `IMPORT_RESERVED_WORDS` from source at
runtime and diffed against the spec's own enumerated 48-entry set (36 always-reserved + 9
strict-mode-reserved + `await` + `eval` + `arguments`):

```
spec count: 48   code count: 48
spec - code (missing): []   code - spec (extra): []   EXACT MATCH: true
```

No over-blocking: the three lookalike cases (`evaluate`, `myEval`, `argumentsList`) are asserted
ACCEPTED by the same test run that asserts `eval`/`arguments` REJECTED — exact Set-membership,
never substring/prefix, same discipline as REQ-RXD-06.7's own lookalike trio.

### TDD sequence — real RED→GREEN, as instructed

This one had a genuine RED available (the behaviour did not exist — `eval`/`arguments` were
accepted before this fix) and it was used, not substituted with a mutation probe:

1. **Safety net** (Phase 0): `bun test test/dialects/react/name-validation.test.ts` →
   **76 pass / 0 fail** before any change.
2. **RED**: wrote the REQ-RXD-06.9 describe block first (2 reject cases + 3 lookalike-accept
   cases), ran it scoped (`-t "REQ-RXD-06.9"`) against the UNCHANGED validator →
   **3 pass / 2 fail**. The 2 failures were `expect(caught).toBeInstanceOf(Error)` receiving
   `undefined` for both `"eval"` and `"arguments"` — an assertion failure, the right reason (not
   an import/syntax error). The 3 lookalike cases passed immediately, correctly — they were
   already accepted and stay accepted; no code change touches that behaviour.
3. **GREEN**: added `"eval", "arguments"` to `IMPORT_RESERVED_WORDS`. Re-ran the same scoped
   test → **5 pass / 0 fail**.
4. **Triangulation**: not required — this is a Set-membership addition (REQ-RXD-06.7's own
   precedent treats each new reserved word as its own case, not a class needing a forcing
   sequence), and the two values were tested together in the same RED→GREEN pass, both moving
   from fail to pass together.
5. **Refactor**: none needed — the change matches REQ-RXD-06.7's existing shape exactly (same
   assertion style, same describe-block pattern, same lookalike-battery convention).

No deviation from the prescribed sequence — RED was observed before GREEN, in that order, with
the numbers above.

### Test numbers, each labelled with the location it was taken in

| Scope | Result | Location |
|---|---|---|
| `name-validation.test.ts` (safety net, pre-fix) | 76 pass / 0 fail | `~/Documents` (working dir) |
| `name-validation.test.ts -t "REQ-RXD-06.9"` (RED, pre-fix) | 3 pass / 2 fail | `~/Documents` (working dir) |
| `name-validation.test.ts -t "REQ-RXD-06.9"` (GREEN, post-fix) | 5 pass / 0 fail | `~/Documents` (working dir) |
| `name-validation.test.ts` (full file, post-fix) | 81 pass / 0 fail | `~/Documents` (working dir) |
| `test/dialects/react/` + `test/conformance/` + `test/fitness/` + `test/security/canary-no-echo.test.ts` + `test/docs/doc-set-content.test.ts` | 739 pass / 0 fail | `~/Documents` (working dir) |
| `bunx tsc --noEmit` | 0 errors | `~/Documents` (working dir) |
| **Full suite, trustworthy location** | **1829 pass / 0 fail** | fresh `/private/tmp/react-dialect-f1-verify` worktree of `9a92944`, `bun install --ignore-scripts` + `bun test`; worktree removed after |

1829 = 1824 (verify-report.md's trustworthy baseline) + 5 net new tests (2 REQ-RXD-06.9 reject
cases + 3 lookalike-accept cases) — matches exactly, no unexplained delta. No environmental
timeout was observed in any run; nothing was reported as a pass that was actually a timeout, and
no failure was attributed to the environment.

### Scope discipline

Touched only `IMPORT_RESERVED_WORDS` in `src/core/jsx-name-validator.ts` and the new
REQ-RXD-06.9 test block in `test/dialects/react/name-validation.test.ts`. Did not touch
REQ-RXD-05's algorithm, the tail helpers, docs, or the `.d.ts` baseline — confirmed no `.d.ts`
regen was needed: this change adds a `Set` member, not a type-surface change (`ReactOps`'
shape is unaffected). Did not re-open DOC-3, ARCH-2, the subprocess-timeout debt, or any CLOSED
`council-findings.md` ruling. Did not touch F-2 through F-5 from `verify-report.md` — left
exactly as recorded, per the task's explicit scope.
