# North Star — schematic-local-files (Foresight)

**Checkpoint**: foresight (post-design, pre-slice) · **Verdict**: `aligned` (with conscience questions the human MUST answer before reckoning) · **Change**: `schematic-local-files` · **Triage**: L

> This memo is the promise the reckoning gate will hold the delivered result against. Read it there verbatim.

## 1. This is what we're going to do (in outcome terms)

Give schematic authors a **supported, typed, contained, locally-testable way to express "ship this package-local template folder and these assets into the target tree"** — the Angular `apply(url('./files'))` mental model — replacing today's hand-rolled `readFileSync` + `create` workaround. Three author verbs: `scaffold` (declarative folder walk), `create({templateFile})` (one rendered file), `copyIn(from, to)` (one verbatim file). The author never declares text-vs-binary; a deterministic classifier routes each file to the by-value (`create`, rendered) or by-reference (`copyIn`, copied) transport, and shows the choice in `dryRun()`.

The decisive capability that did not exist in ANY form before: **binary assets (svg, images, css) can now be EXPRESSED at all.** The text wire literally cannot carry bytes (ADR-0019); until this change an author had no verb, no wire shape, and no containment story for a binary asset. This change mints the `copyIn` by-reference wire op and the `src/scaffold/` disk-read leaf that produces it.

## 2. Here's how it fits

- The **by-value half rides the EXISTING `create` IR** — zero engine contract change. Text/template files are render-requests the engine already knows how to apply (engine ADR-0028).
- The **by-reference half is a new additive wire op (`copyIn`, ADR-0043)** — a widening the engine must eventually apply. It is the FIRST non-100%-by-value directive in a protocol that was by-value-only (ADR-0019); the design confines the blast radius to three moving 7th-members (Directive op union, `DryRunVerb`, `AuthoringVerb`) plus a 8→12 reason union, each ADR-justified.
- All disk-read + emit logic lives in a **new isolated leaf `src/scaffold/`** reached via `currentContext()`; `DirectiveFactory` stays pure. This matches the SDK's existing `dry-run/`/`testing/`/`dialects/` leaf convention — a deviation the architecture already has a shape for.
- Containment (the sensitivity-override boundary) is **dual-sided**: SDK emit-time for DX/attribution, engine apply-time as the ONLY real security control. The SDK never claims to be the security authority.

## 3. Here's the outcome we're chasing — and the HONEST delivery ladder

The stated pain (triage): *"authors cannot reference package-local template files nor copy package-local assets; binary assets cannot travel the text wire at all."*

What this change delivers, rung by rung, for the motivating author (nestjs `crud-graphql-mongo/files`):

| Rung | Delivered by | Available when this change archives? |
|---|---|---|
| Author can EXPRESS scaffold/copyIn/templateFile with a typed surface | this change (SDK) | **YES** |
| Author gets local feedback: harness run, collisions, containment rejections, `AuthoringError`s | this change (SDK + fake/conformance) | **YES** |
| Author previews by-value/by-reference per entry via `dryRun()` | this change (SDK) | **YES** |
| Binary assets become expressible at all (were impossible) | this change (wire widening) | **YES (as emission + simulation)** |
| **Text/template files land as REAL files on disk** | engine `create` apply + **PC-PROTO-01 real-wire** (cross-repo, NOT landed) | **NO** |
| **Binary assets land as REAL bytes on disk** | PC-PROTO-01 **PLUS** a NEW engine copy-apply pass (three seam obligations BRC-02/BRC-08/PRC-06, engine repo, UNSCHEDULED) | **NO** |

**The load-bearing honesty**: when this change archives, the motivating author can author, harness-test, and dry-run their schematic and see green + a faithful plan — but **no bytes land on real disk for any verb**, because real-wire integration is PC-PROTO-01-gated for the WHOLE SDK (not special to this change). The by-reference (binary) half — the exact pain that motivated the change — carries an EXTRA gate beyond PC-PROTO-01: a dedicated engine copy-apply pass that no plan yet schedules.

This is NOT a defect of this design. It is the product's architecture: the SDK is an authoring-surface + directive-emitter verified against a normative fake contractually committed to mirror the engine; every prior stage (1–5) shipped under this same emit-only boundary and passed its steward gate. The design is **structurally honest** about it — the evidence boundary is itself a tested fitness function (BRC-04: zero assertions on `result.tree`/disk bytes for a by-reference target), and registering the three engine pending-changes rows is a NAMED acceptance criterion of the final slice (design §Migration, S5), not prose intent.

## 4. The filed question

*Does this design, executed perfectly, RESOLVE the pain — or merely produce correct outputs?* 

At the **SDK layer (the only in-scope layer)**: it resolves the pain — an author moves from "no supported way, binaries impossible" to "typed, contained, testable expression of folder + asset scaffolding, binaries included." There is **no shorter path to the SAME outcome**: the classification, containment, and wire work are irreducible for the SDK half, and the by-value/by-reference split is the minimum honest shape.

At the **delivery layer (real files on the nestjs author's disk)**: it does NOT resolve the pain, and cannot — that is cross-repo, out-of-scope by owner ratification, and (for binary) unscheduled. Whether the SDK-layer resolution is a SIGNIFICANT step for L1-readiness, or whether L1-readiness demands real files (making this a prerequisite that doesn't itself reach the outcome), is a MEANING question I escalate to the human below.

## Result → Problem map

| Stated pain | Addressed by | Residual gap |
|---|---|---|
| No supported way to reference package-local template files | `scaffold` + `create({templateFile})` (by-value, `create` IR) | Real files pending PC-PROTO-01 real-wire |
| No supported way to copy package-local assets | `copyIn` + scaffold by-reference arm (new `copyIn` op) | Real bytes pending PC-PROTO-01 **+ engine copy-apply pass (unscheduled)** |
| Binary assets cannot travel the text wire | `copyIn` by-reference wire (path reference, never bytes) | Same as above — expression yes, delivery engine-gated |
| Manual `readFileSync` + hand-rolled path resolution | ambient `packageDir` resolution + `collection.json` containment ceiling | New friction: existing `defineFactory({packageDir})` sites now REQUIRE a `collection.json` ancestor (ADR-0046 tightening) — fail-loud, no fallback |

## Gold-plating / smuggled-scope scan (tension 3)

- **No gold-plating found.** The 10,000-entry walk bound, case-fold segment comparison, and ancestor-symlink ENOENT-oracle closure are security-hardening driven by the sensitivity override, not spec ornamentation — they serve the containment pain, which IS part of the stated problem. The evidence-boundary test serves honesty, not the spec.
- **No smuggled scope found.** `collection.json` stays a pure containment marker (charter L2 cross-collection kept out); no template DSL; no per-file options. Discipline held.
- **One friction worth naming (not a gap):** the ADR-0046 `{packageDir}` tightening retrofits a `collection.json` requirement across ~13 existing test run-sites and every future author's `defineFactory`. Owner-ratified (ruling 10, fail-loud no fallback), but the reckoning gate should confirm it did not surprise authors who never touch `scaffold`.

## Author-journey simulation (tension 4 — every wall named)

1. Author writes `defineFactory({ packageDir }, fn)` → **NEW WALL** if no `collection.json` ancestor exists: fail-loud at run boundary (intended; ADR-0046).
2. Calls `scaffold({ from: './files', to, options })` → walks, classifies each file, applies rename→token→`.template`-strip. ✓ real SDK behavior.
3. Text → `create` render directives; binary/oversized → `copyIn` by-reference directives. ✓ emitted.
4. Runs via harness `runFactoryForTest` → sees directives, collisions, containment rejections, typed `AuthoringError`s. ✓ real, faithful feedback.
5. Calls `dryRun()` → per-entry `kind: "rendered" | "copied"`. ✓ visibility (the honesty mechanism).
6. Runs the schematic FOR REAL against the engine → **WALL**: real-wire is PC-PROTO-01-gated (whole SDK). Even when PC-PROTO-01 lands, the **binary assets still do not reach disk** until the unscheduled engine copy-apply pass — the precise motivating pain is resolved at expression, deferred at delivery.

## Conscience questions for the human (gate does not pass to reckoning until engaged)

1. **[significance]** L1-readiness is the stated "why now." This change makes real schematics AUTHORABLE and LOCALLY TESTABLE, but real files land only after PC-PROTO-01 (text) and an unscheduled engine copy-apply pass (binary). Is "authorable + harness-verified + dry-run-visible, real files cross-repo-gated" a SIGNIFICANT L1-readiness deliverable — or does L1-readiness require real files, making this a necessary-but-insufficient prerequisite whose outcome only crystallizes cross-repo? *(My suspicion, labeled as suspicion: this is significant AND consistent with every prior stage's accepted emit-only boundary — but the binary half's EXTRA, unscheduled engine gate is a weaker commitment than Stage 4's same-repo committed-next 4b, and risks crystallizing as outputs-without-outcome if the engine pass never schedules.)*

2. **[usability]** For the motivating author, is the value of expressing + locally simulating binary asset copying — with NO real bytes landing until an unscheduled engine change — usable ENOUGH to ship now, or does it invite authors to build schematics that green-test but silently drop their assets in production until the engine catches up? *(Suspicion: usable as an authoring/testing experience today; the risk is an author mistaking green for "assets land." The BRC-04 evidence-boundary test + `dryRun()` `kind` tags + the S5 engine pending-rows are the mitigations that keep the gap visible — reckoning must confirm they are actually shipped, not just specified.)*

3. **[commitment]** Will the owner make an explicit commitment (analogous to Stage 4's committed-next 4b) that the engine copy-apply pass — the three seam obligations (BRC-02, BRC-08, PRC-06) — is SCHEDULED, not merely registered? Absent that, the by-reference half's outcome is indefinitely deferred, and the reckoning gate should hold `aligned` CONDITIONAL on that commitment, exactly as Stage 4 did.

## Verdict rationale

`aligned`, not `outcome-gap`: the design faithfully reaches the outcome available at the SDK layer — the only layer in scope — with no shorter path, no gold-plating, no smuggled scope, and rare structural honesty about its evidence boundary. An `outcome-gap` halt here would be the steward unilaterally overturning an owner-ratified scope boundary (engine out of scope); that is a MEANING call reserved for the human, raised as conscience questions above rather than faked as a verdict. The delivery-layer gap is real and named — the reckoning gate must NOT read "green fake/conformance + dry-run" as "the nestjs author's assets land."

---

## Owner Affirmations — Conscience Questions (2026-07-12)

Gate closed: all three conscience questions engaged and AFFIRMED by the owner (Daniel).

1. **[significance] AFFIRMED — necessary prerequisite.** Emit-only-with-honest-boundary is the same maturity every prior stage (1-5) shipped under; the expression layer IS the SDK product. L1 additionally requires engine integration — acknowledged as the next front, not this change's burden.
2. **[usability] AFFIRMED — reckoning verifies mitigations SHIPPED.** BRC-04 evidence-boundary fitness, dryRun rendered|copied tags, and the three archive-gated seam rows are in-change deliverables; reckoning fails the change if any remained spec-only. Residual risk documented in copyIn README/JSDoc.
3. **[commitment] AFFIRMED — engine copy-apply pass is COMMITTED-NEXT post-integration.** Scheduled (not merely registered) on the engine side, tied to PC-PROTO-01 — the stage-4→4b committed-next pattern. The by-reference outcome has a schedule, not an indefinite deferral.

Verdict stands: **aligned** (unconditional — the conditional-on-commitment clause resolved by affirmation 3).
