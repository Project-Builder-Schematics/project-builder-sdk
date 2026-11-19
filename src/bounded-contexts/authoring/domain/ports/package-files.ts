// The one filesystem port: reads under a factory package's folder. Absence is a return, never
// a throw; every other failure throws PackageReadFailure carrying the author-facing problem
// text, so callers never branch on filesystem error codes.

export class PackageReadFailure extends Error {
  constructor(readonly problem: string) {
    super(problem);
    this.name = "PackageReadFailure";
  }
}

/**
 * What a package-local source path holds, following symlinks. `unreadable` carries the
 * author-facing category; the path is resolved lexically against the package folder, never
 * canonicalized on disk.
 */
export type PackageSource =
  | { kind: "file"; size: number }
  | { kind: "missing" }
  | { kind: "directory" }
  | { kind: "other" }
  | { kind: "unreadable"; detail: "permission or I/O error" | "symlink cycle" | "path contains an invalid character" };

export interface PackageFiles {
  /** The file's UTF-8 text, or `undefined` when nothing exists at `path`. */
  readText(path: string): string | undefined;
  /**
   * The reserved lifecycle name among the package folder's own entries (REQ-RLN-01,
   * ADR-0028), or `undefined` for a clean package or a folder that does not exist.
   */
  findReservedSibling(packageDir: string): string | undefined;
  /** `path` relative to the working directory, for messages that must not leak an absolute path. */
  relativeToCwd(path: string): string;
  /** What `relPath` under `packageDir` holds; never throws. */
  statSource(packageDir: string, relPath: string): PackageSource;
  /** The bytes of `relPath` under `packageDir`; any failure throws PackageReadFailure. */
  readBytes(packageDir: string, relPath: string): Uint8Array;
}
