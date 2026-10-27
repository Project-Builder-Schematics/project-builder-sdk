import type { SourceFile } from "ts-morph";
import { defineDialect, defineOpPack, withOps, type Handle } from "../../core/define-dialect.ts";
import { parse, print } from "../typescript/ast.ts";
import { typescriptOps } from "../typescript/pack.ts";
import { addController, addExport, addModuleImport, addProvider } from "./ops.ts";

export * as astLibrary from "ts-morph";

type ModuleOps = {
  addProvider: (ast: SourceFile, name: string, from: string) => void;
  addController: (ast: SourceFile, name: string, from: string) => void;
  addModuleImport: (ast: SourceFile, name: string, from: string) => void;
  addExport: (ast: SourceFile, name: string, from: string) => void;
};

type NestOps = typeof typescriptOps & ModuleOps;

const moduleOps = defineOpPack<SourceFile, ModuleOps>({ addProvider, addController, addModuleImport, addExport });

const baseDialect = defineDialect({
  extensions: [".ts"],
  ast: { parse, print },
  ops: {},
});

const nestjsDialect = withOps(baseDialect, typescriptOps, moduleOps);

/**
 * Opens a `.ts` file of a NestJS project for editing. The handle carries every
 * `@pbuilder/sdk/typescript` op plus the `@Module` ops below, chained on one handle and
 * written once.
 *
 * `addProvider`, `addController`, `addModuleImport` and `addExport` each take
 * `(name, from)`: they add `import { name } from "from"` with the same rules as `addImport`,
 * then append `name` to the `providers`, `controllers`, `imports` or `exports` array of the
 * file's only `@Module` class, creating the metadata object or the array when missing. They
 * reject, leaving the file unchanged, when the file has no `@Module` class or more than one,
 * or when the metadata or the array is not a literal. Use `.modify(fn)` for those files and
 * for entries that are not a plain class name, such as `ConfigModule.forRoot()`.
 *
 * @example
 * import * as nestjs from "@pbuilder/sdk/nestjs";
 *
 * // src/app.module.ts before:
 * // @Module({ providers: [AppService] })
 * // export class AppModule {}
 * export const run = async () => {
 *   await nestjs
 *     .find("src/app.module.ts")
 *     .addModuleImport("UsersModule", "./users/users.module")
 *     .addProvider("UsersService", "./users/users.service");
 * };
 * // -> import { UsersModule } from "./users/users.module";
 * // -> import { UsersService } from "./users/users.service";
 * // ->
 * // -> @Module({ providers: [AppService, UsersService], imports: [UsersModule] })
 * // -> export class AppModule {}
 */
export function find(path: string): Handle<"found", SourceFile, NestOps> {
  return nestjsDialect.find(path);
}
