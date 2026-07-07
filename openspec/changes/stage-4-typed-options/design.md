# Design: stage-4-typed-options

**Spec version**: V4 (signed, owner 2026-07-07) · **Triage**: L · **Persona lens**: none · **Architecture impact**: modifying · **Design rev**: 5 (plan-verify iteration-3 literal pins applied — see §4.15 delta; iteration-2 fixes in §4.14; iteration-1 in §4.13; rev-2 blind design-council in §4.12)

## 4.1 Architecture Overview

`schema.json` becomes a factory's real input contract along three planes that never cross:
a **compile-time** plane (a shipped codegen bin derives `type Input` from `schema.json`;
the author supplies it as `defineFactory<Input>`), a **build-time** plane (fitness gates
prove schema↔type parity and schema sufficiency), and a **run-time** plane (`defineFactory`
validates the resolved input against the on-disk `schema.json` before `als.run`, fail-closed).

The shared schema logic (parse, validate, sufficiency, digest, discovery) lives in a new
`src/core/schema/` cluster — runtime-side, behind the existing IR-seam. The codegen bin lives
**outside** `src/` (in `bin/`), imports that cluster, and is bundled by `bun build` into
`dist/bin/` so the dependency arrow is strictly bin→core (FIT-15). The one seam the change
introduces is the run boundary in `defineFactory` (`context.ts`): a new pre-`als.run`
validation step, upstream of and distinct from the emit-seam the engine judges. That upstream
placement is a scoping amendment to ADR-0018, not a breach of it (ADR-0030).

## 4.2 File Changes

| Path | Action | Purpose |
|---|---|---|
| `src/core/schema/schema-model.ts` | Create | `Schema`/`SchemaProperty` types, recognized-kind set, reserved-name tokens |
| `src/core/schema/schema-parse.ts` | Create | Bytes → `Schema`; fail-closed, position locator, no raw echo (shared: bin + runtime + RBV-05) |
| `src/core/schema/schema-validate.ts` | Create | Resolved input → findings: missing/wrong-type/excess/non-JSON/reserved/proto keys; null-trichotomy; template-opaque |
| `src/core/schema/schema-sufficiency.ts` | Create | type/label/enum-choices/nonsensical-type/proto-key hard-fail; advisory fields pass (FIT-13) |
| `src/core/schema/schema-digest.ts` | Create | SHA-256 of schema bytes via `node:crypto` (bin embeds; FIT-12 recomputes) |
| `src/core/schema/schema-discovery.ts` | Create | Locate adjacent `schema.json` + reserved-name sibling files from a package dir |
| `src/core/schema/input-rejection.ts` | Create | Maps a finding → a thrown rejection carrying the pinned REQ-AEC-09 message literal. INTERIM (S-000..S-005): a plain `Error` (no Stage-2 coupling). S-006 UPGRADES it to `AuthoringError{origin,reason}` — the ONLY Stage-2-coupled module, and only at S-006 |
| `src/core/schema/index.ts` | Create | Barrel for the cluster |
| `bin/pbuilder-codegen.ts` | Create | CLI: parse → emit adjacent `schema.generated.ts`; usage/exit/stream discipline; write-containment (realpathSync anchor) |
| `bin/emit-type.ts` | Create | `Schema` + digest → `export type Input` text; **emitter-escaping contract** (SEC-1: every schema-derived string via `JSON.stringify`; identifier allow-list else quoted-property-key; labels escaped/`*/`-guarded or dropped); AUTO-GENERATED header literal |
| `src/core/context.ts` | Modify | `defineFactory<O>(fn, options?)`; pre-`als.run` reserved-name scan + schema validation; JSDoc `@example`(packageDir pit-of-success)/`@param`(tiers)/`@remarks`(reserved names) — the doc-assertion carrier (`definefactory-jsdoc.test.ts`, Gap 5, reads this file) |
| `package.json` | Modify | Add `bin` field; `build` script adds `bun build bin/…` step |
| `test/support/canary.ts` | Create | **Shared canary helper** (SEC-5): token generation, schema-fixture seeding, error-surface collector incl. subprocess stdout/stderr capture — consumed by all three rejection domains |
| `test/fixtures/typed-factory/*` | Create | Reference schematic: `factory.ts` + `schema.json` + `schema.generated.ts` |
| `test/fixtures/red/{schema,reserved,hostile}/*` | Create | **Deliberately-red root — NEVER walked by the always-on gates (§4.6a); red-proofs invoke the check function directly.** malformed, empty, staled-digest, proto-key input, **proto-declaring schema**, nonsensical-type, excess/reserved-input, **hostile-escape** (field/label/enum carrying breakout payloads), **unreadable** (EACCES dir + schema, chmod-000, root-guarded §4.6a), **symlink-escape**; reserved: `pre-execute.ts`, `post-execute.ts`, **`pre-execute/index.ts` dir-form**, exported `remove`. The CLEAN/positive reserved case is the reference schematic at `test/fixtures/typed-factory/` (no reserved sibling). |
| `test/support/scan-roots.ts` | Create | Exports the shared `ALWAYS_ON_SCAN_ROOTS` const (§4.6a) that FIT-12 and FIT-16 both import — the single source of the always-on walk allowlist |
| `test/bin/codegen-cli.test.ts` | Create | Bin CLI: TFO-03/04/05, FPS-01/05.1 (spawn, streams, exit, output); hostile-schema emitter-inertness red-proof |
| `test/bin/codegen-static-scan.test.ts` | Create | TFO-03.3 static parse-as-data scan of the shipped `dist/bin` artifact |
| `test/types/typed-factory-options.test.ts` | Create | TFO-01/02 compile-time + mutation-resistant negative proof |
| `test/skeleton/run-boundary-validation.test.ts` | Create | RBV-01/02/03/05 site + fail-closed + warnings |
| `test/skeleton/reserved-lifecycle-names.test.ts` | Create | RLN-01/02/03 |
| `test/security/canary-no-echo.test.ts` | Create | RBV-04 dictionary-seeded canary scan across all rejection branches |
| `test/fitness/fit-12-schema-parity.test.ts` | Create | Digest parity/drift gate (non-destructive) |
| `test/fitness/fit-13-schema-sufficiency.test.ts` | Create | Sufficiency gate |
| `test/fitness/fit-14-package-surface.test.ts` | Create | Exports unchanged + only `bin` added + zero-deps + tarball contents; diffs the regenerated surface against the committed baseline (Gap 11) |
| `test/fitness/pkg-surface-baseline.json` | Create | **FIT-14 committed baseline snapshot (Gap 11, FIT-04-style)**: `{ exports, files, tarball, bin, shebang }` — exports map + files array + expected tarball listing + `#bin` path + shebang-present flag; FIT-14 regenerates the actual surface and diffs against this |
| `test/fitness/fit-15-bin-core-direction.test.ts` | Create | No `src/` runtime module imports bin/codegen |
| `test/fitness/fit-16-reserved-name-scan.test.ts` | Create | **Always-on structural reserved-name scan** (SEC-2 hybrid): walks ONLY `ALWAYS_ON_SCAN_ROOTS` (§4.6a) for reserved sibling files (case-insensitive, dir-form) regardless of `packageDir`; also flags schema.json-present-but-`packageDir`-not-threaded (3rd signal); red fixtures live under `test/fixtures/red/**` (never walked) and the red-proof calls the scan function directly |
| `test/fitness/fit-07-no-tree-in-core.test.ts` | Modify | **Recursive walk** of `src/core/**` (ARCH-1: `src/core/schema/` subdir escapes the non-recursive readdirSync guard); re-run red-proof |
| `test/fitness/definefactory-jsdoc.test.ts` | Create | **FPS-05.2/.3 dedicated doc-assertion (Gap 5)**: reads `src/core/context.ts` and asserts `defineFactory`'s JSDoc carries `@example` (bin→typed workflow) + `@remarks` naming BOTH `pre-execute`/`post-execute`. FIT-06 (`fit-06-example-jsdoc.test.ts`) is LEFT UNTOUCHED — its `PUBLIC_PATHS` scans only `src/commons` + `src/conformance`, and `defineFactory` is exported from the internal-kit root `src/core/index.ts` (ADR-0009), so broadening FIT-06 to reach it would wrongly impose `@example` on every internal-kit export; a dedicated, symbol-targeted assertion is the pin |
| `test/e2e/typed-factory.e2e.test.ts` | Create | FPS-04 reference schematic end-to-end against `ContractFake` |
| `src/core/authoring-error.ts` | Read-only | Stage-2-owned; `origin`/`reason` extension is Stage 2's coordinated amendment, never edited here |

## 4.2b Flow Changes

| Flow | Action | REQ-IDs | E2E spec | Notes |
|---|---|---|---|---|
| Author a typed factory (run bin → typed `defineFactory`) | Create | TFO-01, FPS-04, FPS-05 | `test/e2e/typed-factory.e2e.test.ts` | the differentiator, engine-free |
| Run the codegen bin (CLI) | Create | TFO-03/04/05, FPS-01/05 | `test/bin/codegen-cli.test.ts` | process-level e2e (spawn) |
| Run-boundary input rejection | Create | RBV-01/02/05 | `test/e2e/typed-factory.e2e.test.ts` (reject variant) | pre-`als.run`, exhaustive at integration |
| Reserved-name rejection | Create | RLN-01/02 | `test/skeleton/reserved-lifecycle-names.test.ts` | runtime package-dir scan |
| No-schema / empty-schema opt-out warning | Create | RBV-03, RBV-05.2 | `test/skeleton/run-boundary-validation.test.ts` | loud, stateless, stderr |

## 4.2c Architecture Touchpoints

| Layer/Component | Action | Why | Baseline fit |
|---|---|---|---|
| `src/core/schema/*` (new cluster) | new | shared parse/validate/sufficiency/digest/discovery, joins the existing `core` layer | aligns |
| `defineFactory` run boundary (`context.ts`) | modify | new pre-`als.run` validation + runtime reserved-name step | deviates → ADR-0029/0027 |
| reserved-name enforcement (build-time fitness plane) | new | FIT-16 always-on structural scan complements the `packageDir`-gated runtime throw (hybrid, SEC-2) — joins the existing fitness-test layer | aligns |
| codegen bin (`bin/`, `dist/bin/`) | new | first executable distribution primitive; baseline has none | deviates → ADR-0027 |
| `package.json` public surface | modify | adds `#bin`; exports map + deps unchanged (FIT-14) | aligns |
| EngineClient port / emit seam | modify | scope-clarified: input-contract conformance is SDK-owned upstream; wire judgments stay engine-owned | deviates → ADR-0030 |

## 4.3 Data Model

```ts
// src/core/schema/schema-model.ts
export type SchemaKind = "string" | "number" | "boolean" | "enum";
export interface SchemaProperty {
  key: string; type: SchemaKind; label?: string; choices?: string[];
  default?: unknown; required?: boolean; description?: string; // last three advisory
}
export interface Schema { properties: SchemaProperty[]; } // array, NOT Record — FIT-07 clean
export const RESERVED_LIFECYCLE_NAMES = ["pre-execute", "post-execute"] as const;
```

Validation shape (RBV-01): all declared properties required unless `required: false`; input keys
outside `properties` reject (excess/closed shape); `null` on a non-nullable type is WRONG-TYPED,
never treated as missing; a non-JSON value (function) rejects; a key in `RESERVED_LIFECYCLE_NAMES`
or `__proto__`/`constructor`/`prototype` rejects. `required` is validation-relevant but sufficiency-advisory.

**Emitter mapping (`bin/emit-type.ts`)**: the exact `SchemaKind`→TypeScript table
(`string`/`number`/`boolean`→same; `enum`→union of `choices` literals; `required:false`→`key?:T`;
`label`→guarded JSDoc doc-comment) is pinned in **ADR-0027** — no prose hedging; TFO-01.1/.2 and FPS-04
assert it verbatim.

## 4.4 Interface Contracts

```ts
// src/core/context.ts — additive optional second parameter (backward-compatible)
export function defineFactory<O>(
  fn: (o: O) => void | Promise<void>,
  options?: { packageDir?: string | URL }
): (o: O, deps: { client: EngineClient }) => Promise<void>;
```

`packageDir` (author passes `import.meta.dir`) is the single opt-in that threads BOTH schema
discovery and the reserved-name scan. **Two opt-out tiers**: bare `defineFactory(fn)` (no
`options`) runs silently exactly as today (TFO-02); `defineFactory(fn, { packageDir })` opts into
the flow and is loud when schemaless (RBV-03). `packageDir?: string | URL` JSDoc (TW-m8, finding
2d/16): a `URL` means a **directory** URL; steer authors to `import.meta.dir`; explicitly warn
against `import.meta.url` (a FILE url — misuse). The `@example` shows the pit of success
`{ packageDir: import.meta.dir }`; `@param packageDir` explains the two tiers (surprising behaviour
lives in the `@param`, not an ADR); `@remarks` names `pre-execute`/`post-execute` as reserved
schematic-level lifecycle names + the namespace note (add/remove deferred to L2) — the dedicated
`definefactory-jsdoc.test.ts` (Gap 5) asserts both names appear (FPS-05.3, TW-M3).

**Diagnostic-prefix convention** (TW-m7): the bin uses `pbuilder-codegen:` (a standalone CLI,
argv0-style prefix); the runtime uses `[pbuilder]` (a library-emitted bracketed namespace tag) —
the split marks *which surface* spoke (process vs. imported library).

**Bin CLI contract** (`pbuilder-codegen <package-dir>`): `--help`/`-h`→usage to STDOUT exit 0;
no-args/bad-flag→usage to STDERR exit non-zero. Usage text (TW-m5) MUST contain its purpose and the
literal `pbuilder-codegen <package-dir>`. Success→exit 0 + fixed line
`pbuilder-codegen: wrote schema.generated.ts` on STDOUT. Malformed→STDERR non-zero, prior output
unchanged (non-destructive), author vocabulary; parse-error template (TW-m6) is
`pbuilder-codegen: <file>: <problem> (line L, column C)` — prefix + `(line L, column C)` locator are
contractual. Generated file header literal (TW-M4):
`// AUTO-GENERATED by pbuilder-codegen — do not edit. Regenerate: pbuilder-codegen <package-dir>`.
Runtime errors throw a **plain `Error`** interim (S-000..S-005) whose `.message` is the EXACT pinned
REQ-AEC-09 template literal — input-level `invalid input: {field} must be {expectedType}` (and the
reserved-input-key / malformed-schema variant rows) or reserved-name
`reserved lifecycle name: {name} is reserved and cannot be declared by a factory module`. This carries
NO Stage-2 coupling — the interim `AuthoringError{origin:"authoring-rejected"}` was UNCONSTRUCTIBLE
(Stage-2 derives `origin` from a closed `reason` enum, ADR-0021), so it is deliberately NOT constructed
before S-006. **S-006** (post `stage-2-error-attribution` archive + its coordinated `sdd-spec` amendment)
UPGRADES the throw to `AuthoringError{origin:"authoring-rejected", reason:"invalid-input"|"reserved-name"}`
and flips the `instanceof`/`origin`/`reason` assertions on. See §4.8's S-006-only gate.

**`{expectedType}` rendering per branch (AEC-09 input template `invalid input: {field} must be {expectedType}`
— iteration-3 pin 3).** `{expectedType}` always renders the DECLARED expectation, never the received value's
kind (no-echo): (a) primitive typed property → the declared `SchemaKind` string verbatim (`number`/`string`/
`boolean`), e.g. `invalid input: port must be number`; (b) a NON-JSON value (e.g. a function) supplied for a
typed property → still the DECLARED kind (`invalid input: port must be number` for a function-for-number — the
expectation, never `function`); (c) `null` for a required typed property → the DECLARED kind (null is a
WRONG-TYPE, not a missing key — the pinned trichotomy in §4.3), e.g. `invalid input: port must be number`;
(d) an enum property → `one of: <choices joined by ", ">`, e.g. `invalid input: mode must be one of: dev, prod`.
The four variants are pinned in the slices load-bearing-literals list.

**RBV-05.1 runtime malformed/invalid-shape schema literal (iteration-3 pin 2).** At the run boundary a
present-but-unparseable OR invalid-shape (missing `"properties"`) `schema.json` fails closed with the pinned
runtime literal (bracketed `[pbuilder]` namespace, `<dir>` locator, author-vocabulary `<problem>`):
`[pbuilder] factory at <dir>: schema.json could not be read: <problem> (line L, column C)` — with the
`(position unknown)` fallback branch when the engine `SyntaxError` carries no offset (shared locator machinery
above). ONE literal covers BOTH cases, `<problem>` distinguishing them (`invalid JSON` vs
`missing "properties" object`); it NEVER echoes file content or raw engine/parser text. Pinned in the slices
load-bearing-literals list. This is the RUNTIME counterpart of the bin's `pbuilder-codegen: <file>: …`
parse-error template — the prefix split (`[pbuilder]` vs `pbuilder-codegen:`) marks which surface spoke
(TW-m7). `<dir>` uses `path.relative(process.cwd(), packageDir)` — see §4.15 pin 5.

## 4.5 ADRs (drafts under `openspec/decisions/`, DRAFT until archive)

Numbered 0024–0028 to avoid collision with Stage 2's concurrently-drafted 0020–0023.

- **ADR-0027** — Codegen mechanism: hand-rolled zero-dep parser + **escaping emitter** (SEC-1); bin CLI/semver contract; `bun build` packaging; the bespoke `type`/`label`/`choices` format is the **SDK↔Go-CLI cross-repo wire contract** (ARCH-3), its evolution a two-party change.
- **ADR-0028** — Reserved-name declaration: kebab **filename convention**, **case-insensitive**, strip-extension + dir-form matching (TW-M2); **hybrid** runtime throw (`packageDir`) **+ always-on FIT-16 structural scan** (SEC-2); read-path fails closed on non-ENOENT (SEC-3).
- **ADR-0029** — Run-boundary validation placement + error-taxonomy wiring: pre-`als.run`; disk-discovered schema; fail-closed; **only ENOENT → opt-out; EACCES/EISDIR/etc → AuthoringError** (SEC-3); safe schema iteration (SEC-7); Stage-2 coupling isolated to `input-rejection.ts`.
- **ADR-0030** — ADR-0018 scoping amendment: author-input-contract conformance is SDK-owned upstream of the wire; path/serializability/conflict judgments stay engine-owned.
- **ADR-0031** — Package-shape discovery: `packageDir` threads schema + reserved-name discovery (**trusted author-authority dev-time input**, SEC-6); **realpathSync write-containment anchor** (SEC-4); fixed adjacent output; two opt-out tiers; relative-path warning placeholders (TW-m9); orphan-schema + **bundled/transpiled** known limitations (ARCH-m5).

## 4.6 Test Derivation

| REQ-ID (scenarios) | Level | Test | Flow ref |
|---|---|---|---|
| TFO-01 (.1,.2) | unit(type) | `test/types/typed-factory-options.test.ts` — TFO-01.2 negative-compile (Gap 7) via `@ts-expect-error` lines in this dedicated `test/types/` file, which lives in the MAIN `tsc --noEmit` set (repo precedent: the typed-create matrix). A `@ts-expect-error` on a line that fails to error turns `tsc` RED (unused-directive) — that reddening IS the proof; no `expect-type` dependency | Author typed factory |
| TFO-01 (emitter-escaping, SEC-1) | contract | `test/bin/codegen-cli.test.ts` (hostile-schema fixture → generated `.ts` inert: compiles, no statement/import executes) | Run bin |
| TFO-02 (.1) | unit(type) | `test/types/typed-factory-options.test.ts` | — |
| TFO-03 (.1,.2,.3) | contract | `test/bin/codegen-cli.test.ts`; `test/bin/codegen-static-scan.test.ts` | Run bin |
| TFO-04 (.1–.6) | e2e | `test/bin/codegen-cli.test.ts` | Run bin |
| TFO-05 (.1,.2,.3 + symlink-escape SEC-4) | e2e | `test/bin/codegen-cli.test.ts` — TFO-05.2 red-proof spawns `bun dist/bin/pbuilder-codegen.js ../../etc` (Gap 9: Bun is the guaranteed CI runtime; it executes the node-target bundle) and asserts REFUSED (exit≠0, nothing written); symlink fixture asserts **post-`realpathSync` containment** against the invoking-process project root (Gap 3, ADR-0027) — a symlink whose real target escapes the anchor is refused | Run bin |
| SCP-01 (.1–.4) | architectural | `test/fitness/fit-12-schema-parity.test.ts` | — |
| SCP-02 (.1–.6 + proto-declaring schema SEC-7) | architectural | `test/fitness/fit-13-schema-sufficiency.test.ts` | — |
| RBV-01 (.1–.8) | integration | `test/skeleton/run-boundary-validation.test.ts` | Run-boundary rejection |
| RBV-02 (.1) | integration | `test/skeleton/run-boundary-validation.test.ts` | Run-boundary rejection |
| RBV-03 (.1) | integration | `test/skeleton/run-boundary-validation.test.ts` | Opt-out warning |
| RBV-04 (.1,.2) | integration | `test/security/canary-no-echo.test.ts` | — |
| RBV-05 (.1,.2 + non-ENOENT fail-closed SEC-3) | integration | `test/skeleton/run-boundary-validation.test.ts` (adds EACCES/EISDIR unreadable-schema + unreadable-dir fixtures — chmod-000, **root-guarded** per §4.6a) | Run-boundary / opt-out |
| RLN-01 (.1–.4) | integration | `test/skeleton/reserved-lifecycle-names.test.ts` | Reserved-name rejection |
| RLN-01 (structural scan, SEC-2 hybrid) | architectural | `test/fitness/fit-16-reserved-name-scan.test.ts` (case-insensitive, dir-form, `packageDir`-independent; 3rd-signal warning; red-proof) | — |
| RLN-02 (.1) | integration | `test/skeleton/reserved-lifecycle-names.test.ts` | Reserved-name rejection |
| RLN-03 (.1,.2) | integration | `test/skeleton/reserved-lifecycle-names.test.ts` | — |
| FPS-01 (.1) | contract | `test/bin/codegen-cli.test.ts` | Run bin |
| FPS-02 (.1,.2) | architectural | `test/fitness/fit-14-package-surface.test.ts` | — |
| FPS-03 (.1) | architectural | `test/fitness/fit-15-bin-core-direction.test.ts` | — |
| FPS-04 (.1) | e2e | `test/e2e/typed-factory.e2e.test.ts` | Author typed factory |
| FPS-05 (.1,.2,.3) | contract | `test/bin/codegen-cli.test.ts`; `test/fitness/definefactory-jsdoc.test.ts` (Gap 5 dedicated doc-assertion) | Run bin |
| AEC-07/08/09 (deferred) | integration | asserted post-amendment in RBV/RLN files | Run-boundary / reserved-name |

`instanceof AuthoringError`, `origin`, and `reason` (RBV-01/02, RLN-02) and AEC-07/08/09 are asserted
only in S-006, after the Stage-2 amendment. INTERIM (S-000..S-005) the rejection is a plain `Error`,
and those files assert SITE + fail-closed + the EXACT pinned message literal + no-echo — NONE of the
three deferred class facets (Option A, interim-behaviour clause). S-006 upgrades the throw to
`AuthoringError` and flips those assertions on.

### 4.6a Test infrastructure — fixture roots, always-on walk scope, root-guard (Gaps 5 & 6)

**Fixture-root split + always-on walk scope (Gap 5).** The always-on fitness gates that WALK a tree —
**FIT-12** (parity) and **FIT-16** (reserved-name structural scan) — scan ONLY an explicit allowlist of
REAL packages, shared as a single const both gates import:
`export const ALWAYS_ON_SCAN_ROOTS = ["test/fixtures/typed-factory"] as const;` (the reference schematic;
`src/core/schema/discovery.ts` or a `test/support/scan-roots.ts` module owns it). Deliberately-red fixtures
live under a SEPARATE root, `test/fixtures/red/**`, which the always-on gates NEVER walk. Red-proofs do not
rely on a walk finding a planted fixture — they invoke the underlying check FUNCTION DIRECTLY against the
red-fixture input (e.g. FIT-16's scan function called on `test/fixtures/red/reserved-pre-execute/`, FIT-12's
digest-compare called on a staled-digest fixture). This removes the "allowlist a negative inside the walked
tree" coupling: negatives are simply outside the walk, and their red-proofs are direct-call. FIT-13
(sufficiency), FIT-14 (package surface), FIT-15 (bin→core) are NOT tree-walks over fixtures — FIT-13 drives
its hard-fail matrix by direct function calls on `test/fixtures/red/schema/*`; FIT-14/15 scan `package.json`
/ `src/` — so none of them can trip on a planted red fixture either.

**Typecheck set — red fixtures are tsconfig-excluded (iteration-2 Gap 6).** `test/fixtures/red/**` is
added to the root `tsconfig.json` `exclude` array (alongside the existing `test/types/permissive-proof.ts`
entry) so the deliberately-broken/hostile fixtures — malformed schema JSON, hostile-escape payloads,
reserved `pre-execute.ts`/`post-execute.ts`/dir-form modules — NEVER enter `tsc --noEmit` and can never
break the global typecheck. The reference schematic at `test/fixtures/typed-factory/**` — INCLUDING its
committed `schema.generated.ts` — stays IN the typecheck set DELIBERATELY: the emitter↔type parity proof
(TFO-01, FPS-04) depends on that generated file compiling against a hand-written factory. The Gap-7
negative-compile file `test/types/typed-factory-options.test.ts` also stays IN the set — its whole
mechanism is a reddening `tsc`. (Chosen over materializing red fixtures to a temp dir: a single `exclude`
entry is simpler and keeps fixtures on disk for the direct-call red-proofs.)

**Non-ENOENT (EACCES) fixture root-guard (Gap 6).** The unreadable-dir / unreadable-schema fixtures
(RBV-05, RLN-01) are constructed with `chmod 000` to force a non-ENOENT read error. Under root, `chmod 000`
is bypassed (root reads anything), so on a root runner these fixtures would be silently READABLE and the
fail-closed assertion would false-green. Every such test therefore GUARDS the fixture with a root check:
`if (process.getuid?.() === 0) throw new Error("must run as non-root: chmod-000 fixtures are bypassed by root, invalidating the non-ENOENT fail-closed proof")` — the test FAILS LOUDLY under root, never silently
passes. CI assumption (documented): the suite runs as a NON-ROOT user; if a future CI image runs as root,
this guard converts the false-green into a hard, self-explaining failure.

## 4.7 Fitness Functions

- **FIT-12** schema↔type parity: digest-recompute vs the digest embedded in the committed `schema.generated.ts`; read-only, never rewrites the committed file (SCP-01.4). Its always-on walk covers ONLY `ALWAYS_ON_SCAN_ROOTS` (the reference schematic — §4.6a); the staled-digest / content-drift red-proofs invoke the digest-compare function DIRECTLY on fixtures under `test/fixtures/red/**`, never via the walk.
- **FIT-13** schema sufficiency: hard-fail rules over consumed `schema.json` (SCP-02).
- **FIT-14** package-surface guard (FPS-02): baseline-diff mechanism (Gap 11, FIT-04-style). A committed snapshot `test/fitness/pkg-surface-baseline.json` records `{ exports, files, tarball, bin, shebang }` — the exports map, the `files` array, the expected `bun pm pack`/tarball listing, the `#bin` path, and a shebang-present flag. FIT-14 REGENERATES the actual surface at test time and DIFFS it against the committed baseline; drift (a new export, a lost `files` entry, a deps addition, a missing shebang) fails, naming the delta. There is no "git-before" state at test time — the committed JSON IS the before.
- **FIT-15** bin→core direction: no `src/` runtime module imports `bin/` or codegen-only code (FPS-03), mirroring FIT-07's src-scan idiom.
- **FIT-16** reserved-name structural scan (SEC-2 hybrid): its always-on walk covers ONLY `ALWAYS_ON_SCAN_ROOTS` (the reference schematic — §4.6a) — a `factory.ts` + `schema.json` pair — checking for a reserved sibling (`pre-execute`/`post-execute`, case-insensitive, file or `dir/` form) regardless of `packageDir`, and flagging a package that ships `schema.json` but whose `defineFactory(` call omits `packageDir` (the 3rd signal, SEC-2c). **3rd-signal mechanism (Gap 10)**: a SIMPLE SUBSTRING check — read the factory source and test whether a `defineFactory(` call carries the `packageDir` token — applied ONLY to the files inside `ALWAYS_ON_SCAN_ROOTS` (known, controlled, allowlisted files; NO general/AST parsing of arbitrary source). The bare-`defineFactory(`-without-`packageDir` red fixture is exercised by calling the check FUNCTION directly on a fixture path under `test/fixtures/red/**` — never via the always-on walk. Deliberately-red reserved fixtures likewise live under `test/fixtures/red/**`, NEVER walked; their red-proof invokes the scan FUNCTION directly. Structural always-on guarantee complementing the `packageDir`-gated runtime throw.
- **FIT-07 (modified)** now walks `src/core/**` recursively so the new `src/core/schema/` subdir is inside the ADR-0008 guard (ARCH-1) — a non-recursive scan would silently exempt the whole cluster.

## 4.8 Migration / Rollout

Pre-v1, unpublished.

**S-006-only Stage-2 gate (Gap 2/3/4 — Option A, plain-`Error` interim).** The Stage-1 `AuthoringError`
on this build's base carries only `verb`+`path`, is READ-ONLY here, and — critically — Stage-2 DERIVES
`origin` from a CLOSED `reason` enum (ADR-0021), so an interim `AuthoringError{origin:"authoring-rejected"}`
is UNCONSTRUCTIBLE until the two new enum members land. Rather than fabricate an unconstructible object,
**every interim rejection (S-000..S-005) throws a plain `Error`** carrying the EXACT pinned REQ-AEC-09
message literal. Consequence: **there is NO Tier-1 whole-build precondition** — with no `AuthoringError`
construction interim, S-000..S-005 have ZERO Stage-2 dependency. The Stage-2 BUILD-merge/rebase
precondition and S-000's halt-check are REMOVED; the build may start immediately once plan-verify returns
`ready`.

The ONLY Stage-2 gate that remains is **S-006** (deferred-blocked, never dropped): its FIRST task verifies
`src/core/authoring-error.ts` carries the generalized `origin`/`reason` fields AND the two new `reason`
enum members (`invalid-input`/`reserved-name`) — i.e. `stage-2-error-attribution` ARCHIVED and its
coordinated `sdd-spec` amendment (REQ-AEC-07/08/09) landed on Stage-2's own signed spec; if not, HALT
`stage-2-precondition-missing`. S-006 then UPGRADES every interim plain-`Error` throw in
`input-rejection.ts` to `AuthoringError{origin:"authoring-rejected", reason:"invalid-input"|"reserved-name"}`,
adds the exact AEC-09 message-template assertions, and flips the interim assertions (SITE/fail-closed/message
literal → also `instanceof`/`origin`/`reason`). Register that amendment as a pending change at archive.

**Sequencing**: 4.1 (bin/typed options), 4.2 (FIT-12/13/14/15/16), 4.4 (e2e), the RBV
*logic*/discovery/sufficiency/parse/digest + RBV-03/05.2 *warnings*, and every interim rejection throw carry
NO Stage-2 coupling at all — they build on the current base. Only `input-rejection.ts`'s class UPGRADE
(S-006) touches Stage-2's taxonomy. `authoring-error.ts` is never edited by this change.

Rollback: revert the `context.ts` call site + `schema/` cluster, drop `#bin` and `dist/bin`, delete
FIT-12+ and fixtures; `authoring-error.ts` untouched, so no cross-change rollback.

**Production-path posture** (SEC-2b): the runtime throw fires ONLY when the author threads
`packageDir` — a discipline the SDK cannot force across the process boundary, since the real
execution path is the Go CLI invoking author factories cross-repo. This residual fail-open is
ACCEPTED as a cross-repo/author-discipline risk, mitigated by three compensating controls: the
always-on FIT-16 structural scan (fires in the author's own repo regardless of `packageDir`), the
pit-of-success `@example`/`@param` (finding 2d), and the 3rd-signal warning for schema-present-but-
untethered packages. Register a followup at archive (`project/pending-changes`) to revisit once the
Go CLI's invocation contract is pinned (candidate: CLI threads the package dir on the SDK's behalf).

**Read-path posture** (SEC-3): at the run boundary, ONLY `ENOENT` maps to the RBV-03 opt-out/warning
path; any other read/`readdir` error (`EACCES`/`EPERM`/`EISDIR`) FAILS CLOSED — interim as a plain
`Error` (upgraded to `AuthoringError` in S-006) — an unreadable schema/dir is never silently treated as
"no schema".

## 4.9 Performance

Run-boundary validation adds one `readFileSync` + `JSON.parse` + a linear property walk per factory
run — negligible for a dev-time authoring tool. The reserved-name scan is one `readdirSync` of the
package dir. No hot path.

## 4.10 Architecture Impact

**Architecture impact**: modifying
**Rationale**: derives from 4.2c — the new codegen-bin component introduces an executable
distribution primitive the single-layer-library baseline lacks (`deviates`, ADR-0027), and the
run-boundary/EngineClient touchpoints scope-amend ADR-0018's ownership line (`deviates`,
ADR-0029/0027). No documented boundary is removed and the IR-seam pattern is intact, so not
`breaking`. Rev 2's additions (FIT-16 build-time reserved scan, emitter escaping, canary helper) are
additive fitness/test surface within the same posture — they do not change the impact class.
Triggers `arch_refresh_post_verify` (new component + modifying) post-build.

## 4.11 Open Questions

None.

## 4.12 Rev 1 → Rev 2 Delta (blind design-council)

| # | Finding (lens) | Disposition |
|---|---|---|
| 1 | SEC-1 emitter escaping | APPLIED — ADR-0027 escaping emitter; `bin/emit-type.ts` (JSON.stringify all strings, identifier allow-list `/^[A-Za-z_$][\w$]*$/` else quoted-property-key, labels `*/`-guarded/dropped); hostile-schema inertness red-proof (TFO-01 row) |
| 2 | SEC-2+ARCH-2+TW-M1 fail-open cluster | APPLIED — (a) ADR-0028 records hybrid in Alternatives + ADOPTS it (FIT-16 always-on scan + runtime throw); (b) production-path fail-open ACCEPTED as cross-repo risk in §4.8 + archive followup; (c) 3rd signal (schema-present-but-untethered) folded into FIT-16; (d) `@example {packageDir: import.meta.dir}` + `@param` tiers in §4.4 |
| 3 | SEC-3 read-path posture | APPLIED — ADR-0028/0026 + §4.8: only ENOENT→opt-out, else fail-closed; unreadable-dir/schema fixtures on RBV-05/RLN rows |
| 4 | SEC-4 write containment | APPLIED — ADR-0027/0028: realpathSync-canonicalized output-path check; ~~project-root anchor = nearest ancestor `package.json` dir of resolved `<package-dir>`~~ **anchor CORRECTED in rev 3 (§4.13, Gap 3) to the nearest ancestor `package.json` dir of `process.cwd()` (the invoking process), not of `<package-dir>` — the `<package-dir>`-derived anchor was circular and made TFO-05.2 unfalsifiable**; symlink-escape fixture on TFO-05 row |
| 5 | ARCH-1 FIT-07 regression | APPLIED — `test/fitness/fit-07-*.test.ts` Modify (recursive walk + red-proof); File Changes modify budget 3→4 |
| 6 | ARCH-3 cross-repo contract | APPLIED — ADR-0027 records `type`/`label`/`choices` as the SDK↔Go-CLI wire contract, two-party evolution |
| 7 | TW-M2 filename semantics | APPLIED — ADR-0028: case-insensitive, strip-extension-then-compare against {pre-execute,post-execute}×{.ts,.js}, dir-form `pre-execute/index.ts` caught |
| 8 | TW-M3+ARCH-m4 doc home | APPLIED — reserved names in `defineFactory` `@remarks` (FIT-06 carrier = `src/core/context.ts`); FIT-06 asserts both names |
| 9 | TW-M4 generated header | APPLIED — exact literal pinned in §4.4 + ADR-0031 |
| 10 | SEC-5 canary helper | APPLIED — `test/support/canary.ts` in File Changes (token gen, fixture seeding, subprocess stdout/stderr collector) |
| 11 | SEC-6 trust one-liner | APPLIED — ADR-0031: `packageDir` trusted as author-authority dev-time input; reads only schema.json + entry NAMES, never emits values, fails closed on non-ENOENT |
| 12 | SEC-7 safe iteration | APPLIED — ADR-0029 + `schema-parse`/`schema-sufficiency`: `Object.keys`/`hasOwn`/null-proto accumulator; proto-declaring-schema fixture on SCP-02 row |
| 13 | TW-m5 usage substrings | APPLIED — §4.4: purpose + literal `pbuilder-codegen <package-dir>` |
| 14 | TW-m6 parse-error template | APPLIED — §4.4/ADR-0027: `pbuilder-codegen: <file>: <problem> (line L, column C)` |
| 15 | TW-m7 prefix convention | APPLIED — §4.4: `pbuilder-codegen:` (CLI) vs `[pbuilder]` (runtime), rationale stated |
| 16 | TW-m8 packageDir JSDoc | APPLIED — §4.4: directory URL meaning, steer to `import.meta.dir`, warn vs `import.meta.url` |
| 17 | TW-m9 relative `<dir>` | APPLIED — ADR-0031 warning literals use project-root-RELATIVE dir; naming-by-location = factory identity |
| 18 | ARCH-m5 bundled case | APPLIED — ADR-0031 known limitations: bundled/transpiled factory (adjacency + `import.meta.dir` both break; RBV-03 warning covers loudly) |
| 19 | TW obs (spec-owned) | **spec-touchpoint** — REQ-TFO-01.1/.2 use `options.port` vs the Glossary's input/options split; NOT edited here (spec signed) — reconcile at the Stage-2 coordinated amendment / archive |

## 4.13 Rev 2 → Rev 3 Delta (plan-verify iteration-1 gap fixes)

Closes the seven design-routed gaps from `verify-plan-1.md` (gap 1 → spec V3 micro-amendment; gap 8 →
slices rev 2). One story, cross-checked across design.md, ADR-0027/0026, slices.md, and the V3 spec.

| Gap | Finding | Disposition |
|---|---|---|
| 2 (headline) | Interim-throw contradiction: rejection slices need `AuthoringError{origin,reason}` but the on-branch class is Stage-1 `verb`+`path`, READ-ONLY | APPLIED — **two-tier gate** in §4.8 + ADR-0029 + §4.4: TIER 1 (origin/reason FIELDS) = Stage-2 BUILD MERGED = START PRECONDITION for the whole build (S-000..S-005), S-000's first task verifies it or HALTs `stage-2-precondition-missing`; TIER 2 (final reason LITERALS + AEC-09 templates) = Stage-2 ARCHIVED + amendment = S-006 only. Removed all wording implying the interim throw is buildable on the Stage-1 class shape. |
| 3 | Write-containment anchor circular (derived from `<package-dir>`, so `../../etc` unrefusable, TFO-05.2 unfalsifiable) | APPLIED — ADR-0027 pins reading (b): anchor = nearest ancestor `package.json` dir of **`process.cwd()`** (invoking process); resolved `<package-dir>` AND resolved output path must both lie within it, else refuse + exit non-zero + write nothing. §4.6 TFO-05 row: symlink fixture asserts post-realpath containment. §4.12 row 4 marked corrected. |
| 4 | Emitter SchemaKind→TS mapping unpinned | APPLIED — exact table in ADR-0027 (`string`/`number`/`boolean`→same; `enum`→union of `choices` literals; `required:false`→`key?:T`; `label`→guarded JSDoc with `*/`-breakout escaped/dropped); referenced from §4.3. |
| 5 | FIT-12/FIT-16 walk root + fixture-exclusion undefined | APPLIED — §4.6a: always-on gates walk ONLY the shared `ALWAYS_ON_SCAN_ROOTS` const (`test/support/scan-roots.ts` = the reference schematic); red fixtures under `test/fixtures/red/**` never walked; red-proofs invoke the check FUNCTION directly. §4.7 FIT-12/FIT-16 + §4.2 rows updated. |
| 6 | EACCES fixtures false-green under root | APPLIED — §4.6a: chmod-000 fixtures guarded by `process.getuid?.() === 0` → the test FAILS LOUDLY ("must run as non-root…"), never silently passes; non-root CI assumption documented. |
| 7 | Bin shebang/executability + spawn discipline unpinned | APPLIED — ADR-0027: `#!/usr/bin/env node` via `bun build --banner` (chosen mechanism); CLI e2e spawns via explicit `node dist/bin/pbuilder-codegen.js` **[spawn runtime SUPERSEDED → `bun` in §4.14 Gap 9]**; FPS-02 tarball check asserts the shipped shebang. |
| 1, 8 | (spec + slices routed) | Gap 1 → REQ-FPS-05.4 (spec V3, owner unfreeze). Gap 8 → slices rev 2 Build Order + Executor Context precondition. |

## 4.14 Rev 3 → Rev 4 Delta (plan-verify iteration-2 gap fixes)

Closes all 13 `verify-plan-2.md` gaps. The headline is the OWNER FORK on gaps 3/4: **Option A —
plain-`Error` interim + spec V4 micro-unfreeze** — which DISSOLVES the rev-3 two-tier gate (no
interim `AuthoringError` construction ⇒ no Tier-1 whole-build precondition). One story, cross-checked
across spec V4, design §4.4/§4.6/§4.6a/§4.7/§4.8, ADR-0027/0026, and slices rev 3.

| Gap | Finding | Disposition |
|---|---|---|
| 1 | Sequencing commitment for the deliverable | MOOT (Option A) — the Tier-1 precondition is removed; S-000..S-005 have no Stage-2 dependency and the build may start immediately after plan-verify `ready`. Only S-006 keeps a gate. §4.8, slices Build Order. |
| 2 | Generalized `AuthoringError` construction API unknown from stage-4 artefacts | NOW S-006-SCOPED — S-006's executor reads `src/core/authoring-error.ts` AFTER Stage-2 archive/amendment and constructs via its actual public API; Stage-2's signed spec + amendment are the field contract. §4.8 S-006 gate. |
| 3, 4 | **Interim `AuthoringError{origin:"authoring-rejected"}` UNCONSTRUCTIBLE** (Stage-2 derives `origin` from a closed `reason` enum, ADR-0021); RBV-vs-RLN in-kind distinguishability impossible interim if both distinguishers are Tier-2-gated | APPLIED — **Option A**: interim throws a plain `Error` with the EXACT pinned REQ-AEC-09 message literal; `instanceof`/`origin`/`reason` all move to S-006. Interim RBV-vs-RLN distinguishability = the two DISTINCT message literals. Spec V4 rewrites the umbrella Interim Behaviour + the RBV-01/02 & RLN-02 BLOCKED markers. §4.4, §4.6 note, §4.8, ADR-0029. |
| 5 | FIT-06 `PUBLIC_PATHS` (commons + conformance) does not reach `defineFactory` (exported from internal-kit `src/core/index.ts`) — @example/@remarks target undefined | APPLIED — dedicated doc-assertion test `test/fitness/definefactory-jsdoc.test.ts` reads `src/core/context.ts` and asserts `defineFactory`'s `@example` + `@remarks` (both reserved tokens). FIT-06 left untouched (broadening it would impose `@example` on every internal-kit export). §4.2, §4.6 FPS-05 row, §4.7. §4.12 row 8's "FIT-06 asserts both names" is thereby corrected. |
| 6 | Are `test/fixtures/red/**` + committed `*.generated.ts` inside `tsc --noEmit`? | APPLIED — `test/fixtures/red/**` added to `tsconfig.json` `exclude`; the reference schematic `test/fixtures/typed-factory/**` (incl. its `schema.generated.ts`) stays IN deliberately (parity depends on it). §4.6a typecheck-set paragraph. |
| 7 | Negative-compile mechanism for TFO-01.2 unpinned | APPLIED — `@ts-expect-error` lines in `test/types/typed-factory-options.test.ts`, which lives in the MAIN `tsc` set (repo precedent: typed-create matrix); a missing error turns the build red. §4.6 TFO-01 row. |
| 8 | Parse-error `(line L, column C)` locator source engine-dependent | APPLIED — ADR-0027: attempt `JSON.parse`; on `SyntaxError`, extract `at position N` from the engine message when present and convert to (line, column) via a byte-offset walk of the raw text; when absent, emit the pinned fallback `(position unknown)`. REQ-TFO-04.4 targets a fixture whose Bun error carries a position + a second fixture pins the fallback. |
| 9 | `node` runtime not guaranteed in Bun CI | APPLIED — ADR-0027: CLI e2e spawns via explicit `bun dist/bin/pbuilder-codegen.js …` (Bun executes the node-target bundle); the `#!/usr/bin/env node` shebang stays for end-user installs; FPS-02 still asserts the shebang. §4.6 TFO-05 row, slices constraint 10. Supersedes §4.13 row 7's `node`-spawn wording. |
| 10 | FIT-16 3rd-signal static-detection heuristic unspecified | APPLIED — §4.7: a SIMPLE substring check (`defineFactory(` call carrying the `packageDir` token) applied ONLY to allowlisted `ALWAYS_ON_SCAN_ROOTS` files (no general parsing); the bare-call red fixture is driven by calling the check function directly on a `test/fixtures/red/**` path. |
| 11 | FIT-14 before/after baseline mechanism | APPLIED — committed snapshot `test/fitness/pkg-surface-baseline.json` (`{exports, files, tarball, bin, shebang}`, FIT-04-style); FIT-14 regenerates the actual surface and diffs against it. §4.2, §4.7. |
| 12 | Is S-000..S-005 with S-006 outstanding a shippable end state? | APPLIED — first `/build` pass delivers S-000..S-005 and stops; the CHANGE reaches verify-final + archive ONLY after S-006 lands (post Stage-2 archive + amendment). S-006 is deferred-blocked, never dropped. Slices Build Order. |
| 13 | README qualifying-line placement anchor | APPLIED — append immediately after the existing typed-inputs claim (`README.md` ~line 22, the "Anatomy" `schema.json # typed inputs` line); if that anchor is absent at build time, place it in the top feature/anatomy section — executor discretion sanctioned, byte-exact literal unchanged. Slices S-005 task. |

## 4.15 Rev 4 → Rev 5 Delta (plan-verify iteration-3 literal pins)

Closes the five literal-level pins from `verify-plan-3.md` (Judge B, all `question-technical`, zero product
questions). No REQ changes — spec V4 stays UNTOUCHED; these are design/executor-surface pins. Cross-checked
across ADR-0027, design §4.4, and slices (Executor Context + reading list + load-bearing literals).

| # | Gap (iteration-3) | Pin (owner-ratified 2026-07-07 where noted) |
|---|---|---|
| 1 | Exact on-disk `schema.json` shape unpinned (flat vs wrapped) — the SDK↔Go-CLI cross-repo wire contract | APPLIED — **OWNER-RATIFIED WRAPPED form**: top-level `{ "properties": { "<key>": { type/label/choices/required/default/description } } }`; property KEY = map key; facets inside each value object. Unknown TOP-LEVEL keys IGNORED (reserved future metadata name/version/description); unknown PROPERTY-level keys = FIT-13 advisory; missing/non-object `"properties"` = invalid shape, fail-closed same path as malformed JSON. Recorded in **ADR-0027** Decision as the cross-repo contract; the in-memory `Schema` array model (§4.3) is a distinct representation, parse lifts map→array. The only pre-existing snippet (`schema.json{port:number}` shorthand, slices S-000) is notation, not flat JSON — no flat-form JSON survived the sweep. |
| 2 | Byte-exact RBV-05.1 runtime malformed/invalid-shape schema literal missing | APPLIED — pinned `[pbuilder] factory at <dir>: schema.json could not be read: <problem> (line L, column C)` + `(position unknown)` fallback; ONE literal covers present-but-unparseable AND invalid-shape, `<problem>` distinguishing (`invalid JSON` vs `missing "properties" object`); author-vocabulary, no content/raw-engine echo. §4.4 + slices load-bearing literals. |
| 3 | AEC-09 `{expectedType}` rendering per branch unpinned | APPLIED — always the DECLARED expectation (no-echo): primitive → `SchemaKind` string; non-JSON value → declared kind (function-for-number → `port must be number`); `null` for required typed prop → declared kind (wrong-type, not missing); enum → `one of: <choices joined by ", ">` (`mode must be one of: dev, prod`). §4.4 + slices load-bearing literals (four variants, one example each). |
| 4 | ContractFake/e2e driving contract outside the executor reading surface | APPLIED — `test/support/contract-fake.ts` + `test/e2e/author-to-tree.e2e.test.ts` added to slices MANDATORY READING LIST; driving sketch in Executor Context (verified against the actual files: constructor is `new ContractFake({ seed })`, NOT bare); fixtures execute FROM SOURCE under `bun test` (no bundling) so `import.meta.dir` resolves the fixture's own dir → `schema.json` adjacency holds at test time. |
| 5 | Warning `<dir>` relativization algorithm unpinned | APPLIED — pinned `path.relative(process.cwd(), packageDir)` for EVERY runtime warning/error `<dir>` token (tests run from repo root → deterministic, no absolute-path leak). Stated once in Executor Context, referenced from the load-bearing literals + §4.4 RBV-05.1. |
