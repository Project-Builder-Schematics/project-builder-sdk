/**
 * Installed-consumer-vantage e2e (S-000 spike, ADR-0036/REQ-TES-02 groundwork): proves
 * reachability from a REAL installed consumer's own vantage — build, `bun pm pack`, install
 * the tarball into a scratch dir, `import(...)` BY PACKAGE NAME (never a relative `dist`
 * path). A relative import never exercises the `exports` map — the exact gap this proves.
 *
 * S-000 scope: proves ONLY resolution of ONE symbol (`defineFactory` via
 * `@pbuilder/sdk/testing`). The full TES-02/06 behavioural scenario suite (both `./commons`
 * and `./testing` resolving, `./core` rejecting, the founding-bug write/rejection proofs)
 * lands in S-004 once `runFactoryForTest` exists — this spike only unblocks that work by
 * proving the pack→install→import-by-name mechanic itself.
 *
 * Hardening (ADR-0036, SEC-m2): `bun install --ignore-scripts` + a non-routable
 * `BUN_CONFIG_REGISTRY` so any accidental network dependence fails loudly instead of
 * silently fetching; the scratch install gets its OWN lockfile inside the scratch dir — the
 * repo's lockfile hash is asserted unchanged before/after. `afterAll` always removes the
 * scratch dir (tarball lives inside it, so one `rm -rf` covers both).
 */
import { describe, it, expect, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ensureTscBuild } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const SCRATCH_DIR = join(PROJECT_ROOT, ".tmp-testing-e2e");
const REPO_LOCKFILE = join(PROJECT_ROOT, "bun.lock");

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function cleanScratch(): void {
  if (existsSync(SCRATCH_DIR)) rmSync(SCRATCH_DIR, { recursive: true, force: true });
}

afterAll(() => {
  cleanScratch();
});

describe("e2e — installed-consumer-vantage (S-000 spike, ADR-0036)", () => {
  it("defineFactory resolves from @pbuilder/sdk/testing in a freshly packed, scratch-installed tarball", () => {
    ensureTscBuild();

    const repoLockfileHashBefore = hashFile(REPO_LOCKFILE);

    cleanScratch();
    mkdirSync(SCRATCH_DIR, { recursive: true });

    // Pack the built package into a real tarball, written straight into the scratch dir.
    const packResult = spawnSync(
      "bun",
      ["pm", "pack", "--destination", SCRATCH_DIR, "--quiet"],
      { cwd: PROJECT_ROOT, encoding: "utf-8" }
    );
    if (packResult.status !== 0) {
      throw new Error(`bun pm pack failed:\n${packResult.stdout}\n${packResult.stderr}`);
    }
    const tarballPath = packResult.stdout.trim();
    expect(existsSync(tarballPath)).toBe(true);

    // The scratch consumer gets its OWN package.json/lockfile — isolated from the repo's.
    writeFileSync(
      join(SCRATCH_DIR, "package.json"),
      JSON.stringify(
        {
          name: "installed-consumer-scratch",
          version: "0.0.0",
          private: true,
          type: "module",
          dependencies: { "@pbuilder/sdk": `file:${tarballPath}` },
        },
        null,
        2
      )
    );

    // Non-routable registry (SEC-m2): any accidental network dependence fails loudly
    // instead of silently fetching. The `file:` dependency never needs the registry.
    const installResult = spawnSync("bun", ["install", "--ignore-scripts"], {
      cwd: SCRATCH_DIR,
      encoding: "utf-8",
      env: { ...process.env, BUN_CONFIG_REGISTRY: "http://127.0.0.1:9" },
    });
    if (installResult.status !== 0) {
      throw new Error(`scratch bun install failed:\n${installResult.stdout}\n${installResult.stderr}`);
    }

    writeFileSync(
      join(SCRATCH_DIR, "check.mjs"),
      [
        'import { defineFactory } from "@pbuilder/sdk/testing";',
        'console.log(typeof defineFactory === "function" ? "RESOLVED" : "MISSING");',
        "",
      ].join("\n")
    );

    const runResult = spawnSync("bun", ["run", "check.mjs"], { cwd: SCRATCH_DIR, encoding: "utf-8" });
    if (runResult.status !== 0) {
      throw new Error(`scratch consumer script failed:\n${runResult.stdout}\n${runResult.stderr}`);
    }
    expect(runResult.stdout.trim()).toBe("RESOLVED");

    const repoLockfileHashAfter = hashFile(REPO_LOCKFILE);
    expect(repoLockfileHashAfter).toBe(repoLockfileHashBefore);
  });
});
