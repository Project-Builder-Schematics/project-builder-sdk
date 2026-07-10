/**
 * TFO-03.3 — static parse-as-data proof over the SHIPPED bin artifact (design §4.6): no
 * `eval`, no `new Function`, no dynamic `import()`/`require()` call whose argument is not a
 * literal string. Scans `dist/bin/pbuilder-codegen.js` — the built artifact that ships in
 * the tarball — not the TypeScript source.
 *
 * Self-building via an unconditional `beforeAll` (FIT-04 precedent, slices constraint 10)
 * so a bare `bun test` on a fresh checkout stays green; no external build-then-test
 * protocol is assumed.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const DIST_BIN = join(PROJECT_ROOT, "dist/bin/pbuilder-codegen.js");

beforeAll(() => {
  const result = spawnSync("bun", ["run", "build"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `codegen-static-scan: bun run build failed — cannot scan without a fresh build.\n` +
      `stdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
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
