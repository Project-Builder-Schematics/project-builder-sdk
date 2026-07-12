# North Star — stage-5b-dialect-breadth (Foresight memo)

**Checkpoint**: foresight (post-design, forward-looking) · **Triage**: L (sensitivity live: code-execution + third-party-trust + public-api)
**Design rev**: 2 · **Spec**: V2 signed (4 domains, 10 REQs added / 3 modified, 47 scenarios) · **Verdict**: `aligned`
**Steward**: purpose lifecycle — validates against the ORIGINAL problem + the stage-5 committed-next obligation, NOT the spec.
**Method**: BLIND (no orchestrator/council/verify conclusions read). Two author journeys simulated forward.

## 1. This is what we're going to do (outcome terms)

Stage 5 shipped a deliberately THIN TypeScript dialect: `.raw()` + exactly ONE structured op
(`addImport`). Every other real edit the pain statement names — export a function, remove an
import, add a class or variable — forces the author down `.raw()`, surrendering the type-safety,
chaining, and coalescing the dialect exists to provide. After this change, a schematic author will
be able to:

- `ts.find("a.ts").addFunction("greet", "(): void {}", { export: true })` — the pain's LITERAL
  second named example ("export a function"), now a TYPED, chained, coalesced op (no `.raw()`),
- `ts.find("a.ts").removeImport("x", "m")` — a destructive edit, dryRun-observable before commit,
- `addVariable` / `addClass` (± export) — the remaining named declaration edits, typed,
- all coalescing to EXACTLY ONE `modify` of final bytes (the AST-never-crosses-the-seam invariant
  preserved), with fail-loud rejection of author-incoherent operations instead of silent data loss.

And — the load-bearing half for the SECOND audience (dialect authors) — the recipe stops being
half-proven: `withOps` gains a real fail-closed collision + reserved-name diagnostic (RED against
real-`SourceFile` colliding packs, GREEN for disjoint), and the conformance kit grows its deferred
tail (six mandatory non-opt-out adversarial samples, a real-base structural probe that rejects a
stub `parse`, a documented leaf rule). `modify` breadth stops being "one op + eject-to-raw".

## 2. Here's how it fits (architecture)

No new topology — this EXTENDS the one bounded context stage-5 established (the ts-morph dialect
leaf + the ADR-0037 coalescing seam + the ADR-0012 conformance kit). Four seams are touched, all
`aligns`: five new ops reuse `addImport`'s `(ast, ...args) => void` rhythm in
`dialects/typescript/{ops,index}.ts`; `dialect-handle.ts` grows a shared contained-invoke
primitive (runOp/runRaw parity), a mutation-gated open-directive registration, the row-136 reject,
and a run-scoped fail-closed poison flag; `define-dialect.ts`'s `withOps` gains the eager
collision/reserved-name check that fulfills ADR-0010's OWN deferred promise; `conformance/index.ts`
grows the deferred tail. Two kit-internal `core/` modules join (`deep-equal.ts`, `dialect-error.ts`
— no public symbol, out of every barrel/subpath). Architecture impact: **additive** — the baseline
GAINS entries (five ops on the frozen `./typescript` subpath, two internal modules, a `RunContext`
field, conformance assertions, a sensitive-areas promotion); nothing documented becomes wrong. Four
ADRs (0039 + amendments to 0037/0010/0012), one under the 6-ADR XL tripwire.

## 3. Here's the outcome we're chasing (traced to the problem)

Two obligations converge. The CHANGE-level pain: "the dialect that exists to provide type-safety
forces authors down `.raw()` for every edit but one." The PROJECT-level pain (problem-statement.md):
"`modify` is where the SDK has its greatest impact (the per-file-type AST dialect libraries)" and
testability must hold "for two audiences — contributors AND schematic/dialect authors." This change
answers BOTH on their core path: the named declaration/import edits become typed ops, and the
future-dialect recipe becomes PROVEN-general (collision diagnostic + non-vacuous conformance) rather
than founded-on-one. It directly discharges the stage-5 reckoning flag #2 / affirmed CQ-4: **"if 5b
never lands, the recipe stays half-proven."** After this, it lands.

## 4. Result → problem map

| Design deliverable | Pain / obligation it serves | Verdict |
|---|---|---|
| `addFunction` (±export), NON-CUTTABLE (REQ-TSD-09) | pain's literal 2nd example "export a function" — typed, no `.raw()` | serves — load-bearing |
| `removeImport`, dryRun-visible (REQ-TSD-08) | named edit "remove an import" — explicit-target (safe), idempotent | serves — direct |
| `addVariable`/`addClass` ±export, cuttable (REQ-TSD-10/11) | named edits "add a class/variable" + op-authoring generality at low marginal cost | serves — generality demo, cut-lever armed |
| `withOps` collision + reserved-name diagnostic (REQ-DG-02) | discharges the deferral that kept the recipe half-proven — dialect-author audience | serves — recipe generality |
| Conformance tail: samples + leaf + real-base (REQ-DC-06/07/08) | ADR-0012 deferral; makes conformance non-vacuous — dialect-author audience | serves — 2nd named audience |
| `runOp` async containment (REQ-DG-06, row 137) | latent correctness defect: async op's rejection floats uncontained | serves — invariant guardrail |
| Row-136 modify-after-AST-op REJECT (REQ-MC-08) | silent-data-loss footgun BOTH stage-5 judges flagged | serves — correctness/safety |
| Fail-closed run + poison flag (REQ-DG-07) | a reject must fail the whole run closed, same OR different handle | serves — coherence |
| Debt riders: `deepEqual`, `isPending`, closure-clear, 139-sweep | pre-tagged "do alongside 5b" internal debt (no-REQ, isolated) | serves — maintainability, NOT gold-plating |

**Outputs-without-outcome scan**: none. The debt riders are pre-existing tagged debt bundled for
context-freshness, isolated as no-REQ internal refactors — not decoration. `addVariable`/`addClass`
go one step past the strictly-load-bearing minimum but the pain restatement names them and they
prove op-authoring generality dialect-locally at low cost, cut-lever armed if size balloons.

**Outcome-without-output scan**: ONE named edit in the change-level pain — `pruneUnusedImports` — is
DEFERRED (owner ruling #2). Rationale is strong and honest: without the language service (frozen out
by REQ-TSD-02.3), syntactic-only unused-detection has false-positive modes that silently DELETE live
author code (side-effect, type-only, re-export, JSX imports) — unanimous council risk finding; the
SDK's first silently-destructive op is not justified by modest convenience. `removeImport` (explicit
target, no inference) covers the safe case. Registered as a pending change. This is a RATIFIED
narrowing, not a silent gap — but the reckoning MUST NOT let anyone claim "every named edit is now
typed": prune still ejects to `.raw()`.

## 5. Journey findings (two audiences, simulated forward)

- **Schematic author — export a function typed.** `import * as ts from "@pbuilder/sdk/typescript"`
  → `ts.find("a.ts").addFunction("greet", "(): void {}", { export: true })`. Before: `.raw(sf =>
  sf.addStatements("export function greet…"))`. After: typed, chained, one coalesced `modify`,
  byte-exact golden. The pain's second named example is resolved on the primary path. **Wrinkle
  (disclosed, escalated §7):** the author must learn TWO asymmetries — `addFunction`'s `source`
  INCLUDES its `{…}` braces while `addClass`'s `source` EXCLUDES them; and add-ops REJECT on a
  same-name collision while `addImport` MERGES. Both are documented (JSDoc `@example` contrast is a
  verify-final obligation; ADR-0039 consequence) with real justifications, but they are learnable
  surface.

- **Dialect author — compose packs + run conformance.** Composes op-packs via `withOps`; a name
  collision or a reserved-verb shadow now throws a legible `op-pack composition failed: …` at
  COMPOSITION time (not an `any`-erased type evaporation). Runs `testDialect`/`testOpPack` from
  `@pbuilder/sdk/conformance`: six adversarial samples inject unconditionally (fixture carries no
  opt-out field, compile-enforced), a real-base probe rejects a stub/identity `parse`, the leaf rule
  is documented. Before 5b the tail was deferred and conformance could pass vacuously; after, the
  recipe is genuinely exercised. **The "half-proven recipe" gap closes.** Two points I escalate in §7
  because they are meaning judgments, not AI-decidable: the collision proof uses a FIXTURE pack (not
  shipped topology), and the leaf rule ships as a DOCUMENTED-limit (kit-enforced only for the SDK's
  own dialect; third-party authors self-run).

## 6. Drift findings (promise ↔ delivery, pre-build)

- **Framing is HONEST.** Proposal Intent, every delta-spec Purpose, and the triage/owner rulings all
  state the thin→broad transition explicitly and name what's deferred (prune, row-144, row-141
  halves) with re-tag destinations. No over-claim of "fully general modify."
- **The reckoning bar is structurally protected.** Owner ruling #3 pinned the discharge floor:
  named-pain typed (`addFunction`±export) AND generality proven (collision + conformance tail) are
  NON-cuttable; the cut lever may touch ONLY `addVariable`/`addClass` (isolated in
  `ops-declarations-cuttable.test.ts` + their goldens, allow-list edited same-slice). So even if the
  cut lever fires, the committed-next obligation is STILL discharged. The design honors this exactly.
- **DRIFT-WATCH 1 — collision proof is FIXTURE, not shipped.** Explore recommended approach 2 (≥2
  shipped packs → real collision topology). Owner overrode to ONE expanded pack + a deliberately
  colliding FIXTURE pair typed over real `SourceFile`, outside the kit. Sound argument (shipped packs
  are disjoint-by-convention per ADR-0010 and can never collide; a real collision can ONLY arise from
  third-party composition, which the real-`SourceFile` fixture faithfully models). The proof is real
  (real Ast, real `withOps` runtime path), just not from shipped packs. Escalated §7 CQ-A because
  "generality proven" is the reckoning bar's own clause and the owner overrode the explorer here.
- **DRIFT-WATCH 2 — leaf rule as DOCUMENTED-limit.** The kit DOCUMENTS the leaf contract; only the
  SDK's own dialect is runtime-enforced (FIT-01 transitive walk); third-party dialects self-run. No
  public static entry point (PM balloon-watch: the in-memory vehicle is not a static analyzer). This
  is the closest thing to an output-without-outcome smell — a documented rule vs an enforced one for
  the dialect-author audience. Honestly marked as a limit, not a silent gap. Escalated §7 CQ-B.

## 7. Conscience questions (ESCALATED — human-only; `aligned` does NOT pre-answer these)

1. **CQ-A — collision proof via fixture = "generality proven"?** Is the `withOps` collision
   diagnostic, proven against a deliberately-colliding FIXTURE pack (typed over real `SourceFile`,
   outside the kit) rather than shipped multi-pack topology, enough to call the recipe's generality
   PROVEN — the reckoning bar's own clause? *(Steward suspicion: yes — shipped packs are
   disjoint-by-convention and a real collision can only come from third-party composition, which the
   real-`SourceFile` fixture models faithfully; the runtime path exercised is production. But the
   owner overrode the explorer's shipped-topology recommendation, so the "is this proof enough" call
   is the owner's to affirm, not the AI's.)*

2. **CQ-B — leaf rule as documented-limit = "delivered" for dialect authors?** Is shipping the leaf
   rule as a DOCUMENTED limit — kit-enforced only for the SDK's own dialect, third-party authors
   self-run, no public static entry point — enough to call the conformance tail delivered for the
   dialect-author audience the problem statement names? *(Steward suspicion: it is an honest,
   scope-disciplined narrowing consistent with "not the vehicle's job," but whether a third-party
   dialect author is genuinely SERVED by documentation-without-kit-enforcement is a usability/
   significance judgment. This is the change's closest output-without-outcome smell — I flag it a
   suspicion, not a verdict.)*

3. **CQ-C — prune deferral acceptable? (owner ALREADY ruled #2 — restated for the reckoning to
   hold).** `pruneUnusedImports` — a named edit in the change-level pain — stays on `.raw()` after
   this change. Owner ruling #2 already deferred it on a unanimous council risk finding
   (syntactic-only detection silently deletes live code). *(Not reopened; carried forward so the
   reckoning holds delivery against "prune still ejects," and nobody claims every named edit is now
   typed.)*

4. **CQ-D — the two learnable asymmetries usable enough?** Are the `addFunction`-braces-included vs
   `addClass`-braces-excluded `source` asymmetry, and the add-op-REJECTS vs `addImport`-MERGES
   collision asymmetry, taught wrinkles or surprising footguns for the author? *(Steward suspicion:
   taught wrinkles — each has a real justification and documented `@example` — but "surprising vs
   learnable" is a meaning call. Minor.)*

## Verdict

**`aligned`.** Every AI-analyzable dimension aligns: each design deliverable maps to a real named
pain or a ratified stage-5 obligation (result→problem map clean); there is no gold-plating and no
outputs-without-outcome (debt riders are pre-tagged debt, `addVariable`/`addClass` are justified and
cut-lever-armed); the one named edit not served (`pruneUnusedImports`) is honestly deferred with a
strong, owner-ratified rationale and registered as pending; the framing is honest throughout; and
BOTH author journeys resolve on their core path. Executed perfectly, the design DISCHARGES the
stage-5 committed-next obligation — op breadth + collision diagnostic + conformance tail all present,
with the reckoning bar's non-cuttable floor structurally protected against the cut lever — so it
delivers the OUTCOME (a proven-general dialect recipe + the named edits typed), not merely correct
outputs. The four conscience questions are genuinely human-only (generality-proof-enough?
documented-limit-enough? prune-deferral-acceptable? asymmetries-usable?) and are ESCALATED for the
owner's call — `aligned` proceeds to slice but does NOT pre-answer them; the reckoning checkpoint
will hold the delivered result against this memo and these questions.

## Owner Affirmations (2026-07-12, foresight gate — the reckoning holds delivery against these)

- **CQ-A AFFIRMED**: the deliberately-colliding FIXTURE pack (typed over the real `SourceFile`) is sufficient proof of recipe generality — shipped packs are disjoint-by-convention (ADR-0010); a real collision only arises from third-party composition, which the fixture models.
- **CQ-B AFFIRMED**: leaf rule as a DOCUMENTED limit is honest delivery — a runtime pseudo-check in the in-memory vehicle would be theatre. Condition: the limit is stated EXPLICITLY in the recipe doc, never hidden. Runtime-observable rules (6 injected samples + real-base probe) are enforced.
- **CQ-C REAFFIRMED**: `pruneUnusedImports` deferral stands (ruling #2). The Intent's claim is scoped to structured NON-destructive edits — 3 of 4 named families typed. The reckoning measures against this honest bar.
- **CQ-D AFFIRMED**: the two taught asymmetries (source braces-in/braces-out; add-ops reject vs addImport merge) are teachable wrinkles, accepted WITH the mandatory mitigation — JSDoc cross-referenced @examples + recipe-doc distinction (halt-worthy at verify-final if absent).
