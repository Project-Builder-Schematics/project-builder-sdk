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
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
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

  it('exports "./typescript" with correct types and import fields (stage-5-first-dialect REQ-TSD-01, ADR-0014 amendment)', () => {
    const typescript = pkgJson.exports["./typescript"] ?? null;
    expect(typescript).not.toBeNull();
    expect(typescript!.types).toMatch(/dist\/dialects\/typescript\/index\.d\.ts$/);
    expect(typescript!.import).toMatch(/dist\/dialects\/typescript\/index\.js$/);
  });

  it('does NOT export "./core" (contributor-kit boundary, ADR-0009)', () => {
    expect(pkgJson.exports["./core"]).toBeUndefined();
  });

  it("the only exported subpaths are ., ./commons, ./conformance, ./testing, and ./typescript (REQ-TES-01.1, REQ-PKG-01)", () => {
    const keys = Object.keys(pkgJson.exports).sort();
    expect(keys).toEqual([".", "./commons", "./conformance", "./testing", "./typescript"]);
  });
});
