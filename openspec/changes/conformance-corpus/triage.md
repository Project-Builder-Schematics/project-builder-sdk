# Triage: Conformance Corpus (SDK↔engine live conformance fixtures)

**Classification**: L
**Decided at**: 2026-07-18T07:53:31Z
**Change name**: `conformance-corpus`

## Problem & Scope

> The engine repo (`sdk-live-conformance` / PC-PROTO-02) is BLOCKED on M1 until this SDK repo
> lands a conformance fixture corpus under `conformance/` at repo root on `main`. Today all
> SDK↔engine validation runs against the in-repo fake, never the real runner
> (`dist/bin/pbuilder-runner.js`) against the real engine. The engine consumes the corpus as a
> pinned git submodule; its Go harness reads plain files and executes factories through the real
> runner. Hurting: the engine team (blocked milestone) and both repos (fake/engine fidelity gaps
> go undetected). Why now: handoff landed, M1 is current.

```yaml
scope:
  in_scope:
    - "conformance/ at repo root: corpus.json + ALL FIVE fixtures (m1-vehicle, m2-modify, m2-delete, m2-rename-move, m2-create-composition), each with manifest.json/factory.ts + optional seed/expected/schematic"
    - "m1-vehicle = priority / walking-skeleton"
    - "bun install --frozen-lockfile && bun run build stays green"
  out_of_scope:
    - "engine-side changes (submodule pin advance)"
    - "wire spec or runner changes"
    - "engines.bun pin (already landed)"
    - "new SDK features"
```

**Owner-ratified (echoed)**: full corpus in ONE change; incremental delivery via slices
(`corpus.json` grows as fixtures land, fail-closed); automatic execution mode.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | `corpus.json` + 5 fixtures × (manifest, factory, optional seed/expected/schematic) ≈ 35-45 files, mostly 1-line fixture bytes | L (raw count) |
| Lines affected | ~250-350 authored lines (manifests+factories); rest is trivial fixture bytes | M |
| Bounded contexts | 1 new dir added, but requires cross-cutting knowledge of 3 existing subsystems: authoring surface, schematic lowering, wire exit-code taxonomy (EXC-01) | M/L |
| New patterns | Checked against existing `test/fake/conformance-corpus.ts` (in-process TS scenario array, `bun test`-consumed). The new corpus is a JSON-manifest, plain-file, cross-repo contract consumed externally via git submodule by a Go harness — not a variant, genuinely new | L |
| Test types | Handoff only requires build stays green; no SDK-side self-check mandated, but corpus drift would otherwise surface only in the engine's external CI later — likely warrants a new test type (design decision, not settled here) | M/L |

**Overrides**: none of the hard sensitivity overrides fire (no auth/payments/privacy, no
`.github/workflows/`/publish changes, no migration, no new dependency).

**Final: L** — driven by the "new pattern" row (genuinely new cross-repo fail-closed fixture
contract) and the correctness stakes of external fail-closed validation (any manifest mismatch
is a HARD failure, not a skip). Owner's own framing (priority fixture first, rest incremental)
already matches L's walking-skeleton + SPIDR shape. M vs L was close; chose higher per
tie-breaking rule.

## Recommended Path

- Full Planner with Council
- Skills: `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` →
  `sdd-verify --mode=plan` → `/build`
- Slice target: 5 (`m1-vehicle` walking skeleton, then `m2-modify`, `m2-delete`,
  `m2-rename-move`, `m2-create-composition`)

## Recommended Personas

| Role | Reason |
|---|---|
| Business Analyst | Always for L — acceptance criteria from manifest schema (exit codes, transcripts, byte-exact snapshots) |
| PM | Always for L — scope discipline (one change, per owner ruling; guard against engine/wire-spec creep) |
| QA Engineer | Always for L — the corpus IS adversarial fixtures (not-found/collision/dir-target/unrepresentable twins); byte-exactness review |
| Architect | Always for L — keep `conformance/` decoupled from `src/`/build output; resolve `./conformance` (existing export → `src/conformance/`) vs `conformance/` (new root corpus) naming adjacency |
| Tech Writer | Conditional, triggered — manifest schema/factory conventions are a documented cross-team contract; needs docs distinguishing the conformance kit from the conformance corpus |

Not triggered: UX Designer, Security Engineer (no override fired), DBA.

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- **Naming adjacency, not collision**: `package.json#exports` already publishes `./conformance`
  → `src/conformance/` (CONF-01 kit, ADR-0012). New `conformance/` is a sibling root dir, not
  under `src/`, not in `exports` — no packaging collision, but a discoverability risk worth a
  short `conformance/README.md`.
- **Fail-closed external validation**: `corpus.json` must only list fully-landed fixtures —
  land `manifest.json`+`factory.ts`+dirs in the same slice that adds the corpus.json entry.
- **IPC surface exercised**: touches `security (IPC)` (low-confidence row in
  `openspec/sensitive-areas.md`) by running factories through the real runner/engine — explore
  should confirm no wire-spec changes are implied.
- **Test-type gap** (design decision): no internal check currently verifies a factory's actual
  exit code/expected/transcript against its own manifest before landing.

## Halt?

No

## Notes for Next Phase

- Read `CONFORMANCE-CORPUS-HANDOFF.md` (repo root, untracked) in full — authoritative schema.
- `test/fake/conformance-corpus.ts` is RELATED but DISTINCT (in-process scenario array) — useful
  only for its relative-import convention, not as a structural template.
- `src/conformance/{index,run-vehicle}.ts` (CONF-01 kit, ADR-0012) are unrelated in scope but
  share the "conformance" name — don't conflate in spec/design. `run-vehicle.ts` already runs a
  factory against an in-memory tree/read/commit — worth checking during explore as reusable
  plumbing for an eventual self-validation test.
- Slicing order: `m1-vehicle` first (unblocks M1 alone), then the four `m2-*` in any order.
