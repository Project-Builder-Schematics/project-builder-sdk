# Verification Report: react-dialect

**Change**: react-dialect
**Mode**: final (Strict TDD)
**Spec version**: react-dialect V4 (owner-signed) + local-consumption V2 (owner-signed)
**Triage**: L — sensitive-area override (security/code-execution + public-api contract)
**Range**: `93e38d7..f12ffba` (merge-base independently established via `git merge-base main HEAD`)
**Branch**: `feat/react-dialect` · working tree clean

---

### Verdict: **fail**

One gating finding (F-01, MAJOR — quality). Everything else in this change passes, and passes
well. This is a **one-line JSDoc fix + `.d.ts` baseline regen**, not a re-plan: routing
`verify-failed`, category `quality` → Executor `sdd-apply`, then re-verify.

The verdict is narrow on purpose. Suite, typecheck, build, coverage, REQ traceability, design
conformance, problem fit, and the entire adversarial security surface are green — several of
them verified against my own independent probes rather than the prior reports' narratives.

---

## Completeness

| Metric | Value |
|---|---|
| Slices total | 6 (S-000..S-005) |
| Slices complete | 6 |
| Tasks total | 21 |
| Tasks complete | 21 (all `[x]` in `slices.md`) |

---

## Build & Tests Execution — my own numbers, each labelled by location

The environmental effect described in the carry-forward is **REAL and I reproduced its control
myself**. Same commit `f12ffba`, two locations, identical 1797-test population:

| Location | Result | Wall | Note |
|---|---|---|---|
| `/private/tmp/rd-verify-f12ffba` (fresh worktree of `f12ffba` + `bun install`) | **1797 pass / 0 fail** | 23.77s | The trustworthy number. Reproduces the carry-forward and the apply record exactly. |
| `/Users/danielramirez/Documents/POC/project-builder-sdk` (working directory) | **1795 pass / 2 fail** | 53.67s | Same commit, same 1797 tests. 2.3x wall. |

**Identity of the 2 location-dependent failures — confirmed, not assumed**: I re-ran the
suspected file in `~/Documents`: `test/docs/quickstart-docs.test.ts` → `10 pass / 1 fail`, the
failure being literally `this test timed out after 5000ms`. That file is **not in this change's
diff** — it is pre-existing and untouched.

**Ruling on the environmental effect**: I did not report a timeout as a pass, and I do not
attribute either failure to this change. The control (same commit, different directory) settles
it: 0 fail vs 2 fail is location, not code.

**Does this change ADD to the timeout exposure? No — and I checked rather than assumed:**

- No new test file in this change spawns a subprocess (`rg -l "spawnSync|execSync|Bun.spawn"`
  over all new react/conformance/fitness test files → zero hits; all in-process).
- S-005's `installed-consumer.e2e.test.ts` edit adds **zero new subprocess spawns** — it adds one
  `react: await probe(...)` line inside the *already-running* in-process probe script and two
  assertions. Spawn count is unchanged from before this change.
- The change's own 127 tests (`test/dialects/react/` + `react-conformance.test.ts`) pass
  **127/0 in `~/Documents` itself** — the affected-location run.

The missing-explicit-timeout debt stays pre-existing and out of scope, correctly.

| Check | Result |
|---|---|
| **Build** (`bun run build`, clean worktree) | ✅ Passed |
| **Typecheck** (`tsc --noEmit`, clean worktree) | ✅ Clean |
| **Tests (full suite)** | ✅ 1797 pass / 0 fail / 0 skipped (trustworthy location) |
| **Linter** | ➖ Not available — `testing.linter.tool: null` in `openspec/config.yaml` |

### Coverage (Strict TDD — expanded per-file over changed source)

`bun test --coverage`, clean worktree. Every file in design §4.2 with Action ≠ Read-only:

| File | % Funcs | % Lines |
|---|---|---|
| `src/core/jsx-name-validator.ts` | 100.00 | 100.00 |
| `src/core/reject-tail.ts` | 100.00 | 100.00 |
| `src/dialects/react/ast.ts` | 100.00 | 100.00 |
| `src/dialects/react/index.ts` | 100.00 | 100.00 |
| `src/dialects/react/ops.ts` | 100.00 | 100.00 |

Threshold: `null` (unset in config) → no threshold gate. All five at 100%.

---

## Strict TDD (final audit)

**Verdict**: pass-with-followups (does not contribute to the `fail` — F-01 is a quality finding,
not a TDD one)

### TDD Cycle Adherence — **the S-002 ordering violation, ruled here, terminally**

I am the terminus for this. I did not inherit the "resolved" framing, and I did not let three
hops of deferral stand in for a finding of compliance.

**What actually happened** (disclosed in `apply-progress.md`): during S-002, `addImport`'s
implementation body and its `ops.test.ts` tests were written in the same editing pass —
implementation slightly ahead of watching the tests fail. RED was proven retroactively via two
probes before the base commit.

**Method 1 — git history analysis (the module's preferred method), run by me:**

```
fcd24d7  feat(react-dialect): S-002 addImport — merge/create/idempotent, coalescing, exact op-set
  src/dialects/react/ops.ts                    | 42 +++++++-
  test/dialects/react/ops.test.ts              | 93 ++++++++++++++++++
  test/dialects/react/ops-exact-set.test.ts    | 34 ++++++
  test/dialects/react/name-validation.test.ts  | 69 +++++++++++-
  ... (impl and tests in the SAME commit)
```

`strict-tdd-verify.md` Method 1 accepts "tests added before **or with** implementation" and
defines the anti-TDD pattern as "tests are added in a separate commit **AFTER** implementation".
Method 3's anti-pattern is "feat → test". **Neither occurred.** Impl and tests landed together in
one `feat:` commit. The final-mode halt condition — *"Tests added AFTER implementation (anti-TDD
pattern from git history)"* — **is not met on the evidence.**

**So what is the residue, honestly?** RED was not observed *live* before the implementation was
typed. That is a real ordering violation and it was correctly self-disclosed. The question that
matters is whether it caused the harm the RED phase exists to prevent.

RED buys three things: (1) proof the test *can* fail; (2) proof it fails for the *right reason*;
(3) proof the test *drove the design*.

- **(1) and (2) are empirically closed, with reproducible numbers.** The body-stub probe
  (`// TDD-RED-STUB`, validators left wired) produced **19 pass / 5 fail**, the five being exactly
  the body-dependent scenarios, failing at *assertion* level with quoted expected/received — not
  import errors. This is a *stronger* discrimination proof than a naive RED, which on a
  not-yet-written module typically fails with a module-resolution error and proves nothing about
  assertion quality. REQ-RXD-06.3 correctly kept passing under the stub (its reject fires in the
  validator, before the body) — a detail that only a genuine probe would produce.
- **Corroborated independently.** verify-in-loop-4 ran its *own* probes (A: body no-op → exactly
  6 body-dependent tests fail; B: idempotency guard removed → exactly REQ-RXD-05.3 fails;
  C: validator unwired → exactly the 2 validator-shaped tests fail). Two independent parties,
  same isolation. This is not builder self-report.
- **(3) is moot here, and that is the substantive point.** The API shape was not the tests' to
  drive — it was fixed *upstream* by the signed spec (REQ-RXD-05: merge/create/idempotent/
  named-only) and by design §4.4 + **ADR-05, which makes the structured path NON-NEGOTIABLE**.
  The tests could not have driven a different design without violating an accepted ADR. RED's
  design-driving function was already discharged by spec+design.

**RULING: ACCEPTABLE — not a `tdd-violation` finding.** The git record shows tests-with-impl
(permitted by Method 1); the halt condition (tests-after-impl) is not met; and the only property
genuinely at risk — vacuous or non-discriminating tests — is closed by reproducible probes from
two independent parties, over an API whose shape was pinned upstream anyway.

**It does not vanish, either.** It is recorded below as a **followup lesson** (`project/
lessons-learned`), because the reason this cost four verify iterations is that the event was
initially reported only in a return envelope and not in `apply-progress.md`. The process defect
worth carrying forward is the *disclosure-location*, not the ordering.

### Mutation-probe-for-RED substitution (S-003/S-005) — ruled

**RULING: ACCEPTABLE — I agree with in-loop-6, on independent reasoning.**

S-003 wires S-000–S-002 behaviour into a new conformance surface; S-005 wires S-000's `./react`
export into the e2e proof. Both exercise behaviour that genuinely pre-existed. For such a test, a
literal RED is **not merely inconvenient — it is incoherent**: you cannot watch a test fail for
behaviour that already works without first sabotaging shipped, already-verified production code.
Doing so would be a worse practice than a disclosed, reverted probe. The mutation probe is the
*only* honest RED available, and it answers the exact question RED asks ("would this test move if
the behaviour broke?").

The substitution is used narrowly (only where pre-existing behaviour meets a new test surface,
never as a general RED bypass); each probe isolates exactly one describe block; each was reverted
with a verified-empty `git diff`. S-004, where genuine RED *was* available (doc prose did not
exist), used genuine RED — 11/15 failing first. That the team reached for real RED when it
existed and the probe only when it didn't is precisely the discriminating evidence that this is
judgement, not a workaround.

### Assertion Quality

- Tests scanned: 80 `it()` across the change's 6 new test files + 3 modified.
- Banned-pattern matches: **0 substantive.** No `toBeDefined()`, `toBeTruthy()`, `toBeFalsy()`,
  `objectContaining(...)`-as-whole-assertion, or snapshots anywhere in the change.
- **One mechanical match, audited and CLEARED — recorded so the next gate need not re-litigate
  it**: `name-validation.test.ts:78-83` and `:85-89` are two tests whose only assertions are
  `expect(() => assertValidX(...)).not.toThrow()`, which literally matches the module's
  "`not.toThrow()` as the only assertion" pattern. I rule this a **false positive in substance**:
  the assertion under test is a `void`-returning `assert*` function whose entire contract is
  binary (throw / don't throw), so `not.toThrow()` is the *complete and exact* expression of the
  acceptance half of REQ-RXD-06.2/06.6 — not a weak proxy for a stronger assertion that exists.
  It is triangulated three ways: the same file's 30-case reject battery (a
  validator that accepted everything would fail 30 tests), the byte-exact golden
  `setprop-widened-propnames.txt` covering the same names end-to-end in `ops.test.ts`, and my own
  probe below. `dialect.test.ts:142`'s `not.toThrow()` is *paired* with `toThrow()` on `:141` —
  it is the control half of REQ-RXD-03.5's divergence proof, not a sole assertion.

### Triangulation

- Functions audited: 8 (3 validators, `validatedOp`, `setJsxProp`, `addImport`,
  `matchingElements`, `find`'s gate).
- Gaps: **0**. `find`'s 4-branch gate → 8 scenarios; `setJsxProp`'s match trio (0/1/N) → all
  three branches; upsert × 3 value forms + the `removeInitializer` downgrade branch (caught as a
  gap by in-loop-2 and fixed with a mid-position triangulation companion); `addImport`
  merge/create/idempotent/named-only → 4.

### Mutation Testing

- Tool: **Not configured** — `testing.mutation_testing.tool: null` in `openspec/config.yaml`.
  Skipped per module, cleanly, not silently.
- Compensating evidence: 8 manual mutation probes across S-002/S-003/S-005, each independently
  reproduced by an in-loop verifier. Not a scored run, but real discrimination evidence.

### REQ-ID Coverage

- REQs in spec: **17** (REQ-RXD-01..14, REQ-LC-01..03)
- REQs with ≥1 test: **17**
- Uncovered: **0** — independently swept, not trusted from the reports.

---

## Adversarial Quality Gate (Step 11b)

### Stage A — Code audit (`pre-pr` mode, per `code-audit.md`) — **GATING**

**1 gating finding, 3 followups.**

#### Finding F-01 — MAJOR — Shipped public `.d.ts` tells authors the ops don't exist yet

**Category**: public-api documentation drift (Group 1 / Group 3 boundary)
**Location**: `src/dialects/react/index.ts:54` → emitted verbatim into
`test/fitness/dts-baseline/react.index.d.ts` (the FIT-04-pinned semver baseline)
**Anchorable**: yes

**What**: `find()`'s JSDoc `@example` — the only worked example on the new public subpath's
shipped type surface — reads:

```ts
 * @example
 * import * as react from "@pbuilder/sdk/react";
 *
 * export const run = async () => {
 *   await react.find("src/Button.tsx").modify((ast) => {
 *     // structured ops arrive in later slices; .modify() is the escape hatch today.
 *   });
 * };
```

This is S-000 walking-skeleton wording. **Both ops shipped in S-001/S-002.** The statement is
affirmatively false in the published package.

**Why**: This is not a missing doc — it is a *wrong* one, on the sensitive `public-api (contract)`
surface this change was L-classified partly to protect. It is what an author sees in an IDE
tooltip and on the published types. It tells them `setJsxProp`/`addImport` do not exist and to
reach for `.modify()` — steering them to the raw escape hatch (the *code-execution* seam the
security override exists for) instead of the two validated, structured ops this entire change was
built to give them. REQ-RXD-09's stated purpose is author-facing **"honest limitations"**; the
change spent a whole slice (S-004) reconciling *stale framing* (REQ-RXD-09.4) in
`docs/authoring-a-dialect.md` — and the identical staleness class survived in the JSDoc that
`docs.test.ts` **already opens and reads** (`REACT_INDEX_PATH`, `:21`, guarding `find`'s JSDoc for
REQ-RXD-09.5). The guard was in the right file and asserted only presence of required sentences,
so nothing caught a false one.

**Evidence**:
- `src/dialects/react/index.ts:54` (verified in source)
- `test/fitness/dts-baseline/react.index.d.ts` — the stale `@example` is present in the committed
  public-contract baseline, i.e. it ships
- `rg "later slices|escape hatch today" src/` → exactly this one site (plus `:1`'s internal
  "walking skeleton" comment, which does not reach the `.d.ts` — see S-03)
- `apply-progress.md` S-001 records that only the *"future setJsxProp" phrase* was corrected to
  present tense — the `@example` body was not revisited
- `slices.md` S-004.4 was marked **"N/A: `find`'s JSDoc text was not touched by this slice"** —
  yet `docs.test.ts:129` reads exactly that file. This is the seam the miss fell through.

**Fix options**:
1. (Preferred) Rewrite the `@example` to the shipped coalesced journey, mirroring the doc's own
   accurate worked example (`.addImport("handleClick", "./handlers").setJsxProp("Button",
   "onClick", "{handleClick}")`), then `bun run build` and regenerate
   `test/fitness/dts-baseline/react.index.d.ts`. Consider extending `docs.test.ts` with a guard
   asserting the `@example` names both shipped ops — the same pinned-sentinel pattern S-004
   already uses — so this cannot regress.
2. Minimal: drop the false sentence only. Weaker — leaves the entry point without a worked example
   of the ops that are the entire point of the change.

---

*Followups (minor/info — NOT blockers):*

- **S-01 — `Nit`, spec-wording** · `openspec/changes/react-dialect/specs/react-dialect/spec.md`
  REQ-RXD-11.5. The signed scenario's literal example — `setJsxProp("Button", "data-x", "{")` — is
  **unimplementable** under ADR-03's structured-API-only mandate: ts-morph@28 reparse-and-
  reconciles the whole file after each structural edit, so an unterminated `{` throws
  `Manipulation error: A syntax error was inserted.` before `print()`. The team handled this
  correctly and honestly: the substance (no output re-validation of `value`) is proven with a
  delimiter-balanced `'{1+}'`, and an *adjacent* test pins that the genuinely unterminated case
  still fails **safely** (contained, zero directives, byte-unchanged) rather than corrupting.
  Both the deviation and its rationale are documented in the test body and `apply-progress.md`.
  → Amend the scenario's example wording at the next spec touch. **⚠️ PARTIAL on the literal
  scenario text; substance COMPLIANT.** Not gating: the requirement's real property is proven,
  the deviation is disclosed, and the boundary is tested.
- **S-02 — `Nit`, gate edge** · `src/dialects/react/index.ts:61`. A file literally named `.tsx`
  passes the gate (`".tsx".endsWith(".tsx")` → true), whereas the spec's own suffix rule — under
  which `.babelrc`'s suffix is `babelrc` — implies `.tsx`'s suffix is `tsx`, i.e. it should reject
  with the "only `.tsx`" tail. Verified by probe. Utterly obscure, zero security impact, spec is
  ambiguous here. Every other gate edge I probed is **correct**: `Button.TSX`, `Button.tsx.md`,
  `src/v1.2/Button`, `.babelrc`, `Button.` all reject with the right tail.
- **S-03 — `Nit`, stale internal comment** · `src/dialects/react/index.ts:1` still reads
  "S-000: ... (REQ-RXD-01, walking skeleton)". Internal only — does not reach the `.d.ts`. Natural
  to sweep alongside F-01.

*Audited and explicitly NOT findings:*

- **Scope creep — ruled NO.** `test/fixtures/red/fit-37-transitive/{leaf,helper}.ts` are the only
  two files in the diff absent from design §4.2's File Changes table. They are the RED fixtures
  for `fit-37`, which **is** a designed row; `test/fixtures/red/**` is a pre-existing repo
  convention (present at merge-base `93e38d7` with sibling dirs `dialect-generics/`,
  `dialect-typescript/`, `author-emulation/`); both are marked `[permanent-fixture]`, excluded
  from tsc, never executed; and §4.2 already admits glob-style companion rows
  (`test/dialects/react/golden/*.txt`). They make fit-37 catch *transitive* AST imports, not just
  direct — a strictly stronger guard. Calling this MAJOR scope-creep would be mechanical
  rule-matching, not judgement.
- **`addImport.name` denylist widening — ruled NO.** The implementation applies the reserved-name
  denylist to `addImport.name`, which REQ-RXD-06's bullet for that argument does not itself
  mandate. But REQ-RXD-06.5 scopes the battery "*and, where the grammar applies, as
  `addImport.name`*", so this is consistent with the signed scenario and strictly safer. Not drift.
- **"Frozen" denylist — ruled NO.** `JSX_NAME_DENYLIST` is `ReadonlySet` (compile-time) without
  `Object.freeze`. `Object.freeze` does **not** protect a Set's internal `[[SetData]]` anyway —
  it would be theatre. The spec's "frozen" clause is about the *mechanism* (`Set` + `.has()`
  equality, never an object literal, never regex-encoded), and that is exactly what ships.

### Security — sensitive-area override in effect, judged adversarially with my own probes

I did not take the tests' word for this. I wrote and ran an independent probe against the real
`jsx-name-validator` / `ops` / `ast` modules. **The surface holds.**

| Attack | Result |
|---|---|
| Newline/CR bypass of the anchored grammars (`"a\n"`, `"onClick\n"`, `"a\r"`) | **rejected** — confirms JS `$` is end-of-input-strict (no Python-style trailing-newline bypass) |
| Attribute-name breakout (`"a=1"`, `"a>"`, `'a"'`, `"a{"`, `"a/"`, `"on Click"`) | **all rejected** — no admitted char (`[A-Za-z0-9_-]` + one `:`) can terminate the attribute-name token |
| Grammar edges (`":a"`, `"-a"`, `"1a"`, `""`, `"a:b:c"`) | **all rejected** |
| Widened real-world names (`data-testid`, `aria-label`, `xlink:href`) | **accepted**, splice contained: `<Button x:y={1} />` |
| `addImport` clause breakout (`'x } from "evil"; import { y'`) | **rejected** |
| Denylist via `.has()` on all three args (`__proto__`, `constructor`, `prototype`) | **all rejected**, incl. `addImport.name` |
| **SEC-4** hostile `from` (`a"; import {y} from "evil`) | **1** ImportDeclaration after reparse; specifier = full hostile string; **no `"evil"` import exists**; ts-morph escaping assumption holds |
| Prototype pollution end-to-end | `Object.prototype` **not polluted** |
| `toString` / `hasOwnProperty` / `__PROTO__` as propName | **accepted — and correctly so**: legal JSX attribute names; splice is contained (`<Button toString={1} />`); harmless because the code **never uses them as object keys** — Set-key-safety holds (`===`/`Set`/`Map` only, pinned by the file's own static scan) |
| ReDoS on the three grammars | **No.** No nested quantifiers; `ELEMENT_NAME_GRAMMAR`'s `(\.…)*` is unambiguous (the `.` separator is excluded from the inner class), so each position is deterministic — linear. |

The `validatedOp` chokepoint is sound: `body` is structurally unreachable before `validators(args)`
returns, and the throw rides the existing `runOp → #invokeContained` seam to zero-emit +
byte-unchanged (design §4.4). `elementName`'s lookup-only property is real — it is compared via
`getTagNameNode().getText() === elementName`, never spliced. The spec's honesty about `propName`
being the *only* spliced, validator-protected channel is accurate.

**Security verdict: no findings.** This surface is better than the shipped TypeScript dialect's,
which validates nothing — correctly noted and not repeated.

### Live-app pass

**N/A** — no UI surface. This is a developer-facing SDK; the equivalent behavioural proof is the
installed-consumer e2e (both legs green, mutation-proven).

### Stage B — Adversarial review flag

**`adversarial_review: required`** — triage is **L**, *and* the change touches two registered
sensitive areas (security/code-execution via a new `.raw()`/`.modify()`-equivalent instance in a
new AST realm; public-api contract via the 6th subpath). Either condition alone suffices; both
hold. Orchestrator runs `judgment-day` blind after this verify passes, before archive.

---

## Spec Compliance Matrix

60 scenarios across both signed specs. Every row backed by a test that **passed at runtime** in
the trustworthy location.

| Requirement | Scenarios | Test | Result |
|---|---|---|---|
| REQ-RXD-01 frozen subpath + exact 2-op set | .1 | `ops-exact-set.test.ts` (`toEqual`, anti-smuggle) | ✅ COMPLIANT |
| REQ-RXD-02 extension gate (`.tsx`-only, sync, fail-closed) | .1–.5, .8, .9, .10 (.6/.7 retired at V4 — correctly absent) | `dialect.test.ts` | ✅ COMPLIANT |
| REQ-RXD-03 `ScriptKind.Tsx` fidelity + mode engagement | .1–.5 | `dialect.test.ts` | ✅ COMPLIANT (divergence proof real: `<string>y` throws under Tsx, parses clean under `.ts`) |
| REQ-RXD-04 `setJsxProp` targeting trio + upsert | .1–.6 | `ops.test.ts` / `dialect.test.ts` goldens | ✅ COMPLIANT |
| REQ-RXD-05 `addImport` merge/create/idempotent/named-only | .1–.4 | `ops.test.ts` | ✅ COMPLIANT |
| REQ-RXD-06 per-arg validation (security, load-bearing) | .1–.6 | `name-validation.test.ts` | ✅ COMPLIANT (independently probed) |
| REQ-RXD-07 heterogeneous coalescing → one modify | .1 | `react-conformance.test.ts` (testOpPack) | ✅ COMPLIANT |
| REQ-RXD-08 JSX adversarial corpus (required capability) | .1, .2 | `react-conformance.test.ts` | ✅ COMPLIANT (19 round-trip + 6 mandatory; divergence sample correctly separated) |
| REQ-RXD-09 author docs (2nd example, trust, honest limits) | .1–.5 | `docs.test.ts` | ✅ COMPLIANT *for `docs/authoring-a-dialect.md`* — see F-01 for the JSDoc `@example` |
| REQ-RXD-10 placement/whitespace/closing-form | .1–.6 | `dialect.test.ts` goldens | ✅ COMPLIANT |
| REQ-RXD-11 value grammar, three forms | .1–.4 | `ops.test.ts` goldens | ✅ COMPLIANT |
| REQ-RXD-11 malformed value emitted as-is | .5 | `ops.test.ts` (+ boundary pin) | ⚠️ PARTIAL — spec's literal `'{'` example unimplementable under ADR-03; substance proven via `'{1+}'`; unterminated case pinned as safely contained. Followup S-01 (spec wording). |
| REQ-RXD-12 trust boundary — `value` is trusted-code | .1 | `ops.test.ts` | ✅ COMPLIANT |
| REQ-RXD-13 rejection hygiene (no-echo, zero-emit, byte-unchanged) | .1–.3 | `name-validation.test.ts` + `canary-no-echo.test.ts` | ✅ COMPLIANT (100-char hostile + every 17-char fragment absent — verified) |
| REQ-RXD-14 supply-chain — spike deps never ship | .1 | `fit-36-spike-deps-absent.test.ts` | ✅ COMPLIANT (`dependencies` still exactly `{ts-morph}`) |
| REQ-LC-01 bun-link six-subpath parity | .1, .2 | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |
| REQ-LC-02 bun-link founding-bug parity | .1–.3 | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT (.3 structural, needed no edit) |
| REQ-LC-03 tarball `./react` probe | .1 | `installed-consumer.e2e.test.ts` | ✅ COMPLIANT |

**Compliance summary**: **59/60 compliant, 1 partial (REQ-RXD-11.5, spec-wording), 0 failing,
0 untested.**

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-01 duplicate fidelity glue, don't hoist | ✅ Yes | `typescript/ast.ts` untouched (zero diff); 4 primitives duplicated in `react/ast.ts`; boundary now *guarded* by fit-37/38, not conventional |
| ADR-02 core validator + `validatedOp` + no-echo tail | ✅ Yes | All three ship as designed; chokepoint structurally sound; Set-key-safety pinned by static scan |
| ADR-03 structured API, no text-splice | ✅ Yes | `addAttribute`/`setInitializer`/`removeInitializer` only; no fallback. Its documented consequence (ts-morph reparse ceiling) is exactly what surfaced REQ-RXD-11.5's wording issue — the ADR predicted its own edge |
| ADR-04 exports-guard minimal edit | ✅ Yes | Only mechanical FIT-09/14/04 regens; row-229 refactor stayed deferred |
| ADR-05 `addImport` fresh, validated, structured-path | ✅ Yes | Written fresh (not copied from the lax TS op); `addImportDeclaration`/`addNamedImport`; SEC-3/SEC-4 pinned — I re-confirmed SEC-4 by probe |
| §4.2 File Changes (16 Create / 9 Modify / 3 Read-only) | ✅ Yes | **16/16 Create, 9/9 Modify, 3/3 Read-only verified against `git diff --name-status 93e38d7..f12ffba`.** Read-only rows confirmed genuinely untouched. Only extra: 2 fit-37 RED fixtures — ruled not scope creep above |
| §4.2b Flow Changes (Create: author mutates `.tsx`) | ✅ Yes | e2e proves the subpath resolves and runs on both install vehicles |
| §4.6 Test Derivation | ✅ Yes | Every REQ→test mapping holds; retired .6/.7 correctly absent |
| §4.10 `architecture_impact: additive` | ✅ **Confirmed** | New leaf + 2 kit-internal core helpers + 6th subpath + test-side fitness. No existing boundary moved; no shipped module changed behaviour. fit-37/38 codify an existing boundary rather than move one |

---

## Problem Fit & Scope (vs `triage.md`)

**Problem statement**: *"Schematic authors who need to mutate TSX/JSX files have no dialect that
supports that syntax... A React (TSX/JSX) dialect closes that gap."*

**Delivered**: `@pbuilder/sdk/react` resolves on both install vehicles and mutates real `.tsx`
files through two validated structured ops, byte-exact across a 20-sample JSX adversarial corpus
including the classes that actually break naive JSX tooling (fragments, spreads, comments-in-JSX,
JSX-lookalike strings, CRLF, BOM, 4 MiB). **The gap is closed.** No `problem-drift`.

| Scope item | Status |
|---|---|
| in: parse/print pair, extension matchers, `find()` surface, conformance-kit proof | ✅ Delivered |
| in: exactly TWO ops | ✅ `setJsxProp` + `addImport`, pinned by `toEqual` anti-smuggle |
| in: docs for the new surface | ⚠️ Delivered in `docs/authoring-a-dialect.md` — F-01 is the JSDoc gap |
| out: full React mutation catalog | ✅ Respected — deferred, named in docs |
| out: any change to engine or wire protocol | ✅ Respected — `src/core/{dialect-handle,define-dialect}` zero diff |

**Nothing exceeds `out_of_scope`.** The two new `src/core/*` files are library-agnostic kit
helpers (dialect-error/deep-equal precedent), not engine/wire changes.

---

## Drift / Cross-Change

| Module | Status | Notes |
|---|---|---|
| FIT-01/02 (leaf isolation, no sibling-dialect import) | ✅ Pass | Auto-covered new leaf, zero edit — as designed |
| FIT-04 (`.d.ts` semver baseline) | ✅ Pass | React pair added. **NB: the baseline faithfully pins F-01's stale text — the gate works; the input was wrong** |
| FIT-09 / FIT-14 (exports resolution, package surface) | ✅ Pass | 5→6 exact-list; baseline regenerated |
| FIT-36 (spike deps absent) | ✅ Pass | `dependencies` exactly `{ts-morph}`; zero deps added |
| FIT-37 (core/commons AST-free) — NEW | ✅ Pass | Previously *unguarded* boundary now guarded, incl. transitive walk |
| FIT-38 (parser-construction confinement) — NEW | ✅ Pass | `new Project(` only in dialect `ast.ts`; retro-covers the TS dialect |
| `src/dialects/typescript/**` | ✅ No regression | Zero diff; its goldens green |
| Structural degradation | None | No god-node growth, no surprise edges, no layer violations |

Two net-new repo-wide fitness functions that retro-cover pre-existing code is a **net structural
improvement** — the change leaves the codebase better guarded than it found it.

---

## In-Loop History

| Iteration | Verdict | Issues fixed |
|---|---|---|
| 1 (S-000) | PASS | — |
| 2 (S-001) | NEEDS_FIX | CRITICAL `removeInitializer` branch untested; WARNING REQ-RXD-06.5 e2e asymmetry |
| 3 (S-001 re-verify) | PASS | Both resolved, mutation-proven |
| 4 (S-002) | NEEDS_FIX | CRITICAL REQ-RXD-06.5 `addImport` coverage gap (1/10 → 10/10); WARNING TDD record omitted from apply-progress |
| 5 (S-002 re-verify) | PASS | Finding 1 closed; Finding 2 documentation-reconciled; **ordering violation routed to final** |
| 6 (S-003+S-004+S-005) | PASS | None; carried the ordering violation forward |
| **final (this)** | **fail** | **F-01 (new, not previously caught by any gate)** |

The in-loop loop did real work: iterations 2 and 4 both caught genuine coverage gaps that were
"present but too narrow" — exactly the failure class this project's bar targets. F-01 is a *new*
finding, not a re-litigation.

---

## Issues Found

**CRITICAL / gating (must fix before archive)**
- **F-01** — `src/dialects/react/index.ts:54`: shipped public `.d.ts` `@example` states
  "structured ops arrive in later slices; `.modify()` is the escape hatch today" — false since
  S-002. Routing: `verify-failed`, category `quality` → Executor.

**WARNING (should fix)**
- None.

**SUGGESTION / followups (never blockers — for `project/pending-changes` at archive)**
- **S-01** — Amend REQ-RXD-11.5's example to a delimiter-balanced value (`'{1+}'`) at the next
  spec touch. Wording only; behaviour is proven and the boundary is pinned.
- **S-02** — Gate edge: a file literally named `.tsx` passes. Obscure; spec ambiguous; zero
  security impact.
- **S-03** — `index.ts:1` "walking skeleton" internal comment stale (does not ship in `.d.ts`).
- **S-04** *(lesson, not debt)* — TDD disclosure belongs in `apply-progress.md` at the time of the
  event, not only in the return envelope. The S-002 ordering violation cost four verify
  iterations *because of where it was reported*, not because of what it was. → `project/
  lessons-learned`.
- **S-05** *(pre-existing, already registered — restated for the ledger, NOT filed against this
  change)* — `~/Documents` subprocess-bound test flakiness from missing explicit timeouts. This
  change **does not add** to that exposure (verified: zero new spawns).

---

## Verdict

**fail** — one MAJOR quality finding (F-01) on the shipped public API contract; 59/60 scenarios
compliant, suite 1797/0 in a trustworthy location, security surface independently probed and
sound, design conformance exact. Fix F-01, re-verify, then `judgment-day` (required).
