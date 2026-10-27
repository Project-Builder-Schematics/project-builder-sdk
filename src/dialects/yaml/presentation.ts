// Presentation ops only YAML has: comments, anchors, aliases, merge keys, styles, and tags.

import { Alias, Document, Pair, Scalar, isAlias, isMap, isScalar, isSeq, parseDocument, visit, type Node, type YAMLMap } from "yaml";
import { deepEqual } from "../../core/deep-equal.ts";
import type { YamlStream } from "./ast.ts";
import {
  assertAliasesResolve,
  assertPath,
  fail,
  findAnchored,
  findPair,
  resolve,
  selectDocument,
  toValue,
  writeSlot,
  type DocumentOption,
  type Slot,
  type YamlPath,
} from "./paths.ts";

export type CommentPosition = "before" | "inline";
export type CommentOptions = DocumentOption & { position?: CommentPosition };
export type CollectionStyle = "block" | "flow";
export type ScalarStyle = "plain" | "single" | "double" | "literal" | "folded";

function existingSlot(op: string, document: Document, path: YamlPath): Slot & { node: Node } {
  const slot = resolve(op, document, path, "write");
  if (slot.node === null) fail(op, path, "no node exists at this path.");
  return slot as Slot & { node: Node };
}

function position(op: string, path: YamlPath, options: CommentOptions | undefined): CommentPosition {
  const value = options?.position ?? "before";
  if (value !== "before" && value !== "inline") fail(op, path, `position must be "before" or "inline", got ${String(value)}.`);
  return value;
}

const isBlockCollection = (node: Node): boolean => (isMap(node) || isSeq(node)) && node.flow !== true;

/** The object and field holding the comment at `where` for the node at `path`. */
function commentHolder(op: string, document: Document, path: YamlPath, where: CommentPosition): { holder: { commentBefore?: string | null; comment?: string | null }; field: "commentBefore" | "comment" } {
  if (path.length === 0) {
    if (where === "inline") fail(op, path, "the document has no inline comment position; use position \"before\".");
    return { holder: document, field: "commentBefore" };
  }
  const slot = existingSlot(op, document, path);
  if (where === "before") {
    if (isMap(slot.parent)) return { holder: findPair(slot.parent, slot.segment as string)!.key as Node, field: "commentBefore" };
    return { holder: slot.node, field: "commentBefore" };
  }
  if (isBlockCollection(slot.node)) {
    if (isSeq(slot.parent)) fail(op, path, "a block collection item has no inline position; address a scalar inside it.");
    if (isMap(slot.parent)) return { holder: findPair(slot.parent, slot.segment as string)!.key as Node, field: "comment" };
  }
  return { holder: slot.node, field: "comment" };
}

const toCommentText = (comment: string): string =>
  comment
    .split(/\r?\n/)
    .map((line) => (line === "" ? "" : ` ${line}`))
    .join("\n");

/** Sets the comment before a node, or after it on the same line; multi-line text gives one `#` line each. */
export function setComment(ast: YamlStream, path: YamlPath, comment: string, options?: CommentOptions): void {
  assertPath("setComment", path);
  if (typeof comment !== "string") fail("setComment", path, "comment must be a string.");
  const where = position("setComment", path, options);
  const document = selectDocument("setComment", ast, options);
  const { holder, field } = commentHolder("setComment", document, path, where);
  const text = toCommentText(comment);
  if (holder[field] !== text) holder[field] = text;
}

/** Removes the comment at the given position; no comment is a no-op. */
export function removeComment(ast: YamlStream, path: YamlPath, options?: CommentOptions): void {
  assertPath("removeComment", path);
  const where = position("removeComment", path, options);
  const document = selectDocument("removeComment", ast, options);
  const { holder, field } = commentHolder("removeComment", document, path, where);
  if (holder[field]) holder[field] = undefined;
}

// ns-anchor-char: any printable non-space character except the flow indicators.
const ANCHOR_NAME = /^[^\s,[\]{}\p{Cc}]+$/u;

function anchoredTarget(op: string, document: Document, path: YamlPath): Node {
  const { node } = existingSlot(op, document, path);
  if (isAlias(node)) fail(op, path, `the value is the alias *${node.source}; anchors go on the anchored node.`);
  return node;
}

function aliasesOf(document: Document, node: Node): Alias[] {
  const aliases: Alias[] = [];
  visit(document, {
    Alias(_, alias) {
      if (alias.resolve(document) === node) aliases.push(alias);
    },
  });
  return aliases;
}

/** Puts `&name` on the node at `path`; renaming an anchor re-points its aliases. */
export function setAnchor(ast: YamlStream, path: YamlPath, name: string, options?: DocumentOption): void {
  assertPath("setAnchor", path);
  if (typeof name !== "string" || !ANCHOR_NAME.test(name)) fail("setAnchor", path, `"${String(name)}" is not a valid YAML anchor name.`);
  const document = selectDocument("setAnchor", ast, options);
  const node = anchoredTarget("setAnchor", document, path);
  if (node.anchor === name) return;
  if (findAnchored(document, name) !== undefined) fail("setAnchor", path, `another node already carries &${name}.`);
  for (const alias of aliasesOf(document, node)) alias.source = name;
  node.anchor = name;
}

/** Removes the anchor, replacing every alias to it with a copy so the data is unchanged. */
export function removeAnchor(ast: YamlStream, path: YamlPath, options?: DocumentOption): void {
  assertPath("removeAnchor", path);
  const document = selectDocument("removeAnchor", ast, options);
  const node = anchoredTarget("removeAnchor", document, path);
  if (!node.anchor) return;
  const aliases = new Set(aliasesOf(document, node));
  visit(document, {
    Alias(_, alias) {
      if (!aliases.has(alias)) return undefined;
      const copy = node.clone() as Node;
      visit(copy, (__, inner) => {
        if (inner !== null && typeof inner === "object" && "anchor" in inner) (inner as Node).anchor = undefined;
      });
      copy.anchor = undefined;
      copy.comment = alias.comment;
      copy.commentBefore = alias.commentBefore;
      copy.spaceBefore = alias.spaceBefore;
      return copy;
    },
  });
  node.anchor = undefined;
}

/** Sets the value at `path` to `*anchor`, creating missing parents like `setValue`. */
export function setAlias(ast: YamlStream, path: YamlPath, anchor: string, options?: DocumentOption): void {
  assertPath("setAlias", path);
  if (typeof anchor !== "string") fail("setAlias", path, "anchor must be a string.");
  const document = selectDocument("setAlias", ast, options);
  if (findAnchored(document, anchor) === undefined) fail("setAlias", path, `no node carries the anchor &${anchor}.`);
  const slot = resolve("setAlias", document, path, "create");
  if (isAlias(slot.node) && slot.node.source === anchor) return;
  if (isSeq(slot.parent) && (slot.segment as number) >= slot.parent.items.length) {
    fail("setAlias", path, `index ${String(slot.segment)} is out of range.`);
  }
  const alias = new Alias(anchor);
  if (slot.node !== null) {
    alias.commentBefore = slot.node.commentBefore;
    alias.comment = slot.node.comment;
    alias.spaceBefore = slot.node.spaceBefore;
  }
  writeSlot(document, slot, alias);
  if (findAnchored(document, anchor) === undefined) fail("setAlias", path, `the alias *${anchor} would replace its own anchor.`);
  assertAliasesResolve("setAlias", document);
}

const isMergeKey = (pair: Pair): boolean => isScalar(pair.key) && typeof pair.key.value === "symbol";

/** Adds `<<: *anchor` as the first entry of the mapping at `path`. */
export function addMergeKey(ast: YamlStream, path: YamlPath, anchor: string, options?: DocumentOption): void {
  assertPath("addMergeKey", path);
  if (typeof anchor !== "string") fail("addMergeKey", path, "anchor must be a string.");
  const document = selectDocument("addMergeKey", ast, options);
  const anchored = findAnchored(document, anchor);
  if (anchored === undefined) fail("addMergeKey", path, `no node carries the anchor &${anchor}.`);
  if (!isMap(anchored)) fail("addMergeKey", path, `the node anchored &${anchor} is not a mapping.`);
  const { node } = existingSlot("addMergeKey", document, path);
  if (isAlias(node)) fail("addMergeKey", path, `the value is the alias *${node.source}; edit the anchored node instead.`);
  if (!isMap(node)) fail("addMergeKey", path, "the value is not a mapping.");
  const map = node as YAMLMap;
  const existing = (map.items as Pair[]).find(isMergeKey);
  const sources = existing === undefined ? [] : isSeq(existing.value) ? existing.value.items : [existing.value];
  if (sources.some((source) => isAlias(source) && source.source === anchor)) return;
  if (existing === undefined) {
    map.items.unshift(new Pair(MERGE_KEY.clone(), new Alias(anchor)));
  } else {
    const seq = document.createNode([], { flow: true }) as unknown as { items: unknown[] };
    seq.items.push(...sources, new Alias(anchor));
    existing.value = seq;
  }
  assertAliasesResolve("addMergeKey", document);
}

// The merge key is a schema-specific scalar, so it is taken from a parse rather than built.
const MERGE_KEY = (parseDocument("<<: null\n", { merge: true }).contents as YAMLMap).items[0]!.key as Scalar;

const SCALAR_TYPES: Record<ScalarStyle, Scalar.Type> = {
  plain: Scalar.PLAIN,
  single: Scalar.QUOTE_SINGLE,
  double: Scalar.QUOTE_DOUBLE,
  literal: Scalar.BLOCK_LITERAL,
  folded: Scalar.BLOCK_FOLDED,
};

function printsAs(scalar: Scalar, type: Scalar.Type): boolean {
  const copy = scalar.clone() as Scalar;
  copy.type = type;
  copy.comment = undefined;
  copy.commentBefore = undefined;
  copy.anchor = undefined;
  const text = new Document(copy).toString({ lineWidth: 0 }).trimStart();
  const lead = text.replace(/^!\S*\s*/, "")[0];
  const expected = { PLAIN: undefined, QUOTE_SINGLE: "'", QUOTE_DOUBLE: '"', BLOCK_LITERAL: "|", BLOCK_FOLDED: ">" }[type];
  if (expected === undefined) return lead !== "'" && lead !== '"' && lead !== "|" && lead !== ">";
  return lead === expected;
}

/** Sets a collection to block or flow, or a scalar to a quoting or block style. */
export function setStyle(ast: YamlStream, path: YamlPath, style: CollectionStyle | ScalarStyle, options?: DocumentOption): void {
  assertPath("setStyle", path);
  const document = selectDocument("setStyle", ast, options);
  const { node } = existingSlot("setStyle", document, path);
  if (isAlias(node)) fail("setStyle", path, `the value is the alias *${node.source}; aliases have no style.`);
  if (style === "block" || style === "flow") {
    if (!isMap(node) && !isSeq(node)) fail("setStyle", path, `"${style}" is a collection style and the value is a scalar.`);
    const flow = style === "flow";
    if ((node.flow === true) !== flow) node.flow = flow;
    return;
  }
  const type = SCALAR_TYPES[style as ScalarStyle];
  if (type === undefined) fail("setStyle", path, `unknown style "${String(style)}".`);
  if (!isScalar(node)) fail("setStyle", path, `"${style}" is a scalar style and the value is a collection.`);
  const scalar = node as Scalar;
  if (scalar.type === type) return;
  if (!printsAs(scalar, type)) fail("setStyle", path, `the value cannot be written ${style} without changing it.`);
  const before = toValue(document, scalar);
  const previous = scalar.type;
  scalar.type = type;
  if (!deepEqual(new Document(scalar.clone()).toJS(), before)) {
    scalar.type = previous;
    fail("setStyle", path, `the value cannot be written ${style} without changing it.`);
  }
}

const TAG_SUFFIX = /^[A-Za-z0-9\-#;/?:@&=+$_.~*'()%]+$/;

function normalizeTag(op: string, path: YamlPath, document: Document, tag: string): string {
  if (/^!<[^<>\s]+>$/.test(tag)) return tag.slice(2, -1);
  if (tag.startsWith("!!") && TAG_SUFFIX.test(tag.slice(2))) return `tag:yaml.org,2002:${tag.slice(2)}`;
  const named = /^(![A-Za-z0-9-]*!)(.+)$/.exec(tag);
  if (named !== null && named[1] !== "!!") {
    const prefix = document.directives?.tags[named[1]!];
    if (prefix === undefined || !TAG_SUFFIX.test(named[2]!)) fail(op, path, `"${tag}" uses an undeclared tag handle.`);
    return prefix + named[2];
  }
  if (tag.startsWith("!") && TAG_SUFFIX.test(tag.slice(1))) return tag;
  return fail(op, path, `"${tag}" is not a valid YAML tag.`);
}

/** Sets the node's tag, keeping its value and style; `null` removes it. */
export function setTag(ast: YamlStream, path: YamlPath, tag: string | null, options?: DocumentOption): void {
  assertPath("setTag", path);
  if (tag !== null && typeof tag !== "string") fail("setTag", path, "tag must be a string or null.");
  const document = selectDocument("setTag", ast, options);
  const { node } = existingSlot("setTag", document, path);
  if (isAlias(node)) fail("setTag", path, `the value is the alias *${node.source}; aliases have no tag.`);
  const next = tag === null ? undefined : normalizeTag("setTag", path, document, tag);
  if (node.tag !== next) node.tag = next;
}

