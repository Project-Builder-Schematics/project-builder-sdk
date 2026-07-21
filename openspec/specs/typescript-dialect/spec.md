# TypeScript Dialect Specification

**Spec version**: V3.2
**Status**: signed (owner, 2026-07-17; targeted amendment 2026-07-21 via `ts-addimport-collision`, scoped to `.25` only)
**Change**: `ts-addimport-collision`

(This sync folds in `ts-addimport-collision`'s delta: REQ-TSD-01 widens from a frozen
subpath/op-set + `.raw()`→`.modify()` rename statement into a full behavioural contract for
`addImport`'s merge/collision/idempotency algorithm — the four-branch model ported from the
judgment-day-approved React dialect (REQ-RXD-05, V8), with one deliberate TS-specific deviation
(self-alias stays an idempotent no-op) and TS-specific additions (multi-declaration walk,
empty-clause merge target, side-effect-import coexistence, directive-prologue/shebang
placement). REQ-TSD-03 gains `.11`, the seed-with-own-output true-idempotency durability proof.
REQ-TSD-13 is new: `addImport`'s two-parameter injection-safety contract, closing a CONFIRMED
`name`-splice injection. All prior REQ-IDs and scenario IDs are preserved unchanged; see the
archived change `openspec/changes/archive/2026-07-21-ts-addimport-collision/` for the full
V1→V3.2 amendment history and ratification record.)

## Requirements

### REQ-TSD-01: Frozen subpath + widened op-pack vocabulary + `addImport` merge/collision/idempotency contract

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

**`addImport`'s algorithm.** On SUCCESS, `addImport(name, from)` MUST guarantee `name` is bound
in the file's module scope as a named import from `from`, using ONLY the named form `import {
name } from "from"` for any specifier it creates, and MUST NEVER produce an invalid or duplicate
binding. `name`'s call-signature position and type are UNCHANGED by this amendment — only the
behaviour behind them widens. Define a specifier's LOCAL NAME as the identifier it actually
binds in scope (alias if present, else its own name; the default local name for a default
specifier; the namespace local name for a namespace specifier). Define a specifier as
VALUE-BOUND if neither its declaration nor (for a named specifier) the specifier itself is
type-only. Define a name as CLAIMED if EITHER (a) it equals the LOCAL NAME of ANY import
specifier ANYWHERE in the file — any module, value-bound or type-only alike — OR (b) a
top-level VALUE-NAMESPACE declaration (`function`/`const`/`let`/`var`/`class`/`enum`/
`namespace`) shares that name, reusing `assertNoCollision`'s existing predicate
(`typescript/ops.ts:54-75`, ADR-0039) verbatim as this half of CLAIMED — `type`/`interface` are
exempt (legal TS coexistence). Both halves of CLAIMED are SYNTACTIC, SourceFile-wide checks,
not scope-aware — matching this predicate's existing posture. Every reject below (Step 2, and
REQ-TSD-13's validation gate that runs ahead of this algorithm) is a SYNCHRONOUS throw at the
`addImport(name, from)` call itself — mirroring `addFunction`/`addVariable`/`addClass`'s own
`assertNoCollision`-guarded rejects, never a deferred/async rejection — of a branded `dialectError`
carrying the SAME `"dialect operation failed: "` prefix convention REQ-TSD-03.4 already pins for
this domain; the op is CONTAINED per that convention (no ts-morph internal leak). The algorithm,
applied IN THIS ORDER (the order is a spec-level invariant, not an implementation detail — see the
ordering scenario below):

1. **Already-bound check (idempotency, SAME module only)**: if an EXISTING declaration for the
   SAME module `from` has a VALUE-BOUND specifier whose LOCAL NAME equals `name`, AND that
   specifier is a DEFAULT specifier, a NAMESPACE specifier, an UNALIASED named specifier, OR a
   SELF-ALIASED named specifier (alias text equals its own name, e.g. `{ X as X }`) — `addImport`
   is a no-op. The self-aliased case is a DELIBERATE DEVIATION from this predicate's other
   consumer (see the self-alias scenario below).
2. **Collision check**: otherwise, if `name` is CLAIMED anywhere in the file — reject via
   `dialectError` BEFORE any AST mutation.
3. **Merge**: otherwise, if an EXISTING declaration for `from` has a named-import clause (a
   `NamedImports` node, whether or not it already carries other specifiers — including an EMPTY
   clause `import {} from "from"`) AND is NOT type-only, add a NEW, UNALIASED named specifier
   `name` to that clause. When more than one declaration for `from` qualifies, the FIRST such
   declaration (source order) is the merge target — this is a KNOWN, DELIBERATE asymmetry (see
   the asymmetry scenario below), unlike the claimed-scan in Steps 1-2, which walks ALL
   declarations.
4. **Create**: otherwise, INSERT a FRESH, SEPARATE declaration `import { name } from "from";`,
   coexisting with any pre-existing declarations for the same module (type-only, default-only,
   namespace-only, or absent). A pre-existing SIDE-EFFECT-only import statement (`import
   "from";`, no clause at all) is left untouched exactly like any other non-mergeable shape —
   `addImport` NEVER converts a side-effect import into a combined side-effect+named form; the
   fresh named declaration coexists beside it.

This REQ's scenarios (and REQ-TSD-13's) rest on ONE observable defined here, applied
battery-wide, with two branches depending on outcome kind: for a NO-OP outcome, "zero
directives" means the run FLUSHES and the emitted directive list contains no `modify`/`create`
entry touching the target file — observable via the same directive-inspection mechanism
`ops-removeImport.test.ts`'s absent-binding no-op scenario already uses. For a REJECT outcome,
the op throws SYNCHRONOUSLY at the `addImport(name, from)` call — the run never reaches flush
for that op — so the equivalent proof is: the call is caught, AND the target file's on-disk
(or staged) content is BYTE-UNCHANGED from before the call, verified by re-reading it after the
catch. Both branches are asserted the same way throughout this REQ's scenarios: "zero
directives, byte-unchanged" always means "no-op path: empty directive list" OR "reject path:
synchronous throw + byte-unchanged on catch," as the scenario's own GIVEN/THEN dictates.

**Behaviour-change note (pre-release, no ceremony — owner ruling; package is 0.0.0, unpublished,
zero live consumers).** This amendment reclassifies inputs into TWO classes plus a THIRD,
distinct note-entry bucket that is neither.

Class A — inputs that TODAY silently emit broken output — MOVE to a loud, branded reject or a
correctly-placed insertion: a FIX, since the prior behaviour was already wrong, not a break of
previously correct behaviour. Members: (1) type-only merge; (2) cross-module and value-namespace
collisions; (3) aliased-to-a-different-name collisions (all three: reject); (4) same-local-name
idempotency against DEFAULT, NAMESPACE, and MIXED-declaration shapes — TODAY's naive `addImport`
checks only the named-import clause for `alreadyPresent`, so `addImport("Def", "m")` against
`import Def from "m";` grafts a NEW named specifier `Def` onto it, emitting `import Def, { Def }
from "m";` — a DUPLICATE local-name binding (the same `TS2300`-class defect the collision-reject
scenarios close on the import-specifier and value-namespace axes) — where this change makes it a
clean no-op instead; (5) a leading directive prologue (`"use client";`) is TODAY silently robbed
of its effect — `addImport` inserts the new import declaration ABOVE it, and a directive string
literal only functions as a directive when it is the file's first-in-scope statement; the emitted
file stays syntactically valid TS, but the directive becomes an inert, ineffective expression
statement — SILENT semantic corruption. All five are FIXES (Class A), not regression pins — see
REQ-TSD-01.10/.13/.30 (bucket 4) and .21 (bucket 5).

Class B — a case that flips from today's ALREADY-correct, ALREADY-valid behaviour into a
DIFFERENT-but-still-valid behaviour (not a fix; an intentional, owner-weighed restructuring).
ONE member: REQ-TSD-01.20's side-effect-import posture. TODAY, `addImport("X", "polyfill")`
against a pre-existing `import "polyfill";` CONVERTS it into a combined form (also syntactically
valid); after this change, the side-effect statement is preserved byte-unchanged and a SEPARATE
named declaration is added instead. Both outputs are valid TypeScript with the same net import
surface; the emitted SHAPE differs. `.modify()` remains available to any author who specifically
needs today's combined-form output. (The self-alias case is NOT a Class B member: adopting V8's
algorithm verbatim WOULD have created one — by turning today's correct no-op into a reject — but
the owner's deliberate Step 1 deviation keeps it a no-op, so today's correct behaviour for
self-alias stays correct; it never crosses into Class B.)

**Neither class — REQ-TSD-01.33 (shebang).** TODAY's behaviour on a shebang file is a CONTAINED,
fail-closed reject — a branded `dialectError` reading `dialect operation failed: addImport() on
"{path}" threw`, `.cause` UNDEFINED, ZERO directives emitted, target file byte-unchanged — the
SAME generic foreign-wrap mechanism REQ-TSD-04.1 already tests for a real ts-morph parse
failure; the underlying ts-morph error text never leaks through the containment boundary at all.
Nothing is silently broken today (ruling out Class A), and a contained reject is not
previously-relied-upon correct behaviour an author could depend on (ruling out Class B) — this
is its own bucket. `.33`'s OUTCOME IS CONDITIONAL on which of its two design-reserved arms
ships (see `.33`'s own scenario for the fallback): **IF the insertion upgrade ships** — this is
**fail-closed reject → successful insertion**, a NEW capability on shebang files, with NO
migration impact. **IF the pre-authorized fallback ships instead** — there is NO behaviour
change on shebang files at all: the existing fail-closed containment is merely PINNED as a
regression guard, and the insertion upgrade is deferred to `project/pending-changes` as a
followup. (ADR-03, `ts-addimport-collision` design: the FALLBACK shipped — shebang is `SourceFile`
leading trivia, not a statement, so `.21`'s statement-index insertion mechanism cannot target
it; a correct fix needs a distinct text-surgery mechanism, deferred and tracked in
`project/pending-changes`.)

A CHANGELOG "Behaviour Changes" entry records Class A's full five-member list, Class B's one
member with its `.modify()` escape note, and — since the `.33` fallback arm shipped — no
shebang-related changelog entry beyond the followup registration; no migration guide is
required.

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

#### Scenario REQ-TSD-01.3: the value-namespace collision hint names the live escape hatch, not the retired one

- GIVEN `addFunction`/`addVariable`/`addClass` invoked with a `name` that already collides with
  an existing value/import/enum/namespace binding (ADR-0039)
- WHEN the collision guard throws
- THEN the thrown `dialectError`'s message ends with the BYTE-EXACT clause `…or edit it with
  .modify().` — NOT `…or edit it with .raw().` — a guard test pins the corrected literal and
  fails RED if `.raw()` reappears in this runtime message

#### Scenario REQ-TSD-01.4: the module-level JSDoc names the live escape hatch, not the retired one

- GIVEN `src/dialects/typescript/index.ts`'s module-level JSDoc (lines ~48-49, above the
  `ts.find`-opening `@example`)
- WHEN scanned
- THEN it reads "...exposing the universal `.modify()` escape hatch..." — NOT "...the universal
  `.raw()` escape hatch..." — this author-facing JSDoc flows into IntelliSense hover text and
  MUST migrate alongside the runtime collision-hint message (REQ-TSD-01.3); `foundations-skeleton`
  REQ-KIT-03's repo-wide `.raw(` sweep enforces this as a fitness check, not a one-time manual
  edit, and fails RED if `.raw()` reappears here

#### Scenario battery REQ-TSD-01.5–01.19: shape-aware merge, idempotency, and collision — one row per import shape

Each row is its own scenario ID (`.5` through `.19`); `m` denotes the target module, `addImport`
is always called as `addImport(name, from)` against a SEPARATE fresh fixture per row.

| # | Given (existing declaration(s) for `from`, if any) | When | Then |
|---|---|---|---|
| .5 | `import { other } from m` (non-type-only named clause) | `addImport("name", m)` | merges: single clause now names both `other` and `name`, byte-exact golden |
| .6 | `import type { X } from m` (type-only DECLARATION), no value import of X | `addImport("X", m)` | REJECTS before any AST mutation — zero directives, byte-unchanged; X is claimed as type-only, not value-bound |
| .7 | `import type { X } from m`, no value import of X or Y | `addImport("Y", m)` | SUCCEEDS — separate `import { Y } from m` inserted; the type-only decl is untouched |
| .8 | `import { type X } from m` (inline type modifier, NOT decl-level type-only), no value import of X | `addImport("X", m)` | REJECTS the same way as `.6` — pins that the collision check reads `specifier.isTypeOnly()`, not only `decl.isTypeOnly()` |
| .9 | `import type { X as XT } from m` (type-only, ALIASED — local name is XT, not X) | `addImport("X", m)` | SUCCEEDS (GREEN boundary) — X was never claimed (only XT was); separate `import { X } from m` inserted, type-only decl untouched |
| .10 | `import Def from m` (default), same local name | `addImport("Def", m)` | idempotent no-op — printed output byte-IDENTICAL to input |
| .11 | `import Def from m` (default), different name | `addImport("Other", m)` | SUCCEEDS — separate `import { Other } from m` inserted; default import untouched |
| .12 | `import * as ns from m` (namespace), different name | `addImport("X", m)` | SUCCEEDS (no throw) — separate `import { X } from m` inserted; namespace import untouched |
| .13 | `import * as ns from m` (namespace), same local name | `addImport("ns", m)` | idempotent no-op — byte-IDENTICAL to input |
| .14 | `import { Foo as x } from m` (aliased, local name `x`, DIFFERENT underlying export) | `addImport("x", m)` | REJECTS before any AST mutation — zero directives, byte-unchanged; `x` is claimed by the alias, merging a second unaliased `x` would be an invalid duplicate binding |
| .15 | `import { X as X } from m` — SELF-ALIAS, local name X, alias text equals its own name | `addImport("X", m)` | IDEMPOTENT NO-OP — byte-IDENTICAL to input (owner-ratified deliberate deviation; contrast `.14`: alias-to-SAME-name satisfies idempotency, alias-to-a-DIFFERENT-name does not) |
| .16 | `import { readFileSync } from "node:fs"` (claims `readFileSync` under module A) | `addImport("readFileSync", "./local")` — a DIFFERENT module B | REJECTS before any AST mutation — zero directives, byte-unchanged; the claimed scan is FILE-WIDE, not scoped to the SAME module as Step 1's idempotency check |
| .17 | top-level, EACH tested in isolation: `function Icon(){}` / `const Icon=1` / `let Icon=1` / `var Icon=1` / `class Icon{}` / `enum Icon{}` / `namespace Icon{}` / `export default function Icon(){}` — no import of Icon | `addImport("Icon", "./icons")` per case | every case REJECTS before any AST mutation — zero directives, byte-unchanged; the value-namespace declaration claims `Icon` via `assertNoCollision`'s reused predicate |
| .18 | top-level `type Icon = string;` (separately, `interface Icon { x: number }`), no import of Icon | `addImport("Icon", "./icons")` | SUCCEEDS (GREEN boundary) — `type`/`interface` are NOT in the value namespace (ADR-0039's exemption); separate `import { Icon } from "./icons";` inserted |
| .19 | no import from `from` exists at all | `addImport(name, from)` | fresh `import { name } from "from";` inserted (byte-exact pair already pinned by `.2`) |

**Distinguishing-substring requirement for every REJECT row above**: the shared
`"dialect operation failed: "` prefix discriminates NOTHING on its own — every reject in this
domain carries it. Every COLLISION-reject row in this battery (`.6`, `.8`, `.14`, `.16`, `.17`,
and `.26`/`.27` below) MUST additionally assert the collision-specific `…already exists…` /
`…already bound…` clause as a substring of the thrown message, so the test proves WHICH check
fired — a `toThrow()` with no message assertion, or an assertion on the shared prefix alone,
does not satisfy this REQ's scenarios.

#### Scenario REQ-TSD-01.20: side-effect import is preserved, restructured not "fixed"

- GIVEN a seeded file with `import "polyfill";` (a side-effect-only import, no clause) and no
  other import of `polyfill`
- WHEN `addImport("X", "polyfill")` is applied
- THEN the printed output KEEPS `import "polyfill";` byte-unchanged AND adds a SEPARATE
  `import { X } from "polyfill";` declaration — `addImport` NEVER converts the side-effect
  statement into a combined `import X, { ... } from "polyfill"` or similar merged form; today's
  shipped behaviour DOES convert it, and BOTH shapes are valid TypeScript — this is the Class B
  member the behaviour-change note names (an intentional, owner-weighed restructuring, NOT a fix
  to broken output); `.modify()` remains available for an author who specifically needs today's
  combined-form output

#### Scenario REQ-TSD-01.21: directive prologue — inserted import lands AFTER it, never before

- GIVEN a file starting with `"use client";\n` (a directive prologue)
- WHEN `addImport("readFileSync", "node:fs")` is applied
- THEN the printed output keeps `"use client";` as the file's FIRST statement, byte-unchanged,
  with the import inserted AFTER it — this is a Class A FIX (silent semantic corruption today),
  not a regression pin against already-correct behaviour

#### Scenario REQ-TSD-01.22: multiple declarations for the same module — merge-target and claimed-scan both walk ALL of them

- GIVEN a seeded file with TWO separate declarations for the same module, `import { a } from
  "m";\nimport { b } from "m";` (legal TS — a module can be imported via several declarations)
- WHEN `addImport("c", "m")` is applied
- THEN it merges into the FIRST declaration (source order) — printed output is `import { a, c }
  from "m";\nimport { b } from "m";` — proving the merge-target search and the Step 1/2
  claimed-scan both examine EVERY declaration for `from`, not only the first one encountered

#### Scenario REQ-TSD-01.23: empty named-import clause is a valid merge target

- GIVEN a seeded file with `import {} from "m";` (an empty but present named-import clause)
- WHEN `addImport("X", "m")` is applied
- THEN the printed output is `import { X } from "m";` — the empty clause is a valid, non-type-only
  `NamedImports` node and is merged into, not treated as absent

#### Scenario REQ-TSD-01.24: ordering invariant — idempotency runs BEFORE the claimed check (mutant-killing, LOAD-BEARING)

- GIVEN a seeded file with `import { readFileSync } from "node:fs";`
- WHEN `find(path).addImport("readFileSync", "node:fs")` is applied a SECOND time (chained or in
  a fresh run seeded with the first call's own output)
- THEN it is an idempotent no-op — zero directives on the second call — NEVER a collision reject;
  a mutant that reorders Step 1 and Step 2 (runs the claimed check first) makes the SAME-module,
  already-bound specifier match its own claimed scan and reject instead of no-op — this scenario
  is designed to kill exactly that mutant, and its outcome is the same invariant REQ-TSD-03.10
  and REQ-TSD-03.11 also depend on

#### Scenario REQ-TSD-01.25: match-cardinality asymmetry — addImport merges into the FIRST declaration, removeImport searches ALL but removes from the FIRST match only

- GIVEN a seeded file with two declarations for the same module, `import { a } from
  "m";\nimport { b } from "m";`, and separately a second fixture where `"x"` is bound as a named
  import in BOTH of two declarations for `"m"` (a state only reachable by hand-authored/legacy —
  and, since duplicate local-name bindings across declarations are a TS2300 compile error, also
  compile-INVALID — input, since `addImport` itself never produces it)
- WHEN `addImport("c", "m")` is applied to the first fixture, AND `removeImport("x", "m")` is
  applied to the second
- THEN `addImport` merges into ONLY the first declaration (per `.22`) — first-match, scoped to
  this shipped op pair only, not a general SDK convention — WHILE `removeImport` SEARCHES every
  declaration matching `from` but REMOVES the binding from only the FIRST declaration that
  contains it, then returns — the second, later `"x"` survives untouched; on any legal
  (non-duplicate) input this is observationally identical to an all-matches removal, which is why
  the distinction is only reachable through the hand-authored/legacy, compile-invalid fixture
  above — the asymmetry (merge: first-declaration target; remove: all-declarations search,
  first-match-only removal) is a stated fact of this pair's shipped contract, not an oversight

#### Scenario REQ-TSD-01.26: type-only DEFAULT specifier collision rejects

- GIVEN a seeded file with `import type Def from "m";` (a type-only DEFAULT import — decl-level
  `isTypeOnly()`, no per-specifier flag on a default specifier) and no value import of `Def`
- WHEN `addImport("Def", "m")` is applied
- THEN it REJECTS before any AST mutation — zero directives, byte-unchanged, asserting the
  collision-specific substring — pins that the type-only check reaches the DEFAULT-specifier code
  path, not only the named-specifier path `.6`/`.8` already cover; a validator that only reads
  `specifier.isTypeOnly()` for NAMED specifiers and falls back to `decl.isTypeOnly()`-only
  propagation for default/namespace specifiers would wrongly let this one merge or create-through

#### Scenario REQ-TSD-01.27: type-only NAMESPACE specifier collision rejects

- GIVEN a seeded file with `import type * as NS from "m";` (a type-only NAMESPACE import) and no
  value import of `NS`
- WHEN `addImport("NS", "m")` is applied
- THEN it REJECTS before any AST mutation — zero directives, byte-unchanged, asserting the
  collision-specific substring — the namespace-specifier mirror of `.26`, same underlying gap
  (decl-level-only type-only propagation missing the namespace code path)

#### Scenario REQ-TSD-01.28: aliased-underlying merge — GREEN pair for `.14`

- GIVEN a seeded file with `import { Foo as x } from "m";` — an aliased named specifier whose
  LOCAL NAME is `x`, aliasing the EXPORT `Foo`
- WHEN `addImport("Foo", "m")` is applied — the UNDERLYING export name, not the local alias
- THEN it SUCCEEDS (GREEN boundary, contrast `.14`'s reject) — the printed output is
  `import { Foo as x, Foo } from "m";`: a NEW, UNALIASED `Foo` specifier is merged into the
  existing clause, and the pre-existing `Foo as x` alias is undisturbed — `Foo` (the export
  name) was never CLAIMED (only `x`, the local name, was), proving the claimed-scan keys on
  LOCAL NAME, not exported/underlying name, in the success direction as well as `.14`'s reject
  direction

#### Scenario REQ-TSD-01.29: mixed default+named declaration — merge adds to the named clause, default untouched

- GIVEN a seeded file with `import Def, { B } from "m";` (one declaration, default AND named
  clauses both present)
- WHEN `addImport("C", "m")` is applied
- THEN the printed output is `import Def, { B, C } from "m";` — the default specifier `Def` is
  byte-unchanged, the named clause gains `C` alongside `B` — proving `boundNamesIn` collects
  BOTH names from the ONE declaration and only the named clause is a valid merge target

#### Scenario REQ-TSD-01.30: mixed default+named declaration — matching the default name is a no-op

- GIVEN the same fixture as `.29`, `import Def, { B } from "m";`
- WHEN `addImport("Def", "m")` is applied
- THEN it is an idempotent no-op — printed output byte-IDENTICAL to input — `Def`'s DEFAULT
  specifier already satisfies idempotency; `boundNamesIn` must report the default name correctly
  even when a named clause coexists on the same declaration

#### Scenario REQ-TSD-01.31: unaliased NAMED specifier idempotency — symmetry row

- GIVEN a seeded file with `import { X } from "m";` (unaliased named specifier, same local and
  imported name)
- WHEN `addImport("X", "m")` is applied
- THEN it is an idempotent no-op — printed output byte-IDENTICAL to input — completing the set:
  all FOUR idempotency-satisfying shapes (default `.10`, namespace `.13`, self-aliased named
  `.15`, and this unaliased named row) now each have their own dedicated no-op scenario

#### Scenario REQ-TSD-01.32: collision-reject tail echoes a realistic name IN FULL, never truncated

- GIVEN a component-scale top-level declaration, `const NotificationPreferencesPanel = 1;` (29
  characters — a realistic name, no hostile content), and `addImport("NotificationPreferencesPanel",
  "./somewhere")` applied
- WHEN the collision rejection (Step 2, value-namespace half) is inspected
- THEN the tail contains the FULL name `NotificationPreferencesPanel`, uncut — this echo is
  POST-VALIDATION at this point (REQ-TSD-13 already ran and passed `name` as a grammar-valid,
  non-reserved identifier), so it is safe to echo in full; a truncation mutant that silently cuts
  the name to a fixed short cap must die against this scenario

#### Scenario REQ-TSD-01.33: shebang — contained fail-closed reject, pinned as a regression guard (ADR-03 fallback arm shipped)

- GIVEN a file starting with `#!/usr/bin/env node\n` (a shebang)
- WHEN `addImport("readFileSync", "node:fs")` is applied through the PUBLIC dialect API
  (`ts.find("a.ts").addImport(...)`, inside a real run)
- THEN the run REJECTS with a branded `dialectError` reading `dialect operation failed:
  addImport() on "a.ts" threw` (the SAME generic foreign-wrap tail `#invokeContained` uses for
  any uncaught internal error), `.cause` is UNDEFINED, and ZERO directives are emitted — a
  CONTAINED, fail-closed reject, not a crash; this is the SAME containment mechanism
  REQ-TSD-04.1 already tests, just triggered by a different internal ts-morph failure — this is
  the ADR-03 pre-authorized FALLBACK arm as shipped: shebang-aware insertion is NOT achievable
  via `.21`'s statement-index mechanism (the shebang is `SourceFile` leading trivia, not a
  statement); the insertion upgrade is deferred to `project/pending-changes` as a followup

### REQ-TSD-03: Edge scenarios (fail-closed, fidelity, byte/size boundaries)

| # | Given | When | Then |
|---|---|---|---|
| .1 modify-after-create | a commons `create(path, { template, options })` followed by a dialect `find(path).addImport(name, from)` in the SAME run (create stages the file; the dialect's first-op read-through then observes it via read-your-own-writes — `modify-coalescing` REQ-MC-02.2) | flushed | the run emits the `create` directive (flushed when the dialect read-through reads back through `Session.read`, ADR-0015) AND exactly ONE coalesced dialect `modify` for `path` at run end; the `modify`'s content is byte-exact the CREATED content with the import applied — derived from the staged create via RYOW, NEVER from a disk/tree read (no persisted tree, ADR-0008) |
| .2 modify-then-move | a chain `find(path).addImport(x).move(toDir)` | flushed | the coalesced `modify` directive targets the ORIGINAL path AND its content is byte-exact with the import applied — the modify's content survives intact alongside the trailing move; the trailing `move` directive carries `{path, toDir}` |
| .3 two-edits-one-modify | two DISTINGUISHABLE edits (named op + `.modify(fn)`, disjoint textual footprints) with no read between them | flushed | exactly ONE `modify` directive whose `content` reflects BOTH edits — a content assertion, not a count-only assertion (`modify-coalescing` REQ-MC-01, real-AST proof) |
| .4 modify-on-nonexistent | `find()` targeting an unseeded path, first op executed | the handle's first op resolves | rejects with an author-visible message using the SAME `"dialect operation failed: "` prefix as `dialect-generics` REQ-DG-05 — pinned text (the `{path}` is QUOTED, matching REQ-DG-05's three tails): `dialect operation failed: "{path}" does not exist — create it first in this run`; not merely "ADR-0017"; the fake's run-end existence check (ADR-0017, REQ-FAKE-07 precedent) is the engine-side backstop, per `modify-coalescing` REQ-MC-04's reconciled timing |
| .5 empty file | a seeded EMPTY file, `addImport` applied | flushed | round-trips byte-exact plus the import, no spurious whitespace |
| .6 CRLF/BOM | a seeded file with CRLF line endings and a UTF-8 BOM, round-tripped with no edit | round-tripped | byte-exact — BOM and CRLF both preserved |
| .7 4 MiB boundary | a seeded multibyte-UTF-8 fixture sized so RAW bytes < `BATCH_CAP_BYTES` ≤ SERIALIZED (JSON-stringified) bytes — the multibyte expansion crosses the cap only after serialization | an edit is applied and flushed | accepted under the cap, or rejected AT the cap (REQ-AEC-01.5) — never silently truncated; the fixture pins that it is the SERIALIZED side that trips the check |
| .8 CRLF + addImport | a seeded file with CRLF line endings, `addImport` applied | flushed | the inserted import line uses the SAME CRLF `newLineKind` as the rest of the file (REQ-TSD-02's frozen `newLineKind` × the file's existing line ending) — deterministic, pinned against a committed golden |
| .9 modify-then-copy | a chain `find(path).addImport(x).copy(toDir)` | flushed | mirrors .2: the coalesced `modify` targets the ORIGINAL path with byte-exact import content; the trailing `copy` directive carries `{path, toDir}` — `.copy()` chains after a coalesced modify the same as `.move()` |
| .10 duplicate addImport | `find(path).addImport(x, m).addImport(x, m)` — the SAME name+module called twice on one handle | flushed | idempotent: the printed content contains a SINGLE valid import statement for `{x} from m` — no duplicate import lines (design owns the merge mechanism; this REQ pins the observable no-duplicate-output contract) |
| .11 seed-with-own-output — TRUE idempotency | a FRESH `Project`/run, seeded with a file whose content is the OUTPUT of a prior, independent `addImport(x, m)` run against that same fixture (not two chained calls in one run — a genuinely separate, later run reading that output as its starting state) | `addImport(x, m)` is applied again in this fresh run and flushed | the run emits ZERO directives for the target file — the assertion shape `ops-removeImport.test.ts`'s absent-binding no-op already uses; `.10` proves duplicate CALLS within one run don't double-emit, `.11` proves a SEPARATE run reading the prior op's own output makes no further change at all — the distinct claim `.10` alone cannot make |

Justification for .10/.11's idempotent ruling: repeated `addImport` calls for the same name+module
are a common byproduct of composed schematics (two independent op invocations importing the
same helper); a naive duplicate-statement output would be redundant, and in some TS contexts
invalid, code. `.11` closes a gap the pre-existing `.10` alone left open: `.10` proves two calls
in ONE run don't double-emit but never exercises a fresh run reading the op's own prior output as
SEED state — the shape that would catch a regression in Step 1's `satisfiesIdempotency` check
specifically, independent of same-run call chaining.

### REQ-TSD-04: `.modify(fn)` and unparseable/unprintable-content containment (real-AST instance of REQ-DG-05)

Restates `dialect-generics` REQ-DG-05 against the REAL TypeScript dialect, not a mock: a
`.modify(fn)` throw, a real ts-morph parse failure, AND a real ts-morph print failure on
corrupted AST state MUST all surface via the SAME interim contained-error contract (pinned
message prefix, no ts-morph internal leak).

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

### REQ-TSD-13: `addImport`'s two-parameter injection-safety contract (security — load-bearing)

`addImport(name, from)`'s two parameters MUST be validated at the op boundary, BEFORE any AST
mutation:

- **`name`** MUST match the plain-JS-identifier grammar `^[A-Za-z_$][A-Za-z0-9_$]*$`, MUST NOT
  be a reserved word or a strict-mode-restricted `BindingIdentifier` (the frozen 48-entry
  `IMPORT_RESERVED_WORDS` set), AND MUST NOT be a member of the SEPARATE, smaller 3-entry
  `JSX_NAME_DENYLIST` (`__proto__`, `constructor`, `prototype`) — this is its OWN `Set`, checked
  by its OWN `assertNotDenylisted` call, independent of the 48-entry reserved-word check; a
  validator that drops only the denylist check while keeping the reserved-word check would let
  all three names through undetected unless BOTH are exercised. All three checks are reused
  VERBATIM, in sequence, via ONE call to `assertValidImportBinding` — the single exported entry
  point in `src/core/jsx-name-validator.ts` that already chains grammar → reserved-word →
  denylist — no TS-specific narrowing, widening, or reimplementation. A value failing the
  grammar is echoed ZERO times in the reject message (no substring of the hostile input ever
  appears); a value failing only the reserved-word or denylist check MAY echo the matched word
  itself, bounded to 16 characters (the word is known-safe SDK vocabulary at that point, not
  attacker data).
- **`from`** has NO allow-list — legitimate module specifiers legally contain `@ / . :` and more.
  Its safety rests entirely on ts-morph's own string-literal escaping of the `moduleSpecifier`
  field; that assumption is PINNED by a regression scenario (below), never assumed silently.

**Reject-message provenance — TWO deliberate shapes, not an inconsistency.**
`assertValidImportBinding` is reused AS-IS: its internal reject-tail builders live in
`src/core/reject-tail.ts` and are module-private — ONLY the top-level `assertValidImportBinding`
function is exported and consumed here. Its thrown `dialectError` therefore carries its
ORIGINAL, PATH-LESS message shape — the identical form the React dialect's own
`addImport.name` validation already produces — NOT this domain's `on "{handlePathFor(ast)}"`
path clause `assertNoCollision` established for its own callers. This is a DELIBERATE two-shape
posture: COLLISION rejects (REQ-TSD-01 Step 2, this domain's OWN logic, not reused from
elsewhere) carry the path clause, matching this file's established house style; VALIDATION
rejects (this REQ, verbatim-reused from the already judgment-day-approved React validator)
carry React's path-less form. Distinguishing substrings for a VALIDATION reject are: the failing
argument name (`` `name` ``), the specific rule text (e.g. "must be a valid JavaScript
identifier", "is a reserved word", "is a reserved name"), the applicable echo bound (zero for
grammar failures, ≤16 chars for reserved-word/denylist failures), and zero directives emitted —
NEVER the path clause, which is exclusive to COLLISION rejects. Unifying the two shapes would
require changing `assertValidImportBinding`'s exported signature to also accept a path — a
scope expansion, since that function is SHARED, unmodified, with the React dialect. RATIFIED at
sign-off: the owner declined unification — the two-shape posture ships as specified.

**Precedence**: a `name` that is BOTH invalid under this REQ (grammar, reserved-word, or
denylist) AND would ALSO collide under REQ-TSD-01's Step 2 fails with THIS REQ's VALIDATION
message, never the collision message — validation runs strictly BEFORE REQ-TSD-01's algorithm is
even reached; a `name` that fails validation never gets far enough for Step 2 to evaluate it.

A validation failure MUST reject via a branded `dialectError` BEFORE any AST mutation — ZERO
directives emitted, the target file BYTE-UNCHANGED (per the dual observable REQ-TSD-01 defines).
`addImport`'s call signature — `addImport(name: string, from: string)` — is UNCHANGED by this
requirement; only a validation gate is added ahead of the existing algorithm (REQ-TSD-01).

Touched functions in this change (`addImport` and its validation helper) carry trust-boundary
JSDoc naming `name` and `from` as the two channels this REQ validates. That JSDoc MUST
AFFIRMATIVELY characterize `addFunction`/`addVariable`/`addClass`'s own `name`/`source`/
`initializer` arguments as RAW-SPLICED, author-trusted channels this change does NOT validate or
protect — a bare "not covered here" disclaimer is insufficient and MUST NOT be used — they
remain out of scope for this change (tracked separately in `project/pending-changes`).

#### Scenario REQ-TSD-13.1: CONFIRMED injection breakout rejected, zero imports, zero echo

- GIVEN `addImport('x } from "evil"; import { y', "react")` — a `name` attempting to close the
  import clause and smuggle a second import from an attacker-chosen module
- WHEN applied to a seeded file
- THEN it rejects via `dialectError` BEFORE any AST mutation — the printed file contains ZERO new
  import statements and is BYTE-UNCHANGED; the reject message names `` `name` `` and the
  grammar rule as distinguishing substrings, and NO substring of the hostile input (`evil`,
  `x }`, `import { y`, or any fragment thereof) appears ANYWHERE in the message: this is a
  grammar failure, so it carries the REQ's zero-echo guarantee

#### Scenario REQ-TSD-13.2: reserved-word, strict-mode-restricted, AND denylist battery rejected pre-mutation, substrings accepted

- GIVEN each of `default`, `import`, `class`, `null`, `this`, `function`, `let`, `yield`,
  `await`, `eval`, `arguments` (the 48-entry `IMPORT_RESERVED_WORDS` set, sampled) supplied as
  `addImport.name`; SEPARATELY, each of `__proto__`, `constructor`, `prototype` (the FULL
  3-entry `JSX_NAME_DENYLIST`, a DIFFERENT set checked by a DIFFERENT call,
  `assertNotDenylisted`) supplied as `addImport.name`; AND, for the negative boundary,
  `classroom`, `imported`, `defaultValue`, `evaluate`, `argumentsList` (each merely CONTAINING a
  reserved word as a substring)
- WHEN `addImport` is applied with each
- THEN every reserved/restricted word AND every denylisted name REJECTS pre-mutation (zero
  directives, byte-unchanged, bounded ≤16-char echo of the matched word) AND every
  substring-containing identifier is ACCEPTED — exact Set-membership only, never substring or
  prefix matching

#### Scenario REQ-TSD-13.3: grammar battery rejected pre-mutation, zero echo

- GIVEN each of `""` (empty), `"   "` (whitespace-only), `"123abc"` (leading digit), `"Foo
  bar"`, `"Foo=1}"` supplied as `addImport.name`
- WHEN `addImport` is applied with each
- THEN every case rejects via `dialectError` BEFORE any AST mutation — zero directives,
  byte-unchanged, and the rejected VALUE itself does not appear anywhere in the message
  (grammar-failure rejects carry zero echo, contrast `.2`'s bounded reserved-word echo)

#### Scenario REQ-TSD-13.4: `from`-escaping regression pin — hostile specifier stays ONE string

- GIVEN `addImport("X", 'a"; import {y} from "evil')` — a module specifier attempting to
  terminate its own string literal
- WHEN flushed
- THEN the printed output contains exactly ONE import declaration whose module specifier is the
  full hostile string, ESCAPED as a single string literal — no `"evil"` module import exists in
  the output (pins the ts-morph escaping assumption this REQ rests on for `from`, mirroring
  `react-dialect` REQ-RXD-06.4)

#### Scenario REQ-TSD-13.5: trust-boundary JSDoc present, AFFIRMATIVELY names the still-raw ops as author-trusted

- GIVEN the shipped `src/dialects/typescript/ops.ts` after this change
- WHEN a guard test scans `addImport`'s JSDoc
- THEN it names `name` and `from` as the validated channels AND AFFIRMATIVELY states that
  `addFunction`/`addVariable`/`addClass`'s `name`/`source`/`initializer` arguments are
  RAW-SPLICED, author-trusted, and UNVALIDATED by this change — a bare "not covered here" or
  absence of mention does NOT satisfy this scenario; the guard fails RED if either the
  trust-boundary mention or the affirmative non-parity characterization is removed or weakened
  to a passive disclaimer

#### Scenario REQ-TSD-13.6: precedence — validation fails before collision is ever evaluated

- GIVEN a seeded file with a top-level `const __proto__ = 1;` — a value-namespace declaration
  that is BOTH (a) denylisted under REQ-TSD-13 (`__proto__` is grammatically a legal identifier,
  so this fixture is constructible, unlike a reserved word which cannot legally be declared at
  all under ES-module strict mode) AND (b) would independently satisfy REQ-TSD-01 Step 2's
  value-namespace collision predicate if validation were skipped
- WHEN `addImport("__proto__", "m")` is applied
- THEN it REJECTS with REQ-TSD-13's path-less denylist message (naming `` `name` `` and
  "reserved name", ≤16-char bounded echo) — NEVER REQ-TSD-01's path-carrying collision message —
  proving validation runs strictly first: a mutant that reorders the validation gate after
  REQ-TSD-01's algorithm would flip this reject to the COLLISION shape, and this scenario is
  designed to catch exactly that reordering

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (code execution) — `addImport`'s merge/collision algorithm, `.modify(fn)` on the real ts-morph AST, and `addImport`'s `name`/`from` splice channels | REQ-TSD-01, REQ-TSD-03, REQ-TSD-04, REQ-TSD-13 | Yes |

(REQ-TSD-12's two rows — ts-morph-realm/cross-run-reuse third-party-trust coverage and the
importable-form public-api-contract coverage — remain dropped since V4: both existed solely to
cover the now-retired REQ-TSD-12. No replacement coverage is needed since the requirement itself
is retired, not reworded.)
