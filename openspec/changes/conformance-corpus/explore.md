# Exploration: SDK-side conformance fixture corpus (conformance-corpus)

**Triage**: L
**Persona lens**: none (synthesis pass)

## Cross-Change Lessons Consulted

- Discovery (author-emulation-e2e-scaffold, `openspec/lessons-learned.md`): a "decode-neutral" BOM refactor looked safe under a green suite but silently stripped BOM — any byte-exact fixture work needs an explicit BOM/CRLF fixture, not just "tests still pass."
- Discovery (author-emulation-e2e-scaffold, same file): corpus byte-determinism was only trustworthy once proven by a fresh-process regen guard (FIT-28) — self-comparison isn't proof.
- Pending-changes ledger (`openspec/pending-changes.md:306`, from author-emulation-e2e-scaffold): a registered, **unlanded** followup — "Root `.gitattributes` eol=lf rule for cross-platform corpus determinism" — directly applicable here, no `.gitattributes` exists in the repo today (confirmed).
- No prior change built a cross-repo, git-submodule-consumed fixture contract — this is genuinely new (confirms triage's "new pattern" L driver).

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Spawned runner drives a factory over real framed stdio (same shape, different corpus) | `test/fake/exit-matrix.e2e.test.ts`, `test/fake/fake-engine-harness.e2e.test.ts` (via `test/support/frame-host.ts`) | Read-only precedent — informs an optional self-check, not itself modified |
| Engine's Go harness drives a `conformance/<id>` fixture through the real runner via pinned submodule | None in this repo (harness lives in `project-builder-engine`) | N/A — out of repo; this change supplies fixture files only |
| SDK-local self-check spawning the real runner against a landed fixture's own manifest | None found | Create — open design decision (see Approaches) |

## Current State

`bin/pbuilder-runner.ts` → `src/transport/runner.ts` is the REAL, already-shipped runner (stdio-engine-client, archived 2026-07-16): validates `--factory <url>#<export>` + `--input`/`--input-file`, awaits a versioned `ready` greeting **before any factory import**, single-instance-probes, imports the factory, wraps it with `defineFactory`, and serves `tree.read`/`ir.emit`/`ir.commit`/`ir.discard` via `StdioEngineClient`. Exit taxonomy (EXC-01, `docs/engine-sdk-wire-spec.md`) is normative: 0 success, 1 validation, 2 host refusal, 3 transport fault, 4 crash. `test/support/frame-host.ts` already spawns this runner as a real child process over real stdio for in-repo e2e tests — reusable plumbing.

`src/commons/index.ts` is the ONLY author surface a factory needs: `create`, `replaceContent`, `remove`, `rename`, `move`, `copy`, `scaffold`, `copyIn`, `dryRun`. `src/core/wire.ts`'s `Directive` union is exactly the wire op set the handoff calls `modify`/`delete`/`rename`/`move`/`create`.

`test/fake/conformance-corpus.ts` (in-process TS scenario array, FEH-02) and `src/conformance/{index,run-vehicle}.ts` (published `./conformance` dialect-conformance kit, ADR-0012) are both confirmed **unrelated** to the new root `conformance/` corpus — no code overlap, no import path collision. `conformance/` does not exist yet at repo root.

**Baseline mismatch found**: the committed `openspec/architecture.md` (Updated 2026-07-17) has **no mention of `src/transport/**`** at all — it still states "No production implementation in `src/`; real JSON-RPC transport unbuilt." This is stale: the transport cluster shipped and archived 2026-07-16 (`archive(stdio-engine-client)`, commit `980d61b`, never touched `openspec/architecture.md`). The engram mirror (obs #652, rev 14, "post stdio-engine-client") **does** carry the full transport cluster accurately and matches the real code read here. I mapped Architecture Touchpoints below against obs #652's content (source-of-truth-by-accuracy), not the committed file. **Recommend `/sdd-architecture refresh` before or alongside this change's design** — later refreshes (react-dialect etc.) built on the stale pre-transport version and may have compounded the gap.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `conformance/` (new root dir) | new | net-new fixture corpus, submodule-consumed by an external Go harness | deviates — no existing "cross-repo consumed static contract" shape; closest analog (`test/e2e/author-emulation/corpus/`) is SDK-internal, lives under `test/` |
| `src/commons/index.ts` (author verbs) | extend (read-only) | every fixture factory authors exclusively through this public surface | aligns |
| `src/transport/runner.ts` + `bin/pbuilder-runner.ts` | extend (exercised, not modified) | the engine drives every fixture through this real runner | aligns (per obs #652's real content — see baseline-mismatch note above) |
| `test/support/frame-host.ts` | extend (candidate reuse) | reusable spawn+framed-stdio plumbing for an optional local self-check | aligns |
| `docs/engine-sdk-wire-spec.md` (EXC-01) | read-only | fixtures' `outcome.exitCode`/`emitRejectionCode` fields must track this normative doc | aligns |
| `package.json` (`files`/`exports`/`engines`) | read-only | confirm `conformance/` sits outside `dist`/`exports` — no packaging collision | aligns |
| `tsconfig.json` / `tsconfig.build.json` | read-only (decision pending) | `conformance/**/*.ts` auto-sweeps into strict `tsc --noEmit` (no `include` key) but NOT into the `src/`-rooted build | aligns |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `conformance/` (`corpus.json` + `m1-vehicle`, `m2-modify`, `m2-delete`, `m2-rename-move`, `m2-create-composition`) | Created | the corpus itself |
| `conformance/README.md` | Created | triage-flagged discoverability vs `./conformance` kit |
| `package.json` | Read-only | confirmed `files`/`exports`/`engines` unaffected |
| `tsconfig.json` | Read-only | confirms/decides typecheck sweep of `conformance/**` |
| `tsconfig.build.json` | Read-only | confirms `rootDir:"./src"` excludes `conformance/` from `dist` |
| `src/commons/index.ts` | Read-only | confirmed public-verb→wire-op mapping for all 5 fixtures |
| `src/core/wire.ts` | Read-only | confirmed `Directive` shapes match manifest transcript/outcome fields |
| `docs/engine-sdk-wire-spec.md` | Read-only | EXC-01 is the fixtures' outcome contract |
| `test/fake/conformance-corpus.ts` | Read-only | confirmed distinct/unrelated (triage caution) |
| `src/conformance/{index,run-vehicle}.ts` | Read-only | confirmed distinct/unrelated (CONF-01 kit) |
| `test/support/frame-host.ts` | Read-only | reusable spawn plumbing, only touched if self-check is chosen |
| `openspec/pending-changes.md` | Read-only | `.gitattributes eol=lf` followup already registered, unlanded |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (IPC) | `src/transport/**` — **NOT modified**; only exercised at runtime when the engine spawns the runner against a fixture | Yes (low-confidence, flagged for confirmation) — **CONFIRMED not a production touch**: zero lines change in `src/transport/**`, `src/core/wire.ts`, or `docs/engine-sdk-wire-spec.md`. No re-triage needed. |

No other sensitive areas touched (`conformance/` is outside `package.json#files`/`#exports`; no `.github/workflows/` change; no migration).

## Approaches

### 1. Static fixtures only, no self-check
**Description**: Land exactly what the handoff's checklist literally asks for — `conformance/` files, `bun run build` stays green, nothing else. Drift (bad manifest, wrong `expected/` bytes, factory/manifest mismatch) surfaces only when the engine's Go CI runs the submodule.
**Pros**: minimal SDK surface change; fastest path to unblock M1 with `m1-vehicle`; matches the handoff verbatim.
**Cons**: the handoff's own loader is fail-closed (id/manifest mismatch = hard failure) — this ships with zero local proof against that contract; a bad `m1-vehicle` edit is only caught cross-repo, late.
**Effort**: Low. **Pattern fit**: new pattern (plain fixture tree), no precedent to match against.

### 2. Full local behavioral self-check (spawn the real runner per fixture)
**Description**: Add a new test type that reuses `test/support/frame-host.ts` to spawn `bin/pbuilder-runner.ts` for every landed fixture, drives its `positive`/twin cases, and asserts `exitCode`/`writtenPaths`/`transcript` against the fixture's own `manifest.json`.
**Pros**: closes triage's flagged test-type gap for real; catches manifest/factory drift pre-merge; reuses proven plumbing, no new transport code.
**Cons**: for `m1-vehicle`/`m2-create-composition` (`lowering: schematic`) this can only be a **partial** proof — schematic rendering (`schema.json`/`files/` → the pre-staged `create`) is entirely engine-side Go code the SDK has zero implementation of; the self-check would have to hand-seed the post-lowering state, which proves the factory's behavior but never the rendering step itself. Meaningful scope add to an L change already covering 5 fixtures.
**Effort**: Medium-High. **Pattern fit**: hybrid — reuses `frame-host.ts` (aligns), but the manifest-driven generic test runner is new.

### 3. Structural self-check only (defer behavioral spawn-based check)
**Description**: Ship the fixtures (Approach 1) plus a cheap, non-runner structural test: parse `corpus.json` + every listed fixture's `manifest.json`, and assert exactly the invariants the engine's fail-closed loader depends on — `id` matches dir name, every listed id has a `manifest.json`, every `manifest.json` has a `factory.ts`, `seed`/`expected`/`schematic` references point at dirs that exist. No process spawn, no runner involved. Register the full behavioral self-check (Approach 2) as a followup.
**Pros**: catches the exact failure modes the handoff calls out as HARD failures, cheaply and fast, before they ever reach the engine; leaves the schematic-lowering gap honestly unresolved instead of half-closing it; smallest scope add.
**Cons**: does not catch semantic drift (wrong `expected/` bytes, wrong `outcome`/`transcript` values) — only structural/referential drift.
**Effort**: Low-Medium. **Pattern fit**: matches existing fail-closed validation idioms in this repo (e.g., `input-rejection`/schema validation), no new spawn plumbing.

## Recommendation

**Approach 3.** Approach 1 ships a fail-closed external contract with zero local net; Approach 2 is the more complete answer but adds real scope to an already-5-fixture L change and can never fully close the schematic-lowering gap regardless — better registered as a deliberate followup than rushed into this change. Approach 3 closes the cheap, high-value half (the exact hard-failure modes the handoff itself documents) without inflating this change's footprint, and leaves Approach 2 as an explicit, scoped next step for `sdd-propose`/`sdd-design` to size on its own.

## Risks

- **Committed architecture baseline is stale** (see Current State) — `openspec/architecture.md` is missing the entire `src/transport/**` cluster the corpus depends on; recommend `/sdd-architecture refresh` before design cites it further.
- **Fail-closed external validation** (carried from triage): `corpus.json` must list only fully-landed fixtures; land `manifest.json`+`factory.ts`+dirs in the same slice as the `corpus.json` entry.
- **No local self-check today**: without Approach 3 (minimum), a bad fixture edit surfaces only in the engine's external CI — late and cross-repo.
- **`.gitattributes` eol=lf is registered but unlanded** (`openspec/pending-changes.md:306`): this corpus's `expected/` bytes are exposed to the same CRLF-on-checkout risk already flagged for the author-emulation corpus; a second corpus needing byte-exactness strengthens the case to land it now rather than defer again.
- **Schematic-lowered `expected/` bytes (`m1-vehicle`, `m2-create-composition`) cannot be produced or verified SDK-side** — hand-authored against the manifest spec; first real verification happens engine-side only.
- **Naming adjacency** (carried from triage): `./conformance` (published kit) vs root `conformance/` (new corpus) — no code collision confirmed, but a `conformance/README.md` mitigates discoverability confusion.

## Open Questions

- type: product
  question: "Delivery unit — does `m1-vehicle` land and ship in its own PR first (unblocking M1 immediately), or does the whole 5-fixture corpus land as one PR per triage's 'full corpus in ONE change' ruling?"
  why_it_matters: "Carried verbatim from triage's Notes for Next Phase. Changes slice count/order and how soon the engine team is unblocked; propose/spec need an explicit answer, not an inherited assumption."
- type: technical
  question: "Which self-check approach (1/2/3 above) does design commit to, and if 2 or 3, does it live as a new `test/conformance-corpus/` cluster or fold into an existing test layer?"
  why_it_matters: "Determines whether this change gains new test-plumbing scope beyond the fixture files themselves; affects slice count."
- type: technical
  question: "Does this change land the registered `.gitattributes` `* eol=lf` followup now, or stay deferred a second time?"
  why_it_matters: "Directly affects whether `expected/` byte-exact snapshots are checkout-safe on Windows; two corpora now depend on the same unlanded guarantee."
- type: technical
  question: "Should `conformance/**/*.ts` factories be explicitly listed in `tsconfig.json`'s `exclude` (like `test/fixtures/red/**`), or left swept into the strict main typecheck (current default behavior, no `include` key)?"
  why_it_matters: "Affects whether `bun run typecheck` — not just `bun run build` — is a required-green gate for every landed factory; a silent default either way surprises design/slice later."

## Ready for Proposal

**Status**: yes
**Reason**: All five technical questions the launch prompt required are answered with codebase evidence (author-verb mapping, raw-create path, greeting-agnostic factories, local-vs-engine verification split, determinism gap). Sensitive-areas crosscheck resolves triage's one open flag (IPC row confirmed not touched). No architectural conflict, no scope surprise beyond what triage already anticipated — the one genuine open design axis (self-check depth) is captured as a technical open question with a concrete recommendation, not a blocker.
**Recommended action**: Surface the one `type: product` open question to the user before `sdd-propose`; carry the `type: technical` questions into `sdd-propose`/`sdd-spec`.
