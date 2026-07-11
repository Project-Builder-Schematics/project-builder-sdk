/**
 * REQ-FSP-01..04 (file: fit-18-fake-single-source-parity.test.ts — 18th fitness file, next
 * free after stage-4's FIT-16, TW-m4): `ContractFake` and its message dictionary MUST have
 * exactly ONE physical implementation each, relocated under `src/testing/` (ADR-0035).
 * `test/support/contract-fake.ts` / `test/support/rejection-messages.ts` are pure re-export
 * shims. Detection is by reference/value IDENTITY (`===`), never a behavioural diff suite —
 * a behavioural suite could pass on two independently-drifting implementations; identity
 * cannot be spoofed.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { ContractFake as RelocatedContractFake } from "../../src/testing/contract-fake.ts";
import { ContractFake as ShimContractFake } from "../support/contract-fake.ts";
import * as relocatedMessages from "../../src/testing/rejection-messages.ts";
import * as shimMessages from "../support/rejection-messages.ts";

const PROJECT_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const SCAN_ROOTS = ["src", "test", "bin"].map((dir) => join(PROJECT_ROOT, dir));

const CHARACTERISTIC_METHODS = ["emit", "read", "commit", "discard", "committedTree", "stagingTree"] as const;

interface ClassBody {
  name: string;
  body: string;
}

const CLASS_HEADER_PATTERN = /class\s+(\w+)[^{]*\{/g;

/** Extracts every `class Name { ... }` declaration's name + brace-balanced body from source. */
function extractClassBodies(source: string): ClassBody[] {
  const results: ClassBody[] = [];

  for (const match of source.matchAll(CLASS_HEADER_PATTERN)) {
    const name = match[1]!;
    const openBraceIndex = match.index! + match[0].length - 1;
    let depth = 1;
    let cursor = openBraceIndex + 1;
    while (depth > 0 && cursor < source.length) {
      const ch = source[cursor];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      cursor++;
    }
    results.push({ name, body: source.slice(openBraceIndex + 1, cursor - 1) });
  }

  return results;
}

function hasCharacteristicMethodSet(body: string): boolean {
  return CHARACTERISTIC_METHODS.every((method) => new RegExp(`\\b${method}\\s*\\(`).test(body));
}

function collectTs(dirs: string[]): string[] {
  const files: string[] = [];
  for (const dir of dirs) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        files.push(...collectTs([full]));
      } else if (extname(full) === ".ts") {
        files.push(full);
      }
    }
  }
  return files;
}

function toRelPath(filePath: string): string {
  return filePath.replace(PROJECT_ROOT, "").replace(/^\//, "");
}

/**
 * Detects a shim regression: fails if `shimExport` is not the IDENTICAL reference/value as
 * `sourceExport` (REQ-FSP-04). Reused for both the real shim paths and the red-proof fixture.
 */
function checkReExportIdentity(label: string, shimExport: unknown, sourceExport: unknown): string[] {
  if (shimExport === sourceExport) {
    return [];
  }
  return [`${label}: shim's export is not the identical reference as the relocated source — re-export regressed into a structural copy`];
}

describe("REQ-FSP-01 — single ContractFake source", () => {
  it("REQ-FSP-01.1: exactly one class body with the characteristic method set exists, under src/testing/", () => {
    // Single, exact, documented exemption (mirrors FIT-10's ALLOW_LISTED_PATH precedent):
    // this spec file's OWN fixture template-literal strings (below) textually contain
    // "class X { ... }" bodies for triangulation — a regex-based scan can't distinguish
    // string-literal content from real declarations, so this file's own path is excluded
    // from the scan it defines. No other file under SCAN_ROOTS needs this treatment.
    const files = collectTs(SCAN_ROOTS).filter((filePath) => filePath !== import.meta.path);
    const matches: Array<{ relPath: string; className: string }> = [];

    for (const filePath of files) {
      const source = readFileSync(filePath, "utf-8");
      for (const { name, body } of extractClassBodies(source)) {
        if (hasCharacteristicMethodSet(body)) {
          matches.push({ relPath: toRelPath(filePath), className: name });
        }
      }
    }

    expect(matches.length).toEqual(1);
    expect(matches[0]?.relPath).toEqual("src/testing/contract-fake.ts");
    expect(matches[0]?.className).toEqual("ContractFake");
  });

  // Triangulation: proves the scan discriminates on the FULL six-method set, not a subset —
  // a class implementing only the four EngineClient port methods (e.g. this repo's own
  // `DiscardRejectingClient` test double, test/skeleton/double-fault.test.ts) must NOT match.
  it("a fixture class implementing only the 4 EngineClient port methods (no committedTree/stagingTree) does not match", () => {
    const fixtureSource = `
class PartialDouble {
  emit(batch) { return this.inner.emit(batch); }
  read(path) { return this.inner.read(path); }
  commit() { return this.inner.commit(); }
  discard() { return this.inner.discard(); }
}
`;
    const bodies = extractClassBodies(fixtureSource);
    expect(bodies.length).toEqual(1);
    expect(hasCharacteristicMethodSet(bodies[0]!.body)).toBe(false);
  });

  it("a fixture class implementing all 6 characteristic methods matches, alongside an unrelated class that doesn't", () => {
    const fixtureSource = `
class Unrelated {
  emit() {}
}
class FullFake {
  emit(batch) {}
  read(path) {}
  commit() {}
  discard() {}
  committedTree() {}
  stagingTree() {}
}
`;
    const bodies = extractClassBodies(fixtureSource);
    const matching = bodies.filter(({ body }) => hasCharacteristicMethodSet(body));
    expect(matching.length).toEqual(1);
    expect(matching[0]?.name).toEqual("FullFake");
  });
});

describe("REQ-FSP-02 — re-export shim reference identity", () => {
  it("REQ-FSP-02.1: shim and relocated export are the identical reference", () => {
    expect(ShimContractFake).toBe(RelocatedContractFake);
  });

  it("REQ-FSP-02.1: a copy-pasted duplicate class (fixture, never committed) fails the identity check", () => {
    class DuplicateContractFake {}
    expect(DuplicateContractFake as unknown).not.toBe(RelocatedContractFake);
  });
});

describe("REQ-FSP-03 — rejection-messages single source", () => {
  it("REQ-FSP-03.1: the shim's dictionary values are unchanged from the relocated source", () => {
    expect(Object.values(shimMessages)).toEqual(Object.values(relocatedMessages));
  });
});

describe("REQ-FSP-04 — fail-closed parity enforcement", () => {
  it("[permanent-fixture][red-proof] REQ-FSP-04.1: a regressed structural copy is caught", () => {
    class RedeclaredContractFake {}
    const violations = checkReExportIdentity("test/support/contract-fake.ts", RedeclaredContractFake, RelocatedContractFake);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain("test/support/contract-fake.ts");
  });

  it("the real shim passes the same identity check clean", () => {
    const violations = checkReExportIdentity("test/support/contract-fake.ts", ShimContractFake, RelocatedContractFake);
    expect(violations).toEqual([]);
  });
});
