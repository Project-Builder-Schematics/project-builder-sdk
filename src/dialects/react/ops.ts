// S-001: `setJsxProp` (REQ-RXD-04 targeting/upsert, REQ-RXD-10 placement, REQ-RXD-11 value
// forms, REQ-RXD-12 trust boundary, design §4.4/ADR-02/ADR-03). Wrapped in `validatedOp` —
// the target and `propName` validate BEFORE `body` runs; `value` is NOT validated (trust
// contract, REQ-RXD-11/12 verbatim: it is emitted AS-IS, malformed or not, and becomes
// executable code the author is solely responsible for).

import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type InterfaceDeclaration,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type SourceFile,
  type Statement,
  type TypeLiteralNode,
} from "ts-morph";
import { dialectError } from "../../core/dialect-error.ts";
import {
  assertValidAttributeName,
  assertValidElementName,
  assertValidImportBinding,
  validatedOp,
} from "../../core/jsx-name-validator.ts";
import { elementNameEcho, multiMatchTail, zeroMatchTail } from "../../core/reject-tail.ts";
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

type ComponentFunction = FunctionDeclaration | ArrowFunction | FunctionExpression;

// A top-level `function Name` or `const Name =` arrow/function expression. Wrapped components
// (`memo(...)`, `forwardRef(...)`) are deliberately not unwrapped.
function componentFunction(ast: SourceFile, name: string): ComponentFunction {
  const declared: ComponentFunction[] = ast.getFunctions().filter((fn) => fn.getName() === name);
  const assigned = ast
    .getVariableDeclarations()
    .filter((decl) => decl.getName() === name)
    .map((decl) => decl.getInitializer())
    .filter((init): init is ArrowFunction | FunctionExpression => Node.isArrowFunction(init) || Node.isFunctionExpression(init));
  const matches = [...declared, ...assigned];
  if (matches.length !== 1) {
    const found = matches.length === 0 ? "no component named" : `${matches.length} components named`;
    throw dialectError(
      `${found} \`${elementNameEcho(name)}\` (a top-level function, or a const holding an arrow or function expression) — ` +
        "use `.modify()` to edit it directly."
    );
  }
  return matches[0]!;
}

function assertSingleStatement(statement: string): void {
  let valid = false;
  try {
    const statements = parse(statement).getStatements();
    valid = statements.length === 1 && statements[0]!.getText() === statement.trim();
  } catch {
    valid = false;
  }
  if (!valid) {
    throw dialectError("`statement` must be exactly one statement — fix it, or use `.modify()` to make this edit directly.");
  }
}

// `useX(...)`, `React.useX(...)`, or a declaration initialized by one.
function isHookCall(statement: Statement): boolean {
  const call = Node.isExpressionStatement(statement)
    ? statement.getExpression()
    : Node.isVariableStatement(statement)
      ? statement.getDeclarations()[0]?.getInitializer()
      : undefined;
  if (!Node.isCallExpression(call)) return false;
  const callee = call.getExpression();
  const name = Node.isPropertyAccessExpression(callee) ? callee.getName() : callee.getText();
  return /^use[A-Z0-9]/.test(name);
}

/**
 * Inserts `statement` into the body of the component named `component`, after its leading
 * hook calls, or first when it has none. An identical statement already in the body is a
 * no-op; an expression-bodied arrow component rejects. `statement` must be exactly one
 * statement and is emitted verbatim, the same trust boundary as `setJsxProp`'s `value`.
 */
export const addHookCall = validatedOp<SourceFile, [component: string, statement: string]>(
  ([component, statement]) => {
    assertValidImportBinding(component, "component");
    assertSingleStatement(statement);
  },
  (ast, component, statement) => {
    const body = componentFunction(ast, component).getBody();
    if (!Node.isBlock(body)) {
      throw dialectError(
        `component \`${elementNameEcho(component)}\` has an expression body, so there is no statement list to add to — ` +
          "give it a block body, or use `.modify()` to make this edit directly."
      );
    }
    const statements = body.getStatements();
    const text = statement.trim();
    if (statements.some((existing) => existing.getText() === text)) return;
    const leadingHooks = statements.findIndex((existing) => !isHookCall(existing));
    body.insertStatements(leadingHooks === -1 ? statements.length : leadingHooks, text);
  }
);

function assertSingleType(type: string): void {
  let valid = false;
  try {
    const statements = parse(`type T = ${type};\n`).getStatements();
    const alias = statements[0];
    valid = statements.length === 1 && Node.isTypeAliasDeclaration(alias) && alias.getTypeNode()?.getText() === type.trim();
  } catch {
    valid = false;
  }
  if (!valid) {
    throw dialectError("`type` must be exactly one type — fix it, or use `.modify()` to make this edit directly.");
  }
}

// The first parameter's inline type literal, or the same-file interface or type-alias literal it
// names. Anything else (imported, generic utility, untyped) is left to `.modify()`.
function propsType(ast: SourceFile, fn: ComponentFunction, component: string): TypeLiteralNode | InterfaceDeclaration {
  const typeNode = fn.getParameters()[0]?.getTypeNode();
  if (Node.isTypeLiteral(typeNode)) return typeNode;
  if (Node.isTypeReference(typeNode)) {
    const name = typeNode.getTypeName().getText();
    const declared = ast.getInterface(name) ?? ast.getTypeAlias(name)?.getTypeNode();
    if (Node.isInterfaceDeclaration(declared) || Node.isTypeLiteral(declared)) return declared;
  }
  throw dialectError(
    `component \`${elementNameEcho(component)}\` has no props type this op can edit — its first parameter needs an inline ` +
      "type literal, or an interface or type literal declared in this file; use `.modify()` to make this edit directly."
  );
}

function addPropsMember(ast: SourceFile, props: TypeLiteralNode | InterfaceDeclaration, name: string, type: string, optional: boolean): void {
  const last = props.getMembers().at(-1);
  if (last === undefined || props.getText().includes("\n")) {
    props.addProperty({ name, type, hasQuestionToken: optional });
    return;
  }
  // ts-morph's addProperty breaks a single-line literal across lines; keep it on one line,
  // reusing the last member's separator when it has one.
  const signature = `${name}${optional ? "?" : ""}: ${type}`;
  const separator = /[;,]$/.exec(last.getText())?.[0];
  ast.insertText(last.getEnd(), separator === undefined ? `; ${signature}` : ` ${signature}${separator}`);
}

function addDestructuredName(fn: ComponentFunction, name: string): void {
  const pattern = fn.getParameters()[0]?.getNameNode();
  if (!Node.isObjectBindingPattern(pattern)) return;
  const elements = pattern.getElements();
  if (elements.some((element) => element.getName() === name)) return;
  const rest = elements.find((element) => element.getDotDotDotToken() !== undefined);
  const last = elements.at(-1);
  if (rest !== undefined) fn.getSourceFile().insertText(rest.getStart(), `${name}, `);
  else if (last !== undefined) fn.getSourceFile().insertText(last.getEnd(), `, ${name}`);
  else fn.getSourceFile().replaceText([pattern.getStart(), pattern.getEnd()], `{ ${name} }`);
}

/**
 * Adds `name: type` (`name?: type` with `{ optional: true }`) to the props of the component
 * named `component` and, when its props parameter is destructured, `name` to the destructuring.
 * The props type is an inline type literal, or an interface or type literal declared in the
 * same file; a component without parameters gets `({ name }: { name: type })`. The same name
 * with the same type text is a no-op; a different type rejects. `type` is emitted verbatim.
 */
export const addComponentProp = validatedOp<
  SourceFile,
  [component: string, name: string, type: string, options?: { optional?: boolean }]
>(
  ([component, name, type]) => {
    assertValidImportBinding(component, "component");
    assertValidImportBinding(name, "name");
    assertSingleType(type);
  },
  (ast, component, name, type, options) => {
    const text = type.trim();
    const optional = options?.optional === true;
    const fn = componentFunction(ast, component);
    if (fn.getParameters().length === 0) {
      fn.insertParameter(0, { name: `{ ${name} }`, type: `{ ${name}${optional ? "?" : ""}: ${text} }` });
      return;
    }
    const props = propsType(ast, fn, component);
    const existing = props.getProperty(name);
    if (existing !== undefined) {
      if (existing.getTypeNode()?.getText() === text) return;
      throw dialectError(
        `prop \`${elementNameEcho(name)}\` already exists on \`${elementNameEcho(component)}\` with a different type — ` +
          "change it with `.modify()`."
      );
    }
    addPropsMember(ast, props, name, text, optional);
    addDestructuredName(componentFunction(ast, component), name);
  }
);

/**
 * Renames the ONE element `target` names to `tag`, opening and closing tag together; nested
 * elements are left alone. Renaming to the same tag is a no-op. Imports are not touched —
 * chain `addImport` for the new component.
 */
export const renameJsxElement = validatedOp<SourceFile, [target: JsxTarget, tag: string]>(
  ([target, tag]) => {
    assertValidTarget(target);
    assertValidElementName(tag, "tag");
  },
  (ast, target, tag) => {
    const opening = targetElement(ast, target, "renameJsxElement");
    if (opening.getTagNameNode().getText() === tag) return;
    if (Node.isJsxOpeningElement(opening)) {
      opening.getParentIfKindOrThrow(SyntaxKind.JsxElement).getClosingElement().getTagNameNode().replaceWithText(tag);
    }
    opening.getTagNameNode().replaceWithText(tag);
  }
);
