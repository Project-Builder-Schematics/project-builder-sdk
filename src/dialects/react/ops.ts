// S-001: `setJsxProp` (REQ-RXD-04 targeting/upsert, REQ-RXD-10 placement, REQ-RXD-11 value
// forms, REQ-RXD-12 trust boundary, design §4.4/ADR-02/ADR-03). Wrapped in `validatedOp` —
// `elementName`/`propName` validate BEFORE `body` runs; `value` is NOT validated (trust
// contract, REQ-RXD-11/12 verbatim: it is emitted AS-IS, malformed or not, and becomes
// executable code the author is solely responsible for).

import { SyntaxKind, type JsxOpeningElement, type JsxSelfClosingElement, type SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { assertValidAttributeName, assertValidElementName, validatedOp } from "../../core/jsx-name-validator.ts";

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
