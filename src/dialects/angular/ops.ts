import { Node, SyntaxKind, type SourceFile, type VariableDeclaration } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";
import { assertValidImportBinding } from "../../core/jsx-name-validator.ts";
import { elementNameEcho } from "../../core/reject-tail.ts";
import { appendArrayElement, elementText, type ArrayElement, type ArrayLocator } from "../typescript/array-element.ts";
import { addImport } from "../typescript/ops.ts";

/** A named import an inserted element needs: `import { name } from "from"`. */
export type NamedImport = { name: string; from: string };

const IMPORTS_SHAPE =
  "`imports` must be a list of { name, from } strings — fix the imports, or use `.modify()` to make this edit directly.";

function assertImports(imports: unknown): asserts imports is readonly NamedImport[] | undefined {
  if (imports === undefined) return;
  const valid =
    Array.isArray(imports) &&
    imports.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        Object.keys(entry).sort().join() === "from,name" &&
        typeof entry.name === "string" &&
        typeof entry.from === "string"
    );
  if (!valid) throw dialectError(IMPORTS_SHAPE);
  for (const { name } of imports) assertValidImportBinding(name);
}

type Fail = (reason: string) => never;

// An insert op: `locate` turns the file into the array the element goes to, then every
// import the element needs is added with `addImport`'s rules.
function insertOp(opName: string, locate: (ast: SourceFile, fail: Fail) => ArrayLocator) {
  return (ast: SourceFile, element: ArrayElement, imports?: readonly NamedImport[]): void => {
    assertImports(imports);
    const label = `${opName}("${elementNameEcho(elementText(element))}")`;
    const fail: Fail = (reason) => {
      throw dialectError(`${label} on "${handlePathFor(ast)}" — ${reason}. Edit it with .modify().`);
    };
    appendArrayElement(ast, locate(ast, fail), element, label);
    for (const { name, from } of imports ?? []) addImport(ast, name, from);
  };
}

// The declared type of a top-level variable: its annotation, or the type it `satisfies`.
function declaredType(decl: VariableDeclaration): string | undefined {
  const initializer = decl.getInitializer();
  return decl.getTypeNode()?.getText() ?? (Node.isSatisfiesExpression(initializer) ? initializer.getTypeNode()?.getText() : undefined);
}

function typedVariables(ast: SourceFile, types: readonly string[]): VariableDeclaration[] {
  return ast.getVariableDeclarations().filter((decl) => types.includes(declaredType(decl) ?? ""));
}

function rootProviders(ast: SourceFile, fail: Fail): ArrayLocator {
  const configs = typedVariables(ast, ["ApplicationConfig"]);
  if (configs.length > 1) fail(`${configs.length} top-level variables are typed ApplicationConfig; exactly one is required`);
  if (configs.length === 1) return { variable: configs[0]!.getName(), path: ["providers"] };
  const calls = ast
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "bootstrapApplication");
  if (calls.length === 0) fail("no top-level variable typed ApplicationConfig and no bootstrapApplication call was found");
  // Providers passed by reference live where that config is declared, usually another file.
  const config = calls.length === 1 ? calls[0]!.getArguments()[1] : undefined;
  if (Node.isIdentifier(config)) {
    const name = config.getText();
    const from = ast
      .getImportDeclarations()
      .find((decl) => decl.getNamedImports().some((spec) => (spec.getAliasNode() ?? spec.getNameNode()).getText() === name))
      ?.getModuleSpecifierValue();
    fail(
      `the bootstrapApplication config is "${elementNameEcho(name)}"` +
        (from === undefined ? "; add the provider where it is declared" : `, imported from "${elementNameEcho(from)}"; add the provider in that file`)
    );
  }
  return { call: "bootstrapApplication", argument: 1, path: ["providers"] };
}

/**
 * Appends `element` to the `imports` of the file's only `@Component`, creating the metadata
 * object or the array when missing, then adds each of `imports`. An equal element is a no-op.
 */
export const addComponentImport = insertOp("addComponentImport", () => ({ decorator: "Component", path: ["imports"] }));

/** Same as `addComponentImport`, for the component's `providers`. */
export const addComponentProvider = insertOp("addComponentProvider", () => ({ decorator: "Component", path: ["providers"] }));

/**
 * Appends `element` to the application's root `providers`: those of the file's only top-level
 * variable typed `ApplicationConfig`, else those of the only `bootstrapApplication(...)` call's
 * config object, created when missing. A config passed by name rejects with the module to edit.
 */
export const addRootProvider = insertOp("addRootProvider", rootProviders);
