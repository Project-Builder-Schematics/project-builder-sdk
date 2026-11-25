import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../../../../../support/jsdoc-scan.ts";
import { extractSection } from "../../../../../../support/markdown-section.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/guides/csharp-dialect.md"), "utf-8");

describe("docs/guides/csharp-dialect.md — author guide", () => {
  it.each([
    "### `addUsing(namespace, { static?, global?, alias? })`",
    "### `addBaseType(typeName, base, { from? })`",
    "### `addMember(typeName, source)`",
    "### `addConstructorParameter(typeName, name, type, { from? })`",
  ])("documents %s under its own heading", (heading) => {
    expect(() => extractSection(doc, heading)).not.toThrow();
  });

  it("documents the files, the `from` import, the layout rules and the escape hatch", () => {
    expect(extractSection(doc, "## Files")).toContain(".csx");
    expect(extractSection(doc, "## Importing with `from`")).toContain("encloses");
    expect(extractSection(doc, "## Format preservation")).toContain(".editorconfig");
    const hatch = extractSection(doc, "## The escape hatch: `.modify(fn)`");
    expect(hatch).toContain("astLibrary");
    expect(hatch).toContain("language");
  });
});
