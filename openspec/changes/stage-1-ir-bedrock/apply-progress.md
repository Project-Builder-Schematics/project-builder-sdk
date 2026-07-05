# Apply Progress: stage-1-ir-bedrock

## S-1.3 — Move gains `force?` + fail-closed collision + self-move identity

**Status**: COMPLETE. `bunx tsc --noEmit` exit 0. `bun test` → 201 pass / 0 fail (up from 188
baseline; +13 new tests). FIT-04 green against regenerated baselines.

### Scope
`move` joins the fail-closed collision family (previously only create/rename/copy checked
the destination) and gains an optional `force?` threaded end-to-end from the free function
and both handle forms down to the wire directive. `modify` now requires the target to
already exist (staging-aware). Self-move (`dst === src`) is excluded from the collision
check per the ADR-0017 amendment — a file-preserving success, no force required.

### Files changed
- `src/core/wire.ts` — `move` directive gains `force?: boolean`; phantom ADR-0028 header
  comment corrected to cite the internal decisions that adopt it (ADR-0001 SDK-emits-wire-
  directives / ADR-0013 verb-IR-lowering), not the external engine ADR directly.
- `src/core/directive-factory.ts` — `MoveArgs.force?`; `move()` spreads force conditionally
  like `rename`/`copy`; two inline comments citing "ADR-0028" for lowering/wire-shape
  concerns corrected to ADR-0013 (per the apply launch notes' phantom-ADR mapping rule).
- `src/core/base-handle.ts` — `WriteOps.move(toDir, opts?: {force?})`.
- `src/commons/index.ts` — free `move` + both `WritableHandle.move`/`FoundHandle.move` gain
  the trailing `{force?}` shape, mirroring `rename`/`copy`.
- `test/support/contract-fake.ts` — `move`: fail-closed destination check
  (`effective = envelopeForce || opForce`) with `dst===src` identity exclusion computed
  BEFORE the check; `modify`: existence check via the same `#exists` staging-aware
  predicate. Both new throw sites use the established `ContractFake: <reason>: "<detail>"`
  convention and carry `// RAW-UNTIL-STAGE-2.1` (raw seam rejection; Stage 2.1 owns
  attribution — NOT AuthoringError vocabulary here).
- `test/fake/move-fail-closed.test.ts` (created) — REQ-FAKE-04.m1–m4.
- `test/fake/modify-existence.test.ts` (created) — REQ-FAKE-07.1–.3.
- `test/skeleton/directive-factory.test.ts` — factory-level force-threading unit tests
  (REQ-KIT-03.1/.3, factory layer).
- `test/skeleton/handle-chaining.test.ts` — free-function + both handle-form force
  threading (REQ-KIT-03.1/.2/.3, integration layer via `defineFactory` + real
  `ContractFake`).
- `test/fitness/dts-baseline/{commons.index,core.base-handle,core.handle-state}.d.ts` —
  regenerated via `bun run build` (tsc -p tsconfig.build.json) then copying each
  `dist/**/*.d.ts` over its committed baseline. `core.handle-state.d.ts` picked up an
  unrelated pre-existing JSDoc drift (a prior change updated the source comment without
  regenerating this baseline) — comment-only, stripped by `normalizeDeclarations` either
  way, harmless to carry along since the task explicitly names this file for full regen.

### TDD Cycle Evidence — S-1.3

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| FAKE-04.m1 | `move-fail-closed.test.ts::m1 rejects...` | integration | "Expected promise that rejects, Received promise that resolved" | done | n/a — single collision case | none needed |
| FAKE-04.m2 | `move-fail-closed.test.ts::m2 op.force overwrites` | integration | n/a — characterizes pre-existing unconditional-overwrite behavior (force is a no-op check-bypass, already true) | done | n/a | none needed |
| FAKE-04.m3 | `move-fail-closed.test.ts::m3 envelope.force overwrites` | integration | n/a — same as m2 | done | n/a | none needed |
| FAKE-04.m4 | `move-fail-closed.test.ts::m4 self-move succeeds` | integration | passed trivially against baseline (no check existed yet); **triangulation regression**: after landing the naive `#exists(dst) && !effective` check (no identity exclusion) it went RED — "ContractFake: move collision — destination \"src/foo.ts\" already exists" — proving the identity exclusion is load-bearing, not redundant | done | 1 forcing case (naive-check-then-exclude) | none needed |
| FAKE-07.1 | `modify-existence.test.ts::07.1 untouched path rejects` | integration | "Expected promise that rejects, Received promise that resolved" | done | n/a | none needed |
| FAKE-07.2 | `modify-existence.test.ts::07.2 seeded path succeeds` | integration | n/a — green-path guard per spec note, already true, stays true | done | n/a | none needed |
| FAKE-07.3 | `modify-existence.test.ts::07.3 intra-batch create+modify` | integration | n/a — green-path guard per spec note (staging counts by construction of eager array-order apply) | done | n/a | none needed |
| KIT-03.1 (factory) | `directive-factory.test.ts::threads force:true...` | unit | "Expected - 1 (force:true) / Received + 0" | done | 2 cases (present + omit) | none needed |
| KIT-03.3 (factory) | `directive-factory.test.ts::omits force key...` | unit | n/a — passed immediately (additive; no prior force field existed) | done | n/a | none needed |
| KIT-03.1 (free fn) | `handle-chaining.test.ts::move with force...(free function)` | integration | "Expected: true, Received: undefined" | done | paired with omit case | none needed |
| KIT-03.3 (free fn) | `handle-chaining.test.ts::move omits force...(free function)` | integration | n/a — passed immediately (additive) | done | n/a | none needed |
| KIT-03.2 (WritableHandle) | `handle-chaining.test.ts::WritableHandle.move with force...` | integration | "Expected: true, Received: undefined" | done | n/a — single-surface proof | none needed |
| KIT-03.2 (FoundHandle) | `handle-chaining.test.ts::FoundHandle.move with force...` | integration | "Expected: true, Received: undefined" | done | n/a — single-surface proof; together with WritableHandle case kills the free-function-only threading mutant | none needed |
| KIT-03.3 (WritableHandle) | `handle-chaining.test.ts::WritableHandle.move omits force...(handle form)` | integration | n/a — characterization added at verify-in-loop iter 2 (evaluator gap fill: per-branch omission assertion; production already correct) | done | n/a | none needed |
| KIT-03.3 (FoundHandle) | `handle-chaining.test.ts::FoundHandle.move omits force...(handle form)` | integration | n/a — characterization added at verify-in-loop iter 2 (evaluator gap fill: per-branch omission assertion; production already correct) | done | n/a | none needed |

**Note on FAKE-04.m2/m3 and FAKE-07.2/3/KIT-03.3 RED evidence**: the spec's own RED-posture
notes scope "must-fail-first" narrowly (FAKE-04.m1 for the collision throw; the KIT-03
force-present scenarios) — these listed rows are legitimate green-path characterizations
bundled into the same task for file-locality, not independently red. This is documented
here rather than silently treated as satisfied TDD, per the "no theatre" rule.

**Slice audit (Step 7c)**: self-reviewed the diff against `code-audit.md`'s slice-mode
catalogue (Groups 1 subset/2/3). No `Bug`/`Architecture`/`MAJOR` findings — the
force-threading edits mirror the established `rename`/`copy` conditional-spread idiom
exactly; the two new `ContractFake` throw sites reuse the established message convention
and marker. No architecture baseline observation was consulted beyond the change's own
design/ADRs (no separate `sdd/{project}/architecture` topic search was available in this
sub-agent context); flagging this as a gap for the orchestrator to confirm at final-verify
if a project-wide baseline exists.

### Deviations from design
None beyond the two already flagged in slices.md's "Deviations From Design's File-Changes
Grouping" (FIT-04 baseline regen + FAKE-07 slice ownership — both pre-existing, not
introduced here). The `test/fitness/fit-04-dts-semver-gate.test.ts` file itself (W7
unconditional-rebuild edit + its header doc-the-invocation instruction) is correctly left
untouched — that edit belongs to S-1.5/1.6 per the design's file-changes table; S-1.3 only
owns the baseline DATA files.

### Next
S-1.4 (batch cap contract) — `Requires: S-1.3` satisfied. Per Build Order, S-1.4 → S-1.7 →
S-1.1 continue the `contract-fake.ts` sequence; S-1.5/1.6, S-1.8 are parallelizable;
S-1.9 soft-depends on this slice's force end-state.
