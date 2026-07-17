# Verification Report: react-dialect

**Change**: react-dialect
**Mode**: final (Strict TDD) — **iteration 2**, supersedes iteration 1's `fail`
**Spec version**: react-dialect **V5** (owner-signed 2026-07-17) + local-consumption V2 (owner-signed)
**Triage**: L — sensitive-area override (security/code-execution + public-api contract)
**Range**: `93e38d7..01ecec7` (merge-base independently established via `git merge-base main HEAD`)
**Branch**: `feat/react-dialect` · working tree clean

---

### Verdict: **pass-with-followups**

All nine council-routed fix items are **RESOLVED**, and every one was **independently reproduced**
rather than accepted on the apply record's word. The four `addImport` correctness bugs emit bytes
matching the signed V5 scenarios exactly. QA-5's near-miss mutant reproduced precisely as claimed
(76/0 false-pass → 65/11 killed).

One **new** finding surfaced from adversarial probing of the V5 surface (F-1: `arguments`/`eval`
still accepted as import bindings, emitting code a real ES module parser rejects). It is
**spec-conformant** — REQ-RXD-06 enumerates *ECMAScript reserved words* and says "at minimum", and
these two are a different grammar category (strict-mode-restricted `BindingIdentifier`s). So it is a
residual hole in the contract's **floor**, not a defect in implementing the contract. It does not
gate; it is the #1 followup, with a recommendation.

`adversarial_review`: **required** — triage L **and** sensitive area (security / code execution).

---

## Iteration History

| Iteration | Verdict | What happened |
|---|---|---|
| 1 (`f12ffba`) | **`fail`** | Gated on **one** item — F-01 (MAJOR, false `@example` on the only `./react` export). Four blind Council personas ran in parallel and found **four real `addImport` correctness bugs** plus two spec defects the single verifier missed. verify-final alone had described the change as *"a one-line JSDoc fix + `.d.ts` regen"* — on that basis it would have shipped. Recorded in `council-findings.md`. |
| — | — | Owner ruling: **spec first, then apply** (*"patching code against a signed spec that states falsehoods re-opens on the next drift check"*). Spec **V5** signed (`4fff0b7`, `9924a9d`), then a nine-item fix pass: `2079023`, `5749bf2`, `e142c3d`, `24b8227`, `5a7c719`, `610650a`, `dd2be18`. |
| **2 (`01ecec7`)** | **`pass-with-followups`** | This report. Every claim re-derived by execution; findings below. |

**What iteration 1 failed on** → F-01, now RESOLVED (verified by executing the example, byte-comparing
the built `.d.ts`, and confirming the new guard closes the seam).
**What the V5 fix pass changed** → the nine items in the table below.
**What I re-checked and how** → per-item evidence column, plus the reproductions in each section.

---

## Completeness

| Metric | Value |
|---|---|
| Slices total | 6 (S-000..S-005) |
| Slices complete | 6 |
| Tasks total | 23 |
| Tasks complete | **23** (zero `- [ ]` remaining in `slices.md`) |

---

## Build & Tests Execution

**Build**: ✅ Passed (`bun run build`, exit 0)
**Typecheck**: ✅ 0 errors (`tsc --noEmit`) at HEAD
**Tests (full suite)**: ✅ **1824 pass / 0 fail / 0 skipped** — 3889 `expect()` calls, 181 files, 22.38s

### My own numbers, each labelled with the location it was taken in

| Scope | Result | Location |
|---|---|---|
| **Full suite** | **1824 pass / 0 fail** | fresh `/private/tmp/rxd-verify2` worktree of `01ecec7`, `bun install --ignore-scripts` + `bun test`; **worktree removed after** |
| `test/dialects/react/name-validation.test.ts` (clean baseline) | **76 pass / 0 fail** | `/private/tmp/rxd-verify2` |
| same + near-miss mutant + **OLD** assertion | **76 pass / 0 fail** (false pass) | `/private/tmp/rxd-verify2` |
| same + near-miss mutant + **NEW** assertion | **65 pass / 11 fail** (killed) | `/private/tmp/rxd-verify2` |
| `tsc --noEmit` @ `01ecec7` | **0 errors** | `/private/tmp/rxd-verify2` |
| `bun run build` @ `01ecec7` | **exit 0** | `/private/tmp/rxd-verify2` |
| `tsc --noEmit` @ `2079023` / `5749bf2` / `e142c3d` | **2 / 2 / 0 errors** | `/private/tmp/rxd-verify2` (see F-3) |

**1824 = 1797 (pre-fix baseline) + 27 net new** — matches the apply record's claim exactly.

**No environmental timeout was observed, and none was interpreted as a pass.** The
trustworthy-location run was 0-fail in 22.38s, so nothing required excusing or attributing to the
environment. The known `~/Documents` first-touch-scan flakiness (state.yaml carry-forward, engram
#2277) never arose in my runs; I took every number from `/private/tmp` and did not need the control.

**Coverage**: ➖ Not available — no coverage tool configured in `openspec/config.yaml`.
**Mutation testing**: ➖ No tool configured (`testing` block has none). Substituted by hand-run probes.
**Linter**: ➖ `testing.linter.tool: null` — none configured. Reported cleanly, not skipped silently.

---

## Per-Item Rulings — the nine fixed items

| # | Item | Ruling | Evidence I actually observed |
|---|---|---|---|
| 1 | `addImport` shape bug (QA-1..QA-4) | **RESOLVED** | All four reproduced against current code through the real `find()`→run seam; emitted bytes match V5 scenarios exactly (table below); baselines 05.1–05.4 unmoved |
| 2 | SEC-1 reserved words (REQ-RXD-06.7) | **RESOLVED** (residual → F-1) | Implemented set == spec set **exactly 46/46**, zero drift, **zero over-blocking**; battery passes |
| 3 | SEC-2 Set-key-safety (REQ-RXD-06.8) | **RESOLVED** | Static scan present, scope is a **superset** of the scenario's, passes; regex self-tested **both** directions (catches `record[name]`; does not flag `namedImports: [name]`) |
| 4 | F-01 / DOC-1 false `@example` | **RESOLVED** | Example **executed** → byte-exact; committed `.d.ts` baseline **byte-identical to real built output**; guard reads the `.ts` source directly |
| 5 | QA-5 assertion leak | **RESOLVED** | Near-miss mutant reproduced by me: **76/0 old (false pass) → 65/11 new (killed)** |
| 6 | DOC-2 `.tsx`-only doc gap | **RESOLVED** | `authoring-a-dialect.md:108-109` states `find()` **REJECTS** a `.jsx` path, not silently accepts |
| 7 | DOC-4 doc-index rot | **RESOLVED** (bookkeeping → F-4) | `docs/README.md:16` + `docs/quickstart.md:186` both name `@pbuilder/sdk/react` |
| 8 | REQ-RXD-15 `validatedOp` contributor docs | **RESOLVED** | Section names `validatedOp`, the chokepoint, the raw-splice vulnerability class, + reference impl; guard has a red-proof on removal |
| 9 | ARCH-3 chokepoint | **RESOLVED** (wording residual → F-5; git residual → F-3) | Echo **empirically bounded** (35-char name → 16-char fragment); `ops.ts:61/64` route through the new helpers; `design.md` §4.4 amended |

### Item 1 — the four bugs, reproduced against CURRENT code (emitted bytes, not test verdicts)

| Council bug | Seed + op | Emitted **now** | Signed scenario | Match |
|---|---|---|---|---|
| QA-1 (type-only) | `import type { FC }` + `addImport("useState","react")` | type-only clause **unchanged** + separate `import { useState } from "react";` | REQ-RXD-05.5 | ✅ |
| QA-2 (default dup) | `import React` + `addImport("React","react")` | **zero directives** (byte-identical no-op) | REQ-RXD-05.6 | ✅ |
| QA-3 (namespace throw) | `import * as React` + `addImport("useState","react")` | **no throw** — namespace kept + separate declaration | REQ-RXD-05.8 | ✅ |
| QA-4 (aliased no-op) | `import { useState as us }` + `addImport("useState","react")` | `import { useState as us, useState } from "react";` | REQ-RXD-05.10 | ✅ |

Also verified: **05.7** (default, different name → separate decl) ✅; **05.9** (namespace, same local
name → byte-identical no-op) ✅.

**Baselines 05.1–05.4 keep their ORIGINAL expected outcomes** — a "fix" that moved them would be a
regression, and it did not: 05.1 fresh insert ✅; 05.2 merge into existing clause ✅; 05.3 idempotent
single line ✅; 05.4 still emits the **named** form `import { React } from "react";`, never
`import React from "react"` ✅.

### Item 5 — QA-5's near-miss mutant, reproduced independently

The single most important claim in the pass — re-derived from scratch, mutant applied by me:

| Configuration | Result | Meaning |
|---|---|---|
| Clean baseline | **76 pass / 0 fail** | — |
| **Near-miss mutant** (`assertValidAttributeName` wired into `addImport` instead of `assertValidImportBinding`) + **OLD** bare `.toContain("name")` | **76 pass / 0 fail** | **False pass reproduced** — `"propName"` contains `"name"` |
| **Same mutant** + **NEW** backtick-bounded `.toContain(\`${argName}\`)` | **65 pass / 11 fail** | **Killed** — the tests now discriminate |

Both the mutant and the assertion-revert were applied in the isolated worktree and reverted
(`git status --porcelain` verified empty). This is a genuine **near-miss** mutant — a plausible
*wrong* implementation (right shape, wrong grammar) — not an absence mutant. **The claim is true.**

### Item 2 — the reserved-word set, checked mechanically against the spec

Parsed `IMPORT_RESERVED_WORDS` out of source and diffed against REQ-RXD-06's enumerated set:

```
spec count: 46 (always 36 + strict 9 + await 1)   code count: 46
spec - code (missing): []    code - spec (extra): []    EXACT MATCH: True
```

Then brute-forced candidates through node's **real ES module parser** to test the set's
*completeness*, not merely its conformance:

```
Identifiers syntactically INVALID as import bindings (real parser): 48
  covered by IMPORT_RESERVED_WORDS: 46
  NOT covered (HOLES): ["arguments", "eval"]
  in set but actually legal (over-blocking): []   ← zero false rejections
```

The set is **precisely correct** — no drift, no over-blocking — with exactly two residual holes (F-1).

**Error-text / spec agreement**: the original SEC-1 defect (text promising *"a valid JavaScript
identifier"* while admitting `default`) is closed. `default` now rejects with a message naming
`` `name` `` and the reserved-word rule (REQ-RXD-06.7 satisfied), and the grammar label is accurate
on every path that can still reach it. See F-6 for a nit in the V5 changelog's description of *how*.

---

## Adversarial Quality Gate (final mode, Step 11b)

### Stage A — Code audit (`pre-pr` mode, **GATING**)

**No `Bug` / `Architecture` / `MAJOR` findings. Gate not tripped.**

| Check | Result |
|---|---|
| 3.1 untyped casts (`as any`, `as never`, `as unknown as`, `@ts-ignore`, `eslint-disable`) | ✅ zero in the change surface |
| 3.3 TODO / FIXME / deferred markers | ✅ zero |
| 2.1 layer violations | ✅ react leaf reaches only `../../core/*`; `src/core` + `src/commons` contain `dialects/` in **comment text only** |
| 2.2 ADR contradictions | ⚠️ residual wording only → F-5 (Nit-level; no property at risk) |
| 2.3 sensitive area without coverage | ✅ REQ-RXD-06/12/13 cover the code-execution surface |
| 3.2 magic numbers | ✅ the one constant (16-char cap) is named `boundedFragment(s, cap = 16)` and spec'd by REQ-RXD-13 |
| 3.4 dead duplicates | ✅ ADR-01's ~40 duplicated glue lines are a *decided, guarded* tradeoff (fit-37/38), not accidental |
| 4.1 scope creep | ⚠️ 2 doc files outside the design table — **in triage scope** → F-4 (bookkeeping, not creep) |
| 4.3 migration without versioning | ✅ N/A — no schema/migration |
| Non-null assertion `matches[0]!` (`ops.ts:66`) | ✅ guarded by the length trio immediately above it |
| ADR-01/05 honoured | ✅ `git diff 93e38d7..HEAD -- src/dialects/typescript/` = **zero lines** |
| `architecture_impact: additive` | ✅ `src/` = 5 files, **+484, zero deletions** — purely additive |

**Findings table** (none gating):

| Severity | File:Line | Finding |
|---|---|---|
| Nit | `src/core/jsx-name-validator.ts:24-31` | F-1 — `arguments`/`eval` absent from the reserved set (spec-conformant; see below) |
| Nit | `test/dialects/react/ops.test.ts:288` | F-2 — REQ-RXD-11.6's scenario titled `11.5`; stale "Deviation" comment |
| Nit | `design.md:4`, `design.md:22-53` | F-4 — revision marker stale; §4.2 omits two doc files |
| Nit | `design.md:138`, `design.md:190` | F-5 — ADR-02/§4.4 universal claim overreaches |

### Security — attacked what **CHANGED**

Per the brief I did **not** re-run `council-findings.md`'s exhaustive FAILED set (unicode/confusables,
zero-width, surrogates, control chars, `addImport.from` injection, ReDoS, prototype pollution). I
attacked the new surface only:

- **New reserved-word denylist** → 2 residual holes (F-1), proven by brute force. Case-sensitivity is
  correct (`Default` is a legal binding and is accepted — the right call).
- **New shape-aware merge algorithm** → probed inline `type` specifiers
  (`import { type FC, useEffect }`), declaration-level type-only with the **same** name, mixed
  `import React, { useState }`, and side-effect `import "react"`. All behave per the V5 algorithm.
  The inline-type / same-name no-op is **spec-conformant and defensible**: step 1's own rationale
  anticipates it (*"creating a new specifier here would... produce an invalid re-declaration"*) — and
  it genuinely would (TS2300 duplicate identifier). **Not a finding.**
- **New tail helpers** → echo bound verified empirically: a 35-char grammar-valid dotted
  `elementName` yields a 16-char fragment, full name absent from the message.

### Stage B — Blind dual review flag

**`adversarial_review`: required** — triage = L **and** the change touches a flagged sensitive area
(security / code execution: a new `.raw()`-equivalent instance in a new AST realm). Iteration 1 is
the empirical argument for it: the single verifier gated on one item while four blind personas found
four real bugs. I am the same single verifier.

**Live-app pass**: N/A — no UI surface (developer-facing SDK library).

---

## Spec Compliance Matrix

A scenario is COMPLIANT only where a covering test **passed at runtime**. Full suite green (1824/0)
is the execution evidence; rows record the specific verification for the V5 delta and load-bearing REQs.

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-RXD-01 | .1 exact 2-op set (`toEqual`, anti-smuggle) | `ops-exact-set.test.ts` | ✅ COMPLIANT |
| REQ-RXD-02 | .1–.5, .8–.10 extension gate + sync timing | `dialect.test.ts` | ✅ COMPLIANT |
| REQ-RXD-03 | .1–.5 fidelity + Tsx-engagement divergence | `dialect.test.ts`, `react-conformance.test.ts` | ✅ COMPLIANT |
| REQ-RXD-04 | .1–.6 targeting trio + upsert | `ops.test.ts`, `name-validation.test.ts` | ✅ COMPLIANT |
| REQ-RXD-05 | **.1–.4 baseline (outcomes unchanged)** | `ops.test.ts` | ✅ COMPLIANT — re-verified byte-exact |
| REQ-RXD-05 | **.5–.10 (V5 shape-aware)** | `ops.test.ts` | ✅ COMPLIANT — all four bugs reproduced fixed |
| REQ-RXD-06 | .1–.6 grammars + denylist + `from` escaping pin | `name-validation.test.ts`, `ops.test.ts` | ✅ COMPLIANT |
| REQ-RXD-06 | **.7 reserved-word battery + lookalikes** | `name-validation.test.ts` | ✅ COMPLIANT |
| REQ-RXD-06 | **.8 Set-key-safety static scan** | `name-validation.test.ts` | ✅ COMPLIANT (ID unlabelled → F-2) |
| REQ-RXD-07 | .1 heterogeneous coalescing → one modify | `dialect.test.ts`, `react-conformance.test.ts` | ✅ COMPLIANT |
| REQ-RXD-08 | .1 corpus (19 round-trip + 1 reject class), .2 op-pack fidelity | `react-conformance.test.ts` | ✅ COMPLIANT |
| REQ-RXD-09 | .1–.5 author docs | `docs.test.ts` | ✅ COMPLIANT (F-01's JSDoc gap now closed) |
| REQ-RXD-10 | .1–.6 placement / whitespace / closing form | `dialect.test.ts` | ✅ COMPLIANT |
| REQ-RXD-11 | **.5 `{1+}` emitted verbatim** | `ops.test.ts:264` | ✅ COMPLIANT |
| REQ-RXD-11 | **.6 unterminated value fails SAFELY, contained** | `ops.test.ts:288` | ✅ COMPLIANT (mislabelled `11.5` → F-2) |
| REQ-RXD-12 | .1 hostile value emitted verbatim by contract | `ops.test.ts` | ✅ COMPLIANT |
| REQ-RXD-13 | .1 canary, .2 zero-emit ×4 paths, .3 bounded no-echo | `name-validation.test.ts`, `canary-no-echo.test.ts` | ✅ COMPLIANT |
| REQ-RXD-14 | .1 spike deps absent (manifest + lockfile) | `fit-36` | ✅ COMPLIANT |
| REQ-RXD-15 | **.1/.2 contributor `validatedOp` docs + red-proof** | `docs.test.ts` | ✅ COMPLIANT (IDs unlabelled → F-2) |
| REQ-LC-01..03 | installed-consumer six-subpath parity, both legs | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |

**Compliance summary**: **89/89** REQ/scenario IDs across both spec files covered by executed,
passing tests (retired `REQ-RXD-02.6`/`.7` correctly excluded — never consumed, never reused).
**Zero UNTESTED · zero FAILING · zero PARTIAL.**

---

## Strict TDD (final audit)

**Verdict**: `pass-with-followups`

### TDD Cycle Adherence — my ruling on this pass

- **Method used**: git-history (Method 1) + commit-message inspection (Method 3), corroborated
  against the working-tree record.
- **No anti-TDD pattern anywhere in this pass.** For items 1, 2 and 4 the tests land in the **same
  commit** as the implementation (`2079023`, `5749bf2`, `24b8227`), which `strict-tdd-verify.md`
  Method 1 explicitly permits (*"tests added before **or with** implementation"*). The halt condition
  is *"tests added AFTER implementation"* — **not met**.
- **The near-miss-mutant amendment is HONOURED.** This is the binding new requirement and the reason
  iteration 1's coverage argument collapsed, so I verified it rather than accepted it: the pass used a
  genuine near-miss mutant (a plausible *wrong* wiring, not an absence), and I reproduced **both legs
  myself** (76/0 → 65/11). The record also **retracts** its own earlier false generalisation in place
  (`apply-progress.md:163-172`, *"the paragraph above is WRONG"*) rather than quietly editing it —
  that is the correct disposal of a bad claim, and it is the single strongest signal in this pass.
- **Item 9's TDD claim is NOT reconstructible from git** (F-3): its wiring + tests landed in `2079023`
  while its helpers landed in `e142c3d`, three commits later — so at `2079023` the tree does not
  compile and the tests as committed **could not have run**. The described RED→GREEN sequence is
  plausible in the working tree and the end state is correct and tested, but the commit graph does
  not corroborate it, and `apply-progress.md`'s per-item commit map is wrong for item 9.
- **Disclosed process deviation — RULED RECOVERABLE.** The QA-5 assertion fix landed inside `5749bf2`
  (item 2's commit); the message describes only item 2. Verified: the three assertion changes are
  indeed in that commit. Both changes touch the same file and the same validator surface; the
  omission is **disclosed in the record at the point of the deviation**; and no reviewer is misled
  about *what shipped* — only about *which commit to read*. This is exactly the "disclosure LOCATION"
  lesson the S-002 ruling extracted, applied correctly this time. **Not a gate.**

### Assertion Quality
- Tests scanned: all change-owned test files. Banned-pattern matches: **0 new**.
- `not.toThrow()` at `name-validation.test.ts:78-89` — **CLOSED ruling, not re-opened**.
- Assertions are overwhelmingly exact `toBe` against literals or committed goldens. QA-5 — the one
  genuine assertion leak in the change — is fixed and **proven** to discriminate.

### Triangulation
- Functions audited: `addImport` (3-branch shape-aware algorithm), `setJsxProp` (match trio + upsert
  fork + shorthand downgrade), the three validators. **Triangulation gaps: 0.**
- The six new 05.5–05.10 scenarios each exercise a **distinct declaration shape** — triangulation is
  inherent to the scenario set, not bolted on. The reserved-word battery adds 9 words across all
  three grammar families + 3 lookalikes proving exact membership.

### Mutation Testing
- Tool: **Not configured** — skipped per the module's own rule (`sdd-init` has no mutation tool).
- Substituted: 1 near-miss mutant (reproduced by me, both legs) + the pass's own absence probes.

### REQ-ID Coverage
- REQs in spec: **89**. With ≥1 executed, passing test: **89**. **Uncovered: 0.**
- Four IDs (`06.8`, `11.6`, `15.1`, `15.2`) are covered in **substance** but not referenced **by ID**
  → traceability finding F-2, **not** `req-coverage-gap` (every behaviour has a passing test).

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-01 — fidelity glue duplicated, TS leaf untouched | ✅ | `git diff` on `src/dialects/typescript/` = **zero lines** |
| ADR-02 — `validatedOp` chokepoint, core-resident grammars | ✅ | Both ops wrapped; mutation structurally unreachable pre-validation |
| ADR-02 — Set-key-safety clause | ✅ | Static scan passes; new `addImport` uses `.includes()`/`.find()` on plain arrays |
| ADR-02 — no-echo tail chokepoint | ⚠️ | Now true for the class ARCH-3 flagged; universal wording still overreaches → F-5 |
| ADR-03 — structured API only, no text splice | ✅ | `addImportDeclaration`/`addNamedImport`/`addAttribute` only; zero concatenation |
| ADR-05 — `addImport` written fresh, not copied from the lax TS one | ✅ | Validated from day one |
| §4.2 File Changes table vs real diff | ⚠️ | 2 doc files missing → F-4 |
| §4.2b Flow Changes | ✅ | e2e proves the subpath resolves post-pack and post-bun-link |
| `architecture_impact: additive` | ✅ | +484, **zero deletions** in `src/` |

### Problem Fit (vs `triage.md`)

**No `problem-drift`.** The delivered change closes the stated gap: `.tsx`/JSX files were unopenable;
`@pbuilder/sdk/react` now ships with a parse/print pair, `find()` entry, extension gate, exactly two
ops, and conformance proof. All three `in_scope` bullets delivered. Both `out_of_scope` bullets
respected — notably, **DOC-3 was deliberately NOT fixed** precisely because fixing it requires
threading a display name through the generic `dialect-handle` seam, which triage excludes (*"Any
change to the engine or wire protocol"*). I confirmed `src/core/dialect-handle.ts` is genuinely
untouched. Declining that fix is the *correct* way to honour the scope contract, not an omission.

---

## Drift / Cross-Change

| Module | Status | Notes |
|---|---|---|
| fit-36 spike-deps-absent | ✅ Pass | `dependencies` still exactly `{ts-morph: 28.0.0}` |
| fit-37 core/commons AST-free | ✅ Pass | Transitive walk green |
| fit-38 parser-construction confinement | ✅ Pass | Green |
| fit-04 `.d.ts` semver gate | ✅ Pass | Baseline **byte-identical to real built output** — verified by building and diffing, not assumed |
| fit-09 / fit-14 six-subpath | ✅ Pass | Green |
| `src/dialects/typescript/**` | ✅ | Zero change — the shipped sensitive dialect is untouched |

---

## Issues Found

### CRITICAL (must fix before archive)
**None.**

### WARNING (should fix; does not block)

**F-1 — `arguments` and `eval` are still accepted as import bindings, and emit invalid code.**
*Location*: `src/core/jsx-name-validator.ts:24-31` (`IMPORT_RESERVED_WORDS`).
`addImport("arguments", "react")` emits `import { arguments } from "react";`. Node's real ES module
parser returns **`SyntaxError: Unexpected eval or arguments in strict mode`** — while the control
(`useState`) fails only at *resolution* (`ERR_MODULE_NOT_FOUND`), proving it parsed. This is SEC-1's
exact class — invalid emission that `print()` never re-validates — narrowed from 46 words to 2
identifiers.
*Why it is NOT a spec violation*: REQ-RXD-06 requires exclusion of *"the ECMAScript reserved words
listed below"* and says the set must contain them **"at minimum"**. `arguments`/`eval` are **not**
ECMAScript reserved words — they are strict-mode-restricted `BindingIdentifier`s, an early-error
rule, a different grammar category. The implementation satisfies the signed contract **exactly**
(46/46, zero over-blocking). The hole is in the contract's **floor**.
*Why it is worth closing anyway*: REQ-RXD-06's own stated rationale — *"strict-mode and
`await`-reservation both apply unconditionally here because `addImport` always emits into an ES
module, and ES modules are ALWAYS strict"* — is precisely the argument that excludes these two. My
brute-force sweep proves the set would then be **complete** (48/48, still zero over-blocking).
*Impact*: **low**, matching SEC-1's own rating — author-controlled binding name; no injection, no
code execution; worst case is a broken consumer build.
*Fix*: add `"arguments", "eval"` to the Set + one scenario line.
**Recommendation**: I report rather than route — but this is the cheapest finding in the change to
close (~2 words + a spec line), it sits in the one channel REQ-RXD-06 titles *"security —
load-bearing"*, the sensitive-area override is in effect, and closing it makes the denylist
**provably complete**. If the orchestrator wants zero residual of SEC-1's class, route to `sdd-spec`
then `sdd-apply` before archive. If not, it registers cleanly as a pending-change.

**F-2 — Four V5 scenario IDs are covered in substance but not referenced by ID.**
`REQ-RXD-06.8`, `REQ-RXD-11.6`, `REQ-RXD-15.1`, `REQ-RXD-15.2` appear nowhere in `test/` or `docs/`.
All four behaviours **are** tested and passing — traceability, not a coverage gap, so **no
`req-coverage-gap`**. Sharpest instance: `ops.test.ts:288` implements REQ-RXD-11.6's scenario but is
**titled** `REQ-RXD-11.5`, and its comment still calls itself *"Deviation from the spec's own literal
example"* — V5 **eliminated** that deviation by amending the spec to `'{1+}'`. The comment now
describes a conflict that no longer exists. Given this change's own meticulous ID-stability
discipline (*retired IDs "never to be reused"*), the mislabel deserves correcting.

**F-3 — `2079023` and `5749bf2` do not typecheck; item 9's git evidence is not reconstructible.**
`2079023` wires `zeroMatchTail`/`multiMatchTail` into `ops.ts` **and** adds the ARCH-3 tests, but the
helpers only arrive in `e142c3d` — **three commits later**. The consumer landed before the producer.
Verified by checking out each commit:

| Commit | `tsc --noEmit` errors |
|---|---|
| `2079023` | **2** (`TS2305: Module '"../../core/reject-tail.ts"' has no exported member 'zeroMatchTail'`) |
| `5749bf2` | **2** |
| `e142c3d` | 0 |
| `01ecec7` (HEAD) | **0** |

**HEAD is correct and green** — this affects branch archaeology and `git bisect`, not the shipped
artifact. It also makes `apply-progress.md`'s per-item commit map wrong for item 9.

**F-4 — `design.md` §4.2 omits two files it should list; revision marker stale.**
The diff touches `docs/README.md` and `docs/quickstart.md` (item 7 / DOC-4); neither appears in the
design's File Changes table or in any REQ. **This is NOT scope creep against the triage contract** —
`triage.md` puts *"Docs for the new dialect surface"* explicitly `in_scope`, and DOC-4 was routed to
`sdd-apply` by the Council. It is a **stale design table**: `design.md` was amended in this very pass
(`e142c3d` rewrote §4.4) yet §4.2 was not updated in the same edit. Relatedly, `design.md:4` still
reads **`Revision: 2`** despite that amendment — the briefing calls it rev 3; the artefact does not.

**F-5 — ADR-02 / §4.4 still claim a universal property the code does not literally have.**
Both still say *"every react reject routes through `reject-tail.ts`'s helpers, by construction"*.
Four extension-gate rejects (`index.ts:70/75/80/84`) and `ast.ts:75` do **not** — they throw fixed
literals directly. **No property is at risk**: they interpolate nothing, so there is no echo to
bound, and I verified no react reject path echoes an author value unbounded. But this is the same
*shape* as ARCH-3 (an ADR asserting a universal the code doesn't hold), at much lower severity — and
REQ-RXD-02 explicitly **permits** a bounded path echo, so a future author adding one would bypass the
chokepoint with no helper to reach for.

### SUGGESTION (never blockers)

**F-6** — Spec V5's changelog says *"the rule label now names the reserved-word exclusion so spec and
message agree"*. The grammar rule label is unchanged (`"be a valid JavaScript identifier"`,
`jsx-name-validator.ts:96`); agreement is achieved instead by a **separate** reserved-word message.
The outcome is correct and REQ-RXD-06.7 is satisfied — only the changelog's description of *how* is
inaccurate.

**F-7** — ADR-02's status is still `Proposed` (`design.md:180`) though it is fully implemented and
verified. Pre-existing, not this pass's doing; worth flipping to `Accepted` at archive.

---

## Explicitly NOT re-opened (CLOSED rulings, per `council-findings.md`)

S-002's TDD ordering (adjudicated on git evidence — impl+tests in the same commit `fcd24d7`, which
Method 1 permits); the fit-37 RED fixtures; `not.toThrow()` at `name-validation.test.ts`; the
"frozen" denylist lacking `Object.freeze`; the path gate. Also **out of scope and not counted against
this change**: **DOC-3** (`dialect-handle.ts:178` — owner-accepted pending-change; I confirmed the
file is genuinely untouched, which is the correct way to honour triage's engine exclusion), **ARCH-2**
(validator placement → archive commitments, splits when dialect #3 lands), and the subprocess-timeout
debt.

---

## Followups for `sdd-archive` to register in `project/pending-changes`

1. **F-1** — extend `IMPORT_RESERVED_WORDS` with `arguments`/`eval` (spec touch + 2 words); proven to
   make the set complete (48/48). *Cheapest finding here; recommend closing before archive.*
2. **F-2** — relabel `ops.test.ts:288` to REQ-RXD-11.6, drop its stale "Deviation" comment, and cite
   `06.8`/`15.1`/`15.2` by ID.
3. **F-3** — record that `2079023`/`5749bf2` are non-building commits; correct `apply-progress.md`'s
   item-9 commit map. Consider squashing on merge.
4. **F-4** — add `docs/README.md` + `docs/quickstart.md` to `design.md` §4.2; bump `Revision` to 3.
5. **F-5** — reword ADR-02/§4.4 to the accurate universal, or route the extension gate's (permitted)
   path echo through a bounded helper.
6. **F-7** — flip ADR-02 `Proposed` → `Accepted`.
7. Pre-existing carry-forwards: DOC-3; ARCH-2 peer-module split at dialect #3; TS-dialect
   trust-boundary JSDoc backfill; default/mixed-import support; `.jsx` row (**already registered —
   do not duplicate**); subprocess-timeout debt.

---

### Verdict

**`pass-with-followups`** — the nine routed items are genuinely resolved and independently
reproduced; the four correctness bugs emit bytes matching the signed V5 scenarios; QA-5's tests now
provably discriminate (76/0 → 65/11, mutant applied by me); full suite **1824 pass / 0 fail** from a
trustworthy location; Step 11b's gating audit found no Bug/Architecture/MAJOR. Seven followups, none
blocking. F-1 is a real, empirically-proven residual of SEC-1's class that the signed spec's floor
does not cover — cheap enough to be worth closing before archive if the orchestrator so routes.
