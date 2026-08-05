# Simplify report — `sdk-plain-error-note`

**Gate**: `sdd-simplify`, M profile — ONE `cleanup-reviewer` carrying all four angles (reuse,
simplification, efficiency, altitude) over the FULL diff, run once between the last in-loop verify
`pass` and `sdd-verify --mode=final`.

**Scope**: `git diff b5d4339..HEAD` — 17 files, +1381/−5. Production surface is ~36 lines
(`src/transport/error-text.ts`, `src/transport/runner.ts`); the rest is test.

**Verdict**: `clean` — **0 findings, 0 applied, 0 skipped, 0 reverted.**

## Why nothing was changed

The reviewer read both production files in full, not only the diff hunks. `scrubAbsolutePaths`
composes the pre-existing `toProjectRelativePath` and `OUTSIDE_PROJECT_TOKEN` rather than
re-implementing path handling, and the terminal-catch change is one added branch on an existing
ternary. There is no new mechanism to generalise and no helper that was reinvented.

## Explicitly considered and rejected

Recorded because it tells the next reader the ground was covered, rather than leaving an empty
findings list to be read as a shallow pass.

| Candidate | Why not flagged |
|---|---|
| **Nine new fixture directories** under `test/fixtures/frame-runner/` across three slices — the classic cross-slice fan-out signal | The repo's pre-existing set (`happy`, `crash`, `import-crash`, `collide`, `cap-boundary`, `sabotage`, `schema`) is **already one directory per scenario**, each mapping to a distinct REQ or branch. The nine new ones each pin a distinct REQ-RUN-09 / REQ-WPS-07 branch or platform shape. Convention-following, not duplication |
| **Three near-identical e2e canary tests** (`exit-matrix.e2e.test.ts:317-345`) sharing a 4-line spawn/serve/expect shape — could be table-driven | The file's **pre-existing** `(b)` and `(d)` cases (`:57-61`, `:124-130`) already use repeated `it()` blocks for structurally identical scenarios rather than a loop. Collapsing only the new ones would leave the established siblings unlooped — that is inconsistency, not cleanup |
| **`canary-path-leak` and `unc-path-leak` fixtures** could merge into one 4-style fixture, saving a directory | The split mirrors the two REQ-IDs they each prove (REQ-WPS-07.4 vs `.6`), and each file's own comment states that intent. REQ-aligned separation, not redundant near-clones |
| **`scrubAbsolutePaths` runs two sequential regex passes** over the message | Invoked once per failed run in the terminal catch — not a hot path. Micro-optimising it would buy nothing measurable and would obscure the two-pass ownership boundary the design depends on |

## Guardrail observed

Every angle was applied under the standing constraint that findings must preserve REQ behaviour.
No candidate fix would have altered a Given/When/Then outcome, so none was skipped on those grounds.

One constraint was given to the reviewer up front and is worth recording: **do not propose
collapsing tests in a way that weakens them.** This change is M because of disclosure control; an
assertion folded into a loop that no longer names what it proves is a downgrade wearing the costume
of a simplification.

## Status

Non-blocking gate, nothing to apply. Proceeding to `sdd-verify --mode=final`.
