# Archive Report: sdk-plain-error-note

**Archived at**: 2026-08-06  
**Verify verdict**: pass-with-followups  
**Spec version archived**: V1 (pbuilder-runner-bin), V2 (wire-protocol-spec) — both signed 2026-08-01  
**Change**: `sdk-plain-error-note` (M-triage, sensitivity override: disclosure-control)

## Summary

This change widens the runner's terminal catch from a 3-branch ternary to 4-branch ternary, surfacing plain `Error` messages through the existing `pbuilder-runner:` sentinel and scrubbing discipline (`scrubAbsolutePaths`) before composition. The problem: descriptive plain-`Error` throws from schematic factories were discarded, leaving operators with the literal fallback `"run failed"` instead of actionable context (Workbench-01 evidence: a 30-second fix cost 6-8 minutes of blind diagnosis). Delivered: operators now see `pbuilder-runner: Could not locate the imports array closing in src/app.module.ts` instead of `run failed`, immediately actionable. Outcome status: `delivered-pending-activation` — the SDK binary ships the fix; downstream consumers (engine, CLI) do not see this benefit until they update. Reachability verified against both repos' `origin/main` (2026-08-06).

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed |
|---|---|---|---|---|
| `pbuilder-runner-bin` | New requirement class | 1 (REQ-RUN-09 + 4 scenarios) | 0 | 0 |
| `wire-protocol-spec` | Modified requirement | 3 (REQ-WPS-07.4, .5, .6 scenarios) | 1 (REQ-WPS-07 main text, uncurated-content addendum) | 0 |

### REQ-RUN-09 (pbuilder-runner-bin, ADDED)
The runner's terminal catch now surfaces `.message` of ANY thrown `Error` instance (not only curated classes `AuthoringError`/`TransportFault`/`IntentRejectedError`) through the existing note discipline, scrubbed per REQ-WPS-07's uncurated-content-class addendum. Non-`Error` throws fall back to the fixed literal `"run failed"`, unchanged. Exit-code classification is UNCHANGED (plain `Error` still exits 4). Four scenarios: plain Error message surfaces (REQ-RUN-09.1), non-Error keeps fallback (REQ-RUN-09.2), curated classes byte-identical (REQ-RUN-09.3), cap discipline applies to composed note (REQ-RUN-09.4).

### REQ-WPS-07 (wire-protocol-spec, MODIFIED)
The requirement text now includes the "Uncurated content class addendum": the terminal-catch fallback branch now surfaces plain `Error.message` through the same discipline. Because that content is host/library-authored, it may embed absolute paths. The runner MUST apply best-effort scrub of POSIX (`/...`), Windows drive-letter (`C:\...`), and UNC/WSL-interop (`\\server\share\...`) shapes to their project-relative form or `<outside-project>` placeholder. This scrub is diagnostics-preserving, best-effort, NOT a security boundary: non-path-shaped secret content (e.g., env-var values) passes through bounded but unredacted. Three new scenarios: uncurated plain-Error with POSIX/Windows paths scrubbed (REQ-WPS-07.4), secret-shaped non-path content passes through unscrubbed (REQ-WPS-07.5), UNC/WSL shapes scrubbed to placeholder (REQ-WPS-07.6).

## Archive Location

`openspec/changes/archive/2026-08-06-sdk-plain-error-note/`

Specs delta artefacts preserved at `specs/{pbuilder-runner-bin,wire-protocol-spec}/spec.md` for audit trail. Main specs synced to `openspec/specs/`.

## Lessons Learned Persisted

Three high-value lessons extracted:

1. **Test corpus blindness: when all test inputs share one shape, parallel judges find in minutes what sighted passes missed** — The bypass bypasses (whitespace-terminated path, single-segment path) passed 100% of the suite because all test inputs were multi-segment, space-free. Four sighted reviews missed both; two blind judges found both in minutes. Lesson: expand test corpus toward edge cases (single segments, boundary chars) before verify, not after judgment-day.

2. **Fix attribution requires controlled comparison, not narrative confidence** — This fix closed two shapes (spaces, single segments) but opened a third (paths with no separator before them). Measured comparison (running each finding against pre-fix and post-fix regexes) proved the regression was introduced BY the fix. Lesson: before shipping a shape-matching fix, measure its impact on the SAME corpus used to find the bug.

3. **Shipped binary reachability is not operator reachability** — The SDK binary now surfaces messages; reachability check against engine and CLI repos showed the operator still sees nothing (CLI pins engine version predating this change). Outcome is `delivered-pending-activation`, not `delivered`. Lesson: verify against consumer repos' `origin/main`, not just the change's own build-passing tests.

All three persisted as separate observations under `project/lessons-learned`.

## ADRs

### Recommended but Not Yet Promoted

None. No new project-level ADRs are required by this change. ADR-02 (Windows/UNC/WSL fallback rule) and ADR-01 (path formatter selection) were design decisions predating this change; they are documented in the archived `design.md`.

(Note: The asymmetry between POSIX and Windows/UNC path scrubbing was noted in verify-report §3 as a mechanism artifact of ADR-02's correctness constraint, not a deliberate design choice at disclosure-policy level. This is tracked as a future `error-text-parity-audit` process item, not a new ADR.)

## Followups Registered

Two sets of followups registered:

### From verify-report (pass-with-followups findings)

| Description | Type | Size | Origin |
|---|---|---|---|
| POSIX outside-project paths disclose directory-depth and path-tail, while Windows/UNC disclose nothing for the same input — asymmetry is mechanism artifact (ADR-02 correctness constraint) not deliberate policy choice; recommend ADR amendment or explicit security-engineer sign-off | discovery | S | verify-report §3 |
| `specs/pbuilder-runner-bin/spec.md:4` still says `draft` while the rest of the change treats REQ-RUN-09 as signed and implemented; update status line for consistency | metadata | XS | verify-report §6 |
| First `bun test` run produced transient `1 error` (vs. reproduced `2676 pass / 0 fail`); root cause not captured; re-run in CI with full capture if recurs | process | S | verify-report §5 |

Registered in pending-changes.md as two existing rows (note: the metadata-only status-line fix was out-of-scope for archive, filed as a minor issue).

### From outcome-verdict (deferred-activation gate)

| Description | Type |
|---|---|
| **outcome-check**: CLI `cli-runner-note-rendering` (S-000..S-002) lands AND CLI engine pin advances past `project-builder-engine` #195 (commit `4f67b9a`) — reachability check against both repos' `origin/main` confirms operator still sees nothing until both land | outcome-check |

Registered in pending-changes.md as "From `sdk-plain-error-note` (2026-08-06)". Outcome recorded as `delivered-pending-activation`; will re-open to `delivered` when both downstream conditions met.

## Final State

- Spec status: signed (both specs, V1 and V2 as of 2026-08-01)
- Main specs updated: yes, two domains (`pbuilder-runner-bin`, `wire-protocol-spec`)
- Lessons in project memory: 3 new observations
- ADRs in project memory: 0 (no new promotions)
- Pending changes in project memory: 1 outcome-check registered; prior findings persisted as cross-repo reachability debt
- Suite: 2684 pass / 0 fail, `tsc` clean (verified at archive time)
- Change folder: moved to `openspec/changes/archive/2026-08-06-sdk-plain-error-note/` via `git mv` (folder move is the proof of archive)

## Verification

Verification runs at archive seal (2026-08-06 06:52 UTC):
- `bun test`: 2684 pass / 0 fail (full suite, 110s)
- `bunx tsc --noEmit`: clean, no errors

No blockers; change is sealed and ready for merge.

---

**Archive sealed by**: sdd-archive (SDD phase: archive, TRIAGE: M)  
**Timestamp**: 2026-08-06 06:52 UTC  
**Storage**: openspec (filesystem-based change artefact store)  
