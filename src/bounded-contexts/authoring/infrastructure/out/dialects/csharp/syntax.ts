import type { Node } from "web-tree-sitter";
import { dialectError } from "../../../../domain/valueobjects/dialect-error.ts";

export const TYPE_DECLARATIONS: ReadonlySet<string> = new Set([
  "class_declaration",
  "record_declaration",
  "struct_declaration",
  "interface_declaration",
]);

export function lineEnding(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/** The whitespace that starts the line holding `index`. */
export function indentAt(text: string, index: number): string {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))![0];
}

/**
 * The indentation unit the file uses for members: the step from the first declaration holding a
 * member or a nested declaration to that member, four spaces when the file has none.
 */
export function indentUnit(text: string, root: Node): string {
  for (const body of root.descendantsOfType("declaration_list")) {
    const member = body!.namedChildren.find((child) => !isTrivia(child));
    if (member === undefined || member.startPosition.row === body!.startPosition.row) continue;
    const outer = indentAt(text, body!.parent!.startIndex);
    const inner = indentAt(text, member.startIndex);
    if (inner.startsWith(outer) && inner.length > outer.length) return inner.slice(outer.length);
  }
  return "    ";
}

/** Writes `code` at `indent`: each line after the first keeps its indentation relative to the first. */
export function indentCode(code: string, indent: string, eol: string): string {
  const lines = code.trim().split(/\r?\n/);
  const base = /^[ \t]*/.exec(code.split(/\r?\n/).find((line) => line.trim() !== "") ?? "")![0];
  return lines
    .map((line, index) => {
      if (index === 0) return indent + line;
      if (line.trim() === "") return "";
      return indent + (line.startsWith(base) ? line.slice(base.length) : line.trimStart());
    })
    .join(eol);
}

/**
 * Where code inserted after `node` goes: before a line break the node itself holds (preprocessor
 * lines do), and past a comment that ends the node's line, so that comment stays with it.
 */
export function endOfNode(text: string, node: Node): number {
  let end = node.endIndex;
  while (end > node.startIndex && (text[end - 1] === "\n" || text[end - 1] === "\r")) end--;
  const newline = text.indexOf("\n", end);
  const rest = text.slice(end, newline === -1 ? text.length : newline).replace(/\r$/, "");
  return /^\s*(\/\/.*|\/\*.*\*\/\s*)$/.test(rest) ? end + rest.length : end;
}

/** Comments and preprocessor lines are not members, statements or directives. */
export function isTrivia(node: Node): boolean {
  return node.type === "comment" || node.type.startsWith("preproc_");
}

export function splice(text: string, start: number, end: number, insert: string): string {
  return text.slice(0, start) + insert + text.slice(end);
}

/** The type declarations at the top level of the file or inside a namespace; nested types are not targets. */
function topLevelTypes(container: Node): Node[] {
  const types: Node[] = [];
  for (const child of container.namedChildren) {
    if (TYPE_DECLARATIONS.has(child.type)) types.push(child);
    else if (child.type === "namespace_declaration") {
      const body = child.childForFieldName("body");
      if (body !== null) types.push(...topLevelTypes(body));
    }
  }
  return types;
}

/** The one class, record, struct or interface named `typeName`; none or several reject. */
export function findType(root: Node, op: string, typeName: string): Node {
  const matches = topLevelTypes(root).filter((type) => type.childForFieldName("name")?.text === typeName);
  if (matches.length === 1) return matches[0]!;
  const why =
    matches.length === 0
      ? `no class, record, struct or interface named \`${typeName}\` is declared at the top level or in a namespace`
      : `\`${typeName}\` names ${matches.length} declarations (a partial type?); edit them with .modify()`;
  throw dialectError(`${op}(${JSON.stringify(typeName)}) — ${why}`);
}

/** Where a header clause (`(...)`, `: base`) goes: after the name, type parameters and primary constructor. */
export function headerEnd(type: Node): number {
  let end = type.childForFieldName("name")!.endIndex;
  for (const child of type.namedChildren) {
    if (child.type === "type_parameter_list" || child.type === "parameter_list") end = Math.max(end, child.endIndex);
  }
  return end;
}

/** The namespaces the file declares, with the names of block namespaces nested in each other joined. */
export function declaredNamespaces(root: Node, prefix = ""): string[] {
  const names: string[] = [];
  for (const child of root.namedChildren) {
    if (child.type !== "namespace_declaration" && child.type !== "file_scoped_namespace_declaration") continue;
    const name = prefix + child.childForFieldName("name")!.text.replace(/\s+/g, "");
    names.push(name);
    const body = child.childForFieldName("body");
    if (body !== null) names.push(...declaredNamespaces(body, `${name}.`));
  }
  return names;
}
