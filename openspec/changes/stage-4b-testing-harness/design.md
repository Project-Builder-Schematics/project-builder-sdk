# Design: stage-4b-testing-harness

**Spec version**: V3 (signed, owner 2026-07-10 — micro-unfreeze on steward CQ2 = YES) · **Triage**: L · **Persona lens**: none · **Architecture impact**: modifying · **Store**: hybrid · **Design rev**: 4 (rev 2 = blind design-council; rev 3 = V3/steward-C1 delta; rev 4 = plan-verify iteration-1 gap fixes — see §4.12/§4.13)

## 4.1 Architecture Overview

`./testing` is a new sibling module under `src/testing/`, mirroring the existing
`src/conformance/` and `src/dry-run/` single-file-facade pattern. It holds three source
files: the **relocated** normative fake (`contract-fake.ts`, moved verbatim from
`test/support/`), its **relocated** message dictionary (`rejection-messages.ts`), and the
facade `index.ts`. The relocation is forced, not stylistic: `tsconfig.build.json`
(`rootDir:"./src"`, `exclude:["test"]`) forbids a `src/`→`test/` import in the published
build (explore Approach A), so the harness — which must ship — cannot reach a fake living
in `test/`. Old paths become **pure re-export shims**, so the ~25 existing importers and
`spy-client.ts` keep their import specifiers unchanged (zero churn) and FIT-11 keeps reading
the same dictionary through the shim.

`runFactoryForTest` is the harness: per call it constructs a fresh `ContractFake({seed})`,
wraps it in a **spy-recording client** (mirrors `test/support/spy-client.ts`'s
`makeSpyClient` — record each `Batch` then delegate), runs the author's `defineFactory`
runner against it, and returns `{tree, emitted, error}`. The one binding subtlety
(REQ-TES-07): the facade file `src/testing/index.ts` MUST NOT name `EngineClient` or
`EmitRejection` — it achieves spy-wrapping via a **local structural interface**
(`RecordingClient`) covering only `emit/read/commit/discard`, which is structurally
identical to `EngineClient` and thus passes to the runner's `deps.client` without importing
the port type. The single architectural seam this crosses: `ContractFake` — until now
test-owned, unshipped — becomes a **src-owned, tarball-shipped** module (ADR-0034); its
containment (never bundled into `.`/`./commons`/`./conformance`) is the fail-closed job of
the new dev-only guard FIT-17 and the five companion guards (ADR-0033, six in total).

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/testing/index.ts` | Create | Facade: `runFactoryForTest`; re-export `defineFactory` (value) + `Batch`/`Directive` (type-only); exports `RunResult` (locally-declared, non-kit — outside FIT-08's scan universe, §4.4). Names no port symbol (REQ-TES-07). JSDoc checklist (TSD-02, TW-M2/M3): `@example` = COMPLETE author test INCLUDING a rejection assertion with the `instanceof AuthoringError` narrowing branch (seeded-read example homes in the README, TW-m1); `@param seed` (`Record<string,string>`, sole seeding channel); explicit 0.x stability sentence; one-line `./testing`-vs-`./conformance` boundary reference; `RunResult` carries its own `@example` + per-field docs — `tree` committed-writes-only/seed-excluded, `emitted` in-call-order, `error` "undefined on success" stated explicitly |
| `src/testing/contract-fake.ts` | Create | Relocated normative fake (git-move from `test/support/`) — now a shipped `src/` module |
| `src/testing/rejection-messages.ts` | Create | Relocated dictionary (git-move) — FIT-11/FIT-17 literal source |
| `test/support/contract-fake.ts` | Modify | Becomes pure re-export shim (`export { ContractFake, … } from "../../src/testing/contract-fake.ts"`) |
| `test/support/rejection-messages.ts` | Modify | Becomes pure re-export shim of `src/testing/rejection-messages.ts` |
| `package.json` | Modify | Add `"./testing"` exports entry (types+import); stage-4-merged base |
| `src/core/wire.ts` | Modify | Add `@example` to `Batch`/`Directive` origin decls (FIT-06 re-export cascade, REQ-TSD-02) |
| `src/core/context.ts` | Read-only | `defineFactory` origin `@example` (FIT-06 cascade target) — present on stage-4-merged base; verified, not edited. Fallback (TW-m6): if `@example` is absent at rebase time, this change ADDS it (the FIT-06 cascade hard-depends on it) and the row flips to Modify |
| `test/fake/harness-result.test.ts` | Create | ATH-01/02/03/04/05/06/07/08/09/10 harness behaviour (integration) |
| `test/fake/harness-in-memory-invariant.test.ts` | Create | ATH-11.1 fs/net/env/argv instrumentation (harness machinery, non-opted-in factory) |
| `test/fake/harness-opted-in.test.ts` | Create | ATH-11.2 + ATH-13.1/.2 opted-in (`packageDir`) factory scenarios — **STAGE-4-MERGED-DEPENDENT** (cannot pass on main-today; gated like TSD-03/FIT-14) |
| `test/fixtures/harness-opted-in/schema.json` | Create | Fixture schema for the opted-in factory (`{ port: number }` per ATH-13.1) — stage-4-merged-dependent |
| `test/fake/harness-leak-scan.test.ts` | Create | ATH-12 whole-object scan of `result.error` |
| `test/fitness/fit-18-fake-single-source-parity.test.ts` | Create | FIT-18 (claimed, TW-m4): FSP-01/02/03/04 single-source + reference-identity parity |
| `test/fitness/fit-17-testing-dev-only-bundle.test.ts` | Create | FIT-17 fail-closed containment guard + positive control |
| `test/e2e/installed-consumer.e2e.test.ts` | Create | TES-02/06 pack→install→import-by-name outcome-proof |
| `test/support/shared-build.ts` | Create | Memoized build fixture (`ensureTscBuild`, `ensureMinifiedEntry`) — shared by FIT-04/FIT-17/e2e (Suite-Cost constraint) |
| `test/fitness/dts-baseline/testing.index.d.ts` | Create | FIT-04 baseline for `dist/testing/index.d.ts` (entry-only, §4.7) |
| `test/docs/testing-story-docs.test.ts` | Create | TSD-01 copy-runnable example + TOKEN-LEVEL text asserts (GAP-5 pinned token sets, §4.6): stability = `0.x` + `semver-exempt`; boundary = `./conformance`; seeded-read = `runFactoryForTest` + `seed`; TSD-04 amendment = `author-testing` + `./testing` + `0.x`; TSD-03 revert = stage-4's byte-exact qualifying-line literal ABSENT. Surrounding prose is author-free |
| `test/fitness/fit-08-no-kit-bleed.test.ts` | Modify | Per-path allowlist data model (REQ-TES-03) + wildcard-re-export ban by form with the ONE specifier-exact umbrella exemption (`src/index.ts` → `./commons/index.ts` only; SEC-M1, GAP-4) + two red-proofs |
| `test/fitness/fit-09-pkg-exports-resolution.test.ts` | Modify | 3→4 keys incl. `./testing`; `./core` still absent |
| `test/fitness/fit-04-dts-semver-gate.test.ts` | Modify | Add `testing.index` DTS pair + companion negative declaration-scan (SEC-M2, §4.7); consume `shared-build`; update the W7 "unconditional rebuild" header comment to describe the memoized one-fresh-build-per-process mechanic — SAME slice as `ensureTscBuild` (ARCH-m4) |
| `test/fitness/fit-10-engine-client-port-guard.test.ts` | Modify | Allow-list transition `test/support/…`→`src/testing/contract-fake.ts`; facade + red-proofs (REQ-TES-07) |
| `test/fitness/fit-06-example-jsdoc.test.ts` | Modify | `PUBLIC_PATHS` += `src/testing/index.ts` (REQ-TSD-02 cascade + red-proof); `RunResult` in `@example` scope (ARCH-M1); stability-language assert on `runFactoryForTest`'s JSDoc = TOKEN-LEVEL, pinned tokens `0.x` + `semver-exempt` (TSD-02.2, TW-m2, GAP-5) |
| `test/fitness/fit-07-no-tree-in-core.test.ts` | Modify | Update stale "not in dist" comment; assert glob STAYS `src/core/**` (spec SEC-M2 non-regression note) |
| `test/fitness/fit-14-package-surface.test.ts` | Modify | stage-4-owned; `./testing` now in exports (stage-4-dependent row) |
| `test/fitness/pkg-surface-baseline.json` | Modify | Regenerate surface snapshot with `./testing` (same slice as exports edit) |
| `openspec/decisions/0009-two-audiences-contributor-kit.md` | Modify | Amendment STUB cross-referencing ADR-0032 (REQ-TSD-04) — decision text lives in 0032, §4.5 |
| `openspec/decisions/0032-third-audience-author-testing.md` | Create | ADR-0032 draft (§4.5) |
| `openspec/decisions/0033-shipped-fake-containment.md` | Create | ADR-0033 draft (§4.5) |
| `openspec/decisions/0034-fake-relocation-parity-by-identity.md` | Create | ADR-0034 draft (§4.5) |
| `openspec/decisions/0035-packed-tarball-e2e-lifecycle.md` | Create | ADR-0035 draft (§4.5) |
| `README.md` | Modify | Testing section (TSD-01) incl. the seeded-read worked example (TSD-01.4's chosen home, TW-m1) + qualifying-line revert (TSD-03, sequence-gated on stage-4 archive) |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author writes `factory.ts`, tests it via installed `@pbuilder/sdk/testing` | Create | ATH-01/02/03, TES-06 | `test/e2e/installed-consumer.e2e.test.ts` | the harness itself, engine-free |
| Author proves the factory runs end-to-end through the *published* entry (installed-consumer-vantage) | Create | TES-02, TES-06 | `test/e2e/installed-consumer.e2e.test.ts` | pack→install→import-by-name |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `package.json#exports` | extend | add `./testing` (never `./core`) | aligns |
| `src/testing/` module | new | facade + relocated fake, joins the single-layer lib | aligns (mirrors `conformance`/`dry-run`) |
| ADR-0009 audience boundary | modify | records third audience `author-testing`, own entry | deviates → ADR-0032 |
| `ContractFake` ownership | modify | test-owned→src-owned, shipped in tarball; data-ownership line moves | deviates → ADR-0034 |
| FIT-08 no-kit-bleed | modify | flat ban → per-path allowlist data model | deviates → ADR-0033 |
| FIT-10 port guard | modify | allow-list transitions into shipped `src/`; boundary widening | deviates → ADR-0033 |
| FIT-17 dev-only bundle guard | new | fail-closed containment scan of production bundles | aligns (mirrors FIT-03) |
| FIT-04 / FIT-09 baselines | modify | extend fixed fixtures to cover `./testing` | aligns |
| FIT-07 glob | modify | comment refresh; pinned to `src/core/**`, NOT widened (SEC-M2) | aligns |
| installed-consumer-vantage e2e | new | build→pack→install→import-by-name | deviates → ADR-0035 |
| `README.md` / ADR-0009 doc | modify | positive docs + amendment | aligns |

## 4.3 Data Model

```ts
// src/testing/index.ts
import type { Batch, Directive } from "../core/wire.ts";
import type { AuthoringError } from "../core/authoring-error.ts";

// Local structural port (REQ-TES-07): names neither EngineClient nor EmitRejection.
interface RecordingClient {
  emit(batch: Batch): Promise<void>;
  read(path: string): Promise<string | undefined>;
  commit(): Promise<void>;
  discard(): Promise<void>;
}

export interface RunResult {
  tree: ReadonlyMap<string, string>;        // ContractFake.committedTree() — committed writes ONLY
  emitted: Batch[];                          // recorded per emit() call, in order
  error: AuthoringError | unknown;           // undefined on success
}

export type { Batch, Directive };            // type-only public re-exports
export { defineFactory } from "../core/context.ts"; // allowlisted value re-export
```

`result.tree` is `committedTree()` verbatim (seed NEVER included — it is served only through
the fake's `read`, per Glossary). On any rejection/throw the runner's `discard()` leaves
`#committed` empty ⇒ `tree.size === 0` (ATH-03/05/06/09). `error: AuthoringError | unknown`
is documented as the union though `unknown` absorbs it — the doc communicates the two live
shapes (attributed `AuthoringError` from the emit seam; the original thrown value from a
factory throw, ATH-06).

**Opted-in factory semantics (REQ-ATH-13, V3 — resolves steward condition C1)**:
`runFactoryForTest` runs a `packageDir`-opted-in factory (`defineFactory(fn, { packageDir })`,
stage-4 ADR-0029) **AS-IS — the harness needs ZERO code change** (the design's explicit claim,
to be verified at build). `packageDir` lives in the factory's DEFINITION, so the harness
signature gains no channel; stage-4's pre-`als.run` schema read + run-boundary validation
execute INSIDE the runner the harness already awaits, strictly BEFORE the client is ever
used — a rejection therefore lands in the harness's existing `catch` and surfaces as
`result.error`, with `result.tree` AND `result.emitted` both empty (no directive buffered,
`emit` never invoked — the rejection precedes the emit seam). **Interim shape** (stage-4
Option A, owner-ratified in stage-4's plan): until stage-4's S-006 lands the rejection is a
**plain `Error`** — so in this window an author asserts the pinned message literal + the
fail-closed empties, and `result.error` is observed as `unknown`; `instanceof AuthoringError`
/ `reason` literals become assertable only post-S-006, when ATH-13's scenarios re-verify.
The existing `AuthoringError | unknown` typing accommodates BOTH windows without
modification. A schema-VALID input runs the opted-in factory indistinguishably from a
non-opted-in happy path (ATH-13.2).

## 4.4 Interface Contracts

```ts
export async function runFactoryForTest<O>(
  factory: (o: O, deps: { client: RecordingClient }) => Promise<void>,
  input: O,
  seed?: Record<string, string>,
): Promise<RunResult>;
```

- Accepts the runner **`defineFactory` produces** (REQ-ATH-01), the resolved `input`, and an
  optional `seed`. `seed` is the SOLE seeding channel (`Record<string,string>`; owner ruling)
  — no disk/env fallback (ATH-11).
- Because `RecordingClient` and `EngineClient` are structurally IDENTICAL (same four members,
  same signatures), the two types are **mutually assignable under `strictFunctionTypes`** —
  the contravariant parameter check is satisfied in both directions by structural identity,
  not by bivariance (ARCH-m1). The author's `defineFactory<O>(fn)` runner (typed with
  `EngineClient`) therefore accepts the facade's client — no port type is named in the facade.
- **Param naming (TW-m5)**: the first parameter is named **`factory`** — author vocabulary,
  matching the spec's own framing ("the function `defineFactory` produces") and reading
  naturally at the call site; rejected: `runner` (technically what `defineFactory` returns, but
  it leaks kit-lifecycle vocabulary into the author surface). FIT-04 freezes the name via the
  emitted `.d.ts`.
- Body: `const fake = new ContractFake({ seed: seed ?? {} }); const emitted: Batch[] = [];
  const client: RecordingClient = { emit(b){ emitted.push(b); return fake.emit(b); }, read:
  (p)=>fake.read(p), commit:()=>fake.commit(), discard:()=>fake.discard() };` then
  `try { await factory(input, { client }); } catch (e) { error = e; }` and return
  `{ tree: fake.committedTree(), emitted, error }`. The runner (`defineFactory`) owns
  flush→commit / discard→rethrow; the harness only records and captures.

**FIT-08 per-path allowlist data model** (REQ-TES-03): replace the single flat
`KIT_SYMBOL_NAMES` ban with `SCANNED: Array<{ path; valueAllow: string[]; typeAllow:
string[] }>`. `./testing` entry = `{ path: src/testing/index.ts, valueAllow:
["defineFactory","runFactoryForTest"], typeAllow: ["Batch","Directive"] }`. A re-export of
an allowlisted symbol from `../core` is permitted on its path; every other kit symbol —
`ContractFake` included, value or type (SEC-M3) — stays banned. `.`/`./commons`/`./conformance`
keep the full ban (empty allowlists). `./testing` MUST be a MEMBER of the scanned set
(REQ-TES-03.3) — removing it instead of allowlisting fails a membership assertion.

**Wildcard ban by form (SEC-M1, corrected rev 4 / GAP-4)**: on every scanned path, any
`export *` or `export * as ns` statement is a violation BY FORM — allowlisted paths enumerate
their export names exhaustively, so a wildcard can never be validated against an allowlist —
with EXACTLY ONE specifier-exact grandfathered exemption: `src/index.ts` may star-re-export
from EXACTLY `./commons/index.ts` (the umbrella's pre-existing legitimate form — verified:
that file is today a single `export * from "./commons/index.ts"` line and IS in FIT-08's
scanned set, so the rev-2 unqualified ban would have flagged it). ANY other wildcard — any
other specifier, any other scanned file, and especially `src/testing/index.ts` — remains a
violation by form. This closes the hole where `export * from "./contract-fake.ts"` in the
facade would ship `ContractFake` as a value while evading the name-based scan (and
FIT-10/FIT-04/FIT-17 too — none of them scans the facade's export FORM), without flagging the
umbrella's existing shape. TWO red-proofs (§4.6 TES-03 row): (a) a fixture facade source
containing `export * from "./contract-fake.ts"` IS flagged; (b) a fixture umbrella source
containing a wildcard to any NON-`./commons/index.ts` specifier (e.g.
`export * from "./core/index.ts"`) IS flagged — proving the exemption is specifier-exact,
not file-wide.

**Scan universe (ARCH-M1)**: FIT-08's per-path allowlist relaxes ONLY the kit-symbol /
`../core`-re-export ban — locally-DECLARED non-kit exports (e.g. `RunResult`, declared in the
facade itself) are OUTSIDE FIT-08's universe and need no allowlist entry. `RunResult` stays
exported (authors need the type to annotate results) and joins FIT-06's `@example` scope
instead (§4.2 fit-06 row).

**Doc homes (TW-M3, TW-m1)**: the `instanceof AuthoringError` narrowing idiom is documented in
`runFactoryForTest`'s `@example` (a rejection assertion with the `instanceof` branch);
`RunResult.error`'s field doc states "undefined on success" explicitly — the type alone cannot
say it. The seeded-read worked example lives in the README testing section (satisfies
REQ-TSD-01.4's either-home clause).

**FIT-10 allow-list** (REQ-TES-07): `ALLOW_LISTED_PATH` transitions to EXACTLY
`src/testing/contract-fake.ts` (single string, never a `src/testing/**` glob). The facade and
every other `src/**` file naming `EngineClient`/`EmitRejection` is caught.

## 4.5 ADRs (drafts under `openspec/decisions/`, DRAFT until archive)

Numbered 0032–0035 (0027–0031 are stage-4 drafts; verified `openspec/decisions/` latest = 0031).
Each ADR is its own draft FILE (§4.2 Create rows). The edit to `0009-*.md` is an amendment
STUB cross-referencing ADR-0032 — the amendment's decision text lives in 0032, never inlined
into 0009 (TW-M1/ARCH-m2).

### ADR-0032: Third audience `author-testing` (ADR-0009 amendment)

**Status**: Proposed
**Context**: `defineFactory` and the normative fake are unreachable from an installed
package; ADR-0009 defines exactly two audiences (author/contributor). Authors need a
supported test surface without repealing the kit boundary.
**Decision**: Amend ADR-0009 with a literal THIRD audience `author-testing`, surfaced through
its OWN subpath `./testing` (not folded into `./commons`), shipping **0.x semver-exempt**
(mirroring the kit) until real use validates the result shape. `./core` stays unmapped;
production graduation deferred to Stage 6. The two-audience author/contributor split is
extended, never rewritten.
**Consequences**: (+) authors get a reachable harness; result-shape iteration stays cheap
under 0.x. (−) a third published entry enlarges supply-chain surface (mitigated by FIT-17).
(→) enables the installed-consumer e2e as the outcome-proof.
**Alternatives**: `runFactoryForTest` in `./commons` — rejected: mixes a test harness into
the author-runtime surface and drags the fake into the commons bundle (blows FIT-03 budget +
containment). Wiring `./core` into exports — rejected: repeals ADR-0009, semver-locks the
whole kit prematurely (blind-rejected by architect+security).

### ADR-0033: `./testing` containment strategy (six structural guards)

**Status**: Proposed
**Context**: relocating the fake into shipped `src/` raises the stakes — test-only machinery
must never reach a production bundle, and the guards keyed to the fake's old test-path must
transition without widening into carve-outs.
**Decision**: containment is structural + fail-closed across six guards: (1) **FIT-17**
dev-only bundle guard — minified `bun build` of `.`/`./commons`/`./conformance` asserts
`CONTRACT_FAKE_PREFIX` ABSENT, and (mandatory positive control) PRESENT in the `./testing`
bundle; the literal is IMPORTED from `rejection-messages.ts` (never re-hardcoded). (2)
**FIT-08** per-path allowlist + wildcard-re-export ban by form, with the single
specifier-exact grandfathered exemption `src/index.ts` → `./commons/index.ts` (§4.4, SEC-M1 +
GAP-4 — the umbrella's pre-existing star re-export is legitimate; every other wildcard on any
scanned path is a violation by form). (3) **FIT-10**
single-path allow-list transition (§4.4). (4) **FIT-07** glob PINNED to `src/core/**` — NOT
widened to `src/testing/**` (the relocated fake holds a path-keyed tree that FIT-07 would
wrongly flag; spec SEC-M2 note). (5) **FIT-04** dts baseline granularity = **entry-only**
`dist/testing/index.d.ts` — chosen over the whole-`dist/testing/**` alternative, which was
REJECTED because it monitors non-public fake internals (unshipped-as-surface, like today's
`dist/core/**`) and churns baselines on every internal fake refactor while entry-only still
catches removal of every public export line (ARCH-m5 — recorded inline so this ADR stands
alone at archive promotion). (6) **dts negative declaration-scan** (council SEC-M2):
`dist/testing/index.d.ts` MUST NOT match `\b(EngineClient|EmitRejection)\b` — FIT-10 scans
sources only and FIT-04 is removal-only, so declaration emit could resurface port names
undetected; housed as a companion assert on FIT-04's testing row (§4.7). Design note
(SEC-m1 spec note, non-binding): FIT-17 MAY add a second structural marker (a characteristic
fake method-set) alongside the literal; left to executor discretion.
**Consequences**: (+) every containment surface fail-closed and drift-proof; (−) FIT-17 adds
per-entry minified builds to suite cost (mitigated by shared-build, §4.6a). (→) proves the
fake ships reachable ONLY via `./testing`.
**Alternatives**: conditional (fail-open) `exports` routing as the containment mechanism —
rejected: fail-open; REQ-TES-04.3 red-proofs that a conditional-routed bundle still
carrying the literal is caught. Directory-level FIT-10 exemption (`src/testing/**`) —
rejected: reopens the port-bleed hole (REQ-TES-07.3).

### ADR-0034: Fake relocation + parity-by-identity

**Status**: Proposed
**Context**: the fake must live in `src/` to ship, but 25 importers + FIT-11 depend on the
`test/support/` path, and a second physical fake would silently drift from the normative one.
**Decision**: git-move `contract-fake.ts` AND `rejection-messages.ts` into `src/testing/`;
leave BOTH old paths as **pure re-export shims**. Parity is enforced by **reference identity**
(`===` on the exported class / value equality on the constants), not a behavioural suite. A
fitness test fails closed if either shim regresses into a re-declared body. `rejection-messages`
resolution: SHIM (not repoint) — keeps FIT-11's direct import and all importers uniform under
one relocation pattern.
**Consequences**: (+) one physical fake, zero importer churn, drift impossible by construction;
(−) the fake now compiles under production-strict flags and its `.d.ts` ships (a real new
tarball surface, arch M3 — not mechanical). (→) the harness reuses the exact fake every test
already trusts.
**Alternatives**: behavioural parity suite — rejected: two impls can pass while independently
drifting; identity cannot be spoofed. Keep fake in `test/` + widen build `rootDir` — rejected:
fights the `rootDir:"./src"`/`exclude:["test"]` invariant every FIT-04/FIT-09 dist assertion is
keyed to.

### ADR-0035: Installed-consumer-vantage e2e lifecycle

**Status**: Proposed
**Context**: the owner's outcome-proof requires proving reachability from a real installed
consumer — exercising the `exports` map, which a relative `dist` import never does. No repo
precedent (PM M3).
**Decision**: `ensureTscBuild()` → `bun pm pack` → scratch dir `.tmp-testing-e2e/` at repo
root (FIT-03 `.tmp-`-prefix idiom) with its OWN `package.json` declaring
`"@pbuilder/sdk": "file:<abs tarball>"` → `bun install --ignore-scripts` with
`BUN_CONFIG_REGISTRY=http://127.0.0.1:9` (non-routable — any accidental network dependence
fails LOUDLY instead of silently fetching; SEC-m2) (cwd=scratch: isolated lockfile, repo
lockfile untouched — backed by a repo-lockfile HASH-UNCHANGED assert before/after the install)
→ a consumer script imported/spawned FROM the scratch dir imports `@pbuilder/sdk/testing` +
`@pbuilder/sdk/commons` BY NAME, and asserts `@pbuilder/sdk/core` rejects resolution.
Offline-safe (zero runtime deps, FIT-14; only the local tarball installs). Runs **serial**;
`afterAll` always `rm -rf` scratch+tarball. **S-000 spike-first**: the
walking skeleton proves pack→install→import-by-name→run-a-factory BEFORE the behavioural
scenarios layer on.
**Consequences**: (+) the only mechanic that proves installed-consumer reachability; subsumes
pending row W1. (−) heaviest single test (full build + pack + install). (→) closes the
founding-bug loop at the published vantage (write-only + rejection scenarios).
**Alternatives**: relative `import("dist/testing/index.js")` (explore C1) — rejected: never
exercises the `exports` map, the exact gap the owner's amendment targets.

## 4.6 Test Derivation

| REQ-ID (scenarios) | Level | Test | Flow ref |
|---|---|---|---|
| ATH-01.1, .2 | integration | `test/fake/harness-result.test.ts` | Author tests factory |
| ATH-01.3 | architectural | `test/fitness/fit-08-no-kit-bleed.test.ts` | — |
| ATH-02.1 | integration | `test/fake/harness-result.test.ts` | Author tests factory |
| ATH-03.1, .2 | integration | `test/fake/harness-result.test.ts` | Author tests factory |
| ATH-04.1, .2 | integration | `test/fake/harness-result.test.ts` | — |
| ATH-05.1 | integration | `test/fake/harness-result.test.ts` | — |
| ATH-06.1 | integration | `test/fake/harness-result.test.ts` | — |
| ATH-07.1, .2 | integration | `test/fake/harness-result.test.ts` | — |
| ATH-08.1 | integration | `test/fake/harness-result.test.ts` (escaped-callback) | — |
| ATH-09.1, .2 | integration | `test/fake/harness-result.test.ts` (~4 MiB cap fixture) | — |
| ATH-10.1 | integration | `test/fake/harness-result.test.ts` | — |
| ATH-11.1 | integration | `test/fake/harness-in-memory-invariant.test.ts` | — |
| ATH-11.2 | integration | `test/fake/harness-opted-in.test.ts` — **STAGE-4-MERGED-DEPENDENT** (never main-today-buildable) | — |
| ATH-12.1, .2 | architectural | `test/fake/harness-leak-scan.test.ts` | — |
| ATH-13.1 | integration | `test/fake/harness-opted-in.test.ts` — **STAGE-4-MERGED-DEPENDENT**; interim asserts plain-`Error` message + empty tree/emitted; `instanceof`/`reason` re-verified post stage-4 S-006 | — |
| ATH-13.2 | integration | `test/fake/harness-opted-in.test.ts` — **STAGE-4-MERGED-DEPENDENT** | — |
| TES-01.1 | architectural | `test/fitness/fit-09-pkg-exports-resolution.test.ts` | — |
| TES-02.1 | e2e | `test/e2e/installed-consumer.e2e.test.ts` | Installed-consumer |
| TES-03.1, .2, .3, .4 | architectural | `test/fitness/fit-08-no-kit-bleed.test.ts` (+ SEC-M1 wildcard red-proofs ×2: facade `export * from "./contract-fake.ts"` IS flagged; umbrella wildcard to a non-`./commons/index.ts` specifier IS flagged — exemption is specifier-exact, GAP-4) | — |
| TES-04.1, .2, .3, .4 | architectural | `test/fitness/fit-17-testing-dev-only-bundle.test.ts` | — |
| TES-05.1, .2 | architectural | `test/fitness/fit-04-dts-semver-gate.test.ts` | — |
| TES-06.1, .2, .3 | e2e | `test/e2e/installed-consumer.e2e.test.ts` | Installed-consumer |
| TES-07.1, .2, .3 | architectural | `test/fitness/fit-10-engine-client-port-guard.test.ts` | — |
| FSP-01.1 | architectural | `test/fitness/fit-18-fake-single-source-parity.test.ts` | — |
| FSP-02.1 | integration | `test/fitness/fit-18-fake-single-source-parity.test.ts` (`===`) | — |
| FSP-03.1 | architectural | `test/fitness/fit-18-fake-single-source-parity.test.ts` | — |
| FSP-04.1 | architectural | `test/fitness/fit-18-fake-single-source-parity.test.ts` (red-proof) | — |
| TSD-01.1 | integration | `test/docs/testing-story-docs.test.ts` (copy-runnable) | — |
| TSD-01.2, .3, .4 | contract | `test/docs/testing-story-docs.test.ts` (token asserts — pinned sets below, GAP-5) | — |
| TSD-02.1, .3 | architectural | `test/fitness/fit-06-example-jsdoc.test.ts` (scan + cascade red-proof) | — |
| TSD-02.2 | contract | `test/fitness/fit-06-example-jsdoc.test.ts` (token assert: `0.x` + `semver-exempt`, GAP-5) | — |
| TSD-03.1 | contract | `test/docs/testing-story-docs.test.ts` (stage-4's byte-exact qualifying-line literal ABSENT) | — |
| TSD-03.2 | architectural | slice-deferral state (followup register — no runtime surface) | — |
| TSD-04.1 | contract | `test/docs/testing-story-docs.test.ts` (token asserts: `author-testing` + `./testing` + `0.x`) | — |

**Docs token pins (GAP-5)** — the docs tests assert TOKEN PRESENCE, never full sentences, so
executors go green deterministically while prose stays author-free. Pinned sets, scoped to the
README testing section / the named JSDoc block: TSD-01.2 + TSD-02.2 stability = BOTH `0.x` AND
`semver-exempt`; TSD-01.3 boundary = `./conformance`; TSD-01.4 seeded read = `runFactoryForTest`
AND `seed` co-occurring in the section's code example; TSD-04.1 amendment = `author-testing`
(spec-pinned literal) AND `./testing` AND `0.x`. TSD-03.1 needs no token pin — it asserts the
ABSENCE of stage-4's byte-exact qualifying-line literal (already deterministic).

All 28 REQ-IDs covered (V3: +ATH-13; +scenarios ATH-11.2/13.1/13.2, all three in the
stage-4-merged-dependent set — never claimed main-today-buildable). Both Create flows gain
e2e rows (TES-02/06 in `installed-consumer.e2e.test.ts`).

### 4.6a Shared build fixture (Suite-Cost design constraint)

`test/support/shared-build.ts` exports two memoized helpers, module-singletons within the
single `bun test` process: `ensureTscBuild()` runs `bun run build` (tsc) AT MOST ONCE and
returns `dist/` — consumed by **FIT-04** (dts diff) and the **e2e** (pack input), whose build
inputs are identical. `ensureMinifiedEntry(entry)` runs `bun build --minify --outfile` once
per entry, cached by entry key — consumed by **FIT-17**'s four per-entry scans. This satisfies
the binding Suite-Cost clause: one tsc build shared where inputs match; minified builds
deduped by entry. The `.tmp-` scratch outputs are unique-named and cleaned in `afterAll`.
FIT-04's W7 "unconditional rebuild" header comment is UPDATED in the same slice (ARCH-m4):
the memoized one-fresh-build-per-process mechanic preserves W7's invariant (never trust a
stale `dist/`) — the comment must describe the new mechanic, not the removed per-test rebuild.

### 4.6b In-memory instrumentation (ATH-11)

`harness-in-memory-invariant.test.ts` wraps a full-verb run with call-interception spies on
`node:fs`, `node:net`, `Bun.write/file/spawn/$/connect`, and global `fetch`, plus Proxy GET
traps on `process.env`/`process.argv`, asserting zero calls and zero property-gets for the
run's duration. Instrumentation is TEST-side; the harness source touches none of these
surfaces. Independently falsifiable from ATH-12 (leak scan) — the two are separate tests.
Executor note (SEC-m3, optional): a `node:child_process` spy MAY be added to the instrumented
set — strengthening only, no spec change (REQ-ATH-11.1's enumerated list stays the floor).

**Instrumentation window scoping (ATH-11.2, V3 re-scope)**: the invariant governs harness
MACHINERY only — the spies stay armed for the run's FULL duration (never disarmed around the
factory), and the assertion is scoped by an **event allowlist predicate over the recorded
calls**, not by narrowing the window: for an opted-in factory, exactly the `node:fs` read
events whose resolved target path equals `<packageDir>/schema.json` (the factory-under-test's
own declared stage-4 read) are OBSERVED-NOT-FLAGGED; every other recorded event — network,
env/argv property-gets, and any disk touch attributable to `runFactoryForTest`, the fake, the
spy wrapper, or the seeding path — still fails the run. Fail-closed is preserved: an
unexpected path, a write, or a second I/O surface is a violation even during the factory's
own execution. ATH-11.1 (non-opted-in) keeps the strict zero-events assertion with the same
armed window.

## 4.7 Fitness Functions

- **FIT-17** (new) dev-only bundle containment: ADR-0033 (1). Shares `ensureMinifiedEntry`.
  Bundled entries are the **`src/` entry files** (`src/index.ts`, `src/commons/index.ts`,
  `src/conformance/index.ts`, `src/testing/index.ts`), mirroring FIT-03's idiom (SEC-m1):
  equivalence with dist holds because tsc emits `dist/` 1:1 per-module (no bundling), so the
  `src` import graph IS the `dist` import graph `bun build` resolves. Recorded assumption:
  `package.json` declares NO `sideEffects` field — FIT-17 asserts its absence, so bundler
  tree-shaking semantics cannot silently diverge between the scan and a consumer's build.
- **FIT-08** (modified) per-path allowlist + wildcard ban by form: §4.4 / ADR-0033 (2), SEC-M1.
- **FIT-10** (modified) single-path allow-list transition: §4.4 / ADR-0033 (3) / REQ-TES-07.
- **FIT-07** (modified) glob pinned to `src/core/**`, comment de-staled: ADR-0033 (4).
- **FIT-04** (modified) **entry-only** `./testing` baseline = ONE new `DTS_PAIRS` row
  (`testing.index.d.ts` ↔ `dist/testing/index.d.ts`). Rationale: whole-`dist/testing/**`
  would monitor NON-public fake internals (unshipped-as-surface, like today's `dist/core/**`)
  and churn baselines on every internal fake refactor; entry-only still catches removal of the
  `defineFactory`/`runFactoryForTest`/`Batch`/`Directive` public lines (REQ-TES-05.2 — the
  type-only re-export lines live in `index.d.ts`). ADR-0033 (5). **Housing decision (SEC-M2)**:
  the negative declaration-scan — `dist/testing/index.d.ts` MUST NOT match
  `\b(EngineClient|EmitRejection)\b` — lives HERE as a companion assert on the testing row
  (FIT-04 already reads that exact file via `ensureTscBuild`; FIT-17 scans minified JS, not
  dts). ADR-0033 (6).
- **FIT-09** (modified) 3→4 keys; `./core` still asserted absent.
- **FIT-06** (modified) `PUBLIC_PATHS` += `src/testing/index.ts`; re-export cascade reaches
  `defineFactory` (context.ts) + `Batch`/`Directive` (wire.ts) origins; `RunResult` in scope;
  stability-language assert (TSD-02.2).
- **FIT-18** (new) reference-identity parity (FSP) — claims the next free FIT number (TW-m4)
  rather than sitting unnumbered outside the series.

## 4.8 Migration / Rollout

Pre-v1, unpublished; every step git-reversible (proposal Rollback).

**Sequencing (binding)**: 4b builds strictly AFTER `stage-4-typed-options` archives/merges and
rebases on it. Rows depending on the **stage-4-merged** state: `README.md` qualifying-line
revert (TSD-03 — the line only exists post stage-4 REQ-FPS-05.4; if absent at build time the
TSD-03 slice is **DEFERRED as a followup, never silently dropped** — REQ-TSD-03.2);
`fit-14-package-surface.test.ts` + `pkg-surface-baseline.json` (stage-4-created; `./testing`
enters the exports snapshot — regenerated in the SAME slice as the `package.json` exports
edit); `src/core/context.ts` `defineFactory` `@example` (stage-4-added — verified present, the
FIT-06 cascade relies on it); **`test/fake/harness-opted-in.test.ts` + its fixture**
(ATH-11.2/ATH-13.1/13.2 — `defineFactory(fn, { packageDir })` does not exist on main-today;
Cross-Change Note 7: if stage-4's merged opt-in shape shifts before build, these scenarios
re-verify at rebase). Everything else builds on main-today shape. Stage-4 must promote
its ADR drafts (0027–0031) before 4b's 0032–0035 are claimed.

**Slice guidance**: **S-000 = walking skeleton** = the ADR-0035 pack/install spike + the fake
relocation + shims (unblocks everything). No Stage-2 coupling anywhere in this change (the
harness surfaces Stage-2's already-merged `AuthoringError` via the emit seam; it constructs
none).

**Archive grooming obligations** (carried to `sdd-archive`): (1) rewrite/retire pending row
**W1** — REQ-TES-06 subsumes its pack→install mechanic. (2) `sensitive-areas.md` **row 1**
(supply-chain) gains `./testing` as a published entry carrying the fake; **row 6** (public-api)
FIT-10 allow-list note now spans `src/**`. (3) register **Stage-6 `./core` production
graduation** as a pending change (PM M4). (4) if TSD-03 deferred, register the README revert as
a followup.

## 4.9 Performance

No hot path. `runFactoryForTest` is dev-time, in-memory (Map-backed fake). Suite wall-time is
the only cost lever — bounded by the shared-build fixture (§4.6a): ~1 tsc build (FIT-04+e2e) +
4 minified entry builds (FIT-17) + 1 pack/install (e2e), versus the naive per-test rebuild.

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: derives from 4.2c — no baseline component is removed and the layered-modules-
behind-an-IR-seam pattern is intact (not `breaking`), but two `deviates` rows change documented
boundaries: ADR-0032 amends the ADR-0009 audience boundary, and ADR-0034 shifts a data-ownership
line (the normative fake moves from test-owned/unshipped to src-owned/shipped surface). The new
`src/testing/` module joining the existing single layer is additive, but the boundary amendments
lift the class to `modifying`. Triggers `arch_refresh_post_verify` post-build.

## 4.11 Open Questions

None.

## 4.12 Rev 1 → Rev 2 Delta (blind design-council)

| # | Finding (lens) | Disposition |
|---|---|---|
| 1 | SEC-M1 wildcard re-export evasion | APPLIED — §4.4 wildcard-ban-by-form clause (any `export *`/`export * as`, any specifier, on every scanned path = violation); red-proof fixture on §4.6 TES-03 row; fit-08 File Changes row updated; ADR-0033 guard (2) wording |
| 2 | SEC-M2 dts can resurface port names | APPLIED — negative declaration-scan `\b(EngineClient\|EmitRejection)\b` on `dist/testing/index.d.ts`; HOUSED as companion assert on FIT-04's testing row (it already reads that file via `ensureTscBuild`; FIT-17 scans minified JS, not dts) — §4.7 + ADR-0033 guard (6) |
| 3 | ARCH-M1 + TW-M2 (converged) RunResult ambiguity | APPLIED both ways — §4.4 scan-universe clause (per-path allowlist relaxes kit-symbol/core-re-export ban only; locally-declared non-kit exports OUTSIDE FIT-08's universe); `RunResult` stays exported + joins FIT-06 `@example` scope (facade + fit-06 rows) |
| 4 | TW-M1 + ARCH-m2 ADR files not in File Changes | APPLIED — four Create rows (`0032-third-audience-author-testing.md`, `0033-shipped-fake-containment.md`, `0034-fake-relocation-parity-by-identity.md`, `0035-packed-tarball-e2e-lifecycle.md`); §4.5 intro: the 0009 Modify row is an amendment STUB cross-referencing 0032 |
| 5 | TW-M2 facade JSDoc obligations scattered | APPLIED — facade Create row carries the full TSD-02 checklist (@example complete test, @param seed, 0.x sentence, boundary reference, RunResult @example + field docs) |
| 6 | TW-M3 instanceof idiom doc home unpinned | APPLIED — §4.4 doc-homes clause: `runFactoryForTest` `@example` includes a rejection assertion with the `instanceof AuthoringError` branch; `RunResult.error` field doc states "undefined on success" explicitly |
| 7 | ARCH-m1 "bivariantly assignable" wrong mechanism | APPLIED — §4.4: mutual assignability via structural identity under `strictFunctionTypes` (contravariant params satisfied in both directions) |
| 8 | ARCH-m4 FIT-04 W7 comment staleness | APPLIED — fit-04 File Changes row + §4.6a: header comment updated in the SAME slice as `ensureTscBuild`, describing the memoized one-fresh-build-per-process mechanic |
| 9 | ARCH-m5 ADR-0033 must stand alone | APPLIED — entry-only alternative + whole-tree rejection rationale inlined into ADR-0033 guard (5) |
| 10 | SEC-m1 FIT-17 entry ambiguity + sideEffects | APPLIED — §4.7: bundles the four `src/` entry files (FIT-03 idiom); equivalence via tsc 1:1 emission stated; `sideEffects`-absent assumption ASSERTED by FIT-17 |
| 11 | SEC-m2 e2e install hardening | APPLIED — ADR-0035: `bun install --ignore-scripts` + `BUN_CONFIG_REGISTRY=http://127.0.0.1:9` (non-routable, loud network failure) + repo-lockfile hash-unchanged assert |
| 12 | SEC-m3 child_process spy | APPLIED — §4.6b optional executor note (strengthening only, spec floor unchanged) |
| 13 | TW-m1 seeded-read home | APPLIED — README testing section is the chosen home (TSD-01.4); stated in §4.4 + README row |
| 14 | TW-m2 fit-06 row/§4.6 misalignment | APPLIED — fit-06 row now names the stability-language assert (TSD-02.2) |
| 15 | TW-m3 test filename scope | APPLIED — renamed `test/docs/readme-testing.test.ts` → `test/docs/testing-story-docs.test.ts` (all references) |
| 16 | TW-m4 parity test unnumbered | APPLIED — claims **FIT-18**; file renamed `fit-18-fake-single-source-parity.test.ts` |
| 17 | TW-m5 param name unpinned | APPLIED — §4.4: `factory` chosen (author vocabulary, spec's own framing); `runner` rejected (kit-lifecycle vocabulary leak); FIT-04 freezes it |
| 18 | TW-m6 context.ts @example fallback | APPLIED — Read-only row gains the fallback clause: absent at rebase time → this change ADDS it (FIT-06 cascade hard-depends), row flips to Modify |

Zero findings rejected. File Changes delta: +4 Create (ADR files), 2 renames, 6 row-text
amendments. No REQ touched — spec V2 stays read-only. Architecture impact unchanged
(`modifying`) — all rev-2 changes are guard/doc mechanics within the same touchpoint set.

## 4.13 Rev 2 → Rev 3 Delta (targeted — spec V3 micro-unfreeze, steward condition C1)

Steward foresight returned `aligned-conditional` (C1: harness × stage-4 opted-in factories);
owner answered CQ2 = YES; spec V3 signed same day (ATH-11 re-scoped to harness machinery,
new ATH-13 + scenarios 11.2/13.1/13.2, Cross-Change Note 7). Touch, not re-draft.

| # | V3 delta | Disposition |
|---|---|---|
| 1 | REQ-ATH-13 opted-in factory support | APPLIED — §4.3 semantics block: harness runs opted-in factories AS-IS, **zero harness code change** (explicit design claim, verified at build); `packageDir` lives in the definition, validation runs inside the runner pre-client, rejection lands in the existing `catch` → `result.error`, `tree` + `emitted` both empty. Interim (stage-4 Option A): plain `Error` — authors assert message + fail-closed empties; `instanceof AuthoringError`/`reason` only post stage-4 S-006; existing `AuthoringError \| unknown` typing covers both windows unmodified |
| 2 | REQ-ATH-11 re-scope (harness machinery only) | APPLIED — §4.6b window-scoping paragraph: spies armed the FULL run duration; assertion scoped by an event-allowlist PREDICATE (only `node:fs` reads whose resolved target = `<packageDir>/schema.json` are observed-not-flagged); everything else stays fail-closed; ATH-11.1 keeps strict zero-events |
| 3 | New scenarios ATH-11.2 / ATH-13.1 / ATH-13.2 | APPLIED — Test Derivation rows added, ALL marked STAGE-4-MERGED-DEPENDENT (mirroring TSD-03/FIT-14's gate), homed in new `test/fake/harness-opted-in.test.ts` + fixture `test/fixtures/harness-opted-in/schema.json` |
| 4 | File Changes | +2 Create rows (opted-in test file + fixture schema), both stage-4-merged-dependent; §4.8 sequencing set extended with them + Cross-Change Note 7 re-verify clause. NO production-source row changes — the harness supports opted-in factories with zero code delta |
| 5 | Coverage count | 27 → **28 REQ-IDs** (V3 index), all covered |

Architecture impact RE-AFFIRMED `modifying`: rev 3 adds test surface + semantics
documentation only — no new touchpoint, no boundary change beyond those already recorded
(ADR-0032/0034).

### Rev 3 → Rev 4 Delta (plan-verify iteration-1 gap fixes — surgical)

| # | Gap (Judge B) | Disposition |
|---|---|---|
| GAP-4 | Rev-2 wildcard-ban-by-form flags `src/index.ts`'s legitimate pre-existing `export * from "./commons/index.ts"` (verified: that IS the umbrella's whole body, and it IS in FIT-08's scanned set) | APPLIED — §4.4 clause corrected: EXACTLY ONE specifier-exact grandfathered exemption (`src/index.ts` → `./commons/index.ts` only); any other wildcard on any scanned path — any other specifier, any other file, especially the facade — stays a violation by form. Red-proofs now ×2: (a) facade `export * from "./contract-fake.ts"` flagged (kept intact); (b) umbrella wildcard to a non-`./commons/index.ts` specifier flagged (exemption is specifier-exact, not file-wide). ADR-0033 guard (2) + fit-08 row + §4.6 TES-03 row updated |
| GAP-5 | Docs tests (FIT-06 stability assert; `testing-story-docs.test.ts`) had no canonical wording — executor cannot go green deterministically | APPLIED — TOKEN-LEVEL asserts pinned (§4.6 "Docs token pins" block + both file-change rows): TSD-01.2/TSD-02.2 stability = `0.x` + `semver-exempt`; TSD-01.3 boundary = `./conformance`; TSD-01.4 seeded read = `runFactoryForTest` + `seed` in the section's code example; TSD-04.1 = `author-testing` + `./testing` + `0.x`; TSD-03.1 = ABSENCE of stage-4's byte-exact qualifying-line literal (already deterministic). Surrounding prose stays author-free |

Nothing else touched (surgical scope, per the plan-verify routing). Architecture impact
UNCHANGED (`modifying`) — both fixes are fitness-mechanics/test-determinism refinements
inside already-recorded touchpoints.
