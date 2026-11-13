# ADR-0031: Factory package-shape discovery — `packageDir`, fixed adjacent output, opt-out tiers

- Status: Accepted (2026-07-11, promoted at stage-4-typed-options archive)
- Date: 2026-07-06
- Change: `stage-4-typed-options`
- Builds on: ADR-0027 (bin), ADR-0028 (reserved-name scan), ADR-0029 (run-boundary validation)

## Context

The bin and the runner must both locate a factory's `schema.json` without configuration (REQ-FPS-01), and
the runner must know the factory's own directory at run time to discover the schema and scan for reserved
sibling files. `defineFactory` has no intrinsic knowledge of where its module lives on disk.

## Decision

**Canonical shape**: `schema.json` sits adjacent to `factory.ts` in the same directory; that same
directory is the bin's fixed, non-configurable output location for `schema.generated.ts` (REQ-TFO-05,
write-containment mechanics in ADR-0027). The bin discovers `schema.json` from the `<package-dir>`
argument; the runner discovers it from an optional `options.packageDir` the author supplies as
`import.meta.dir` — the only portable way a module learns its own directory. `packageDir` threads BOTH
schema discovery (ADR-0029) and the reserved-name scan (ADR-0028).

**Trust model (SEC-6).** `packageDir` is trusted as **author-authority dev-time input** (the author
names their own module's directory); it is not attacker-controlled. The runtime read path reads only
`schema.json` and directory entry NAMES, never emits their VALUES onto any error surface (RBV-02/04),
and fails closed on any non-`ENOENT` read error (ADR-0029, SEC-3).

**Two opt-out tiers** (reconciling REQ-TFO-02 with REQ-RBV-03):
- Bare `defineFactory(fn)` (no `options`) — the pure untyped opt-out: runs silently exactly as before this
  change, no validation, no warning.
- `defineFactory(fn, { packageDir })` with no `schema.json` found — opts into the flow but is schemaless:
  emits the loud, stateless, per-run STDERR warning (RBV-03); an empty (zero-property) `schema.json` emits
  a distinct "declares zero properties" warning (RBV-05.2). Warning literals (design-pinned) — `<dir>` is
  the factory directory RELATIVE to the project root (TW-m9: no absolute-path filesystem leak,
  deterministic across machines/tests; naming-by-location is the intended factory identity):
  `"[pbuilder] factory at <dir>: no schema.json found — running WITHOUT schema-derived input validation"`
  and `"[pbuilder] factory at <dir>: schema.json declares zero properties — no input validation performed"`.

The generated `schema.generated.ts` is TYPE-ONLY (`export type Input` + an embedded
`// @schema-digest sha256:<...>` line for FIT-12); the runtime never imports it (it re-reads `schema.json`
from disk), keeping the compile-time and run-time planes independent.

## Consequences

- One convention drives bin, runner, reserved-name scan, and the parity gate — no config surface.
- The two-tier opt-out keeps the bare factory byte-for-byte backward-compatible while making the
  opted-in-but-schemaless case observable.
- **Known limitations (noted, not closed)**: (1) a `schema.json` outside the canonical adjacent location
  is invisible to discovery — the opt-out warning is the author's signal (REQ-RBV-05 orphan-schema note);
  (2) a **bundled/transpiled** factory (where the module has been rolled into a single artifact) breaks
  BOTH adjacency (no sibling `schema.json` on disk) and `import.meta.dir` (points at the bundle, not the
  source package) — the RBV-03 no-schema warning fires loudly and is the author's signal that validation
  did not run in that build (ARCH-m5).

## Alternatives Considered

- **Configurable output path / schema path flags**: rejected — REQ-TFO-05 forbids a configurable
  destination (write-containment attack surface); fixed adjacency is the containment mechanism.
- **Infer the caller's directory from the stack**: fragile across bundling/transpilation; `import.meta.dir`
  passed explicitly is deterministic.
- **Single opt-out tier (always warn when schemaless)**: breaks REQ-TFO-02's "runs exactly as before" for
  the bare untyped factory.
