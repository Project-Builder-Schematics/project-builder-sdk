import { describe, it, expect } from "bun:test";
import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps } from "../../src/core/define-dialect.ts";
import { parse, print } from "../../src/dialects/typescript/ast.ts";
import { typescriptOps } from "../../src/dialects/typescript/pack.ts";
import type { ArrayElement } from "../../src/dialects/typescript/array-element.ts";
import { addComponentImport, addComponentProvider, addRootProvider, type NamedImport } from "../../src/dialects/angular/ops.ts";
import { testDialect, testOpPack, type OpPackFixture } from "../../src/conformance/index.ts";
import { DIALECT_MODULES } from "../support/dialect-modules.ts";

type InsertOp = (ast: SourceFile, element: ArrayElement, imports?: readonly NamedImport[]) => void;
type AngularOps = Record<"addComponentImport" | "addComponentProvider" | "addRootProvider", InsertOp>;

const angularOps = defineOpPack<SourceFile, AngularOps>({ addComponentImport, addComponentProvider, addRootProvider });
const baseDialect = defineDialect({ extensions: [".ts"], ast: { parse, print }, ops: {} });
const realAngularDialect = withOps(baseDialect, typescriptOps, angularOps);
const angularModule = DIALECT_MODULES.find((m) => m.entrypoint === "src/dialects/angular/index.ts")!;

const ANGULAR_SAMPLES = [
  '@Component({\n  selector: "app-root",\n  imports: [RouterOutlet],\n  template: `<router-outlet />`,\n})\nexport class App {}\n',
  "export const appConfig: ApplicationConfig = {\n  providers: [provideRouter(routes), provideHttpClient(withFetch())],\n};\n",
  "bootstrapApplication(App, appConfig).catch((err) => console.error(err));\n",
];

describe("angular dialect conformance", () => {
  it("round-trips Angular sources byte-exact", async () => {
    await expect(testDialect({ ...angularModule, dialect: realAngularDialect, samples: ANGULAR_SAMPLES })).resolves.toBeUndefined();
  });

  it("the Angular op pack coalesces with an inherited TypeScript op", async () => {
    const fixture: OpPackFixture = {
      opPack: angularOps,
      baseDialect: realAngularDialect,
      exercises: [
        {
          seed: "@Component({})\nexport class C {}\n",
          chain: [
            { op: "addComponentImport", args: ["RouterOutlet", [{ name: "RouterOutlet", from: "@angular/router" }]] },
            { op: "addComponentProvider", args: [{ expression: "provideX()" }] },
            { op: "addImport", args: ["Component", "@angular/core"] },
          ],
          expect:
            'import { RouterOutlet } from "@angular/router";\nimport { Component } from "@angular/core";\n\n' +
            "@Component({ imports: [RouterOutlet], providers: [provideX()] })\nexport class C {}\n",
        },
      ],
    };
    await expect(testOpPack(fixture)).resolves.toBeUndefined();
  });
});
