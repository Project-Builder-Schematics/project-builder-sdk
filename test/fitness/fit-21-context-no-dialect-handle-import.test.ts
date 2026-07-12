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
import { join, dirname } from "node:path";
import { specifiersResolvingInto } from "../support/import-scan.ts";

const CORE_DIR = new URL("../../src/core", import.meta.url).pathname;
const CONTEXT_FILE = join(CORE_DIR, "context.ts");
const DIALECT_HANDLE_FILE = join(CORE_DIR, "dialect-handle.ts");

describe("FIT-21 — context.ts takes no import from dialect-handle.ts (F2 guard)", () => {
  it("src/core/context.ts does not import src/core/dialect-handle.ts", () => {
    const source = readFileSync(CONTEXT_FILE, "utf-8");
    const offenders = specifiersResolvingInto(source, dirname(CONTEXT_FILE), DIALECT_HANDLE_FILE);
    expect(offenders).toEqual([]);
  });

  // RED-PROOF: a fixture context.ts-shaped module importing dialect-handle.ts is caught.
  it("[red-proof] a simulated context.ts importing dialect-handle.ts is detected", () => {
    const fakeSource = `import { createDialectHandle } from "./dialect-handle.ts";`;
    const offenders = specifiersResolvingInto(fakeSource, CORE_DIR, DIALECT_HANDLE_FILE);
    expect(offenders).toEqual(["./dialect-handle.ts"]);
  });

  // RED-PROOF: an unrelated core import is never flagged (no false positive).
  it("[red-proof] an unrelated relative import is NOT flagged", () => {
    const fakeSource = `import { Session } from "./session.ts";`;
    const offenders = specifiersResolvingInto(fakeSource, CORE_DIR, DIALECT_HANDLE_FILE);
    expect(offenders).toEqual([]);
  });

  // RED-PROOF: a bare specifier merely containing the substring is never flagged.
  it("[red-proof] a bare specifier containing the substring 'dialect-handle' is NOT flagged", () => {
    const fakeSource = `import { x } from "some-package/dialect-handle-lookalike.js";`;
    const offenders = specifiersResolvingInto(fakeSource, CORE_DIR, DIALECT_HANDLE_FILE);
    expect(offenders).toEqual([]);
  });
});
