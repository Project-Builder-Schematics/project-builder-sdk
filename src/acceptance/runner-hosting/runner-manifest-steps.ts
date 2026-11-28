import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StepDefinition, World } from "../runner/steps.ts";
import { PROJECT_ROOT } from "../shared/runner-process.ts";

/** R-3: the runner manifest the build writes into the SDK's distribution. */
function manifest(world: World): { readonly dialects?: readonly string[] } {
  if (world.distDir === undefined) throw new Error("the SDK's distribution has not been built");
  return JSON.parse(readFileSync(join(world.distDir as string, "runner-manifest.json"), "utf-8"));
}

export const RUNNER_MANIFEST_STEPS: readonly StepDefinition[] = [
  {
    // The real build rewrites dist/: never run it while a `bun test` of this checkout reads dist/.
    phrase: "the SDK's distribution is built",
    run: (world) => {
      const built = Bun.spawnSync(["bun", "run", "build"], { cwd: PROJECT_ROOT, stdout: "pipe", stderr: "pipe" });
      if (built.exitCode !== 0) throw new Error(`bun run build failed:\n${built.stderr.toString()}`);
      world.distDir = join(PROJECT_ROOT, "dist");
    },
  },
  {
    phrase: 'the runner manifest of the SDK\'s distribution lists the dialects "{dialects}"',
    run: (world, [names]) =>
      void expect([...(manifest(world).dialects ?? [])].sort()).toEqual((names as string).split(", ").sort()),
  },
];
