// S-001: `setJsxProp` (REQ-RXD-04 targeting/upsert, REQ-RXD-10 placement, REQ-RXD-11 value
// forms, REQ-RXD-12 trust boundary, design §4.4/ADR-02/ADR-03). Wrapped in `validatedOp` —
// the target and `propName` validate BEFORE `body` runs; `value` is NOT validated (trust
// contract, REQ-RXD-11/12 verbatim: it is emitted AS-IS, malformed or not, and becomes
// executable code the author is solely responsible for).

import { Node, SyntaxKind, type JsxOpeningElement, type JsxSelfClosingElement, type SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { assertValidAttributeName, assertValidElementName, validatedOp } from "../../core/jsx-name-validator.ts";
import { multiMatchTail, zeroMatchTail } from "../../core/reject-tail.ts";

type JsxTag = JsxOpeningElement | JsxSelfClosingElement;

/**
 * The element a JSX op edits: a tag name, or a tag plus props that narrow same-tag elements. A
 * string prop value must equal the attribute's initializer text (`'"/users"'`, `'{id}'`);
 * `true` matches the prop with any value, shorthand included.
 */
export type JsxTarget = string | { tag: string; props?: Readonly<Record<string, string | true>> };

function targetParts(target: JsxTarget): { tag: string; props: [string, string | true][] } {
  if (typeof target === "string") return { tag: target, props: [] };
  return { tag: target.tag, props: Object.entries(target.props ?? {}) };
}

export function assertValidTarget(target: JsxTarget): void {
  const { tag, props } = targetParts(target);
  assertValidElementName(tag);
  for (const [name, value] of props) {
    assertValidAttributeName(name);
    if (typeof value !== "string" && value !== true) {
      throw dialectError(
        "`target.props` values must be a string or `true` — fix the target, or use `.modify()` to make this edit directly."
      );
    }
  }
}

function hasProp(element: JsxTag, name: string, value: string | true): boolean {
  const attr = element.getAttribute(name);
  if (attr === undefined || !Node.isJsxAttribute(attr)) return false;
  return value === true || attr.getInitializer()?.getText() === value;
}

// Text-equality targeting against each element's tag-name text (design §4.4) — Set-key-safety
// clause: the tag and prop names are compared with `===`, NEVER used as an object/array index.
// Zero or several matches reject — never a silent first-match.
function targetElement(ast: SourceFile, target: JsxTarget): JsxTag {
  const { tag, props } = targetParts(target);
  const openings = ast.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
  const selfClosing = ast.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  const matches = [...openings, ...selfClosing].filter(
    (element) =>
      element.getTagNameNode().getText() === tag && props.every(([name, value]) => hasProp(element, name, value))
  );
  const propNames = props.map(([name]) => name);
  if (matches.length === 0) throw dialectError(zeroMatchTail(tag, propNames));
  if (matches.length > 1) throw dialectError(multiMatchTail(tag, matches.length, propNames));
  return matches[0]!;
}

/**
 * Sets (inserts or updates) a JSX attribute on the ONE element `target` names (REQ-RXD-04).
 * Zero matches or more than one match both reject — never a silent first-match. `value`'s three forms (REQ-RXD-11): a quoted string (`'"hi"'`), an
 * expression container (`'{count}'`), or omitted (boolean shorthand, no `=`). An insert lands
 * immediately after the element's last existing attribute — including after a trailing
 * `{...spread}`, which is deliberate: the explicit prop wins at React runtime (REQ-RXD-10). An
 * update replaces the initializer IN PLACE, preserving attribute position.
 *
 * Trust boundary (REQ-RXD-12): `value` is emitted VERBATIM and becomes executable code — the
 * SDK performs no validation, escaping, or sanitisation on it; the author is solely
 * responsible for any untrusted input reaching this channel. The target and `propName` ARE
 * validated and are not a trusted-code channel; `target`'s prop values are compared, never
 * emitted or echoed.
 */
export const setJsxProp = validatedOp<SourceFile, [target: JsxTarget, propName: string, value?: string]>(
  ([target, propName]) => {
    assertValidTarget(target);
    assertValidAttributeName(propName);
  },
  (ast, target, propName, value) => {
    const element = targetElement(ast, target);
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
