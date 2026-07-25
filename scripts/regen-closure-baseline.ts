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
import {
  deriveRunnerClosure,
  renderViolations,
  BASELINE_RELATIVE_PATH,
  DIST_DIR_NAME,
  ENTRY_RELATIVE_PATH,
  SRC_DIR_NAME,
} from "./derive-runner-closure.ts";

const packageRoot = process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url));
const { nodes, edges, builtins, violations } = deriveRunnerClosure(
  join(packageRoot, DIST_DIR_NAME),
  ENTRY_RELATIVE_PATH
);

if (violations.length > 0) {
  process.stderr.write(
    "regen-closure-baseline: refusing to write a baseline from a tree that cannot build.\n\n"
  );
  // Any existing baseline is left untouched: it is the maintainer's committed oracle, not
  // this script's leftover output to clean up — which is what the epilogue has to say, since
  // the renderer's default sentence is about the manifest and would be untrue here.
  process.stderr.write(
    renderViolations(violations, {
      distDirName: DIST_DIR_NAME,
      srcDirName: SRC_DIR_NAME,
      outcome: `No baseline was written; ${BASELINE_RELATIVE_PATH} is unchanged.`,
    })
  );
  process.exit(1);
}

writeFileSync(
  join(packageRoot, BASELINE_RELATIVE_PATH),
  `${JSON.stringify({ nodes, edges, builtins }, null, 2)}\n`
);
