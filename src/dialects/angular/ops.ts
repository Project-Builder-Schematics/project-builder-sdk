import { Node, SyntaxKind, type ClassDeclaration, type Expression, type SourceFile, type VariableDeclaration } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";
import { assertValidImportBinding } from "../../core/jsx-name-validator.ts";
import { elementNameEcho } from "../../core/reject-tail.ts";
import {
  appendArrayElement,
  elementText,
  isSameElement,
  unwrap,
  type ArrayElement,
  type ArrayLocator,
} from "../typescript/array-element.ts";
import { parse } from "../typescript/ast.ts";
import { insertClassProperty, type ClassPropertyOptions } from "../typescript/class-property.ts";
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

/** An eager route: `{ path, component }`, with `component` imported from `from`. */
export type RouteSpec = { path: string; component: string; from: string };

/** A lazy route: `loadComponent` or `loadChildren` is the module to import; `export` names its export, else the default one. */
export type LazyRouteSpec = { path: string; loadComponent?: string; loadChildren?: string; export?: string };

const ROUTE_SHAPE = "`route` must be { path, component, from } strings — fix the route, or use `.modify()` to make this edit directly.";
const LAZY_ROUTE_SHAPE =
  "`route` must be { path, loadComponent | loadChildren, export? } strings — fix the route, or use `.modify()` to make this edit " +
  "directly.";

function isStringRecord(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key)) &&
    Object.values(value).every((field) => typeof field === "string")
  );
}

function pathOf(element: Node): string | undefined {
  const route = unwrap(element as Expression);
  if (!Node.isObjectLiteralExpression(route)) return undefined;
  const value = route.getProperty("path")?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
  return Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value) ? value.getLiteralValue() : undefined;
}

// Adds `text` to the file's only `Routes` array. Angular matches routes in order and the first
// match wins, so a new route goes before a top-level `**` route instead of after it.
function insertRoute(ast: SourceFile, opName: string, path: string, text: string): void {
  const label = `${opName}("${elementNameEcho(path)}")`;
  const fail: Fail = (reason) => {
    throw dialectError(`${label} on "${handlePathFor(ast)}" — ${reason}. Edit it with .modify().`);
  };
  if (path.startsWith("/")) fail('a route path cannot start with "/"');
  const declarations = typedVariables(ast, ["Routes", "Route[]"]);
  if (declarations.length === 0) fail("no top-level variable typed Routes or Route[] was found");
  if (declarations.length > 1) fail(`${declarations.length} top-level variables are typed Routes or Route[]; exactly one is required`);
  const name = declarations[0]!.getName();
  const list = unwrap(declarations[0]!.getInitializerOrThrow());
  if (!Node.isArrayLiteralExpression(list)) fail(`"${elementNameEcho(name)}" is not an array literal`);

  const element = { expression: text };
  const elements = list.getElements();
  const samePath = elements.find((candidate) => pathOf(candidate) === path);
  if (samePath !== undefined) {
    if (isSameElement(samePath, element)) return;
    fail(`a different route with path "${elementNameEcho(path)}" already exists`);
  }
  const wildcard = elements.find((candidate) => pathOf(candidate) === "**");
  if (wildcard === undefined) {
    appendArrayElement(ast, { variable: name, path: [] }, element, label);
    return;
  }
  const source = ast.getFullText();
  if (!source.slice(list.getStart(), list.getEnd()).includes("\n")) {
    ast.insertText(wildcard.getStart(), `${text}, `);
    return;
  }
  const indent = /^[ \t]*/.exec(source.slice(source.lastIndexOf("\n", wildcard.getStart()) + 1))![0];
  ast.insertText(wildcard.getStart(), `${text},\n${indent}`);
}

/**
 * Imports `route.component` from `route.from` and adds `{ path, component }` to the file's only
 * top-level variable typed `Routes` or `Route[]`, before a `**` route when there is one. An
 * equal route is a no-op; a different route with the same `path` rejects.
 */
export function addRoute(ast: SourceFile, route: RouteSpec): void {
  if (!isStringRecord(route, ["path", "component", "from"])) throw dialectError(ROUTE_SHAPE);
  assertValidImportBinding(route.component, "component");
  insertRoute(ast, "addRoute", route.path, `{ path: ${JSON.stringify(route.path)}, component: ${route.component} }`);
  addImport(ast, route.component, route.from);
}

/**
 * Same placement and duplicate rules as `addRoute`, for a lazy route:
 * `{ path, loadComponent: () => import("<module>") }`, or `loadChildren`, followed by
 * `.then((m) => m.<export>)` when `export` is given. Adds no import.
 */
export function addLazyRoute(ast: SourceFile, route: LazyRouteSpec): void {
  if (!isStringRecord(route, ["path"], ["loadComponent", "loadChildren", "export"])) throw dialectError(LAZY_ROUTE_SHAPE);
  const kind = route.loadComponent !== undefined ? "loadComponent" : "loadChildren";
  const from = route[kind];
  if (from === undefined || (route.loadComponent !== undefined && route.loadChildren !== undefined)) throw dialectError(LAZY_ROUTE_SHAPE);
  if (route.export !== undefined) assertValidImportBinding(route.export, "export");
  const loader = `import(${JSON.stringify(from)})${route.export === undefined ? "" : `.then((m) => m.${route.export})`}`;
  insertRoute(ast, "addLazyRoute", route.path, `{ path: ${JSON.stringify(route.path)}, ${kind}: () => ${loader} }`);
}

type Scope = NonNullable<ClassPropertyOptions["scope"]>;

/** Options of `addInput` and `addModel`; `type` is the generic argument, `initial` the default value. */
export type InputOptions = { type?: string; initial?: string; required?: boolean; imports?: readonly NamedImport[] };

/** Options of `addOutput`. */
export type OutputOptions = { type?: string; imports?: readonly NamedImport[] };

/** Options of `addInjection`; `scope` defaults to `private`. */
export type InjectionOptions = { scope?: Scope; imports?: readonly NamedImport[] };

// Angular only reads input(), model() and output() in component and directive initializers.
const VIEW_DECORATORS = ["Component", "Directive"];
const INJECTABLE_DECORATORS = ["Component", "Directive", "Pipe", "Injectable", "Service"];

function decoratorList(decorators: readonly string[]): string {
  const names = decorators.map((name) => `@${name}`);
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

function decoratedClass(ast: SourceFile, decorators: readonly string[], fail: Fail): ClassDeclaration {
  const classes = ast
    .getDescendantsOfKind(SyntaxKind.ClassDeclaration)
    .filter((cls) => cls.getDecorators().some((decorator) => decorators.includes(decorator.getName())));
  if (classes.length === 0) fail(`no class decorated with ${decoratorList(decorators)} was found`);
  if (classes.length > 1) fail(`${classes.length} classes are decorated with ${decoratorList(decorators)}; exactly one is required`);
  return classes[0]!;
}

function assertOptions(options: unknown, keys: readonly string[]): asserts options is Record<string, unknown> | undefined {
  if (options === undefined) return;
  const shape = `\`options\` must be { ${keys.map((key) => `${key}?`).join(", ")} } — fix the options, or use \`.modify()\` to make this edit directly.`;
  if (typeof options !== "object" || options === null || Array.isArray(options)) throw dialectError(shape);
  const record = options as Record<string, unknown>;
  const valid = Object.keys(record).every((key) => {
    const value = record[key];
    if (!keys.includes(key)) return false;
    if (key === "required") return typeof value === "boolean";
    if (key === "scope") return value === "public" || value === "protected" || value === "private";
    if (key === "imports") return true;
    return typeof value === "string";
  });
  if (!valid) throw dialectError(shape);
  assertImports(record.imports);
}

const TYPE_RULE = "`type` must be exactly one TypeScript type — fix the type, or use `.modify()` to make this edit directly.";

// `<type>` once proven to be one type: a breakout such as `T>(); evil(<T` parses differently.
function typeArgument(type: string | undefined): string {
  if (type === undefined) return "";
  let statements;
  try {
    statements = parse(`let x: ${type};`).getStatements();
  } catch {
    throw dialectError(TYPE_RULE);
  }
  const [statement, ...rest] = statements;
  const declaration = statement?.asKind(SyntaxKind.VariableStatement)?.getDeclarations();
  const typeNode = declaration?.length === 1 ? declaration[0]!.getTypeNode() : undefined;
  if (rest.length > 0 || typeNode === undefined || declaration![0]!.hasInitializer() || typeNode.getText() !== type.trim()) {
    throw dialectError(TYPE_RULE);
  }
  return `<${typeNode.getText()}>`;
}

// Adds `property` to the file's only class with one of `decorators`, then the Angular
// function it calls (from `@angular/core`) and the author's `imports`.
function addMember(
  ast: SourceFile,
  opName: string,
  name: string,
  decorators: readonly string[],
  property: { initializer: string; scope?: Scope; core: string },
  imports: readonly NamedImport[] | undefined
): void {
  const fail: Fail = (reason) => {
    throw dialectError(`${opName}("${elementNameEcho(name)}") on "${handlePathFor(ast)}" — ${reason}. Edit it with .modify().`);
  };
  const cls = decoratedClass(ast, decorators, fail);
  insertClassProperty(ast, cls, { name, initializer: property.initializer, scope: property.scope, readonly: true }, fail);
  addImport(ast, property.core, "@angular/core");
  for (const entry of imports ?? []) addImport(ast, entry.name, entry.from);
}

function signalInputOp(opName: string, fn: "input" | "model") {
  return (ast: SourceFile, name: string, options?: InputOptions): void => {
    assertValidImportBinding(name, "name");
    assertOptions(options, ["type", "initial", "required", "imports"]);
    if (options?.required && options.initial !== undefined) {
      throw dialectError("`required` and `initial` cannot be combined — drop one, or use `.modify()` to make this edit directly.");
    }
    const generic = typeArgument(options?.type);
    const initial = options?.initial === undefined ? "" : elementText({ expression: options.initial });
    const initializer = options?.required ? `${fn}.required${generic}()` : `${fn}${generic}(${initial})`;
    addMember(ast, opName, name, VIEW_DECORATORS, { initializer, core: fn }, options?.imports);
  };
}

/**
 * Adds `readonly name = input<type>(initial)`, or `input.required<type>()` with `required`, to
 * the file's only `@Component` or `@Directive` class, after its last property, and imports
 * `input`. The same declaration already there is a no-op.
 */
export const addInput = signalInputOp("addInput", "input");

/** Same as `addInput`, with `model()` for a two-way bound property. */
export const addModel = signalInputOp("addModel", "model");

/** Adds `readonly name = output<type>()` to the file's only `@Component` or `@Directive` class and imports `output`. */
export function addOutput(ast: SourceFile, name: string, options?: OutputOptions): void {
  assertValidImportBinding(name, "name");
  assertOptions(options, ["type", "imports"]);
  addMember(ast, "addOutput", name, VIEW_DECORATORS, { initializer: `output${typeArgument(options?.type)}()`, core: "output" }, options?.imports);
}

/**
 * Adds `private readonly name = inject(token)` to the file's only class decorated with
 * `@Component`, `@Directive`, `@Pipe`, `@Injectable` or `@Service`, and imports `inject`.
 * `token` is an identifier or `{ expression }`; `options.scope` replaces `private`.
 */
export function addInjection(ast: SourceFile, name: string, token: ArrayElement, options?: InjectionOptions): void {
  assertValidImportBinding(name, "name");
  assertOptions(options, ["scope", "imports"]);
  const initializer = `inject(${elementText(token)})`;
  addMember(ast, "addInjection", name, INJECTABLE_DECORATORS, { initializer, scope: options?.scope ?? "private", core: "inject" }, options?.imports);
}
