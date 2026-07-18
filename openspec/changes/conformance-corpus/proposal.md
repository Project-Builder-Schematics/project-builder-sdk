# Proposal: Conformance Corpus (SDK↔engine live conformance fixtures)

**Change**: `conformance-corpus` · **Triage**: L · **Persona lens**: none

## Intent

The engine repo (`sdk-live-conformance`, PC-PROTO-02) is BLOCKED on its M1 milestone: today every
SDK↔engine validation runs against the in-repo fake, never the real runner
(`dist/bin/pbuilder-runner.js`) against the real Go engine, so fake/engine fidelity gaps go
undetected in both repos. The engine's Go harness consumes a fixture corpus under `conformance/` at
this SDK's repo root as a pinned git submodule, reads only plain files, and drives each fixture's
factory through the real runner. This change supplies that corpus — `corpus.json` plus all five
fixtures — landing the contract the engine's fail-closed loader requires so M1 (handshake + round
trip) and the m2 wire-mutation suite can run live.

## Scope

### In Scope
- `conformance/` at repo root: `corpus.json` + all five fixtures (`m1-vehicle`, `m2-modify`,
  `m2-delete`, `m2-rename-move`, `m2-create-composition`), each `manifest.json` + `factory.ts`
  (+ optional `seed/`/`expected/`/`schematic/`) per the handoff.
- `conformance/README.md` disambiguating the root corpus from the published `./conformance` kit.
- SDK-local self-verification of corpus structural integrity (fail-closed invariants).
- `.gitattributes` `* eol=lf` REPO-WIDE (owner ruling 2; retires pending-changes row 306), with
  verification that already-tracked files do not re-normalize surprisingly.
- `bun install --frozen-lockfile && bun run build` stays green.
- TWO-PR delivery (owner ruling 1, REVISED 2026-07-18 — supersedes the same-day single-PR ruling):
  PR#1 ships `m1-vehicle` + all cross-cutting scaffolding (self-check, `.gitattributes`, README,
  `corpus.json` listing exactly `["m1-vehicle"]`) as soon as it verifies green, unblocking the
  engine's M1 early; PR#2 ships the four `m2-*` fixtures. `m1-vehicle` is the walking skeleton.

### Out of Scope
- Engine-side changes (submodule pin advance, Go harness).
- Wire-spec or runner changes; `engines.bun` pin (already landed).
- New SDK features.
- cap / exit-3 / exit-4 twin fixtures (cross-repo followup candidates, not this corpus).

## Capabilities (CONTRACT WITH SDD-SPEC)

### New Capabilities
- `conformance-corpus`: `corpus.json` registry + on-disk layout + manifest schema, fail-closed structural invariants.
- `conformance-fixtures`: the five fixtures' behavioral contracts — factories, cases, negative twins, expected snapshots, exit codes.
- `conformance-self-check`: SDK-local test asserting corpus integrity before it reaches the engine.
- `corpus-determinism`: `* eol=lf` repo-wide + byte-exactness guarantee for `expected/` snapshots.

### Modified Capabilities
- None.

## Approach

Author each `factory.ts` exclusively through the public `src/commons` verbs (relative-source import,
same convention as `test/fake/conformance-corpus.ts`); factories are loaded from source by Bun and
sit outside `bun run build` output (`tsconfig.build.json` `rootDir:"./src"`). Grow `corpus.json`
fixture-by-fixture, fail-closed: each slice adds a fixture's `manifest.json`+`factory.ts`+dirs in the
SAME slice that lists its id. Self-verification follows explore's Approach 3 (cheap structural check
of the exact hard-failure modes the engine loader enforces), reusing `test/support/frame-host.ts`
plumbing only if design elevates depth.

L design must formalise as ADRs / spec decisions: (1) the new root `conformance/` dir deviates from
the architecture baseline (no existing cross-repo-consumed static-contract shape) — needs an ADR;
(2) self-check DEPTH — structural-only vs fake-replay vs +runner-smoke; (3) the
`wire-create-reject-twin` exit-code path — authoring-time exit 1 vs emit-time exit 2 (the manifest's
batch-level `unrepresentable`/exit-2 claim may be unsatisfiable SDK-side, correctness-grade);
(4) `tsconfig.json` treatment of `conformance/**/*.ts` (strict typecheck sweep vs `exclude`);
(5) `wireSpecVersion` pin against `WIRE_PROTOCOL_VERSION`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `conformance/` (`corpus.json` + 5 fixtures + `README.md`) | New | the corpus itself |
| `.gitattributes` | New | `* eol=lf` repo-wide (owner ruling 2) |
| self-check test (`test/conformance-corpus/` or fold-in) | New | structural integrity guard; depth = design decision |
| `tsconfig.json` | Modified / decision-pending | possible `exclude` of `conformance/**` |
| `openspec/pending-changes.md` | Modified | retire row 306 (`.gitattributes`) |
| `src/commons/index.ts` | Read-only | public author verbs every factory uses |
| `src/core/wire.ts` | Read-only | `Directive` shapes back manifest transcript/outcome |
| `docs/engine-sdk-wire-spec.md` | Read-only | EXC-01 exit-code taxonomy is the outcome contract |
| `test/support/frame-host.ts` | Read-only | reusable spawn plumbing if self-check elevated |
| `test/fake/conformance-corpus.ts`, `src/conformance/**` | Read-only | distinct/unrelated (name adjacency only) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fail-closed loader: `corpus.json` lists an id without landed manifest/factory/dirs | Medium | Land manifest+factory+dirs in the SAME slice as each `corpus.json` entry; self-check enforces |
| Schematic-lowered `expected/` bytes (`m1-vehicle`, `m2-create-composition`) unverifiable SDK-side | Medium | Hand-author against manifest; first real verification is engine-side; register behavioral+runner self-check as followup |
| `wire-create-reject-twin` exit-code claim may be unsatisfiable as written (exit 1 vs 2) | Medium | Design resolves the authoring/emit path; escalate as cross-repo followup if the manifest claim is wrong |
| `.gitattributes * eol=lf` re-normalizes already-tracked files unexpectedly | Medium | `git add --renormalize .` dry-check; verify diff empty/expected before commit |
| Naming adjacency: published `./conformance` kit vs root `conformance/` corpus | Low | `conformance/README.md` disambiguation |
| Committed architecture baseline stale (missing `src/transport/**`) | Low | `/sdd-architecture refresh` running in parallel; design cites engram baseline obs #652 |
| Cross-repo pin: SDK rollback does not retroactively un-block the engine | Low / Accepted | Engine holds the submodule gitlink; coordinate so it never advances to a reverted SHA |

## Rollback Plan

Delete the `conformance/` directory, delete the self-check test, and revert `.gitattributes`
(and any `tsconfig.json` `exclude` line) in a single revert commit; restore `openspec/pending-changes.md`
row 306. **Validate**: `git status` clean, `bun install --frozen-lockfile && bun run build` green,
`bun run typecheck` green, `git add --renormalize .` yields no residual diff. Nothing is
unrecoverable — all fixtures are hand-authored and remain in git history. **Cross-repo caveat**: the
engine pins this corpus by git SHA (submodule gitlink); a revert here does not retroactively break the
engine, but the engine team must NOT advance the pin to a reverted SHA — coordinate the rollback so
the pin stays on a valid corpus commit.

## Dependencies

- None blocking. Downstream (out of scope): the engine advances its submodule pin after this lands on
  `main`. Informational: architecture baseline refresh running in parallel.

## Success Criteria

- [ ] `conformance/corpus.json` lists exactly the five fixtures; each listed id has a dir whose `manifest.json` `id` equals the dir name and a `factory.ts`.
- [ ] All five fixtures present with cases per the handoff (m1-vehicle positive + greeting-mismatch-twin; each m2 positive + its documented twins).
- [ ] `bun install --frozen-lockfile && bun run build` stays green.
- [ ] `bun run typecheck` is green (or `conformance/**` explicitly excluded per the design decision).
- [ ] SDK-local self-check passes: parses `corpus.json` + every `manifest.json` and asserts id/dir match, manifest↔factory presence, and that `seed`/`expected`/`schematic` references resolve.
- [ ] `.gitattributes` with `* eol=lf` is committed and `git add --renormalize .` produces no unexpected diff on already-tracked files.
- [ ] PR#1 lands `m1-vehicle` + scaffolding with `corpus.json` = `["m1-vehicle"]` at its HEAD SHA; PR#2 lands the four `m2-*` fixtures (owner ruling 1, revised 2026-07-18).
