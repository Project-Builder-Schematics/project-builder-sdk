// S-001: the single validate-before-mutate chokepoint (design §4.4/ADR-02) — three per-arg
// grammars, a frozen denylist, and `validatedOp`, the higher-order wrapper every react op
// composes with so mutation code (`body`) is structurally unreachable before every declared
// arg validates. Kit-internal: no barrel/subpath export (dialect-error.ts/deep-equal.ts
// precedent — see src/core/index.ts, which does not re-export this module).
//
// Set-key-safety clause (ADR-02): `propName`/`elementName` are NEVER used as plain-object
// keys anywhere in this file or src/dialects/react/** — no `record[name]`, no `{[name]: …}`,
// no `counts[tag]++`. Set/Map/`===` only. This, not denylist width, is the real Stage-4b
// `__proto__` defence (test/dialects/react/name-validation.test.ts pins it via static scan).

import { dialectError } from "./dialect-error.ts";
import { boundedFragment, nameRuleTail } from "./reject-tail.ts";

/** Frozen V4 denylist — `.has()` equality only, NEVER an object literal, never regex-encoded. */
export const JSX_NAME_DENYLIST: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

// V5 (REQ-RXD-06, SEC-1): `IMPORT_BINDING_GRAMMAR` alone admits any `IdentifierName`, not a
// `BindingIdentifier` — `import { name }` requires the latter. This frozen 46-word set (36
// always-reserved ECMAScript keywords + 9 strict-mode-reserved words + `await`, which is
// reserved unconditionally here because `addImport` always emits into an ES module, and ES
// modules are always strict) closes that gap. `.has()` equality only — never regex-encoded —
// same mechanism as `JSX_NAME_DENYLIST`.
export const IMPORT_RESERVED_WORDS: ReadonlySet<string> = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
  "else", "enum", "export", "extends", "false", "finally", "for", "function", "if", "import", "in",
  "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with",
  "implements", "interface", "let", "package", "private", "protected", "public", "static", "yield",
  "await",
]);

// Verbatim from the shared contract (slices.md rev 2, "Name grammars + denylist"):
// - attribute name: letters/digits/underscore/hyphen, one optional `:namespace` segment.
// - element name (lookup-only, never spliced): identifier-or-hyphenated segments, dot-joined
//   (admits `Button`, `Menu.Item`, `my-web-component`).
// - import binding: a plain JS identifier (no alias handling).
const ATTRIBUTE_NAME_GRAMMAR = /^[A-Za-z_][A-Za-z0-9_-]*(:[A-Za-z_][A-Za-z0-9_-]*)?$/;
const ELEMENT_NAME_GRAMMAR = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
const IMPORT_BINDING_GRAMMAR = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Denylist reject: MAY echo the fixed literal (it's the rule's own vocabulary, not author
// data, and every denylisted name is well under the 16-char `boundedFragment` ceiling).
function assertNotDenylisted(argName: string, value: string): void {
  if (!JSX_NAME_DENYLIST.has(value)) return;
  throw dialectError(
    `\`${argName}\` "${boundedFragment(value)}" is a reserved name and cannot be used — fix the name, ` +
      "or use `.modify()` to make this edit directly."
  );
}

// Reserved-word reject (V5, SEC-1): exact Set membership only, never substring/prefix — a
// name that merely CONTAINS a reserved word (`classroom`, `imported`, `defaultValue`) passes.
function assertNotReservedWord(argName: string, value: string): void {
  if (!IMPORT_RESERVED_WORDS.has(value)) return;
  throw dialectError(
    `\`${argName}\` "${boundedFragment(value)}" is a reserved word and cannot be used as an import ` +
      "binding — fix the name, or use `.modify()` to make this edit directly."
  );
}

// Grammar reject: routes through `nameRuleTail` — default ZERO echo of the rejected value.
function assertGrammar(argName: string, value: string, grammar: RegExp, ruleLabel: string): void {
  if (grammar.test(value)) return;
  throw dialectError(nameRuleTail(argName, ruleLabel));
}

/** `assertValidAttributeName`'s propName grammar — hyphens + one optional `:namespace` segment. */
export function assertValidAttributeName(propName: string): void {
  assertGrammar(
    "propName",
    propName,
    ATTRIBUTE_NAME_GRAMMAR,
    "match the attribute-name grammar (letters, digits, underscore, and hyphen, with one optional `:namespace` segment)"
  );
  assertNotDenylisted("propName", propName);
}

/** `assertValidElementName`'s lookup-only JSX-name grammar — identifier/hyphenated, dot-joined. */
export function assertValidElementName(elementName: string): void {
  assertGrammar(
    "elementName",
    elementName,
    ELEMENT_NAME_GRAMMAR,
    "match the JSX element-name grammar (identifier or hyphenated segments, optionally joined by `.`)"
  );
  assertNotDenylisted("elementName", elementName);
}

/**
 * `assertValidImportBinding`'s plain-JS-identifier grammar. The regex alone admits any
 * `IdentifierName` (including reserved words) — `import { name }` requires a `BindingIdentifier`,
 * so a reserved-word check (V5, SEC-1) runs alongside the denylist.
 */
export function assertValidImportBinding(name: string): void {
  assertGrammar("name", name, IMPORT_BINDING_GRAMMAR, "be a valid JavaScript identifier");
  assertNotReservedWord("name", name);
  assertNotDenylisted("name", name);
}

/**
 * The single validate-before-mutate chokepoint (ADR-02): `validators` runs first over the
 * op's full argument tuple and throws via `dialectError` on any failure — `body` (the actual
 * mutation) is structurally unreachable before every declared arg validates.
 */
export function validatedOp<Ast, A extends unknown[]>(
  validators: (args: A) => void,
  body: (ast: Ast, ...args: A) => void
): (ast: Ast, ...args: A) => void {
  return (ast: Ast, ...args: A) => {
    validators(args);
    body(ast, ...args);
  };
}
