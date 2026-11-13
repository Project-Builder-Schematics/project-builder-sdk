// fit-49's exceptions: legacy edges that break a rule today, each removed by a named slice of
// odd/tasks/hexagonal-layout-proposal.md. A row whose edge no longer exists, or no longer
// breaks its rule, fails fit-49 and must be deleted, so the table only shrinks; CEILING caps
// its length and only goes down.

import type { Rule } from "./rules.ts";

export type Exception = { from: string; to: string; rule: Rule; reason: string; removedBy: `S${number}${string}` };

const KIT_AHEAD_OF_CLOSURE = "the kit moved ahead of the runner closure (S1b); the type it imports moves into authoring/domain with the runner closure";
const SCAFFOLD_FS = "scaffold use case reads the source folder directly (V3); it goes through the package-files port";

export const EXCEPTIONS: readonly Exception[] = [
  { from: "src/bounded-contexts/authoring/domain/entities/dialect-handle.ts", to: "src/core/directive-factory.ts", rule: "targetNeverImportsLegacy", reason: KIT_AHEAD_OF_CLOSURE, removedBy: "S4" },
  { from: "src/bounded-contexts/authoring/domain/entities/dialect-handle.ts", to: "src/core/session.ts", rule: "targetNeverImportsLegacy", reason: KIT_AHEAD_OF_CLOSURE, removedBy: "S4" },
  { from: "src/bounded-contexts/authoring/domain/entities/dialect-handle.ts", to: "src/core/wire.ts", rule: "targetNeverImportsLegacy", reason: KIT_AHEAD_OF_CLOSURE, removedBy: "S4" },
  { from: "src/core/authoring-error.ts", to: "src/core/emit-rejection.ts", rule: "domainImports", reason: "the domain error model decodes engine rejections; acl/irwire takes the decoding and maps it onto AuthoringError (Q7)", removedBy: "S5" },
  { from: "src/core/context.ts", to: "node:fs", rule: "noRuntimeIo", reason: "run boundary reads the package directory (V1); moves behind the package-files port", removedBy: "S9" },
  { from: "src/core/context.ts", to: "process.cwd", rule: "noRuntimeIo", reason: "run boundary resolves the package directory from the working directory (V1); moves into the package-files adapter", removedBy: "S9" },
  { from: "src/core/context.ts", to: "src/core/schema/schema-discovery.ts", rule: "applicationImports", reason: "run use case calls the schema.json finder directly (V2); goes through the package-files port", removedBy: "S9" },
  { from: "src/core/context.ts", to: "src/core/fs-errors.ts", rule: "platformImporters", reason: "run use case maps filesystem error codes itself (V1); the package-files adapter owns them", removedBy: "S9" },
  { from: "src/bounded-contexts/authoring/domain/entities/dialect-handle.ts", to: "src/core/context.ts", rule: "domainImports", reason: "the Dialect handle entity reads the run context (currentContext) itself; a domain port takes over the lookup", removedBy: "S1b" },
  { from: "src/core/index.ts", to: "src/core/context.ts", rule: "domainImports", reason: "the internal kit barrel (ADR-0009) re-exports defineFactory and currentContext from the run boundary; it goes when the legacy tree is empty", removedBy: "S14" },
  { from: "src/scaffold/expander.ts", to: "src/scaffold/walk.ts", rule: "applicationImports", reason: SCAFFOLD_FS, removedBy: "S10" },
  { from: "src/scaffold/expander.ts", to: "src/scaffold/classify-transport.ts", rule: "applicationImports", reason: SCAFFOLD_FS, removedBy: "S10" },
  { from: "src/scaffold/expander.ts", to: "src/scaffold/path-guards.ts", rule: "applicationImports", reason: SCAFFOLD_FS, removedBy: "S10" },
  { from: "src/scaffold/index.ts", to: "src/scaffold/path-guards.ts", rule: "applicationImports", reason: SCAFFOLD_FS, removedBy: "S10" },
  { from: "src/scaffold/index.ts", to: "src/scaffold/classify-transport.ts", rule: "applicationImports", reason: SCAFFOLD_FS, removedBy: "S10" },
  { from: "src/testing/contract-fake.ts", to: "src/platform/deep-equal.ts", rule: "platformImporters", reason: "CODE-LAYOUT:127 does not list testing/ among platform/ importers; S7 settles it (architecture clarification or a local helper)", removedBy: "S7" },
  { from: "src/transport/exit-codes.ts", to: "src/core/authoring-error.ts", rule: "crossContext", reason: "runner maps Authoring's error type to exit codes; it reaches the type through Authoring's run-factory use case", removedBy: "S11" },
  { from: "src/transport/runner.ts", to: "src/core/authoring-error.ts", rule: "crossContext", reason: "runner reaches Authoring's error type directly; it goes through the run-factory use case and the types it exposes", removedBy: "S11" },
  { from: "src/transport/runner.ts", to: "src/core/schema/schema-locate.ts", rule: "crossContext", reason: "runner calls Authoring's schema services directly; it goes through the run-factory use case", removedBy: "S11" },
  { from: "src/transport/runner.ts", to: "src/core/schema/schema-parse.ts", rule: "crossContext", reason: "runner calls Authoring's schema services directly; it goes through the run-factory use case", removedBy: "S11" },
  { from: "src/transport/framing.ts", to: "src/core/wire.ts", rule: "sharedKernelImports", reason: "the frame codec takes exceedsBatchCap from the domain wire module; the byte-count cap moves to shared-kernel/batch-cap.ts", removedBy: "S5" },
];

// 18 at S0a; +3 in S1b for the interim rows that S4 removes, the only time CEILING went up.
export const CEILING = 21;
