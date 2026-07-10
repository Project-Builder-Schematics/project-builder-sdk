# Exploration: Stage 4 — Typed Factory Options (stage-4-typed-options)

**Triage**: L
**Persona lens**: none (orchestrator-run explore; council personas run at propose/spec/design)

## Cross-Change Lessons Consulted

- Lesson (`foundations-skeleton`, obs #648): "Fitness/gate tests that read build output must build first or assert freshness: FIT-04 (.d.ts semver gate) false-greened twice on stale `dist/`." Directly relevant to D4 path (b) — a codegen bin producing generated `.ts`/`.d.ts` from `schema.json` reproduces the exact staleness-trap shape; any codegen path needs a freshness-asserting test from day one, not a follow-up.
- Lesson (same obs): "Lifecycle guarantees belong in a REQ with a GWT, not a JSDoc comment." Applies directly to 4.3's run-boundary validation and reserved-name enforcement — both must be REQs with Given/When/Then, not documented convention.
- No discovery/bugfix-type memories matched "schema", "typed options", or "reserved names" beyond the triage/pending-changes rows already in scope.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author writes a factory and runs it against the fake (in-repo) | `test/e2e/author-to-tree.e2e.test.ts` | Modify — extend to a typed `O` example (closes CQ-2/4.4) |
| Author runs their OWN factory from an installed package (out-of-repo) | none found — currently impossible, see Current State | Create |
| End user resolves inputs via CLI against `schema.json` | none in this repo (Go CLI, external) | Not applicable here — SDK only guarantees schema sufficiency, no prompt UX in scope |
| Resolved inputs cross into the running factory | `test/skeleton/context.test.ts` (untyped `void`/ad-hoc `O` only) | Modify — run-boundary validation has no test today |

## Current State

- `defineFactory<O>` (`src/core/context.ts:38`) takes `O` as a bare caller-supplied generic; the returned runner `(o, deps) => Promise<void>` invokes `fn(o)` directly (`context.ts:50`) with **zero validation** of `o` — confirmed by reading the full function body.
- No file named `schema.json` exists anywhere in `src/` or `test/` (`rg -n "schema\.json"` — zero hits). The input-contract mechanism described in the problem statement has no code today, not even a stub.
- `create<S>` (`src/commons/index.ts:129`) is a **separate, already-shipped plane**: `S` narrows the *template interpolation* `options` object via a homomorphic mapped type (`test/types/typed-create.test.ts` pins the exact positive/negative matrix). It has no relationship to `defineFactory<O>`'s input `O`. The objectives-plan 4.2 text ("builds on the `create<S>` overload") is confirmed MISANCHORED — flag for propose to correct the cross-reference.
- Reserved lifecycle names (`add`/`remove`/`pre-execute`/`post-execute`): **zero occurrences** anywhere in `src/` or `test/` outside the triage/pending-changes prose itself — confirmed by repo-wide search. Notably, `remove` is ALREADY a live author-verb export name (`src/commons/index.ts:163`) — so treating `"remove"` as a *reserved* lifecycle-hook name would collide with its existing meaning as a *verb*, unless the two namespaces are understood to be disjoint (e.g. reserved against schematic-package export names vs. reserved against in-factory verb calls). The engine-handoff note in `pending-changes.md` names the four strings but never states the namespace they are reserved against.
- Testing story gap is worse than "unexported fake": `defineFactory` and `currentContext` are exported only from `src/core/context.ts`, and `./core` is **not wired** in `package.json#exports` (confirmed against `ADR-0014` + the exports map). An installed consumer cannot import `defineFactory` **at all** today — in-repo tests reach it only via relative path, which is not available outside this repo. D7 is not merely "the fake is hard to reach" — the factory *runner itself* is unreachable from an installed package.
- Auto-prompt parity conflict flagged at triage as unresolved is **already resolved**: `pending-changes.md` records the 2026-07-06 owner ratification — schema-sufficiency is a CONTRACT (fitness function), the guard rail against SDK-side prompt rendering stands. Not an open question; current-state fact.
- Zero runtime dependencies today (`package.json` has no `dependencies` key); `devDependencies` only. No `bin` field exists.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/context.ts` (`defineFactory`) | modify | run-boundary validation of resolved `O` before `fn(o)`; typing source changes per D4 | aligns — this is exactly the ambient-run-context chokepoint (ADR-0011) |
| new schema-parity module (validation + D4 path b/c type derivation) | new | schema.json ↔ O parity enforcement (4.2/4.3) | aligns if it lands in `src/core` per the stated convention ("new internal kit primitive → `src/core/`"); plain-JSON parsing, no AST — does not touch the dialect layer |
| `package.json#exports` + possible `bin` field | extend / new | D7's `./testing` subpath; D4 path (b)'s codegen executable | `./testing` aligns with the ADR-0014 subpath pattern (reserved slots exist for exactly this kind of growth); a `bin` field is a **new distribution primitive** with no precedent in this package → deviates |
| `test/fitness/` (schema-sufficiency + semver gates) | extend | new fitness function(s) for parity/testing-subpath | aligns with the FIT-* convention, but see Risks — number collision with the concurrently-building Stage 2 |
| `src/core/authoring-error.ts` (Stage 2's frozen contract) | read-only, conflict flagged | run-boundary validation failures must surface as `AuthoringError`, but Stage 2's V2-signed closed `reason` enum has no member for "input failed schema validation" | deviates — see Risks; growing the enum is MAJOR per Stage 2's own signed semver stance |
| new runtime dependency (D4 path c only, conditional) | new | Zod-as-source | deviates — first runtime dependency ever, contradicts the explicit-trust/near-zero-dep supply-chain posture recorded in ADR-0009 |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/context.ts` | Modify | run-boundary validation call site; `defineFactory<O>` signature/typing per D4 |
| `src/core/authoring-error.ts` | Read-only / conflict | frozen `reason` enum has no slot for schema-validation failures (cross-change risk) |
| `package.json` | Modify | new `./testing` export, possible `bin`, possible new dependency (D4c) |
| new: schema-parity module (path TBD by D4) | Created | schema↔type parity, run-boundary validator |
| new: `./testing` public entrypoint (D7) | Created | public harness for schematic authors |
| `test/support/contract-fake.ts` | Read-only (D7 exposure design input) | candidate wrap target; its class surface must NOT be exported verbatim |
| `test/types/typed-create.test.ts` | Read-only | confirms `create<S>` is the unrelated plane; no changes expected |
| `test/fitness/` (new file(s)) | Created | schema-sufficiency fitness function, testing-subpath semver gate |
| new: reference schematic + e2e test (4.3/4.4) | Created | canonical `factory.ts`+`schema.json` pair, executed by a test |
| `openspec/decisions/` (new ADRs) | Created | D4, D7, reserved-name semantics, run-boundary error-shape |
| `docs/` (author-facing) | Modify/Created | quickstart references stage-6, but D7's testing story needs its own doc note |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| public-api (semver-locked exports/`.d.ts`) | `package.json#exports`, possible `bin`, new `./testing` subpath | Yes — triage names this explicitly, tech-writer + security-engineer invoked |
| security boundary (run-boundary input validation) | `src/core/context.ts` | Yes — sensitivity override forced L |
| new external dependency (conditional, D4c) | `package.json` | Yes — triage names this preemptively |

No sensitive-area touch found that triage missed.

## Approaches

### D4 — typed-options mechanism (the central, owner-ratified ★ decision)

1. **(a) Hand-supplied `O` for v1.** Ship `defineFactory<O>` as-is; `schema.json`'s only job becomes CLI-prompt sufficiency (4.2), decoupled from typing. **Pros**: near-zero implementation, reversible pre-v1, unblocks 4.3/4.4/4.5 immediately with no new tooling/dependency risk. **Cons**: the "one source, parity enforced" differentiator (O2) stays undelivered at exactly the point the plan calls cheapest to fix it. **Effort**: Low. **Pattern fit**: matches today's code exactly (no change).
2. **(b) `schema.json` → TS codegen via a shipped dev-time bin (Prisma-style).** **Pros**: lossless TS representation, familiar DX, schema.json stays the literal single source. **Cons**: first `bin` field ever (new distribution primitive, no precedent); generated-artifact staleness lifecycle — this is the *exact* shape of the FIT-04 stale-`dist/` trap already recorded in lessons-learned #648, so a freshness-asserting test is mandatory from slice 1, not a followup. **Effort**: Medium-High. **Pattern fit**: new pattern, no existing analog in `src/`.
3. **(c) TS-schema-as-source (e.g. Zod 4) → emit `schema.json` as build artifact.** **Pros**: single TS-first source, no separate JSON to hand-maintain, Zod4's `toJSONSchema()` derives the wire artifact directly. **Cons**: FIRST runtime dependency ever in a package whose supply-chain posture (ADR-0009) is explicit-trust/near-zero-deps; inverts the source-of-truth arrow implied by the problem statement (schema.json IS the input contract) into "schema.json is generated, TS is the real source" — a bigger authoring-model shift than it looks; bundle-budget (FIT-03) and type-leak-through-umbrella exposure. **Effort**: Medium. **Pattern fit**: new pattern; also the only path that independently triggers triage's "new external dependency" override.

**Recommendation (input to owner ratification, not a unilateral pick — D4 is explicitly reserved for the owner)**: (a) hand-supplied for v1. Reasoning: 4.2's schema-sufficiency contract is **already ratified as a fitness function independent of D4** (pending-changes.md, 2026-07-06) — schema.json's job of feeding CLI prompts does not require it to ALSO drive TS types, so the "parity enforced" promise is *partially* deliverable under (a) today, with (b)/(c) as a clean additive upgrade later (pre-v1, this call is reversible; post-v1 it is semver-locked, which is exactly why the plan treats it as cheap-now). (b)/(c) both add real tooling/dependency debt for a differentiator that has a working structural placeholder already ratified.

### D7 — schematic-author testing exposure

1. **Export `ContractFake` directly under `./testing`.** Simplest, but locks its full internal surface (constructor shape, `committedTree()`/`stagingTree()` test-only accessors, `lastServed`) as a semver contract forever.
2. **Thin wrapper harness** (e.g. `createTestHarness({ seed })` returning a narrow `{ run, committedTree }`-shaped object) that wraps the fake internally without exporting its class. **Recommended** — matches the existing kit-boundary discipline (ADR-0009: "designed now, extracted/exposed later behind a clean boundary"), keeps `ContractFake` free to evolve. Still requires `defineFactory` itself to become reachable (currently unreachable from any installed package, see Current State) — either wired directly into `./testing` or wrapped by the same harness; this is a technical design decision, not settled here.
3. **Documented hand-rolled pattern, no new export.** Lowest exposure risk, but fails the objectives-plan's own "Exists when" criterion for 4.5 (an author must run their factory "without cloning this repo") — `defineFactory` is unreachable today, so this option leaves the stated done-criterion unmet.

### Reserved-name enforcement site (independent of D4/D7, contingent on semantics)

Cannot be finalized — see Open Questions (semantics unrecoverable). Once the product question resolves, three enforcement sites are viable and not mutually exclusive: (i) type-level exclusion (only meaningful if D4 picks a derived-typing path); (ii) runtime check inside `defineFactory`'s existing run-boundary chokepoint (`context.ts:50`) — works regardless of D4, colocates with the already-scoped run-boundary validation; (iii) a static fitness/lint scan over schematic package shape at build/CI time. Recommend (ii) as the baseline regardless of what "reserved against" turns out to mean, since it is the one site that works under every D4 outcome.

### Run-boundary validation shape

Site: `core/context.ts:50`, immediately before `fn(o)` inside `defineFactory`'s existing try-block — the single per-run chokepoint (ADR-0011). What it throws is the open problem: Stage 2's V2-signed `authoring-error-contract` freezes `origin: "write-rejected" | "authoring-rejected"` and a **closed** `reason` enum (`path-collision | path-not-found | unrepresentable-content | changes-too-large | outside-run | unknown`). A schema-validation failure fits `origin: "authoring-rejected"` cleanly (SDK-origin, born before the wire) — but **none of the six `reason` values fit**, and Stage 2's spec explicitly states growing that enum is a MAJOR change under its own semver stance. `unknown` is documented as "the SDK could not classify" — reusing it would misrepresent a fully-classifiable error. This is a genuine cross-change gap Stage 4 exposes in Stage 2's taxonomy, not a Stage 4 design choice alone.

## Risks

- **Cross-change enum collision**: Stage 4's run-boundary validation has no home in Stage 2's frozen `reason` enum; Stage 2 is mid-build in a concurrent session with a signed V2 spec — reopening it has real cost. Design must coordinate explicitly rather than silently pick a reason value.
- **FIT number collision**: Stage 2 claims `FIT-11` (in-flight, concurrent session). Stage 4's new fitness function(s) must claim `FIT-12`+ to avoid a file/REQ-ID collision at merge time.
- **`defineFactory` unreachability**: no wired subpath exposes it today; D7 cannot be satisfied by exposing only the fake — the runner itself needs a reachable path.
- **Codegen staleness (D4b only)**: repeats the exact FIT-04 stale-derived-artifact trap already burned once (lessons-learned #648); needs a freshness proof from slice 1.
- **First runtime dependency (D4c only)**: contradicts the explicit-trust/near-zero-dep posture ADR-0009 records; would need its own supply-chain/security-engineer review before ratification.
- **Objectives-plan cross-reference is stale**: 4.2's text ties itself to `create<S>` ("builds on the `create<S>` overload") — confirmed unrelated code path; propose should correct this before design inherits the wrong anchor.

## Open Questions

- type: product
  question: "D4 — which typed-options mechanism: (a) hand-supplied v1, (b) schema.json→TS codegen bin, (c) Zod-as-source emitting schema.json?"
  why_it_matters: "Semver-locked once published; gates 4.2-4.4 entirely; (c) alone triggers the first-runtime-dependency override."
- type: product
  question: "D7 — public `./testing` harness (thin wrapper vs. exported fake) vs. documented hand-rolled pattern, AND whether `defineFactory` itself becomes reachable through it?"
  why_it_matters: "Today NO installed author can run their own factory at all; the objectives-plan's own done-criterion for 4.5 requires this to be possible without cloning the repo."
- type: product
  question: "Reserved lifecycle names (`add`/`remove`/`pre-execute`/`post-execute`) — reserved against WHAT namespace (schematic package export names? schema.json keys? in-factory verb calls, which already includes a live `remove` verb)? The engine handoff names the four strings but never states the namespace."
  why_it_matters: "Without this, 'enforcement' cannot be scoped or tested at all — the current material is genuinely silent, not merely ambiguous."
- type: technical
  question: "How should Stage 4's run-boundary validation failure be represented under Stage 2's signed, closed `AuthoringError.reason` enum, given none of its six values fit and growing it is a MAJOR change in a concurrently-building change?"
  why_it_matters: "Blocks freezing the run-boundary throw shape in design without either an enum-growth ADR or a cross-change coordination decision."

## Ready for Proposal

**Status**: partial
**Reason**: The codebase-grounding work is complete and conclusive (zero existing coverage confirmed for reserved names and schema.json; the two-plane distinction between `defineFactory<O>` and `create<S>` is confirmed independent; the testing-story gap is confirmed more severe than assumed). What remains are the two owner-ratified ★ decisions (D4, D7) the objectives-plan itself reserves for the owner, plus one genuinely unrecoverable semantic gap (reserved-name namespace) and one cross-change coordination point (Stage 2's closed enum). None of these are architectural conflicts internal to this change — they are product decisions and one cross-team coordination item, exactly as triage anticipated ("D4/D7 gate everything else... frame as the first walking-skeleton slice's exit criteria").
**Recommended action**: Surface the three `type: product` open questions to the user/owner before `sdd-propose`; propose should frame D4/D7/reserved-name-semantics as slice-0 exit criteria (per triage's own note) rather than block on them now. Flag the Stage-2 enum-collision technical question for `sdd-design` to resolve via explicit coordination, not silent reuse of an ill-fitting `reason` value.
