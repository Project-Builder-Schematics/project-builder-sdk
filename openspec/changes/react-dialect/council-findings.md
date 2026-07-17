# Council Findings — react-dialect `/evaluate`

**Run**: 2026-07-17, HEAD `f12ffba`, branch `feat/react-dialect`, triage **L** (sensitive-area override).
**Companion to**: `verify-report.md` (sdd-verify --mode=final, verdict `fail`, `adversarial_review: required`).

Four Council personas ran **in parallel with** the final verifier and **blind** to it and to each other:
architect, qa-engineer, security-engineer, tech-writer — all `opus`, each given the question and the
artefacts only, never the orchestrator's reasoning or another persona's output.

## Why this file exists

`verify-report.md` gated on **one** item (F-01). The blind Council found **four real correctness
bugs** the verifier missed, plus two spec defects. verify-final alone described this change as
*"a one-line JSDoc fix + `.d.ts` regen, not a re-plan"* — and on that basis it would have shipped.

The fan-out is what caught them. That is the entire argument for anti-anchored parallel review, and
it is recorded here so the next reader does not conclude the single-verifier verdict was sufficient.

Full narrative also in engram obs **#2288**.

---

## QA-1 — `addImport` corrupts a `import type` clause, silently emitting broken code — **HIGH**

```
seed: import type { FC } from "react";
op:   addImport("useState", "react")
out:  import type { FC, useState } from "react";
```

`useState` is now a **type-only** import — erased at compile time, so the generated file references an
unbound identifier at runtime. No error, no warning. Zero coverage.

## QA-2 — `addImport` violates its own idempotency REQ on the most common React input — **HIGH**

```
seed: import React from "react";
op:   addImport("React", "react")
out:  import React, { React } from "react";   // duplicate binding — invalid TS
```

REQ-RXD-05.3 pins idempotency; REQ-RXD-05.4 pins "never default-import synthesis". Both are tested
**only** against a file with no prior import. Zero coverage.

## QA-3 — `addImport` hard-fails on a namespace import — **MEDIUM-HIGH**

```
seed: import * as React from "react";
op:   addImport("useState", "react")
out:  throws — dialect operation failed: addImport() on "A.tsx" threw
```

REQ-RXD-05 says: merge into an existing **named-import clause**, *or insert a fresh declaration
otherwise*. Zero coverage.

## QA-4 — Aliased import → silent no-op — **MEDIUM**

`import { useState as us } from "react"` + `addImport("useState","react")` emits **zero directives,
no error**. `getName()` returns the original name, so the guard believes the binding is present — but
`useState` does not exist in the file. Zero coverage.

### Root cause of QA-1..QA-4 — one line

```ts
// src/dialects/react/ops.ts
const existing = ast.getImportDeclaration((decl) => decl.getModuleSpecifierValue() === from);
```

The predicate matches **any** declaration by module specifier, where REQ-RXD-05 requires matching a
**named-import clause** specifically. Every existing merge test seeds either nothing or a plain named
clause; **the entire non-named space is unexplored**, and all four inputs above are mainstream React.

---

## QA-5 — Assertion leak: the hostile battery cannot tell **which** validator is wired — **MEDIUM**

This is the **third instance** of the narrow-coverage shape this change kept producing (in-loop-2 and
in-loop-4 caught the first two), and it sits in exactly the code path fix-iteration 1 already touched.

**Probe**: point `addImport` at the *wrong* grammar (`assertValidAttributeName` instead of
`assertValidImportBinding`), keeping the import referenced so no unused-symbol build error confounds
the result → **138 pass / 0 fail, identical to baseline**. It survives all 10 end-to-end
`addImport.name` battery cases.

**Cause**: the loop asserts `expect(message).toContain(argName)` with `argName === "name"` — and
**`"propName"` contains `"name"`**. The assertion pins *"a validator ran"*, not *"the right validator
ran"*.

`apply-progress.md:158-161` explicitly claims the opposite (*"The message assertion
(`toContain("name")`) is what discriminates"*), generalising from a single **unwired** probe, which it
does kill. The wrong-validator mutant it does not. Shipped impact today: none — but the guard is
weaker than the record asserts.

Also unpinned (grammars verified correct by probe, just untested): `$` accepted for import bindings;
two-colon `a:b:c` and `$` rejected for propNames.

---

## The mutation-probe-for-RED ruling — **adopt this amendment**

Two prior gates accepted substituting mutation probes for a genuine RED phase (S-003, S-005) on the
grounds that the behaviour already existed and forcing a literal RED would mean breaking working
production code. QA agrees the substitution is **adequate, not a rationalisation** — and then names
the precise way it is weaker, with QA-5 as the proof:

> In genuine TDD, **reality** picks the mutant — the behaviour simply isn't written yet.
> In a mutation probe, **the author** picks the mutant, and authors pick mutants their tests already
> kill. It is a self-selected exam.

Every probe in this change is an **absence** mutant (no-op the body, unwire the validator, remove the
export). Not one is a **near-miss** mutant — a plausible *wrong* implementation. Absence mutants are
precisely the ones a substring-weak assertion still catches, which is why QA-5 survived.

**Amendment**: when a mutation probe substitutes for RED, the probe set MUST include at least one
**near-miss** mutant, not only an absence mutant — and the record MUST NOT generalise from one probe
to "the assertion discriminates".

---

## SEC-1 — `IMPORT_BINDING_GRAMMAR` accepts JS reserved words — **LOW-MODERATE** → routes to `sdd-spec`

`/^[A-Za-z_$][A-Za-z0-9_$]*$/` accepts `IdentifierName` but not `BindingIdentifier`. The validator's
own error text claims the rule is *"be a valid JavaScript identifier"* — then admits `default`.

| input | emitted | re-parsed through the dialect's own `parse()` |
|---|---|---|
| `addImport("default", "react")` | `import { default } from "react";` | **INVALID** |
| `addImport("import", "react")` | `import { import } from "react";` | **INVALID** |
| `addImport("class", "react")` | `import { class } from "react";` | **INVALID** |
| `addImport("null", "react")` | `import { null } from "react";` | **INVALID** |
| `addImport("this", "react")` | `import { this } from "react";` | **INVALID** |
| `addImport("function", "react")` | `import { function } from "react";` | **INVALID** |

Output is written to disk with **no re-validation** — `parse()` throws on syntactic diagnostics for
*input*; `print()` never checks *output*.

**Exploitability: low** — the binding name is author-controlled; this is not code execution or
injection; worst case is a broken consumer build. But it is a straight contract violation in the one
channel REQ-RXD-06 titles *"security — load-bearing"*.

**Routes to `sdd-spec`, not `sdd-apply`**: REQ-RXD-06 mandates that regex **verbatim**. Fixing the
code without fixing the spec re-opens on the next drift check.

## SEC-2 — the spec's "full prototype-walk set" claim is factually false — documentation accuracy

REQ-RXD-06 calls `{__proto__, constructor, prototype}` *"the full prototype-walk set"*. It is not:
`__defineGetter__`, `__lookupGetter__`, `__defineSetter__`, `valueOf`, `toString`, `hasOwnProperty`,
`isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString` all pass validation.

**They are all harmless — and that is the interesting part.** The denylist is **not guarding an object
index**: `matchingElements` compares tag text with `===`; nothing does `obj[name] = value`.
`Foo.__proto__` as an `elementName` just falls through to *"no element named ... was found"*.
`Object.prototype` was byte-identical before and after.

- `__proto__` in **`propName`** *is* genuinely load-bearing — but for the **consumer's generated
  code**, not SDK memory: `<div __proto__={evil} />` compiles to `_jsx("div", { __proto__: evil })`,
  and a literal `__proto__` key in an object literal does set the prototype (verified).
- `constructor` and `prototype` in that same position are plain own props
  (`Object.getPrototypeOf({constructor: evil})` → `false`). The V4 widening from `{__proto__}` to
  three names was **cosmetic** — made on a security-council rec premised on a wrong model. It made
  nothing worse; it just isn't the defence it is described as.

**The code comment is more accurate than the spec** (*"this, not denylist width, is the real Stage-4b
`__proto__` defence"*). Correct the spec to match.

## Attacks attempted that **FAILED** — do not repeat these

The grammar is sound: ASCII-only, anchored, no `m` flag (so `$` is true end-of-string — the
Python-style trailing-newline bypass does not apply), no `i`, no `u`. All **rejected**:

- **Unicode/confusables**: cyrillic-o `__protо__`, fullwidth `＿＿ｐｒｏｔｏ＿＿`, Kelvin sign, Turkish
  dotted `İ`, roman numeral `Ⅰ`, long-s `ſ` (NFKC→`s`). No `.normalize()` runs post-validation, so no
  NFKC round-trip bypass.
- **Zero-width**: ZWSP, ZWNJ inside `__proto__`. **Surrogates**: emoji pair, lone `\uD800`.
- **Control/terminator**: trailing `\n`, leading `\n`, trailing `\r`, trailing NUL, NUL-split.
- **Injection into `propName`**: `a" onload="alert(1)`, `a b`, `a>alert`, `a=1`, `a{}`, `a/`, `a.b`.
- **Injection into `elementName`**: `div onload=x`, `div><script>`.
- **Injection into `addImport.name`**: `a} from 'x'; import evil from 'y'; //`, `a as b`.
- **`addImport.from` injection failed completely** — REQ-RXD-06.4's pinned assumption holds. ts-morph
  escapes the module specifier as a single string literal; every payload stayed inside and re-parsed
  clean: `react"; import evil from "./evil` → `from "react\"; import evil from \"./evil"`. Also
  newline, `\r\n`, U+2028, backslash, backtick, `*/; evil(); /*`, empty string. No escape.
- **Round-trip differential**: no case where output parsed differently than it printed, other than
  SEC-1's reserved words and the documented `value` channel.
- **Prototype pollution**: none. **ReDoS**: none. `xlink:__proto__` → key `"xlink:__proto__"`;
  `__PROTO__` → different key. Both verified non-polluting.

`setJsxProp.value` is documented, spec'd (REQ-RXD-12) and jsdoc'd as a **verbatim trusted-code
channel**. `{(()=>{require('child_process')})()}` emits as-is — that is the stated contract, **not a
defect**.

**Security verdict: the surface is sound, and better than the shipped TypeScript dialect's, which
validates nothing.**

---

## ARCH-1 — the pattern is not transmitted; React is the **exception**, not the template — **MEDIUM**

Three facts that line up badly:

1. The spike proved ts-morph splices attribute names and import bindings **raw**
   (`name-validation.test.ts:192-200` pins it permanently, independent of our code).
2. The shipped **TypeScript dialect validates nothing** — no `assertValid*`, no `validatedOp`.
   ADR-02 concedes this ("retrofit is pending item 22").
3. `docs/authoring-a-dialect.md:156-182` — the *"For contributors: building a dialect"* section —
   teaches `defineDialect`, `defineOpPack`, `withOps` and the conformance kit, and says **nothing**
   about `validatedOp`, name validation, the denylist, or the no-echo tail. Its only
   validation-adjacent prose is author-facing trust-boundary text about `value` (`:148-149`), which
   teaches the **opposite** lesson: *"we don't validate this."*

So dialect #3's author follows the doc, mirrors the leaf structurally (which the doc teaches well),
and ships **zero name validation** — reproducing the exact laxity ADR-05 called *"a confirmed
vulnerability class this op does not repeat."* No fitness function requires ops to be wrapped in
`validatedOp` (`rg "validatedOp" test/fitness/ docs/` returns nothing).

## ARCH-2 — `src/core/jsx-name-validator.ts` puts a dialect concern in a file-type-agnostic layer — **MEDIUM**

ADR-0002 defines core as owning *"file-type-agnostic ops"*. This module is named for a dialect
concept, holds three **JSX** grammars (`:23-25`), and its only production consumer is
`src/dialects/react/ops.ts`.

ADR-02 considered and rejected the alternative (*"Validator inside `react/ops.ts` — rejected: couples
a reusable control to one leaf"*). The architect disputes the reasoning, not the process: the control
is coupled to one leaf **today**, the reuse is speculative, and an abstraction without a second user
is a guess. Design §4.2c calls the row `aligns` citing the *"dialect-error/deep-equal precedent"* —
but those are genuinely file-type-agnostic; a JSX attribute grammar is not.

The honest seam is already visible **inside the file**: `validatedOp` (`:76-84`) and all of
`reject-tail.ts` are truly generic and belong in core; the three grammars + denylist are react's.
Dialect #3 (Vue, Svelte) has *different* name grammars — it will either append
`assertValidVueAttributeName` to the same core file, turning it into a per-dialect grammar drawer, or
fork.

**Architect's call: not a rebuild.** ADR-01 already registered a peer-module hoist for dialect #3;
extend that followup — split when #3 lands, `validatedOp` + `reject-tail` stay in core, JSX grammars
move to the leaf. Re-litigating now, with one consumer and a documented rejected alternative, would be
premature abstraction in the opposite direction.

**Combined with ARCH-1, this is the real cost**: the control is in core (implies *"shared"*), used by
one leaf (actually *"react-only"*), taught nowhere (effectively *"undiscoverable"*). Three signals,
three different stories.

## ARCH-3 — ADR-02 claims a chokepoint property the code does not have — **LOW-MEDIUM**

ADR-02 states react tails *"never interpolate author values (RXD-13; the wrapper + tail helper enforce
it by construction)"*. **False as written**: `src/dialects/react/ops.ts:55` and `:60` call
`dialectError` directly with `` `${elementName}` `` interpolated, bypassing `nameRuleTail` entirely.
`rg "reject-tail"` confirms exactly one importer: `jsx-name-validator.ts`. The op layer never routes
through the chokepoint.

The **security property survives** — `elementName` is post-validation at those lines, so the echoed
value is grammar-constrained (no quotes, no newlines, no injection vector) — and design §4.4
separately **sanctions** this. So the **design contradicts itself**: §4.4 permits what ADR-02 forbids,
and the code follows the permissive branch.

What is actually lost: the echo is **unbounded in length** (the grammar has no length cap;
`boundedFragment` is never reached on this path), and the property is held by *discipline plus
grammar*, not *by construction*. No fitness function pins it. **The ADR should say what the code
does** — or route `:55`/`:60` through a `matchCountTail` helper to make the ADR true.

---

## DOC-1 — the shipped `@example` is FALSE — **MAJOR** (the one item verify-final also caught, as F-01)

`src/dialects/react/index.ts:49-56`:

> `// structured ops arrive in later slices; .modify() is the escape hatch today.`

**Both ops shipped in S-001/S-002.** This is S-000 skeleton text left behind. It is not an internal
comment — it is emitted into `dist/dialects/react/index.d.ts`, proven by the committed baseline
`test/fitness/dts-baseline/react.index.d.ts:24-31`. It is the **only** example on the **only** export
of `./react`, so a consumer hovering `find` in their IDE is told the dialect has no structured ops and
is pushed to the raw `.modify()` code-execution seam — instead of the two validated ops the change
exists to provide. It also leaks SDD vocabulary ("slices") to consumers. The TypeScript dialect's
`find` JSDoc (`src/dialects/typescript/index.ts:53-58`) correctly demos `.addImport(...)`.

**Nothing guards it**: `fit-04-dts-semver-gate.test.ts:48` explicitly exempts `@example` edits;
`docs.test.ts` only greps the `.md`.

**The seam it fell through**: S-004 reconciled *stale framing* (REQ-RXD-09.4) in the docs while the
same staleness survived in the JSDoc that `docs.test.ts:21` **already opens and reads** — the guard
asserted **presence** of required sentences, never **falsity**. `slices.md` S-004.4 is marked
*"N/A: find's JSDoc not touched"*.

## DOC-2 — the `.tsx`-only limit is **absent** from the doc, not buried

`docs/authoring-a-dialect.md:108` says the dialect *"mutates `.tsx`/JSX files"* — which reads as
inclusive to someone holding a `.jsx` file. `.jsx` appears **exactly once** in the whole doc (`:116`),
and only as *"a future `.jsx` dialect addition"* — forward-compat colour, never a present rejection.
The doc states the **extensionless** rejection plainly but never the `.jsx` one. The runtime error is
good; the doc you read *before* writing code is silent.

## DOC-3 — `could not parse "X" as TypeScript` in the dialect-**generic** path — routes to Planner

`src/core/dialect-handle.ts:178`. Untouched by the diff, and correct when one dialect existed —
**this change is the event that makes it wrong.** The SDK now tells you *`.ts` is not a React file;
use `@pbuilder/sdk/typescript`*, then reports your `.tsx` failure *"as TypeScript"*. It also discards
`ast.ts`'s own *"syntactically invalid TSX source"*, so there is no line or reason. Every third-party
dialect the doc invites contributors to build inherits it — and
`test/core/dialect-handle.test.ts:328` already **pins the wrong text**
(`'could not parse "a.toy" as TypeScript'`), enshrining it.

## DOC-4 — the doc index never learned about the second dialect

`docs/README.md:16` and `docs/quickstart.md:186` both still read *"(e.g. `@pbuilder/sdk/typescript`)"*.
`README.md` was updated; the guard (`docs.test.ts:148-156`) checks **only** `README.md`.
`docs/README.md` is the *"reading path"* index — follow the documented path and `./react` is
invisible.

## DOC-5 — the systemic gap behind DOC-1..DOC-4

`docs.test.ts` is a **lexical** guard. It asserts sentences exist; it never executes the example and
never checks the index. **It would pass unchanged if every byte-claim in the doc were wrong.** The
prose survived execution — but that is the author's care, not the suite's.

---

## What the Council verified as GOOD (do not re-litigate)

- **ADRs 01/03/05 honoured exactly.** `git diff --stat 93e38d7..HEAD -- src/dialects/typescript/` is
  **zero lines** — the shipped sensitive dialect is genuinely untouched. No text-splice fallback
  anywhere (`ops.ts:65-75` is `getAttribute` → `setInitializer`/`removeInitializer` → `addAttribute`).
  `addImport` goes through `addImportDeclaration`/`addNamedImport` — no string concatenation. ADR-05's
  clause called "NON-NEGOTIABLE" is actually non-negotiated.
- **Design contract exact**: File Changes 16C/9M/3R; `git diff --stat 93e38d7..HEAD -- src/` is 5
  files, +377, **zero deletions** — purely additive, matching `architecture_impact: additive`.
- **Dependency direction verified, not asserted**: `rg "dialects/" src/core/ src/commons/` returns
  comment text only. The react leaf reaches only `../../core/*`, never a sibling dialect.
- **The leaf mirrors its predecessor structurally**, verb for verb — no parallel pattern invented. The
  generic `dialect-handle`/`define-dialect` seam took **zero change** absorbing a second dialect,
  which is the strongest possible evidence the original abstraction was earned.
- **Fitness functions are real, not theatre**: fit-37 walks the import graph **transitively** with a
  permanent planted two-file fixture proving the walk catches `leaf → helper → ts-morph` that a
  per-file scanner would miss, and red-proofs the negative; fit-38 asserts **non-vacuity explicitly**
  (both `ast.ts` files must *contain* `new Project(`, so the rule cannot pass by having no authorized
  sites). 143 pass / 0 fail in a clean worktree.
- **QA ran 9 independent mutations — all 9 killed.** The conformance kit genuinely asserts; the
  "20 samples" claim is honest (19 round-trip + 1 parse-reject class, pinned by
  `expect(CORPUS_SAMPLES.length).toBe(19)`).
- **Test quality as an asset**: assertions are overwhelmingly exact `toBe` against literals or
  committed goldens — no `toBeDefined`, no snapshot abuse. These will survive refactoring because they
  assert emitted bytes, not internals. QA-5 is the exception, not the pattern.
- **No-echo discipline is stronger than typical**: `canary-no-echo.test.ts` seeds a fresh
  unpredictable token per rejection branch and scans message + `.stack` + own enumerable props + bin
  stdout/stderr.
- **Supply chain sound, and reasoned rather than assumed**: `bun install --ignore-scripts`, zero
  net-new dependencies, `fit-36` scans manifest *and* lockfile and deep-equals `dependencies` to
  exactly `{ts-morph: 28.0.0}`.
- **`./react` public contract is clean**: runtime surface is exactly `{ find }`; `jsx-name-validator`
  and `reject-tail` ship in the tarball but are **not** in the exports map, and `./core`
  unresolvability is pinned by an e2e test. Nothing internal leaked.
- **Naming is consistent, not a second dialect of the vocabulary**: `addImport` has an identical
  signature *and* identical merge/idempotent semantics in both dialects. `setJsxProp`'s `set` verb
  correctly signals upsert against TS's `add`/`remove`.
- **Error messages are above average** — nearly all name what was wrong, what was expected, and give
  two remedies; the `.ts` reject *routes you to the right dialect*.

## Rulings that CLOSED — do not re-open

- **S-002's TDD ordering violation: ACCEPTABLE, on evidence, not attrition.** Git is decisive: impl
  and tests landed in the **same** commit (`fcd24d7`), not impl-then-test. `strict-tdd-verify.md`
  Method 1 explicitly permits *"tests added before **or with** implementation"*; the halt condition is
  *"tests added AFTER implementation"* — **not met**. The vacuous-test risk is empirically closed: the
  body-stub probe gave 19 pass / **5 fail** at *assertion* level (stronger than a naive RED, which
  fails on module resolution and proves nothing). RED's design-driving function was moot — the API was
  pinned upstream by the signed spec and ADR-05's non-negotiable structured path. **The real defect was
  disclosure LOCATION**: reporting it only in the return envelope cost four iterations.
- **Not findings**: the fit-37 RED fixtures (pre-existing `test/fixtures/red/**` convention);
  `not.toThrow()` at `name-validation.test.ts:78-89` (mechanically matches the ban, but it is the
  *complete* contract of a void `assert*` fn, triangulated by 30 reject cases + a byte-exact golden);
  the "frozen" denylist lacking `Object.freeze` (freeze does not protect a Set's `[[SetData]]` — would
  be theatre; also unreachable from consumers).
- **Path gate**: passes traversal, absolute, `~`, UNC, `CON.tsx`, URL forms and NUL-poison
  (`evil.js\0.tsx`). **Not a regression, not routed back**: the gate is *dialect routing* ("is this
  file mine?"), not confinement — and the shipped TypeScript dialect's `find()` has **no gate at all**.
  Path authority lives engine-side, past the wire protocol; the SDK only emits directives. Worth a
  follow-up on where confinement is asserted engine-side; out of this change's scope.

---

## The single most valuable test that does not exist

A table over **`addImport` against non-named-import declaration shapes** — `import React from "react"`
(default), `import * as React from "react"` (namespace), `import type { FC } from "react"`
(type-only), `import { useState as us } from "react"` (aliased) — each asserting the **emitted bytes**.
One table catches QA-1..QA-4, all of which are mainstream React inputs, and one of which silently
emits broken code.

**Runner-up, cheap**: pin grammar **divergence** per argument (`addImport("$", …)` accepts;
`addImport("data-testid", …)` rejects). Verified to pass clean against unmutated source and fail 2/2
against the wrong-grammar mutant.

---

## Routing

| Finding | Routes to |
|---|---|
| SEC-1 (reserved words), SEC-2 (false prototype-walk claim) | **`sdd-spec`** — REQ-RXD-06 mandates the regex verbatim |
| QA-1..QA-4 (import declaration shapes) | **`sdd-spec`** first (REQ-RXD-05 does not contemplate them), then **`sdd-apply`** |
| QA-5 (assertion leak), DOC-1, DOC-2, DOC-4 | **`sdd-apply`** — mechanical, in-scope |
| ARCH-1 (`validatedOp` undocumented) | **`sdd-apply`** — check whether REQ-RXD-09 needs a spec touch |
| ARCH-3 (ADR-02 false clause) | **`sdd-apply`** — amend the ADR, or route `ops.ts:55`/`:60` through a tail helper |
| DOC-3 (`as TypeScript` in generic path) | **Planner** — core file outside the slice boundary, but a contract defect this change created; the suite currently pins the wrong text |
| ARCH-2 (validator placement) | **Archive commitments** — extend ADR-01's registered peer-module followup; split when dialect #3 lands |

**Owner decision, 2026-07-17**: **spec first, then apply.** Patching code against a signed spec that
states falsehoods re-opens on the next drift check.
