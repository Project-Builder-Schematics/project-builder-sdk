/**
 * S-002 — REQ-MC-03: the dialect's read-through-parse routes through Session.read ONLY,
 * never a direct EngineClient call. A static scan over `src/dialects/typescript/**`'s
 * source text for any `EngineClient` reference (import or symbol) — dialect code has no
 * legitimate reason to name that type at all, since every read goes through
 * `core/dialect-handle.ts`'s own `Session.read` delegation (kit-internal, outside this
 * scanned tree).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIALECT_ROOT = new URL("../../../src/dialects/typescript/", import.meta.url).pathname;
const RED_FIXTURE = new URL(
  "../../fixtures/red/dialect-typescript/direct-engine-read.ts",
  import.meta.url
).pathname;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(dir, entry.name));
}

// Strips `//` line comments and `/* */` block comments (incl. JSDoc) before scanning — a
// prose mention of "EngineClient" in a doc comment (e.g. explaining what is NOT imported)
// must not itself trip the scan (mirrors FIT-01's comment-stripping fix, apply-progress
// batch 1).
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function findEngineClientReferences(source: string): string[] {
  const violations: string[] = [];
  if (/\bEngineClient\b/.test(stripComments(source))) {
    violations.push("EngineClient referenced");
  }
  return violations;
}

describe("real dialect — REQ-MC-03: no direct EngineClient.read in dialect code", () => {
  it("REQ-MC-03.1: src/dialects/typescript/** has zero EngineClient references outside core/session.ts's own delegation", () => {
    const files = listSourceFiles(DIALECT_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf-8");
      return findEngineClientReferences(source).map((v) => `${file}: ${v}`);
    });
    expect(violations).toEqual([]);
  });

  // RED-PROOF (REQ-MC-03.2): a planted fixture calling EngineClient.read directly, quarantined
  // under test/fixtures/red/ — never part of the green suite — turns the scan RED.
  it("[red-proof] REQ-MC-03.2: a planted direct-EngineClient.read fixture fails the scan", () => {
    const source = readFileSync(RED_FIXTURE, "utf-8");
    const violations = findEngineClientReferences(source);
    expect(violations.length).toBeGreaterThan(0);
  });
});
