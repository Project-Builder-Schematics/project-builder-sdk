# Delta for Conformance Fixtures

**Spec version**: V2
**Status**: draft
**Change**: `copy-copyin-conformance-fixtures`

**V1 → V2 (council feedback incorporated, 2026-07-22)**: owner ruling extends REQ-CFX-16 with a
5th engine-plane case (`dest-dir-twin`) — `m2-copyin` is now 5 cases; branch-held totals become
7 fixtures / 23 cases (`main` stays 6 fixtures / 18 cases after `m2-copy` lands). QA: REQ-CFX-16
now pins every seed/`assets/`/expected byte, mirroring REQ-CFX-15's precision. BA: REQ-CFX-15.6
(and every scenario in 15.2-15.6 / 16.2-16.5) reworded to the declared-artefacts framing — no
runtime-verb language ("applied"), consistent with REQ-CFX-11's honesty boundary. TW (verified
with evidence): REQ-CFX-17 + REQ-CFX-03 corrected — `fit-40`'s clause-(e) check is a prefix
regex that stays green whether or not `copy` is present, so the regex itself must now tighten
per landing step; REQ-CFX-17 records which SDK docs are NOT sync sites and why; REQ-CFX-03's
branch-hold guidance is marked spec-internal, never on-`main` comment text. REQ-CFX-12's
`writtenPaths` parenthetical tightened (path novelty is irrelevant; only the schematic-lowering
staging mechanism governs). REQ-CFX-16 gains a token-PRESENCE assertion requirement for
verbatim-content (byte-equality alone is tautological) and a note on `m2-copyin`'s deliberate
single-token id form. Followups gains the pre-existing SDK-verb-docs drift breadcrumb. All
REQ-IDs preserved; no IDs added or removed relative to V1 in this file — REQ-CFX-15/16/17 content
extended, REQ-CFX-02/03/12/13 content corrected.

## ADDED Requirements

### REQ-CFX-15: `m2-copy` Behavioral Contract (owner ruling 1, 2026-07-22)

`class: wire-mutation`, `lowering: none`. Seed: `src.txt = "payload"`, `occupied.txt = "taken"`,
`adir/child.txt = "x"` (mirrors `m2-rename-move`'s seed, ADR-0065 per-case `factory` override).
UNLIKE `rename`/`move`, `copy`'s positive case MUST leave the source path INTACT — the
destination receives a byte-identical copy; the source is NEVER removed. `writtenPaths` pin:
REQ-CFX-12 (`[]` for every case — pure wire-mutation, no schematic lowering, per ruling 3(a)).

| Case | exitCode | emitRejectionCode | failedIndex | expected | notes |
|---|---|---|---|---|---|
| positive | 0 | null | null | `dst.txt="payload"`, `src.txt="payload"` (unchanged), `occupied.txt="taken"`, `adir/child.txt="x"` | source survives the copy |
| collision-with-force | 0 | null | null | `occupied.txt="payload"` (overwritten), `src.txt` unchanged | `force:true` targets an existing destination |
| collision-no-force-twin | 2 | `collision` | 0 | `"zero-effect"` | dest = `occupied.txt`, no `force` |
| missing-source-twin | 2 | `not-found` | 0 | `"zero-effect"` | source = `missing.txt` |
| dir-source-twin | 2 | `unrepresentable` | null | `"zero-effect"` | source = `adir` (a directory) |
| copy-then-modify | 0 | null | null | final dest bytes = the MODIFY directive's content, never the copy's | ONE batch, two directives: `copy(src→dst2)` then `modify(dst2,…)`; intra-batch apply is STRICTLY SEQUENTIAL in array order (engine-confirmed, ruling 3(b)) — proves array-order collapse, not a race |

#### Scenario REQ-CFX-15.1: Positive case declares an exact-bytes copy, source intact

- GIVEN `m2-copy`'s manifest + seed (`src.txt = "payload"`) + `expected/`
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN `outcome.exitCode: 0`, `expected/dst.txt` byte-equals `"payload"`, `expected/src.txt`
  ALSO byte-equals `"payload"` (source never removed) — a DECLARATION (REQ-CFX-11)

#### Scenario REQ-CFX-15.2: Collision-with-force overwrites and exits 0

- GIVEN the collision-with-force case targets existing `occupied.txt` with `force:true`
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN the manifest declares `outcome.exitCode: 0`, `expected/occupied.txt` byte-equals the
  source's content — a DECLARATION (REQ-CFX-11)

#### Scenario REQ-CFX-15.3: Collision-no-force twin rejects fail-closed

- GIVEN the collision-no-force-twin targets existing `occupied.txt`, no `force`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "collision"`,
  `failedIndex: 0`, `expected: "zero-effect"`

#### Scenario REQ-CFX-15.4: Missing-source twin rejects not-found

- GIVEN the missing-source-twin's source path does not exist in the seed
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "not-found"`,
  `failedIndex: 0`, `expected: "zero-effect"`

#### Scenario REQ-CFX-15.5: Directory-source twin rejects unrepresentable

- GIVEN the dir-source-twin's source is `adir` (a directory)
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "unrepresentable"`,
  `failedIndex: null` (batch-level), `expected: "zero-effect"`

#### Scenario REQ-CFX-15.6: Copy-then-modify collapses to the modify's bytes (declaration, not a runtime claim)

- GIVEN a single batch authoring `copy(src→dst2)` immediately followed by
  `modify(dst2, "final")` in the SAME array
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN the manifest declares `outcome.exitCode: 0`, `expected/dst2.txt` byte-equals `"final"`
  (the modify's content, never the copy's intermediate bytes) — the collapse is a DECLARATION
  traced from the engine-confirmed sequential array-order fact (ruling 3(b)), not an SDK-run
  proof; one flush, `singleCommit: true`

### REQ-CFX-16: `m2-copyin` Behavioral Contract — Engine-Plane Cases Only (owner ruling 2, extended 2026-07-22)

`class: wire-mutation`, `lowering: none`. Structurally novel: introduces a PACKAGE-LOCAL
in-fixture source directory (`assets/`) — the bytes `copyIn` references live INSIDE the fixture
package itself, resolved against `packageDir` = the fixture's own directory. [SEAM] The engine's
Go fixture loader treats unknown files/dirs inside a fixture dir as INERT (engine-confirmed,
ruling 3(c)) — an in-fixture `assets/` source needs ZERO schema changes; flagged for engine-team
awareness, same posture as `conformance-corpus` REQ-CCR-08's `collection.json` note. 5
engine-plane cases are in scope (extended from 4 by the 2026-07-22 owner-ruling addition of
`dest-dir-twin`) — SDK-plane twins remain explicitly DESCOPED (see Followups; a deliberate,
recorded exclusion, never a silent gap). The fixture id `m2-copyin` is DELIBERATELY a single
token — `copyIn` is ONE verb, not a compound `copy` + `in` operation — a future reader MUST NOT
"correct" it to `m2-copy-in`, which would falsely echo the two-op `m2-rename-move` fixture's
naming shape (that fixture names two DISTINCT verbs; this one names one).

**Fixture layout (bytes pinned to the exact byte, mirroring REQ-CFX-15's precision)**:

- `assets/payload.txt = "by-reference-payload"` — package-local by-reference source (used by
  `positive`, `collision-with-force`, `dest-dir-twin`)
- `assets/verbatim.txt = "Hello {= name =}!"` — contains a literal template-token sequence in
  the `folder-scaffold` REQ-FSC-05 syntax (ground truth: REQ-FSC-05's token-translation form is
  `{= x =}` / `{= x | filter =}`), used only by `verbatim-content`
- `seed/occupied.txt = "taken"` — pre-existing destination for the collision cases
- `seed/existing-dir/child.txt = "x"` — a pre-existing DIRECTORY at the path `dest-dir-twin`
  targets as its destination

| Case | exitCode | emitRejectionCode | failedIndex | expected | notes |
|---|---|---|---|---|---|
| positive | 0 | null | null | `dst.txt = "by-reference-payload"`; `occupied.txt`/`existing-dir/child.txt` unchanged | dest is a genuinely NEW path — see REQ-CFX-12 |
| verbatim-content | 0 | null | null | `dst2.txt = "Hello {= name =}!"` byte-identical, token present verbatim | proves REQ-CCL-04's documented escape; fit-40 MUST assert token PRESENCE in both source and expected — byte-equality alone is tautological (Scenario .2) |
| collision-with-force | 0 | null | null | `occupied.txt = "by-reference-payload"` (overwritten) | `force:true` |
| collision-no-force-twin | 2 | `collision` | 0 | `"zero-effect"` | dest = `occupied.txt`, no `force` |
| dest-dir-twin | 2 | `collision` | 0 | `"zero-effect"` | dest = `existing-dir` (an existing DIRECTORY in seed) — owner-confirmed: the engine treats a directory destination as a DESTINATION COLLISION, indexed to directive 0, NOT `unrepresentable` |

**This is `copyIn`'s ONLY engine-plane rejection twin.** `copyIn` has NO `unrepresentable`-coded
twin in this corpus, unlike `m2-copy`'s directory-SOURCE case — a reviewer MUST NOT read that
absence as a gap: a directory SOURCE is rejected SDK-side pre-emit (source-side,
`authoring-rejected`, descoped below, never reaches the engine), while a directory DESTINATION
is the one case that DOES reach the engine, and the engine resolves it to `collision`, never
`unrepresentable`.

**Descope note (owner ruling 2, non-gating)**: SOURCE-side rejections
(containment-escape, missing-source, a directory SOURCE) are SDK-plane — declared
`(1,null,null,[])` + empty transcript, `AuthoringError.origin: "authoring-rejected"` before any
emit — and remain explicitly DESCOPED from this corpus (see Followups). Only the
DESTINATION-side cases (collision-with-force/no-force/dest-dir) are engine-plane and therefore
fixture-worthy.

`writtenPaths` pin: REQ-CFX-12 (`[]` for every exit-0 case, including `positive`, whose
destination is a genuinely new path — see REQ-CFX-12's tightened governing clause).

#### Scenario REQ-CFX-16.1: Positive case declares by-reference bytes landing at a new path

- GIVEN `m2-copyin`'s manifest + `assets/payload.txt = "by-reference-payload"` + `expected/`
- WHEN the fixture's declared artefacts are inspected (structural, no runner spawn)
- THEN the manifest declares `outcome.exitCode: 0`, `expected/dst.txt` byte-equals
  `"by-reference-payload"`, `outcome.writtenPaths: []` — a DECLARATION (REQ-CFX-11); the first
  real proof is the engine's Go harness at pin-advance

#### Scenario REQ-CFX-16.2: Verbatim-content case declares the token present, unrendered, in BOTH source and expected

- GIVEN `assets/verbatim.txt = "Hello {= name =}!"` (a REQ-FSC-05-shaped token)
- WHEN the fixture's declared artefacts are inspected
- THEN `expected/dst2.txt` is byte-IDENTICAL to the source AND both are asserted to contain the
  literal `{= name =}` sequence — token PRESENCE, not byte-equality alone (an
  `expected == source` check alone would pass even for an unrelated file pair; the token proves
  by-reference bypasses the by-value template engine that would otherwise have rendered it)

#### Scenario REQ-CFX-16.3: Collision-with-force overwrites and exits 0

- GIVEN the collision-with-force case targets existing `occupied.txt = "taken"` with
  `force:true`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 0`, `expected/occupied.txt` byte-equals
  `"by-reference-payload"`

#### Scenario REQ-CFX-16.4: Collision-no-force twin rejects fail-closed

- GIVEN the collision-no-force-twin targets existing `occupied.txt`, no `force`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "collision"`,
  `failedIndex: 0`, `expected: "zero-effect"`

#### Scenario REQ-CFX-16.5: Dest-dir twin rejects as a collision, never unrepresentable

- GIVEN the dest-dir-twin targets `existing-dir`, a pre-existing DIRECTORY in `seed/`
- WHEN the fixture's declared artefacts are inspected
- THEN the manifest declares `outcome.exitCode: 2`, `emitRejectionCode: "collision"`
  (owner-confirmed engine behaviour — NOT `unrepresentable`), `failedIndex: 0`,
  `expected: "zero-effect"`

### REQ-CFX-17: Representable-Ops Sync Sites — Consistency and Branch-Hold Two-Step

Widening the corpus's representable-ops set MUST update, in the SAME commit that widens it,
every site that ENFORCEABLY documents the current op set: (a) `conformance/README.md`'s
representable-ops sentence; (b) `m2-create-composition/factory.ts`'s DO-NOT-COPY clause (e)
("what to copy instead", REQ-CFX-03); (c) `fit-40`'s clause-(e) consistency check — which MUST
itself be TIGHTENED in the same commit, not merely re-read. `fit-40`'s existing clause-(e) check
(`test/fitness/fit-40-conformance-corpus-integrity.test.ts` ~line 296) is a PREFIX regex
(`/modify\/delete\/rename\/move/`) that matches a SUBSTRING of clause (e)'s text and therefore
stays green whether or not `copy`/`copyIn` are present — as WRITTEN TODAY its enforcement of a
widened set is illusory (verified by reading the check: it never asserts the ABSENCE of
anything, only the presence of the original four verbs). This change's landing steps MUST
tighten the regex alongside the clause text: the `m2-copy`-landing commit requires the regex to
positively match `copy`'s presence (e.g. `/move\/copy/` or equivalent), and `m2-copyin`'s
un-hold commit requires it to additionally match `copyIn`'s presence — widening clause (e)'s
prose WITHOUT correspondingly tightening the regex does NOT satisfy this REQ.

Because this change's two fixtures land on DIFFERENT schedules (REQ-CCR-09): `copy` MUST be
added to every sync site (README, clause (e) text, and its regex) in the SAME commit `m2-copy`
lands on `main`; `copyIn` MUST NOT be added to ANY sync site until the commit that un-holds
`m2-copyin` from its branch — a sync site claiming `copyIn` representable while `m2-copyin`'s
commit is still branch-held is a false declaration, worse than an omission.

**Not sync sites (verified, this REQ does NOT extend to them)**: the SDK's author-facing verb
docs — `docs/README.md:9`, `docs/quickstart.md` (Next Steps, ~line 179-180), and
`docs/authoring-verbs.md:9` — already enumerate `copy`/`copyIn` among the SDK's seven author
verbs. This is an AUTHOR-SURFACE enumeration (what verbs exist to call), NOT a
wire-representability contract (what this corpus declares the engine can actually land) — the
two claims serve different audiences, and holding the docs to this REQ's sync discipline would
conflate them. This is PRE-EXISTING drift (the docs already present `copyIn` as fully working
while it yields zero bytes pre-engine-inclusion), not introduced by this change — see Followups
for its disposition. `CONFORMANCE-CORPUS-HANDOFF.md:96-97` references "the representable-ops-only
quarantine" by NAME only, without enumerating the actual op list — it cannot go stale as the set
widens and is therefore not a sync site either.

#### Scenario REQ-CFX-17.1: `copy` lands in every sync site, regex included, with `m2-copy`'s commit

- GIVEN the commit that lands `m2-copy` on `main`
- WHEN README, the DO-NOT-COPY clause (e) text, and `fit-40`'s clause-(e) regex are read
- THEN all three name/match `copy` as representable, in that SAME commit — the regex change is
  not deferred to a later cleanup commit

#### Scenario REQ-CFX-17.2: `copyIn` is absent from every sync site while branch-held — enforced by commit sequencing, not a test guard

- GIVEN `main` at any point before `m2-copyin`'s un-hold commit merges
- WHEN the same three sync sites are read
- THEN none of them names/matches `copyIn` as representable — this is enforced ENTIRELY by
  which commits have merged (commit sequencing); NO `fit-40` assertion polices a
  must-NOT-appear guard for `copyIn`, and none should be assumed to exist

## MODIFIED Requirements

### REQ-CFX-02: Representable-Ops-Only, Exactly One Wire `create` Corpus-Wide

Across the whole corpus, factories MUST author only `modify`/`delete`/`rename`/`move`/`copy`/
`copyIn` via the public commons verbs — `copy` and `copyIn` join the representable set per this
change, subject to REQ-CFX-17's branch-hold two-step (`copyIn` is representable-in-declaration
but its landing commit stays branch-held until the engine's `copyIn` wire-inclusion is in
flight). EXACTLY ONE case in the entire corpus — `m2-create-composition`'s
`wire-create-reject-twin` — MAY emit a wire `create` directive, as a deliberate reject probe. No
other case may emit `create`.

(Previously: representable set was `modify`/`delete`/`rename`/`move` only. This change adds
`copy`/`copyIn` per owner ruling 1/2 (2026-07-22) — the `create` exception is unchanged.)

#### Scenario REQ-CFX-02.1: Only one create exists corpus-wide

- GIVEN every case across every fixture CURRENTLY listed in `corpus.json#fixtures` (a
  manifest-derived count, never a hardcoded literal — consistent with `conformance-corpus`
  REQ-CCR-05's generalization)
- WHEN each factory's emitted directive ops are inspected
- THEN exactly one case (`m2-create-composition/wire-create-reject-twin`) emits `create`

### REQ-CFX-03: DO-NOT-COPY Header on the Reject-Probe Factory

The code path authoring the raw wire `create` in `wire-create-reject-twin` MUST carry a comment
beginning `DO-NOT-COPY` that conveys, at minimum: (a) this deliberately violates REQ-CFX-02's
one-create-corpus-wide invariant; (b) it exists as a reject PROBE, not a template; (c) it MUST
NOT be imitated by any other fixture; (d) the engine REFUSES this batch (`unrepresentable`,
REQ-CFX-04) — the exact exit path is resolved by ADR-0064 (2/unrepresentable/null, emit-time);
(e) what to copy INSTEAD when authoring a new fixture — the positive case's
`modify`/`delete`/`rename`/`move`/`copy`/`copyIn` default-export pattern, widening IN STEP with
REQ-CFX-02's representable set (REQ-CFX-17) — before `copyIn` un-holds, a new fixture wanting the
by-reference shape copies `m2-copy`'s already-merged pattern, not `m2-copyin`'s held one. A
CLAUSE LIST, not frozen prose — the exact wording is an implementation choice as long as all
five points are conveyed.

(Previously: clause (e) named only `modify`/`delete`/`rename`/`move`. This change widens it to
include `copy`/`copyIn` per REQ-CFX-02's expanded representable set, with the branch-hold caveat
for `copyIn` specifically.)

**Branch-hold clarification (spec-internal only, TW, 2026-07-22)**: the parenthetical guidance
above about `copyIn`'s branch-hold status (REQ-CFX-17) is guidance for THIS SPEC's readers and
for whoever authors a FUTURE fixture — it is NEVER text that belongs in the on-`main`
`DO-NOT-COPY` comment itself. At the `m2-copy`-landing step, the shipped comment's clause (e)
names ONLY `modify`/`delete`/`rename`/`move`/`copy` — no mention of `copyIn`, no
planning/sequencing noise of any kind. The comment is an EXTERNAL, on-disk contract read by any
engine-team member browsing the file; it states current fact, never roadmap.

**Resolution note (archive-time, carried from V3)**: exit path resolved by ADR-0064; the shipped
comment's assertion cites that ADR and is consistent.

#### Scenario REQ-CFX-03.1: Reject-probe code is marked with all five clauses

- GIVEN `m2-create-composition/factory.ts`'s `wire-create-reject-twin` branch
- WHEN read
- THEN a `DO-NOT-COPY`-prefixed comment precedes the raw `create` authoring and conveys clauses
  (a) through (e) — clause (e) naming the CURRENT representable set at the time of reading,
  never a stale one

### REQ-CFX-12: `writtenPaths` Rule — Engine-Materialized Paths Only

`outcome.writtenPaths` for a case MUST list ONLY paths NEWLY MATERIALIZED on disk BY
ENGINE-SIDE SCHEMATIC-LOWERING STAGING (a schematic-lowered `create`) — this STAGING MECHANISM
is the ONLY governing clause. Every wire-mutation or by-reference-copy case
(`modify`/`delete`/`rename`/`move`/`copy`/`copyIn`) MUST NOT list ANY path in `writtenPaths`,
REGARDLESS of whether its destination path pre-existed or is genuinely NEW — e.g. `copyIn`'s
`positive` case creates a destination path that did NOT exist before the run, yet still
declares `writtenPaths: []`, because schematic-lowering staging never runs for a
`lowering: none` fixture. Pinned values, every positive-or-force-success case: `m1-vehicle` =
`["out.txt"]` (schematic-lowered create); `m2-modify`, `m2-delete`, `m2-rename-move`, `m2-copy`
(all exit-0 cases), `m2-copyin` (all exit-0 cases, INCLUDING `positive`'s new-path destination)
= `[]` (pure wire-mutation / by-reference, `lowering: none`); `m2-create-composition` =
`["generated.txt"]` exactly (schematic-lowered create).

(Previously: the pinned-values list did not include `m2-copy`/`m2-copyin` — added by this
change, engine-confirmed ruling 3(a). V2 also tightens the exclusion wording: it previously
described excluded paths as "of an already-seeded or already-materialized path", which could
mislead an author into believing `writtenPaths` tracks PATH NOVELTY. It does not — it tracks
ONLY whether the path was materialized via schematic-lowering staging. Corrected per QA review,
2026-07-22, using `m2-copyin`'s `positive` case — a genuinely NEW path with `writtenPaths: []`
— as the disambiguating example.)

#### Scenario REQ-CFX-12.1: Schematic-lowered positive case pins its materialized path

- GIVEN `m1-vehicle`'s positive case (schematic-lowered `out.txt`)
- WHEN `outcome.writtenPaths` is inspected
- THEN it equals `["out.txt"]` exactly

#### Scenario REQ-CFX-12.2: Pure wire-mutation/by-reference exit-0 cases pin an empty list regardless of path novelty

- GIVEN any exit-0 case of `m2-modify`, `m2-delete`, `m2-rename-move`, `m2-copy`, or
  `m2-copyin` (no schematic lowering) — including `m2-copyin`'s `positive` case, whose
  destination path did NOT exist before the run
- WHEN `outcome.writtenPaths` is inspected
- THEN it equals `[]` — path novelty is irrelevant; only schematic-lowering staging governs
  this field

### REQ-CFX-13: Transcript Oracle — Every Case Carries a Full `transcript` Object

For EVERY case (positive and negative twin) in EVERY fixture's `manifest.json`,
`cases[].transcript` MUST be present with the full shape: ordered `callbacks[]` (the
reverse-callback methods ISSUED during the run, in order, regardless of whether the response was
success or rejection — a rejected `ir.emit` still counts as issued), `singleCommit` (boolean),
`forbidDiscard` (boolean), `emitBeforeCommit` (boolean).

A REJECTED run does NOT simply halt at the rejected callback: `defineFactory`'s catch
(`src/core/context.ts` ~339-361, ADR-01, all-or-nothing teardown) unconditionally runs `await
ctx.session.discard()` on ANY error thrown by `fn`, `dialects.drain()`, `session.flush()`, or
`session.commit()` before re-throwing. `Session.discard()` (`src/core/session.ts`) delegates to
the client's `discard()`, which for `StdioEngineClient` (`src/transport/stdio-engine-client.ts`
~283-284) issues an `ir.discard` reverse callback. A rejected case's transcript therefore ends in
`ir.discard`, not in the rejected `ir.emit`. A batch carrying MULTIPLE directives that all
succeed (e.g. `m2-copy`'s `copy-then-modify` case, or `m2-create-composition`'s two composed
halves) is still flushed via a SINGLE `ir.emit` covering the whole directive array — the engine
applies the array's entries STRICTLY SEQUENTIALLY in array order (engine-confirmed, ruling 3(b))
— so `copy-then-modify`'s transcript has the SAME shape as any other single-commit positive case,
not a doubled `ir.emit`. `singleCommit` and `emitBeforeCommit` therefore pin `true` for all cases
in the corpus (vacuously true wherever the callback in question never occurs). `forbidDiscard`
pins `true` only for cases whose run reaches `ir.commit` without any prior rejection plus
`greeting-mismatch-twin` (decided pre-`defineFactory`) — it pins `false` for every case whose run
rejects mid-flight. `callbacks[]` and `forbidDiscard` both vary per case:

| Fixture / Case | `callbacks[]` | `forbidDiscard` |
|---|---|---|
| m1-vehicle / positive | `[tree.read, ir.emit, ir.commit]` | `true` |
| m1-vehicle / greeting-mismatch-twin | `[]` (decided pre-`defineFactory`, no session) | `true` |
| m2-modify / positive | `[ir.emit, ir.commit]` | `true` |
| m2-modify / not-found-twin | `[ir.emit, ir.discard]` | `false` |
| m2-delete / positive | `[ir.emit, ir.commit]` | `true` |
| m2-delete / not-found-twin | `[ir.emit, ir.discard]` | `false` |
| m2-delete / dir-target-twin | `[ir.emit, ir.discard]` | `false` |
| m2-rename-move / positive | `[ir.emit, ir.commit]` | `true` |
| m2-rename-move / collision-twin | `[ir.emit, ir.discard]` | `false` |
| m2-rename-move / dir-source-twin | `[ir.emit, ir.discard]` | `false` |
| m2-create-composition / positive | `[ir.emit, ir.commit]` | `true` |
| m2-create-composition / wire-create-reject-twin | `[ir.emit, ir.discard]` IF resolved to the exit-2 emit-time path; `[ir.discard]` IF resolved to the exit-1 authoring-time path (see REQ-CFX-09) | `false` (either resolution) |
| m2-copy / positive | `[ir.emit, ir.commit]` | `true` |
| m2-copy / collision-with-force | `[ir.emit, ir.commit]` | `true` |
| m2-copy / collision-no-force-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copy / missing-source-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copy / dir-source-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copy / copy-then-modify | `[ir.emit, ir.commit]` (ONE flush, two directives applied in array order) | `true` |
| m2-copyin / positive | `[ir.emit, ir.commit]` | `true` |
| m2-copyin / verbatim-content | `[ir.emit, ir.commit]` | `true` |
| m2-copyin / collision-with-force | `[ir.emit, ir.commit]` | `true` |
| m2-copyin / collision-no-force-twin | `[ir.emit, ir.discard]` | `false` |
| m2-copyin / dest-dir-twin | `[ir.emit, ir.discard]` | `false` |

`tree.read` appears ONLY in `m1-vehicle`'s positive case — no other factory in the corpus,
including `m2-copy`/`m2-copyin`, reads before authoring the directive.

(Previously: table did not include `m2-copy`/`m2-copyin` rows, and the prose did not describe
multi-directive single-flush sequencing. Both added by this change; the six pre-existing rows and
their rationale are unchanged. V2 adds the `m2-copyin / dest-dir-twin` row per the 2026-07-22
owner-ruling extension — a directive-level rejection, same shape as every other
directive-level twin in this table.)

#### Scenario REQ-CFX-13.1: A wire-mutation positive case's transcript is single-emit-single-commit

- GIVEN `m2-modify`'s positive case
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]`, `singleCommit: true`, `forbidDiscard: true`,
  `emitBeforeCommit: true`

#### Scenario REQ-CFX-13.2: A directive-level reject twin's transcript ends in a discard, not a halt

- GIVEN `m2-modify`'s not-found-twin
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]`, `singleCommit: true` (vacuously), `forbidDiscard:
  false`, `emitBeforeCommit: true` (vacuously)

#### Scenario REQ-CFX-13.3: A batch-level reject twin discards identically to a directive-level one

- GIVEN `m2-delete`'s `dir-target-twin` (batch-level `unrepresentable`, `failedIndex: null`)
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.discard]` and `forbidDiscard: false`, identically to a
  directive-level twin

#### Scenario REQ-CFX-13.4: wire-create-reject-twin discards under either exit-path resolution

- GIVEN `m2-create-composition`'s `wire-create-reject-twin`
- WHEN `cases[].transcript` is inspected under EITHER candidate resolution
- THEN `ir.discard` is present as the LAST callback in both cases and `forbidDiscard: false` in
  both

#### Scenario REQ-CFX-13.5: A two-directive positive batch is a single flush, not a doubled emit

- GIVEN `m2-copy`'s `copy-then-modify` case (one batch, `copy` then `modify` on the same dest)
- WHEN `cases[].transcript` is inspected
- THEN `callbacks = [ir.emit, ir.commit]` exactly once each — the two directives share ONE
  flush, applied sequentially in array order (ruling 3(b)), never two `ir.emit` calls

## Followups

- **SDK-plane `copyIn` twins verification (non-gating, descoped by owner ruling 2)**: this
  corpus does NOT author `m2-copyin` cases for SOURCE-side rejections — containment-escape,
  missing-source, or a directory SOURCE (all would declare `(1,null,null,[])` + empty
  transcript — SDK-side, authoring-rejected, indistinguishable in this schema from each other,
  and duplicative of existing SDK unit coverage: `by-reference-copy-wire` REQ-BRC-06,
  `package-root-containment` REQ-PRC-04/07). The DESTINATION-side directory case
  (`dest-dir-twin`, REQ-CFX-16) is NOT part of this descope — it is engine-plane and IS
  authored. Followup: confirm SDK unit tests (not this corpus) exercise the three SOURCE-side
  rejection planes with the exact `(1,null,null,[])` outcome shape. Tracked as a pending-change
  row at archive, never read as a corpus coverage gap.
- **`m2-copyin` branch-hold re-validation**: see `conformance-corpus` REQ-CCR-09 for the
  un-hold trigger and the concrete re-validation checklist — this change authors `m2-copyin`
  fully but its landing is a SEPARATE done-definition from `m2-copy`'s.
- **Pre-existing SDK verb-docs drift (not introduced by this change)**: `docs/README.md`,
  `docs/quickstart.md`, and `docs/authoring-verbs.md` already present `copyIn` as a working
  author verb today, while it yields zero bytes on disk until the engine's `copyIn`
  wire-inclusion lands. This drift PRE-DATES this change (the docs enumerate all seven verbs
  uniformly, with no wire-representability caveat for any of them) and is explicitly OUT OF
  SCOPE here (REQ-CFX-17 confirms these docs are not sync sites). Disposition: at `m2-copyin`'s
  un-hold commit, add a "not yet wire-representable" honesty note to these docs' `copyIn`
  mentions — tracked now so this change is not later blamed for pre-existing doc drift it did
  not create.

## Sensitive Areas Coverage

None. `conformance/` is not in `openspec/sensitive-areas.md` (confirmed at triage, re-confirmed
at explore).
