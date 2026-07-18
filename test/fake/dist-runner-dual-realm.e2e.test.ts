// Dist-runner dual-realm regression e2e (S-000, context-singleton-fix, REQ-MIS-01.1/05.1/
// 05.2/06.1): spawns the BUILT dist/bin/pbuilder-runner.js against the src-relative `happy`
// fixture factory — the ONLY topology where the runner's own defineFactory (resolved via
// dist/core/context.js) and the factory's verbs (resolved via src/core/context.ts, reached
// through the factory's src-relative import of src/index.ts) land in TWO DIFFERENT module
// realms in one Bun process. The existing source-runner e2e (fake-engine-harness.e2e.test.ts)
// spawns src/bin/pbuilder-runner.ts directly — a same-copy topology that cannot exercise the
// module-identity bug this guards against regressing.

import { describe, it, expect, beforeAll } from "bun:test";
import { join } from "node:path";
import { frameHostFactory } from "../support/frame-host.ts";
import { serveSpawnedRunner } from "./fake-engine-harness.ts";
import { ContractFake } from "../../src/testing/contract-fake.ts";
import { ensureTscBuild, requireDistArtifacts } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const HAPPY_POINTER = `file://${new URL("../fixtures/frame-runner/happy/", import.meta.url).pathname}factory.ts`;

const spawnFrameHost = frameHostFactory();

let distRunnerBin: string;

beforeAll(() => {
  const distDir = ensureTscBuild();
  requireDistArtifacts(distDir);
  distRunnerBin = join(distDir, "bin/pbuilder-runner.js");
});

function spawnDistRunner(input: unknown) {
  return spawnFrameHost(
    "bun",
    ["run", distRunnerBin, "--factory", HAPPY_POINTER, "--input", JSON.stringify(input)],
    { cwd: PROJECT_ROOT }
  );
}

describe("dist-runner dual-realm regression e2e — built dist runner + src-relative factory (REQ-MIS-01/REQ-MIS-05)", () => {
  it("REQ-MIS-05.1: two-instance happy path exits clean — same request sequence and committed output as the source-runner e2e", async () => {
    const fake = new ContractFake({ seed: { "seed.txt": "hello from seed" } });
    const host = spawnDistRunner({});

    const run = await serveSpawnedRunner(host, fake);

    expect(run.signal).toBeNull();
    expect(run.exitCode).toEqual(0);
    expect(run.requests.map((r) => r.method)).toEqual(["tree.read", "ir.emit", "ir.commit"]);
    expect(run.requests[0]?.params).toEqual({ path: "seed.txt" });
    expect(fake.committedTree().get("out.txt")).toEqual("read:hello from seed");
  });
});
