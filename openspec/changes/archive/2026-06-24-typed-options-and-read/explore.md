# Explore: typed-options-and-read (#2 of l1-author-surface)

**Triage**: L · **Council**: architect, qa-engineer, business-analyst (parallel, anti-anchored)
**Ladder**: entry A1 (authoring flow), full descent A1→A2→A3→A4
**Date**: 2026-06-22

## A1 — Affected Author Flows

**Flow A — typed factory**: author writes `create<S>(path, { template, options })`; editor autocompletes
options from `S`; wrong/missing/excess options fail to compile; untyped `create(path, {options:JsonValue})`
still compiles (backward compat, REQ-01.3). Today blocked: `options: JsonValue` accepts anything; the
skeleton's identity map `{ [K in keyof S]: S[K] }` (`commons/index.ts:118-121`) narrows excess but does no
real required/optional/type derivation.

**Flow B — read-and-decide**: `const c = await find(path).read()` → content if present, `null` if absent,
`""` if empty → author branches (`if (c === null) create… else modify…`). Today blocked: `read()` returns
`Promise<string>` and the engine seam **THROWS** on not-found (`contract-fake.ts:67-80`), so absence is
not branchable and absent-vs-empty is indistinguishable.

## A2 — Current State (as-is, cited)
- **Options typing**: `commons/index.ts:118-122` — generic overload narrows `options` to `{[K in keyof S]:S[K]}`
  (structurally = S, no real derivation); fallback overload `options: JsonValue`. Runtime body untyped; `S`
  erased (never read at runtime → FIT-01 safe).
- **Read path — 4 sites, all `Promise<string>`**: `base-handle.ts:5-7` (`ReadOps.read`, canonical, in public
  `.d.ts`), `commons/index.ts:29-32,60-63` (handle bodies → `session.read`), `session.ts:33-36`
  (`flush()` then `#client.read`), `engine-client.ts:7` (port). Plus the sole impl `contract-fake.ts:67-80`
  **throws** on not-found.
- **Read is NOT a wire directive** (`wire.ts`; ADR-0001:26-29) — separate read-through query → the
  `string|null` change does NOT touch `wire.ts`. Clean seam isolation.

## A3 — Architecture Touchpoints (mapped to openspec/architecture.md)

| Layer / component | Action | Fit |
|---|---|---|
| `OptionsOf<S>` derivation (`commons`) | replace identity map with real schema→options derivation, type-level only | **aligns** — stays AST-free (FIT-01) |
| `EngineClient.read` port | `Promise<string>` → `Promise<string\|null>` + not-found returns null (no throw) | **deviates** → ADR (semver-frozen port + behaviour change) |
| `Session.read` | return → `Promise<string\|null>` | aligns mechanically; rides the read ADR; data-flow §Read updates |
| `ReadOps.read` (base-handle, public .d.ts) | `Promise<string\|null>` | **deviates** → FIT-04 fires, baseline regen required |
| handle bodies + `find(...).read()` shape | return type follows; `find(path):FoundHandle` unchanged, `.read():Promise<string\|null>` | aligns (see PIN) |
| `ContractFake.read` (test/support) | stop throwing on not-found → return null; seed `""` → `""` via `in`/`has`, never truthiness | aligns (fake fidelity, FAKE-06) |

**PIN — read surface shape**: user's "el find te va a devolver el contenido" maps to the EXISTING shape —
`find(path): FoundHandle` unchanged, `FoundHandle.read(): Promise<string|null>`. Collapsing `find` to resolve
content directly would delete the read-and-modify chain (find also offers modify/rename/remove) and be a far
bigger semver break. Architecturally-correct = handle method. (Confirm with user — see Open Questions.)

## Approach — `OptionsOf<S>` derivation (AST-free, type-level)
The crux is **what `S` is** (Open Question — central):
- **Framing A** — `S` IS the options shape (author writes a TS interface for the options). `OptionsOf<S>`
  refines the identity map: required/optional split (`?`/`-?`), per-key type matching, excess rejection.
  Idiomatic, lightweight, matches the skeleton shape. L-appropriate.
- **Framing B** — `S` is a *schema descriptor* (`{name:{type:"string",required:true,default:…}}`) projected to
  options (`{name:string}`). Richer, mirrors runtime schema.json, but heavier — risks scope toward XL.
Realistic TS techniques (either framing): mapped type over keys + conditional `TypeOf` per field; optionality
via key-remapping conditional; defaults = "has default ⇒ optional key" (do NOT surface default VALUES in the
type — runtime data the engine owns, FIT-01 boundary). **Recommendation: Framing A** (smallest derivation that
delivers real value over the identity map, provable positive+negative); Framing B is a larger design.

## Read return-type / ADR shape
- Likely **ONE combined ADR "Read signature freeze: async + nullable"**: async clause = RATIFICATION citing
  ADR-0001 (IPC process-boundary; rejected alt sync-across-IPC already frozen) + spike evidence; nullable
  clause = NEW decision (rejected alts: `undefined`, throw-on-not-found). Watch the 3+-ADR re-triage trigger.
- **`null` vs `undefined`** → all three lenses recommend **`null`**: JsonValue vocabulary includes null not
  undefined; JSON-RPC can't carry undefined; `=== null` is explicit where `?.` silently swallows not-found.

## Fitness-function impact
- **FIT-01 (commons-no-AST)**: `OptionsOf<S>` is type-level, invisible to the import scanner; FIT-01 stays a
  regression gate against runtime schema-read drift. Re-run in #2's fence.
- **FIT-04 (.d.ts semver gate)**: FIRES — `ReadOps.read` change lands in `dist/core/base-handle.d.ts` (already
  diffed). Baseline regen is a required design step; the gate going green again is the proof the new frozen
  surface is intentional.
- **CI permissive-proof inversion (fold-in)**: SUBTLE — the file mixes two negative idioms with OPPOSITE
  success exit codes (unused-directive → exit 2 = success; used-directive suppressing a real error → exit 0 =
  success). A single "exit non-zero = pass" rule (current `ci.yml`) can't validate both AND lets an unrelated
  compile failure false-green. Design must: pin to expected TS error codes on expected lines, or split into
  two tsconfig targets, plus a deliberate-regression guard test that flips CI red.

## Resolved Decisions (user, 2026-06-22)
- **Q-A — `S` framing → FRAMING A.** `S` IS the options type (author writes a TS interface). `OptionsOf<S>`
  refines S: required/optional split, per-key type match, excess-property rejection. L-fit, small semver
  surface. (Framing B / schema-descriptor projection is explicitly NOT this sub-change.)
- **Q-B — not-found sentinel → `undefined`.** Return type is **`Promise<string | undefined>`** (was written as
  `string | null` above — supersede every such mention). not-found → `undefined`, empty → `""`, content →
  content. **Wire-translation note**: `undefined` is not JSON-representable, so the JSON-RPC `tree.read` wire
  carries not-found as absence/null and the SDK (`EngineClient.read` adapter / `Session.read`) translates it to
  `undefined` at the TS boundary. Author-facing surface = `string | undefined`; the contract fake models
  `read()→undefined` on not-found. Tests assert `=== undefined` / `toBeUndefined()` strictly, NEVER `toBeFalsy`.
- **Q-C — empty-file responsibility → author's job.** `""` is reported faithfully; no built-in seeding helper
  in #2.

## Open Questions (technical — resolve in design)
- **[technical] which layer owns not-found→null**: port returns null (fake+real stop throwing) vs `session.read`
  catches throw→null. Lean: port contract changes; genuine failures (permission/transport) stay throws → #3.
  Resolve in design.
- **[technical] not-found vs real read failure**: define how absence (→null) is distinguished from permission/
  transport failure (→throw, #3 territory) so #2 returns null for absence ONLY. Resolve in design.
- **[technical] OptionsOf<S> export**: keep INTERNAL (one consumer at L1; exporting freezes derivation under
  FIT-04 forever). Resolve in design; affects whether proofs assert on the named alias or via the call site.
- **[technical] wire→undefined translation site**: where absence (JSON-RPC null/absent) maps to TS `undefined` —
  `EngineClient.read` port returns `Promise<string|undefined>` (fake+real) vs `Session.read` translates. Lean
  port; genuine failures (permission/transport) stay throws → #3.

## Risks
1. **HIGH — empty-vs-not-found conflation via JS falsiness.** Any `||`/truthiness merges `""`,`"0"`,`"false"`
   with not-found. Mitigation: strict `===`/`toBeNull` trichotomy tests (content/null/""/whitespace/"0"/"false");
   ban `||`-coalesce at the null mapping in review; docs mandate `=== null` not `if (!content)`.
2. **MED-HIGH — CI negative-proof inversion too coarse** (mixed idioms + any-non-zero accepts unrelated
   failures). Mitigation: TS-error-code-pinned assertion + deliberate-regression guard test.
3. **MED — `string→string|null` ripples into #1's archived suite** (breaking edit to `ReadOps.read`; lazy
   `as string` casts would defeat the contract). Mitigation: integration gate #2 re-runs #1 union suite with
   `tsc` exit 0 + review ban on `as string` at read sites; FIT-01 re-run for runtime-leak mutant.

**ready_for_proposal**: yes, conditional on Q-A + Q-B resolved with the user.
