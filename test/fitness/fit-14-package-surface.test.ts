/**
 * FIT-14: package-surface guard (REQ-FPS-02, Gap 11).
 *
 * Baseline-diff mechanism (FIT-04-style): a committed snapshot
 * `test/fitness/pkg-surface-baseline.json` records `{ exports, dependencies, files, bin,
 * shebang, tarball }` as of this change. This test REGENERATES the actual surface
 * (package.json fields + a real `bun pm pack --dry-run` listing + the shipped bin's first
 * line) and diffs it against the committed baseline — any drift (a changed export, an
 * unauthorized `dependencies` entry, a lost `files` entry, a missing shebang, or an
 * unexpected new tarball entry) fails, naming the delta.
 *
 * stage-5-first-dialect (REQ-FPS-02, V4): the baseline's `exports`/`dependencies` fields
 * were regenerated at this change to capture its OWN authorized growth — `./typescript`
 * (5th export entry) and `ts-morph` (first-ever runtime dependency, exact-pinned). The
 * zero-deps invariant this file's tests originally asserted becomes a ONE-deps invariant,
 * still closed (REQ-FPS-02.1) — asserted below against the pinned baseline, not "empty".
 *
 * Self-building via an unconditional `beforeAll` (FIT-04 precedent, slices constraint 10)
 * so a bare `bun test` on a fresh checkout stays green.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const BASELINE_PATH = join(PROJECT_ROOT, "test/fitness/pkg-surface-baseline.json");

interface PkgSurfaceBaseline {
  exports: Record<string, { types: string; import: string }>;
  dependencies: Record<string, string>;
  files: string[];
  bin: Record<string, string>;
  shebang: string;
  tarball: string[];
}

beforeAll(() => {
  const result = spawnSync("bun", ["run", "build"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `FIT-14: bun run build failed — cannot diff the package surface without a fresh build.\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
});

// Parses `bun pm pack --dry-run`'s "packed <size> <path>" lines into a sorted path list —
// the actual publishable tarball contents.
function parsePackedFileList(stdout: string): string[] {
  return stdout
    .split("\n")
    .filter((line) => line.startsWith("packed "))
    .map((line) => line.replace(/^packed\s+\S+\s+/, "").trim())
    .sort();
}

// Returns tarball paths present in `current` but absent from `baseline` — new entries a
// future change silently introduced (REQ-FPS-02.2: "no OTHER file... has newly entered").
function findNewTarballEntries(baseline: string[], current: string[]): string[] {
  const baselineSet = new Set(baseline);
  return current.filter((path) => !baselineSet.has(path));
}

// Returns tarball paths present in `baseline` but absent from `current` — entries that
// silently disappeared (a lost `files` entry is exactly this drift class).
function findMissingTarballEntries(baseline: string[], current: string[]): string[] {
  const currentSet = new Set(current);
  return baseline.filter((path) => !currentSet.has(path));
}

// REQ-FPS-07: positive credential-filename scan — asserted explicitly, never merely
// inferred from the baseline diff above (S-002.1).
const SECRET_FILENAME_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\..+)?$/,
  /(^|\/)\.npmrc$/,
  /\.pem$/,
  /\.key$/,
  /(^|\/)\.netrc$/,
  /(^|\/)id_rsa/,
  /\.p12$/,
  /\.pfx$/,
  /(^|\/)credentials\.json$/,
];

function scanForSecrets(paths: string[]): string[] {
  return paths.filter((path) => SECRET_FILENAME_PATTERNS.some((pattern) => pattern.test(path)));
}

describe("FIT-14 — package surface guard (baseline diff)", () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as PkgSurfaceBaseline;
  const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
    exports: PkgSurfaceBaseline["exports"];
    files: string[];
    bin: Record<string, string>;
    dependencies?: Record<string, string>;
  };

  // Computed once (S-002.1) and reused by the tarball-drift test below plus the new
  // REQ-PPH-05.2/REQ-FPS-07.1 checks — avoids a second redundant `bun pm pack --dry-run`.
  let freshTarball: string[] = [];
  beforeAll(() => {
    const result = spawnSync("bun", ["pm", "pack", "--dry-run"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
    if (result.status !== 0) {
      throw new Error(
        `FIT-14: bun pm pack --dry-run failed.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
      );
    }
    freshTarball = parsePackedFileList(result.stdout);
  });

  it("exports map is unchanged from the committed baseline (REQ-FPS-02.1)", () => {
    expect(pkgJson.exports).toEqual(baseline.exports);
  });

  it("REQ-FPS-02.1: exports map is EXACTLY the five authorized entries, no more, no less", () => {
    expect(Object.keys(pkgJson.exports).sort()).toEqual(
      [".", "./commons", "./conformance", "./testing", "./typescript"].sort()
    );
  });

  it("files field is unchanged from the committed baseline", () => {
    expect(pkgJson.files).toEqual(baseline.files);
  });

  it("bin field matches the committed baseline (only the codegen bin, REQ-FPS-02.1)", () => {
    expect(pkgJson.bin).toEqual(baseline.bin);
  });

  it("dependencies is unchanged from the committed baseline (REQ-FPS-02.1)", () => {
    expect(pkgJson.dependencies ?? {}).toEqual(baseline.dependencies);
  });

  it("REQ-FPS-02.1: dependencies contains EXACTLY one entry, ts-morph, exact-pinned (no caret/tilde)", () => {
    const deps = pkgJson.dependencies ?? {};
    expect(Object.keys(deps)).toEqual(["ts-morph"]);
    expect(deps["ts-morph"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // RED-PROOF: a caret/tilde-ranged version would fail the exact-pin assertion above.
  it("[red-proof] a caret-ranged ts-morph version would fail the exact-pin pattern", () => {
    expect("^28.0.0").not.toMatch(/^\d+\.\d+\.\d+$/);
    expect("~28.0.0").not.toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("the shipped dist/bin artifact's first line is exactly the pinned shebang", () => {
    const distBin = readFileSync(join(PROJECT_ROOT, "dist/bin/pbuilder-codegen.js"), "utf-8");
    const firstLine = distBin.split("\n")[0];
    expect(firstLine).toEqual(baseline.shebang);
  });

  it("the publishable tarball contains no file beyond the committed baseline (REQ-FPS-02.2)", () => {
    const newEntries = findNewTarballEntries(baseline.tarball, freshTarball);
    const missingEntries = findMissingTarballEntries(baseline.tarball, freshTarball);

    expect(newEntries).toEqual([]);
    expect(missingEntries).toEqual([]);
  });

  it("REQ-PPH-05.2: the fresh build's tarball ships zero .d.ts.map entries", () => {
    expect(freshTarball.filter((path) => path.endsWith(".d.ts.map"))).toEqual([]);
  });

  it("REQ-PPH-06.1: the committed baseline's tarball ships zero .d.ts.map entries", () => {
    expect(baseline.tarball.filter((path) => path.endsWith(".d.ts.map"))).toEqual([]);
  });

  it("REQ-FPS-06.1: the committed baseline still includes dist/core/** entries (documented, not stripped)", () => {
    expect(baseline.tarball.some((path) => path.startsWith("dist/core/"))).toBe(true);
  });

  it("REQ-FPS-07.1: the fresh tarball listing is positively scanned and contains no secret-like filenames", () => {
    expect(scanForSecrets(freshTarball)).toEqual([]);
  });

  // RED-PROOF: a simulated tarball listing containing a .env file is caught (REQ-FPS-07.2).
  it("[red-proof] REQ-FPS-07.2: a simulated tarball listing containing a .env file is caught", () => {
    const simulated = [...freshTarball, ".env"];
    expect(scanForSecrets(simulated)).toEqual([".env"]);
  });

  it("the codegen bin's file is present in the tarball listing", () => {
    expect(baseline.tarball).toContain("dist/bin/pbuilder-codegen.js");
  });

  // RED-PROOF: a simulated new tarball entry is detected as drift.
  it("[red-proof] a simulated new tarball file is flagged as a newly-entered file", () => {
    const simulatedCurrent = [...baseline.tarball, "dist/unexpected-leak.js"].sort();
    const newEntries = findNewTarballEntries(baseline.tarball, simulatedCurrent);
    expect(newEntries).toEqual(["dist/unexpected-leak.js"]);
  });

  // RED-PROOF: a simulated lost `files`-declared entry is detected as drift.
  it("[red-proof] a simulated missing tarball file is flagged as a lost entry", () => {
    const simulatedCurrent = baseline.tarball.filter((p) => p !== "dist/bin/pbuilder-codegen.js");
    const missingEntries = findMissingTarballEntries(baseline.tarball, simulatedCurrent);
    expect(missingEntries).toEqual(["dist/bin/pbuilder-codegen.js"]);
  });

  // RED-PROOF: an identical listing produces no drift.
  it("[red-proof] an unchanged listing produces no new or missing entries", () => {
    expect(findNewTarballEntries(baseline.tarball, baseline.tarball)).toEqual([]);
    expect(findMissingTarballEntries(baseline.tarball, baseline.tarball)).toEqual([]);
  });
});
