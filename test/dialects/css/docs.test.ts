import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../support/jsdoc-scan.ts";
import { extractSection } from "../../support/markdown-section.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/css-dialect.md"), "utf-8");

describe("docs/css-dialect.md — author guide", () => {
  it.each(["setDeclaration(target, property, value, options?)", "removeDeclaration(target, property)"])(
    "documents %s under its own heading",
    (signature) => {
      expect(() => extractSection(doc, `### \`${signature}\``)).not.toThrow();
    }
  );

  it("documents targets, placement, the byte-fidelity guarantee, and the escape hatch", () => {
    expect(extractSection(doc, "## Targets")).toContain("{ atRule: \"theme\" }");
    expect(extractSection(doc, "## Placement")).toContain("end of the file");
    expect(extractSection(doc, "## Format preservation")).toContain("byte-identical");
    const hatch = extractSection(doc, "## The escape hatch: `.modify(fn)` and reading values");
    expect(hatch).toContain(".modify(");
    expect(hatch).toContain("astLibrary");
  });
});
