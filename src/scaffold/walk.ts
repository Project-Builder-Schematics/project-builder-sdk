// src/scaffold/walk.ts (ADR-0044): folder enumeration for `scaffold` — lstat-based
// symlinked-directory non-descent (REQ-FSC-09.1) and a 10 000-entry bound (REQ-FSC-09.2).
// Pure enumeration only: source/destination eligibility, containment, and the by-value/
// by-reference verdict are NOT this module's concern (classify-transport.ts + containment.ts,
// the latter landing in S-002).

import { lstatSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { invalidInput } from "../core/authoring-error.ts";
import { isErrnoException } from "../core/fs-errors.ts";

export const DEFAULT_WALK_ENTRY_BOUND = 10_000;

export interface WalkEntry {
  /** Source-relative path, posix-separated, relative to the walked `from` root. */
  relPath: string;
  /** Absolute filesystem path — `join(fromAbs, relPath)`. */
  absPath: string;
}

function boundExceededMessage(bound: number): string {
  return `invalid input: scaffold walk exceeded the ${bound}-entry bound`;
}

// judgment-day iteration 2 fix: the ROOT `readdirSync` (below) has no per-entry containment
// guard ahead of it the way every recursive sub-directory read does (those enumerate
// directories `validateSourceRootContainment` + this function's own walk already proved
// in-ceiling) — `runScaffold` only proves the root is IN-CEILING, never that it exists or is
// a directory (`validateSourceRootContainment`'s own contract: a legitimately absent root is
// deliberately left for `walkFolder` to answer, package-root-containment REQ-PRC-10.3). A
// `from` that resolves to a regular FILE or does not exist at all therefore used to reach
// `readdirSync` unguarded and throw a raw Node `Error` — never an `AuthoringError` — whose
// message echoes the ABSOLUTE filesystem path (no-echo violation). `rootRelPath` is the
// author-facing, package-relative `from` the caller already has in hand (never re-derived
// from `fromAbs`); a caller that omits it (only the direct-unit-test callers in walk.test.ts
// do) falls back to a locator-free phrasing rather than ever risking an absolute-path leak.
function rootNotDirectoryMessage(rootRelPath: string | undefined): string {
  return rootRelPath === undefined
    ? "invalid input: scaffold \"from\" must be a folder — it resolves to a regular file"
    : `invalid input: scaffold "from" (${rootRelPath}) must be a folder — it resolves to a regular file`;
}

function rootNotFoundMessage(rootRelPath: string | undefined): string {
  return rootRelPath === undefined
    ? "invalid input: scaffold \"from\" folder does not exist"
    : `invalid input: scaffold "from" folder (${rootRelPath}) does not exist`;
}

function rootUnreadableMessage(rootRelPath: string | undefined): string {
  return rootRelPath === undefined
    ? "invalid input: scaffold \"from\" folder could not be read"
    : `invalid input: scaffold "from" folder (${rootRelPath}) could not be read`;
}

// Never re-throws the raw Node error (no-echo, REQ-AEC-05/FIT-11 posture already held by
// every other scaffold-family rejection): ENOTDIR (the root resolves to a non-directory —
// most commonly a regular file) and ENOENT (the root doesn't exist) each mint their own
// `AuthoringError` naming ONLY the package-relative `rootRelPath`; any other errno (e.g.
// EACCES) still fails closed the same way — a generic "could not be read" — rather than ever
// leaking `err.message`'s absolute path.
function rootReadFailure(err: unknown, rootRelPath: string | undefined): Error {
  if (isErrnoException(err) && err.code === "ENOTDIR") {
    return invalidInput(rootNotDirectoryMessage(rootRelPath));
  }
  if (isErrnoException(err) && err.code === "ENOENT") {
    return invalidInput(rootNotFoundMessage(rootRelPath));
  }
  return invalidInput(rootUnreadableMessage(rootRelPath));
}

// A symlink's OWN type (lstat) is always "symbolic link" — this asks what the link's
// TARGET is, via `statSync` (follows the link), ONLY to decide non-descent (REQ-FSC-09.1).
// NOT a containment check: a broken symlink (target absent) is treated as a
// (later-failing) file candidate rather than silently vanishing from the walk.
function symlinkTargetIsDirectory(absPath: string): boolean {
  try {
    return statSync(absPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Enumerates every file under `fromAbs`, mirroring nested directory structure into
 * posix-separated `relPath`s (sorted for deterministic output). Symlinked directories are
 * NEVER descended — even when their target resolves inside the containment ceiling
 * (REQ-FSC-09.1) — skipped silently, no error. Fails loud, naming the bound, once the
 * enumerated entry count exceeds `bound` (REQ-FSC-09.2); `bound` is injectable so a test
 * can drive the branch without materializing 10,001 real files.
 *
 * `rootRelPath` (judgment-day iteration 2 fix, package-root-containment REQ-PRC-10.3
 * amendment): the author-facing, package-relative `from` — threaded through SOLELY to name
 * the ROOT in an `AuthoringError` message if the root itself is not a readable directory (a
 * regular file, or missing — `runScaffold`'s `validateSourceRootContainment` proves the root
 * is in-ceiling but deliberately leaves existence/type to this function, see its own
 * doc-comment). Recursive sub-directory reads below are NOT re-guarded — every one of them
 * enumerates a directory this walk already lstat'd as a directory, so their behavior for a
 * valid tree is unchanged.
 */
export function walkFolder(
  fromAbs: string,
  bound: number = DEFAULT_WALK_ENTRY_BOUND,
  rootRelPath?: string
): WalkEntry[] {
  const entries: WalkEntry[] = [];
  const dirStack: string[] = [""];

  while (dirStack.length > 0) {
    const relDir = dirStack.pop()!;
    const absDir = relDir === "" ? fromAbs : join(fromAbs, relDir);
    let names: string[];
    if (relDir === "") {
      try {
        names = readdirSync(absDir).sort();
      } catch (err) {
        throw rootReadFailure(err, rootRelPath);
      }
    } else {
      names = readdirSync(absDir).sort();
    }

    for (const name of names) {
      const relPath = relDir === "" ? name : `${relDir}/${name}`;
      const absPath = join(absDir, name);
      const lst = lstatSync(absPath);

      if (lst.isSymbolicLink()) {
        if (symlinkTargetIsDirectory(absPath)) {
          continue; // REQ-FSC-09.1: never descended, no error for the skip
        }
        // symlinked file (or broken symlink): walkable entry, eligibility deferred.
      } else if (lst.isDirectory()) {
        dirStack.push(relPath);
        continue;
      }

      entries.push({ relPath, absPath });
      if (entries.length > bound) {
        throw invalidInput(boundExceededMessage(bound));
      }
    }
  }

  return entries;
}
