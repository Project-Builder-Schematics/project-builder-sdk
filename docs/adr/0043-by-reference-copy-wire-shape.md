# ADR-0043: By-reference copy wire shape — a new `copyIn` op (not a `copy` discriminator)

- Status: Accepted (2026-07-13, promoted at schematic-local-files archive)
- Date: 2026-07-12
- Deciders: Daniel (Hyperxq)
- Origin: change `schematic-local-files` (design rev 1). Closes obs #915 ruling 19 (wire
  shape left open through propose).
- Builds on: ADR-0013 (six frozen wire ops), ADR-0019 (text-only wire; additive widening
  anticipated), ADR-0024/0025 (frozen 1-op↔1-author-verb `DryRunVerb` map).

## Context

`scaffold`/`copyIn` must emit a directive that references a package-local source by PATH
(the engine reads and copies it, verbatim, at apply time — the by-reference half). Two
encodings were live (obs #915: an earlier architect+security lean for the discriminator;
explore + fresh architect evidence lean new op):

1. **New op** `{ op: "copyIn"; copyIn: { from; to; force? } }`.
2. **Extend `copy`** with `source: { kind: "package" | "tree", path }`.

## Decision

Add a **new wire op `copyIn`**:

```ts
| { op: "copyIn"; copyIn: { from: string; to: string; force?: boolean } }
```

- `from` — source path relative to the RESOLUTION anchor (`packageDir`), never absolute
  (REQ-BRC-07). [SEAM] The engine MUST resolve `from` against its own re-derived
  `packageDir`, NOT against its containment ceiling — the two anchors stay distinct on
  the engine side exactly as on the SDK side (REQ-PRC-01).
- `to` — destination path/`pathTemplate`; MAY carry `{= =}` tokens (REQ-FSC-05); the
  engine renders it single-pass (REQ-BRC-08).
- `force?` — overwrite-on-collision, same key-omission semantics as every other op.

## Consequences

- (+) `copy`'s tree→tree shape is **byte-identical** pre/post (REQ-BRC-03 "any other
  existing wire op MUST NOT be altered" — which the discriminator would violate).
- (+) `WIRE_TO_AUTHOR_VERB` stays a total `Record<Directive["op"], DryRunVerb>` with a
  clean 7th 1:1 row (`copyIn → copyIn`); the discriminator maps ONE op to TWO author
  verbs, breaking that compile-enforced totality (ADR-0024/0025).
- (+) Trust domain is explicit on the wire — the op NAME says "package read"; combined
  with the package-relative `from` and the engine's own ceiling re-derivation (REQ-BRC-02),
  it delivers the discriminator's security intent without a discriminator.
- (−) A MAJOR growth event across THREE frozen public vocabularies at once (rev 2, A1):
  +1 wire op (`Directive`), +1 dry-run verb (`DryRunVerb`), AND +1 authoring verb
  (`AuthoringVerb` — forced: `verbFor`/`primaryPath` in `authoring-error.ts` are
  exhaustive over `Directive["op"]` and will not compile without the `copyIn` arm; a
  `copyIn` collision attributes `verb: "copyIn"`, `primaryPath = copyIn.from`); +1 branch
  in five consuming surfaces (factory, fake, vehicle, dry-run map, engine apply).
  Accepted — ADR-0025's own language anticipates exactly this growth path.
- (−) Engine gains a distinct apply branch rather than a unified copy pass (the
  discriminator's only real saving) — a cross-repo, out-of-scope, marginal cost.

## Alternatives Considered

- **Extend `copy` with a `source: {kind}` discriminator** — REJECTED: alters an existing
  wire op (violates REQ-BRC-03), collapses the frozen 1-op↔1-verb map, and the per-entry
  by-value/by-reference `dryRun()` tag (ruling 14) appears REGARDLESS of shape — so its
  "no new dry-run verb" saving is illusory. Registered as reconsideration debt
  (`openspec/pending-changes.md`): revisit only if the engine team requires a unified copy
  apply pass AND the SDK relaxes its frozen verb-map totality.
