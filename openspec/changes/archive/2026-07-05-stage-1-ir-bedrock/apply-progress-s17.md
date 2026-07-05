# Apply Progress — S-1.7 (JSON round-trip fidelity + paths verbatim + conflict order)

**Change**: stage-1-ir-bedrock · **Slice**: S-1.7 · **Mode**: Strict TDD
**Status**: complete

## Executive Summary

Implemented `boundary` REQ-01/02 at `ContractFake#emit`: a JSON round-trip fidelity check
that structurally compares the round-tripped batch against the original, rejecting both
the silent-drop family (function/undefined/Symbol values, which `JSON.stringify` omits or
nulls without complaint) and the stringify-throw family (BigInt/circular references, which
make `JSON.stringify` itself throw). REQ-03 (path-verbatim) and REQ-04 (array-order
conflicts) needed no code change — both pinned as characterization rows against the
pre-existing fake behavior, proving the new round-trip/cap logic does not regress them.
All 4 slice tasks complete.

## Integration Notes (ordering choice in `contract-fake.ts` `emit`)

Design row 1.3 (file-changes table) orders the three checks: **(a)** move fail-closed +
self-move identity → **(b)** cap check (S-1.4) → **(c)** round-trip compare (S-1.7). I
preserved that check ORDER but merged the underlying `JSON.stringify(batch)` call that (b)
and (c) each conceptually need into a single guarded call, for a correctness reason, not
just tidiness:

The S-1.4 cap check computed `Buffer.byteLength(JSON.stringify(batch), "utf8")`
**unguarded**. A batch containing a BigInt or a circular reference makes that bare
`JSON.stringify` throw synchronously — inside an `async` method this becomes an unhandled
promise rejection with the RAW engine message (e.g. `"JSON.stringify cannot serialize
BigInt."`), not a `ContractFake:`-prefixed rejection. That is exactly the crash REQ-02.3
requires the fake to prevent ("the fake surfaces this as an `emit` rejection, not an
uncaught crash"). So the cap check's own stringify call had to move inside the try/catch
that the round-trip check needs anyway — there is no way to "measure size first, round-trip
second" when measuring size requires a successful stringify in the first place.

Concretely, `emit()` now reads: try `JSON.stringify(batch)` once (catch → stringify-throw
rejection) → cap check on the resulting byte length (unchanged threshold/message) → parse
that same serialized string and `deepEqual` it against the original batch (mismatch →
round-trip rejection) → apply directives in array order (unchanged). Test-observable
ordering is unaffected: no scenario in the spec combines an over-cap batch with a
BigInt/circular value, so cap-vs-round-trip precedence between those two families is never
exercised. Everything downstream of the shared stringify (cap byte count, round-trip parse)
behaves identically to two separate calls would have — this is a shared-computation
optimization, not a behavior change.

## Files Changed

| File | Action | What was done |
|---|---|---|
| `test/support/contract-fake.ts` | Modified | Added module-level `deepEqual(a, b)` (structural equality: arrays compared element-wise by length+recursion, objects by `Object.keys` length+membership+recursion, primitives by `===`) — needed because JSON round-tripping SILENTLY drops keys/nulls elements rather than producing an unequal-but-comparable value. Rewired `emit()`: `JSON.stringify(batch)` now runs once inside a try/catch (stringify-throw family → `ContractFake: batch failed JSON serialization: "<msg>"`); the existing cap check reuses that serialized string (unchanged behavior/threshold); a new `deepEqual(batch, JSON.parse(serialized))` check follows (mismatch → `ContractFake: batch failed round-trip fidelity check: non-JSON-safe value detected`) |
| `test/fake/boundary-pass-through.test.ts` | Created | REQ-01.1 (clean round-trip applies), REQ-02.1 (function value rejects), REQ-02.2 (undefined + Symbol reject, silent-drop family, 2 scenarios), REQ-02.3 (BigInt + circular reject, stringify-throw family, 2 scenarios), REQ-03.1 (odd path `"../escaped.ts"` crosses the seam verbatim — factory + `emit` spy + committed-tree read), REQ-04.1/.2 (`[create X, delete X]` → absent; `[delete X, create X]` → present) |

## REQ Coverage

| REQ-ID | Test | State |
|---|---|---|
| boundary REQ-01.1 (clean round-trip applies) | `test/fake/boundary-pass-through.test.ts` | ✅ green (false-rejection guard — proves the new check doesn't reject valid batches) |
| boundary REQ-02.1 (function value rejects) | `test/fake/boundary-pass-through.test.ts` | ✅ green (RED→GREEN driven) |
| boundary REQ-02.2 (undefined + Symbol reject) | `test/fake/boundary-pass-through.test.ts` | ✅ green (RED→GREEN driven, 2 scenarios) |
| boundary REQ-02.3 (BigInt + circular reject) | `test/fake/boundary-pass-through.test.ts` | ✅ green (RED→GREEN driven, 2 scenarios) |
| boundary REQ-03.1 (path verbatim) | `test/fake/boundary-pass-through.test.ts` | ✅ green (characterization — zero production change to path handling) |
| boundary REQ-04.1 (`[create X, delete X]` → absent) | `test/fake/boundary-pass-through.test.ts` | ✅ green (characterization) |
| boundary REQ-04.2 (`[delete X, create X]` → present) | `test/fake/boundary-pass-through.test.ts` | ✅ green (characterization) |

## TDD Cycle Evidence — S-1.7

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| round-trip compare (silent-drop) | `boundary-pass-through.test.ts::REQ-02.1 ... function value` | integration | `Expected promise that rejects, Received promise that resolved` | ✅ | 3 cases (function, undefined, Symbol) cover the silent-drop family's distinct JS mechanisms | none needed |
| round-trip compare (silent-drop) | `boundary-pass-through.test.ts::REQ-02.2 ... undefined` / `...Symbol` | integration | same (resolved instead of rejected) | ✅ | see above | none needed |
| stringify-throw guard | `boundary-pass-through.test.ts::REQ-02.3 ... BigInt` / `...circular` | integration | message mismatch — raw engine message (`"JSON.stringify cannot serialize BigInt."` / `"...cyclic structures."`) instead of the `ContractFake:`-prefixed rejection | ✅ | 2 cases (BigInt, circular) cover the throw family's two distinct triggers | none needed |
| false-rejection guard | `boundary-pass-through.test.ts::REQ-01.1` | integration | n/a — written to PASS immediately once GREEN lands (guards against an over-eager check rejecting valid input); ran red-with-the-file before GREEN existed, confirmed it fails for the same underlying reason (no round-trip check yet cannot "wrongly reject", so this row's value is post-GREEN regression coverage) | ✅ | n/a — single representative shape (object + array + primitives) | none needed |
| characterization pins | `boundary-pass-through.test.ts::REQ-03.1`, `REQ-04.1`, `REQ-04.2` | integration | not RED — pins of pre-existing behavior per spec's RED posture (characterization/RED-waived); ran once GREEN landed to confirm no regression | ✅ (unchanged) | n/a — prove+freeze, not new behavior | none needed |

**Note on REQ-03.1's first failed run**: the initial test used `fake.read("../escaped.ts")`
after `run()` completed, which returned `undefined` — not a round-trip regression but a
fixture-correctness mistake: ADR-01's `read()` binds exclusively to the staging tree
(`#tree`), and a completed `run()` has already called `commit()`, which moves staged content
into `#committed` and clears `#tree`. Fixed by asserting via `fake.committedTree().get(...)`
instead (matching the existing pattern in `test/skeleton/write-only-factory.test.ts`), with
zero production changes — a fixture fix, not a GREEN-phase code change.

## Deviations From Design

None beyond the shared-`JSON.stringify` merge documented above under Integration Notes,
which is an implementation-efficiency/correctness detail, not a semantic deviation — the
design's three-phase check ORDER (fail-closed → cap → round-trip) is preserved exactly as
specified; only the underlying serialization call is shared rather than duplicated.

Per slices.md's own deviation note #2, REQ-FAKE-07 (modify-existence) was already
implemented in S-1.3 and is NOT re-touched here — S-1.7's "part (c)" scope is the round-trip
compare only.

## Post-Slice Audit (code-audit.md, mode: slice)

Ran Group 1 (REQ-01.1, REQ-02.1–.3, REQ-03.1, REQ-04.1–.2), Group 2, Group 3 against this
slice's diff. No `Bug`, `Architecture`, or `MAJOR` findings:
- Group 1: all 7 REQ-IDs (boundary spec) trace to `specs/boundary-pass-through/spec.md`;
  each has both implementing/pinning code and an asserting test.
- Group 2: no new cross-layer imports — `contract-fake.ts` already imports `Batch`/`Directive`
  from `src/core/wire.ts`; `deepEqual` is a private module-level pure function, no new
  dependency. Round-trip/cap logic stays entirely inside the fake (ADR-0018-consistent — the
  SDK carries none of this judgment). No sensitive area touched.
- Group 3: no untyped casts in production code (`deepEqual`'s `as Record<string, unknown>`
  casts are internal to a 12-line pure helper, guarded by the preceding `typeof === "object"`
  checks); the test file's `unsafeOptions` cast is the deliberate, spec-mandated "smuggled
  past `JsonValue` via `any`" mechanism, not an accidental escape hatch. No dead code, no new
  TODO/deferred markers.

## Verification

- `bun test test/fake/boundary-pass-through.test.ts` → 9 pass, 0 fail
- `bun test` (full suite) → 232 pass, 0 fail
- `bunx tsc --noEmit` → clean, no output

## Risks

None identified. The `deepEqual` helper is scoped to the fake (test support), not shipped
production code — no semver/API surface exposure. The merged-stringify implementation choice
is called out explicitly above should a reviewer want to re-split it; functionally
equivalent either way for every scenario the spec defines.

## Skill Resolution

`fallback-registry` — no `## Project Standards (auto-resolved)` compact-rule block was
present beyond the brief inline TypeScript/Bun/Strict-TDD note in the launch prompt;
proceeded using the codebase's own established conventions (`test/fake/*.test.ts` literal
Batch/Directive builders per `move-fail-closed.test.ts`/`modify-existence.test.ts`, the
`defineFactory` + `spyOn(fake, "emit")` pattern per `write-only-factory.test.ts`/
`batch-cap.test.ts`) as the pattern source, read directly from sibling files.
