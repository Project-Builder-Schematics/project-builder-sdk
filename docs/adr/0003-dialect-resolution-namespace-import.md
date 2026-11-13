# ADR-0003: Dialect resolution by namespace import

- Status: Accepted
- Date: 2026-06-21
- Deciders: Daniel (Hyperxq)
- Builds on: engine design.md §2.1 (dialect resolution at authoring time by import); ADR-0002 (this
  repo).

> **Amended by ADR-0010 (this repo)** — a dialect's `find` returns an open `Handle<State, Ast, Ops>`
> composed from op-packs, not a sealed subclass return type.

## Context

A single `find` exported per dialect collides when one factory needs more than one dialect (e.g. an
Angular `.ts` and a plain `.css`), and aliasing every import is clumsy. The import must still *be*
the dialect selection (engine design.md §2.1).

## Decision

Dialects are consumed as **namespaces**, and each dialect package offers **both** a default export
(the whole dialect) and named exports (à la carte):

```ts
import * as ng  from "@pbuilder/sdk/angular";
import * as css from "@pbuilder/sdk/css";

ng.find("app.component.ts").addImport("CommonModule");
css.find("styles.css").addRule(".btn", { color: "red" });
```

- The import is the dialect selection; the file extension dispatches to the specialized factory
  within (factory-of-factories).
- The mutations available on a handle are guaranteed by the **return type** of that dialect's `find`,
  and the input is constrained by template-literal path types (`css.find` accepts only
  `` `${string}.css` | `${string}.scss` ``) — a wrong-dialect call is a compile error.
- A handle's mutation surface stacks: **commons (always) + dialect L1 (named, library-agnostic) +
  dialect L2 (`.raw`, library-coupled).**

## Consequences

- No name collision; dialects mix freely in one factory.
- The default export does not tree-shake within a dialect (you take the whole dialect) — acceptable,
  since importing it is already paying for it, and named exports remain for fine-grained imports. The
  cross-dialect "pay only for the dialects you import" boundary holds (roadmap fitness #3).
