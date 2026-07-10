# Slices: Stage 4 — Typed Factory Options

**Triage**: L · **Spec**: V4 signed · **Design**: rev 5 · **Total slices**: 7 (1 skeleton +
6 SPIDR, 1 gated). **Revision**: 4 (plan-verify iteration-3 literal pins: **wrapped `schema.json`
wire shape** (ADR-0027), RBV-05.1 runtime malformed-schema literal, four `{expectedType}` render
variants, ContractFake/e2e driving contract + reading-list additions, `<dir>` =
`path.relative(process.cwd(), packageDir)` — see design §4.15; folded into the reading list,
Executor Context, and load-bearing literals below). Rev 3 (iteration-2): **Option A plain-`Error`
interim dissolves the Tier-1 whole-build precondition**; FIT-06→dedicated JSDoc test, FIT-14
baseline, FIT-16 3rd-signal substring, red-fixture tsconfig-exclude, spawn-via-`bun`.

> **/build deliverable = S-000..S-005.** S-006 is explicitly **deferred-blocked** (built later
> via `/build --scope=slice:S-006` once Stage 2 ARCHIVES + the coordinated amendment lands).
> **There is NO whole-build precondition** (Option A, iteration-2 gaps 3/4): every interim rejection
> throws a plain `Error`, so S-000..S-005 have ZERO Stage-2 dependency and the build may start
> IMMEDIATELY once plan-verify returns `ready`. The ONLY Stage-2 gate is S-006's.
**Test**: `bun test <path>` · full `bun test` · types `bunx tsc --noEmit` · build
`bun run build` (needed before `test/bin/codegen-static-scan.test.ts`, which scans the
built `dist/bin` artifact).

## Executor Context (mandatory)

> Handoff-plumbing appendix, following the stage-2-error-attribution house pattern
> (plan-verify Judge B simulates executing from this file alone). The ≤800-word artifact
> budget governs the slice blocks (unchanged); this section is exempt — deviation noted,
> not silent.

### No whole-build precondition (Option A, iteration-2 gaps 3/4 — the Tier-1 gate is DISSOLVED)

The rev-2 "Tier-1 START PRECONDITION" (Stage-2 BUILD merged + rebase, S-000 halt-check) is **REMOVED**.
An interim `AuthoringError{origin:"authoring-rejected"}` was UNCONSTRUCTIBLE — Stage-2 derives `origin`
from a CLOSED `reason` enum (ADR-0021), and no interim `reason` maps until the two new members land. So
under Option A **every interim rejection (S-000..S-005) throws a plain `Error`** with the EXACT pinned
REQ-AEC-09 message literal — NO `AuthoringError`, NO `origin`, NO `reason` interim. This gives S-000..S-005
ZERO Stage-2 dependency: **the build may start immediately after plan-verify `ready`; there is nothing to
verify or rebase before S-000.** `authoring-error.ts` stays READ-ONLY throughout.

The ONLY Stage-2 gate is **S-006** (deferred-blocked): its first task verifies `authoring-error.ts` carries
the generalized `origin`/`reason` fields AND the `invalid-input`/`reserved-name` enum members (i.e. Stage-2
ARCHIVED + its coordinated `sdd-spec` amendment landed); else HALT `stage-2-precondition-missing`. S-006 then
upgrades every interim plain-`Error` throw to the final `AuthoringError` shape (constraint 1, constraint 6,
design §4.8).

### ContractFake driving contract (iteration-3 pin 4)

The typed e2e (`test/e2e/typed-factory.e2e.test.ts`, S-000) drives `defineFactory` through the same
`ContractFake` seam the existing `author-to-tree.e2e.test.ts` uses — no engine. Verified against the actual
`test/support/contract-fake.ts` + `test/e2e/author-to-tree.e2e.test.ts`:

```ts
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";

const fake = new ContractFake({ seed: {} });               // constructor REQUIRES { seed } — NOT bare new ContractFake()
const run = defineFactory<Input>(fn, { packageDir: import.meta.dir });
await run(input, { client: fake });                         // success: resolves; assert fake.committedTree() for the golden tree
```

Fixtures execute **FROM SOURCE** under `bun test` (no bundling step): `import.meta.dir` inside a fixture
factory resolves THAT fixture's own directory, so the `schema.json` adjacency `defineFactory` needs for
discovery holds at test time. Pass `import.meta.dir` (a directory) as `packageDir` — never `import.meta.url`
(a file URL; misuse). A reject variant asserts the pinned plain-`Error` `.message` (constraint 1).

### `<dir>` relativization (iteration-3 pin 5)

Every runtime warning/error `<dir>` token (no-schema, empty-schema, RBV-05.1 malformed-schema) is rendered
via `path.relative(process.cwd(), packageDir)` — never the absolute `packageDir`. Tests run from the repo
root, so this is deterministic and leaks no absolute path. This single algorithm anchors all three `<dir>`
literals below.

### Mandatory reading list (read BEFORE any slice)

REQ-IDs and constraint numbers here resolve against these artefacts; **this file is the
build ORDER, those are the build CONTENT** (scenario texts live in the specs):

1. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/spec.md`
2. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/specs/typed-factory-options/spec.md`
3. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/specs/schema-contract-parity/spec.md`
4. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/specs/run-boundary-input-validation/spec.md`
5. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/specs/reserved-lifecycle-names/spec.md`
6. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/specs/factory-package-shape/spec.md`
7. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/specs/authoring-error-contract/spec.md` — deferred amendment, read-only against Stage 2
8. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/.claude/worktrees/stage-4-typed-options/openspec/changes/stage-4-typed-options/design.md` — esp. §4.2 (File Changes), §4.4 (interface/CLI contract), §4.5 (ADRs), §4.6 (Test Derivation), §4.8 (sequencing)
9. ADRs `openspec/decisions/0027-codegen-bin-mechanism.md` … `0031-factory-package-shape-discovery.md`
10. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/src/core/context.ts` — the `defineFactory` this change modifies twice (S-000, S-004)
11. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/test/fitness/fit-07-no-tree-in-core.test.ts` — the ONLY fitness Modify target (recursive walk). `fit-06-example-jsdoc.test.ts` is READ-ONLY reference — left UNTOUCHED (Gap 5); FPS-05.2/.3 lands in the NEW `test/fitness/definefactory-jsdoc.test.ts`
12. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/test/support/contract-fake.ts` — the `EngineClient` stand-in the new e2e drives (iteration-3 pin 4). Constructor is `new ContractFake({ seed })` (a `Record<string,string>` seed, NOT bare); assert commit via `fake.committedTree()`; `read()`/`stagingTree()` are the other observable surfaces. Read it for the exact constructor + assertion API before writing `test/e2e/typed-factory.e2e.test.ts`
13. `/home/barri/Projects/Project-Builder-Renaissance/project-builder-sdk/test/e2e/author-to-tree.e2e.test.ts` — the existing pyramid e2e; COPY its driving shape (`defineFactory<O>(fn)` → `await run(input, { client: fake })` → assert `fake.committedTree()`). The typed e2e adds `{ packageDir: import.meta.dir }` and a schema.json sibling (iteration-3 pin 4)

### Binding constraints (verbatim — violating any is a slicing/build defect)

1. **Interim-throw discipline — plain `Error`, single S-006 gate (Option A, design §4.8/ADR-0029,
   iteration-2 gaps 3/4).** INTERIM (S-000..S-005) every rejection this change ships throws a **plain
   `Error`** — NOT an `AuthoringError` — whose `.message` is the EXACT pinned REQ-AEC-09 template literal
   (field/type or offending key named, never the value). Tests assert SITE + fail-closed + the EXACT
   message literal + no-echo. NO test interim asserts `instanceof AuthoringError`, `origin`, or `reason` —
   those three are ALL S-006. The interim `AuthoringError{origin:"authoring-rejected"}` was UNCONSTRUCTIBLE
   (Stage-2 derives `origin` from a closed `reason` enum, ADR-0021), so it is deliberately not constructed
   before S-006 — and consequently NO whole-build Stage-2 precondition exists.
   - **S-006 (the ONLY Stage-2 gate)**: after `stage-2-error-attribution` ARCHIVES + its coordinated
     `sdd-spec` amendment lands (origin/reason fields + `invalid-input`/`reserved-name` enum members +
     AEC-09 rows on Stage-2's signed spec), S-006 UPGRADES the plain-`Error` throw to
     `AuthoringError{origin:"authoring-rejected", reason:…}`, adds the exact `reason`-equality + AEC-09
     message assertions, and flips the interim assertions on (rule 6).
   Only `src/core/schema/input-rejection.ts`'s throw becomes Stage-2-coupled, and only at S-006 —
   validation logic, rejection site, fail-closed behavior, no-echo, and warnings carry NO Stage-2
   dependency and build on the current base.
2. **Emitter escaping is not optional, ever (SEC-1, ADR-0027).** `bin/emit-type.ts` emits
   every schema-derived string ONLY via `JSON.stringify`; a property key is bare only if it
   matches `/^[A-Za-z_$][\w$]*$/`, else quoted; labels are escaped/`*/`-guarded or dropped.
   This is written correctly in S-000 (not bolted on later) — S-001 adds the adversarial
   hostile-schema red-proof against the already-correct implementation.
3. **Write containment (SEC-4, ADR-0027, Gap 3).** The anchor is the INVOKING PROCESS's project
   root — the nearest ancestor `package.json` dir of **`process.cwd()`** (NOT of `<package-dir>`;
   that would be circular and make `pbuilder-codegen ../../etc` unrefusable). BOTH the
   `fs.realpathSync`-resolved `<package-dir>` AND the resolved output path must lie within that
   anchor, else the bin refuses (exit≠0, writes nothing). A string-level `../` check alone is
   insufficient (symlink-bypassable).
4. **Read-path posture (SEC-3, ADR-0028/0026).** ONLY `ENOENT` maps to an opt-out/warning
   path (RBV-03 no-schema, or "no reserved files" for the RLN scan). Any other read error
   (`EACCES`/`EPERM`/`EISDIR`) FAILS CLOSED — interim as a plain `Error` (upgraded to
   `AuthoringError` in S-006) — never silently downgraded to "absent". **Root-guard (iteration-1
   Gap 6, design §4.6a)**: chmod-000 EACCES fixtures are
   bypassed by root, so every such test guards with `process.getuid?.() === 0` → FAIL LOUDLY
   ("must run as non-root…"); the suite assumes a non-root runner.
5. **Safe iteration (SEC-7, ADR-0029).** Both the schema-parse/sufficiency pass and the
   input-validation pass iterate via `Object.keys`/`Object.hasOwn` (or a null-prototype
   accumulator) — never plain property access that could trigger a `__proto__` getter.
6. **Gating isolation.** S-006 is the ONLY slice touching the final `reason` literal /
   AEC-09 message text; no other slice may assert an exact `reason` string. This mirrors
   Stage-2's droppability-isolation lesson even though nothing here is droppable — S-006 is
   GATED (blocked on an external archive event), not optional; it must eventually land.
7. **FIT numbering.** FIT-12 (parity) · FIT-13 (sufficiency) · FIT-14 (package surface) ·
   FIT-15 (bin→core direction) · FIT-16 (reserved-name structural scan). FIT-11 is Stage
   2's — never touch it or any `openspec/changes/stage-2-error-attribution/` file;
   `src/core/authoring-error.ts` is READ-ONLY.
8. Every slice leaves the suite GREEN and `tsc --noEmit` CLEAN at its boundary; no broken
   intermediate states.
9. **Fixture roots + always-on walk scope (Gap 5, design §4.6a).** The always-on WALKING gates
   (FIT-12 parity, FIT-16 reserved scan) scan ONLY the shared allowlist const
   `ALWAYS_ON_SCAN_ROOTS` (`test/support/scan-roots.ts` = the reference schematic
   `test/fixtures/typed-factory/`). Deliberately-red fixtures live under `test/fixtures/red/**`
   and are NEVER walked; their red-proofs invoke the check FUNCTION directly against the fixture
   input. FIT-13/14/15 are not fixture tree-walks (direct-call matrix / `package.json` / `src/` scan).
10. **Bin shebang + spawn discipline (Gap 7; runtime corrected iteration-2 Gap 9, ADR-0027).** The built
    `dist/bin/pbuilder-codegen.js` carries an explicit `#!/usr/bin/env node` shebang via
    `bun build --banner "#!/usr/bin/env node"` (the `package.json` `build` step) — that shebang is the
    END-USER-INSTALL contract. CLI e2e tests spawn via EXPLICIT `bun dist/bin/pbuilder-codegen.js <args>`
    (Bun is the guaranteed CI runtime and executes the node-target bundle; `node` is NOT guaranteed),
    never relying on the exec bit or a host `node`. FPS-02's tarball check (REQ-FPS-02.2) still asserts the
    shipped file's first line is exactly `#!/usr/bin/env node`.

11. **Fixture typecheck exclusion (iteration-2 Gap 6, design §4.6a).** `test/fixtures/red/**` is added to
    `tsconfig.json` `exclude` so hostile/malformed red fixtures never enter `tsc --noEmit`. The reference
    schematic `test/fixtures/typed-factory/**` (incl. its committed `schema.generated.ts`) stays IN the set
    deliberately (parity proof). The Gap-7 `@ts-expect-error` file `test/types/typed-factory-options.test.ts`
    stays IN the set — a reddening `tsc` is its proof.

### RED-posture taxonomy (definitions)

- **[must-fail-first]** — write the test, watch it fail for the right reason, then implement.
- **[characterization]** — pins already-intended behavior (e.g. untyped opt-out); RED waived with justification.
- **[permanent-fixture]** — a planted red-proof that stays in the suite forever (e.g. FIT-16's red-root negative fixtures under `test/fixtures/red/**`, invoked via a direct scan-function call — never via the always-on walk; the hostile-emitter proof).

### Load-bearing literals (copied exactly — do not paraphrase)

- **Bin name**: `pbuilder-codegen` · invocation `pbuilder-codegen <package-dir>` ·
  `package.json#bin`: `{ "pbuilder-codegen": "dist/bin/pbuilder-codegen.js" }`.
- **Generated file**: `schema.generated.ts`, header
  `// AUTO-GENERATED by pbuilder-codegen — do not edit. Regenerate: pbuilder-codegen <package-dir>`
  plus an embedded `// @schema-digest sha256:<...>` line.
- **Bin success line** (STDOUT): `pbuilder-codegen: wrote schema.generated.ts`.
- **Bin parse-error template** (STDERR): `pbuilder-codegen: <file>: <problem> (line L, column C)`.
- **Runtime warning prefix**: `[pbuilder]` (bracketed namespace tag, contrasts with the bin's argv0-style prefix).
- **No-schema warning**: `"[pbuilder] factory at <dir>: no schema.json found — running WITHOUT schema-derived input validation"`.
- **Empty-schema warning**: `"[pbuilder] factory at <dir>: schema.json declares zero properties — no input validation performed"`.
- **Malformed/invalid-shape schema runtime literal (REQ-RBV-05.1, iteration-3 pin 2)**:
  `"[pbuilder] factory at <dir>: schema.json could not be read: <problem> (line L, column C)"` — with the
  `(position unknown)` fallback branch when the engine `SyntaxError` carries no offset (shared locator, ADR-0027).
  ONE literal covers present-but-unparseable AND invalid-shape (missing/non-object `"properties"`), `<problem>`
  distinguishing: `invalid JSON` vs `missing "properties" object`. `<problem>` is author vocabulary (never raw
  engine/parser text); the literal NEVER echoes file content. Runtime counterpart of the bin's
  `pbuilder-codegen: <file>: …` template (prefix split TW-m7).
- **`<dir>` token (all three literals above)**: rendered via `path.relative(process.cwd(), packageDir)` —
  project-root-RELATIVE, never absolute (TW-m9, iteration-3 pin 5; algorithm in Executor Context).
- **Reserved lifecycle names**: `pre-execute` / `post-execute` (kebab, case-insensitive, `{.ts,.js}`, dir-form caught). `add`/`remove` are NOT reserved here (L2).
- **REQ-AEC-09 message literals (the SINGLE source of truth — asserted INTERIM as the plain-`Error` `.message` from S-000)**: `"invalid input: {field} must be {expectedType}"` · `"invalid input: {field} is a reserved or disallowed key"` · `"reserved lifecycle name: {name} is reserved and cannot be declared by a factory module"`. Under Option A these MESSAGE literals are pinned and asserted interim; ONLY the `reason` string VALUE (`invalid-input`/`reserved-name`) and `instanceof AuthoringError`/`origin` are S-006. Interim RBV-vs-RLN distinguishability (REQ-RLN-02.1) = the two DISTINCT literals above (`invalid input: …` vs `reserved lifecycle name: …`).
- **`{expectedType}` rendering per branch (iteration-3 pin 3 — always the DECLARED expectation, NEVER the received value's kind; no-echo)**:
  - primitive typed property → the declared `SchemaKind` string (`number`/`string`/`boolean`), e.g. `invalid input: port must be number`.
  - NON-JSON value (e.g. a function) for a typed property → the DECLARED kind, e.g. `invalid input: port must be number` (function-for-number renders `number`, never `function`).
  - `null` for a required typed property → the DECLARED kind (null is WRONG-TYPE, not missing — the pinned trichotomy), e.g. `invalid input: port must be number`.
  - enum property → `one of: <choices joined by ", ">`, e.g. `invalid input: mode must be one of: dev, prod`.
- **Canary asymmetry**: key NAMES may appear on an error surface; VALUES never.
- **Branch→template mapping (iteration-4 pin — every RBV rejection renders exactly ONE of the two input-level templates)**:
  - MISSING required key → `invalid input: {field} must be {expectedType}` ({expectedType} = the declared kind, per the branch table above).
  - EXCESS key (RBV-01.3), reserved-lifecycle-name-AS-input-key (RBV-01.5), and `__proto__`/`constructor`/`prototype` keys (RBV-01.6) → ALL THREE render `invalid input: {field} is a reserved or disallowed key`, with `{field}` = the offending key name (sanctioned by the canary asymmetry: key names may appear, values never).
- **Self-building artifact tests (iteration-4 pin — FIT-04 precedent)**: `test/fitness/fit-14-package-surface.test.ts` and `test/bin/codegen-static-scan.test.ts` build their own artifact via `spawnSync("bun", ["run", "build"])` in an UNCONDITIONAL `beforeAll` (exact pattern: `test/fitness/fit-04-dts-semver-gate.test.ts`, which also honors the W7 lesson — no fragile mtime gating). A bare `bun test` on a fresh checkout stays GREEN; no external build-then-test protocol is assumed.
- **README qualifying line (REQ-FPS-05.4, S-005, reverted in stage-4b)** — added VERBATIM, asserted
  byte-for-byte:
  `> **Note**: shipping incrementally — the external-author API (installable `defineFactory` + testing harness) lands with stage-4b.`

---

## S-000: Walking Skeleton — One Source, One Type, One Rejection

**Scope**: walking-skeleton · **Dimension**: — · **Requires**: nothing
**Covers**: TFO-01(.1,.2), TFO-02(.1), RBV-01(.1 — site proof, interim plain-`Error`), FPS-01(.1), FPS-04(.1)

**Acceptance**: GIVEN `schema.json{port:number}` WHEN the bin runs and the generated type is
supplied as `defineFactory<O>` THEN the factory type-checks, runs to completion, and commits
against `ContractFake`; GIVEN a resolved input missing `port` WHEN run THEN rejection happens
BEFORE `als.run`/emit, thrown as a plain `Error` whose `.message` is the pinned literal
`invalid input: port must be number` (constraint 1 — NO `instanceof AuthoringError`/`origin`/`reason`
assertion interim).

### Tasks
- [x] [must-fail-first] `schema/{schema-model,schema-parse,schema-discovery,schema-digest,input-rejection,index}.ts` — `input-rejection.ts` throws a plain `Error` with the pinned REQ-AEC-09 literal (constraint 1; NO `AuthoringError` interim). **Executor note**: `schema-validate.ts` also created here (not named in the original directory-group notation) — the run-boundary "missing required key" finding needed to drive `input-rejection.ts`/context.ts had to live somewhere; S-003 triangulates the rest of the RBV-01 matrix into this same file per its own task list.
- [x] [must-fail-first] `bin/{pbuilder-codegen,emit-type}.ts` — escaping emitter (constraint 2) from the start
- [x] [must-fail-first] `context.ts` — `defineFactory<O>(fn, {packageDir}?)`; pre-`als.run` schema-validation call (not reserved-name yet — S-004)
- [x] `package.json` — `#bin` field + `bun build` step; `tsconfig.json` — add `test/fixtures/red/**` to `exclude` (constraint 11)
- [x] `test/fixtures/typed-factory/*` (reference schematic) + `test/e2e/typed-factory.e2e.test.ts` (happy path + one reject variant asserting the pinned plain-`Error` message)
- [x] `test/types/typed-factory-options.test.ts` — TFO-01.2 mutation-resistant proof via `@ts-expect-error` (constraint from design §4.6 / Gap 7; string→number, re-run, factory body fails to compile → the missing error reddens `tsc`); file stays in the MAIN tsc set
- [x] [must-fail-first] `fit-07-no-tree-in-core.test.ts` Modify — recursive walk (ARCH-1) so `schema/` is covered from day 1

---

## S-001: Bin CLI Discipline — Success/Error Path Completeness

**Scope**: happy-path · **Dimension**: P (Path) · **Requires**: S-000
**Covers**: TFO-03(.1-.3), TFO-04(.1-.6), TFO-05(.1-.3), FPS-01(.1 formalized), FPS-02(.1,.2), FPS-03(.1), FPS-05(.1)

**Acceptance**: GIVEN a malformed `schema.json` WHEN the bin runs THEN exit≠0, STDERR-only,
author-vocabulary + locator, prior output untouched; GIVEN valid input THEN exit 0 + fixed
success line; GIVEN a path-escaping/symlinked output target THEN refused before any write.

### Tasks
- [ ] `test/support/canary.ts` — token gen, fixture seeding, subprocess stdout/stderr capture
- [ ] [must-fail-first] `test/bin/codegen-cli.test.ts` — TFO-04 full matrix + TFO-03.1/.2 + FPS-01.1/FPS-05.1
- [ ] [must-fail-first] `test/bin/codegen-static-scan.test.ts` — TFO-03.3 (no eval/Function/dynamic-import in `dist/bin`)
- [ ] [must-fail-first] TFO-05 write-containment + symlink-escape fixture (constraint 3)
- [ ] [must-fail-first] hostile-schema emitter-inertness red-proof (constraint 2, TFO-01 SEC-1 row)
- [ ] [must-fail-first] `fit-14-package-surface.test.ts` (exports unchanged, `#bin` added, zero-deps, tarball contents) + committed baseline `test/fitness/pkg-surface-baseline.json` (`{exports, files, tarball, bin, shebang}`, Gap 11); FIT-14 regenerates the actual surface and diffs against it
- [ ] [must-fail-first] `fit-15-bin-core-direction.test.ts` (no `src/` runtime import of `bin/`)

---

## S-002: Schema Contract Fitness — Parity + Sufficiency

**Scope**: happy-path · **Dimension**: R (Rule) · **Requires**: S-000 (parallel with S-001/S-003/S-004 — disjoint files)
**Covers**: SCP-01(.1-.4), SCP-02(.1-.6)

**Acceptance**: GIVEN a `schema.json` edited without regenerating WHEN FIT-12 runs THEN it
FAILS naming the package (incl. label-only/content-only drift); regenerating restores green;
the check never mutates the committed file. GIVEN a property missing `type`/`label`, an enum
missing `choices`, a nonsensical `type`, or a `__proto__`/`constructor`/`prototype` key WHEN
FIT-13 runs THEN it hard-fails, named; advisory-only fields pass.

### Tasks
- [ ] [must-fail-first] `fit-12-schema-parity.test.ts` — staled-digest fixture fails; regen restores green
- [ ] content-only drift (label edit, byte-identical type text) still caught; non-destructive-check proof (SCP-01.3/.4)
- [ ] [must-fail-first] `schema-sufficiency.ts` + `fit-13-schema-sufficiency.test.ts` — hard-fail matrix (fixtures: missing-type, missing-label, enum-no-choices, nonsensical-type, proto-declaring)
- [ ] [characterization] advisory-fields-pass positive scenario

---

## S-003: Run-Boundary Validation Matrix

**Scope**: happy-path · **Dimension**: D (Data) · **Requires**: S-000 (parallel with S-001/S-002/S-004)
**Covers**: RBV-01(.2-.8), RBV-02(.1), RBV-03(.1), RBV-05(.1,.2)

**Acceptance**: GIVEN wrong-type/excess-key/non-JSON/reserved-key/proto-key/null-vs-missing/
template-syntax resolved inputs WHEN run THEN each rejects pre-`als.run` as a plain `Error`
(constraint 1 — no `instanceof`/`origin`/`reason` interim), message = the pinned REQ-AEC-09 literal
naming field+type never the value; GIVEN no `schema.json` THEN a stateless
per-run STDERR warning; GIVEN a malformed/unreadable (non-ENOENT) schema THEN fail-closed;
GIVEN an empty schema THEN a distinct warning, run proceeds.

### Tasks
- [ ] [must-fail-first] `schema-validate.ts` — missing/wrong-type/excess/non-JSON + null-vs-missing trichotomy (constraint 5 safe iteration)
- [ ] [must-fail-first] reserved-key-in-input (RBV-01.5) + `__proto__`/`constructor`/`prototype`-in-input, canary-clean (RBV-01.6)
- [ ] template-syntax-opaque scenario (RBV-01.8)
- [ ] `run-boundary-validation.test.ts` — RBV-02 message-shape (field+type, no value)
- [ ] RBV-03 opt-out warning (stateless, per-factory, 2nd-run + 2nd-factory proof)
- [ ] [must-fail-first] RBV-05 non-ENOENT fail-closed (EACCES fixture) + empty-schema distinct-text warning (constraint 4)

---

## S-004: Reserved Lifecycle Names — Module-Structure Enforcement

**Scope**: happy-path · **Dimension**: P (Path) · **Requires**: S-000 (parallel with S-001/S-002/S-003)
**Covers**: RLN-01(.1-.4), RLN-02(.1), RLN-03(.1,.2), FPS-05(.3)

**Acceptance**: GIVEN a factory package with a `pre-execute.ts`/`post-execute.ts` sibling (or
dir-form) WHEN validated THEN rejected, naming the reserved token; a clean factory is
accepted; a `schema.json` field or an exported `remove` named after a reserved/collection
token is NOT rejected by this REQ. Independent of `packageDir`, FIT-16 always-on scan
catches the same violations structurally and flags schema-present-but-untethered packages.

### Tasks
- [ ] [must-fail-first] `context.ts` Modify — reserved-name scan step (kebab, case-insensitive, strip-ext, dir-form; ADR-0028)
- [ ] [must-fail-first] `reserved-lifecycle-names.test.ts` — RLN-01.1-.3 (pre-execute, post-execute, clean) + non-ENOENT unreadable-dir fixture (constraint 4)
- [ ] [characterization] RLN-01.4 + RLN-03.1/.2 boundary-pin (schema field / `add` / exported `remove` NOT rejected) + FPS-05.3 doc note
- [ ] RLN-02.1 — rejection thrown as a plain `Error` with the pinned literal `reserved lifecycle name: {name} …`; distinguishable-in-kind from RBV-01 interim VIA the two DISTINCT message literals (`reserved lifecycle name: …` vs `invalid input: …`); no `instanceof`/`origin`/`reason` interim (constraint 1)
- [ ] [must-fail-first] [permanent-fixture] `fit-16-reserved-name-scan.test.ts` — always-on scan over `ALWAYS_ON_SCAN_ROOTS` only (constraint 9) + 3rd-signal via a SIMPLE substring check (`defineFactory(` call carrying the `packageDir` token) applied ONLY to allowlisted files, no general parsing (Gap 10); red fixtures under `test/fixtures/red/**` (reserved siblings AND a bare-`defineFactory(`-without-`packageDir` file) driven by direct scan-function call, never walked

---

## S-005: Cross-Domain No-Echo Verification + Discoverability

**Scope**: edge-case · **Dimension**: R (Rule) · **Requires**: S-001, S-003, S-004
(3 — accepted exception: REQ-RBV-04 is explicitly spec-titled "Cross-Domain", it verifies
every rejection branch S-001/S-003/S-004 introduce; splitting would fragment one REQ's
single scenario across artificial slice boundaries)
**Covers**: RBV-04(.1,.2), FPS-05(.2,.4)

**Acceptance**: GIVEN a canary token seeded into every schema field/value and every resolved
input value, driven through every rejection branch (RBV-01.1-.8, TFO-04.1, RLN-02.1) WHEN
each error surface (message/`.stack`/fields/stdout/stderr) is scanned THEN the token appears
nowhere — except a key NAME may legitimately appear. GIVEN `defineFactory`'s JSDoc THEN
`@example` demonstrates bin-invocation → typed call end-to-end (asserted by the dedicated `definefactory-jsdoc.test.ts`, Gap 5).

### Tasks
- [ ] [must-fail-first] `canary-no-echo.test.ts` — dictionary-seeded scan across every branch, using `test/support/canary.ts`
- [ ] key-name-vs-value asymmetry pin (RBV-04.2)
- [ ] `context.ts` JSDoc — `@example` (bin→typed workflow), `@param packageDir` (two tiers, `import.meta.dir` steer), `@remarks` (reserved names); NEW dedicated `test/fitness/definefactory-jsdoc.test.ts` (Gap 5) reads `src/core/context.ts` and asserts `@example` + `@remarks` naming BOTH reserved tokens — FIT-06 (`fit-06-example-jsdoc.test.ts`) is left UNTOUCHED (its `PUBLIC_PATHS` scans commons+conformance only; `defineFactory` lives in the internal-kit `src/core/index.ts`)
- [ ] [must-fail-first] README.md — add the REQ-FPS-05.4 qualifying line VERBATIM (see Load-bearing literals) immediately AFTER the CLOSING ``` fence of the "Anatomy" code block that contains the `schema.json # typed inputs` line (iteration-4 pin: the anchor line itself sits INSIDE the fence, where a `>` blockquote cannot render — the line goes right below the block's closing fence, as normal markdown); if that anchor block is absent at build time, place it in the top feature/anatomy section (Gap 13, executor discretion sanctioned — byte-exact literal unchanged either way); a `fit`/test asserts it byte-for-byte greppable; reverted in stage-4b

---

## S-006: Reason-Literal Finalization (GATED on stage-2-error-attribution archive)

**Scope**: edge-case · **Dimension**: R (Rule) · **Requires**: S-003, S-004 — BLOCKED on
`stage-2-error-attribution` archiving + its coordinated `sdd-spec` amendment (REQ-AEC-07/08/09)
landing on Stage 2's own signed spec. NOT droppable — must eventually land; only its start is
gated. No other slice may assert an exact `reason` string (constraint 6).
**Covers**: AEC-07(.1), AEC-08(.1), AEC-09(.1,.2) — deferred scenarios, now unblocked

**Acceptance**: GIVEN Stage 2 archived + its coordinated amendment applied WHEN a
run-boundary/reserved-name rejection is thrown THEN the thrown value is an `AuthoringError` with
`origin: "authoring-rejected"` and `reason` exactly `"invalid-input"`/`"reserved-name"`, and the
message still matches the AEC-09 literals (unchanged from interim).

### Tasks
- [ ] **GATE** — read `src/core/authoring-error.ts` (post Stage-2 archive/rebase) and verify it carries the generalized `origin`/`reason` fields AND the `invalid-input`/`reserved-name` enum members; if NOT, HALT `stage-2-precondition-missing` (Stage-2's signed spec + amendment are the field contract — Gap 2; do NOT edit `authoring-error.ts`)
- [ ] `input-rejection.ts` — UPGRADE the interim plain-`Error` throw to `AuthoringError{origin:"authoring-rejected", reason:…}` constructed via `authoring-error.ts`'s actual public API (message literals unchanged)
- [ ] Flip the interim assertions ON — add `instanceof AuthoringError` + `origin` + exact `reason` string-equality in `run-boundary-validation.test.ts`, `reserved-lifecycle-names.test.ts`, `typed-factory.e2e.test.ts` (interim asserted plain-`Error` + message literal only)
- [ ] Confirm the exact AEC-09 message-template assertions (3 rows) still hold post-upgrade

---

## Build Order

**`/build` deliverable = S-000..S-005.** S-006 is **deferred-blocked**, NOT part of this build —
it lands later via `/build --scope=slice:S-006` once its S-006 gate opens.

**No start precondition (Option A, iteration-2 gaps 3/4)**: the build may start IMMEDIATELY after
plan-verify returns `ready` — every interim rejection throws a plain `Error`, so S-000..S-005 have
ZERO Stage-2 dependency (the rev-2 Tier-1 precondition and S-000 halt-check are removed). S-001..S-004
are parallelizable (disjoint files); a sequential single-pass is acceptable.

**Acceptance bar (Gap 12)**: the FIRST `/build` pass delivers S-000..S-005 and STOPS. The CHANGE
reaches `sdd-verify --mode=final` + archive ONLY after S-006 lands (post `stage-2-error-attribution`
archive + its coordinated amendment). S-006 is deferred-blocked, never dropped — it MUST eventually land.

| Order | Slice | Note |
|---|---|---|
| 1 | S-000 | implicit blocker for all; no precondition — starts immediately |
| 2 | S-001, S-002, S-003, S-004 | disjoint files — parallelizable (sequential single-pass acceptable), each requires only S-000 |
| 3 | S-005 | requires S-001 + S-003 + S-004 (cross-domain scan); also carries the README REQ-FPS-05.4 line. **End of the `/build` deliverable — the change does NOT archive until S-006 lands.** |
| — (deferred-blocked) | S-006 | requires S-003 + S-004; **S-006 gate**: BLOCKED until Stage 2 ARCHIVES + its coordinated `sdd-spec` amendment (REQ-AEC-07/08/09) lands. Built later, out of this `/build`. Not droppable — must eventually land, and the change cannot verify-final/archive before it does. |

## Coverage Check

TFO 2+1+3+6+3=15 · SCP 4+6=10 · RBV 8+1+1+2+2=14 · RLN 4+1+2=7 · FPS 1+2+1+1+4=9 ·
AEC(deferred) 1+1+2=4 → **59/59 scenarios across 25 REQ-IDs**, no orphans (FPS-05.4 added in
spec V3 — the README qualifying-line, covered by S-005). RBV-01 spans
S-000 (Scenario .1, site proof) + S-003 (Scenarios .2-.8, full matrix) — not a duplicate,
a staged completion of one REQ's scenario set.

## Anti-Pattern Check

No horizontal/layer-named slices. Every slice cites ≥1 REQ-ID. No two-SPIDR-dimension
slice. 7 total (target 4-7 ✓). S-005's 3-dependency count is a reviewed exception (REQ-RBV-04
is explicitly cross-domain by spec title, not accidental coupling).

## Upstream Publication

N/A — `spec_source: internal`, Step 8b skipped.
