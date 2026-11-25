import type { Node } from "web-tree-sitter";
import { dialectError } from "../../../../domain/valueobjects/dialect-error.ts";
import { withTree, type CsharpDocument } from "../csharp/ast.ts";
import { assertIdentifier, assertNamespace, assertOptions, assertType, compact } from "../csharp/names.ts";
import { importNamespace } from "../csharp/ops.ts";
import { endOfNode, indentAt, indentUnit, isTrivia, lineEnding, splice } from "../csharp/syntax.ts";

export type Lifetime = "Singleton" | "Scoped" | "Transient";

export interface ServiceOptions {
  /** The namespace that declares the service type; its `using` is added unless the file already sees it. */
  serviceFrom?: string;
  /** The namespace that declares the implementation type, imported like `serviceFrom`. */
  implementationFrom?: string;
  /** Edits the one `static` method of this name whose first parameter is `this IServiceCollection`. */
  method?: string;
}

const LIFETIMES: readonly string[] = ["Singleton", "Scoped", "Transient"];
const BUILDER_FACTORIES: ReadonlySet<string> = new Set(["CreateBuilder", "CreateSlimBuilder", "CreateEmptyBuilder"]);

/** Where the registrations live: the statements searched for one already there, and where a new one goes. */
interface Place {
  readonly receiver: string;
  readonly statements: readonly Node[];
  /** Inserts `line` into `text` at this place. */
  readonly insert: (text: string, line: string) => string;
}

interface Registration {
  readonly lifetime: string;
  readonly service: string;
  readonly implementation: string;
}

/** `<receiver>.Add<Lifetime><Service, Implementation>();` as a registration, or `undefined`. */
function registration(statement: Node, receiver: string): Registration | undefined {
  if (statement.type !== "expression_statement") return undefined;
  const call = statement.namedChildren[0];
  const callee = call?.type === "invocation_expression" ? call.childForFieldName("function") : null;
  if (callee?.type !== "member_access_expression" || compact(callee.childForFieldName("expression")!.text) !== receiver) return undefined;
  const generic = callee.childForFieldName("name")!;
  const lifetime = /^Add(Singleton|Scoped|Transient)$/.exec(generic.namedChildren[0]?.text ?? "")?.[1];
  const types = generic.namedChildren[1]?.namedChildren ?? [];
  if (generic.type !== "generic_name" || lifetime === undefined || types.length !== 2) return undefined;
  return { lifetime, service: compact(types[0]!.text), implementation: compact(types[1]!.text) };
}

function isBuilderCall(value: Node | null): boolean {
  const callee = value?.type === "invocation_expression" ? value.childForFieldName("function") : null;
  return (
    callee?.type === "member_access_expression" &&
    callee.childForFieldName("expression")!.text === "WebApplication" &&
    BUILDER_FACTORIES.has(callee.childForFieldName("name")!.text)
  );
}

function callsBuild(statement: Node, builder: string): boolean {
  return statement.descendantsOfType("invocation_expression").some((call) => {
    const callee = call!.childForFieldName("function");
    return (
      callee?.type === "member_access_expression" &&
      callee.childForFieldName("expression")!.text === builder &&
      callee.childForFieldName("name")!.text === "Build"
    );
  });
}

/** The top-level statements: the builder, and the line after the last statement before the one calling `Build()`. */
function programPlace(op: string, root: Node): Place {
  const statements = root.namedChildren.filter((child) => child.type === "global_statement").map((child) => child.namedChildren[0]!);
  const builders = statements.flatMap((statement) =>
    statement.type === "local_declaration_statement"
      ? statement.descendantsOfType("variable_declarator").filter((d) => isBuilderCall(d!.namedChildren.at(-1) ?? null))
      : []
  );
  if (builders.length !== 1) {
    throw dialectError(
      `${op} — the top-level statements need exactly one variable initialized by WebApplication.CreateBuilder, CreateSlimBuilder or CreateEmptyBuilder; found ${builders.length}. Pass \`method\` to edit a service collection extension method instead`
    );
  }
  const builder = builders[0]!.childForFieldName("name")!.text;
  const build = statements.findIndex((statement) => callsBuild(statement, builder));
  if (build < 1) throw dialectError(`${op} — no top-level statement after the builder calls \`${builder}.Build()\``);
  const before = statements[build - 1]!;
  return {
    receiver: `${builder}.Services`,
    statements,
    insert: (source, line) => {
      const at = endOfNode(source, before);
      return splice(source, at, at, lineEnding(source) + indentAt(source, before.startIndex) + line);
    },
  };
}

function isServiceCollectionExtension(method: Node): boolean {
  if (!method.children.some((child) => child.type === "modifier" && child.text === "static")) return false;
  const first = method.childForFieldName("parameters")?.namedChildren.find((child) => child.type === "parameter");
  const isThis = first?.children.some((child) => child.type === "modifier" && child.text === "this") === true;
  return isThis && /(^|\.)IServiceCollection$/.test(compact(first!.childForFieldName("type")?.text ?? ""));
}

/** The one `static` method `name(this IServiceCollection ...)`: before its last statement when that is a `return`, else after it. */
function methodPlace(op: string, root: Node, name: string): Place {
  const methods = root
    .descendantsOfType("method_declaration")
    .filter((method) => method!.childForFieldName("name")!.text === name && isServiceCollectionExtension(method!)) as Node[];
  if (methods.length !== 1) {
    throw dialectError(`${op} — the file needs exactly one static method \`${name}\` whose first parameter is \`this IServiceCollection\`; found ${methods.length}`);
  }
  const method = methods[0]!;
  const body = method.childForFieldName("body");
  if (body?.type !== "block") throw dialectError(`${op} — \`${name}\` has an expression body; edit it with .modify()`);
  const receiver = method.childForFieldName("parameters")!.namedChildren.find((child) => child.type === "parameter")!.childForFieldName("name")!.text;
  const statements = body.namedChildren.filter((child) => !isTrivia(child));
  const last = statements.at(-1);
  const insert = (source: string, line: string): string => {
    const eol = lineEnding(source);
    if (last === undefined) {
      const open = body.children[0]!;
      return splice(source, open.endIndex, open.endIndex, eol + indentAt(source, method.startIndex) + indentUnit(source, root) + line);
    }
    const indent = indentAt(source, last.startIndex);
    if (last.type === "return_statement") return splice(source, last.startIndex, last.startIndex, line + eol + indent);
    const at = endOfNode(source, last);
    return splice(source, at, at, eol + indent + line);
  };
  return { receiver, statements, insert };
}

export function addService(doc: CsharpDocument, lifetime: Lifetime, service: string, implementation: string, options?: ServiceOptions): void {
  const op = "addService";
  if (typeof lifetime !== "string" || !LIFETIMES.includes(lifetime)) {
    throw dialectError(`${op} — \`lifetime\` ${JSON.stringify(lifetime)} is not a lifetime; use "Singleton", "Scoped" or "Transient"`);
  }
  assertType(op, "service", service);
  assertType(op, "implementation", implementation);
  const opts = assertOptions(op, options, ["serviceFrom", "implementationFrom", "method"]) as ServiceOptions;
  if (opts.serviceFrom !== undefined) assertNamespace(op, "serviceFrom", opts.serviceFrom);
  if (opts.implementationFrom !== undefined) assertNamespace(op, "implementationFrom", opts.implementationFrom);
  if (opts.method !== undefined) assertIdentifier(op, "method", opts.method);
  const edited = withTree(doc.text, (root) => {
    const place = opts.method === undefined ? programPlace(op, root) : methodPlace(op, root, opts.method);
    const receiver = compact(place.receiver);
    const existing = place.statements
      .map((statement) => registration(statement, receiver))
      .find((r) => r !== undefined && r.service === compact(service) && r.implementation === compact(implementation));
    if (existing?.lifetime === lifetime) return undefined;
    if (existing !== undefined) {
      throw dialectError(`${op}(${JSON.stringify(service)}) — \`${service}\` is already registered with \`${implementation}\` as ${existing.lifetime}, not ${lifetime}`);
    }
    return place.insert(doc.text, `${place.receiver}.Add${lifetime}<${service.trim()}, ${implementation.trim()}>();`);
  });
  if (edited === undefined) return;
  doc.text = importNamespace(op, importNamespace(op, edited, opts.serviceFrom), opts.implementationFrom);
}
