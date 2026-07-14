// S-002: the `addImport` structured op (REQ-TSD-01, frozen call signature
// `addImport(name: string, from: string)`, design §4.4). Merges into an existing
// same-module named-import clause when present (REQ-TSD-01.2/03.10), otherwise inserts a
// fresh `import { name } from "from";` declaration.
//
// S-001: `addFunction` (REQ-TSD-09) + the shared `assertNoCollision` predicate it (and
// S-003's addVariable/addClass) reuse (design §4.5 ADR-0039).
//
// S-003: `addVariable` (REQ-TSD-10) + `addClass` (REQ-TSD-11) — same insert-mechanism and
// collision rule as addFunction, different declaration kinds.

import type { SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";

/**
 * Adds `import { name } from "from";` to the file, or merges `name` into an EXISTING
 * named-import clause from the SAME module if one already exists. Idempotent: calling this
 * twice with the same `name`+`from` produces a single import line, never a duplicate
 * (REQ-TSD-03.10).
 */
export function addImport(ast: SourceFile, name: string, from: string): void {
  const existing = ast.getImportDeclaration((decl) => decl.getModuleSpecifierValue() === from);
  if (existing !== undefined) {
    const alreadyPresent = existing.getNamedImports().some((namedImport) => namedImport.getName() === name);
    if (!alreadyPresent) {
      existing.addNamedImport(name);
    }
    return;
  }
  ast.addImportDeclaration({ moduleSpecifier: from, namedImports: [name] });
}

// Shared `{ export?: boolean }` shape across addFunction/addVariable/addClass — addVariable
// composes it with its own extra `kind` member.
type DeclarationOptions = { export?: boolean };

function exportPrefixFor(options?: DeclarationOptions): string {
  return options?.export === true ? "export " : "";
}

// ADR-0039 collision-namespace pin (owner ruling #4): a VALUE-namespace declaration
// (function/const/let/var/class) OR a named-import binding under `name` collides,
// cross-kind; `type`/`interface` are exempt (legal TS coexistence). Syntactic search only
// (no language service, per REQ-TSD-02.3's own no-LS commitment) — SourceFile-wide, not
// scope-aware (matches the "no language service needed" owner framing; every signed
// scenario seeds top-level declarations only).
//
// `handlePathFor(ast)` (final-verify fix, dialect-handle.ts) is the ONLY channel through
// which an op function can recover the author-facing path for its own dialectError()-branded
// message (design §4.4's pinned "on {path}" clause) — position-independent (keyed by the
// live AST instance, not a runtime argument position), so it can never collide with `name`/
// `options` regardless of which trailing args the author omitted.
function assertNoCollision(ast: SourceFile, name: string, opName: string): void {
  const collides =
    ast.getFunction(name) !== undefined ||
    ast.getVariableDeclaration(name) !== undefined ||
    ast.getClass(name) !== undefined ||
    // Judgment-day round 1 (Issue 3): enum and namespace declarations also occupy the
    // value namespace (TypeScript rejects `enum Foo {}` / `namespace Foo {}` coexisting
    // with a same-named function/const/class — TS2451) — missing these two let addFunction/
    // addVariable/addClass emit invalid TS instead of rejecting.
    ast.getEnum(name) !== undefined ||
    ast.getModule(name) !== undefined ||
    ast
      .getImportDeclarations()
      .some((decl) =>
        decl.getNamedImports().some((named) => (named.getAliasNode()?.getText() ?? named.getName()) === name)
      );
  if (!collides) return;
  throw dialectError(
    `${opName}("${name}") on "${handlePathFor(ast)}" — a value or import binding named "${name}" already exists; ` +
      `TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, or edit it with .modify().`
  );
}

/**
 * Inserts a new top-level function declaration `{export }function {name}{source}` at the
 * end of the file, in call order (ts-morph `addStatements`, REQ-TSD-09). Rejects with a
 * pinned `dialectError` when a value-namespace declaration or import binding already
 * exists under `name` (ADR-0039) — `type`/`interface` are exempt.
 *
 * `source` INCLUDES the function's `{ … }` braces — contrast `addClass`, whose `source`
 * EXCLUDES them (the op supplies the braces itself).
 *
 * @example
 * // source includes braces:
 * ts.find(path).addFunction("hi", "(): void {}"); // -> function hi(): void {}
 * // contrast addClass, whose source EXCLUDES braces (the op adds them).
 */
export function addFunction(ast: SourceFile, name: string, source: string, options?: DeclarationOptions): void {
  assertNoCollision(ast, name, "addFunction");
  ast.addStatements(`${exportPrefixFor(options)}function ${name}${source}`);
}

/**
 * Inserts a new top-level variable declaration `{export }{kind} {name} = {initializer};` at
 * the end of the file, in call order (ts-morph `addStatements`, REQ-TSD-10). `kind` defaults
 * to `"const"`. Rejects with a pinned `dialectError` under the SAME collision-namespace rule
 * as `addFunction` (ADR-0039) — `type`/`interface` are exempt.
 *
 * @example
 * ts.find(path).addVariable("PI", "3.14159"); // -> const PI = 3.14159;
 * ts.find(path).addVariable("counter", "0", { export: true, kind: "let" }); // -> export let counter = 0;
 */
export function addVariable(
  ast: SourceFile,
  name: string,
  initializer: string,
  options?: DeclarationOptions & { kind?: "const" | "let" | "var" }
): void {
  assertNoCollision(ast, name, "addVariable");
  const kind = options?.kind ?? "const";
  ast.addStatements(`${exportPrefixFor(options)}${kind} ${name} = ${initializer};`);
}

/**
 * Inserts a new top-level class declaration `{export }class {name} {\n{source}\n}` at the
 * end of the file, in call order (ts-morph `addStatements`, REQ-TSD-11). Rejects with a
 * pinned `dialectError` under the SAME collision-namespace rule as `addFunction` (ADR-0039)
 * — `type`/`interface` are exempt.
 *
 * `source` EXCLUDES the class's `{ … }` braces — contrast `addFunction`, whose `source`
 * INCLUDES them (that op supplies no braces of its own; this one does).
 *
 * @example
 * // source excludes braces:
 * ts.find(path).addClass("Point", "  x = 0;"); // -> class Point {\n  x = 0;\n}
 * // contrast addFunction, whose source INCLUDES braces (the op does NOT add them itself).
 */
export function addClass(ast: SourceFile, name: string, source: string, options?: DeclarationOptions): void {
  assertNoCollision(ast, name, "addClass");
  ast.addStatements(`${exportPrefixFor(options)}class ${name} {\n${source}\n}`);
}

/**
 * Removes the named binding from `from`'s import clause (REQ-TSD-08). Idempotent: an
 * absent binding is a no-op. Removing the LAST named binding deletes the entire import
 * statement — no dangling `import {} from "from"`. Matched by the module-EXPORTED name,
 * not the local alias (`{ readFileSync as rf }` is matched by `"readFileSync"`). Scope:
 * NAMED-binding imports only — default and namespace imports are untouched, and a
 * declaration mixing a default/namespace import alongside named bindings is never
 * whole-statement-deleted (only the matched named specifier is removed).
 *
 * Judgment-day round 1 (Issue 2): a module can be imported via SEVERAL separate
 * declarations (`import { a } from "m"; import { b } from "m";`, legal TS) — this walks
 * every declaration matching `from`, not just the first, and operates on whichever one
 * actually contains `name`. Sibling declarations from the same module are never touched.
 */
export function removeImport(ast: SourceFile, name: string, from: string): void {
  const decls = ast.getImportDeclarations().filter((d) => d.getModuleSpecifierValue() === from);
  for (const decl of decls) {
    const namedImports = decl.getNamedImports();
    const specifier = namedImports.find((named) => named.getName() === name);
    if (specifier === undefined) continue;
    const isLastNamedBindingOnly =
      namedImports.length === 1 && decl.getDefaultImport() === undefined && decl.getNamespaceImport() === undefined;
    if (isLastNamedBindingOnly) {
      decl.remove();
    } else {
      specifier.remove();
    }
    return;
  }
}
