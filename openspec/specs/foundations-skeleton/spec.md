# Specification: foundations-skeleton

**Spec version**: V4 (plan-verify converged; author-facing API frozen — find + 6 verb mappings + runner injection)
**Domains**: PKG · KIT · FAKE · SKEL · GIR · FIT · STD · CONF
**Sensitive**: deployment/publish, supply-chain → security REQs inline.

---

## PKG — publishable package

### REQ-PKG-01: Subpath exports, no kit leak
`package.json#exports` MUST expose `.` (umbrella → commons surface), `./commons`, `./conformance`, and MUST NOT expose `./core`/`./internal`/`./kit`. The reserved dialect subpath is documented, NOT wired.
- GIVEN the package, WHEN a consumer imports `@pbuilder/sdk/core`, THEN resolution fails; AND `@pbuilder/sdk/commons` resolves.

### REQ-PKG-02: Publish build emits ESM + `.d.ts`, separate from the dev tsconfig
A `tsconfig.build.json` distinct from the `noEmit` dev `tsconfig` MUST emit ESM + `.d.ts` per subpath.
- GIVEN the build script, WHEN run, THEN `dist/commons/index.{js,d.ts}` exist; AND `tsc --noEmit` still typechecks `src/` without emitting.

### REQ-PKG-03: CI publishes a dev prerelease with provenance, isolated from PR/forks
CI on **`main`** (the protected ref) MUST publish with `--provenance` via npm **trusted publishing (OIDC, no long-lived token)**; the publish job MUST be unreachable by PR/fork builds. To stay idempotent (a fixed version cannot be re-published), the version is **`0.0.0-dev.<short-sha>`** on the `dev` dist-tag. npm trusted-publishing is an **external registry-side precondition**: CI acceptance asserts the workflow config + a **publish dry-run** + the provenance flag; a real publish runs once registry trust is established.
- GIVEN a push to `main`, THEN the publish job runs a provenance dry-run.
- GIVEN a fork PR, THEN the publish job does not run and has no credential.

---

## KIT — the core (ADR-0009 boundary)

### REQ-KIT-01: `EngineClient` port
`core` MUST define `EngineClient { emit(batch): Promise<void>; read(path): Promise<string> }` as the sole transport seam; the fake and the future real client both implement it. The return is a **bare `Promise<string>`** — the fake's `served:"tree"|"disk"` signal (REQ-FAKE-02) is **fake-internal test state** (e.g. `fake.lastServed`), queried out-of-band by fake tests, NEVER part of `EngineClient.read`.

### REQ-KIT-02: `Session` — buffer + flush-before-read, NO tree
`Session` MUST hold only the pending-directive buffer + the `EngineClient`; `read(path)` MUST flush pending THEN delegate to `EngineClient.read`; it MUST hold no path-keyed collection.
- GIVEN a buffered `create(P)`, WHEN `read(P)`, THEN `emit` (flush) fires BEFORE `read` (spied); AND a fitness test asserts no `Map<path,*>`/tree field in `core`.

### REQ-KIT-03: `DirectiveFactory` — pure, ADR-0028 shapes, AST-blind
`DirectiveFactory` MUST expose one pure method per wire op returning the exact ADR-0028 directive; it MUST NOT render templates or touch an AST.
- GIVEN `create({pathTemplate, template, options})`, THEN it returns `{op:"create", create:{pathTemplate, template, options}}` with `template` byte-identical (unrendered).
- `remove(a)` emits wire op **`delete`** (`{op:"delete", delete:{path}}`) — author verb `remove` ≠ wire op `delete` (ADR-0028 vocabulary); the golden asserts `op:"delete"`.
- **Author surface (frozen public API — positional + trailing options)**: `find(path): FoundHandle` · `create(path, {template, options, force?}): WritableHandle` · `modify(path, content): WritableHandle` · `remove(path): void` (also `find(path).remove()`) · `rename(path, newName, {force?}?): WritableHandle` · `move(path, toDir): WritableHandle` · `copy(from, to, {force?}?): WritableHandle`.
- **Author→factory mapping**: `create(path,{template,options,force?})`→`factory.create({pathTemplate:path,template,options,force})`; `modify(path,content)`→`factory.modify({path,content})`; `remove(path)`→`factory.remove({path})`→`op:"delete"`; `rename(path,newName,{force?})`→`factory.rename({path,newName,force})`; `move(path,toDir)`→`factory.move({path,toDir})`; `copy(from,to,{force?})`→`factory.copy({from,to,force})`.

### REQ-KIT-04: Handle state machine — open, type-enforced
`find(path)` returns `FoundHandle` (has `remove`); writes return `WritableHandle` (no `remove`); `remove()` returns `void`. Both handles expose `read(): Promise<string>` (delegates to `Session.read`, flush-before-read). The handle is OPEN (ops composed per ADR-0010), not a sealed subclass.
- type-level: `create().remove` MUST NOT typecheck; `find().remove()` MUST; each negative paired with a positive `expectTypeOf`; the permissive-Handle mutation proof MUST flip the negatives green.

### REQ-KIT-05: Ambient `RunContext` (AsyncLocalStorage)
`find`/`create` MUST resolve `Session`/`DirectiveFactory` from an ALS `RunContext = { session, factory }` activated by `defineFactory`; `currentContext()` MUST throw outside a run. `defineFactory<O>(fn)` MUST return a runner `(o, deps:{client: EngineClient}) => Promise<void>` that builds `RunContext` from `new Session(deps.client)` + a `DirectiveFactory` and runs `fn(o)` inside the ALS — the `EngineClient` is **injected by the caller** (the test passes the fake), never a module global.
- GIVEN a verb called outside a run, THEN it throws a clear error.
- GIVEN the runner invoked with the fake as `deps.client`, THEN the verb uses the fake (no global).
- **Run-end flush (NOT read-coupled)**: the runner MUST flush the session after `fn` resolves (in a `finally`-safe path). A **write-only factory** — `create`/`modify`/`remove`/… with NO `read` — MUST still emit its batch. `read`-triggered flush (REQ-KIT-02) is an ADDITIONAL trigger, never the only one; a buffered write is never silently dropped at run end.
- GIVEN a factory that only `create`s `P` (never reads), WHEN the runner resolves, THEN `emit` fired with `P`'s directive (a subsequent `read(P)` returns the written content).

---

## FAKE — the contract fake (the downstream oracle)

The fake is seeded via its constructor: `new ContractFake({ seed: Record<path, content> })`. It is a **single-phase, eager-apply, flat in-memory tree** — it does NOT model engine-internal staging.

### REQ-FAKE-01: Eager batch apply in array order
`emit(batch)` MUST apply instructions to the tree in array order before resolving.
- GIVEN `[create A, modify A]`, THEN a later read of A sees the modified content (reordering the fake fails the test).

### REQ-FAKE-02: Tree-first read + served-from tag (fake-internal)
`read(P)` MUST return staged content if P was touched, else the disk seed; the fake MUST expose `served:"tree"|"disk"` as **fake-internal test state**, not in the port return.
- GIVEN seed P differs from staged P, THEN read returns staged with `served:"tree"`; an untouched seeded path returns `served:"disk"`.

### REQ-FAKE-03: Flush-before-read round-trip (no SDK shadow)
A read after buffered writes MUST observe them via flush; the SDK MUST hold no copy.

### REQ-FAKE-04: Fail-closed + force precedence (all 3 rows)
`effective = envelope.force OR op.force`. `create`/`rename`/`copy` over an existing target → error unless `effective`.
- the 3 rows asserted: (no force → error), (op.force=true → overwrite), (**envelope.force=true**, op.force=false → overwrite).

### REQ-FAKE-05: Idempotent delete
`delete` of an absent target MUST succeed (≤ warning), never error; double-delete still succeeds.

### REQ-FAKE-06: Fidelity to the engine's OBSERVABLE contract (not its internals)
The fake's conformance suite MUST assert the engine's **observable wire/conversation contract** — REQ-FAKE-01..05 (eager array-order apply, Tree-first read, flush-before-read, fail-closed + force per ADR-0028, idempotent delete) — via an **independent** suite (not the SDK tests that consume the fake). It MUST NOT model engine-internal staging (`StatusMovedAway`/`MovedHere` tombstones, `opLog`, the commit pass, the `*ConflictError{RuleID}` taxonomy) — those never cross the seam and are outside the SDK's observation. The oracle is the conversation contract (ADR-0028 + engine design.md §4), NOT a 1:1 port of the engine's two-phase internals.

### REQ-FAKE-07: `modify` of a non-existent path errors — but staging counts as existence

> RED posture: **must-fail-first** for the rejection scenario — today's fake silently
> materializes `modify` of a missing path, so REQ-FAKE-07.1 fails red against the current
> fake before the fix lands. REQ-FAKE-07.2/07.3 are green-path guards that must survive the
> fix (07.3 kills the seed-only existence-check mutant).

`modify` MUST require the target path to already exist (in `#tree` staging or `#seed`, and
not `#deleted`) — `modify` never materializes a new file; creating content at a new path is
`create`'s job (ADR-0017 rule 2). Existence includes paths created EARLIER IN THE SAME
BATCH: the fake applies eagerly in array order, so a `modify` after a `create` of the same
path in one batch sees the staged entry.

- GIVEN a `ContractFake` with an empty seed and tree, WHEN `emit` is called with a `modify`
  directive targeting an untouched path, THEN `emit(batch)` rejects AND the path is not
  present in the tree afterward.
- GIVEN a `ContractFake` seeded with path P, WHEN `emit` is called with `modify` on P,
  THEN it succeeds (existing behavior unchanged).
- GIVEN a `ContractFake` with an EMPTY seed, WHEN `emit` is called with a single batch
  `[create("X", content1), modify("X", content2)]`, THEN it succeeds AND a subsequent read
  of `X` returns `content2` — the existence check consults staging, not only the seed (kills
  the seed-only existence-check mutant).

---

## SKEL — the walking skeleton

### REQ-SKEL-01: Byte-exact read-your-own-write
A `defineFactory` that `create`s `P` with content `X`, run against the fake, then `find(P).read()` MUST return `X` byte-exact (served by the fake). The assertion MUST be content equality — NOT "did not throw" / `toBeDefined`. `find().read()` is a REAL read path in the skeleton; other handle write-ops defer to S-003.
- flow: `commons.create` → `RunContext` → `DirectiveFactory` → `Session`(buffer/flush) → `EngineClient` → fake(apply) → `read` → up.

---

## GIR — golden-IR

### REQ-GIR-01: Golden-IR per op, exact-key
Each `DirectiveFactory` op MUST deep-equal (exact keys, no extras) a committed, hand-written fixture. `create` proves the template unrendered. `remove`→`{op:"delete", delete:{path}}`; `rename`={path,newName}; `move`={path,toDir}; `copy`={from,to} (shape-only — apply deferred). Envelope={protocolVersion:1, force, instructions[]} ordered. Never auto-recorded snapshots.

### REQ-GIR-02: Chained-handle Batch fixtures

> RED posture: **must-fail-first** for the fixture-comparison tests as tests of NEW fixture
> shape (no multi-directive Batch fixture exists today — the test file/fixtures don't exist
> until written).

Golden-IR extends beyond single directives: ≥1 hand-written, committed **Batch** fixture (not
a bare `Directive`) exists per named chained-handle program. The SUT is the
FACTORY-PRODUCED batch captured (via `emit` spy) from a REAL `defineFactory` run — the
comparison is run-output vs. the hand-written fixture, never fixture vs. itself. The full
`instructions[]` array deep-equals the fixture, exact keys, in author order.

- GIVEN a real `defineFactory` run that calls `rename(path, newName)` then chains
  `.move(toDir)` on the returned handle, WHEN the emitted batch (captured by spy) is
  compared to the hand-written `rename-then-move` fixture, THEN `instructions` deep-equals
  `[{op:"rename",...}, {op:"move",...}]` in order.
- GIVEN a real `defineFactory` run that calls `create(path, opts)` then chains
  `.modify(content)` on the returned handle, WHEN the emitted batch is compared to the
  hand-written `create-then-modify` fixture, THEN `instructions` deep-equals
  `[{op:"create",...}, {op:"modify",...}]` in order.

### REQ-GIR-03: Emission determinism proof + envelope key-order golden pin

> RED posture: **characterization / RED-waived** — determinism is a property of TODAY'S
> factory/session code; the proof pins pre-existing behavior (prove+freeze precedent from
> `typed-options-and-read` #2). The committed golden byte-string is new but freezes what
> already holds.

Running the same `defineFactory` body with the same inputs twice against a fresh
`ContractFake` each time MUST produce byte-identical serialized `Batch` output
(`JSON.stringify` string equality, not `toEqual`). Self-consistency alone is insufficient —
the serialized output ALSO MUST equal one committed golden byte-string, which fixes the
envelope key order `protocolVersion, force, instructions` literally in the pinned string.

- GIVEN a factory buffering ≥2 directives, WHEN run twice (spy on `emit`) with fresh fakes,
  THEN `JSON.stringify(batch1) === JSON.stringify(batch2)`.
- GIVEN the same run, WHEN its serialized `Batch` is compared to a committed golden string
  constant, THEN it matches exactly, including key order `protocolVersion` before `force`
  before `instructions`.

---

## FIT — fitness functions (each with a red-proof)

### REQ-FIT-01: commons imports zero AST libs — import-graph scan over `src/commons/**` with an **allow-list** = { the SDK's own `core` public symbols, Node/Bun builtins }; any other import (esp. ts-morph/postcss/cheerio/babel) → fail.
### REQ-FIT-02: no dialect imports another dialect (leaf rule).
### REQ-FIT-03: `/commons` payload budget — `bun build` of the `/commons` entry MUST stay under **50 KB** minified AND contain no AST-lib module specifier; MUST ship a fixture AST import proving it fires red. (Generous; tightened when real deps land.)
### REQ-FIT-04: public `.d.ts` semver gate — committed baseline + CI diff; a breaking export change without a version bump fails.
### REQ-FIT-05: only serializable bytes cross the seam — `JSON.parse(JSON.stringify(directive))` deep-equals.
### REQ-FIT-06: every public export carries a JSDoc `@example`.
### REQ-FIT-07: no `Map<path,*>`/tree field in `core` (ADR-0008).
### REQ-FIT-08: no author subpath re-exports a kit symbol (ADR-0009).

### REQ-FIT-09: Structural `EngineClient` port guard

> Naming note: the test FILE follows the existing file-count convention —
> `test/fitness/fit-10-*.test.ts` (the 10th fitness test file; `fit-09` is already
> `fit-09-pkg-exports-resolution.test.ts`, which tests REQ-PKG-01, not a `REQ-FIT-*`). The
> FIT domain's own REQ-ID sequence stops at REQ-FIT-08, so THIS requirement is **REQ-FIT-09**
> — not "FIT-10" as informally referenced in explore/proposal. Design/apply MUST use
> REQ-FIT-09 as the stable ID; the file name staying `fit-10-*` is not an ID mismatch.
>
> RED posture: the planted-bypass red-proof is a **PERMANENT string-fixture test** (like
> FIT-01/FIT-08's red-proofs — a fixture SOURCE STRING scanned in-test, never a committed
> poisoned module). It stays in the suite forever, NOT a transient red-phase gate.

No module under `src/**` OUTSIDE `src/core` MUST name the `EngineClient` symbol (type or
value import) or call a `.emit(`/`.commit(`/`.discard(` site reachable from it — a static
scan (mirroring FIT-01/FIT-08's regex approach) enforces this. ALLOW-LISTED:
`test/support/contract-fake.ts`'s single legitimate `import type { EngineClient }` (the
downstream oracle implementing the port). `Directive`/`JsonValue` (shared wire types from
`wire.ts`) are exempt everywhere — they are data shapes, not the port. The allow-list
MECHANISM (path list vs. structural exception) is a design decision, not specified here.

- EVERY FIT REQ: a meta-test MUST demonstrate the function fails RED against a deliberate violation.
- **Activation is per-slice**: a fitness function wires into CI when the surface it polices first lands (FIT-01/05/07 from S-000; FIT-04/06 with the build at S-004; FIT-08 once subpaths exist; FIT-09 at S-1.8) — NOT all at commit one, so the suite stays green under Strict TDD.

---

## STD — standards, docs, ADRs

### REQ-STD-01: Public-repo standards + contributor on-ramp doc
CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (MUST state the explicit-trust posture: importing any dialect/op-pack runs its code with full process privilege; no sandbox/signing in v1; vet before importing), issue/PR templates, CI runs on forks/PRs. MUST also ship a **stub `docs/authoring-a-dialect.md`** (the contributor on-ramp; content deferred to T-M2 — the file existing with a titled outline is the acceptance bar).
- GIVEN the repo, THEN `docs/authoring-a-dialect.md` exists with a titled outline; AND SECURITY states the explicit-trust posture verbatim.

### REQ-STD-02: The two ADRs
`verb→IR lowering table` + `single-package + subpath-exports shape` (monorepo-deferral trigger = first external/2nd dialect) MUST be written to `openspec/decisions`.

---

## CONF — conformance scaffold

### REQ-CONF-01: Scaffold + meta-tests (impl deferred)
`@pbuilder/sdk/conformance` MUST export `testDialect`/`testOpPack` signatures + a meta-test placeholder asserting the kit's own properties (remove a property → meta-test red). Full dialect-testing impl deferred (no dialect exists yet).
