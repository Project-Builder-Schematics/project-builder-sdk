# Specs: stage-1-ir-bedrock

**Spec version**: V2
**Status**: signed (owner, 2026-07-04)
**Change**: `stage-1-ir-bedrock`
**Triage**: L

V2 — council feedback (BA + QA, blind) applied as scenario-level refinements; no re-scoping.
**UNSIGNED**, pending human review. Five domains: 2 MODIFIED (delta specs against existing
main specs), 3 NEW (full specs).

## Upstream Ingest / Sync

`spec_source: internal` — Step 5b (upstream ingest) and Step 10b (upstream sync) do not
apply. This spec is authored directly from the proposal.

## Cross-Cutting Notes (read before reviewing individual domains)

1. **FIT-09 vs "FIT-10" naming.** Explore/proposal/triage all refer to the new port-guard
   requirement as "FIT-10." The FIT domain's own REQ-ID sequence in `foundations-skeleton`
   stops at REQ-FIT-08, so the stable requirement ID is **REQ-FIT-09**. The test FILE
   correctly stays `test/fitness/fit-10-*.test.ts` (10th file — `fit-09` is already claimed
   by `fit-09-pkg-exports-resolution.test.ts`, which tests REQ-PKG-01, not a FIT requirement).
   Design/apply/verify MUST cite REQ-FIT-09; do not invent a "REQ-FIT-10."
2. **Stage-boundary discipline.** Every rejection scenario in this spec is phrased at the
   seam (`emit(batch)` rejects / a `ContractFake`-compatible double rejects) — none asserts
   `AuthoringError` vocabulary or applied-boundary (`instructions[0]`) attribution reporting.
   That is Stage 2.1's contract, explicitly out of scope here (see proposal's Out of Scope).
3. **`docs/CONTRIBUTING.md` path typo.** The proposal's affected-areas table names
   `docs/CONTRIBUTING.md`; the real file is root-level `CONTRIBUTING.md`. Carried as a note
   in `test-pyramid-codification`'s spec — design/apply should target the real path.
4. **Objectives-plan reconciliation is housekeeping, not a REQ.** The proposal's "1.6 XS test
   debt batch" and "objectives-plan reconciliation" items (1.4 wording, Coverage O1 row 6,
   D8 decision-table row, phantom "ADR-0028"→0013/0017 citation fixes) carry no REQ-ID and no
   scenario in this spec — they are direct edits sdd-design/sdd-apply make against
   `openspec/objectives-plan.md` and the phantom-ADR comment sites, not testable requirements.
5. **FIT-10 allow-list mechanism deferred to design.** REQ-FIT-09 specifies WHAT must be
   allow-listed (the fake's one legitimate `EngineClient` import; `Directive`/`JsonValue`
   shared types) without prescribing HOW (path allow-list vs. structural exception) — that
   technical open question from explore is a design decision, not a spec decision.
6. **D8/ADR-0019 predicate is ratified, not open.** The exactly-at-cap-passes /
   one-byte-over-rejects boundary rule and the UTF-8-byte-length measurement are treated as
   ratified per the session's D8 decision (2026-07-04) — `batch-cap-contract` REQ-01 pins
   this directly; ADR-0019 formalizes the prose at design time.
7. **RED-posture taxonomy (labeled per requirement/scenario throughout).** Four postures:
   (a) **must-fail-first** — Strict TDD RED applies; the scenario fails against today's code
   (FAKE-07 rejection, FAKE-04 move collision rows, boundary REQ-01/02 round-trip+compare,
   batch-cap REQ-01, move-force in GIR-01/KIT-03);
   (b) **characterization / RED-waived** — behavior pre-exists; prove+freeze per the
   `typed-options-and-read` #2 precedent (GIR-03 determinism, batch-cap REQ-02 type pin,
   batch-cap REQ-03 empty batch, boundary REQ-04 conflict order);
   (c) **RED-PHASE GATE** — transient: proves a live bug against today's code, historical
   once the fix lands (REQ-10.2's double-fault proof against today's `context.ts`);
   (d) **PERMANENT string-fixture red-proof** — stays in the suite forever, scanning a
   fixture SOURCE STRING, never a committed poisoned module (REQ-FIT-09's planted bypass,
   like FIT-01/FIT-08).
8. **Identity exclusion is an ADR-0017 scope clarification.** `dst === src` is NOT a
   collision (REQ-FAKE-04.m4): the fail-closed destination check excludes identity; self-move
   is a file-preserving success. Rationale: colliding with yourself is not data loss; matches
   fs rename semantics. Design MUST fold this into ADR-0019 or an ADR-0017 amendment note.

## Domain: foundations-skeleton (MODIFIED)

> Full delta: `specs/foundations-skeleton/spec.md`. ADDED: REQ-GIR-02, REQ-GIR-03,
> REQ-FAKE-07, REQ-FIT-09. MODIFIED: REQ-GIR-01, REQ-FAKE-04, REQ-KIT-03.

### ADDED Requirements

#### REQ-GIR-02: Chained-handle Batch fixtures

The SUT is the FACTORY-PRODUCED batch captured (via `emit` spy) from a REAL `defineFactory`
run — comparison is run-output vs. the hand-written, committed fixture, never fixture vs.
itself. ≥1 Batch fixture per named chained-handle program; `instructions[]` deep-equals the
fixture, exact keys, in author order. [RED: must-fail-first — new fixture shape]

- GIVEN a real run calling `rename(path, newName)` then `.move(toDir)` on the returned
  handle, WHEN the emitted batch is compared to the `rename-then-move` fixture, THEN
  `instructions` deep-equals `[{op:"rename",...}, {op:"move",...}]` in order.
- GIVEN a real run calling `create(path, opts)` then `.modify(content)`, WHEN compared to
  the `create-then-modify` fixture, THEN `instructions` deep-equals
  `[{op:"create",...}, {op:"modify",...}]` in order.

#### REQ-GIR-03: Emission determinism proof + envelope key-order golden pin

[RED: characterization / RED-waived — determinism pre-exists; prove+freeze precedent #2]

Same factory + inputs run twice against fresh fakes → byte-identical serialized `Batch`
(`JSON.stringify` string equality, not `toEqual`). Self-consistency alone is insufficient —
the output ALSO MUST equal one committed golden byte-string, fixing envelope key order
`protocolVersion, force, instructions` literally in the pinned string.

- GIVEN a factory buffering ≥2 directives, WHEN run twice with fresh fakes, THEN
  `JSON.stringify(batch1) === JSON.stringify(batch2)`.
- GIVEN the same run, WHEN compared to the committed golden string constant, THEN it matches
  exactly, key order included.

#### REQ-FAKE-07: `modify` of a non-existent path errors — but staging counts as existence

[RED: must-fail-first for 07.1 (today's fake silently materializes); 07.2/07.3 are
green-path guards — 07.3 kills the seed-only existence-check mutant]

`modify` MUST require the target path to exist (staging `#tree` or `#seed`, not `#deleted`)
— it never materializes; creating is `create`'s job (ADR-0017 rule 2). Existence includes
paths created EARLIER IN THE SAME BATCH (eager array-order apply).

- REQ-FAKE-07.1: GIVEN empty seed/tree, WHEN `emit` carries `modify` on an untouched path,
  THEN it rejects AND the path is not present afterward.
- REQ-FAKE-07.2: GIVEN seeded path P, WHEN `emit` carries `modify` on P, THEN it succeeds.
- REQ-FAKE-07.3: GIVEN an EMPTY seed, WHEN `emit` carries one batch
  `[create("X", content1), modify("X", content2)]`, THEN it succeeds AND reading `X`
  returns `content2` — the existence check consults staging, not only the seed.

#### REQ-FIT-09: Structural `EngineClient` port guard

(Naming note — see cross-cutting note 1: REQ-FIT-09, file `test/fitness/fit-10-*.test.ts`.)
[RED: the planted-bypass red-proof is a PERMANENT string-fixture test, like FIT-01/FIT-08 —
never a transient gate, never a committed poisoned module]

No module under `src/**` OUTSIDE `src/core` MUST name `EngineClient` or call a
`.emit(`/`.commit(`/`.discard(` site reachable from it. ALLOW-LISTED:
`test/support/contract-fake.ts`'s legitimate `EngineClient` import; `Directive`/`JsonValue`
exempt everywhere (data shapes, not the port). Allow-list mechanism deferred to design.

- GIVEN a planted-bypass fixture (string fixture) outside `src/core` importing
  `EngineClient` and calling `.emit(...)`, WHEN scanned, THEN it is flagged.
- GIVEN `test/support/contract-fake.ts`'s real source, WHEN scanned, THEN NOT flagged.
- GIVEN a fixture importing only `Directive`/`JsonValue`, WHEN scanned, THEN NOT flagged.
- GIVEN today's `src/commons/index.ts`/`src/conformance/index.ts`, WHEN scanned, THEN both
  pass clean.

### MODIFIED Requirements

#### REQ-GIR-01: Golden-IR per op, exact-key

[RED: move force-present fixture is must-fail-first (`MoveArgs` has no `force` today);
force-absent fixtures are characterization pins]

Each op deep-equals (exact keys, no extras) a committed fixture. `create` proves the
template unrendered. `remove`→`op:"delete"`; `rename`={path,newName}±force;
`move`={path,toDir}±force; `copy`={from,to}±force (shape-only). Envelope ordered. Never
auto-recorded. Six ops × ≥1 fixture; `rename`/`move`/`copy` each force-present AND
force-absent (`move`'s force fixture is new — ADR-0017 closure).

- GIVEN `factory.move({path, toDir, force: true})`, THEN the directive includes
  `force: true` — no extra keys.
- GIVEN `factory.move({path, toDir})`, THEN the directive omits `force` entirely.

(Previously: `move` had no `force` key anywhere — pins the ADR-0017 wire addition.)

#### REQ-FAKE-04: Fail-closed + force precedence (all 3 rows) — `move` joins; identity excluded

[RED: move collision rows are must-fail-first — today's fake silently overwrites on move;
existing create/rename/copy rows stay pinned green]

`effective = envelope.force OR op.force`. `create`/`rename`/`copy`/`move` over an existing
target → error unless `effective`; 3 rows asserted for all four verbs. **Identity exclusion
(ADR-0017 scope clarification)**: `dst === src` is NOT a collision — self-move is a
file-preserving success, no force required (see cross-cutting note 8).

- REQ-FAKE-04.m1: GIVEN seed `"src/foo.ts"` + `"lib/foo.ts"` (dst exists), WHEN `emit`
  carries `move("src/foo.ts", "lib")` with no force, THEN it REJECTS AND `"lib/foo.ts"`
  keeps its original content AND `"src/foo.ts"` is still present.
- REQ-FAKE-04.m2: same seed, WHEN move has `force: true` on the op, THEN it succeeds —
  dst holds source content, src reads absent.
- REQ-FAKE-04.m3: same seed, WHEN envelope `force: true` and op force absent, THEN it
  succeeds (Row 3).
- REQ-FAKE-04.m4: GIVEN only `"src/foo.ts"` seeded, WHEN `move("src/foo.ts", "src")`
  (dst === src) with NO force, THEN it succeeds AND content is preserved.

(Previously: only `create`/`rename`/`copy` participated; `move` silently overwrote with no
check at all — ADR-0017 closes this gap. Identity exclusion is new scope clarification.)

#### REQ-KIT-03: `DirectiveFactory` — pure, ADR-0028 shapes, AST-blind

[RED: move-with-force scenarios (free function AND both handle forms) are must-fail-first —
no `force` exists on any move surface today]

One pure method per wire op, exact ADR-0028 shapes, no rendering/AST. Author surface
(frozen): `find`, `create(..., force?)`, `modify`, `remove`, `rename(..., {force?}?)`,
`move(path, toDir, {force?}?)`, `copy(..., {force?}?)`. Handle write-ops mirror the free
functions 1:1 — `WritableHandle.move` AND `FoundHandle.move` gain
`move(toDir, opts?: {force?: boolean})` matching `.rename`/`.copy`.

- REQ-KIT-03.1: GIVEN `move(path, toDir, {force: true})`, THEN `factory.move` receives
  `{path, toDir, force: true}` and the wire directive carries `force: true`.
- REQ-KIT-03.2: GIVEN a `WritableHandle` calling `.move(toDir, {force: true})` AND
  separately a `FoundHandle` calling `.move(toDir, {force: true})`, THEN BOTH wire
  directives carry `force: true` (kills the free-function-only threading mutant).
- REQ-KIT-03.3: GIVEN `move(path, toDir)` and `handle.move(toDir)` on either handle form
  (no opts), THEN each wire directive omits `force` entirely.

(Previously: `move`/`.move` had no `force` parameter anywhere on the author surface —
closes ADR-0017's wire-vs-surface gap; FIT-04 confirms additive-only.)

---

## Domain: commit-discard-contract (MODIFIED)

> Full delta: `specs/commit-discard-contract/spec.md`. ADDED: REQ-10.

### ADDED Requirements

#### REQ-10: Double-Fault Error Preservation — Discard Rejection Does Not Replace the Original Error

[Layer: **integration** — real `defineFactory` → `context.ts` → `Session` → `discard()`,
unmocked except the discard-rejecting client double; MUST NOT be hollowed to a mocked unit
test. RED: REQ-10.2 is a RED-PHASE GATE — transient, historical once the fix lands.]

Factory throws E1 AND `discard()` rejects with E2 → the runner MUST reject with E1 (E2
neither replaces nor is swallowed); `E1.cause` is E2.

- REQ-10.1: GIVEN a factory buffering one directive then throwing E1, AND a client double
  whose `discard()` rejects with E2, WHEN the runner executes (full integration path), THEN
  it rejects with E1 and `E1.cause` is E2.
- REQ-10.2 (RED-PHASE GATE): GIVEN the same fixture, WHEN run against TODAY'S `context.ts`
  (no try/catch around `discard()`), THEN the test fails red (E2 replaces E1) before the
  fix lands — proving W6 live.
- REQ-10.3 (contrast): GIVEN a factory throwing E1 and a normally-resolving `discard()`,
  THEN E1 propagates unchanged with `E1.cause === undefined`.

---

## Domain: batch-cap-contract (NEW)

> Full spec: `specs/batch-cap-contract/spec.md`.

Cap = 4 MiB via `Buffer.byteLength(JSON.stringify(batch), 'utf8')`, enforced at the fake's
`emit` only (never `Session.flush` — ADR-0018). Wire content fields are type-constrained to
`string` (text-only v1; ADR-0019 carries the binary-posture prose).

- **REQ-01** [RED: must-fail-first]: exactly-at-cap passes; one-byte-over rejects. Boundary
  fixtures sized against the SERIALIZED batch and constructed so JSON-escaping overhead
  makes a raw-content measurer reach the WRONG verdict on the over-cap fixture (raw total
  < cap < serialized total, asserted as a fixture property — kills the
  raw-content-measurement mutant); multi-byte payload mandatory in both. `Session.flush`
  performs no size check of its own.
- **REQ-02** [RED: characterization/RED-waived]: `modify.content`/`create.template` pinned
  as exactly `string` at type level (`expectTypeOf` + FIT-04 `.d.ts` baseline) — replaces
  V1's unobservable "no binary code path" scenario with a positive, testable pin.
- **REQ-03** [RED: characterization/RED-waived]: a zero-directive factory still commits —
  the assertion observes the `commit()` INVOCATION via spy (count exactly 1, `emit` count
  0), not merely that the run resolves. Zero production change; prove+freeze precedent #2.

---

## Domain: boundary-pass-through (NEW)

> Full spec: `specs/boundary-pass-through/spec.md`.

Models ADR-0018: the fake JSON-round-trips each batch at `emit`, COMPARING pre/post (not
merely trusting a non-throw) so silent value-dropping surfaces as a rejection. Paths pass
through verbatim on the emitted wire directive; intra-batch conflicts resolve in author
order.

- **REQ-01** [RED: must-fail-first]: round-trip comparison at `emit`; a structural mismatch
  rejects; clean batches apply normally (false-rejection guard).
- **REQ-02** [RED: must-fail-first]: BOTH non-serializable families reject — silent-drop
  family (function, `undefined`, `Symbol` — only the pre/post comparison catches these) AND
  stringify-throw family (BigInt, circular — surfaced as `emit` rejection, not an uncaught
  crash). All smuggled past `JsonValue` via `any`.
- **REQ-03**: paths verbatim, scoped to the EMITTED WIRE DIRECTIVE (captured at `emit`) —
  NOT the fake's internal tree resolution; the fake's `posix.join`/`dirname`/`basename`
  destination bookkeeping for move/rename is legitimate and unchanged.
- **REQ-04** [RED: characterization/RED-waived — pins today's eager array-order behavior]:
  `[create X, delete X]` → X absent; `[delete X, create X]` → X present.

---

## Domain: test-pyramid-codification (NEW)

> Full spec: `specs/test-pyramid-codification/spec.md`.
> RED posture: REQ-01..03 are doc/CI structural checks (naturally red until authored);
> REQ-04 is characterization through a new test file.

- **REQ-01**: `CONTRIBUTING.md` (root-level — see cross-cutting note 3) maps unit/fitness/
  integration/e2e each to a real, populated test directory.
- **REQ-02**: a verb/dialect-authoring decision table (new verb / new fitness invariant /
  cross-module behavior / full author story → layer).
- **REQ-03**: CI's `bun test` invocation demonstrably covers every mapped directory.
- **REQ-04**: ≥1 named e2e test under `test/e2e/` drives factory → `defineFactory` → seeded
  `ContractFake` → asserted golden committed-tree end state.

---

## REQ-ID Stability (V2 vs V1)

All V1 REQ-IDs preserved — no ID lost, none reused, none re-domained. V2 changes are
scenario-level additions/rephrasings within existing IDs:

| Domain | ADDED | MODIFIED | REMOVED |
|---|---|---|---|
| foundations-skeleton | REQ-GIR-02, REQ-GIR-03, REQ-FAKE-07, REQ-FIT-09 | REQ-GIR-01, REQ-FAKE-04, REQ-KIT-03 | none |
| commit-discard-contract | REQ-10 | none | none |
| batch-cap-contract (new domain) | REQ-01, REQ-02, REQ-03 | — | — |
| boundary-pass-through (new domain) | REQ-01, REQ-02, REQ-03, REQ-04 | — | — |
| test-pyramid-codification (new domain) | REQ-01, REQ-02, REQ-03, REQ-04 | — | — |

Scenario deltas V1→V2: foundations-skeleton +6 (FAKE-07.3; FAKE-04.m1–.m4 made explicit
inline, of which .m4 identity is new behavior; KIT-03.2 both-handles force); batch-cap
REQ-02.1 replaced (type-level pin), REQ-01.2/03.1 strengthened; boundary +1 (REQ-02.2
undefined/Symbol), REQ-03.1 rescoped to the emitted directive.

## Sensitive Areas Coverage

None. Checked against `openspec/sensitive-areas.md` (auth, payments, privacy, security,
deployment, data migration) — no requirement in this spec touches any of them, matching
triage's and explore's evaluation. No `sensitive-area` halt routing triggered.

## Drift Check Results

Not applicable — `spec_source: internal` (Step 9b skipped).

## Feedback Applied (V2)

Council review (BA + QA, blind) — all items applied:

1. batch-cap REQ-02.1 rephrased from unobservable absence-of-code-path to a positive
   type-level pin (`string` constraint via `expectTypeOf` + FIT-04 baseline); binary-posture
   prose delegated to ADR-0019. REQ-02 retained as a REQ (honest testable form exists).
2. REQ-FAKE-04 gained explicit inline GWT scenarios REQ-FAKE-04.m1 (move no-force collision
   REJECTS, must-fail-first) and .m2/.m3 (force success rows).
3. Move-to-same-directory pinned: REQ-FAKE-04.m4 — `dst === src` is not a collision,
   self-move is file-preserving success; flagged as ADR-0017 scope clarification for design
   (cross-cutting note 8).
4. batch-cap REQ-01 boundary fixtures re-specified against the SERIALIZED batch with the
   escaping-overhead constraint that makes a raw-content measurer verdict-flip on the
   over-cap fixture (asserted as a fixture property); multi-byte stays mandatory.
5. REQ-FAKE-07.3 added: intra-batch `[create X, modify X]` SUCCESS — existence check
   consults staging, kills the seed-only mutant.
6. RED posture labeled per requirement/scenario across all five domains; taxonomy in
   cross-cutting note 7 (must-fail-first / characterization-waived / RED-PHASE GATE /
   PERMANENT string-fixture).
7. Cross-cutting notes renumbering: the duplicate "2." present in the file the council
   reviewed was corrected; V2 verifies sequential 1–8 (now including new notes 7–8).

Also folded in (same reviews):
- REQ-KIT-03.2: `handle.move(toDir, {force:true})` threads force on BOTH WritableHandle and
  FoundHandle forms.
- boundary REQ-03 scoped explicitly to the EMITTED WIRE DIRECTIVE, exempting the fake's own
  join/dirname bookkeeping.
- batch-cap REQ-03.1 asserts the `commit()` INVOCATION via spy, not mere resolution.
- REQ-GIR-02 states the SUT is the factory-produced batch captured from a real run vs. the
  hand-written fixture (no fixture-vs-itself tautology).
- REQ-10 layer pinned as integration (unmocked path), cannot be hollowed to a mocked unit.
- boundary REQ-02 mismatch-reject set extended with `undefined` and `Symbol` (silent-drop
  family), separated from the stringify-throw family (BigInt/circular).
