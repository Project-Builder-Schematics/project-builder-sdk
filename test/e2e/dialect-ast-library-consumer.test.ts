import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratch = scratchDirFactory("dialect-library-consumer-");
const root = new URL("../../", import.meta.url).pathname;

for (const name of ["typescript", "react"] as const) {
  for (const mode of ["runtime", "types"] as const) {
    test(`${name} source package consumer uses native library ${mode} without a direct dependency`, () => {
      const dir = scratch();
      writeFileSync(join(dir, "package.json"), JSON.stringify({ private: true, type: "module", dependencies: {} }));
      writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          target: "ESNext", module: "Preserve", moduleResolution: "bundler", strict: true,
          noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true,
          types: ["node"], typeRoots: [join(root, "node_modules/@types")],
          paths: {
            [`@pbuilder/sdk/${name}`]: [join(root, `src/dialects/${name}/index.ts`)],
            "@pbuilder/sdk/testing": [join(root, "src/testing/index.ts")],
            "@pbuilder/sdk/conformance": [join(root, "src/conformance/index.ts")],
          },
        },
        files: ["consumer.ts"],
      }));
      writeFileSync(join(dir, "type-only.ts"), `export { find } from "@pbuilder/sdk/${name}";\nexport type { astLibrary } from "@pbuilder/sdk/${name}";\n`);
      writeFileSync(join(dir, "consumer.ts"), `
import * as dialect from "@pbuilder/sdk/${name}";
import type { astLibrary } from "@pbuilder/sdk/${name}";
import type { DialectModule } from "@pbuilder/sdk/conformance";
import * as typeOnly from "./type-only.ts";
import { runFactoryForTest } from "@pbuilder/sdk/testing";
const conforming: DialectModule<typeof dialect.astLibrary> = dialect;
void conforming;
// @ts-expect-error — erased namespaces cannot satisfy the runtime module contract.
const erased: DialectModule<typeof dialect.astLibrary> = typeOnly;
void erased;
const path = "source.${name === "react" ? "tsx" : "ts"}";
const result = await runFactoryForTest(async () => {
  await dialect.find(path).addImport("join", "node:path").modify(function (ast) {
    if (arguments.length !== 1) throw new Error("callback arity changed");
    if (!("astLibrary" in dialect)) throw new Error("native library unavailable");
    const library = dialect.astLibrary;
    const file: astLibrary.SourceFile = ast;
    if (!(file instanceof library.SourceFile) || !library.Node.isSourceFile(file)) {
      throw new Error("incompatible library");
    }
    const structure: astLibrary.VariableStatementStructure = {
      kind: library.StructureKind.VariableStatement,
      declarationKind: library.VariableDeclarationKind.Const,
      declarations: [{ name: "answer", initializer: "42" }],
    };
    file.addVariableStatement(structure);
  });
}, undefined, { seed: { [path]: "// keep\\n" } });
if (result.error !== undefined) throw result.error;
console.log(JSON.stringify([...result.tree]));
`);
      const result = mode === "runtime"
        ? spawnSync("bun", ["run", "consumer.ts"], { cwd: dir, encoding: "utf8" })
        : spawnSync(join(root, "node_modules/.bin/tsc"), ["--noEmit", "-p", join(dir, "tsconfig.json")], { cwd: dir, encoding: "utf8" });
      expect({ status: result.status, stderr: result.stderr, stdout: result.stdout }).toEqual({
        status: 0, stderr: "",
        stdout: mode === "runtime" ? JSON.stringify([[`source.${name === "react" ? "tsx" : "ts"}`, 'import { join } from "node:path";\n\n// keep\nconst answer = 42;\n']]) + "\n" : "",
      });
    });
  }
}
