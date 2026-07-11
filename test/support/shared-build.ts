// Shared build fixture (design §4.6a, Suite-Cost design constraint, spec QA-M4): memoized
// module-singletons within a single `bun test` process — FIT-04 (dts diff), FIT-17
// (dev-only bundle scan), and the installed-consumer e2e (pack input) all share this ONE
// tsc build / these per-entry minified builds instead of each triggering its own.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIST_DIR = join(PROJECT_ROOT, "dist");

let tscBuildDist: string | undefined;

/**
 * Runs `bun run build` (tsc -p tsconfig.build.json + the codegen bin bundle) AT MOST ONCE
 * per `bun test` process, memoized as a module-singleton. Returns the absolute `dist/`
 * path. FIT-04 and the installed-consumer e2e share this ONE build (their inputs are
 * identical) instead of each rebuilding.
 */
export function ensureTscBuild(): string {
  if (tscBuildDist !== undefined) {
    return tscBuildDist;
  }
  const result = spawnSync("bun", ["run", "build"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `shared-build: "bun run build" failed — cannot proceed without a fresh build.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  tscBuildDist = DIST_DIR;
  return tscBuildDist;
}

const minifiedEntryCache = new Map<string, { sizeBytes: number; output: string }>();

/**
 * Runs `bun build <entry> --target=node --minify` AT MOST ONCE per entry key (FIT-03's
 * idiom), memoized as a module-singleton cache. Consumed by FIT-17's four per-entry scans.
 */
export function ensureMinifiedEntry(entry: string): { sizeBytes: number; output: string } {
  const cached = minifiedEntryCache.get(entry);
  if (cached !== undefined) {
    return cached;
  }

  const outFile = join(PROJECT_ROOT, `.tmp-shared-build-${entry.replace(/[/.]/g, "-")}.js`);
  try {
    const result = spawnSync(
      "bun",
      ["build", entry, "--target=node", "--minify", `--outfile=${outFile}`, "--packages=bundle"],
      { cwd: PROJECT_ROOT, encoding: "utf-8" }
    );
    if (result.status !== 0) {
      throw new Error(`shared-build: "bun build --minify" failed for ${entry}.\nstderr: ${result.stderr}`);
    }
    const output = existsSync(outFile) ? readFileSync(outFile, "utf-8") : "";
    const sizeBytes = Buffer.byteLength(output, "utf-8");
    const entryResult = { sizeBytes, output };
    minifiedEntryCache.set(entry, entryResult);
    return entryResult;
  } finally {
    if (existsSync(outFile)) unlinkSync(outFile);
  }
}
