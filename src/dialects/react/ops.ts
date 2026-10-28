// S-001: `setJsxProp` (REQ-RXD-04 targeting/upsert, REQ-RXD-10 placement, REQ-RXD-11 value
// forms, REQ-RXD-12 trust boundary, design §4.4/ADR-02/ADR-03). Wrapped in `validatedOp` —
// the target and `propName` validate BEFORE `body` runs; `value` is NOT validated (trust
// contract, REQ-RXD-11/12 verbatim: it is emitted AS-IS, malformed or not, and becomes
// executable code the author is solely responsible for).

import { Node, SyntaxKind, type JsxOpeningElement, type JsxSelfClosingElement, type SourceFile } from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import { assertValidAttributeName, assertValidElementName, validatedOp } from "../../core/jsx-name-validator.ts";
import { multiMatchTail, zeroMatchTail } from "../../core/reject-tail.ts";
import { parse } from "./ast.ts";

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
function targetElement(ast: SourceFile, target: JsxTarget, opName: string): JsxTag {
  const { tag, props } = targetParts(target);
  const openings = ast.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
  const selfClosing = ast.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  const matches = [...openings, ...selfClosing].filter(
    (element) =>
      element.getTagNameNode().getText() === tag && props.every(([name, value]) => hasProp(element, name, value))
  );
  const propNames = props.map(([name]) => name);
  if (matches.length === 0) throw dialectError(zeroMatchTail(tag, propNames));
  if (matches.length > 1) throw dialectError(multiMatchTail(opName, tag, matches.length, propNames));
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
    const element = targetElement(ast, target, "setJsxProp");
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
 * Removes the attribute named `propName` from the ONE element `target` names. An absent
 * attribute is a no-op; a `{...spread}` is never touched, even when it may carry the prop.
 */
export const removeJsxProp = validatedOp<SourceFile, [target: JsxTarget, propName: string]>(
  ([target, propName]) => {
    assertValidTarget(target);
    assertValidAttributeName(propName);
  },
  (ast, target, propName) => {
    const attr = targetElement(ast, target, "removeJsxProp").getAttribute(propName);
    if (attr !== undefined && Node.isJsxAttribute(attr)) attr.remove();
  }
);

// One JSX node of an accepted kind and nothing around it. Parsed as `(jsx);`, so trailing code
// such as `<a />); evil(<b />` yields a second statement and rejects. The text is never echoed.
function assertJsxNode(jsx: string, argName: string, accepts: (node: Node) => boolean, ruleLabel: string): void {
  let valid = false;
  try {
    const statements = parse(`(${jsx});\n`).getStatements();
    const statement = statements[0];
    if (statements.length === 1 && Node.isExpressionStatement(statement)) {
      const expression = statement.getExpression();
      if (Node.isParenthesizedExpression(expression)) {
        const inner = expression.getExpression();
        valid = accepts(inner) && inner.getText() === jsx.trim();
      }
    }
  } catch {
    valid = false;
  }
  if (!valid) {
    throw dialectError(`\`${argName}\` must be ${ruleLabel} — fix it, or use \`.modify()\` to make this edit directly.`);
  }
}

function lineIndent(ast: SourceFile, pos: number): string {
  const text = ast.getFullText();
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))![0];
}

function indentUnit(indent: string): string {
  return indent.includes("\t") ? "\t" : "  ";
}

/**
 * Appends `jsx` as the last child of the ONE element `target` names. A self-closing target
 * becomes an open/close pair holding the child; otherwise the child goes on its own line at
 * the siblings' indentation, or inline when the element's content is inline. A child with the
 * same text already present is a no-op. `jsx` must be exactly one JSX element or fragment and
 * is emitted verbatim, the same trust boundary as `setJsxProp`'s `value`.
 */
export const addJsxChild = validatedOp<SourceFile, [target: JsxTarget, jsx: string]>(
  ([target, jsx]) => {
    assertValidTarget(target);
    assertJsxNode(
      jsx,
      "jsx",
      (node) => Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node) || Node.isJsxFragment(node),
      "exactly one JSX element or fragment"
    );
  },
  (ast, target, jsx) => {
    const child = jsx.trim();
    const tag = targetElement(ast, target, "addJsxChild");
    const eol = ast.getProject().manipulationSettings.getNewLineKindAsString();
    if (Node.isJsxSelfClosingElement(tag)) {
      const indent = lineIndent(ast, tag.getStart());
      const open = tag.getText().replace(/\s*\/>$/, ">");
      const close = `</${tag.getTagNameNode().getText()}>`;
      ast.replaceText([tag.getStart(), tag.getEnd()], `${open}${eol}${indent}${indentUnit(indent)}${child}${eol}${indent}${close}`);
      return;
    }
    const element = tag.getParentIfKindOrThrow(SyntaxKind.JsxElement);
    const children = element.getJsxChildren();
    if (children.some((existing) => existing.getText() === child)) return;
    const content = children.filter((node) => !(Node.isJsxText(node) && node.containsOnlyTriviaWhiteSpaces()));
    const last = content.at(-1);
    const closingStart = element.getClosingElement().getStart();
    const anchor = last?.getEnd() ?? tag.getEnd();
    if (!ast.getFullText().slice(anchor, closingStart).includes("\n")) {
      ast.insertText(closingStart, child);
      return;
    }
    const closingIndent = lineIndent(ast, closingStart);
    const indent = last === undefined ? closingIndent + indentUnit(closingIndent) : lineIndent(ast, last.getStart());
    ast.insertText(anchor, `${eol}${indent}${child}`);
  }
);

/**
 * Wraps the ONE element `target` names in `wrapper`, a self-closing JSX element whose props are
 * kept: `'<QueryProvider client={qc} />'` turns `<App />` into
 * `<QueryProvider client={qc}><App /></QueryProvider>`. A target whose direct parent already
 * has the wrapper's tag is a no-op. `wrapper` is emitted verbatim, the same trust boundary as
 * `setJsxProp`'s `value`.
 */
export const wrapJsxElement = validatedOp<SourceFile, [target: JsxTarget, wrapper: string]>(
  ([target, wrapper]) => {
    assertValidTarget(target);
    assertJsxNode(wrapper, "wrapper", (node) => Node.isJsxSelfClosingElement(node), "exactly one self-closing JSX element");
  },
  (ast, target, wrapper) => {
    const tag = targetElement(ast, target, "wrapJsxElement");
    const node = Node.isJsxSelfClosingElement(tag) ? tag : tag.getParentIfKindOrThrow(SyntaxKind.JsxElement);
    const open = wrapper.trim().replace(/\s*\/>$/, ">");
    const wrapperTag = /^<([^\s/>]+)/.exec(open)![1]!;
    const parent = node.getParent();
    if (Node.isJsxElement(parent) && parent.getOpeningElement().getTagNameNode().getText() === wrapperTag) return;
    ast.replaceText([node.getStart(), node.getEnd()], `${open}${node.getText()}</${wrapperTag}>`);
  }
);
