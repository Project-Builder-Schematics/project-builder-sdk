// R-E (design rev 2): the SINGLE scenario source `scripts/regen-corpus.ts` AND
// `test/e2e/author-emulation-scaffold.e2e.test.ts` BOTH iterate — corpus filenames,
// report filenames, and expected counts all derive from this one export. Data-only: no
// fs, no writes, no import of the capture module (never a capture path, FIT-25-
// irrelevant; never a corpus write, FIT-27-clean by construction, still scanned like
// every test-reachable module).
import { run as skeletonRun } from "../../fixtures/typed-factory/factory.ts";
import type { Input as SkeletonInput } from "../../fixtures/typed-factory/schema.generated.ts";

// A factory variant reference, erased to `any` at the boundary: each scenario's factory
// carries its OWN `Input` type (schema-derived), and this registry deliberately mixes
// heterogeneous scenarios in one array — there is no single concrete signature to give
// `run` without an escape hatch here. `captureRun`'s own generic `<O>` recovers precision
// per call site.
export type FactoryRunner = (input: any, deps: { client: any }) => Promise<void>;

export interface ScenarioEntry {
  id: string;
  slug: string;
  run: FactoryRunner;
  input: unknown;
  seed?: Record<string, string>;
  expected: "committed" | "rejected";
  /** Matrix rows (m-01..m-21) needing the landed scaffold/copyIn/create(templateFile)
   * surface — gated true until S-003/S-004 land them. The infra-spine skeleton (s-00)
   * is never gated (GCC-12). */
  gated: boolean;
}

export const SCENARIOS: readonly ScenarioEntry[] = [
  {
    id: "s-00",
    slug: "infra-skeleton",
    run: skeletonRun,
    input: { port: 8080 } satisfies SkeletonInput,
    expected: "committed",
    gated: false,
  },
];
