# Verification Report — react-dialect

**Change**: `react-dialect`
**Mode**: final (Strict TDD) · **Iteration**: 3
**Spec version**: V6 (owner-signed, 2026-07-17)
**Commit under verification**: `9a1c23c` · **Delta since iteration 2**: `01ecec7..9a1c23c`
**Triage**: L · sensitive-area override in effect · Branch `feat/react-dialect`, working tree clean

---

## Verdict

### `pass-with-followups`

**F-1 is RESOLVED** — independently reproduced, both directions, at the validator AND the public
API. **V6's completeness claim HOLDS** — I attacked it with ~194.7M candidate identifiers against
node's real ES module parser and could not find a 49th. The delta is a genuine RED→GREEN. Step 11b
found no `Bug`/`Architecture`/`MAJOR`. Full suite **1829 pass / 0 fail** from a clean
`/private/tmp` worktree, zero environmental timeouts.

The verdict is `pass-with-followups`, **not** `pass`, and this does **not** block archive — see
"A note on the verdict token" below. Six followups from iteration 2 remain open (F-2..F-7, all
non-gating) plus one new Nit (F-8).

---

## Iteration history — the record of why this change is trustworthy

| Iter | Commit | Verdict | What happened |
|---|---|---|---|
| **1** | `f12ffba` | **`fail`** | Gated on ONE item while four blind Council personas independently found **four real `addImport` correctness bugs it had missed**. The failure was the verify pass itself, not just the code. Recorded in `council-findings.md`. |
| **2** | `01ecec7` | **`pass-with-followups`** | After spec V5 + a nine-item fix pass. Comprehensive: all nine items independently reproduced, Step 11b clean, suite 1824/0, TDD adherence pass. Surfaced **F-1** (`eval`/`arguments` accepted → invalid emission) — spec-CONFORMANT (46/46, zero drift), but a hole in **REQ-RXD-06's own floor**. Six further followups F-2..F-7. |
| **3** | `9a1c23c` | **`pass-with-followups`** (this report) | Spec **V6** (owner-signed) closes F-1's contract hole; `9a92944` + `299fc32` implement it. F-1 verified RESOLVED. V6's completeness claim tested adversarially and upheld. F-2..F-7 still open, non-gating; new Nit F-8. |

Iteration 1's lesson is why this report reproduces rather than reads: **a verify pass that trusted
the apply record is how four bugs got past iteration 1.** Every number below was taken by me.

---

## 1. F-1 — RESOLVED

### 1.1 Mechanical set diff (both directions) — reproduced, not asserted

The apply record claims it verified the set mechanically rather than asserting it. I reproduced that
diff independently: parsed the **runtime `Set`** and diffed it against **the spec's own 48-entry
enumeration parsed out of the V6 prose** (not hand-typed — the parser reads the backticked runs in
REQ-RXD-06 verbatim):

```
spec count: 48
code count: 48
missing (spec has, code lacks): []
extra  (code has, spec lacks): []
EXACT MATCH: true
```

V6 retired the "at minimum" floor and now demands **EXACTLY** these 48, so **both** directions are
now spec violations. **Neither fires**: zero drift, zero over-blocking.

Over-blocking was additionally checked *empirically*, not only against the spec text: the
dictionary/curated sweep (§2) submits all 48 set members to node's real parser and confirms **every
one is genuinely rejected**. Nothing in the set is over-blocked.

### 1.2 REQ-RXD-06.9 implemented, with the substring counter-check

`test/dialects/react/name-validation.test.ts:160-188` — cited by ID, mirrors REQ-RXD-06.7's shape:
`eval`/`arguments` reject; `evaluate`/`myEval`/`argumentsList` accepted (exact-Set-membership
discipline, never substring), which is the counter-check the scenario specifies.

Scoped run (`/private/tmp/rxd-verify3` worktree of `9a1c23c`): **5 pass / 0 fail**.

### 1.3 Reproduced at the public API, not only the validator

The shipped 06.9 test asserts `assertValidImportBinding` directly — matching 06.7's shape, exactly
as V6 specifies. But scenario 06.9's THEN clause also promises *"zero directives emitted, target
file byte-unchanged"*, which a validator-level test does not itself prove. I wrote a scratch test
driving the **real public API** and asserting the full THEN clause:

```
addImport("eval", "react")       -> rejects · message names `name` + reserved-word rule
                                  · collectModifies == 0 · file byte-unchanged   ✅
addImport("arguments", "react")  -> same                                         ✅
addImport("evaluate"|"myEval"|"argumentsList", "react") -> ACCEPTED, emits       ✅
```

**5 pass / 0 fail** (scratch test, `/private/tmp/rxd-verify3`; removed after the run).

So 06.9's full THEN clause holds end-to-end. The property is carried compositionally — `validatedOp`
makes `body` structurally unreachable before validation (ADR-02), pinned independently by
REQ-RXD-13.2 — which is the same argument iteration 2 accepted for 06.7. Consistent treatment.

**F-1: RESOLVED.**

---

## 2. V6's completeness claim — HOLDS (I tried to break it)

V6 makes a **deductive claim about the grammar**: `addImport` always emits into an ES module → ES
modules are always strict → reserved words AND strict-mode-restricted BindingIdentifiers both apply
unconditionally → their union is the complete set ECMA-262 can reject in BindingIdentifier position.
This deserves testing, not nodding at: the *previous* wording ("at minimum") is precisely what let
F-1 through, so the wording is load-bearing, not decoration.

### 2.1 Method

Oracle: **node's real ES module parser** via `vm.SourceTextModule`, constructing
`import { X } from "react";`. Construction parses **without linking**, isolating parse errors from
resolution errors. Validated on known cases before use:

| Probe | Node's verdict |
|---|---|
| `eval` / `arguments` | `SyntaxError: Unexpected eval or arguments in strict mode` |
| `class` | `SyntaxError: Unexpected reserved word` |
| `foo` / `evaluate` | ACCEPTED |

Disagreement test, in **both** directions: `parserRejects(n) !== IMPORT_RESERVED_WORDS.has(n)`. A
49th identifier = parser rejects but the set lacks it. Over-blocking = set has it but parser accepts.

### 2.2 Coverage

Candidates are constrained upstream by `IMPORT_BINDING_GRAMMAR` (`^[A-Za-z_$][A-Za-z0-9_$]*$`), so
the reachable domain is ASCII-only — Unicode identifiers and escapes are rejected by the grammar
gate before the Set is ever consulted. Completeness is therefore scoped to that reachable domain,
which is the correct scope.

| Tier | Domain | Candidates | Disagreements |
|---|---|---|---|
| Exhaustive len 1-4 | **full regex alphabet** (54 first-char × 64 rest) | 14,380,470 | **0** |
| Exhaustive len 5 | lowercase `[a-z]` | 11,881,376 | **0** |
| Exhaustive len 6 | lowercase `[a-z]`, 368/676 prefixes | 168,167,168 | **0** |
| Curated + dictionary | every ES/TS keyword, contextual keyword, future-reserved, global, casing variant, `_`/`$` variant, + `/usr/share/dict/words` — up to 28 chars | 236,031 | **0** |
| **Total** | | **≈194.7M** | **0** |

The curated tier is the one that would catch a long keyword (`instanceof`, `implements`,
`protected`, `arguments` are all ≥9 chars, beyond exhaustive reach) — it includes every reserved
word across ES editions, TS keywords (`satisfies`, `accessor`, `using`, `infer`, `keyof`, …),
contextual keywords (`as`, `from`, `of`, `get`, `set`, `target`, `meta`), and globals (`undefined`,
`NaN`, `globalThis`, …). None disagreed.

### 2.3 Ruling

**The claim holds.** I could not produce a 49th. The empirical result agrees with the deduction:
ECMA-262's rejections in BindingIdentifier position come from a **finite, enumerated** source — the
`ReservedWord` production plus the strict-mode early-error rule for `eval`/`arguments` — and the
48-entry set is exactly that union. V6's central assertion is sound, and `IMPORT_RESERVED_WORDS` is
complete for the BindingIdentifier-in-strict-ES-module problem this argument validates.

**Honest limit**: length 6 is 368/676 prefixes (a full 676-prefix re-run was still in flight at
report time; every completed shard produced zero disagreements, across two independent runs).
Lengths ≥7 rest on the curated + dictionary tier, not exhaustion. The exhaustive tiers **corroborate
a deductive argument; they do not replace it** — the deduction is what carries the claim, and it is
sound. Exhausting a domain this size is not what makes the claim true; it is what makes it credible.

---

## 3. TDD Cycle Adherence (this delta) — PASS, RED failed for the right reason

The apply record claims a **genuine RED→GREEN** with no probe substitution, because the values were
accepted before the fix so real RED was available. **Reproduced by reverting the two Set entries** in
the `/private/tmp/rxd-verify3` scratch worktree:

```
set size: 46 | has eval: false | has arguments: false
=== SCOPED RED RUN (REQ-RXD-06.9) ===
(fail) "eval" rejects, naming `name` and the reserved-word rule
        expect(received).toBeInstanceOf(expected)
        Expected constructor: [class Error]
        Received value: undefined                     <- assertion failure
(fail) "arguments" rejects, naming `name` and the reserved-word rule
        (same)
 3 pass / 2 fail
```

Restored → **5 pass / 0 fail**.

**The RED failed for the RIGHT reason.** Both failures are `toBeInstanceOf(Error)` receiving
`undefined` — the validator *did not throw*, which is the defect itself. Not module resolution, not
a syntax error, not an import-path typo. The test **discriminates the fix**: it fails without the two
entries and passes with them. Matches the apply record's claim exactly (scoped pre-fix 3/2, post-fix
5/0). This change's history is precisely why that distinction matters, and here it holds up.

The 3 always-passing tests are the substring lookalikes — by design they do *not* discriminate; they
are the counter-check guarding against over-blocking. Correct shape, honestly reported.

**TDD Cycle Adherence for this delta: PASS.**

---

## 4. Regression — none

The delta is exactly what it claims: **2 Set entries + 1 test block** (+ SDD artefacts).

```
src/core/jsx-name-validator.ts              |  9 +-  (2 entries + comment)
test/dialects/react/name-validation.test.ts | 32 +   (REQ-RXD-06.9 block)
openspec/… , .sdd/state/…                   |        (artefacts only)
```

| Check | Result | Location taken |
|---|---|---|
| **Full suite** | **1829 pass / 0 fail**, 3898 expects, 181 files, 20.32s | fresh `/private/tmp/rxd-verify3` worktree of `9a1c23c` |
| `tsc --noEmit` @ `9a1c23c` | **0 errors** (exit 0) | `~/Documents/POC/project-builder-sdk` |
| REQ-RXD-06.7 battery | **12 pass / 0 fail** | `/private/tmp/rxd-verify3` |
| REQ-RXD-06.9 | **5 pass / 0 fail** | `/private/tmp/rxd-verify3` |
| F-1 public-API reproduction | **5 pass / 0 fail** | `/private/tmp/rxd-verify3` (scratch, removed) |

**1829 = 1824 + 5** — exactly the claim to beat, exactly the 5 new 06.9 tests, nothing else moved.

**Environmental note**: zero environmental timeouts observed, consistent with iteration 2. The
`bun test` sequential / `tsc` first-touch-scan interaction (state.yaml carry-forward, engram #2277)
did not fire from `/private/tmp`. No timeout is reported here as a passing test, and none is
attributed to the change. Worktree removed after the run.

Iteration 2's nine resolved items are **spot-checked, not re-derived**: REQ-RXD-05's shape-aware
algorithm and the four bug scenarios are covered by the full suite above, green at 1829/0 with the
same test bodies iteration 2 independently reproduced. The delta touches neither. REQ-RXD-06.7's
battery passes (12/12).

---

## 5. Step 11b — Adversarial Quality Gate (GATING)

**Stage A — code audit (`pre-pr` mode, per `code-audit.md`), scoped to `01ecec7..9a1c23c`.**

| Group | Check | Result |
|---|---|---|
| G1 | 1.3 REQ-ID test coverage | ✅ REQ-RXD-06.9 cited by ID at `name-validation.test.ts:168` |
| G1 | 1.1/1.2 spec drift / coverage gap | ➖ n/a (`spec_source: internal` — the spec *is* the upstream) |
| G2 | 2.1 layer violations | ✅ no new imports or edges |
| G2 | 2.2 ADR contradictions | ✅ delta is consistent with ADR-02's chokepoint |
| G2 | 2.3 sensitive area uncovered | ✅ security area touched; REQ-RXD-06 covers it |
| G2 | 2.4/2.5 SSOT bypass / standards | ✅ none |
| G3 | 3.1 untyped casts | ✅ none (`(caught as Error)` matches the file's established 06.7 pattern; not `as any`) |
| G3 | 3.2/3.3 magic numbers / TODOs | ✅ none introduced |
| G3 | 3.4 dead duplicates | ➖ 06.9's block deliberately mirrors 06.7's — **V6 mandates it** ("matching REQ-RXD-06.7's shape"); parallelism, not copy-paste |
| G4 | 4.1 scope creep | ✅ both product files are in `design.md` §4.2 (rows 29, 34) |
| G4 | 4.3 migration risk | ➖ n/a |

**Findings: 0 gating.** No `Bug`, no `Architecture`, no `MAJOR`. One new `Nit` → **F-8** below.

**Stage B — `adversarial_review`: `required`** — triage is **L** AND the change touches a sensitive
area (security / code-execution HIGH, per the triage override). Both triggers fire independently.

---

## 6. Spec Compliance Matrix — delta scope

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-RXD-06 | **.9** `eval`/`arguments` rejected pre-mutation (NEW, V6) | `name-validation.test.ts:168` + my API-level reproduction | ✅ COMPLIANT |
| REQ-RXD-06 | .9 substring counter-check (`evaluate`/`myEval`/`argumentsList` accepted) | `name-validation.test.ts:183` | ✅ COMPLIANT |
| REQ-RXD-06 | .7 reserved-word battery (regression) | `name-validation.test.ts:136` | ✅ COMPLIANT (12/12) |
| REQ-RXD-06 | set is EXACTLY 48 — no drift, no over-blocking (V6) | mechanical diff §1.1 + parser sweep §2 | ✅ COMPLIANT |

Everything outside the delta: unchanged from iteration 2's comprehensive matrix, and green at 1829/0.

---

## 7. Findings

### CRITICAL (must fix before archive)
**None.**

### WARNING (should fix; does not block)

**F-1 — CLOSED.** Verified RESOLVED, both directions, validator + public API. See §1.

**F-2 — OPEN, non-gating.** Traceability, unchanged since iteration 2. Verified in the current tree:
`test/dialects/react/ops.test.ts:288` is still titled **`REQ-RXD-11.5`** but implements **11.6**; the
stale *"Deviation from the spec's own literal example"* comment still sits at `ops.test.ts:265`,
describing a conflict V5 eliminated. `REQ-RXD-06.8`, `11.6`, `15.1`, `15.2` still appear **nowhere**
by ID in `test/` or `docs/` (zero hits each). All four behaviours **are** tested and passing →
traceability, **not** `req-coverage-gap`. **Still non-gating.**

**F-3 — OPEN, non-gating.** Git archaeology only. `2079023`/`5749bf2` remain non-building commits
(the consumer landed before the producer). **HEAD `9a1c23c` typechecks clean — 0 errors, exit 0**
(verified this run). Affects `git bisect` and `apply-progress.md`'s item-9 commit map, not the
shipped artifact. **Still non-gating.** Squash-on-merge resolves it.

**F-4 — OPEN, non-gating, and now WIDER.** Verified in the current tree: `design.md:4` still reads
**`Revision: 2`**, and `docs/README.md` / `docs/quickstart.md` are still absent from §4.2's table.
**New this iteration**: `design.md:3` still reads **`Spec: V4 signed`** — the spec is now **V6**, so
the design's spec marker is **two versions stale**. Same staleness F-4 already names, widened by V5
and V6 landing without a design-header touch. No property is at risk (§4.2 correctly lists both files
the delta touched — which is why §5's scope-creep check passes). **Still non-gating**, but F-4's fix
should now also bump the spec marker V4 → V6.

**F-5 — OPEN, non-gating.** Verified: `design.md:138` still claims *"every react reject routes
through `src/core/reject-tail.ts`'s helpers, by construction"* — the extension-gate rejects
(`index.ts:70/75/80/84`) and `ast.ts:75` still throw fixed literals directly. No property at risk
(they interpolate nothing). **Still non-gating.**

### SUGGESTION (never blockers)

**F-6 — OPEN.** Spec V5's changelog description of *how* message/spec agreement was achieved remains
inaccurate. Outcome still correct.

**F-7 — OPEN.** Verified: ADR-02 `Status` is still **`Proposed`** (`design.md:180`) though fully
implemented and verified. Flip to `Accepted` at archive.

**F-8 — NEW (Nit, from Step 11b).** *The error message calls `eval`/`arguments` "reserved words" —
the exact claim V6 spends a paragraph refuting.* Observed:

```
addImport("eval", …)  ->  `name` "eval" is a reserved word and cannot be used as an import binding
```

V6 is emphatic that *"`eval` and `arguments` are **not** reserved words — they are
strict-mode-RESTRICTED BindingIdentifier names, a DIFFERENT grammar category"*. The shipped message
(and the constant name `IMPORT_RESERVED_WORDS`, and the test's own
`expect(message).toContain("reserved word")`) tell the author the opposite. **This is
spec-CONFORMANT** — scenario 06.9 explicitly requires the tail to name *"the reserved-word rule"* —
so it is neither a defect nor gating. But it is the mirror image of F-1's own root cause: a taxonomy
the spec now takes care to distinguish, flattened in the surface the author actually reads. The
cheapest honest fix is a message widening (e.g. *"is a reserved word or restricted in strict
mode"*) — which touches 06.9's assertion, so it needs a spec touch, not a drive-by edit.
**Register as a pending-change; do not fix under this verdict.**

---

## 8. Explicitly NOT re-opened

Out of scope per the briefing, and confirmed untouched by this delta: **DOC-3**
(`dialect-handle.ts:178`; `test/core/dialect-handle.test.ts:328` pins the wrong text — registered,
not a finding), **ARCH-2** (`jsx-name-validator.ts` placement — archive commitment, splits at dialect
#3), the **subprocess-timeout debt** (pre-existing, registered), and every ruling recorded CLOSED in
`council-findings.md`.

Per the briefing I did **not** re-attack the security surface that already failed exhaustively
(unicode/confusables, zero-width, surrogates, control chars, `addImport.from` injection, ReDoS,
prototype pollution). I attacked what CHANGED: the two Set entries, V6's completeness claim, and the
delta's TDD.

---

## 9. Followups for `sdd-archive` to register in `project/pending-changes`

1. **F-2** — relabel `ops.test.ts:288` → REQ-RXD-11.6; drop the stale "Deviation" comment
   (`ops.test.ts:265`); cite `06.8`/`15.1`/`15.2` by ID.
2. **F-3** — record `2079023`/`5749bf2` as non-building; correct `apply-progress.md`'s item-9 commit
   map. Consider squashing on merge.
3. **F-4** — add `docs/README.md` + `docs/quickstart.md` to `design.md` §4.2; bump `Revision` 2 → 3;
   **and** bump the header's `Spec: V4 signed` → `V6 signed` (widened this iteration).
4. **F-5** — reword ADR-02/§4.4 to the accurate universal, or route the extension gate's (permitted)
   path echo through a bounded helper.
5. **F-6** — correct spec V5's changelog description.
6. **F-7** — flip ADR-02 `Proposed` → `Accepted`.
7. **F-8** *(new)* — widen the `assertNotReservedWord` message (and reconsider the
   `IMPORT_RESERVED_WORDS` name) so `eval`/`arguments` are not mislabelled "reserved words";
   requires a matching touch to REQ-RXD-06.9's assertion.
8. Pre-existing carry-forwards: DOC-3; ARCH-2 peer-module split at dialect #3; TS-dialect
   trust-boundary JSDoc backfill; default/mixed-import support; `.jsx` row (**already registered —
   do not duplicate**); subprocess-timeout debt.

---

## A note on the verdict token — pushback

My briefing framed this run's purpose as converting `pass-with-followups` → `pass` **"because
archive requires `verify-report = pass`"**. I verified that premise before acting on it, and **it is
false**:

- `sdd-archive/SKILL.md:44` — *"must be verdict `pass` or `pass-with-followups`"*
- `sdd-archive/SKILL.md:86` — halts only on a verdict **not in** `{pass, pass-with-followups}`
- `sdd-archive/SKILL.md:9` — triggers on *"verdict: pass (or pass-with-followups)"*

**`pass-with-followups` does not block archive.** There was no gate to clear.

And the token is not cosmetic — it is **load-bearing in the opposite direction**.
`sdd-archive/SKILL.md:392-417`, Step 9, registers followups into `project/pending-changes` **only
if** the verdict was `pass-with-followups`, and **explicitly skips that step when the verdict is
`pass`** (line 417). Reporting `pass` with F-2..F-8 still open would therefore delete eight tracked
followups from the pipeline's memory — the precise outcome my own briefing told me to prevent
(*"Anything that should now be registered as a pending-change before archive rather than
vanishing?"*).

So the honest verdict is `pass-with-followups`: **F-1 is genuinely closed and the change is
archive-ready**, and the followups remain open and visible, none blocking. This costs the change
nothing. `pass` would have bought a nicer-looking token by discarding the record.

---

**One-line summary**: F-1 verified RESOLVED (48/48 exact, both directions, validator + public API);
V6's completeness claim attacked with ~194.7M parser probes and upheld; genuine RED→GREEN failing for
the right reason; suite 1829/0 from a clean worktree; Step 11b clean; eight non-blocking followups
remain — `pass-with-followups`, archive-ready.
