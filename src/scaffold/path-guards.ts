// src/scaffold/path-guards.ts (ADR-0077): replaces containment.ts. The SDK no longer
// enforces a containment ceiling — `package-root-containment` is retired wholesale. The
// SDK's remaining obligation for package-local sources is IO HYGIENE (does this resolve to
// a readable regular file?) and IR WELL-FORMEDNESS (is the literal path shape emittable?) —
// never a boundary. Three guards live here (ADR-0077 §G, one shared predicate, ruling 5):
//
//  1. `validateSourceLexical` — segment-aware `../`/absolute screen for a SOURCE path
//     (`ir-path-well-formedness` REQ-IPF-01). Zero fs calls. Called at EXACTLY three sites.
//  2. `statSourceForRead` — IO hygiene, TOTAL guard (`package-source-io-hygiene`
//     REQ-PSH-01/02/03). LEXICAL resolution only — no realpath, no ceiling.
//  3. `validateDestinationLexical` — lexical-only guard for a `to` destination
//     (`ir-path-well-formedness` REQ-IPF-02). Reuses the EXISTING `invalid-input` reason.

import { statSync, type Stats } from "node:fs";
import { join, resolve } from "node:path";
import { AuthoringError, invalidInput } from "../core/authoring-error.ts";
import { isErrnoException } from "../core/fs-errors.ts";

// Lexical `../`/absolute screen shared by BOTH the source guard (REQ-IPF-01) and the
// destination guard (REQ-IPF-02, symmetric by design): a literal ".." segment or an
// absolute-looking path (POSIX leading `/` or a Windows drive letter) is rejected
// lexically — no filesystem touch needed.
function isLexicallyEscaping(relPath: string): boolean {
  const isAbsolute = relPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relPath);
  const segments = relPath.split(/[\\/]+/);
  return isAbsolute || segments.includes("..");
}

function sourceLexicalRejectionMessage(relPath: string): string {
  return (
    `source path invalid: ${relPath} must not contain a '..' segment or be absolute — ` +
    "everything a schematic reads lives inside its package (packageDir)"
  );
}

/**
 * Ruling-5 lexical screen (REQ-IPF-01). Segment-aware over `/` and `\`; ANY segment
 * === ".." or an absolute path (POSIX `/` or Windows drive) → `invalid-input`. Zero fs
 * calls. Called at EXACTLY three sites: `readTemplateFile`, `runScaffold` (the walk
 * ROOT `from`), `runCopyIn` (`from`).
 */
export function validateSourceLexical(relPath: string): void {
  if (isLexicallyEscaping(relPath)) {
    throw invalidInput(sourceLexicalRejectionMessage(relPath));
  }
}

// The variant selector (design §4 Q1) — a CLOSED enum mapping (reason, detail) to the
// exact REQ-AEC-11 template.
type RejectionDetail =
  | "directory" // source-not-regular-file, actionable variant
  | "permission or I/O error" // source-unreadable category 1
  | "symlink cycle" // source-unreadable category 2
  | "path contains an invalid character"; // source-unreadable category 3

const UNPRINTABLE_SOURCE_PATH_PLACEHOLDER = "<unprintable source path>";

function sourceRejectionMessage(
  reason: "source-not-found" | "source-not-regular-file" | "source-unreadable",
  displayPath: string,
  detail: RejectionDetail | undefined
): string {
  switch (reason) {
    case "source-not-found":
      return `source file not found: ${displayPath} does not exist in the package`;
    case "source-not-regular-file":
      return detail === "directory"
        ? `source file invalid: ${displayPath} is a directory, not a regular file — use scaffold() to copy a folder`
        : `source file invalid: ${displayPath} is not a regular file`;
    case "source-unreadable":
      return `source file unreadable: ${displayPath} could not be read (${detail})`;
  }
}

// REQ-PSH-02.3: when `relPath` is unrepresentable (embedded NUL), the fixed placeholder
// substitutes for the WHOLE `{path}` slot in the message — never the literal (possibly
// unprintable) bytes. The `.path` field on the error still carries the real `relPath`
// (programmatic access, not the human-readable surface).
function sourceRejection(
  reason: "source-not-found" | "source-not-regular-file" | "source-unreadable",
  relPath: string,
  detail?: RejectionDetail
): AuthoringError {
  const displayPath = detail === "path contains an invalid character" ? UNPRINTABLE_SOURCE_PATH_PLACEHOLDER : relPath;
  return new AuthoringError({
    verb: undefined,
    path: relPath,
    reason,
    appliedCount: 0,
    message: sourceRejectionMessage(reason, displayPath, detail),
  });
}

/**
 * IO hygiene, TOTAL guard (`package-source-io-hygiene` REQ-PSH-01/02/03). `absPath =
 * resolve(join(packageDir, relPath))` — LEXICAL, no realpath. `statSync` (follows
 * symlinks) → allow-list `isFile()`. The returned `stat` is reused by
 * `classify-transport.ts` for the CCL-06 size gate. The `try` wraps BOTH the path
 * computation AND the `statSync` call — no raw Node error ever escapes.
 */
export function statSourceForRead(params: { packageDir: string; relPath: string }): { absPath: string; stat: Stats } {
  const { packageDir, relPath } = params;

  if (typeof relPath !== "string") {
    throw invalidInput("invalid input: source path must be a string");
  }

  let absPath: string;
  let stat: Stats;
  try {
    absPath = resolve(join(packageDir, relPath));
    stat = statSync(absPath);
  } catch (err) {
    if (isErrnoException(err)) {
      if (err.code === "ENOENT") {
        throw sourceRejection("source-not-found", relPath);
      }
      if (err.code === "ELOOP") {
        throw sourceRejection("source-unreadable", relPath, "symlink cycle");
      }
      if (err.code === "ERR_INVALID_ARG_VALUE") {
        throw sourceRejection("source-unreadable", relPath, "path contains an invalid character");
      }
      // EACCES/EPERM/EMFILE/ENFILE/EINTR/… — deliberately never interpolates the errno.
      throw sourceRejection("source-unreadable", relPath, "permission or I/O error");
    }
    // No `.code` at all — an unclassifiable failure. Safest generic category, never a
    // raw error message.
    throw sourceRejection("source-unreadable", relPath, "permission or I/O error");
  }

  if (stat.isDirectory()) {
    throw sourceRejection("source-not-regular-file", relPath, "directory");
  }
  if (!stat.isFile()) {
    throw sourceRejection("source-not-regular-file", relPath);
  }

  return { absPath, stat };
}

function destinationEscapeMessage(relPath: string): string {
  return (
    `invalid input: destination "${relPath}" escapes the workspace tree ` +
    '(literal ".." segment or absolute path)'
  );
}

/**
 * Validates a FINAL, SDK-computed DESTINATION path (`scaffold`'s computed `to`, or
 * `copyIn`'s `to`) — LEXICAL ONLY, no realpath (the destination may not exist yet,
 * `ir-path-well-formedness` REQ-IPF-02). Applied post-rename, post-token-translation,
 * immediately pre-emit. Rejects with the EXISTING `invalid-input` reason (scaffold-family
 * author misuse) — never a `source-*` reason, which is reserved for source READS.
 */
export function validateDestinationLexical(relPath: string): void {
  if (isLexicallyEscaping(relPath)) {
    throw invalidInput(destinationEscapeMessage(relPath));
  }
}
