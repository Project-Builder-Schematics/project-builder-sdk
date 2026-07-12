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

// ADR-0039 collision-namespace pin (owner ruling #4): a VALUE-namespace declaration
// (function/const/let/var/class) OR a named-import binding under `name` collides,
// cross-kind; `type`/`interface` are exempt (legal TS coexistence). Syntactic search only
// (no language service, per REQ-TSD-02.3's own no-LS commitment) — SourceFile-wide, not
// scope-aware (matches the "no language service needed" owner framing; every signed
// scenario seeds top-level declarations only).
//
// `handlePath` is the S-001 trailing-arg addition threaded by dialect-handle.ts's runOp
// (see its own doc comment) — the ONLY channel through which an op function can recover
// the author-facing path for its own dialectError()-branded message (design §4.4's
// pinned "on {path}" clause).
function assertNoCollision(ast: SourceFile, name: string, opName: string, handlePath: string): void {
  const collides =
    ast.getFunction(name) !== undefined ||
    ast.getVariableDeclaration(name) !== undefined ||
    ast.getClass(name) !== undefined ||
    ast
      .getImportDeclarations()
      .some((decl) =>
        decl.getNamedImports().some((named) => (named.getAliasNode()?.getText() ?? named.getName()) === name)
      );
  if (!collides) return;
  throw dialectError(
    `${opName}("${name}") on "${handlePath}" — a value or import binding named "${name}" already exists; ` +
      `TypeScript forbids two value declarations sharing a name. Rename or remove the existing one, or edit it with .raw().`
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
 * ast.find(path).addFunction("hi", "(): void {}"); // -> function hi(): void {}
 * // contrast addClass, whose source EXCLUDES braces (the op adds them).
 */
export function addFunction(
  ast: SourceFile,
  name: string,
  source: string,
  options?: { export?: boolean },
  handlePath?: string
): void {
  assertNoCollision(ast, name, "addFunction", handlePath!);
  const exportPrefix = options?.export === true ? "export " : "";
  ast.addStatements(`${exportPrefix}function ${name}${source}`);
}

/**
 * Inserts a new top-level variable declaration `{export }{kind} {name} = {initializer};` at
 * the end of the file, in call order (ts-morph `addStatements`, REQ-TSD-10). `kind` defaults
 * to `"const"`. Rejects with a pinned `dialectError` under the SAME collision-namespace rule
 * as `addFunction` (ADR-0039) — `type`/`interface` are exempt.
 *
 * @example
 * ast.find(path).addVariable("PI", "3.14159"); // -> const PI = 3.14159;
 * ast.find(path).addVariable("counter", "0", { export: true, kind: "let" }); // -> export let counter = 0;
 */
export function addVariable(
  ast: SourceFile,
  name: string,
  initializer: string,
  options?: { export?: boolean; kind?: "const" | "let" | "var" },
  handlePath?: string
): void {
  assertNoCollision(ast, name, "addVariable", handlePath!);
  const exportPrefix = options?.export === true ? "export " : "";
  const kind = options?.kind ?? "const";
  ast.addStatements(`${exportPrefix}${kind} ${name} = ${initializer};`);
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
 * ast.find(path).addClass("Point", "  x = 0;"); // -> class Point {\n  x = 0;\n}
 * // contrast addFunction, whose source INCLUDES braces (the op does NOT add them itself).
 */
export function addClass(
  ast: SourceFile,
  name: string,
  source: string,
  options?: { export?: boolean },
  handlePath?: string
): void {
  assertNoCollision(ast, name, "addClass", handlePath!);
  const exportPrefix = options?.export === true ? "export " : "";
  ast.addStatements(`${exportPrefix}class ${name} {\n${source}\n}`);
}

/**
 * Removes the named binding from `from`'s import clause (REQ-TSD-08). Idempotent: an
 * absent binding is a no-op. Removing the LAST named binding deletes the entire import
 * statement — no dangling `import {} from "from"`. Matched by the module-EXPORTED name,
 * not the local alias (`{ readFileSync as rf }` is matched by `"readFileSync"`). Scope:
 * NAMED-binding imports only — default and namespace imports are untouched, and a
 * declaration mixing a default/namespace import alongside named bindings is never
 * whole-statement-deleted (only the matched named specifier is removed).
 */
export function removeImport(ast: SourceFile, name: string, from: string): void {
  const decl = ast.getImportDeclaration((d) => d.getModuleSpecifierValue() === from);
  if (decl === undefined) return;
  const specifier = decl.getNamedImports().find((named) => named.getName() === name);
  if (specifier === undefined) return;
  const isLastNamedBindingOnly =
    decl.getNamedImports().length === 1 && decl.getDefaultImport() === undefined && decl.getNamespaceImport() === undefined;
  if (isLastNamedBindingOnly) {
    decl.remove();
  } else {
    specifier.remove();
  }
}
