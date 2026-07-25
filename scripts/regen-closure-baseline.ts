// Sole writer of test/fitness/runner-closure-graph-baseline.json.
//
// Deliberately OUTSIDE `scripts.build`: a build that regenerated its own oracle would make
// the closure-graph tripwire self-healing — it could never fire, because every build would
// quietly rewrite the file it is meant to be checked against.
//
// usage: bun scripts/regen-closure-baseline.ts [packageRoot]
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveRunnerClosure, renderViolations } from "./derive-runner-closure.ts";

const DIST_DIR_NAME = "dist";
const SRC_DIR_NAME = "src";
const ENTRY_RELATIVE_PATH = "bin/pbuilder-runner.js";
const BASELINE_RELATIVE_PATH = "test/fitness/runner-closure-graph-baseline.json";

const packageRoot = process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url));
const { nodes, edges, builtins, violations } = deriveRunnerClosure(
  join(packageRoot, DIST_DIR_NAME),
  ENTRY_RELATIVE_PATH
);

if (violations.length > 0) {
  process.stderr.write(
    "regen-closure-baseline: refusing to write a baseline from a tree that cannot build.\n\n"
  );
  process.stderr.write(
    renderViolations(violations, { distDirName: DIST_DIR_NAME, srcDirName: SRC_DIR_NAME })
  );
  // Any existing baseline is left untouched: it is the maintainer's committed oracle, not
  // this script's leftover output to clean up.
  process.exit(1);
}

writeFileSync(
  join(packageRoot, BASELINE_RELATIVE_PATH),
  `${JSON.stringify({ nodes, edges, builtins }, null, 2)}\n`
);
