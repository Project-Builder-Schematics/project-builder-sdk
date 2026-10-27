import { Node, SyntaxKind, type ClassDeclaration, type SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";
import { assertValidImportBinding } from "../../core/jsx-name-validator.ts";
import { elementNameEcho } from "../../core/reject-tail.ts";
import { elementText, tokensOf } from "./array-element.ts";
import { parse } from "./ast.ts";

export type ClassPropertyOptions = { scope?: "public" | "protected" | "private"; readonly?: boolean };

/** A property to insert; `initializer` is already validated as one expression. */
export type ClassProperty = ClassPropertyOptions & { name: string; initializer: string };

const OPTIONS_SHAPE =
  '`options` must be { scope?, readonly? } with scope "public", "protected" or "private" — fix the options, or use ' +
  "`.modify()` to make this edit directly.";

export function assertClassPropertyOptions(options: unknown): asserts options is ClassPropertyOptions | undefined {
  if (options === undefined) return;
  const valid =
    typeof options === "object" &&
    options !== null &&
    Object.keys(options).every((key) => key === "scope" || key === "readonly") &&
    [undefined, "public", "protected", "private"].includes((options as ClassPropertyOptions).scope) &&
    [undefined, true, false].includes((options as ClassPropertyOptions).readonly);
  if (!valid) throw dialectError(OPTIONS_SHAPE);
}

function declarationOf(property: ClassProperty): string {
  const modifiers = [property.scope, property.readonly ? "readonly" : undefined].filter((m) => m !== undefined);
  return [...modifiers, `${property.name} = ${property.initializer};`].join(" ");
}

// Tokens without a trailing `;`, so `b = 1` and `b = 1;` are the same declaration.
function declarationTokens(node: Node): string[] {
  const tokens = tokensOf(node);
  return tokens.at(-1) === ";" ? tokens.slice(0, -1) : tokens;
}

function sameDeclaration(member: Node, text: string): boolean {
  const parsed = parse(`class X {\n${text}\n}`).getClassOrThrow("X").getMembers()[0]!;
  const a = declarationTokens(member);
  const b = declarationTokens(parsed);
  return a.length === b.length && a.every((token, index) => token === b[index]);
}

/**
 * Inserts `property` into `cls`: after its last property, else before its first member, else
 * into its empty body. A member named `property.name` with the same declaration is a no-op;
 * any other member with that name rejects through `fail`.
 */
export function insertClassProperty(ast: SourceFile, cls: ClassDeclaration, property: ClassProperty, fail: (reason: string) => never): void {
  const text = declarationOf(property);
  const members = cls.getMembers();
  const named = members.filter((member) => Node.hasName(member) && member.getName() === property.name);
  if (named.length > 0) {
    if (named.length === 1 && Node.isPropertyDeclaration(named[0]) && sameDeclaration(named[0], text)) return;
    fail(`the class already has a different member named "${elementNameEcho(property.name)}"`);
  }
  const source = ast.getFullText();
  const indentAt = (position: number) => /^[ \t]*/.exec(source.slice(source.lastIndexOf("\n", position - 1) + 1))![0];
  const anchor = members.filter((member) => Node.isPropertyDeclaration(member)).at(-1);
  if (anchor !== undefined) {
    const lineEnd = source.indexOf("\n", anchor.getEnd());
    const rest = source.slice(anchor.getEnd(), lineEnd === -1 ? source.length : lineEnd);
    // Only trivia after the property means it ends its line: the new one goes on the next line.
    if (lineEnd !== -1 && /^\s*(\/\/.*|\/\*.*\*\/\s*)?$/.test(rest)) ast.insertText(lineEnd, `\n${indentAt(anchor.getStart())}${text}`);
    else ast.insertText(anchor.getEnd(), ` ${text}`);
    return;
  }
  const first = members[0];
  if (first !== undefined) {
    const start = first.getStart(true);
    const open = cls.getFirstChildByKindOrThrow(SyntaxKind.OpenBraceToken);
    if (source.slice(open.getEnd(), start).includes("\n")) ast.insertText(start, `${text}\n${indentAt(start)}`);
    else ast.insertText(start, `${text} `);
    return;
  }
  const open = cls.getFirstChildByKindOrThrow(SyntaxKind.OpenBraceToken);
  const close = cls.getLastChildByKindOrThrow(SyntaxKind.CloseBraceToken);
  const indent = indentAt(cls.getStart());
  ast.replaceText([open.getEnd(), close.getStart()], `\n${indent}  ${text}\n${indent}`);
}

/**
 * Adds `{scope }{readonly }name = initializer;` to the only class named `className`, after its
 * last property, else as its first member, keeping the members' indentation. `initializer` must
 * parse as exactly one expression and is otherwise author-trusted. A property with the same
 * declaration is a no-op; any other member named `name` rejects.
 */
export function addClassProperty(
  ast: SourceFile,
  className: string,
  name: string,
  initializer: string,
  options?: ClassPropertyOptions
): void {
  assertValidImportBinding(className, "className");
  assertValidImportBinding(name, "name");
  assertClassPropertyOptions(options);
  const value = elementText({ expression: initializer });
  const fail = (reason: string): never => {
    throw dialectError(
      `addClassProperty("${elementNameEcho(className)}", "${elementNameEcho(name)}") on "${handlePathFor(ast)}" — ${reason}. Edit it with .modify().`
    );
  };
  const classes = ast.getDescendantsOfKind(SyntaxKind.ClassDeclaration).filter((cls) => cls.getName() === className);
  if (classes.length === 0) fail(`no class named "${elementNameEcho(className)}" was found`);
  if (classes.length > 1) fail(`${classes.length} classes are named "${elementNameEcho(className)}"; exactly one is required`);
  insertClassProperty(ast, classes[0]!, { ...options, name, initializer: value }, fail);
}
