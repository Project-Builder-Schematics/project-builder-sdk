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
import { claimedNameTail, multiMatchTail, zeroMatchTail } from "../../core/reject-tail.ts";

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

// V7 (REQ-RXD-05, judgment-day fix): a bound name, tagged with enough shape to answer BOTH
// questions the algorithm now needs — "is this name CLAIMED file-wide" (Step 2, any binding,
// value-bound or type-only) and "does this SAME-MODULE binding satisfy idempotency" (Step 1,
// only a value-bound default/namespace/unaliased-named specifier). A specifier is VALUE-BOUND
// only if NEITHER its declaration (`decl.isTypeOnly()`) NOR — for a named specifier — the
// specifier itself (`specifier.isTypeOnly()`, the inline `import { type X }` form) is
// type-only; a type-only binding still CLAIMS its local name (TS rejects the same-name
// value+type-only combination as `TS2300: Duplicate identifier`), it just does not satisfy
// `addImport`'s value-binding promise.
interface BoundName {
  localName: string;
  kind: "default" | "namespace" | "named";
  aliased: boolean;
  valueBound: boolean;
}

// Collects every local name a single declaration binds, across all three clause shapes at once
// (a declaration can carry a default AND a named clause simultaneously, e.g. `import React, {
// useState } from "react"`). Set-key-safety clause: names are compared via `.includes()`/`===`
// on plain arrays, NEVER used as an object/Map key.
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

// Step 1's idempotency-satisfying shape (REQ-RXD-05, V7-narrowed): a value-bound default
// specifier, a value-bound namespace specifier, or a value-bound UNALIASED named specifier.
// An aliased named specifier's local name identifies a DIFFERENT export (Defect 3) and a
// type-only binding at either granularity does not satisfy the value-binding promise (Defect
// 1) — neither counts here, even though both still CLAIM the name for Step 2's purposes.
function satisfiesIdempotency(bound: BoundName): boolean {
  if (!bound.valueBound) return false;
  return bound.kind !== "named" || !bound.aliased;
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
 * from the SAME module `from` if one already exists (REQ-RXD-05, V7 unified algorithm):
 *
 * 1. Already-bound (idempotency, SAME module only): if an EXISTING declaration for `from` has
 *    a VALUE-BOUND specifier whose local name equals `name`, AND that specifier is a default
 *    specifier, a namespace specifier, or an UNALIASED named specifier — this is a no-op. An
 *    aliased named specifier's local name identifies a DIFFERENT export, so it does NOT satisfy
 *    idempotency (Defect 3); neither does a type-only specifier at either granularity (Defect
 *    1), because it does not satisfy the value-binding promise.
 * 2. Collision (file-wide, V7 NEW): otherwise, if `name` is CLAIMED anywhere in the file — the
 *    local name of ANY import specifier, in ANY module, value-bound or type-only alike — REJECT
 *    via `dialectError`. TypeScript treats a same-name type-only/value collision as the
 *    identical `TS2300: Duplicate identifier` error as two value bindings, so a type-only
 *    specifier claims its name exactly as a value specifier does (Defect 1); the claiming
 *    declaration may be FROM `from` (a same-module alias or type-only collision, Defect 1/3) or
 *    from a DIFFERENT module entirely (a cross-module collision, Defect 2) — both reject.
 * 3. Merge: otherwise, if an EXISTING declaration for `from` has a non-type-only named-import
 *    clause, add a NEW, UNALIASED named specifier to it. (Reaching this step guarantees `name`
 *    is claimed nowhere in the file, so the merge is always safe.)
 * 4. Create: otherwise (no declaration for `from`; every one is type-only, default-only, or
 *    namespace-only), INSERT a FRESH, SEPARATE `import { name } from "from";` — a type-only,
 *    default-only, or namespace-only declaration's clause structure is NEVER mutated to graft
 *    a named binding onto it. (Reaching this step also guarantees `name` is claimed nowhere in
 *    the file, so the fresh declaration never collides.)
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

    const alreadyBound = declarationsForModule.some((decl) =>
      boundNamesIn(decl).some((bound) => bound.localName === name && satisfiesIdempotency(bound))
    );
    if (alreadyBound) return;

    const claimed = ast
      .getImportDeclarations()
      .some((decl) => boundNamesIn(decl).some((bound) => bound.localName === name));
    if (claimed) {
      throw dialectError(claimedNameTail(name));
    }

    const mergeTarget = declarationsForModule.find(isNonTypeOnlyNamedImportClause);
    if (mergeTarget !== undefined) {
      mergeTarget.addNamedImport(name);
      return;
    }

    ast.addImportDeclaration({ moduleSpecifier: from, namedImports: [name] });
  }
);
