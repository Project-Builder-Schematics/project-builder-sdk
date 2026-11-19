// fit-49's exceptions: legacy edges that break a rule today, each removed by a named slice of
// odd/tasks/hexagonal-layout-proposal.md. A row whose edge no longer exists, or no longer
// breaks its rule, fails fit-49 and must be deleted, so the table only shrinks; CEILING caps
// its length and only goes down.

import type { Rule } from "./rules.ts";

export type Exception = { from: string; to: string; rule: Rule; reason: string; removedBy: `S${number}${string}` };

const TESTING_PLATFORM = "CODE-LAYOUT:127 does not list testing/ among platform/ importers; project-builder-architecture#75 proposes it, and the row goes in the slice after it lands";

export const EXCEPTIONS: readonly Exception[] = [
  { from: "src/core/index.ts", to: "src/bounded-contexts/authoring/application/usecases/run-factory/context.ts", rule: "domainImports", reason: "the internal kit barrel (ADR-0009) re-exports defineFactory and currentContext from the run boundary; it goes when the legacy tree is empty", removedBy: "S14" },
  { from: "src/bounded-contexts/authoring/testing/contract-fake.ts", to: "src/platform/deep-equal.ts", rule: "platformImporters", reason: TESTING_PLATFORM, removedBy: "S13" },
  { from: "src/bounded-contexts/authoring/testing/conformance/index.ts", to: "src/platform/deep-equal.ts", rule: "platformImporters", reason: TESTING_PLATFORM, removedBy: "S13" },
];

// 18 at S0a. S1b added 4 interim rows and removed the handle → context row (21); S4 removed
// the 4 interim rows (17); S5 removed authoring-error → emit-rejection and framing → wire (15).
// S7 moved the conformance kit out of its public entry, so its existing deep-equal import
// became a testing/ → platform/ edge (16). S9 put the run boundary's reads behind the
// package-files port, removing the four context.ts rows (12). S10a did the same for the
// scaffold use case's source stat and read, removing four of its five fs rows (8); S10b moved
// its folder walk behind the port, removing the last (7). S11 sent the runner through Authoring's
// application layer for its error origin and JSON syntax message, removing four rows (3).
export const CEILING = 3;
