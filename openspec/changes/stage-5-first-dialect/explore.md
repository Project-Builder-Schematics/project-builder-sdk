# Exploration: Stage 5 — First dialect: `modify` becomes real (stage-5-first-dialect)

**Triage**: L (owner-ruled thin scope; XL decomposition rejected)
**Persona lens**: none (council personas join propose/spec/design per triage matrix)

## Cross-Change Lessons Consulted

- stage-3 (`§4.6b`): the flush-seed-rule — `defineFactory`'s unconditional run-end `flush()` hits the fake's fail-closed existence checks; directly load-bearing for 5.4 coalescing sequences.
- stage-1: triangulation regression — a naive coalescing impl can pass green until a genuine ≥2-op chain fixture exposes it. Budget adversarial fixtures, not count-only assertions (ADR-0012 already mandates ≥2 distinguishable ops).
- stage-2/stage-4: blind adversarial review catches unimplemented spec clauses/defenses that in-pipeline verify marks clean — both `.raw()` and dialect-trust are live sensitivity overrides here.
- l1-author-surface-skeleton (ADR-0015): rollback-by-withholding is off the table — directly cited by the owner's constraint that modify's read must go through `Session.read`.
- No prior change touched AST/dialect code — genuinely new territory; no closer precedent than the ADR record itself.

## Affected Flows

| Flow | Current E2E spec | Expected action |
|---|---|---|
| Author chains typed dialect ops (`find→addImport→…`) on one file, run commits one `modify` | none — `author-to-tree.e2e.test.ts` covers hand-written create+modify only | Create |
| Author uses `.raw(ast => …)` after a named op on the same handle — coalesces with it | none | Create |
| FIT-01 pre-gate rejects a transitive AST import reaching commons via a relative chain | `fit-01-commons-no-ast.test.ts` (non-transitive form) | Modify |
| Conformance kit runs against the real dialect (round-trip, single-op fidelity, coalescing) | `test/conformance/meta.test.ts` (surface-only) | Modify |

## Current State

`src/core/define-dialect.ts` is a thin stub (`Op`/`OpPack`/`Dialect` types, no generics). `src/conformance/index.ts` throws by design. The wire `modify` directive (`src/core/wire.ts`) carries full resolved `content: string`, never a patch. `src/commons/index.ts`'s `buildWritableHandle`/`buildFoundHandle` push exactly one `Directive` per verb call via `session.buffer()` — no existing coalescing of repeated calls to the same path. `Session` (`src/core/session.ts`) holds only `#pending: Directive[]` + `#client`; `read()` flushes before delegating (ADR-0015). `package.json` has zero runtime `dependencies` today (devDependencies only). ADR-0014 wires exactly 3 subpaths and documents the dialect subpath pattern as **not wired**. `SECURITY.md` already carries the trust-model prose (REQ-STD-01 substance); no guarding test exists yet (pending-changes W5). `docs/authoring-a-dialect.md` is a titled stub, content deferred. `FIT-02`/`FIT-08` already anticipate `src/dialects/<name>/` (fixtures name `ts-morph`) though `openspec/architecture.md`'s Scaffolding table doesn't list it yet.

## Architecture Touchpoints (A3)

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `core/define-dialect.ts` | modify | real generics (AST type param, op-pack intersection, handle factory), ADR-0010 | aligns |
| `core/session.ts` | read-only (recommended) | modify's read must go through `Session.read`; coalescing-location choice below decides this row | aligns if handle-layer / deviates if Session gains new API |
| `src/dialects/typescript/**` (new) | new | first dialect: extensions, ts-morph parse/print, starter op-pack | aligns — FIT-02/FIT-08 pre-wired; architecture.md prose refresh is routine post-verify, not a conflict |
| `package.json#exports` | extend | new dialect subpath (5.5) vs ADR-0014's "documented, not wired" | deviates — needs an ADR-0014 amendment |
| `package.json` dependencies | new | first runtime dependency (ts-morph) | deviates — D5's open dependency-posture question |
| `conformance/index.ts` | modify | frozen signatures get real bodies (ADR-0012) | aligns |
| `test/fitness/fit-01-*` | modify | 5.0 pre-gate: today's scanner checks each commons file's own bare imports only, not transitively through relative imports | aligns — closes tracked W2 debt |

## Affected Areas

| Path | Impact | Why |
|---|---|---|
| `src/core/define-dialect.ts` | Modify | real generics |
| `src/core/session.ts`, `engine-client.ts` | Read-only | confirms read-through contract needs no signature change |
| `src/dialects/typescript/**` | Created | dialect package + starter op-pack |
| `src/conformance/index.ts` | Modify | real `testDialect`/`testOpPack` bodies |
| `test/fitness/fit-01-commons-no-ast.test.ts` | Modify | transitive depth |
| `test/golden-ir/**` | Modify | fixture proving one `modify` per chain |
| `package.json` | Modify | new subpath + dependency |
| `docs/authoring-a-dialect.md`, `SECURITY.md` | Modify | REQ-STD-01 accuracy + guarding test |
| `openspec/decisions/0014-*.md` | Modify | amendment, not replacement |

## Sensitive Areas Crosscheck

| Area | Path touched | Flagged at triage? |
|---|---|---|
| security (code execution) | `.raw()` in the TS dialect | Yes |
| security (third-party trust) | `src/dialects/typescript/**`, `package.json` dependency | Yes |

## Approaches

### 1. Handle-layer coalescing — Session/DirectiveFactory untouched
**Description**: The dialect's open `Handle` (ADR-0010) owns the AST lifecycle. First op on a fresh `find()` calls `Session.read(path)` (flush-before-read + read-your-own-writes), parses via `ast.parse`, and pushes ONE `modify` directive via the existing `session.buffer()`, retaining the object reference. Subsequent ops on the same handle mutate the AST and update only that retained directive's `content` (eager re-serialize, or a lazy getter evaluated at stringify time to match ADR-0006's "serialize once at flush" literally). `.move()`/`.copy()` chained afterward push ordinary new directives via the existing state machine — untouched.
**Pros**: Zero Session/DirectiveFactory/EngineClient changes; KIT-02's "holds ONLY the pending buffer" stays literally true; no new FIT-10 surface; small, auditable diff.
**Cons**: The dialect handle factory must retain shared mutable state across a chain — a real divergence from `buildWritableHandle`'s current per-call-fresh-closure pattern, needs explicit design (not copy-paste); coalescing correctness is enforced per-dialect-author, not centrally.
**Effort**: Medium. **Pattern fit**: new pattern local to the dialect layer; core stays on the existing plain-buffer pattern.

### 2. Core-owned lazy buffer — Session gains a keyed slot
**Description**: Session exposes `bufferKeyed(key, materialize)`; `flush()` resolves each keyed entry once. The dialect handle registers once per `find()`, mutating only its own AST reference thereafter.
**Pros**: "Serialize once at flush" literally true; the one-directive-per-key invariant is enforced in one place, not trusted to every op-pack author.
**Cons**: Directly contradicts Session's documented KIT-02 contract (a path-keyed map is exactly what "no path-keyed map" forbids) — needs an ADR amending ADR-0008; enlarges the AST-blind port's surface FIT-07/FIT-10 argue against; two coexisting buffering mechanisms in Session.
**Effort**: Medium-High. **Pattern fit**: deviates from Session's documented contract — design-time ADR required.

## Recommendation

Approach 1. It matches the extraction-ready kit boundary (ADR-0009/0014 — dialect mechanics belong outside core so `@pbuilder/sdk-kit` extraction stays mechanical) and keeps Session's contract true without an ADR amendment to it. The "centralized enforcement" advantage of Approach 2 is already covered per-dialect by ADR-0012's conformance kit ("coalescing to ONE modify" is a mandatory conformance assertion) — third-party op-packs are already trusted to hold the AST correctly (ADR-0006), and Approach 2 doesn't remove that trust, only relocates one invariant. Within Approach 1, prefer the lazy-getter variant to avoid O(ops × file-size) re-serialization and honor ADR-0006's wording exactly; verify `dryRun()` (reads only `verb`/`path` from `pendingSnapshot()`) never forces early evaluation of `.content`.

On ADR-0014: no second approach exists — the ratified scope (5.5) requires wiring a 4th `#exports` entry, which ADR-0014 already anticipates via its "monorepo-deferral trigger" but does not wire. Design must draft an ADR-0014 **amendment** (not a competing ADR) naming the subpath string and recording that this change is the trigger event.

## Risks

- Coalescing correctness is provable only against a real AST (ADR-0012) — budget real ts-morph round-trips from the first slice, never a mock.
- The stage-3 flush-seed-rule applies to AST chains too: any `find()`-only dialect test needs its target pre-seeded (never a `create()` target) — design must restate this for AST sequences explicitly.
- First runtime dependency: FIT-03's commons bundle budget doesn't cover the dialect subpath — needs its own budget or an explicit exemption, not silent omission.
- REQ-STD-01 has prose but no guarding test today (W5) — shipping 5.7 without it leaves the "guard" CI-unverifiable.
- `.raw()` is a live sensitivity override on the actual shipped implementation, not just the ADR-0006 design intent — security-engineer must review code, not the decision record.

## Open Questions

- type: technical — question: "Which literal subpath string does the TS dialect wire (`./typescript`, `./ts-morph`, other), and does the ADR-0014 amendment name a general dialect-naming convention or just this one?" — why_it_matters: `#exports` entries are FIT-04 semver-frozen the moment they ship.
- type: technical — question: "Dependency vs peerDependency posture for ts-morph (D5's open half)?" — why_it_matters: peerDependency avoids version-lock conflicts but is worse first-run DX for a capability with zero existing adopters; affects `package.json`, CI, and the SECURITY.md supply-chain posture.
- type: technical — question: "Does Approach 1's coalescing need its own fitness function (guard against an op-pack accidentally double-buffering the same path), or is the golden-IR 5.4 exit-criterion fixture sufficient?" — why_it_matters: without an explicit guard, a silent double-`modify` regression is only caught if a real dialect's own tests happen to notice.

## Ready for Proposal

**Status**: yes
**Reason**: The owner's thin-scope ruling bounds the contract; both genuine architectural forks (coalescing location, subpath wiring) have a clear, ADR-grounded recommendation rather than requiring re-triage; live sensitivity overrides already route to a mandatory downstream reviewer.
**Recommended action**: Proceed to sdd-propose carrying the Approach-1 recommendation and the ADR-0014-amendment framing forward.
