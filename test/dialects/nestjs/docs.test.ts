import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../support/jsdoc-scan.ts";
import { extractSection } from "../../support/markdown-section.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/nestjs-dialect.md"), "utf-8");
const readme = readFileSync(join(PROJECT_ROOT, "README.md"), "utf-8");

const SIGNATURES = [
  "addProvider(name, from)",
  "addController(name, from)",
  "addModuleImport(name, from)",
  "addExport(name, from)",
];

describe("docs/nestjs-dialect.md — author guide", () => {
  it.each(SIGNATURES)("documents %s under its own heading", (signature) => {
    expect(() => extractSection(doc, `### \`${signature}\``)).not.toThrow();
  });

  it("documents the inherited TypeScript ops, format preservation, rejections, and the escape hatch", () => {
    expect(doc).toContain("@pbuilder/sdk/typescript");
    expect(extractSection(doc, "## Format preservation")).toContain("byte-identical");
    expect(extractSection(doc, "## Rejections")).toContain("the file is left unchanged");
    const hatch = extractSection(doc, "## The escape hatch");
    expect(hatch).toContain(".modify(");
    expect(hatch).toContain("astLibrary");
  });

  it("the README has a section linking the guide", () => {
    const section = extractSection(readme, "### `@pbuilder/sdk/nestjs`");
    expect(section).toContain("./docs/nestjs-dialect.md");
  });
});
