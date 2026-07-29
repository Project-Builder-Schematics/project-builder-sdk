// src/scaffold/walk.ts (ADR-0044): folder enumeration for `scaffold` — lstat-based
// symlinked-directory non-descent (REQ-FSC-09.1) and a 10 000-entry bound (REQ-FSC-09.2).
// Pure enumeration only: source/destination eligibility and the by-value/by-reference
// verdict are NOT this module's concern (classify-transport.ts + path-guards.ts).

import { lstatSync, readdirSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";
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

// judgment-day iteration 2 fix: the ROOT `readdirSync` (below) has no guard the caller
// already provides — `runScaffold` only lexically screens the root (`validateSourceLexical`,
// ADR-0077), never that it exists or is a directory (that check is deliberately left for
// `walkFolder` to answer). A `from` that resolves to a regular FILE or does not exist at
// all therefore used to reach `readdirSync` unguarded and throw a raw Node `Error` — never
// an `AuthoringError` — whose message echoes the ABSOLUTE filesystem path (no-echo
// violation). Ruling 8 (REQ-FSC-10.4) extends the SAME guard shape to every RECURSIVE
// sub-directory `readdirSync` and per-entry `lstatSync` below — a mid-walk failure (an
// entry vanishes, or an EACCES mid-tree) is no more entitled to leak a raw Node error than
// the root is. `rootRelPath` is the author-facing, package-relative `from` the caller
// already has in hand (never re-derived from `fromAbs`); a caller that omits it (only the
// direct-unit-test callers in walk.test.ts
// do) falls back to a locator-free phrasing rather than ever risking an absolute-path leak.
/** Every message helper below (root and per-entry alike) shares this shape: a locator-free
 * phrasing when `relPath` is undefined (only the direct unit-test callers in walk.test.ts
 * omit it), the locator-bearing phrasing otherwise — never an absolute path either way. */
function withOptionalLocator(relPath: string | undefined, plain: string, withLocator: (relPath: string) => string): string {
  return relPath === undefined ? plain : withLocator(relPath);
}

function rootNotDirectoryMessage(rootRelPath: string | undefined): string {
  return withOptionalLocator(
    rootRelPath,
    "invalid input: scaffold \"from\" must be a folder — it resolves to a regular file",
    (relPath) => `invalid input: scaffold "from" (${relPath}) must be a folder — it resolves to a regular file`
  );
}

function rootNotFoundMessage(rootRelPath: string | undefined): string {
  return withOptionalLocator(
    rootRelPath,
    "invalid input: scaffold \"from\" folder does not exist",
    (relPath) => `invalid input: scaffold "from" folder (${relPath}) does not exist`
  );
}

function rootUnreadableMessage(rootRelPath: string | undefined): string {
  return withOptionalLocator(
    rootRelPath,
    "invalid input: scaffold \"from\" folder could not be read",
    (relPath) => `invalid input: scaffold "from" folder (${relPath}) could not be read`
  );
}

// Owner ruling 16 (2026-07-29): REQ-FSC-09 mandates the walk never descend into ANY
// symlinked directory, but only the NESTED case was implemented — the walk ROOT itself
// went straight to `readdirSync` with no `lstatSync` ahead of it, so a symlinked `from`
// was FOLLOWED rather than rejected (probe-proven: enumerates content outside the
// package). A symlinked root is now an explicit, named rejection — never a silent skip
// (skipping would make `scaffold` a silent no-op for a root that resolves to a real,
// populated directory, which is a worse surprise than a nested skip) — reusing the SAME
// `invalid-input` reason and locator shape every other root-failure message already uses.
function rootIsSymlinkMessage(rootRelPath: string | undefined): string {
  return withOptionalLocator(
    rootRelPath,
    "invalid input: scaffold \"from\" must not be a symlinked directory",
    (relPath) => `invalid input: scaffold "from" (${relPath}) must not be a symlinked directory`
  );
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

// REQ-FSC-10.4 (ruling 8, design §4 Q3): the recursive `readdirSync` (a nested directory
// this walk itself discovered) and the per-entry `lstatSync` had NO guard ahead of them —
// unlike the ROOT read above — so a mid-walk failure (the entry vanishes, or an EACCES
// mid-tree) used to reach the caller as a raw Node `Error`, echoing an ABSOLUTE path
// (no-echo violation). `rootReadFailure`'s SHAPE is reused (AuthoringError, invalid-input,
// package-relative, no-echo) but its three texts are ROOT-specific and would misname a
// per-entry failure — these two templates are ENTRY-specific instead. `X` is
// `posix.join(rootRelPath, entryRelPath)`; when `rootRelPath` is undefined (only the
// direct unit-test callers in walk.test.ts), both fall back to a locator-free phrasing,
// exactly as the three root texts already do — never an absolute path.
function entryUnreadableMessage(entryRelPath: string | undefined): string {
  return withOptionalLocator(
    entryRelPath,
    "invalid input: scaffold entry could not be read",
    (relPath) => `invalid input: scaffold entry (${relPath}) could not be read`
  );
}

function entryDisappearedMessage(entryRelPath: string | undefined): string {
  return withOptionalLocator(
    entryRelPath,
    "invalid input: scaffold entry disappeared during the walk",
    (relPath) => `invalid input: scaffold entry (${relPath}) disappeared during the walk`
  );
}

function entryReadFailure(err: unknown, entryRelPath: string | undefined): Error {
  if (isErrnoException(err) && err.code === "ENOENT") {
    return invalidInput(entryDisappearedMessage(entryRelPath));
  }
  return invalidInput(entryUnreadableMessage(entryRelPath));
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
 * posix-separated `relPath`s (sorted for deterministic output). A NESTED symlinked
 * directory is NEVER descended — even when its target resolves inside the package
 * (REQ-FSC-09.1) — skipped silently, no error. The ROOT is held to a stricter standard
 * (owner ruling 16): a symlinked `from` itself is REJECTED (`AuthoringError`,
 * `invalid-input`) rather than followed or silently skipped — a bare no-op would hide a
 * root that resolves to a real, populated directory. Fails loud, naming the bound, once
 * the enumerated entry count exceeds `bound` (REQ-FSC-09.2); `bound` is injectable so a
 * test can drive the branch without materializing 10,001 real files.
 *
 * `rootRelPath` (judgment-day iteration 2 fix, extended by ruling 8 / REQ-FSC-10.4): the
 * author-facing, package-relative `from` — threaded through to name BOTH the ROOT and any
 * RECURSIVE entry in an `AuthoringError` message: the root if it itself is not a readable
 * directory (a regular file, or missing — `runScaffold`'s `validateSourceLexical` only
 * screens the root lexically, deliberately leaving existence/type to this function, see its
 * own doc-comment); a nested entry if a recursive `readdirSync`/`lstatSync` fails mid-walk
 * (the entry vanished, or an EACCES mid-tree, REQ-FSC-10.4).
 */
export function walkFolder(
  fromAbs: string,
  bound: number = DEFAULT_WALK_ENTRY_BOUND,
  rootRelPath?: string
): WalkEntry[] {
  // judgment-day round 2 fix (F1): POSIX `lstat` FOLLOWS the final symlink when the path
  // ends with a separator — an un-normalized `fromAbs` (trailing slash, doubled trailing
  // slash, or a literal "./" segment) would resolve THROUGH a symlinked root before the
  // `isSymbolicLink()` check below ever ran, bypassing the ruling-16 rejection entirely
  // (probe-proven leak). `resolve` strips any trailing separator and collapses "./"/".."
  // segments — the SAME normalization every recursive `join(root, relDir)` below now
  // builds on, so a caller passing an un-normalized root is corrected in exactly ONE place.
  const root = resolve(fromAbs);
  const entries: WalkEntry[] = [];
  const dirStack: string[] = [""];
  // judgment-day round 3 fix (F6): counts EVERY enumerated dirent (files, directories, and
  // skipped symlinked directories alike) — the prior bound only incremented on
  // `entries.push` (files), so a directory-only tree was entirely unbounded regardless of
  // depth or breadth. REQ-FSC-09.2 frames the bound as a loop-safety/DoS guard over
  // "enumerated entries," not "emitted files" — every name a `readdirSync` call returns is
  // one enumerated entry, whatever it turns out to be.
  let enumeratedCount = 0;

  while (dirStack.length > 0) {
    const relDir = dirStack.pop()!;
    const absDir = relDir === "" ? root : join(root, relDir);
    let names: string[];
    if (relDir === "") {
      // REQ-FSC-09.1 (owner ruling 16): the root gets the SAME non-descent guarantee a
      // nested symlinked directory already has — `lstatSync` first (never `readdirSync`
      // straight off `fromAbs`, which would silently FOLLOW a symlinked root) so a
      // missing/non-directory root still reaches `rootReadFailure` unchanged (lstat fails
      // with the identical errno readdir would have), and a symlinked root rejects
      // explicitly instead of either being followed or silently skipped.
      let rootLst: ReturnType<typeof lstatSync>;
      try {
        rootLst = lstatSync(absDir);
      } catch (err) {
        throw rootReadFailure(err, rootRelPath);
      }
      if (rootLst.isSymbolicLink()) {
        throw invalidInput(rootIsSymlinkMessage(rootRelPath));
      }
      try {
        names = readdirSync(absDir).sort();
      } catch (err) {
        throw rootReadFailure(err, rootRelPath);
      }
    } else {
      try {
        names = readdirSync(absDir).sort();
      } catch (err) {
        const entryX = rootRelPath === undefined ? undefined : posix.join(rootRelPath, relDir);
        throw entryReadFailure(err, entryX);
      }
    }

    for (const name of names) {
      // F6: incremented for EVERY name `readdirSync` returned, before this entry is
      // classified — a directory that will be pushed onto `dirStack` (never reaching
      // `entries.push` below) still counts against the bound.
      enumeratedCount += 1;
      if (enumeratedCount > bound) {
        throw invalidInput(boundExceededMessage(bound));
      }

      const relPath = relDir === "" ? name : `${relDir}/${name}`;
      const absPath = join(absDir, name);
      let lst: ReturnType<typeof lstatSync>;
      try {
        lst = lstatSync(absPath);
      } catch (err) {
        const entryX = rootRelPath === undefined ? undefined : posix.join(rootRelPath, relPath);
        throw entryReadFailure(err, entryX);
      }

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
    }
  }

  return entries;
}
