# Apply Progress: stage-3-dry-run-exposure

**Change**: stage-3-dry-run-exposure · **Triage**: M · **Mode**: Strict TDD
**Last run**: 2026-07-07 — scope `skeleton` (S-000)

## Slice Status

| Slice | Scope tag | Status | Tasks |
|---|---|---|---|
| S-000 | walking-skeleton | complete | 10/10 |
| S-001 | happy-path | not started | 0/1 |
| S-002 | happy-path | not started | 0/1 |

## S-000 — Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/dry-run/plan.ts` | Modified | Exported frozen `WIRE_TO_AUTHOR_VERB` map (`Record<Directive["op"], DryRunVerb>`, delete→remove, identity elsewhere; test-only reach, not barrel-re-exported); `export type DryRunVerb` (six frozen members) with exhaustive-switch/`never`-arm `@example` + frozen-growth prose; `DryRunEntry.verb` narrowed `string`→`DryRunVerb` with defining-site `@example`; `dryRunPlan` renders through the map; header rewritten to the frozen table (retired "§4.4 wire-tag" rationale, added `dryRun()` back-pointer) |
| `src/dry-run/index.ts` | Modified | Barrel gains `export type { DryRunVerb }`; deliberately does NOT re-export `WIRE_TO_AUTHOR_VERB` |
| `src/commons/index.ts` | Modified | Appended at file END: runtime `import { dryRunPlan } from "../dry-run/index.ts"`, type imports from `../dry-run/plan.ts` DEFINING SITE (FIT-06 single-hop), two-step `export type { DryRunEntry, DryRunVerb }`, and `dryRun(): DryRunEntry[]` = `dryRunPlan(currentContext().session.pendingSnapshot())` with full REQ-DRE-04 JSDoc (all four §4.4 elements incl. outside-run `@throws`) |
| `test/dry-run/plan.test.ts` | Modified | REQ-04.2 rebaselined delete→remove; REQ-04.4 decoy added (verb EXACTLY "remove", NOT "delete"); doc comment rewritten to frozen table; inline `Directive` literals kept |
| `test/dry-run/vocabulary-consistency.test.ts` | Created | D3 consistency: runtime `toEqual` on the exported map + compile-time `expectTypeOf<DryRunVerb>` + values-bridge, anchored to test-local `RATIFIED_AUTHOR_VERBS` |
| `test/e2e/dry-run.e2e.test.ts` | Created | REQ-DRE-01.1 (seed `{"src/b.ts": "old"}`, never `src/a.ts`) + REQ-DRE-01.5 (seed `src/gone.ts`); raw `ContractFake` + `defineFactory`, in-fn `expect` |
| `test/skeleton/dry-run-public-contract.test.ts` | Created | `.d.ts` baseline scans (REQ-DRE-02.1/.2, REQ-DRE-03.1) + JSDoc token scans (REQ-DRE-04.1–.3 + (d)) |
| `test/types/dry-run-verb.test.ts` | Created | Narrowing pin + never-arm exhaustive switch; type-only imports from public `src/commons/index.ts`; teeth at `bun run typecheck` |
| `test/fitness/dts-baseline/commons.index.d.ts` | Regenerated | `bun run build` + cp; adds `dryRun`/`DryRunEntry`/`DryRunVerb`, names neither `Directive` nor `pendingSnapshot` |
| `test/fitness/dts-baseline/index.d.ts` | Regenerated | Umbrella `export *` propagation captured (zero `src/index.ts` edit, PKG-01) |

## TDD Cycle Evidence — S-000

| Task | Test (file::name) | Layer | RED evidence | GREEN | Triangulated | Refactored |
|---|---|---|---|---|---|---|
| plan.ts flip | `plan.test.ts::REQ-04.2 — all six ops map correctly` | unit | `expected "remove", received "delete"` (toEqual diff on src/c.ts entry) | yes | six-op aggregate + decoy | none needed |
| REQ-04.4 decoy | `plan.test.ts::REQ-04.4 — delete op never emits the wire tag [decoy]` | unit | `Expected: "remove" / Received: "delete"` | yes | negative assertion pair | none needed |
| D3 consistency | `vocabulary-consistency.test.ts::WIRE_TO_AUTHOR_VERB is exactly the six frozen rows` | unit | `SyntaxError: Export named 'WIRE_TO_AUTHOR_VERB' not found in module 'src/dry-run/plan.ts'` (import failure — the design-pinned RED locus for the unexported map, §4.6b rev 3) | yes | map `toEqual` + values-bridge + `expectTypeOf` | none needed |
| dryRun accessor + e2e | `dry-run.e2e.test.ts::REQ-DRE-01.1/-01.5` | e2e | `SyntaxError: Export named 'dryRun' not found in module 'src/commons/index.ts'` | yes | 2 scenarios (identity verbs + delete→remove through accessor) | none needed |
| REQ-DRE-03.1 export presence | `dry-run-public-contract.test.ts::dryRun is a named export of the commons .d.ts baseline` | architectural | `expect(dts).toMatch(/export declare function dryRun\(/)` failed against pre-regen baseline | yes (post-regen) | n/a — presence pin | none needed |
| REQ-DRE-02.1/.2 + 04.* scans | same file | architectural | [characterization] — target text cannot exist before the same slice writes it (design rev 5 per-assertion split); 02.2 + all 04.* observed failing pre-implementation as a side effect | yes | n/a | none needed |
| DryRunVerb narrowing | `dry-run-verb.test.ts` | contract | [characterization] RED at `bun run typecheck`: `TS2305 no exported member 'DryRunEntry'/'DryRunVerb'` + `TS2322 any not assignable to never` (file green under `bun test` as pinned) | yes | narrowing + exhaustive-switch pair | none needed |
| barrel export | `src/dry-run/index.ts` | — | [characterization] — type-only re-export, no runtime observable | yes | n/a | none needed |
| permanent fixtures | FIT-04 / FIT-06 / FIT-09 / `no-import.test.ts` | architectural | [permanent-fixture] reconfirmed green post-change | yes | n/a | n/a |

## Verification at Slice Boundary

- `bun test`: 258 pass / 0 fail (was 243 pre-slice; +15)
- `bun run typecheck`: clean
- FIT-04 green post-regen; FIT-06 resolves `DryRunEntry`/`DryRunVerb` to `plan.ts` defining-site JSDoc; FIT-09 key set unchanged; `no-import.test.ts` green (map is pure data + type-only import)

## Deviations from Design

None — implementation matches design rev 5 (§4.3 data model, §4.4 JSDoc tokens, §4.6b pinned idioms, §4.8 constraints 1–6 all honored in-slice).

## Notes

- Cross-change guard honored: `src/core/context.ts` and `src/core/session.ts` untouched.
- REQ-04.4 decoy needed an explicit `string` widening (`const verb: string = ...`) because the narrowed `DryRunVerb` type structurally excludes `"delete"` — the negative assertion would not typecheck against the narrowed literal union otherwise.

## Next

`/build --scope=slice:S-001` (outside-run propagation, REQ-DRE-01.4), then S-002.
