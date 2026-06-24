# Apply Progress: typed-options-and-read (#2)

**Status**: OPTIONS track complete + READ track applied to the no-build checkpoint. STOPPED before
`bun run build` / dts-baseline regen (user boundary). `tsc` exit 0; `bun test` 187 pass / 1 fail (FIT-04,
build-pending).

## Course correction (apply-time, verified)
The design/explore/spec premise that the skeleton's `create<S>` identity map `{ [K in keyof S]: S[K] }`
needed an `OptionsOf<S>` derivation was FALSE — that map is HOMOMORPHIC, so TS already preserves
optionality/required-ness/per-key types (verified via standalone tsc: missing→TS2741, wrong-type→TS2322,
excess→TS2353, optional-omitted compiles). `OptionsOf<S>` dropped (structural no-op). User reframed
OPTIONS to PROVE + FREEZE the existing contract. See `sdd/typed-options-and-read/apply-gap-homomorphic`
(obs 678) + design §A4.1 (corrected).

## OPTIONS track (S-01/02/03) — characterization + CI guard
- **No production code change** (`git diff src/` = 0). `create<S>` overload type UNCHANGED.
- S-01: positive matrix (REQ-01.1/.3/.4/.5) added to `test/types/typed-create.test.ts` — characterization
  (green immediately; Strict-TDD RED waived, behaviour pre-exists).
- S-02: negative matrix (REQ-01.2/.6/.7) added to `test/types/permissive-proof.ts` — USED `@ts-expect-error`
  directives (verified: removing one surfaces the real TS2741/TS2322).
- S-03: `test/types/permissive-proof.guard.test.ts` (created) — pure parse+assert over `tsc --pretty false`
  diagnostics, pins TS2578 present/absent by code+region (markers scanned, not line numbers), rejects
  unexpected `src/**` codes; `[red-proof]` simulated-regression RED→GREEN. Deleted the inverted-exit
  "Permissive-proof (must fail)" step from `.github/workflows/ci.yml`. `tsconfig.permissive-proof.json`
  left at default `src/**` scope.

## READ track (S-04 + S-05 no-build parts) — signature widening + trichotomy + #1 fence
Signature widened as one tsc-coupled unit (port → Session → ReadOps → handle bodies):
- `src/core/engine-client.ts`: `read → Promise<string | undefined>` (PORT owns not-found, ADR-01).
- `src/core/session.ts`: `Session.read → Promise<string | undefined>`, body unchanged (NO catch, NO `??`/`||`).
- `src/core/base-handle.ts`: `ReadOps.read → Promise<string | undefined>`.
- `src/commons/index.ts`: handle read bodies ride the type; `find` `@example` rewritten to the `=== undefined`
  trichotomy (FIT-06; never `if (!content)`).
- `test/support/contract-fake.ts`: both `throw …path not found` sites → `return undefined`, absence by KEY
  MEMBERSHIP; seeded `""` returns `""`.
- Tests created: `test/fake/read-trichotomy.test.ts` (RD-01.1-.5/02.1/03.2, strict `toBeUndefined`/`=== ""`),
  `test/skeleton/read-trichotomy.test.ts` (RD-01.6 integration, real Session + unmocked fake, branchable).

### #1 regression fence (apply-verified — the design's HYPOTHESIS, enumerated for real)
- 1 mechanical widening: `read-your-own-write.test.ts` `observeCallOrder` stub `read` return widened.
- 6 deliberate behavioural reversals (throw-on-not-found → `=== undefined`): `test/fake/fidelity.test.ts`
  (×2), `test/fake/fidelity-missing-source.test.ts` (×3), `test/skeleton/contract-fake.test.ts` (×1) —
  the THROW→undefined contract change ADR-01 anticipated; test names updated.
- 3 type-assertion reversals: `test/types/handle-types.test.ts` `toEqualTypeOf<Promise<string>>` →
  `<Promise<string | undefined>>` (frozen surface widened).
- FENCE held: NO `as string` at any read site; NO `||`/`??` at the not-found mapping (verified by grep).

## Verify (independently re-run by orchestrator)
- `bunx tsc --noEmit` → exit **0**.
- `bun test` → **187 pass / 1 fail**. The fail is **FIT-04** (`core/base-handle`: the stale `dist/` `.d.ts`
  still says `Promise<string>` vs source `Promise<string | undefined>`) — EXPECTED at this boundary.
- FIT-01 green, FIT-06 green. No fence violations.

## PENDING (build step — user runs `bun run build`)
S-05 remaining: `bun run build` → regen `test/fitness/dts-baseline/core.base-handle.d.ts` to
`read(): Promise<string | undefined>` (and `commons.index.d.ts` / `core.handle-state.d.ts` IF they diff) →
FIT-04 green against the regenerated baseline = the intentional-freeze proof (REQ-RD-03.1). Then:
verify-final (Step 11b audit) → arch-refresh (modifying) → integration gate #2.
