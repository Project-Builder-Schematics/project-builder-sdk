# Triage: Copy/CopyIn Conformance Fixtures

**Classification**: L
**Decided at**: 2026-07-22T00:00:00Z
**Change name**: `copy-copyin-conformance-fixtures`

## Problem & Scope

> The engine's `copy-wire-inclusion` change is hard-gated: its owner ruled it does not merge
> while its conformance test skips, and the engine repo cannot author fixtures
> (`TestConformance_FixturesAreSDKOwned` fails the engine build on embedded fixture content;
> engine ADR-D). Today a schematic author calling the SDK's public `copy()` verb gets zero
> bytes on disk because the engine ingestion layer rejects `copy` as unrepresentable. Only an
> SDK-owned conformance fixture can prove copy lands bytes end-to-end. The same applies to
> `copyIn` (queued next engine-side). Why now: the engine is planning `copy-wire-inclusion` NOW;
> the SDK fixture must land and be pinned BEFORE that change merges — SDK PR cadence gates an
> engine milestone.

```yaml
scope:
  in_scope:
    - m2-copy fixture in conformance/ — positive, collision-with-force, directory-source,
      copy-then-modify collapse
    - m2-copyin fixture — case set refined in spec (positive + negative twins per corpus
      conventions)
    - corpus.json#fixtures listing in the same commit as each fixture (REQ-CCR-04 atomicity)
    - conformance/README.md representable-ops sentence update
    - fit-40-conformance-corpus-integrity green
  out_of_scope:
    - engine-side changes (wire inclusion, submodule pin advance)
    - any `create` fixture
    - changes to src/**
    - new corpus schema keys (strict engine decoder — DisallowUnknownFields)
```

## Description Received

Origin: GitHub issue #42 — "Add m2-copy conformance fixture — prerequisite for engine
copy-wire-inclusion" — plus an explicit owner decision to also author `m2-copyin` in the same
change (SDK-side fixture authoring is engine-independent).

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | ~18-26 (2 new fixture dirs × {manifest.json, factory.ts, seed/, expected/} following the m2-rename-move precedent: 8 files for 3 cases; scaled to 4 cases + a to-be-refined copyIn case set) + corpus.json edit + README.md edit | L (nominally reads XL-range by raw count, see override note below) |
| Lines affected (estimated) | ~150-300 (precedent fixtures: factory.ts 700-1500 bytes/~20-40 lines, manifest.json 30-50 lines, seed/expected files 1-9 bytes each) | M |
| Bounded contexts | 1 (conformance/ corpus authoring only — no src/, no engine repo, no other systems) | S/M |
| New patterns | none for m2-copy (matches the established per-case factory-override pattern, ADR-0065, used 5x already); m2-copyin's negative-twin case set needs real design (deferred to spec) — variant of existing | M |
| Test types | existing (`fit-40-conformance-corpus-integrity.test.ts`, `bun test`) — no new test infrastructure | S |

### Overrides Triggered
- None of the sensitivity overrides (auth/payments/privacy/security/deploy/schema-migration) apply — `conformance/` is explicitly NOT in `openspec/sensitive-areas.md`.
- No new external dependency, no DB migration.
- Cross-repo coordination risk (see Risks) is real but is not one of the listed mechanical overrides — factored into the classification via judgment, not a table override.

**Final classification**: L — driven by real risk/coordination drivers, not by raw file count. Two fixtures bundled in one change, an explicit cross-repo submodule-pin ratchet sequencing risk (owner-accepted landing order: `m2-copy` then `m2-copyin`), a REQ-CCR-04 commit-atomicity constraint, and a public-facing README/contract update (representable-ops sentence read by both schematic authors and the engine team) together warrant full Council care. The raw file count nominally lands in XL range, but that count is inflated by trivial one-line/few-byte declarative fixture data repeating an established, already-5x-used pattern in a single bounded context with no new patterns and modest total lines — mechanically forcing XL off file-count alone would misclassify boilerplate fixture authoring as equivalent-complexity to a multi-context code change. Tie-broken toward L (the higher of the two defensible readings), not XL, because bounded-contexts=1 and new-patterns=none are the criteria that actually gate XL's mandatory decomposition halt, and neither fires.

## Recommended Path

- Phase: full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices) → `sdd-verify --mode=plan` (plan-verify gate, M/L) → ready for `/build`
- Slice target: 4-7 (natural seam already visible: m2-copy slice(s) first, m2-copyin slice(s) second, per the owner-accepted landing sequence)

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L — captures acceptance criteria per case (positive/negative twins), REQ-CCR-04 atomicity |
| PM | Always for L — scope discipline across two bundled fixtures, landing-sequence prioritisation (pin-ratchet risk) |
| Architect | Always for L — corpus structural fitness, ADR-0043/0047/0063/0065/0067 alignment, fit-40 fitness function |
| QA Engineer | Always for L — adversarial case design (collision-with-force, dir-source, copy-then-modify collapse; copyIn negative twins) |
| Tech Writer | Conditional — README.md representable-ops sentence is an external contract read by schematic authors and the engine team |

Not triggered: UX Designer (no UI surface), Security Engineer (no sensitivity override — `conformance/` not in sensitive-areas registry), DBA (no schema/migration).

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- Submodule-pin ratchet: once `m2-copyin` positive-outcome cases land on main, the engine cannot advance its corpus pin past that commit until `copyIn` is wire-included engine-side. Mitigation (owner-accepted): land `m2-copy` first, `m2-copyin` after — carry this into `sdd-slice` ordering.
- REQ-CCR-04 atomicity: `corpus.json#fixtures` entry must land in the SAME commit as its fixture's full artefact set — a partial land is a hard failure, relevant to slice boundaries.
- Strict engine decoder (`DisallowUnknownFields`): no new corpus schema keys — any accidental new key is an engine-side hard failure invisible to local fit-40.
- `m2-copyin` case set is explicitly "to be refined in spec" — spec phase must nail down the exact case list before design/slice.

## Halt?

No

## Notes for Next Phase

- `sdd-explore` should read `conformance/m2-rename-move/` (multi-case template with per-case factory override) as the primary structural precedent, plus `src/commons/index.ts:286` (`copyIn`) and `:356` (`copy`), and `src/core/wire.ts:34-39` (wire shapes) for the verb contracts being fixture-ized — read-only, no src changes are in scope.
- Preserve the honesty-boundary framing (REQ-CFX-11) verbatim when drafting scenarios: these are hand-authored declarations, not runner-proven outcomes.
- Slice ordering should mirror the owner-accepted landing sequence (`m2-copy` before `m2-copyin`) to respect the pin-ratchet mitigation.
