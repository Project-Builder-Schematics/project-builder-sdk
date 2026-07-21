# Delta for typescript-dialect

**Spec version**: V3.2
**Status**: signed (owner, 2026-07-21 — targeted amendment; original sign-off 2026-07-17 stands
for everything else)
**Change**: `ts-addimport-collision`

(This delta amends the already-signed main spec's REQ-TSD-01 — authorised via
`unfreeze=true`, owner-ratified, scoped to the `addImport` merge/collision/idempotency
behaviour and its new reject surface ONLY; no other clause of REQ-TSD-01 is touched beyond
what full-copy-then-edit requires. It also extends REQ-TSD-03 — justified as in-scope, not
adjacent creep: the seed-with-own-output idempotency scenario (row 343, proposal handle CAP-4)
is the DURABILITY PROOF of the idempotent-no-op promise REQ-TSD-01's own scenarios already
establish (REFRAMED at V2, BA F5 — not a fourth, separate author-observable capability
alongside shape-safe-merge/loud-reject/injection-safety; it is in-scope because it strengthens
an existing promise's evidence, not because it introduces a new one). One new
requirement, REQ-TSD-13, is ADDED for `addImport`'s two-parameter injection-safety contract
— genuinely new ground; the shipped `addImport` validates neither argument today.)

(V2 — council review round, all three lenses converged on `needs-fixes`, none contradictory.
All V1 REQ-IDs and scenario IDs are PRESERVED unchanged; new scenarios extend the numbering
from `.26` (REQ-TSD-01) and `.6` (REQ-TSD-13) — no renumbering, no ID reuse. Fixes: REQ-TSD-13's
internal message-shape contradiction resolved (validation rejects are path-less, reusing
`assertValidImportBinding` verbatim; only collision rejects carry the path clause — two
deliberate shapes, documented); the separate 3-entry `JSX_NAME_DENYLIST` is now pinned
alongside the 48-entry `IMPORT_RESERVED_WORDS`; zero-echo is now asserted on the confirmed
injection scenario; four coverage gaps closed (type-only default/namespace collision rejects,
an aliased-underlying merge GREEN pair, mixed default+named rows, the unaliased-named
idempotency symmetry row); collision-battery rows now require a distinguishing message
substring, not the shared prefix alone; the behaviour-change note's Class B claim is corrected
(it was NOT empty — REQ-TSD-01.20 is a genuine Class B member); "zero directives" now has its
reject-side dual observable defined once, battery-wide; and REQ-TSD-01.21 (directive
prologue/shebang) was EMPIRICALLY PROBED against the pinned `ts-morph` — both were CLAIMED as
Class A fixes at V2, with the shebang case split into its own scenario (`.33`) — SUPERSEDED at
V3, see below. See each requirement's own `(Previously: ...)` note for the itemised trace.)

(V3 — targeted confirmation-pass sweep. Security and BA lenses fully CONFIRMED (all V2 fixes
verified resolved); QA confirmed all 7 of its original fixes but REJECTED V2's `.33` on a
factually unsound premise: the V2 probe called `ast.addImportDeclaration(...)` DIRECTLY,
bypassing this dialect's own containment wrapper — not representative of what an author actually
observes through the public API. RE-VERIFIED THROUGH THE PUBLIC HANDLE this round (a real run via
`ts.find(path).addImport(...)`, mirroring `test/dialects/typescript/dialect.test.ts`'s own
harness shape): TODAY's shebang behaviour is a CONTAINED, fail-closed reject (branded
`dialectError`, `.cause` undefined, zero directives) — the SAME generic foreign-wrap mechanism
REQ-TSD-04.1 already tests — NOT an uncaught crash, and NOT the `TS18026` text V2 pinned (that
text is never even the one ts-morph raises for this case, and either way never surfaces past
containment). `.33` is REWRITTEN accordingly: reclassified out of Class A into its own
behaviour-change bucket ("fail-closed reject → successful insertion", no migration impact), its
GIVEN now documents the verified baseline instead of asserting a crash, its THEN now requires a
byte-exact golden instead of prose, and a pre-authorized design-reserved fallback is recorded in
case shebang-aware insertion turns out not to share `.21`'s mechanism. Additionally: `.20`'s
wording was softened to match its own Class B framing (BA F1-residual, no scenario shape change);
a FOURTH Class A bucket was added — same-local-name idempotency against default/namespace/mixed
shapes (REQ-TSD-01.10/.13/.30) TODAY emits a duplicate/invalid binding, not merely the three
buckets V1/V2 enumerated (BA F6) — no new scenario IDs, this bucket cites existing `.10`/`.13`/
`.30`/`.26`-`.30`; and the directive-prologue placement fix (`.21`) is now explicitly counted as
Class A member (5) rather than only implied. No REQ-ID or scenario-ID renumbering; `.33`'s
CONTENT changed but its ID did not.)

(V3.1 — QA re-check CONFIRMED `.33`'s substantive V3 correction; two note-level wording fixes
only, no scenario shape change. (1) The `.33` behaviour-change note and its CHANGELOG instruction
were unconditional ("a NEW capability... an input that previously rejected now succeeds"),
which is false under `.33`'s OWN pre-authorized fallback arm (containment pinned, insertion
deferred) — both are now stated CONDITIONALLY on which arm ships. (2) The Class A bucket-4
scenario-ID list (the normative one, in the prose above) was over-broad — tightened to
`.10`/`.13`/`.30` only, matching its own earlier, correct citation two sentences prior;
`.26`/`.27` are bucket-1-3 type-only/collision rejects and `.28`/`.29` are GREEN success pins,
neither belongs in the duplicate-binding-idempotency bucket. Also carried QA's two non-blocking
test-derivation strengthening notes into Design-Reserved (`collectModifies` length assertion for
`.33`; an explicit committed golden for `.21`).)

(V3.2 — targeted amendment, factual correction, `unfreeze=true`, owner-ratified 2026-07-21;
SCOPED to `.25` ONLY, no other scenario or requirement touched. `.25`'s claim that `removeImport`
"removes `x` from EVERY matching declaration it appears in (all-matches behaviour)" was factually
wrong about the shipped code (`src/dialects/typescript/ops.ts:353-368`, empirically probed twice,
byte-identical results): `removeImport` WALKS every declaration matching `from` (the judgment-day
Issue 2 fix — the search is all-declarations, not first-declaration-only) but REMOVES the binding
from only the FIRST declaration that contains it, then returns — a later duplicate survives. On
legal (non-duplicate-binding) TypeScript this is observationally indistinguishable from a true
all-matches removal, which is why it was never caught; the distinguishing fixture (the same local
name bound in two declarations for one module) is itself a TS2300 compile error, reachable only by
hand-authored/legacy, compile-invalid input. `.25` is REWRITTEN to state the asymmetry truthfully:
`addImport` merges into ONLY the first declaration (unchanged); `removeImport` searches all
declarations but removes from the first match only, exactly once. Owner ratification: "Corregir la
spec" — the spec is corrected to match shipped behaviour; ZERO production-code change; the
containing slice (S-004) stays pins-only. No REQ-ID or scenario-ID change; `.25`'s ID and role as
the explicit asymmetry posture pin are preserved, only its CONTENT is corrected.)

## MODIFIED Requirements

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

**`addImport`'s algorithm (NEW this round — the call signature was already frozen; the
behaviour behind it previously carried no explicit contract, matching the shipped naive
implementation).** On SUCCESS, `addImport(name, from)` MUST guarantee `name` is bound in the
file's module scope as a named import from `from`, using ONLY the named form `import { name }
from "from"` for any specifier it creates, and MUST NEVER produce an invalid or duplicate
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
battery-wide, with two branches depending on outcome kind (BA F2): for a NO-OP outcome, "zero
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
distinct note-entry bucket that is neither — CORRECTED at V2 (BA F1, Class B was wrongly claimed
empty) and REVISED at V3 (QA's .33 correction — one V2 "Class A" member was reclassified after
re-verifying THROUGH THE PUBLIC HANDLE, not by calling ts-morph directly; BA F6 — a fourth Class
A bucket was missing).

Class A — inputs that TODAY silently emit broken output — MOVE to a loud, branded reject or a
correctly-placed insertion: a FIX, since the prior behaviour was already wrong, not a break of
previously correct behaviour. Members: (1) type-only merge; (2) cross-module and value-namespace
collisions; (3) aliased-to-a-different-name collisions (all three: reject); (4) same-local-name
idempotency against DEFAULT, NAMESPACE, and MIXED-declaration shapes (NEW bucket, V3, BA F6 —
covering REQ-TSD-01.10/.13/.30's fixtures) — TODAY's naive `addImport` checks only the named-
import clause for `alreadyPresent`, so `addImport("Def", "m")` against `import Def from "m";`
grafts a NEW named specifier `Def` onto it, emitting `import Def, { Def } from "m";` — a
DUPLICATE local-name binding (the same `TS2300`-class defect the collision-reject scenarios
close on the import-specifier and value-namespace axes) — where this change makes it a clean
no-op instead; (5) a leading directive prologue (`"use client";`) is TODAY silently robbed of
its effect — `addImport` inserts the new import declaration ABOVE it (confirmed by directly
probing the pinned `ts-morph` version's `addImportDeclaration` against this exact fixture,
scratchpad script), and a directive string literal only functions as a directive when it is the
file's first-in-scope statement; the emitted file stays syntactically valid TS, but the
directive becomes an inert, ineffective expression statement — SILENT semantic corruption. All
five are FIXES (Class A), not regression pins — see REQ-TSD-01.10/.13/.30 (bucket 4) and .21
(bucket 5).

Class B — a case that flips from today's ALREADY-correct, ALREADY-valid behaviour into a
DIFFERENT-but-still-valid behaviour (not a fix; an intentional, owner-weighed restructuring).
ONE member: REQ-TSD-01.20's side-effect-import posture. TODAY, `addImport("X", "polyfill")`
against a pre-existing `import "polyfill";` CONVERTS it into a combined form (also syntactically
valid); after this change, the side-effect statement is preserved byte-unchanged and a SEPARATE
named declaration is added instead. Both outputs are valid TypeScript with the same net import
surface; the emitted SHAPE differs. `.modify()` remains available to any author who specifically
needs today's combined-form output. (The self-alias case, by contrast, is NOT a Class B member:
adopting V8's algorithm verbatim WOULD have created one — by turning today's correct no-op into
a reject — but the owner's deliberate Step 1 deviation keeps it a no-op, so today's correct
behaviour for self-alias stays correct; it never crosses into Class B.)

**Neither class — REQ-TSD-01.33 (shebang), CORRECTED at V3.** V2 wrongly classified this as
Class A (claiming an uncaught, uncontained `ManipulationError` crash) based on a probe that
called `ast.addImportDeclaration(...)` directly, bypassing this dialect's own containment
wrapper. Re-verified THROUGH THE PUBLIC HANDLE (`ts.find(path).addImport(...)`, a real run
through `DialectHandleController#invokeContained`, `dialect-handle.ts:248-258`): TODAY's
behaviour on a shebang file is a CONTAINED, fail-closed reject — a branded `dialectError` reading
`dialect operation failed: addImport() on "{path}" threw`, `.cause` UNDEFINED, ZERO directives
emitted, target file byte-unchanged — the SAME generic foreign-wrap mechanism REQ-TSD-04.1
already tests for a real ts-morph parse failure; the underlying ts-morph error text (a generic
`ManipulationError: A syntax error was inserted.`, NOT `TS18026`) never leaks through the
containment boundary at all. Nothing is silently broken today (ruling out Class A), and a
contained reject is not previously-relied-upon correct behaviour an author could depend on
(ruling out Class B) — this is its own bucket, and its OUTCOME IS CONDITIONAL on which of
`.33`'s two design-reserved arms ships (see `.33`'s own scenario for the fallback): **IF the
insertion upgrade ships** — `.33`'s primary path — this is **fail-closed reject → successful
insertion**, a NEW capability on shebang files, with NO migration impact (no output shape changes
for any input that succeeded before; only an input that previously rejected now succeeds). **IF
the pre-authorized fallback ships instead** (design finds shebang insertion isn't the same
mechanism `.21` uses) — there is NO behaviour change on shebang files at all: the existing
fail-closed containment is merely PINNED as a regression guard, and the insertion upgrade is
deferred to `project/pending-changes` as a followup.

A CHANGELOG "Behaviour Changes" entry MUST record Class A's full five-member list, Class B's one
member with its `.modify()` escape note, and — DEPENDING ON WHICH `.33` ARM SHIPPED — either the
shebang fail-closed→success note as a separate, clearly-labelled non-breaking capability
addition, OR (fallback arm) no shebang-related changelog entry at all beyond the followup
registration; no migration guide is required either way.

(Previously: named the universal escape hatch `.raw()`. Renamed to `.modify(fn)` —
`dialect-generics` REQ-DG-03's rename. The five structured ops and their call signatures are
UNCHANGED by this change; only the escape-hatch reference renames. V2: added the runtime
collision-hint literal's corrected wording — `src/dialects/typescript/ops.ts`'s
`addFunction`/`addVariable`/`addClass` collision guard emits an author-facing RUNTIME error
whose hint clause named `.raw()`; this reference must migrate in lockstep with the rest of the
rename, and V1 left it unpinned. V3 (this round): added the module-level JSDoc migration
(`src/dialects/typescript/index.ts` lines ~48-49) as its own pinned scenario — REQ-TSD-01.3
covered only the runtime collision-hint string; the author-facing module JSDoc naming `.raw()`
was a second, separate stale reference V2 left unpinned, now caught by `foundations-skeleton`
REQ-KIT-03's repo-wide `.raw(` sweep. `ts-addimport-collision` (this round): the shipped
`addImport` (`typescript/ops.ts:22-32`) matched the FIRST declaration by module specifier and
merged unconditionally with no shape check, no `name`/`from` validation, and no participation in
`assertNoCollision` — a confirmed merge-defect family (silent type-contamination, cross-module
and value-namespace collisions producing invalid emitted code) plus a confirmed `name`-splice
injection. The CHANGELOG entry for the injection fix (V2, security F-5) is scoped precisely:
"`addImport`'s `name`-splice injection is closed by REQ-TSD-13; the sibling ops'
(`addFunction`/`addVariable`/`addClass`) `name`/`source`/`initializer` splice channels remain
open — tracked in `project/pending-changes`, out of this change's scope" — never phrased as
closing "the TS injection surface" in general. This amendment ports the CLAIMED four-branch model
already proven and judgment-day-APPROVED for the React dialect (REQ-RXD-05, V8) — adopted, not
re-derived — with ONE deliberate posture deviation (self-alias, Step 1) and TS-specific additions
the React port surfaced (multi-declaration walk, empty-clause merge target, side-effect-import
coexistence, directive-prologue/shebang placement). REQ-TSD-01.1-01.4's outcomes are UNCHANGED.)

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
  .modify().` — NOT `…or edit it with .raw().` (the retired V1-era wording still present in
  `src/dialects/typescript/ops.ts:73` before this change) — a guard test pins the corrected
  literal and fails RED if `.raw()` reappears in this runtime message

#### Scenario REQ-TSD-01.4: the module-level JSDoc names the live escape hatch, not the retired one

- GIVEN `src/dialects/typescript/index.ts`'s module-level JSDoc (lines ~48-49, above the
  `ts.find`-opening `@example`)
- WHEN scanned
- THEN it reads "...exposing the universal `.modify()` escape hatch..." — NOT "...the universal
  `.raw()` escape hatch..." (the retired V1-era wording still present at this location before
  this change) — this author-facing JSDoc flows into IntelliSense hover text and MUST migrate
  alongside the runtime collision-hint message (REQ-TSD-01.3); `foundations-skeleton`
  REQ-KIT-03's repo-wide `.raw(` sweep enforces this as a fitness check, not a one-time manual
  edit, and fails RED if `.raw()` reappears here

#### Scenario battery REQ-TSD-01.5–01.19: shape-aware merge, idempotency, and collision — one row per import shape (NEW)

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
| .15 | `import { X as X } from m` — SELF-ALIAS, local name X, alias text equals its own name | `addImport("X", m)` | IDEMPOTENT NO-OP — byte-IDENTICAL to input (owner-ratified V8 DEVIATION, row 456 fix; contrast `.14`: alias-to-SAME-name satisfies idempotency, alias-to-a-DIFFERENT-name does not) |
| .16 | `import { readFileSync } from "node:fs"` (claims `readFileSync` under module A) | `addImport("readFileSync", "./local")` — a DIFFERENT module B | REJECTS before any AST mutation — zero directives, byte-unchanged; the claimed scan is FILE-WIDE, not scoped to the SAME module as Step 1's idempotency check |
| .17 | top-level, EACH tested in isolation: `function Icon(){}` / `const Icon=1` / `let Icon=1` / `var Icon=1` / `class Icon{}` / `enum Icon{}` / `namespace Icon{}` / `export default function Icon(){}` (8th kind, QA L1 — React parity, RXD-05.16) — no import of Icon | `addImport("Icon", "./icons")` per case | every case REJECTS before any AST mutation — zero directives, byte-unchanged; the value-namespace declaration claims `Icon` via `assertNoCollision`'s reused predicate |
| .18 | top-level `type Icon = string;` (separately, `interface Icon { x: number }`), no import of Icon | `addImport("Icon", "./icons")` | SUCCEEDS (GREEN boundary) — `type`/`interface` are NOT in the value namespace (ADR-0039's exemption); separate `import { Icon } from "./icons";` inserted |
| .19 | no import from `from` exists at all | `addImport(name, from)` | fresh `import { name } from "from";` inserted (byte-exact pair already pinned by `.2`) |

**Distinguishing-substring requirement for every REJECT row above (QA M4)**: the shared
`"dialect operation failed: "` prefix discriminates NOTHING on its own — every reject in this
domain carries it. Every COLLISION-reject row in this battery (`.6`, `.8`, `.14`, `.16`, `.17`,
and `.26`/`.27` below) MUST additionally assert the collision-specific `…already exists…` /
`…already bound…` clause (design owns the exact wording) as a substring of the thrown message,
so the test proves WHICH check fired — a `toThrow()` with no message assertion, or an assertion
on the shared prefix alone, does not satisfy this REQ's scenarios.

#### Scenario REQ-TSD-01.20: side-effect import is preserved, restructured not "fixed" (SOFTENED at V3, BA F1-residual; RATIFIED at sign-off — see Sign-Off Block)

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

#### Scenario REQ-TSD-01.21: directive prologue — inserted import lands AFTER it, never before (FIX, empirically confirmed — see .33 for the shebang case)

- GIVEN a file starting with `"use client";\n` (a directive prologue)
- WHEN `addImport("readFileSync", "node:fs")` is applied
- THEN the printed output keeps `"use client";` as the file's FIRST statement, byte-unchanged,
  with the import inserted AFTER it — TODAY's behaviour (confirmed by directly probing the
  pinned `ts-morph` version's `addImportDeclaration` default insertion point against this exact
  fixture) inserts the import ABOVE the directive instead; the file remains syntactically valid
  but the directive silently loses its effect (a directive is only live when it is the
  first-in-scope statement) — this is a Class A FIX (silent semantic corruption today), not a
  regression pin against already-correct behaviour

#### Scenario REQ-TSD-01.22: multiple declarations for the same module — merge-target and claimed-scan both walk ALL of them (NEW)

- GIVEN a seeded file with TWO separate declarations for the same module, `import { a } from
  "m";\nimport { b } from "m";` (legal TS — a module can be imported via several declarations)
- WHEN `addImport("c", "m")` is applied
- THEN it merges into the FIRST declaration (source order) — printed output is `import { a, c }
  from "m";\nimport { b } from "m";` — proving the merge-target search and the Step 1/2
  claimed-scan both examine EVERY declaration for `from`, not only the first one encountered

#### Scenario REQ-TSD-01.23: empty named-import clause is a valid merge target (NEW)

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

#### Scenario REQ-TSD-01.25: match-cardinality asymmetry — addImport merges into the FIRST declaration, removeImport searches ALL but removes from the FIRST match only (explicit posture pin, CORRECTED at V3.2)

- GIVEN a seeded file with two declarations for the same module, `import { a } from
  "m";\nimport { b } from "m";`, and separately a second fixture where `"x"` is bound as a named
  import in BOTH of two declarations for `"m"` (a state only reachable by hand-authored/legacy —
  and, since duplicate local-name bindings across declarations are a TS2300 compile error, also
  compile-INVALID — input, since `addImport` itself never produces it)
- WHEN `addImport("c", "m")` is applied to the first fixture, AND `removeImport("x", "m")` is
  applied to the second
- THEN `addImport` merges into ONLY the first declaration (per `.22`) — first-match, scoped to
  this shipped op pair only, not a general SDK convention — WHILE `removeImport` SEARCHES every
  declaration matching `from` (its judgment-day Issue 2 fix — the scan is all-declarations, not
  first-declaration-only) but REMOVES the binding from only the FIRST declaration that contains
  it, then returns — the second, later `"x"` survives untouched; on any legal (non-duplicate)
  input this is observationally identical to an all-matches removal, which is why the distinction
  is only reachable through the hand-authored/legacy, compile-invalid fixture above — the
  asymmetry (merge: first-declaration target; remove: all-declarations search, first-match-only
  removal) is a stated fact of this pair's shipped contract, not an oversight

#### Scenario REQ-TSD-01.26: type-only DEFAULT specifier collision rejects (NEW, V2 — QA M1)

- GIVEN a seeded file with `import type Def from "m";` (a type-only DEFAULT import — decl-level
  `isTypeOnly()`, no per-specifier flag on a default specifier) and no value import of `Def`
- WHEN `addImport("Def", "m")` is applied
- THEN it REJECTS before any AST mutation — zero directives, byte-unchanged, asserting the
  collision-specific substring (per the distinguishing-substring requirement above) — pins that
  the type-only check reaches the DEFAULT-specifier code path, not only the named-specifier path
  `.6`/`.8` already cover; a validator that only reads `specifier.isTypeOnly()` for NAMED
  specifiers and falls back to `decl.isTypeOnly()`-only propagation for default/namespace
  specifiers would wrongly let this one merge or create-through

#### Scenario REQ-TSD-01.27: type-only NAMESPACE specifier collision rejects (NEW, V2 — QA M1)

- GIVEN a seeded file with `import type * as NS from "m";` (a type-only NAMESPACE import) and no
  value import of `NS`
- WHEN `addImport("NS", "m")` is applied
- THEN it REJECTS before any AST mutation — zero directives, byte-unchanged, asserting the
  collision-specific substring — the namespace-specifier mirror of `.26`, same underlying gap
  (decl-level-only type-only propagation missing the namespace code path)

#### Scenario REQ-TSD-01.28: aliased-underlying merge — GREEN pair for `.14` (NEW, V2 — QA M2)

- GIVEN a seeded file with `import { Foo as x } from "m";` — an aliased named specifier whose
  LOCAL NAME is `x`, aliasing the EXPORT `Foo`
- WHEN `addImport("Foo", "m")` is applied — the UNDERLYING export name, not the local alias
- THEN it SUCCEEDS (GREEN boundary, contrast `.14`'s reject) — the printed output is
  `import { Foo as x, Foo } from "m";`: a NEW, UNALIASED `Foo` specifier is merged into the
  existing clause, and the pre-existing `Foo as x` alias is undisturbed — `Foo` (the export
  name) was never CLAIMED (only `x`, the local name, was), proving the claimed-scan keys on
  LOCAL NAME, not exported/underlying name, in the success direction as well as `.14`'s reject
  direction (kills the exported-name-keying mutant that `.14` alone cannot kill)

#### Scenario REQ-TSD-01.29: mixed default+named declaration — merge adds to the named clause, default untouched (NEW, V2 — QA M3)

- GIVEN a seeded file with `import Def, { B } from "m";` (one declaration, default AND named
  clauses both present)
- WHEN `addImport("C", "m")` is applied
- THEN the printed output is `import Def, { B, C } from "m";` — the default specifier `Def` is
  byte-unchanged, the named clause gains `C` alongside `B` — proving `boundNamesIn` collects
  BOTH names from the ONE declaration and only the named clause is a valid merge target

#### Scenario REQ-TSD-01.30: mixed default+named declaration — matching the default name is a no-op (NEW, V2 — QA M3)

- GIVEN the same fixture as `.29`, `import Def, { B } from "m";`
- WHEN `addImport("Def", "m")` is applied
- THEN it is an idempotent no-op — printed output byte-IDENTICAL to input — `Def`'s DEFAULT
  specifier already satisfies idempotency; `boundNamesIn` must report the default name
  correctly even when a named clause coexists on the same declaration

#### Scenario REQ-TSD-01.31: unaliased NAMED specifier idempotency — symmetry row (NEW, V2 — QA L2)

- GIVEN a seeded file with `import { X } from "m";` (unaliased named specifier, same local and
  imported name)
- WHEN `addImport("X", "m")` is applied
- THEN it is an idempotent no-op — printed output byte-IDENTICAL to input — completing the set:
  all FOUR idempotency-satisfying shapes (default `.10`, namespace `.13`, self-aliased named
  `.15`, and this unaliased named row) now each have their own dedicated no-op scenario

#### Scenario REQ-TSD-01.32: collision-reject tail echoes a realistic name IN FULL, never truncated (NEW, V2 — BA F4, mirrors REQ-RXD-05.18)

- GIVEN a component-scale top-level declaration, `const NotificationPreferencesPanel = 1;` (29
  characters — a realistic name, no hostile content), and `addImport("NotificationPreferencesPanel",
  "./somewhere")` applied
- WHEN the collision rejection (Step 2, value-namespace half) is inspected
- THEN the tail contains the FULL name `NotificationPreferencesPanel`, uncut — this echo is
  POST-VALIDATION at this point (REQ-TSD-13 already ran and passed `name` as a grammar-valid,
  non-reserved identifier), so it is safe to echo in full; a truncation mutant that silently cuts
  the name to a fixed short cap must die against this scenario

#### Scenario REQ-TSD-01.33: shebang — TODAY a contained fail-closed reject, upgraded to successful insertion (REWRITTEN at V3, QA correction — verified through the public handle)

- GIVEN a file starting with `#!/usr/bin/env node\n` (a shebang), and — as the scenario's own
  documented BASELINE, not an assumption — TODAY's behaviour verified by driving this exact
  fixture through the PUBLIC dialect API (`ts.find("a.ts").addImport("readFileSync",
  "node:fs")`, inside a real run, per `test/dialects/typescript/dialect.test.ts`'s own harness
  shape): the run REJECTS with a branded `dialectError` reading `dialect operation failed:
  addImport() on "a.ts" threw` (the SAME generic foreign-wrap tail `#invokeContained` uses for
  any uncaught internal error, `dialect-handle.ts:248-258`), `.cause` is UNDEFINED, and ZERO
  directives are emitted — a CONTAINED, fail-closed reject, not a crash; this is the SAME
  containment mechanism REQ-TSD-04.1 already tests, just triggered by a different internal
  ts-morph failure (`ManipulationError: A syntax error was inserted.` — NOT `TS18026`, and that
  raw text never surfaces past the containment boundary either way)
- WHEN `addImport("readFileSync", "node:fs")` is applied AFTER this change ships
- THEN it SUCCEEDS — the printed output keeps `#!/usr/bin/env node` as the file's literal first
  line, BYTE-EXACT against a committed golden fixture, with the import inserted immediately
  after it — the SAME prologue-aware insertion mechanism `.21` commits to for directive
  prologues, applied to the shebang case; this upgrades a fail-closed reject into a successful
  insertion (its own behaviour-change bucket — neither Class A nor Class B, see the note above),
  NOT a fix to broken output, since nothing was silently broken before

**Design-reserved fallback (pre-authorized)**: if design finds shebang-aware insertion is NOT
achievable via the same mechanism `.21`'s directive-prologue fix uses (e.g. a ts-morph
limitation distinct from the directive case), the pre-authorized fallback is to NARROW this
scenario to PIN the existing containment instead — assert the branded `dialectError` shape above
stays stable (zero directives, byte-unchanged, `.cause` undefined) — and move the
insertion-upgrade to `project/pending-changes` as a followup. Either outcome is spec-conformant;
design records which one shipped.

### REQ-TSD-03: Edge scenarios (fail-closed, fidelity, byte/size boundaries)

(Full requirement copied from the signed main spec, then extended with one new row — `.11`,
seed-with-own-output true idempotency (row 343) — the DURABILITY PROOF of the idempotent-no-op
promise REQ-TSD-01's `.10`/`.13`/`.15`/`.31` already establish within one run, not a standalone
capability (BA F5); rows `.1`–`.10` and their outcomes are UNCHANGED.)

| # | Given | When | Then |
|---|---|---|---|
| .1 modify-after-create | a commons `create(path, { template, options })` followed by a dialect `find(path).addImport(name, from)` in the SAME run (create stages the file; the dialect's first-op read-through then observes it via read-your-own-writes — `modify-coalescing` REQ-MC-02.2) | flushed | the run emits the `create` directive (flushed when the dialect read-through reads back through `Session.read`, ADR-0015) AND exactly ONE coalesced dialect `modify` for `path` at run end; the `modify`'s content is byte-exact the CREATED content with the import applied — derived from the staged create via RYOW, NEVER from a disk/tree read (no persisted tree, ADR-0008) |
| .2 modify-then-move | a chain `find(path).addImport(x).move(toDir)` | flushed | the coalesced `modify` directive targets the ORIGINAL path AND its content is byte-exact with the import applied — the modify's content survives intact alongside the trailing move; the trailing `move` directive carries `{path, toDir}` |
| .3 two-edits-one-modify | two DISTINGUISHABLE edits (named op + `.modify(fn)`, disjoint textual footprints) with no read between them | flushed | exactly ONE `modify` directive whose `content` reflects BOTH edits — a content assertion, not a count-only assertion (`modify-coalescing` REQ-MC-01, real-AST proof) |
| .4 modify-on-nonexistent | `find()` targeting an unseeded path, first op executed | the handle's first op resolves | rejects with an author-visible message using the SAME `"dialect operation failed: "` prefix as `dialect-generics` REQ-DG-05 — pinned text (the `{path}` is QUOTED, matching REQ-DG-05's three tails): `dialect operation failed: "{path}" does not exist — create it first in this run`; not merely "ADR-0017"; the fake's run-end existence check (ADR-0017, REQ-FAKE-07 precedent) is the engine-side backstop, per `modify-coalescing` REQ-MC-04's reconciled timing |
| .5 empty file | a seeded EMPTY file, `addImport` applied | flushed | round-trips byte-exact plus the import, no spurious whitespace |
| .6 CRLF/BOM | a seeded file with CRLF line endings and a UTF-8 BOM, round-tripped with no edit | round-tripped | byte-exact — BOM and CRLF both preserved |
| .7 4 MiB boundary | a seeded multibyte-UTF-8 fixture sized so RAW bytes < `BATCH_CAP_BYTES` ≤ SERIALIZED (JSON-stringified) bytes — the multibyte expansion crosses the cap only after serialization (Stage-1 lesson) | an edit is applied and flushed | accepted under the cap, or rejected AT the cap (REQ-AEC-01.5) — never silently truncated; the fixture pins that it is the SERIALIZED side that trips the check |
| .8 CRLF + addImport | a seeded file with CRLF line endings, `addImport` applied | flushed | the inserted import line uses the SAME CRLF `newLineKind` as the rest of the file (REQ-TSD-02's frozen `newLineKind` × the file's existing line ending) — deterministic, pinned against a committed golden |
| .9 modify-then-copy | a chain `find(path).addImport(x).copy(toDir)` | flushed | mirrors .2: the coalesced `modify` targets the ORIGINAL path with byte-exact import content; the trailing `copy` directive carries `{path, toDir}` — `.copy()` chains after a coalesced modify the same as `.move()` |
| .10 duplicate addImport | `find(path).addImport(x, m).addImport(x, m)` — the SAME name+module called twice on one handle | flushed | idempotent: the printed content contains a SINGLE valid import statement for `{x} from m` — no duplicate import lines (design owns the merge mechanism; this REQ pins the observable no-duplicate-output contract) |
| .11 seed-with-own-output — TRUE idempotency (NEW, `ts-addimport-collision`) | a FRESH `Project`/run, seeded with a file whose content is the OUTPUT of a prior, independent `addImport(x, m)` run against that same fixture (not two chained calls in one run — a genuinely separate, later run reading that output as its starting state) | `addImport(x, m)` is applied again in this fresh run and flushed | the run emits ZERO directives for the target file — the assertion shape `ops-removeImport.test.ts`'s absent-binding no-op already uses; `.10` proves duplicate CALLS within one run don't double-emit, `.11` proves a SEPARATE run reading the prior op's own output makes no further change at all — the distinct claim `.10` alone cannot make (row 343's original "idempotency" test measured determinism, not this) |

Justification for .10/.11's idempotent ruling: repeated `addImport` calls for the same name+module
are a common byproduct of composed schematics (two independent op invocations importing the
same helper); a naive duplicate-statement output would be redundant, and in some TS contexts
invalid, code. `.11` closes a gap the pre-existing `.10` alone left open: `.10` proves two calls
in ONE run don't double-emit (and does catch a deleted idempotency guard, refuting the literal
"determinism-only" framing this row's originating note used) but never exercises a fresh run
reading the op's own prior output as SEED state — the shape that would catch a regression in
Step 1's `satisfiesIdempotency` check specifically, independent of same-run call chaining.

(Previously: row .3's example named the escape hatch `.raw()`. Renamed to `.modify(fn)` — no
other row changed; the WIRE-level `modify` directive naming used throughout this table (rows
.1/.2/.3/.4/.9) is the unchanged wire op, not the author verb. `ts-addimport-collision` (this
round): row .11 ADDED — a true seed-with-own-output/zero-directive idempotency proof, distinct
from and additional to `.10`'s existing same-run duplicate-call proof; `.10`'s own outcome is
UNCHANGED.)

## ADDED Requirements

### REQ-TSD-13: `addImport`'s two-parameter injection-safety contract (security — load-bearing, NEW)

`addImport(name, from)`'s two parameters MUST be validated at the op boundary, BEFORE any AST
mutation:

- **`name`** MUST match the plain-JS-identifier grammar `^[A-Za-z_$][A-Za-z0-9_$]*$`, MUST NOT
  be a reserved word or a strict-mode-restricted `BindingIdentifier` (the frozen 48-entry
  `IMPORT_RESERVED_WORDS` set), AND MUST NOT be a member of the SEPARATE, smaller 3-entry
  `JSX_NAME_DENYLIST` (`__proto__`, `constructor`, `prototype` — CORRECTED at V2, security F-2:
  this is its OWN `Set`, checked by its OWN `assertNotDenylisted` call, independent of the
  48-entry reserved-word check; a validator that drops only the denylist check while keeping the
  reserved-word check would let all three names through undetected unless BOTH are exercised).
  All three checks are reused VERBATIM, in sequence, via ONE call to `assertValidImportBinding`
  — the single exported entry point in `src/core/jsx-name-validator.ts` that already chains
  grammar → reserved-word → denylist — no TS-specific narrowing, widening, or reimplementation.
  A value failing the grammar is echoed ZERO times in the reject message (no substring of the
  hostile input ever appears); a value failing only the reserved-word or denylist check MAY echo
  the matched word itself, bounded to 16 characters (the word is known-safe SDK vocabulary at
  that point, not attacker data).
- **`from`** has NO allow-list — legitimate module specifiers legally contain `@ / . :` and more.
  Its safety rests entirely on ts-morph's own string-literal escaping of the `moduleSpecifier`
  field; that assumption is PINNED by a regression scenario (below), never assumed silently.

**Reject-message provenance — TWO deliberate shapes, not an inconsistency (CORRECTED at V2,
security F-1).** `assertValidImportBinding` is reused AS-IS: its internal reject-tail builders
(`nameRuleTail`, and the denylist/reserved-word tail construction) live in
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
scope expansion, since that function is SHARED, unmodified, with the React dialect. **RATIFIED
at sign-off (2026-07-17)**: the owner declined unification — the two-shape posture ships as
specified; see the sign-off block.

**Precedence (NEW, V2 — QA L3)**: a `name` that is BOTH invalid under this REQ (grammar,
reserved-word, or denylist) AND would ALSO collide under REQ-TSD-01's Step 2 fails with THIS
REQ's VALIDATION message, never the collision message — validation runs strictly BEFORE
REQ-TSD-01's algorithm is even reached; a `name` that fails validation never gets far enough for
Step 2 to evaluate it.

A validation failure MUST reject via a branded `dialectError` BEFORE any AST mutation — ZERO
directives emitted, the target file BYTE-UNCHANGED (per the dual observable REQ-TSD-01 defines).
`addImport`'s call signature — `addImport(name: string, from: string)` — is UNCHANGED by this
requirement; only a validation gate is added ahead of the existing algorithm (REQ-TSD-01).

Touched functions in this change (`addImport` and its validation helper) carry trust-boundary
JSDoc naming `name` and `from` as the two channels this REQ validates. That JSDoc MUST
AFFIRMATIVELY characterize `addFunction`/`addVariable`/`addClass`'s own `name`/`source`/
`initializer` arguments as RAW-SPLICED, author-trusted channels this change does NOT validate or
protect (TIGHTENED at V2, security F-4 — a bare "not covered here" disclaimer is insufficient
and MUST NOT be used) — they remain out of scope for this change (tracked separately in
`project/pending-changes`).

#### Scenario REQ-TSD-13.1: CONFIRMED injection breakout rejected, zero imports, zero echo

- GIVEN `addImport('x } from "evil"; import { y', "react")` — a `name` attempting to close the
  import clause and smuggle a second import from an attacker-chosen module
- WHEN applied to a seeded file
- THEN it rejects via `dialectError` BEFORE any AST mutation — the printed file contains ZERO new
  import statements and is BYTE-UNCHANGED; the reject message names `` `name` `` and the
  grammar rule as distinguishing substrings, and — TIGHTENED at V2, security F-3 — NO substring
  of the hostile input (`evil`, `x }`, `import { y`, or any fragment thereof) appears ANYWHERE in
  the message: this is a grammar failure, so it carries the REQ's zero-echo guarantee, and the
  assertion belongs on THIS payload specifically, not merely inferred from the general rule

#### Scenario REQ-TSD-13.2: reserved-word, strict-mode-restricted, AND denylist battery rejected pre-mutation, substrings accepted (EXTENDED at V2, security F-2)

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
  prefix matching; a validator that drops `assertNotDenylisted` specifically (while keeping the
  reserved-word check intact) would let all three denylisted names through undetected — this
  scenario's denylist branch is what catches exactly that mutant, which the pre-V2 scenario did
  not exercise at all

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

#### Scenario REQ-TSD-13.5: trust-boundary JSDoc present, AFFIRMATIVELY names the still-raw ops as author-trusted (guard-asserted; TIGHTENED at V2, security F-4)

- GIVEN the shipped `src/dialects/typescript/ops.ts` after this change
- WHEN a guard test scans `addImport`'s JSDoc
- THEN it names `name` and `from` as the validated channels AND AFFIRMATIVELY states that
  `addFunction`/`addVariable`/`addClass`'s `name`/`source`/`initializer` arguments are
  RAW-SPLICED, author-trusted, and UNVALIDATED by this change — a bare "not covered here" or
  absence of mention does NOT satisfy this scenario; the guard fails RED if either the
  trust-boundary mention or the affirmative non-parity characterization is removed or weakened
  to a passive disclaimer

#### Scenario REQ-TSD-13.6: precedence — validation fails before collision is ever evaluated (NEW, V2 — QA L3)

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
| security (code execution) — `addImport`'s merge/collision algorithm and its `name`/`from` splice channels | REQ-TSD-01, REQ-TSD-03, REQ-TSD-13 | Yes |

## Design-Reserved (explicitly OUT of this spec)

Per the proposal's own framing — these are HOW, not WHAT, and stay with `sdd-design`:

- Hoist-vs-mirror for the value-namespace collision predicate (arm a: mirror-in-leaf +
  predicate-sync fitness; arm b: hoist to a new core module + react-leaf reopen) — architect's
  port matrix (`sdd/ts-addimport-collision/explore-architect`) and PM's scope-boundary ruling
  (`sdd/ts-addimport-collision/owner-decisions`) both apply: if design recommends arm b, that is
  a SCOPE EXPANSION requiring explicit owner ratification, not a free implementation choice.
- `validatedOp`-wrapper vs inline-validator call style — both wire cleanly through
  `defineOpPack`; a style choice, not a behavioural contract.
- Row-456 bookkeeping mechanics (ledger reconciliation, whether the React twin is closed or
  stays tracked) — `sdd-archive`'s job, not this spec's.

**Note for `sdd-design`'s Test Derivation table**: REQ-TSD-01 alone carries 33 scenario IDs
(`.1`–`.33`) after V2's additions — design MUST map each ID to its own discrete Test Derivation
entry. Do not blur multiple sub-IDs into one design-level test bucket; the consolidated-REQ
shape chosen for this domain (contrast React's REQ-RXD-01/05 split) makes per-ID traceability
the only thing standing between this REQ and an unauditable wall of tests.

Two QA strengthening notes for that same table (non-blocking, V3.1): (a) `.33`'s test derivation
should assert `collectModifies(emitted)` has length 1 ALONGSIDE the byte-exact golden — a length
check catches a mutant that emits a correct byte-exact result via a SECOND, spurious directive;
(b) `.21` should gain an explicit committed golden fixture at design time, matching `.33`'s own
discipline — `.21`'s current scenario text illustrates the shape inline but doesn't yet commit to
a golden file the way `.2`/`.33` do.

## Sign-Off Block

**Signed by**: owner, via orchestrator
**Date**: 2026-07-17 (original sign-off); amended 2026-07-21 (V3.2, see amendment #5 below)
**Spec version at signing**: V3.1 (original); V3.2 (current, post-amendment)
**Status transition**: draft → signed (2026-07-17); signed → unfrozen → signed (2026-07-21,
targeted amendment via `unfreeze=true`, scoped to `.25` only)

Four ratifications recorded at sign-off, closing every item this delta had left open for the
owner across V1–V3.1, plus one post-sign-off amendment (V3.2):

1. **REQ-TSD-01.20 side-effect-import posture — RATIFIED.** The PM+QA-recommended V8 posture
   ships as specified: `addImport` preserves a pre-existing side-effect-only import
   (`import "polyfill";`) byte-unchanged and creates a SEPARATE named declaration, rather than
   converting it into a combined form (today's shipped behaviour). No longer pending — this is
   now the signed behaviour. It remains the SOLE Class B member in the behaviour-change note
   (an intentional, owner-weighed restructuring of already-valid output, not a fix); no other
   scenario in this delta depended on this posture, so no other scenario changes at sign-off.
2. **Reject-message shapes — RATIFIED, unification explicitly DECLINED.** REQ-TSD-13's
   path-less validation rejects (verbatim-reused `assertValidImportBinding`) and REQ-TSD-01's
   path-carrying collision rejects (this domain's own `on "{handlePathFor(ast)}"` convention)
   ship as TWO deliberate, documented shapes. The owner considered and declined the alternative
   (changing `assertValidImportBinding`'s exported signature to also accept a path, which would
   have been a scope expansion touching the shared React validator) — this is a closed decision,
   not an open choice carried forward.
3. **Semver posture — RATIFIED.** Pre-release, no ceremony: package is `0.0.0`, unpublished,
   zero live consumers. A CHANGELOG "Behaviour Changes" entry is the only required artefact
   (per the behaviour-change note's Class A/B/shebang-conditional enumeration); no migration
   guide. Already fully encoded in this delta prior to signing — ratified as-is, no changes.
4. **Self-alias fix (REQ-TSD-01.15) — RATIFIED.** `import { X as X }` + `addImport("X", "m")`
   is an idempotent no-op, a deliberate deviation from the React dialect's V8 algorithm (which
   would reject this case — a registered false-positive, pending-changes row 456). Already
   owner-ruled prior to this spec's V1 draft (`sdd/ts-addimport-collision/owner-decisions`, obs
   #2304); reconfirmed and formally ratified at this sign-off alongside the other three items.

No scenario content changes at sign-off beyond what ratification #1 required (moving REQ-TSD-01.20
out of "pending" framing, into the signed body — its scenario text itself was already correct and
is unchanged). REQ-IDs and scenario IDs are unchanged from V3.1: REQ-TSD-01 `.1`–`.33`, REQ-TSD-03
`.1`–`.11`, REQ-TSD-13 `.1`–`.6`.

5. **REQ-TSD-01.25 `removeImport` cardinality claim — CORRECTED, V3.2 (2026-07-21).** Post-sign-off,
   empirical probing (twice, byte-identical results) established that `.25`'s original text
   misdescribed the shipped `removeImport` (`src/dialects/typescript/ops.ts:353-368`) as removing a
   binding from EVERY matching declaration. The shipped op WALKS every declaration matching `from`
   (the judgment-day Issue 2 fix, unchanged) but REMOVES from only the FIRST declaration containing
   the binding, then returns — a later duplicate survives. Owner ratification: **"Corregir la
   spec"** — `.25` is rewritten to state the true, first-match-only removal semantics; ZERO
   production-code change; slice S-004 stays pins-only (test + JSDoc alignment, no behaviour
   change). This is a targeted amendment via `unfreeze=true`, scoped to `.25` alone — no other
   scenario, requirement, or ratification #1-#4 is reopened or affected.
