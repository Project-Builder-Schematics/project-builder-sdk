# WHAT-Level Delivery Plan — making the two objectives real

- Status: Approved by the owner, 2026-07-04
- Frame: `openspec/problem-statement.md` (canonical contract; wins over `ROADMAP.md`)
- Altitude: WHAT only — complete and ordered, low level → high level. Per-item design detail
  lands in each item's `/plan` under `openspec/changes/`, per the SDD process.

Ordered inventory of work so the two objectives become reality:

- **O1 — IR generation**: correct wire directives for the six mutations; the contract fake is
  the legitimate counterpart (no real engine required).
- **O2 — Developer experience**: `factory.ts` + `schema.json`, direct verbs, dialect-by-import,
  typed options.

Every O1 item closes only when the IR-correctness triad of the problem statement holds
(golden-IR + unmocked fake test + fitness green). Every O2 item closes with an author-visible
proof (a runnable factory/example or a packed-install resolution test) — never only unit
internals. Every ★ decision closes with an ADR in `openspec/decisions/` before its dependent
items start.

---

## Stage 0 — Contract materialization & grooming (process; unblocks everything)

- **0.1 Materialize `openspec/problem-statement.md`** [O1+O2] — the ratified contract in-tree:
  two objectives, four invariants, fake-as-counterpart, IR-correctness triad. *Exists when* the
  file is in-tree and referenced as canonical.
- **0.2 Formally supersede `l1-author-surface` #3/#4** [process] — mark them superseded in
  `openspec/changes/l1-author-surface/program.md`, pointing at where their absorbed pieces land
  (Stages 1.4, 2, 3, 6).
- **0.3 Groom `openspec/pending-changes.md`** [process] — every debt row gets a stage tag from
  this plan or an explicit "not now".
- **0.4 ROADMAP reconciliation (first pass)** [process] — reframe the old L1–L4 / engine-backed
  framing to the two-objectives framing; conflicts resolve toward the problem statement.

## Stage 1 — IR bedrock: wire correctness & fake fidelity (O1, lowest level)

- **1.1 Golden-IR completeness for all six mutations** [O1] — every verb ± `force`, plus
  chained-handle programs (rename-then-move, create-then-modify), pinned exactly. EXTENSION of
  `test/golden-ir/` (exists). *Exists when* each `Directive` variant has ≥1 golden fixture and
  ≥1 chained fixture, envelope key order is asserted, and a **determinism proof** exists (same
  factory + same inputs run twice → byte-identical `Batch`).
- **1.2 ★ DECISION D1 — ratify fake semantics as normative** [O1] — ✅ **RATIFIED 2026-07-04,
  ADR-0017**: `move` onto an existing destination fails unless `force: true` (the `move` wire
  directive gains `force?`, symmetric with create/rename/copy); `modify` of a nonexistent path
  is an ERROR (never materializes). Remaining work is implementation — see 1.3.
- **1.3 D1 closure — production surface + fake fidelity** [O1] — BOTH halves of ADR-0017:
  (a) production: `move` directive gains `force?` in `src/core/wire.ts`, threaded through
  `src/core/directive-factory.ts`, and the author surface `move(path, toDir, opts?)` + handle
  `.move` grow the trailing `{ force? }` their sibling verbs already have; (b) the fake
  implements both fail-closed rules. *Exists when* `test/fake/` pins both rules unmocked and
  golden fixtures (1.1) pin `move` ± `force` on the new wire shape.
- **1.4 Frame-cap enforcement at emit** (absorbed from superseded #4) [O1] — ✅ **RATIFIED
  2026-07-04, D8/ADR-0019**: the 4 MiB batch cap, owned by the `Batch` wire contract, is
  enforced ONLY at the fake's `emit` (the engine stand-in) — never at `Session.flush`
  (`src/core/session.ts`), which calls `emit` unconditionally with no SDK-side size branch
  (ADR-0018: the engine, not the SDK, owns validation). The cap's **measurement unit** is
  `Buffer.byteLength(JSON.stringify(batch), 'utf8')` — UTF-8 bytes of the serialized envelope,
  exactly-at-cap passes, one byte over rejects — together with the **content encoding /
  binary-file posture**: `modify.content`/`create.template` are exactly `string` in v1
  (text-only; binary is an additive future wire change). Run-end **empty-batch behavior** (a
  factory that buffers nothing still reaches `commit()`) is specified and tested here too.
  *Exists when* an oversized batch is rejected at the `emit` boundary with a fake-fidelity
  test, the unit/encoding ADR exists, and the empty-factory run-end path is pinned.
- **1.5 Double-fault preservation** (debt W6) [O1] — `defineFactory` (`src/core/context.ts`)
  preserves the factory's original error when `discard()` also rejects.
- **1.6 Small test debt (batchable)** [O1, XS] — FIT-04 unconditional rebuild (W7);
  permissive-proof guard hardening; drop the tautological red-proof label in
  `test/conformance/meta.test.ts`; fix the **phantom "ADR-0028" references** (`src/core/wire.ts`,
  `src/core/directive-factory.ts`, `test/golden-ir/`) — no ADR-0028 exists; the real citations
  are ADR-0013 (lowering) and ADR-0017 (D1).
- **1.7 ★ DECISION D6 — boundary pass-through + fake wire-modeling** [O1] — ✅ **RATIFIED
  2026-07-04, ADR-0018** (owner ruling: the engine owns all file control; the SDK only sends
  and receives). The SDK is a verbatim conduit: (a) **paths pass through untouched** — zero SDK
  validation/normalization; the fake owns path-acceptance semantics; (b) **no runtime
  serializability guard in verbs** — the fake's `emit` performs a JSON round-trip, so
  non-serializable options fail at the seam as engine-judged errors; (c) **intra-batch
  conflicts emit in author order; the engine judges**. Remaining work is fake wire-modeling
  implementation: *exists when* the fake round-trips batches through JSON on emit, its
  path-acceptance and conflict-sequence semantics are pinned by `test/fake/` tests, and Stage
  2.1's attribution covers the three new rejection families. Sits before Stage 2 freezes the
  error contract.
- **1.8 Engine-boundary abstraction hardening** [O1] — ratify the `EngineClient` port
  (`src/core/engine-client.ts`, already the self-described "sole transport seam") as the ONLY
  engine I/O crossing — every input from the engine (read results, rejections) and every output
  to it (batch, commit, discard) — and guard it structurally: a new fitness test (FIT-10)
  proves no module outside `src/core` names the port or wire encoding, and that swapping the
  fake for a future real client requires zero SDK changes (the whole suite runs against the
  port interface only). Mostly ratification + guard — the port exists; the item makes bypassing
  it impossible, not possible-but-discouraged. *Exists when* FIT-10 is green with a planted
  bypass red-proof.
- **1.9 Test-pyramid codification** [O1+O2] — testability at four layers is a first-class
  quality attribute (problem statement). Name the layers over the existing tree: **unit**
  (`test/skeleton`, `test/types`, pure units — no engine), **fitness** (`test/fitness`
  FIT-01..09 + planned FIT-10), **integration** (`test/fake` cross-boundary, unmocked),
  **e2e** (factory → `defineFactory` → fake virtual tree + golden batch); document the map in a
  testing doc/CONTRIBUTING and add an explicit e2e suite where that layer is thin today.
  *Exists when* the doc maps each layer to its directory, CI runs all four, and a contributor
  adding a verb or dialect has an obvious home per layer.

## Stage 2 — The failure half: error-to-author attribution (O1 correctness, O2 vocabulary)

Re-absorbs superseded #3. Depends on Stage 1 (fake semantics — ADR-0017 — and the D6 emission
contract must be ratified before attribution over them freezes).

- **2.1 Full attribution coverage — every verb, mid-chain** [O1+O2] — builds on
  `src/core/authoring-error.ts`. Covers: every op kind rejected by the unmocked fake (including
  the ADR-0017 rejections — move-collision without `force`, modify-nonexistent — and any D6
  path/conflict rejections); mid-chain rejection reporting the applied boundary (which
  directives the eager fake already applied); flush-time vs commit-time rejection. Read
  not-found stays a VALUE (`undefined`, ADR-0016), never an error. *Exists when* every verb's
  rejection surfaces `AuthoringError` with verb + primary path + applied-boundary info, and a
  whole-object scan proves zero engine/fake vocabulary leaks.
- **2.2 ★ DECISION D2 — structured cause access** [O2] — the skeleton discards the raw engine
  message; owner ratifies whether/what structured cause detail authors get. Sits at 2.1's
  start; ADR-recorded.
- **2.3 Read-trichotomy affordance helper** (debt CQ-1) [O2] — a named helper making
  `=== undefined` / `=== ""` branching the pit of success, exported from `./commons`; JSDoc
  examples use it.
- **2.4 Error-origin taxonomy: engine-origin vs SDK-origin** [O1+O2] — errors reach the author
  from TWO distinct origins and the contract must name both (owner input, 2026-07-04):
  (a) **engine-origin** — rejections returned through the port: collisions (ADR-0017), path
  acceptance / serialization / conflict judgments (ADR-0018), template rendering failures (the
  SDK never processes templates, so a corrupt `create` template fails engine-side at render);
  (b) **SDK-origin** — errors born inside the SDK before anything reaches the wire: dialect/AST
  failures (parsing corrupt or unparseable content in a `modify` chain, a named op failing on
  the live AST, print/serialize failures) and authoring misuse (verbs outside a factory —
  already a `currentContext()` throw). Both families surface as `AuthoringError` in author
  vocabulary, distinguishable by origin, each attributed to the authoring action; D2's
  structured-cause ruling covers both. The dialect side is later exercised by the conformance
  kit's error-attribution property (ADR-0012) when Stage 5 lands. *Exists when* the taxonomy is
  ADR-recorded with the attribution contract per origin, and a test proves an author can tell
  an engine rejection from an SDK-side dialect failure without reading internals.

## Stage 3 — Dry-run exposure (O2; renderer EXISTS — the work is EXPOSURE)

`src/dry-run/plan.ts` is done and pure; nothing exports it publicly and no author-facing API
feeds it.

- **3.1 ★ DECISION D3 — exposure shape + vocabulary** [O2] — owner ratifies (a) where authors
  touch dry-run (in-factory verb vs runner-level mode vs `./dry-run` subpath utility) and
  (b) plan vocabulary: `dryRunPlan` today emits wire tag `"delete"` while the author verb is
  `remove` — ratify author-vocabulary rendering. ADR-recorded; sits before 3.2.
- **3.2 Session snapshot → author-facing plan wiring** [O2] — a read-only pending-directives
  snapshot from `Session` reaches `dryRunPlan`, exposed per D3. *Exists when* an author can
  obtain the plan of buffered directives before flush, tested plan == buffered directives.
- **3.3 Exports + fitness update** [O2] — `package.json#exports` gains the ratified entry (or
  folds into `./commons`); FIT-09 and `test/dry-run/no-import.test.ts` updated.

## Stage 4 — Typed options: schema.json as the source (O2; the promised differentiator)

Independent of Stages 1–3; parallelizable after D4. Today `create<S>` narrows via hand-supplied
generic only; no `schema.json` is read anywhere in `src/`.

- **4.1 ★ DECISION D4 — typed-options mechanism** [O2] — keep hand-supplied `create<S>` for v1,
  or implement real `schema.json` → type derivation ("one source, parity enforced"). THE
  semver-sensitive DX call; gates 4.2–4.4. ADR-recorded.
- **4.2 schema.json → options-type parity** [O2, if D4 = derive] — a factory's `options` type
  originates from its `schema.json`; drift fails typecheck/test. Builds on the `create<S>`
  overload (`src/commons/index.ts`) and the expect-type / permissive-proof harness
  (`test/types/`). *Exists when* editing `schema.json` without touching types breaks the build
  in a demo factory (positive + negative proofs).
- **4.3 Factory package shape: `factory.ts` + `schema.json`** [O2] — the author's schematic
  unit: a `factory.ts` default export consumed by the internal `defineFactory` runner, with
  adjacent `schema.json`. (Everything-inside-factory is already enforced by `currentContext()`
  throwing outside a run.) *Exists when* a reference schematic in-repo has the pair and runs
  end-to-end against the fake.
- **4.4 End-to-end typed-factory example** (debt CQ-2) [O2] — real schema, real options, real
  chained factory as the canonical example, executed by a test.
- **4.5 ★ DECISION D7 + schematic-author testing story** [O2] — today a schematic author has NO
  public way to run their `factory.ts` against a fake engine: the contract fake lives in
  `test/support/` (unexported), `defineFactory` is internal (guarded by FIT-08), and the
  conformance kit targets dialect/op-pack authors, not schematic authors. Owner ratifies the
  exposure: a public testing subpath (e.g. `./testing` exporting a fake-backed harness) vs a
  documented hand-rolled pattern. Per the testability quality attribute (problem statement),
  the ratified story must make the author's two key layers TRIVIAL: unit tests of pure factory
  logic (no engine) and e2e tests (run the factory, assert emitted IR + resulting virtual
  tree); dialect authors' layers are owned by the conformance kit (5.6). *Exists when* the ADR
  records the choice and a schematic author can, per that choice, execute their factory and
  assert its emitted IR / resulting virtual tree without cloning this repo.

## Stage 5 — First dialect: `modify` becomes real (O1+O2 converge; highest risk)

The DX proof for the modify mutation. Depends on Stages 1–2 (fidelity + attribution frozen
first). Activates ADRs 0003/0006/0010/0012.

- **5.0 Pre-gate: FIT-01 transitive import-graph depth** (debt W2) [O1] — the commons-no-AST
  fitness test must follow relative imports transitively BEFORE any AST dependency enters the
  repo. *Exists when* FIT-01 catches a planted transitive AST import in a red-proof.
- **5.1 ★ DECISION D5 — first dialect choice + AST-dependency policy** [O2] — the dialect (old
  candidate: TypeScript/ts-morph), its subpath name (ADR-0003/0014), and the third-party
  dependency posture for a published SDK. ADR-recorded; sits before 5.2.
- **5.2 Real `defineDialect` / `defineOpPack` / `withOps`** [O2] — the stubs in
  `src/core/define-dialect.ts` become real: AST type parameter, parse/print pair, op-pack
  intersection typing, handle factory. *Exists when* type-level tests prove the generics and a
  dialect assembles without casts.
- **5.3 `withOps` op-name collision diagnostic** (debt, ADR-0010) [O2] — clashing op names
  across packs yield a loud diagnostic, not last-write-wins.
- **5.4 Modify coalescing: N AST edits → ONE `modify` directive** [O1] — per ADR-0006: one live
  AST across the chain, serialize once at flush, final bytes only. *Exists when* a golden-IR
  fixture shows exactly one `modify` for a multi-op chain and serializable-bytes holds.
- **5.5 The first dialect itself** [O2] — extensions, parse/print, a starter op-pack, importable
  at its own subpath. *Exists when* a factory imports `@pbuilder/sdk/<dialect>`, opens a handle,
  applies ops, and emits correct IR against the fake.
- **5.6 Conformance kit bodies: `testDialect` / `testOpPack`** [O1+O2] — signatures in
  `src/conformance/index.ts` are frozen, bodies throw; implement per ADR-0012 (byte-exact
  round-trip, single-op fidelity + unchanged-elsewhere, coalescing-to-one-modify, seam
  serializability, leaf rule, adversarial samples, real-base-dialect rule). *Exists when* the
  kit passes against the first dialect and a planted violation fails it.
- **5.7 Dialect docs + SECURITY guard** (debt W5) [O2] — `docs/authoring-a-dialect.md` matches
  the real API; REQ-STD-01 guarding test.

## Stage 6 — Release shape & DX closure (O2, highest level)

Re-absorbs superseded #4's release half. Packages whatever surface Stages 3/4/5 produced.

- **6.1 Final exports map** [O2] — `.`, `./commons`, `./conformance`, dry-run entry (D3),
  `./<dialect>` (D5); FIT-09 extended. *Exists when* every public subpath resolves from a packed
  install and `/core` stays unreachable.
- **6.2 Tarball + publish hardening** (debts W1/W3, dist/core, SHA pins, prebuild clean) [O2] —
  publish.yml repo-owner guard (**gating: before first live publish**); pack→install→resolve
  smoke test in CI; strip-or-document `dist/core/**`; pin action SHAs; prebuild clean.
- **6.3 Author documentation set** [O2] — quickstart (`factory.ts` + `schema.json`), six-verb
  reference with the read-trichotomy rule, dialect usage, error contract in author vocabulary,
  dry-run usage. *Exists when* a new author goes from install to a passing typed factory against
  the fake using only the docs.
- **6.4 ROADMAP reconciliation (final pass) + milestone declaration** [process] — ROADMAP,
  problem statement, and pending-changes mutually consistent; L2+ explicitly out of scope.

---

## Sequencing & risk

```
Stage 0 ──► Stage 1 ──► Stage 2 ──► Stage 5 ──► Stage 6
                │                       ▲
                ├──► Stage 3 ───────────┤   (3 and 4 parallel after D3/D4)
                └──► Stage 4 ───────────┘
```

- Stages 1–2 first: everything above freezes semantics they define (fake behavior, error
  contract) — cheapest to change now, semver-locked later.
- Stages 3 and 4 are mutually independent and independent of 5; both parallelize once their
  decision is ratified.
- Stage 5 is largest/riskiest (first external dependency, real generics, coalescing); FIT-01
  depth (5.0) is a hard pre-gate.

## Decision points needing owner ratification

| ID | Decision | Sits before | Stage | Status |
|----|----------|-------------|-------|--------|
| D1 | Fake semantics normative: move-overwrite + modify-nonexistent | 1.3 | 1 | ✅ RATIFIED — ADR-0017 |
| D2 | Structured cause access on `AuthoringError` | 2.1 freeze | 2 | open |
| D3 | Dry-run exposure shape + author vocabulary (`remove` vs wire `delete`) | 3.2 | 3 | open |
| D4 | Typed options: hand-supplied `create<S>` v1 vs schema.json derivation | 4.2 | 4 | open |
| D5 | First dialect + AST-dependency policy | 5.2 | 5 | open |
| D6 | Boundary pass-through: paths verbatim · no verb-level serializability guard (fake JSON round-trip at the seam) · conflicts emitted in author order, engine judges | Stage 2 freeze | 1.7 | ✅ RATIFIED — ADR-0018 |
| D7 | Schematic-author testing exposure: public `./testing` harness vs documented pattern | 4.5 close | 4 | open |
| D8 | Batch cap: measurement unit (UTF-8 bytes of serialized envelope), enforcement site (fake's `emit`, never `Session.flush`), exactly-at-cap-passes boundary, text-only wire content | 1.4 | 1 | ✅ RATIFIED — ADR-0019 |

## Out of scope (guard rails)

Engine execution/disk · real wire (`ir.emit`/`tree.read`, engine repo) · prompt UX from
`schema.json` · L2 composition (`invoke`/`extends`) · cross-collection · external
collections/trust · monorepo extraction.

---

## Coverage — what fulfilling each objective means (gap-reviewed 2026-07-04)

The checklist an objective must satisfy to be called DONE, with the stage items that deliver
each line. Produced by an adversarial gap review of the plan against the actual tree; the review
added 1.7 (D6), 4.5 (D7), and the amendments to 1.1/1.3/1.4/1.6/2.1.

### O1 — IR generation is fulfilled when:

| # | Required capability | Delivered by |
|---|---|---|
| 1 | Every one of the six verbs lowers to its exact, pinned wire directive (± `force` where the shape allows) | 1.1 |
| 2 | Emission is deterministic: same factory + same inputs → byte-identical `Batch` | 1.1 |
| 3 | The fake's semantics are ratified and normative — no "ask the real engine later" left | 1.2 ✅ (ADR-0017) + 1.3 |
| 4 | `move`'s `force` exists on the wire, the factory, and the author surface — before semver freezes it absent | 1.3 |
| 5 | The SDK is a verbatim conduit at the edges: paths pass through untouched, serializability is judged at the seam (fake JSON round-trip), conflicts emit in author order — the engine judges all three | 1.7 (D6 ✅ ADR-0018) |
| 6 | The batch cap has a defined unit + encoding/binary posture and is enforced at emit (fake/engine boundary, never `Session.flush`); empty-batch run-end is specified | 1.4 |
| 7 | A failed run never half-commits (all-or-nothing, double-fault preserved) | 1.5 (+ ADR-0015) |
| 8 | Every error is attributable to the authoring action, in author vocabulary, distinguishable by origin (engine-returned rejection vs SDK-born AST/dialect failure), with the applied boundary observable | 2.1/2.2/2.4 |
| 9 | N AST edits on one file coalesce to exactly ONE `modify` carrying final bytes only | 5.4 |
| 10 | The seam invariants hold structurally (commons-no-AST, serializable-bytes, no-tree) and conformance makes them checkable for third parties | fitness (exists) + 5.0 + 5.6 |
| 11 | ALL engine I/O crosses the single `EngineClient` port — bypassing it is structurally impossible; fake ↔ real client swap needs zero SDK changes | 1.8 (FIT-10) |

### O2 — Developer experience is fulfilled when:

| # | Required capability | Delivered by |
|---|---|---|
| 1 | An author writes `factory.ts` + `schema.json` and nothing else — no Tree/Rule/chain plumbing | 4.3 |
| 2 | `options` is typed from one source with parity enforced (or the v1 mechanism is deliberately ratified) | 4.1 (D4) + 4.2 |
| 3 | The six verbs are direct calls with fluent chaining; read is the trichotomy with a pit-of-success affordance | exists + 2.3 |
| 4 | Errors speak the author's vocabulary — never `ContractFake:`/`OpMove` — with ratified cause access, whether returned by the engine or born in the SDK (AST/corrupt content) | 2.1 + 2.2 (D2) + 2.4 |
| 5 | The author can see the plan of what they are about to emit (dry-run) before it happens | 3.1 (D3) + 3.2/3.3 |
| 6 | A schematic author can TEST their factory against a fake engine without cloning this repo | 4.5 (D7) |
| 7 | Importing a dialect IS selecting it: `@pbuilder/sdk/<dialect>` brings a ready AST + named ops that chain and coalesce | 5.1 (D5) + 5.2/5.5 |
| 8 | Dialect/op-pack contributors have a real contract: composable op-packs, collision diagnostics, an executable conformance kit, and a doc | 5.3/5.6/5.7 |
| 9 | The published package resolves every public subpath (and only those) from a real install, with a hardened publish pipeline | 6.1/6.2 |
| 10 | A new author goes install → passing typed factory using only the docs | 6.3 + 4.4 |
| 11 | All four test layers (unit, fitness, integration, e2e) stay easy — for SDK contributors and for schematic/dialect authors | 1.9 + 4.5 (D7) + 5.6 |

## End state — what exists when the whole plan is complete

The day Stage 6 closes, **@pbuilder/sdk is a publishable, engine-independent authoring product**:

A schematic author installs one package and writes a `factory.ts` next to a `schema.json`. Their
`options` are typed from the schema (per D4's ratified mechanism) — drift breaks the build, not
production. Inside the factory they call the six verbs directly and chain them; they `read()`
existing content through the trichotomy; they import `@pbuilder/sdk/<dialect>` and apply named
AST ops that coalesce into single `modify` directives. Before anything is emitted they can see
the dry-run plan in their own vocabulary; when something fails they get an `AuthoringError`
naming their verb, their path, and what had already applied — never engine internals — and they
can tell whether it was the engine rejecting (collision, path, render) or the SDK itself
(corrupt content an AST could not parse, a failing dialect op). They test all of it against the
fake engine from their own repo (per D7) — unit tests of pure factory logic and e2e runs
asserting the emitted IR and virtual tree are both trivial — and they learned all of it from
the docs alone.

What that author's run produces — the product itself — is a **deterministic, byte-pinned,
semver-frozen IR batch**: six directive shapes whose semantics are ratified by ADR (fail-closed
collisions, existence-required modify, defined path/serializability/conflict/cap contracts),
proven correct against a normative contract fake, carried across ONE abstracted engine boundary
(the `EngineClient` port — the SDK never reads, validates, or judges; it sends and receives),
and guarded structurally by a four-layer test pyramid (unit, fitness, integration, e2e) plus an
executable conformance kit that any third-party dialect author can self-run.

What does NOT exist — by design — is any disk execution, template rendering, or AST crossing
the seam. The engine, whenever it arrives at the wire, receives a contract that is already
frozen, documented, and exhaustively pinned — integration becomes the engine's conformance
problem, not a renegotiation of the SDK.

**The demo moment:** a ~10-line typed factory that creates a file from a schema option, adds an
import to an existing module via the dialect, shows its dry-run plan, and emits one clean batch
— IR generation (O1) and the authoring experience (O2), both real, no engine required.
