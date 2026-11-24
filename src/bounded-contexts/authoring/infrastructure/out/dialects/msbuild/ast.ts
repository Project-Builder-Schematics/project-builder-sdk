import { readElements } from "./xml.ts";

const BOM = "﻿";

/**
 * The live document an MSBuild handle edits. `text` is the current source without its UTF-8
 * BOM (re-added on print). The dialect edits XML text rather than a tree, so every byte outside
 * an edit survives; a `.modify(fn)` callback may replace `text` the same way, reading offsets
 * with `astLibrary` (`saxes`).
 *
 * @example
 * import * as msbuild from "@pbuilder/sdk/msbuild";
 *
 * await msbuild.find("Shop.Api.csproj").modify((doc) => {
 *   doc.text = doc.text.replace("<Nullable>disable</Nullable>", "<Nullable>enable</Nullable>");
 * });
 */
export interface MsbuildDocument {
  text: string;
}

const hadBom = new WeakSet<MsbuildDocument>();

/**
 * Wraps `source` in an `MsbuildDocument`, throwing on anything that is not well-formed XML. An
 * empty source is a document with no root element, which every op rejects.
 */
export function parse(source: string): MsbuildDocument {
  const doc: MsbuildDocument = { text: source.startsWith(BOM) ? source.slice(BOM.length) : source };
  readElements(doc.text);
  if (source.startsWith(BOM)) hadBom.add(doc);
  return doc;
}

export function print(doc: MsbuildDocument): string {
  return hadBom.has(doc) ? BOM + doc.text : doc.text;
}
