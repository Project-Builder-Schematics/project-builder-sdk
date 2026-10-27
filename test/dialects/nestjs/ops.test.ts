import { describe, it, expect } from "bun:test";
import * as nestjs from "../../../src/dialects/nestjs/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

const PATH = "app.module.ts";

async function edit(seed: string, run: () => PromiseLike<void>): Promise<string | undefined> {
  const { client, emitted } = makeSpyClient({ [PATH]: seed });
  await defineFactory<void>(async () => {
    await run();
  })(undefined, { client });
  const modifies = collectModifies(emitted);
  expect(modifies.length).toBeLessThanOrEqual(1);
  return modifies[0]?.modify.content;
}

async function expectReject(seed: string, run: () => PromiseLike<void>): Promise<Error> {
  const { client, emitted } = makeSpyClient({ [PATH]: seed });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await run();
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(collectModifies(emitted)).toHaveLength(0);
  expect(await client.read(PATH)).toBe(seed);
  return caught as Error;
}

const MODULE = [
  'import { Module } from "@nestjs/common";',
  'import { AppService } from "./app.service";',
  "",
  "@Module({",
  "  imports: [],",
  "  providers: [AppService],",
  "})",
  "export class AppModule {}",
  "",
].join("\n");

describe("nestjs @Module ops", () => {
  it("addProvider imports the class and appends it to a one-line providers array", async () => {
    const content = await edit(MODULE, () => nestjs.find(PATH).addProvider("UsersService", "./users/users.service"));
    expect(content).toBe(
      [
        'import { Module } from "@nestjs/common";',
        'import { AppService } from "./app.service";',
        'import { UsersService } from "./users/users.service";',
        "",
        "@Module({",
        "  imports: [],",
        "  providers: [AppService, UsersService],",
        "})",
        "export class AppModule {}",
        "",
      ].join("\n")
    );
  });

  it("addController adds a missing property on its own line, keeping the trailing comma", async () => {
    const content = await edit(MODULE, () => nestjs.find(PATH).addController("UsersController", "./users/users.controller"));
    expect(content).toContain("  providers: [AppService],\n  controllers: [UsersController],\n})");
  });

  it("addModuleImport fills an empty imports array", async () => {
    const content = await edit(MODULE, () => nestjs.find(PATH).addModuleImport("UsersModule", "./users/users.module"));
    expect(content).toContain("  imports: [UsersModule],\n");
    expect(content).toContain('import { UsersModule } from "./users/users.module";');
  });

  it("addExport adds an exports array to a one-line metadata object", async () => {
    const seed = 'import { A } from "./a";\n\n@Module({ providers: [A] })\nexport class M {}\n';
    const content = await edit(seed, () => nestjs.find(PATH).addExport("A", "./a"));
    expect(content).toBe('import { A } from "./a";\n\n@Module({ providers: [A], exports: [A] })\nexport class M {}\n');
  });

  it("creates the metadata object when @Module() has no argument", async () => {
    const content = await edit("@Module()\nexport class M {}\n", () => nestjs.find(PATH).addProvider("A", "./a"));
    expect(content).toBe('import { A } from "./a";\n\n@Module({ providers: [A] })\nexport class M {}\n');
  });

  it("fills an empty metadata object", async () => {
    const content = await edit("@Module({})\nexport class M {}\n", () => nestjs.find(PATH).addProvider("A", "./a"));
    expect(content).toContain("@Module({ providers: [A] })\n");
  });

  it("appends to a multi-line array at the entries' indentation, keeping the trailing comma", async () => {
    const seed = '@Module({\n  providers: [\n    A,\n    B,\n  ],\n})\nexport class M {}\n';
    const content = await edit(seed, () => nestjs.find(PATH).addProvider("C", "./c"));
    expect(content).toContain("  providers: [\n    A,\n    B,\n    C,\n  ],\n");
  });

  it("appends to a multi-line array without a trailing comma", async () => {
    const seed = "@Module({\n  providers: [\n    A,\n    B\n  ]\n})\nexport class M {}\n";
    const content = await edit(seed, () => nestjs.find(PATH).addProvider("C", "./c"));
    expect(content).toContain("  providers: [\n    A,\n    B,\n    C\n  ]\n");
  });

  it("is a no-op when the entry and its import already exist", async () => {
    const content = await edit(MODULE, () => nestjs.find(PATH).addProvider("AppService", "./app.service"));
    expect(content).toBeUndefined();
  });

  it("adds only the import when the entry is already listed", async () => {
    const seed = "@Module({ providers: [A] })\nexport class M {}\n";
    const content = await edit(seed, () => nestjs.find(PATH).addProvider("A", "./a"));
    expect(content).toBe('import { A } from "./a";\n\n@Module({ providers: [A] })\nexport class M {}\n');
  });

  it("produces the output shown in find()'s @example", async () => {
    const seed = "@Module({ providers: [AppService] })\nexport class AppModule {}\n";
    const content = await edit(seed, () =>
      nestjs
        .find(PATH)
        .addModuleImport("UsersModule", "./users/users.module")
        .addProvider("UsersService", "./users/users.service")
    );
    expect(content).toBe(
      [
        'import { UsersModule } from "./users/users.module";',
        'import { UsersService } from "./users/users.service";',
        "",
        "@Module({ providers: [AppService, UsersService], imports: [UsersModule] })",
        "export class AppModule {}",
        "",
      ].join("\n")
    );
  });

  it("chains with the inherited TypeScript ops on one handle", async () => {
    const content = await edit("@Module({})\nexport class M {}\n", () =>
      nestjs.find(PATH).addProvider("A", "./a").addVariable("TOKEN", '"token"', { export: true })
    );
    expect(content).toContain("@Module({ providers: [A] })");
    expect(content).toContain('export const TOKEN = "token";');
  });
});

describe("nestjs @Module ops — rejections leave the file unchanged", () => {
  it("rejects a file without a @Module class", async () => {
    const err = await expectReject("export class M {}\n", () => nestjs.find(PATH).addProvider("A", "./a"));
    expect(err.message).toContain('addProvider("A") on "app.module.ts" — no class decorated with @Module was found');
  });

  it("rejects a file with two @Module classes", async () => {
    const seed = "@Module({})\nclass A {}\n@Module({})\nclass B {}\n";
    const err = await expectReject(seed, () => nestjs.find(PATH).addController("C", "./c"));
    expect(err.message).toContain("2 classes are decorated with @Module; exactly one is required");
  });

  it("rejects a metadata argument that is not an object literal", async () => {
    const err = await expectReject("@Module(METADATA)\nexport class M {}\n", () => nestjs.find(PATH).addExport("A", "./a"));
    expect(err.message).toContain("the @Module argument is not an object literal");
  });

  it("rejects a property that is not an array literal", async () => {
    const seed = "@Module({ providers: PROVIDERS })\nexport class M {}\n";
    const err = await expectReject(seed, () => nestjs.find(PATH).addProvider("A", "./a"));
    expect(err.message).toContain('@Module "providers" is not an array literal');
  });

  it("rejects a name already bound from another module, through the inherited addImport rule", async () => {
    const seed = 'import { A } from "./other";\n\n@Module({})\nexport class M {}\n';
    const err = await expectReject(seed, () => nestjs.find(PATH).addProvider("A", "./a"));
    expect(err.message).toContain('a value or import binding named "A" already exists');
  });

  it("rejects an invalid name before touching the file", async () => {
    await expectReject("@Module({})\nexport class M {}\n", () => nestjs.find(PATH).addModuleImport("A] , evil(", "./a"));
  });
});
