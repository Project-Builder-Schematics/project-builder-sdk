// The React dialect's JSX name grammars (ARCH-2, ADR-0071), built on the shared identifier
// checks. Verbatim from the shared contract (slices.md rev 2, "Name grammars + denylist"):
// - attribute name: letters/digits/underscore/hyphen, one optional `:namespace` segment.
// - element name (lookup-only, never spliced): identifier-or-hyphenated segments, dot-joined
//   (admits `Button`, `Menu.Item`, `my-web-component`).

import { assertGrammar, assertNotDenylisted } from "../../../../domain/services/identifier-names.ts";

const ATTRIBUTE_NAME_GRAMMAR = /^[A-Za-z_][A-Za-z0-9_-]*(:[A-Za-z_][A-Za-z0-9_-]*)?$/;
const ELEMENT_NAME_GRAMMAR = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;

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
export function assertValidElementName(elementName: string, argName: string = "elementName"): void {
  assertGrammar(
    argName,
    elementName,
    ELEMENT_NAME_GRAMMAR,
    "match the JSX element-name grammar (identifier or hyphenated segments, optionally joined by `.`)"
  );
  assertNotDenylisted(argName, elementName);
}
