// S-002: the `addImport` structured op (REQ-TSD-01, frozen call signature
// `addImport(name: string, from: string)`, design §4.4).
//
// S-001: `addFunction` (REQ-TSD-09) + the shared `assertNoCollision` predicate it (and
// S-003's addVariable/addClass) reuse (design §4.5 ADR-0039).
//
// S-003: `addVariable` (REQ-TSD-10) + `addClass` (REQ-TSD-11) — same insert-mechanism and
// collision rule as addFunction, different declaration kinds.
//
// ts-addimport-collision/S-000: `addImport`'s original naive first-match unconditional
// merge is REPLACED by the V8 four-branch algorithm ported from the react leaf verbatim
// (`react/ops.ts:81-234`, design §4.1/§4.3) — idempotency (Step 1) -> merge (Step 3) ->
// create (Step 4). Step 2 (file-wide collision reject) is DEFERRED to S-001.

import { SyntaxKind, type ImportDeclaration, type SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";

// Ported verbatim from `react/ops.ts` (design §4.3 data model) — a bound name, tagged with
// enough shape to answer "does this SAME-MODULE binding satisfy idempotency" (Step 1). The
// file-wide CLAIMED half (Step 2, `isValueNamespaceClaimed`) lands in S-001.
interface BoundName {
  localName: string;
  kind: "default" | "namespace" | "named";
  aliased: boolean;
  valueBound: boolean;
}

// Collects every local name a single declaration binds, across all three clause shapes at
// once (a declaration can carry a default AND a named clause simultaneously, e.g.
// `import Def, { B } from "m"`). Set-key-safety clause: names are compared via
// `.includes()`/`===` on plain arrays, NEVER used as an object/Map key.
function boundNamesIn(decl: ImportDeclaration): BoundName[] {
  const declTypeOnly = decl.isTypeOnly();
  const names: BoundName[] = [];
  const defaultImport = decl.getDefaultImport();
  if (defaultImport !== undefined) {
    names.push({ localName: defaultImport.getText(), kind: "default", aliased: false, valueBound: !declTypeOnly });
  }
  const namespaceImport = decl.getNamespaceImport();
  if (namespaceImport !== undefined) {
    names.push({
      localName: namespaceImport.getText(),
      kind: "namespace",
      aliased: false,
      valueBound: !declTypeOnly,
    });
  }
  for (const specifier of decl.getNamedImports()) {
    const alias = specifier.getAliasNode();
    names.push({
      localName: alias !== undefined ? alias.getText() : specifier.getName(),
      kind: "named",
      aliased: alias !== undefined,
      valueBound: !declTypeOnly && !specifier.isTypeOnly(),
    });
  }
  return names;
}

// Step 1's idempotency-satisfying shape: a value-bound default specifier, a value-bound
// namespace specifier, or a value-bound UNALIASED named specifier. An aliased named
// specifier's local name identifies a DIFFERENT export and a type-only binding at either
// granularity does not satisfy the value-binding promise — neither counts here.
function satisfiesIdempotency(bound: BoundName): boolean {
  if (!bound.valueBound) return false;
  return bound.kind !== "named" || !bound.aliased;
}

// A valid MERGE target (Step 3) is a declaration that (a) is NOT type-only and (b) has a
// `NamedImports` clause node — whether or not it already carries specifiers. A default-only
// or namespace-only declaration has no `NamedImports` node at all: TS/JS syntax forbids
// grafting a named clause onto a namespace import, and grafting one onto a default-only
// declaration would silently widen an existing statement the author did not ask this op to
// touch — so neither is a merge target, matching a FRESH separate declaration instead
// (Step 4).
function isNonTypeOnlyNamedImportClause(decl: ImportDeclaration): boolean {
  if (decl.isTypeOnly()) return false;
  const namedBindings = decl.getImportClause()?.getNamedBindings();
  return namedBindings !== undefined && namedBindings.getKind() === SyntaxKind.NamedImports;
}

/**
 * Adds `import { name } from "from";`, or merges `name` into an EXISTING NAMED-import
 * clause from the SAME module `from` if one already exists (REQ-TSD-01, S-000 subset —
 * Steps 1/3/4 only; Step 2's file-wide collision reject lands in S-001):
 *
 * 1. Already-bound (idempotency, SAME module only): if an EXISTING declaration for `from`
 *    has a VALUE-BOUND specifier whose local name equals `name`, AND that specifier is a
 *    default specifier, a namespace specifier, or an UNALIASED named specifier — this is a
 *    no-op.
 * 2. Merge: otherwise, if an EXISTING declaration for `from` has a non-type-only
 *    named-import clause, add a NEW, UNALIASED named specifier to it.
 * 3. Create: otherwise (no declaration for `from`; every one is type-only, default-only, or
 *    namespace-only), INSERT a FRESH, SEPARATE `import { name } from "from";` — a
 *    type-only, default-only, or namespace-only declaration's clause structure is NEVER
 *    mutated to graft a named binding onto it.
 *
 * Idempotent: calling this twice with the same `name`+`from` produces a single import line,
 * never a duplicate (REQ-TSD-03.10).
 */
export function addImport(ast: SourceFile, name: string, from: string): void {
  const declarationsForModule = ast
    .getImportDeclarations()
    .filter((decl) => decl.getModuleSpecifierValue() === from);

  const alreadyBound = declarationsForModule.some((decl) =>
    boundNamesIn(decl).some((bound) => bound.localName === name && satisfiesIdempotency(bound))
  );
  if (alreadyBound) return;

  const mergeTarget = declarationsForModule.find(isNonTypeOnlyNamedImportClause);
  if (mergeTarget !== undefined) {
    mergeTarget.addNamedImport(name);
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
