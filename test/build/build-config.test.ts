/**
 * Build-script config guards (S-000, REQ-PPH-04.1/REQ-PPH-05.1): `prebuild` must clean
 * `dist/` before `tsc` runs (so a local build can't ship stale artifacts), and
 * `tsconfig.build.json#declarationMap` must be `false` (ADR-0034 amendment — no `.d.ts.map`
 * source-map leak of internal paths, REQ-PPH-05).
 *
 * The PPH-04.1 check is a REAL invocation of `bun run build` (never the shared
 * `ensureTscBuild()` singleton from `shared-build.ts`) — it seeds a stale marker file into
 * `dist/` first, so the only way the assertion passes is if the actual npm-lifecycle
 * `prebuild` hook fires and removes it before `tsc` runs.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIST_DIR = join(PROJECT_ROOT, "dist");
const STALE_MARKER = join(DIST_DIR, "__stale-build-config-test-marker__.js");

describe("REQ-PPH-04.1: prebuild removes dist/ before tsc runs", () => {
  let buildStatus: number | null;

  beforeAll(() => {
    mkdirSync(DIST_DIR, { recursive: true });
    writeFileSync(STALE_MARKER, "// stale — must be removed by prebuild\n", "utf-8");
    const result = spawnSync("bun", ["run", "build"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
    buildStatus = result.status;
  });

  it("completes the build successfully", () => {
    expect(buildStatus).toEqual(0);
  });

  it("removes the pre-existing stale dist/ file before the tsc step begins", () => {
    expect(existsSync(STALE_MARKER)).toBe(false);
  });

  it("still produces a fresh build after the clean", () => {
    expect(existsSync(join(DIST_DIR, "index.js"))).toBe(true);
  });
});

describe("REQ-PPH-05.1: declarationMap is false in tsconfig.build.json", () => {
  it("reads compilerOptions.declarationMap as false", () => {
    const raw = readFileSync(join(PROJECT_ROOT, "tsconfig.build.json"), "utf-8");
    const parsed = JSON.parse(raw) as { compilerOptions?: { declarationMap?: boolean } };
    expect(parsed.compilerOptions?.declarationMap).toBe(false);
  });
});
