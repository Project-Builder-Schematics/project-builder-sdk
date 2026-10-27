// Structural ops: the JSON dialect's catalogue over `yaml` nodes, with "object" read as mapping
// and "array" as sequence.

import { isAlias, isMap, isSeq, type Document, type Node, type YAMLMap, type YAMLSeq } from "yaml";
import { deepEqual } from "../../core/deep-equal.ts";
import { formatPath } from "../../core/json-value.ts";
import type { YamlStream } from "./ast.ts";
import {
  assertAliasesResolve,
  assertPath,
  assertPosition,
  assertValue,
  createNode,
  fail,
  findPair,
  isPlainObject,
  keyLabel,
  replacement,
  resolve,
  resolveAlias,
  selectDocument,
  toValue,
  writeSlot,
  type DocumentOption,
  type PositionOption,
  type YamlPath,
  type YamlValue,
} from "./paths.ts";

export type KeyOptions = DocumentOption & PositionOption;

function upsert(op: string, document: Document, path: YamlPath, value: YamlValue, options?: PositionOption): void {
  assertPosition(op, path, document, options);
  const slot = resolve(op, document, path, "create");
  if (slot.node !== null && deepEqual(toValue(document, slot.node), value)) return;
  if (isSeq(slot.parent) && (slot.segment as number) >= slot.parent.items.length) {
    fail(op, path, `index ${String(slot.segment)} is out of range for a sequence of ${slot.parent.items.length}.`);
  }
  writeSlot(document, slot, replacement(document, slot.node, value), options);
}

/** Sets the value at `path`, creating missing parent mappings; an equal value changes nothing. */
export function setValue(ast: YamlStream, path: YamlPath, value: YamlValue, options?: KeyOptions): void {
  assertPath("setValue", path);
  assertValue("setValue", path, value);
  const document = selectDocument("setValue", ast, options, true);
  upsert("setValue", document, path, value, options);
  assertAliasesResolve("setValue", document);
}

/** Adds a mapping key that does not exist yet; an equal existing value is a no-op. */
export function addKey(ast: YamlStream, path: YamlPath, value: YamlValue, options?: KeyOptions): void {
  assertPath("addKey", path);
  assertValue("addKey", path, value);
  if (typeof path[path.length - 1] !== "string") fail("addKey", path, "the last segment must be a key.");
  const document = selectDocument("addKey", ast, options);
  assertPosition("addKey", path, document, options);
  const slot = resolve("addKey", document, path, "write");
  if (!isMap(slot.parent)) fail("addKey", path, "the parent mapping does not exist.");
  if (slot.node !== null) {
    if (deepEqual(toValue(document, slot.node), value)) return;
    fail("addKey", path, "the key already exists with a different value.");
  }
  writeSlot(document, slot, replacement(document, null, value), options);
}

/** Removes a mapping key and its comments; an absent key is a no-op. */
export function removeKey(ast: YamlStream, path: YamlPath, options?: DocumentOption): void {
  assertPath("removeKey", path);
  if (typeof path[path.length - 1] !== "string") fail("removeKey", path, "the last segment must be a key.");
  const document = selectDocument("removeKey", ast, options);
  const slot = resolve("removeKey", document, path, "write");
  if (slot.node === null || !isMap(slot.parent)) return;
  const map = slot.parent;
  map.items.splice(map.items.indexOf(findPair(map, slot.segment as string)!), 1);
  assertAliasesResolve("removeKey", document);
}

/** Renames a mapping key in place, keeping its value, position, and comments. */
export function renameKey(ast: YamlStream, path: YamlPath, newKey: string, options?: DocumentOption): void {
  assertPath("renameKey", path);
  if (typeof path[path.length - 1] !== "string") fail("renameKey", path, "the last segment must be a key.");
  if (typeof newKey !== "string") fail("renameKey", path, "newKey must be a string.");
  const document = selectDocument("renameKey", ast, options);
  const slot = resolve("renameKey", document, path, "write");
  const map = isMap(slot.parent) ? slot.parent : null;
  const target = map === null ? undefined : findPair(map, newKey);
  if (slot.node === null) {
    if (target !== undefined) return;
    fail("renameKey", path, `neither the key nor "${newKey}" exists.`);
  }
  if (target !== undefined && newKey !== slot.segment) fail("renameKey", path, `"${newKey}" already exists.`);
  const pair = findPair(map!, slot.segment as string)!;
  (pair.key as { value: unknown }).value = newKey;
}

function sequenceAt(op: string, document: Document, path: YamlPath, mode: "write" | "create"): YAMLSeq | null {
  const slot = resolve(op, document, path, mode);
  if (slot.node === null) {
    if (mode !== "create") return null;
    const seq = createNode(document, []) as YAMLSeq;
    writeSlot(document, slot, seq);
    return seq;
  }
  if (isAlias(slot.node)) fail(op, path, `the value is the alias *${slot.node.source}; edit the anchored node instead.`);
  if (!isSeq(slot.node)) fail(op, path, "the value is not a sequence.");
  return slot.node;
}

function requireSequence(op: string, document: Document, path: YamlPath): YAMLSeq {
  const seq = sequenceAt(op, document, path, "write");
  if (seq === null) fail(op, path, "no sequence exists at this path.");
  return seq;
}

function assertIndex(op: string, path: YamlPath, index: unknown, max: number): asserts index is number {
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > max) {
    fail(op, path, `index ${String(index)} is out of range (0..${max}).`);
  }
}

/** Inserts a sequence item before `index`; `index` equal to the length appends. */
export function insertItem(ast: YamlStream, path: YamlPath, index: number, value: YamlValue, options?: DocumentOption): void {
  assertPath("insertItem", path);
  assertValue("insertItem", path, value);
  const document = selectDocument("insertItem", ast, options);
  const seq = requireSequence("insertItem", document, path);
  assertIndex("insertItem", path, index, seq.items.length);
  seq.items.splice(index, 0, createNode(document, value));
}

/** Appends a sequence item, creating the sequence; `{ unique: true }` skips a deep-equal duplicate. */
export function appendItem(ast: YamlStream, path: YamlPath, value: YamlValue, options?: DocumentOption & { unique?: boolean }): void {
  assertPath("appendItem", path);
  assertValue("appendItem", path, value);
  const document = selectDocument("appendItem", ast, options, true);
  const seq = sequenceAt("appendItem", document, path, "create")!;
  if (options?.unique === true && seq.items.some((item) => deepEqual(toValue(document, item as Node), value))) return;
  seq.items.push(createNode(document, value));
}

/** Removes the sequence item at `index`. */
export function removeItem(ast: YamlStream, path: YamlPath, index: number, options?: DocumentOption): void {
  assertPath("removeItem", path);
  const document = selectDocument("removeItem", ast, options);
  const seq = requireSequence("removeItem", document, path);
  assertIndex("removeItem", path, index, seq.items.length - 1);
  seq.items.splice(index, 1);
  assertAliasesResolve("removeItem", document);
}

/** Removes every sequence item deep-equal to `value`; no match is a no-op. */
export function removeValue(ast: YamlStream, path: YamlPath, value: YamlValue, options?: DocumentOption): void {
  assertPath("removeValue", path);
  assertValue("removeValue", path, value);
  const document = selectDocument("removeValue", ast, options);
  const seq = sequenceAt("removeValue", document, path, "write");
  if (seq === null) return;
  seq.items = seq.items.filter((item) => !deepEqual(toValue(document, item as Node), value));
  assertAliasesResolve("removeValue", document);
}

/** Replaces the sequence item at `index`, keeping its comments. */
export function replaceItem(ast: YamlStream, path: YamlPath, index: number, value: YamlValue, options?: DocumentOption): void {
  assertPath("replaceItem", path);
  assertValue("replaceItem", path, value);
  const document = selectDocument("replaceItem", ast, options);
  const seq = requireSequence("replaceItem", document, path);
  assertIndex("replaceItem", path, index, seq.items.length - 1);
  const old = seq.items[index] as Node;
  if (deepEqual(toValue(document, old), value)) return;
  seq.items[index] = replacement(document, old, value);
  assertAliasesResolve("replaceItem", document);
}

/** Moves the item at `from` so it sits at `to`; the others keep their relative order. */
export function moveItem(ast: YamlStream, path: YamlPath, from: number, to: number, options?: DocumentOption): void {
  assertPath("moveItem", path);
  const document = selectDocument("moveItem", ast, options);
  const seq = requireSequence("moveItem", document, path);
  assertIndex("moveItem", path, from, seq.items.length - 1);
  assertIndex("moveItem", path, to, seq.items.length - 1);
  const [item] = seq.items.splice(from, 1);
  seq.items.splice(to, 0, item);
  assertAliasesResolve("moveItem", document);
}

function changes(current: unknown, incoming: { [key: string]: YamlValue }): boolean {
  if (!isPlainObject(current)) return true;
  return Object.entries(incoming).some(([key, value]) =>
    isPlainObject(value) && isPlainObject(current[key]) ? changes(current[key], value) : !deepEqual(current[key], value)
  );
}

function mergeInto(document: Document, map: YAMLMap, incoming: { [key: string]: YamlValue }, path: YamlPath): void {
  for (const [key, value] of Object.entries(incoming)) {
    const pair = findPair(map, key);
    const keyPath = [...path, key];
    const current = pair === undefined ? undefined : toValue(document, pair.value as Node);
    if (pair !== undefined && !(isPlainObject(value) ? changes(current, value) : !deepEqual(current, value))) continue;
    const node = (pair?.value as Node | null | undefined) ?? null;
    if (isPlainObject(value) && isPlainObject(current)) {
      if (isAlias(node)) fail("merge", keyPath, `the value is the alias *${node.source}; edit the anchored node instead.`);
      mergeInto(document, node as YAMLMap, value, keyPath);
      continue;
    }
    writeSlot(document, { parent: map, segment: key, node }, replacement(document, node, value));
  }
}

/** Deep-merges a plain object into the mapping at `path`, creating it when absent. */
export function merge(ast: YamlStream, path: YamlPath, value: { [key: string]: YamlValue }, options?: DocumentOption): void {
  assertPath("merge", path);
  if (!isPlainObject(value)) fail("merge", path, "the merged value must be a plain object.");
  assertValue("merge", path, value);
  const document = selectDocument("merge", ast, options, true);
  const slot = resolve("merge", document, path, "create");
  if (slot.node !== null && !changes(toValue(document, slot.node), value)) return;
  if (isAlias(slot.node)) fail("merge", path, `the value is the alias *${slot.node.source}; edit the anchored node instead.`);
  if (slot.node !== null && !isMap(slot.node)) fail("merge", path, "the target is not a mapping.");
  let map = slot.node as YAMLMap | null;
  if (map === null) {
    map = createNode(document, {}) as YAMLMap;
    writeSlot(document, slot, map);
  }
  mergeInto(document, map, value, path);
}

/** Replaces the value at `path` with `fn(current)`; `current` is undefined when absent. */
export function updateValue<T extends YamlValue>(
  ast: YamlStream,
  path: YamlPath,
  fn: (current: YamlValue | undefined) => T,
  options?: DocumentOption
): void {
  assertPath("updateValue", path);
  if (typeof fn !== "function") fail("updateValue", path, "fn must be a function.");
  const document = selectDocument("updateValue", ast, options, true);
  const current = toValue(document, resolve("updateValue", document, path, "read").node) as YamlValue | undefined;
  const next = fn(current);
  assertValue("updateValue", path, next);
  upsert("updateValue", document, path, next);
  assertAliasesResolve("updateValue", document);
}

const isInside = (inner: YamlPath, outer: YamlPath): boolean =>
  inner.length > outer.length && outer.every((segment, index) => inner[index] === segment);

function detach(document: Document, path: YamlPath): Node {
  const slot = resolve("moveValue", document, path, "write");
  const node = slot.node!;
  if (slot.parent === null) document.contents = null;
  else if (isMap(slot.parent)) slot.parent.items.splice(slot.parent.items.indexOf(findPair(slot.parent, slot.segment as string)!), 1);
  else slot.parent.items.splice(slot.segment as number, 1);
  return node;
}

/** Moves the value at `from` to `to` (RFC 6902 move): a number last segment inserts. */
export function moveValue(ast: YamlStream, from: YamlPath, to: YamlPath, options?: DocumentOption): void {
  assertPath("moveValue", from);
  assertPath("moveValue", to);
  const document = selectDocument("moveValue", ast, options);
  if (isInside(to, from)) fail("moveValue", to, `the destination lies inside ${formatPath(from)}.`);
  if (deepEqual(from, to)) return;
  const source = resolve("moveValue", document, from, "write");
  if (source.node === null) {
    if (resolve("moveValue", document, to, "read").node !== null) return;
    fail("moveValue", from, "neither the source nor the destination exists.");
  }
  const node = detach(document, from);
  const last = to[to.length - 1];
  if (typeof last === "number") {
    const seq = requireSequence("moveValue", document, to.slice(0, -1));
    assertIndex("moveValue", to, last, seq.items.length);
    seq.items.splice(last, 0, node);
  } else {
    writeSlot(document, resolve("moveValue", document, to, "create"), node);
  }
  assertAliasesResolve("moveValue", document);
}

/** Copies the resolved data at `from` to `to` with `setValue`'s rules; anchors are not copied. */
export function copyValue(ast: YamlStream, from: YamlPath, to: YamlPath, options?: DocumentOption): void {
  assertPath("copyValue", from);
  assertPath("copyValue", to);
  const document = selectDocument("copyValue", ast, options);
  const source = resolve("copyValue", document, from, "read").node;
  if (source === null) fail("copyValue", from, "the source does not exist.");
  const value = toValue(document, resolveAlias(document, source));
  assertValue("copyValue", from, value);
  upsert("copyValue", document, to, value);
  assertAliasesResolve("copyValue", document);
}

function sortMap(map: YAMLMap, recursive: boolean): void {
  const label = (pair: unknown): string => keyLabel((pair as { key: unknown }).key) ?? "";
  map.items.sort((a, b) => (label(a) < label(b) ? -1 : label(a) > label(b) ? 1 : 0));
  if (recursive) map.items.forEach((pair) => sortNested(pair.value as Node | null));
}

function sortNested(node: Node | null): void {
  if (isMap(node)) sortMap(node, true);
  else if (isSeq(node)) node.items.forEach((item) => sortNested(item as Node));
}

/** Orders a mapping's keys by code point; `{ recursive: true }` also sorts nested mappings. */
export function sortKeys(ast: YamlStream, path: YamlPath, options?: DocumentOption & { recursive?: boolean }): void {
  assertPath("sortKeys", path);
  const document = selectDocument("sortKeys", ast, options);
  const node = resolve("sortKeys", document, path, "write").node;
  if (isAlias(node)) fail("sortKeys", path, `the value is the alias *${node.source}; edit the anchored node instead.`);
  if (!isMap(node)) fail("sortKeys", path, "the value is not a mapping.");
  sortMap(node, options?.recursive === true);
  assertAliasesResolve("sortKeys", document);
}
