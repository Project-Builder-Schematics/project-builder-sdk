# Delta for foundations-skeleton

**Spec version**: V2
**Status**: draft
**Change**: `stage-1-ir-bedrock`

## ADDED Requirements

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

#### Scenario REQ-FAKE-07.1: modify of an untouched path rejects and never materializes

- GIVEN a `ContractFake` with an empty seed and tree
- WHEN `emit` is called with a `modify` directive targeting an untouched path
- THEN `emit(batch)` rejects AND the path is not present in the tree afterward

#### Scenario REQ-FAKE-07.2: modify of a seeded path succeeds

- GIVEN a `ContractFake` seeded with path P
- WHEN `emit` is called with `modify` on P
- THEN it succeeds (existing behavior unchanged)

#### Scenario REQ-FAKE-07.3: intra-batch `[create X, modify X]` succeeds — staging counts

- GIVEN a `ContractFake` with an EMPTY seed
- WHEN `emit` is called with a single batch `[create("X", content1), modify("X", content2)]`
- THEN it succeeds AND a subsequent read of `X` returns `content2` — the existence check
  consults staging, not only the seed (kills the seed-only existence-check mutant)

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

- GIVEN a planted-bypass fixture source (string fixture, not committed) outside `src/core`
  that imports `EngineClient` and calls `.emit(...)`, WHEN scanned, THEN it is flagged as a
  violation.
- GIVEN `test/support/contract-fake.ts`'s real source, WHEN scanned, THEN its `EngineClient`
  import is NOT flagged (allow-listed).
- GIVEN a fixture importing only `Directive`/`JsonValue` from `../core/wire.ts` outside
  `src/core`, WHEN scanned, THEN it is NOT flagged.
- GIVEN today's `src/commons/index.ts` and `src/conformance/index.ts`, WHEN scanned, THEN
  both pass clean (neither names the port).

## MODIFIED Requirements

### REQ-GIR-01: Golden-IR per op, exact-key

> RED posture: the `move` force-present fixture is **must-fail-first** — `MoveArgs` has no
> `force` today, so the fixture comparison cannot pass until the wire/factory change lands.
> The force-absent fixtures are characterization pins of existing shapes.

Each `DirectiveFactory` op MUST deep-equal (exact keys, no extras) a committed, hand-written
fixture. `create` proves the template unrendered. `remove`→`{op:"delete", delete:{path}}`;
`rename`={path,newName}±force; `move`={path,toDir}±force; `copy`={from,to}±force
(shape-only — apply deferred). Envelope={protocolVersion:1, force, instructions[]} ordered.
Never auto-recorded snapshots. Each of the six wire ops (`create`, `modify`, `delete`,
`rename`, `move`, `copy`) has ≥1 committed fixture; `rename`/`move`/`copy` each have a
force-present AND a force-absent fixture (`move`'s force fixture is new — ADR-0017 closure).

- GIVEN `factory.move({path, toDir, force: true})`, WHEN compared to its fixture, THEN the
  directive includes `force: true` — no extra keys.
- GIVEN `factory.move({path, toDir})` (no force), WHEN compared to its fixture, THEN the
  directive omits the `force` key entirely (`"force" in directive.move` is `false`).

(Previously: `move` had no `force` key anywhere in its fixture or factory output — this
requirement pins the ADR-0017 wire addition.)

### REQ-FAKE-04: Fail-closed + force precedence (all 3 rows) — `move` joins; identity excluded

> RED posture: the `move` collision scenarios below are **must-fail-first** — today's fake
> silently overwrites on `move` collision (no `#exists(dst)` check), so REQ-FAKE-04.m1
> fails red against the current fake before the fix lands. The existing
> `create`/`rename`/`copy` rows are already pinned green (unchanged).

`effective = envelope.force OR op.force`. `create`/`rename`/`copy`/`move` over an existing
target → error unless `effective`.
- the 3 rows asserted for all four verbs: (no force → error), (op.force=true → overwrite),
  (**envelope.force=true**, op.force=false → overwrite).
- **Identity exclusion (ADR-0017 scope clarification)**: `dst === src` is NOT a collision.
  The fail-closed destination check excludes identity — a self-move (`move` whose resolved
  destination equals the source path) is a file-preserving SUCCESS, no force required.
  Rationale: colliding with yourself is not data loss; matches fs rename semantics. Design
  MUST fold this clarification into ADR-0019 or an ADR-0017 amendment note.

#### Scenario REQ-FAKE-04.m1: move onto an existing destination REJECTS without force

- GIVEN a `ContractFake` seeded with `"src/foo.ts"` and `"lib/foo.ts"` (destination exists)
- WHEN `emit` carries `move("src/foo.ts", "lib")` with no force (op or envelope)
- THEN `emit(batch)` rejects
- AND `"lib/foo.ts"` still holds its ORIGINAL content and `"src/foo.ts"` is still present

#### Scenario REQ-FAKE-04.m2: move with op.force=true overwrites

- GIVEN the same seed as REQ-FAKE-04.m1
- WHEN `emit` carries `move` with `force: true` on the op
- THEN it succeeds; `"lib/foo.ts"` holds the SOURCE content and `"src/foo.ts"` reads absent

#### Scenario REQ-FAKE-04.m3: envelope.force=true, op.force absent — move overwrites (Row 3)

- GIVEN the same seed as REQ-FAKE-04.m1
- WHEN `emit` carries `move` with no op-level force inside a batch whose envelope
  `force: true`
- THEN it succeeds; `"lib/foo.ts"` holds the SOURCE content

#### Scenario REQ-FAKE-04.m4: self-move (dst === src) is a file-preserving success

- GIVEN a `ContractFake` seeded with only `"src/foo.ts"`
- WHEN `emit` carries `move("src/foo.ts", "src")` (resolved destination equals the source)
  with NO force
- THEN it succeeds (no collision error) AND `"src/foo.ts"` still reads its original content

(Previously: only `create`/`rename`/`copy` participated in fail-closed collision handling;
`move` silently overwrote an existing destination with no check at all — ADR-0017 closes
this gap. The identity exclusion is new scope clarification in this change.)

### REQ-KIT-03: `DirectiveFactory` — pure, ADR-0028 shapes, AST-blind

> RED posture: the `move`-with-force scenarios (free function AND both handle forms) are
> **must-fail-first** — no `force` parameter exists on any `move` surface today, so these
> cannot pass until the threading lands end-to-end.

`DirectiveFactory` MUST expose one pure method per wire op returning the exact ADR-0028
directive; it MUST NOT render templates or touch an AST.
- GIVEN `create({pathTemplate, template, options})`, THEN it returns `{op:"create",
  create:{pathTemplate, template, options}}` with `template` byte-identical (unrendered).
- `remove(a)` emits wire op **`delete`** (`{op:"delete", delete:{path}}`) — author verb
  `remove` ≠ wire op `delete` (ADR-0028 vocabulary); the golden asserts `op:"delete"`.
- **Author surface (frozen public API — positional + trailing options)**: `find(path):
  FoundHandle` · `create(path, {template, options, force?}): WritableHandle` · `modify(path,
  content): WritableHandle` · `remove(path): void` (also `find(path).remove()`) ·
  `rename(path, newName, {force?}?): WritableHandle` · `move(path, toDir, {force?}?):
  WritableHandle` · `copy(from, to, {force?}?): WritableHandle`.
- **Author→factory mapping**: `create(path,{template,options,force?})`→
  `factory.create({pathTemplate:path,template,options,force})`; `modify(path,content)`→
  `factory.modify({path,content})`; `remove(path)`→`factory.remove({path})`→`op:"delete"`;
  `rename(path,newName,{force?})`→`factory.rename({path,newName,force})`;
  `move(path,toDir,{force?})`→`factory.move({path,toDir,force})`;
  `copy(from,to,{force?})`→`factory.copy({from,to,force})`.
- **Handle write-ops mirror the free functions 1:1** (`WriteOps`, `base-handle.ts`):
  `WritableHandle.move` and `FoundHandle.move` both gain the same trailing `{force?}` shape
  as their `.rename`/`.copy` siblings — `move(toDir, opts?: {force?: boolean})`.

#### Scenario REQ-KIT-03.1: free-function move threads force to the wire

- GIVEN `move(path, toDir, {force: true})`
- THEN `factory.move` is called with `{path, toDir, force: true}` and the wire directive
  carries `force: true`

#### Scenario REQ-KIT-03.2: BOTH handle forms thread force to the wire

- GIVEN a `WritableHandle` (from a write verb) calling `.move(toDir, {force: true})`
- AND separately a `FoundHandle` (from `find`) calling `.move(toDir, {force: true})`
- WHEN each buffered directive is captured
- THEN BOTH wire directives carry `force: true` — the threading exists on the handle path,
  not only the free function (kills the free-function-only threading mutant)

#### Scenario REQ-KIT-03.3: no opts omits force on every surface

- GIVEN `move(path, toDir)` and `handle.move(toDir)` on either handle form (no opts)
- THEN each wire directive omits the `force` key entirely

(Previously: `move(path, toDir)` and `.move(toDir)` had no `force` parameter anywhere on the
author surface — this requirement closes ADR-0017's wire-vs-surface gap; FIT-04 confirms the
addition is additive-only, no breaking removal.)
