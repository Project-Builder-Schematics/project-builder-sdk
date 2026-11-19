// Scaffold's source and destination guards (ADR-0077): replaces containment.ts. The SDK no longer
// enforces a containment ceiling — `package-root-containment` is retired wholesale. The
// SDK's remaining obligation for package-local sources is IO HYGIENE (does this resolve to
// a readable regular file?) and IR WELL-FORMEDNESS (is the literal path shape emittable?) —
// never a boundary. Three guards live here (ADR-0077 §G, one shared predicate, ruling 5):
//
//  1. `validateSourceLexical` — segment-aware `../`/absolute screen for a SOURCE path
//     (`ir-path-well-formedness` REQ-IPF-01). Zero fs calls. Called at EXACTLY three sites.
//  2. `statSourceForRead` — IO hygiene, TOTAL guard (`package-source-io-hygiene`
//     REQ-PSH-01/02/03), over the package-files port's `statSource`. LEXICAL resolution
//     only — no disk-canonicalization pass, no ceiling.
//  3. `validateDestinationLexical` — lexical-only guard for a `to` destination
//     (`ir-path-well-formedness` REQ-IPF-02). Reuses the EXISTING `invalid-input` reason.

import { AuthoringError, invalidInput } from "../../../domain/valueobjects/authoring-error.ts";
import type { PackageFiles, PackageSource } from "../../../domain/ports/package-files.ts";

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
  if (typeof relPath !== "string") {
    throw invalidInput("invalid input: source path must be a string");
  }
  if (isLexicallyEscaping(relPath)) {
    throw invalidInput(sourceLexicalRejectionMessage(relPath));
  }
}

// The variant selector (design §4 Q1) — a CLOSED enum mapping (reason, detail) to the
// exact REQ-AEC-11 template.
// `directory` is source-not-regular-file's actionable variant; the rest are the port's
// source-unreadable categories.
type RejectionDetail = "directory" | Extract<PackageSource, { kind: "unreadable" }>["detail"];

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
// (programmatic access, not the human-readable surface). Exported (judgment-day G4(i)):
// `classify-transport.ts`'s own post-hygiene read failure mints through this SAME helper
// rather than constructing a bare, category-less `AuthoringError` — the ONE place a
// `source-unreadable` message is built, so the failure category (REQ-AEC-11.1) can never
// be silently dropped at a second call site.
export function sourceRejection(
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
 * IO hygiene, TOTAL guard (`package-source-io-hygiene` REQ-PSH-01/02/03): the source must be a
 * readable regular file. The port resolves the path lexically and follows symlinks; this maps
 * what it found to the author-facing rejection. Returns the size `classify-transport.ts` reuses
 * for the CCL-06 gate.
 */
export function statSourceForRead(params: { files: PackageFiles; packageDir: string; relPath: string }): { size: number } {
  const { files, packageDir, relPath } = params;
  const source = files.statSource(packageDir, relPath);
  switch (source.kind) {
    case "file":
      return { size: source.size };
    case "missing":
      throw sourceRejection("source-not-found", relPath);
    case "directory":
      throw sourceRejection("source-not-regular-file", relPath, "directory");
    case "other":
      throw sourceRejection("source-not-regular-file", relPath);
    case "unreadable":
      throw sourceRejection("source-unreadable", relPath, source.detail);
  }
}

function destinationEscapeMessage(relPath: string): string {
  return (
    `invalid input: destination "${relPath}" escapes the workspace tree ` +
    '(literal ".." segment or absolute path)'
  );
}

/**
 * Validates a FINAL, SDK-computed DESTINATION path (`scaffold`'s computed `to`, or
 * `copyIn`'s `to`) — LEXICAL ONLY, never disk-canonicalized (the destination may not exist yet,
 * `ir-path-well-formedness` REQ-IPF-02). Applied post-rename, post-token-translation,
 * immediately pre-emit. Rejects with the EXISTING `invalid-input` reason (scaffold-family
 * author misuse) — never a `source-*` reason, which is reserved for source READS.
 */
export function validateDestinationLexical(relPath: string): void {
  if (typeof relPath !== "string") {
    throw invalidInput("invalid input: destination path must be a string");
  }
  if (isLexicallyEscaping(relPath)) {
    throw invalidInput(destinationEscapeMessage(relPath));
  }
}
