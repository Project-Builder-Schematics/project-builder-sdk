# North Star — stage-5-first-dialect (Foresight memo)

**Checkpoint**: foresight (post-design, forward-looking) · **Triage**: L (owner-ruled thin scope; sensitivity live)
**Design rev**: 2 · **Spec**: V3 signed (7 domains, 34 REQs) · **Verdict**: `aligned`
**Steward**: purpose lifecycle — validates against the ORIGINAL problem, not the spec.

## 1. This is what we're going to do (outcome terms)

A schematic author who today must EJECT to raw text to touch an existing source file — losing
type-safety, chaining, and IR fidelity — will, after this change, be able to:

- `import * as ts from "@pbuilder/sdk/typescript"` (dialect selection by import — O2),
- `ts.find("a.ts").addImport("readFileSync", "node:fs")` — a TYPED, structured mutation of a real
  file (the literal first example in the pain statement), and
- `.raw(ast => …)` — an in-SDK escape hatch handing the same live ts-morph AST for anything the thin
  op-pack does not cover, WITHOUT re-parsing or re-serializing, WITHOUT leaving the SDK, and WITHOUT
  breaking IR fidelity,
- chained with `move`/`copy`, dry-run-observable, all coalescing to EXACTLY ONE `modify` directive of
  final bytes (the AST never crosses the seam — invariant preserved).

Underneath: the real `defineDialect`/`defineOpPack`/`withOps` generics (the contract every FUTURE
dialect composes against) and a conformance CORE kit that a dialect author runs to prove a new dialect
is faithful. `modify` stops being a stub.

## 2. Here's how it fits (architecture)

No new topology. Three collaborating layers on the existing `core/` kit: real generics + a kit-internal
coalescing **handle factory** (`dialect-handle.ts`); the first dialect at `src/dialects/typescript/**`
(ts-morph parse/print + `addImport` + `.raw`) composing ONLY the sanctioned kit surface; real
conformance-core bodies. `Session`/`DirectiveFactory`/`EngineClient` stay untouched (KIT-02/ADR-0008
literal). `RunContext` gains ONE additive field (a dialect-handle registry) drained at run end. Two
`deviates` touchpoints move the baseline (impact = **modifying**): `exports` grows 3→4 (`./typescript`,
ADR-0014 amendment) and the FIRST-EVER runtime dependency lands (ts-morph, exact-pinned, ADR-0033).
The async, thenable handle is the first non-sync object on the author surface — a new pattern the
baseline does not yet describe.

## 3. Here's the outcome we're chasing (traced to the problem)

The canonical problem's two objectives CONVERGE in one working dialect: O1 (turn author intent into
correct wire directives for `modify`) and O2 (import-and-use DX for a dialect library). The change-level
pain — "`modify` is a stub; authors must eject to raw text; no predictable recipe for future AST
libraries" — is answered on its core path: a real typed mutation exists, ejection is no longer required,
and the recipe (generics + conformance kit) is FOUNDED. This is the last blocker before release shape
(Stage 6).

## 4. Result → problem map

| Design element | Author pain it serves | Verdict |
|---|---|---|
| Real generics (`defineDialect`/`defineOpPack`/`withOps`) | "no predictable recipe for adding future AST libraries" — this IS the recipe/contract | serves — founds the recipe |
| `.raw()` escape hatch | "must eject to raw text, losing type-safety, chaining, fidelity" — in-SDK live-AST escape, coalesced, seam-safe | serves — removes ejection |
| `addImport` structured op | the literal example in the pain ("add an import") | serves — direct, load-bearing |
| Handle-owned coalescer (N edits → 1 `modify`) | O1 IR fidelity + "AST never crosses the seam" invariant + preserved chaining | serves — O1 correctness |
| Toy/planted-violation dialects (conformance red-proofs) | proves the conformance kit actually catches faithlessness → the recipe is trustworthy | serves — recipe credibility |
| Thin op-pack (`.raw` + `addImport`) | the load-bearing minimum per owner ruling | serves — scope-disciplined |
| Conformance CORE kit | "predictable recipe" + testability quality attribute (dialect-author audience) | serves — second named audience |
| Wired `./typescript` subpath | O2 "dialect selection by import (`@pbuilder/sdk/<dialect>`)" | serves — direct O2 |
| Interim plain-Error taxonomy | author needs a comprehensible, leak-free error, not a ts-morph stack | serves — reduced-fidelity interim, tracked |
| **Run-boundary join** (RunContext registry drain) | prevents a DESIGN-INTRODUCED regression (async handle → forgotten-await → silently lost edit / unhandledRejection) | serves indirectly — guardrail for the inherited-async cost, NOT gold-plating |

No element serves NO pain. The run-boundary join is the only element not mapped to an original pain; it
mitigates a regression the async surface would otherwise introduce, and the async surface itself is
inherited from the pre-existing flush-before-read/RYOW read path (ADR-0015), not newly invented here.

## 5. Journey findings

- **Core relief delivered.** find → addImport → .raw → chain with move/copy → dryRun → await → error
  containment → forgotten-await-still-commits. The exact pain ("add an import to an existing file,
  typed, chained, fidelity intact") is resolved on the primary path.
- **Design-introduced friction (honestly disclosed).** The handle is the FIRST thenable on an
  otherwise all-sync author surface. `await find(p).addImport(x)` is a departure from the sync commons
  verbs. The join makes `await` OPTIONAL for correctness (completion-before-commit is guaranteed), so
  the happy path survives a forgotten await — but the author must still learn "await between
  SAME-PATH sequential edits for RYOW ordering." Taught explicitly (REQ-DAS-01.3 Async-usage section).
  This is a real DX cost weighed against the "simplified" north star — escalated below, not silently
  accepted.
- **Sharp edge (documented UB).** Two UNAWAITED chains on the SAME path = last-write-wins clobber,
  RYOW violated, declared UNDEFINED BEHAVIOUR (documented, not prevented). Narrow, guidance is clear
  (await between same-path handles), common path is safe — but it is a documented-UB posture in a
  correctness-sensitive tool. Escalated below.

## 6. Drift findings (promise ↔ delivery)

- **Framing is HONEST throughout.** Proposal Intent, every spec Purpose, and the triage owner ruling
  all state THIN scope explicitly and name the deferral (`stage-5b-dialect-breadth`) as committed-next.
  Nobody claims full `modify` breadth. No over-claim.
- **"Predictable recipe" is FOUNDED, not PROVEN-GENERAL — and the artefacts say so.** The generics +
  conformance kit exist, and ONE real dialect proves the contract compiles and round-trips. But: only
  one dialect is built against it; the `withOps` collision diagnostic, adversarial samples, leaf rule,
  and real-base-dialect rule are DEFERRED (REQ-DG-02.2, ADR-0012 amendment). The recipe's GENERALITY
  is honestly marked founded-not-complete — no dishonest "proven" claim. **Reckoning flag**: the
  committed-next `stage-5b-dialect-breadth` MUST actually land, or the recipe stays half-proven.
- **Two named pain examples, one typed op.** The pain statement names TWO concrete cases: "add an
  import OR export a function." This change ships a TYPED op for the first (`addImport`) and forces the
  second ("export a function") down the `.raw()` escape hatch (no `addFunction` — deferred to breadth).
  Honest (tracked), but it means the DX proof rests on ONE typed op + the universal hatch. Escalated
  below.
- **Objectives-plan 5.6 partially narrowed.** The plan's Stage 5 §5.6 "exists when" lists leaf rule +
  adversarial samples + real-base-dialect rule as part of the conformance kit; the owner ruling defers
  those. "Stage 5 done" ≠ "plan §5.6 fully satisfied" — owner-ratified narrowing, tracked, not silent.

## 7. Outputs-without-outcome scan

None found. Fitness extensions (FIT-01 transitive, FIT-03/04/05/06) are CI enforcement of the
problem's own non-negotiable invariants (seam serializability, leaf isolation, public-surface gates),
not decoration. The conformance kit serves the SECOND audience the problem statement explicitly names
(dialect authors). The interim plain-Error delivers author-visible value. ADRs are expected planning
artefacts.

## 8. Conscience questions (ESCALATED — human-only; `aligned` does NOT pre-answer these)

1. **Usable enough?** Is ONE typed structured op (`addImport`) + the universal `.raw()` hatch enough
   to call the DX proof DELIVERED — given the pain statement's own second example ("export a function")
   lands only via `.raw()` this change? (Steward suspicion: yes for a FOUNDING proof — one typed op end
   to end plus a faithful hatch genuinely demonstrates the convergence — but "the DX is proven" for the
   author is a meaning judgment the owner must make, not the AI.)
2. **Significant friction?** Is the await-based, thenable chain SIGNIFICANT friction against the
   "inspired by Angular Schematics, then simplified" north star — the first and only async surface amid
   sync commons verbs? (Steward suspicion: the join softens it to a taught wrinkle rather than a
   correctness trap, but "simplified" is the owner's bar to hold.)
3. **Documented-UB posture.** Is same-path concurrent-handle UNDEFINED BEHAVIOUR (documented, not
   guarded) an acceptable v1 posture for a correctness-sensitive codegen tool, or must it be guarded
   before ship? (Borders on design, but it is really a "is this safe/usable enough" meaning call.)
4. **Committed-next enforceability.** The "predictable recipe" claim's generality depends on
   `stage-5b-dialect-breadth` (op breadth, collision diagnostic, conformance tail) actually happening.
   Is the owner content to ship Stage 5 with the recipe FOUNDED-not-general, on the strength of a
   committed-next promise?

## Verdict

**`aligned`.** Every AI-analyzable dimension aligns: each design element maps to a real pain, there is
no gold-plating, no outputs-without-outcome, and the framing is honest (thin scope, deferrals tracked,
no over-claim of "proven"). Executed perfectly, the design RESOLVES the core pain (typed real `modify`,
no ejection, coalesced correct IR, recipe founded) — genuine outcome, not merely correct outputs. The
four conscience questions are genuinely human-only (usable? significant? safe-enough? founded-enough?)
and are ESCALATED for the owner's call — `aligned` proceeds to slice, but it does NOT pre-answer them;
the reckoning checkpoint will hold the delivered result against this memo and those questions.
