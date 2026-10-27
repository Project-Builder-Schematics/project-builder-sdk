import { describe, it, expect } from "bun:test";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { parse, print } from "../../src/dialects/typescript/ast.ts";
import { typescriptOps } from "../../src/dialects/typescript/pack.ts";
import { addController, addExport, addModuleImport, addProvider } from "../../src/dialects/nestjs/ops.ts";
import { testDialect, testOpPack, type OpPackFixture } from "../../src/conformance/index.ts";
import { DIALECT_MODULES } from "../support/dialect-modules.ts";

type ModuleOps = Record<"addProvider" | "addController" | "addModuleImport" | "addExport", (ast: SourceFile, name: string, from: string) => void>;

const moduleOps = defineOpPack<SourceFile, ModuleOps>({ addProvider, addController, addModuleImport, addExport });
const baseDialect = defineDialect({ extensions: [".ts"], ast: { parse, print }, ops: {} });
const realNestDialect = withOps(baseDialect, typescriptOps, moduleOps);
const nestModule = DIALECT_MODULES.find((m) => m.entrypoint === "src/dialects/nestjs/index.ts")!;

const MODULE_SAMPLES = [
  "@Module()\nexport class M {}\n",
  '@Module({\n  imports: [ConfigModule.forRoot({ isGlobal: true })],\n  providers: [{ provide: TOKEN, useValue: 1 }],\n})\nexport class M {}\n',
  "@Global()\n@Module({ exports: [A] })\nexport class M {\n  constructor(private readonly a: A) {}\n}\n",
];

describe("nestjs dialect conformance", () => {
  it("round-trips Nest module sources byte-exact", async () => {
    await expect(testDialect({ ...nestModule, dialect: realNestDialect, samples: MODULE_SAMPLES })).resolves.toBeUndefined();
  });

  it("the @Module op pack coalesces with an inherited TypeScript op", async () => {
    const fixture: OpPackFixture = {
      opPack: moduleOps,
      baseDialect: realNestDialect,
      exercises: [
        {
          seed: "@Module({})\nexport class M {}\n",
          chain: [
            { op: "addController", args: ["C", "./c"] },
            { op: "addExport", args: ["S", "./s"] },
            { op: "addImport", args: ["Module", "@nestjs/common"] },
          ],
          expect:
            'import { C } from "./c";\nimport { S } from "./s";\nimport { Module } from "@nestjs/common";\n\n' +
            "@Module({ controllers: [C], exports: [S] })\nexport class M {}\n",
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});
