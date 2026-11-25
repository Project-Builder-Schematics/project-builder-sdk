import type { Node } from "web-tree-sitter";
import { dialectError } from "../../../../domain/valueobjects/dialect-error.ts";
import { withTree, type CsharpDocument } from "./ast.ts";
import { assertIdentifier, assertNamespace, assertOptions, assertType, compact } from "./names.ts";
import { declaredNamespaces, endOfNode, findType, headerEnd, indentAt, indentCode, indentUnit, isTrivia, lineEnding, splice } from "./syntax.ts";

export interface UsingOptions {
  /** Writes `using static namespace;`. */
  static?: boolean;
  /** Writes `global using namespace;`, placed with the other global directives. */
  global?: boolean;
  /** Writes `using alias = namespace;`. */
  alias?: string;
}

export interface FromOptions {
  /** The namespace that declares the type; its `using` is added unless the file already sees it. */
  from?: string;
}

interface Directive {
  readonly node: Node;
  readonly global: boolean;
  readonly static: boolean;
  readonly alias: string | undefined;
  readonly target: string;
}

function directive(node: Node): Directive {
  const alias = node.childForFieldName("name");
  const target = node.namedChildren.filter((child) => child.id !== alias?.id && child.type !== "comment").at(-1)!;
  return {
    node,
    global: node.children.some((child) => child.type === "global"),
    static: node.children.some((child) => child.type === "static"),
    alias: alias?.text,
    target: compact(target.text),
  };
}

function directivesIn(container: Node): Directive[] {
  return container.namedChildren.filter((child) => child.type === "using_directive").map(directive);
}

/** The block namespaces of the file that hold directives, each with its directives. */
function namespaceDirectives(container: Node): Directive[][] {
  const found: Directive[][] = [];
  for (const child of container.namedChildren) {
    if (child.type !== "namespace_declaration") continue;
    const body = child.childForFieldName("body");
    if (body === null) continue;
    const own = directivesIn(body);
    if (own.length > 0) found.push(own);
    found.push(...namespaceDirectives(body));
  }
  return found;
}

/** Where a directive goes when the file has none: at the top, after any leading comment. */
function topOfFile(text: string, root: Node): number {
  let at = 0;
  for (const child of root.children) {
    if (child.type !== "comment") break;
    const newline = text.indexOf("\n", child.endIndex);
    at = newline === -1 ? text.length : newline + 1;
  }
  return at;
}

function usingLine(namespace: string, options: UsingOptions): string {
  const alias = options.alias === undefined ? "" : `${options.alias} = `;
  return `${options.global === true ? "global " : ""}using ${options.static === true ? "static " : ""}${alias}${namespace};`;
}

/** The text with the directive added by the placement rules of A-109, or `undefined` when it is already there. */
function withUsing(op: string, text: string, namespace: string, options: UsingOptions): string | undefined {
  return withTree(text, (root) => {
    const top = directivesIn(root);
    const nested = namespaceDirectives(root);
    const all = [...top, ...nested.flat()];
    const isGlobal = options.global === true;
    const isStatic = options.static === true;
    if (options.alias !== undefined) {
      const bound = all.find((d) => d.alias === options.alias && d.target !== namespace);
      if (bound !== undefined) {
        throw dialectError(`${op}(${JSON.stringify(namespace)}) — the alias \`${options.alias}\` is already bound to ${JSON.stringify(bound.target)}`);
      }
    }
    if (all.some((d) => d.target === namespace && d.alias === options.alias && d.global === isGlobal && d.static === isStatic)) {
      return undefined;
    }
    const eol = lineEnding(text);
    const line = usingLine(namespace, options);
    const after = (d: Directive) => {
      const at = endOfNode(text, d.node);
      return splice(text, at, at, eol + indentAt(text, d.node.startIndex) + line);
    };
    if (isGlobal) {
      const lastGlobal = top.filter((d) => d.global).at(-1);
      if (lastGlobal !== undefined) return after(lastGlobal);
      const first = top[0];
      if (first !== undefined) {
        return splice(text, first.node.startIndex, first.node.startIndex, line + eol + indentAt(text, first.node.startIndex));
      }
    } else if (top.length > 0) {
      return after(top.at(-1)!);
    } else if (nested.length === 1) {
      return after(nested[0]!.at(-1)!);
    }
    const at = topOfFile(text, root);
    const lead = at > 0 && !text.slice(0, at).endsWith("\n") ? eol : "";
    const blankFollows = at === text.length || /^\r?\n/.test(text.slice(at));
    return splice(text, at, at, lead + line + eol + (blankFollows ? "" : eol));
  });
}

/** Adds `using from;` unless `from` is absent or the file already sees that namespace (A-110). */
export function importNamespace(op: string, text: string, from: string | undefined): string {
  if (from === undefined) return text;
  const seen = withTree(text, (root) => {
    const declared = declaredNamespaces(root);
    if (declared.some((name) => name === from || name.startsWith(`${from}.`))) return true;
    const all = [...directivesIn(root), ...namespaceDirectives(root).flat()];
    return all.some((d) => d.target === from && d.alias === undefined && !d.static);
  });
  return seen ? text : (withUsing(op, text, from, {}) ?? text);
}

function fromOption(op: string, options: unknown): string | undefined {
  const { from } = assertOptions(op, options, ["from"]);
  if (from !== undefined) assertNamespace(op, "from", from);
  return from as string | undefined;
}

/** Validates `options`, applies `edit`, and imports `from`; an edit that returns `undefined` leaves the file as it is. */
function editType(doc: CsharpDocument, op: string, from: string | undefined, edit: (text: string, root: Node) => string | undefined): void {
  const edited = withTree(doc.text, (root) => edit(doc.text, root));
  if (edited !== undefined) doc.text = importNamespace(op, edited, from);
}

export function addUsing(doc: CsharpDocument, namespace: string, options?: UsingOptions): void {
  const op = "addUsing";
  assertNamespace(op, "namespace", namespace);
  const opts = assertOptions(op, options, ["static", "global", "alias"]) as UsingOptions;
  for (const flag of ["static", "global"] as const) {
    if (opts[flag] !== undefined && typeof opts[flag] !== "boolean") throw dialectError(`${op} — \`${flag}\` must be a boolean`);
  }
  if (opts.alias !== undefined) assertIdentifier(op, "alias", opts.alias);
  if (opts.static === true && opts.alias !== undefined) throw dialectError(`${op} — \`static\` and \`alias\` cannot be combined`);
  const edited = withUsing(op, doc.text, namespace, opts);
  if (edited !== undefined) doc.text = edited;
}

export function addBaseType(doc: CsharpDocument, typeName: string, base: string, options?: FromOptions): void {
  const op = "addBaseType";
  assertIdentifier(op, "typeName", typeName);
  assertType(op, "base", base);
  const from = fromOption(op, options);
  const written = base.trim();
  editType(doc, op, from, (text, root) => {
    const type = findType(root, op, typeName);
    const list = type.namedChildren.find((child) => child.type === "base_list");
    if (list === undefined) {
      const at = headerEnd(type);
      return splice(text, at, at, ` : ${written}`);
    }
    if (list.namedChildren.some((entry) => compact(entry.text) === compact(written))) return undefined;
    return splice(text, list.endIndex, list.endIndex, `, ${written}`);
  });
}

const MEMBER_DECLARATIONS: ReadonlySet<string> = new Set([
  "field_declaration",
  "property_declaration",
  "method_declaration",
  "constructor_declaration",
  "destructor_declaration",
  "event_declaration",
  "event_field_declaration",
  "indexer_declaration",
  "operator_declaration",
  "conversion_operator_declaration",
  "class_declaration",
  "record_declaration",
  "struct_declaration",
  "interface_declaration",
  "enum_declaration",
  "delegate_declaration",
]);

function assertMember(op: string, source: unknown): asserts source is string {
  if (typeof source !== "string") throw dialectError(`${op} — \`source\` must be a string`);
  const single = withTree(`class C {\n${source}\n}`, (root) => {
    if (root.hasError) return false;
    const members = root.namedChildren[0]?.childForFieldName("body")?.namedChildren.filter((child) => child.type !== "comment") ?? [];
    return root.namedChildren.length === 1 && members.length === 1 && MEMBER_DECLARATIONS.has(members[0]!.type);
  });
  if (!single) throw dialectError(`${op} — \`source\` must be exactly one member declaration (a field, property, method, constructor, event, indexer, operator or nested type)`);
}

export function addMember(doc: CsharpDocument, typeName: string, source: string): void {
  const op = "addMember";
  assertIdentifier(op, "typeName", typeName);
  assertMember(op, source);
  editType(doc, op, undefined, (text, root) => {
    const type = findType(root, op, typeName);
    const eol = lineEnding(text);
    const declIndent = indentAt(text, type.startIndex);
    const unit = indentUnit(text, root);
    const body = type.childForFieldName("body");
    if (body === null) {
      // A record with no body (`record A(int Id);`) gets one in place of its `;`.
      const semicolon = type.children.at(-1)!;
      const block = `${eol}${declIndent}{${eol}${indentCode(source, declIndent + unit, eol)}${eol}${declIndent}}`;
      return splice(text, semicolon.startIndex, semicolon.endIndex, block);
    }
    const named = body.namedChildren;
    const members = named.filter((child) => !isTrivia(child));
    if (members.some((member) => compact(member.text) === compact(source))) return undefined;
    const open = body.children[0]!;
    const close = body.children.at(-1)!;
    if (open.startPosition.row === close.startPosition.row) {
      const lines = [...named.map((child) => child.text), source].map((code) => indentCode(code, declIndent + unit, eol));
      return splice(text, open.endIndex, close.startIndex, eol + lines.join(eol) + eol + declIndent);
    }
    if (named.length === 0) return splice(text, open.endIndex, open.endIndex, eol + indentCode(source, declIndent + unit, eol));
    const at = endOfNode(text, named.at(-1)!);
    const memberIndent = members.length > 0 ? indentAt(text, members.at(-1)!.startIndex) : declIndent + unit;
    const blank =
      members.length >= 2
        ? /\n[ \t]*\r?\n/.test(text.slice(members.at(-2)!.endIndex, members.at(-1)!.startIndex))
        : members.length === 1 && source.trim().includes("\n");
    return splice(text, at, at, eol + (blank ? eol : "") + indentCode(source, memberIndent, eol));
  });
}

export function addConstructorParameter(doc: CsharpDocument, typeName: string, name: string, type: string, options?: FromOptions): void {
  const op = "addConstructorParameter";
  assertIdentifier(op, "typeName", typeName);
  assertIdentifier(op, "name", name);
  assertType(op, "type", type);
  const from = fromOption(op, options);
  const parameter = `${type.trim()} ${name}`;
  editType(doc, op, from, (text, root) => {
    const target = findType(root, op, typeName);
    const label = `${op}(${JSON.stringify(typeName)})`;
    if (target.type === "interface_declaration") throw dialectError(`${label} — an interface has no constructor`);
    const explicit = target
      .childForFieldName("body")
      ?.namedChildren.some((member) => member.type === "constructor_declaration" && !member.children.some((m) => m.text === "static"));
    if (explicit === true) {
      throw dialectError(`${label} — \`${typeName}\` has an explicit constructor; only a primary constructor is edited, use .modify() for this type`);
    }
    const list = target.namedChildren.find((child) => child.type === "parameter_list");
    if (list === undefined) {
      const at = headerEnd(target);
      return splice(text, at, at, `(${parameter})`);
    }
    const params = list.namedChildren.filter((child) => child.type === "parameter");
    const same = params.find((p) => p.childForFieldName("name")?.text === name);
    if (same !== undefined) {
      if (compact(same.childForFieldName("type")?.text ?? "") === compact(type)) return undefined;
      throw dialectError(`${label} — a parameter \`${name}\` of type \`${same.childForFieldName("type")?.text}\` is already declared`);
    }
    const last = params.at(-1);
    if (last === undefined) return splice(text, list.startIndex + 1, list.startIndex + 1, parameter);
    const separator = last.startPosition.row > list.startPosition.row ? `,${lineEnding(text)}${indentAt(text, last.startIndex)}` : ", ";
    return splice(text, last.endIndex, last.endIndex, separator + parameter);
  });
}
