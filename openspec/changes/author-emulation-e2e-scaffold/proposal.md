# Proposal: Author-Emulation E2E — Scaffold Family (author-emulation-e2e-scaffold)

**Triage**: L · **Persona lens**: none (council synthesis) · **ready_for_proposal**: partial (caveats resolved by owner rulings obs #941)

## Intent

Before engine construction resumes (post stage-6), the SDK's only proof is surgical: 6 of 7 `test/e2e/*` files drive 2–4 directive paths against `ContractFake`. Nothing exercises the SDK as a *real* schematic author would — a full CRUD-shaped generator with template files, binary assets, chained naming tokens, and typed options — and the IR contract the future engine must honor is invisible, living only inside test asserts. The owner is the one who hurts, at engine-integration time, when SDK gaps (DX friction, missing helpers, contract holes) surface at the worst possible moment. This change makes that IR visible now, for the `scaffold` mutation family, on shared capture/report infra that later per-family changes reuse.

## Scope

### In Scope
- Realistic in-repo author-emulation generator exhausting the scaffold-family IR surface (`scaffold`, `copyIn`, `create({templateFile})`), CRUD-shaped, not a faithful port (D2).
- Run-level IR capture at the `EngineClient` seam + a rendered report, reusing `makeSpyClient`.
- Committed golden-transcript corpus (one file per scenario) — golden baseline AND engine-handoff corpus are the same file (D1).
- Gitignored per-run human report (R1/R2).
- Fixed enumerated scenario matrix (~17 rows, D4), each row citing a signed `schematic-local-files` REQ-ID or in-scope boundary bullet.
- Fitness functions FIT-23..26.
- Upstream flag: single-filter-only token gap registered as a pending-changes row (D3).

### Out of Scope
- Other mutation families and cross-family combinations (own pending changes).
- Engine / real-wire / PC-PROTO-01; live registry, publish, public-package plan items.
- Stryker `src/` mutation testing; dialect-`.raw()`/ts-morph/`dialect-modify` wiring (module-wiring + tsconfig-AST is the D2 honest gap).

## Capabilities (contract with sdd-spec)

### New Capabilities
- `ir-transcript-capture`: run-level `Batch[]` capture at the EngineClient seam, wrapping `makeSpyClient`.
- `scaffold-corpus-format`: corpus v0 shape with own `formatVersion` (≠ `protocolVersion`); NORMATIVE = directive multiset + intra-walk-order + commit-once; INFORMATIVE = batch boundaries.
- `golden-corpus-baselines`: committed per-scenario transcript files; hand-reviewed; tests FAIL on drift; no in-test update path (tautology guard).
- `per-run-ir-report`: gitignored, deterministic-filename human report (R1/R2).
- `author-emulation-fixture`: CRUD-shaped generator — templates, `.gitattributes`-marked binary asset, chained naming tokens, typed options (Stage-4 `pbuilder-codegen` pattern).
- `scaffold-scenario-matrix`: fixed enumerated matrix; engine-gated rows carried as non-executing corpus notes.
- `ir-capture-fitness-functions`: FIT-23 (corpus byte-determinism), FIT-24 (no binary bytes in corpus), FIT-25 (single capture path = EngineClient/`makeSpyClient` only), FIT-26 (every matrix row cites a REQ-ID).
- `single-filter-token-gap-flag`: e2e asserts `{= name | singular | dasherize =}` emitted verbatim + pending-changes row flagging the upstream single-filter-only spec gap.

### Modified Capabilities
None.

## Approach

Reuse the proven `EngineClient` seam: `makeSpyClient` already collects every emitted `Batch`. A new `test/support/` module renders that captured array into TWO physical artifacts (D1 collapses the "3 audiences"): (1) a committed golden-transcript corpus file per scenario, serving as both the diff-on-drift baseline and the engine-handoff contract; (2) a gitignored per-run report for human inspection. The corpus asserts directive SHAPE, never rendered output — `ContractFake`/`runFactoryForTest` never render `{{}}`/`{= =}` (mirror `by-reference-copy-wire` REQ-BRC-04). The generator follows the SDK's own Stage-4 typed-factory pattern, not the reference schematic's near-empty `schema.json`.

Architectural decisions for `sdd-design` to formalise as ADRs: (a) reconcile a third golden idiom (run-level `Batch[]`) against the two existing ones (`test/golden-ir/` literals, `test/dialects/typescript/golden/*.txt` bytes); (b) corpus authority — which fields are NORMATIVE vs INFORMATIVE, and `formatVersion` vs `protocolVersion`; (c) single-capture-path invariant; (d) corpus is v0/PROVISIONAL (real consumer absent until PC-PROTO-01 — do not over-polish).

Slicing splits by build-gate: the infra spine (capture module, corpus/report renderer, fitness functions) is buildable NOW against the 6 existing directive ops + `makeSpyClient`; scaffold-scenario slices are build-gated on `schematic-local-files` archiving and must re-verify against the landed API at apply time (`scaffold`/`copyIn`/`create({templateFile})` confirmed absent from this worktree's `src/`).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `test/support/` (new capture + corpus/report renderer) | New | shared IR-capture infra, reusable by future per-family changes |
| `test/support/spy-client.ts` | Read-only / wrap | run-level capture wraps existing `makeSpyClient` |
| committed golden-transcript corpus dir | New | per-scenario baseline + engine-handoff (same file, D1) |
| `test/e2e/author-emulation-scaffold.e2e.test.ts` | New | distinct name — avoids `scaffold.e2e.test.ts` collision |
| `test/fixtures/{author-emulation}/` (factory + schema.json + files/) | New | the emulated generator |
| `test/fitness/fit-2{3,4,5,6}-*.test.ts` | New | FIT-23..26 |
| `.gitignore` | Modified | R1 — per-run report pattern |
| `openspec/pending-changes.md` | Modified | D3 single-filter gap row |
| `src/scaffold/*`, `src/core/wire.ts`, `src/testing/contract-fake.ts` | Read-only | landed by `schematic-local-files`; consumed, not touched |
| `openspec/changes/schematic-local-files/specs/*` | Read-only | signed REQ contract the matrix cites |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| e2e filename collision (`scaffold.e2e.test.ts` exists on origin) | High | use `author-emulation-scaffold.e2e.test.ts`; confirmed by `git ls-tree origin/feat/schematic-local-files` |
| Build gate — scaffold verb absent from worktree `src/` | High | infra-spine slices ungated; scaffold-scenario slices gated on merge + apply-time re-verify vs landed API |
| Corpus byte-determinism rests on un-speced walk order | Medium | code sorts (`walk.ts` `readdirSync().sort()`) but schematic-local-files spec does not normatively pin intra-walk-order → corpus format declares it NORMATIVE so silent drift FAILS |
| Rendering evidence boundary — shape not render | Medium | assert directive/`pathTemplate` shape only (literal token string); evidence-boundary REQ mirroring REQ-BRC-04 |
| Three golden idioms read as drift | Medium | ADR reconciling the run-level idiom vs the two existing ones (design) |
| FIT number collision — FIT-22 taken by schematic-local-files | High | start at FIT-23 (verified: `test/fitness/fit-22-scaffold-leaf-rule.test.ts` on origin) |
| Single-filter-only token spec gap silently absorbed (D3) | Medium | explicit pending-changes row + verbatim-emission assertion; not resolved here |
| Corpus grows unbounded | Low | bounded by fixed matrix (committed); per-run report gitignored (R1) |

## Rollback Plan

Test-only + docs + `.gitignore` + one pending-changes row — no `src/` runtime change, no public surface, no data migration, nothing shipped to consumers. Revert = delete the new `test/support/` capture module, `test/fixtures/{author-emulation}/`, the committed corpus dir, `test/e2e/author-emulation-scaffold.e2e.test.ts`, and `test/fitness/fit-2{3..6}-*.test.ts`; revert the `.gitignore` line and the `openspec/pending-changes.md` row. Validate rollback: `bun test` returns to the pre-change baseline count with zero references to the removed module. Fully reversible; nothing irreversible.

## Dependencies

- `schematic-local-files` archiving/merge — provides the landed `scaffold`/`copyIn`/`create({templateFile})` API; BUILD gate for scaffold-scenario slices only (infra-spine slices are ungated). No new runtime dependency.

## Success Criteria

- [ ] SC-1 (corpus completeness): every non-engine-gated matrix row has exactly one committed golden-transcript file — `count(corpus files) == count(executable rows)`.
- [ ] SC-2 (byte-determinism): two consecutive runs yield a diff-empty corpus; report re-run overwrites the same filename (R2), file count stable.
- [ ] SC-3 (report separation): `git status` is clean after a run (report gitignored, R1); `.gitignore` carries the report pattern.
- [ ] SC-4 (author-realism): fixture exercises `scaffold` + `copyIn` + `create({templateFile})` + ≥1 chained naming token + 1 binary asset + typed options; each scaffold-family IR op appears ≥1× in the corpus.
- [ ] SC-5 (gap honesty): pending-changes row for the single-filter token gap exists; evidence-boundary REQ present; no in-test corpus update path (drift FAILS the suite).
- [ ] SC-6 (traceability + fitness): FIT-23..26 present and green; every matrix row cites ≥1 `schematic-local-files` REQ-ID or in-scope boundary bullet.

## Caveats from Exploration (ready_for_proposal = partial)

- Caveat: corpus committed vs ephemeral (product open question) → **Resolved** by owner ruling D1 (obs #941): golden baseline and engine-handoff corpus are the SAME committed file per scenario; per-run report only is gitignored.
- Caveat: e2e filename collision → **Addressed in Scope/Risks**: distinct name `author-emulation-scaffold.e2e.test.ts` (collision confirmed on origin).
- Caveat: corpus file shape (one vs per-scenario vs jsonl) → **Addressed**: one committed file per scenario (D1); NORMATIVE/INFORMATIVE field split deferred to `scaffold-corpus-format` spec + design ADR.
