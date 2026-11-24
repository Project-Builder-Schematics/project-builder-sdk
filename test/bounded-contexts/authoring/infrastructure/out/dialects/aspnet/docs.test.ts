import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../../../../../support/jsdoc-scan.ts";
import { extractSection } from "../../../../../../support/markdown-section.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/guides/aspnet-dialect.md"), "utf-8");

describe("docs/guides/aspnet-dialect.md — author guide", () => {
  it("documents addService, both places it edits, and its rejections", () => {
    const op = extractSection(doc, "### `addService(lifetime, service, implementation, { serviceFrom?, implementationFrom?, method? })`");
    expect(op).toContain("CreateBuilder");
    expect(op).toContain("this IServiceCollection");
    expect(extractSection(doc, "## Rejections")).toContain("another lifetime");
  });
});
