// Shared build fixture (design §4.6a, Suite-Cost design constraint, spec QA-M4): memoized
// module-singletons within a single `bun test` process — FIT-04 (dts diff), FIT-17
// (dev-only bundle scan), and the installed-consumer e2e (pack input) all share this ONE
// tsc build / these per-entry minified builds instead of each triggering its own.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deriveRunnerClosure, ENTRY_RELATIVE_PATH, type ClosureDerivation } from "../../scripts/derive-runner-closure.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIST_DIR = join(PROJECT_ROOT, "dist");

/**
 * `bun run build`'s `prebuild` is `rm -rf dist`, and FIT-42, the docs-count check and the
 * installed-consumer e2e all read the REAL `dist/` tree — so a second `bun test` process
 * reaching this module destroys the first one's fixture mid-run. Measured on the tree as it stood
 * at judgment-day round 1: 2599 pass / 6 fail concurrent versus 2605 / 0 serial, with a different
 * set of failures each time.
 *
 * Building into a per-process scratch tree would remove the collision but also the property:
 * these checks exist to verify the tree that actually SHIPS, and a scratch copy verifies a
 * copy. So the tree stays shared and the collision is made LOUD instead — the failure mode
 * a second run gets is a named error, not six mysterious failures.
 *
 * Held for the whole process, not just for the build: the destructive window is every read of
 * `dist/` after it, not only the `rm -rf`.
 *
 * Ownership is reclaimed by LIVENESS, not by cleanup — `bun test` terminates the worker that
 * acquired the lock rather than exiting it, so a `process.on("exit")` release provably never
 * fires here and the file routinely outlives the run. That is fine and is the design: a lock
 * naming a dead pid is stale and is taken over silently. The leftover file is gitignored.
 */
const BUILD_LOCK_PATH = join(PROJECT_ROOT, ".tmp-shared-build.lock");

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process EXISTS and belongs to someone else — reading it as "dead" would
    // hand the lock to a second run while the first is still holding it. Only ESRCH is dead.
    return (error as { code?: string }).code === "EPERM";
  }
}

function acquireBuildLock(): void {
  if (existsSync(BUILD_LOCK_PATH)) {
    const holder = Number.parseInt(readFileSync(BUILD_LOCK_PATH, "utf-8").trim(), 10);
    if (Number.isInteger(holder) && holder !== process.pid && processIsAlive(holder)) {
      throw new Error(
        `shared-build: another "bun test" run (pid ${holder}) already owns this repo's dist/ tree.\n` +
          `"bun run build" begins with "rm -rf dist", so two concurrent runs delete each other's fixture and fail non-deterministically.\n` +
          `Wait for pid ${holder} to finish, or run the two suites against separate checkouts. ` +
          `If pid ${holder} is genuinely gone, delete ${BUILD_LOCK_PATH}.`
      );
    }
    // A dead holder's lock is stale — a killed run cannot be waited for.
  }
  writeFileSync(BUILD_LOCK_PATH, `${process.pid}\n`, "utf-8");
}

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
  acquireBuildLock();
  const result = spawnSync("bun", ["run", "build"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `shared-build: "bun run build" failed — cannot proceed without a fresh build.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  tscBuildDist = DIST_DIR;
  return tscBuildDist;
}

/**
 * Fail-loud guard (context-singleton-fix, REQ-MIS-06.1): asserts the two build artifacts a
 * dist-runner e2e needs are actually present under `distDir`. Called AFTER `ensureTscBuild()`
 * so a build failure is caught there first — this only catches the residual case where the
 * build "succeeded" but the expected output layout changed (a silent skip would false-pass
 * the dual-realm regression e2e instead of exercising the real bug).
 */
export function requireDistArtifacts(distDir: string): void {
  const requiredArtifacts = [join(distDir, "bin/pbuilder-runner.js"), join(distDir, "core/context.js")];
  for (const artifact of requiredArtifacts) {
    if (!existsSync(artifact)) {
      throw new Error(`requireDistArtifacts: missing build artifact ${artifact} — run "bun run build" first`);
    }
  }
}

let realClosureDerivation: ClosureDerivation | undefined;

/**
 * The real dist/ tree's runner closure, derived AT MOST ONCE per `bun test` process
 * (memoized as a module-singleton, same idiom as `ensureTscBuild`). FIT-42's own closure
 * checks and the docs-count fitness check (REQ-DLV-01) both derive the SAME closure from the
 * SAME build; this is the one call site both consume instead of each re-deriving it.
 */
export function ensureRealClosureDerivation(): ClosureDerivation {
  if (realClosureDerivation === undefined) {
    realClosureDerivation = deriveRunnerClosure(ensureTscBuild(), ENTRY_RELATIVE_PATH);
  }
  return realClosureDerivation;
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
