# Runner Integrity Manifest — Engine→SDK Contract

**From**: `project-builder-engine` (2026-07-25). **To**: the SDK.
**Status**: REQUESTED — required before the engine can execute the real runner in production.
**Engine change**: `production-runner-selection` (see "Pending-change ID" below).

## Why this exists

The engine is graduating production to spawn the **real** `pbuilder-runner.js` instead of its embedded
test-double. Before it execs code it does not own, it verifies that code's integrity — the same
discipline it already applies to the Bun binary (digest-pinned) and to its own embedded sidecar
script (content-keyed, re-hashed before every spawn).

The runner cannot reuse either mechanism: it is a **thin, multi-file, import-linked** module, so a
single-file content-key does not cover its imports, and a single bundle hash does not apply to a
non-bundle. The engine therefore verifies a **manifest** of the runner's static import closure.

**This document asks the SDK to generate and publish that manifest.** Nobody else can: the SDK is
the only party that knows its own closure.

---

## What the engine verified (so you can check our work)

Against the pinned submodule at `6e4aab7`:

| Property | Finding |
|---|---|
| Build is `tsc`, not a bundler | `dist/` is 1:1 file-per-source, static relative ESM specifiers preserved. No code-splitting, no chunk graph. (`build:codegen` bundles only `pbuilder-codegen.js`, which is **not** in the runner closure.) |
| Closure size | **exactly 23 `.js` files** — transitive walk from `dist/bin/pbuilder-runner.js` over `import`/`export … from` + side-effect imports: `bin/`×1, `transport/`×9, `core/`×7, `core/schema/`×6 |
| Third-party specifiers in closure | **zero**. Only 6 node builtins (`node:async_hooks, node:console, node:fs, node:module, node:path, node:url`). `ts-morph` and `react` are NOT in the runner closure — they are reachable only through the factory the runner dynamically imports. |
| Dynamic `import()` in closure | **exactly one** — `transport/runner.js` importing the author's factory. That is the intended user-code boundary. |
| Resolution escape hatches | none. `single-instance-probe.js` uses `createRequire(anchor).resolve()` — resolution only, never `import()`. No `package.json#imports` map, no subpath-import specifiers. |
| Env vars read by the closure | **zero** (`process.env` absent across all 23 files). |

If any of these has changed on your side, tell us — several of them are load-bearing (see
"Constraints", below).

---

## Deliverable — `dist/runner-manifest.json`

Generate it as a build step, ship it inside the published package.

### Contents — 24 entries

```jsonc
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "entry": "dist/bin/pbuilder-runner.js",
  "files": [
    { "path": "dist/bin/pbuilder-runner.js",   "sha256": "<hex>" },
    { "path": "dist/transport/runner.js",      "sha256": "<hex>" },
    // … all 23 closure .js files …
    { "path": "package.json",                  "sha256": "<hex>" }
  ]
}
```

- **The 23 closure `.js` files** — each with its path relative to the **package root** and the
  lowercase-hex SHA-256 of its exact on-disk bytes.
- **The SDK-root `package.json`** — entry #24. Non-obvious but required: `packageRootFor()` in
  `single-instance-probe.js` walks up from the runner's own path looking for `package.json` to
  establish `runnerRoot`. It is **resolution-controlling data read at runtime**, so it is part of the
  trusted surface.

**Explicitly NOT in the manifest** (please do not "helpfully" add them — the engine treats extra
entries as a manifest/closure mismatch): `*.d.ts` (never executed), `dist/dialects/**`,
`dist/commons/**`, `dist/conformance/**`, `node_modules/**`. All of those are reached only through
the factory's dynamic import and are already inside the accepted user-code threat model.

### How to compute the closure

Do not hand-maintain the list. Derive it mechanically at build time:

1. Start at `dist/bin/pbuilder-runner.js`.
2. Parse its static `import` / `export … from` specifiers **and** side-effect imports.
3. Follow every **relative** specifier; ignore `node:*` builtins.
4. Recurse until closed.
5. Append `package.json`.
6. Hash each file's bytes; emit sorted by path (see determinism).

If step 3 ever encounters a **bare** specifier, the build must **fail loudly** rather than emit a
manifest — that is the tripwire described under Constraints.

### Determinism

The same source tree must produce a byte-identical manifest on any machine:

- Sort `files` by `path`, byte-wise ascending.
- POSIX separators (`/`) in every `path`, on every OS.
- Paths relative to the package root, no leading `./`, no absolute paths.
- Lowercase hex digests.
- Stable JSON key order + a trailing newline; no timestamps, no build IDs, no machine paths.

The engine will compare digests exactly. Any nondeterminism becomes a false tamper alarm on a user's
machine.

### Publishing

- Add `dist/runner-manifest.json` to the package's published `files` (it must survive `npm pack`).
- Regenerate it on **every** build — a stale manifest is indistinguishable from tampering and will
  fail closed on the user's machine.
- Wire it into the same `bun run build` that produces `dist/`, so it can never drift from the bytes
  it describes. A manifest generated by a separate, forgettable command will eventually be forgotten.

---

## Constraints — this is the part that matters most

The engine verifies **24 hashes** rather than walking the whole tree. That is sound because of one
property, which we are calling the **closure-sealing lemma**:

> Every import edge in the runner's closure lives *inside* a hashed file. An attacker cannot add a
> file to the closure, or redirect an existing edge, without editing a file whose digest is in the
> manifest — which breaks that digest.

**The lemma is what makes 24 hashes equivalent to hashing the whole tree.** It has three
preconditions, and all three are properties of *your* build:

1. **No bundler with code-splitting.** The `tsc`-not-esbuild/bun-build choice is currently
   **load-bearing security infrastructure**. If the SDK build is ever "optimised" to a bundler that
   emits chunks or rewrites the module graph, this trust model breaks — silently, because everything
   still runs.
2. **No dynamic `import()` on an infrastructure path.** The one existing dynamic import (the
   author's factory) is the intended boundary. A second one — a lazily-loaded transport, a plugin
   hook — would admit unhashed code into the executed surface.
3. **No bare third-party specifier inside the closure.** A dependency imported by the runner
   infrastructure lands in `node_modules`, outside the manifest, and executes unverified.

**Ask**: please treat these as an explicit invariant of the SDK build — ideally enforced by the build
step itself (fail the build if the computed closure contains a dynamic import outside the factory
site, or any bare specifier beyond `node:*`). The engine will enforce its own mirror of this check
against the pinned submodule, but that only catches it at *our* integration point, after the fact.
Nobody has written this down until now, which is exactly why we are writing it down.

---

## Manifest identity — a coordination note, not an SDK task

A manifest that ships inside the tree it describes cannot, on its own, prove anything: an attacker
who can edit 23 files can also edit the manifest. The engine's requirement is therefore that the
manifest's identity be **bound externally**, not self-asserted.

Under the locked threat model — malicious *schematic author*, single-tenant local, no write access
to the installed SDK tree — the proportionate binding is the **package manager's existing lockfile
integrity** (the `integrity` digest recorded for the published tarball), validated by the CLI at
resolve time. That covers the whole tree, manifest included, with infrastructure that already exists.

**Nothing is required from the SDK for this** beyond publishing normally. It is recorded here so
that all three repos share one story rather than three. One optional nicety: if the build prints the
manifest's own SHA-256 and the release notes carry it, out-of-band verification becomes possible for
anyone who wants it.

---

## Acceptance

- [ ] `bun run build` emits `dist/runner-manifest.json` with exactly the 23 closure files +
      `package.json`, deterministically, sorted, POSIX paths, lowercase digests.
- [ ] The manifest ships in the published package (`npm pack` contains it).
- [ ] Rebuilding an unchanged tree produces a byte-identical manifest.
- [ ] Mutating any closure file changes exactly that file's digest.
- [ ] The build **fails** if the computed closure contains a bare specifier beyond `node:*`, or a
      dynamic `import()` anywhere other than the factory-import site.
- [ ] The three Constraints are documented in the SDK repo as build invariants, not folklore.

## Relationship to the earlier SDK brief

This is **additive** to the runner work already requested (real runner honoring `--factory`, demo
schematic as a conformance fixture, resolvable package, and the #153 fixture drift). It was not in
that brief because the engine's integrity design did not exist yet. Treat it as **Deliverable 4**.

## Pending-change ID

Engine-side work is tracked as **`PC-RUN-01`** (`production-runner-selection`), org project #2. Cite
it as the build gate for anything on your side that depends on the engine consuming this manifest.

## Release target — decided 2026-07-25

The first published release is **`@pbuilder/sdk@0.1.0`**, owned by Daniel. Two consequences for this
contract:

- **The manifest must ship in `0.1.0`.** The CLI has made a registry-installed `@pbuilder/sdk` a
  requirement of the end-to-end demo (not a linked or tarball install), so `0.1.0` is the first
  version the engine will verify in a real run. A `0.1.0` without `dist/runner-manifest.json` cannot
  be executed by a production engine — it fails closed, by design.
- **`files: ["dist"]` already covers it**, since the manifest lives at `dist/runner-manifest.json`.
  No packaging change is needed — only that the build actually emits it before `prepublishOnly` runs.

Local `bun link` development is explicitly NOT collateral damage here: the engine gates on the
manifest, not on any registry or lockfile artefact, and a local `bun run build` regenerates a valid
manifest. Linked development keeps working as long as the build emits the manifest — which is the
same reason it must be wired into `bun run build` rather than a separate command.

## Open question back to you

**Does the runner's closure differ across published platforms or build modes?** The engine assumes
one manifest per published package. If a platform-specific build could produce a different closure,
say so now — it changes the manifest's shape from one list to a per-platform map.
