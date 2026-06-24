# Triage: typed-options-and-read (#2 of l1-author-surface)

**Classification**: **L** (confirmed — program pre-sized L, council over-determined it)
**Parent program**: `l1-author-surface` (sub-change #2, dependency: #1 skeleton, done+archived)
**Date**: 2026-06-22
**Council**: architect + pm (parallel, anti-anchored)

## Problem Statement

Schematic authors get zero authoring value from `create` today: `options` is bare `JsonValue`
(`commons/index.ts:20-24`), so writing a typed schematic is indistinguishable from writing an
untyped script — the line the roadmap (§4) draws between "authoring a schematic" and "writing a
script" does not yet exist. There is also no read-disk at the author surface, so any
read-and-decide authoring flow is impossible. The skeleton (#1) proved the *thread* — one
hardcoded schema-derived option crossing SEAM-01 — but proved nothing about real schema→options
derivation or reads. **Why now**: this is the VALUE half of the first public release (L1);
SEAM-01's `OptionsOf<S>` shape and `read()`'s signature are semver-frozen the moment L1 ships,
so they must be derived correctly and proven (positive + negative) BEFORE the lock.

## Scope

### in_scope
- Full type-level `OptionsOf<S>` schema→options derivation (positive `expect-type` proof +
  negative `permissive-proof` inverted-exit proof).
- The fluent author chain typed end-to-end (input → `WritableHandle` → chained ops; no `any`
  widening). **Happy-path structural typing only.**
- `read(path)` read-disk through the author surface, against the engine's existing `fs.readFile`.
- The §9.0 spike: ratify `read()`'s async signature WITH EVIDENCE (cite ADR-0001), produce a
  confirming ADR. Runs inside design (answer is pre-determined async; not a pre-spec gate).
- **(pending user decision — see Open Questions)** the masked-exit CI followup fold-in.

### out_of_scope
- Error attribution and typed-error reporting (`AuthoringError` mapping, mid-chain boundaries) → #3.
- Commit/discard contract, staging, read-your-own-writes / read-staged (engine-gated §6) → #3.
- Full dry-run renderer, 4 MiB frame-cap, tarball `dist/core` strip → #4.

## Sensitive-area check
No security-sensitive area (auth/payments/privacy/secrets/deploy). BUT L is forced regardless:
#2 freezes a PUBLIC API signature at the first public release (`package.json#exports` + emitted
`.d.ts` = the semver contract; FIT-04 .d.ts semver gate). Public-API contract freeze is
review-required (architect + tech-writer in design/spec).

## Approach
- **No new walking skeleton** — the PROGRAM skeleton (#1) already threaded SEAM-01 end-to-end and
  is integration-clean. #2 GROWS an existing working slot.
- **Slice directly, target 4-7, A2 entry** (System → A3 for ADRs → A4 for the type derivation).
  Natural SPIDR seams: `OptionsOf<S>` derivation + positive proof; negative `permissive-proof`
  case; fluent chain typed end-to-end; §9.0 spike (SPIKE slice, design-embedded → confirming ADR);
  `read(path)` read-disk thread; FIT-04 dts-baseline regen + semver gate green.
- **Sequencing fence**: #2 produces SEAM-01 that archived #1 consumes. Integration gate #2 re-runs
  #1's suite as a regression fence. Widening the derivation behind `OptionsOf<S>` is additive-safe;
  changing the `create<S>` SIGNATURE SHAPE is a seam renegotiation needing explicit sign-off.

## Resolved Decisions (user, 2026-06-22)
- **PB-1 — `read(path)` surface shape → RESOLVED: handle-only, no new standalone export.** Read
  stays on the existing `find`/handle path through the author surface; NO top-level `read(path)`
  commons export is added (surface minimalism, no permanent semver debt).
- **Read-disk return semantics → NEW HARD REQUIREMENT (user):** the read returns the file CONTENT;
  if the file does NOT exist → `null`/`undefined`; if the file exists but is EMPTY → empty string
  `""`. The contract MUST distinguish not-found from empty. This changes the read return type from
  `Promise<string>` to **`Promise<string | null>`** — a semver-frozen signature decision for L1.
  - *Explore must pin the exact surface*: user phrasing was "el find te va a devolver el contenido"
    — pin whether this is `find(path).read(): Promise<string | null>` (handle method, current
    shape) or `find(path)` resolving content directly. Do NOT over-read; surface the precise verb
    in explore and confirm before spec freezes it. Today: `find` returns a `FoundHandle`,
    `.read()` returns `Promise<string>` (`base-handle.ts`, `session.ts:33-36`).
  - *Interaction with the §9.0 async ratification*: still async (`Promise<...>`); the spike's job
    is unchanged, but the frozen return type is now `string | null`, not `string`.
  - *Scope fence (pm)*: this is read-DISK semantics (against `fs.readFile`), still NOT read-staged
    / read-your-own-writes (engine §6, #3).
- **masked-exit followup fold-in → RESOLVED: FOLD INTO #2.** CI must invert the
  `typecheck:permissive-proof` exit code via raw `tsc` (exit-2-as-success) so #2's headline
  negative proof is verifiable in CI. In scope for #2; remove from `pending-changes.md` at archive.

## Top Risks
1. **MED-HIGH — `OptionsOf<S>` leaks to runtime.** Derivation must stay type-level; any drift to
   reading `schema.json` at runtime pulls a dependency into `commons` and breaks FIT-01. Mitigation:
   FIT-01 (commons-no-AST) as regression gate; the negative `permissive-proof` proves it narrows.
2. **MED — semver freeze with one consumer.** `OptionsOf<S>` has exactly one real user at L1.
   Don't export it as a named public helper unless a second use is real — exporting freezes the
   derivation contract under FIT-04 forever.
3. **MED — ADR theatre on the §9.0 confirming ADR.** It must CITE ADR-0001 + the spike evidence,
   not manufacture a fake async re-litigation. The genuine rejected alternative (sync across IPC)
   is already documented; the spike supplies evidence, not debate.

## Next phase
`sdd-explore` (council: architect, qa-engineer; + business-analyst user-facing; tech-writer for
the public-API/naming surface) — after the product Open Questions are resolved with the user.
