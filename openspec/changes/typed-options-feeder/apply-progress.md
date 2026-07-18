# Apply Progress: typed-options-feeder

**Mode**: Strict TDD
**Store**: hybrid

## S-000: Walking Skeleton — Native array option encodes at the wire boundary

**Status**: complete (5/5 tasks)

### TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-000.1/.2 (unit) | `test/core/encode-options.test.ts::Scenario REQ-TOE-01.1: native array value encodes to a JSON string` | unit | "error: not implemented (encodeOptions stub)" | ✅ | n/a — 2 test-cases (array + object) exercise the same encode branch, no further class of composite input needed for the minimal skeleton | none needed |
| S-000.1/.2 (unit) | `test/core/encode-options.test.ts::Scenario REQ-TOE-01.2: native plain object value encodes to a JSON string` | unit | "error: not implemented (encodeOptions stub)" | ✅ | see above | none needed |
| S-000.3/.4 (outer loop) | `test/golden-ir/golden-ir.test.ts::create — exact keys, template byte-identical (DSL syntax unrendered); composite options encode at the wire boundary (REQ-TOE-01.1)` | golden fixture / integration | `Expected  - "[{\"name\":\"load\"},{\"name\":\"save\"}]"` / `Received  + [{name:"load"},{name:"save"}]` (native array unchanged, encode not yet wired) | ✅ | n/a — single end-to-end wiring assertion | tightened `isPlainObject`/`encodeOptions` value typing from `unknown` to `JsonValue` to drop a trailing `as JsonValue` cast (self-audit Group 3.1); all tests stayed green throughout |

Double-loop TDD ordering: outer-loop test (golden fixture, `test/golden-ir/golden-ir.test.ts`) was updated + driven RED before the wiring step (S-000.3) turned it GREEN, per slices.md's "Test layers: unit + golden fixture" for S-000.

### Files Touched

| File | Action | What |
|---|---|---|
| `src/core/directive-factory.ts` | Modified | Added `isPlainObject` + `encodeOptions` (composite→compact `JSON.stringify` via `Object.defineProperty` with pinned descriptor, everything else passthrough); wired `encodeOptions(a.options)` into `DirectiveFactory.create()` |
| `test/core/encode-options.test.ts` | Created | RED/GREEN unit tests for REQ-TOE-01.1/.2 |
| `test/golden-ir/fixtures.ts` | Modified | `GOLDEN_CREATE.create.options.methods` re-recorded to the encoded string `'[{"name":"load"},{"name":"save"}]'` |
| `test/golden-ir/golden-ir.test.ts` | Modified | `create` golden test now feeds a NATIVE array as input options (was self-referentially feeding the fixture's own — now encoded — value back to itself, which would have made the seam-proof vacuous); asserts against `GOLDEN_CREATE` (the encoded wire form) |

### Deviations from Design

- `test/golden-ir/golden-ir.test.ts` was not listed in the design's File Changes table or the slice's File Map, but required a one-line input-source change (native array literal instead of `GOLDEN_CREATE.create.options`) in its single `create` test case. Reason: once `GOLDEN_CREATE.create.options` itself became the post-encode (string) value, feeding it back as the `factory.create()` input made the test a no-op identity check (a string passes through unchanged regardless of whether `encodeOptions` runs) — it stopped proving the array→string encode seam at all. This is the "GOLDEN_CREATE re-record proving the seam end-to-end" outcome explicitly asked for; without this fix the seam is only proven by the standalone unit test, not the golden/integration layer the slice's "Test layers: unit + golden fixture" calls for.
- Task execution order deviated from the slice's listed numbering (did S-000.4 re-record + outer-loop RED before S-000.3 wiring) to honor double-loop TDD ordering (outer-loop test written/RED before descending into wiring). All 5 tasks completed; end state identical to what the numbered list specifies.
- Self-audit (Step 7c) caught FIT-07 (`no Map<path,*>/tree field in production core`) firing on `Record<string, unknown>` type annotations in the new code — not a real path-keyed-collection violation (it's a transient local variable for building an options object, not a stored tree), but the fitness test's regex is intentionally blunt project-wide. Fixed by using index-signature syntax (`{ [key: string]: JsonValue }`) instead of `Record<string, ...>` — same semantics, no `Record<string,` substring for the scanner to catch.

### Risks

None. Change is additive/narrow: one new exported function + one call-site wire-up, matching the sibling `forceEntry` pattern already in the file.

### Verification

- `bun test test/core/encode-options.test.ts test/golden-ir/golden-ir.test.ts test/fitness/fit-07-no-tree-in-core.test.ts` — green
- `bun test` (full suite) — 1863 pass / 0 fail (up from 1861 baseline; +2 new tests)
- `bun run typecheck` — clean, no errors

## S-001: Composite/scalar value shapes encode or pass through correctly

**Status**: complete (5/5 tasks)

### TDD Cycle Evidence — S-001

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-001.1 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-01.3: nested composites ride inside the single top-level encode` | unit | passed on first run — S-000's generic `Object.entries` + type-discriminated loop already handles nested-ride (no independent re-stringify site to fail) | ✅ (pre-existing) | n/a — pass-through of the existing general algorithm | none needed |
| S-001.1 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-01.4: mixed composite/scalar values — order, encode, and passthrough all pinned together` | unit | passed on first run — `Object.entries` iteration + `Object.defineProperty` assembly already preserve insertion order | ✅ (pre-existing) | n/a | none needed |
| S-001.1 | `test/core/encode-options.test.ts::Scenario REQ-TOE-01.5: a null-prototype object carrying composite data encodes (dict-like container)` | unit | `Expected - "{\"a\":1,\"b\":2}"` / `Received + {a:1,b:2}` — `isPlainObject` rejected `Object.create(null)` (only accepted `Object.prototype`), so the null-proto value fell through as a passthrough instead of encoding | ✅ | n/a — single class-of-input fix (prototype ∈ {Object.prototype, null}), no conditional/iterative logic beyond the existing branch | none needed |
| S-001.1 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-01.6: empty composite values encode to their empty JSON form, not skipped` | unit | passed on first run — the encode branch is a type check (`Array.isArray \|\| isPlainObject`), never a truthiness check, so `[]`/`{}` were never skip-prone | ✅ (pre-existing) | n/a | none needed |
| S-001.1 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-01.7: empty options object is a no-op` | unit | passed on first run — zero-entry `Object.entries` loop naturally no-ops | ✅ (pre-existing) | n/a | none needed |
| S-001.2 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-02.1: pre-stringified composite string passes through byte-identical` | unit | passed on first run — the encode branch only fires for `Array.isArray \|\| isPlainObject`; a string value already falls to the `else` passthrough | ✅ (pre-existing) | n/a — pure pass-through per spec, no triangulation required (strict-tdd.md "may not be required" case) | none needed |
| S-001.2 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-02.2: an ordinary string beginning \`[\`/\`{\` passes through unmodified` | unit | passed on first run — same passthrough branch, no `[`/`{`-prefix sniffing exists to misfire | ✅ (pre-existing) | n/a | none needed |
| S-001.2 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-03.1: number and boolean values pass through unmodified` | unit | passed on first run — same passthrough branch | ✅ (pre-existing) | n/a | none needed |
| S-001.2 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-03.2: null passes through as null, never the string "null"` | unit | passed on first run — `null` never matches `Array.isArray`/`isPlainObject` (both explicitly exclude `null`), so it never reaches `JSON.stringify` | ✅ (pre-existing) | n/a | none needed |
| S-001.3 | `test/core/encode-options.test.ts::[characterization] Scenario REQ-TOE-05.1: an option keyed "__proto__" encodes as a normal own key` | unit | passed on first run — S-000 already assembled `result` via `Object.defineProperty` (never spread/`result[k]=`), the exact mechanism REQ-TOE-05 requires | ✅ (pre-existing) | n/a | none needed |
| S-001.5 | `test/commons/encode-surface-parity.test.ts::a scaffold() call with no options argument at all schedules successfully — the encode step tolerates the absent value (defaults to {}, REQ-TOE-01.7)` | integration | passed on first run — `expander.ts`'s `args.options ?? {}` already defaults the omitted field to `{}` before it ever reaches `encodeOptions`, so the absent-options path never touches the `undefined` branch at all | ✅ (pre-existing) | n/a | none needed |

**Double-loop TDD note**: no new outer-loop (e2e/integration) test was required beyond the slice's own `test/commons/encode-surface-parity.test.ts` addition — the design's Test Derivation table places TOE-01.8 at "integration" level and that is exactly what this test exercises (through `scaffold()` + `runFactoryForTest`, not the bare `encodeOptions` unit).

**On the `[characterization]` naming and 10/11 tests passing immediately**: strict-tdd.md's Phase 1 halt condition ("test passes immediately on first run → HALT... behaviour already exists") is written for the case where a slice turns out to be redundant. That is not what happened here: S-000's GREEN step deliberately implemented a GENERAL `Object.entries` + type-discrimination loop (not a hard-coded per-key check for REQ-TOE-01.1/.2 alone) — see S-000's own evidence row noting "2 test-cases exercise the same encode branch, no further class of composite input needed for the minimal skeleton." S-001's job was to PROVE that generalization holds across the full scenario surface (nesting, ordering, empty values, string/scalar/null passthrough, `__proto__`-safety, absent-options) — most of it already did, one case (null-prototype objects) did not. This is the intended, designed shape of the slice: `slices.md` explicitly scopes S-001.4's GREEN step to ONLY "harden `isPlainObject` (null-proto)," confirming the slice author anticipated exactly this RED/already-green split. The codebase already has precedent for this exact situation — `test/fake/boundary-pass-through.test.ts` labels pre-existing-behavior tests `[characterization]` rather than forcing an artificial RED; this slice follows that same convention rather than inventing a new one. Every test asserts a specific expected value (never `toBeTruthy`/`toBeDefined`/"doesn't throw" alone), so none are vacuous per the Banned Assertion Patterns table.

### Files Touched

| File | Action | What |
|---|---|---|
| `src/core/directive-factory.ts` | Modified | `isPlainObject` now accepts `Object.getPrototypeOf(v) === null` in addition to `=== Object.prototype` (REQ-TOE-01.5, null-prototype dict-like containers encode instead of passthrough) |
| `test/core/encode-options.test.ts` | Modified | Added 10 scenario tests: REQ-TOE-01.3–.7, REQ-TOE-02.1–.2, REQ-TOE-03.1–.2, REQ-TOE-05.1 |
| `test/commons/encode-surface-parity.test.ts` | Created | REQ-TOE-01.8 (absent-options tolerance via `scaffold()`); file is scoped to grow further in S-002 (TOE-04 integration) and S-003 (TOE-06 cross-surface parity) per slices.md |

### Deviations from Design

- REQ-TOE-01.8's scenario prose says "a create()/scaffold() call made with no options argument at all." `commons.create()`'s `options` field is a REQUIRED (non-optional) `JsonValue` on every overload — TypeScript does not admit omitting it, and forcing the omission via an `as unknown as CreateOptions` cast produces a directive literal `{ options: undefined }` that FAILS at flush time for an unrelated reason: `ContractFake`'s round-trip fidelity check (`src/core/deep-equal.ts`) treats a key holding `undefined` as structurally different from an absent key once `JSON.stringify`/`JSON.parse` drops it, so the run would reject with "non-JSON-safe value detected" — a flush-time rejection, not a scheduling-time one, and NOT what REQ-TOE-01.8 is pinning ("WHEN scheduled THEN it schedules successfully," scheduling-scoped language consistent with REQ-TOE-04's own scheduling-vs-flush distinction). I verified this empirically (`fake.emit()` with a literal `options: undefined` create directive rejects with exactly that message) before choosing the surface. `scaffold()`'s `options` field IS genuinely optional (`options?: JsonValue`, `src/scaffold/expander.ts`) and already defaults the omitted case to `{}` before it ever reaches `encodeOptions` — a real, type-checked, author-reachable "no options argument at all" call that schedules AND completes successfully end-to-end. I tested through `scaffold()` rather than `create()` for this reason; noting it here rather than silently picking one interpretation.
- No other deviations. Task execution order matched the slice's listed numbering (S-001.1 → S-001.5).

### Risks

None. The only production change (`isPlainObject`'s null-proto branch) is additive and narrowly scoped — it only WIDENS which values are treated as "plain" for encoding purposes, matching REQ-TOE-01.5's explicit contract; it cannot affect any previously-passing case since `Object.create(null)` objects were previously falling through to the passthrough branch (silently wrong, not erroring), never exercised by S-000's tests.

### Verification

- `bun test test/core/encode-options.test.ts test/commons/encode-surface-parity.test.ts test/golden-ir/golden-ir.test.ts` — 25 pass / 0 fail
- `bun test test/fitness/` — 517 pass / 0 fail (self-audit: no fitness regressions from the `isPlainObject` change or new test files)
- `bun run typecheck` — clean, no errors
- `bun test` (full suite) — 1874 pass / 0 fail (up from 1863 baseline; +11 new tests)

## S-002: Non-plain-JSON option values reject loud at scheduling

**Status**: complete (5/5 tasks)

### TDD Cycle Evidence — S-002

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| S-002.1 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.1: top-level undefined option value rejects loud, naming the key` | unit | "Received function did not throw / Received value: {userMethods: undefined}" | ✅ | see triangulation note below | none needed |
| S-002.1 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.2: nested undefined inside a composite value rejects loud, never silently dropped` | unit | no throw; silently produced `{methods: '[{"name":"load"}]'}` (tag dropped, matching JSON.stringify's own silent-drop behavior) | ✅ | see below | none needed |
| S-002.1 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.3: function/symbol/BigInt values reject loud, never coerced or a raw serializer TypeError` | unit | function/symbol: no throw (silent passthrough); BigInt: message mismatch (no reject at all — top-level scalar bigint was never even attempted through JSON.stringify pre-fix) | ✅ | 3 cases in one test (function/symbol/BigInt) — the class-of-input triangulation for "which JS type is rejected" | none needed |
| S-002.1 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.5: Date value rejects as non-plain-JSON, never silently coerced to its ISO string` | unit | "Received function did not throw / Received value: {when: Date}" | ✅ | n/a — single-case (Date is not array/composite, no further class of input for this branch) | none needed |
| S-002.1 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.6: Map value rejects loud, never silently accepted as an empty object` | unit | "Received function did not throw / Received value: {methodRegistry: Map}" | ✅ | forced `kindOf`'s `instanceof Map` branch (distinct from Date/generic-class) | none needed |
| S-002.1 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.7: class instance value rejects loud, never accepted as its own-property JSON` | unit | "Received function did not throw / Received value: {userProfile: UserProfile{x:1}}" | ✅ | forced `kindOf`'s generic "a class instance" fallback branch (neither Date nor Map) | none needed |
| S-002.1/.8 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.8: nested function/symbol inside a composite value rejects loud, never silently dropped` | unit | function case: no throw, silently produced `{methods: '[{"name":"load"}]'}` (handler dropped); symbol case: same silent-drop family inside an array | ✅ | 2 cases (nested function in object, nested symbol in array) — forces recursion into BOTH array elements and object entries, not just top-level | none needed |
| S-002.2 | `test/core/encode-options.test.ts::Scenario REQ-TOE-04.4: circular reference rejects loud, not a raw TypeError` | unit | `"JSON.stringify cannot serialize cyclic structures."` (Bun's raw TypeError text — exactly the failure mode REQ-TOE-04.4 forbids) | ✅ | n/a — single true-cycle case; the shared-ref-DAG non-false-positive is the discriminating companion test (next row) | none needed |
| S-002.2 | `test/core/encode-options.test.ts::"the SAME object reference used at two sibling keys encodes both, not rejected as circular"` | unit | passed pre-implementation (no cycle-detection existed at all, so nothing could false-positive) — the value of this test is as a REGRESSION GUARD: it continues to pass after `assertEncodable`'s ancestor-path (add-on-descent/delete-on-ascent) cycle detection landed, proving the algorithm is NOT a global "ever-visited" set (which would have flagged this DAG as circular) | ✅ (continues passing) | n/a — the true-cycle test above is this test's discriminating triangulation pair (same mechanism, opposite outcome) | none needed |
| S-002.3 | (implementation task — `assertEncodable`/`rejectOption`/`kindOf` in `src/core/directive-factory.ts`) | — | — | ✅ | — | — |
| S-002.4 | `test/commons/encode-surface-parity.test.ts::a create() call with a non-plain-JSON option value throws the plain Error naming the key — never an AuthoringError, and no directive is ever staged` | integration | passed on first run — S-002.3's `encodeOptions` change is invoked synchronously inside `DirectiveFactory.create()`, which `commons.create()` calls before `session.buffer()`, so the throw already propagated correctly through the full commons→factory chain with no intervening wrap; this test LOCKS IN that path (proving no accidental AuthoringError-wrapping or swallowing exists between `create()` and the factory) rather than driving new code | ✅ (pre-existing, given S-002.3) | n/a | none needed |
| S-002.5 | `test/skeleton/error-attribution.test.ts::REQ-14.3 — unrepresentable-content (round-trip-drop): reason set, verb/path undefined, appliedCount 0` | integration | AFTER S-002.3 landed, this PRE-EXISTING Stage-2 test broke exactly as design §4.2d predicted: `expect(caught).toBeInstanceOf(AuthoringError)` failed because the function-valued option now throws a plain Error at scheduling (never reaching the flush-time guard) | ✅ (reconciled: fixture trigger swapped `{fn: () => {}}` → `{ratio: 0/0}`; all 4 assertion values — reason/verb/path/appliedCount — unchanged, exactly per §4.2d) | n/a — reconcile, not new coverage | none needed |

**Triangulation note (S-002.1, TOE-04.1/.2/.8)**: the undefined/function/symbol REJECT branches in `assertEncodable` are separate `typeof`/`===` checks (not one combined predicate), so each scenario (04.1 top-level undefined, 04.2 nested undefined, 04.8 nested function/symbol) individually forces its own check to exist — collectively they triangulate the "any non-plain-JSON type, at any nesting depth" class `assertEncodable`'s recursion + per-type dispatch generalizes to.

**Double-loop TDD note**: S-002's outer-loop proof is `test/commons/encode-surface-parity.test.ts`'s new REQ-TOE-04 integration test (S-002.4) — it exercises the full `create()` → `DirectiveFactory` → `encodeOptions` → `assertEncodable` chain, confirming the scheduling-time reject reaches the real author-facing surface, not just the unit-level `encodeOptions` function.

### Files Touched

| File | Action | What |
|---|---|---|
| `src/core/directive-factory.ts` | Modified | Added `kindOf`, `rejectOption`, `assertEncodable` (recursive, ancestor-path cycle detection); `encodeOptions` now calls `assertEncodable(value, key)` per top-level entry before encoding/passthrough |
| `test/core/encode-options.test.ts` | Modified | Added REQ-TOE-04.1–.8 (8 tests) + the shared-ref-DAG non-false-positive regression guard (1 test) |
| `test/commons/encode-surface-parity.test.ts` | Modified | Added REQ-TOE-04 integration test (rejection surfaces at `create()` scheduling, nothing staged) |
| `test/skeleton/error-attribution.test.ts` | Modified | REQ-14.3 fixture reconciled per design §4.2d: `{fn: () => {}}` → `{ratio: 0 / 0}`; dropped the now-unused `JsonValue` import |
| `test/fake/harness-result.test.ts` | Modified (deviation — not in the slice's pinned File Map) | REQ-ATH-09.1 hit the identical ADR-03 shadow; reconciled with the same pattern; dropped the now-unused `JsonValue` import (kept `Batch`) |
| `test/fake/harness-leak-scan.test.ts` | Modified (deviation — not in the slice's pinned File Map) | REQ-ATH-12.1's `unrepresentable-content` case hit the identical shadow; reconciled with the same pattern; dropped the now-unused `JsonValue` import |

### Deviations from Design

- **Scope grew beyond §4.2d's pinned file list.** Design §4.2d and slices.md's S-002.5 task named exactly ONE file to reconcile (`test/skeleton/error-attribution.test.ts`). After landing S-002.3, running the FULL suite (mandatory end-of-slice safety net) surfaced two MORE pre-existing tests broken by the identical, already-documented shadow (ADR-03's Consequence: "the scheduling-time plain-`Error` SHADOWS Stage-2's structured `unrepresentable-content` `AuthoringError` for function/BigInt/symbol values in create-options"): `test/fake/harness-result.test.ts` (REQ-ATH-09.1) and `test/fake/harness-leak-scan.test.ts` (REQ-ATH-12.1's unrepresentable-content case). Both used the exact same `options: { fn: () => {} } as unknown as JsonValue }` fixture pattern REQ-14.3 used. I searched the full `test/` tree for this pattern (`rg "fn: \(\) => \{\}"`) to make sure no further instances were missed — one more match exists (`test/fitness/fit-05-serializable-bytes.test.ts`) but it constructs a raw `Directive` WIRE LITERAL fed directly to `isSerializable()`, never through `create()`/`encodeOptions`, so it is NOT shadowed and was left untouched (confirmed still green).
  I reconciled both newly-found tests using the IDENTICAL sanctioned pattern §4.2d already approved for REQ-14.3 (swap the function trigger for a top-level non-finite number; every assertion value unchanged) rather than halting, because: (a) the root cause and fix are already fully documented and pre-approved by ADR-03/§4.2d — this is completing that reconciliation's intent, not inventing new design; (b) leaving 2 known-broken pre-existing tests at the end of a slice violates the strict-tdd safety-net contract for S-003's Phase 0; (c) the fix is mechanical and narrowly scoped (one line + one import per file, zero behavior/assertion changes). Flagging prominently here and in `slices.md` per the "no silent deviation" rule — the orchestrator/verify-in-loop should be aware this slice touched 2 files outside its pinned File Map.
- No other deviations. Task order matched the slice's listed numbering (S-002.1 → S-002.5, with the two extra reconciles folded into S-002.5's scope since they're the same task in substance).

### Risks

- The `AuthoringError`-parity followup (already registered at design time, §Followups) becomes slightly more consequential given this run found 3 total shadowed call sites (not 1) — restoring structured attribution to the scheduling-time reject will need to re-touch all 3 files' assertions (`toBeInstanceOf(AuthoringError)` → whatever the eventual scheduling-time error type becomes), not just the one design originally scoped. Worth a note when that followup is picked up.
- None for the S-002.3 production change itself: `assertEncodable`'s ancestor-path cycle detection and per-type rejection are additive to the encode path and only REJECT values that previously either silently dropped/coerced (a correctness bug) or threw a raw, unfriendly `TypeError` — no previously-valid encode (string/number/boolean/null/plain-array/plain-object, including shared non-cyclic references) is affected, proven by the shared-ref-DAG regression guard.

### Verification

- `bun test test/core/encode-options.test.ts test/commons/encode-surface-parity.test.ts test/golden-ir/golden-ir.test.ts test/skeleton/error-attribution.test.ts test/fake/boundary-pass-through.test.ts` — 61 pass / 0 fail
- `bun run typecheck` — clean, no errors
- `bun test` (full suite) — 1884 pass / 0 fail (up from 1874 after S-001; +10 new tests, net of the 3 reconciled pre-existing tests whose trigger changed but count stayed the same)

### Next Recommended

Both S-001 and S-002 are complete (this run's full scope). S-003 (cross-surface consistency, fit-39, docs) is next per Build Order — requires both S-001 and S-002, now satisfied. Recommend in-loop verify on this S-001+S-002 batch before S-003 starts, per the orchestrator's GAN-loop cadence — especially given the deviation above (2 files reconciled outside the pinned File Map) warrants explicit sign-off.
