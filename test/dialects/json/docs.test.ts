import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../support/jsdoc-scan.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/json-dialect.md"), "utf-8");
const index = readFileSync(join(PROJECT_ROOT, "src/dialects/json/index.ts"), "utf-8");

const OPS = [
  "setValue",
  "addKey",
  "removeKey",
  "renameKey",
  "insertItem",
  "appendItem",
  "removeItem",
  "removeValue",
  "replaceItem",
  "moveItem",
  "merge",
  "updateValue",
  "moveValue",
  "copyValue",
  "sortKeys",
];

describe("docs/json-dialect.md — author guide", () => {
  it("has one heading per named op, each with an example", () => {
    for (const op of OPS) {
      const start = doc.indexOf(`### \`${op}(`);
      expect(start).toBeGreaterThan(-1);
      const next = doc.indexOf("\n#", start + 1);
      expect(doc.slice(start, next === -1 ? undefined : next)).toContain("```");
    }
  });

  it("documents the escape hatch with a jsonc-parser edit and the rejection prefix", () => {
    expect(doc).toContain("## The escape hatch: `.modify(fn)`");
    expect(doc).toContain("json.astLibrary.modify(");
    expect(doc).toContain("dialect operation failed: ");
  });

  it("find()'s @example demonstrates named ops", () => {
    expect(index).toContain("@example");
    expect(index).toContain(".setValue(");
  });
});
