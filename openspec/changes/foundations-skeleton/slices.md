# Slices: foundations-skeleton

SPIDR vertical slices; **S-000 is the mandatory walking skeleton**. Each slice is independently
testable and leaves the suite green. Strict TDD. **Fitness functions activate per-slice** as the
surface they police lands (NOT all at commit one) — so the suite stays green throughout.
**Version**: V4 (plan-verify converged; author API frozen — find/verbs, exports, runner injection, source layout inlined).

> **Executor contract map** — every REQ-ID a slice cites is fully specified in the plan; read the
> contract BEFORE coding the slice. Wire shapes (`Batch`/`Directive` per op), `EngineClient`,
> `Session`, `DirectiveFactory`, handle types, the author→factory mapping → **`design.md` §Interface
> contracts** + **`spec.md`** REQ bodies. Force-precedence rows, Tree-first read, seed shape →
> **`spec.md` REQ-FAKE-01..06**. Fitness predicates + thresholds → **`spec.md` REQ-FIT-01..08**.
> Canonical wire authority → **engine ADR-0028**; open-handle composition → **ADR-0010**.

---

## S-000 — Walking skeleton (read-your-own-write through the fake) 🚶
**REQs**: KIT-01, KIT-02 (minimal), KIT-03 (create only), KIT-05, FAKE-01/02/03, SKEL-01, PKG-01 (commons export)
**Delivers**: package + `exports` (commons) · `EngineClient` port (`read: Promise<string>`) · a MINIMAL
seeded contract-fake (eager apply + Tree-first read for `create`) · `DirectiveFactory.create`
(+ the `commons.create(path,opts)→factory.create({pathTemplate:path,...})` mapping) · `Session`
(buffer + flush-before-read) · `RunContext`/`defineFactory` · `commons.create` + a **real `find().read()`**
(the read path is on the skeleton's critical line; other handle write-ops are stubbed until S-003).
**Activates**: FIT-05 (only-bytes), FIT-07 (no-tree-in-core).
**Acceptance**: the e2e — `defineFactory` creates `P` with content `X` against the fake, `read(P)` returns
`X` **byte-exact** (spied flush-before-read). The spike's proof, now permanent.

## S-001 — DirectiveFactory (all ops) + golden-IR
**REQs**: KIT-03, GIR-01
**Delivers**: the remaining factory methods (`modify/remove/rename/move/copy`; `remove`→`op:"delete"`)
+ committed exact-key golden fixtures per op (`copy` shape-only; `create` proves template-unrendered; envelope ordered).

## S-002 — Contract-fake full fidelity
**REQs**: FAKE-01..06
**Delivers**: seeded fake (`new ContractFake({seed})`) · fail-closed + force (all 3 precedence rows,
row 3 = envelope.force=true) · idempotent delete · served-from tag (fake-internal) · seed≠staged fixtures
· the fidelity suite asserting the engine's **OBSERVABLE contract** (FAKE-01..05; NOT engine-internal
tombstone/opLog/commit — those don't cross the seam) as an independent oracle.

## S-003 — Handle state machine + open-handle types
**REQs**: KIT-04
**Delivers**: `FoundHandle`/`WritableHandle` · `rename`/`move`/`remove` chaining · `defineDialect`/
`defineOpPack`/`withOps` **types + thin signatures only** · type-level tests (`expect-type` + paired
`@ts-expect-error` + the permissive-Handle mutation proof).

## S-004 — Fitness functions + build/dts pipeline
**REQs**: FIT-01..04/06/08, PKG-02
**Delivers**: the publish build config (ESM + `.d.ts`, separate from dev tsconfig) + committed `.d.ts`
baseline · the remaining fitness tests, **each with a deliberate-violation red-proof** (FIT-01 allow-list;
FIT-03 50 KB budget + fixture-AST red-proof; FIT-04 against the baseline; FIT-06 `@example`; FIT-08 no-kit-bleed).
FIT-04/06 activate here (they need the build); FIT-01/02/03/08 once their subpath surface exists.

## S-005 — Publish pipeline + public-repo standards
**REQs**: PKG-03, STD-01
**Delivers**: CI on forks/PRs · the publish job on `main` (`0.0.0-dev.<short-sha>`, `dev` dist-tag) with
`--provenance`/OIDC trusted-publishing, isolated from PR/fork builds (real publish gated on registry-side
trust; CI asserts config + dry-run) · CONTRIBUTING · CODE_OF_CONDUCT · SECURITY (explicit-trust statement)
· issue/PR templates.

## S-006 — Conformance scaffold + ADRs + dialect doc
**REQs**: CONF-01, STD-02, STD-01 (the `docs/authoring-a-dialect.md` clause only)
**Delivers**: `@pbuilder/sdk/conformance` (`testDialect`/`testOpPack` stubs + meta-tests; remove-a-property→red)
· ADR-0013 (verb→IR lowering table) · ADR-0014 (single-package + subpath shape, monorepo-deferral trigger)
· stub `docs/authoring-a-dialect.md`.

---

**Order/deps**: S-000 first (proves the spine). S-001/S-002 build on the fake + factory. S-003 independent
(types). S-004 polices the surface S-000..003 built (+ the build). S-005/S-006 = publish + ecosystem polish.
**Slice count: 7 (1 skeleton + 6)** — within the L target (5–7).

---

## Contract appendix (inlined — this artifact is self-sufficient)

Everything an executor needs to start each slice with no other artifact. Canonical authority: engine
**ADR-0028** (wire), **ADR-0010** (open handle), **ADR-0008** (no-tree). `spec.md` carries the GWT.

### Wire shapes (ADR-0028) — S-000/S-001/GIR-01

```ts
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type Batch = { protocolVersion: 1; force: boolean; instructions: Directive[] };  // envelope order fixed
type Directive =
  | { op:"create"; create:{ pathTemplate:string; template:string; options:JsonValue; force?:boolean } }
  | { op:"modify"; modify:{ path:string; content:string } }
  | { op:"delete"; delete:{ path:string } }                       // author verb `remove` → wire op `delete`
  | { op:"rename"; rename:{ path:string; newName:string; force?:boolean } }
  | { op:"move";   move:{ path:string; toDir:string } }
  | { op:"copy";   copy:{ from:string; to:string; force?:boolean } };   // shape-only here; apply at T-M2
```

Golden-IR (GIR-01): each op deep-equals a **hand-written, committed** fixture (exact keys, no extras);
`create` proves `template` byte-identical (unrendered). Never auto-recorded snapshots.

### Core interfaces — S-000/S-003

```ts
interface EngineClient { emit(b: Batch): Promise<void>; read(path: string): Promise<string>; }  // KIT-01, sole seam
// Session (KIT-02/ADR-0008): holds ONLY #pending Directive[] + the EngineClient — NO path-keyed map/tree.
//   read(p) = flush (emit #pending) BEFORE delegating to client.read(p).
interface DirectiveFactory {                       // KIT-03 — pure args→Directive; renders nothing, no AST
  create(a): Directive; modify(a): Directive; remove(a): Directive;  // remove() returns op:"delete"
  rename(a): Directive; move(a): Directive; copy(a): Directive;
}
interface FoundHandle    extends ReadOps, WriteOps { remove(): void; read(): Promise<string>; }  // KIT-04 — find() returns this
interface WritableHandle extends ReadOps, WriteOps { read(): Promise<string>; /* no remove */ }  // writes return this

// Author surface (commons) — positional + trailing options (frozen public API):
function find(path: string): FoundHandle;                                                        // read entry
function create(path: string, opts: { template: string; options: JsonValue; force?: boolean }): WritableHandle;
function modify(path: string, content: string): WritableHandle;
function remove(path: string): void;                                                             // also find(path).remove()
function rename(path: string, newName: string, opts?: { force?: boolean }): WritableHandle;
function move(path: string, toDir: string): WritableHandle;
function copy(from: string, to: string, opts?: { force?: boolean }): WritableHandle;
// Handle.read() delegates to Session.read (flush-before-read).

// Run-context injection seam (KIT-05): defineFactory returns a runner; the test injects the fake as deps.client.
type RunContext = { session: Session; factory: DirectiveFactory };
function defineFactory<O>(fn:(o:O)=>void|Promise<void>): (o:O, deps:{ client: EngineClient })=>Promise<void>;
//   runner(o, {client}) = als.run({ session: new Session(client), factory: new DirectiveFactory() }, () => fn(o))
//   currentContext() throws outside a run. defineDialect/defineOpPack/withOps (S-003): TYPES + thin sigs only.
```

**Author→factory mapping (KIT-03):** `create(path,{template,options,force?})`→`factory.create({pathTemplate:path,template,options,force})` ·
`modify(path,content)`→`factory.modify({path,content})` · `remove(path)`→`factory.remove({path})`→`op:"delete"` ·
`rename(path,newName,{force?})`→`factory.rename({path,newName,force})` · `move(path,toDir)`→`factory.move({path,toDir})` ·
`copy(from,to,{force?})`→`factory.copy({from,to,force})`.

**Package `@pbuilder/sdk` `exports`:** `"."`→`dist/index.js` (umbrella→commons) · `"./commons"`→`dist/commons/index.js` ·
`"./conformance"`→`dist/conformance/index.js` (each with a `types` condition); NO `./core`/`./internal`/`./kit`; dialect subpath documented, not wired.

**Source layout:** `src/core/{engine-client,wire,directive-factory,session,context,base-handle,handle-state,define-dialect,contract-fake,index}.ts` ·
`src/commons/index.ts` (author verbs; no AST) · `src/conformance/index.ts` (stubs) · `src/index.ts` (umbrella→commons).

### Contract fake semantics — S-000 (minimal)/S-002 (full)

- Construct: `new ContractFake({ seed: Record<path, content> })` — flat in-memory tree, **single-phase eager apply**.
- `emit(batch)`: apply instructions in **array order** before resolving (`[create A, modify A]` → read sees modified).
- `read(P)`: staged content if P was touched, else the seed. The `served:"tree"|"disk"` tag is **fake-internal
  test state** (e.g. `fake.lastServed`), queried out-of-band by fake tests — NEVER in `EngineClient.read`'s `Promise<string>`.
- **Force precedence (3 rows):** `effective = envelope.force OR op.force`; `create`/`rename`/`copy` over an existing
  target → error unless `effective`. Rows: (1) no force → error · (2) `op.force=true` → overwrite ·
  (3) `envelope.force=true`, `op.force=false` → overwrite.
- `delete` of an absent target → succeeds (≤ warning), idempotent (double-delete OK).
- Fidelity suite (FAKE-06): asserts the **observable** contract (FAKE-01..05) as an INDEPENDENT oracle —
  NOT engine internals (tombstones/opLog/commit/`*ConflictError` taxonomy never cross the seam).

### Fitness catalog (FIT-01..08) — each ships a deliberate-violation red-proof; per-slice activation

| FF | Predicate | Activates |
|---|---|---|
| FIT-01 | import-graph scan `src/commons/**`; allow-list = {SDK `core` public symbols, Node/Bun builtins}; any other (esp. ts-morph/postcss/cheerio/babel) → fail | S-004 (once `/commons` exists) |
| FIT-02 | no dialect imports another dialect (leaf rule) | S-004 |
| FIT-03 | `bun build` `/commons` entry < **50 KB** minified AND no AST-lib module specifier; fixture-AST red-proof | S-004 |
| FIT-04 | public `.d.ts` vs committed baseline; breaking export change without version bump → fail | S-004 |
| FIT-05 | `JSON.parse(JSON.stringify(directive))` deep-equals (only serializable bytes cross the seam) | **S-000** |
| FIT-06 | every public export carries a JSDoc `@example` | S-004 |
| FIT-07 | no `Map<path,*>`/tree field in `core` (ADR-0008) | **S-000** |
| FIT-08 | no author subpath re-exports a kit symbol (ADR-0009) | S-004 (once subpaths exist) |

### Product answers (boundaries — Judge B #14/#15/#16/#17)

- **Publish (S-005):** CI asserts workflow config + a **publish dry-run** + the `--provenance` flag. **NO live
  publish in this change** — a real publish runs once npm trusted-publishing (OIDC) is established registry-side.
  Version `0.0.0-dev.<short-sha>`, `dev` dist-tag, job unreachable by PR/fork builds.
- **Kit:** NOT a separate published package here — it is internal `src/core`, extraction-ready (ADR-0009). The
  `@pbuilder/sdk-kit` package is extracted later (first external/2nd dialect trigger).
- **Module system:** ESM-only; Bun for runtime/pm/test; dev `tsconfig.json` is `noEmit`, `tsconfig.build.json` emits.
- **Per-slice acceptance bars:** S-000 = e2e byte-exact read-your-own-write (spied flush-before-read) ·
  S-001 = golden deep-equal per op (create unrendered) · S-002 = fidelity suite green (3 force rows, idempotent
  delete, seed≠staged) as independent oracle · S-003 = type positives compile, negatives `@ts-expect-error`,
  permissive-Handle proof flips negatives green · S-004 = each fitness green + demonstrated red, `dist/` emits
  `.js`+`.d.ts`, `tsc --noEmit` still clean · S-005 = CI on fork/PR, publish job isolated + dry-run green with
  provenance, repo-standard files present · S-006 = conformance meta-test red when a kit property is removed,
  2 ADRs written, dialect-doc stub exists.
