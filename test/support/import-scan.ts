// Shared with FIT-15 (bin -> core direction) and FIT-21 (context.ts no dialect-handle
// import) — both resolve relative import specifiers against the importing file's own
// directory and flag any that resolve INTO a forbidden target, a textual substring check
// (`"bin/"` / `"dialect-handle"`) would false-positive on legitimate identifiers/paths
// merely containing that text, so this resolves paths for real.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

export const IMPORT_SPECIFIER_RE = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith(".");
}

// A JSDoc @example block quoting a sample import as prose is not a real import edge
// (mirrors fit-01's own, deliberately untouched, pre-existing guard).
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Resolves every relative import specifier in `source` (as if it lived in `fromDir`) and
 * returns those resolving into `target` — covers both a directory target (FIT-15's `bin/`,
 * matched by exact equality or any path nested under it) and a single-file target (FIT-21's
 * `dialect-handle.ts`, matched by exact equality or its extensionless form, since import
 * specifiers omit the `.ts` extension).
 */
export function specifiersResolvingInto(source: string, fromDir: string, target: string): string[] {
  const offenders: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    const specifier = match[1]!;
    if (!specifier.startsWith(".")) continue; // bare/package specifiers can never reach it
    const resolved = resolve(fromDir, specifier);
    if (resolved === target || resolved === target.replace(/\.ts$/, "") || resolved.startsWith(`${target}/`)) {
      offenders.push(specifier);
    }
  }
  return offenders;
}

/**
 * BFS worklist over the relative-import graph, starting at `entryFiles` — returns every
 * file reached (including the entries themselves). Comments are stripped before specifier
 * extraction (a JSDoc @example quoting a sample import as prose is not a real import
 * edge). Shared by FIT-25 (single capture path) and FIT-27 (anti-tautology scan) — the two
 * pre-hoist copies differed only in WHERE the relative-specifier filter applied
 * (pre-extraction vs. pre-enqueue), never in the walk's actual behavior.
 */
export function walkReachable(entryFiles: readonly string[]): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [...entryFiles];

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue; // An unresolvable edge is not this scanner's concern.
    }

    const withoutComments = stripComments(source);
    for (const match of withoutComments.matchAll(IMPORT_SPECIFIER_RE)) {
      const specifier = match[1]!;
      if (isRelativeSpecifier(specifier)) {
        queue.push(resolve(dirname(file), specifier));
      }
    }
  }

  return visited;
}

/** Recursively collects every file under `dir` whose extension is `ext` (e.g. `".ts"`). */
export function collectFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...collectFiles(full, ext));
    } else if (extname(full) === ext) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Recursively collects every `.ts` file under `dir`. Behaviour-identical to FIT-01's own
 * `collectTs` (pre-dates this change, deliberately left untouched there) — this hoisted
 * delegate serves FIT-26's `collectTsFiles` and FIT-27's `collectTs` call sites.
 */
export function collectTsFiles(dir: string): string[] {
  return collectFiles(dir, ".ts");
}

/** Matches a call to any of the file-writing primitives the FIT scans treat as a write
 * site — shared by FIT-27's corpus-write scan and the FIT-43/44/45 marker-fabrication scan. */
export const WRITE_CALL_RE = /\bwriteFileSync\s*\(|\.writeFile\s*\(|\bappendFileSync\s*\(|\bBun\.write\s*\(/g;

/**
 * Depth-counts `open`/`close` delimiters starting at `openIndex` (which must point at the
 * `open` character itself) and returns the index of the delimiter that closes it — balanced
 * matching, not lexically aware of strings/comments/template literals. Returns -1 if depth
 * never returns to zero before the end of `source`. Shared paren/brace-matching idiom
 * behind `extractCallArgs` and `extractFunctions`'s body-brace match.
 */
export function findMatchingClose(source: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === open) depth++;
    else if (source[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Paren-depth-aware extraction of a call's full argument-list text, starting at the
 * `(` immediately following the matched call name. */
export function extractCallArgs(source: string, callMatchIndex: number): string {
  const openParenIndex = source.indexOf("(", callMatchIndex);
  if (openParenIndex === -1) return "";
  const closeIndex = findMatchingClose(source, openParenIndex, "(", ")");
  return closeIndex === -1 ? source.slice(openParenIndex + 1) : source.slice(openParenIndex + 1, closeIndex);
}
