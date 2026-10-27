import {
  Node,
  SyntaxKind,
  ts,
  type ArrayLiteralExpression,
  type CallExpression,
  type Decorator,
  type Expression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";
import { elementNameEcho } from "../../core/reject-tail.ts";
import { assertValidImportBinding, assertValidPropertyKey } from "../../core/jsx-name-validator.ts";
import { parse } from "./ast.ts";

/** A string is an object key; `{ key: "value" }` selects the only array element whose `key` is that string. */
export type PathSegment = string | Readonly<Record<string, string>>;

export type ArrayLocator =
  | { variable: string; path: readonly PathSegment[] }
  | { call: string; argument: number; path: readonly PathSegment[] }
  | { decorator: string; path: readonly PathSegment[] };

/** An identifier, validated; or `{ expression }`, which must parse as exactly one expression. */
export type ArrayElement = string | { expression: string };

// Appends `item` after the last entry of an array or object literal, keeping its layout: one
// line stays one line, a multi-line list gets a new line at the last entry's indentation, and
// a trailing comma stays trailing.
export function appendEntry(ast: SourceFile, list: Node, entries: Node[], item: string, empty: string): void {
  const last = entries.at(-1);
  if (last === undefined) {
    list.replaceWithText(empty);
    return;
  }
  const text = ast.getFullText();
  const closeAt = list.getEnd() - 1;
  // The comma is read from the list's tokens: a comma inside a comment is trivia, not one.
  const trailing = list.getFirstChildByKind(SyntaxKind.SyntaxList)?.getLastChild();
  const trailingComma = trailing?.getKind() === SyntaxKind.CommaToken;
  const commaAt = trailingComma ? trailing!.getStart() : -1;
  if (!text.slice(list.getStart(), closeAt).includes("\n")) {
    if (trailingComma) ast.insertText(commaAt + 1, ` ${item},`);
    else ast.insertText(last.getEnd(), `, ${item}`);
    return;
  }
  const indent = /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", last.getStart()) + 1))![0];
  if (trailingComma) ast.insertText(commaAt + 1, `\n${indent}${item},`);
  else ast.insertText(last.getEnd(), `,\n${indent}${item}`);
}

const LOCATOR_SHAPE =
  "`locator` must be { variable, path }, { call, argument, path }, or { decorator, path } — fix the locator, " +
  "or use `.modify()` to make this edit directly.";
const ELEMENT_SHAPE =
  "`element` must be an identifier string or { expression: string } — fix the element, or use `.modify()` to " +
  "make this edit directly.";
const EXPRESSION_RULE =
  "`expression` must be exactly one JavaScript expression — fix the expression, or use `.modify()` to make this " +
  "edit directly.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function assertLocator(locator: unknown): asserts locator is ArrayLocator {
  if (!isPlainObject(locator)) throw dialectError(LOCATOR_SHAPE);
  const shape = Object.hasOwn(locator, "call") ? ["call", "argument", "path"] : ["variable" in locator ? "variable" : "decorator", "path"];
  if (!hasExactKeys(locator, shape) || !Array.isArray(locator.path)) throw dialectError(LOCATOR_SHAPE);
  const root = shape[0]!;
  if (typeof locator[root] !== "string") throw dialectError(LOCATOR_SHAPE);
  if (root === "call" && !(Number.isInteger(locator.argument) && (locator.argument as number) >= 0)) {
    throw dialectError(LOCATOR_SHAPE);
  }
  assertValidImportBinding(locator[root] as string, root);
  for (const segment of locator.path as unknown[]) {
    if (typeof segment === "string") {
      assertValidPropertyKey(segment, "path");
      continue;
    }
    const entries = isPlainObject(segment) ? Object.entries(segment) : [];
    if (entries.length !== 1 || typeof entries[0]![1] !== "string") {
      throw dialectError(
        "`path` segments must be object keys or { key: \"value\" } matches — fix the path, or use `.modify()` to " +
          "make this edit directly."
      );
    }
    assertValidPropertyKey(entries[0]![0], "path");
  }
}

// The only element of `[text]`, or undefined when `text` is not exactly one plain element.
function parseElement(text: string): Node | undefined {
  let parsed: SourceFile;
  try {
    parsed = parse(`[${text}]`);
  } catch {
    return undefined;
  }
  const [statement, ...rest] = parsed.getStatements();
  const list = statement?.asKind(SyntaxKind.ExpressionStatement)?.getExpressionIfKind(SyntaxKind.ArrayLiteralExpression);
  const elements = list?.getElements() ?? [];
  if (rest.length > 0 || elements.length !== 1 || Node.isSpreadElement(elements[0]) || Node.isOmittedExpression(elements[0])) {
    return undefined;
  }
  return elements[0];
}

// Returns the element's parsed node once it is proven to be a single array element.
function elementNode(element: unknown): Node {
  if (typeof element === "string") {
    assertValidImportBinding(element, "element");
    return parseElement(element)!;
  }
  if (!isPlainObject(element) || !hasExactKeys(element, ["expression"]) || typeof element.expression !== "string") {
    throw dialectError(ELEMENT_SHAPE);
  }
  // Wrapping in brackets and requiring exactly one plain element blocks every breakout: a
  // closed bracket, a comma, or a comment that swallows `]` yields a different parse.
  const node = parseElement(element.expression.trim());
  if (node === undefined) throw dialectError(EXPRESSION_RULE);
  return node;
}

// Tokens without trivia, so formatting, comments, and trailing commas never make two equal
// elements look different.
export function tokensOf(node: Node): string[] {
  const sourceFile = node.getSourceFile().compilerNode;
  const tokens: string[] = [];
  const visit = (current: ts.Node): void => {
    if (current.kind >= ts.SyntaxKind.FirstJSDocNode && current.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = current.getChildren(sourceFile);
    if (children.length === 0) {
      const text = current.getText(sourceFile);
      if (text !== "") tokens.push(text);
      return;
    }
    children.forEach(visit);
  };
  visit(node.compilerNode);
  return tokens.filter((token, index) => token !== "," || ![")", "]", "}"].includes(tokens[index + 1] ?? ""));
}

function sameTokens(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((token, index) => token === b[index]);
}

/** True when `node` and the validated `element` are the same code, compared token by token. */
export function isSameElement(node: Node, element: unknown): boolean {
  return sameTokens(tokensOf(node), tokensOf(elementNode(element)));
}

export function unwrap(node: Expression): Expression {
  let current = node;
  while (
    Node.isAsExpression(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isParenthesizedExpression(current) ||
    Node.isTypeAssertion(current) ||
    Node.isNonNullExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

function propertyKey(member: Node): string | undefined {
  if (
    !Node.isPropertyAssignment(member) &&
    !Node.isShorthandPropertyAssignment(member) &&
    !Node.isMethodDeclaration(member) &&
    !Node.isGetAccessorDeclaration(member) &&
    !Node.isSetAccessorDeclaration(member)
  ) {
    return undefined;
  }
  const name = member.getNameNode();
  if (Node.isIdentifier(name)) return name.getText();
  if (Node.isStringLiteral(name) || Node.isNoSubstitutionTemplateLiteral(name)) return name.getLiteralValue();
  return undefined;
}

function stringValue(node: Expression | undefined): string | undefined {
  const value = node === undefined ? undefined : unwrap(node);
  return Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value) ? value.getLiteralValue() : undefined;
}

// Where the element goes, found before anything is mutated.
type Placement =
  | { kind: "present" }
  | { kind: "append"; list: ArrayLiteralExpression }
  | { kind: "addProperty"; object: ObjectLiteralExpression; keys: string[] }
  | { kind: "addArgument"; owner: CallExpression | Decorator; keys: string[] };

function locateRoot(ast: SourceFile, locator: ArrayLocator, fail: (reason: string) => never): { kind: "node"; node: Expression } | Placement {
  if ("variable" in locator) {
    const declarations = ast.getVariableDeclarations().filter((decl) => decl.getName() === locator.variable);
    if (declarations.length === 0) fail(`no top-level variable named "${elementNameEcho(locator.variable)}" was found`);
    if (declarations.length > 1) fail(`${declarations.length} top-level variables are named "${elementNameEcho(locator.variable)}"; exactly one is required`);
    const initializer = declarations[0]!.getInitializer();
    if (initializer === undefined) fail(`"${elementNameEcho(locator.variable)}" has no initializer`);
    return { kind: "node", node: initializer };
  }
  let owner: CallExpression | Decorator;
  let argument = 0;
  if ("call" in locator) {
    const calls = ast
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === locator.call);
    if (calls.length === 0) fail(`no call to "${elementNameEcho(locator.call)}" was found`);
    if (calls.length > 1) fail(`${calls.length} calls to "${elementNameEcho(locator.call)}" were found; exactly one is required`);
    owner = calls[0]!;
    argument = locator.argument;
  } else {
    const decorators = ast.getDescendantsOfKind(SyntaxKind.Decorator).filter((decorator) => decorator.getName() === locator.decorator);
    if (decorators.length === 0) fail(`no "@${elementNameEcho(locator.decorator)}" decorator was found`);
    if (decorators.length > 1) fail(`${decorators.length} "@${elementNameEcho(locator.decorator)}" decorators were found; exactly one is required`);
    owner = decorators[0]!;
    if (!owner.isDecoratorFactory()) fail(`"@${elementNameEcho(locator.decorator)}" is not called with an argument list`);
  }
  const args = owner.getArguments() as Expression[];
  if (argument < args.length) return { kind: "node", node: args[argument]! };
  const name = "call" in locator ? elementNameEcho(locator.call) : `@${elementNameEcho(locator.decorator)}`;
  if (argument > args.length) fail(`"${name}" is called with ${args.length} arguments; only argument ${args.length} can be created`);
  return missingLevels(locator.path, 0, `argument ${argument}`, fail, (keys) => ({ kind: "addArgument", owner, keys }));
}

// Only keys can be created: a match segment names an element that does not exist yet.
function missingLevels(
  path: readonly PathSegment[],
  from: number,
  missing: string,
  fail: (reason: string) => never,
  placement: (keys: string[]) => Placement
): Placement {
  const keys = path.slice(from);
  if (keys.every((segment) => typeof segment === "string")) return placement(keys);
  fail(`${missing} is missing and cannot be created before a match segment`);
}

function locate(ast: SourceFile, locator: ArrayLocator, item: Node, fail: (reason: string) => never): Placement {
  const root = locateRoot(ast, locator, fail);
  if (root.kind !== "node") return root;
  let node = unwrap(root.node);
  for (const [index, segment] of locator.path.entries()) {
    if (typeof segment === "string") {
      if (!Node.isObjectLiteralExpression(node)) fail(`path[${index}] "${elementNameEcho(segment)}" expects an object literal`);
      const object = node;
      const members = object.getProperties().filter((member) => propertyKey(member) === segment);
      if (members.length === 0) {
        // A spread or a computed key may already supply the key; a created one would shadow it.
        const opaque = object
          .getProperties()
          .some((member) => Node.isSpreadAssignment(member) || (Node.hasName(member) && Node.isComputedPropertyName(member.getNameNode())));
        if (opaque) fail(`path[${index}] "${elementNameEcho(segment)}" may already come from a spread or a computed key, so it cannot be created`);
        const missing = `path[${index}] "${elementNameEcho(segment)}"`;
        return missingLevels(locator.path, index, missing, fail, (keys) => ({ kind: "addProperty", object, keys }));
      }
      if (members.length > 1) fail(`path[${index}] "${elementNameEcho(segment)}" is assigned ${members.length} times`);
      const member = members[0]!;
      if (!Node.isPropertyAssignment(member)) fail(`path[${index}] "${elementNameEcho(segment)}" is not a plain property assignment`);
      node = unwrap(member.getInitializerOrThrow());
      continue;
    }
    if (!Node.isArrayLiteralExpression(node)) fail(`path[${index}] expects an array literal`);
    const [[key, value]] = Object.entries(segment) as [[string, string]];
    const matches = node.getElements().filter((element) => {
      const candidate = unwrap(element);
      if (!Node.isObjectLiteralExpression(candidate)) return false;
      const property = candidate.getProperties().find((member) => propertyKey(member) === key);
      return Node.isPropertyAssignment(property) && stringValue(property.getInitializer()) === value;
    });
    if (matches.length === 0) fail(`path[${index}] matched no element`);
    if (matches.length > 1) fail(`path[${index}] matched ${matches.length} elements; exactly one is required`);
    node = unwrap(matches[0]!);
  }
  if (!Node.isArrayLiteralExpression(node)) fail("the target is not an array literal");
  const itemTokens = tokensOf(item);
  const present = node.getElements().some((element) => sameTokens(tokensOf(element), itemTokens));
  return present ? { kind: "present" } : { kind: "append", list: node };
}

// `keys` are the levels still missing below the located node; the last one holds the array.
function nested(keys: string[], item: string): string {
  return keys.reduceRight((inner, key) => `{ ${key}: ${inner} }`, `[${item}]`);
}

function locatorEcho(locator: ArrayLocator): string {
  const path = locator.path.map((segment) =>
    typeof segment === "string"
      ? elementNameEcho(segment)
      : Object.fromEntries(Object.entries(segment).map(([k, v]) => [elementNameEcho(k), elementNameEcho(v)]))
  );
  if ("variable" in locator) return JSON.stringify({ variable: elementNameEcho(locator.variable), path });
  if ("call" in locator) return JSON.stringify({ call: elementNameEcho(locator.call), argument: locator.argument, path });
  return JSON.stringify({ decorator: elementNameEcho(locator.decorator), path });
}

/**
 * Appends `element` to the array literal `locator` points at, keeping the list's layout. The
 * locator starts at a top-level variable, an argument of the only call to a callee, or the
 * only decorator with a name, then follows `path`: a string is an object key, and
 * `{ key: "value" }` selects the only array element whose `key` is that string. Missing keys and
 * the next missing call argument are created; a missing root or matched element rejects. An
 * element already listed, compared token by token, is a no-op. The element is an identifier, or
 * `{ expression }` for code, which must parse as exactly one expression and is otherwise
 * author-trusted, like `addFunction`'s `source`.
 */
export function addArrayElement(ast: SourceFile, locator: ArrayLocator, element: ArrayElement): void {
  assertLocator(locator);
  appendArrayElement(ast, locator, element, `addArrayElement(${locatorEcho(locator)})`);
}

/** The validated source text of `element`; rejects like `addArrayElement` does. */
export function elementText(element: unknown): string {
  return elementNode(element).getText();
}

/**
 * `addArrayElement` for a dialect that builds `locator` itself: `label` heads the reject
 * tail in place of `addArrayElement(<locator>)`.
 */
export function appendArrayElement(ast: SourceFile, locator: ArrayLocator, element: unknown, label: string): void {
  const node = elementNode(element);
  const item = node.getText();
  const fail = (reason: string): never => {
    throw dialectError(`${label} on "${handlePathFor(ast)}" — ${reason}. Edit it with .modify().`);
  };
  const placement = locate(ast, locator, node, fail);
  switch (placement.kind) {
    case "present":
      return;
    case "append":
      appendEntry(ast, placement.list, placement.list.getElements(), item, `[${item}]`);
      return;
    case "addProperty": {
      const [key, ...rest] = placement.keys;
      const entry = `${key}: ${nested(rest, item)}`;
      appendEntry(ast, placement.object, placement.object.getProperties(), entry, `{ ${entry} }`);
      return;
    }
    case "addArgument":
      placement.owner.addArgument(nested(placement.keys, item));
  }
}
