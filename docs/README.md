# Docs

A reading path through `@pbuilder/sdk`'s author-facing documentation. Start at the
quickstart; the rest is reference, read in whatever order you need it.

1. **[Quickstart](./quickstart.md)** — install, generate types, write and test a typed
   factory. The fastest way to a working example.
2. **[Authoring verbs](./authoring-verbs.md)** — the seven directive-shaped verbs
   (`create`, `modify`, `remove`, `rename`, `move`, `copy`, `copyIn`) and the
   `find().read()` read-trichotomy rule.
3. **[Error contract](./authoring-errors.md)** — what `AuthoringError` looks like, its
   `verb`/`path`/`reason` fields, and how to recover from a rejected run.
4. **[Dry-run](./dry-run.md)** — preview a factory's planned changes with `dryRun()` before
   anything commits.
5. **[Authoring a dialect](./authoring-a-dialect.md)** — structured, AST-aware mutation for
   one file type (e.g. `@pbuilder/sdk/typescript`, `@pbuilder/sdk/react`), for when the verbs
   above aren't enough. This SDK ships that content only once — this index links it rather
   than repeating it.

## Contributor notes

Design records for SDK contributors — not part of the author reading path above.

- **[Engine ↔ SDK wire spec](./engine-sdk-wire-spec.md)** — the NORMATIVE wire text: frame
  grammar, `ready` handshake, reverse-callback method schemas, error shapes, factory-pointer
  grammar, exit-code taxonomy, bridge contract, and the frame-cap constant. Both repos build
  and conformance-test against this document.
- **[Engine ↔ SDK wire design](./engine-sdk-wire-design.md)** — the historical decision
  record: runner contract, the Go↔TS cross-language contracts, and (in its `## Superseded`
  section) the pre-implementation proposal the wire spec above replaced.
