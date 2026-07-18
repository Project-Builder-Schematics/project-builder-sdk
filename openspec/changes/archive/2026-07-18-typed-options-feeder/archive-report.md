# Archive Report: typed-options-feeder

**Archived at**: 2026-07-18T15:20:00Z
**Verify verdict**: pass-with-followups
**Spec version archived**: V3 signed (owner 2026-07-18)

## Summary

Native array/object `create` option values now encode automatically at the SDK's wire boundary via a single `encodeOptions` helper (ADR-0060/0061/0062), closing a DX gap where authors previously hand-`JSON.stringify`'d composite options. The encode step applies uniformly across all three author-facing emission surfaces (inline `create()`, `create({templateFile})`, and `scaffold` expansion) — no surface left inconsistent. String values pass through byte-identical (backward-compat via type discrimination per ADR-0061). Non-plain-JSON values reject loud at scheduling time with author-vocabulary messages. The `classify-transport` budget estimator now measures post-encode option size (REQ-CCL-02.4), closing a pre-encode/post-encode misclassification gap. Full suite: 1962/0, typecheck clean, code audit clean, 32/32 spec scenarios compliant.

## Specs Synced

| Domain | Type | REQs Added | REQs Modified | REQs Removed | Location |
|---|---|---|---|---|---|
| `typed-options-encoding` | New | 9 (TOE-01…TOE-09) | 0 | 0 | `openspec/specs/typed-options-encoding/spec.md` |
| `content-classification` | Delta | 0 | 1 (CCL-02 + scenario CCL-02.4) | 0 | `openspec/specs/content-classification/spec.md` |

## Archive Location

`openspec/changes/archive/2026-07-18-typed-options-feeder/`

**Folder move verified**: SRC removed, DEST exists, 18 files intact.

## Lessons Learned Extracted

1. **`Object.defineProperty` enumerable-default trap**: `Object.defineProperty(result, key, { value })` does NOT set `enumerable: true` by default (descriptor defaults to false). Explicit enumeration requirement is non-obvious; future value-shaping helpers should pin the enum descriptor upfront to avoid silent key-drop bugs.
   - Source: design §4.3 + apply-progress self-audit
   - Applies: any SDK shaping helper that builds objects for the wire

2. **Top-level-sibling tests don't exercise per-entry-scoped ancestor state**: mutation testing / ancestor-path-DAG validation is non-trivial to exercise — truly-circular vs shared-ref DAGs require both positive (encodes fine) and negative (rejects loud) cases at each depth level. Nested-sibling test scenarios (a value nested at multiple depths within the same object) are needed to catch ancestor-path scoping bugs a flat top-level test suite can miss.
   - Source: apply-progress S-001 self-audit + design §4.3 (ARCH-F2)
   - Applies: future wire-encoding helpers with stateful traversal

3. **Executor Context powers judge-proof slices**: the blind-review judges in judgment-day (two independent architecture reviewers seeing only the design, spec, and diff) caught 7 CRITICAL findings and 13 additional observations that the full Council missed. Judge trajectories 13→2→0 via enriched context (ADRs, test-derivation detail, fixture generation) show that building richer Executor Context documentation pays dividends — future slices should invest in explicit section titles and structured test-generation tables.
   - Source: verify-report + judgment-day envelope
   - Applies: future M/L changes with adversarial review gates

## ADRs

### Promoted to Project-Level
- **ADR-0060**: Option value-lowering at DirectiveFactory is wire shaping, not rendering (amends KIT-03)
- **ADR-0061**: String passthrough as backward-compat mechanism (type discrimination, not a flag)
- **ADR-0062**: Interim plain-`Error` reject + `createOp` stays independent oracle

### Amendment to Existing ADR
- **ADR-0013**: Appended amendment note clarifying wire value-lowering exception to the factory-purity invariant (references ADR-0060)

## Followups Registered

Verify verdict was `pass-with-followups`. 8 followups registered to `openspec/pending-changes.md`:

| Description | Type | Size | Stage |
|---|---|---|---|
| AuthoringError-parity for scheduling-time option rejection | refactor | S | S/M follow-up |
| ARCH-F1 construction-direction fitness guard | test-coverage | S | next FIT suite update |
| QA-F3 toJSON-bearing objects divergence | docs | XS | spec amendment or design-decision |
| QA-F4 exotic inputs surface raw errors | edge-case | S | advanced-options-encoding design |
| QA-F5 classify-transport boundary unpinned | test-coverage | XS | next content-classification touch |
| Scaffold budget estimator double-encode | refactor | XS | perf/refactor pass |
| React-dialect architecture baseline entries | docs | XS | react-dialect archive completion |
| Stale IPC sensitive-area row | docs | XS | sdd-init refresh |

## Build & Test Results

| Metric | Value |
|---|---|
| Full suite | 1962 pass / 0 fail |
| Typecheck | Clean (tsc --noEmit) |
| Code audit (pre-PR) | 0 gating findings (0 Bug/Architecture/MAJOR) |
| Verify final verdict | pass-with-followups |
| Spec scenarios compliant | 32/32 |

## Test Coverage

- **Unit tests** (REQ-TOE-01/02/03/04/05/06/08 base scenarios): `test/core/encode-options.test.ts` (REQ-TOE-01–05, REQ-TOE-08)
- **Integration tests** (surface parity, scheduling reject, recorded batches): `test/commons/encode-surface-parity.test.ts`, `test/fake/encode-recorded-batch.test.ts`
- **Classification boundary** (post-encode sizing): `test/scaffold/classify-transport.test.ts` (REQ-CCL-02.4)
- **Docs verification** (zero stringify, native example, note preservation): `test/docs/encode-options-docs.test.ts`
- **Dry-run regression**: `test/dry-run/plan.test.ts` (REQ-TOE-08.1)
- **Stage-2 REQ-14.3 reconciliation**: `test/skeleton/error-attribution.test.ts` (fixture swap to non-finite number)
- **Fitness** (single encode site, no duplicates): `test/fitness/fit-39-single-encode-site.test.ts`

## Spec Compliance

All 32 REQ-ID scenarios pinned by tests, zero uncovered. Strict TDD audit: clean RED→GREEN cycle evidence, no snapshot-only assertions, mutation-resistant reject-message assertions, triangulation across composite/scalar/null/string/circular cases.

## Architecture Impact

**Impact**: modifying

Rationale: ADR-0060 amends the accepted ADR-0013/KIT-03 factory-purity invariant to admit wire value-lowering, making the baseline characterization ("pure args→Directive") outdated. Baseline refresh warranted on next architecture audit pass. No new module boundary, dependency direction, or layered/IR-seam pattern changes.

## Upstream Sync

**Spec source**: internal — no upstream Jira/GitHub tickets to close.

## Metrics

| Metric | Count |
|---|---|
| Slices completed | 4 (S-000..S-003) |
| New test files | 4 |
| Modified production files | 2 (`directive-factory.ts`, `classify-transport.ts`) |
| Modified test files | 5 |
| Modified docs | 1 (`docs/create-templates.md`) |
| Lessons extracted | 3 |
| ADRs promoted | 3 |
| ADRs amended | 1 |
| Followups registered | 8 |

## Next Steps

- Surface the 3 promoted ADRs (0060/0061/0062) to stakeholders if human confirmation was needed (already confirmed by orchestrator pre-archive).
- Schedule the 8 registered followups for future planning cycles.
- Consume the 3 lessons into project memory for cross-change learning (especially the Executor Context observation).
