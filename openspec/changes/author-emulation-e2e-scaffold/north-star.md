# North Star — Author-Emulation E2E, Scaffold Family

**Checkpoint**: foresight (post-design) · **Verdict**: ALIGNED (with escalated conscience questions) · **Change**: `author-emulation-e2e-scaffold` · **Triage**: L · **Date**: 2026-07-13

## Mission (one paragraph)

Before the engine comes back to life after stage-6, prove the SDK the way a real
schematic author would use it — a CRUD-shaped generator with templates, a binary asset,
chained naming tokens and typed options exercising the whole `scaffold`/`copyIn`/`create({templateFile})`
surface — and, in the same stroke, make the IR contract the future engine must honor
VISIBLE and STABLE where today it hides inside test asserts. The outcome we chase is not
"more green tests": it is a committed, self-describing, drift-guarded transcript corpus
that (a) trips loudly when an SDK change silently reshapes the emitted directives, (b)
hands a Go engineer opening it cold in six months a legible, normatively-labeled contract,
and (c) surfaces the SDK's own DX gaps NOW — on shared capture/report infrastructure that
the per-family e2e changes after this one reuse without rework — so the owner is not blind
at engine-integration time, the worst possible moment to discover a contract hole.

## How it fits (architecture)

Additive, test/docs/tooling only — zero `src/` edit, no public-API change, no new runtime
dependency. It adds a THIRD golden idiom (run-level `Batch[]` transcript capture) beside
the two existing ones (`test/golden-ir/` literals, `test/dialects/typescript/golden/`
byte-prints), physically separated at `test/e2e/author-emulation/corpus/` and ADR-justified
(ADR-0048) as a new *member* of the documented golden-idiom family rather than a competing
pattern. The capture wraps the SDK's own normative harness `runFactoryForTest` — the single
capture path (FIT-25) that future families reuse.

## Outcome we're chasing, traced to the three stated pains

| Stated pain (triage problem_statement) | Design deliverable(s) that attack it | Strength |
|---|---|---|
| Owner blind at engine-integration (gaps surface at the worst moment) | Committed corpus as regression tripwire (GCC-01/04/05) + NOT-EXERCISED ledger + `PC-SPEC-FSC-TOKENS` gap row + FRICTION section | Served — but see CQ-1/CQ-2 on how much this *actively* surfaces vs merely records |
| Author DX gaps invisible (nothing exercises the SDK like a real author) | CRUD-shaped author-emulation fixture (AEG-01..07) + FRICTION capture (AEG-06) | Weakest link — the DX-gap signal lives entirely in a self-reported manifest section that may legitimately read `none observed` (CQ-1) |
| IR contract invisible (lives only inside test asserts) | Committed transcript corpus = engine-handoff contract (GCC-01/09), self-labeling normative/informative records, 5-section README (GCC-11), canonical serialization binding the reader (ADR-0049) | Strongest — this is the center of gravity and it is well-served |

No deliverable serves *no* pain. The five fitness guards and the out-of-band regen
script are not output-without-outcome: they protect the corpus from becoming a lying or
self-healing artifact, which is a precondition for the contract-visibility outcome to be
trustworthy (see CQ-3 on right-sizing).

## The four foresight assertions

### 1. Result → Problem map
All three pains have concretely-mapped deliverables; the mapping is strongest for pain #3
(contract visibility) and pain #1 (gap-surfacing for the owner), and softest for pain #2
(author DX gaps). The ONLY concrete output for pain #2 is REQ-AEG-06's FRICTION section —
a subjective, presence-checked ledger. "Module wiring" and "tsconfig-AST", named in the
owner's realism vision (obs #936), are honestly declared out of reach (D2 gap: illustrative
text only, ADR/AEG-02) — a conscious deferral, not an oversight, but it means one dimension
of "author realism" the owner named is not exercised here.

### 2. User-journey simulation
- **(a) Owner re-runs the suite after an SDK change** — WORKS. Corpus byte-compare fails
  loud on directive-shape drift, naming the scenario. This is the regression tripwire the
  pain asked for. Bounded to the scaffold family by design; the README states the scope so
  it does not mislead.
- **(b) Future author reads the report + fixture as reference** — PARTIAL. The fixture is a
  strong reference, but it is a *matrix-exhausting* exerciser (deliberate collisions M-15,
  filters-eliminate-all M-13); a copy-paste reader could mistake edge-case exercisers for
  recommended patterns. And reports are gitignored (R1) — a cold reader who has not RUN the
  suite has only the JSON corpus + README, never a rendered report. The report-as-reference
  journey requires running, not just reading.
- **(c) Go engineer opens the corpus cold in six months** — STRONGEST. Self-labeling
  normative/informative records + 5-section README + canonical grammar give a legible
  contract. One legibility gap: the corpus records LOWERED wire ops (`create`/`copyIn`);
  a cold reader could miss that a `scaffold` verb ever existed (it has no wire op). The
  README's Normative-Status section should teach the scaffold→create/copyIn lowering
  explicitly, or the "contract visibility" outcome leaks at exactly the handoff moment.

### 3. Outputs-without-outcome detection
Three ways verify-final could pass while the outcome is hollow:
- **FRICTION = "none observed"** → pain #2 captured nothing, yet the presence check passes.
- **Green ≠ contract validated.** Everything runs against a FAKE (`runFactoryForTest` never
  renders). Green means "the SDK's emitted IR is captured and stable," NOT "the engine will
  honor it." Real round-trip validation is PC-PROTO-01, explicitly out of scope. Honest
  (seam disclaimer, v0/PROVISIONAL posture) but the owner must own that boundary consciously.
- **Build-gate sequencing.** 21 of 22 records are GATED on `schematic-local-files` merging;
  only the `s-00` skeleton is ungated. Infra-only green (skeleton + fitness guards) must NOT
  be accepted as delivered at reckoning — that would archive the scaffolding of the point
  while the point itself (the author-emulation scenarios) is still pending.

### 4. Promise ↔ delivery drift
The owner's program promise (obs #936): this change "builds the shared IR-report
infrastructure the rest reuse." The design HONORS it — the infra genuinely generalizes and
is NOT scaffold-shaped in disguise: capture is family-agnostic (records `Batch[]` generically;
ITC-05 zombie tripwire forbids cross-family branching), the record format is WIRE-DERIVED
(lowered `create`/`copyIn` in a family-neutral envelope), the report derives kind from the
frozen `dryRunPlan` mechanism (not a parallel map), and the corpus dir reserves per-family
matrix-id prefixes (R-C) for multi-family cohabitation. The one tension: full hardening (5
fitness functions, anti-tautology static import-graph scan, planted red-proof fixtures,
write-boundary partition, canonical-serialization ADR) is built NOW for a v0/PROVISIONAL
corpus whose only real consumer does not exist until PC-PROTO-01 — against the owner's own
"do not over-polish" instruction (ADR-0047). Amortizing hardening across N future families
is defensible; whether ALL of it must land in change #1 is a right-sizing call (CQ-3).

## Conscience questions for the owner (escalated — the gate holds until answered)

- **CQ-1 (significant?)** — Pain #2 (surfacing author DX gaps) has exactly one concrete
  output: the FRICTION section, which can legitimately read `none observed` when an AI
  authors the fixture in one clean pass. Is a self-reported, presence-checked friction
  ledger a *significant* answer to "author DX gaps are invisible" — or does surfacing DX
  gaps need a harder mechanism (e.g. a required minimum of authored-friction observations,
  or a human author pass) to actually move that needle?
- **CQ-2 (usable? / boundary ownership)** — Green here proves the SDK's *emitted* IR is
  stable, not that the future engine will *honor* it (fake, not engine; real validation is
  PC-PROTO-01, out of scope). Do you consciously accept that this change delivers
  "contract *visibility*," not "contract *validation*" — and that the corpus is v0/PROVISIONAL
  until the engine returns?
- **CQ-3 (shorter path to the same outcome?)** — Is the full infra-hardening set
  (FIT-25 + FIT-27 static import-graph scan + planted red fixtures + write-boundary
  partition) right-sized for change #1, or should some of it follow the SECOND family's real
  reuse, honoring the "do not over-polish a provisional corpus" instruction? What is the
  minimum hardening the shared spine needs to be trustworthy *now*?

## Reckoning hooks (for the pre-archive gate to hold this result against)

1. Do NOT accept infra-only (skeleton + fitness guards, scaffold scenarios still gated) as
   "delivered" — the 21 matrix scenarios are the outcome, not the scaffolding around it.
2. Confirm the FRICTION section is a real record, not a reflexive `none observed`.
3. Confirm the corpus README teaches the scaffold→create/copyIn lowering, so a cold reader
   sees the whole contract.
4. Confirm the owner's answers to CQ-1/CQ-2/CQ-3 were incorporated, not bypassed.
