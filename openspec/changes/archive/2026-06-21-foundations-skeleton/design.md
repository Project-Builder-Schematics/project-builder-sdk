# Design: foundations-skeleton

**architecture_impact**: additive (greenfield instantiation of ADRs 0001-0012; no existing code to modify).
**adversarial_review**: required (L + sensitive: publish/supply-chain).
**Version**: V4 (plan-verify converged; author-facing API frozen — find/verbs surface, exports map, runner injection seam).

## Architecture overview

Three layers (ADR-0002, amended by 0009/0010). `core` is the internal, extraction-ready kit
(ADR-0009 → future `@pbuilder/sdk-kit`); `commons` is the agnostic author surface; `conformance` is the
ecosystem test kit (scaffold only). The walking skeleton wires one path through all of `core`. The
engine HOSTS its own pinned sidecar → the only `EngineClient` impl here is the **contract fake**.

## File changes (contract with sdd-slice)

| Path | REQ | Note |
|---|---|---|
| `package.json` (`exports`, build/dts/lint/publish scripts) | PKG-01/02/03 | umbrella + `/commons` + `/conformance`; no `/core` |
| `tsconfig.build.json` (emit) + keep `tsconfig.json` (`noEmit`) | PKG-02 | dev vs publish split |
| `src/core/engine-client.ts` | KIT-01 | port; `read(): Promise<string>` (no served tag) |
| `src/core/wire.ts` | KIT-03, GIR-01 | ADR-0028 `Directive`/`Batch` types |
| `src/core/directive-factory.ts` | KIT-03, GIR-01 | pure args→directive; `remove`→`op:"delete"` |
| `src/core/session.ts` | KIT-02, FAKE-03 | buffer + flush-before-read; no path-map |
| `src/core/context.ts` | KIT-05 | ALS `RunContext`, `defineFactory`, `currentContext` |
| `src/core/base-handle.ts` + `handle-state.ts` | KIT-04 | `FoundHandle`/`WritableHandle` |
| `src/core/define-dialect.ts` | KIT-04 | `defineDialect`/`defineOpPack`/`withOps` **types + thin sigs only** |
| `src/core/contract-fake.ts` | FAKE-01..06 | seeded flat tree, eager apply, Tree-first, force, idempotent delete |
| `src/core/index.ts` | KIT, PKG-01 | future kit root (not exported to authors) |
| `src/commons/index.ts` | KIT, SKEL | `create` + **real `find().read()`** (skeleton path); other handle write-ops stubbed until S-003; no AST |
| `src/conformance/index.ts` | CONF-01 | `testDialect`/`testOpPack` stubs |
| `src/index.ts` | PKG-01 | umbrella → commons only |
| `test/skeleton/*` | SKEL-01 | byte-exact read-your-own-write e2e |
| `test/golden-ir/*` | GIR-01 | committed fixtures per op |
| `test/fake/*` | FAKE-06 | fidelity suite (observable contract, NOT engine internals) |
| `test/fitness/*` | FIT-01..08 | each + a red-proof; activated per-slice |
| `test/types/*` | KIT-04 | `expect-type` + `@ts-expect-error` + permissive-Handle proof |
| `CONTRIBUTING/CODE_OF_CONDUCT/SECURITY/.github templates + workflows` | STD-01, PKG-03 | CI on forks/PRs; publish on `main` isolated |
| `docs/authoring-a-dialect.md` (stub) | STD-01 | contributor on-ramp |
| `openspec/decisions/0013-verb-ir-lowering.md`, `0014-single-package-subpath-shape.md` | STD-02 | the 2 ADRs |

## Interface contracts (concise — full rationale in ADRs)

```ts
// core/wire.ts (ADR-0028)
type Batch = { protocolVersion: 1; force: boolean; instructions: Directive[] };
type Directive =
  | { op:"create"; create:{ pathTemplate:string; template:string; options:JsonValue; force?:boolean } }
  | { op:"modify"; modify:{ path:string; content:string } }
  | { op:"delete"; delete:{ path:string } }
  | { op:"rename"; rename:{ path:string; newName:string; force?:boolean } }
  | { op:"move";   move:{ path:string; toDir:string } }
  | { op:"copy";   copy:{ from:string; to:string; force?:boolean } };

interface EngineClient { emit(b: Batch): Promise<void>; read(path: string): Promise<string>; }   // KIT-01
class Session { /* #pending only */ read(p): Promise<string> /* flush → client.read */ }            // KIT-02/0008
interface DirectiveFactory { create(a): Directive; modify(a): Directive; remove(a): Directive;       // remove→op:"delete"
  rename(a): Directive; move(a): Directive; copy(a): Directive; }                                    // KIT-03 (pure)
interface FoundHandle    extends ReadOps, WriteOps { remove(): void; read(): Promise<string>; }      // KIT-04; find() returns this
interface WritableHandle extends ReadOps, WriteOps { read(): Promise<string>; /* no remove */ }      // writes return this

// Author surface (commons) — positional + trailing options (frozen public API, SKEL/KIT-03):
function find(path: string): FoundHandle;                                                            // read entry
function create(path: string, opts: { template: string; options: JsonValue; force?: boolean }): WritableHandle;
function modify(path: string, content: string): WritableHandle;
function remove(path: string): void;                                                                 // also find(path).remove()
function rename(path: string, newName: string, opts?: { force?: boolean }): WritableHandle;
function move(path: string, toDir: string): WritableHandle;
function copy(from: string, to: string, opts?: { force?: boolean }): WritableHandle;
// FoundHandle.read()/WritableHandle.read() delegate to Session.read (flush-before-read).

// Run-context injection seam (KIT-05): defineFactory returns a runner that builds the RunContext and
// runs fn inside the ALS. The test injects the fake as deps.client → no global.
type RunContext = { session: Session; factory: DirectiveFactory };
function defineFactory<O>(fn:(o:O)=>void|Promise<void>): (o:O, deps:{ client: EngineClient })=>Promise<void>;
//   runner(o, {client}) = als.run(ctx, () => fn(o)), then ctx.session.flush() in a finally (REQ-KIT-05).
// NOTE (B5 / envelope.force): Batch.force is part of the engine wire contract the fake honors (FAKE-04 Row 3).
// In v1 the author surface exposes only op-level force; Session hard-codes envelope.force=false.
// The fake's Row-3 test exercises the engine-contract path, not a dead code path.

// Author→factory mapping (KIT-03): create(path, {template, options, force?}) → factory.create({pathTemplate: path, template, options, force});
//   modify(path, content) → factory.modify({path, content}); remove(path) → factory.remove({path}) → op:"delete";
//   rename(path, newName, {force?}) → factory.rename({path, newName, force}); move(path, toDir) → factory.move({path, toDir});
//   copy(from, to, {force?}) → factory.copy({from, to, force}).
// The fake's served:"tree"|"disk" is fake-internal test state — NOT in EngineClient.read's Promise<string>.
// Contract fake is seeded: new ContractFake({ seed: Record<path, content> }).

// package.json#exports (PKG-01) — package name @pbuilder/sdk:
//   "."           → { types: "./dist/index.d.ts",            import: "./dist/index.js" }            (umbrella → commons)
//   "./commons"   → { types: "./dist/commons/index.d.ts",    import: "./dist/commons/index.js" }
//   "./conformance" → { types: "./dist/conformance/index.d.ts", import: "./dist/conformance/index.js" }
//   no "./core" / "./internal" / "./kit"; the dialect subpath is documented, NOT wired.
```

## Flow Changes

| Flow | Before | After |
|---|---|---|
| author writes a file | (none) | `defineFactory(o => create(P, {template, options}))` → buffered directive |
| read-your-own-write | (none) | `create(P)` → flush → fake applies eagerly → `await find(P).read()` returns the written bytes (Tree-first) |
| publish | (none) | CI on `main` → build (ESM+`.d.ts`) → `npm publish 0.0.0-dev.<sha> --provenance --tag dev` (OIDC) |

## Test Derivation

| REQ | Test type |
|---|---|
| KIT-03, GIR-01 | golden-IR unit (exact-key, hand-written; `remove`→`op:"delete"`) |
| KIT-04 | type-level (`expect-type` + `@ts-expect-error` + permissive-Handle mutation proof) |
| KIT-02, FAKE-03, KIT-05 | spied round-trip (flush-before-read; ALS isolation) |
| FAKE-01..05 | fake-fidelity unit (observable contract; seed≠staged fixtures; 3 force rows) |
| SKEL-01 | e2e against the fake — byte-exact content equality |
| FIT-01..08 | fitness tests, each with a deliberate-violation red-proof; per-slice activation |
| PKG-01/02/03 | CI/integration (exports resolution, dual build, publish dry-run w/ provenance) |

## Migration plan

None — greenfield. Rollback = revert the scaffolding; the `0.0.0-dev.<sha>` dev tag carries no
downstream dependents.
