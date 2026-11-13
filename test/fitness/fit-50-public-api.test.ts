/**
 * fit-50 (S0b, P-API): the published API of every `exports` subpath, path-independent, is
 * byte-identical to test/fitness/public-api-snapshot.txt. The layout migration moves files
 * without changing the API (CODE-LAYOUT:138; Q2's binding condition), so any diff here is an
 * API change. Rewrite the snapshot with FIT50_WRITE_SNAPSHOT=1 only for an intended change.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Project, ts } from "ts-morph";
import { describeEntries, entryProject } from "../support/public-api.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const SNAPSHOT = join(ROOT, "test/fitness/public-api-snapshot.txt");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as { exports: Record<string, { import: string }> };
const ENTRIES = Object.entries(PKG.exports).map(([subpath, t]) => [subpath, join(ROOT, t.import.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts"))] as const);

describe("fit-50 — P-API: the public API of every exports subpath", () => {
  const { text, descendedFiles } = describeEntries(entryProject(join(ROOT, "tsconfig.json"), ENTRIES.map(([, f]) => f)), ENTRIES);

  it("matches public-api-snapshot.txt", () => {
    if (process.env.FIT50_WRITE_SNAPSHOT === "1") writeFileSync(SNAPSHOT, text);
    expect(text.split("\n").length).toBeGreaterThan(80);
    expect(text).not.toContain(ROOT);
    expect(text).toEqual(readFileSync(SNAPSHOT, "utf-8"));
  });

  it("the type walk expands only the SDK's own sources, never node_modules or lib types", () => {
    expect(descendedFiles.size).toBeGreaterThan(10);
    expect([...descendedFiles].filter((f) => !f.startsWith(join(ROOT, "src/")))).toEqual([]);
  });
});

function inMemory(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true, noEmit: true },
  });
  for (const [path, text] of Object.entries(files)) project.createSourceFile(path, text);
  return project;
}

const entry = (dir: string): string => `export { make, type Shape } from "./${dir}/shape.ts";\n`;
const shape = (ret: string): string =>
  `interface Internal { size: ${ret} }\nexport interface Shape { name: string; inner: Internal }\nexport function make(n: string): Internal { return { size: 1 as ${ret} }; }\n`;

describe("fit-50 — [red-proof] P-API ignores moves and catches API changes", () => {
  const describeIndex = (files: Record<string, string>): string => describeEntries(inMemory(files), [[".", "/pkg/index.ts"]]).text;
  const before = describeIndex({ "/pkg/index.ts": entry("core"), "/pkg/core/shape.ts": shape("number") });

  it("moving a file to another folder leaves the description unchanged", () => {
    const moved = describeIndex({ "/pkg/index.ts": entry("bounded-contexts/authoring/domain/valueobjects"), "/pkg/bounded-contexts/authoring/domain/valueobjects/shape.ts": shape("number") });
    expect(moved).toEqual(before);
  });

  it("moving a type that a barrel re-exports leaves the description unchanged", () => {
    // The checker names `Value` through the barrel or through its own file depending on the
    // relative paths, so the description must name the declaring file itself, even when
    // another SDK file declares a type of the same name.
    const barrel = (valueDir: string): Record<string, string> => ({
      "/pkg/index.ts": `export { x } from "./other.ts";\n`,
      "/pkg/other.ts": `export type Value = boolean;\nexport const x: Value = true;\n`,
      "/pkg/dialects/json/index.ts": `export type { Value } from "../../${valueDir}/value.ts";\nexport { setValue } from "./ops.ts";\n`,
      "/pkg/dialects/json/ops.ts": `import type { Value } from "../../${valueDir}/value.ts";\nexport function setValue(v: Value): void {}\n`,
      [`/pkg/${valueDir}/value.ts`]: `export type Value = string | number | Value[];\n`,
    });
    const entries: Array<[string, string]> = [[".", "/pkg/index.ts"], ["./json", "/pkg/dialects/json/index.ts"]];
    const near = describeEntries(inMemory(barrel("core")), entries).text;
    expect(near).toContain("reachable Value@value type: string | number | Value[]");
    expect(describeEntries(inMemory(barrel("bounded-contexts/authoring/domain/valueobjects")), entries).text).toEqual(near);
  });

  it("an alias the resolved type drops (`Scope | undefined`) is still pinned", () => {
    const options = (scope: string): Record<string, string> => ({
      "/pkg/index.ts": `export type { Options } from "./core/options.ts";\n`,
      "/pkg/core/options.ts": `type Scope = ${scope};\nexport interface Options { scope?: Scope }\n`,
    });
    const before = describeIndex(options(`"public" | "private"`));
    expect(before).toContain(`reachable Scope@options type: "public" | "private"`);
    expect(describeIndex(options(`"public" | "protected"`))).not.toEqual(before);
  });

  it("changing a member type of a non-exported type changes the description", () => {
    expect(describeIndex({ "/pkg/index.ts": entry("core"), "/pkg/core/shape.ts": shape("string") })).not.toEqual(before);
  });

  it("a lib type in the API (Map, Promise) contributes its type arguments but is never expanded", () => {
    const files = {
      "/pkg/index.ts": `export { load } from "./core/load.ts";\n`,
      "/pkg/core/load.ts": `interface Row { id: number }\nexport function load(): Promise<Map<string, Row>> { return Promise.resolve(new Map()); }\n`,
    };
    const { text, descendedFiles } = describeEntries(inMemory(files), [[".", "/pkg/index.ts"]]);
    expect(text).toContain("reachable Row@load interface");
    expect([...descendedFiles].sort()).toEqual(["/pkg/core/load.ts"]);
  });
});
