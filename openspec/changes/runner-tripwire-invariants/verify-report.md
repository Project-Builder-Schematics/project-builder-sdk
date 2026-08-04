# Verification Report — runner-tripwire-invariants

**Change**: `runner-tripwire-invariants`
**Mode**: final (Strict TDD)
**Triage**: L (sensitivity override fired — `security (code execution)` + `deployment / build integrity`)
**Spec version**: `runner-integrity-manifest` V3 (SIGNED) + `publish-pipeline-hardening` V4 (SIGNED)
**Branch**: `feat/tripwire-evaluate` @ `1ade7d7` · base `f7428e8`
**Artifact store**: openspec (strict)
**Date**: 2026-08-05

---

### Verdict: **fail** — category `quality`

Five gating findings. The headline: **the capability-admission classifier admits 15 distinct,
independently reproduced, genuinely executable arbitrary-code-execution constructs inside the
digest-verified runner closure** — including single-expression escapes needing no aliasing at all
(`"".constructor.constructor("return 1")()`). Separately, **the new publish-job suite gate is
permanently red**, so the job this change hardened can never publish.

Every gating finding carries a repro command with its actual output, and every one was reproduced
by this gate directly against the production code path (`deriveRunnerClosure`), not inferred.

This is not a rejection of the design. The redesign genuinely closes the three probe-confirmed
escapes it was built for (M2.1, M2.2, `node:child_process`), delivers a real fail-closed generator,
real resolution-based path verdicts, real whole-verbatim diagnostics, and reproducible byte
neutrality. The finding is that **default-deny is not yet closed**: several paths still terminate
in a silent `admitted`, which is the one property the change exists to establish.

| Gate | Result |
|---|---|
| Full suite (`bun test`) | ✅ 2548 pass / 0 fail / 0 skip |
| Typecheck (`tsc --noEmit`) | ✅ clean |
| Fresh-build byte-neutrality | ✅ `31cd5382…f333fde`, 118/118 `dist/` files byte-identical |
| Post-simplify regression scrutiny | ✅ zero behaviour drift across all 10 commits |
| Scenario compliance | ⚠️ 69 / 77 fully compliant |
| Requirement-level normative clauses | ❌ 6 breached |

---

## Completeness

| Metric | Value |
|---|---|
| Slices total | 6 (S-000, S-001..S-005) |
| Slices complete | 6 |
| Tasks total | 37 |
| Tasks complete | 36 |
| Tasks open | 1 — `S-002.3` (deferred to archive; see "Deferred-item rulings") |

All task boxes are `[x]` except `S-002.3`, deferred with a recorded rationale rather than silently
skipped.

---

## Build & Tests Execution

All gates executed fresh for this report. No value is carried over from `apply-progress.md`,
`simplify-report.md`, or any `verify-in-loop-N.md`.

**Build**: ✅ Passed — `bun run build` (with its `prebuild: rm -rf dist`), exit 0.

**Tests (full suite)**: ✅ **2548 pass / 0 fail / 0 skipped**, 5650 `expect()` calls, 202 files,
82.63 s, exit 0. Independently reproduces `simplify-report.md`'s claimed 2548/0.

> Zero skips matters. Six tests are guarded `it.skipIf(process.getuid?.() === 0)` — the
> `chmod 0o000`-based fail-closed proofs and, notably, REQ-DGN-01.3's *standing* rule-identity
> totality check. This run was not as root, so all six executed. Under a root-privileged CI
> container they silently do not run, including that standing gate. Followup FU-7.

**Typecheck**: ✅ `tsc --noEmit` — clean, zero diagnostics, exit 0.

**Fresh-build byte-neutrality (REQ-CAP-06, B6 procedure)**: ✅ Passed.

```
$ bun run build                      # prebuild removes dist/ entirely, then full rebuild
$ sha256sum dist/runner-manifest.json
31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde
```

Matches the re-pinned digest exactly. Stronger evidence also gathered: all **118** files under a
from-scratch `dist/` are byte-identical to the pre-build state (full `sha256sum` manifest diff
empty), and `git status` is clean afterwards. `dist/` is untracked, so this is genuine
regeneration — not a hash of a committed artefact, which is exactly the distinction REQ-CAP-06.1's
B6 clarification insists on.

**Coverage**: ➖ Not a gate — `bun test --coverage` is configured with `threshold: null`
(`openspec/config.yaml`). Reported cleanly as unavailable, not skipped silently.

**Linter**: ➖ Not available — `testing.linter.tool: null` (deferred to `foundations-skeleton`).
Not a failure.

**Live-app behavioural pass**: N/A — no UI surface. The change ships **no runtime bytes**; `src/**`
is read-only by gate (verified: zero `src/` paths in `git diff --name-status f7428e8...HEAD`).

---

## Issues Found

### CRITICAL — must fix before archive

Each carries `evidence: demonstrated` (repro command with actual output, through the production
code path) **and** `outcome_relevance: blocking` (breaks a signed normative requirement).

---

#### C-1 — `Bug` — Fifteen arbitrary-code-execution constructs are silently admitted inside the runner closure

**Location**: `scripts/capability-admission.ts` — `classifyOrigin` (~`:654-661`, `:415-424`,
`:663-667`), `resolveChain`'s `safe-terminal` arm (~`:601-614`, consumed ~`:737-738`),
`taintReasonOf` (~`:353`), and `BindingOrigin` taint propagation (design §1 D-3)
**Breaks (normative clauses)**: `REQ-CAP-01`, `REQ-CAP-03`, `REQ-CAP-04`, `REQ-CAP-05`,
`REQ-CST-04.2`, `REQ-PRM-01`; contradicts `ADR-0079` and `ADR-0080`
**evidence**: `demonstrated` · **outcome_relevance**: `blocking`

Reproduced through `deriveRunnerClosure` — the real build gate, over planted single- and
two-file closures. `ADMITTED` means **zero violations reported**:

```
--- (a) denied-root laundering: alias / member / return ---
DENIED   | BASELINE signed red-proof CAP-05.2:  const F = Function; F("return 1")
ADMITTED | const F = Function; const G = F; G("return 1")
ADMITTED | const e = eval;     const e2 = e; e2("1+1")
ADMITTED | const o = {}; o.F = Function; o.F("return 1")
ADMITTED | function h(){ return Function; } h()("return 1")
ADMITTED | const k="eval"; const g = globalThis[k]; const f = g; f("1+1")

--- (b) member path rooted at a denied register primitive, in value position ---
ADMITTED | const C = Function.prototype.constructor;      export const r = C("return 1")()
ADMITTED | const { constructor: C } = Function.prototype;  export const r = C("return 1")()
ADMITTED | const w = WebAssembly.instantiate;              export function go(b){ return w(b) }
ADMITTED | lib.js: export const C = Function.prototype.constructor
         | entry.js: import { C } from "./lib.js"; export const r = C("return 1")()

--- (c) `safe-terminal`: literal-rooted and call-result-rooted chains ---
ADMITTED | export const r = "".constructor.constructor("return 1")()
ADMITTED | export const r = [].constructor.constructor("return 1")()
ADMITTED | export const r = ({}).constructor.constructor("return 1")()
ADMITTED | export const r = /x/.constructor.constructor("return 1")()
ADMITTED | export const r = Reflect.get(globalThis, "eval")("1+1")
ADMITTED | function f(){} export const r = Object.getPrototypeOf(f).constructor("return 1")()

--- controls (proving the fixtures are not vacuous) ---
DENIED   | WebAssembly.instantiate(bytes)      [constraint-4-inadmissible-origin]
DENIED   | process.stdout.constructor          [constraint-4-inadmissible-origin]
DENIED   | eval(payload)                       [constraint-4-inadmissible-origin]
```

These are not theoretical shapes — each executes:

```
$ bun -e 'console.log(Function.prototype.constructor("return 1")(),
                      [].constructor.constructor("return 5")(),
                      Reflect.get(globalThis,"eval")("1+1"))'
1 5 2
```

**Why the signed text is breached, clause by clause:**

- `REQ-CAP-01`: *"The default for any node the classifier does not recognise MUST be `violation`
  or `unclassifiable-construct` — **never a silent pass**."* All fifteen end in a silent pass.
- `REQ-CAP-03`: *"Every call or `new` expression whose callee is not a statically resolvable
  binding MUST be a violation."* `"".constructor.constructor` is not a statically resolvable
  binding; it is admitted.
- `REQ-CAP-04`: *"A resolved binding's origin MUST classify as exactly one of `{local, closure
  import, admitted global, admitted builtin surface}`. Any other origin is a violation."*
  `classifyOrigin` returns `{admitted, via: "local"}` when the chain root resolves to **no binding
  at all** (class b), and `resolveChain`'s `safe-terminal` introduces an unlisted **fifth** admitted
  origin (class c). Neither is one of the four.
- `REQ-CAP-05`: *"A denied root identifier MUST be permitted to appear ONLY in … `instanceof` right
  operand, `typeof` operand. **Any other position is a violation.**"* In class (a) `Function`
  appears in an initializer, an assignment RHS, and a return expression. No violation fires.
- `REQ-CST-04.2` (MODIFIED, owner re-signed to demand *the property, not an enumeration*): *"The
  system MUST fail the build for **any** closure-file reference to a denied capability primitive."*
  Classes (a) and (b) each reference `Function`/`eval`/`WebAssembly`. The build does not fail.
- `ADR-0079`: *"default is violation; ambiguity is violation."* Not upheld.
- `docs/runner-integrity-invariants.md:112-114`, added by this very change, now states *"the
  default for anything unrecognised is a violation, never a silent pass"* — so the doc promises
  more than the guard enforces, against `design.md` §2b's own Flow Changes obligation.

Most pointedly, `design.md`'s depth-≥2 clarification names this exact hazard: prefix inheritance
*"would admit `process.stdout.constructor.constructor("...")` and reopen the probe-confirmed
Function-constructor escape this change exists to close."* That route **is** closed (control
fires). The literal-rooted spelling of the same reach is wide open.

**Root causes** — three distinct, all in the same module:

1. **Taint is not transitive.** `const F = Function` marks `F` tainted; copying a tainted local
   yields an untainted `local`, so the taint is lost at hop two. `REQ-CAP-05` is enforced on the
   *alias in callee position* rather than at the *denied root's own occurrence*.
2. **An unresolvable free root is admitted in value position.** `classifyOrigin` treats
   "resolves to no binding" as `local` outside callee position, and `taintReasonOf` tests only
   *exact full-path* register membership (`Function.prototype.constructor` ∉ register), so the
   binding it initialises is never tainted.
3. **`safe-terminal` is an unlisted fifth admitted origin.** A callee chain terminating in a
   literal or a call result is admitted via `"local"` with no origin check. The inline rationale
   ("the inner call is independently enumerated as its OWN callee surface node") fails precisely
   when that inner callee is itself admitted — `Reflect.get` and `Object.getPrototypeOf` are both
   in `ADMITTED_MEMBER_PATHS`, so nothing denies the outer invocation of their result.

**Why this is not "add another spelling"** (success criterion 11): all three fixes are rule
changes, not enumerations.

1. Enforce `REQ-CAP-05` literally at the occurrence — a denied-root identifier in any position
   other than `instanceof`-RHS / `typeof`-operand is a violation. Closes class (a) with **no
   dataflow at all**, and matches the signed text exactly.
2. Make `origin === undefined` a violation in **every** position, and taint on *root* register
   membership rather than full-path membership. Closes class (b).
3. Deny a callee whose resolved terminal is a literal or a call result **when the chain adds a
   property segment**; at minimum deny `constructor` as a member segment on any chain — it is the
   single unifying step in every class-(c) escape. Closes class (c).
4. Make `tainted` transitive over binding copies and assignment RHS — reinforces (1) and closes
   the `globalThis[k]` two-hop variant.

None of this needs the deferred semantic oracle (`FIT-CAP-ORACLE`); none re-opens the
fitness-function budget.

**Blast radius — measured, not assumed.** Zero real-closure sites are affected. A scan of every
closure file for bare denied-root identifier occurrences finds `eval`: 0, `Function`: 0,
`WebAssembly`: 0, `createRequire`: 2 (both at the exempt anchor
`dist/transport/single-instance-probe.js`). `process.*` / `module.*` occurrences are the
member-path family, admitted via `ADMITTED_MEMBER_PATHS`. Fix (2) is the one to re-measure
carefully against `FIT-CAP-TOTALITY`'s real-closure run, and fix (3)'s exact cut should be chosen
after re-measuring the closure's four probe-verified safe-terminal shapes. No `src/**` change is
involved, so the manifest digest and REQ-CAP-06 are unaffected.

**Required new red-proofs**: all fifteen shapes above, each asserting rule identity and exact
count — the shape `REQ-CAP-05.2` (`fit-42n:1336`) already uses correctly. `rg 'Function\.prototype|\.constructor\.constructor' test/`
currently matches only `REQ-CAP-03.2`'s direct `(()=>{}).constructor(...)` form, so none of the
fifteen is covered today.

---

#### C-2 — `Bug` — The new publish-job suite gate is permanently red; the publish job can never publish

**Location**: `.github/workflows/publish.yml:53-69` × `test/fitness/fit-42-runner-closure-integrity.test.ts:1017-1021`
**Breaks**: `REQ-PPI-03.3` in the real workflow; defeats the purpose of `REQ-PPI-03` and of slice
S-000 as a whole
**evidence**: `demonstrated` · **outcome_relevance**: `blocking`

`publish.yml`'s step order, as shipped by this change:

```
:48  Build                      → bun run build          (manifest = 31cd5382…)
:53  Set dev version            → npm version 0.0.0-dev.<sha>
:62  Rebuild after version stamp→ bun run build          (manifest now differs)
:68  Run test suite             → bun test               ← REQ-PPI-03's gate
:83  Publish (dry-run)                                    ← never reached
```

`fit-42`'s `FIT-MANIFEST-BYTE-NEUTRAL` hard-pins the digest, and the manifest embeds
`packageVersion` plus the `package.json` sha256 — both moved by the stamp. Reproduced by running
the real generator against a copy of `dist/` + `package.json`, stamping exactly as the workflow
does:

```
version 0.2.3             → runner-manifest-sha256: 31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde
version 0.0.0-dev.abc1234 → runner-manifest-sha256: dec7aaf1d29fc1c281a34d24902bcc5f688952e324de059f46e022aea975aa06
pinned at fit-42:1017     → 31cd5382a411f145178eb0bc3ae74a0672cadca600e7d957da33a9792f333fde
```

`fit-42`'s `manifestPath` comes from `ensureTscBuild()`, which runs `bun run build` at the real
`PROJECT_ROOT` (`test/support/shared-build.ts:25`) — so inside the publish job the test itself
rebuilds against the *stamped* `package.json`, reproduces `dec7aaf1…`, and fails. The test carries
no `skipIf` or env guard.

**Why it is invisible today**: `ci.yml:32` runs `bun test` with **no** version stamp, so PR CI is
green. The defect is publish-job-specific — and the publish job is new in this change, so it has
never run.

**Why blocking**: `REQ-PPI-03.3` ("a clean closure reaches the publish step — sibling positive") is
proven only against a scratch tree in `fit-46`; in the real workflow it is falsified. A
permanently-red publish gate is precisely the *"knowingly-flaky gate that gets routed around"* that
ruling 6 exists to prevent — and the first person to hit it will be tempted to add
`continue-on-error`, deleting REQ-PPI-03's entire value. It also hard-blocks any future
`npm version` bump, including the 0.1.0 release.

**Fix options**: (1) make the digest comparison the one-shot **slice gate** `design.md` §7 actually
specifies (*"plus the one-shot cross-tree sha comparison (slice gate)"*) rather than a standing
suite assertion — e.g. gate it behind an explicit env flag; or (2) keep it standing but make it
**version-invariant**: regenerate against a fixed synthetic `packageVersion` and compare that
digest, so the property proven is byte-neutrality of the *derivation* rather than of a
version-stamped artefact. Option (2) also dissolves W-7.

**Blast radius**: `test/fitness/fit-42-runner-closure-integrity.test.ts` (and possibly
`publish.yml` step order). No production code.

---

#### C-3 — `MAJOR` — REQ-CST-04.3's non-vacuity guard is still a substring count; R1-10 is not closed

**Location**: `test/fitness/fit-42-runner-closure-integrity.test.ts:590`
**Breaks**: `REQ-CST-04.3` (normative clause, MODIFIED/re-signed), `REQ-CST-04.3.2`
**Contradicts**: `slices.md`'s Archive-Sync Ledger, which records `R1-10 → CLOSED-BY-FIX`
**evidence**: `demonstrated` · **outcome_relevance**: `blocking`

`REQ-CST-04.3` was unfrozen and re-signed *specifically* to require: *"The non-vacuity guard MUST
count via AST identifier occurrences, **never a substring count of the source text** (R1-10)."*
The shipped guard is:

```ts
expect(probe.split("createRequire").length - 1).toBeGreaterThanOrEqual(2);
```

That is the substring count of raw source text — the exact construct the MODIFIED REQ forbids —
and it retains a `toBeGreaterThanOrEqual` threshold against the change's own
exact-counts-never-thresholds doctrine. (Design §6(c) inventoried two thresholds and S-002.5
converted them; this third one, in the *positive* file, was never inventoried.)

Measured against the real anchor, then mutated:

```
--- real anchor (dist/transport/single-instance-probe.js) ---
shipped substring guard count  : 10   (threshold: >= 2)
AST identifier-occurrence count:  2   <-- what REQ-CST-04.3 mandates
comment-only occurrences        :  8

--- MUTANT: every real-code createRequire reference removed, comments untouched ---
shipped substring guard count  :  8   -> guard still PASSES (8 >= 2)
AST identifier-occurrence count:  0   -> the mandated AST guard would FAIL (0 < 2)
```

8 of the guard's 10 hits are inside comments. Deleting **every** real-code `createRequire`
reference leaves the guard green, so it cannot distinguish "the exemption is working" from "the
file no longer uses the primitive at all" — exactly the vacuity R1-10 named ("counts substrings,
incl. comments"). The guard's own inline comment claims the opposite: *"the anchored file really
does hold createRequire references, so 'no violations' above is an exemption working, not a file
that happens to be clean."*

**And the red-proof meant to prove the fix does not exercise it.** `REQ-CST-04.3.2`
(`fit-42n:1363`) asserts only Set arithmetic:

```ts
const mutantAdmitted = new Set([...ADMITTED_GLOBALS, "totallyFakePrimitive"]);
expect(mutantAdmitted.size - ADMITTED_GLOBALS.size).toBe(1);
expect([...ADMITTED_GLOBALS].some((g) => g === "totallyFakePrimitive")).toBe(false);
```

It never invokes the non-vacuity guard, never performs an AST count, and never produces the
"naming the widened register entry" failure its scenario requires. Adding a novel member to a set
raises its size by one; a set does not contain a name never added. The scenario's actual subject —
AST-vs-substring counting — is untested.

**Fix**: replace the substring count with an AST identifier-occurrence count over the parsed anchor
(ts-morph is already imported in this file family) and assert `toBe(2)`, not a threshold. Rewrite
`REQ-CST-04.3.2` as the AST-vs-substring differential its scenario names.

---

#### C-4 — `Bug` — REQ-PTH-01: backtick command substitution and a valueless flag pass silently

**Location**: `scripts/bundler-disjointness.ts:63-89` (undecidability test is `value.includes("$")`
only), `:101-103` (tokenizer)
**Breaks**: `REQ-PTH-01` normative clause; contradicts `ADR-0081`'s Decision
**evidence**: `demonstrated` · **outcome_relevance**: `blocking`

```
backtick command substitution   bun build x.ts --outdir `pwd`/dist/transport
    targets=[{flag:"--outdir",target:"`pwd`/dist/transport"}]   unclassifiable=0   <-- PASSES
recognised flag, no value       bun build x.ts --outdir
    targets=[]                                                  unclassifiable=0   <-- PASSES
CONTROL $( ) substitution       bun build x.ts --outdir $(pwd)/dist/transport
    unclassifiable=1                                                               <-- caught
CONTROL --outdir=$OUT           unclassifiable=1                                   <-- caught
CONTROL --out-dir (unrec shape) unclassifiable=1                                   <-- caught
```

`REQ-PTH-01` states: *"An undecidable target MUST be an explicit `unclassifiable-construct`
violation, **never a pass**."* `ADR-0081`'s Decision names the cases: *"an undecidable target
(`$VAR`, **command substitution**) is an explicit `unclassifiable-construct` violation, never a
pass."* Undecidability is detected solely by the presence of `$`, so backtick substitution is read
as a literal path and passes; a recognised flag with no following token returns `undefined` and is
dropped in silence. A `--outdir \`pwd\`/dist/transport` script writes into the closure at runtime
while the guard reports nothing — and a false negative voids the closure-sealing lemma
(ADR-0081's own Consequences: *"a false positive fails a build; a false negative voids the
closure-sealing lemma"*).

**Fix** — take the class, not the spellings (criterion 11): treat a recognised flag's value as
decidable **only** if it matches a committed safe-path grammar (e.g. `[A-Za-z0-9._/-]+`), and
everything else — backticks, `$(`, `$VAR`, absent value, embedded whitespace — as
`unclassifiable`. Merely widening the predicate to `/[$`]/` would close two spellings and leave the
class open.

**Related, `improvement` only**: `--outdir "my dir/dist/transport"` yields `target: "my"`, so the
real target is never checked. `ADR-0081` explicitly declined a full shell-grammar parse, so this is
a followup (FU-13), not a gate.

**Blast radius**: `scripts/bundler-disjointness.ts` + new `bundler-scripts/` fixtures with
`REQ-PTH-01.5`-style rule-identity assertions.

---

#### C-5 — `MAJOR` — REQ-CAP-01.2's red-proof is a tautology; FIT-CAP-TOTALITY's non-vacuity is unproven

**Location**: `test/fitness/fit-42-runner-closure-integrity.test.ts:990`
**Breaks**: `REQ-CAP-01.2`
**evidence**: `demonstrated` · **outcome_relevance**: `blocking`

The red-proof for the change's central fitness function is, in full:

```ts
const presentCount = 5;
const classifiedCount = 4; // one synthetic node kind silently skipped by the mutant
expect(() => expect(classifiedCount).toBe(presentCount)).toThrow();
```

It references no production symbol. Demonstrated — copied verbatim into a file with **zero**
imports from the project, it passes:

```
$ bun test <scratch>/cap0102-tautology.test.ts
 1 pass, 0 fail, 2 expect() calls
```

`REQ-CAP-01.2` requires: *"GIVEN a mutant classifier where one synthetic capability-surface node
kind … is routed to silent pass; WHEN the totality check runs **against a fixture exercising that
node kind**; THEN it fails, **naming the node kind** and that classified-count < present-count —
this is FIT-CAP-TOTALITY's own mutation, proving it is not vacuous."* The shipped test constructs
no mutant, uses no fixture, names no node kind, and asserts only that `bun`'s `expect` throws on
`4 !== 5`.

This matters beyond bookkeeping. The half of `REQ-CAP-01.1` with real teeth is
`expect(surface.length).toBe(independentSurfaceCount(sourceFile))` — a genuinely independent
recount. The other half, `expect(classified.length).toBe(surface.length)` where
`classified = surface.map(classify)`, is **structurally incapable of failing**:
`Array.prototype.map` always returns an array of equal length. `ADR-0080` anticipated exactly this
(*"the count comparison becomes self-referential, so the mutation that routes an unrecognised node
to a pass path cannot be detected by the fitness function it is supposed to fail"*) and chose the
enumerator/classifier split as the mitigation. So the detectable mutation is on the **enumerator** —
and the shipped test mutates neither.

**Fix** (no production change): wrap `enumerateCapabilitySurface` in a shim that drops one
`SurfaceNodeKind`, run it against a fixture exercising that kind, and assert
`surface.length < independentSurfaceCount(...)` with the dropped kind named. Roughly 20 lines.

---

### WARNING — should fix, does not block

- **W-1 — ADR-0081 was never written.** `design.md` §2 declares
  `openspec/decisions/0081-resolution-based-path-verdicts-predicate-placement.md` as a `Create`
  row, and §11 declares ADR numbering settled at "0079-0081"; `slices.md`'s Coverage line claims
  *"3/3 ADRs"*. Only `0079` and `0080` exist. Four shipped files cite `ADR-0081` as their governing
  decision — `scripts/bundler-disjointness.ts:1`, `test/support/closure-integrity-checks.ts:10`,
  `fit-42:1032`, `fit-42n:1523`/`:1769`. ADR-0081 is the **only** record that the
  `test/support/` → `scripts/` relocation is *"placement, not timing"* and therefore not a reversal
  of accepted ADR-0075 — a sentence `design.md` §2c leans on to justify seven `aligns` rows. Its
  content lives only in `design.md` §5, which moves into `openspec/changes/archive/` at archive,
  taking the guard rail with it, and leaving the pre-archive `arch_audit_gate` nothing to audit
  against. Fix is a transcription, not a decision — Context/Decision/Consequences/Alternatives are
  already complete in §5. Should land **before** archive.
- **W-2 — the two count re-pins and the digest re-pin live only in `design.md`, never in the signed
  spec.** Shipped: `ADMITTED_GLOBALS` = **21**, `ADMITTED_MEMBER_PATHS` = **30** (verified: exact-set
  `toEqual` assertions, no thresholds, `fit-42:804`/`:844`). Signed `REQ-CAP-04.4` says *"its pinned
  22-member list"*; `REQ-CAP-04.6` says *"the pinned 28-member list"*; `REQ-CAP-06.1`'s dated
  clarification pins `bf6c983c…a530` while the enforced digest is `31cd5382…f333fde`. The
  **property** each scenario demands (exact-set comparison, never a threshold) is fully met, and
  `design.md` §1 root-causes the drift with evidence (`git diff e6dcde2 HEAD` over the two closure
  files shows JSDoc-comment-only edits; REQ-RME-02 hashes raw bytes, so a comment edit moves the
  digest). But every earlier count change in this change's history was recorded as a dated
  amendment note **inside the signed spec**; these three were recorded only in the design. This
  gate can verify the root-cause trace and the re-derived counts; it **cannot** verify the
  "owner-authorized" attribution from the artefacts (`unverified`). Archive's delta sync must
  correct all three — `design.md` schedules the two counts but **not** REQ-CAP-06.1's digest. Note
  also that `design.md` §8's rollback validation ("manifest sha matches the value above") still
  names the superseded value.
- **W-3 — `ADMITTED_NODE_SURFACES`' per-module value sets are unpinned.** `REQ-CAP-04.4`'s
  assertion compares `[...ADMITTED_NODE_SURFACES.keys()].sort()` only (`fit-42:832`). Adding a name
  to `node:fs`'s or `node:module`'s admitted-export set changes admission with **no**
  exact-membership test failing — an open widening hole in the very device REQ-CAP-04.4/.5 exist to
  provide. Arguably satisfies the scenario's letter ("a pinned 6-module list") while missing its
  intent. Fix: compare the flattened `module → names` pairs.
- **W-4 — `FIT-MANIFEST-BYTE-NEUTRAL`'s red-proof is a tautology about hashing**
  (`sha256(x + "\n") ≠ sha256(x)`, `fit-42:1023`). The positive gate is real and was independently
  reproduced here, so the risk is presentational. Better: perturb a closure file's bytes and assert
  the *regenerated* manifest digest diverges — that exercises the derivation.
- **W-5 — frozen shared singleton is now order-dependent** (simplify commit `200ebeb`).
  `freezeDerivation` deep-freezes the object returned by the new cross-file
  `ensureRealClosureDerivation()` singleton (`test/support/shared-build.ts:51-62`, `fit-42:125`).
  Whether `test/docs/runner-integrity-docs.test.ts` receives a frozen or unfrozen object now
  depends on `bun test` file ordering. Harmless today — both consumers only read `.nodes.length`
  and iterate — but a future consumer that sorts or mutates `.nodes` fails non-deterministically.
  Verified green in both orders (91 pass).
- **W-6 — the standing anti-`toContain` scan cannot see `test/support/`.** The REQ-CST-06.1 scan
  reads a hardcoded 4-file `SCANNED_FILES` list, all under `test/**/*.test.ts` (`fit-42n:1452-1457`).
  Simplify commit `19574eb` established the pattern of extracting assertions into
  `test/support/*.ts` — outside that set. Nothing is evaded today
  (`test/support/corpus-completeness.ts` contains only `toEqual`), but it is an erosion vector for
  a *standing* guard.
- **W-7 — the pinned digest has no regeneration path.** `PRE_AND_POST_S001_SHA256` is a literal in
  a test file. The repo has `regen:closure-baseline` for the graph baseline but nothing equivalent
  for this digest, and it has already been re-pinned once by hand-editing three places
  (`design.md` §1, §8, and the literal). Any legitimate `src/**` or version change requires the
  same manual ritual — the failure mode ruling 8 declined a generated baseline artefact to avoid.
  Fix: a `regen:manifest-digest` script writing to a single committed home the test reads, or adopt
  C-2's option (2), which needs no pin at all.
- **W-8 — two files changed that design §2's File Changes table does not list**:
  `test/support/corpus-completeness.ts` (new, from `19574eb`) and `test/support/shared-build.ts`
  (modified, from `200ebeb`). Both are mechanical simplify-pass extractions with no new behaviour,
  but the table is the design↔slice contract and is supposed to catch exactly this. Conversely,
  two *declared* artefacts are absent: `openspec/decisions/0081-*.md` (W-1) and the `mutants/`
  fixture corpus (FU-9).
- **W-9 — `unverified`: the independent totality oracle may not be faithful.** `fit-42:916`'s
  `independentSurfaceCount` appears to count *every* `node:`-prefixed specifier, while the
  production enumerator (`capability-admission.ts:279`) counts only real builtins — so the counts
  would diverge for a `node:nonexistent` import. `REQ-CAP-01.1` only runs over the real closure
  (which has no such import), so it never fires. Flagged rather than demonstrated: this gate did
  not construct the divergence. It matters because this oracle is the **one** genuinely
  load-bearing half of `FIT-CAP-TOTALITY` (see C-5).
- **W-10 — stale statements in the touch zone of a change about diagnostic honesty.**
  (a) `test/support/closure-integrity-checks.ts:7-8` still says *"No repo imports by design (node
  builtins only)"* immediately above the new `export … from "../../scripts/bundler-disjointness.ts"`.
  (b) `fit-42:582`'s title is `"REQ-CST-04.3: the **deny-scan** reports zero violations…"` — naming
  the retired mechanism, inside the very requirement whose MODIFIED block exists to stop that
  wording (*"Previously: 'the deny-scan reports zero violations' — worded against the retired
  text-matching mechanism"*). This is the same test as C-3. (c) `oneLine` is byte-identical in
  `scripts/capability-admission.ts:353-356` and `scripts/derive-runner-closure.ts:384-387`.
  (d) Two test-only `as unknown as string` casts (`fit-42n:1656`, `:1754`).

### SUGGESTION

- **S-1** — `REQ-FCG-01.5` asserts exit-0 indirectly (`preSeededRoot()` throws when
  `seed.status !== 0`; the test then asserts only `existsSync`). Genuine, but the biconditional's
  positive direction would read better with an explicit `expect(result.status).toBe(0)`.
- **S-2** — `REQ-CST-04.2.6`–`.9` (the four ruled-in primitives) are proven compositionally
  (`violations.length === 1` + `violations[0].detail === primitive`, with whole-message rendering
  asserted separately per rule), while the five original primitives get direct whole-verbatim
  message assertions. Consistency favours extending the whole-message form to all ten fixtures.
- **S-3** — `ecd6283`'s new comment justifies the `closureFileBytes` memo with "the same static,
  **never-mutated** file bytes", contradicted at `fit-42:381-383` which notes another test file
  "deletes and rebuilds the real tree mid-suite". The risk is unreachable (bun runs test files
  sequentially), but the stated justification is false.
- **S-4** — `3b6132d`'s subject claims "share **one** tokenize/classify walk", but each export
  still runs a full walk and discards half the result. The loop-body dedup is real; the perf
  framing is not delivered.
- **S-5** — `889dd9a` collapsed three distinct scratch prefixes into one `fit-46-`, losing per-test
  attribution for a leaked temp dir.
- **S-6** — `simplify-report.md` inaccuracies: finding #7's cache is describe-scoped, not
  "module-level"; and `33fbd97` widened a private helper's parameter from `Buffer` to `Uint8Array`,
  so "public signatures kept byte-identical" is imprecise.

### IMPROVEMENTS (real, not blocking this problem — route to pending-changes)

- **FU-1** — Build the semantic oracle `FIT-CAP-ORACLE` (already a registered followup with a
  re-open trigger). C-1 is that trigger firing: even after all four fixes, deeper laundering
  (through parameters, object graphs, cross-file value flow) remains out of reach of a syntax-only
  one-hop resolver by construction.
- **FU-2** — `M3.6` (bundler script-chaining) and `R1-14` (entry-file symlink containment):
  re-register as fresh dated debt rows.
- **FU-3** — `R1-9`, `R1-12`, `R1-18`: `OUT-WITH-REASON`, stay registered.
- **FU-4** — Register the three owed rows (`0.1.0-must-ship-manifest`, integrity-mismatch
  diagnostic, `M3.6`) and write the 23-row disposition table into `openspec/pending-changes.md`.
- **FU-5** — Repair the 49/49 red-proof tag device (or the tags) so it holds mechanically.
- **FU-6** — Commit test-first in future cycles so Method 1/3 can verify TDD discipline
  mechanically.
- **FU-7** — Make the six `skipIf(getuid === 0)` proofs fail loudly (or drop privileges) rather
  than silently skipping under root CI.
- **FU-8** — W-4 (byte-neutrality red-proof) and W-9 (oracle faithfulness).
- **FU-9** — Either build the `mutants/` corpus (≤20 budget) or amend `design.md` §2 and §6's
  REQ-PRM-01 test-vehicle cell to record its deliberate replacement by inline mutants.
- **FU-10** — W-5 and W-6 (frozen shared singleton; standing-scan file set).
- **FU-11** — Tech-writer pass: `REQ-CST-04.1`'s rationale sentence, `REQ-CAP-02.2`'s scenario
  title (already noted as archive-time obligations).
- **FU-12** — `design.md` §6(c) still says *"Six of the 18 (#10–#16 …)"*; `slices.md`'s own dated
  B2 correction establishes the verified figure is **8**. Flagged then as out of scope; still
  uncorrected.
- **FU-13** — Quoted/whitespace-bearing bundler paths (`--outdir "my dir/…"` → `target: "my"`).
  `ADR-0081` declined a full shell-grammar parse, so this stays a registered limitation.

---

## Strict TDD (final audit)

**Verdict**: fail — assertion quality (two tautological red-proofs, one of which leaves a signed
normative clause unimplemented) plus a material triangulation gap that C-1 turned into fifteen
demonstrated escapes.

### TDD Cycle Adherence

- **Methods used**: git history (1), test/impl pairing (2), commit-message inspection (3).
- **Methods 1 & 3 — anti-TDD commit ordering in 6 of 6 slices.** In every slice the implementation
  commit precedes its test commits:

  | Slice | Implementation commit | Its test commits (all later) |
  |---|---|---|
  | S-000 | `c6012ad` feat(publish) | `edd66bd`, `3046cd9` |
  | S-001 | `1e88150` feat(capability-admission) | `259937d`, `085e5bf`, `11b77c5`, `45272a8` |
  | S-003 | `13fbe93` feat(bundler-disjointness) | `169282e`, `613aba3` |
  | S-004 | `ae5321c` feat(generate-runner-manifest) | `7cc749b`, `7afd02f`, `d74479e` |
  | S-002 | `d8838de` fix + `01b4bc3` feat | `3499a2b` |
  | S-005 | `8547d00` docs | `01ae6d6` |

  This is `strict-tdd-verify.md`'s named anti-pattern (`feat → test`).
- **Method 2 passes, with genuine countervailing evidence.** `apply-progress.md` records specific,
  falsifiable RED-first work per task — including two cases proven by reverting the fix: S-002.1
  ("ran red — 1 violation, not 2 — against the S-001 code, confirming the gap") and S-002.2
  ("temporarily restoring the pre-fix `capability-admission.ts` via `git stash` and re-running the
  XPO-01.4 red-proof: it failed, 0 violations where 1 was expected"). Every implementation file has
  a paired test file.
- **Assessment**: the RED-GREEN cycle was performed in the working tree but never committed
  test-first, so no future cycle can verify it mechanically. Not independently a halt — but it is
  the causal mechanism behind C-3, C-5 and C-1's coverage gap: tests fitted to the shipped code
  rather than derived from the requirement. The three signals corroborate each other, which is why
  those findings are treated as real rather than pedantic. Followup FU-6.

### Assertion Quality

- **Tests scanned**: the 6 files named by design §6's Test Derivation table.
- **Banned `toContain`-on-message-receiver matches**: **0**. The standing scan (S-001.7) is live
  across all four tripwire-message files with its own red-proof and a false-positive guard; 50
  pre-existing `toContain` call-sites became ~19 whole-verbatim `toBe` assertions. **REQ-CST-06.1
  is genuinely met and is one of the change's strongest deliveries.**
- **Tautologies (zero production code exercised)**: **2** — `REQ-CAP-01.2` (C-5) and
  `REQ-CST-04.3.2` (C-3).
- **Weak-but-anchored — assessed and cleared** (this gate examined each and disagrees with
  classifying them as theatre): `REQ-CAP-01.6`, `REQ-CAP-04.5`, `REQ-CAP-04.8` each carry a
  genuine leading assertion against the real pinned table (`widened.size === TABLE.size + 1`
  fails if the injected member is already present), so they positively prove
  `eval ∉ ADMITTED_GLOBALS`, `process.dlopen ∉ ADMITTED_MEMBER_PATHS`, and
  `member-path ∈ SURFACE_NODE_KINDS`. `REQ-PRM-01.2` likewise exercises real production data and
  proves the register⇄corpus bijection. These are weaker than a driven mutant but are **not**
  vacuous. `REQ-CAP-06.1`'s red-proof *is* a tautology about hashing → W-4.
- **The genuine widening protection exists and is sound**: `fit-42:743`/`:748`/`:775`/`:804`/`:832`/
  `:844` pin `SURFACE_NODE_KINDS`, `SURFACE_EXCLUSIONS`, `DENIED_CAPABILITY_PRIMITIVES`,
  `ADMITTED_GLOBALS` (21), `ADMITTED_NODE_SURFACES` keys (6) and `ADMITTED_MEMBER_PATHS` (30) by
  exact set membership, never a threshold — except the per-module value sets (W-3).

### Triangulation

- **Functions audited**: the three classifier legs, the exemption proof, the bundler grammar
  enumerator, the fail-closed boundary, `publishRunSteps` / `computePublishStepIndices`.
- **Material gap: 1, with severe consequences.** `REQ-CAP-05`'s positional/origin rule is driven by
  a *single* hop (`const F = Function; F(...)`). Adding a second hop, a member assignment, a
  return, a literal root, or a reflective root reveals C-1's fifteen escapes. This is exactly the
  failure mode the triangulation audit exists to catch — *"did one test pass and the rest is
  uncovered branches?"*
- Otherwise clean: the bundler grammar is exercised over 349 differential cells and 7 corpus
  fixtures (C-4 is a predicate gap, not a triangulation gap); the fail-closed boundary over 3
  distinct fault kinds each asserted independently plus the success direction.

### Mutation Testing

- **Tool**: Not configured — `testing.mutation_testing.tool: null`. Skipped cleanly; not a failure.
- The change's compensating device was the `mutants/` committed corpus (≤20 budget, design §2,
  S-001.6). It was **not built**; mutation red-proofs landed as in-test simulated mutants.
  `slices.md` S-001.6 records the deferral and its reasoning. Accepted — but it removes the one
  mutation-resistance device the change had, and C-1 is what a mutation corpus over the classifier
  would plausibly have caught. FU-9.

### REQ-ID Coverage

- **REQs in spec**: 22 · **REQs with ≥1 test**: 22 · **Uncovered REQs**: 0
- **Uncovered scenarios**: 1 — `REQ-CAP-01.3` (see ruling (a))
- **Red-proof tally**: 48 of 49 signed red-proof scenarios have a test; `REQ-CAP-01.3` has none.

**The plan's own 49/49 completeness device does not hold.** `slices.md` (B3) declares that the count
of `it()` titles matching `REQ-[\w.-]+\.\d+ \[red-proof\]:` across the named vehicles *"MUST equal
49 … before any slice is considered complete; a mismatch means a red-proof was landed untagged or a
non-red-proof scenario was mistagged."* Executed fresh: **40**. Reconciliation:

| Cause | Count |
|---|---|
| Tagged and matching the declared pattern | 40 occurrences (37 distinct numbered scenarios + 3 duplicate/unnumbered) |
| `REQ-CST-04.2.1`–`.9` — parameterized `it()` titles (template literals) cannot carry the literal tag | 9 |
| `REQ-DLV-01.2` — tagged `DLV-01.2 [red-proof]`, missing the `REQ-` prefix | 1 |
| `REQ-DGN-01.1` — red-proof present but sharing an untagged title with `REQ-RME-07.1` | 1 |
| `REQ-CAP-01.3` — **genuinely absent** | 1 |

37 + 9 + 1 + 1 + 1 = 49 — the arithmetic closes, so coverage is materially complete bar
`REQ-CAP-01.3`. But the device the plan committed to as a machine-checkable slice-completion
precondition is unsatisfiable as written against the shipped realisation, and it did not catch the
one real gap. FU-5.

---

## Deferred-item rulings

Both items were explicitly routed to this gate. Neither is decided by the implementer; neither is
waved through.

### (a) `REQ-CAP-01.3` — ruling: **UNCOVERED. Retirement REJECTED. Implement it as C-1's red-proof.**

`design.md` §1 records the scenario as *"unimplementable AS WRITTEN under the union this design
signed off on"* and offers two dispositions: (a) add a 6th `SurfaceNodeKind`, or (b) accept D-1's
argument that a value-position computed access is non-capability-yielding by construction, and
retire the scenario at the next spec touch.

**The structural half of the analysis is confirmed.** Probing the shipped classifier directly:

```
### CAP-01.3 shape: computed member on a computed base, VALUE position  (a[k][k], globalThis[k][k])
  surface nodes enumerated: 4  -> all [value-reference], all admitted
  => any violation/unclassifiable? false

### same shape as CALLEE  (a[k][k]())
  [callee] "a[k][k]" -> violation / constraint-4-undecidable-callee
```

The computed-access node is never enumerated as any of the five kinds in value position, so
`unclassifiable` is structurally unreachable for that shape and `FIT-CAP-TOTALITY` has no "present
but misclassified" case to catch. The callee-position variant is caught under REQ-CAP-03, as the
design states.

**But disposition (b)'s premise is false, and C-1 is the proof.** D-1's safety claim — *"computed
access read into a value, never a callee, is safe by construction"* — depends entirely on the
value→callee transition being caught. It is caught at one hop and not beyond:

```
ADMITTED | const k = "eval"; const g = globalThis[k]; const f = g; f("1+1")
```

That is a computed member expression on a computed base, in value position, laundered to a callee,
yielding arbitrary code execution with zero violations — and it is only one of fifteen such shapes.
`REQ-CAP-01.3`'s premise ("a construct that yields a capability but which no leg can resolve")
describes a real case today. Retiring the scenario now would enshrine live holes in the signed spec.

**Ruling:**
1. `REQ-CAP-01.3` is **UNCOVERED**. It must not be marked satisfied, retired, or force-fit.
2. Disposition (a) — a 6th `SurfaceNodeKind` — is **not required**. Widening the pinned union
   (`REQ-CAP-01.4`) would need its own owner-authorized unfreeze and does not address the risk.
3. Disposition (b) — retirement — is **REJECTED as argued**, because its premise is currently
   false.
4. **The correct closure is C-1's fix**, and the work is shared rather than additional: once
   default-deny is closed for unresolved roots, safe-terminals, and copied taint, implement
   `REQ-CAP-01.3` as one of C-1's red-proofs — a construct no admission leg resolves must render
   `unclassifiable-construct` and fail the build. If the owner still prefers to retire the scenario
   *as written*, it must be replaced in the same unfreeze by a scenario whose GIVEN is one of C-1's
   demonstrated shapes. Either way it stays open until an owner decision, not an implementer one.

### (b) `S-002.3` — ruling: **NOT well-defined for archive to execute. Needs an owner decision first.**

The task: *"Anchor-site code comment cross-referencing REQ-CST-04.4 (synthetic-file scoping) and
REQ-XPO-01.2 (real anchor, namespace form green) — spec Open Item 2."* Deferred because editing
`src/transport/single-instance-probe.ts` changes `dist/transport/single-instance-probe.js`'s bytes
(neither `tsconfig.json` nor `tsconfig.build.json` sets `removeComments`; TS default is `false`)
and would break this slice's own REQ-CAP-06 gate.

**The premise is verified.** The emitted anchor carries all 8 of the source's `createRequire`
comment mentions (lines 5, 10, 16, 19, 22, 29, 79, 93) — comments *are* emitted, so a comment edit
does move the digest.

**But the deferral relocated the blocker without resolving it.** The same consequence applies at
archive time as at slice time: the edit moves the digest → REQ-CAP-06 halts → per `slices.md`'s
Risks section the owner must either ratify a new pinned digest (*"at which point this change
becomes cross-repo and requires an engine handoff"*) or reject the diff. Nothing in the deferral
names which. Archive cannot execute the task as written without improvising that decision or
silently ticking the box — both unacceptable under the gate's own rule that *"Nobody re-pins the
hash unilaterally."*

**Ruling — the owner must choose one before archive:**

- **(i) RECOMMENDED — retarget the comment to a non-emitted location.** Open Item 2's stated purpose
  is reader-facing (*"so the distinction is not left implicit for the next reader"*), not
  positional. Placing the cross-reference beside the exemption logic in
  `scripts/capability-admission.ts` (build-time-only, never in the closure, provably
  digest-neutral) or in `docs/runner-integrity-invariants.md`'s Constraint-4 section (already
  rewritten by S-005.3) satisfies the intent at zero risk. Arguably the better home anyway: the
  cross-reference explains how the exemption is *decided*, which is what that file does.
- **(ii) Accept the digest change** — owner ratifies a new pin, triggering the cross-repo /
  engine-handoff path. Disproportionate for a comment.
- **(iii) Set `removeComments: true`** in `tsconfig.build.json` — rejected: out of scope, and it
  moves every emitted file's bytes.

Until one is chosen, `S-002.3` stays `[ ]` and must not be handed to archive as an executable
obligation.

---

## Spec Compliance Matrix

All results executed fresh. A scenario is `✅ COMPLIANT` only when a test covering it **passed at
runtime** in this report's own full-suite run. Requirement-level normative clauses are listed
separately from their scenarios, because several REQs have every listed scenario passing while the
requirement's own MUST is breached — that gap is the change's central finding.

`f42` = `fit-42-runner-closure-integrity.test.ts` · `f42n` = `…negative.test.ts` ·
`f23` = `fit-23-publish-workflow-guard.test.ts` · `f46` = `fit-46-publish-sequence-integrity.test.ts` ·
`docs` = `test/docs/runner-integrity-docs.test.ts` · `rc` = `test/conformance/react-conformance.test.ts`

### Requirement-level normative clauses

| Requirement | Normative clause | Result |
|---|---|---|
| REQ-CAP-01 | unrecognised node ⇒ violation/unclassifiable, never a silent pass | ❌ **FAILING (C-1)** |
| REQ-CAP-03 | callee not a statically resolvable binding ⇒ violation | ❌ **FAILING (C-1c)** |
| REQ-CAP-04 | origin ∈ exactly the four admitted kinds, else violation | ❌ **FAILING (C-1b, C-1c)** |
| REQ-CAP-05 | denied root only in `instanceof`-RHS / `typeof`-operand | ❌ **FAILING (C-1a)** |
| REQ-CST-04.2 | *any* closure reference to a register member fails the build | ❌ **FAILING (C-1a, C-1b)** |
| REQ-PTH-01 | undecidable target ⇒ explicit `unclassifiable-construct`, never a pass | ❌ **FAILING (C-4)** |
| REQ-CST-04.3 | non-vacuity guard counts by AST identifier occurrences | ❌ **FAILING (C-3)** |
| REQ-PRM-01 | ONE register, enforced at ONE site | ⚠️ PARTIAL — register is the single ledger, but enforcement leaks (C-1) |
| REQ-CAP-02, CAP-06, XPO-01, FCG-01, DGN-01, DLV-01, CST-06.1, RMD-05.1, RMD-01.2, PPI-01..05 | — | ✅ upheld |

### `runner-integrity-manifest` V3 — ADDED

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-CAP-01 | .1 totality on real closure | f42:975 | ✅ COMPLIANT (independent recount genuine; see W-9) |
| REQ-CAP-01 | .2 [red] mutant classifier → silent pass | f42:990 | ❌ **FAILING (C-5)** — tautology, zero production code |
| REQ-CAP-01 | .3 [red] unclassifiable is fail-closed | — | ❌ **UNTESTED** — ruling (a) |
| REQ-CAP-01 | .4 `SurfaceNodeKind` exact membership | f42:743 | ✅ COMPLIANT (exact set) |
| REQ-CAP-01 | .5 E1-E4 exclusions exact membership | f42:748 | ✅ COMPLIANT (exact set) |
| REQ-CAP-01 | .6 [red] narrowing union / widening exclusion | f42:753 | ✅ COMPLIANT (anchored to real tables) |
| REQ-CAP-01 | .7 RCD-03.3 JSDoc fixtures non-flagged via E1 | f42n:1230, :1247 | ✅ COMPLIANT |
| REQ-CAP-02 | .1 [red] module-scope reassignment | f42n:1200 | ✅ COMPLIANT |
| REQ-CAP-02 | .2 real closure — 3 reassignments, admitted RHS | f42n:1208 | ✅ COMPLIANT |
| REQ-CAP-03 | .1 [red] `globalThis["ev"+"al"]` (M2.1) | f42n:1256 | ✅ COMPLIANT |
| REQ-CAP-03 | .2 [red] IIFE `.constructor` (M2.2) | f42n:1263 | ✅ COMPLIANT |
| REQ-CAP-03 | .3 resolvable callee admitted | f42n:1270 | ✅ COMPLIANT |
| REQ-CAP-04 | .1 [red] `node:child_process` | f42n:1277 | ✅ COMPLIANT |
| REQ-CAP-04 | .2 six-member builtin baseline unaffected | f42n:1283 | ✅ COMPLIANT |
| REQ-CAP-04 | .3 [red] unknown `node:` → unclassifiable (R1-15) | f42n:1301 | ✅ COMPLIANT |
| REQ-CAP-04 | .4 admitted tables exact membership | f42:804, :832 | ⚠️ PARTIAL — exact-set property met; signed cardinality 22 vs shipped 21 (W-2); per-module value sets unpinned (W-3) |
| REQ-CAP-04 | .5 [red] widening `ADMITTED_GLOBALS` | f42n:1308 | ✅ COMPLIANT |
| REQ-CAP-04 | .6 member-path table exact membership | f42:844 | ⚠️ PARTIAL — property met; signed 28 vs shipped 30 (W-2) |
| REQ-CAP-04 | .7 [red] `process.dlopen` denied | f42n:1314 | ✅ COMPLIANT |
| REQ-CAP-04 | .8 [red] widening `ADMITTED_MEMBER_PATHS` | f42n:1323 | ✅ COMPLIANT |
| REQ-CAP-05 | .1 `x instanceof Function` admitted | f42n:1331 | ✅ COMPLIANT |
| REQ-CAP-05 | .2 [red] `const F = Function; F(...)` denied | f42n:1336 | ⚠️ **PARTIAL (C-1a)** — passes at one hop; the scenario's stated purpose ("the aliased-call escape is not reopened") is falsified |
| REQ-CAP-05 | .3 `typeof Function` admitted | f42n:1343 | ✅ COMPLIANT |
| REQ-CAP-06 | .1 [red] manifest byte-identical | f42:1019 (+ :1023 red) | ✅ COMPLIANT — independently reproduced; but see C-2 and W-4/W-7 |
| REQ-PRM-01 | .1 register is the exact 11-member set | f42:775, f42n:1407 | ✅ COMPLIANT |
| REQ-PRM-01 | .2 [red] unfixtured member (M2.10/M6.2) | f42n:1416, :1436 | ✅ COMPLIANT — bijection over the corpus, both directions |
| REQ-XPO-01 | .1 anchor named-import, resolve-only, exempt | f42n:1887 | ✅ COMPLIANT |
| REQ-XPO-01 | .2 namespace form green (closes R2-5) | f42n:1901 | ✅ COMPLIANT — landed with red-proof #12 green (S-002.4) |
| REQ-XPO-01 | .3 [red] aliased binding forfeits | f42n:1911 | ✅ COMPLIANT — exact counts |
| REQ-XPO-01 | .4 [red] re-export laundering (M1.12) | f42n:1925, :1936 | ✅ COMPLIANT — genuineness stash-verified |
| REQ-XPO-01 | .5 [red] anchor drift (M1.13) | f42n:1947, :1961, :1966 | ✅ COMPLIANT |
| REQ-PTH-01 | .1 [red] `--outdir .//dist/transport` | f42n:1536 | ✅ COMPLIANT |
| REQ-PTH-01 | .2 [red] `--outdir .` | f42n:1545 | ✅ COMPLIANT |
| REQ-PTH-01 | .3 [red] `-odist/…` short form | f42n:1555 | ✅ COMPLIANT |
| REQ-PTH-01 | .4 [red] `../<pkg>/dist/…` | f42n:1564 | ✅ COMPLIANT |
| REQ-PTH-01 | .5 [red] `--outdir=$VAR` → unclassifiable | f42n:1573 | ✅ COMPLIANT |
| REQ-PTH-01 | .6 non-vacuity sibling | f42:643, f42n:1617 | ✅ COMPLIANT |
| REQ-PTH-01 | .7 [red] `--out-dir` shape → unclassifiable | f42n:1583, :1593 | ✅ COMPLIANT (+ scope-limit sibling) |
| REQ-FCG-01 | .1 [red] malformed `package.json` (R2-4) | f42n:1714 | ✅ COMPLIANT |
| REQ-FCG-01 | .2 [red] unreadable mid-derivation (R1-6) | f42n:1722 | ✅ COMPLIANT — also asserts no `.tmp` survives |
| REQ-FCG-01 | .3 [red] unrouted throw (R1-5) | f42n:1735 | ✅ COMPLIANT — prefix+suffix pinned around `error.stack` |
| REQ-FCG-01 | .4 [red] biconditional ≥3 faults, pre-seeded | f42n:1690 | ✅ COMPLIANT — per-fault, not aggregate |
| REQ-FCG-01 | .5 success yields a manifest | f42n:1707 | ✅ COMPLIANT — exit-0 via helper throw (S-1) |
| REQ-DGN-01 | .1 [red] version rule (R2-3) | f42:532 | ✅ COMPLIANT (untagged; shares title with REQ-RME-07.1) |
| REQ-DGN-01 | .2 [red] directory-specifier rule (R1-8) | f42n:1350 | ✅ COMPLIANT |
| REQ-DGN-01 | .3 rule-identity totality over the corpus | f42n:1838 | ✅ COMPLIANT — `{fixture, rule}` pairs, not bare value multiset |
| REQ-DGN-01 | .4 [red] rule-swap / misattribution | f42n:1848, :1866 | ✅ COMPLIANT |
| REQ-DLV-01 | .1 counts vs live derivation | docs:361, :365 | ✅ COMPLIANT — no frozen literal |
| REQ-DLV-01 | .2 [red] stale count caught | docs:369, :378 | ✅ COMPLIANT — one per count family, exact |

### `runner-integrity-manifest` V3 — MODIFIED

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-CST-04.2 | .1 `eval` | f42n:887, f42n:1421 | ✅ COMPLIANT |
| REQ-CST-04.2 | .2 `Function` | f42n:887, f42n:1421 | ✅ COMPLIANT |
| REQ-CST-04.2 | .3 `node:vm` | f42n:887, f42n:1421 | ✅ COMPLIANT — single-emit `constraint-4-inadmissible-origin` per slices B4 |
| REQ-CST-04.2 | .4 `Bun.plugin` | f42n:887, f42n:1421 | ✅ COMPLIANT |
| REQ-CST-04.2 | .5 `process.binding` | f42n:887, f42n:1421 | ✅ COMPLIANT |
| REQ-CST-04.2 | .6 `node:child_process` | f42n:1421 | ✅ COMPLIANT (see S-2) |
| REQ-CST-04.2 | .7 `node:worker_threads` | f42n:1421 | ✅ COMPLIANT (see S-2) |
| REQ-CST-04.2 | .8 `WebAssembly` | f42n:1421 | ✅ COMPLIANT — detail is the full path `WebAssembly.instantiate` |
| REQ-CST-04.2 | .9 `module.register` / `registerHooks` | f42n:1421 (2 fixtures) | ✅ COMPLIANT — split per PRM-01.2 bijection |
| REQ-CST-04.3 | .1 non-vacuity on the real tree | f42:582, :588 | ❌ **FAILING (C-3)** — substring-counted, forbidden by this REQ's own normative clause; title also names the retired mechanism (W-10b) |
| REQ-CST-04.3 | .2 [red] AST-counted, not substring (R1-10) | f42n:1363 | ❌ **FAILING (C-3)** — tautology; never invokes the guard or any AST count |
| REQ-CST-06.1 | .1 every tripwire message asserted whole | f42n:1486 (standing scan), f42n:929 | ✅ COMPLIANT — 0 `toContain` on message receivers |
| REQ-CST-06.1 | .2 [red] substring-passing / whole-failing (R2-3) | f42n:1498 (+ :1512 FP guard) | ✅ COMPLIANT |
| REQ-RMD-05.1 | .1 segment-bounded, `runner.js` not a false positive | f42:339, f42n:625 | ✅ COMPLIANT |
| REQ-RMD-05.1 | .2 [red] genuine `dist/runner/` segment caught | f42n:629 | ✅ COMPLIANT |
| REQ-RMD-01.2 | .1 no locale-sensitive API in generator source | f42:1141 | ✅ COMPLIANT |
| REQ-RMD-01.2 | .2 [red] planted `.localeCompare()` caught | f42:1154, :1166 | ✅ COMPLIANT — all four API forms |

### `publish-pipeline-hardening` V4 — ADDED

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-PPI-01 | .1 packed digests match packed bytes | f46:130 | ✅ COMPLIANT — real stamp→rebuild→pack on a `cpSync` scratch tree |
| REQ-PPI-01 | .2 [red] `--ignore-scripts` mismatch | f46:137 | ✅ COMPLIANT — names the field |
| REQ-PPI-02 | .1 rebuild step present and positioned | f23:533 | ✅ COMPLIANT |
| REQ-PPI-02 | .2 [red] absence caught | f23:539 | ✅ COMPLIANT |
| REQ-PPI-03 | .1 suite step before publish, no `continue-on-error` | f23:556 (+ :567/:579/:592) | ✅ COMPLIANT (structural) |
| REQ-PPI-03 | .2 [red] violating closure never reaches publish (S9) | f46:169 (S-000 leg), f46:205 (S-001 leg, real Constraint-4 fixture) | ✅ COMPLIANT — both legs of the iteration-2 amendment landed |
| REQ-PPI-03 | .3 clean closure reaches publish | f46:184 | ⚠️ **PARTIAL (C-2)** — holds on the scratch tree; falsified in the real `publish.yml`, where the suite step can never pass |
| REQ-PPI-04 | .1 per-file timeout declared | f23:608 | ✅ COMPLIANT — `setDefaultTimeout(20000)` ≠ 5000 default (verified per-file in Bun 1.3.14) |
| REQ-PPI-04 | .2 [red] non-resolving fixture fails at the boundary | rc:212 | ✅ COMPLIANT — child `bun test`, names the file, "timed out" |
| REQ-PPI-05 | .1 execution order read, not textual | f23:499 | ✅ COMPLIANT |
| REQ-PPI-05 | .2 [red] `needs:`-divergent reorder caught (R1-13) | f23:512 | ✅ COMPLIANT |

### Compliance summary

| Result | Count |
|---|---|
| ✅ COMPLIANT | **69** |
| ⚠️ PARTIAL | **4** — REQ-CAP-04.4, REQ-CAP-04.6 (cardinality/value-set drift), REQ-CAP-05.2 (one hop only), REQ-PPI-03.3 (scratch tree only) |
| ❌ FAILING | **3** — REQ-CAP-01.2, REQ-CST-04.3.1, REQ-CST-04.3.2 |
| ❌ UNTESTED | **1** — REQ-CAP-01.3 |
| **Total** | **77** |

Plus **6 requirement-level normative clauses breached** (REQ-CAP-01, CAP-03, CAP-04, CAP-05,
CST-04.2, PTH-01) and one partial (REQ-PRM-01). This gap between passing scenarios and breached
requirements is the report's central observation: the scenarios were written narrowly enough that
every one can pass while the property it was meant to establish does not hold.

---

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| ADR-0079 — capability admission replaces deny-scan | ⚠️ Partially | `denyScan` deleted, admission wired in, all three probe-confirmed live escapes closed. But *"default is violation; ambiguity is violation"* does not hold — C-1's fifteen shapes end in a silent `admitted`. |
| ADR-0080 — classifiers total with fail-closed default | ⚠️ Partially | Enumerator/classifier split shipped; the `default` arm yields `unclassifiable` (`capability-admission.ts:773`). But `safe-terminal` is an unlisted fifth admitted origin (C-1c), and the non-vacuity proof is tautological (C-5). |
| ADR-0081 — resolution-based path verdicts; predicates in `scripts/` | ⚠️ Partially | Mechanism shipped and correct on the spellings it recognises (349-cell differential, 0 mismatches), but the undecidability predicate leaks (C-4) — **and the ADR file was never written** (W-1). |
| D-1 — computed access judged by position, not base | ⚠️ Partially | Holds at one hop; the value→callee laundering path defeats the safety argument (C-1a, ruling (a)). |
| D-2 — no-reassignment precondition scoped to origin soundness | ✅ Yes | 3 reassignments pinned with admitted RHS (f42n:1208). |
| D-3 — origin admission per-position, one-hop taint | ⚠️ As designed, insufficient vs the signed spec | The one-hop bound is explicitly declared in the design, but a declared implementation bound cannot narrow REQ-CAP-05's normative MUST (C-1a). |
| E1–E4 exclusions are claims, not pass paths | ✅ Yes | Exact-membership pinned (f42:748) + widening red-proof (f42:753) + the RCD-03.3 day-one scenario. |
| §2 File Changes table | ⚠️ Four deviations | Absent: `openspec/decisions/0081-*.md` (W-1), `mutants/` corpus (FU-9). Unlisted: `test/support/corpus-completeness.ts`, `test/support/shared-build.ts` (W-8). All other rows match; `src/**` genuinely untouched. |
| §7 Fitness-function budget (exactly 4) | ✅ Yes | No fifth function introduced. |
| §8 Byte-neutrality gate, per slice | ✅ Yes | Independently reproduced; 118/118 `dist/` files byte-identical. Rollback validation text names a superseded digest (W-2). |
| 3/3 ADRs | ❌ No | 2 of 3 on disk (W-1). |
| §6 "43 red-proof scenarios each asserting rule identity AND exact count" | ⚠️ Partially | Two assert over local literals only (C-3, C-5). |

---

## Drift / Cross-Change

| Module | Status | Notes |
|---|---|---|
| `FIT-CAP-TOTALITY` | ⚠️ Passing, non-vacuity unproven | Enumerator half genuine (but see W-9); classifier half structurally tautological (C-5). |
| `FIT-MANIFEST-BYTE-NEUTRAL` | ⚠️ Passing locally, self-blocking in CI | Independently reproduced here; guarantees a red publish job (C-2). Red-proof weak (W-4); no regeneration path (W-7). |
| `FIT-PATH-SPELLING-INVARIANCE` | ⚠️ Passing, predicate leaks | Ground-truth oracle = Node `resolve`/`relative`; non-vacuity sibling present; C-4 is outside its cross-product. Note: the 54-cell cross-product at f42:1040-1090 **constructs its `targets` array literally** and never calls `findBundlerTargets`, so it provides zero coverage of the walk — real coverage comes from the individual spelling cases and the 7 corpus fixtures. |
| `FIT-FAILCLOSED-BICONDITIONAL` | ✅ Passing | Per-fault, pre-seeded root, both directions. Genuinely strong. |
| `fit-23` 18/18 baseline | ✅ Preserved | 27 tests pass; every pre-existing `REQ-PPH-*` / `REQ-BPI-03.1` proof intact. |
| 18 S-000-tier survival red-proofs | ✅ Preserved | 8 (S-001.8) + 10 (S-002.6) = 18. `node:vm`'s rule identity deliberately migrated to `constraint-4-inadmissible-origin` per slices B4 — a documented stricter-only change, not a regression. |
| FIT-27 anti-tautology scan | ✅ Not broken by the new cross-boundary import | Corpus-scoped to `scripts/regen-corpus.ts` (verified), so W-10a is a comment defect only. |
| Existing `REQ-RCD-*` / `REQ-RME-*` / `REQ-BDI-*` / `REQ-PPH-*` | ✅ No regressions | Full suite 0 fail; no test deleted or weakened. |
| Layer / architecture fitness | ✅ No degradation | Two new modules join the existing `scripts/` build-integrity cluster; the `test/support/` → `scripts/` relocation is placement-only. |

---

## Post-simplify regression scrutiny

The simplify gate landed 10 commits (`19b77d3..1ade7d7`) touching 9 mechanisms **after** the last
in-loop verify, covered only by affected-test runs. Each was audited for behaviour drift.

**Result: zero behaviour drift.** None of the gating findings above originates in the simplify pass.
Both specifically-named high-risk items cleared with mechanical differentials:

- **`ca53dbe` (fit-23 shared index extraction) — PRESERVED, verified.** Reason strings
  byte-identical (assertion/string-literal multiset diff across the range: no diff; all three
  reasons survive verbatim at f23:218, :223, :267, :276). Index equivalence proven exhaustively:
  every kind-sequence of length 0–5 over the 4-member `PublishStepKind` union × 5 publish-run
  spellings × 3 `scripts` maps = **20,475 cells**, old vs new, both checkers — **0 mismatches**.
  That space covers step-missing, stamp-at-0, publish-before-stamp, multiple matching steps, and
  stamp/publish with no build between. The guard reordering is provably inert: the old checkers
  computed the rebuild-between slice only after their early returns, and the new `hasRebuildBetween`
  reproduces exactly those conditions.
- **`3b6132d` (bundler single-walk) — PRESERVED, verified.** `classifyToken` is a pure function of
  `(tokens, index)` with no shared mutable state; the merged loop keeps the same full walk with no
  `break`/early return; the three `TokenReading.kind` values are mutually exclusive, so the new
  `else if` is exactly the old second pass's predicate. Push order is unchanged, so the token
  *named* in each construct is unchanged. Differential harness importing old and new side by side:
  10 flag spellings × 11 path forms + both flag-pair orderings + multi-script records in varied
  order + degenerate shapes + all 7 committed corpus fixtures = **349 cells**, comparing `targets`,
  `unclassifiable`, `violations` and the final verdict — **0 mismatches**. (C-4 is a pre-existing
  predicate gap present on both sides of the commit, not drift.)

Per-commit verdicts: `19b77d3` PRESERVED (the inlined helper was module-private with one caller;
every reset path still runs through `resetAnchorExemptionLatch`) · `3b6132d` PRESERVED ·
`ca53dbe` PRESERVED · `33fbd97` PRESERVED (same expression; digests bit-identical) · `889dd9a`
PRESERVED — lifetime *improved*, `preSeededRoot` previously leaked its `mkdtempSync` dir forever ·
`1757b2c` PRESERVED (byte-identical fixture trees: same file set, contents, ordering) · `ecd6283`
PRESERVED (neither consumer mutates the cached bytes) · `200ebeb` PRESERVED (both call sites already
used identical memoized inputs) · `19574eb` PRESERVED (`expectCorpusMatchesDeclared` keeps exact
bidirectional multiset equality at all 3 sites) · `1ade7d7` DOCS-ONLY (confirmed single-file).

**Assertion-weakening sweep across all 10 commits: zero weakening.** `expect(...)` multiset diff at
`19b77d3~1` vs `1ade7d7` for all five touched test files is identical, except the 3 corpus
assertions absorbed verbatim into the helper. No `toBe`→`toContain`, no exact-count→threshold, no
removed assertions, no removed test cases. The standing REQ-CST-06.1 scan runs green.

Two latent hazards surfaced (not drift): W-5 and W-6, plus S-3–S-6.

---

## In-Loop History

| Iteration | Slice | Verdict | Issues fixed |
|---|---|---|---|
| 1 | S-000 | NEEDS_FIX | `checkSuiteGate` triangulation gap |
| 2 | S-000 | PASS | closed by `f8d6444` |
| 3 | S-001 | PASS | after the S-001.7 completion pass + doc-drift re-pin |
| 4 | S-003 | PASS | — |
| 5 | S-004 | PASS | unrouted-error stderr suffix pin added (`44c537f`) |
| 6 | S-002 | PASS | two genuine exemption gaps closed (`d8838de`, `01b4bc3`) |
| 7 | S-005 | PASS | — |

No iteration exceeded the 3-per-batch budget. Note that the in-loop gate is delta-scoped by design
and does not run the adversarial construct probing that surfaced C-1 — which is precisely what the
final gate is for.

---

## Fix Plan

Four batches. Recommended as **ONE** batched `sdd-apply` fix followed by **ONE** re-verify. Batch 1
is the only one touching production classifier logic and carries all the risk; batches 2–4 are
small and independent.

### Batch 1 — Close default-deny (C-1) and, with it, REQ-CAP-01.3

- **Root cause**: three distinct silent-pass paths in `scripts/capability-admission.ts` — taint is
  not transitive; an unresolvable free root is admitted as `local` in value position; and
  `resolveChain`'s `safe-terminal` is an unlisted fifth admitted origin.
- **IMPACT if left unfixed**: fifteen demonstrated, executable arbitrary-code-execution constructs
  pass the guard inside the digest-verified runner closure — including single expressions needing
  no aliasing (`"".constructor.constructor("return 1")()`). The closure-sealing lemma — that
  everything the runner executes is hashed in `dist/runner-manifest.json` — does not hold, which is
  the only thing Constraint 4 exists to provide. Shipping means re-signing a spec whose central
  promise the guard does not keep, in a change whose sensitivity override fired for
  `security (code execution)`, and whose own docs now assert the stronger property.
- **Suggested approach**: (1) enforce REQ-CAP-05 at the denied root's occurrence; (2) make
  `origin === undefined` a violation in every position and taint on *root* register membership;
  (3) deny a literal/call-result terminal when the chain adds a property segment — at minimum deny
  `constructor` as a member segment; (4) make `tainted` transitive over binding copies and
  assignment RHS. Then land red-proofs for all fifteen shapes (rule identity + exact count), and
  cite the doubly-computed value-position one as `REQ-CAP-01.3`'s realisation per ruling (a).
- **Blast radius**: `scripts/capability-admission.ts`; new red-proofs and `deny-scan/` fixtures in
  `test/fitness/fit-42-runner-closure-integrity.negative.test.ts`. **No `src/**` change → digest
  unaffected.** Measured: zero real-closure sites carry a bare denied root (`eval` 0, `Function` 0,
  `WebAssembly` 0; `createRequire` 2, both at the exempt anchor), so (1) and (4) should be
  false-positive-free. Fixes (2) and (3) are the ones to re-measure against `FIT-CAP-TOTALITY`'s
  real-closure run before choosing the exact cut — the closure's four probe-verified safe-terminal
  shapes must stay green. Re-run byte-neutrality to confirm.

### Batch 2 — Unblock the publish job (C-2)

- **Root cause**: a version-sensitive digest assertion runs inside the suite that now gates publish,
  after the version stamp.
- **IMPACT if left unfixed**: the publish job is red on every push to `main`; the gate S-000 exists
  to install can never pass, REQ-PPI-03.3 is false in the real workflow, the 0.1.0 release is
  blocked, and the first person to hit it is invited to add `continue-on-error` — deleting the
  gate's entire value, which is the outcome ruling 6 was written to prevent.
- **Suggested approach**: make the digest gate version-invariant (regenerate against a fixed
  synthetic `packageVersion` and compare that) — this also dissolves W-7 by removing the pinned
  literal. Alternatively make it the one-shot slice gate design §7 specifies rather than a standing
  suite assertion.
- **Blast radius**: `test/fitness/fit-42-runner-closure-integrity.test.ts`; possibly
  `.github/workflows/publish.yml` step order. No production code.

### Batch 3 — Close the bundler undecidability class (C-4)

- **Root cause**: undecidability is detected by `value.includes("$")` alone.
- **IMPACT if left unfixed**: an output-directing flag whose target is backtick command
  substitution — or absent entirely — passes silently, so a script writing into the closure is not
  flagged. A false negative voids the closure-sealing lemma (ADR-0081's own Consequences).
- **Suggested approach**: invert the predicate — a recognised flag's value is decidable only if it
  matches a committed safe-path grammar; everything else is `unclassifiable`. Closes the class
  rather than two spellings, satisfying criterion 11.
- **Blast radius**: `scripts/bundler-disjointness.ts` + two new `bundler-scripts/` fixtures with
  rule-identity assertions.

### Batch 4 — Make two spec-mandated proofs real (C-3, C-5)

- **Root cause**: two red-proofs were written to fit the shipped code rather than to the
  requirement — the anti-TDD commit ordering is the mechanism.
- **IMPACT if left unfixed**: `R1-10` is recorded `CLOSED-BY-FIX` in the archive ledger while the
  guard it names is provably vacuous (green with every real `createRequire` reference deleted); and
  `FIT-CAP-TOTALITY` — the fitness function the whole redesign rests on — has no non-vacuity proof,
  so an enumerator regression would ship silently. Both would be inherited as false green by the
  next cycle.
- **Suggested approach**: C-3 — AST identifier-occurrence count over the parsed anchor, asserted
  `toBe(2)`; rewrite `REQ-CST-04.3.2` as the AST-vs-substring differential its scenario names; fix
  the test title (W-10b) in the same edit. C-5 — mutate the **enumerator** (shim dropping one
  `SurfaceNodeKind`) against a fixture exercising that kind, asserting
  `surface.length < independentSurfaceCount(...)` and naming the dropped kind.
- **Blast radius**: the two `fit-42-*` test files only. No production change, no digest impact.

### Recommended to fold in (cheap, and in the archive's own path)

- **W-1** — transcribe `design.md` §5's ADR-0081 block into
  `openspec/decisions/0081-resolution-based-path-verdicts-predicate-placement.md`. Four shipped
  files already cite it; the pre-archive `arch_audit_gate` has nothing to audit without it.
- **W-2** — schedule the signed-spec delta sync for **all three** stale figures (22→21, 28→30,
  `bf6c983c…`→`31cd5382…`); `design.md` currently schedules only the first two. Also correct §8's
  rollback-validation digest.
- **W-3** — pin `ADMITTED_NODE_SURFACES`' per-module value sets, not just its keys.
- **W-8** — add the two unlisted files to design §2 with their simplify-pass provenance.

---

## Adversarial Quality Gate

**Code audit (`pre-pr` mode, per `skills/_shared/code-audit.md`)**: run over the full diff
(`f7428e8...HEAD`, 49 files, +5804/−406) against both signed specs, the design's File Changes
table, `triage.md`'s problem statement and scope, `openspec/architecture.md`, and
`openspec/sensitive-areas.md`. All four check groups ran.

| Result | Findings |
|---|---|
| **Gating** (Bug/MAJOR/Architecture **and** `demonstrated` **and** `blocking`) | **5** — C-1, C-2, C-3, C-4, C-5 |
| Followups (`improvement` or `unverified`) | W-1..W-10, S-1..S-6, FU-1..FU-13 |

Per-group notes:
- **1.1/1.2 spec drift & upstream coverage** — not run: `triage.md` records
  `spec_source: internal`, so there is no upstream spec to drift from.
- **1.3 REQ-ID test coverage** — C-3, C-5, and the one unreferenced scenario ID (`REQ-CAP-01.3`).
  All other 21 REQ-IDs and their scenario IDs are referenced in `test/`.
- **1.4 AC clause coverage in diff** — C-1, C-3, C-4 (implementing code contradicts the signed
  normative clause).
- **2.1 layer violations** — none. The one new cross-boundary edge (`test/support/` → `scripts/`)
  is sanctioned by ADR-0081's placement decision and does not trip FIT-27 (corpus-scoped,
  verified). Only the stale comment is reportable (W-10a).
- **2.2 ADR contradictions** — C-1 (ADR-0079/0080), C-4 (ADR-0081), W-1. ADR-0075 is **not**
  reversed. ADR-0079's own table counts are current in code (21/6/30).
- **2.3 sensitive-area coverage** — both fired rows carry REQ-IDs in the specs' Sensitive Areas
  Coverage tables, so the registry obligation is met on paper. Substantively: the code-execution
  guard has fifteen demonstrated default-pass holes (C-1) and the deployment surface is
  self-blocking (C-2).
- **2.4 SSOT bypass** — none.
- **2.5 project-standard violations** — none beyond W-10.
- **3.1 untyped casts** — none in production beyond index-access non-null assertions; two test-only
  double casts (W-10d).
- **3.2 magic numbers** — none. `setDefaultTimeout(20000)` is REQ-PPI-04-mandated and documented;
  verified empirically that Bun 1.3.14's `setDefaultTimeout` is per-file, so it does not weaken the
  rest of the suite gate.
- **3.3 TODO / FIXME / eslint-disable** — **zero introduced anywhere in the diff.** Nothing to
  cross-reference against REQ-IDs. Clean.
- **3.4 dead duplicates** — the duplicated `oneLine` (W-10c); the simplify pass removed the rest.
- **4.1 scope creep** — W-8 (two unlisted files), plus two *declared* artefacts absent (W-1, FU-9).
- **4.2 pending-sync flags** — not run: pre-archive, no `archive_report` exists yet.
- **4.3 migration / versioning without rollback** — C-2, W-7.

**Live-app pass**: N/A — no UI surface; the change ships no runtime bytes.

**Adversarial review (`judgment-day`)**: **required**.

Justification — the condition is met twice over, independently of the failures above:
1. **Triage = L.** `sdd-verify`'s rule sets `required` on L classification alone.
2. **Sensitive areas touched.** Both signed deltas record a fired override: `security (code
   execution)` — the Constraint-4 guard IS the change's core subject, so the SUBJECT test is met,
   not mere proximity — and `deployment / build integrity` (`.github/workflows/publish.yml`, OIDC,
   publish sequencing).

`design.md` §11 reaches the same conclusion independently and names the acceptance bar: *success
criterion 11 — zero findings whose fix is "add another spelling."* That bar is directly relevant:
C-1's and C-4's fixes are rule changes, not spelling additions, so neither finding itself breaches
criterion 11 — but a fix that merely enumerates the fifteen shapes would.

**Sequencing**: `judgment-day` runs after this verify returns `pass` / `pass-with-followups`. The
verdict is `fail`, so the fix loop comes first; `judgment-day` then runs **blind** on the fixed diff,
before archive. Given that this gate found fifteen escapes by adversarial construct probing that
seven in-loop verifies did not, the blind pass should be treated as load-bearing rather than
ceremonial.

**Architecture impact confirmation**: design claims `additive`. **Confirmed `additive`** —
independently checked against §2c: the two new predicate modules join the existing `scripts/`
build-integrity cluster without moving its boundaries; the one-derivation/three-consumers shape,
the BUILD/CI/ENGINE authority split (ADR-0075) and the `dist/runner-manifest.json` cross-repo
contract are all unchanged (the contract is byte-identical by a gate this report reproduced);
`src/**` is genuinely untouched (zero `src/` paths in `git diff --name-status f7428e8...HEAD`). The
`test/support/` → `scripts/` relocation is placement within the documented cluster. Zero `deviates`
rows stands.

**Caveat**: the baseline gains its declared entries only if ADR-0081 is actually written (W-1).
Until then one of the three declared decisions has no record outside the change folder, and the
pre-archive `arch_audit_gate` has nothing to audit the placement claim against. The fixes in
batches 1–4 touch only `scripts/` and `test/`, so they do not change this assessment.

---

## Followups for `sdd-archive`

Register in `openspec/pending-changes.md`: all of FU-1..FU-13, plus W-1..W-10 and S-1..S-6 not
folded into the fix loop. Additionally:

- The 23-row disposition table from `slices.md`, **re-verified against the built code**. This report
  contradicts one row: **`R1-10` is NOT `CLOSED-BY-FIX`** (C-3). Its disposition must be corrected
  before the table is written.
- `S-002.3`'s owner decision (ruling (b)) — must be resolved, not inherited.
- `REQ-CAP-01.3`'s disposition (ruling (a)) — must not be silently retired.
- Signed-spec delta sync including all three stale figures (W-2).
- The one `archive-verifies` row (architecture baseline refresh) — `architecture_impact: additive`
  *prompts* a refresh; it does not mandate one.

---

### Verdict

**fail** — category `quality`.

Five gating findings, all demonstrated against the production code path and all
outcome-blocking. The decisive one: the capability-admission classifier admits fifteen distinct,
executable arbitrary-code-execution constructs inside the digest-verified runner closure, breaching
the normative clauses of REQ-CAP-01, CAP-03, CAP-04, CAP-05 and CST-04.2 — a change that inverts a
guard's default must actually invert it. Alongside: the new publish-job suite gate is permanently
red so the job can never publish; the bundler undecidability predicate lets command substitution
pass; `R1-10`'s substring-counting guard survives while the ledger records it closed; and
`FIT-CAP-TOTALITY`'s non-vacuity proof exercises no production code.

None of the five requires a scope, budget, or spec re-open, and none touches `src/**`, so the
digest and byte-neutrality gate are unaffected. Four bounded fix batches are specified above with
measured blast radii.

Everything else is genuinely strong and should not be re-litigated in the fix loop: 2548/2548 tests,
clean typecheck, byte-neutrality independently reproduced across all 118 `dist/` files, a real
fail-closed generator with a per-fault biconditional, complete whole-verbatim message assertions
with a live standing scan, rule-identity totality over the fixture corpus, and zero behaviour drift
across all 10 simplify-gate commits.
