import { defineDialect, defineOpPack, withOps, type Handle } from "../../core/define-dialect.ts";
import type { JsonPath, JsonValue } from "../../core/json-value.ts";
import { parse, print, type JsonDocument } from "./ast.ts";
import {
  addKey,
  appendItem,
  copyValue,
  insertItem,
  merge,
  moveItem,
  moveValue,
  removeItem,
  removeKey,
  removeValue,
  renameKey,
  replaceItem,
  setValue,
  sortKeys,
  updateValue,
  type AppendOptions,
  type KeyPosition,
  type SortOptions,
} from "./ops.ts";

export * as astLibrary from "jsonc-parser";
export type { JsonDocument, JsonPath, JsonValue, KeyPosition, AppendOptions, SortOptions };

type JsonOps = {
  setValue: (ast: JsonDocument, path: JsonPath, value: JsonValue, options?: KeyPosition) => void;
  addKey: (ast: JsonDocument, path: JsonPath, value: JsonValue, options?: KeyPosition) => void;
  removeKey: (ast: JsonDocument, path: JsonPath) => void;
  renameKey: (ast: JsonDocument, path: JsonPath, newKey: string) => void;
  insertItem: (ast: JsonDocument, path: JsonPath, index: number, value: JsonValue) => void;
  appendItem: (ast: JsonDocument, path: JsonPath, value: JsonValue, options?: AppendOptions) => void;
  removeItem: (ast: JsonDocument, path: JsonPath, index: number) => void;
  removeValue: (ast: JsonDocument, path: JsonPath, value: JsonValue) => void;
  replaceItem: (ast: JsonDocument, path: JsonPath, index: number, value: JsonValue) => void;
  moveItem: (ast: JsonDocument, path: JsonPath, from: number, to: number) => void;
  merge: (ast: JsonDocument, path: JsonPath, value: { [key: string]: JsonValue }) => void;
  updateValue: <T extends JsonValue>(ast: JsonDocument, path: JsonPath, fn: (current: JsonValue | undefined) => T) => void;
  moveValue: (ast: JsonDocument, from: JsonPath, to: JsonPath) => void;
  copyValue: (ast: JsonDocument, from: JsonPath, to: JsonPath) => void;
  sortKeys: (ast: JsonDocument, path: JsonPath, options?: SortOptions) => void;
};

const opsPack = defineOpPack<JsonDocument, JsonOps>({
  setValue,
  addKey,
  removeKey,
  renameKey,
  insertItem,
  appendItem,
  removeItem,
  removeValue,
  replaceItem,
  moveItem,
  merge,
  updateValue,
  moveValue,
  copyValue,
  sortKeys,
});

const jsonDialect = withOps(defineDialect({ extensions: [".json", ".jsonc"], ast: { parse, print }, ops: {} }), opsPack);

/**
 * Opens a `.json` or `.jsonc` file for structural editing. Every op addresses a value by a
 * path array (`["scripts", "build"]`, `["files", 0]`) and edits only the bytes it must:
 * comments, key order, indentation, line endings, a BOM, and the trailing newline survive.
 * Any other extension, a basename with no stem (`.json`), or an extensionless path throws
 * synchronously with the `dialect operation failed: ` prefix. `.modify(fn)` hands `fn` the
 * live `JsonDocument`; edit its `text` with `astLibrary` (`jsonc-parser`) for anything the
 * ops do not cover, such as comments.
 *
 * @example
 * import * as json from "@pbuilder/sdk/json";
 *
 * // package.json before: {\n  "name": "app"\n}\n
 * export const run = async () => {
 *   await json
 *     .find("package.json")
 *     .setValue(["scripts", "build"], "tsc")
 *     .appendItem(["files"], "dist", { unique: true });
 * };
 * // -> {
 * // ->   "name": "app",
 * // ->   "scripts": {
 * // ->     "build": "tsc"
 * // ->   },
 * // ->   "files": [
 * // ->     "dist"
 * // ->   ]
 * // -> }
 */
export function find(path: string): Handle<"found", JsonDocument, JsonOps> {
  return jsonDialect.find(path);
}
