// Document-level ops for multi-document files.

import { newDocument, type YamlStream } from "./ast.ts";
import { assertValue, fail, isPlainObject, type YamlValue } from "./paths.ts";

function assertIndex(op: string, index: unknown, max: number): asserts index is number {
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > max) {
    fail(op, null, `index ${String(index)} is out of range (0..${max}).`);
  }
}

/** Inserts a document holding `value` at `options.index`, by default at the end. */
export function addDocument(ast: YamlStream, value: YamlValue, options?: { index?: number }): void {
  assertValue("addDocument", [], value);
  if (options !== undefined && !isPlainObject(options)) fail("addDocument", null, "options must be a plain object.");
  const index = options?.index ?? ast.documents.length;
  assertIndex("addDocument", index, ast.documents.length);
  ast.documents.splice(index, 0, newDocument(value));
}

/** Removes the document at `index`. */
export function removeDocument(ast: YamlStream, index: number): void {
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= ast.documents.length) {
    fail("removeDocument", null, `document ${String(index)} is out of range; the file has ${ast.documents.length} document(s).`);
  }
  ast.documents.splice(index, 1);
}
