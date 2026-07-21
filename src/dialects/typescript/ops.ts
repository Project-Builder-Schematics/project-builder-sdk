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
// create (Step 4).
//
// ts-addimport-collision/S-001: Step 2 (file-wide collision reject) lands here, strictly
// AFTER Step 1 (REQ-TSD-01.24, mutant-kill ordering invariant) and before Step 3/4.
// `isValueNamespaceClaimed` is EXTRACTED from `assertNoCollision` below (design §4.5 ADR-01)
// and consumed by BOTH `assertNoCollision` (behaviour-preserving, siblings' own import-scan
// posture UNCHANGED) and `addImport`'s new Step 2 (design §4.4 — TS house-style tail, built
// inline, NOT reusing `assertNoCollision`'s own message: "two bindings sharing a name" here,
// vs "two value declarations sharing a name" there — `addImport`'s collision surface also
// fires on import-vs-import and type-only claims, which are not value declarations, F10).
//
// ts-addimport-collision/S-002: REQ-TSD-13's injection-safety validation gate lands here —
// `assertValidImportBinding` (reused verbatim from `src/core/jsx-name-validator.ts`, ADR-02)
// runs INLINE as `addImport`'s first statement, strictly BEFORE Step 1/2/3/4 ever evaluate
// `name` (REQ-TSD-13.6 precedence pin). Its PATH-LESS reject shape is deliberately distinct
// from Step 2's path-ful `dialectError` tail below — see `addImport`'s own JSDoc.

import { SyntaxKind, type ImportDeclaration, type SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { handlePathFor } from "../../core/dialect-handle.ts";
// A misnomer surviving from its JSX-only origin (`jsx-name-validator.ts`) — this dialect is
// its first non-JSX consumer, sharpening ARCH-2's now-realised "one consumer" debt (ADR-02).
import { assertValidImportBinding } from "../../core/jsx-name-validator.ts";

// Ported verbatim from `react/ops.ts` (design §4.3 data model) — a bound name, tagged with
// enough shape to answer BOTH "does this SAME-MODULE binding satisfy idempotency" (Step 1)
// and, via `boundNamesIn` walked file-wide, "is this name CLAIMED anywhere" (Step 2, below).
interface BoundName {
  localName: string;
  kind: "default" | "namespace" | "named";
  aliased: boolean;
  valueBound: boolean;
  selfAliased: boolean;
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
    names.push({
      localName: defaultImport.getText(),
      kind: "default",
      aliased: false,
      valueBound: !declTypeOnly,
      selfAliased: false,
    });
  }
  const namespaceImport = decl.getNamespaceImport();
  if (namespaceImport !== undefined) {
    names.push({
      localName: namespaceImport.getText(),
      kind: "namespace",
      aliased: false,
      valueBound: !declTypeOnly,
      selfAliased: false,
    });
  }
  for (const specifier of decl.getNamedImports()) {
    const alias = specifier.getAliasNode();
    names.push({
      localName: alias !== undefined ? alias.getText() : specifier.getName(),
      kind: "named",
      aliased: alias !== undefined,
      valueBound: !declTypeOnly && !specifier.isTypeOnly(),
      selfAliased: alias !== undefined && alias.getText() === specifier.getName(),
    });
  }
  return names;
}

// Step 1's idempotency-satisfying shape: a value-bound default specifier, a value-bound
// namespace specifier, a value-bound UNALIASED named specifier, or a value-bound
// SELF-ALIASED named specifier (`{ X as X }`). An aliased-to-a-DIFFERENT-name named
// specifier's local name identifies a DIFFERENT export and a type-only binding at either
// granularity does not satisfy the value-binding promise — neither counts here.
//
// DELIBERATE DEVIATION (S-003, REQ-TSD-01.15, owner-ratified): self-alias satisfying
// idempotency diverges from this predicate's twin in `react/ops.ts` (which rejects it) —
// FIT-41 pins the divergence as a POSITIVE expected-mismatch row, never a row exclusion.
function satisfiesIdempotency(bound: BoundName): boolean {
  if (!bound.valueBound) return false;
  return bound.kind !== "named" || !bound.aliased || bound.selfAliased;
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

// ADR-0039 collision-namespace pin (owner ruling #4), EXTRACTED (S-001, design §4.5 ADR-01)
// from `assertNoCollision` below so both it and `addImport`'s Step 2 share ONE predicate: a
// top-level VALUE-NAMESPACE declaration (function/const/let/var/class/enum/namespace) under
// `name` collides; `type`/`interface` are exempt (legal TS coexistence). Syntactic search
// only (no language service, REQ-TSD-02.3) — SourceFile-wide, not scope-aware.
function isValueNamespaceClaimed(ast: SourceFile, name: string): boolean {
  return (
    ast.getFunction(name) !== undefined ||
    ast.getVariableDeclaration(name) !== undefined ||
    ast.getClass(name) !== undefined ||
    ast.getEnum(name) !== undefined ||
    ast.getModule(name) !== undefined
  );
}

// S-003, REQ-TSD-01.21: counts the file's LEADING directive prologue — string-literal
// `ExpressionStatement`s starting at statement 0, stopping at the first non-directive
// statement (a directive is only live when first-in-scope; a string literal appearing
// later in the file is an ordinary expression statement, not a directive). A shebang is
// SourceFile leading trivia, never a statement, so it never contributes here — the Create
// branch below falls through to its pre-existing `addImportDeclaration` path for a shebang
// file, leaving REQ-TSD-01.33's fail-closed containment untouched (ADR-03).
function leadingDirectiveCount(ast: SourceFile): number {
  let count = 0;
  for (const statement of ast.getStatements()) {
    if (statement.getKind() !== SyntaxKind.ExpressionStatement) break;
    const expression = statement.asKindOrThrow(SyntaxKind.ExpressionStatement).getExpression();
    if (expression.getKind() !== SyntaxKind.StringLiteral) break;
    count++;
  }
  return count;
}

/**
 * Adds `import { name } from "from";`, or merges `name` into an EXISTING NAMED-import
 * clause from the SAME module `from` if one already exists (REQ-TSD-01). `name` is
 * validated at the op boundary BEFORE any of the four branches below ever run (REQ-TSD-13)
 * — see the trust-boundary note at the end of this doc.
 *
 * 0. Validation (REQ-TSD-13, runs FIRST, strictly before Step 1): `name` MUST be a valid
 *    plain-JS identifier, MUST NOT be a reserved or strict-mode-restricted word, and MUST
 *    NOT be a denylisted name (`assertValidImportBinding`, reused verbatim from
 *    `src/core/jsx-name-validator.ts`) — REJECTS via a PATH-LESS `dialectError` before Step
 *    1/2/3/4 ever evaluate `name`, even when `name` would ALSO collide under Step 2
 *    (REQ-TSD-13.6, precedence pinned: validation wins, never the collision message).
 * 1. Already-bound (idempotency, SAME module only): if an EXISTING declaration for `from`
 *    has a VALUE-BOUND specifier whose local name equals `name`, AND that specifier is a
 *    default specifier, a namespace specifier, an UNALIASED named specifier, or a
 *    SELF-ALIASED named specifier (`{ name as name }`) — this is a no-op. The self-aliased
 *    case is a DELIBERATE DEVIATION from the `react` dialect's twin predicate, which rejects
 *    it (REQ-TSD-01.15, owner-ratified). Runs strictly BEFORE Step 2 (REQ-TSD-01.24,
 *    mutant-kill ordering invariant): a same-module already-bound specifier is a no-op,
 *    NEVER a collision reject.
 * 2. Collision: otherwise, if `name` is CLAIMED anywhere in the file — EITHER the local name
 *    of ANY import specifier, in ANY module, value-bound or type-only alike, OR a top-level
 *    value-namespace declaration (`isValueNamespaceClaimed`) — REJECT via `dialectError`
 *    BEFORE any AST mutation.
 * 3. Merge: otherwise, if an EXISTING declaration for `from` has a non-type-only
 *    named-import clause — INCLUDING an empty one (`import {} from "from"`) — add a NEW,
 *    UNALIASED named specifier to it. Walks EVERY declaration for `from` (a module can be
 *    imported via several separate declarations) and merges into the FIRST one in source
 *    order (REQ-TSD-01.22/.25 — a known, deliberate first-match asymmetry; contrast
 *    `removeImport`, which also SEARCHES every declaration matching `from` but REMOVES the
 *    binding from only the first one it finds it in, then returns — see `removeImport`'s own
 *    JSDoc). A side-effect-only import (`import "from";`, no
 *    clause at all) is never a merge target and is never converted into a combined form
 *    (REQ-TSD-01.20, Class B) — it is left byte-unchanged, coexisting beside the fresh
 *    declaration Step 4 inserts. (Reaching this step guarantees `name` is claimed nowhere in
 *    the file, so the merge is always safe.)
 * 4. Create: otherwise (no declaration for `from`; every one is type-only, default-only,
 *    namespace-only, or side-effect-only), INSERT a FRESH, SEPARATE
 *    `import { name } from "from";` — a type-only, default-only, or namespace-only
 *    declaration's clause structure is NEVER mutated to graft a named binding onto it. A
 *    leading directive prologue (`"use client";` and similar) is preserved as the file's
 *    first statement(s) — the fresh declaration is inserted AFTER it, never above
 *    (REQ-TSD-01.21). (Reaching this step also guarantees `name` is claimed nowhere in the
 *    file, so the fresh declaration never collides.)
 *
 * Idempotent: calling this twice with the same `name`+`from` produces a single import line,
 * never a duplicate (REQ-TSD-03.10).
 *
 * Trust boundary (REQ-TSD-13.5): `name` and `from` are the ONLY two channels this op
 * validates. `addFunction`/`addVariable`/`addClass`'s own `name`/`source`/`initializer`
 * arguments remain RAW-SPLICED, author-trusted input this change does NOT validate or
 * protect — that gap is tracked separately in `project/pending-changes`, out of this
 * change's scope.
 */
export function addImport(ast: SourceFile, name: string, from: string): void {
  // REQ-TSD-13 validation gate: a deliberately PATH-LESS reject (contrast Step 2's path-ful
  // `dialectError` below) — runs first, so a `name` that is BOTH invalid AND claimed rejects
  // via validation, never collision (REQ-TSD-13.6).
  assertValidImportBinding(name);

  // Single pass: one `getImportDeclarations()` call, one `boundNamesIn` per declaration —
  // Step 1 and Step 2 below both read from `declarationBoundNames` instead of each re-walking
  // the AST. Step 1 still fully evaluates (and early-returns) before Step 2 ever runs
  // (REQ-TSD-01.24/REQ-TSD-13.6 ordering pin) — this is code motion only, not reordering.
  const allDeclarations = ast.getImportDeclarations();
  const declarationsForModule = allDeclarations.filter((decl) => decl.getModuleSpecifierValue() === from);
  const declarationBoundNames: Array<readonly [ImportDeclaration, BoundName[]]> = allDeclarations.map((decl) => [
    decl,
    boundNamesIn(decl),
  ]);

  const alreadyBound = declarationBoundNames.some(
    ([decl, bound]) =>
      decl.getModuleSpecifierValue() === from &&
      bound.some((b) => b.localName === name && satisfiesIdempotency(b))
  );
  if (alreadyBound) return;

  const claimed =
    declarationBoundNames.some(([, bound]) => bound.some((b) => b.localName === name)) ||
    isValueNamespaceClaimed(ast, name);
  if (claimed) {
    throw dialectError(
      `addImport("${name}") on "${handlePathFor(ast)}" — a value or import binding named "${name}" already exists; ` +
        `TypeScript forbids two bindings sharing a name. Rename or remove the existing one, or edit it with .modify().`
    );
  }

  const mergeTarget = declarationsForModule.find(isNonTypeOnlyNamedImportClause);
  if (mergeTarget !== undefined) {
    mergeTarget.addNamedImport(name);
    return;
  }

  const directiveCount = leadingDirectiveCount(ast);
  if (directiveCount === 0) {
    ast.addImportDeclaration({ moduleSpecifier: from, namedImports: [name] });
  } else {
    ast.insertImportDeclaration(directiveCount, { moduleSpecifier: from, namedImports: [name] });
  }
}

// Shared `{ export?: boolean }` shape across addFunction/addVariable/addClass — addVariable
// composes it with its own extra `kind` member.
type DeclarationOptions = { export?: boolean };

function exportPrefixFor(options?: DeclarationOptions): string {
  return options?.export === true ? "export " : "";
}

// ADR-0039 collision-namespace pin (owner ruling #4): a VALUE-namespace declaration
// (`isValueNamespaceClaimed`, S-001-extracted, shared with `addImport`'s Step 2 above) OR a
// named-import binding under `name` collides, cross-kind; `type`/`interface` are exempt
// (legal TS coexistence). Syntactic search only (no language service, per REQ-TSD-02.3's own
// no-LS commitment) — SourceFile-wide, not scope-aware (matches the "no language service
// needed" owner framing; every signed scenario seeds top-level declarations only).
//
// Behaviour-preservation (S-001, ops-declarations.test.ts guard): the import-binding half of
// this predicate stays NAMED-imports-only, UNCHANGED by the extraction — `addFunction`/
// `addVariable`/`addClass` stay blind to a default/namespace import collision, same as
// before (design §4.8's registered "sibling collision-scan asymmetry" followup, not closed
// by this change).
//
// `handlePathFor(ast)` (final-verify fix, dialect-handle.ts) is the ONLY channel through
// which an op function can recover the author-facing path for its own dialectError()-branded
// message (design §4.4's pinned "on {path}" clause) — position-independent (keyed by the
// live AST instance, not a runtime argument position), so it can never collide with `name`/
// `options` regardless of which trailing args the author omitted.
function assertNoCollision(ast: SourceFile, name: string, opName: string): void {
  const collides =
    isValueNamespaceClaimed(ast, name) ||
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
 * declarations (`import { a } from "m"; import { b } from "m";`, legal TS) — this SEARCHES
 * every declaration matching `from`, not just the first, to locate whichever one actually
 * contains `name`. Once found, the binding is removed from that ONE declaration and the
 * function returns — a legal file never binds the same local name twice, so this is
 * observationally a full removal on any real input; on the illegal, hand-authored fixture
 * where `name` is duplicated across two declarations for `from` (REQ-TSD-01.25, CORRECTED
 * V3.2), only the FIRST one loses the binding — the search is all-declarations, the removal
 * is first-match-only. Sibling declarations from the same module are never touched.
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
