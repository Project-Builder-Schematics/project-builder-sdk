# Triage: Author write surface — honest write-verb rename (replaceContent / modify(fn))

**Classification**: L
**Decided at**: 2026-07-14T00:00:00Z
**Re-cut at**: 2026-07-14 (owner decision after blind council review — see "Scope Re-cut" below)
**Change name**: `author-write-surface`

## Problem & Scope

> Schematic authors face a dishonest write API: `.modify(content)` promises "modify" but
> wholesale-replaces the file's text; `.raw(fn)` exists only because the `modify` name was taken;
> and the custom-dialect kit (`defineDialect`/`defineOpPack`/`withOps` in `src/core/define-dialect.ts`)
> is complete and tested but locked behind ADR-0009's internal boundary, so SDK consumers cannot
> create their own dialects/ASTs. Why now: pre-1.0 POC — the last cheap window for a clean-break
> rename with no deprecation machinery.

```yaml
scope:
  in_scope:
    - "Rename .modify(content) -> .replaceContent(content) on all handles AND the commons top-level verb"
    - ".modify(fn: (ast) => void) replaces .raw(fn) entirely: chained form on dialect handles (importable form modify(handle, fn) DEFERRED at foresight gate — owner decision obs #2128)"
    - "Migrate the ./conformance published contract in lockstep: ConformanceCase.chain's { raw } step + dispatch (src/conformance/index.ts) — architect-found scope gap"
    - "Update RESERVED_HANDLE_NAMES (reserve-both: raw STAYS blocked per owner decision obs #2117 — security guardrail; replaceContent added; final set = then/read/raw/modify/replaceContent/rename/move/copy/remove)"
    - "Update the Handle type (currently frozen per architecture.md) — explicit ADR required"
    - "Migrate the ADR-0039 reject-while-pending guard from .modify() to .replaceContent() (guard must NOT attach to the new .modify(fn))"
    - "Regenerate FIT-04 dts-baseline snapshots (test/fitness/dts-baseline/) for every renamed export"
    - "Tests + docs (incl. ADR for the modify-polymorphism decision with rejected alternatives: keep raw / name it edit)"
  out_of_scope:
    - "Wire IR unchanged ({ op: \"modify\" } directive stays byte-identical)"
    - "No new dialects beyond TypeScript"
    - "No deprecation aliases (clean break)"
    - "Engine/CLI untouched"
    - "Coalescing/mutation-gate/lazy-print semantics unchanged"
    - "DEFERRED (re-cut): public dialect-kit subpath / ADR-0009 revisit / FIT-08 inversion -> public-package plan (pending-changes row ~210)"
    - "DEFERRED (re-cut): hasImport + query helpers -> Group 5 (pending-changes row ~327; needs return-channel ADR first)"
    - "DEFERRED (re-cut): standalone op-function exports from ./typescript -> gated on the row-320 CONFIRMED identifier-injection validator"
    - "DEFERRED (foresight gate, obs #2128): importable modify(handle, fn) + its run-identity guard subsystem -> own pending change; REQ-TSD-12 V3 text + design #origin mechanism preserved as prior art"
```

## Scope Re-cut (2026-07-14, owner decision)

Blind council review (PM + architect, independent) converged: the original scope bundled
four changes under one why-now. Owner accepted the recommended cut. This change keeps ONLY
the honest write-verb rename (the piece whose pre-1.0 clean-break window is real). The
problem statement's dialect-kit clause ("locked behind ADR-0009's internal boundary") is
DEFERRED with its piece — the contract this change answers to is the dishonest-write-API
clause only. Classification stays L: both sensitivity overrides (security code-execution on
the escape hatch; public-api contract on exports/.d.ts) fire on the rename itself.

## Description Received

> Ratified design decision (engram #2109, topic `sdd/improve-raw-dx/api-redesign-decision`):
> redesign the author-facing write API — `.modify(content)` renames to `.replaceContent(content)`;
> `.raw(fn)` is removed, absorbed by `.modify(fn)` as the AST escape hatch; structured ops stay
> unchanged; wire IR untouched. This triage additionally resolves the predecessor's one open point
> (top-level commons `modify` verb renames too) and expands scope to publicly expose the
> custom-dialect kit, revisiting ADR-0009.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | `base-handle.ts`, `dialect-handle.ts`, `define-dialect.ts` (Handle type, `RESERVED_HANDLE_NAMES`), `commons/index.ts`, `dialects/typescript/{ops,index,ast}.ts`, `conformance/index.ts` (uses `{raw}` chain steps), `src/index.ts` (ADR-0009 boundary), `package.json` (new 6th export subpath), new dialect-kit entry file, plus tests + docs (ADR-0009, ADR-0039, `authoring-a-dialect.md`) — ~12-15 files | L |
| Lines affected (estimated) | Rename across call sites + new query helpers + new public subpath wiring + ADR/doc updates + tests — ~600-1200 | L |
| Bounded contexts | 4 within one package: (1) core write-surface (`base-handle`/`dialect-handle`/`define-dialect`), (2) public API surface (`package.json#exports`, ADR-0009 boundary), (3) typescript dialect module (new query helpers), (4) conformance (`{raw}` chain steps) — same "one package, not 3+ independently-shippable systems" reasoning as the `stage-6-release-shape` precedent, so L not XL | L |
| New patterns | New pattern: converting an internal extension kit (ADR-0009) into a supported public contract | L |
| Test types | Existing types (unit + conformance), no new category | M |

### Overrides Triggered

- **Sensitivity override — security (code execution)**: `openspec/sensitive-areas.md` names `.raw()` + `src/core/dialect-handle.ts` at **high** confidence ("`.raw` runs arbitrary author code against a live AST"). This change directly redesigns that exact mechanism (`.raw` → `.modify(fn)`). Forces L minimum.
- **Sensitivity override — public-api (contract)**: same registry names `package.json#exports` + emitted `.d.ts` at medium confidence, "review-required for breaking changes." Verified live: `package.json` currently has 5 export subpaths; this change adds a 6th (dialect kit) plus renames/removes existing verbs. Forces L minimum, corroborating the above.
- **Breaking API change**: clean-break rename with no deprecation aliases → minimum M independently, subsumed by the L overrides above.

**Final classification**: **L** — two independent sensitivity overrides (security code-execution on the `.raw`/`.modify(fn)` escape hatch, public-API contract on the exports map) both force L minimum; size criteria (files, bounded contexts, new pattern) independently land in the L band and stay short of the XL "3+ independently-shippable systems" line — this is one cohesive package-internal redesign, not disparate systems.

## Recommended Path

- Phase: Full Planner with Council
- Skills to invoke (in order): `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-slice` (target 4-7 slices) → `sdd-verify --mode=plan` → `/build` (`sdd-apply` ⇄ `sdd-verify` in-loop) → `sdd-verify --mode=final` → `sdd-archive`
- Slice target: 4-7

## Recommended Personas (L)

| Role | Reason |
|---|---|
| Business Analyst | Always for L |
| PM | Always for L |
| Architect | Always for L — Handle type unfreeze, ADR-0009 boundary revisit, new public dialect-kit export shape |
| QA Engineer | Always for L |
| Security Engineer | Sensitivity override triggered: `.raw`→`.modify(fn)` escape-hatch redesign + new public exposure of the dialect kit widens third-party-trust surface (community dialects) |
| Tech Writer | Public contract exposed: new export subpath is a semver contract; verb renames + `authoring-a-dialect.md`/ADR updates need author-facing clarity |

Not needed: UX Designer (programmatic authoring API, no rendered UI); DBA (no schema/migration).

## Spec Reference

`spec_source: internal` — no reference captured (write_mode: sync).

## Risks Flagged at Triage

- Handle type is explicitly "frozen" per `architecture.md` — unfreezing it needs an explicit ADR, not a silent deviation; Architect must treat this as a gated decision at design.
- ADR-0009 revisit is a formal boundary reversal (internal → public) — needs its own ADR entry, not just code changes.
- `src/conformance/index.ts` chain steps use `{raw}` today — must migrate in lockstep with `runRaw`/`runModify`, or conformance tests will silently validate the wrong verb.
- Clean break (no deprecation aliases) means any existing caller of `.raw()`/`.modify(content)` breaks immediately — confirm no external consumer depends on the current shape before design commits.
- New public dialect-kit subpath widens the "security (third-party trust)" surface already flagged in the registry for community dialect packages — Security Engineer should scope this specifically, separate from the `.raw` merge review.

## Halt?

No

## Notes for Next Phase

`sdd-explore` should: (1) enumerate all call sites of `.modify(content)`/`.raw(fn)` across `src/` + tests + docs before design finalizes the rename — including the `./conformance` published `{ raw }` chain contract and planted fixtures; (2) read `docs/authoring-a-dialect.md` + the ADR-0009/ADR-0039 entries in `architecture.md` as the doc precedents needing updates; (3) confirm the Handle-type freeze rationale and what "unfreezing" requires procedurally; (4) verify `RESERVED_HANDLE_NAMES`' current contents for a collision-free `raw`-free/`replaceContent`-reserved swap; (5) map the FIT-04 dts-baseline regeneration procedure (which of the 7 snapshots churn); (6) resolve or explicitly re-defer pending-changes row-136 (modify-after-AST-op last-write-wins) — it sits directly in the rename's blast radius. Item DROPPED by re-cut: public-subpath name/shape for the dialect kit (deferred with its change).
