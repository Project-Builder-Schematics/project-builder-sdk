# Slices: L1 Author Surface — Walking Skeleton

**Triage**: M
**Spec version**: V1 (signed)
**Total slices**: 3 (1 walking skeleton + 2 SPIDR)

---

## S-000: Walking Skeleton — Thread All Four Seams End-to-End

**Scope**: walking-skeleton
**Dimension**: —
**Covers**: REQ-01.1, REQ-01.2, REQ-01.3, REQ-02.1, REQ-02.2, REQ-06.1, REQ-07.1, REQ-07.3, REQ-10.1, REQ-11.1, REQ-11.2, REQ-12.1, REQ-12.2, REQ-13.1
**Requires**: nothing
**Test layers**: type-level + integration (cross-boundary, fake unmocked both sides)

**Acceptance**:
- GIVEN a `ContractFake` with no seed, a typed `create<S>` call (one schema field), the attribution wrap active, and the commit/discard contract in place
- WHEN a `defineFactory`-wrapped factory runs to completion
- THEN the committed tree contains the created path (all four seams real: overload → buffer → commit/discard → attribution wrap active)
- AND forcing a collision rejects with `AuthoringError{verb:"create",path}`, committed tree empty, no engine text in the error

### Strict TDD ordering (tests before implementation, in this sequence)

1. **S-000.1** Write the type-level proofs (failing): (a) `test/types/typed-create.test.ts` — `expect-type` POSITIVE proof `create<S>` compiles (REQ-01.1) + untyped backward-compat case (REQ-01.3); (b) `test/types/permissive-proof.ts` — add the excess-field NEGATIVE proof case (REQ-01.2): `create<{name:string}>(…, { template, options: { name:"x", extra:1 } })` MUST be a compile error (excess-property check on the mapped type). The permissive-proof file runs under `tsconfig.permissive-proof.json` (exit-2-as-success; CI inverts) — follow the existing pattern in that file. Run — positive proofs fail (no overload yet); the negative proof is not yet a compile error (no narrowing yet). REQ-01.2 is the single excess-field proof of the THIN overload (proving the narrowing actually narrows); the full-derivation negative matrix is out-of-scope (#2).
2. **S-000.2** Write `test/skeleton/commit-discard.test.ts` (failing): skeleton success case — one `create<S>` in a write-only factory, committed tree contains the path (REQ-06.1, REQ-02.1, REQ-02.2). Run — fails (no `#committed`, no `commit()`).
3. **S-000.3** Write `test/skeleton/error-attribution.test.ts` (failing, unmocked both sides): forced-collision → `AuthoringError{verb,path}`, no `ContractFake:`/`OpMove` text, committed empty (REQ-10.1, REQ-11.1, REQ-11.2, REQ-12.1, REQ-12.2, REQ-13.1). Run — fails (no `AuthoringError`, no attribution wrap).
4. **S-000.4** Reverse the assertion in `test/skeleton/write-only-factory.test.ts` lines 40-51: throwing factory MUST leave committed tree empty (was: `src/partial.ts` readable). This is the obs-648 deliberate contract flip — edit before any source changes so the suite is intentionally red for the old contract.
5. **S-000.5** Implement: `src/core/authoring-error.ts` — `AuthoringError` class + `toAuthoringError` translate (REQ-10, REQ-11, REQ-12).
6. **S-000.6** Implement: grow the `EngineClient` port in `src/core/engine-client.ts` — add `commit(): Promise<void>` and `discard(): Promise<void>` (ADDITIVE; `emit`/`read` unchanged). THEN grow `test/support/contract-fake.ts` to implement them — add `#committed`, `async commit()`, `async discard()`, `committedTree()` (test-only). `read()` stays on `#tree` (staging). (Port first so the fake's new members satisfy the interface and `defineFactory`'s `client.commit()` typechecks.) **Gap-#1 pin — hand-rolled-literal sweep**: growing the port with REQUIRED `commit`/`discard` breaks EVERY hand-rolled `EngineClient` literal in the suite that implements only `emit`/`read`. Sweep ALL of them so the suite still typechecks — port stays REQUIRED, do NOT weaken to optional (`commit?`/`discard?` would make `session.commit()`'s `#client.commit()` call silently skippable — unsound): (1) `test/skeleton/session.test.ts` — `makeOrderedClient` literal (~L18) + inline literal (~L45); (2) `test/skeleton/read-your-own-write.test.ts` — `observeCallOrder` wrapper (~L16); (3) `test/skeleton/handle-chaining.test.ts` — `makeSpy` literal (~L21). WRAPPERS holding an inner `EngineClient` (`observeCallOrder`, and `makeSpy` if it wraps) FORWARD `commit`/`discard` to the inner client; STANDALONE literals get no-op `async commit() {}` / `async discard() {}` stubs. After the sweep, all existing tests stay green.
7. **S-000.7** Implement: modify `src/core/session.ts` — attribution wrap at `flush()` emit call site; add `pendingSnapshot()`; add `commit()`/`discard()` thin wrappers delegating to `#client`.
8. **S-000.8** Implement: modify `src/core/context.ts` — replace `try/finally` with `try { run; flush; commit } catch { discard; throw }` (final flush INSIDE the try; commit-on-success / discard-on-throw via `session.commit()`/`session.discard()`); reword JSDoc to all-or-nothing (REQ-09 satisfied here, verified in S-001); add `create<S>` generic overload in `src/commons/index.ts` with the bare inline mapped type `{ [K in keyof S]: S[K] }` (type-level only, runtime unchanged, NO `OptionsOf<S>` helper). Run full suite — all tests green.

---

## S-001: ContractFake Commit/Discard Modelled in Isolation

**Scope**: edge-case
**Dimension**: R (Rule)
**Covers**: REQ-06.2, REQ-07.2, REQ-08.1, REQ-08.2, REQ-08.3, REQ-09.1
**Requires**: S-000
**Test layers**: unit (fake) + integration + architectural (JSDoc source-scan)

**Acceptance**:
- GIVEN a `ContractFake` whose staging tree is populated via multiple `emit` calls
- WHEN `commit()` is called once
- THEN the committed tree contains every staged entry and the staging tree is empty
- AND calling `discard()` instead would leave the committed tree untouched

### Strict TDD ordering

1. **S-001.1** Write `test/fake/commit-discard.test.ts` (failing): `commit()` promotes staging → committed + clears staging (REQ-08.1); `discard()` clears staging, committed untouched (REQ-08.2); committed independent after re-stage + discard (REQ-08.3). Run — these are isolated fake-unit scenarios; new test file even though the fake was grown in S-000.
2. **S-001.2** Extend `test/skeleton/commit-discard.test.ts` with multi-directive and discard cases: two `create`+`modify` directives committed in order (REQ-06.2); factory buffering two directives before throw commits nothing (REQ-07.2); source-scan of `context.ts` JSDoc — no partial-write sentence (REQ-09.1). Run — verify all pass (implementation from S-000.8 should cover these; confirm no gaps).
3. **S-001.3** If any edge case from S-001.2 is red, harden `src/core/context.ts` only. No new source files otherwise. Run full suite — all green.

## S-001 Progress

Strict TDD. Implementation from S-000 satisfied all REQ-08/06.2/07.2/09.1 — tests confirm existing behaviour (no S-001.3 needed).

- [x] **S-001.1** — `test/fake/commit-discard.test.ts`: 3 fake-unit tests (REQ-08.1/08.2/08.3). Passed immediately; S-000.6 already implemented commit/discard/committedTree/stagingTree correctly. Confirmed as regression coverage.
- [x] **S-001.2** — Extended `test/skeleton/commit-discard.test.ts`: REQ-06.2 (multi-directive commit), REQ-07.2 (throw-after-buffer commits nothing), REQ-09.1 (JSDoc source-scan — no partial-write sentence). All passed (S-000.8 already correct). Added `modify` import + `readFileSync` for JSDoc scan.
- [x] **S-001.3** — NOT NEEDED. No S-001.2 case was red. Full suite: 159 pass / 0 fail. Typecheck: exit 0.

---

## S-002: Dry-Run Renderer + AST-Blindness Fitness Guard

**Scope**: happy-path
**Dimension**: I (Interface)
**Covers**: REQ-03.1, REQ-03.2, REQ-04.1, REQ-04.2, REQ-04.3, REQ-05.1
**Requires**: S-000
**Test layers**: unit + integration + architectural (import-graph scan)

**Acceptance**:
- GIVEN a `Session` with two directives buffered and a snapshot obtained before a third is added
- WHEN `dryRunPlan(snapshot)` is called
- THEN the snapshot still contains only the original two entries, and the plan entries carry correct author-vocabulary `verb` + `path` for all six op kinds
- AND the renderer module's import graph contains no `src/core/**` runtime reference

### Strict TDD ordering

1. **S-002.1** Extend `test/skeleton/session.test.ts` (failing): `pendingSnapshot()` reflects two buffered directives in order (REQ-03.1); snapshot isolated from later buffer mutation (REQ-03.2). Run — fails (`pendingSnapshot()` wired in S-000.7 but these specific cases need test coverage).
2. **S-002.2** Write `test/dry-run/plan.test.ts` (failing): create op → `{verb:"create",path:"src/foo.ts"}` (REQ-04.1); all six ops mapped correctly (REQ-04.2); snapshot from real `Session` → plan equals buffered directives for write-only chain (REQ-04.3). Run — fails (no `src/dry-run/plan.ts` yet).
3. **S-002.3** Write `test/dry-run/no-import.test.ts` (failing): import-graph scan of `src/dry-run/**` — no `src/core/**` runtime, no AST package (REQ-05.1). Run — fails (module does not exist yet).
4. **S-002.4** Implement: `src/dry-run/plan.ts` — `dryRunPlan(snapshot: Directive[]): DryRunEntry[]`; imports ONLY `type Directive` from `../core/wire.ts`; primary-path extraction per op kind. Implement `src/dry-run/index.ts` — re-export `dryRunPlan` + `DryRunEntry` (NOT added to `package.json#exports`). Run full suite — all green.

## S-002 Progress

Strict TDD. RED→GREEN for plan.ts (stubs → not-implemented → all-six-ops real implementation).

- [x] **S-002.1** — Extended `test/skeleton/session.test.ts`: REQ-03.1 (two buffered directives in order) + REQ-03.2 (snapshot isolated from later mutation). Passed immediately (S-000.7 pendingSnapshot correct). 6 tests total in file.
- [x] **S-002.2** — NEW `test/dry-run/plan.test.ts`: REQ-04.1 (create op mapping), REQ-04.2 (all six ops), REQ-04.3 (integration from real Session). RED: `Cannot find module '../../src/dry-run/index.ts'`. Fixed with stubs → RED: `error: not implemented`. GREEN: implemented real switch/map in plan.ts.
- [x] **S-002.3** — NEW `test/dry-run/no-import.test.ts`: import-graph scan (REQ-05.1). 6 tests (3 real + 3 red-proofs). Constraint confirmed via red-proofs; scan passes because plan.ts has zero runtime core imports.
- [x] **S-002.4** — NEW `src/dry-run/plan.ts`: `dryRunPlan(snapshot: readonly Directive[]): DryRunEntry[]` (type-only import from wire.ts; switch per op; primary-path per design §4.4). NEW `src/dry-run/index.ts`: re-exports dryRunPlan + DryRunEntry. NOT in package.json#exports. Full suite: 170 pass / 0 fail. Typecheck: exit 0.

---

## S-000 Progress

Strict TDD. Each step's RED was observed before its GREEN (evidence in apply-progress).

- [x] **S-000.1** — type-level proofs: `test/types/typed-create.test.ts` (REQ-01.1/.3 positive) + `test/types/permissive-proof.ts` excess-field negative (REQ-01.2). RED: `tsc` TS2558 (no generic param yet).
- [x] **S-000.2** — `test/skeleton/commit-discard.test.ts` success case (REQ-06.1/02.1/02.2). RED: `committedTree is not a function`.
- [x] **S-000.3** — `test/skeleton/error-attribution.test.ts` forced-collision cross-boundary (REQ-10.1/11.1/11.2/12.1/12.2/13.1). RED: `Cannot find module authoring-error.ts`.
- [x] **S-000.4** — flipped `test/skeleton/write-only-factory.test.ts` throw case to committed-empty (obs-648 deliberate contract reversal). Suite intentionally red until S-000.8.
- [x] **S-000.5** — `src/core/authoring-error.ts`: `AuthoringError` + `toAuthoringError` (fresh message, no `.cause`, gap-#2).
- [x] **S-000.6** — grew `EngineClient` port (`commit`/`discard`, REQUIRED, additive); grew `ContractFake` (`#committed`, `commit`/`discard`, `committedTree`/`stagingTree` accessors); hand-rolled-literal sweep (session.test ×2 stub, read-your-own-write + handle-chaining forward to inner). No regressions.
- [x] **S-000.7** — `src/core/session.ts`: attribution wrap at `flush` emit site + `pendingSnapshot()` + `commit()`/`discard()` wrappers.
- [x] **S-000.8** — `src/core/context.ts` `try{run;flush;commit}catch{discard;throw}` (no finally) + all-or-nothing JSDoc; `create<S>` overload in `src/commons/index.ts` (bare inline mapped type, no `OptionsOf<S>`). All gates green: `bun test` 153 pass, `tsc` exit 0, permissive-proof exit 2.

---

## Build Order

| Step | Slice | Notes |
|---|---|---|
| 1 | S-000 | Skeleton — threads all four seams; implicit blocker for S-001 and S-002 |
| 2 | S-001 | Independent of S-002; both buildable in parallel after S-000 |
| 2 | S-002 | Independent of S-001; both buildable in parallel after S-000 |

---

## Distribution

| Scope | Count | Slice IDs |
|---|---|---|
| walking-skeleton | 1 | S-000 |
| happy-path | 1 | S-002 |
| edge-case | 1 | S-001 |
| spike | 0 | — |
| **Total** | **3** | |

## SPIDR Dimensions Used

| Dimension | Count | Slices |
|---|---|---|
| Rule | 1 | S-001 |
| Interface | 1 | S-002 |
| Path / Data / Spike | 0 | — |

---

## Executor Contracts Reference

> Folded from the signed `design.md` + existing codebase so this slices document is self-sufficient for an executor. Full detail lives in `design.md`.

**Seams** (the 4 boundaries S-000 threads; from `program.md`): SEAM-01 typed-options (`create<S>`), SEAM-02 directive buffer (`Session.#pending` snapshot → renderer), SEAM-03 commit/discard (`EngineClient` port grows `commit`/`discard` → `Session.commit`/`discard` wrappers → `defineFactory` try/catch → fake `#committed`), SEAM-04 error-attribution (wrap at `Session.flush` emit). "Real" = both sides use the actual `ContractFake`/`Session`, no mock.

**Six ops** = the `Directive` union in `src/core/wire.ts`: `create` (path), `modify` (path), `delete` (path), `rename` (path→newName), `move` (path→toDir), `copy` (from→to). Primary path per op = the source path (`from` for copy). `verb` in author vocabulary = the op tag.

**EngineClient port** (`src/core/engine-client.ts`, MODIFY — gap-#1 resolution): today the interface has ONLY `emit(batch): Promise<void>` and `read(path): Promise<string>`. ADD two members: `commit(): Promise<void>` and `discard(): Promise<void>`. This is ADDITIVE — `emit`/`read` signatures are untouched. Rationale: the all-or-nothing boundary CANNOT be "don't emit on throw" because `Session.read()` flushes mid-run for read-your-own-writes (directives are already staged before any later throw); the boundary is a transactional **staging → commit/discard** owned by the engine. The SDK declares the port; the fake models it; the real Go client implements it at engine §6. `ContractFake implements EngineClient`, so the fake MUST implement both new members (they are port members, not ad-hoc methods — required for `defineFactory`'s `{ client: EngineClient }` to typecheck the commit call).

**ContractFake** (`test/support/contract-fake.ts`, EXISTS — grow it): today `read(path): Promise<string>` (serves staging tree, read-your-own-writes) + `emit(batch): Promise<void>` (applies eagerly, op-by-op, throws raw `ContractFake: …` on rejection). Constructor takes a seed map. ADD (implementing the grown port): private `#committed` tree, `async commit(): Promise<void>` (promote `#tree` staging → `#committed`, clear staging), `async discard(): Promise<void>` (clear `#tree`, committed untouched), and a TEST-ONLY `committedTree(): ReadonlyMap<string,string>` accessor (NOT on the port). `read()` STAYS bound to `#tree` — existing 148 tests must stay green (none call commit/discard).

**AuthoringError** (`src/core/authoring-error.ts`, NEW): `class AuthoringError extends Error { verb: string; path: string }`. `toAuthoringError(rawError, directive): AuthoringError` — maps an engine/fake error to author vocab using the FAILING directive's verb + primary path; when the engine error is opaque (no op index), attribute to `batch.instructions[0]`. NOT added to `package.json#exports` (seed surface). **Gap-#2 pin — fresh message, NO `.cause` chain**: `toAuthoringError` builds a FRESH author-vocabulary message from verb+path (e.g. `create failed at src/existing.ts`) and DISCARDS the raw engine message. The skeleton's `AuthoringError` does NOT set `.cause` to the raw error and embeds NO raw engine string anywhere — so the no-engine-text guarantee (REQ-11/REQ-12.2/REQ-13.1) holds for the WHOLE error object, not only `.message`. Rich error context (cause chain, original-error access) is deferred to #3 `error-and-commit-contract` where attribution is frozen. The S-000.3 assertion targets BOTH: `error instanceof AuthoringError` with typed `verb`/`path`, AND `.message` does not contain `ContractFake:`/`OpMove` (the whole-object guarantee makes this robust regardless of whether a test walks `.cause`).

**create<S>** (`src/commons/index.ts`, MODIFY — gap-#2 pinned): add a generic overload with the BARE INLINE mapped type (NO named `OptionsOf<S>` helper this change): `create<S>(path, opts: { template: string; options: { [K in keyof S]: S[K] }; force?: boolean }): WritableHandle` narrowing `options` to the schema's keys; the existing untyped `create(path, { template, options: JsonValue, force? })` MUST still compile (backward-compat). Type-level only — runtime/buffered directive unchanged. "Schema `S`" for the skeleton = any object type; the proof uses `{ name: string }` → `options` resolves to `{ name: string }`. The full `OptionsOf<S>` derivation is sub-change #2 (SEAM-01) — do NOT introduce a named alias here.

**Session** (`src/core/session.ts`, MODIFY): buffers `Directive[]` in `#pending`; `flush()` emits the batch via `EngineClient.emit` — wrap THAT call to translate a thrown error via `toAuthoringError` and re-throw (discard still fires downstream). ADD `pendingSnapshot(): readonly Directive[]` — a copy of `#pending` (later mutations must not affect a prior snapshot). ADD `commit(): Promise<void>` and `discard(): Promise<void>` thin wrappers that delegate to `#client.commit()` / `#client.discard()` — Session owns `#client`, so the commit boundary stays inside Session (NOT called from `defineFactory` directly).

**defineFactory / context** (`src/core/context.ts`, EXISTS — MODIFY — gap-#3 control flow): runs the factory in an AsyncLocalStorage run-context. REPLACE the current `try { run } finally { flush }` with NO `finally` — success and failure are distinct paths:
```
try {
  await als.run(ctx, () => fn(o));   // run factory
  await ctx.session.flush();         // emit remaining #pending (inside try — a flush rejection routes to catch)
  await ctx.session.commit();        // success → promote staged → committed
} catch (err) {
  await ctx.session.discard();       // throw OR flush-rejection → drop staged, committed empty
  throw err;                         // re-throw original/attributed error (never swallow)
}
```
"Success" = `fn` resolved AND flush+commit succeeded; "throw" = `fn` threw OR flush rejected. The final flush is INSIDE the try so a forced-rejection at emit (REQ-07.3/REQ-12) skips `commit()` and lands in `catch → discard → re-throw`. The flush rejection is ALREADY an `AuthoringError` (Session.flush wraps emit). Reword the partial-write JSDoc (lines ~29-38) to state all-or-nothing (success commits the full batch; any throw commits nothing).

**Dry-run renderer** (`src/dry-run/plan.ts` + `index.ts`, NEW): `dryRunPlan(snapshot: Directive[]): DryRunEntry[]` where `DryRunEntry = { verb: string; path: string }`. Imports ONLY `type Directive` from `../core/wire.ts` (type-only import is allowed; a runtime import from `src/core/**` or any AST package is FORBIDDEN — that is what REQ-05 scans). "Seed surface" = internal API, reachable by tests via relative import, NOT listed in `package.json#exports`.

**Existing test files to edit**: `test/skeleton/write-only-factory.test.ts` (EXISTS — lines ~40-51 currently assert the OLD partial-write contract: a thrown factory leaves `src/partial.ts` readable; S-000.4 FLIPS this to committed-tree-empty); `test/skeleton/session.test.ts` (EXISTS — extend + gap-#1 literal sweep at ~L18/~L45); `test/skeleton/commit-discard.test.ts` (NEW in S-000.2, extended in S-001.2). **Gap-#1 literal sweep also touches** `test/skeleton/read-your-own-write.test.ts` (`observeCallOrder` ~L16 — forward `commit`/`discard` to inner) and `test/skeleton/handle-chaining.test.ts` (`makeSpy` ~L21 — forward if wrapping, else stub). Read the actual files before editing.

**Tooling**: runner = `bun test`; type assertions = `expect-type` (positive proofs) + `tsconfig.permissive-proof.json` (negative/excess-property proofs, exit-2-as-success — CI inverts); module system = ESM, TS runs directly under Bun (no transpile).

**Product (Judge-B carryover, RESOLVED)**: attribution = engine rejections surfaced to the AUTHOR in their own vocabulary (verb + path), hiding engine internals (`OpMove`/`ContractFake:`) — so an author debugging a failed schematic sees *their* `create("x")`, not engine ops. Collision is ALL-OR-NOTHING (inherited product decision Q3 + REQ-07): a thrown/rejected run commits NOTHING; the partial set lives only in the discarded staging tree — not per-op.
