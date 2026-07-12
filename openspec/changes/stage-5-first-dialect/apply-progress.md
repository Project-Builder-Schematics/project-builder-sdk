# Apply Progress: Stage 5 — First Dialect

**Batch**: 1 of N (S-000 + S-001) · **Mode**: Strict TDD · **Suite**: 662 → 689 (bun test) ·
`bunx tsc --noEmit`: CLEAN throughout · **Branch**: `feat/stage-5-first-dialect`

---

## Batch 4 — S-005: Authoring Docs, SECURITY Guard, Sensitive-Areas Promotion (FINAL SLICE)

**Mode**: Strict TDD, [must-fail-first] — `test/docs/security-authoring-guard.test.ts` was
written FIRST against the pre-existing stub `docs/authoring-a-dialect.md` and unmodified
`SECURITY.md`; run to confirm genuine RED (6 pass / 6 fail — the passes were the
already-satisfied general-trust-sentence check, the vacuous unshipped-name check, the
already-satisfied `--provenance` workflow check, and the two "regression proof" tests whose
own logic is self-contained; the fails were the 3 new/moved frozen strings + 2 mandated
sections genuinely absent). Content was then written to `docs/authoring-a-dialect.md` and
`SECURITY.md` and the suite re-run GREEN. **Suite**: 746 → 758 (bun test, +12) ·
`bunx tsc --noEmit`: CLEAN · `bun run build`: CLEAN.

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-005 | edge-case | complete | 4/4 |

### Commits

1. `cb94b90` — docs(dialect): S-005 — authoring guide, SECURITY guard, sensitive-areas promotion

### Implementation approach

- **`docs/authoring-a-dialect.md`** (Modify, stub → real) — restructured around ADR-0009's
  two-audience split: "For authors" (worked `addImport` example, awaited chain) and "For
  contributors" (kit-verbs prose only — `defineDialect`/`defineOpPack`/`withOps` — pointing to
  each verb's own JSDoc `@example` in `src/core/define-dialect.ts` rather than repeating a
  runnable demo, per REQ-DAS-02's "no author-style demo in the contributor section"; names
  `testDialect`/`testOpPack`/`expectTypeOf` as verification anchors). Added "Two ts-morph
  realms" (frozen paragraph, verbatim) under the `.raw()` section, and a dedicated "Async
  usage" section covering both the awaited-chain form and the forgotten-await run-end-join
  behavior (REQ-MC-06). Coalescing's observable shape (N edits → one `modify`; a read splits
  it into two) gets its own section. Intro paragraph deliberately never names unshipped
  surface (no "postcss", no "removeImport", no second dialect) — REQ-DAS-01.1's "only the
  shipped surface" bar.
- **`SECURITY.md`** (Modify) — added a new `## \`.raw()\` and the conformance kit` section
  (before the existing `## Publish pipeline`) carrying the two NEW frozen sentences verbatim;
  the pre-existing general explicit-trust paragraph is untouched (REQ-STD-01 requires BOTH to
  co-exist, not one replacing the other).
- **`test/docs/security-authoring-guard.test.ts`** (Create, `[permanent-fixture]`) — mirrors
  `test/docs/testing-story-docs.test.ts`'s house pattern (`PROJECT_ROOT` via `import.meta.url`,
  `readFileSync` fixtures, `describe`/`it`/`.toContain`). Frozen strings are module-level
  constants built by joining design.md §4.4b's markdown-wrapped source lines into single
  unwrapped strings (both the doc and SECURITY.md paragraphs are written as ONE physical
  line each in their respective files, so `readFileSync` yields the identical string with no
  wrap-point mismatch). Each frozen-string `describe` block also carries a "fails red if
  removed" regression-proof test (string-splice-and-recheck) — the guard's own self-test that
  its assertion is load-bearing, not vacuous. `extractSection()` reuses
  `testing-story-docs.test.ts`'s heading-bounded-section technique for the "Async usage" and
  "For contributors" scoped checks.
- **Sensitive-areas promotion** — `openspec/sensitive-areas.md`'s "security (code execution)"
  and "security (third-party trust)" rows updated in place (matching the precedent set by
  stage-4b-testing-harness's own row edits for `./testing`): paths now name
  `src/dialects/typescript/**`, `src/core/dialect-handle.ts`, and
  `package.json#dependencies` (ts-morph) concretely; confidence low→medium. Engram topic
  `project/sensitive-areas` (obs #646) upserted to match — discovered it had drifted behind
  the filesystem file (last synced at the stage-4b archive), so this upsert also backfills
  that drift in the same pass, not just the stage-5 delta.

### Deviations From Plan

None — content-only slice, no implementation files touched. One judgment call not explicit in
slices.md: the two SECURITY.md frozen sentences are NOT repeated verbatim inside
`docs/authoring-a-dialect.md` (the doc cross-references SECURITY.md in prose instead) — only
the two-realms hazard paragraph is doc-side frozen per design §4.4b's own text ("land
byte-for-byte in S-005" is stated for the two-realms hazard specifically; the SECURITY.md
sentences are SECURITY.md's own frozen strings). This keeps one frozen string in exactly one
file, avoiding a second copy that could silently drift.

### TDD Cycle Evidence — S-005

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Doc + SECURITY frozen strings | `security-authoring-guard.test.ts` (12 cases) | architectural (substring guard) | Full-suite run against the pre-existing stub/unmodified files: 6/6 genuine fails (missing `.raw()` sentence-in-doc-context N/A, missing caveat in SECURITY.md, missing two-realms paragraph, missing "Async usage" section, missing "For contributors" heading, missing kit-verb names) — see run log in this batch's commit history | ✅ (12/12 after content) | n/a (each REQ pins one fixed frozen string/section, not a class of inputs) | n/a |
| Sensitive-areas promotion | (no dedicated test — registry update, per slices.md's own task text: "orchestrator/apply-time registry update, not a test") | — | n/a | n/a (file + engram diffed manually against design §4.8's exact path list) | n/a | n/a |

### Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `docs/authoring-a-dialect.md` | Modified | S-005 | Stub → real content (two-audience split, kit verbs, `.raw()`, two ts-morph realms, coalescing shape, Async usage, testing/publishing) |
| `SECURITY.md` | Modified | S-005 | + `.raw()`-specific trust sentence + "conformance ≠ safety" caveat (verbatim) |
| `test/docs/security-authoring-guard.test.ts` | Created | S-005 | 12 substring guards (STD-01, DAS-01.1/.2/.3, DAS-02.1, TSD-06.2) |
| `openspec/sensitive-areas.md` | Modified | S-005 | 2 rows promoted low→medium, concrete paths (design §4.8) |
| `openspec/changes/stage-5-first-dialect/slices.md` | Modified | S-005 | S-005 tasks ticked `[x]` |

### Post-Slice Self-Review (Step 7c — no external audit engine available in this sub-agent context)

Checked the S-005 diff against all 8 binding constraints: (1) N/A (no dependency change); (2)
zero references to `test/fixtures/toy-dialect/**` in any S-005 file (`rg` confirmed); (3) N/A
(no error-wrapper touched — this slice is docs/security/registry only); (4) frozen guard
strings copied byte-for-byte from design §4.4b (joined-wrapped-lines technique, verified via
the guard test's own exact-substring assertions passing); (5) N/A (no dialect-chain test
added this slice); (6) N/A (no concurrency assertion this slice); (7) every guard assertion
is exact-substring (`.toContain` against a full frozen string or a full section extraction),
never count-only; (8) suite green (758/758) + `tsc` clean + `bun run build` clean confirmed.
No findings.

### Next Recommended

`sdd-verify --mode=in-loop` (iteration 4, this is the LAST slice) → if pass, `/evaluate`
(`sdd-verify --mode=final`) — S-005 was the final slice in the Build Order; all 6 slices
(S-000..S-005) are now complete, 34/34 REQ-IDs covered per slices.md's Coverage Check.

---

## Batch 3a — S-003: Edge Scenarios & Fidelity Boundaries

**Mode**: Strict TDD, [characterization] posture (RED-posture taxonomy, slices.md) — every
mechanism this slice exercises (BOM re-prepend, `detectNewLineKind`, syntactic-diagnostics
parse-failure detection, `addImport` merge-idempotency, the coalescing handle's move/copy/create
interplay) was already BUILT in S-002 but not yet test-covered (apply-progress batch 2 explicitly
flagged this: "not yet golden/test-covered (S-002 doesn't reach TSD-03)"). Every new test was
first run to confirm it exercises REAL behaviour (not a tautology) via a standalone probe script
against the actual `ast.ts`/`ops.ts`/dialect-handle chain BEFORE being committed to the test file
— the probe output IS the RED-equivalent evidence (mirrors S-002's own precedent for
pre-verified-then-batched assertions) — then the committed test ran GREEN on the first `bun test`
pass, confirming the mechanism holds. No implementation changes were needed this slice — S-003 is
proof/coverage only. **Suite**: 729 → 740 (bun test) · `bunx tsc --noEmit`: CLEAN · `bun run
build`: CLEAN.

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-003 | edge-case | complete | 5/5 |

### Task-to-scenario map

| Task | Scenarios covered | Test |
|---|---|---|
| create/move/copy interaction | TSD-03.1, TSD-03.2, TSD-03.9 | `dialect.test.ts` — "REQ-TSD-03 edge scenarios" describe |
| two-distinguishable-edits + not-found | TSD-03.3, TSD-03.4 | same describe |
| goldens: empty / CRLF+BOM / CRLF+addImport | TSD-03.5, TSD-03.6, TSD-03.8 | same describe + 4 new golden files |
| 4 MiB boundary | TSD-03.7 | same describe |
| duplicate addImport | TSD-03.10 | same describe |
| malformed TypeScript | TSD-04.1 | `dialect.test.ts` — "REQ-TSD-04" describe |

### New golden files (byte-exact, verified via `xxd`/`node -e` before commit — never hand-typed)

- `test/dialects/typescript/golden/empty-add-import-after.txt` — `import { readFileSync } from
  "node:fs";\n` (empty seed + addImport, TSD-03.5)
- `test/dialects/typescript/golden/crlf-bom-round-trip.txt` — `EF BB BF` BOM + CRLF content,
  written via `node -e` (never a text editor, to guarantee exact bytes — TSD-03.6)
- `test/dialects/typescript/golden/crlf-add-import-before.txt` / `crlf-add-import-after.txt` —
  CRLF seed + CRLF-consistent import insertion (TSD-03.8)

### TSD-03.7 (4 MiB boundary) — construction note

Reused the EXISTING `test/fake/batch-cap-fixtures.ts` technique (quote-padding: 1 raw byte `"`
costs 2 JSON-serialized bytes `\"`) rather than reinventing it, but applied it through the REAL
dialect chain instead of a synthetic `Batch`: a block comment (`/* ... */`) holding the padding
quotes needs NO TypeScript-level escaping (so ts-morph round-trips it byte-for-byte, same
guarantee REQ-DC-01 exercises), but each `"` still costs 2 bytes once the printed content becomes
a `modify` directive's `content` field and the whole batch is `JSON.stringify`'d. Deterministic
arithmetic (probe with an empty comment body to measure fixed envelope+import overhead, then pad
to land exactly `BATCH_CAP_BYTES + 1` serialized bytes) — no search/iteration, same style as
`batchOverSerializedBytes`. Verified empirically (standalone probe, ~0.6s for the full
parse→addImport→print→JSON.stringify round trip on a ~2 MiB comment): raw print bytes =
2,097,121 (`< BATCH_CAP_BYTES`), serialized = 4,194,305 (`BATCH_CAP_BYTES + 1`). The run rejects
cleanly with `AuthoringError.reason === "changes-too-large"` — the SAME cap-rejection path
already proven by `test/fake/batch-cap.test.ts` (REQ-01.2), now proven reachable through the
dialect's coalescing/print pipeline specifically, and proving "never silently truncated" (a
typed rejection, not corrupted output).

### Deviations From Plan

None — no implementation files changed, only new tests + 4 new golden files. The mechanism this
slice proves (BOM, newline detection, parse-failure containment, addImport idempotency, the
dialect handle's move/copy/create interplay) was already built in S-002; S-003 is exactly the
test-writing slice slices.md's own Test Derivation table describes it as.

### TDD Cycle Evidence — S-003

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| TSD-03.1/.2/.9 (create/move/copy) | `dialect.test.ts::REQ-TSD-03.1/.2/.9` | integration | [characterization] — mechanism pre-built in S-001 (ADR-0037 clause 1b re-owned write verbs) + S-002; probed via standalone script against the real chain before committing the assertion, output matched design's predicted directive order/content on first run | ✅ | n/a (each REQ is one fixed scenario, not a class of inputs) | n/a |
| TSD-03.3 (two-distinguishable-edits) | `dialect.test.ts::REQ-TSD-03.3` | integration | [characterization] — same coalescing mechanism as REQ-MC-01.1 (already proven in S-002's `coalescing.test.ts`), restated at the TSD edge-scenario layer with a distinct op combo (`addImport("existsSync",...)` + `.raw` appending a different statement) to avoid a literal content duplicate | ✅ | n/a | n/a |
| TSD-03.4 (not-found) | `dialect.test.ts::REQ-TSD-03.4` | integration | [characterization] — the frozen-prefix wrapper was built and unit-probed in S-001/S-002; this is its first REQ-TSD-03-level pin of the QUOTED not-found tail | ✅ | n/a | n/a |
| TSD-03.5 (empty file) | `dialect.test.ts::REQ-TSD-03.5` | integration | [characterization] — probed empirically first (empty source + addImport → `import {...} from "...";\n`, no spurious blank line), golden committed from the probe's real output | ✅ | n/a | n/a |
| TSD-03.6 (CRLF+BOM round-trip) | `dialect.test.ts::REQ-TSD-03.6` | unit | [characterization] — direct `print(parse(seeded)) === seeded` against the golden (mirrors REQ-DC-01's own round-trip framing); the BOM re-prepend WeakMap mechanism was built in S-002 and probed then but never asserted against a committed golden until now | ✅ | n/a | n/a |
| TSD-03.8 (CRLF+addImport) | `dialect.test.ts::REQ-TSD-03.8` | integration | [characterization] — `detectNewLineKind` was unit-tested in S-002 (REQ-TSD-02.2) in isolation; this is its first proof end-to-end through an actual `addImport` insertion on a CRLF file | ✅ | n/a | n/a |
| TSD-03.10 (duplicate addImport) | `dialect.test.ts::REQ-TSD-03.10` | integration | [characterization] — `ops.ts`'s merge-into-existing-clause branch was written in S-002 but never exercised via TWO calls on the SAME handle (only single-call coverage existed); probed first, single import line confirmed | ✅ | n/a | n/a |
| TSD-03.7 (4 MiB boundary) | `dialect.test.ts::REQ-TSD-03.7` | integration | GENUINELY NEW assertion (not characterization) — no prior test drove a multibyte-inflation cap rejection through the dialect. Probed via standalone script first (see construction note above); real RED-equivalent evidence is the probe's own arithmetic proof (`raw < CAP < serialized`) before the assertion was committed | ✅ | n/a (one fixed boundary construction, not a class of inputs — REQ-TSD-03.7 pins a single deterministic fixture) | n/a |
| TSD-04.1 (malformed TypeScript) | `dialect.test.ts::REQ-TSD-04.1` | unit | [characterization] — the syntactic-diagnostics throw mechanism in `ast.ts` was empirically probed and built in S-002 (apply-progress batch 2, deviation #3) explicitly deferring its own test to S-003; probed again here against a fresh malformed fixture (`const x = ;\nfunction ( { }\n`) confirming the REAL ts-morph diagnostics path throws, contained, `.cause` absent | ✅ | n/a | n/a |

### Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `test/dialects/typescript/dialect.test.ts` | Modified | S-003 | +11 tests: TSD-03.1/.2/.3/.4/.5/.6/.7/.8/.9/.10, TSD-04.1 |
| `test/dialects/typescript/golden/empty-add-import-after.txt` | Created | S-003 | TSD-03.5 golden |
| `test/dialects/typescript/golden/crlf-bom-round-trip.txt` | Created | S-003 | TSD-03.6 golden (BOM+CRLF) |
| `test/dialects/typescript/golden/crlf-add-import-before.txt` | Created | S-003 | TSD-03.8 seed |
| `test/dialects/typescript/golden/crlf-add-import-after.txt` | Created | S-003 | TSD-03.8 golden |

### Post-Slice Self-Review (Step 7c — no external audit engine available in this sub-agent context)

Checked the S-003 diff against all 8 binding constraints: (1) N/A this slice (no dependency
change); (2) zero references to `test/fixtures/toy-dialect/**`; (3) the frozen-prefix wrapper
is untouched — S-003 only adds NEW callers of the existing `dialect-handle.ts` wrapper, never a
second implementation; (4) N/A this slice (S-005 scope); (5) both `find()`-only chains that call
`.read()` — none in this slice actually call bare `.read()` without a prior op, so the
flush-seed-rule is vacuously satisfied (every new test pre-seeds via `makeSpyClient({...})`
before any op runs); (6) no test asserts a specific outcome for concurrent unawaited same-path
handles; (7) every new content assertion is byte-exact against a committed golden or an inline
literal derived from a real probe run — never count-only; (8) suite green + `tsc` clean +
`bun run build` clean confirmed. No findings.

### Next Recommended

`/build --scope=slice:S-004` (Conformance Core) — parallelizable with S-003 per Build Order, now
starting since S-003 is complete. S-004 is disjoint in files from S-003 (touches
`src/conformance/index.ts`, `src/conformance/run-vehicle.ts`, `test/conformance/**`).

---

## Batch 3b — S-004: Conformance Core Against the Real Dialect

**Mode**: Strict TDD, [must-fail-first] — every planted-violation fixture was probed via a
standalone script (RED-equivalent evidence: confirmed the fixture rejects, and rejects for
the SPECIFIC assertion it targets, not an incidental earlier check) BEFORE being wired into
`typescript-conformance.test.ts`'s expect-reject assertions; the happy-path `testDialect`/
`testOpPack` bodies were likewise probed against the real dialect end-to-end before being
committed to production code, per the same house convention batches 2/3 already established
for this change. **Suite**: 740 → 746 (bun test, +6: 3 meta + 3 conformance-suite files worth
of new assertions minus the deleted toy-smoke file's 5) · `bunx tsc --noEmit`: CLEAN ·
`bun run build`: CLEAN.

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-004 | happy-path | complete | 6/6 |

### ADR-0012 amendment

`openspec/decisions/0012-conformance-kit.md` amended in place (Modified, not a new number —
per this change's own established precedent for amending EXISTING ADRs 0012/0014, distinct
from the ADR-0033/0034 renumbering-collision precedent which only applies to brand-NEW
decision numbers). Amendment section documents: the five CORE assertions now shipped,
`Promise<void>` signatures, the `OpPackFixture.exercises`/`OpExercise` additive field, the
run-vehicle rationale, and what stays deferred (adversarial samples, leaf rule,
real-base-dialect rule — `stage-5b-dialect-breadth`).

### Implementation approach

- **`src/conformance/run-vehicle.ts`** (Create) — a MINIMAL kit-internal in-memory transport
  (stage/read/commit/discard semantics only) implementing the port shape via a LOCAL
  structural interface, never naming the SDK's transport-port TYPE anywhere in the file
  (comments included — REQ-FIT-09/fit-10's structural guard scans ALL source text, not just
  code; caught this on first full-suite run, see Deviations). NOT exported from
  `./conformance` (FIT-08-legal internal use; `test/`'s `ContractFake` stays normative).
- **`src/conformance/index.ts`** (Modify) — real `testDialect` (DC-01: direct
  `dialect.ast.print(dialect.ast.parse(sample))` comparison, no run-vehicle needed) and
  `testOpPack` (DC-02/03/04/05.2: a shared `runExercise` helper drives each `OpExercise`
  through `defineFactory` + a fresh, isolated `run-vehicle.ts` instance, per §4.4c). Assertion
  ORDER is deliberate: serializability (DC-04) is checked BEFORE content/count checks on every
  exercise result, so a closure-/live-node-smuggle fixture fails on the SPECIFIC DC-04
  assertion rather than an incidental content mismatch masking it (verified via probe — see
  TDD Cycle Evidence).
- **`test/conformance/planted/`** (Create, 6 files) — `round-trip-violation.ts` (DC-01 slot,
  built via the real `defineDialect` factory with a corrupting `print`), `single-op-violation.ts`
  (DC-02 slot), `coalescing-violation.ts` (DC-03 slot, hand-rolled `find()` since the real
  `createDialectHandle` machinery cannot be coerced into NOT coalescing — bypasses
  `defineDialect` entirely, test-only code so importing `currentContext` directly is legal),
  `closure-smuggle-violation.ts` (DC-04.1, ALSO the mandated DC-05 serializability instance per
  REQ-DC-05's own text), `live-node-smuggle-violation.ts` (DC-04.2, uses the REAL `ast.ts`
  `parse` to get a genuine ts-morph `SourceFile` with circular compiler-node parent
  pointers — empirically confirmed `JSON.stringify` throws `TypeError: JSON.stringify cannot
  serialize cyclic structures.` on it, verified BEFORE writing the fixture), and
  `read-split-violation.ts` (DC-05.2 slot, hand-rolled `find()` that defers ALL buffering to
  the chain's final `.then()` — correctly coalesces a plain no-read chain into one modify
  [isolating the read-split failure specifically] but ignores any mid-chain `read()` entirely,
  so it never splits).
- **`test/conformance/typescript-conformance.test.ts`** (Create) — assembles a REAL
  `Dialect` from the SAME production building blocks `src/dialects/typescript/index.ts`
  composes internally (`defineDialect`+`defineOpPack`+`withOps` over the real `ast.ts`/`ops.ts`)
  since `index.ts` itself exports only `find` (REQ-DG-04.1/FIT-08) — this is NOT a mock, per
  ADR-0012/REQ-TSD-07, it is literally the same `parse`/`print`/`addImport` production code the
  shipped dialect uses. DC-02's single-op exercise and DC-03's multi-op exercise reuse the
  EXISTING `add-import-before/after.txt` and `coalesced-two-edits.txt` goldens (no new goldens
  needed — same real ts-morph output already committed and verified in S-002). REQ-TSD-05.1
  smoke test added (against a real `ContractFake`, per design's Test Derivation assignment).
- **`test/conformance/meta.test.ts`** (Rewrite) — dropped the stale "throws, no dialect exists
  yet" assertions; kept + extended the export-surface wiring checks (now also asserts
  `testDialect` returns a `Promise`, matching the new async signature).
- **`test/conformance/toy-dialect-smoke.test.ts`** (Deleted) — design's own Q2/rev-4 language
  is explicit: "that smoke is REPLACED by the REAL TypeScript-dialect conformance run... the
  toy fixture is NOT carried into conformance code past S-001" (constraint 2). Its own
  assertions (`testDialect`/`testOpPack` throw the stub error) are now FALSE against the real
  implementation — kept as dead code would either bit-rot or require reimplementing stub
  behavior just to keep an obsolete test green, both worse than deletion. `rg` confirmed no
  other file references it.

### Deviations From Plan

#### 1. FIT-10/REQ-FIT-09 caught a comment, not code (self-corrected same session)

First `run-vehicle.ts` draft explained its OWN port-symbol avoidance in a comment that
LITERALLY NAMED the two banned symbols ("No `EngineClient`/`EmitRejection` symbol is named
anywhere in this file...") — fit-10's structural guard scans ALL source text (`PORT_SYMBOL_
PATTERN.test(source)`), comments included, so the explanatory comment tripped the very guard
it was explaining. Fixed by rephrasing the comment to describe the constraint without quoting
the banned identifiers. Caught on the FIRST full-suite run after the file was written — no
implementation change needed, purely a comment-wording fix. Recorded here as a genuine,
non-obvious gotcha for future dialect-adjacent `src/` authors: the port guard is a TEXT scan,
not an AST/import scan.

#### 2. `OpPackFixture.exercises` was already present (no change needed)

S-001's batch had already landed the `exercises: readonly OpExercise[]` REQUIRED field and
`OpExercise` type in `src/conformance/index.ts` (type-only, per the verify-plan-4 amendment) —
confirmed by reading the file before writing S-004's bodies. No structural change needed here;
S-004 only filled in the runtime bodies that CONSUME `exercises`.

### TDD Cycle Evidence — S-004

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `testDialect` DC-01 | `typescript-conformance.test.ts::REQ-DC-01.1` | integration | Probed standalone against 4 representative samples (plain, comment+whitespace, JSDoc+function, leading/trailing-space) BEFORE writing the assertion — all round-tripped byte-exact on first probe run (the underlying `ast.ts` parse/print pair was already proven correct in S-002); committed test passed on first `bun test` run | ✅ | 4 distinct sample shapes | n/a |
| `testOpPack` DC-02/03/05.2 | `typescript-conformance.test.ts::"addImport single-op...multi-op..."` | integration | Probed standalone (single-op + multi-op exercises against the real dialect) BEFORE committing — confirmed exactly 1 modify (no-read) / exactly 2 modifies (read-injected), byte-exact against existing goldens | ✅ | single-op (DC-02) + multi-op (DC-03) + read-split (DC-05.2) — 3 distinct code paths through the same `runExercise` helper | n/a |
| DC-04 serializability (positive path) | (implicit — every exercise run above passes `assertSerializable`, plain-string content) | integration | n/a — proven negative via the two smuggle fixtures below, not a positive-only assertion (Theatre Criteria: "a `.raw()` fixture that is positive-only... MUST NOT appear") | ✅ | n/a | n/a |
| round-trip-violation | `typescript-conformance.test.ts::"round-trip slot"` | integration | [must-fail-first] Probed: `testDialect(roundTripViolationFixture)` rejects with the REQ-DC-01 message on first run (a print-corrupting dialect can never round-trip) | ✅ | n/a (one fixed violation) | n/a |
| single-op-violation | `typescript-conformance.test.ts::"single-op-fidelity slot"` | integration | [must-fail-first] Probed: rejects with REQ-DC-02/03 content-mismatch message; required a SECOND, multi-op exercise added to the fixture so the structural "≥1 multi-op exercise" precondition didn't mask the single-op failure with a DIFFERENT (wrong-reason) rejection — caught via probe, fixed before commit | ✅ | 2 exercises (single-op + multi-op, both broken the same way) | n/a |
| coalescing-violation | `typescript-conformance.test.ts::"coalescing slot"` | integration | [must-fail-first] Probed: rejects with "expected exactly ONE modify... got 2" — confirms the hand-rolled never-coalescing `find()` genuinely bypasses the real machinery | ✅ | n/a | n/a |
| closure-smuggle / live-node-smuggle | `typescript-conformance.test.ts::"serializability slot" / "distinct failure mode"` | integration | [must-fail-first] Probed BOTH independently: closure fixture rejects via the deep-equal mismatch branch (silent key-drop); live-node fixture rejects via the try/catch branch (`JSON.stringify` THROWS) — confirmed these are genuinely DISTINCT code paths inside `assertSerializable`, not the same branch catching both | ✅ | 2 distinct failure modes, both required by REQ-DC-04.1/.2 | n/a |
| read-split-violation | `typescript-conformance.test.ts::"REQ-DC-05.2"` | integration | [must-fail-first] First hand-rolled attempt ("stale-directive-reuse" design) produced a LOST edit (0 additional modifies) rather than a clean "1 modify where 2 expected" — still correctly rejected (`length !== 2`) but the mechanism didn't match the fixture's own doc comment. Redesigned to "defer all buffering to final `.then()`" — probed again, now genuinely "coalesces across the read" (1 modify, cumulative content) matching REQ-DC-05.2's literal wording; verified the DIRECT (no-read) pass still coalesces correctly first, isolating the read-split failure specifically | ✅ | n/a | one full mechanism redesign (see RED evidence) |
| `meta.test.ts` rewrite | `meta.test.ts::"testDialect returns a Promise"` | unit | Old stub-throw assertions removed; new Promise-return assertion probed against the real (non-stub) implementation | ✅ | n/a | n/a |

### Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `src/conformance/index.ts` | Modified | S-004 | Real `testDialect`/`testOpPack` bodies, `deepEqual`, `assertSerializable`, `runExercise` |
| `src/conformance/run-vehicle.ts` | Created | S-004 | Kit-internal minimal in-memory transport (structural port type, never names it) |
| `test/conformance/typescript-conformance.test.ts` | Created | S-004 | DC-01..05 + TSD-05.1 against the real dialect |
| `test/conformance/planted/round-trip-violation.ts` | Created | S-004 | DC-05 round-trip slot |
| `test/conformance/planted/single-op-violation.ts` | Created | S-004 | DC-05 single-op slot |
| `test/conformance/planted/coalescing-violation.ts` | Created | S-004 | DC-05 coalescing slot |
| `test/conformance/planted/closure-smuggle-violation.ts` | Created | S-004 | DC-04.1 + DC-05 serializability slot |
| `test/conformance/planted/live-node-smuggle-violation.ts` | Created | S-004 | DC-04.2 distinct failure mode |
| `test/conformance/planted/read-split-violation.ts` | Created | S-004 | DC-05.2 slot |
| `test/conformance/meta.test.ts` | Modified | S-004 | Dropped stale stub assertions, added Promise-return check |
| `test/conformance/toy-dialect-smoke.test.ts` | Deleted | S-004 | Replaced by `typescript-conformance.test.ts` (constraint 2) |
| `test/fitness/dts-baseline/conformance.index.d.ts` | Modified | S-004 | Regenerated (`Promise<void>`, `exercises`/`OpExercise`) |
| `test/fitness/pkg-surface-baseline.json` | Modified | S-004 | +3 tarball entries (`dist/conformance/run-vehicle.*`) |
| `openspec/decisions/0012-conformance-kit.md` | Modified | S-004 | ADR-0012 amendment (in place, no renumber — amends an existing ADR) |

### Post-Slice Self-Review (Step 7c — no external audit engine available in this sub-agent context)

Checked the S-004 diff against all 8 binding constraints: (1) N/A (no dependency change); (2)
zero references to `test/fixtures/toy-dialect/**` in any S-004 file (`rg` confirmed) —
`toy-dialect-smoke.test.ts` was DELETED, not extended, per constraint 2's own text; (3) the
frozen-prefix wrapper untouched, S-004 never constructs a second error-wrapping site; (4) N/A
(S-005 scope); (5) every `OpExercise`/exercise run pre-seeds its target via
`createRunVehicle({[path]: seed})` before any op runs — no bare `create()`-then-`find()`-only
chain; (6) no test asserts a specific outcome for concurrent unawaited same-path handles; (7)
every DC-01/02/03 assertion is byte-exact (`===`) against either a committed golden or a
self-derived value — never count-only, and DC-04's assertion is structural deep-equal, never a
`toBeDefined`-style loose check; (8) suite green (746/746) + `tsc` clean + `bun run build`
clean confirmed, including FIT-04/FIT-14's own self-rebuilding checks. No findings.

### Next Recommended

`/build --scope=slice:S-005` (Authoring Docs, SECURITY Guard, Sensitive-Areas Promotion) —
requires S-002 (complete) + S-004 (complete, this batch). This is the LAST slice in the
Build Order; once done, the change is ready for `sdd-verify --mode=final`.

---

## Batch 2 — S-002: The Real Dialect (ts-morph, `./typescript`, `addImport`)

**Mode**: Strict TDD (batch-oriented per house precedent — implementation and its driving
test written together per coherent mechanism, same as batch 1's "coalescing mechanism" row;
every unit still ran through a real RED before GREEN where behaviour was new/uncertain) ·
**Suite**: 689 → 729 (bun test) · `bunx tsc --noEmit`: CLEAN · `bun run build`: CLEAN ·
resolved ts-morph pin: **28.0.0** (latest stable at S-002 apply time, 2026-07-12, verified via
`npm view ts-morph version`) · measured FIT-03 `/typescript` budget: **6.82 KB actual, 32 KB
committed budget** (`--packages=external`).

### Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-002 | happy-path | complete | 10/10 |

### Commits

1. `3c04bd5` — chore(deps): S-002 — land ts-morph as the first runtime dependency (D5, ADR-0038)
2. `bc073d2` — feat(dialects): S-002 — real TypeScript dialect via ts-morph (addImport, .raw)
3. `ed5ab53` — test(fitness): S-002 — extend FIT-03/04/05/06/08/09/14 for the ./typescript subpath

### Halt-check (constraint 1)

Confirmed `fit-01-commons-no-ast.test.ts` GREEN (6/6) BEFORE `ts-morph` entered
`package.json#dependencies` — re-verified again after landing (still 6/6), and again after the
full batch (still green, nothing under `src/commons/**` reaches the new dialect tree).

### Deviations From Plan

#### 1. ADR renumbering: "ADR-0033" → ADR-0038 (same precedent as batch 1's ADR-0037)

Design drafted the ts-morph decision as "ADR-0033". By S-002 apply time the free range had
moved twice: `stage-4b-testing-harness` claimed 0033-0036 on `main`, and this change's own
S-001 batch claimed 0037 for the coalescing-seam decision. Landed as
`openspec/decisions/0038-ts-morph-runtime-dependency.md` — content verbatim per design §4.5,
header documents the collision. `openspec/decisions/0014-single-package-subpath-shape.md`
amended in place (its own convention — ADRs amend rather than fork) to wire `./typescript`.

#### 2. Exports-map count: design's "four entries" → actual five (`./testing` pre-existing)

Design/slices/REQ-FPS-02/REQ-PKG-01 all state the exports map "is now FOUR entries" (assuming
a 3-entry starting point: `.`, `./commons`, `./conformance`). By S-002 apply time
`stage-4b-testing-harness` had already landed a 4th entry, `./testing` (third-audience
author-testing surface), on `main` — independently of this change, the same cross-branch
"next free slot computed at plan time, other branch merged first" collision class as the ADR
renumbering above, just for a count instead of a number. Treated identically: the AUTHORIZED
delta this change makes is "+1 subpath (`./typescript`) +1 dependency (`ts-morph`)" relative
to whatever the actual current baseline is — not the literal stale count. Final state: **five**
exports entries (`.`, `./commons`, `./conformance`, `./testing`, `./typescript`), **one**
dependency (`ts-morph`, exact-pinned). `pkg-surface-baseline.json`, FIT-09, and FIT-14 updated
to the real 5-entry/1-dep state; new assertions added asserting the EXACT authorized set (not
just "unchanged from baseline") so a future silent 6th entry or 2nd dependency still fails red.

#### 3. Two empirically-discovered ts-morph@28.0.0 behaviours the design's prose assumed differently

Both probed BEFORE writing any golden/implementation (not discovered via a failing golden —
caught at the design-verification stage, not the red-proof stage):

- **BOM is NOT preserved by ts-morph "independently"** (design §4.4's claim) — `SourceFile
  #getFullText()` strips a leading BOM; it never round-trips it. `ast.ts` owns re-prepending
  the BOM itself via a private `WeakMap<SourceFile, boolean>`, set at `parse()`, consumed at
  `print()` — invisible to the frozen `Ast = SourceFile` type, no signature change. Prepares
  REQ-TSD-03.6 (S-003 scope) correctly; not yet golden/test-covered (S-002 doesn't reach TSD-03).
- **ts-morph's parser does not natively throw on malformed syntax** — TypeScript's parser is
  deliberately fault-tolerant (produces a `SourceFile` with diagnostics, not a thrown error),
  contradicting REQ-TSD-04.1/REQ-DG-05.2's "triggering `ast.parse`" framing, which assumes a
  native throw. `ast.parse` now checks `project.getProgram().getSyntacticDiagnostics(sourceFile)`
  post-parse and throws (a plain, generic-message Error — never the frozen prefix itself, honoring
  constraint 3) when syntactic (not semantic/type) diagnostics exist — verified empirically to
  correctly distinguish a real syntax error from a type-only error (zero syntactic diagnostics)
  and from valid/empty content. This is executor latitude (design §4.3 Q4: `ast.parse`'s internal
  failure-detection mechanism is not itself a frozen contract, only its `(source) => Ast` shape
  is) — not yet exercised by a REQ-TSD-04.1 test (S-003 scope); the mechanism is in place and
  will be driven by S-003's malformed-TypeScript fixture.

#### 4. F1 followup (verify-in-loop-1) closed against the REAL dialect, not the toy one

`coalescing.test.ts` adds `.raw()`-before-a-named-op content-verified against ts-morph
(REQ-DG-03.2) — S-001's toy-dialect test only covered the reverse order. Byte-identical to the
forward-order end-state (confirmed via both a probe and the e2e Flow 1/2 pair), proving order
independence on the real AST, not just the toy line-array one.

#### 5. Collateral fixes outside S-002's own file list (required by constraint 8, not scope creep)

Two PRE-EXISTING tests hard-coded a zero-runtime-deps assumption that predates this change and
broke the moment `ts-morph` landed — neither is in S-002's task list or Test Derivation table,
but constraint 8 ("every slice leaves the suite GREEN... no broken intermediate states") is
unconditional:

- `test/bin/codegen-cli.test.ts`: "dependencies stays absent or empty" → "dependencies is
  exactly `[ts-morph]`" (the bin itself still pulls in nothing of its own).
- `test/e2e/installed-consumer.e2e.test.ts`: the scratch-consumer install used a non-routable
  `BUN_CONFIG_REGISTRY` (SEC-m2 zero-deps-era hardening) — now needs REAL registry access to
  resolve `ts-morph`, a legitimate dependency the tarball itself declares. Removed the registry
  override (kept `--ignore-scripts`, the actual supply-chain guard against a malicious
  lifecycle script); documented the reasoning in the file's own header comment. Verified fresh
  (deleted the memoized scratch dir, re-ran from a clean install) — genuinely exercises network
  resolution, not a stale cached pass.

### TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| `detectNewLineKind` | `dialect.test.ts::REQ-TSD-02.2` | unit | Wrong assumption about `NewLineKind` enum ordinals — `expected 0, got 1` on the first assertion; fixed by comparing against the real `NewLineKind` enum instead of hard-coded numbers | ✅ | LF / CRLF-dominant / tie / empty — 4 cases | n/a |
| Read-routing static scan | `read-routing.test.ts::REQ-MC-03.1` | architectural | Real false positive: `src/dialects/typescript/index.ts` flagged for "EngineClient referenced" — the scanner matched the literal word inside a doc comment explaining what is NOT imported, not an actual import; fixed by stripping comments before scanning (mirrors FIT-01's own batch-1 fix for the same class of bug) | ✅ | n/a (structural scan, not scenario-varied) | n/a |
| ts-morph parse-failure containment | (mechanism only — not yet REQ-TSD-04.1-tested, S-003 scope) | — | Probed empirically (`getSyntacticDiagnostics` distinguishes syntax vs. semantic errors: 0 for a type-error-only file, >0 for genuinely malformed source, 0 for empty/valid) before writing any implementation — RED-equivalent discovery at the design-verification stage | ✅ (mechanism in place) | n/a | n/a |
| Coalescing/split/join/addImport/e2e (dialect.test.ts, coalescing.test.ts, dialect-modify.e2e.test.ts — 20 cases total) | multiple files | integration/e2e | Every content expectation was pre-verified against real ts-morph output via standalone probe scripts BEFORE being written into a test (not asserted blind); all passed on first `bun test` run — batch-oriented per house precedent (same as batch 1's 10-case coalescing row), acceptable because the mechanism (dialect-handle.ts) was already proven correct in S-001 and only the AST-specific glue (ast.ts/ops.ts) was new | ✅ | REQ-MC-01/02/06/07 × real dialect + F1 + Flows 1-4 | n/a |
| FIT-03/05/06/08/09/14 extensions | `test/fitness/*.test.ts` | architectural | Fit-09/fit-10 broke on first full-suite run post-implementation (genuine collateral RED: exports-count mismatch, EngineClient-in-comment false positive) — fixed as documented in Deviations #2 and the read-routing row above | ✅ | n/a | n/a |

### Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `package.json` | Modified | S-002 | `ts-morph@28.0.0` exact dependency; `./typescript` exports entry |
| `bun.lock` | Modified | S-002 | Committed lockfile carrying ts-morph + its 8 transitive deps |
| `openspec/decisions/0038-ts-morph-runtime-dependency.md` | Created | S-002 | ADR (renumbered from "0033") |
| `openspec/decisions/0014-single-package-subpath-shape.md` | Modified | S-002 | Amendment: `./typescript` wired |
| `src/dialects/typescript/ast.ts` | Created | S-002 | ts-morph parse/print, `detectNewLineKind`, BOM re-prepend, syntactic-diagnostics parse-failure detection |
| `src/dialects/typescript/ops.ts` | Created | S-002 | `addImport` op (merge-into-existing-clause idempotency) |
| `src/dialects/typescript/index.ts` | Created | S-002 | Dialect module — `find`, composed via `defineDialect`+`withOps` |
| `test/dialects/typescript/dialect.test.ts` | Created | S-002 | TSD-01/02 base cases, determinism spy |
| `test/dialects/typescript/coalescing.test.ts` | Created | S-002 | MC-01/02/05/06/07 real-AST restatement + F1 followup |
| `test/dialects/typescript/read-routing.test.ts` | Created | S-002 | MC-03 static scan + planted red-proof |
| `test/dialects/typescript/golden/*.txt` (5 files) | Created | S-002 | Byte-exact committed goldens |
| `test/e2e/dialect-modify.e2e.test.ts` | Created | S-002 | Outer-loop Flows 1-4 |
| `test/fixtures/red/dialect-typescript/direct-engine-read.ts` | Created | S-002 | Quarantined red-proof fixture (REQ-MC-03.2) |
| `test/fitness/fit-03-commons-bundle-budget.test.ts` | Modified | S-002 | `/typescript` own budget + red-proof |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modified | S-002 | New `typescript.index.d.ts` baseline pair |
| `test/fitness/dts-baseline/typescript.index.d.ts` | Created | S-002 | First-commit baseline |
| `test/fitness/fit-05-serializable-bytes.test.ts` | Modified | S-002 | Real coalesced dialect directive JSON-roundtrip case |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Modified | S-002 | `PUBLIC_PATHS` + `find` `@example` gate + red-proof |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modified | S-002 | `./typescript` scanned path + planted red-proofs |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Modified | S-002 | `./typescript` entry assertion, 5-entry exact set |
| `test/fitness/fit-14-package-surface.test.ts` | Modified | S-002 | `dependencies` baseline field, exact-pin assertions |
| `test/fitness/pkg-surface-baseline.json` | Modified | S-002 | 5 exports, ts-morph dependency, 9 new tarball entries |
| `test/bin/codegen-cli.test.ts` | Modified | S-002 (collateral) | Zero-deps → exactly-ts-morph assertion |
| `test/e2e/installed-consumer.e2e.test.ts` | Modified | S-002 (collateral) | Removed non-routable registry override |

### Post-Slice Self-Review (Step 7c — no external audit engine available in this sub-agent context)

Checked the full S-002 diff against all 8 binding constraints manually: (1) halt-check
confirmed before AND after the dependency landed; (2) zero references to
`test/fixtures/toy-dialect/**` anywhere in S-002 code (`rg` confirmed); (3) the frozen-prefix
wrapper is still implemented exactly once, in `dialect-handle.ts` (untouched this batch) —
`ast.ts`'s own thrown errors are plain, unprefixed signals the existing wrapper catches, not a
second implementation; (4) N/A this batch (S-005 scope); (5) every `find()`-only chain in every
new test pre-seeds its target; (6) no test asserts a specific outcome for concurrent
unawaited same-path handles; (7) every coalescing/split/e2e assertion is byte-exact against a
committed golden, never count-only; (8) suite green + `tsc` clean confirmed repeatedly,
including post-build. No findings.

### Next Recommended

`/build --scope=slice:S-003` — requires S-002 complete (confirmed). S-003 (Edge Scenarios &
Fidelity Boundaries) can now exercise the BOM-preservation and parse-failure-detection
mechanisms this batch already built into `ast.ts` but did not yet test (TSD-03/04 are S-003's
own REQ coverage, correctly out of S-002's scope per slices.md). S-004 (conformance core)
is parallelizable with S-003 once S-002 is confirmed complete.

## Slices Built This Run

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-000 | edge-case (guard) | complete | 3/3 |
| S-001 | walking-skeleton | complete | 10/10 |

## Commits

1. `f21b17c` — test(fitness): S-000 — rebuild FIT-01 as a transitive import-graph walk
2. `e071f1b` — feat(core): S-001 — real dialect generics, coalescing handle, run-boundary join
3. `386604e` — test(fitness): S-001 — coalescing orphan + unawaited-join guards (ADR-0037)
4. `2d59327` — test: S-001 — type-level pins, toy-dialect e2e smoke, conformance type-pin

## Deviations From Plan (both content-neutral, mechanical)

### 1. ADR renumbering: "ADR-0034" → ADR-0037

Design.md and slices.md drafted the coalescing-seam decision as ADR-0034 (and the S-002
ts-morph decision as ADR-0033). By the time this worktree branched from `main`,
`stage-4b-testing-harness` had already landed ADRs 0033-0036 for an unrelated concern
(third-audience author-testing, shipped-fake containment) — both branches independently
picked the "next free number" at planning time, and stage-4b merged first. Landed this
change's decision as `openspec/decisions/0037-coalescing-seam-handle-owned.md` (renumbered,
content unchanged, header documents the collision and precedent — this project has an
established convention for exactly this situation, per stage-4's own 0024-0028 renumber).
**S-002's ADR-0033 (ts-morph) will need the SAME treatment** — flagging now so the next
batch's executor isn't surprised; next free slot at that point will be 0038 (or later if
another change lands first).

### 2. Fitness function renumbering: "FIT-17"/"FIT-18" → FIT-19/FIT-20

Same root cause: `fit-17-testing-dev-only-bundle.test.ts` and
`fit-18-fake-single-source-parity.test.ts` already exist on `main` from
stage-4b-testing-harness. Landed as `test/fitness/fit-19-coalescing-orphan-guard.test.ts` and
`test/fitness/fit-20-unawaited-join-guard.test.ts`. Neither REQ-ID text nor any signed spec
references the literal numbers "17"/"18" — these are design/slices-internal labels only, so
the renumbering carries zero content risk.

### 3. Generic type-parameter default: `unknown` → `any`

Design's `Op<Ast>`/`OpPack<Ast>`/`Dialect<Ast,Ops>`/`Handle<State,Ast,Ops>` needed default
type parameters so `src/conformance/index.ts`'s fixtures could keep using BARE (no
type-argument) `Dialect`/`OpPack`, per design §4.3's literal code block. Defaulting to
`unknown` compiles for the type DECLARATIONS themselves but breaks at every USE site: `Op<Ast>`'s
`ast` parameter is contravariant, so a concrete `Dialect<ToyAst, ...>` is not structurally
assignable to `Dialect<unknown, OpPack<unknown>>` (surfaced writing
`test/conformance/toy-dialect-smoke.test.ts`). Switched every default to `= any`, which
short-circuits variance checking in both directions — exactly the "some dialect, don't care
about the concrete Ast" erasure the bare form needs. Explicit instantiations
(`Dialect<ToyAst, {push:...}>`, `Handle<"found", Ast, {}>`, etc.) are completely unaffected —
`any` only ever applies when NO type argument is supplied.

### 4. pkg-surface-baseline.json touched one line early (pulled forward from S-002)

Adding `src/core/dialect-handle.ts` produces new `dist/core/dialect-handle.{js,d.ts,d.ts.map}`
output, which FIT-14's self-building `beforeAll` (`bun run build`) picks up — without a
baseline update this fails FIT-14's own tarball-diff assertion at S-001's boundary, violating
binding constraint 8 ("every slice leaves the suite GREEN... no broken intermediate states").
Added the 3 new tarball entries to `test/fitness/pkg-surface-baseline.json` (alphabetically
placed). This is the MINIMUM slice of S-002's own "regenerate pkg-surface-baseline.json" task
— only the 3 new lines for this new internal file; the ts-morph/exports/dependency parts of
that task are untouched and remain S-002's job.

## TDD Cycle Evidence

### S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Transitive walk | `fit-01-commons-no-ast.test.ts::the graph walk reaches the transitive ts-morph import through helper.ts` | fitness (static scan) | `expect(violations).toEqual([{file:helper.ts,specifier:ts-morph}])` — got `[]` | ✅ | 2 cases (real-commons-clean-graph + planted-1-hop-violation) | comment-stripping + export-from matching added post-GREEN (2 real bugs found: JSDoc @example false positive, `export { x } from` not matched) |

### S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| Coalescing mechanism | `dialect-handle.test.ts` (10 cases) | unit/integration | Chaining bug found on first real run: `.raw is not a function` (op methods returned the internal controller, not the public handle wrapper) — 4 tests failed for this reason | ✅ (after fixing the wrapper's return-value binding) | REQ-MC-01/02/04/05/07 + REQ-DG-05 — 10 distinct cases | n/a |
| FIT-19 orphan guard | `fit-19-coalescing-orphan-guard.test.ts` | fitness | Verified via literal mechanism removal (see below) | ✅ | n/a (dedicated ADR-level guard, not scenario variation) | n/a |
| FIT-20 join guard | `fit-20-unawaited-join-guard.test.ts` | fitness | Verified via TWO literal, independent mechanism removals (see below) | ✅ | 2 cases (happy unawaited + throwing unawaited) | Added an explicit in-flight delay to the throwing case so the rejection genuinely races the drain — the first version raced by accident and didn't exercise the real window |

**Literal mechanism-removal verification (temporary, reverted after observing RED — `git diff`
against the committed state confirmed byte-identical restoration):**

- Removed `ensureOpen()`'s `pendingSnapshot().includes(...)` identity check → FIT-19 AND
  `dialect-handle.test.ts`'s REQ-MC-02.1/.2.3 all failed with `Received length: 1` (expected
  2) — the post-read edit was silently absorbed into the pre-read directive instead of
  splitting.
- Removed `dialects.drain()` from `defineFactory` → FIT-20's happy case lost the edit
  entirely (`Received length: 0`); the throwing case's rejection never surfaced
  (`caught === undefined`).
- Removed the eager shadow-catch (`#tail.catch(() => {})`) while keeping drain → FIT-20's
  throwing case crashed Bun's own test runner with an uncaught rejection at the exact throw
  site — the strongest possible signal that the pre-drain window is real and this line closes
  it.

## Files Changed

| File | Action | Slice | What |
|---|---|---|---|
| `test/fitness/fit-01-commons-no-ast.test.ts` | Modified | S-000 | Direct-scan → transitive graph walk |
| `test/fixtures/red/fit-01-transitive/{leaf,helper}.ts` | Created | S-000 | Permanent planted 2-hop fixture |
| `src/core/define-dialect.ts` | Rewritten | S-001 | Real generics: `Op<Ast>`, `OpPack<Ast>`, `DialectDescriptor`, `Handle<State,Ast,Ops>`, `Dialect<Ast,Ops>`, `defineOpPack`/`defineDialect`/`withOps` |
| `src/core/dialect-handle.ts` | Created | S-001 | The coalescing handle factory (`#tail` queue, `ensureOpen`, lazy getter, error wrapper, registry self-registration) |
| `src/core/context.ts` | Modified | S-001 | `DialectRegistry` + `RunContext.dialects`; `defineFactory` drains before flush |
| `src/conformance/index.ts` | Modified | S-001 | `OpExercise` type + `OpPackFixture.exercises` (REQUIRED, type-only) |
| `openspec/decisions/0037-coalescing-seam-handle-owned.md` | Created | S-001 | ADR (renumbered from "0034") |
| `test/fixtures/toy-dialect/index.ts` | Created | S-001 | Throwaway toy dialect proof vehicle |
| `test/core/dialect-handle.test.ts` | Created | S-001 | REQ-MC-01/02/04/05/07 + REQ-DG-05 |
| `test/fitness/fit-19-coalescing-orphan-guard.test.ts` | Created | S-001 | Renumbered from "fit-17" |
| `test/fitness/fit-20-unawaited-join-guard.test.ts` | Created | S-001 | Renumbered from "fit-18" |
| `test/types/define-dialect.test.ts` | Modified | S-001 | Type-level pins (DG-01.1, DG-02.1, DG-02.3, `.raw`, thenable, `remove` state-gating) |
| `test/e2e/toy-dialect-skeleton.e2e.test.ts` | Created | S-001 | Outside-in smoke against `ContractFake` |
| `test/conformance/toy-dialect-smoke.test.ts` | Created | S-001 | Type-pin + expect-throw characterization |
| `test/fitness/pkg-surface-baseline.json` | Modified | S-001 | 3 new tarball entries (dialect-handle.*) |

## Next Recommended

`/build --scope=slice:S-002` — requires S-000 GREEN (confirmed) + S-001 complete (confirmed).
S-002 is the first task to touch `package.json#dependencies` (ts-morph) — its own halt-check
(constraint 1) should re-verify FIT-01 is still green before proceeding. S-002's executor
should also apply the SAME ADR-renumbering treatment to ADR-0033 (ts-morph) — next free slot
is 0038 at time of writing.
