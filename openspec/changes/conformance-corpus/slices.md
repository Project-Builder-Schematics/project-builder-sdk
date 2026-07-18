# Slices: conformance-corpus

**Triage**: L
**Spec version**: V3 — SIGNED (re-signed by owner 2026-07-18; no archive-gate risk)
**Total slices**: 5 (1 walking skeleton + 4 SPIDR/Data)

**Word-budget note**: this artefact exceeds the ~800-word guideline. Flagged, not silently cut —
per spec-summary.md's own precedent, trimming REQ-ID/gate detail on a fail-closed cross-repo
contract corpus would strip correctness-critical traceability.

---

## S-000: Walking Skeleton — PR#1 (m1-vehicle + ALL scaffolding)

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing
**Covers**: CCR-01,02,03,05.3,06,07,08 · CFX-01,04,05,10,11,12,13.1/.2,14 · CSC-01..06 · CDT-01..07
**Test layers**: fit-40 (architectural, RED→GREEN) + PR-gate scripts (CCR-03.1/04.1, one-time, not suite)

**Cross-repo gate (pre-merge, owner-mandated, non-blocking-for-authoring)**: engine confirms
greeting-exit-1 cleanup semantics — does `expected:"empty"` on `greeting-mismatch-twin` describe
the committed workspace or full disk state (north-star Q2). Surface before PR#1 merges.

**Acceptance**:
- GIVEN empty workspace, m1-vehicle schematic `out.txt="v1"`, greetingVersion 1, factory
  `read()`→`modify→"v2"` — THEN manifest declares exit 0, `expected/out.txt="v2"`,
  `writtenPaths=["out.txt"]`, transcript `[tree.read,ir.emit,ir.commit]`
- GIVEN greetingVersion 2 (same factory) — THEN exit 1, `expected:"empty"`, transcript `[]`
- GIVEN the full PR#1 tree — THEN fit-40 passes green at 1 fixture/2 cases (CCR-05.3);
  `collection.json` resolves as ancestor; README names both `conformance/` surfaces; `.gitattributes`
  renormalize dry-check yields no residual diff; `bun run typecheck`+`build` stay green with no
  `conformance/**` in dist

### Tasks
- [x] S-000.1 `conformance/corpus.json` = `{wireSpecVersion:1, fixtures:["m1-vehicle"]}`
- [x] S-000.2 `conformance/collection.json` (presence-only marker)
- [x] S-000.3 `conformance/README.md` (4-way disambiguation + honesty boundary + authoring
      checklist, §4.3b)
- [x] S-000.4 `conformance/m1-vehicle/{manifest.json,factory.ts,schematic/,expected/}` (both cases; `expected/out.txt` = `v2` COMMITTED as a directory for the positive case — the twin's `expected: "empty"` is manifest-field-only, no dir; per design File Changes + REQ-CSC-02 presence assertion)
- [x] S-000.5 `.gitattributes` (`* eol=lf`) + renormalize dry-check
- [x] S-000.6 `test/support/conformance-fixture-loader.ts` (shapes + loader, §4.3)
- [x] S-000.7 `test/fitness/fit-40-conformance-corpus-integrity.test.ts` — RED first (write
      against the not-yet-landed corpus), then GREEN once S-000.1-4 land; must implement the
      failure-message contract (fixture id + case name + rule)
- [x] S-000.8 Verify `tsconfig.json` carries NO `exclude` for `conformance/**` (CFX-14/design Q3);
      retire `openspec/pending-changes.md` row 306

**Out of scope**: any `m2-*` fixture, ADR-0065 schema delta, runner-driven proof (CFX-11 honesty
boundary — this repo has none).

---

## S-001: `m2-modify` — positive + not-found twin

**Scope**: happy-path · **Dimension**: D (Data) · **Requires**: nothing
**Covers**: CFX-06.1/.2, CFX-10.1 (zero-effect), CFX-04.1/.2, CFX-12.2, CFX-13.1/.2, CCR-05.2 (recheck)
**Test layers**: fit-40 grows to 2 fixtures/4 cases

**Acceptance**:
- GIVEN seed `{target.txt:"orig",sibling.txt:"keep"}`, factory `modify(target.txt)→"replaced"` —
  THEN positive: exit 0, `expected={target.txt:"replaced",sibling.txt:"keep"}`, `writtenPaths=[]`,
  transcript `[ir.emit,ir.commit]`
- WHEN not-found-twin (`modify(missing.txt)`) — THEN exit 2, `not-found`, `failedIndex:0`,
  `expected:"zero-effect"`, transcript `[ir.emit,ir.discard]`, `forbidDiscard:false`

### Tasks
- [x] S-001.1 RED: fit-40 assertions target m2-modify's 2-case set
- [x] S-001.2 `conformance/m2-modify/{manifest.json,factory.ts,seed/,expected/}`
- [x] S-001.3 `corpus.json#fixtures` += `"m2-modify"` — SAME commit as .2 (CCR-04)
- [x] S-001.4 GREEN: fit-40 passes at 2 fixtures/4 cases

**Out of scope**: any other fixture; no fake-fidelity fixes; no wire-spec touches.

---

## S-002: `m2-delete` — positive + not-found + dir-target twins

**Scope**: happy-path · **Dimension**: D (Data) · **Requires**: nothing
**Covers**: CFX-07.1/.2, CFX-13.3 (batch-level discard), CFX-04.2 (`failedIndex:null`)
**Test layers**: fit-40 grows to 3 fixtures/7 cases

**Acceptance**:
- GIVEN seed `{target.txt,sibling.txt,adir/child.txt}`, factory `delete(target.txt)` — THEN
  positive: exit 0, expected omits target, retains sibling+adir
- WHEN not-found-twin (`delete(missing.txt)`) — THEN exit 2/`not-found`/`failedIndex:0`/zero-effect
- WHEN dir-target-twin (`delete(adir)`, batch-level unrepresentable) — THEN exit
  2/`unrepresentable`/`failedIndex:null`/zero-effect, transcript `[ir.emit,ir.discard]`

### Tasks
- [x] S-002.1 RED: fit-40 assertions target m2-delete's 3-case set
- [x] S-002.2 `conformance/m2-delete/{manifest.json,factory.ts,seed/,expected/}`
- [x] S-002.3 `corpus.json#fixtures` += `"m2-delete"` — same commit
- [x] S-002.4 GREEN: fit-40 passes at 3 fixtures/7 cases

**Out of scope**: dir-target unrepresentable is this slice's only directory-op twin; no other fixtures.

---

## S-003: `m2-rename-move` — positive + collision + dir-source twins

**Scope**: happy-path · **Dimension**: D (Data) · **Requires**: nothing
**Covers**: CFX-08.1/.2, CFX-13 (collision + dir-source rows), CFX-04 (both twin classes co-present)
**Test layers**: fit-40 grows to 4 fixtures/10 cases

**Acceptance**:
- GIVEN seed `{src.txt:"payload",occupied.txt:"taken",adir/child.txt:"x"}`, factory
  `rename(src→dst)` — THEN positive: exit 0, expected `{dst.txt:"payload",occupied.txt,
  adir/child.txt}`, src absent, dst byte-equals src
- WHEN collision-twin (dest=`occupied.txt`, no force) — THEN exit 2/`collision`/`failedIndex:0`/zero-effect
- WHEN dir-source-twin (source=`adir`) — THEN exit 2/`unrepresentable`/`failedIndex:null`/zero-effect

### Tasks
- [x] S-003.1 RED: fit-40 assertions target m2-rename-move's 3-case set
- [x] S-003.2 `conformance/m2-rename-move/{manifest.json,factory.ts,seed/,expected/}`
- [x] S-003.3 `corpus.json#fixtures` += `"m2-rename-move"` — same commit
- [x] S-003.4 GREEN: fit-40 passes at 4 fixtures/10 cases

**Out of scope**: no other fixtures. Verb is PINNED: `rename` (design File Changes table, m2-rename-move row — "rename verb"); `move` stays unexercised (registered corpus followup, not this slice).

---

## S-004: `m2-create-composition` — positive + wire-create-reject-twin

**Scope**: happy-path · **Dimension**: D (Data) · **Requires**: nothing (build LAST)
**Covers**: CFX-09.1/.2/.3, CFX-13.4 (dual-branch discard), CFX-02.1 (exactly-one-create, full
corpus-wide assertion), CFX-03.1 (DO-NOT-COPY header), CCR-05.1 (final 5/12 absolute count)
**Test layers**: fit-40 final — 5 fixtures/12 cases, absolute count now asserted

**HARD GATE (pre-authoring, BLOCKING)**: engine sign-off on the case-level `factory` schema delta
(ADR-0065) — the handoff amendment is already appended (design's job, done); this fixture's
`manifest.json` MUST NOT be authored until the engine team confirms Go-loader support for a
per-case `factory.export` pointer. If unconfirmed at slice start: HALT and escalate cross-repo,
do not proceed on assumption.

**Acceptance**:
- GIVEN seed `existing.txt="orig"`, schematic `generated.txt="generated"`, default-export factory
  `modify(existing.txt)→"composed"` — THEN positive: exit 0, single `ir.commit`, expected
  `{generated.txt,existing.txt:"composed"}`, `writtenPaths=["generated.txt"]` exactly
- WHEN wire-create-reject-twin (named export `createRejectProbe`, DO-NOT-COPY 5-clause header,
  per-case `factory` override) authors raw `create` — THEN triple frozen per ADR-0064: exit
  2/`unrepresentable`/`failedIndex:null`/zero-effect, transcript `[ir.emit,ir.discard]`
- WHEN the corpus-wide create scan runs — THEN exactly one `create` site exists (this probe)

### Tasks
- [ ] S-004.1 Confirm ADR-0065 engine sign-off (HARD GATE) — do not proceed unconfirmed
- [ ] S-004.2 RED: fit-40 targets m2-create-composition's 2-case set + corpus-wide create-count +
      DO-NOT-COPY scan
- [ ] S-004.3 `conformance/m2-create-composition/{manifest.json,factory.ts,seed/,expected/,schematic/}`
      (per-case `factory` override; `createRejectProbe` named export)
- [ ] S-004.4 `corpus.json#fixtures` += `"m2-create-composition"` — same commit
- [ ] S-004.5 GREEN: fit-40 passes at 5 fixtures/12 cases (CCR-05.1 absolute gate now live)

**Out of scope**: no second `create` site anywhere in the corpus; no fake-fidelity fixes; no
wire-spec touches.

---

## Build Order / PR Mapping

| Slice | PR | Gate |
|---|---|---|
| S-000 | PR#1 (ships alone, unblocks engine M1) | pre-merge: engine confirms greeting-exit-1 cleanup semantics |
| S-001 → S-002 → S-003 → S-004 | PR#2 (4 commit-atomic slices) | S-004: HARD GATE — ADR-0065 engine sign-off before manifest authored |

S-001..S-003 carry no inter-slice technical dependency (each extends `corpus.json` additively) but
are sequenced by owner-endorsed twin-complexity. S-004 is deliberately last: it alone carries the
cross-repo HARD GATE, and CCR-05.1's absolute 5/12 gate can only pass once it lands.

## Gate Status Register (as of 2026-07-18)

| Gate | Status | Ruling source |
|---|---|---|
| Spec V3 signature | **SIGNED** (owner re-signed 2026-07-18) | orchestrator session; spec-summary.md header |
| S-000 pre-merge: greeting-exit-1 cleanup confirm | **OPEN — owner-mandated at foresight**: confirm with engine team BEFORE merging PR#1; non-blocking for authoring | steward foresight conscience Q2, owner-answered |
| S-004 pre-authoring: ADR-0065 schema-delta sign-off | **OPEN by design**: engine sign-off required before `m2-create-composition/manifest.json` is authored; HALT-and-escalate if unconfirmed at slice start | ADR-0065 hard gate; owner accepted coordination cost (foresight Q3) |
| Declaration-only verification depth | **RATIFIED**: structural self-check suffices for M1; behavioural replay = registered followup | foresight Q1, owner-answered |

## Executor Context Map (contracts by authoritative source)

The slices are the sequencing layer; the executor (sdd-apply) receives the artefacts below INJECTED
at launch. Every contract a slice references resolves here — none is open:

| Contract | Authoritative source |
|---|---|
| manifest.json full schema (fields, types, required/optional, per-case shape incl. `transcript` + `outcome` + PROPOSED case-level `factory`) | design.md §4.3 (TS shapes) + CONFORMANCE-CORPUS-HANDOFF.md §manifest.json schema (incl. PROPOSED amendment) |
| REQ texts CCR-01..08 / CFX-01..14 / CSC-01..06 / CDT-01..07 | `specs/{conformance-corpus,conformance-fixtures,conformance-self-check,corpus-determinism}/spec.md` (V3 SIGNED) |
| Factory authoring API (verbs, signatures, export conventions) | `src/commons/index.ts` (public surface) + handoff §Factory conventions; probe export = `createRejectProbe` (design/ADR-0065) |
| Transcript vocabulary + emission rules (tree.read/ir.emit/ir.commit/ir.discard; twins `[ir.emit, ir.discard]`) | REQ-CFX-13 (V3-corrected table) + ADR-0064 frozen trace |
| Exit codes / rejection enum / failedIndex rules | docs/engine-sdk-wire-spec.md EXC-01 + REQ-CFX-04; frozen triple for reject-twin: (2, "unrepresentable", null) per ADR-0064 |
| `expected` forms ("empty" vs "zero-effect" vs file map) | REQ-CFX-10 |
| conformance-fixture-loader.ts shapes | design.md §4.3 |
| README required content (4-way disambiguation, honesty boundary quoted from REQ-CFX-11, authoring checklist) | design.md §4.3b |
| fit-40 failure-message contract + framework (`bun test`) | design.md §4.7 + REQ-CSC-06 |
| corpus.json shape | handoff §On-disk layout + REQ-CCR-01/07 |
| collection.json content (presence-only marker; content = `{}` unless design states otherwise) | ADR-0067 + REQ-CCR-08 |
| DO-NOT-COPY 5-clause header text | design.md (pinned wording) + REQ-CFX-03 |
| tsconfig no-exclude vs dist-exclusion mechanism | design.md ADR-0066 / Q3 resolution (build tsconfig `rootDir: ./src` already excludes; typecheck sweeps) |
| greetingVersion mechanics (engine flips greeting pre-import; factory is greeting-agnostic — same file both cases) | handoff §m1-vehicle + REQ-CFX-05; wire-spec greeting section |
| S-003 verb | `rename` (pinned above) |
| CCR-03.1/04.1 PR-gate checks — deliverable form | PINNED (orchestrator ruling, repo precedent `scripts/validate-harness.sh`): a COMMITTED bun script `scripts/conformance-pr-gate.ts`, authored in S-000, run manually/CI at each PR boundary (PR#1: asserts `corpus.json#fixtures === ["m1-vehicle"]` at HEAD; PR#2: commit-range scan asserting each slice's corpus.json entry + artefact set land in the same commit). NOT part of `bun test`; lives under `scripts/` (outside `src/`, trivially outside dist) |
| m1-vehicle positive `expected/` | COMMITTED directory (`expected/out.txt` = `v2`); twin's `"empty"` = manifest field only, no dir |

## Anti-Pattern Check

Pass, with one flagged deviation. Only 4 non-skeleton slices (floor of the L target range) is
task-mandated: owner ruling requires full corpus / two-PR delivery with twins bundled per fixture
as CCR-04 commit-atomic units — splitting positive/negative cases into separate slices would
violate "manifest + full artefact set lands in the same commit." No horizontal/layer-named slices;
each slice references ≥3 REQ-IDs; no slice crosses two SPIDR dimensions; max dependency depth = 1
(S-000, implicit).
