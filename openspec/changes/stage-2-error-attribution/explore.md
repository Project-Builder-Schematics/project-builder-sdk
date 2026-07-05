# Exploration: Stage 2 error-to-author attribution (stage-2-error-attribution)

**Triage**: L
**Persona lens**: none (synthesis pass; architect/qa/pm/ba/tech-writer council to run in propose/spec)

## Cross-Change Lessons Consulted

None found for this topic beyond the predecessor triage (obs #719) — no prior change touched `authoring-error.ts`/`session.ts` attribution logic since foundations-skeleton.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author writes a factory; one verb call rejects; author needs to know WHICH action failed and WHY | none found — `test/e2e/author-to-tree.e2e.test.ts` covers only happy-path create+modify and move-with-force | Create |
| Author's factory buffers N directives; verb K (K>1) fails; author needs to know verbs 1..K-1 already applied (then discarded) before the failure | `test/skeleton/error-attribution.test.ts` (single-directive batch only — does NOT exercise mid-chain) | Modify |
| Author distinguishes an engine-rejected write (collision/cap/fidelity) from an SDK-born failure (misuse outside a factory; future dialect/AST failure) | none found | Create |

## Current State

`Session.flush` (`src/core/session.ts:52-64`) wraps the single `#client.emit(batch)` call; on rejection it calls `toAuthoringError(raw, batch.instructions[0]!)` — **hardcoded to the first directive regardless of which one actually failed**. `ContractFake.emit` (`test/support/contract-fake.ts:91-93`) applies directives in a plain `for` loop and throws a bare `Error` with no index/identity on the failing directive — nothing today lets `Session`/`authoring-error.ts` learn which directive failed or how many already applied. `toAuthoringError` (`src/core/authoring-error.ts:46-48`) builds a fresh `AuthoringError{verb, path}` from the directive it's given, discarding `raw` entirely (`_raw` unused, "gap-#2"). **`AuthoringError.verb` is typed `AuthoringVerb = "create"|"modify"|"delete"|...` — the WIRE op name, not the author verb**: a failed `remove()` call surfaces `verb: "delete"`, contradicting ADR-0013 ("delete is jargon; remove is the author-friendly synonym"). Separately, `AuthoringError`/`AuthoringVerb` are **not re-exported from any public subpath today** (`rg` across `src/index.ts`, `src/commons/index.ts`, `src/core/index.ts` — zero hits) — contra the triage's assumption that it's "exported/public"; an author cannot currently `instanceof`-check or import the type. `context.ts`'s double-fault handling (REQ-10) is correct and untouched by this stage. No read-trichotomy helper exists in `src/commons/index.ts` today (2.3/CQ-1 debt confirmed) — only JSDoc guidance to branch manually on `=== undefined`/`=== ""`.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/session.ts` (`flush()`) | modify | must identify the failing directive, not always `instructions[0]` | aligns |
| `core/authoring-error.ts` | modify | structured rejection (D2), applied-boundary field, origin tag, verb-vocabulary fix | aligns (SEAM-04 owner unchanged) |
| `core/engine-client.ts` (port surface) | extend? — open question | nothing today lets the port's rejection communicate WHICH directive failed; may need a structured rejection shape | **uncertain — see Open Question 1** |
| `core/context.ts` | modify (maybe) | `currentContext()` misuse throws a plain `Error`, not an `AuthoringError` — origin-taxonomy (2.4) may need to tag this | aligns |
| `commons/index.ts` | new | read-trichotomy helper (2.3); possibly re-exports `AuthoringError`/`AuthoringVerb` for author-facing `instanceof`/type access | **new row: deviates** — ADR-0009 forbids re-exporting `core` from the umbrella; an author-facing error type crossing that boundary needs its own ADR |
| `test/support/contract-fake.ts` | read-only | source of every rejection family (5× `RAW-UNTIL-STAGE-2.1` markers); its own throw messages must stay engine-internal text, never surfaced | aligns |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/session.ts` | Modify | locate failing directive by index/identity, not `instructions[0]` |
| `src/core/authoring-error.ts` | Modify | structured rejection type, applied-boundary field, origin tag, `delete`→`remove` vocabulary fix |
| `src/core/context.ts` | Modify (maybe) | tag SDK-origin errors (misuse throw isn't an `AuthoringError` today) |
| `src/core/engine-client.ts` | Read-only / possibly extend | port surface unchanged unless Open Question 1 resolves to a port-contract change |
| `src/commons/index.ts` | Modify | export read-trichotomy helper (2.3); possibly re-export error type/class |
| `test/support/contract-fake.ts` | Read-only | rejection source; RAW-UNTIL-STAGE-2.1 markers document what attribution consumes |
| `test/skeleton/error-attribution.test.ts` | Modify | today pins only single-directive create-collision (REQ-11.x); needs every-verb + mid-chain + origin coverage |
| `test/fake/batch-cap.test.ts:67` | Modify or explicit carry-forward | pins literal message `` `modify failed at ${FIXTURE_PATH}` `` — any message-format change breaks this REQ-01.3 pin |
| `test/fake/{boundary-pass-through,move-fail-closed,modify-existence,fidelity-missing-source}.test.ts` | Read-only | assert on the FAKE's raw rejection text directly (fake-level, not `AuthoringError`) — not touched by attribution, but each family needs a NEW skeleton-level twin proving attribution |
| `test/fitness/` (new function) | Create | leak-scan proof generalising fit-08/fit-10's pattern to "zero engine/fake vocabulary leaks" across ALL rejection families |
| `openspec/decisions/` (2 new ADRs) | Create | D2 (structured cause) and 2.4 (origin taxonomy) are both ★ owner decisions requiring ADRs |

## Sensitive Areas Crosscheck

No sensitive areas touched (no auth/payments/privacy/security/data-migration surface).

## Approaches

### 1. Port-contract extension — structured `EmitRejection` shape
`EngineClient.emit`'s rejection becomes a documented shape (`{failedIndex, appliedCount}` or similar) that fake AND future real client must produce. **Pros**: origin-agnostic, no message parsing, directly satisfies mid-chain + applied-boundary. **Cons**: changes the port surface (needs ADR, `architecture_impact: additive`); commits a not-yet-built real engine to a wire convention (ROADMAP §6 risk). **Effort**: Medium. **Pattern fit**: extends the existing single seam, matches the baseline's "single interface, not hexagonal scaffold."

### 2. Error-subtype metadata, no port signature change (recommended)
Keep `emit(): Promise<void>` unchanged; the rejection's error object carries `{failedIndex, appliedCount}` fields, computed from the same `for` loop the fake already runs. **Pros**: smallest surface change; envelope-level batch cap/fidelity checks (ADR-0018/0019) stay exactly as ratified. **Cons**: still a forward contract commitment for a real engine, phrased as an error-shape instead of a signature — same category of risk as #1, smaller footprint. **Effort**: Medium. **Pattern fit**: aligns with SEAM-04 (Session already owns the attribution wrap).

### 3. Message-parsing from the raw rejection (rejected)
Regex-extract path/verb from the fake's English error text. **Rejected**: ties the SDK to today's fake's exact wording, breaks for any real engine with different phrasing, and is in tension with the no-engine-text guarantee's spirit even though it wouldn't surface the parsed text directly.

## Recommendation

Approach 2 — error-subtype metadata on the emit rejection. It gives `authoring-error.ts` everything 2.1 needs (index → correct directive → correct verb+path; `appliedCount` → applied-boundary reporting) without changing the `EngineClient` port signature or the envelope-level contracts Stage 1 just froze. Approach 1's full port-signature change is unneeded weight for what 2.1 requires; Approach 3 is architecturally unsound. Both D2 (structured cause) and 2.4 (origin taxonomy) should be designed on top of the SAME rejection-shape decision — they are one contract question, not two.

## Risks

- The `instructions[0]` hardcode has zero red-proof today — no test exercises a multi-directive batch with a non-first failing directive; this is a silently-shipping bug, not a regression risk.
- `AuthoringError.verb` uses wire vocabulary (`"delete"`) contradicting ADR-0013 and Stage 2.1's own "in author vocabulary" exists-when clause.
- `AuthoringError`/`AuthoringVerb` are not exported anywhere today, contra triage's framing — exposing them is a NEW public export, not a "confirm no break" check.
- Literal-message pins (`batch-cap.test.ts:67`, `error-attribution.test.ts` verb/path asserts — REQ-01.3, REQ-11.x) need explicit compat handling if the rejection format changes.
- No e2e coverage of any rejection path exists — 2.1's "author reads the error" flow has zero end-to-end proof today.
- 2.4's SDK-origin family (dialect/AST) has no implementation yet (`define-dialect.ts` is a T-M2 stub); the only present SDK-origin failure (`currentContext()` misuse) isn't even an `AuthoringError` today — the origin-distinguishability test may only be provable against one concrete case, not the dialect family the plan describes.

## Open Questions

- type: technical
  question: "What mechanism lets `Session`/`authoring-error.ts` learn WHICH directive in a multi-directive batch failed and how many already applied? (Approach 1: port-signature change / Approach 2: error-subtype metadata, recommended / Approach 3: message-parsing, rejected.)"
  why_it_matters: "Nothing today communicates this; hardcoding `instructions[0]` is the resulting bug. This choice also decides whether `engine-client.ts`'s port surface changes — currently marked uncertain in the touchpoints table."
- type: product
  question: "D2 — what detail does an author actually get back: verb+path+applied-boundary only (today's ceiling), or a richer structured cause (e.g. a `reason` enum), and how does that coexist with the no-engine-text guarantee that currently covers the WHOLE error object?"
  why_it_matters: "Owner-flagged ★ decision gating 2.1's freeze (triage risk #1). Answered by default → either a contract too thin to debug real failures, or a 'rich' cause field that leaks engine vocabulary and undermines the guarantee 2.1 exists to protect."
- type: technical
  question: "2.4 — given the SDK-origin dialect family doesn't exist yet, what marks an error 'SDK-origin' vs 'engine-origin' at the type level (discriminant field, subclasses, other), and is the exists-when test provable now or does it need a stand-in case?"
  why_it_matters: "Without a concrete mechanism, 2.4 risks being ADR'd in the abstract with no code to prove it, or silently narrowed to engine-origin only."
- type: product
  question: "Should `AuthoringError.verb` be corrected to author vocabulary (`remove` not `delete`), and if `AuthoringError`/`AuthoringVerb` become author-importable, which public subpath re-exports them, given ADR-0009 currently forbids core re-exports from the umbrella?"
  why_it_matters: "Unasked, design may perpetuate the vocabulary bug or add a new public export without the ADR the architecture baseline demands for a core-boundary crossing."

## Ready for Proposal

**Status**: yes
**Reason**: The problem is concrete and grounded in real code (hardcoded `instructions[0]`, discarded `_raw`, wire-vocabulary leak, unexported error type), the architecture touchpoints are mapped against the current baseline with one flagged deviation (public export of an error type), and the technical unknowns (rejection-identification mechanism, origin-taxonomy mechanism) are now concrete enough to decide rather than assume. D2 and the export/vocabulary question are product-level and must reach the user before `sdd-propose` commits to an approach.
**Recommended action**: Surface the two `product` open questions to the user; feed the two `technical` open questions into `sdd-propose`/`sdd-spec` as design inputs. Proceed to `sdd-propose`.
