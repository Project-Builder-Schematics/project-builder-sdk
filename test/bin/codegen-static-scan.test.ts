/**
 * TFO-03.3 — static parse-as-data proof over the SHIPPED bin artifact (design §4.6): no
 * `eval`, no `new Function`, no dynamic `import()`/`require()` call whose argument is not a
 * literal string. Scans `dist/bin/pbuilder-codegen.js` — the built artifact that ships in
 * the tarball — not the TypeScript source.
 *
 * Builds through the memoized `ensureTscBuild()`, once per `bun test` process, so a bare
 * `bun test` on a fresh checkout stays green and no test deletes `dist/` under another (#170).
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureTscBuild } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIST_BIN = join(PROJECT_ROOT, "dist/bin/pbuilder-codegen.js");

beforeAll(() => {
  ensureTscBuild();
});

// A `callee(...)` call whose argument is NOT a plain single/double-quoted string literal —
// the non-literal-argument shape REQ-TFO-03.3 forbids for import()/require(). Counts every
// occurrence of `callee(` and how many are immediately followed by a quote; any gap between
// the two counts means at least one call has a non-literal (or no) argument.
function hasNonLiteralCall(source: string, callee: string): boolean {
  const anyCallRe = new RegExp(`\\b${callee}\\s*\\(`, "g");
  const literalCallRe = new RegExp(`\\b${callee}\\s*\\(\\s*['"]`, "g");
  const totalCalls = (source.match(anyCallRe) ?? []).length;
  const literalCalls = (source.match(literalCallRe) ?? []).length;
  return totalCalls > literalCalls;
}

describe("TFO-03.3 — shipped bin is statically parse-as-data (no eval/Function/dynamic non-literal import)", () => {
  const source = readFileSync(DIST_BIN, "utf-8");

  it("contains no eval(...) call", () => {
    expect(/\beval\s*\(/.test(source)).toBe(false);
  });

  it("contains no `new Function(...)` construction", () => {
    expect(/\bnew\s+Function\s*\(/.test(source)).toBe(false);
  });

  it("contains no dynamic import()/require() call with a non-literal argument", () => {
    expect(hasNonLiteralCall(source, "import")).toBe(false);
    expect(hasNonLiteralCall(source, "require")).toBe(false);
  });

  // RED-PROOFS: synthetic sources containing each banned pattern are detected.
  it("[red-proof] eval(...) is detected", () => {
    expect(/\beval\s*\(/.test('const x = eval("1+1");')).toBe(true);
  });

  it("[red-proof] new Function(...) is detected", () => {
    expect(/\bnew\s+Function\s*\(/.test('const f = new Function("return 1");')).toBe(true);
  });

  it("[red-proof] a non-literal dynamic import() is detected", () => {
    expect(hasNonLiteralCall("const mod = import(userInput);", "import")).toBe(true);
  });

  it("[red-proof] a literal-argument dynamic import() is NOT flagged", () => {
    expect(hasNonLiteralCall('const mod = import("node:fs");', "import")).toBe(false);
  });
});
