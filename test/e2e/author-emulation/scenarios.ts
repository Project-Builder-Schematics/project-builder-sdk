// R-E (design rev 2): the SINGLE scenario source `scripts/regen-corpus.ts` AND
// `test/e2e/author-emulation-scaffold.e2e.test.ts` BOTH iterate — corpus filenames,
// report filenames, and expected counts all derive from this one export. Data-only: no
// fs, no writes, no import of the capture module (never a capture path, FIT-25-
// irrelevant; never a corpus write, FIT-27-clean by construction, still scanned like
// every test-reachable module).
import { run as skeletonRun, PACKAGE_DIR as SKELETON_PACKAGE_DIR } from "../../fixtures/typed-factory/factory.ts";
import type { Input as SkeletonInput } from "../../fixtures/typed-factory/schema.generated.ts";
import {
  PACKAGE_DIR,
  runM01,
  runM02Defaults,
  runM03,
  runM04,
  runM05,
  runM06,
  runM07,
  runM08,
  runM09,
  runM10,
  runM11AtCap,
  runM12Binary,
  runM13,
  runM14,
  runM15,
  runM16Traversal,
  runM17NonExisting,
  runM18,
  runM19,
  runM20Valid,
  runM21,
  M21_COLLISION_SEED_PATH,
} from "../../fixtures/author-emulation/factory.ts";
import type { Input as AuthorEmulationInput } from "../../fixtures/author-emulation/schema.generated.ts";

// A bare factory variant reference, erased to `any` at the boundary (bare-factory-migration
// design §4.3): each scenario's factory carries its OWN `Input` type (schema-derived), and
// this registry deliberately mixes heterogeneous scenarios in one array — there is no
// single concrete signature to give `run` without an escape hatch here. `captureRun`'s own
// generic `<O>` recovers precision per call site. Narrowed from the old arity-2
// wrapped-runner shape to the bare author-fn shape — this is what COMPILE-enforces every
// fixture export's migration (design §4.7).
export type FactoryRunner = (input: any) => void | Promise<void>;

export interface ScenarioEntry {
  id: string;
  slug: string;
  run: FactoryRunner;
  input: unknown;
  seed?: Record<string, string>;
  /** Threaded to `runFactoryForTest`/`captureRun`'s options bag (bare-factory-migration
   * design §4.3) — `packageDir` now lives at the SCENARIO level, never inside the fixture's
   * own export. Absent for the scratch-backed rows (m-07/m-09/m-14/m-17/m-18/m-19/m-21),
   * whose factories resolve their OWN dynamically-created scratch directory internally. */
  packageDir?: string;
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
    packageDir: SKELETON_PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-01",
    slug: "full-generator",
    run: runM01,
    input: M01_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-02",
    slug: "defaults-hold",
    run: runM02Defaults,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-03",
    slug: "include-exclude",
    run: runM03,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-04",
    slug: "rename-chained-token",
    run: runM04,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-05",
    slug: "mixed-by-value-by-reference",
    run: runM05,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-06",
    slug: "binary-by-reference",
    run: runM06,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
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
    packageDir: PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  // --- S-004 (Batch-Cap, Containment & Rejection Boundaries) — one canonical
  // corpus-committed scenario per row; companion input variants of the SAME row's reason
  // (M-11 one-byte-over, M-12 oversized, M-16 absolute-path, M-17 existing-target) are
  // e2e-inline-only, never corpus-captured (see factory.ts's per-row comments).
  {
    id: "m-08",
    slug: "binary-template-walk-fails-loud",
    run: runM08,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-10",
    slug: "single-group-over-cap-rejects",
    run: runM10,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-11",
    slug: "exactly-at-cap-passes",
    run: runM11AtCap,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "committed",
    gated: false,
  },
  {
    id: "m-12",
    slug: "templatefile-binary-fails-loud",
    run: runM12Binary,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-13",
    slug: "filters-eliminate-everything",
    run: runM13,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-15",
    slug: "intra-scaffold-collision",
    run: runM15,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-16",
    slug: "traversal-source-rejected",
    run: runM16Traversal,
    input: DEFAULT_INPUT,
    packageDir: PACKAGE_DIR,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-17",
    slug: "no-existence-oracle-nonexisting",
    run: runM17NonExisting,
    input: DEFAULT_INPUT,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-18",
    slug: "missing-in-ceiling-source",
    run: runM18,
    input: DEFAULT_INPUT,
    expected: "rejected",
    gated: false,
  },
  {
    id: "m-21",
    slug: "cross-chunk-atomicity",
    run: runM21,
    input: DEFAULT_INPUT,
    seed: { [M21_COLLISION_SEED_PATH]: "pre-existing seeded content — the collision M-21 pins" },
    expected: "rejected",
    gated: false,
  },
];
