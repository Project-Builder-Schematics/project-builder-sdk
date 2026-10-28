import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../../support/jsdoc-scan.ts";
import { extractSection } from "../../support/markdown-section.ts";

const doc = readFileSync(join(PROJECT_ROOT, "docs/angular-dialect.md"), "utf-8");
const readme = readFileSync(join(PROJECT_ROOT, "README.md"), "utf-8");

const SIGNATURES = [
  "addComponentImport(element, imports?)",
  "addComponentProvider(element, imports?)",
  "addRootProvider(element, imports?)",
  "addRoute({ path, component, from })",
  "addLazyRoute({ path, loadComponent | loadChildren, export? })",
  "addInjection(name, token, options?)",
  "addInput(name, options?)",
  "addModel(name, options?)",
  "addOutput(name, options?)",
  "addSignal(name, initial, options?)",
  "addComputed(name, expression, options?)",
];

const NGMODULE_OPS = ["addNgModuleImport", "addDeclaration", "addNgModuleProvider", "addNgModuleExport", "addBootstrap"];

describe("docs/angular-dialect.md — author guide", () => {
  it.each(SIGNATURES)("documents %s under its own heading", (signature) => {
    expect(() => extractSection(doc, `### \`${signature}\``)).not.toThrow();
  });

  it("documents the inherited TypeScript ops, route ordering, format preservation, rejections, and the escape hatch", () => {
    expect(doc).toContain("@pbuilder/sdk/typescript");
    expect(extractSection(doc, "## Routes")).toContain('{ path: "**" }');
    expect(extractSection(doc, "## Format preservation")).toContain("byte-identical");
    expect(extractSection(doc, "## Rejections")).toContain("the file is left unchanged");
    const hatch = extractSection(doc, "## The escape hatch");
    expect(hatch).toContain(".modify(");
    expect(hatch).toContain("astLibrary");
  });

  it.each(NGMODULE_OPS)("lists %s in the NgModule section", (op) => {
    expect(extractSection(doc, "## NgModule")).toContain(`\`${op}(element, imports?)\``);
  });

  it("the README has a section linking the guide", () => {
    const section = extractSection(readme, "### `@pbuilder/sdk/angular`");
    expect(section).toContain("./docs/angular-dialect.md");
  });
});
