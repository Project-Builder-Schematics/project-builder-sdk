# `conformance/` — SDK↔engine live conformance corpus

`conformance/` at the repo root is the SDK↔engine live conformance corpus consumed by
`project-builder-engine` as a pinned git submodule: its Go harness reads `corpus.json` and
every fixture's `manifest.json`/`factory.ts`/`seed/`/`expected/`/`schematic/` as plain files
and drives each factory through the REAL runner (`dist/bin/pbuilder-runner.js`). It is
**unrelated** to three same-named neighbours in this repo: the published `./conformance`
package export (`src/conformance/**`, the dialect-conformance kit, ADR-0012),
`test/fake/conformance-corpus.ts` (fake-engine unit scenarios), and
`test/e2e/author-emulation/corpus/` (SDK-internal e2e transcripts). Naming adjacency only —
no code relationship between `conformance/` and `./conformance`.

## Honesty boundary (REQ-CFX-11)

This SDK repo has no runner-driven execution path. Every case's `outcome` (exit code,
rejection code, `writtenPaths`) and `transcript` (reverse-callback sequence) is a
**declaration** — traced from runner source and hand-authored against
`CONFORMANCE-CORPUS-HANDOFF.md` — never SDK-proven. Runner-driven outcomes are
**engine-authoritative**: the first real proof that a fixture produces these exact bytes,
exit codes, and callbacks happens only when the engine's Go harness runs it. The structural
self-check (`test/fitness/fit-40-conformance-corpus-integrity.test.ts`) proves the
declaration is internally consistent and well-formed — it never proves engine behaviour.

## Authoring conventions

- Every `factory.ts` imports the SDK **only** via the public source umbrella
  `../../src/index.ts` (REQ-CFX-01) — no `src/core/**`, `src/transport/**`,
  `src/testing/**`, I/O-capable Node builtins, `fetch`, or `process.env`.
- Factories author **representable ops only**: `modify` (`replaceContent`), `delete`
  (`remove`), `rename`, `move`. A wire `create` appears exactly once in the whole corpus —
  `m2-create-composition`'s deliberate `wire-create-reject-twin` reject probe (REQ-CFX-02),
  marked with a `DO-NOT-COPY` comment (REQ-CFX-03). Do not add a second `create` site.
- Every text file under `conformance/` is UTF-8, LF-only, no BOM, no trailing newline under
  `expected/**`/`schematic/files/**` (`corpus-determinism` REQ-CDT-03..07).
- The engine's manifest/`corpus.json` decoder is **strict** (`DisallowUnknownFields`): any key
  beyond the documented schema — at any level (top-level, `factory`, `lowering`, `cases[]`,
  `outcome`, `transcript`) — is a HARD engine-side failure, never ignored. Never add a field
  the schema does not list; fit-40 checks shape, not unknown keys, so there is no local
  warning. New keys go through `CONFORMANCE-CORPUS-HANDOFF.md` BEFORE a fixture ships them.

## How to add a fixture (mirrors exactly what fit-40 enforces)

1. Create `conformance/<id>/manifest.json` + `factory.ts` (+ optional `seed/`, `expected/`,
   `schematic/{schema.json,files/}`).
2. Negative twins are extra `cases[]` on the SAME fixture (never separate fixtures). A twin
   needing different authoring than the positive case carries its own
   `"factory": { "module": "factory.ts", "export": "<namedExport>" }`, overriding the
   fixture-level default export for THAT case only (ADR-0065 mechanism, engine-accepted).
   Name the export `<behaviour>Probe` and the case `<behaviour>-twin`.
3. `manifest.json#id` MUST equal the directory name; `wireSpecVersion` MUST equal the
   corpus-wide value (currently `1`, pinned to `WIRE_PROTOCOL_VERSION`).
4. Every case needs a full `outcome` object and a full `transcript` object (REQ-CFX-04/13).
5. List `<id>` in `corpus.json#fixtures` **in the same commit** as its full artefact set
   (REQ-CCR-04 commit atomicity) — an id landed ahead of its artefacts is a hard failure.
6. `conformance/collection.json` must exist at the corpus root — it is the shared
   package-anchor marker every fixture's runner invocation resolves against (REQ-CCR-08);
   without it, every fixture fails at exit 1 before its factory runs.
7. Run `bun test test/fitness/fit-40-conformance-corpus-integrity.test.ts` — it must be
   green before the commit lands.

## Expected stderr note

Every fixture run, positive or negative, emits a harmless
`[pbuilder] factory at <dir>: no schema.json found — running WITHOUT schema-derived input
validation` warning to stderr. This corpus's `lowering: schematic` fixtures place their
`schema.json` under `schematic/schema.json`, a different path from the one this check
consults (`<packageDir>/schema.json`) — the warning is expected, not a defect.
