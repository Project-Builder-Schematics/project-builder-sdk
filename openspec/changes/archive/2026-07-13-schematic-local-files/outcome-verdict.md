# Outcome Verdict — schematic-local-files (Reckoning)

**Checkpoint**: reckoning (pre-archive, backward-looking) · **Verdict**: `DELIVERED` · **Change**: `schematic-local-files` · **Triage**: L · **Evaluated**: 2026-07-13

> Held against the ORIGINAL `problem_statement` (triage) and the foresight `north-star.md` promise — NOT the spec. Verification (tests 1055/0, tsc clean, judgment-day APPROVED) is assumed; this gate asks whether the delivered work SOLVES the stated problem, is usable, and matters — or is just code that passes tests.

## 1. Our objective was THIS

Triage problem_statement: *"Schematic authors cannot reference schematic-package-local template files nor copy package-local assets. Real schematics ship folders of `.template` files plus assets (svg, css, images). Today's workaround is manual `readFileSync` + `create` — text-only, manual path resolution; binary assets cannot travel the text wire at all (ADR-0019). Why now: stage-6 / L1 readiness requires real-world schematics to be authorable."*

Scope contract: SDK side + seam CONTRACT only; **engine-side apply implementation explicitly OUT of scope** (cross-repo, PC-PROTO-01-gated).

## 2. Did we deliver it? Show me WHERE — Result → Problem map

| Stated pain | Delivered? | WHERE in the result |
|---|---|---|
| No supported way to reference package-local template files | **YES** (expression + local test) | `scaffold` + `create({ templateFile })` — `src/commons/index.ts:186-260`; `readTemplateFile` reads at emit time → existing `create` IR (zero wire change) |
| No supported way to copy package-local assets | **YES** (expression + faithful simulation) | `copyIn` verb — `src/commons/index.ts:286`; new `copyIn` by-reference wire op (ADR-0043) |
| Binary assets cannot travel the text wire | **YES** (expression — the decisive net-new capability) | `copyIn` by-reference = path reference, never bytes; classifier routes binary/oversized → by-reference (`src/scaffold/classify-transport.ts`) |
| Manual `readFileSync` + hand-rolled path resolution | **YES** | ambient `packageDir` resolution + `collection.json` containment ceiling (`src/core/context.ts:132-306`) |
| **Real bytes land on the author's disk (any verb)** | **NO — engine-gated, honestly out of scope** | PC-PROTO-01 real-wire (text, whole SDK) + an unscheduled engine copy-apply pass (binary); the three seam obligations BRC-02/BRC-08/PRC-06 are registered in `pending-changes.md`, owner=engine repo |

**The load-bearing honesty holds**: no bytes land on real disk for any verb when this archives — real-wire is PC-PROTO-01-gated for the WHOLE SDK, exactly as every prior stage (1-5) shipped and passed its steward gate. The by-reference (binary) half carries ONE extra gate beyond PC-PROTO-01: a dedicated engine copy-apply pass. This is architecture, not defect — the SDK is an authoring-surface + directive-emitter verified against a normative fake.

## 3. Author-journey simulation (the nestjs `crud-graphql-mongo/files` author)

1. `defineFactory({ packageDir: import.meta.dir })` → requires a `collection.json` ancestor (ADR-0046). A REAL schematic collection HAS one by definition (it IS the collection manifest, README §Anatomy) → passes. ✓
2. `scaffold({ from: "files", to, options })` → walks, classifies each file (never author-declared), applies rename→token→`.template`-strip; text→`create` render, binary/oversized→`copyIn` by-reference. ✓ Reachable, coherent.
3. `copyIn("assets/logo.svg", "src/generated/logo.svg")` → always by-reference, verbatim, never classified. ✓
4. `create("x.ts", { templateFile: "x.ts.template", options })` → read at emit time, render request; binary/oversized fails loud `invalid-input`, never a silent copy. ✓
5. `runFactoryForTest(...)` via `./testing` → directives, collisions, containment rejections, typed `AuthoringError`s. ✓ Real, faithful local feedback.
6. `dryRun()` → per-entry `kind: "rendered" | "copied"`. ✓ The honesty mechanism — SHIPPED (`src/commons/index.ts:368-399`, `DryRunEntry.kind`).
7. Run FOR REAL against the engine → **WALL** (expected, honestly surfaced): no bytes land — PC-PROTO-01-gated (whole SDK); binary carries the extra unscheduled engine copy-apply gate.

**No wall in the authoring / local-testing journey.** The only wall is the cross-repo engine boundary, which the delivery makes visible rather than hides.

## 4. Outputs-without-outcome detection

**SDK layer (the only in-scope layer): NOT outputs-without-outcome.** Before this change a binary asset had no verb, no wire shape, no containment story — it was inexpressible. After, an author can author, harness-test, and dry-run a real schematic including binary assets. The expression layer IS the SDK product; this is a genuine, usable increment on its own contract (does it correctly emit + contain + classify? — yes, 46/48 REQs behaviorally tested, 2 correctly engine-deferred).

**Labeled residual risk (not a verdict):** the by-reference (binary) half's DELIVERY-layer outcome depends on an engine copy-apply pass no plan yet schedules. IF that pass never lands, the binary half crystallizes as outputs-without-outcome. This is the north-star CQ1 suspicion carried forward. The owner AFFIRMED at foresight (affirmation 3) the engine copy-apply pass is COMMITTED-NEXT post-integration (stage-4→4b pattern), tied to PC-PROTO-01. Commitment exists; reckoning carries it as the standing condition, does not re-litigate it.

## 5. Promise ↔ delivery drift — NONE

North-star "available when archives = YES" rungs, every one verified delivered:

| North-star promise (foresight) | Delivered? | Evidence |
|---|---|---|
| Typed EXPRESS surface for scaffold/copyIn/templateFile | ✅ | exported, type-checked, FIT-14 pkg-surface green |
| Local feedback (harness, collisions, containment, AuthoringErrors) | ✅ | fake + conformance, 1055/0 suite |
| dryRun per-entry by-value/by-reference tag | ✅ | `kind: "rendered" \| "copied"` shipped |
| Binary assets expressible at all | ✅ | as emission + simulation |
| Real files on disk | ✅ NOT promised (engine-gated) | honestly deferred, never claimed |

**CQ2 affirmation demanded reckoning FAIL the change if any mitigation remained spec-only. All four are SHIPPED, not spec-only:**

- **BRC-04 evidence-boundary fitness** → SHIPPED: `test/scaffold/evidence-boundary.test.ts` — a real production-wide per-`it()`-block scan proving NO test asserts by-reference bytes in `result.tree`/`committedTree()`/`stagingTree()`, with red-proof fixture + negative controls + block-scoping proof. Substantive, not a stub.
- **dryRun `rendered|copied` tags** → SHIPPED (above).
- **Three archive-gated seam rows (BRC-02/BRC-08/PRC-06)** → SHIPPED in `pending-changes.md` §"From schematic-local-files", owner=engine repo, cross-repo flag with PC-PROTO-01, wording matches design §Seam Contract verbatim (verify-in-loop-7 confirmed).
- **Residual risk documented in copyIn README/JSDoc** → SHIPPED: `copyIn` JSDoc states "a by-reference destination's bytes exist only after the ENGINE applies the directive (the fake never materializes them)"; README §"Scaffolding a folder" + "The SDK never touches the disk… the engine owns execution."

**ADR-0046 friction (foresight flag): mitigated, not a gap.** The `collection.json`-ceiling requirement fires eagerly for ANY `defineFactory({ packageDir })` run (`src/core/context.ts:306`), including non-scaffold authors who pass `packageDir` only for schema validation. BUT: (a) a real schematic collection HAS a `collection.json` by definition, so the motivating author is unaffected; (b) the failure is fail-loud with a clear, package-relative message ("no collection.json found at or above <dir> — cannot resolve the containment root"); (c) owner-ratified (ruling 10, ADR-0046, no fallback); (d) the ~13 synthetic test run-sites were retrofitted in-change (suite green). Real-schematic authors do not hit a surprise; synthetic setups fail coherently. Within contract.

## Verdict: DELIVERED

The SDK half genuinely delivers its scoped outcome — an author moves from "no supported way, binaries impossible" to "typed, contained, locally-testable expression of folder + asset scaffolding, binaries included." The engine dependency is HONESTLY carried, not hidden: dryRun `kind` tags + the BRC-04 evidence-boundary scan test + README/JSDoc residual-risk prose + three archive-gated seam rows + the owner's committed-next affirmation. No promise↔delivery drift. No smuggled scope. The delivery-layer gap is real, named, and out of scope by owner ratification — green fake/conformance is NOT read as "the engine copies files."

## Conscience questions for the human (reckoning gate — confirm before archive)

The north-star's three CQs were AFFIRMED by the owner at foresight (2026-07-12) CONDITIONAL on SDK deliverables shipping. I have verified those conditions are met. Two confirmations remain for the owner AT the archive gate (where seam-row sign-off happens anyway):

1. **[commitment — the load-bearing one]** The binary half's outcome depends on an engine copy-apply pass no plan schedules; foresight affirmation 3 promised it COMMITTED-NEXT before the code existed. Now that the SDK code is real and the three `pending-changes.md` rows (BRC-02/BRC-08/PRC-06) are the only tether, does the owner RE-AFFIRM the committed-next schedule? Absent a live schedule, the by-reference half risks indefinite deferral → outputs-without-outcome.
2. **[usability/significance]** Is "authorable + harness-tested + dry-run-visible, no real bytes until the engine lands" a usable-and-significant L1-readiness increment to ARCHIVE now? (Owner affirmed YES at foresight; the mitigations that keep the gap visible are confirmed shipped — this is a standing confirmation, not a re-open.)

Suspicion, labeled: I judge both YES for the SDK layer — consistent with every prior stage's accepted emit-only boundary. The one genuine weakness vs Stage 4's same-repo committed-next 4b is that this change's committed-next lives in the ENGINE repo (cross-repo, less enforceable). That is a meaning/commitment call reserved for the owner, surfaced here — not faked as a verdict.

## Override

`DELIVERED` — no halt. (Had this been `outcome-gap`, it would be blocking-with-override; reason would persist to `sdd/schematic-local-files/outcome-override`.)
