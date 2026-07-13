// R-E (design rev 2): the SINGLE scenario source `scripts/regen-corpus.ts` AND
// `test/e2e/author-emulation-scaffold.e2e.test.ts` BOTH iterate — corpus filenames,
// report filenames, and expected counts all derive from this one export. Data-only: no
// fs, no writes, no import of the capture module (never a capture path, FIT-25-
// irrelevant; never a corpus write, FIT-27-clean by construction, still scanned like
// every test-reachable module).
import { run as skeletonRun } from "../../fixtures/typed-factory/factory.ts";
import type { Input as SkeletonInput } from "../../fixtures/typed-factory/schema.generated.ts";
import {
  runM01,
  runM02Defaults,
  runM03,
  runM04,
  runM05,
  runM06,
  runM07,
  runM09,
  runM14,
  runM19,
  runM20Valid,
} from "../../fixtures/author-emulation/factory.ts";
import type { Input as AuthorEmulationInput } from "../../fixtures/author-emulation/schema.generated.ts";

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

// S-003's own default fixture input — `visibility`/`withTests` omitted where a scenario
// doesn't care, `satisfies` pins each literal against the generated `Input` type.
const M01_INPUT = { name: "Widgets", withTests: true, visibility: "public" } satisfies AuthorEmulationInput;
const DEFAULT_INPUT = { name: "Widgets" } satisfies AuthorEmulationInput;

export const SCENARIOS: readonly ScenarioEntry[] = [
  {
    id: "s-00",
    slug: "infra-skeleton",
    run: skeletonRun,
    input: { port: 8080 } satisfies SkeletonInput,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-01",
    slug: "full-generator",
    run: runM01,
    input: M01_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-02",
    slug: "defaults-hold",
    run: runM02Defaults,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-03",
    slug: "include-exclude",
    run: runM03,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-04",
    slug: "rename-chained-token",
    run: runM04,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-05",
    slug: "mixed-by-value-by-reference",
    run: runM05,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-06",
    slug: "binary-by-reference",
    run: runM06,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-07",
    slug: "oversized-by-stat-by-reference",
    run: runM07,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-09",
    slug: "aggregate-over-cap-chunking",
    run: runM09,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-14",
    slug: "empty-folder-noop",
    run: runM14,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-19",
    slug: "symlinked-dir-skipped",
    run: runM19,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-20",
    slug: "conformance-parity-copyin",
    run: runM20Valid,
    input: DEFAULT_INPUT,
    expected: "committed",
    gated: false,
  },
];
