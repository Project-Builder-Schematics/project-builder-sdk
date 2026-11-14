import { parseTree, type ParseError } from "jsonc-parser";

const BOM = "﻿";

/**
 * The live document a JSON handle edits. `text` is the current source without its UTF-8 BOM
 * (re-added on print). `jsonc-parser` edits text rather than a mutable tree, so named ops
 * replace `text` with format-preserving edits; a `.modify(fn)` callback may do the same with
 * any `jsonc-parser` edit.
 *
 * @example
 * import * as json from "@pbuilder/sdk/json";
 *
 * await json.find("package.json").modify((doc) => {
 *   const edits = json.astLibrary.modify(doc.text, ["private"], true, {});
 *   doc.text = json.astLibrary.applyEdits(doc.text, edits);
 * });
 */
export interface JsonDocument {
  text: string;
}

const hadBom = new WeakSet<JsonDocument>();

/**
 * Wraps `source` in a `JsonDocument`, throwing on any syntax error. Comments and trailing
 * commas are JSONC and allowed; an empty or whitespace/comment-only source is a document with
 * no value, which `setValue` fills.
 */
export function parse(source: string): JsonDocument {
  const doc: JsonDocument = { text: source.startsWith(BOM) ? source.slice(BOM.length) : source };
  const errors: ParseError[] = [];
  parseTree(doc.text, errors, { allowTrailingComma: true, disallowComments: false, allowEmptyContent: true });
  if (errors.length > 0) throw new Error("invalid JSON");
  if (source.startsWith(BOM)) hadBom.add(doc);
  return doc;
}

export function print(doc: JsonDocument): string {
  return hadBom.has(doc) ? BOM + doc.text : doc.text;
}
