// src/scaffold/walk.ts (ADR-0044): folder enumeration for `scaffold` — lstat-based
// symlinked-directory non-descent (REQ-FSC-09.1) and a 10 000-entry bound (REQ-FSC-09.2).
// Pure enumeration only: source/destination eligibility, containment, and the by-value/
// by-reference verdict are NOT this module's concern (classify-transport.ts + containment.ts,
// the latter landing in S-002).

import { lstatSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { invalidInput } from "../core/authoring-error.ts";

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
 */
export function walkFolder(fromAbs: string, bound: number = DEFAULT_WALK_ENTRY_BOUND): WalkEntry[] {
  const entries: WalkEntry[] = [];
  const dirStack: string[] = [""];

  while (dirStack.length > 0) {
    const relDir = dirStack.pop()!;
    const absDir = relDir === "" ? fromAbs : join(fromAbs, relDir);
    const names = readdirSync(absDir).sort();

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
