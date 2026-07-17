// S-001: `setJsxProp` (REQ-RXD-04 targeting/upsert, REQ-RXD-10 placement, REQ-RXD-11 value
// forms, REQ-RXD-12 trust boundary, design §4.4/ADR-02/ADR-03). Wrapped in `validatedOp` —
// `elementName`/`propName` validate BEFORE `body` runs; `value` is NOT validated (trust
// contract, REQ-RXD-11/12 verbatim: it is emitted AS-IS, malformed or not, and becomes
// executable code the author is solely responsible for).
//
// S-002: `addImport` (REQ-RXD-05 merge/create/idempotent/named-only, REQ-RXD-06 `name`
// validation + `from`'s pinned-escaping trust, design §4.4/ADR-05). Written FRESH — NOT
// copied from the TypeScript dialect's `addImport` (src/dialects/typescript/ops.ts), which
// validates nothing; that laxity is a confirmed vulnerability class this op does not repeat.

import {
  SyntaxKind,
  type ImportDeclaration,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type SourceFile,
} from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import {
  assertValidAttributeName,
  assertValidElementName,
  assertValidImportBinding,
  validatedOp,
} from "../../core/jsx-name-validator.ts";
import { multiMatchTail, zeroMatchTail } from "../../core/reject-tail.ts";

type JsxTag = JsxOpeningElement | JsxSelfClosingElement;

// Text-equality targeting against each element's tag-name text (design §4.4) — Set-key-safety
// clause: `elementName` is compared with `===`, NEVER used as an object/array index.
function matchingElements(ast: SourceFile, elementName: string): JsxTag[] {
  const openings = ast.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
  const selfClosing = ast.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  const all: JsxTag[] = [...openings, ...selfClosing];
  return all.filter((element) => element.getTagNameNode().getText() === elementName);
}

/**
 * Sets (inserts or updates) a JSX attribute on the ONE element whose tag-name text equals
 * `elementName` (REQ-RXD-04). Zero matches or more than one match both reject — never a
 * silent first-match. `value`'s three forms (REQ-RXD-11): a quoted string (`'"hi"'`), an
 * expression container (`'{count}'`), or omitted (boolean shorthand, no `=`). An insert lands
 * immediately after the element's last existing attribute — including after a trailing
 * `{...spread}`, which is deliberate: the explicit prop wins at React runtime (REQ-RXD-10). An
 * update replaces the initializer IN PLACE, preserving attribute position.
 *
 * Trust boundary (REQ-RXD-12): `value` is emitted VERBATIM and becomes executable code — the
 * SDK performs no validation, escaping, or sanitisation on it; the author is solely
 * responsible for any untrusted input reaching this channel. `elementName`/`propName` ARE
 * validated and are not a trusted-code channel.
 */
export const setJsxProp = validatedOp<SourceFile, [elementName: string, propName: string, value?: string]>(
  ([elementName, propName]) => {
    assertValidElementName(elementName);
    assertValidAttributeName(propName);
  },
  (ast, elementName, propName, value) => {
    const matches = matchingElements(ast, elementName);
    if (matches.length === 0) {
      throw dialectError(zeroMatchTail(elementName));
    }
    if (matches.length > 1) {
      throw dialectError(multiMatchTail(elementName, matches.length));
    }
    const element = matches[0]!;
    const existingAttr = element.getAttribute(propName);
    if (existingAttr !== undefined && existingAttr.getKind() === SyntaxKind.JsxAttribute) {
      const attr = existingAttr.asKindOrThrow(SyntaxKind.JsxAttribute);
      if (value === undefined) {
        attr.removeInitializer();
      } else {
        attr.setInitializer(value);
      }
      return;
    }
    element.addAttribute({ name: propName, initializer: value });
  }
);

// V5 (REQ-RXD-05): a specifier's LOCAL NAME is the identifier it actually binds in scope —
// for a named specifier, its alias if one exists, else its own name; for a default specifier,
// the default local name; for a namespace specifier, the namespace local name. Collects every
// local name a single declaration binds, across all three clause shapes at once (a
// declaration can carry a default AND a named clause simultaneously, e.g.
// `import React, { useState } from "react"`). Set-key-safety clause: names are compared via
// `.includes()`/`===` on plain arrays, NEVER used as an object/Map key.
function localNamesBoundBy(decl: ImportDeclaration): string[] {
  const names: string[] = [];
  const defaultImport = decl.getDefaultImport();
  if (defaultImport !== undefined) names.push(defaultImport.getText());
  const namespaceImport = decl.getNamespaceImport();
  if (namespaceImport !== undefined) names.push(namespaceImport.getText());
  for (const specifier of decl.getNamedImports()) {
    const alias = specifier.getAliasNode();
    names.push(alias !== undefined ? alias.getText() : specifier.getName());
  }
  return names;
}

// V5 (REQ-RXD-05, step 2): a valid MERGE target is a declaration that (a) is NOT type-only and
// (b) has a `NamedImports` clause node — whether or not it already carries specifiers. A
// default-only or namespace-only declaration has no `NamedImports` node at all: TS/JS syntax
// forbids grafting a named clause onto a namespace import, and grafting one onto a default-only
// declaration would silently widen an existing statement the author did not ask this op to
// touch — so neither is a merge target, matching a FRESH separate declaration instead.
function isNonTypeOnlyNamedImportClause(decl: ImportDeclaration): boolean {
  if (decl.isTypeOnly()) return false;
  const namedBindings = decl.getImportClause()?.getNamedBindings();
  return namedBindings !== undefined && namedBindings.getKind() === SyntaxKind.NamedImports;
}

/**
 * Adds `import { name } from "from";`, or merges `name` into an EXISTING NAMED-import clause
 * from the SAME module `from` if one already exists (REQ-RXD-05, V5 shape-aware algorithm):
 *
 * 1. Already-bound (idempotency, generalized across shapes): if `name` already equals the
 *    LOCAL NAME of ANY existing specifier from `from` — named, aliased-named, default, or
 *    namespace — this is a no-op.
 * 2. Merge: otherwise, if an EXISTING declaration for `from` has a non-type-only named-import
 *    clause, add a NEW, UNALIASED named specifier to it.
 * 3. Create: otherwise (no declaration for `from`; every one is type-only, default-only, or
 *    namespace-only), INSERT a FRESH, SEPARATE `import { name } from "from";` — a type-only,
 *    default-only, or namespace-only declaration's clause structure is NEVER mutated to graft
 *    a named binding onto it.
 *
 * NAMED-ONLY, pinned as contract: always the `import { name } from "from"` form — v1 never
 * synthesizes default or namespace imports (REQ-RXD-05.4).
 *
 * `name` is validated (`assertValidImportBinding`, REQ-RXD-06) — a plain JS identifier, not a
 * reserved word, checked against the reserved-name denylist — BEFORE any AST mutation. `from`
 * has NO allow-list: legitimate module specifiers contain `@ / . :` and more; its safety rests
 * on ts-morph escaping `moduleSpecifier` as a single string literal (REQ-RXD-06.4 pins this
 * assumption as a regression test, never assumes it silently).
 */
export const addImport = validatedOp<SourceFile, [name: string, from: string]>(
  ([name]) => {
    assertValidImportBinding(name);
  },
  (ast, name, from) => {
    const declarationsForModule = ast
      .getImportDeclarations()
      .filter((decl) => decl.getModuleSpecifierValue() === from);

    const alreadyBound = declarationsForModule.some((decl) => localNamesBoundBy(decl).includes(name));
    if (alreadyBound) return;

    const mergeTarget = declarationsForModule.find(isNonTypeOnlyNamedImportClause);
    if (mergeTarget !== undefined) {
      mergeTarget.addNamedImport(name);
      return;
    }

    ast.addImportDeclaration({ moduleSpecifier: from, namedImports: [name] });
  }
);
