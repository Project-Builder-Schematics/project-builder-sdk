/**
 * fit-52 (S0b, P-SIZE): the minified bundle of every public entry, and of two single-symbol
 * consumer probes, stays within max(256 bytes, 1 %) of test/fitness/bundle-size-baseline.json.
 * The SDK port rule (odd/tasks/hexagonal-layout-proposal.md section 3.3) allows no wiring that
 * defeats tree-shaking; the probes catch it. Builds use `Bun.build` in memory, as fit-03's
 * `bun build` does on disk, with dependencies external so only SDK code is measured. A
 * measurement below the band means the baseline is stale: lower it in the same commit
 * (FIT52_WRITE_BASELINE=1).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const BASELINE = join(ROOT, "test/fitness/bundle-size-baseline.json");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as { exports: Record<string, { import: string }> };

const MEASURED: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PKG.exports).map(([subpath, t]) => [subpath, t.import.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts")])),
  "probe:commons#create": "test/fixtures/bundle-probes/commons-create.ts",
  "probe:css#find": "test/fixtures/bundle-probes/css-find.ts",
};

export function tolerance(baseline: number): number {
  return Math.max(256, Math.ceil(baseline * 0.01));
}

async function bundleBytes(entry: string): Promise<number> {
  const result = await Bun.build({ entrypoints: [join(ROOT, entry)], minify: true, target: "node", packages: "external" });
  if (!result.success) throw new Error(`bun build ${entry} failed: ${result.logs.join("\n")}`);
  return result.outputs.reduce((sum, output) => sum + output.size, 0);
}

describe("fit-52 — P-SIZE: bundle size per public entry and probe", () => {
  it("every measurement is within max(256 B, 1 %) of bundle-size-baseline.json", async () => {
    const actual: Record<string, number> = {};
    for (const [name, entry] of Object.entries(MEASURED)) actual[name] = await bundleBytes(entry);
    if (process.env.FIT52_WRITE_BASELINE === "1") writeFileSync(BASELINE, `${JSON.stringify(actual, null, 2)}\n`);
    const baseline = JSON.parse(readFileSync(BASELINE, "utf-8")) as Record<string, number>;

    expect(Object.keys(actual).sort()).toEqual(Object.keys(baseline).sort());
    const outside = Object.entries(actual)
      .filter(([name, bytes]) => Math.abs(bytes - baseline[name]!) > tolerance(baseline[name]!))
      .map(([name, bytes]) => `${name}: ${bytes} B vs baseline ${baseline[name]} B (±${tolerance(baseline[name]!)} B)`);
    expect(outside).toEqual([]);
  }, 120_000);

  it("[red-proof] the band is max(256 B, 1 %)", () => {
    expect(tolerance(1_000)).toBe(256);
    expect(tolerance(100_000)).toBe(1_000);
  });
});
