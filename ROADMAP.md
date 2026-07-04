# Project Builder SDK — Roadmap

> The public TypeScript/Bun authoring layer for Project Builder schematics. The developer-facing
> half of the system: it turns file mutations into something programmable, lowers them to IR, and
> hands them to the engine. **"The developer authors; the engine enforces."**

This is the SDK that schematic authors import inside a `factory.ts`. It never touches the disk — it
translates author intent into **IR** (the instruction record) and converses with the Go engine over
JSON-RPC. The engine owns execution and the disk; the SDK owns the authoring experience.

> Direction only. Per-part design detail lands in each part's `/plan` under `openspec/changes/`; the
> *why* behind decisions lives in `openspec/decisions/` (ADRs). We do not pull design detail up into
> this roadmap.

> **⚠ Reconciliation notice (2026-07-04, first pass).** The ratified problem statement
> (`openspec/problem-statement.md`) is now the canonical frame and **wins over this document
> wherever they conflict**. The near goal is the **two objectives** — (O1) IR generation for the
> six mutations with the **contract fake as the legitimate counterpart, not a stopgap**, and
> (O2) the authoring developer experience — delivered per the WHAT-level plan in
> `openspec/objectives-plan.md`. An **engine-backed release is NOT the near goal**; §6 remains
> real cross-repo context for a *later* engine-backed milestone, but it gates nothing in the
> current plan. The L1–L4 / T-M2–T-M3 level language below is retained as direction and will be
> fully reconciled at the plan's final pass (objectives-plan Stage 6.4).

The build mirrors the engine's discipline: **two independent axes** — the **authoring surface**
(rides the IR wire) and the **orthogonal Modify track** (the AST-dependent part). These map onto
the two objectives (the surface serves O2; both lower into O1's IR). The engine-side conversation
(§6) is context for a later engine-backed milestone, not a gate on the objectives.

---

## 1. Guiding principles

1. **Vertical, not horizontal.** Make ONE schematic author end-to-end early, then *thicken* each layer.
2. **Publish-shaped from day one, public-released at L1.** The npm package is born publishable. But the
   first walking-skeleton publish is an internal `0.0.0-dev` proof — the **first public release is L1**,
   and the first release that claims *engine-backing* waits on §6. Every public name is frozen *before*
   any public publish, because semver locks it the moment it ships.
3. **Surface ≠ contract.** Rich author verbs **lower to the engine's small, stable 3-op IR**
   (`OpCreate`/`OpDelete`/`OpMove`). The surface grows freely; the contract stays tiny. `rename` is real
   to the developer and a `move` to the engine.
4. **AST-agnostic.** AST tooling (ts-morph, postcss, cheerio) lives in SDK **dialect modules**, never in
   the engine. A new target file type is a new package, not an engine release.
5. **It's a conversation — and we develop it against a contract fake.** A schematic reads-and-decides
   mid-run; the engine applies emitted IR *eagerly* so the SDK reads its own writes. These semantics are
   not yet on the wire (§6), so the SDK is built and tested against a **contract fake engine**, and a
   time-boxed **spike** proves the model before the spine commits to it. **Evidence over decree.**
6. **The failure half is first-class.** What the author sees when the engine *rejects* an op — and
   whether the staging tree stays consistent after a mid-chain failure (some ops already applied
   eagerly) — is part of the contract. Errors are attributed to the authoring action that caused them,
   in author vocabulary.
7. **Public-first.** LICENSE, CONTRIBUTING, SECURITY, semver discipline, a verifiable publish pipeline,
   and a written dialect contract are foundations, not afterthoughts.

---

## 2. The two axes (the core model)

The SDK orders its levels by **what the author can express end-to-end**.

### Axis A — the authoring surface

```
L1   ●            single schematic    — commons verbs + typed options + fluent chain + read-disk
                                        + errors-to-author → the FIRST public release
L2   ●─●          composition         — invoke / extends / orchestrate from the author side
L3   ●─●─◇        cross-collection    — author against schematics in other local collections
L4   ●─●─◇─⊗      external collections — dependency declarations + a minimal trust posture (§9)
```

**L1's bar is author *value*, not "a verb reached the engine":** the agnostic verbs, **typed `options`
from `schema.json`** (the line between authoring a schematic and writing a script), the fluent chain,
**read-disk** (`read(path)` against the existing engine disk callback), and **error-to-author**.
*Staged* read (read-your-own-writes) is gated on the engine — see §6.

### Axis B — the Modify track (orthogonal, AST-dependent)

```
T-M2   Modify primitive + dialects    — factory-of-factories: per-file-type AST + L1 named ops
                                         + L2 .raw (deferred past the 1st dialect); owns coalescing
                                         + flush-boundary correctness (incl. the 4 MiB frame cap)
T-M3   Smart refactor: rename/move/delete with reference updates — the 🏆 marquee; lands LAST
```

> **Key property — stated honestly:** Axes A and B are independent **on the dialect dimension** — you
> can ship L1–L4 without a single dialect. But L1's *staged conversation* depends on the engine's
> runtime protocol (an engine deliverable, §6). The SDK is therefore **not** independent of the engine;
> that dependency is named, not assumed.

---

## 3. Anatomy of a schematic

```
collection
  ├── schema.json    # typed inputs — the contract with the user (auto-prompt parity)
  └── factory.ts     # the authoring logic, written against @pbuilder/sdk
```

**The mutations, and how they lower.** Five authoring verbs; the engine never learns a new op:

| Author verb | Lowers to | Note |
|---|---|---|
| `create` | `OpCreate` | template + typed params |
| `remove` | `OpDelete` | the export is `remove` (`delete` is a JS reserved word) |
| `move` | `OpMove` | path change |
| `rename` | `OpMove` | same op as `move`; a distinct *verb* for author intent |
| `modify` | final bytes on `OpCreate`/`OpMove` | AST work; the engine stays AST-blind |

**The sub-imports — the heart of the DX.** *What you import decides what you get*, at author-time, with
no runtime dispatcher:

```ts
import { create, move, rename, remove, find } from '@pbuilder/sdk/commons';  // agnostic
import { addImport, addProvider }             from '@pbuilder/sdk/angular';   // dialect (ts-morph)
import { addRule }                            from '@pbuilder/sdk/css';       // dialect (postcss)
```

- `@pbuilder/sdk/commons` → the agnostic verbs + queries. No AST, no library coupling.
- `@pbuilder/sdk/<dialect>` → a file-type/library-specific module bringing its AST plus **L1 named ops**
  and the **L2 `.raw`** escape hatch. **Importing the dialect IS the dialect selection.**

**Two read surfaces, kept distinct — and at different readiness:**

- `find(path)` → a **chainable handle** (the entry point for mutations).
- `read(path)` → **content**. Two backings: **read-disk** (against the engine's existing `fs.readFile`,
  buildable now) and **read-staged** (Tree-first, read-your-own-writes — gated on §6).

**The fluent chain** composes commons + dialect ops on one handle and **coalesces**: a chain of edits on
a single AST lowers to ONE `Modify` IR op (a T-M2 concern; commons verbs are separate ops).

---

## 4. Developer experience — the Angular-schematics lineage

An author opens `factory.ts`, imports the SDK, and *describes* the mutations — no disk, no manual AST
plumbing, full TypeScript types from `schema.json`.

- **Typed options** — `schema.json` drives both the user prompts and the `options` type. One source,
  parity enforced. The load-bearing differentiator, not a footnote.
- **L1 named ops** (80–90%) — auditable, dialect-typed, portable across AST libraries.
- **L2 `.raw(ast => …)`** — the escape hatch; only final bytes cross the seam, never the AST or closure.

Beyond Angular: **traceability** (a dry-run that speaks the author's vocabulary — `rename` shows as
rename) and **error attribution** (engine rejections tied to the authoring action), plus
**extensibility without forking the core**.

---

## 5. The Engine↔SDK protocol — the conversation

JSON-RPC over stdio (the engine's archived `bun-ipc-bridge`). The model:

- **SDK → Engine**: emit IR (writes) · query the tree (reads) · `invoke` · request input.
- **Engine → SDK**: query results · invoke results · input values · continue/abort.
- **Eager application** — emitted IR hits the staging tree immediately, so reads see prior writes.
- **Split authority** — the engine owns the transaction (can reject); the SDK owns the logic flow.
  *SDK proposes; engine disposes.*

The **signature shape** that flows from this — does a `read()` return `T` or `Promise<T>` (sync vs
async authoring) — is the most semver-sensitive decision in the surface, so it is **decided and frozen
at L1** (the spike, §9.0, gathers the evidence since read-through is what may force `await`). Only the
deeper machinery (input delegation, suspension) defers to L2. The author-relevant half of the protocol
will be **restated in the public SDK docs** — a public library cannot point authors at a private repo.

---

## 6. Engine-side prerequisites (cross-repo dependency)

> The SDK sits above the IR seam, but its core job — the conversation — needs the engine to **expose**
> it, and today it does not. The archived `bun-ipc-bridge` wire carries only `ping`, `astWarm`,
> `runFactory` (a stub returning a placeholder), and an `fs.readFile` host callback that reads **disk**
> (`os.Root`), **not** the staging tree. There is no IR-emit and no staged read on the wire. The
> following are **ENGINE deliverables** that gate the SDK's real-engine integration — they belong on the
> **engine board**, not assumed silently here:

| Engine must ship | Enables | Gates (SDK) |
|---|---|---|
| `ir.emit` — receive IR, apply to staging eagerly | the SDK emits mutations end-to-end | first real-engine end-to-end |
| `tree.read` — staged read, Tree-first then disk | read-your-own-writes (`read-staged`) | L1's staged read surface |
| eager-application ordering guarantee | a read after an emit observes the write | the whole conversation |

> **Why this is not a blocker to progress:** the SDK is **fully developable in isolation** against a
> **contract fake engine** that implements the above — surface, coalescing, lowering, and tests all
> advance in parallel. What waits on the engine is the *first release that claims engine-backing* and
> the *real* `read-staged`. `read-disk` (against today's `fs.readFile`) is the one read surface that
> works against the real engine now. This dependency is the corrected reading of §2's independence
> claim: dialects are independent; the engine conversation is a named prerequisite, scheduled, visible.

---

## 7. Architecture & enforcement

- **The IR seam is the boundary.** Everything the SDK produces is *above* the IR (engine ADR-0010).
  Nothing engine-internal leaks up; no AST leaks down.
- **commons vs dialects** behind a single published **dialect contract**. Its **names and interface
  shape are frozen before the first public publish**; before freezing, validate the shape on paper
  against **two** hypothetical dialects (ts-morph + postcss) so it isn't frozen against a sample size of
  zero. Full implementation is validated against the first real dialect (T-M2).
- **Built for a proliferation of AST libraries.** The long tail (yaml, graphql, prisma, svelte, vue,
  markdown, …) is unbounded. Each lives in exactly ONE dialect module. **Subpath exports mean you pay
  only for the dialects you import.** The single biggest reason the IR seam exists.
- **Package shape (v1): single package + subpath exports.** Monorepo extraction is deferred debt,
  triggered by the second dialect.

**Fitness functions — born with the package, enforced in CI from day one:**

1. `commons/**` imports **zero** AST libraries.
2. No dialect imports another dialect (dialects are leaves).
3. Subpath payload budget — importing `/commons` pulls no AST-lib bytes into the bundle.
4. Public `.d.ts` semver gate — a breaking export change fails CI without a version bump.
5. Nothing forbidden crosses the IR seam — only serializable bytes; never an AST object, a closure, or
   an unresolved parameter.
6. Every public export carries a JSDoc `@example`.

---

## 8. npm package & tooling (Bun)

- **Bun** as runtime, package manager, test runner — TypeScript runs directly, no transpile step.
- **Publish gate:** no public release until the dialect-contract names/shape and the
  `remove`/`find`/`read` naming are written into `openspec/decisions/`, a stub
  `docs/authoring-a-dialect.md` exists, and (for an *engine-backed* release) §6 has landed.
- **Public-repo standards** — LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates,
  CI that runs on forks/PRs.
- **Strict TDD** — tests precede implementation.

---

## 9. The route

Sequenced value-vs-risk, evidence-first. The first move proves the riskiest assumption.

```
0. SPIKE              Does emit-IR-then-read-your-own-write hold? Build the minimal in-memory CONTRACT
                      FAKE engine and prove the SEMANTICS against it (the archived wire can't carry it
                      yet — §6). PASS = emit IR → fake applies eagerly → a later read returns the written
                      content, in deterministic order. FAIL = the conversation model is wrong; fix it
                      before any spine. Outcome decides the skeleton's altitude (two-turn vs one-shot)
                      AND the sync-vs-async signature (§5). Time-boxed.

1. foundations-skeleton   Publishable @pbuilder/sdk + public-repo standards + the walking skeleton
                      (vs the fake engine) + the fake-engine test harness + golden-IR assertions
                      + the fitness functions + the dialect-contract names/shape + a stub
                      authoring-a-dialect doc. First publish is 0.0.0-dev (NOT a public-API lock).
                      ADRs: the verb→IR lowering table + the single-package shape.

2. L1 (first public release)  commons verbs + typed options from schema.json + fluent chain
                      + read-disk + error-to-author (incl. mid-chain rejection: what the author sees and
                      the tree state when some ops already applied eagerly) + the 4 MiB frame-cap behaviour
                      for large content. read-staged ships when §6 lands.

3. T-M2 · first dialect   ONE dialect (Angular/ts-morph), L1 named ops, .raw deferred. The "wow".
                      Owns coalescing + flush-boundary golden tests (before read, at schematic boundary,
                      near the 4 MiB cap). Validates the dialect contract against a real consumer.

4+.                   L2 composition → second dialect (extract the dialect contract → monorepo trigger)
                      → L3 cross-collection → L4 external (gated on a minimal trust posture)
                      → T-M3 smart-refactor (last).
```

**Where we are (2026-07-04):** Step 1 `foundations-skeleton` ✅ shipped (archived). The XL program
`l1-author-surface` delivered **#1 (walking skeleton)** and **#2 (`typed-options-and-read`)** — both
archived and merged (188 tests green). Its pending **#3/#4 are SUPERSEDED** (owner decision,
2026-07-04): execution now follows the ratified problem statement
(`openspec/problem-statement.md`) and the WHAT-level delivery plan
(`openspec/objectives-plan.md`), which re-absorbs their valuable pieces (error attribution →
Stage 2, dry-run exposure → Stage 3, frame-cap/tarball hardening → Stages 1.4/6). The contract
fake is the legitimate counterpart; `read-staged` and any *engine-backed* release remain later
milestones gated on §6, outside the current plan.

**The demo moment:** an author writes a ~10-line `factory.ts` that `create`s a file from a typed
`schema.json` option and `addImport`s a module into `app.module.ts`, runs it, sees a **dry-run plan
rendered from the SDK's own coalesced-IR view** (author-side, AST-blind — no engine plan channel
assumed), and the engine applies it. It skips L2/L3/L4 and `.raw` — every piece is on the v1 critical
path, so the demo is free, and it's unmistakably *this* product.

---

## 10. Explicitly deferred (NOT v1)

- **Monorepo migration** — single package + subpaths is correct for v1; workspaces come with the second
  dialect.
- **L2 `.raw` in the first dialect** — ship L1 named ops first; `.raw` welds an AST-library version into
  the public contract, a semver liability.
- **Dialect trust / signing / tiers** — the security model for third-party packages. L4 ships a minimal
  posture only (v1: explicit-trust, no execution of unverified external dialects); the full model defers.
- **Sync-vs-async DSL *machinery*** — input delegation and suspension defer to L2. (The *signature* sync
  vs async is decided and frozen at L1 — §5 — not deferred.)
- **Observability surface** — structured author-facing diagnostics beyond the L1 dry-run + error floor.
- **Reference-update project graph** — the reverse index behind T-M3 smart refactor.
