import {
  SyntaxKind,
  type ArrayLiteralExpression,
  type Decorator,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";
import { assertValidImportBinding } from "../../core/jsx-name-validator.ts";
import { appendEntry } from "../typescript/array-element.ts";
import { addImport } from "../typescript/ops.ts";

type ModuleProperty = "providers" | "controllers" | "imports" | "exports";

// What still has to be written into `@Module`, found before anything is mutated.
type Placement =
  | { kind: "present" }
  | { kind: "append"; list: ArrayLiteralExpression }
  | { kind: "addProperty"; metadata: ObjectLiteralExpression }
  | { kind: "addArgument"; decorator: Decorator };

function moduleDecorator(ast: SourceFile, fail: (reason: string) => never): Decorator {
  const decorators = ast
    .getClasses()
    .map((cls) => cls.getDecorator("Module"))
    .filter((decorator) => decorator !== undefined);
  if (decorators.length === 0) fail("no class decorated with @Module was found");
  if (decorators.length > 1) fail(`${decorators.length} classes are decorated with @Module; exactly one is required`);
  return decorators[0]!;
}

function locate(ast: SourceFile, property: ModuleProperty, name: string, fail: (reason: string) => never): Placement {
  const decorator = moduleDecorator(ast, fail);
  const [metadata] = decorator.getArguments();
  if (metadata === undefined) return { kind: "addArgument", decorator };
  if (metadata.getKind() !== SyntaxKind.ObjectLiteralExpression) fail("the @Module argument is not an object literal");
  const object = metadata.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  const member = object.getProperty(property);
  if (member === undefined) return { kind: "addProperty", metadata: object };
  const list = member.asKind(SyntaxKind.PropertyAssignment)?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (list === undefined) fail(`@Module "${property}" is not an array literal`);
  if (list.getElements().some((element) => element.getText() === name)) return { kind: "present" };
  return { kind: "append", list };
}

function write(ast: SourceFile, placement: Placement, property: ModuleProperty, name: string): void {
  const entry = `${property}: [${name}]`;
  switch (placement.kind) {
    case "present":
      return;
    case "append":
      appendEntry(ast, placement.list, placement.list.getElements(), name, `[${name}]`);
      return;
    case "addProperty":
      appendEntry(ast, placement.metadata, placement.metadata.getProperties(), entry, `{ ${entry} }`);
      return;
    case "addArgument":
      placement.decorator.addArgument(`{ ${entry} }`);
  }
}

function moduleArrayOp(verb: string, property: ModuleProperty) {
  return (ast: SourceFile, name: string, from: string): void => {
    assertValidImportBinding(name);
    const fail = (reason: string): never => {
      throw dialectError(`${verb}("${name}") on "${handlePathFor(ast)}" — ${reason}. Edit it with .modify().`);
    };
    // Locating first rejects an unusable @Module before addImport mutates the file; the
    // nodes are located again afterwards because addImport may have rewritten them.
    locate(ast, property, name, fail);
    addImport(ast, name, from);
    write(ast, locate(ast, property, name, fail), property, name);
  };
}

/**
 * Imports `name` from `from` and adds it to the `providers` array of the file's only
 * `@Module` class, creating the metadata object or the array when missing. An entry already
 * named `name` is left as it is.
 */
export const addProvider = moduleArrayOp("addProvider", "providers");

/** Same as `addProvider`, for the `controllers` array. */
export const addController = moduleArrayOp("addController", "controllers");

/** Same as `addProvider`, for the `imports` array (other Nest modules). */
export const addModuleImport = moduleArrayOp("addModuleImport", "imports");

/** Same as `addProvider`, for the `exports` array. */
export const addExport = moduleArrayOp("addExport", "exports");
