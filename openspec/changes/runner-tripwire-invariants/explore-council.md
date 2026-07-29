# Explore Council Record — `runner-tripwire-invariants` (L)

> Three blind lenses (opus), launched in parallel with `sdd-explore`, 2026-07-29. Condensed
> faithful record of each envelope — the full texts live in the session transcript; every
> load-bearing claim below was carried over verbatim or near-verbatim. Owner rulings issued
> at the explore→propose gate are appended at the end and are BINDING on propose/spec/design.

## Architect lens — position

The shape tail is not caused by AST checking; it is caused by **which branch is the default**.
`classifySpecifier` is total by construction (every specifier lands in exactly one branch,
unknown → violation); `denyScan` is the opposite shape (iterates identifiers, `continue`s the
unrecognised — default = pass, committed set = the forbidden one). Every Constraint-4 finding
in both judgment rounds is a consequence of that one asymmetry. The house pattern that fixes
the class already exists twice in-repo (`classifySpecifier` totality; the graph-baseline
ratchet) — this is a boring redesign, not a novel one.

**Mechanism**: replace the deny-scan with a **closure capability baseline** — per closure
file, the set of free identifiers + static member paths reached through them, committed and
diffed like the graph baseline; not-in-baseline = violation; any syntactic position that
*prevents computing* the set (computed access on a capability root, capability root used as a
value, aliased/re-exported builtin binding) = `unclassifiable-construct`, fail-closed.
Generalise R2-1's forfeit mechanic into the declared table. Disjointness: stop normalising
strings and stop parsing flags — `resolve()` both sides, test resolved-prefix containment,
try all candidate path readings per token (over-approximate; false positives are the safe
direction). Failure modes are a DIFFERENT property (single-exit fail-closed totality:
one boundary routing every throw through `failClosed`, write-temp-then-rename as the only
write path) — do not fold them into the capability work.

**Decidability test to apply to any guard**: which branch is the default, and which set is
committed? Committed = forbidden + default = ok → enumerable, tail guaranteed. Committed =
permitted + default = violation → decidable.

**Critical constraint**: the invariant must be decidable from SYNTAX alone — no ts-morph
type checker / module resolution in a fail-closed build gate (verdict must not be a function
of install state). Hand-rolled scope analysis biased so **ambiguity means free** (fail-closed
direction), with the semantic oracle as a CI-only differential check (cheap set ⊇ correct set).

**ADR candidates** (start at 0079; verify numbering with `eza openspec/decisions/` first —
repo carries pre-existing 0073/0074/0075 filename collisions):
- ADR-0079 capability baseline replaces deny-scan (supersedes ADR-0076 — mark it)
- ADR-0080 tripwire classifiers are total with fail-closed default (class rule)
- ADR-0081 path comparisons are resolution-based; verdicts spelling-invariant
- ADR-0082 build gate analyses syntax only; semantic oracle lives in CI
- ADR-0083 (foldable into 0080) one home for tripwire predicates: `scripts/`, `test/support/` as consumer — placement-not-timing (must NOT read as an ADR-0075 reversal)
- Failure-mode rows deliberately get NO ADR (no rejected alternative worth recording).

**Fitness functions**: FIT-CAP-TOTALITY (classified-node count == present-node count — kills
"unrecognised → continue" structurally; would have prevented every Constraint-4 finding in
both rounds); FIT-CAP-MUTANTS (combinatorial hostile-spelling generator, every mutant ≥1
violation); FIT-CAP-ORACLE (CI differential vs ts-morph symbol resolution); FIT-PATH-
SPELLING-INVARIANCE; FIT-FAILCLOSED-BICONDITIONAL (exit≠0 ⟺ no manifest, driven per
injected fault, scratch root); FIT-SINGLE-PREDICATE; FIT-NO-CHECKER-IN-BUILD;
FIT-BASELINE-NOT-SELF-HEALING; FIT-RULE-REACHABILITY; FIT-MANIFEST-BYTE-NEUTRAL (the
redesign changes no shipped byte — gates blast radius).

**Risks**: (HIGH) hand-rolled scope analysis has its own tail and fails in the wrong
direction — must bias ambiguity=free + pin with the oracle, or the capability model is not
better than today; (MED) baseline rubber-stamping — baseline must be tiny, drift renderer
must use the deny register voice, never the permissive graph-drift voice; (MED)
spec/mechanism coupling (04.2 enumerates primitives in requirement text); (MED) ADR-0075
reversal-by-accident; (MED) scope creep to XL — the capability redesign without
FIT-CAP-TOTALITY is NOT separable, that pair IS the change; (LOW) ts-morph as tripwire TCB —
record the trust assumption.

**Open questions**: 04.2 unfreeze (→ ruled, see below); one baseline artefact or two
(leans separate — opposite failure semantics demand opposite message registers); per-file vs
repo-wide baseline keying (leans per-file, consistency with existing per-file anchor
constants); debt-row split (which dissolve: R1-7, R1-16, R1-17, R2-5, node:vm fold; which
need explicit disposition: R1-9/10/12 test-quality, R1-11, R1-13, R1-18); byte-neutrality
must be a gate — if any case forces manifest/baseline byte changes it becomes cross-repo and
must surface before slicing.

## QA lens — position (probe-verified; everything marked CONFIRMED was reproduced on main)

A deny-set guard can only be *sampled* by tests; a passing suite *proves* the property only
if the invariant's **negation space is finite and enumerable**. Each invariant must publish
its **negation partition** (closed case list) + a machine-checked closure argument for
exhaustiveness (total classification over a closed union, or a baseline diff) — prose
exhaustiveness claims are what failed twice. Two independent oracles per invariant (AST +
runtime behavioural). Absence assertions require pre/post pairing + a sibling positive on the
same fixture. Diagnostics asserted WHOLE, never by substring (R2-3 shipped 4/5 false lines
under a green substring assertion). A committed **mutant catalogue** executed as a fitness
function (ts-morph in-memory mutation of the guard modules; each committed mutant must make
the FIT-42N block red; surviving mutant = named hole).

**CONFIRMED live escapes (probes, zero violations today)**:
- `globalThis["ev"+"al"]("1+1")` (M2.1)
- `(()=>{}).constructor("return 1")()` (M2.2 — not in any register; `Function` banned as text, this never spells it)
- `node:child_process` passes cleanly as ordinary builtin (M2.9 — spawning `node -e` is the
  arbitrary-code-execution bypass Constraint 4 names); siblings worker_threads, WebAssembly,
  module.register/registerHooks equally absent from every deny set
- Disjointness: `--outdir .//dist/transport`, `--outdir .`, `-odist/...` (not even extracted),
  `--outdir ../<pkg>/dist/...`, `--outdir=$VAR` (undecidable → must become explicit
  unclassifiable violation, not a pass) — all ESCAPE (M3.1-M3.5)
- R2-4 CONFIRMED: malformed package.json → exit 1, stale manifest survives byte-identical,
  raw SyntaxError diagnostic
- M1.16 contradiction: R1-16 says JSDoc identifiers ARE walked; `derive-runner-closure.ts:177`
  comment says structurally absent — one is false; settle by probe in BOTH directions before
  building on either.

**Mutant classes** (60+, six families INV-1..INV-6, incl. INVERSE/green classes — R2-5's
namespace form, `x instanceof Function`, shadowed local `createRequire`, segment-boundary
disjointness siblings). Notable: M1.12 re-export laundering (likely live escape of even the
NEW invariant — `createRequireBindingsIn` filters on module specifier and sees nothing);
M1.13 anchor drift (nothing asserts the anchor file is still a node of the derived closure —
an exemption pointing at an unwalked file is a dormant hole); M2.10/M6.2 meta-mutants (new
deny/rule member with no producing fixture).

**Red-fixture plan**: `test/fixtures/red/runner-tripwires/{deny-scan,green,bundler-scripts,
fail-closed,mutants}` — directory-enumerated (corpus discovered by readdir; declared
class-ID list committed; test asserts corpus ⇔ declared classes in both directions); expected
rule encoded in the filename, asserted as MULTISET (never `>0`); green corpus mandatory;
combination cells mandatory (decoy+alias, `./`+trailing, malformed JSON + pre-existing
manifest) — fixture-shape monoculture is a named lessons-ledger failure mode.

**Falsifiability rules** (halt-worthy at design review if violated): reachability (assert-X-
absent requires a sibling test showing X present); pre/post pairing; sibling flip; exact
counts never thresholds; AST nodes not substrings; whole-message diagnostics; rule identity
asserted (M1.11 currently caught by the WRONG rule — luck must be visible); anti-tautology
(unsatisfiable by an implementation that reads the committed baseline); justifying comments
must be independently true or not written; Strict-TDD RED evidence per-REQ (rule + count),
never aggregate.

**Test-derivation rows demanded in design**: TD-1..TD-20 (per-invariant mutant-class kill
lists, oracles, falsifiability devices — incl. TD-9's deterministic cross-product spelling
enumerator over the disjointness grammar: exhaustive over the grammar, no fast-check dep,
the grammar itself is the reviewable artefact; ground-truth oracle = Node's own
resolve/relative semantics).

**Risks**: the tail MOVES rather than closes if only the anchor is inverted while
DENIED_IDENTIFIERS stays a deny-set (two live escapes prove it); test-suite regrowth (insist
on directory-enumerated corpora); mutant-catalogue runtime (scope to guard modules × FIT-42N
block); green-corpus under-investment is the most likely way this change ships a NEW defect.

## Security lens — threat model + trust chain

Two assets: the 24 bytes (guarded by manifest + engine verify) and **the closure-sealing
lemma** — that "these 24 files" ≡ "everything that runs pre-factory" (guarded ONLY by the
tripwires; the engine's check derives all its meaning from it). Only boundary the tripwires
sit on: B1 repo → published artefact. No external attacker (commit required); adversary
population: maintainers, compromised credential, unread PR, **AI agents with write access
(this repo's normal operating mode — idiomatic-looking code at volume is precisely what a
shape scanner passes)**, build compromise. Strict priority ordering: (1) soundness (no false
negative — externally load-bearing via the lemma), (2) decidability (the ability to KNOW
soundness holds), (3) diagnostic honesty (internal, with one real second-order: scanners that
lie get routed around, and every route-around is an exemption — both prior CRITICALs lived
inside exemptions).

**Debt re-ranking**: Tier 1 live false negatives — R1-7 computed member access (HIGHEST — the
bracket form is the first thing anyone writes against an identifier ban; only currently-open
demonstrated evasion of a stated invariant); R1-14 entry file exempt from symlink containment
(medium); R1-15 `node:nonexistent` → builtin (low-med; REQ-RCD-03's "zero silent skips" is
false as written). Tier 2 — R2-4+R1-5+R1-6 as ONE property (fail-closed totality; fixing
R2-4 alone leaves the invariant untrue). Tier 3 honesty (R2-5 high second-order —
resolution pressure is "widen the exemption", the exact place both CRITICALs lived; fix via
redesign, never via exemption branch; R1-17 sequencing hazard — its register-proposed fix
reopens `const F = Function; F("…")`, must land WITH callee-decidability, never before).
Tier 4 — R2-6 ranked LOWER than the register implies (leg 3 of 3; legs 1+2 catch the
consequence; and all three legs live in fit-42 which does not run on the publish path).

**Load-bearing invariants (must be decidable AND fail-closed)**: P1 callee decidability
(every call whose callee is not a statically-resolvable binding = violation — generalises
4b4914a, subsumes R1-7 + namespace + alias + indirect + unimagined siblings in one property;
PRECONDITION that must itself be proven: no closure file reassigns a module-scope binding —
else P1 is decidable-if-you-squint and a permissive P1 is a WORSE false negative than today);
P2 classification totality; P3 containment totality incl. the entry (R1-14); P4 generation
atomicity + fail-closed totality as ONE invariant; P5 exemptions are proof obligations,
never searched-for occurrences (last remaining: the dynamic-import sanction is positional —
fold it: the sanctioned site carries the marker, exactly one marker, or forfeit).

**Trust-chain findings (NEW, neither in any register)**:
- **W1 — publish.yml stamps the version AFTER the manifest is generated**: build hashes
  package.json@0.2.0, `npm version 0.0.0-dev.<sha>` rewrites it, publish packs the rewritten
  one → the shipped package.json CANNOT match its own sha256 in the manifest; packageVersion
  records the pre-stamp value. Masked today by `--dry-run`. [Owner ruling: engine DOES verify
  the digest → first live publish fails 100% of installs. Ordering fix mandatory.]
- **W2 — the publish path runs zero tests**: publish.yml = install → build → stamp → publish;
  Constraint 1's three legs + every fit-42 assertion never run against the published
  artefact. [Orchestrator verified 2026-07-29: main has NO branch protection → W2 is live
  today. "Adding bun test to publish.yml is the highest security value per line in this
  entire change."]
- W3 tripwire TCB = ts-morph@28.0.0 + build env (controlled: exact pin, frozen lockfile) —
  named to bound investment; W4 a manifest is an inclusion list, cannot express absence —
  Constraints 2/3 are the only things converting "24 listed" into "24 executed".

**Redesign risks**: allowlist entries must be fully-qualified single bindings (never
prefixes/wildcards), pinned by exact count; exemption widening under false-positive pressure
(rule for the ADR: exemptions are proof obligations on the file, never predicates on an
occurrence); marker-comment sanctions are forgeable by the same population — net-neutral on
adversary capability, strictly better on decidability — say it in the ADR; P1 implemented
permissively is worse than today; R1-17 must not land before P1; scope creep into src/
changes architecture_impact and touches the code-execution sensitive row — surface as a
design decision; every test deletion must name the SURVIVING test that proves the property.

## Explore (main artefact: `explore.md`) — summary

ready_for_proposal: yes. Recommended Approach 1: per-guard structural inversion extending
`4b4914a`'s positional-shape technique (conservative); R2-3/R2-4/R2-6 as independent
already-decidable bugfixes alongside. 5 architecture touchpoints, all `aligns`, no baseline
refresh needed (2026-07-29 refresh covers the cluster). NOTE for propose: this
recommendation is NARROWER than the architect lens's capability baseline; QA's live escapes
(M2.1/M2.2 pass today) are direct evidence the conservative form leaves CST-04.2's tail
open. The synthesis of these two approaches is propose's central job. Also flagged: the
architecture-baseline-refresh debt row is already discharged (retire at archive); ADR
numbering starts 0079; R1-16 "already closed" is a hypothesis needing a red-proof; 18
existing red-proofs must survive byte-for-byte.

## Owner rulings at the explore→propose gate (2026-07-29 — BINDING)

1. **UNFREEZE REQ-CST-04.2 + REQ-CST-04.3** — primitives become scenario-level examples;
   requirement text demands the property; 04.3's non-vacuity guard re-derived under the new
   mechanism. REQ-CST-04.1 survives unmodified. Re-signature at spec phase.
2. **W1 + W2 both IN-SCOPE** — stamp-ordering fix + test gate in publish.yml. The "0.1.0
   publish sequence" out-of-scope boundary refers to go-live, not current-pipeline integrity.
3. **P4 as ONE REQ** (fail-closed atomicity absorbing R1-5 + R1-6 with R2-4). **M2.9
   missing primitives IN** (node:child_process, node:worker_threads, WebAssembly,
   module.register/registerHooks). **M3.6 script-chaining OUT** — register as
   pending-changes debt with explicit reason (silence is the register's own failure mode).
4. **The engine verifies the manifest's package.json digest** (owner first-hand) — W1
   severity confirmed: first live publish fails 100% of installs; the ordering fix is a
   mandatory pre-go-live gate.

## Owner rulings at the propose gate (2026-07-29, second batch — BINDING)

5. **W1 REFORMULATED — emergency framing WITHDRAWN** (premise refuted by both propose lenses
   independently + orchestrator verification: `prepublishOnly: "bun run build"` regenerates
   the manifest after the stamp at real publish; npm 11.12.1 gates prepublishOnly on
   `!ignoreScripts`, not dryRun; signed REQ-BPI-03.1 records exactly this; fit-23 18/18).
   New deliverable shape: the publish-integrity property is proven BEHAVIOURALLY (real
   publish sequence against a scratch target, packed digests vs packed bytes) and must not
   depend on an implicit npm lifecycle behaviour publish.yml never declares (explicit rebuild
   step, XS) + **R1-13 pulled IN-SCOPE** (publishRunSteps assumes YAML order == execution
   order — the ordering guard's real weakness). The engine-verifies-digest fact (ruling 4)
   stays recorded as future-severity context, not as a live emergency.
6. **W2 ships WITH the react-conformance timeout fix** — the publish test gate and the
   explicit per-file timeout land in the same slice; a knowingly-flaky gate is a gate that
   gets routed around.
7. **Spec-honesty bundle IN**: R1-15 (fix `node:` validation vs builtinModules — signed
   RCD-03 "zero silent skips" must become true, not amended away), RMD-05.1 + RMD-01.2
   wording deviations (this IS the spec touch their trigger names), R1-8 (directory-specifier
   misdiagnosis — C7 cannot ship with a known-false instance). **R1-14 NOT pulled in** —
   RE-REGISTERED as a fresh dated row carrying the security lens's Tier-1 ranking alongside
   explore's dismissal (silence is not a disposition).
8. **Budget ratified as HARD GATES**: ≤4 new fitness functions, ≤3 new/amended ADRs, ≤20
   committed mutants, **zero new committed artefacts** that require updates on ordinary
   non-capability closure edits — the capability-model PROPERTY is adopted, the baseline
   ARTEFACT is declined (kills the rubber-stamping risk and both baseline design questions).
   Directory-enumerated fixture corpus replaces the ts-morph mutation harness. Exceeding any
   gate is re-triage evidence, never a silent pass.
