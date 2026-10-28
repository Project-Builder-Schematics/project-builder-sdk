import { atRule, decl, parse, rule, type AtRule, type ChildNode, type Container, type Declaration, type Root, type Rule } from "postcss";
import { dialectError } from "../../core/dialect-error.ts";
import { validatedOp } from "../../core/jsx-name-validator.ts";

/**
 * Addresses one top-level block: `{ selector }` is a rule, `{ atRule, params? }` is an at-rule's
 * own body (`@theme`), and both together are a rule inside that at-rule. The selector and params
 * match after trimming; the at-rule name, written without `@`, matches case-insensitively.
 */
export interface CssTarget {
  selector?: string;
  atRule?: string;
  params?: string;
}

export interface DeclarationOptions {
  before?: string;
  after?: string;
  important?: boolean;
}

const REGULAR_PROPERTY = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;
// `*` admits Tailwind's namespace resets (`--color-*: initial`).
const CUSTOM_PROPERTY = /^--[A-Za-z0-9_*\u0080-￿-]+$/;
const AT_RULE_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;

function label(target: CssTarget): string {
  const at = target.atRule === undefined ? [] : [`@${target.atRule} ${target.params?.trim() ?? ""}`.trim()];
  return [...at, ...(target.selector === undefined ? [] : [target.selector.trim()])].join(" ");
}

function fail(op: string, target: CssTarget, why: string): never {
  throw dialectError(`${op}(${label(target)}) — ${why}`);
}

function tryParse(css: string): Root | undefined {
  try {
    return parse(css);
  } catch {
    return undefined;
  }
}

// The selector, params, and value checks re-parse the argument alone and require PostCSS to
// read back exactly one node with the same text: anything that would close the node or add
// another one (`;`, `}`, `{`) is rejected before it can reach the printed file.
function assertTarget(op: string, target: unknown): asserts target is CssTarget {
  const t = target as CssTarget;
  const shaped =
    typeof target === "object" && target !== null && [t.selector, t.atRule, t.params].every((v) => v === undefined || typeof v === "string");
  if (!shaped) throw dialectError(`${op} — a target is an object of string \`selector\`, \`atRule\`, and \`params\`.`);
  if (t.params !== undefined && t.atRule === undefined) throw dialectError(`${op} — \`params\` needs an \`atRule\`.`);
  if (t.selector === undefined && t.atRule === undefined) {
    throw dialectError(`${op} — a target needs a \`selector\`, an \`atRule\`, or both.`);
  }
  if (t.atRule !== undefined && !AT_RULE_NAME.test(t.atRule)) {
    fail(op, t, `\`${t.atRule}\` is not an at-rule name; write it without \`@\`.`);
  }
  if (t.params !== undefined) {
    const nodes = tryParse(`@${t.atRule} ${t.params}{}`)?.nodes;
    if (nodes?.length !== 1 || nodes[0]!.type !== "atrule" || nodes[0]!.params !== t.params.trim()) {
      fail(op, t, `\`${t.params}\` is not at-rule params.`);
    }
  }
  if (t.selector !== undefined) {
    const nodes = tryParse(`${t.selector}{}`)?.nodes;
    if (t.selector.trim() === "" || nodes?.length !== 1 || nodes[0]!.type !== "rule" || nodes[0]!.selector !== t.selector.trim()) {
      fail(op, t, `\`${t.selector}\` is not a single selector.`);
    }
  }
}

const isCustom = (property: string): boolean => property.startsWith("--");

function assertProperty(op: string, target: CssTarget, property: unknown): asserts property is string {
  if (typeof property !== "string" || !(isCustom(property) ? CUSTOM_PROPERTY : REGULAR_PROPERTY).test(property)) {
    fail(op, target, `\`${String(property)}\` is not a CSS property name.`);
  }
}

function assertValue(op: string, target: CssTarget, property: string, value: unknown): asserts value is string {
  const parsed = typeof value === "string" ? tryParse(`a{${property}:${value}}`) : undefined;
  const block = parsed?.nodes.length === 1 && parsed.first?.type === "rule" ? parsed.first.nodes : [];
  const node = block.length === 1 && block[0]!.type === "decl" ? block[0] : undefined;
  if (node?.important) fail(op, target, "put `!important` in the `important` option, not in the value.");
  // PostCSS keeps the surrounding whitespace of a custom property's value, so compare trimmed.
  if (node === undefined || node.prop !== property || node.value.trim() === "" || node.value.trim() !== (value as string).trim()) {
    fail(op, target, `\`${String(value)}\` is not a single declaration value.`);
  }
}

function assertOptions(op: string, target: CssTarget, options: unknown): asserts options is DeclarationOptions | undefined {
  if (options === undefined) return;
  if (typeof options !== "object" || options === null) fail(op, target, "options must be an object.");
  const { before, after, important } = options as DeclarationOptions;
  if (before !== undefined && after !== undefined) fail(op, target, "pass `before` or `after`, not both.");
  for (const anchor of [before, after]) if (anchor !== undefined) assertProperty(op, target, anchor);
  if (important !== undefined && typeof important !== "boolean") fail(op, target, "`important` must be a boolean.");
}

function only<T extends ChildNode>(op: string, target: CssTarget, nodes: ChildNode[], match: (node: ChildNode) => node is T): T | undefined {
  const found = nodes.filter(match);
  if (found.length > 1) fail(op, target, `\`${label(target)}\` matches ${found.length} blocks; the target is ambiguous.`);
  return found[0];
}

function findBlock(op: string, root: Root, target: CssTarget): Container | undefined {
  let scope: Container | undefined = root;
  if (target.atRule !== undefined) {
    const name = target.atRule.toLowerCase();
    const params = target.params?.trim() ?? "";
    scope = only(op, target, root.nodes, (node): node is AtRule =>
      node.type === "atrule" && node.nodes !== undefined && node.name.toLowerCase() === name && node.params === params
    );
  }
  if (scope === undefined || target.selector === undefined) return scope;
  const selector = target.selector.trim();
  return only(op, target, scope.nodes ?? [], (node): node is Rule => node.type === "rule" && node.selector === selector);
}

function findDeclaration(op: string, target: CssTarget, block: Container, property: string): Declaration | undefined {
  const same = (prop: string) => (isCustom(property) ? prop === property : prop.toLowerCase() === property.toLowerCase());
  const found = (block.nodes ?? []).filter((node): node is Declaration => node.type === "decl" && same(node.prop));
  if (found.length > 1) fail(op, target, `\`${property}\` is declared ${found.length} times in the block.`);
  return found[0];
}

interface Style {
  newline: string;
  indent: string;
}

// The file's own newline and the indentation of its first top-level declaration, so a block the
// ops create reads like the blocks around it. PostCSS's own inference writes `selector{` here.
function styleOf(root: Root): Style {
  let indent = "  ";
  root.walkDecls((node) => {
    if (node.parent?.parent?.type !== "root") return;
    indent = /[ \t]*$/.exec(node.raws.before ?? "")![0] || indent;
    return false;
  });
  return { newline: root.source?.input.css.includes("\r\n") ? "\r\n" : "\n", indent };
}

function place<T extends ChildNode>(parent: Container, child: T, style: Style): T {
  const level = parent.type === "root" ? 0 : parent.parent?.type === "root" ? 1 : 2;
  const indent = style.indent.repeat(level);
  if ((parent.nodes ?? []).length === 0) {
    child.raws.before = parent.type === "root" ? "" : style.newline + indent;
    parent.raws.after = style.newline + style.indent.repeat(Math.max(level - 1, 0));
    if (parent.type !== "root") parent.raws.semicolon = true;
  } else if (child.type !== "decl") {
    child.raws.before = style.newline + style.newline + indent;
  }
  parent.append(child);
  return child;
}

function createBlock(op: string, root: Root, target: CssTarget): Container {
  const style = styleOf(root);
  let parent: Container = root;
  if (target.atRule !== undefined) {
    const params = target.params?.trim() ?? "";
    parent =
      findBlock(op, root, { atRule: target.atRule, params }) ??
      place(root, atRule({ name: target.atRule, params, raws: { afterName: params === "" ? "" : " ", between: " " } }), style);
  }
  if (target.selector === undefined) return parent;
  return place(parent, rule({ selector: target.selector.trim(), raws: { between: " " } }), style);
}

/**
 * Sets `property` to `value` in the `target` block: an existing declaration is updated in place,
 * a new one goes last in the block or next to the `before` / `after` anchor, and a missing block
 * is created at the end of the file. Setting the value a declaration already has changes nothing.
 */
export const setDeclaration = validatedOp<Root, [CssTarget, string, string, DeclarationOptions?]>(
  ([target, property, value, options]) => {
    assertTarget("setDeclaration", target);
    assertProperty("setDeclaration", target, property);
    assertValue("setDeclaration", target, property, value);
    assertOptions("setDeclaration", target, options);
  },
  (root, target, property, value, options = {}) => {
    const op = "setDeclaration";
    const text = value.trim();
    const important = options.important === true;
    const block = findBlock(op, root, target);
    const existing = block === undefined ? undefined : findDeclaration(op, target, block, property);
    if (existing !== undefined) {
      if (existing.value.trim() !== text) existing.value = text;
      if (existing.important !== important) existing.important = important;
      return;
    }
    const anchorName = options.before ?? options.after;
    const anchor = anchorName === undefined || block === undefined ? undefined : findDeclaration(op, target, block, anchorName);
    if (anchorName !== undefined && anchor === undefined) fail(op, target, `the anchor \`${anchorName}\` is not declared in the block.`);
    const created = decl({ prop: property, value: text, important });
    if (anchor === undefined) place(block ?? createBlock(op, root, target), created, styleOf(root));
    else if (options.before !== undefined) anchor.before(created);
    else anchor.after(created);
  }
);

/**
 * Reads `property` from the `target` block of a parsed `Root`, such as the one `.modify(fn)`
 * receives: `{ value, important }`, or `undefined` when the block or declaration is missing.
 * Not an op — it returns a value — so it is called directly, never chained on a handle.
 */
export function getDeclaration(root: Root, target: CssTarget, property: string): { value: string; important: boolean } | undefined {
  assertTarget("getDeclaration", target);
  assertProperty("getDeclaration", target, property);
  const block = findBlock("getDeclaration", root, target);
  const found = block === undefined ? undefined : findDeclaration("getDeclaration", target, block, property);
  return found === undefined ? undefined : { value: found.value.trim(), important: found.important === true };
}

/** Removes `property` from the `target` block; a missing block or declaration is a no-op. */
export const removeDeclaration = validatedOp<Root, [CssTarget, string]>(
  ([target, property]) => {
    assertTarget("removeDeclaration", target);
    assertProperty("removeDeclaration", target, property);
  },
  (root, target, property) => {
    const block = findBlock("removeDeclaration", root, target);
    if (block !== undefined) findDeclaration("removeDeclaration", target, block, property)?.remove();
  }
);
