/**
 * FIT-21 (F2 guard, ADR-0037 amendment): dependency-direction guard for the poison flag.
 * `RunContext.runFailure` (src/core/context.ts) is read/written by dialect-handle.ts via
 * `currentContext()` — the one-way edge (dialect-handle.ts -> context.ts) must never
 * reverse. A static import-scan asserts context.ts takes NO import from dialect-handle.ts.
 *
 * Mirrors FIT-15's resolved-path idiom (never a textual substring check, which would
 * false-positive on identifiers merely containing "dialect-handle").
 *
 * Red-proof: a planted fixture importing dialect-handle.ts from a context.ts-shaped module
 * is caught by the scanner.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const CORE_DIR = new URL("../../src/core", import.meta.url).pathname;
const CONTEXT_FILE = join(CORE_DIR, "context.ts");
const DIALECT_HANDLE_FILE = join(CORE_DIR, "dialect-handle.ts");

const IMPORT_SPECIFIER_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

// Resolves every relative import specifier in `source` (as if it lived in `fromDir`) and
// returns those resolving exactly onto `targetFile`.
function specifiersResolvingTo(source: string, fromDir: string, targetFile: string): string[] {
  const offenders: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    const specifier = match[1]!;
    if (!specifier.startsWith(".")) continue; // bare/package specifiers can never reach it
    const resolved = resolve(fromDir, specifier);
    // Import specifiers omit the extension; compare the extensionless form too.
    if (resolved === targetFile || resolved === targetFile.replace(/\.ts$/, "")) {
      offenders.push(specifier);
    }
  }
  return offenders;
}

describe("FIT-21 — context.ts takes no import from dialect-handle.ts (F2 guard)", () => {
  it("src/core/context.ts does not import src/core/dialect-handle.ts", () => {
    const source = readFileSync(CONTEXT_FILE, "utf-8");
    const offenders = specifiersResolvingTo(source, dirname(CONTEXT_FILE), DIALECT_HANDLE_FILE);
    expect(offenders).toEqual([]);
  });

  // RED-PROOF: a fixture context.ts-shaped module importing dialect-handle.ts is caught.
  it("[red-proof] a simulated context.ts importing dialect-handle.ts is detected", () => {
    const fakeSource = `import { createDialectHandle } from "./dialect-handle.ts";`;
    const offenders = specifiersResolvingTo(fakeSource, CORE_DIR, DIALECT_HANDLE_FILE);
    expect(offenders).toEqual(["./dialect-handle.ts"]);
  });

  // RED-PROOF: an unrelated core import is never flagged (no false positive).
  it("[red-proof] an unrelated relative import is NOT flagged", () => {
    const fakeSource = `import { Session } from "./session.ts";`;
    const offenders = specifiersResolvingTo(fakeSource, CORE_DIR, DIALECT_HANDLE_FILE);
    expect(offenders).toEqual([]);
  });

  // RED-PROOF: a bare specifier merely containing the substring is never flagged.
  it("[red-proof] a bare specifier containing the substring 'dialect-handle' is NOT flagged", () => {
    const fakeSource = `import { x } from "some-package/dialect-handle-lookalike.js";`;
    const offenders = specifiersResolvingTo(fakeSource, CORE_DIR, DIALECT_HANDLE_FILE);
    expect(offenders).toEqual([]);
  });
});
