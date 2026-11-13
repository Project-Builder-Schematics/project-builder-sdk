// fit-49's import graph: every `.ts` under `src/` and the repo-root `bin/`, with the edges
// the TypeScript compiler sees. `preProcessFile` reads only real import/export/dynamic-import
// specifiers, so sample imports inside strings and JSDoc never become edges.

import { readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { ts } from "ts-morph";
import { collectFiles } from "../import-scan.ts";

export type Edge = { from: string; to: string };

const PROCESS_IO_MEMBERS = new Set(["stdin", "stdout", "env", "cwd"]);

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function resolveRelative(fromFile: string, specifier: string, files: ReadonlySet<string>): string {
  const base = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (files.has(candidate)) return candidate;
  }
  return base;
}

// `process.stdin`/`stdout`/`env`/`cwd` are runtime I/O without an import (CODE-LAYOUT:126),
// so they become edges to a pseudo-module `process.<member>`.
function processIoMembers(path: string, source: string): string[] {
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "process" &&
      PROCESS_IO_MEMBERS.has(node.name.text)
    ) {
      found.add(`process.${node.name.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true));
  return [...found];
}

/** Repo-relative POSIX paths of every `.ts` file in `src/` and `bin/`, sorted. */
export function graphFiles(root: string): string[] {
  return [...collectFiles(join(root, "src"), ".ts"), ...collectFiles(join(root, "bin"), ".ts")]
    .map((abs) => toPosix(relative(root, abs)))
    .sort();
}

export function buildGraph(root: string): { files: string[]; edges: Edge[] } {
  const files = graphFiles(root);
  const known = new Set(files);
  // One edge per (from, to): a file that both imports and re-exports a module is one dependency.
  const edges = new Map<string, Edge>();
  const add = (from: string, to: string): void => void edges.set(`${from} -> ${to}`, { from, to });
  for (const from of files) {
    const source = readFileSync(join(root, from), "utf-8");
    for (const { fileName } of ts.preProcessFile(source, true, true).importedFiles) {
      add(from, fileName.startsWith(".") ? resolveRelative(from, fileName, known) : fileName);
    }
    for (const member of processIoMembers(from, source)) add(from, member);
  }
  return { files, edges: [...edges.values()] };
}
