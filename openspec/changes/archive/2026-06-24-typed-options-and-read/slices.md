# Slices: typed-options-and-read (#2 of l1-author-surface)

**Triage**: L · **Strict TDD**: enabled · **Walking skeleton**: not needed (program skeleton = #1; #2 grows working slots)
**Slice count**: 5 · **Two independent tracks**: OPTIONS (S-01→S-02→S-03) and READ (S-04→S-05). Linear apply
order below; the tracks share no files so a fence break in one cannot mask the other.

---

## S-01 — typed-options positive matrix (CHARACTERIZATION — REFRAMED 2026-06-22)
**Covers**: REQ-01.1, REQ-01.3, REQ-01.4, REQ-01.5
**Files**: `test/types/typed-create.test.ts` ONLY (NO source change — the skeleton's homomorphic
`{ [K in keyof S]: S[K] }` map already enforces the full contract; verified at apply via standalone tsc).
**No `OptionsOf<S>`** — it was found to be a structural no-op (design A4.1, corrected).

**Characterization (Strict-TDD RED waived — behaviour already exists)**:
1. Add `expect-type` POSITIVES to `typed-create.test.ts`: multi-field all-required present (REQ-01.4,
   triangulation — proves the map covers `keyof S`), optional-key-omitted compiles (REQ-01.5, proves the
   homomorphic map preserves `?`), keep single-field (REQ-01.1) + untyped-backward-compat (REQ-01.3). These
   go GREEN immediately — their VALUE is locking the contract before the L1 freeze.
2. VERIFY — `bunx tsc --noEmit` exit 0; `bun test` green; FIT-01 green; the `create<S>` overload type is
   UNCHANGED (no new aliases, no `OptionsOf<S>`, no new import).

## S-02 — typed-options negative matrix (permissive-proof)
**Covers**: REQ-01.2 (existing, kept), REQ-01.6, REQ-01.7
**Files**: `test/types/permissive-proof.ts`

**Characterization (the negatives are ALREADY real errors against the homomorphic map)**:
1. Add `@ts-expect-error` negatives: missing-required key (REQ-01.6 → TS2741), wrong-type value
   (REQ-01.7 → TS2322). Keep the existing excess case (REQ-01.2 → TS2353). Each is an Idiom-2 USED
   directive (suppresses a REAL error) FROM THE START — no S-01 dependency, because the homomorphic map
   already enforces. (If any directive is UNUSED → the map regressed → investigate.)
2. VERIFY — `bunx tsc --noEmit -p tsconfig.permissive-proof.json --pretty false`: the new directives are
   USED (no TS2578 on their lines). Removing a `@ts-expect-error` surfaces the real error.

## S-03 — CI permissive-proof guard (REQ-03)
**Covers**: REQ-03.1, REQ-03.2
**Files**: `test/types/permissive-proof.guard.test.ts` (create), `.github/workflows/ci.yml` (delete the inverted-exit "Permissive-proof (must fail)" step), `package.json` (keep `typecheck:permissive-proof` as dev convenience; `tsconfig.permissive-proof.json` include scope decided here)
**Depends on**: S-02 (the diagnostics the guard asserts)

**TDD**:
1. RED — write `permissive-proof.guard.test.ts`: `spawnSync` `tsc --noEmit -p tsconfig.permissive-proof.json --pretty false`, parse `file(line,col): error TSxxxx`, assert expected TS2578 PRESENT on Idiom-1 line(s) + ABSENT on Idiom-2 lines (excess/missing-required/wrong-type) matched by scanning the source for `@ts-expect-error` markers (NOT hard-coded line numbers), and REJECT any non-expected `src/**` error code. Add the REQ-03 `[red-proof]`: feed the parser a SIMULATED regressed-diagnostic blob (excess now legal → TS2578 appears on the excess line) and assert the guard REJECTS it (REQ-03.1); feed an unrelated-error blob and assert it is NOT counted as the proof passing (REQ-03.2). Guard test fails before it exists.
2. GREEN — implement the guard; DELETE the `ci.yml` inverted-exit step (the guard under `bun test` subsumes it).
3. VERIFY — `bun test` green; the `[red-proof]` simulated-regression blob (a negative `@ts-expect-error` gone UNUSED, e.g. the `create<S>` options type relaxed to accept excess) makes the guard REJECT.

## S-04 — read trichotomy: port + fake (contract level) [RISKIEST]
**Covers**: REQ-RD-01.1, REQ-RD-01.2, REQ-RD-01.3, REQ-RD-01.4, REQ-RD-01.5, REQ-RD-02.1, REQ-RD-03.2
**Files**: `src/core/engine-client.ts` (port: `read(path): Promise<string | undefined>` + header comment), `test/support/contract-fake.ts` (the two `throw …path not found…` sites → `return undefined`, absence by KEY MEMBERSHIP), `test/fake/read-trichotomy.test.ts` (create)

**TDD**:
1. RED — write `read-trichotomy.test.ts` driving the fake: content `=== "<exact>"` (RD-01.1); not-found `toBeUndefined()` strict, NO throw (RD-01.2 + RD-02.1); empty `=== ""` AND `!== undefined` (RD-01.3); whitespace `"   \n"` preserved verbatim (RD-01.4); falsy-strings `"0"`/`"false"` each `=== "<literal>"` (RD-01.5, mutant-killers); seeded `""`→`""` vs absent→`undefined` by membership (RD-03.2). All RED — the fake throws on not-found today.
2. GREEN — change `EngineClient.read` port signature to `Promise<string | undefined>`; `ContractFake.read` two throw sites → `return undefined`, detecting absence via `#deleted.has` / `!#tree.has` / `!(in #seed)` — NEVER truthiness; found paths (incl. `""`) return the stored string verbatim.
3. VERIFY — `read-trichotomy.test.ts` green; NO `||`/`??` at the not-found mapping; strict `toBeUndefined()`/`=== ""` assertions (never `toBeFalsy`).

## S-05 — read end-to-end through Session + handle + #1 fence + dts regen + `@example`
**Covers**: REQ-RD-01.6, REQ-RD-03.1
**Files**: `src/core/session.ts` (`Session.read` return → `Promise<string | undefined>`, NO catch/coalesce), `src/core/base-handle.ts` (`ReadOps.read` → `Promise<string | undefined>`), `src/commons/index.ts` (handle bodies ride the type; `find`/handle `@example` shows `=== undefined` trichotomy — FIT-06), `test/skeleton/read-trichotomy.test.ts` (create — integration), `test/fitness/dts-baseline/core.base-handle.d.ts` (regen; `commons.index.d.ts` / `core.handle-state.d.ts` regen IF diff), plus #1 read-consumer sites (apply-verify)
**Depends on**: S-04 (the port/fake contract)

**TDD**:
1. RED — write integration `test/skeleton/read-trichotomy.test.ts`: `find(p).read()` through a REAL `Session` + UNMOCKED fake, asserting the three branches `if (c === undefined) … else if (c === "") … else …` each reachable + hit by its fixture (RD-01.6, cross-boundary, no mock on read).
2. GREEN — widen `Session.read` (body unchanged: `await this.flush(); return this.#client.read(path)`), `ReadOps.read`, handle bodies; update the `@example` to the `=== undefined` trichotomy. Then `tsc` — **enumerate the REAL #1 breaks** (HYPOTHESIS, apply-verify per design): read-consumers asserting a throw on not-found become `=== undefined` (deliberate behavioural reversal); `EngineClient` stubs/spies widen their `read` return; any `: string` annotation on a read result is HANDLED (guarded `if`), **never** cast `as string`. Fix each.
3. GREEN(dts) — `bun run build`; regen `test/fitness/dts-baseline/core.base-handle.d.ts` to `read(): Promise<string | undefined>`; regen `commons.index.d.ts`/`core.handle-state.d.ts` ONLY if they actually diff. FIT-04 green against the regenerated baseline (RD-03.1) = the intentional-freeze proof.
4. VERIFY — full `bun test` green; `tsc` exit 0; FIT-01/FIT-04/FIT-06 green; grep the diff for `as string` at read sites (must be NONE).

---

## ADR ownership (not a slice deliverable)
The read-signature ADR (in_scope) is ALREADY AUTHORED as **ADR-01** in `design.md` ("Read signature
freeze: async ratifies 0001 + nullable `undefined`"). No slice authors it; S-05 merely IMPLEMENTS the
frozen signature. (Resolves the plan-verify Judge-A scope note, a false-positive from Judge A's blindness
to the design artefact.)

## Executor Contracts Reference (pins — do not deviate without halting)
- **Typed options = PROVE + FREEZE the existing homomorphic map** `{ [K in keyof S]: S[K] }` (skeleton's; verified to already enforce required/optional/type/excess). NO `OptionsOf<S>` (structural no-op). NO source change to the `create<S>` overload. Proofs assert at the CALL SITE. Strict-TDD RED waived for the characterization matrix (behaviour pre-exists). NOT Framing B (schema-descriptor projection).
- **Read not-found contract lives ON THE PORT.** `EngineClient.read: Promise<string | undefined>`; fake + real STOP throwing on not-found and return `undefined`. `Session.read` does NOT catch and does NOT coalesce (no `||`, no `??`). Genuine read failures (permission/transport) stay throws → #3. The fake detects absence by KEY MEMBERSHIP, never truthiness; seeded `""` returns `""`.
- **FENCE VIOLATIONS — hard ban (integration gate #2 greps for these):**
  - `as string` casts at any read site — re-merge `undefined` into `string`, DEFEAT the contract. A widening type error must be HANDLED, never cast away.
  - `||` / `??` coalescing at the not-found mapping — merges `""`/`"0"`/`"false"` into `undefined`.
- **The Fake Migration "#1 breaks" list is a HYPOTHESIS** (lesson from #1). Enumerate the REAL breaks at apply time via `tsc` + `bun test`; do not pre-assert. A throw-on-not-found assertion flipping to `=== undefined` is a deliberate behavioural reversal, tracked explicitly, not a regression.
- **CI guard pins by ERROR CODE + directive region**, never bare exit-code; the `ci.yml` inverted-exit step is DELETED (subsumed by the `bun test` guard).
- **dts baseline regen is the intentional-freeze proof** — regen `core.base-handle.d.ts`; regen the others ONLY if they diff post-build (apply-verify).
- **Regression fence**: #1's union suite stays green (`tsc` exit 0 + full `bun test`); FIT-01 (commons-no-AST) stays green as the runtime-schema-read-drift guard.
