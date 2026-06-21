# ADR-0005: `scaffold` — folder-create as SDK sugar over N `create` directives

- Status: Draft (Model A leaning; A-vs-B open)
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: engine ADR-0028 (`create` directive, text-only invariant, `copy` for binaries).

## Context

The common `create` case is "create this folder of files" — some templated, some static — not a
single file (see `crud-graphql-mongo`). Angular forces a heavy pipeline (`apply` / `url` /
`applyTemplates` / `renameTemplateFiles` / `move` / `mergeWith` / `chain` / `branchAndMerge` /
`MergeStrategy`). We want one primitive, as simple as possible, equally powerful.

## Decision

Expose `scaffold(dir, options)` that creates every file in a schematic folder:

```ts
scaffold('./files', { name, imports });
for (const r of resources) scaffold('./files/entity', r);  // the author owns the logic / loops
```

- **No `.template` suffix, no `renameTemplateFiles`**: per engine ADR-0028, `create` always renders
  and templates apply only to text — so every text file renders (a no-op when it has no `{= =}`),
  and binaries go via `copy`. Nothing to mark.
- **No `MergeStrategy` / `branchAndMerge`**: collisions are fail-closed + `force` (engine ADR-0028);
  ordering/visibility is the flush/coalescing model (engine design.md §4).
- The on-disk path-token convention (Angular's `__name@dasherize__`) maps to the wire `pathTemplate`
  (`{= name | dasherize =}`).

**Model A (leaning):** `scaffold` is **pure SDK sugar** — the SDK reads its own `files/` (its
package, not the workspace → no containment violation) and emits N `create` directives. No engine
change.

**Open — A vs B:** Model B would add a new engine wire op `scaffold{ fromDir, options }` (engine
reads + renders, like `copy` via `SourceFS`), more efficient (templates never cross the wire) but a
contract amendment. **Deferred** to a follow-up once the wire weight of templates is measured.

## Consequences (Model A)

- No engine contract change; ships on the existing `create` directive.
- Template bytes cross the wire (text, small; the 4 MiB frame cap + streaming already handle volume).
- The author keeps the logic (which resources, which data); `scaffold` removes the plumbing.
