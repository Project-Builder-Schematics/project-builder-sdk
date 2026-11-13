/**
 * FIT-09 / REQ-PKG-01: subpath resolution guarantee.
 *
 * The "@pbuilder/sdk" package exports exactly these public subpaths (from package.json):
 *   "."          → dist/index.js    (umbrella re-export of ./commons)
 *   "./commons"  → dist/commons/index.js
 *   "./conformance" → dist/conformance/index.js
 *   "./testing"  → dist/testing/index.js (third audience, `author-testing`, ADR-0033/REQ-TES-01)
 *   "./typescript" → dist/dialects/typescript/index.js (first real dialect, stage-5-first-dialect
 *                     REQ-TSD-01, ADR-0014 amendment)
 *
 * "./core" is intentionally NOT exported — it is the contributor-kit boundary (ADR-0009).
 *
 * Strategy: since import.meta.resolve() may not resolve the package's own exports map
 * while running inside the repo (it resolves the raw file path, not the package name),
 * we assert against the package.json#exports map shape directly. This is the authoritative
 * source of truth — if the shape matches, npm / Bun's resolution will honour it.
 *
 * A note is left explaining why we test the shape and not live resolution.
 */
import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIALECTS_DIR = join(PROJECT_ROOT, "src/dialects");
const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8")) as {
  exports: Record<string, { types: string; import: string }>;
};

// NOTE: import.meta.resolve() resolves the package's own exports map from inside
// the repo only when the package name matches an installed dependency. Since this
// package imports itself by path (not by package name) during development, we assert
// against the exports map shape — the shape IS the resolution contract that npm/Bun honour.

describe("REQ-PKG-01 — package.json#exports resolution contract", () => {
  it('exports "." (umbrella) with correct types and import fields', () => {
    const umbrella = pkgJson.exports["."] ?? null;
    expect(umbrella).not.toBeNull();
    expect(umbrella!.types).toMatch(/dist\/index\.d\.ts$/);
    expect(umbrella!.import).toMatch(/dist\/index\.js$/);
  });

  it('exports "./commons" with correct types and import fields', () => {
    const commons = pkgJson.exports["./commons"] ?? null;
    expect(commons).not.toBeNull();
    expect(commons!.types).toMatch(/dist\/commons\/index\.d\.ts$/);
    expect(commons!.import).toMatch(/dist\/commons\/index\.js$/);
  });

  it('exports "./conformance" with correct types and import fields', () => {
    const conformance = pkgJson.exports["./conformance"] ?? null;
    expect(conformance).not.toBeNull();
    expect(conformance!.types).toMatch(/dist\/conformance\/index\.d\.ts$/);
    expect(conformance!.import).toMatch(/dist\/conformance\/index\.js$/);
  });

  it('exports "./testing" with correct types and import fields (REQ-TES-01)', () => {
    const testing = pkgJson.exports["./testing"] ?? null;
    expect(testing).not.toBeNull();
    expect(testing!.types).toMatch(/dist\/testing\/index\.d\.ts$/);
    expect(testing!.import).toMatch(/dist\/testing\/index\.js$/);
  });

  it('does NOT export "./core" (contributor-kit boundary, ADR-0009)', () => {
    expect(pkgJson.exports["./core"]).toBeUndefined();
  });

  // Each `./<name>` subpath that points into dist/dialects/ is a public dialect, read from
  // package.json so adding one needs no edit here; its public barrel is src/dialects/<name>/.
  const dialectSubpaths = Object.entries(pkgJson.exports).filter(([, entry]) => entry.import.startsWith("./dist/dialects/"));

  it("finds the shipped dialect subpaths in package.json", () => {
    expect(dialectSubpaths.length).toBeGreaterThanOrEqual(7);
  });

  it.each(dialectSubpaths)('exports "%s" with correct types and import fields', (subpath, entry) => {
    const name = subpath.slice(2);
    expect(entry.types).toBe(`./dist/dialects/${name}/index.d.ts`);
    expect(entry.import).toBe(`./dist/dialects/${name}/index.js`);
  });

  it("every public barrel folder under src/dialects/ has its subpath, and no subpath lacks one", () => {
    const folders = readdirSync(DIALECTS_DIR).filter((entry) => statSync(join(DIALECTS_DIR, entry)).isDirectory());
    expect(dialectSubpaths.map(([subpath]) => subpath.slice(2)).sort()).toEqual(folders.sort());
  });

  it("the only other exported subpaths are ., ./commons, ./conformance and ./testing (REQ-TES-01.1, REQ-PKG-01)", () => {
    const dialects = new Set(dialectSubpaths.map(([subpath]) => subpath));
    expect(Object.keys(pkgJson.exports).filter((key) => !dialects.has(key)).sort()).toEqual([".", "./commons", "./conformance", "./testing"]);
  });
});
