# Conformance Corpus — SDK-side Handoff

**From**: `project-builder-engine`, change `sdk-live-conformance` (PC-PROTO-02, live SDK↔engine
conformance). **What the engine needs**: a fixture corpus under `conformance/` at the SDK repo
ROOT, landed on SDK `main`. The engine consumes it via a pinned git submodule and drives each
fixture through the REAL runner (`dist/bin/pbuilder-runner.js`) — the Go harness reads only plain
files (`corpus.json`, `manifest.json`, `seed/`, `expected/`, `schematic/`); it never executes TS.
The factory is executed by the runner itself.

**Priority**: `m1-vehicle` FIRST — it alone unblocks the engine's M1 milestone (handshake + round
trip). The four `m2-*` fixtures can land in a later PR.

**Already landed** (nothing to do): `package.json#engines.bun = "1.3.14"` exact.

---

## On-disk layout

```
conformance/
  corpus.json                # fixture registry (authoritative set)
  <fixture-id>/
    manifest.json            # machine-readable per-fixture contract (schema below)
    factory.ts               # the runner's --factory target — export default, Bun-native TS
    seed/                    # OPTIONAL: files copied into the workspace before the run
    expected/                # OPTIONAL: byte-exact post-run workspace snapshot (positive cases)
    schematic/               # OPTIONAL: producer-format schematic (m1-vehicle + composition only)
      schema.json
      files/<template…>
```

`corpus.json`:

```json
{ "wireSpecVersion": 1, "fixtures": ["m1-vehicle", "m2-modify", "m2-delete", "m2-rename-move", "m2-create-composition"] }
```

List ONLY fixtures that exist — the engine loader is fail-closed: a listed id without a
`manifest.json`, a fixture dir with a `factory.ts` but no manifest, or a manifest whose `id` differs
from its dir name are all HARD failures engine-side, not skips.

## Factory conventions

- `export default` the factory function; the engine builds the pointer
  `file://<abs>/conformance/<id>/factory.ts` with NO `#fragment` (default export). A named export
  needs `"factory": {"module": "factory.ts", "export": "name"}` in the manifest — avoid unless
  necessary.
- Import the SDK via relative source path (e.g. `../../src/index.ts`) — same convention as
  `test/fake/conformance-corpus.ts`. The factory is loaded from SOURCE by Bun; it is NOT part of
  `bun run build` output.
- Factories author REPRESENTABLE ops only: `modify`, `delete`, `rename`, `move`. A wire `create`
  appears exactly once in the whole corpus — as `m2-create-composition`'s deliberate reject probe.
- Exit-code taxonomy (already in `docs/engine-sdk-wire-spec.md`, EXC-01): `0` success, `1`
  greeting/validation failure, `2` host refusal (`IntentRejectedError`).

## `manifest.json` schema (per fixture)

```json
{
  "id": "<fixture-id>",
  "wireSpecVersion": 1,
  "class": "wire-mutation",                      // handshake | wire-mutation | composition
  "factory": { "module": "factory.ts", "export": null },
  "input": {},                                   // JSON passed as --input to the runner
  "lowering": { "mode": "none" },                // none | schematic (schematicRoot defaults "schematic")
  "cases": [
    {
      "name": "positive",
      "greetingVersion": 1,                      // 1 normal; 2 = engine's greeting-mismatch twin
      "seed": "seed",                            // dir copied into workspace pre-run; null = empty
      "expected": "expected",                    // dir | "zero-effect" | "empty"
      "outcome": { "exitCode": 0, "emitRejectionCode": null, "failedIndex": null, "writtenPaths": [] },
      "transcript": { "callbacks": ["tree.read", "ir.emit", "ir.commit"], "singleCommit": true, "forbidDiscard": true, "emitBeforeCommit": true }
    }
  ]
}
```

The `callbacks` shown above are illustrative only — the real sequence is per-fixture (e.g.
`m2-modify` never does `tree.read`; only `m1-vehicle` reads before writing). Each fixture's own
`manifest.json` is the normative source for its `transcript`.

Notes: negative twins are extra `cases[]` on the SAME fixture, never separate fixtures.
`emitRejectionCode` non-null requires `exitCode: 2`; `failedIndex` is an int only for
directive-level codes (`not-found`, `collision`) and `null` for batch-level ones
(`unrepresentable`).

**ACCEPTED (engine sign-off 2026-07-18, loader support landed engine-side on branch
`sdk-live-conformance/build` @ `17a49ab` — `m2-create-composition/manifest.json` may now be
authored against this schema)**: a `cases[]` entry MAY carry its own
`"factory": { "module": "factory.ts", "export": "<name>" }`, overriding the fixture-level
`factory` for THAT case only. `m2-create-composition` needs this: its `positive` case authors a
`modify` via the DEFAULT export, while `wire-create-reject-twin` must author the raw wire `create`
from a SEPARATE named export (`createRejectProbe`) so both behaviours live in ONE fixture — twins
are cases on the same fixture (never separate fixtures), and branching a single default factory
would pull a `create` path into the positive authoring, muddying the representable-ops-only
quarantine. The engine's Go loader would need to resolve a case-level `factory.export` to a
`file://…/conformance/<id>/factory.ts#<name>` pointer for that case (default export otherwise).
(Origin: SDK-side `conformance-corpus` change, design ADR-0065. The earlier authoring hold is
LIFTED by the acceptance above.)

**Engine loader strictness (effective with the same commit)**: the engine's manifest/corpus
decoding is now STRICT (`DisallowUnknownFields`) — any unknown key at any level (top-level,
`factory`, `lowering`, `cases[]`, `outcome`, `transcript`, `corpus.json`) is a hard failure
engine-side, not ignored. Schema evolution must go through this doc BEFORE a fixture ships a new
key. The corpus-root ambiguity guard is also live: an undeclared directory containing `factory.ts`
or `manifest.json` is fatal; non-fixture stray files (e.g. `collection.json`) and non-fixture dirs
are inert.

**Also flagged, SDK-side only (engine-loader-invisible)**: the corpus ships a presence-only
`conformance/collection.json` marker at its root. The SDK runner's `defineFactory({packageDir})`
package-anchor resolution (`resolvePackageRoot`, ADR-0046) walks upward for a `collection.json`
ancestor and exits 1 before any factory runs if none exists; the marker satisfies it. The Go
loader neither reads nor parses this file — it changes nothing engine-side, noted for awareness
only. (Origin: design ADR-0067 / REQ-CCR-08.)

---

## The five fixtures

### 1. `m1-vehicle` — `class: handshake`, `lowering: schematic` ← BUILD THIS FIRST

- **Seed**: none (empty pre-run workspace — required).
- **Schematic**: `schema.json` = `{"schema_version":"1","name":"m1","variables":[]}`;
  `files/out.txt` = `v1`. (The engine's lowering pre-stages this create before spawn.)
- **Factory**: `find("out.txt").read()`, then author a `modify` of `out.txt` with exact content
  `v2`.
- **Cases**:
  - `positive` (greetingVersion 1): exit 0; `expected/out.txt` = `v2`;
    `writtenPaths: ["out.txt"]`; transcript `[tree.read, ir.emit, ir.commit]`.
  - `greeting-mismatch-twin` (greetingVersion 2): exit 1; `expected: "empty"` (zero files);
    empty transcript (zero callbacks). No factory change — the engine flips the greeting.

### 2. `m2-modify` — `class: wire-mutation`, `lowering: none`

- **Seed**: `target.txt` = `orig`, `sibling.txt` = `keep`.
- **Factory**: `modify` of `target.txt`, content `replaced`.
- **Cases**: `positive` (exit 0; `expected/` = `{target.txt: "replaced", sibling.txt: "keep"}`;
  `writtenPaths: []`); `not-found-twin` (`modify` of `missing.txt` → `not-found`, `failedIndex: 0`,
  exit 2, `zero-effect`).

### 3. `m2-delete` — `class: wire-mutation`, `lowering: none`

- **Seed**: `target.txt` = `gone`, `sibling.txt` = `keep`, `adir/child.txt` = `x`.
- **Factory**: `delete` of `target.txt`.
- **Cases**: `positive` (exit 0; expected = `{sibling.txt, adir/child.txt}`, target absent);
  `not-found-twin` (`missing.txt` → `not-found`, `failedIndex: 0`, exit 2, `zero-effect`);
  `dir-target-twin` (`delete` of `adir` → `unrepresentable`, batch-level / no `failedIndex`,
  exit 2, `zero-effect`).

### 4. `m2-rename-move` — `class: wire-mutation`, `lowering: none`

- **Seed**: `src.txt` = `payload`, `occupied.txt` = `taken`, `adir/child.txt` = `x`.
- **Factory**: `rename` of `src.txt` → `dst.txt` (or the `move` equivalent).
- **Cases**: `positive` (exit 0; expected = `{dst.txt: "payload", occupied.txt: "taken",
  adir/child.txt: "x"}` — src absent AND dst carries src's exact bytes);
  `collision-twin` (destination = existing `occupied.txt`, no force → `collision`,
  `failedIndex` present, exit 2, `zero-effect`); `dir-source-twin` (source = `adir` →
  `unrepresentable`, batch-level, exit 2, `zero-effect`).

### 5. `m2-create-composition` — `class: composition`, `lowering: schematic`

- **Seed**: `existing.txt` = `orig`.
- **Schematic**: `schema.json` = `{"schema_version":"1","name":"compose","variables":[]}`;
  `files/generated.txt` = `generated`. (The CREATE half comes from the engine's lowering — the
  factory must NOT author it.)
- **Factory**: `modify` of `existing.txt`, content `composed`.
- **Cases**:
  - `positive`: exit 0; single `ir.commit` flushes both halves; `expected/` =
    `{generated.txt: "generated", existing.txt: "composed"}`; `writtenPaths: ["generated.txt"]`
    exactly.
  - `wire-create-reject-twin`: the factory emits a RAW `{op: "create", …}` batch entry — authored
    SDK-side (via normal create authoring or `currentContext().session.buffer`; the engine will
    never fabricate this batch) → `unrepresentable`, batch-level / no `failedIndex`, exit 2,
    `zero-effect`.

---

## Delivery checklist

1. `conformance/` at repo root with `corpus.json` + fixture dirs as above (start with
   `corpus.json` listing only `m1-vehicle`; extend the list as each `m2-*` lands).
2. Factories run under the pinned Bun (`engines.bun 1.3.14`); `bun install --frozen-lockfile &&
   bun run build` must stay green — the engine's CI builds the runner from this tree.
3. Land on SDK `main` (normal PR flow). Then tell the engine side: it advances the submodule pin
   (gitlink) to the new SHA and the conformance suite starts exercising the fixtures live.
