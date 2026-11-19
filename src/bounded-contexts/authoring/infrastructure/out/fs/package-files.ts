// The node:fs adapter of the package-files port. ENOENT is absence; any other failure is
// described in author vocabulary, never by its raw errno message.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PackageReadFailure, type PackageFiles, type PackageSource } from "../../../domain/ports/package-files.ts";
import { RESERVED_LIFECYCLE_NAMES } from "../../../domain/valueobjects/schema-model.ts";
import { isErrnoException } from "../../../../../platform/fs-errors.ts";

function describeReadFailure(err: unknown): string {
  if (isErrnoException(err)) {
    if (err.code === "EACCES" || err.code === "EPERM") return "permission denied";
    if (err.code === "EISDIR") return "is a directory, not a file";
  }
  return "unreadable";
}

function unlessAbsent<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return undefined;
    throw new PackageReadFailure(describeReadFailure(err));
  }
}

const RESERVED_EXTENSIONS = [".ts", ".js"];

// Strips a recognized extension (case-insensitively) so `pre-execute.ts`, `PRE-EXECUTE.TS`,
// and the dir-form entry `pre-execute` (no extension at all) all normalize to the same
// lowercase kebab token before comparison (ADR-0028: case-insensitive, strip-extension).
function normalizeEntry(name: string): string {
  const lower = name.toLowerCase();
  for (const ext of RESERVED_EXTENSIONS) {
    if (lower.endsWith(ext)) return lower.slice(0, -ext.length);
  }
  return lower;
}

/**
 * The reserved lifecycle name among a package folder's own entry names — a
 * `pre-execute`/`post-execute` file (`.ts`/`.js`, case-insensitive) or directory — or
 * `undefined`. Never run-time inputs or `schema.json` field names (REQ-RLN-01.4).
 */
export function reservedSiblingIn(entryNames: readonly string[]): string | undefined {
  for (const entry of entryNames) {
    const normalized = normalizeEntry(entry);
    const match = RESERVED_LIFECYCLE_NAMES.find((name) => name === normalized);
    if (match !== undefined) return match;
  }
  return undefined;
}

// The path is joined lexically, never canonicalized on disk; the operating system resolves a
// relative package folder against the working directory. This file is in the runner closure,
// where `path.resolve` (it reads the working directory) is not an admitted origin.
function statSource(packageDir: string, relPath: string): PackageSource {
  try {
    const stat = statSync(join(packageDir, relPath));
    if (stat.isDirectory()) return { kind: "directory" };
    return stat.isFile() ? { kind: "file", size: stat.size } : { kind: "other" };
  } catch (err) {
    if (isErrnoException(err)) {
      // ENOTDIR/ENAMETOOLONG both mean the path, as given, does not exist: a segment along
      // the way is a regular file, or the resolved string exceeds the filesystem's name
      // limit. Neither is a permission or I/O failure on an existing path.
      if (err.code === "ENOENT" || err.code === "ENOTDIR" || err.code === "ENAMETOOLONG") return { kind: "missing" };
      if (err.code === "ELOOP") return { kind: "unreadable", detail: "symlink cycle" };
      if (err.code === "ERR_INVALID_ARG_VALUE") return { kind: "unreadable", detail: "path contains an invalid character" };
    }
    // EACCES/EPERM/EMFILE/…, or no `.code` at all: never interpolates the raw error.
    return { kind: "unreadable", detail: "permission or I/O error" };
  }
}

export const nodePackageFiles: PackageFiles = {
  readText: (path) => unlessAbsent(() => readFileSync(path, "utf-8")),
  findReservedSibling: (packageDir) => {
    const entries = unlessAbsent(() => readdirSync(packageDir));
    return entries === undefined ? undefined : reservedSiblingIn(entries);
  },
  relativeToCwd: (path) => relative(process.cwd(), path),
  statSource,
  readBytes: (packageDir, relPath) => {
    try {
      return readFileSync(join(packageDir, relPath));
    } catch (err) {
      throw new PackageReadFailure(describeReadFailure(err));
    }
  },
};
