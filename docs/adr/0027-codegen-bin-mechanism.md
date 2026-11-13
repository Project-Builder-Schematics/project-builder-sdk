# ADR-0027: Codegen bin — hand-rolled zero-dep subset parser + CLI contract

- Status: Accepted (2026-07-11, promoted at stage-4-typed-options archive)
- Date: 2026-07-06
- Change: `stage-4-typed-options` (D4)
- Builds on: ADR-0009 (near-zero runtime deps, supply-chain blast radius); ADR-0014 (subpath shape)

## Context

`schema.json` must derive `defineFactory<O>`'s input type (D4, owner-ratified: codegen bin;
`schema.json` stays hand-authored, parsed as data, no postinstall, project-scoped writes, explicit
invocation). Two mechanisms were open: a JSON-Schema→TS generator as a `devDependency`, or a
hand-rolled parser+emitter for the SDK's own bespoke schema format. That format is NOT standard JSON
Schema — it uses `type`/`label`/`choices`, a flat property map, primitives + enum. That bespoke
format is a **cross-repo wire contract** (ARCH-3): the Go CLI consumes the same `schema.json` to
derive its interactive prompts, and `REQ-SCP-02` sufficiency is only the SDK's half of it — its
fields evolve as a two-party change (SDK + engine), never a private SDK detail.

## Decision

**`schema.json` wire shape (SDK↔Go-CLI cross-repo contract — OWNER-RATIFIED 2026-07-07).** The on-disk
`schema.json` is the **WRAPPED** form: a top-level object with a `"properties"` map, keyed by property
name, each value an object carrying `type`/`label`/`choices`/`required`/`default`/`description`:

```json
{
  "properties": {
    "port": { "type": "number", "label": "Server port", "required": true, "default": 8080 },
    "mode": { "type": "enum", "label": "Mode", "choices": ["dev", "prod"] }
  }
}
```

The property KEY is the map key under `"properties"`; the per-property facets live INSIDE each value
object (never as sibling top-level keys). Rules pinned as the cross-repo wire contract (both SDK and the
Go CLI parse the same bytes):

- **Unknown TOP-LEVEL keys are IGNORED** — reserved for future metadata (`name`/`version`/`description`
  at the document root); the SDK reads ONLY `"properties"` today, so an unknown top-level key is silently
  tolerated (forward-compatible).
- **Unknown PROPERTY-level keys are an FIT-13 advisory** (sufficiency notices them, never hard-fails).
- **A missing or non-object `"properties"` key = INVALID shape** → fail-closed on the SAME path as
  malformed JSON (parse rejects; the runtime emits the RBV-05.1 literal below with
  `<problem>` = `missing "properties" object`).

This is the WIRE contract; the SDK's IN-MEMORY `Schema` model is a DISTINCT representation — an ARRAY of
`SchemaProperty` (each with an explicit `key`), kept an array (NOT a `Record`) so FIT-07's no-tree guard
stays clean (design §4.3). Parsing lifts the wrapped map into that array (`key` = the map key); the two
shapes never conflate.

Hand-roll a **zero-dependency** parser + type emitter (no generator dep, not even dev). Parsing is
`JSON.parse` (built-in, "parse as data", no `eval`/`new Function`/non-literal dynamic import — REQ-TFO-03.3).

**Parse-error locator (Gap 8) — SUPERSEDED by ADR-0032 (2026-07-10).** The `at position N`
engine-message extraction below is DEAD under Bun/JavaScriptCore (`JSON.parse` emits no byte offset —
`verify-in-loop-2`); the locator is now a hand-rolled JSON syntax scanner (`src/core/schema/schema-locate.ts`,
ADR-0032). The `(line L, column C)` message slot and `(position unknown)` fallback token are UNCHANGED — only
the offset SOURCE changed. Original (superseded) text: On a `JSON.parse`
`SyntaxError`, the locator is derived as follows: (1) attempt to extract an `at position N` byte offset
from the engine's `SyntaxError.message` (present on Bun/V8 for most malformed inputs); (2) when present,
convert `N` to `(line L, column C)` via a byte-offset walk of the RAW file text (count newlines up to `N`,
column = offset since the last newline, both 1-based) — this makes the locator ENGINE-INDEPENDENT once the
offset is known; (3) when NO position is present in the message, emit the pinned fallback token
`(position unknown)` in the locator slot. The parser NEVER echoes the engine's raw `SyntaxError.message`
text (author-vocabulary discipline, REQ-TFO-04.6). REQ-TFO-04.4 asserts BOTH branches: one fixture whose
Bun `SyntaxError` carries a position (asserts a concrete `(line L, column C)`), and a second fixture that
pins the `(position unknown)` fallback.

**Escaping emitter (SEC-1).** Every schema-derived string that reaches the generated `.ts` is
emitted ONLY through `JSON.stringify` — never string-concatenated raw — for both string-literal
and property-key positions. A property key is emitted bare only if it matches the identifier
allow-list `/^[A-Za-z_$][\w$]*$/`; otherwise it falls back to a `JSON.stringify`'d quoted-property
key. Labels destined for a doc comment are escaped (or dropped) with the comment-breakout sequence
`*/` explicitly guarded, so a hostile `label`/field/enum choice carrying `"; import("evil")//`,
backticks, `${…}`, `*/`, or newlines cannot produce an executable statement or import in the output
— the generated file stays inert data. A hostile-schema fixture red-proofs this (the emitted `.ts`
compiles, runs no statement, executes no import). The generated file opens with the fixed header
`// AUTO-GENERATED by pbuilder-codegen — do not edit. Regenerate: pbuilder-codegen <package-dir>`.

The bin lives at
`bin/pbuilder-codegen.ts` (OUTSIDE `src/`), imports `src/core/schema/*`, and is packaged by
`bun build bin/pbuilder-codegen.ts --outfile dist/bin/pbuilder-codegen.js --target node
--banner "#!/usr/bin/env node"` (a second `build` step after `tsc`), keeping the exports map and
`tsc` rootDir untouched. `package.json#bin`: `{ "pbuilder-codegen": "dist/bin/pbuilder-codegen.js" }`.

**Bin executability + spawn discipline (Gap 7; runtime corrected in Gap 9).** The shipped artifact
carries an explicit `#!/usr/bin/env node` shebang, injected via `bun build --banner "#!/usr/bin/env node"`
(the single chosen mechanism — NOT a post-build prepend). The shebang is the END-USER-INSTALL contract
(`node` is the runtime a published `bin` targets on a consumer's machine). For the SDK's OWN CI e2e tests,
however, **Bun is the guaranteed runtime and `node` is NOT** — so CLI end-to-end tests spawn the bin
through an EXPLICIT `bun dist/bin/pbuilder-codegen.js <args>` (Gap 9: Bun executes the node-target bundle
directly), NEVER relying on the executable bit surviving pack/unpack nor on a host `node` being present —
keeping exit-code and STDOUT/STDERR stream assertions deterministic regardless of mode bits or `PATH`.
FPS-02's tarball check (REQ-FPS-02.2) still asserts the FIRST line of the shipped
`dist/bin/pbuilder-codegen.js` in the packed tarball is exactly `#!/usr/bin/env node` — the shebang is a
shipped-artifact contract for end-user installs, independent of how the SDK's own tests spawn it.

**SchemaKind → TypeScript emit mapping (Gap 4, exact — no prose hedging).** `bin/emit-type.ts` maps each
`SchemaProperty` to one `export type Input` member by this table:

| Schema construct | Emitted TypeScript | Notes |
|---|---|---|
| `type: "string"` | `string` | — |
| `type: "number"` | `number` | — |
| `type: "boolean"` | `boolean` | — |
| `type: "enum"` (with `choices: string[]`) | union of its `choices` string literals, e.g. `"a" \| "b"` | each choice emitted via `JSON.stringify` (escaping emitter, SEC-1); order follows `choices` |
| `required: false` | optional member marker `key?: T` | ALL other members are required (`key: T`) — absence of `required` means required |
| `label` present | a leading JSDoc doc-comment on that member (`/** <label> */`), with the `*/`-breakout sequence escaped or the label dropped | label is documentation only; never affects the member type |

Property KEYS follow the identifier rule above (bare if `/^[A-Za-z_$][\w$]*$/`, else `JSON.stringify`'d
quoted-property key). `default`/`description` are advisory and do NOT appear in the emitted type. This
table pins the exact compile behaviour TFO-01.1/.2 and FPS-04 assert.

**CLI semver contract** (REQ-TFO-04/05, FPS-01/05): `pbuilder-codegen <package-dir>`; discovers the
adjacent `schema.json` (REQ-FPS-01); writes `schema.generated.ts` to that same fixed, non-configurable
directory. **Write containment (SEC-4, REQ-TFO-05) — anchor pinned to the INVOKING PROCESS (Gap 3, reading (b)):**
the containment anchor is the invoking process's project root — the nearest ancestor directory of
`process.cwd()` that contains a `package.json` (NOT an ancestor of the `<package-dir>` argument; deriving
the anchor from `<package-dir>` is circular — under that reading `pbuilder-codegen ../../etc` could never
be refused and TFO-05.2 would be unfalsifiable). The check acts on paths canonicalized via `fs.realpathSync`
(a string-level `../` check is symlink-bypassable; for a not-yet-existing file, canonicalize its nearest
existing parent). BOTH the resolved `<package-dir>` AND the resolved output path (`<package-dir>/schema.generated.ts`)
MUST lie within that anchor. If either falls outside — absolute, `../`-escaping, symlinked-out, or derived
from schema content — the bin REFUSES: it exits non-zero, writes NOTHING, and leaves any prior output
untouched. A symlink-escape fixture red-proofs post-realpath containment (`pbuilder-codegen ../../etc`
refused; a symlink whose real target escapes the anchor refused). `--help`/`-h` → usage on STDOUT, exit 0; usage text names the
purpose and the literal `pbuilder-codegen <package-dir>` (TW-m5). No args / unrecognized flag → usage
on STDERR, exit non-zero. Success → exit 0 + fixed line `pbuilder-codegen: wrote schema.generated.ts`
on STDOUT. Malformed schema → STDERR (never STDOUT), exit non-zero, non-destructive (prior valid
output untouched), author-vocabulary message following the pinned template
`pbuilder-codegen: <file>: <problem> (line L, column C)` (TW-m6) — where the `(line L, column C)` slot is
the deterministic locator above, or the pinned `(position unknown)` fallback when the engine message
carries no offset (Gap 8) — never echoing raw content nor the underlying parser's text.

## Consequences

- Zero third-party code in the shipped bin — no supply-chain surface, full control over error language.
- Cost: the SDK maintains its own (small) parser/emitter and locator logic instead of reusing a library.
- `bun build` bundles the shared `core/schema` logic into the bin artifact (a copy) — acceptable; it is
  our own code and keeps the bin self-contained (no fragile `dist/` relative imports).
- Enables the parity gate (FIT-12) via an embedded digest and the typed differentiator.

## Alternatives Considered

- **json-schema-to-typescript / quicktype as devDependency**: doesn't fit the bespoke `label`/`choices`
  format; drags a transitive dev tree (supply-chain surface); its raw errors fight REQ-TFO-04.6.
- **Zod-as-source (D4 c)**: rejected at explore — first runtime dep, README mental-model inversion.
- **Runtime JSON-Schema validator (Ajv)**: a runtime dependency; violates ADR-0009 zero-dep stance.
- **Build bin via `tsc` under `src/`**: violates FIT-15 (bin must live outside the runtime path).
