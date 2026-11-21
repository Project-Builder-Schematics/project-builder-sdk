/**
 * `bun run build` starts with `rm -rf dist`, so a test file that runs it deletes `dist/` under
 * every other test reading it in the same `bun test` run (#170). Builds go through the memoized
 * `ensureTscBuild()` in test/support/shared-build.ts. The one exception is build-config, whose
 * subject is that very `rm -rf`.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const ALLOWED = new Set(["test/support/shared-build.ts", "test/build/build-config.test.ts", "test/build/single-build-owner.test.ts"]);
const SELF_BUILD = /["']run["']\s*,\s*["']build["']/;

describe("the build fixture has a single owner", () => {
  it("no test file runs `bun run build` itself", () => {
    const offenders = [...new Glob("test/**/*.ts").scanSync({ cwd: PROJECT_ROOT })]
      .filter((path) => !ALLOWED.has(path) && !path.includes("node_modules"))
      .filter((path) => SELF_BUILD.test(readFileSync(join(PROJECT_ROOT, path), "utf-8")));
    expect(offenders.sort()).toEqual([]);
  });

  it("[red-proof] the pattern catches the spawn shape the offenders used", () => {
    expect(SELF_BUILD.test('spawnSync("bun", ["run", "build"], { cwd })')).toBe(true);
    expect(SELF_BUILD.test("ensureTscBuild()")).toBe(false);
  });
});
