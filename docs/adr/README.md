# Architecture decision records

Each file records one SDK decision: its context, the choice and its consequences. Files keep
the numbers they were accepted with. Domain rules shared across repositories live in
[project-builder-architecture](https://github.com/Project-Builder-Schematics/project-builder-architecture);
these records cover how the SDK implements them.

Numbering notes:

- 0050, 0073, 0074 and 0075 were each given to two decisions. Both files keep their names, so
  cite these by file name, not by number alone.
- 0068 and 0069 were never used.

## Decisions recorded only in change designs

These decisions were written inside a change's design and never got their own file. The links
point at the last commit that held them.

| Change | Decisions |
|--------|-----------|
| react-dialect | [ADR-01 fidelity glue duplicated in the react leaf](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/archive/2026-07-17-react-dialect/design.md#L163), [ADR-02 core-resident name grammars and the `validatedOp` chokepoint](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/archive/2026-07-17-react-dialect/design.md#L179), [ADR-03 `setJsxProp` through the ts-morph structured API](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/archive/2026-07-17-react-dialect/design.md#L202), [ADR-04 exports-guard minimal edit](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/archive/2026-07-17-react-dialect/design.md#L217), [ADR-05 react `addImport` fresh-write](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/archive/2026-07-17-react-dialect/design.md#L222) |
| sdk-plain-error-note | [ADR-01 the scrub lives in `error-text.ts`](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/archive/2026-08-06-sdk-plain-error-note/design.md#L139), [ADR-02 Windows and UNC paths become `<outside-project>`](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/archive/2026-08-06-sdk-plain-error-note/design.md#L171) |
| context-singleton-fix | [ADR-01 unqualified registry key](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/context-singleton-fix/design.md#L123), [ADR-02 `globalThis`/`Symbol.for` registry for the run context](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/context-singleton-fix/design.md#L159) |
| modify-e2e-extensible (planned, not built) | [ADR-01 two-tier golden tree seam](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/modify-e2e-extensible/design.md#L233), [ADR-02 fit-42 as a coverage-completeness check](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/modify-e2e-extensible/design.md#L242), [ADR-03 conformance corpus vs this seam](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/modify-e2e-extensible/design.md#L261), [ADR-04 the seam runs maintainer-authored factories in CI](https://github.com/Project-Builder-Schematics/project-builder-sdk/blob/1a1888f316a3be4664e4c72ab1c0c652cbb141c7/openspec/changes/modify-e2e-extensible/design.md#L270) |
