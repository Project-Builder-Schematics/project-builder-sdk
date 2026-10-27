// Shared plumbing for the YAML ops: document selection, path resolution over `yaml` nodes,
// node replacement that keeps comments and anchors, and the alias-order invariant.

import { Pair, Scalar, isAlias, isMap, isNode, isScalar, isSeq, visit, type Document, type Node, type YAMLMap, type YAMLSeq } from "yaml";
import { dialectError } from "../../core/dialect-error.ts";
import { assertJsonValue, formatPath, type JsonPath, type JsonValue } from "../../core/json-value.ts";
import { newDocument, type YamlStream } from "./ast.ts";

export type YamlValue = JsonValue;
export type YamlPath = JsonPath;

/** The `{ document }` option every op accepts as its last argument. */
export interface DocumentOption {
  document?: number;
}

/** Key placement for a newly created mapping key. */
export interface PositionOption {
  before?: string;
  after?: string;
}

export type Container = YAMLMap | YAMLSeq;

/** A resolved location: the node at `path` (null when absent) and where it lives. */
export interface Slot {
  parent: Container | null;
  segment: string | number | null;
  node: Node | null;
}

export function fail(op: string, path: YamlPath | null, tail: string): never {
  throw dialectError(path === null ? `${op}: ${tail}` : `${op} ${formatPath(path)}: ${tail}`);
}

export function isPlainObject(value: unknown): value is { [key: string]: JsonValue } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function assertPath(op: string, path: unknown): asserts path is YamlPath {
  if (!Array.isArray(path)) fail(op, null, "path must be an array of keys and indices.");
  for (const segment of path) {
    if (typeof segment === "string") continue;
    if (typeof segment !== "number" || !Number.isInteger(segment) || segment < 0) {
      fail(op, path as YamlPath, `segment ${String(segment)} is neither a key nor a non-negative integer index.`);
    }
  }
}

export function assertValue(op: string, path: YamlPath, value: unknown): asserts value is YamlValue {
  try {
    assertJsonValue(value);
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^dialect operation failed: /, "") : String(error);
    fail(op, path, message);
  }
}

function assertOptions(op: string, options: unknown): void {
  if (options !== undefined && !isPlainObject(options)) fail(op, null, "options must be a plain object.");
}

/**
 * Picks the document an op edits. An empty stream gets document 0 created on demand by the ops
 * that create missing parents; every other out-of-range index rejects.
 */
export function selectDocument(op: string, stream: YamlStream, options: DocumentOption | undefined, create = false): Document {
  assertOptions(op, options);
  const index = options?.document ?? 0;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= stream.documents.length) {
    if (create && index === 0 && stream.documents.length === 0) {
      const document = newDocument();
      stream.documents.push(document);
      return document;
    }
    fail(op, null, `document ${String(index)} is out of range; the file has ${stream.documents.length} document(s).`);
  }
  return stream.documents[index]!;
}

export function keyLabel(key: unknown): string | undefined {
  if (!isScalar(key)) return undefined;
  return typeof key.value === "symbol" ? "<<" : String(key.value);
}

export function findPair(map: YAMLMap, key: string): Pair | undefined {
  return map.items.find((pair) => keyLabel(pair.key) === key) as Pair | undefined;
}

function childOf(container: Container, segment: string | number): Node | null {
  if (isMap(container)) {
    const pair = findPair(container, segment as string);
    return pair === undefined ? null : ((pair.value as Node | null) ?? new Scalar(null));
  }
  return (container.items[segment as number] as Node | undefined) ?? null;
}

export function resolveAlias(document: Document, node: Node | null): Node | null {
  return isAlias(node) ? ((node.resolve(document) as Node | undefined) ?? null) : node;
}

function describe(node: Node | null): string {
  if (isMap(node)) return "a mapping";
  if (isSeq(node)) return "a sequence";
  if (isAlias(node)) return `the alias *${node.source}`;
  return "a scalar";
}

/**
 * Walks `path`. `mode` decides how containers along the way behave: `read` follows aliases,
 * `write` rejects descending into an alias, and `create` also adds missing parents as mappings.
 */
export function resolve(op: string, document: Document, path: YamlPath, mode: "read" | "write" | "create"): Slot {
  let slot: Slot = { parent: null, segment: null, node: (document.contents as Node | null) ?? null };
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]!;
    let current = slot.node;
    if (isAlias(current)) {
      if (mode !== "read") fail(op, path, `${formatPath(path.slice(0, i))} is the alias *${current.source}; edit the anchored node instead.`);
      current = resolveAlias(document, current);
    }
    if (current === null) {
      if (mode !== "create") return { parent: null, segment, node: null };
      if (typeof segment === "number") fail(op, path, `${formatPath(path.slice(0, i))} is absent; only mappings are created for missing parents.`);
      current = createNode(document, {}) as YAMLMap;
      writeSlot(document, slot, current);
    }
    if (typeof segment === "number" && !isSeq(current)) {
      fail(op, path, `index ${segment} addresses ${describe(current)}, not a sequence.`);
    }
    if (typeof segment === "string" && !isMap(current)) {
      fail(op, path, `key "${segment}" addresses ${describe(current)}, not a mapping.`);
    }
    const container = current as Container;
    slot = { parent: container, segment, node: childOf(container, segment) };
  }
  return slot;
}

/** Writes `node` into the slot's position, creating the mapping key when absent. */
export function writeSlot(document: Document, slot: Slot, node: Node, position?: PositionOption): void {
  if (slot.parent === null) {
    document.contents = node as never;
    return;
  }
  if (isMap(slot.parent)) {
    const existing = findPair(slot.parent, slot.segment as string);
    if (existing !== undefined) {
      existing.value = node;
      return;
    }
    const pair = new Pair(new Scalar(slot.segment), node);
    slot.parent.items.splice(insertionIndex(slot.parent, position), 0, pair);
    return;
  }
  slot.parent.items[slot.segment as number] = node;
}

function insertionIndex(map: YAMLMap, position: PositionOption | undefined): number {
  const sibling = position?.before ?? position?.after;
  if (sibling === undefined) return map.items.length;
  const index = map.items.findIndex((pair) => keyLabel(pair.key) === sibling);
  return position?.before !== undefined ? index : index + 1;
}

/** Rejects a malformed `before`/`after` before anything changes. */
export function assertPosition(op: string, path: YamlPath, document: Document, options: PositionOption | undefined): void {
  if (options?.before !== undefined && options.after !== undefined) fail(op, path, "give either before or after, not both.");
  const sibling = options?.before ?? options?.after;
  if (sibling === undefined) return;
  if (path.length === 0 || typeof path[path.length - 1] !== "string") fail(op, path, "before/after only place mapping keys.");
  const parent = resolve(op, document, path.slice(0, -1), "read").node;
  const resolved = resolveAlias(document, parent);
  const exists = isMap(resolved) && findPair(resolved, path[path.length - 1] as string) !== undefined;
  if (!exists && !(isMap(resolved) && findPair(resolved, sibling) !== undefined)) {
    fail(op, path, `sibling key "${sibling}" does not exist.`);
  }
}

/** Builds a node from plain data; a value referenced twice is written out twice, never aliased. */
export function createNode(document: Document, value: unknown): Node {
  return document.createNode(value, { aliasDuplicateObjects: false }) as Node;
}

export function toValue(document: Document, node: Node | null): unknown {
  if (node === null) return undefined;
  return node.toJS(document, { maxAliasCount: -1 });
}

/**
 * Builds the node that replaces `old` with `value`, keeping its comments, blank line, anchor,
 * and collection style. A scalar of the same type is edited in place so its quoting survives.
 */
export function replacement(document: Document, old: Node | null, value: YamlValue): Node {
  if (isScalar(old) && value !== null && typeof value !== "object" && typeof old.value === typeof value && old.tag === undefined) {
    old.value = value;
    return old;
  }
  const node = createNode(document, value) as Node;
  if (old !== null) {
    node.commentBefore = old.commentBefore;
    node.comment = old.comment;
    node.spaceBefore = old.spaceBefore;
    if (!isAlias(old)) node.anchor = old.anchor;
    if ((isMap(old) || isSeq(old)) && (isMap(node) || isSeq(node))) node.flow = old.flow;
  }
  return node;
}

/** Every alias must follow a node carrying its anchor in document order. */
export function assertAliasesResolve(op: string, document: Document): void {
  const seen = new Set<string>();
  visit(document, (_, node) => {
    if (isAlias(node)) {
      if (!seen.has(node.source)) fail(op, null, `the edit leaves the alias *${node.source} without a preceding anchor &${node.source}.`);
      return;
    }
    if (isNode(node) && node.anchor) seen.add(node.anchor);
  });
}

export function findAnchored(document: Document, name: string): Node | undefined {
  let found: Node | undefined;
  visit(document, (_, node) => {
    if (isNode(node) && !isAlias(node) && node.anchor === name) found = node;
  });
  return found;
}

