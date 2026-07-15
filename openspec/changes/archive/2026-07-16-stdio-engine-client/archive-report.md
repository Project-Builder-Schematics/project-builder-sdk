# Archive Report: stdio-engine-client

**Archived at**: 2026-07-16T00:00:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V4 (signed, owner, 2026-07-15 — micro-amendment closing judgment-day round 2)
**Triage**: L (sensitive-area override: security/IPC)

## Summary

`stdio-engine-client` ships the SDK's first real `EngineClient` — a length-prefixed stdio
transport, the `pbuilder-runner` bin, an in-process bootstrap bridge, and a spawned-process
fake-engine conformance harness proving the SDK half self-conformant to a new normative wire
spec (`docs/engine-sdk-wire-spec.md`). 41/41 REQs across 7 new domains are COMPLIANT (108/108
scenarios traced). Two rounds of blind judgment-day found 13 confirmed defects (7 CRITICAL,
incl. `Session.flush` silently degrading a transport fault to the wrong exit code) — all fixed
with RED evidence, R2 APPROVED. Steward reckoning DELIVERED, owner-ratified on the three
conscience questions. Seven ADRs promoted to project level; the V4 amendment's cap-budget shift
(`BATCH_CAP_BYTES` → `EMIT_BATCH_BUDGET_BYTES`, 82-byte envelope allowance) synced into three
archived main specs.

## Specs Synced to Main

| Domain | Type | REQs Added | REQs Modified | REQs Removed | Status |
|---|---|---|---|---|---|
| `wire-protocol-spec` | New | 11 | 0 | 0 | ✅ synced |
| `runner-exit-code-taxonomy` | New | 2 | 0 | 0 | ✅ synced |
| `pbuilder-runner-bin` | New | 8 | 0 | 0 | ✅ synced |
| `bootstrap-runner-bridge` | New | 3 | 0 | 0 | ✅ synced |
| `stdio-engine-client` | New | 10 | 0 | 0 | ✅ synced |
| `fake-engine-conformance-harness` | New | 6 | 0 | 0 | ✅ synced |
| `ledger-reconciliation` | New | 1 | 0 | 0 | ✅ synced |
| `emit-rejection-metadata` | Delta (amendment) | 0 | 1 (REQ-ERM-03 carve-out) | 0 | ✅ synced, V2→V3 |
| `batch-cap-contract` | Delta (amendment) | 0 | 2 (REQ-01.1, REQ-04.3 re-anchor) | 0 | ✅ synced, V3→V4 |
| `content-classification` | Delta (amendment) | 0 | 1 (REQ-CCL-02.3 re-anchor) | 0 | ✅ synced, V3→V4 |

The 7 New domains are the FIRST split of this spec's flat `spec.md` into
`openspec/specs/{domain}/spec.md` per `openspec-convention.md`'s archive procedure (domain
directory names taken verbatim from spec.md's own `## Domain:` headers, matching
`test/fake/harness.test.ts`'s `THIS_SPEC_DOMAIN_DIRS` — the production fallback contract this
archive activates for real for the first time).

## Archive Location

**Filesystem**: `openspec/changes/archive/2026-07-16-stdio-engine-client/`
**Move**: 19/19 files moved via `git mv`; SRC removed, DEST verified present, file count matched.

## Mid-Archive Discovery: Post-Move Suite Regression (Found and Fixed)

The post-move suite run (per this archive's own mandate to verify FEH-03/FEH-05 survive the
real move) went **red on 2 legs**, both in `test/fake/harness.test.ts`:

1. `REQ-FEH-05.2` initially read `0` REQ-IDs instead of `41` — the production fallback
   (`resolveSpecReqIds`) correctly tried the post-archive per-domain layout, but that layout
   did not exist yet (**cause**: the 7 new domains had never been synced to
   `openspec/specs/` before this archive — see "Specs Synced to Main" above; **fix**: created
   the 7 domain files by splitting the archived `spec.md` verbatim per its own `## Domain:`
   headers, restoring 41/41).
2. The `[real repo-layout hazard, judgment-day F12]` test failed with `ENOENT` — this test
   rehearses the archive event in a tmpdir by reading the LIVE pre-archive `spec.md` as its own
   comparison ground truth; once the REAL archive happened (deleting that file), the test's own
   oracle broke, even though production code (`resolveSpecReqIds`) was already correctly
   resilient. **Fix**: added a `findArchivedChangeDir()` helper to `test/fake/harness.test.ts`
   so the test falls back to the sealed archive copy (immutable, never modified post-move) the
   same way production code falls back — same resilience contract, applied to the test's own
   data source. This is a test-only change; no production code was touched.

Post-fix: **1639 pass / 0 fail** (172 files), `tsc --noEmit` clean. No CRITICAL or scope-altering
findings — both were narrow, mechanical gaps in first-time execution of an archive-time
contract this change itself built and had not yet exercised for real.

## Lessons Learned Persisted

Five lessons appended to `openspec/lessons-learned.md` (mirrored to engram
`project/lessons-learned`, obs #648):

1. **Blind dual-judge review catches what a full council with context does not** (pattern) —
   judgment-day found 13 confirmed defects (7 CRITICAL) a clean council verify-final missed;
   never treat a clean council pass as license to skip adversarial review.
2. **A test comment citing "see docs, not tested here" can be quietly routing around a live
   bug** (discovery) — `exit-matrix.e2e.test.ts`'s original comment documented the
   `Session.flush` degrade bug instead of asserting against it.
3. **Bun's `console.table`/`dir`/`trace` write to fd 1 natively, bypassing a `process.stdout`
   stub** (discovery) — a stdout-capture strategy must redirect the whole `console` object, not
   just `process.stdout.write`.
4. **Post-archive fallback code paths are untested by construction — probe them before
   sealing** (pattern) — directly validated by this very archive's mid-archive discovery above.
5. **Steward foresight conscience-questions must be answered on record, not left to imply
   consent** (pattern) — reckoning found no record of the owner's CQ answers until re-asked.

## ADRs Promoted to Project-Level

Seven architectural decisions promoted from design section 4.5, all Status: Accepted, in
`openspec/decisions/` (mirrored to engram `project/architectural-decisions`, obs #647):

- **ADR-0053**: Transport home `src/transport/` + FIT-10 allow-list +1
- **ADR-0054**: SDK owns the raw stdio read loop post-`ready` (single reader)
- **ADR-0055**: Sequential single-in-flight, single pending slot, no pending-map
- **ADR-0056**: Double-wrap detection via brand marker on `defineFactory`'s return
- **ADR-0057**: Single-instance probe = resolution-only realpath, before import
- **ADR-0058**: Provisional unmapped runner bin (`dist/bin`, no `package.json#bin`)
- **ADR-0059**: Runner root is a sanctioned `defineFactory` caller — FIT-29 allow-list +1

**Note**: `openspec/decisions/` carries a PRE-EXISTING numbering collision — two files are both
numbered `0050` (`0050-definefactory-core-internal-removal.md` and
`0050-handle-unfreeze-honest-write-verb-rename.md`), predating this archive. NOT fixed here
(out of scope; renumbering a shipped ADR file rewrites history) — registered as a followup for
a dedicated renumbering pass.

## Followups Registered

29 non-blocking followup rows registered in `openspec/pending-changes.md` under "From
`stdio-engine-client` archive (2026-07-16)": verify-final F-1..F-5 (cold-start suite flake,
SEC-07 probe altitude, twin package-root walks, runner.ts export-arm coverage, dist/bin build
wiring), 4 council notes (token-truncation fixture parity, appliedCount exhaustiveness, runner
EOF e2e leg, `errors.ts` extraction + fit-31 cohesion split), 9 judgment-day theoreticals
(tree.read result-shape guard, greeting timeout bound, pre-greeting EOF exit code, desync
continuation posture doc, O(n²) reader concat, WPS-11.2 header stamp format, superseded-table
phrasing, stdout stub surface, RUN-04 TOCTOU), 2 architecture-audit carries (stale dts-baseline
JSDoc, the ADR-0050 numbering collision above), and 1 process item (`/sdd-init force=true` to
raise the IPC sensitive-area confidence).

The previously-STALE row documenting `Session.flush`'s exit-2 degrade
(`pending-changes.md`, formerly line 413) is now marked **CLOSED — FIXED** with a reference to
judgment-day fix commit `867c342` and the `emit-rejection-metadata` REQ-ERM-03 spec sync above.
The cross-repo tether, Windows/macOS-pins, and closed-supersession rows this change registered
at S-005.4 survive intact (verified: `fit-31`'s `REQ-LED-01` ledger-presence scan, 25/25 green).

## Upstream Sync

**spec_source**: internal (no upstream Jira/GitHub sync required).

## Final State

- **Specs synced to main**: 10 domains (7 new, 3 amended).
- **Change folder moved**: `openspec/changes/archive/2026-07-16-stdio-engine-client/` ✓ (19/19 files).
- **Lessons persisted**: 5 entries appended to `openspec/lessons-learned.md` + engram.
- **ADRs promoted**: 7 (ADR-0053..0059) in `openspec/decisions/` + engram.
- **Pending changes registered**: 29 new rows + 1 row closed in `openspec/pending-changes.md`.
- **Verify verdict**: pass-with-followups (verify-final ran pre-judgment-day; addendum appended
  to `verify-report.md` before the move recording the JD fix commits as covered post-verify
  deltas — R2 blind re-judge + full green suite).
- **Judgment-day**: APPROVED (round 2).
- **Steward reckoning**: DELIVERED, owner-ratified (RCQ-1/2/3 answered on record 2026-07-16).
- **Architecture audit**: warnings — 0 violations (obs #768; JSON-RPC package-description
  finding fixed at `6c69f71`; stale dts-baseline JSDoc carried as pre-existing followup).
- **Suite (post-move, post-fix)**: 1639 pass / 0 fail (172 files); `tsc --noEmit` clean.

## Coherence

| Area | Status | Notes |
|---|---|---|
| Spec compliance | ✅ | 41/41 REQs, 108/108 scenarios traced (verify-final) + R2 judgment-day re-judge |
| ADR adherence | ✅ | ADR-0053..0059 implemented and verified; ADR-0057/0058 deviations documented + followups tracked |
| Frozen-set manifest | N/A | purely additive change, no DB/data/runtime consumer yet |
| Test coverage | ✅ | 1639 passing, 0 failing (post-move, post test-fix); REQ-ID coverage 41/41, exemption set empty |

## Archive Status

**Ready for closure**: Yes. All steps completed:
1. ✅ New domain specs synced to main (7 domains) + 3 archived main specs amended (V4 cap-budget shift + ERM-03 carve-out)
2. ✅ Change folder moved to `archive/2026-07-16-stdio-engine-client/`
3. ✅ Post-move suite regression found (2 legs) and fixed (test-only; production code was already correct)
4. ✅ Lessons learned extracted and persisted (5 entries)
5. ✅ ADRs promoted to `openspec/decisions/` (7 entries)
6. ✅ Followups registered in `openspec/pending-changes.md` (29 rows + 1 closed)
7. ✅ Verify report confirms pass-with-followups (addendum records post-verify JD deltas)
8. ✅ Judgment-day APPROVED (round 2)
9. ✅ Steward reckoning DELIVERED, owner-ratified
10. ✅ Architecture audit: warnings, 0 violations

**Next**: Archive is sealed. Orchestrator can begin a new change cycle, or groom
`pending-changes.md` for the next planning cycle — the ADR-0050 numbering collision and the
29 registered followups are the standing debt this cycle leaves behind.
