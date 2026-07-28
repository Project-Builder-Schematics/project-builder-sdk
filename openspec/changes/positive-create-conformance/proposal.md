# Proposal: Positive Create Conformance

**Change**: `positive-create-conformance`
**Triage**: M
**Persona lens**: none
**Status**: SIGNED (merged mode — proposal doubles as spec)
**Spec status rationale**: auto-ratified against engine handoff obs #1695 per owner's
automatic-mode directive. Every REQ below traces to one of: the handoff's three verbatim
deliverables, the triage's ratified scope, or a verified in-repo constraint (ADR-0064,
ADR-0065, `checkCreateQuarantine`, REQ-TOE-01). The two genuinely undecided items (reject-twin
`force` disposition; case/export naming; `expected/` layout) are NOT frozen as requirements —
they are explicitly routed to `sdd-design` as ADR-bound scenarios (REQ-CFX-09.5 and the
provisional-name notes throughout), so signing this spec does not pre-empt them.

## Intent

The engine's `sdk-wire-create` change (engine repo, plan PR #185) makes the wire `create` op
generally representable and blocks the engine's conformance merge gate (PC-CREATE-02) until the
SDK corpus proves a positive create path with real SDK-emitted directives. Today the corpus
enforces the OPPOSITE: REQ-CFX-02 mandates exactly one wire-`create` case corpus-wide, and that
one case is a deliberate reject probe (`m2-create-composition/wire-create-reject-twin`) — zero
fixtures in `corpus.json` author an accepted `create()`. Without this change, the engine team
cannot advance its `third_party` submodule pin past the SDK commit that adds the positive
fixture, and its two gated conformance tests (cardinality + force-reject against a real corpus)
stay permanently skipped.

## Scope

### In Scope
- Amend `openspec/specs/conformance-fixtures/spec.md` REQ-CFX-02/02.1/03 to relax the
  create-cardinality invariant from "exactly one case, corpus-wide" to "any number of cases, but
  only inside `m2-create-composition/factory.ts`'s quarantine" (ADR-0064 untouched)
- Add ≥1 positive create case as a new named export in `m2-create-composition/factory.ts` +
  new case entry in `m2-create-composition/manifest.json`: composite (array/object) options
  exercising `encodeOptions`, `factory.export` ≠ null/`"createRejectProbe"`, `exitCode: 0`,
  `emitRejectionCode: null`, byte-exact declared path + content
- Extend REQ-CFX-09/12/13's pin tables for the new case; confirm `fit-40`'s
  `checkCreateQuarantine` needs zero code change (already generalizes per named-export block)
- Reword `conformance/README.md`'s "create appears exactly once" sentence and the DO-NOT-COPY
  comment's clause (a)/(e), keeping `fit-40`'s clause-(a) regex in sync in the SAME commit
  (mirrors REQ-CFX-17's sync-site discipline, applied to cardinality wording)
- If `sdd-design`'s ADR resolves that `wire-create-reject-twin` needs a `force: true` addition to
  remain a valid rejection under the new engine semantics (REQ-CFX-09.5), make that manifest +
  factory + ADR-0064 update as part of this same change

### Out of Scope
- Engine-side Go tests + submodule pin advance (engine repo)
- The `force`-removal followup (`wire.ts` `force?: boolean` type removal, `docs/create-templates.md`
  §"Overwrite behavior (force)" correction) — engine framed it as a separate, non-blocking
  concern; registered as its own `pending-changes.md` row, not built here
- BRC-08/PRC-06 hardening (engine-side)
- The typed-options feeder for array/object create options (already tracked at
  `pending-changes.md:472`) — this change's new fixture exercises `encodeOptions` under the
  CURRENT v1 JSON-string mechanism only
- `pending-changes.md:500` (session.buffer raw `{op:"create"}` shape scan, widening the
  invariant model beyond the named-export heuristic) — confirmed (via exploration) that this
  change's approach does not require or trigger that widening; the row stays OPEN, not closed

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `conformance-fixtures`: relax REQ-CFX-02/02.1/03's create-cardinality invariant from
  corpus-wide "exactly one" to "quarantined to one sanctioned file," add a positive create case
  to `m2-create-composition`'s behavioral contract (REQ-CFX-09/12/13 pin-table additions), and
  resolve (via `sdd-design` ADR) whether the existing reject twin needs a `force: true` update to
  stay valid under the engine's new create semantics.

## Approach

**Recommended: new case + second named export inside `m2-create-composition/factory.ts`** (the
7th use of the ADR-0065 per-case factory-override mechanism), NOT a new `corpus.json` fixture
id. This is the exploration's recommended approach and satisfies every handoff deliverable with
the smallest diff: `checkCreateQuarantine` (`test/support/conformance-validators.ts:207`) already
sums `create()` calls across every named-export block per module, so a second block in the SAME
file needs zero code change there; the file-level `SANCTIONED_SITE` scan
(`fit-40.test.ts:243`) stays a single literal path, needing zero code change either; no new
fixture id means no new `corpus.json` entry and no widening of the README's "site" sentence into
an actual second site. The rejected alternative — a new fixture id with its own directory — would
force `SANCTIONED_SITE` to become a real allow-list (genuine `fit-40` code change) and create the
literal second `create` site the README explicitly warns against, for no behavioral gain the
handoff requires.

Three items are deliberately carried forward as `sdd-design` inputs, not resolved here (per the
ratified scope): (a) whether `wire-create-reject-twin`'s factory needs `force: true` added to
stay a valid rejection once the engine's new semantics land — an ADR-grade tradeoff, encoded as
REQ-CFX-09.5's conditional scenario rather than frozen; (b) the new case/export's name — the
corpus's only naming convention (`<behaviour>Probe`/`<behaviour>-twin`) is twin-specific and
would mislead for a second POSITIVE case, so this proposal uses a PROVISIONAL name
(`positive-create-composite` / `createComposite`) throughout, renamable without invalidating any
requirement; (c) whether the new case reuses `m2-create-composition/expected/` or needs its own
sibling `expected-*` directory (the `m2-copy`/`m2-copyin` precedent: `expected-force`,
`expected-modify`).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `openspec/specs/conformance-fixtures/spec.md` | Modified | REQ-CFX-02/02.1/03 cardinality relaxation; REQ-CFX-09/12/13 pin additions (delta spec: `openspec/changes/positive-create-conformance/specs/conformance-fixtures/spec.md`) |
| `conformance/m2-create-composition/manifest.json` | Modified | new case entry; possible reject-twin `force` update |
| `conformance/m2-create-composition/factory.ts` | Modified | new named export authoring a quarantined positive `create()` w/ composite options; possible `force: true` addition to `createRejectProbe` |
| `conformance/m2-create-composition/expected/` (or new sibling `expected-*` dir) | New/Modified | byte-exact declared output for the new case |
| `conformance/README.md` | Modified | reword the create-cardinality sentence (genuine sync site, not covered by REQ-CFX-17) |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | Modified | update REQ-CFX-02 cardinality comment/clause-(a) regex; add a describe block for the new case's contract |
| `test/support/conformance-validators.ts` | Read-only | `checkCreateQuarantine` confirmed to need no change |
| `conformance/corpus.json` | Read-only | no new fixture id under this approach |
| `openspec/decisions/0064-*.md` | Read-only, or amended if design's ADR adds `force: true` | conditional on the reject-twin staleness resolution |
| `openspec/pending-changes.md:500` | Read-only | confirmed stays open, not closed by this change |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `wire-create-reject-twin`'s pinned outcome triple (ADR-0064) silently goes stale once the engine's `sdk-wire-create` lands, since its factory omits `force` and the new engine only rejects batches carrying one | Medium | `sdd-design` resolves via ADR whether to add `force: true` (REQ-CFX-09.5); fail-closed clause (REQ-CFX-09) already forbids shipping an unresolved placeholder |
| Amending REQ-CFX-02's heavily cross-referenced cardinality invariant (referenced by CFX-03/04/09/12/13/17) breaks a downstream REQ's scenario if reworded carelessly | Medium | delta spec copies and edits every cross-referencing REQ's FULL block (openspec MODIFIED workflow); full suite + fit-40 rerun before landing |
| `conformance/` is a pinned git submodule the engine consumes — a bad landing commit blocks the engine's PC-CREATE-02 unblock and pin advance | Low | single-commit landability is a Success Criterion; full suite + fit-40 green at the exact commit the engine will pin |
| New case's `expected/` bytes are hand-authored, SDK-side unverified (REQ-CFX-11 honesty boundary) | Low | the "declared, not proven" framing is preserved verbatim for the new case, same as every existing fixture |
| A reader assumes `pending-changes.md:500` is closed by this change | Low | archive step must not claim the row closed; row stays open verbatim, called out explicitly here and in Out of Scope |

## Rollback Plan

Single-commit landability is itself a Success Criterion, so rollback is a single `git revert` of
the landing commit. **Reverted**: the spec.md delta (REQ-CFX-02/02.1/03 wording + REQ-CFX-09/12/13
pin additions), the new `manifest.json` case entry, the new `factory.ts` named export, the new
`expected/`(or `expected-*`) bytes, the README sentence reword, the fit-40 test/comment updates,
and — conditionally — the `createRejectProbe` `force: true` addition + ADR-0064 amendment if
design added them. **Stays**: nothing — this change introduces no forward-incompatible artefact;
the existing `m2-create-composition` positive case and (pre-this-change) reject-twin values are
untouched except for the conditional `force` edit, which reverts with the same commit.
**Validation**: `bun test` + `fit-40` green at the pre-change state (byte-identical to current
`main`); `git log` shows the revert as the sole diff. **Unrecoverable data**: none — this is a
declarative fixture corpus, not runtime state. **Cross-repo caveat**: if the engine has ALREADY
advanced its submodule pin past the landing commit before a rollback is needed, the rollback
additionally requires coordinating a pin rollback with the engine team — this is a cross-repo
dependency, not something this repo can unilaterally undo.

## Dependencies

- Engine team's `sdk-wire-create` change (engine repo, plan PR #185) — this SDK change does NOT
  depend on it landing first; the corpus declares its contract independently (REQ-CFX-11 honesty
  boundary), and the engine team consumes it once ready.
- `collection.json` package-anchor marker (ADR-0067) — already-landed precondition for
  ADR-0064's exit-2 resolution; no new work, just confirmed still true.

## Success Criteria

- [ ] Full suite (`bun test`) green at the landing commit
- [ ] `fit-40` (`test/fitness/fit-40-conformance-corpus-integrity.test.ts`) green at the landing commit
- [ ] The landing commit is a SINGLE commit on `main` (the exact SHA the engine's submodule pin will advance to)
- [ ] ≥1 new case in `m2-create-composition/manifest.json` has `factory.export` ≠ `null` and ≠ `"createRejectProbe"`, `outcome.exitCode === 0`, `outcome.emitRejectionCode === null`
- [ ] The new case's factory authors ≥1 composite (array or plain-object) option value, confirmed by reading the factory source (not merely by type), exercising `encodeOptions`'s JSON-stringify branch
- [ ] REQ-CFX-02.1's quarantine scenario (and its `fit-40` enforcement) holds with the new case present — no vacuous pass
- [ ] `openspec/pending-changes.md:500` remains present, unmodified in its OPEN disposition

## Requirements

**Status**: SIGNED
**Base spec version**: V4 (`openspec/specs/conformance-fixtures/spec.md`)
**Delta spec file**: `openspec/changes/positive-create-conformance/specs/conformance-fixtures/spec.md`
(identical content to this section, in openspec's ADDED/MODIFIED/REMOVED format for archive-time merge)

### MODIFIED Requirements

#### REQ-CFX-02: Representable-Ops-Only, Wire `create` Quarantined To One Sanctioned Site

Across the whole corpus, factories MUST author only `modify`/`delete`/`rename`/`move`/`copy`/
`copyIn` via the public commons verbs, PLUS wire `create` — but `create` MUST be authored ONLY
inside `m2-create-composition/factory.ts`'s quarantined named-export blocks (ADR-0065
case-level `factory` override), never via any fixture's default-export factory and never from
any file outside that one sanctioned site. `wire-create-reject-twin` is one such quarantined
case (a deliberate reject probe); any number of ADDITIONAL positive create cases MAY be
quarantined in the SAME sanctioned file, each via its own named export. No case OUTSIDE the
sanctioned file's quarantine may ever emit `create`.

(Previously: EXACTLY ONE case corpus-wide — `wire-create-reject-twin` — was permitted to emit
`create`. Relaxed per the engine's `sdk-wire-create` handoff, obs #1695.)

- **Scenario REQ-CFX-02.1 — Every `create()`-authoring case is quarantined inside the sanctioned file**: GIVEN every case across every fixture in `corpus.json#fixtures`, WHEN each factory file corpus-wide is inspected for `create(` calls, THEN every call lies inside `m2-create-composition/factory.ts`'s case-referenced named-export blocks (never the default export) — no file outside the sanctioned site authors `create()` anywhere.
- **Scenario REQ-CFX-02.2 — Cardinality sync sites for the create quarantine (NEW)**: GIVEN the commit that first lands a positive create case, WHEN README's create-cardinality sentence, the DO-NOT-COPY clause (a) text, and `fit-40`'s clause-(a) regex are read, THEN all three describe the quarantine invariant (one sanctioned file) in the SAME commit.

#### REQ-CFX-03: DO-NOT-COPY Header on the Reject-Probe Factory

The reject-twin's `create()` call MUST carry a `DO-NOT-COPY` comment conveying: (a) authoring
`create()` outside this file's quarantine violates REQ-CFX-02; (b) THIS case is a deliberate
reject probe — a legitimate positive create case MAY coexist in a separate named export, not
covered by this warning; (c) do not imitate the probe's rejection-triggering shape — copy the
positive create export's pattern instead; (d) the engine refuses THIS probe's batch, exact cause
resolved by ADR-0064 (amended if REQ-CFX-09.5 adds `force: true`); (e) what to copy instead —
the representable ops via default export, or this file's positive create pattern if a new
fixture needs a wire `create`.

(Previously: clause (a) cited "the one-create-corpus-wide invariant"; clause (e) named no
create-authoring alternative, since none existed. Both reworded to match REQ-CFX-02's relaxed
invariant.)

#### REQ-CFX-09: `m2-create-composition` Behavioral Contract

Adds a second, distinct positive case (provisional `positive-create-composite` /
`createComposite`, renamable by `sdd-design`) authoring a wire `create` inside its own
quarantined named-export block, with ≥1 composite (array/object) option value exercising
`encodeOptions` (REQ-TOE-01) — the corpus's first case to do so. `exitCode: 0`,
`emitRejectionCode: null`, byte-exact declared path + content. `writtenPaths` pin: REQ-CFX-12.

- **Scenario REQ-CFX-09.4 (NEW) — A second positive case authors a quarantined create with composite options**: GIVEN the new named-export case, WHEN its directive is inspected, THEN `factory.export` ≠ `null`/`"createRejectProbe"`, ≥1 composite option value present, `exitCode: 0`, `emitRejectionCode: null`, byte-exact declared output.
- **Scenario REQ-CFX-09.5 (NEW) — `wire-create-reject-twin`'s outcome triple stays valid under the engine's new create semantics**: GIVEN the engine's `sdk-wire-create` change rejects a batch only when `force` is present, WHEN `sdd-design` resolves via ADR whether `createRejectProbe` needs `force: true`, THEN the manifest entry, factory call, and DO-NOT-COPY clause (d) ship consistent with that resolution — never contradicting the stated new engine semantics.

(Existing scenarios REQ-CFX-09.1/.2/.3 — the composition-positive case's contract, the
design-blocking exit-path precondition, and the fail-closed clause — are unchanged from V4.)

#### REQ-CFX-12: `writtenPaths` Rule — Committed-Mutation Set (all six op classes)

Adds the new positive-create case's pinned value: its own declared create path only — a
genuinely new path no other case touches, so no dedup collision (exact literal pinned when
design/slice chooses the case's path). All other pinned values unchanged from V4.

- **Scenario REQ-CFX-12.3 (NEW) — A new quarantined positive-create case pins a genuinely new `writtenPaths` entry**: GIVEN the new case's declared create path, WHEN `outcome.writtenPaths` is inspected, THEN it lists exactly that one new path and collides with no other case's pinned path.

#### REQ-CFX-13: Transcript Oracle — Every Case Carries a Full `transcript` Object

Adds one table row: `m2-create-composition / positive-create-composite (provisional)` →
`callbacks: [ir.emit, ir.commit]`, `forbidDiscard: true` — the same single-emit-single-commit
shape as any other single-directive positive case. All other rows unchanged from V4.

- **Scenario REQ-CFX-13.6 (NEW) — A quarantined positive-create case's transcript is single-emit-single-commit**: GIVEN the new case, WHEN `cases[].transcript` is inspected, THEN `callbacks = [ir.emit, ir.commit]`, `singleCommit: true`, `forbidDiscard: true`, `emitBeforeCommit: true`.

Full requirement text (complete copied-then-edited blocks per the openspec MODIFIED workflow,
including every unchanged scenario carried forward verbatim) lives in the delta spec file above —
this section summarizes the same content for merged-mode readability; the two must not drift.
