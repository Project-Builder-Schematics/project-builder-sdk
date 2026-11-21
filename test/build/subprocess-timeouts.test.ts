/**
 * A test that starts a process gets bun's 5000 ms default unless it declares its own timeout,
 * and a cold machine can start a process slower than that (#170). Every `it`/`test` whose body
 * reaches a spawn, directly or through a helper in its file or in test/support, declares one.
 * The global default is not raised.
 */
import { describe, it, expect } from "bun:test";
import { Project, SyntaxKind, Node, type SourceFile } from "ts-morph";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
// A bare spawn call (never a method such as `RegExp#exec`), `Bun.spawn`, or a bun shell template.
const SPAWN = /(?<![.\w])(spawnSync|execFileSync|execSync|execFile|exec|spawn)\s*\(|Bun\.spawn(Sync)?\s*\(|(?<![\w.])\$`/;

const calls = (names: Iterable<string>, text: string) => [...names].some((name) => new RegExp(`\\b${name}\\s*\\(`).test(text));

/** The names in `file` that start a process when called: local functions and imported test helpers. */
function spawningNames(file: SourceFile): Set<string> {
  const names = new Set<string>();
  const bodies = new Map<string, string>();
  for (const fn of file.getFunctions()) if (fn.getName() !== undefined) bodies.set(fn.getName()!, fn.getText());
  for (const variable of file.getVariableDeclarations()) {
    const init = variable.getInitializer();
    if (init !== undefined && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) bodies.set(variable.getName(), init.getText());
  }
  for (const declaration of file.getImportDeclarations()) {
    const target = declaration.getModuleSpecifierSourceFile();
    if (target === undefined || !target.getFilePath().includes("/test/")) continue;
    for (const named of declaration.getNamedImports()) {
      const decl = target.getFunction(named.getName()) ?? target.getVariableDeclaration(named.getName());
      if (decl !== undefined && SPAWN.test(decl.getText())) names.add(named.getAliasNode()?.getText() ?? named.getName());
    }
  }
  for (let grew = true; grew; ) {
    grew = false;
    for (const [name, body] of bodies) {
      if (!names.has(name) && (SPAWN.test(body) || calls(names, body))) {
        names.add(name);
        grew = true;
      }
    }
  }
  return names;
}

/** `path:line` of every test in `files` that reaches a spawn and declares no timeout. */
export function untimedSpawningTests(files: SourceFile[]): string[] {
  return files.flatMap((file) => {
    const names = spawningNames(file);
    return file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => ["it", "test"].includes(call.getExpression().getText()) && call.getArguments().length === 2)
      .filter((call) => {
        const body = call.getArguments()[1]!;
        return (Node.isArrowFunction(body) || Node.isFunctionExpression(body)) && (SPAWN.test(body.getText()) || calls(names, body.getText()));
      })
      .map((call) => `${file.getFilePath().slice(PROJECT_ROOT.length)}:${call.getStartLineNumber()}`);
  });
}

describe("tests that start a process declare their own timeout", () => {
  it("every one in test/", () => {
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    project.addSourceFilesAtPaths([`${PROJECT_ROOT}test/**/*.ts`, `!${PROJECT_ROOT}test/build/subprocess-timeouts.test.ts`, `!${PROJECT_ROOT}test/build/single-build-owner.test.ts`]);
    expect(untimedSpawningTests(project.getSourceFiles())).toEqual([]);
  }, 30_000);

  it("[red-proof] flags a spawning test without a timeout, directly and through a helper, and passes one with it", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      `${PROJECT_ROOT}test/x.test.ts`,
      [
        'const run = () => spawnSync("bun", []);',
        'it("direct", () => { spawnSync("git", []); });',
        'it("helper", () => { run(); });',
        'it("timed", () => { run(); }, 30_000);',
        'it("method", () => { /a/.exec("a"); });',
      ].join("\n")
    );
    expect(untimedSpawningTests([file])).toEqual(["test/x.test.ts:2", "test/x.test.ts:3"]);
  });
});
