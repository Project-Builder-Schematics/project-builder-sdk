import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../support/jsdoc-scan.ts";
import { extractSection } from "../../support/markdown-section.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/yaml-dialect.md"), "utf-8");

const SIGNATURES = [
  "setValue(path, value, options?)",
  "addKey(path, value, options?)",
  "removeKey(path, options?)",
  "renameKey(path, newKey, options?)",
  "insertItem(path, index, value, options?)",
  "appendItem(path, value, options?)",
  "removeItem(path, index, options?)",
  "removeValue(path, value, options?)",
  "replaceItem(path, index, value, options?)",
  "moveItem(path, from, to, options?)",
  "merge(path, value, options?)",
  "updateValue(path, fn, options?)",
  "setComment(path, comment, options?)",
  "removeComment(path, options?)",
  "setAnchor(path, name, options?)",
  "removeAnchor(path, options?)",
  "setAlias(path, anchor, options?)",
  "addMergeKey(path, anchor, options?)",
  "setStyle(path, style, options?)",
  "addDocument(value, options?)",
  "removeDocument(index)",
  "moveValue(from, to, options?)",
  "copyValue(from, to, options?)",
  "sortKeys(path, options?)",
  "setTag(path, tag, options?)",
];

describe("docs/yaml-dialect.md — author guide", () => {
  it.each(SIGNATURES)("documents %s under its own heading", (signature) => {
    expect(() => extractSection(doc, `### \`${signature}\``)).not.toThrow();
  });

  it("documents the { document } option, the byte-fidelity guarantee, and the escape hatch", () => {
    expect(doc).toContain("{ document?: number }");
    expect(extractSection(doc, "## Format preservation")).toContain("byte-identical");
    const hatch = extractSection(doc, "## The escape hatch");
    expect(hatch).toContain(".modify(");
    expect(hatch).toContain("astLibrary");
  });
});
