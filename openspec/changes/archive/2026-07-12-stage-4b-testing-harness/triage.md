# Triage: Stage 4b — Testing Harness

**Classification**: L
**Decided at**: 2026-07-10T00:00:00Z
**Change name**: `stage-4b-testing-harness`

## Problem & Scope

> Schematic authors cannot test their factories. (1) `defineFactory` is unreachable from any installed package — the `./core` entry was never wired into `exports`. (2) Even if reachable, there is no supported test harness: the ONE normative `ContractFake` is repo-internal. Without 4b, stage-4's typed options crystallize as outputs-without-outcome. Owner commitment (stage-4 steward foresight CQ1, 2026-07-07): COMMITTED-NEXT.

```yaml
scope:
  in_scope:
    - "./testing facade with runFactoryForTest wrapping the normative ContractFake; defineFactory exported from ./testing as the ONLY sanctioned kit name it surfaces (path-scoped FIT-08 carve-out); no other kit re-exports (owner ruling P1, 2026-07-10 — supersedes the original 'no name re-exports' wording)"
    - "defineFactory reachability VIA ./testing ONLY: ./core stays unmapped, FIT-09 keeps asserting ./core undefined; production graduation deferred to Stage 6 (owner ruling P1, 2026-07-10 — original 'wire ./core into exports' item STRUCK: repeals ADR-0009, rejected blind by architect + security)"
    - "runFactoryForTest result exposes committed tree + emitted IR Batch[] + error (spy-style batch recording wrapped around the normative fake) with documented unrendered-template non-promise (owner ruling P2, 2026-07-10 — closes §4.5 exit criterion in full). Spec-council rulings 2026-07-10: tree = committedTree() ONLY (seed observed via reads, never in result.tree); Batch + Directive re-exported from ./testing as TYPE-only documented exports; seed param (Record<string,string>, sole seeding channel) RATIFIED as signed API surface with mandatory doc home"
    - "positive testing-story docs: README testing section + JSDoc @example (FIT-06 house style) (owner ruling P3, 2026-07-10)"
    - "ADR-0009 amendment (third audience: author-testing, OWN entry ./testing, 0.x semver-exempt like the kit until validated by real use — owner ruling P4, 2026-07-10)"
    - "4 companion guards: FIT-08 carve-out, dev-only bundle guard, FIT-04 dts baseline, FIT-09 exports entry"
    - "fail-closed parity invariant"
    - "revert the README incremental-shipping qualifying-line"
    - "behavioural outcome-proof: installed-consumer-vantage e2e (spawn-build-import, FIT-04 pattern) running a factory end-to-end through the published ./testing entry (owner scope amendment, 2026-07-10)"
    - "in-memory-only invariant: the harness never touches fs/net/env/argv, frozen as REQ + fitness (owner ratification 2026-07-10 — surfaced by propose council as unauthorized addition, ratified in)"
  out_of_scope:
    - "add/remove L2 collection enforcement"
    - "prompt rendering (Go CLI)"
    - "dialects / Stage 5"
    - "L2 composition"
    - "real wire"
    - "stage-4's 4.4 example must NOT depend on 4b"
```

Split from `stage-4-typed-options` (D7, owner-ratified 2026-07-06). `openspec/pending-changes.md:106` anticipates re-triage `L→M` — weighed below, not adopted.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected | ~9-11 (exports, `./testing` facade, ADR-0009, 3-4 fitness files, README) | L |
| Lines affected | ~300-700 est. | M/L |
| Bounded contexts | 2 (public API/build surface; test-infra/fitness) | M/L |
| New patterns | Third public audience wrapping a normative fake, no prior precedent | L |
| Test types | Dev-only bundle guard + exports-entry guard are new; FIT-04 dts baseline reuses existing pattern | M/L |

### Overrides Triggered

- **Public-API (contract)** (`sensitive-areas.md` row 6, `exports`/`.d.ts`) — adds `./testing`, wires `./core` into `exports` for the first time (both confirmed absent today; only `.`, `./commons`, `./conformance` exist).
- **Security (supply-chain)** (row 1) — new consumer-facing entry point ships in the npm tarball.
- Registry rule: sensitive-area hit forces minimum L regardless of size.

**Final classification**: **L** — override is independently sufficient; size criteria also land in L on their own. Owner's `L→M` noted, not adopted: drivers are real (public npm surface, first third audience), not ceremony cost. **Owner CONFIRMED L at the interactive checkpoint (2026-07-10)**, and amended in_scope (+ consumer-vantage e2e outcome-proof).

## Recommended Path

- Phase: full Planner with Council
- Skills: `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice`
- Slice target: 4-7

## Recommended Personas

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| Architect | Always for L |
| QA Engineer | Always for L |
| Security Engineer | Sensitivity override (public-api + supply-chain) |
| Tech Writer | New public export surface + externally-visible ADR amendment |

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- Owner expected `M`; surface override rationale early to pre-empt re-litigation.
- Dev-only bundle guard must keep `ContractFake`/test-only code out of production `dist`.
- ADR-0009 amendment must extend the two-audience boundary, not redefine it.
- Verify stage-4's 4.4 example stays independent of `./testing`.

## Halt?

No.

## Notes for Next Phase

- Read `openspec/decisions/0009-two-audiences-contributor-kit.md` fully before design.
- `defineFactory` lives at `src/core/context.ts:38`.
- Reuse the existing FIT-04 spawn-build-and-diff dts-baseline pattern (lessons-learned #648) rather than re-deriving it.
