# Apply Progress: stage-1-ir-bedrock — S-1.1

## S-1.1 — Golden fixtures freeze: move-force, chained programs, determinism

**Status**: COMPLETE. `bunx tsc --noEmit` exit 0. `bun test` → 237 pass / 0 fail (up from 232
baseline; +5 new tests). This is the FINAL slice of the change — the wire is frozen as of
this slice (S-1.3 force @ 5ecc04f, S-1.4 cap @ 27f01bf, S-1.7 round-trip @ 325cc83, all
already landed and required by this slice).

### Scope

Freezes the golden-IR fixtures against the finalized wire: `move` gains a force-present
fixture (`GOLDEN_MOVE_FORCE`, ADR-0017 closure — the only op that previously had no
force-present pin), two new chained-handle Batch fixtures prove multi-directive programs
serialize in author order (`RENAME_THEN_MOVE`, `CREATE_THEN_MODIFY`), and a determinism
proof pins both self-consistency (two independent runs, byte-identical) and a committed
golden byte-string (envelope key order: `protocolVersion`, `force`, `instructions`). No
production code touched — this slice is entirely test/fixture authorship, per the design's
"golden pinning lands last so fixtures freeze the finalized wire" sequencing note.

### Files changed

- `test/golden-ir/fixtures.ts` (modified) — added `GOLDEN_MOVE_FORCE` (move force-present
  fixture, new for Stage 1); added `RENAME_THEN_MOVE` and `CREATE_THEN_MODIFY` (`Batch`
  fixtures for REQ-GIR-02); added `GOLDEN_DETERMINISM_STRING` (committed golden byte-string
  for REQ-GIR-03, captured from a real run, not hand-derived); fixed 3 phantom "ADR-0028"
  citations → ADR-0013 (lowering/wire-shape sites — header comment, `remove`/`copy` inline
  comments) per the apply launch notes' mapping rule. No ADR-0017/D1-semantics sites existed
  in this file, so nothing mapped there.
- `test/golden-ir/golden-ir.test.ts` (modified) — added "move with force" test using
  `GOLDEN_MOVE_FORCE`; fixed 2 phantom "ADR-0028" citations → ADR-0013 (header comment,
  `remove` test name).
- `test/golden-ir/chained-batch.test.ts` (created) — REQ-GIR-02: two scenarios
  (`rename().move()` and `create().modify()`), each asserting the `emit`-spy-captured `Batch`
  deep-equals its hand-written fixture, exact keys, author order.
- `test/golden-ir/determinism.test.ts` (created) — REQ-GIR-03: two-directive
  (rename-then-move) scenario run twice against independent fresh `ContractFake` instances;
  asserts `JSON.stringify` string equality between the two runs AND equality against the
  committed `GOLDEN_DETERMINISM_STRING`.

### TDD Cycle Evidence — S-1.1

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| GIR-01 (move force-present) | `golden-ir.test.ts::move with force — exact keys...` | unit | `toEqual` diff: `Expected - 0 / Received + 1` (`"force": true` present in received, absent from the deliberately force-less fixture) — see "RED-proof technique" note below | done | n/a — single new fixture, pure pass-through pin per spec | none needed |
| GIR-02 (rename-then-move) | `chained-batch.test.ts::rename(...).move(...) — emitted batch matches...` | integration | `toEqual` diff: fixture instructions deliberately reversed (move before rename); real batch order (rename, move) mismatched it — "Expected - 7 / Received + 7" (full instruction-order diff) | done | n/a — order-pinning fixture, single scenario per spec's GWT | none needed |
| GIR-02 (create-then-modify) | `chained-batch.test.ts::create(...).modify(...) — emitted batch matches...` | integration | `toEqual` diff: fixture's modify content deliberately set to `"WRONG-ON-PURPOSE"`; real batch content `"export const x = 2;"` mismatched it | done | n/a — order-pinning fixture, single scenario per spec's GWT | none needed |
| GIR-03 (self-consistency) | `determinism.test.ts::same factory + inputs run twice...byte-identical...` | integration | n/a — characterization-RED-waived per spec's posture taxonomy; determinism is a property of `Session.flush`'s plain-object construction, which pre-exists this slice | done | n/a — property holds for any ≥2-directive batch by construction, not conditional/iterative from the test's perspective | none needed |
| GIR-03 (golden byte-string) | `determinism.test.ts::matches the committed golden byte-string...` | integration | `toEqual` diff against placeholder `"PLACEHOLDER-UNTIL-CAPTURED"` — real serialized output captured from the failure diff, then pinned verbatim (not hand-derived, avoiding transcription error) | done | n/a — single golden constant | none needed |

**RED-proof technique for characterization/golden fixtures where production code predates the
test** (worth documenting — reusable pattern): when the underlying behavior already exists
(all three force-threading + chaining production edits landed in S-1.3, before this slice
runs), a literal "test fails because the feature is missing" RED is not available. The
discipline used instead: write the fixture/expected-value DELIBERATELY WRONG first (missing
key, wrong order, wrong content), run the test, confirm it fails for the right reason — an
assertion mismatch showing the actual vs. expected diff — then correct the fixture to the
real captured value and confirm GREEN. This proves the pin has bite (it CAN fail) without
requiring a false "test passes immediately" halt, and matches the S-1.3 precedent for
bundled green-path characterizations. Applied to: GIR-01 move-force, GIR-02 both scenarios,
GIR-03's golden-string capture (used as a practical value-capture mechanism there, not
strictly a RED-proof since that scenario is characterization-waived).

**Slice audit (Step 7c)**: self-reviewed the diff — entirely test/fixture files, no
production code, no new architectural surface. All additions match existing sibling patterns
exactly (fixtures.ts's per-op `Extract<Directive,...>` constants; golden-ir.test.ts's
`toEqual`-against-fixture style; chained-batch/determinism reuse the `makeSpy`/`EngineClient`
double pattern already established in `test/skeleton/handle-chaining.test.ts`). No
`Bug`/`Architecture`/`MAJOR` findings. As with S-1.3's note: no separate project-wide
`sdd/{project}/architecture` baseline was consulted in this sub-agent context (not available
without an orchestrator-level engram search) — flagging as a standing gap for final-verify to
confirm, not new to this slice.

### Deviations from design

None. Design's file-changes table (§4.2, rows tagged "1.1") is followed exactly: fixtures.ts
gets all four new fixture exports, golden-ir.test.ts gets the move-force row, chained-batch
and determinism land as new files. No production files touched, matching "golden pinning
lands last" sequencing (this slice's `Requires: S-1.7` was already satisfied).

### Coverage confirmation

19/19 REQ-IDs across the change were mapped per slices.md's Coverage Check; this slice closes
the final 3 (REQ-GIR-01, REQ-GIR-02, REQ-GIR-03). All 7 slices (S-1.3, S-1.4, S-1.7, S-1.1,
S-1.5/1.6, S-1.8, S-1.9) are now implementation-complete per their own apply-progress records.

### Next

This was the last slice in the Build Order. Full suite green (237/237), typecheck clean.
Ready for `sdd-verify --mode=final` (comprehensive verification against the signed V2 spec,
design, and all 7 slices' acceptance criteria) ahead of archive.
