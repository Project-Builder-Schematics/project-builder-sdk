# retire-sdd

Objective: retire SDD (`openspec/`, `.sdd/`) in favour of ODD (`odd/tasks/<feature>.md`), after rescuing the ADRs, the domain gaps and the open work.
Branch: `chore/retire-sdd` (from origin/main 1a1888f). Delivery: one PR per slice, opened by the coordinating session. Test runner: `bun test`.

## Specs

- S1 — Evidence permalinks pin origin/main `1a1888f316a3be4664e4c72ab1c0c652cbb141c7`, so they survive the deletion. `openspec/` and `.sdd/` are identical at 2d90eaa, the commit the analysis read.
- S2 — Architecture issues in project-builder-architecture for the domain gaps G1-G7 (scaffold and `templateFile`; rendered vs copied; what `read()` returns; the typed error a factory receives; render data as plain JSON; package anchor and reserved lifecycle names; the SDK dialect set and op argument rules) and the process-record candidates (problem-statement non-negotiables, unconfirmed engine limits, lifecycle-name namespaces, non-canonical path forms, greeting and WrittenPaths, the scoped-down Constraint 4). Search open and closed issues first; comment instead of duplicating. Prose goes through the humanizer skill. Waits on the user's approval.
- S3 — SDK issues for the drift (C1 frame budget decides rendering, C2 boolean `force` and the create-templates overwrite docs, C4 wire vocabulary in the error `verb`) and the open work (codegen non-string enum choices, TypeScript op catalog groups 2-6, import/export advisories, React name breadth, runner transport hardening, home/tmp scrub anchors, extensible dialect e2e harness, factory-boundary gaps, test flakiness and tarball content scan); close or retitle #69. Each carries evidence permalinks. Waits on the user's approval.
- S4 — Move every ADR from `openspec/decisions/` to `docs/adr/` unchanged with its number (duplicate numbers keep both files), add `docs/adr/README.md` indexing the decisions recorded only in change designs, and repoint the tests and docs that read `openspec/decisions/`.
- S5 — Untether the tests that read process records or specs as data: delete the pending-changes, objectives-plan, sensitive-areas, architecture.md and fit-43 clause (e) pins with their fixtures; inline the REQ IDs FEH-05 parses; move the scenario matrix beside the e2e; inline or drop the REQ-16 pin.
- S6 — Rewrite ROADMAP.md for ODD and `docs/adr/`, stating that rules come from project-builder-architecture; repoint the `docs/` mentions of `openspec/pending-changes.md` to the S3 issues; permalink the corpus README; delete the SDD-generated `.atl/architecture*.md` and `.atl/viz-*.md`.
- S7 — Delete `openspec/` and `.sdd/`, process records included (user decision L3); `rg` finds no live reference outside `docs/adr/` history text, CHANGELOG and `odd/`.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1, S4 | inline | done — PR1 | see git log |
| T2 | S5 | inline | pending — PR2 | — |
| T3 | S2, S3 | drafts delegated, publish inline | waiting on the user's approval | — |
| T4 | S6, S7 | inline | pending — PR3, after T3 | — |

Route evidence: one understood mechanical change per slice, no writer trigger.

## Log

- L1 (2026-11-13): "necesito que hagamos lo mismo que hicimos con engine y cli que es quitar el SDD ? creo que lo analizamos primero"
- L2 (2026-11-13, user via the orchestrator): "si dale, retire-sdd primero". retire-sdd lands before the hexagonal-layout S16, and S16 drops its ADR move.
- L3 (2026-11-13, user via the orchestrator): "vamos con 1". The process records (architecture-audit, lessons-learned, objectives-plan, problem-statement, sensitive-areas, pending-changes) are deleted with the S1 permalinks as their archive; no `docs/history/`. This replaces the hexagonal-layout Q8 answer that kept them in `openspec/`.
- L4 (2026-11-13): no ADR exists only in the archive; 13 decisions live only in change designs (react-dialect, sdk-plain-error-note, context-singleton-fix, modify-e2e-extensible) and are indexed by permalink in `docs/adr/README.md`. Moved ADR text that mentions `openspec/decisions/` (0019, 0038) is history and stays unchanged.
- L5 (2026-11-13): full `bun test` on 1a1888f plus the move: 4004 pass, 2 fail, both in `fit-raw-sweep` (its `docs/**` sweep now saw ADR history quoting `.raw` and free `modify(`). The sweep now skips `docs/adr/`, as it skipped `openspec/` before; `fit-raw-sweep` 13/13 GREEN after the fix.
