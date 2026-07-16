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

import { SyntaxKind, type JsxOpeningElement, type JsxSelfClosingElement, type SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import {
  assertValidAttributeName,
  assertValidElementName,
  assertValidImportBinding,
  validatedOp,
} from "../../core/jsx-name-validator.ts";

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
      throw dialectError(
        `no element named \`${elementName}\` was found — use \`.modify()\` to inspect the file and edit it directly.`
      );
    }
    if (matches.length > 1) {
      throw dialectError(
        `\`${elementName}\` matched ${matches.length} elements — setJsxProp requires exactly one match; ` +
          "use `.modify()` to disambiguate."
      );
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

/**
 * Adds `import { name } from "from";`, or merges `name` into an EXISTING named-import clause
 * from the SAME module `from` if one already exists (REQ-RXD-05). Idempotent: calling this
 * twice with the same `name`+`from` on one handle produces a single import line, never a
 * duplicate. NAMED-ONLY, pinned as contract: always the `import { name } from "from"` form —
 * v1 never synthesizes default or namespace imports (REQ-RXD-05.4).
 *
 * `name` is validated (`assertValidImportBinding`, REQ-RXD-06) — a plain JS identifier,
 * checked against the reserved-name denylist — BEFORE any AST mutation. `from` has NO
 * allow-list: legitimate module specifiers contain `@ / . :` and more; its safety rests on
 * ts-morph escaping `moduleSpecifier` as a single string literal (REQ-RXD-06.4 pins this
 * assumption as a regression test, never assumes it silently).
 */
export const addImport = validatedOp<SourceFile, [name: string, from: string]>(
  ([name]) => {
    assertValidImportBinding(name);
  },
  (ast, name, from) => {
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
);
