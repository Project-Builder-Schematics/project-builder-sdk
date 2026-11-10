Objective: send array and object `create` options as native JSON, not JSON strings (sdk#150), so the engine can drop `PromoteValue` (engine#286 D3).
Branch: feat/native-json-create-options off origin/main 699b3f0; one PR, not pushed (the orchestrator pushes). Test runner: `bun test` (focused: `bun test test/core/encode-options.test.ts test/fake/encode-recorded-batch.test.ts test/commons/encode-surface-parity.test.ts test/scaffold/classify-transport.test.ts test/golden-ir test/fitness/fit-39-single-encode-site.test.ts`).

## Specs

S1 — "`create()` and `scaffold()` by-value send top-level array and object options as native JSON in `create.options`." (sdk#150 acceptance)

S2 — "Strings, including ones starting with `[` or `{`, numbers, booleans and `null` pass through unchanged." (sdk#150 acceptance)

S3 — "Non-plain-JSON values at any depth still fail with an error that names the key (REQ-TOE-04)." Keep `assertEncodable`. (sdk#150 acceptance; orchestrator: "Keep assertEncodable.")

S4 — "Nested non-finite numbers have a tested, documented outcome." Decision (assumption, recorded in L3): composites are copied by the `assertEncodable` walk, so a nested `NaN`/`Infinity` reaches the batch as a number and the contract fake's round-trip guard rejects it as `unrepresentable`, the same outcome a top-level `NaN` already has. The copy also keeps today's snapshot-at-schedule-time behaviour: mutating the author's array after `create()` does not change the batch.

S5 — "Recorded batches (`@pbuilder/sdk/testing`) show native values. The `createOp` parity test is updated." Flip GOLDEN_CREATE in `test/golden-ir/fixtures.ts` if the factory input is a native array. "The byte-budget math in classify-transport tests must reflect the native form." (sdk#150 acceptance; orchestrator relay of the user's answers)

S6 — "Spec, ADR-0060 and `docs/create-templates.md` are updated, and the changelog flags the testing-surface break." New ADR supersedes 0060: "the factory validates options and forwards native JSON per engine ADR-0028, and marks 0060 'Superseded by'". Reword `openspec/specs/typed-options-encoding/spec.md:9-11` and `openspec/pending-changes.md:499`. Ship as a breaking change in 0.13.0 with a breaking note in the changelog. Fix the stale comment at `conformance/m2-create-composition/factory.ts:28-31`.

S7 — "The conformance `create-composite` case still renders byte-identical bytes against the current engine (which still promotes)." Run m2-create-composition against the pinned engine.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1-S5, S6 (docs/create-templates, changelog, conformance comment) | inline | pending | — |
| T2 | S6 (ADR, spec, pending-changes) | inline | pending | — |
| T3 | S7 | inline | pending | — |
| T4 | all | delegated verifier (risk item 3, wire contract) | pending | — |

Route evidence: one dependent chain, forecast well under ~400 authored lines; no writer trigger fires. T4 fires the verification trigger (risk item 3).

## Log

L1 (2026-11-10, orchestrator brief, verbatim excerpt): "work sdk#150 first, then sdk#149, in project-builder-sdk. … Commit on a feature branch in a fresh worktree off origin/main, and don't push; I push after I spot-check."

L2 (2026-11-10, orchestrator relay of the user's answers, verbatim excerpt): "1. Recorded batches: nothing persisted breaks, per your evidence. Flip the in-repo expectations you listed. That includes GOLDEN_CREATE in test/golden-ir/fixtures.ts if the factory input is a native array. Fix the stale comment at factory.ts:28-31. 2. Public testing surface: the user approved shipping this as a breaking change in 0.13.0 (the SDK is pre-1.0), with a breaking note in the changelog. Follow the repo's release mechanism … Update docs/create-templates.md:82-85. 3. ADR-0060: write a new ADR that supersedes 0060. … Keep assertEncodable. Test-first, with ODD tracking. The byte-budget math in classify-transport tests must reflect the native form. This is risk item 3, the wire contract, so it gets an independent verifier. Also run the conformance m2-create-composition case against the pinned engine to show the rendered output is unchanged."

L3 (2026-11-10, design): forwarding the author's array by reference would let a mutation after `create()` change the queued batch, which the stringify step prevented. A structural copy keeps the snapshot, keeps nested non-finite numbers so the round-trip guard sees them (S4), and turns null-prototype containers into plain objects. The copy comes from the `assertEncodable` walk, not `structuredClone`: the runner-integrity manifest (Constraint 4) default-denies that global. The helper keeps its name `encodeOptions` to avoid renaming every call site and test; its job is now validate-and-copy. Release mechanism: changelog entries land with the feature; a later `chore(release)` commit bumps `package.json`. This branch adds a `## 0.13.0` changelog section; the version bump stays with the release commit.
