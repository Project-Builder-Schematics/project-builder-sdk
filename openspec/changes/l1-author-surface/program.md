# Program: L1 Author Surface

**Program name**: `l1-author-surface`
**Status**: closed — #1/#2 delivered; #3/#4 SUPERSEDED (owner decision, 2026-07-04)
**Build mode**: next-only
**Source change**: `l1-author-surface` (XL triage, re-triaged 2026-06-21)

> **Supersession notice (2026-07-04).** Sub-changes #3 (`error-and-commit-contract`) and #4
> (`dry-run-and-release-shape`) are SUPERSEDED by the ratified problem statement
> (`openspec/problem-statement.md`) and the WHAT-level delivery plan
> (`openspec/objectives-plan.md`). They were scoped under the older "first public release with
> end-to-end author value" framing. Their valuable pieces are re-absorbed, not carried over
> wholesale:
>
> - #3 error attribution + all-or-nothing commit → objectives-plan **Stage 2** (2.1/2.2); W6
>   double-fault → **Stage 1.5**.
> - #4 dry-run renderer exposure → **Stage 3**; 4 MiB frame-cap at flush → **Stage 1.4**;
>   `dist/core` tarball strip + release hardening → **Stage 6** (6.1/6.2).
>
> The seam table below remains valid historical design input (SEAM-02/04/05/06 map onto those
> stages), but this program is no longer the unit of execution.

## Big Picture
Schematic authors get zero authoring value today: `create`'s `options` is bare `JsonValue`, there is no read-disk at the author surface, and engine rejections leak `ContractFake:`/`OpMove` vocabulary instead of author-facing errors. L1 is the first public release, so the semver-sensitive seams (typed options, the async `read()` signature, the error contract, the `dist/core` tarball shape) must land deliberately and frozen. End state: an author writes a typed `factory.ts` whose `create` options are schema-derived, can `read(path)` from disk, sees a dry-run plan of pending commons directives, and on engine rejection gets an attributed author-vocabulary error under an all-or-nothing commit contract. The program threads every seam in a skeleton first, then grows the value half, hardens the failure half (with a blind judgment-day pass), and closes the release shape.

## Sub-Changes (dependency order)
| # | Name | Scope (≤2 sentences) | Target size | Depends on | Status | Epic |
|---|---|---|---|---|---|---|
| 1 | `l1-author-surface-skeleton` | Thinnest end-to-end thread crossing every seam: one typed `create` (single schema-derived option) → directive buffer → minimal dry-run plan render → commit/discard via fake → one attributed error on a forced rejection. Hardcoded values and a single op allowed; every boundary real. | M | — | done (verify-final PASS + integration gate #1 PASS, 2026-06-21; 170 tests, 24/24 REQ scenarios compliant) | — |
| 2 | `typed-options-and-read` | Grow the VALUE half: full type-level schema→options derivation (positive `expect-type` + negative `permissive-proof`), the fluent chain typed end-to-end, and `read(path)` read-disk through the author surface ratified async by the §9.0 spike + confirming ADR. | L | #1 | pending | — |
| 3 | `error-and-commit-contract` | Grow the FAILURE half: full error-attribution seam (every op kind, mid-chain rejection with observable applied-boundary), all-or-nothing commit/discard reworded in `context.ts` + modelled in the fake, W6 double-fault preserved. Blind judgment-day pass (obs 648). | L | #1 | **superseded** → objectives-plan Stages 1.5, 2 | — |
| 4 | `dry-run-and-release-shape` | Finish the dry-run plan renderer (all commons directives, author vocabulary, AST-blind scope guard) and harden the release: enforce the 4 MiB frame-cap at flush (value owned by the wire contract) and strip/gate `dist/core/**` from the published tarball. | M | #1 | **superseded** → objectives-plan Stages 1.4, 3, 6 | — |

## Seams
| Seam | Producer | Consumer | Interface (shape, verbatim) | Verified by |
|---|---|---|---|---|
| SEAM-01 typed-options | #2 typed-options | #1 skeleton `create` | `create<S>(path, opts: { template: string; options: OptionsOf<S>; force?: boolean }): WritableHandle` — `OptionsOf<S>` is type-level only, no runtime read; narrows `options: JsonValue` in `commons/index.ts:20-24` | `expect-type` positive proof + `permissive-proof.ts` negative proof (schema→options parity); FIT-01 commons-no-AST still green |
| SEAM-02 directive buffer | core `Session` (existing) | #4 dry-run renderer + #3 commit | `Session.#pending: Directive[]` read-only snapshot exposed to author-side renderer; `Directive` union per `wire.ts:13-19` (`create/modify/delete/rename/move/copy`) | dry-run render asserts plan == buffered directives for a write-only chain; renderer imports no AST (FIT-01) |
| SEAM-03 commit/discard | #3 commit contract | #1 skeleton runner + fake | `defineFactory` `finally` (`context.ts:49-54`): success → commit staging; thrown `fn` → discard, commit nothing; fake `EngineClient` grows `commit()`/`discard()` over its staging tree | cross-boundary test: thrown factory leaves committed tree empty AND staging discarded; write-only success commits full batch (obs 648 write-only path) |
| SEAM-04 error-attribution | #3 error seam | #1 skeleton + Session call sites | wraps `EngineClient.emit`/`.read` (`engine-client.ts:6-9`) at `Session.read`/`Session.flush` (`session.ts:28,40`); maps `ContractFake:`/`OpMove` → `AuthoringError { verb, path, appliedBoundary }` in author vocabulary | unmocked fake throws → author sees `rename`/`create` (not `OpMove`/`ContractFake:`); mid-chain throw at op N reports `appliedBoundary` |
| SEAM-05 frame-cap | #4 release-shape | core `Session.flush` | cap value owned by `Batch` wire contract (`wire.ts:22`), enforced at `Session.flush` (`session.ts:33-41`); >4 MiB content forces flush/rejection at the wire boundary, not an SDK literal | flush boundary test with fake modelling the cap (FAKE-fidelity); FIT extension forces flush at wire boundary |
| SEAM-06 tarball shape | #4 release-shape | published package | `package.json#files`/`exports`: `dist/core/**` stripped or gated; only `.`, `./commons`, `./conformance` reachable in the tarball | tarball-contents assertion: no `dist/core/**`; FIT-04 `.d.ts` semver gate + pkg-exports-resolution green |

## Integration Gate Contract
After each sub-change completes: program-wide affected suite (union of completed sub-changes) + every seam it produces/consumes exercised by a real cross-boundary test (fake unmocked, both sides) + the write-only-factory happy path (obs 648). Report: `sdd/l1-author-surface/verify-integration-{N}`. Sub-change #3 additionally runs a BLIND judgment-day pass before its gate — the error/commit half is where foundations-skeleton's masked criticals lived.

## Upstream
Not published — `spec_source = internal`, `write_mode = sync`. No initiative/epics. Each sub-change runs its own full pipeline (re-triage, target L/M) when `/build` reaches it.
