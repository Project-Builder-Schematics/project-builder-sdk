import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../../../../../support/jsdoc-scan.ts";
import { extractSection } from "../../../../../../support/markdown-section.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/guides/msbuild-dialect.md"), "utf-8");

describe("docs/guides/msbuild-dialect.md — author guide", () => {
  it("documents addProjectReference(path) under its own heading", () => {
    expect(() => extractSection(doc, "### `addProjectReference(path)`")).not.toThrow();
  });

  it("documents the files, placement, the byte-fidelity guarantee, and the escape hatch", () => {
    const files = extractSection(doc, "## Files");
    expect(files).toContain(".slnx");
    expect(files).toContain(".sln");
    expect(extractSection(doc, "## Placement")).toContain("blank line");
    expect(extractSection(doc, "## Format preservation")).toContain("byte-identical");
    const hatch = extractSection(doc, "## The escape hatch: `.modify(fn)`");
    expect(hatch).toContain(".modify(");
    expect(hatch).toContain("astLibrary");
  });
});

describe("docs/guides/msbuild-dialect.md — addProject", () => {
  it("documents addProject, its folder option and its rejections", () => {
    const op = extractSection(doc, "### `addProject(path, { folder? })`");
    expect(op).toContain("Solution");
    expect(op).toContain("/src/");
    expect(extractSection(doc, "## Rejections")).toContain("anywhere else in the solution");
  });
});
