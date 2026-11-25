import { dialectError } from "../../../../domain/valueobjects/dialect-error.ts";
import { withTree } from "./ast.ts";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

// The reserved keywords of C#. Contextual keywords (`var`, `async`, `record`, ...) are valid names.
const KEYWORDS: ReadonlySet<string> = new Set(
  (
    "abstract as base bool break byte case catch char checked class const continue decimal default delegate do " +
    "double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface " +
    "internal is lock long namespace new null object operator out override params private protected public readonly " +
    "ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint " +
    "ulong unchecked unsafe ushort using virtual void volatile while"
  ).split(" ")
);

const TYPE_NODES: ReadonlySet<string> = new Set([
  "identifier",
  "qualified_name",
  "alias_qualified_name",
  "generic_name",
  "predefined_type",
  "nullable_type",
  "array_type",
  "tuple_type",
]);

/** Rejects `value` for the argument `argument` of `op`, quoting it as the rules phrase it. */
function refuse(op: string, argument: string, value: unknown, why: string): never {
  throw dialectError(`${op} — \`${argument}\` ${JSON.stringify(value)} is ${why}`);
}

export function assertIdentifier(op: string, argument: string, value: unknown): asserts value is string {
  if (typeof value !== "string") throw dialectError(`${op} — \`${argument}\` must be a string`);
  if (!IDENTIFIER.test(value)) refuse(op, argument, value, "not a C# identifier (letters, digits and _, not starting with a digit)");
  if (KEYWORDS.has(value)) refuse(op, argument, value, "a reserved keyword of C#");
}

export function assertNamespace(op: string, argument: string, value: unknown): asserts value is string {
  if (typeof value !== "string") throw dialectError(`${op} — \`${argument}\` must be a string`);
  const parts = value.split(".");
  if (!parts.every((part) => IDENTIFIER.test(part))) refuse(op, argument, value, "not a namespace (identifiers joined by dots)");
  if (parts.some((part) => KEYWORDS.has(part))) refuse(op, argument, value, "a namespace with a reserved keyword of C#");
}

/** A type must parse as exactly one C# type: a name, qualified, generic, nullable, array or tuple type. */
export function assertType(op: string, argument: string, value: unknown): asserts value is string {
  if (typeof value !== "string") throw dialectError(`${op} — \`${argument}\` must be a string`);
  const type = value.trim();
  const single =
    type.length > 0 &&
    withTree(`class C { ${type} f; }`, (root) => {
      if (root.hasError || root.descendantsOfType("comment").length > 0) return false;
      const members = root.namedChildren[0]?.childForFieldName("body")?.namedChildren ?? [];
      const node = members.length === 1 ? members[0]!.namedChildren[0]?.childForFieldName("type") : undefined;
      return node !== null && node !== undefined && TYPE_NODES.has(node.type) && node.text === type;
    });
  if (!single) refuse(op, argument, value, "not exactly one C# type");
}

export function assertOptions(op: string, value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw dialectError(`${op} — \`options\` must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw dialectError(`${op} — \`options\` must hold only ${allowed.map((k) => `\`${k}\``).join(", ")}`);
  }
  return value as Record<string, unknown>;
}

/** Text with every whitespace removed, to compare code as written ignoring whitespace. */
export function compact(text: string): string {
  return text.replace(/\s+/g, "");
}
