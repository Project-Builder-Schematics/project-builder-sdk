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
  ≥1 chained fixture, and envelope key order is asserted.
- **1.2 ★ DECISION D1 — ratify fake semantics as normative** [O1] — the two "engine-fidelity
  questions" (fake `move` silently overwrites; fake `modify` of a nonexistent path materializes
  the file) can no longer defer to a real engine: the fake IS the counterpart. Owner ratifies
  fail-closed vs `force` semantics. *Exists when* an ADR records them. Sits before 1.3.
- **1.3 Contract-fake fidelity closure** [O1] — the fake implements D1 semantics; `test/fake/`
  pins them unmocked.
- **1.4 Frame-cap enforcement at flush** (absorbed from superseded #4) [O1] — the 4 MiB batch
  cap, owned by the `Batch` wire contract, enforced at `Session.flush` (`src/core/session.ts`),
  modeled by the fake. *Exists when* an oversized batch is rejected at the flush boundary with a
  fake-fidelity test.
- **1.5 Double-fault preservation** (debt W6) [O1] — `defineFactory` (`src/core/context.ts`)
  preserves the factory's original error when `discard()` also rejects.
- **1.6 Small test debt (batchable)** [O1, XS] — FIT-04 unconditional rebuild (W7);
  permissive-proof guard hardening; drop the tautological red-proof label in
  `test/conformance/meta.test.ts`.

## Stage 2 — The failure half: error-to-author attribution (O1 correctness, O2 vocabulary)

Re-absorbs superseded #3. Depends on Stage 1 (fake semantics ratified before attribution over
them freezes).

- **2.1 Full attribution coverage — every verb, mid-chain** [O1+O2] — builds on
  `src/core/authoring-error.ts`. Covers: every op kind rejected by the unmocked fake; mid-chain
  rejection reporting the applied boundary (which directives the eager fake already applied);
  flush-time vs commit-time rejection. Read not-found stays a VALUE (`undefined`, ADR-0016),
  never an error. *Exists when* every verb's rejection surfaces `AuthoringError` with verb +
  primary path + applied-boundary info, and a whole-object scan proves zero engine/fake
  vocabulary leaks.
- **2.2 ★ DECISION D2 — structured cause access** [O2] — the skeleton discards the raw engine
  message; owner ratifies whether/what structured cause detail authors get. Sits at 2.1's
  start; ADR-recorded.
- **2.3 Read-trichotomy affordance helper** (debt CQ-1) [O2] — a named helper making
  `=== undefined` / `=== ""` branching the pit of success, exported from `./commons`; JSDoc
  examples use it.

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

| ID | Decision | Sits before | Stage |
|----|----------|-------------|-------|
| D1 | Fake semantics normative: move-overwrite + modify-nonexistent | 1.3 | 1 |
| D2 | Structured cause access on `AuthoringError` | 2.1 freeze | 2 |
| D3 | Dry-run exposure shape + author vocabulary (`remove` vs wire `delete`) | 3.2 | 3 |
| D4 | Typed options: hand-supplied `create<S>` v1 vs schema.json derivation | 4.2 | 4 |
| D5 | First dialect + AST-dependency policy | 5.2 | 5 |

## Out of scope (guard rails)

Engine execution/disk · real wire (`ir.emit`/`tree.read`, engine repo) · prompt UX from
`schema.json` · L2 composition (`invoke`/`extends`) · cross-collection · external
collections/trust · monorepo extraction.
