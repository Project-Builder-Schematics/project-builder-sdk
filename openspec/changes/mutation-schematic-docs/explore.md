# Exploration: Per-mutation schematic authoring docs (mutation-schematic-docs)

**Triage**: S (light depth)
**Persona lens**: none

## Cross-Change Lessons Consulted

No `pattern`/`discovery`/`bugfix` memories matched this topic. Related config: `sdd-init/project-builder-sdk` (#1996, public npm visibility); `project/sensitive-areas` (#1998) — `docs/**` is not a registered row.

## Current State

`docs/authoring-verbs.md` (143 lines) documents 7 verbs at SUMMARY depth — `create`, `replaceContent`, `remove`, `rename`, `move`, `copy`, `copyIn` — each ~1 paragraph + one example, plus the `find().read()` trichotomy. `docs/quickstart.md` "Next steps" (177-186) links `authoring-verbs.md` ONCE for all 7 collectively, not per-verb.

**Undocumented 8th public verb — `scaffold`** (`src/commons/index.ts:258`): walks a package-local folder, applies rename→token-translation→`.template`-strip + include/exclude globbing, emits per-entry `create` directives. Fully specified (REQ-FSC-01..09: defaults, symlink no-descent, 10k-entry cap, npm-tarball empty-folder caveat) and fully tested (`test/scaffold/*` — 9 files — plus 2 e2e + 1 fitness test), but appears in ZERO docs (not `authoring-verbs.md`, not `README.md`'s reading path, not `create-templates.md` despite sharing create's template pipeline). It is NOT in the `AuthoringVerb` error-label union (`src/core/authoring-error.ts:37` = exactly `create|modify|remove|rename|move|copy|copyIn`, 7 confirmed) — triage's "seven verbs" is correct for that axis, but `scaffold` is a separate, shipped, public mutation the docs never mention. See Open Questions.

`docs/create-templates.md` (483 lines) is the ONLY precedent for a verb-specific file — split off `create` because its template mini-language (delimiters/7 pipes/loops/whitespace/sandbox) is a sub-language, not because `create`'s call-site prose needed 483 lines. `dry-run.md` (54) / `authoring-errors.md` (92) are per-CONCEPT docs, not per-verb. Cross-linking is relative markdown with a "Next steps" list per file.

`test/docs/doc-set-content.test.ts` (REQ-AOD-03.1) requires `authoring-verbs.md` to contain 6 named verbs (a FLOOR, not ceiling, per its own comment) — `copyIn` already satisfies it as the true 7th. It also bans wire-internal terms (`EmitRejection`, `Directive`, `Batch`, `delete`) across 6 named docs; any NEW file this change adds is uncovered unless that list is extended.

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `docs/authoring-verbs.md` | Modify | expand all 7 verb sections to detailed depth |
| `docs/quickstart.md` | Modify | replace the single collective link with a per-mutation index |
| `docs/README.md` | Read-only | confirm reading-path list stays accurate |
| `test/docs/doc-set-content.test.ts` | Read-only | confirms floor, not ceiling — no change forced |
| `src/commons/index.ts`, `src/core/authoring-error.ts` | Read-only | source of truth per verb |

## Affected Flows

Not applicable — docs-only, no runtime user flow.

## Architecture Touchpoints (A3)

Not applicable — S-tier, `arch_context_explore` not injected below M.

## Sensitive Areas Crosscheck

None touched.

## Approaches

**1. Expand in place (recommended)** — deepen each of the 7 verb sections inside `authoring-verbs.md` (overloads, options, force/collision semantics, error `reason`/`verb` label, edge cases); split a verb into its own file only if it has a genuinely separate sub-language, as `create` did. Effort: Low. Matches the only real precedent; stays under the 400-line/verb escalation trigger.

**2. One new file per verb** — 7 files at `create-templates.md` scale. Effort: High. No precedent for 6 of 7 verbs; this is literally the shape triage flagged as the re-triage-to-M signal.

**3. Hybrid escape hatch** — expand in place, but give a verb (candidate: `copyIn`, with its 4 `source-*` reasons) its own short file only if its section provably overflows during writing.

## Recommendation

Approach 1, with Approach 3 as a fallback only if a section's actual prose overflows. `quickstart.md`'s Next steps gets one line per verb, anchor-linking into its `authoring-verbs.md#{verb}` subsection.

## Risks

- `scaffold` omission leaves a shipped, tested 8th mutation completely undocumented on the SDK's first public day, regardless of this change's scope decision.
- Doc-accuracy: `replaceContent`'s `AuthoringError` reports `verb: "modify"`; `copyIn`'s 4 `source-*` reasons are shared with `scaffold`/`create({templateFile})` — expanded prose must preserve these exactly, not paraphrase the existing summary.
- If Approach 3 fires, the new file needs manual addition to `doc-set-content.test.ts`'s banned-terms list (see technical open question).

## Open Questions

- type: product
  question: "Include `scaffold` (`src/commons/index.ts:258`, shipped + tested, undocumented) as an 8th detailed mutation doc, or explicitly defer it?"
  why_it_matters: "The problem statement says EVERY possible mutation; scaffold is one. Excluding it ships a known public-doc gap on release day; including it risks the exact 'needs new create-templates.md-scale files' condition triage flagged as the re-triage-to-M trigger, since REQ-FSC-01..09 + the packaging caveat is comparably dense."
- type: technical
  question: "If a verb section is split into a new file (Approach 3), does `doc-set-content.test.ts`'s wire-term-ban list need that path added?"
  why_it_matters: "Without it, a new file could leak `Directive`/`Batch`/`EmitRejection` with no fitness function catching it."

## Ready for Proposal

**Status**: partial
**Reason**: Grounded and complete for the 7 named verbs — behavior confirmed against `src/commons/index.ts` and `src/core/authoring-error.ts`, placement approach recommended, verification anchors gathered. One open item (`scaffold`) is a scope decision only the user can make, not a blocker.
**Recommended action**: Surface the `scaffold` product question to the user before inline execution. Proceed with Approach 1 on the 7 named verbs regardless of that answer; if `scaffold` is added, treat it as an explicit scope addition and re-check the S-tier escalation trigger rather than folding it in silently.
