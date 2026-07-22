# Proposal: Copy/CopyIn Conformance Fixtures

**Change**: `copy-copyin-conformance-fixtures` · **Triage**: L · **Persona lens**: none

## Intent

A schematic author calling the SDK's public `copy()` / `copyIn()` verbs gets zero bytes on
disk today: the engine ingestion layer rejects both as unrepresentable, and the engine's
`copy-wire-inclusion` change is hard-gated — its owner will not merge while its conformance
test skips, and the engine repo cannot author its own fixtures (`TestConformance_FixturesAreSDKOwned`,
engine ADR-D). Only an SDK-owned conformance fixture can prove `copy`/`copyIn` land bytes
end-to-end. The engine plans `copy-wire-inclusion` NOW, so the SDK `m2-copy` fixture must land
and be pinnable BEFORE that change merges — SDK PR cadence gates an engine milestone. `m2-copyin`
is authored in the same change (SDK-side authoring is engine-independent) but held for later
landing.

## Owner Rulings (2026-07-22, binding)

1. **m2-copy = 6 cases**: positive, collision-with-force, collision-WITHOUT-force `(2,"collision",0,[])`
   (force-flag triangulation), missing-source twin `(2,"not-found",0,[])`, directory-source twin,
   copy-then-modify (two wire directives, disk-effect collapse).
2. **m2-copyin = engine-plane ONLY, 5 cases** (dest-dir-twin added by owner ruling 2026-07-22:
   copyIn onto an existing DIRECTORY destination → `(2,"collision",0,[])` — destination collision,
   NOT unrepresentable): positive, verbatim-content (source bytes containing
   `{= =}` land byte-identical — NOT rendered; the by-reference value proposition),
   collision-with-force, collision-without-force. SDK-plane twins (containment-escape, missing-source,
   dir-source — all `(1,null,null,[])` + empty transcript) are **DESCOPED**: non-gating,
   indistinguishable in schema, duplicate existing SDK unit coverage. Descope recorded here so it is
   not read as a gap.
3. **Landing = branch-hold for m2-copyin**: `m2-copy` lands on main first (engine pins that commit,
   unblocks `copy-wire-inclusion`). `m2-copyin` is authored fully here but its commit stays on an
   unmerged branch/PR until the engine's `copyIn` wire-inclusion is in flight — zero pin-ratchet on
   main. REQ-CCR-04 atomicity holds per-commit.
4. **Engine-authoritative facts** — owner confirms BEFORE spec (pending gates, NOT resolved here):
   (a) `writtenPaths` for copy/copyIn positives (`[]` vs `[dst]`), (b) copy-then-modify intra-batch
   ordering, (c) Go loader inertness for an in-fixture source (`assets/`) dir.

## Scope

### In Scope
- `m2-copy` fixture (6 cases) — `manifest.json` + `factory.ts` + `seed/` + `expected/`.
- `m2-copyin` fixture (5 engine-plane cases) — adds a package-local in-fixture source dir.
- `corpus.json#fixtures` entry for each fixture, in the SAME commit as its full artefact set (REQ-CCR-04).
- `conformance/README.md` representable-ops sentence updated in two steps: `copy` when m2-copy lands
  main; `copyIn` only in the held m2-copyin commit (main never claims copyIn while held).
- `fit-40` extended: manifest-derived checkpoint counts replacing the hardcoded 1/5 literals
  (discharges pending-changes row 502; spec REQ-CCR-05 MODIFIED) + per-fixture behavioral-contract
  assertion blocks (REQ-CFX-15/16) mirroring REQ-CFX-05..09.

### Out of Scope
- Engine-side changes (wire inclusion, submodule pin advance).
- Any `create` fixture; changes to `src/**`; new corpus schema keys (strict `DisallowUnknownFields`).
- The descoped `m2-copyin` SDK-plane twins (ruling 2).

## Capabilities (contract with sdd-spec)

### New Capabilities
None.

### Modified Capabilities
- `conformance-fixtures`: add representable-ops `copy`/`copyIn` + their outcome-triple case sets;
  add REQ-CFX-15/16 per-fixture blocks.
- `conformance-corpus`: replace REQ-CCR-05's hardcoded checkpoint literals with manifest-derived
  counts (row 502 — "this change IS that touch"); landing-sequence contract REQ-CCR-09.

## Approach

`m2-copy` is a template-clone of `m2-rename-move` (ADR-0065 per-case `factory` override,
`class: wire-mutation`) — same collision-capable-op shape, no new manifest keys; the 6 cases reuse
established outcome-triple patterns (positive, force-overwrite, `(2,…)` reject twins, batch-order
collapse). `m2-copyin` is **structurally novel**: it introduces a package-local in-fixture source
directory (the bytes `copyIn` references live inside the fixture and must be inert to the Go loader),
and demonstrates by-reference verbatim copy (source `{= =}` not rendered) — still within the existing
schema, no new keys, strict decoder honored. For L, `sdd-design` must formalise (ADRs from **0073**):
the `m2-copy` 6-case outcome triples, the `m2-copyin` in-fixture source-dir convention, and the
`fit-40` 3rd-checkpoint + REQ-CFX-15/16 shape.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `conformance/m2-copy/{manifest.json,factory.ts,seed/,expected/}` | New | 6-case wire-mutation fixture |
| `conformance/m2-copyin/{manifest.json,factory.ts,assets/,expected/}` | New | 5-case; package-local source dir |
| `conformance/corpus.json` | Modified | `fixtures[]` += m2-copy, m2-copyin (same-commit, REQ-CCR-04) |
| `conformance/README.md` | Modified | representable-ops sentence += `copy`, `copyIn` |
| `test/fitness/fit-40-conformance-corpus-integrity.test.ts` | Modified | manifest-derived checkpoint counts (row 502) + REQ-CFX-15/16 blocks |
| `openspec/specs/conformance-fixtures/spec.md` | Modified | delta REQ-IDs (at spec) |
| `src/commons/index.ts`, `src/core/wire.ts`, `src/testing/contract-fake.ts` | Read-only | confirm verb contracts unchanged |
| `openspec/decisions/` | New (design) | ADR(s) from 0073 if design ratifies case shapes |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Forward-dated declarations: engine rejects copy/copyIn as unrepresentable TODAY | High | Branch-hold landing (ruling 3); no schema "pending" field possible under DisallowUnknownFields |
| Authoring-error silent failure: fit-40 checks shape, not outcome truth — a wrong triple passes locally, fails engine-side | Medium | Pending engine-authoritative confirmations (ruling 4) gate spec; engine harness at pin-advance is the real oracle |
| 3-place representable-ops sync (README + conformance-fixtures spec + fit-40 assertion block) | Medium | Update all three in the same commit; REQ-CFX-15/16 blocks enforce |
| fit-40 checkpoint cadence goes vacuous once new fixtures land (hard-coded 1/5) | Medium | Manifest-derived counts (row 502) stay correct at 6-on-main AND 7-on-branch; delete the dead hardcoded gates |
| Strict decoder: accidental new corpus key = engine hard failure invisible to fit-40 | Low | No new manifest keys (ruling); HANDOFF review before ship |
| m2-copyin in-fixture source dir mis-loaded as a fixture by the Go loader | Medium | Pending confirmation 4(c); package-local convention, no manifest key |
| Descoped copyIn SDK-plane twins read as coverage gap by a naive reviewer | Low | Accepted — rationale recorded here + carried into spec (ruling 2) |

## Rollback Plan

Fixtures are additive data outside `src/` and outside `package.json#files`/`#exports` (never built,
never shipped). Rollback = revert the fixture commit(s); because `corpus.json#fixtures` is edited in
the SAME commit as its fixture (REQ-CCR-04), a single `git revert` removes both the entry and the
directory atomically — no dangling registry pointer. The README representable-ops sentence and the
fit-40 checkpoint/REQ-CFX-15/16 edits ride the same commits and revert with them. Validate rollback:
`bun test` fit-40 green at 5 fixtures, `corpus.json#fixtures` back to the original 5, no
`conformance/m2-copy` or `conformance/m2-copyin` directory. No data is unrecoverable (declarative
data only, no migration, no user data). Cross-repo: because m2-copy lands before the engine advances
its pin, reverting before pin-advance is a clean SDK-local operation; after pin-advance the engine
must roll its pin back first (coordination noted, not a code rollback).

## Dependencies

- Owner confirmation of the three engine-authoritative facts (ruling 4) BEFORE spec finalises.
- Engine `copy-wire-inclusion` in flight before `m2-copyin` lands on main (sequencing, not a build dep).

## Success Criteria

- [ ] `m2-copy` (6 cases) + `m2-copyin` (5 cases) present, each `manifest.json`+`factory.ts`+seed/assets+`expected/`, matching m2-rename-move structure.
- [ ] `corpus.json#fixtures` lists both; each entry in the same commit as its fixture set (REQ-CCR-04 holds per-commit across the branch).
- [ ] `conformance/README.md` representable-ops sentence names `copy` on main; `copyIn` appears ONLY in the held m2-copyin commit (two-step, REQ-CFX-17).
- [ ] `fit-40` green at EACH landing step — 6 fixtures/18 cases on main, 7 fixtures/23 cases on the held branch — via manifest-derived counts + REQ-CFX-15/16 per-fixture assertion blocks.
- [ ] `bun run typecheck` green over both new `factory.ts` (free correctness sweep).
- [ ] `m2-copyin` commit held on branch/unmerged PR until engine `copyIn` wire-inclusion is in flight (zero pin-ratchet on main).
- [ ] **Cross-repo (post-merge, the REAL signal)**: engine Go harness runs green on `m2-copy` at submodule pin-advance.
