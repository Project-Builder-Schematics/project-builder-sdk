# Specs: stage-4-typed-options

**Spec version**: V5
**Status**: signed (owner, 2026-07-07)
**Change**: `stage-4-typed-options`
**Triage**: L

**V4 → V5 delta (micro-unfreeze, owner-authorized 2026-07-10)**: the coordinated Stage-2
amendment applied — `openspec/specs/authoring-error-contract/spec.md` (V2 → V3) now carries
REQ-AEC-07 (`invalid-input`), REQ-AEC-08 (`reserved-name`), and REQ-AEC-09 (the 4th/5th
message-template rows), signed 2026-07-10. The "Domain: authoring-error-contract" block below
flips from PROPOSED to APPLIED accordingly. Nothing else touched: no REQ-ID added/removed/
renamed, no scenario text edited, all 25 REQ-IDs and their existing scenarios stable — S-006's
gate (`slices.md`) can now be evaluated against a landed amendment instead of a deferred one.
The V4 sign-off and all its content carry forward unchanged.

**V3 → V4 delta (micro-unfreeze, owner-authorized 2026-07-07)**: the "Interim Behaviour"
clause is rewritten from an interim `AuthoringError` to a plain-`Error` interim (Option A —
resolves plan-verify iteration-2 gaps 3/4). The prior interim
`AuthoringError{origin:"authoring-rejected"}` was UNCONSTRUCTIBLE against Stage-2's
origin-derived-from-`reason` design (ADR-0021: `origin` derives from a CLOSED `reason` enum,
and no interim `reason` truthfully maps until the two new members land). No REQ-ID
added/removed/renamed; scenario text is touched ONLY where it asserted the interim
`AuthoringError` shape (REQ-RBV-01/02 status lines and REQ-RLN-02.1 in the domain specs). The
V3 sign-off and all other content carry forward unchanged.

**V2 → V3 delta (micro-amendment, owner-authorized unfreeze 2026-07-07)**: ONE scenario
added — REQ-FPS-05.4 (README qualifying-line for incremental shipping, reverted in
stage-4b). No other change: no REQ-ID added/removed/renamed, no scenario text edited, all
25 REQ-IDs and their existing scenarios stable. Closes plan-verify iteration-1 gap 1 (the
README qualifying-line was an `in_scope` item with a slice task, S-005, but no REQ
coverage). The V2 sign-off below and all its content carry forward unchanged.

V2 — blind spec-council feedback (business-analyst, qa-engineer, tech-writer,
security-engineer) applied: 6 blockers, 12 majors, 8 minors folded in (26 findings total).
All 20 V1 REQ-IDs preserved; 5 NEW REQ-IDs added (REQ-TFO-05, REQ-RBV-04, REQ-RBV-05,
REQ-FPS-05, REQ-AEC-09). Same 6 domains as V1; no domain added or removed.

## Upstream Ingest / Sync

`spec_source: internal` — Step 5b (upstream ingest) and Step 10b (upstream sync) do not
apply. This spec is authored directly from the proposal.

## Glossary (TW-F8)

- **schematic** == **factory-module**: the package pair (`factory.ts` + adjacent
  `schema.json`) an author ships; the two terms are used interchangeably throughout these
  specs.
- **input**: the schema-derived RUNTIME value resolved and passed into a factory
  (`defineFactory<O>`'s `o`). Distinct from **options**, which stays reserved for the
  `create<S>` template-interpolation plane (an unrelated, already-shipped capability) —
  never use "options" for `defineFactory`'s input in these specs or in generated errors.
- **fitness function**: this SDK's house term for a build/CI-time structural or contract
  check (the `FIT-NN` test files) — not a general "code quality" metric.

## Interim Behaviour (pre-Stage-2-amendment) — consolidated (BA-1/QA-M1; rewritten V4, Option A)

Everything REASON-INDEPENDENT is buildable and testable NOW; the whole error-CLASS wiring
(`AuthoringError` construction, its `origin`, its `reason`) is what the coordinated Stage-2
amendment (REQ-AEC-07/08/09, this change's `authoring-error-contract` domain) unlocks. Stage-2's
`AuthoringError` DERIVES `origin` from a CLOSED `reason` enum (ADR-0021), and no interim `reason`
truthfully maps to an "authoring-rejected" input/name rejection until the two new enum members
land — so an interim `AuthoringError{origin:"authoring-rejected"}` is UNCONSTRUCTIBLE, and this
change does NOT attempt to construct one before S-006.

INTERIM (the S-000..S-005 `/build` deliverable), an author who supplies a schema-violating input
or declares a reserved lifecycle name experiences: the run is REJECTED (never silently accepted or
partially applied — all-or-nothing holds); the rejection happens at the correct SITE (run-boundary
pre-`als.run` for RBV, module-validation for RLN — never the emit seam; nothing is staged and the
engine client's `emit` is never invoked); the thrown value is a **plain `Error`** (NOT an
`AuthoringError`); its `.message` is the EXACT pinned literal for that rejection class (the
REQ-AEC-09 template rows — the SINGLE source of truth for the wording) and NEVER echoes a raw input
value (the canary no-echo scan, REQ-RBV-04, covers these plain-`Error` surfaces). Fail-closed
semantics (present-but-unreadable/unparseable schema → reject, REQ-RBV-05) hold interim on the
plain-`Error` throw.

The three things an author cannot yet do — ALL deferred to S-006 (post `stage-2-error-attribution`
archive + the coordinated `sdd-spec` amendment): assert `instanceof AuthoringError`, inspect
`origin`, or `switch` on a `reason` value. Until S-006 lands, tests assert everything above EXCEPT
those three, and do NOT assert the interim throw is an `AuthoringError`. S-006 UPGRADES every
interim plain-`Error` throw to the final `AuthoringError` shape and flips these assertions on.

Interim RBV-vs-RLN distinguishability (REQ-RLN-02.1) is carried by the two DISTINCT pinned message
literals (`invalid input: …` vs. `reserved lifecycle name: …`); reason/origin-based
distinguishability is S-006. This applies uniformly to REQ-RBV-01/02 and REQ-RLN-02. REQ-RBV-04,
REQ-RBV-05, and REQ-RLN-01 (excluding its design-gated Scenario .1) carry NO Stage-2 dependency —
and with the plain-`Error` interim, NEITHER DO S-000..S-005: the ONLY remaining Stage-2 gate is
S-006's.

## Cross-Cutting Notes (read before reviewing individual domains)

1. **Owner-ratified inputs are binding, not re-litigated.** D4 = codegen dev bin (schema.json
   stays hand-authored, parsed as data, no postinstall, project-scoped writes, explicit
   invocation), the reserved-name namespace split (schematic-level `pre-execute`/`post-execute`
   here vs. collection-level `add`/`remove` deferred to L2), and the interim-throw
   resolution (final shape only, via coordinated Stage-2 amendment) are inputs to this
   spec, not open questions.
2. **ADR-0018 scoping (council arch-F1).** ADR-0018 ("the SDK never validates") governs
   WIRE-level judgments at the `EngineClient` port — paths, serializability, intra-batch
   conflicts — which stay engine-owned pass-through. `run-boundary-input-validation`'s
   schema-conformance checking is the author's OWN input contract, upstream of the wire,
   and out of ADR-0018's scope. Design MUST produce a formal scoping/amendment ADR for
   ADR-0018 recording this distinction before the pre-archive architecture audit — without
   it, the audit gate halts `architecture-audit-violations`. The REQs in
   `run-boundary-input-validation` assume this scoping holds; they do not themselves
   constitute the ADR. Path-shaped input VALUES pass through to engine-owned wire
   validation untouched by this scoping change (SEC-m1) — deliberate, not an omission.
3. **Interim throw shape — see the consolidated "Interim Behaviour" section above** (was:
   a per-domain repeated note in V1; consolidated per BA-1/QA-M1 so it is stated once and
   referenced, not re-explained per domain).
4. **Reserved-name enforcement site (council arch-F3).** `defineFactory` only ever receives
   `fn` — it cannot see sibling module exports at runtime. `REQ-RLN-01` therefore requires
   enforcement to observe the factory package's OWN MODULE STRUCTURE (build-time static
   scan, or an inspectable lifecycle-hooks API — design decides which); no site that
   cannot see module structure satisfies this REQ. The exact declaration shape is
   design-gated (REQ-RLN-01, Scenario .1) — the reservation and enforcement obligation are
   not.
5. **bin→core dependency direction (council arch-F4).** The codegen bin lives outside the
   `src/` runtime path; it may depend on shared schema logic in `src/core`, never the
   reverse. `REQ-FPS-03`/FIT-15 is the new structural guard.
6. **FIT numbering.** Stage 2 claims FIT-11 (concurrent build). This change claims
   FIT-12 (parity), FIT-13 (sufficiency), FIT-14 (package-surface guard), FIT-15
   (bin→core dependency direction) — no collision.
7. **RED posture** (Stage-1/Stage-2 four-posture convention): `REQ-SCP-01` (parity gate,
   now digest-mechanism) is **must-fail-first** — no parity/drift check exists today.
   `REQ-TFO-01`/`REQ-RBV-01` are **must-fail-first** against today's bare-generic,
   zero-validation `defineFactory`. `REQ-TFO-02`/`REQ-RLN-03` are **characterization**
   (proving already-intended backward-compatible/boundary behaviour, not a bug fix).
   `REQ-RLN-01`'s Scenario .1 is **design-gated** — it cannot be driven red until the
   declaration-mechanism ADR lands; Scenarios .2–.4 are must-fail-first now.

## Domain: typed-factory-options (NEW)

> Full spec: `specs/typed-factory-options/spec.md`. REQ-TFO-01 (schema-derived input type
> via the codegen bin; single-source mutation-resistant proof) · REQ-TFO-02 (untyped
> opt-out compatibility, mirrors `typed-create-skeleton` REQ-01.3) · REQ-TFO-03 (bin
> invocation discipline: no postinstall, static parse-as-data proof, devDependency-only
> generator) · REQ-TFO-04 (bin error/success path: non-zero exit + stderr + position
> locator + non-destructive on failure + author-vocabulary messages; documented success
> signal) · REQ-TFO-05 (NEW — write containment: fixed output location adjacent to
> `factory.ts`, path-escape refusal).

## Domain: schema-contract-parity (NEW)

> Full spec: `specs/schema-contract-parity/spec.md`. REQ-SCP-01 (FIT-12 parity/drift gate —
> now a content-digest mechanism, resolving the QA-B1 unsatisfiable-scenario blocker, with
> an explicit non-destructive-check clause) · REQ-SCP-02 (FIT-13 schema-sufficiency gate —
> type/label/enum-choices/nonsensical-type/prototype-pollution-key hard-fail;
> default/required/description advisory; compound scenario split per failure mode).

## Domain: run-boundary-input-validation (NEW)

> Full spec: `specs/run-boundary-input-validation/spec.md`. REQ-RBV-01 (fail-closed
> validation pre-`als.run`, rejection SITE contrasted with the emit-seam
> `unrepresentable-content` path, + prototype-pollution/null-trichotomy/template-syntax-
> opacity scenarios — **AuthoringError shape deferred to S-006; interim throws a plain `Error`
> with the pinned message literal, see Interim Behaviour**) · REQ-RBV-02
> (no-raw-value-echo message contract, now referencing REQ-AEC-09's template row —
> **AuthoringError shape deferred to S-006; exact message literal asserted interim**) · REQ-RBV-03 (no-schema opt-out is a loud, stateless,
> every-run warning — unblocked) · REQ-RBV-04 (NEW — canary-seeded no-echo verification
> across every rejection branch, value/key-name asymmetry pinned) · REQ-RBV-05 (NEW —
> fail-closed on malformed/empty schema.json at the run boundary).

## Domain: reserved-lifecycle-names (NEW)

> Full spec: `specs/reserved-lifecycle-names/spec.md`. REQ-RLN-01 (schematic-level
> `pre-execute`/`post-execute`, enforced from module structure only; kebab-case rationale
> pinned; declaration-mechanism scenario design-gated; positive/pair/schema-field-boundary
> scenarios added) · REQ-RLN-02 (rejection shape, now referencing REQ-AEC-09's reserved-name
> template row — **AuthoringError shape deferred to S-006; interim throws a plain `Error` with
> the pinned reserved-name literal**) · REQ-RLN-03 (boundary pin: collection-level
> `add`/`remove` are NOT rejected here, deferred to L2; compound scenario split).

## Domain: factory-package-shape (NEW)

> Full spec: `specs/factory-package-shape/spec.md`. REQ-FPS-01 (canonical `factory.ts` +
> adjacent `schema.json` layout; also the bin's fixed output location) · REQ-FPS-02
> (FIT-14 package-surface guard: exports map unchanged, only `package.json#bin` added,
> zero-deps preserved, now extended to the publishable tarball's contents) · REQ-FPS-03
> (FIT-15 bin→core dependency direction) · REQ-FPS-04 (in-repo e2e typed-factory example,
> no `./testing` dependency — retires CQ-2) · REQ-FPS-05 (NEW — discoverability: bin usage
> output, `defineFactory` JSDoc `@example` workflow via FIT-06, reserved-name
> documentation, reserved-name-namespace distinction note; **V3 adds Scenario .4** — the
> README incremental-shipping qualifying-line, reverted in stage-4b).

## Domain: authoring-error-contract (MODIFIED — APPLIED 2026-07-10)

> Full spec: `openspec/specs/authoring-error-contract/spec.md` (Stage 2's main spec, now
> V3). NOT an applied delta HERE — this domain block stays a dependency record, never a
> silent edit of Stage 2's own spec. The coordinated `sdd-spec` amendment landed on Stage
> 2's OWN signed spec on 2026-07-10 (owner-authorized unfreeze of the archived
> `stage-2-error-attribution` change's `authoring-error-contract` spec — see that file's
> V2 → V3 delta note): REQ-AEC-07 (`reason: "invalid-input"` — renamed from V1's
> `invalid-options`, TW-F2), REQ-AEC-08 (`reason: "reserved-name"`), and REQ-AEC-09 (the
> 4th/5th message-template rows this change's rejections need — TW-F1 blocker) are now
> live in Stage 2's spec, exactly as previously recorded here as PROPOSED. S-006
> (`slices.md`) may now evaluate its GATE task against a landed amendment.

## Sensitive Areas Coverage

| Area | REQ IDs | Flagged at triage? |
|---|---|---|
| security (input validation at the run boundary) | REQ-RBV-01, REQ-RBV-02, REQ-RBV-03, REQ-RBV-04, REQ-RBV-05, REQ-RLN-01, REQ-RLN-02, REQ-RLN-03 | Yes |
| public-api / supply-chain (`bin`, exports, generator dependency) | REQ-TFO-03, REQ-TFO-04, REQ-TFO-05, REQ-FPS-02, REQ-FPS-03, REQ-FPS-05 | Yes |
| public-api-stability (parity/sufficiency contract) | REQ-SCP-01, REQ-SCP-02 | Yes |

No sensitive-area touch found that triage/explore missed.

## V1 → V2 Blind-Council Findings Applied (26 findings)

| # | Finding (lens-ID) | Encoded as |
|---|---|---|
| 1 | TW-F1 (blocker): 4th message-template family | REQ-AEC-09 (NEW); REQ-RBV-02 now references it |
| 2 | QA-B1 (blocker): REQ-SCP-01.3 unsatisfiable | REQ-SCP-01 rewritten as content-digest mechanism (design variant of "own scenario under SCP-02" — chosen because a digest fix makes the WHOLE gate correct, not just one scenario) |
| 3 | SEC-B1+QA-m2 (blocker): dictionary-seeded canary scan | REQ-RBV-04 (NEW) |
| 4 | SEC-B2+QA-M2 (blocker): `__proto__`/`constructor`/`prototype` | REQ-RBV-01.6 (NEW scenario); REQ-SCP-02.5 (NEW scenario) |
| 5 | SEC-B3+QA-m4 (blocker): fail-open hole, empty schema | REQ-RBV-05 (NEW) |
| 6 | SEC-B4 (blocker): bin write containment | REQ-TFO-05 (NEW) |
| 7 | BA-1+QA-M1 (major): consolidated Interim Behaviour | Top-level "Interim Behaviour" section (this file); per-domain notes now reference it |
| 8 | TW-F2 (major): rename `invalid-options`→`invalid-input` | REQ-AEC-07 renamed |
| 9 | TW-F3+QA-m6 (major): kebab-case rationale, design-gate | REQ-RLN-01 rationale + design-gated status |
| 10 | TW-F4 (major): discoverability REQs | REQ-FPS-05 (NEW) |
| 11 | TW-F5+BA-4+QA-m2 (major): bin CLI contract completion | REQ-TFO-04 scenarios .2–.6 (NEW) |
| 12 | QA-M3+SEC-m2 (major): RLN positive scenarios | REQ-RLN-01.2–.4 (NEW scenarios) |
| 13 | QA-M4+BA-5 (major): RBV-03 warn semantics | REQ-RBV-03 — dropped "first run", pinned stateless every-run |
| 14 | QA-M5 (major): non-destructive compare clause | REQ-SCP-01.4 (NEW scenario) |
| 15 | SEC-M1+QA-m1 (major): TFO-03 static proof scenarios | REQ-TFO-03.3 (NEW scenario) |
| 16 | SEC-M2 (major): FIT-14 → tarball contents | REQ-FPS-02.2 (NEW scenario) |
| 17 | SEC-M3 (major): template-syntax values opaque | REQ-RBV-01.8 (NEW scenario) |
| 18 | QA-M2 (major): null/undefined/"" trichotomy | REQ-RBV-01.7 (NEW scenario) |
| 19 | BA-2 (minor): RBV-01.1 author-observable outcome | REQ-RBV-01.1 amended |
| 20 | BA-3 (minor): SCP-01.1 author-seat reframe | REQ-SCP-01.1 reframed |
| 21 | BA-6 (minor): nonsensical type value | REQ-SCP-02.4 (NEW scenario) |
| 22 | TW-F6 (minor): reserved-name namespace note | REQ-FPS-05 note |
| 23 | TW-F7 (minor): RBV-03 channel/string pin | REQ-RBV-03 — channel (stderr) + required-substrings pinned; exact literal deferred to design |
| 24 | TW-F8+QA-m5 (minor): glossary + scenario splits | Top-level Glossary (this file); REQ-SCP-02.1/.2 split; REQ-RLN-03.1/.2 split |
| 25 | SEC-m1 (minor): path-shaped values scoping note | Cross-cutting note 2 amended; `run-boundary-input-validation` Purpose amended |
| 26 | QA-m3 (minor): RBV-01.4 fold/justify | REQ-RBV-01.4 — kept distinct, justification prose added |

All 26 findings are applied — none flagged not-applied.

## REQ-ID Stability (V2 vs V1)

- **Preserved: ALL V1 IDs** — REQ-TFO-01..04, REQ-SCP-01..02, REQ-RBV-01..03,
  REQ-RLN-01..03, REQ-FPS-01..04, REQ-AEC-07..08 (20 of 20).
- **Modified content (IDs stable)**: REQ-TFO-03 (+ static parse-as-data scenario),
  REQ-TFO-04 (+ success/stderr/locator/non-destructive/author-vocabulary scenarios),
  REQ-SCP-01 (digest mechanism replaces text-diff; non-destructive clause; author-seat
  reframe), REQ-SCP-02 (+ prototype-pollution-key hard-fail, + nonsensical-type hard-fail,
  scenario split), REQ-RBV-01 (+ .6/.7/.8 scenarios, clarifying prose on .1/.4),
  REQ-RBV-02 (now references REQ-AEC-09's template row instead of parallel prose),
  REQ-RBV-03 (dropped "first run" → stateless every-run; channel pinned), REQ-RLN-01
  (design-gated status + kebab-case rationale + 3 new scenarios), REQ-RLN-02 (references
  REQ-AEC-09's reserved-name template row), REQ-RLN-03 (scenario split), REQ-FPS-02
  (+ tarball scenario), REQ-AEC-07 (renamed `invalid-options` → `invalid-input`).
- **Newly added**: REQ-TFO-05 (write containment), REQ-RBV-04 (canary-seeded no-echo
  verification), REQ-RBV-05 (fail-closed malformed/empty schema), REQ-FPS-05
  (discoverability), REQ-AEC-09 (4th/5th message-template rows).
- **Marked REMOVED**: none.

Total REQ-IDs in V2: 25 (20 preserved + 5 new) across 6 domains.

## Next Step

Surface V2 to human for review (owner sign-off). If approved, orchestrator marks
status=signed and proceeds to `sdd-design`. If feedback given, orchestrator re-invokes
`sdd-spec` with feedback. Do NOT sign at V2 per this task's instruction.
