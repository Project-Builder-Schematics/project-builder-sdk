# Triage: Per-Mutation Schematic Authoring Docs

**Classification**: S
**Decided at**: 2026-07-28T00:00:00Z
**Change name**: `mutation-schematic-docs`

## Problem & Scope

> The SDK was just published to npm for the first time (2026-07-28). External users can now
> install it, but the documentation does not explain how to author a schematic using each
> possible mutation the SDK supports. New external adopters landing from npm have a quickstart
> but no per-mutation guidance. First public release makes the docs the package's front door.

```yaml
scope:
  in_scope:
    - "A detailed doc/section per possible mutation explaining how to build a schematic with that mutation"
    - "docs/quickstart.md updated to reference EVERY mutation at the end, each linking into its detailed explanation"
  out_of_scope:
    - "Code/API changes"
    - "Engine/CLI internal docs"
    - "README restructure beyond what linking requires"
```

## Description Received

> Detailed documentation, one section/doc per authoring mutation (the SDK's seven verbs:
> `create`, `replaceContent`, `remove`, `rename`, `move`, `copy`, `copyIn`), plus a
> quickstart.md update linking to each from a final reference list. Docs-only.

## Criteria Evaluation

| Criterion | Evidence | Score |
|---|---|---|
| Files affected (estimated) | `docs/authoring-verbs.md` (expand 7 sections) + `docs/quickstart.md` (Next Steps list); possibly 1-2 new deep-dive files for verbs needing more room, mirroring `create-templates.md`'s split off `create` | S (1-3) |
| Lines affected (estimated) | 7 verbs × ~60-120 lines of genuinely detailed prose/examples + quickstart edit ≈ 450-850 lines | M (raw floor) |
| Bounded contexts | 1 (`docs/`, no code/API touched) | XS/S |
| New patterns | None — mirrors the EXISTING per-topic-doc pattern already in this repo (`create-templates.md` 483 lines, `dry-run.md` 54 lines, `authoring-errors.md` 92 lines all deep-dive one topic each); `authoring-verbs.md` already has a per-verb subsection skeleton to extend | none |
| Test types | None — docs-only, Strict TDD does not apply to prose (no code/behavior changes) | XS |
| Precedent | Mirrors `docs/create-templates.md`, `docs/dry-run.md`, `docs/authoring-errors.md` — the "one detailed doc per authoring topic" pattern is already established for 3 of the 7 verbs' surrounding concepts | -1 level |

### Overrides Triggered

None.

**Final classification**: S — raw floor is M (driven by estimated prose volume across 7 verbs), but this is mechanical work extending an already-established "one detailed doc per authoring topic" pattern (`create-templates.md`, `dry-run.md`, `authoring-errors.md` already exist as precedent) — reduced one level per the Precedent Modifier, same logic as "a fourth endpoint mirroring three existing ones, whatever its line count." Docs-only: no code, no API, no migration, no external dependency, no sensitivity override, single bounded context (`docs/`).

**Escalation trigger for next phase**: if `sdd-explore`/inline execution finds the "detailed doc per mutation" scope genuinely requires 7 NEW dedicated files (not expanded sections in `authoring-verbs.md`) each at `create-templates.md`-scale depth (400+ lines), re-triage to M — that volume would no longer be "mechanical, whatever the line count" but a materially larger authoring effort.

## Recommended Path

- Phase: brief context + inline execution
- Skills to invoke (in order): `sdd-explore` (light, read-only — confirm per-verb behavior against `src/commons` before writing prose) → orchestrator executes inline (edit `docs/authoring-verbs.md` + `docs/quickstart.md`, possibly split 1-2 verbs into dedicated files if warranted)
- Slice target: N/A (S — no `sdd-slice`)

## Recommended Personas

Personas not applicable for S — inline path, no Council delegation.

## Spec Reference

spec_source: internal — no reference captured.

## Risks Flagged at Triage

- Doc accuracy risk: `docs/authoring-verbs.md` already contains precise, load-bearing behavioral claims (e.g. the `replaceContent`/`.modify()` `AuthoringError` label nuance). New per-mutation detail must be verified against `src/commons` source, not invented from the existing summary alone — a documentation error here is now public-facing (first npm release).
- Scope-creep risk: "detailed doc per mutation" could balloon into `create-templates.md`-scale depth per verb; if that happens mid-work, escalate per the trigger noted above rather than silently absorbing the ceremony gap.

## Halt?

No.

## Notes for Next Phase

- Read `docs/authoring-verbs.md` (144 lines, all 7 verbs already summarized) and `src/commons`
  before writing detailed sections — do not paraphrase the existing summary, verify against
  source (this is a public npm package's front door).
- Precedent files to mirror structurally: `docs/create-templates.md`, `docs/dry-run.md`,
  `docs/authoring-errors.md`.
- `docs/quickstart.md`'s existing "Next steps" section (lines 177-186) links to
  `authoring-verbs.md` as ONE entry covering all 7 verbs — this must change to link each
  mutation individually per scope.
