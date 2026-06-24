# Proposal: typed-options-and-read (#2 of l1-author-surface)

**Triage**: L · **Date**: 2026-06-22 · **Store**: hybrid · **Spec source**: internal
**Lenses carried from explore**: business-analyst (value/flows), pm (scope), architect (port deviation/ADR)

## Why (problem)
The VALUE half of L1 is missing. `create`'s `options` is bare `JsonValue` (`commons/index.ts:20-24`), so a
typed schematic is indistinguishable from an untyped script — the roadmap §4 differentiator does not exist.
And there is no branchable read-from-disk: `read()` returns `Promise<string>` and the engine seam THROWS on
not-found (`contract-fake.ts:67-80`), so "scaffold if missing, else patch" flows are impossible and an author
cannot tell an absent file from an empty one. Both contracts freeze at L1 — they must be right before the lock.

## What (proposed change)
Grow the value half across two crisp deliverables, every product decision already resolved with the user:

1. **Typed options — `OptionsOf<S>` (Framing A).** Replace the skeleton's identity mapped type with a real
   refinement of the author's options interface `S`: required vs optional split, per-key type matching, excess
   property rejection. Type-level ONLY (no runtime schema read — FIT-01). Kept INTERNAL (one consumer at L1;
   exporting would freeze the derivation under FIT-04 forever). Proven by a positive `expect-type` matrix and a
   negative inverted-exit `permissive-proof` matrix (missing-required, wrong-type, excess — beyond the single
   excess case the skeleton shipped).

2. **Read-from-disk trichotomy.** `find(path).read()` returns **`Promise<string | undefined>`**: content if
   present, `undefined` if not-found (behaviour change from THROW → undefined), `""` if empty. The contract MUST
   distinguish not-found from empty. Read-DISK only (`fs.readFile`); read-staged / read-your-own-writes stays
   engine-gated (§6, #3). `undefined` is the author-facing sentinel; the JSON-RPC wire carries absence as
   null/absent and the SDK translates to `undefined` at the TS boundary.

3. **CI fold-in.** Invert `typecheck:permissive-proof` so CI SEES the negative proof's failure — pinned to the
   expected TS error codes, not a bare non-zero exit (the current rule false-greens unrelated compile failures
   and can't validate the file's two opposite-exit-code idioms).

## Architectural shift (the one deviation → ADR in design)
The read change deviates from the baseline's "EngineClient `emit`/`read` signatures unchanged" note: the port's
`read` goes `Promise<string>` → `Promise<string | undefined>` AND not-found stops throwing. This is one logical
signature expressed at four layers (port → session → `ReadOps` handle interface → handle bodies) plus the
contract fake. It rides ONE combined ADR — **"Read signature freeze: async (ratifies ADR-0001) + nullable
(`undefined`)"** — async clause is a citation-backed ratification (rejected alt sync-across-IPC already frozen),
nullable clause is the new decision (rejected alts: `null`, throw-on-not-found). FIT-04 fires on the `.d.ts`
change → baseline regen is a required step, the gate going green is the proof the new frozen surface is intended.

## Scope
**in**: `OptionsOf<S>` derivation + positive/negative proofs; fluent chain typed end-to-end (happy-path
structural typing); `find(path).read(): Promise<string|undefined>` trichotomy; the read-signature ADR;
FIT-04 dts baseline regen; CI permissive-proof exit-code fold-in.
**out**: typed-error attribution / `AuthoringError` mapping (#3); commit/discard, staging, read-your-own-writes
(#3); full dry-run renderer, frame-cap, tarball strip (#4); any standalone `read(path)` export; schema-descriptor
projection (Framing B).

## Seam impact (SEAM-01, produced by #2; archived #1 consumes)
#2 GROWS SEAM-01's `OptionsOf<S>` behind the stable `create<S>(path, opts): WritableHandle` signature shape.
Widening the derivation is additive-safe; changing the signature SHAPE would be a seam renegotiation needing
sign-off. The read widening also touches the handle surface #1 threaded — integration gate #2 re-runs #1's
union suite as a regression fence (and bans `as string` casts that would silently defeat the new contract).

## Value & acceptance seeds (BA)
Author writes a typed factory (options autocomplete, wrong options fail to compile) AND reads-to-decide
(`if (c === undefined) create… else if (c === "") … else modify(c)`). The not-found-vs-empty distinction
prevents a real bug class: an idempotent generator overwriting a user's deliberately-empty file. Docs must steer
authors to `=== undefined`, never `if (!content)` (the falsy trap that re-merges undefined and `""`).

## Risks (carried to spec/design)
1. HIGH — empty-vs-not-found conflation via JS falsiness → strict `=== undefined`/`toBeUndefined` trichotomy
   (content/undefined/""/whitespace/"0"/"false"); ban `||`-coalesce at the mapping.
2. MED-HIGH — CI inversion too coarse → pin to TS error codes + deliberate-regression guard test.
3. MED — `string→string|undefined` ripples into #1's archived suite → integration gate fence + `as string` ban.

## Next phase
`sdd-spec` (council: business-analyst, qa-engineer; + tech-writer for the public read/options surface naming).
