// The YAML dialect module, `@pbuilder/sdk/yaml`. Composes the sanctioned kit surface only
// (`defineDialect`/`defineOpPack`/`withOps`), mirroring the other dialect modules.

import { defineDialect, defineOpPack, withOps, type Handle } from "../../core/define-dialect.ts";
import { parse, print, type YamlStream } from "./ast.ts";
import { addDocument, removeDocument } from "./documents.ts";
import type { DocumentOption, YamlPath, YamlValue } from "./paths.ts";
import {
  addMergeKey,
  removeAnchor,
  removeComment,
  setAlias,
  setAnchor,
  setComment,
  setStyle,
  setTag,
  type CollectionStyle,
  type CommentOptions,
  type ScalarStyle,
} from "./presentation.ts";
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
  type KeyOptions,
} from "./structural.ts";

export * as astLibrary from "yaml";
export type { YamlStream, YamlPath, YamlValue };

type YamlOps = {
  setValue: (ast: YamlStream, path: YamlPath, value: YamlValue, options?: KeyOptions) => void;
  addKey: (ast: YamlStream, path: YamlPath, value: YamlValue, options?: KeyOptions) => void;
  removeKey: (ast: YamlStream, path: YamlPath, options?: DocumentOption) => void;
  renameKey: (ast: YamlStream, path: YamlPath, newKey: string, options?: DocumentOption) => void;
  insertItem: (ast: YamlStream, path: YamlPath, index: number, value: YamlValue, options?: DocumentOption) => void;
  appendItem: (ast: YamlStream, path: YamlPath, value: YamlValue, options?: DocumentOption & { unique?: boolean }) => void;
  removeItem: (ast: YamlStream, path: YamlPath, index: number, options?: DocumentOption) => void;
  removeValue: (ast: YamlStream, path: YamlPath, value: YamlValue, options?: DocumentOption) => void;
  replaceItem: (ast: YamlStream, path: YamlPath, index: number, value: YamlValue, options?: DocumentOption) => void;
  moveItem: (ast: YamlStream, path: YamlPath, from: number, to: number, options?: DocumentOption) => void;
  merge: (ast: YamlStream, path: YamlPath, value: { [key: string]: YamlValue }, options?: DocumentOption) => void;
  updateValue: (
    ast: YamlStream,
    path: YamlPath,
    fn: (current: YamlValue | undefined) => YamlValue,
    options?: DocumentOption
  ) => void;
  setComment: (ast: YamlStream, path: YamlPath, comment: string, options?: CommentOptions) => void;
  removeComment: (ast: YamlStream, path: YamlPath, options?: CommentOptions) => void;
  setAnchor: (ast: YamlStream, path: YamlPath, name: string, options?: DocumentOption) => void;
  removeAnchor: (ast: YamlStream, path: YamlPath, options?: DocumentOption) => void;
  setAlias: (ast: YamlStream, path: YamlPath, anchor: string, options?: DocumentOption) => void;
  addMergeKey: (ast: YamlStream, path: YamlPath, anchor: string, options?: DocumentOption) => void;
  setStyle: (ast: YamlStream, path: YamlPath, style: CollectionStyle | ScalarStyle, options?: DocumentOption) => void;
  addDocument: (ast: YamlStream, value: YamlValue, options?: { index?: number }) => void;
  removeDocument: (ast: YamlStream, index: number) => void;
  moveValue: (ast: YamlStream, from: YamlPath, to: YamlPath, options?: DocumentOption) => void;
  copyValue: (ast: YamlStream, from: YamlPath, to: YamlPath, options?: DocumentOption) => void;
  sortKeys: (ast: YamlStream, path: YamlPath, options?: DocumentOption & { recursive?: boolean }) => void;
  setTag: (ast: YamlStream, path: YamlPath, tag: string | null, options?: DocumentOption) => void;
};

const opsPack = defineOpPack<YamlStream, YamlOps>({
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
  setComment,
  removeComment,
  setAnchor,
  removeAnchor,
  setAlias,
  addMergeKey,
  setStyle,
  addDocument,
  removeDocument,
  moveValue,
  copyValue,
  sortKeys,
  setTag,
});

const baseDialect = defineDialect({
  extensions: [".yaml", ".yml"],
  ast: { parse, print },
  ops: {},
});

const yamlDialect = withOps(baseDialect, opsPack);

/**
 * Opens a `.yaml` or `.yml` file for YAML-dialect editing. The basename must end in one of those
 * extensions after a non-empty stem; every other path throws synchronously, before any op runs,
 * with the `dialect operation failed: ` prefix.
 *
 * Every named op addresses a node by a path array (`["services", "web", "ports", 0]`) and takes
 * an optional last `{ document }` option selecting a document of a multi-document file.
 * Documents no op touched print byte-identical to their source.
 *
 * @example
 * import * as yaml from "@pbuilder/sdk/yaml";
 *
 * // compose.yaml before: services:\n  web:\n    image: node\n
 * export const run = async () => {
 *   await yaml
 *     .find("compose.yaml")
 *     .setValue(["services", "web", "ports"], ["3000:3000"])
 *     .setComment(["services", "web"], "Frontend");
 * };
 * // -> services:
 * // ->   # Frontend
 * // ->   web:
 * // ->     image: node
 * // ->     ports:
 * // ->       - 3000:3000
 */
export function find(path: string): Handle<"found", YamlStream, YamlOps> {
  return yamlDialect.find(path);
}
