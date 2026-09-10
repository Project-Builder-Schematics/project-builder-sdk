import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { scratchDirFactory } from "../support/scratch-dir.ts";
import type { Dialect } from "../../src/core/define-dialect.ts";
import type { DialectModule } from "../../src/conformance/index.ts";
import { testDialect } from "../../src/conformance/index.ts";
import { DIALECT_MODULES } from "../support/dialect-modules.ts";

const fixture = { ...DIALECT_MODULES[0], samples: [...DIALECT_MODULES[0].samples] };
const scratch = scratchDirFactory("dialect-module-");

test("native type-only namespaces are erased and cannot satisfy runtime conformance", async () => {
  const dir = scratch();
  const source = new URL("../../src/dialects/typescript/index.ts", import.meta.url).href;
  const path = join(dir, "type-only.ts");
  writeFileSync(path, `export { find } from ${JSON.stringify(source)};\nexport type * as astLibrary from "ts-morph";\n`);
  const module = await import(pathToFileURL(path).href);
  await expect(testDialect({ ...fixture, module })).rejects.toThrow(/runtime astLibrary/);
});

test("independent nominal libraries work with their own ASTs without cross-origin identity", async () => {
  const dir = scratch();
  const core = new URL("../../src/core/define-dialect.ts", import.meta.url).href;
  for (const name of ["first", "second"]) {
    writeFileSync(join(dir, `${name}-library.ts`), `
export class Document {
  #text: string;
  constructor(text: string) { this.#text = text; }
  print() { return this.#text; }
  append(text: string) { this.#text += text; }
}
export function append(ast: Document, text: string) { ast.append(text); }
`);
    writeFileSync(join(dir, `${name}-adapter.ts`), `
import { Document } from "./${name}-library.ts";
import { defineDialect } from ${JSON.stringify(core)};
export const dialect = defineDialect({ extensions: [".text"], ops: {},
  ast: { parse: (source: string) => new Document(source), print: (ast: Document) => ast.print() } });
export const find = dialect.find;
`);
    writeFileSync(join(dir, `${name}.ts`), `export { find } from "./${name}-adapter.ts";\nexport * as astLibrary from "./${name}-library.ts";\n`);
    const module: DialectModule<typeof expectedAstLibrary> = await import(pathToFileURL(join(dir, `${name}.ts`)).href);
    const { dialect }: { dialect: Dialect } = await import(pathToFileURL(join(dir, `${name}-adapter.ts`)).href);
    const expectedAstLibrary: { Document: new (text: string) => { print(): string }; append(ast: unknown, text: string): void } =
      await import(pathToFileURL(join(dir, `${name}-library.ts`)).href);
    let output = "";
    await testDialect({
      dialect, module, expectedAstLibrary, samples: ["own origin"],
      libraryExercise: {
        path: `${name}.text`, seed: "own origin", expect: "own origin edited",
        modify(ast, library) {
          if (!(ast instanceof library.Document)) throw new Error("wrong nominal origin");
          library.append(ast, " edited");
          output = ast.print();
        },
      },
    });
    expect(output).toBe("own origin edited");
  }
});

test("instance-only evidence cannot certify a dialect module", async () => {
  // @ts-expect-error — instance-only fixtures lack mandatory module evidence.
  await expect(testDialect({ dialect: fixture.dialect, samples: [] })).rejects.toThrow(/module/);
});

test("an actual entrypoint without a runtime namespace cannot qualify", async () => {
  const missing = { ...fixture, module: { find: fixture.module.find } };
  // @ts-expect-error — runtime JavaScript callers must also be rejected.
  await expect(testDialect(missing)).rejects.toThrow(/astLibrary/);
});

test("runtime members from the wrong library origin cannot qualify", async () => {
  const wrong = { ...fixture, module: { ...fixture.module, astLibrary: { ...fixture.expectedAstLibrary, SourceFile: class {} } } };
  // @ts-expect-error — deliberately incompatible constructor from another origin.
  await expect(testDialect(wrong)).rejects.toThrow(/library mismatch/);
});

test("the actual module.find exercise must emit the expected bytes", async () => {
  const wrongOutput = { ...fixture, libraryExercise: { ...fixture.libraryExercise, expect: "wrong\n" } };
  await expect(testDialect(wrongOutput)).rejects.toThrow(/exercise/);
});

for (const entry of DIALECT_MODULES) {
  test(`${entry.entrypoint} works with its independently resolved adapter library`, async () => {
    expect(createRequire(entry.adapter).resolve(entry.specifier)).toBe(
      createRequire(new URL("../support/dialect-modules.ts", import.meta.url)).resolve(entry.specifier));
    let exercised = false;
    await testDialect({ ...entry, samples: [...entry.samples], libraryExercise: {
      ...entry.libraryExercise,
      modify(ast: unknown, library: typeof entry.expectedAstLibrary) {
        entry.libraryExercise.modify(ast, library);
        exercised = true;
      },
    } });
    expect(exercised).toBe(true);
  });
}
