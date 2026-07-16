/**
 * FIT-36 (react-dialect S-000, REQ-RXD-14): supply-chain gate — the exploration spike
 * installed `@babel/parser`, `@babel/generator`, `recast`, and `magic-string` in a
 * scratchpad to compare AST-mutation mechanisms; NONE of them may ship. Scans the manifest
 * (ALL top-level fields, not just `dependencies`) and the committed lockfile for the four
 * names, and separately pins `dependencies` to deep-equal exactly `{ "ts-morph": "28.0.0" }`
 * — this change adds ZERO dependencies (FIT-14's baseline pin is the standing enforcement;
 * this file is the REQ-RXD-14-owned assertion).
 *
 * Red-proof: a fixture manifest/lockfile naming one of the four spike libraries is caught.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SPIKE_LIBS = ["@babel/parser", "@babel/generator", "recast", "magic-string"];

function findSpikeLibMatches(source: string): string[] {
  return SPIKE_LIBS.filter((lib) => source.includes(lib));
}

describe("FIT-36 — spike dependencies never ship (REQ-RXD-14.1)", () => {
  const pkgRaw = readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8");
  const lockRaw = readFileSync(join(PROJECT_ROOT, "bun.lock"), "utf-8");
  const pkgJson = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> };

  it("package.json (every field, raw text scan) contains zero spike-library matches", () => {
    expect(findSpikeLibMatches(pkgRaw)).toEqual([]);
  });

  it("the committed lockfile contains zero spike-library matches", () => {
    expect(findSpikeLibMatches(lockRaw)).toEqual([]);
  });

  it("dependencies deep-equals exactly { ts-morph: 28.0.0 } — zero net-new dependencies", () => {
    expect(pkgJson.dependencies).toEqual({ "ts-morph": "28.0.0" });
  });

  // RED-PROOF: a fixture manifest naming a spike library is caught.
  it("[red-proof] a fixture manifest naming magic-string is caught", () => {
    const fixture = JSON.stringify({ dependencies: { "ts-morph": "28.0.0", "magic-string": "^0.30.0" } });
    expect(findSpikeLibMatches(fixture)).toEqual(["magic-string"]);
  });

  // RED-PROOF: a fixture lockfile naming @babel/parser and recast is caught.
  it("[red-proof] a fixture lockfile naming @babel/parser and recast is caught", () => {
    const fixture = '"@babel/parser": ["@babel/parser@7.24.0", ...], "recast": ["recast@0.23.0", ...]';
    expect(findSpikeLibMatches(fixture)).toEqual(["@babel/parser", "recast"]);
  });

  // RED-PROOF: a caret-ranged or mismatched ts-morph entry would fail the deep-equal pin.
  it("[red-proof] an extra dependency entry would fail the exact deep-equal", () => {
    const simulated = { "ts-morph": "28.0.0", "left-pad": "1.0.0" };
    expect(simulated).not.toEqual({ "ts-morph": "28.0.0" });
  });
});
