# Outcome Verdict — stage-5-first-dialect (Reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Triage**: L (sensitivity live) · **Verdict**: `delivered`
**Held against**: the ORIGINAL `problem_statement` (triage) + the North Star foresight memo — NOT the spec.
**Method**: BLIND (no verify/council/judge artefacts read). Journey SIMULATED and RUN live. Full suite executed.

## 1. Our objective was THIS

> Schematic authors are hurting: `modify` is a stub — no way to mutate an existing source file.
> Authors who need to add an import or export a function must eject to raw text, losing type-safety,
> chaining, and IR fidelity. There is also no predictable recipe for adding future AST libraries.
> Why now: Stages 1-4 merged; Stage 5 is the O1+O2 convergence proof, last blocker before Stage 6.

North Star promise: a TYPED, chained, IR-faithful mutation of a real file via
`ts.find(path).addImport(...)`, an in-SDK `.raw()` escape hatch (no ejection), all coalescing to
EXACTLY ONE `modify` of final bytes (AST never crosses the seam), plus a FOUNDED-not-proven-general
recipe (real generics + conformance kit + one real dialect).

## 2. Did we deliver it? WHERE — result → problem map (verified, not asserted)

| Problem element | Where it is resolved | Verified how | Verdict |
|---|---|---|---|
| "`modify` is a stub" | `src/dialects/typescript/**` + `src/core/dialect-handle.ts` — `find().addImport()` emits a real `modify` directive of final bytes | RAN it: seeded `src/index.ts`, `addImport("readFileSync","node:fs")` → committed tree gains `import { readFileSync } from "node:fs";` | DELIVERED |
| "must eject to raw text" | `.raw(ast => …)` universal hatch, live ts-morph AST, no re-parse/re-serialize, no SDK exit | RAN a chain `addImport().raw(…)` — both edits landed in one file | DELIVERED |
| "losing type-safety" | Typed `addImport(name, from)` + `withOps` intersection type; `test/types/define-dialect.test.ts` compile-pins composition | Full suite green incl. type tests | DELIVERED |
| "losing chaining" | Thenable handle, every verb returns the handle; `move/copy/rename/modify` re-owned in author order | RAN chained form; e2e Flow 1/2 green | DELIVERED |
| "losing IR fidelity" | Handle holds ONE live AST, memoized lazy print → exactly ONE `modify`; BOM/CRLF byte-exact (ast.ts owns the ts-morph@28 BOM-strip workaround) | RAN: emitted = 1 batch, 1 modify instruction. Golden fixtures + conformance byte-exact | DELIVERED |
| "no predictable recipe for future AST libraries" | Real `defineDialect`/`defineOpPack`/`withOps` generics + `@pbuilder/sdk/conformance` (`testDialect`/`testOpPack`) + 6 planted-violation red-proofs | `typescript-conformance.test.ts` 9/9 green; planted violations FAIL loudly as designed | FOUNDED (honest, marked founded-not-general) |

No delivered element serves no pain. The run-boundary join (`context.ts` `DialectRegistry`) is the
only element not tracing to an original pain; it prevents a DESIGN-INTRODUCED regression (async handle
→ forgotten-await → lost edit / `unhandledRejection`) — a guardrail for inherited async cost, not
gold-plating. Verified: forgotten-await chain still commits; unawaited throwing chain rejects contained,
zero `unhandledRejection`.

## 3. Simulated author journey (RUN, not imagined)

A JS-project author who has never seen this SDK, following `docs/authoring-a-dialect.md` +
`@pbuilder/sdk/testing`, literally typed:

```ts
const run = defineFactory<void>(async () => {
  await ts.find("src/index.ts").addImport("readFileSync", "node:fs");
});
const result = await runFactoryForTest(run, undefined, { "src/index.ts": "export const x = 1;\n" });
```

Observed (live run, scratch test, then deleted):
- `result.error` → `undefined`
- committed tree → `import { readFileSync } from "node:fs";\n\nexport const x = 1;\n`
- `result.emitted` → EXACTLY ONE batch, ONE `modify` instruction (coalescing proven at the author surface)
- chain `addImport(...).raw(ast => ast.addStatements(...))` → both edits present, one file
- forgotten `await` → still committed (the safety net the docs promise)

**What worked:** the exact stated pain ("add an import to an existing file, typed, chained, fidelity
intact") is resolved on the primary path, end-to-end, first try.
**Where I stumbled:** nowhere in the SDK behaviour. My own scratch assertion referenced `.directives`
where the wire field is `.instructions` — a test-authoring slip on my side, not a delivery defect; the
emitted batch was correct. Full delivered suite: **765 pass, 0 fail** (95 files).

## 4. Did we drift? (promise ↔ delivery, vs the North Star + the 4 affirmed CQs)

No drift from what the owner AFFIRMED at foresight. Each affirmed conscience question holds in delivery:

- **CQ-1 (addImport + `.raw` = DX proof)** — DELIVERED as affirmed: one typed op end-to-end + the
  universal hatch, both run. The pain's second named example ("export a function") lands via `.raw()`
  this change (no `addFunction`), exactly as disclosed — no silent over-claim.
- **CQ-2 (awaitable-chain friction acceptable v1)** — the handle IS the first thenable on an otherwise
  sync surface; friction is present and TAUGHT (`docs` "Async usage" section: await between same-path
  sequential edits for RYOW). Matches the affirmation.
- **CQ-3 (same-path concurrent UB acceptable v1)** — documented UB in ADR-0037 + docs, not guarded.
  Delivered exactly as affirmed (not silently widened, not silently closed).
- **CQ-4 (founded-not-general on the stage-5b commitment)** — generics + conformance kit + ONE real
  dialect exist; docs say "one structured op," `withOps` collision diagnostic / op breadth / conformance
  tail are DEFERRED and registered as committed-next. Honest "founded," never "proven-general."

**Framing honesty:** confirmed throughout — proposal, specs, triage owner ruling all state THIN scope
and name `stage-5b-dialect-breadth` as committed-next. No dishonest "modify is fully general" claim.

## 5. Outputs-without-outcome scan

None. The conformance kit serves the SECOND audience the problem names (dialect authors); its planted
violations (round-trip, single-op, coalescing, closure-smuggle, live-node-smuggle, read-split) are real
red-proofs that FAIL when faithlessness is planted — recipe credibility, not decoration. Fitness
extensions (FIT-19 orphan guard, FIT-20 unawaited-join guard, FIT-05 serializable-bytes) enforce the
problem's own non-negotiable invariants. SECURITY.md + the `.raw()` code-execution guard test ship.

## 6. Reckoning flags (tracked, NOT gaps — no halt)

1. **README front-door deferred.** The README (a new author's first entry point) still describes
   dialects only conceptually — it does not advertise that `modify` is now real via
   `@pbuilder/sdk/typescript`, nor carry a `find().addImport()` example. The subpath IS wired in
   `package.json` exports (technically discoverable/usable) and `docs/authoring-a-dialect.md` is
   accurate; triage explicitly deferred "exhaustive authoring doc (overlaps Stage 6.3)" and README/
   release polish to Stage 6. Scope-consistent, so NOT an outcome-gap — flagged for Stage 6 so the
   prose front-door actually lands and authors discover the capability without reading `docs/`.
2. **Recipe generality rests on a promise.** "Predictable recipe" is FOUNDED on ONE dialect; its
   generality depends on `stage-5b-dialect-breadth` actually landing (op breadth, collision diagnostic,
   conformance tail). Owner affirmed this posture at foresight (CQ-4). Reckoning restates the standing
   obligation: if 5b never lands, the recipe stays half-proven.

Neither flag is a delivered-outcome defect. Both are the North Star's own §6 "committed-next must land"
posture, carried forward — not new surprises.

## Verdict

**`delivered`.** The stated pain is resolved on its core path, verified by RUNNING it, not by trusting a
green suite: an author can today mutate an existing source file with type-safety, chaining, and IR
fidelity — `modify` is real, ejection is gone, edits coalesce to exactly one correct directive, and the
future-dialect recipe is founded and honestly marked. The four human-only questions escalated at
foresight were AFFIRMED by the owner there, and delivery matches those affirmations with no drift — so
they are not re-opened here (`conscience_questions` empty, per the reckoning contract's "empty if the
prior affirmations cover delivery"). The two reckoning flags are tracked Stage-6 / stage-5b obligations,
not blockers. Archive proceeds.
