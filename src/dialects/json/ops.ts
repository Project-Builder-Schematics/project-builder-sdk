import {
  applyEdits,
  getNodeValue,
  modify,
  parseTree,
  type Edit,
  type FormattingOptions,
  type Node,
  type ParseError,
} from "jsonc-parser";
import { deepEqual } from "../../core/deep-equal.ts";
import { dialectError } from "../../core/dialect-error.ts";
import { assertJsonValue, formatPath, type JsonPath, type JsonValue } from "../../core/json-value.ts";
import type { JsonDocument } from "./ast.ts";

export interface KeyPosition {
  before?: string;
  after?: string;
}

export interface AppendOptions {
  unique?: boolean;
}

export interface SortOptions {
  recursive?: boolean;
}

type JsonObject = { [key: string]: JsonValue };

function fail(op: string, path: JsonPath, why: string): never {
  throw dialectError(`${op}(${formatPath(path)}) — ${why}`);
}

function assertPath(op: string, path: unknown): asserts path is JsonPath {
  const valid =
    Array.isArray(path) &&
    path.every((segment) => typeof segment === "string" || (Number.isInteger(segment) && segment >= 0));
  if (!valid) {
    throw dialectError(`${op} — a path must be an array of string keys and non-negative integer indices.`);
  }
}

function assertKeyPath(op: string, path: unknown): asserts path is JsonPath {
  assertPath(op, path);
  if (typeof path.at(-1) !== "string") fail(op, path, "the path must end in an object key.");
}

function assertIndex(op: string, path: JsonPath, index: unknown, max: number): asserts index is number {
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) > max) {
    fail(op, path, `index ${String(index)} is out of range 0..${max}.`);
  }
}

function isPlainObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PARSE_OPTIONS = { allowTrailingComma: true, disallowComments: false, allowEmptyContent: true } as const;

// jsonc-parser is fault-tolerant and only reports syntax errors through `errors`, so every op
// checks them before trusting the tree. Comments and trailing commas are allowed (JSONC).
function readTree(op: string, text: string): Node | undefined {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, PARSE_OPTIONS);
  if (errors.length > 0) throw dialectError(`${op} — the document is not valid JSON.`);
  return root;
}

interface Located {
  root: Node | undefined;
  node: Node | undefined;
  parent: Node | undefined;
  /** `nodes[depth]` is the node at `path.slice(0, depth)`; the array stops at the first absent one. */
  nodes: (Node | undefined)[];
  /** Depth of the first absent node, or `-1` when every node exists. */
  missingDepth: number;
}

// Walks `path`, rejecting a segment whose kind does not fit its container (REQ-JSD-06).
function locate(op: string, text: string, path: JsonPath): Located {
  const root = readTree(op, text);
  const nodes: (Node | undefined)[] = [root];
  for (let depth = 0; depth < path.length; depth++) {
    const current = nodes[depth];
    if (current === undefined) break;
    const segment = path[depth]!;
    const at = formatPath(path.slice(0, depth + 1));
    if (current.type === "object") {
      if (typeof segment === "number") fail(op, path, `${at} indexes an object with a number.`);
      const property = current.children?.find((child) => child.children?.[0]?.value === segment);
      nodes.push(property?.children?.[1]);
    } else if (current.type === "array") {
      if (typeof segment === "string") fail(op, path, `${at} names a key on an array.`);
      nodes.push(current.children?.[segment]);
    } else {
      fail(op, path, `${at} crosses a ${current.type} value.`);
    }
  }
  return {
    root,
    node: nodes[path.length],
    parent: path.length > 0 ? nodes[path.length - 1] : undefined,
    nodes,
    missingDepth: nodes.findIndex((node) => node === undefined),
  };
}

// Only setValue-style writes create parents, and only as objects (REQ-JSD-06).
function assertCreatable(op: string, path: JsonPath, missingDepth: number): void {
  if (missingDepth === -1) return;
  const keyedSegment = path[missingDepth - 1];
  if (typeof keyedSegment === "number") fail(op, path, `index ${keyedSegment} is out of range.`);
  if (path.slice(missingDepth).some((segment) => typeof segment === "number")) {
    fail(op, path, "a missing parent would have to be an array; only objects are created.");
  }
}

function detectFormatting(text: string): FormattingOptions {
  const crlf = text.split("\r\n").length - 1;
  const bareLf = text.split("\n").length - 1 - crlf;
  const eol = crlf > bareLf ? "\r\n" : "\n";
  const indent = /^([ \t]+)\S/m.exec(text)?.[1];
  if (indent?.startsWith("\t")) return { insertSpaces: false, tabSize: 1, eol };
  return { insertSpaces: true, tabSize: indent?.length ?? 2, eol };
}

// jsonc-parser formats every line an edit touches, which would explode a one-line container
// into many lines; edits inside one-line containers therefore stay unformatted.
function formattingFor(text: string, located: Located, path: JsonPath): FormattingOptions | undefined {
  const ancestors = located.nodes.slice(0, Math.max(path.length, 1));
  const container = ancestors.findLast((node) => node !== undefined);
  if (container === undefined) return detectFormatting(text);
  return text.slice(container.offset, container.offset + container.length).includes("\n")
    ? detectFormatting(text)
    : undefined;
}

function spaceSeparators(edit: Edit): Edit {
  let content = edit.content;
  if (content.startsWith(",") && !content.startsWith(", ")) content = `, ${content.slice(1)}`;
  if (content.endsWith(",")) content = `${content} `;
  return { ...edit, content };
}

interface WriteOptions {
  position?: KeyPosition;
}

function write(op: string, doc: JsonDocument, path: JsonPath, value: JsonValue | undefined, options: WriteOptions = {}): void {
  const located = locate(op, doc.text, path);
  const { position } = options;
  if (value !== undefined && located.node === undefined && insertKeyLine(doc, located, path, value, position)) return;
  const formattingOptions = formattingFor(doc.text, located, path);
  const edits = modify(doc.text, [...path], value, {
    formattingOptions,
    getInsertionIndex:
      position === undefined
        ? undefined
        : (keys) => {
            const sibling = position.before ?? position.after;
            return keys.indexOf(sibling!) + (position.after !== undefined ? 1 : 0);
          },
  });
  doc.text = applyEdits(doc.text, formattingOptions === undefined ? edits.map(spaceSeparators) : edits);
}

const end = (node: Node) => node.offset + node.length;

function splice(doc: JsonDocument, start: number, stop: number, content: string): void {
  doc.text = doc.text.slice(0, start) + content + doc.text.slice(stop);
}

interface MemberLine {
  /** Start of the member's leading lines (indentation and comment lines above it). */
  leadStart: number;
  /** Offset of the separator comma on the member's last line, or `-1`. */
  comma: number;
  /** End of the member's last line, before its line ending. */
  tailEnd: number;
  /** Start of the next line. */
  lineEnd: number;
}

// Line-oriented layout of a container whose members each end their own line: a member owns
// the comment lines above it and the trailing comment on its last line, so edits move or drop
// those together with it. `undefined` for any other shape (one-line containers, two members on
// one line, a comma at the start of the next line).
function lineLayout(text: string, container: Node): MemberLine[] | undefined {
  const children = container.children ?? [];
  let leadStart = text.indexOf("\n", container.offset) + 1;
  if (children.length === 0 || leadStart === 0 || leadStart > children[0]!.offset) return undefined;
  const lines: MemberLine[] = [];
  for (const [index, member] of children.entries()) {
    const newline = text.indexOf("\n", end(member));
    const next = children[index + 1];
    if (newline === -1 || newline >= (next?.offset ?? end(container) - 1)) return undefined;
    const tailEnd = text[newline - 1] === "\r" ? newline - 1 : newline;
    const commaEnd = afterComma(text, end(member), tailEnd);
    const comma = commaEnd > end(member) ? commaEnd - 1 : -1;
    if (comma === -1 && next !== undefined) return undefined;
    lines.push({ leadStart, comma, tailEnd, lineEnd: newline + 1 });
    leadStart = newline + 1;
  }
  return lines;
}

// Removals and array insertions are computed against the existing separators rather than
// through jsonc-parser: its unformatted removal assumes the closing bracket sits on its own
// line, and its insertions put the new member between a member and its trailing comment.
function removeAt(op: string, doc: JsonDocument, path: JsonPath): void {
  const node = locate(op, doc.text, path).node!;
  const member = typeof path.at(-1) === "number" ? node : node.parent!;
  const container = member.parent!;
  const children = container.children!;
  const index = children.indexOf(member);
  const lines = lineLayout(doc.text, container);
  if (children.length === 1) {
    splice(doc, container.offset + 1, end(container) - 1, "");
  } else if (lines !== undefined) {
    const line = lines[index]!;
    const previousComma = index === children.length - 1 && line.comma === -1 ? lines[index - 1]!.comma : -1;
    splice(doc, line.leadStart, line.lineEnd, "");
    if (previousComma !== -1) splice(doc, previousComma, previousComma + 1, "");
  } else if (index < children.length - 1) {
    splice(doc, member.offset, children[index + 1]!.offset, "");
  } else {
    splice(doc, end(children[index - 1]!), end(member), "");
  }
}

function indentUnit(text: string): string {
  const format = detectFormatting(text);
  return format.insertSpaces ? " ".repeat(format.tabSize ?? 2) : "\t";
}

// Inserts `prefix + value` as its own line(s) before member `index`, or after the last member.
function insertLine(doc: JsonDocument, container: Node, lines: MemberLine[], index: number, prefix: string, value: JsonValue): void {
  const text = doc.text;
  const at = lines[Math.min(index, lines.length - 1)]!;
  const member = container.children![Math.min(index, lines.length - 1)]!;
  const indent = /[ \t]*$/.exec(text.slice(0, member.offset))![0];
  const eol = text.slice(lines[0]!.tailEnd, lines[0]!.lineEnd);
  const line = indent + prefix + JSON.stringify(value, null, indentUnit(text)).split("\n").join(eol + indent);
  if (index < lines.length) {
    splice(doc, at.leadStart, at.leadStart, `${line},${eol}`);
    return;
  }
  splice(doc, at.lineEnd, at.lineEnd, `${line}${at.comma === -1 ? "" : ","}${eol}`);
  const last = container.children!.at(-1)!;
  if (at.comma === -1) splice(doc, end(last), end(last), ",");
}

function insertAt(op: string, doc: JsonDocument, path: JsonPath, index: number, value: JsonValue): void {
  const array = requireArray(op, doc, path);
  const items = array.children!;
  if (items.length === 0) {
    splice(doc, array.offset + 1, end(array) - 1, JSON.stringify(value));
    return;
  }
  const text = doc.text;
  const lines = lineLayout(text, array);
  if (lines !== undefined) {
    insertLine(doc, array, lines, index, "", value);
    return;
  }
  const anchor = items[Math.min(index, items.length - 1)]!;
  const indent = text.slice(text.lastIndexOf("\n", anchor.offset - 1) + 1, anchor.offset);
  const ownLine = text.slice(array.offset, end(array)).includes("\n") && /^[ \t]*$/.test(indent);
  const eol = detectFormatting(text).eol ?? "\n";
  const rendered = ownLine ? JSON.stringify(value, null, indentUnit(text)).split("\n").join(eol + indent) : JSON.stringify(value);
  const gap = ownLine ? eol + indent : " ";
  if (index < items.length) splice(doc, anchor.offset, anchor.offset, `${rendered},${gap}`);
  else splice(doc, end(anchor), end(anchor), `,${gap}${rendered}`);
}

// A new key in an existing line-layout object is inserted here; everything else goes through
// jsonc-parser. Returns whether it handled the write.
function insertKeyLine(doc: JsonDocument, located: Located, path: JsonPath, value: JsonValue, position?: KeyPosition): boolean {
  const depth = located.missingDepth;
  const container = depth > 0 ? located.nodes[depth - 1] : undefined;
  if (container?.type !== "object") return false;
  const lines = lineLayout(doc.text, container);
  if (lines === undefined) return false;
  const nested = path.slice(depth).reduceRight<JsonValue>((inner, key) => ({ [key]: inner }), value);
  const keys = container.children!.map((property) => property.children![0]!.value as string);
  const sibling = position?.before ?? position?.after;
  const index = sibling === undefined ? keys.length : keys.indexOf(sibling) + (position?.after !== undefined ? 1 : 0);
  insertLine(doc, container, lines, index, `${JSON.stringify(path[depth - 1])}: `, nested);
  return true;
}

function assertPosition(op: string, path: JsonPath, position: KeyPosition | undefined): void {
  if (position === undefined) return;
  if (position.before !== undefined && position.after !== undefined) {
    fail(op, path, "give either `before` or `after`, not both.");
  }
}

function assertSiblingExists(op: string, path: JsonPath, parent: Node | undefined, position: KeyPosition | undefined): void {
  const sibling = position?.before ?? position?.after;
  if (sibling === undefined) return;
  const exists = parent?.type === "object" && parent.children!.some((child) => child.children?.[0]?.value === sibling);
  if (!exists) fail(op, path, `the sibling key ${JSON.stringify(sibling)} does not exist.`);
}

// Shared upsert behind setValue, updateValue, copyValue, and merge's leaves.
function upsert(op: string, doc: JsonDocument, path: JsonPath, value: JsonValue, position?: KeyPosition): void {
  const located = locate(op, doc.text, path);
  if (located.node !== undefined) {
    if (!deepEqual(getNodeValue(located.node), value)) write(op, doc, path, value);
    return;
  }
  assertCreatable(op, path, located.missingDepth);
  assertSiblingExists(op, path, located.parent, position);
  write(op, doc, path, value, { position });
}

function arrayAt(op: string, doc: JsonDocument, path: JsonPath): Node | undefined {
  const { node } = locate(op, doc.text, path);
  if (node !== undefined && node.type !== "array") fail(op, path, `the value is ${node.type}, not an array.`);
  return node;
}

function requireArray(op: string, doc: JsonDocument, path: JsonPath): Node {
  return arrayAt(op, doc, path) ?? fail(op, path, "no array exists at this path.");
}

/** Sets the value at `path`, creating missing parent objects (upsert). */
export function setValue(doc: JsonDocument, path: JsonPath, value: JsonValue, options?: KeyPosition): void {
  assertPath("setValue", path);
  assertJsonValue(value);
  assertPosition("setValue", path, options);
  if (options !== undefined && typeof path.at(-1) !== "string") {
    fail("setValue", path, "`before`/`after` need a path that ends in an object key.");
  }
  upsert("setValue", doc, path, value, options);
}

/** Adds an absent object key; a deep-equal existing value is a no-op, a different one rejects. */
export function addKey(doc: JsonDocument, path: JsonPath, value: JsonValue, options?: KeyPosition): void {
  assertKeyPath("addKey", path);
  assertJsonValue(value);
  assertPosition("addKey", path, options);
  const { node, parent } = locate("addKey", doc.text, path);
  if (node !== undefined) {
    if (deepEqual(getNodeValue(node), value)) return;
    fail("addKey", path, "the key already exists with a different value.");
  }
  if (parent === undefined) fail("addKey", path, "the parent object does not exist.");
  assertSiblingExists("addKey", path, parent, options);
  write("addKey", doc, path, value, { position: options });
}

/** Removes an object key and its separator; an absent key is a no-op. */
export function removeKey(doc: JsonDocument, path: JsonPath): void {
  assertKeyPath("removeKey", path);
  if (locate("removeKey", doc.text, path).node !== undefined) removeAt("removeKey", doc, path);
}

/** Renames an object key in place, keeping its value, position, and comments. */
export function renameKey(doc: JsonDocument, path: JsonPath, newKey: string): void {
  assertKeyPath("renameKey", path);
  if (typeof newKey !== "string") fail("renameKey", path, "`newKey` must be a string.");
  const { node, parent } = locate("renameKey", doc.text, path);
  const target = [...path.slice(0, -1), newKey];
  const renamed = parent === undefined ? undefined : locate("renameKey", doc.text, target).node;
  if (node === undefined) {
    if (renamed !== undefined) return;
    fail("renameKey", path, `neither the key nor ${formatPath(target)} exists.`);
  }
  if (path.at(-1) === newKey) return;
  if (renamed !== undefined) fail("renameKey", path, `both the key and ${formatPath(target)} exist.`);
  const keyNode = node.parent!.children![0]!;
  doc.text = doc.text.slice(0, keyNode.offset) + JSON.stringify(newKey) + doc.text.slice(keyNode.offset + keyNode.length);
}

/** Inserts `value` before the item at `index`; `index === length` appends. */
export function insertItem(doc: JsonDocument, path: JsonPath, index: number, value: JsonValue): void {
  assertPath("insertItem", path);
  assertJsonValue(value);
  const length = requireArray("insertItem", doc, path).children!.length;
  assertIndex("insertItem", path, index, length);
  insertAt("insertItem", doc, path, index, value);
}

/** Appends `value`, creating the array when absent; `{ unique: true }` skips a deep-equal duplicate. */
export function appendItem(doc: JsonDocument, path: JsonPath, value: JsonValue, options?: AppendOptions): void {
  assertPath("appendItem", path);
  assertJsonValue(value);
  const array = arrayAt("appendItem", doc, path);
  if (array === undefined) {
    upsert("appendItem", doc, path, [value]);
    return;
  }
  if (options?.unique === true && array.children!.some((item) => deepEqual(getNodeValue(item), value))) return;
  insertAt("appendItem", doc, path, array.children!.length, value);
}

/** Removes the item at `index` and its separator. */
export function removeItem(doc: JsonDocument, path: JsonPath, index: number): void {
  assertPath("removeItem", path);
  const length = requireArray("removeItem", doc, path).children!.length;
  assertIndex("removeItem", path, index, length - 1);
  removeAt("removeItem", doc, [...path, index]);
}

/** Removes every item deep-equal to `value`; no match (or no array) is a no-op. */
export function removeValue(doc: JsonDocument, path: JsonPath, value: JsonValue): void {
  assertPath("removeValue", path);
  assertJsonValue(value);
  const array = arrayAt("removeValue", doc, path);
  if (array === undefined) return;
  const matches = array.children!.flatMap((item, index) => (deepEqual(getNodeValue(item), value) ? [index] : []));
  for (const index of matches.reverse()) removeAt("removeValue", doc, [...path, index]);
}

/** Replaces the item at `index` in place. */
export function replaceItem(doc: JsonDocument, path: JsonPath, index: number, value: JsonValue): void {
  assertPath("replaceItem", path);
  assertJsonValue(value);
  const items = requireArray("replaceItem", doc, path).children!;
  assertIndex("replaceItem", path, index, items.length - 1);
  if (!deepEqual(getNodeValue(items[index]!), value)) write("replaceItem", doc, [...path, index], value);
}

/** Moves the item at `from` so it ends up at `to`; the other items keep their relative order. */
export function moveItem(doc: JsonDocument, path: JsonPath, from: number, to: number): void {
  assertPath("moveItem", path);
  const items = requireArray("moveItem", doc, path).children!;
  assertIndex("moveItem", path, from, items.length - 1);
  assertIndex("moveItem", path, to, items.length - 1);
  if (from === to) return;
  const value = getNodeValue(items[from]!) as JsonValue;
  removeAt("moveItem", doc, [...path, from]);
  insertAt("moveItem", doc, path, to, value);
}

function mergeInto(doc: JsonDocument, path: JsonPath, value: JsonObject): void {
  for (const [key, incoming] of Object.entries(value)) {
    const childPath = [...path, key];
    const child = locate("merge", doc.text, childPath).node;
    if (child?.type === "object" && isPlainObject(incoming)) {
      mergeInto(doc, childPath, incoming);
    } else {
      upsert("merge", doc, childPath, incoming);
    }
  }
}

/** Deep-merges a plain object into the object at `path`; arrays and scalars are replaced. */
export function merge(doc: JsonDocument, path: JsonPath, value: JsonObject): void {
  assertPath("merge", path);
  assertJsonValue(value);
  if (!isPlainObject(value)) fail("merge", path, "the merged value must be a plain object.");
  const { node, missingDepth } = locate("merge", doc.text, path);
  if (node === undefined) {
    assertCreatable("merge", path, missingDepth);
    write("merge", doc, path, value);
    return;
  }
  if (node.type !== "object") fail("merge", path, `the target is ${node.type}, not an object.`);
  mergeInto(doc, path, value);
}

/** Replaces the value at `path` with `fn(current)`; `current` is `undefined` when absent. */
export function updateValue<T extends JsonValue>(
  doc: JsonDocument,
  path: JsonPath,
  fn: (current: JsonValue | undefined) => T
): void {
  assertPath("updateValue", path);
  if (typeof fn !== "function") fail("updateValue", path, "`fn` must be a function.");
  const { node, missingDepth } = locate("updateValue", doc.text, path);
  if (node === undefined) assertCreatable("updateValue", path, missingDepth);
  const next: unknown = fn(node === undefined ? undefined : (getNodeValue(node) as JsonValue));
  assertJsonValue(next);
  upsert("updateValue", doc, path, next);
}

function isWithin(path: JsonPath, prefix: JsonPath): boolean {
  return path.length > prefix.length && prefix.every((segment, index) => path[index] === segment);
}

/** Moves the value at `from` to `to` (RFC 6902 `move`); a `number` last segment in `to` inserts. */
export function moveValue(doc: JsonDocument, from: JsonPath, to: JsonPath): void {
  assertPath("moveValue", from);
  assertPath("moveValue", to);
  if (from.length === 0) fail("moveValue", from, "the document root cannot be moved.");
  if (isWithin(to, from)) fail("moveValue", from, `the destination ${formatPath(to)} lies inside the source.`);
  const source = locate("moveValue", doc.text, from).node;
  if (source === undefined) {
    if (locate("moveValue", doc.text, to).node !== undefined) return;
    fail("moveValue", from, `neither the source nor ${formatPath(to)} exists.`);
  }
  if (deepEqual(from, to)) return;
  const value = getNodeValue(source) as JsonValue;
  // Work on a scratch document so a rejected destination leaves the live text untouched.
  const scratch: JsonDocument = { text: doc.text };
  removeAt("moveValue", scratch, from);
  const last = to.at(-1);
  if (typeof last === "number") {
    const length = requireArray("moveValue", scratch, to.slice(0, -1)).children!.length;
    assertIndex("moveValue", to, last, length);
    insertAt("moveValue", scratch, to.slice(0, -1), last, value);
  } else {
    upsert("moveValue", scratch, to, value);
  }
  doc.text = scratch.text;
}

/** Copies the value at `from` to `to` with `setValue`'s rules (RFC 6902 `copy`). */
export function copyValue(doc: JsonDocument, from: JsonPath, to: JsonPath): void {
  assertPath("copyValue", from);
  assertPath("copyValue", to);
  const source = locate("copyValue", doc.text, from).node ?? fail("copyValue", from, "the source does not exist.");
  upsert("copyValue", doc, to, getNodeValue(source) as JsonValue);
}

function compareCodePoints(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const delta = left[index]!.codePointAt(0)! - right[index]!.codePointAt(0)!;
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
}

// Offset just past the separator comma in `text[start, end)`, which holds only whitespace,
// comments, and that comma.
function afterComma(text: string, start: number, end: number): number {
  for (let index = start; index < end; index++) {
    if (text.startsWith("//", index)) index = text.indexOf("\n", index);
    else if (text.startsWith("/*", index)) index = text.indexOf("*/", index) + 1;
    else if (text[index] === ",") return index + 1;
    if (index < start) break;
  }
  return start;
}

// Re-renders `node`, reordering object members; each member keeps the text that precedes it
// (its comments and indentation), and separators stay in place.
function sortedText(text: string, node: Node, recursive: boolean): string {
  const slice = (from: number, to: number) => text.slice(from, to);
  const render = (child: Node) => (recursive ? sortedText(text, child, true) : slice(child.offset, child.offset + child.length));
  const nodeEnd = end(node);
  const children = node.children ?? [];
  if (node.type === "array") {
    let out = "";
    let cursor = node.offset;
    for (const child of children) {
      out += slice(cursor, child.offset) + render(child);
      cursor = child.offset + child.length;
    }
    return out + slice(cursor, nodeEnd);
  }
  if (node.type !== "object" || children.length === 0) return slice(node.offset, nodeEnd);
  const members = children.map((property, index) => {
    const previous = children[index - 1];
    const leadStart = previous === undefined ? node.offset + 1 : afterComma(text, previous.offset + previous.length, property.offset);
    const [key, value] = property.children as [Node, Node];
    return {
      key: key.value as string,
      lead: slice(leadStart, property.offset),
      body: slice(property.offset, value.offset) + render(value),
      separator: previous === undefined ? "" : slice(previous.offset + previous.length, leadStart),
    };
  });
  const sorted = [...members].sort((a, b) => compareCodePoints(a.key, b.key));
  const last = children.at(-1)!;
  const lines = lineLayout(text, node);
  if (lines !== undefined) {
    // Each member carries its trailing comment; commas are re-placed by position.
    const trailingComma = lines.at(-1)!.comma !== -1;
    const tails = children.map((property, index) => {
      const { comma, tailEnd } = lines[index]!;
      return comma === -1 ? slice(end(property), tailEnd) : slice(end(property), comma) + slice(comma + 1, tailEnd);
    });
    const order = sorted.map((member) => members.indexOf(member));
    return (
      slice(node.offset, lines[0]!.leadStart) +
      order
        .map((from, position) => {
          const lead = slice(lines[from]!.leadStart, children[from]!.offset);
          const comma = position < children.length - 1 || trailingComma ? "," : "";
          return lead + members[from]!.body + comma + tails[from] + slice(lines[position]!.tailEnd, lines[position]!.lineEnd);
        })
        .join("") +
      slice(lines.at(-1)!.lineEnd, nodeEnd)
    );
  }
  return (
    "{" +
    sorted.map((member, index) => members[index]!.separator + member.lead + member.body).join("") +
    slice(last.offset + last.length, nodeEnd)
  );
}

/** Orders the object's members by key (code-point order); `{ recursive: true }` sorts nested objects too. */
export function sortKeys(doc: JsonDocument, path: JsonPath, options?: SortOptions): void {
  assertPath("sortKeys", path);
  const { node } = locate("sortKeys", doc.text, path);
  if (node?.type !== "object") fail("sortKeys", path, `the value is ${node?.type ?? "absent"}, not an object.`);
  const sorted = sortedText(doc.text, node, options?.recursive === true);
  doc.text = doc.text.slice(0, node.offset) + sorted + doc.text.slice(node.offset + node.length);
}
