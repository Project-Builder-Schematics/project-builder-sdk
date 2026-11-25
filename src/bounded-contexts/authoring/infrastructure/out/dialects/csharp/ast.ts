import { fileURLToPath } from "node:url";
import { Language, Parser, type Node, type Tree } from "web-tree-sitter";

const BOM = "﻿";

// `ast.parse` is synchronous and loading WASM is not, so the module loads it once at import.
await Parser.init();
/** The tree-sitter C# grammar (tree-sitter-c-sharp 0.24.0) the dialect parses with. */
export const language = await Language.load(fileURLToPath(new URL("./tree-sitter-c_sharp.wasm", import.meta.url)));
const parser = new Parser();
parser.setLanguage(language);

/**
 * The live document a C# handle edits. `text` is the current source without its UTF-8 BOM
 * (re-added on print). tree-sitter trees are read-only views of a text, so named ops replace
 * `text` with spliced edits; a `.modify(fn)` callback may do the same, parsing `text` with
 * `astLibrary` (`web-tree-sitter`) and `language`.
 *
 * @example
 * import * as csharp from "@pbuilder/sdk/csharp";
 *
 * await csharp.find("Orders.cs").modify((doc) => {
 *   doc.text = doc.text.replace("internal class", "public class");
 * });
 */
export interface CsharpDocument {
  text: string;
}

const hadBom = new WeakSet<CsharpDocument>();

/** Runs `fn` over a fresh tree of `text`, freeing the tree's WASM memory afterwards. */
export function withTree<T>(text: string, fn: (root: Node) => T): T {
  const tree: Tree | null = parser.parse(text);
  if (tree === null) throw new Error("invalid C#");
  try {
    return fn(tree.rootNode);
  } finally {
    tree.delete();
  }
}

/** True when `text` parses as C# with no ERROR or MISSING node. */
export function isValidCsharp(text: string): boolean {
  return withTree(text, (root) => !root.hasError);
}

/**
 * Wraps `source` in a `CsharpDocument`, throwing when it is not valid C# syntax. A compile
 * error that is not a syntax error, such as an unknown type, parses.
 */
export function parse(source: string): CsharpDocument {
  const doc: CsharpDocument = { text: source.startsWith(BOM) ? source.slice(BOM.length) : source };
  if (!isValidCsharp(doc.text)) throw new Error("invalid C#");
  if (source.startsWith(BOM)) hadBom.add(doc);
  return doc;
}

export function print(doc: CsharpDocument): string {
  return hadBom.has(doc) ? BOM + doc.text : doc.text;
}
