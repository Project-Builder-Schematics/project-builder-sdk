// src/scaffold/containment.ts (ADR-0044, ADR-0045, ADR-0046): the dual-anchor
// containment enforcement (package-root-containment REQ-PRC-01..09) — REPLACES S-001's
// MINIMAL placeholder lexical guard that used to live inline in classify-transport.ts.
// Two DISTINCT checks, never conflated (REQ-PRC-01):
//
//  1. `validateSourceContainment` — realpath-based, segment-aware, case-fold ceiling
//     check + regular-file allow-list for a SOURCE path (PRC-01..08). Mints the four
//     `source-*` AuthoringReasons (REQ-AEC-10): `source-not-found`,
//     `source-outside-package`, `source-not-regular-file`, `source-unreadable`.
//  2. `validateDestinationLexical` — lexical-only guard for a `to` destination
//     (PRC-09) — no realpath (the destination may not exist yet). Reuses the EXISTING
//     `invalid-input` reason (scaffold-family author misuse, REQ-AEC-12), never a
//     `source-*` reason — this is about the emitted DIRECTIVE SHAPE, not a source read.
//
// Classification pipeline order (design §Data Model, pinned): lexical `../`/absolute
// screen → resolve + segment-aware ceiling check (pre-realpath) → (out-of-ceiling ⇒
// source-outside-package, NO existence probe, PRC-07) → realpath. ENOENT ordering (S1,
// closes the ancestor-symlink existence oracle, REQ-PRC-07.2): on realpath ENOENT,
// `source-not-found` may be concluded ONLY AFTER the nearest EXISTING ancestor's
// realpath is proven in-ceiling; an out-of-ceiling ancestor still answers
// `source-outside-package`, never differentiating existence beyond the boundary. Then
// `lstat` allow-list (`isFile()` only, else `source-not-regular-file` — never a
// directory-blacklist, PRC-04.4's FIFO kill). Only after ALL of this may content be read
// (PRC-08) — `source-unreadable` covers a LATER read failure of an already-proven
// in-ceiling regular file (permission/I/O error), surfaced by classify-transport.ts's
// own `readFileSync`, not by this module (this module never reads content).

import { lstatSync, readlinkSync, realpathSync, existsSync, type Stats } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { AuthoringError, invalidInput } from "../core/authoring-error.ts";
import { isErrnoException } from "../core/fs-errors.ts";

const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";

const fold = (p: string): string => (FOLD_CASE ? p.toLowerCase() : p);

// Segment-aware ceiling comparison (REQ-PRC-04, kills the bare-`startsWith` mutant —
// REQ-PRC-04.5's sibling-prefix scenario: `/pkg-evil/x`.startsWith(`/pkg`) would wrongly
// admit it). `candidate` is within `ceiling` iff it EQUALS the ceiling or starts with the
// ceiling PLUS a path separator — never a bare string prefix. Case-folds on
// case-insensitive platforms ONLY (product ruling Q24 — win32/darwin); canonical-form
// hardening (UNC/device/reserved-DOS/drive-relative) stays engine-side (BRC-08).
export function isWithinCeiling(candidateAbs: string, ceilingAbs: string): boolean {
  const candidate = fold(candidateAbs);
  const ceiling = fold(ceilingAbs);
  const ceilingWithSep = ceiling.endsWith(sep) ? ceiling : ceiling + sep;
  return candidate === ceiling || candidate.startsWith(ceilingWithSep);
}

// Lexical `../`/absolute screen shared by BOTH the source guard (REQ-PRC-04's first
// clause) and the destination guard (REQ-PRC-09, symmetric by design): a literal ".."
// segment or an absolute-looking path (POSIX leading `/` or a Windows drive letter)
// resolves outside any ceiling by construction — no filesystem touch needed to reject it.
function isLexicallyEscaping(relPath: string): boolean {
  const isAbsolute = relPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relPath);
  const segments = relPath.split(/[\\/]+/);
  return isAbsolute || segments.includes("..");
}

function sourceRejection(reason: "source-not-found" | "source-outside-package" | "source-not-regular-file" | "source-unreadable", relPath: string): AuthoringError {
  // No `message` override: messageFor() derives the AEC-11 neutral template from
  // `reason` + `path` alone — `path` here is ALWAYS the package-relative `relPath`
  // (REQ-PRC-05), never an absolute filesystem path.
  return new AuthoringError({ verb: undefined, path: relPath, reason, appliedCount: 0 });
}

// Walks UP from `dirname(absPath)` to find the nearest EXISTING ancestor and returns its
// realpath — the GENUINELY-missing-entry half of the S1 ENOENT ordering fix (an entry
// that does not exist AT ALL, lstat included; no symlink indirection involved).
// Terminates at the filesystem root, which always exists.
function nearestExistingAncestorRealpath(absPath: string): string {
  let dir = dirname(absPath);
  for (;;) {
    if (existsSync(dir)) {
      return realpathSync(dir);
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return realpathSync(dir); // filesystem root — defensive terminator, always exists
    }
    dir = parent;
  }
}

// The BROKEN-SYMLINK half of the S1 ENOENT ordering fix (REQ-PRC-07.2): `symlinkAbsPath`
// itself EXISTS (its `lstat` succeeded) and IS a symlink, but `realpath` failed because its
// target does not exist — so there is nothing to realpath TO directly. The returned value
// is compared against the REALPATH'D ceiling, so it MUST be in real space: the raw
// `readlink` target text is LEXICAL (verify-in-loop-4 CRITICAL — on macOS a raw absolute
// target under `/var/...` never string-matches a `/private/var/...` real ceiling), and even
// a relative target joined under a realpath'd parent stays partially lexical when an
// EXISTING intermediate directory of the target is itself a symlink. Both target forms are
// therefore normalized identically: lexical absolute form first (anchored on the symlink's
// realpath'd parent for a relative target — the containing directory exists, the symlink's
// own lstat succeeded), then `nearestExistingAncestorRealpath` brings the result into real
// space. The missing tail cannot alter ceiling membership (`resolve` already collapsed any
// `..`), and the target is never existence-probed beyond the same ancestor walk the
// plain-missing case already uses (REQ-PRC-07: the containment verdict precedes existence
// knowledge). Single-hop only (the symlink's immediate target); deeper multi-hop broken
// chains are not a scenario this domain pins.
function resolveBrokenSymlinkTargetRealAncestor(symlinkAbsPath: string): string {
  const target = readlinkSync(symlinkAbsPath);
  const lexicalTargetAbs = isAbsolute(target)
    ? resolve(target)
    : resolve(join(realpathSync(dirname(symlinkAbsPath)), target));
  return nearestExistingAncestorRealpath(lexicalTargetAbs);
}

/**
 * Validates ONE package-local SOURCE path against the dual-anchor containment model
 * (REQ-PRC-01..08) and returns its realpath'd absolute path plus the `lstat` used to
 * prove regular-file eligibility — callers (`classify-transport.ts`) reuse this `Stats`
 * for the CCL-06 size gate instead of stat'ing again. Throws one of the four `source-*`
 * `AuthoringError`s (REQ-AEC-10) on any failure; never reads file CONTENT.
 */
export function validateSourceContainment(params: {
  packageDir: string;
  packageRoot: string;
  relPath: string;
}): { absPath: string; stat: Stats } {
  const { packageDir, packageRoot, relPath } = params;
  // Two ceiling REPRESENTATIONS, compared only against a candidate in the SAME space —
  // never mixed. `lexicalCeiling` is the raw (non-realpath'd) packageRoot, used for the
  // pre-realpath check against a likewise non-realpath'd candidate (step 2). `realCeiling`
  // is the SAME directory, realpath'd, used for every POST-realpath comparison (steps
  // 3+) — required because a symlinked ancestor of the whole run (e.g. macOS's
  // `/var` → `/private/var`) makes the lexical and real forms of the SAME directory
  // differ; comparing a realpath'd candidate against a non-realpath'd ceiling would
  // false-reject every source. `packageRoot` always exists (context.ts's ancestor walk
  // proved it via `existsSync`), so this realpath cannot ENOENT.
  const lexicalCeiling = resolve(packageRoot);
  const realCeiling = realpathSync(lexicalCeiling);

  // Step 1 (REQ-PRC-04 first clause): lexical `../`/absolute screen, independent of any
  // realpath check — a literal ".." segment or an absolute path resolves outside the
  // ceiling by construction (REQ-PRC-04.1/.6).
  if (isLexicallyEscaping(relPath)) {
    throw sourceRejection("source-outside-package", relPath);
  }

  const lexicalAbs = resolve(join(packageDir, relPath));

  // Step 2 (design §Classification pipeline): pre-realpath segment-aware ceiling check
  // on the lexically-resolved path — out-of-ceiling ⇒ source-outside-package, NO
  // existence probe (REQ-PRC-07: containment precedes any existence/stat probing).
  if (!isWithinCeiling(lexicalAbs, lexicalCeiling)) {
    throw sourceRejection("source-outside-package", relPath);
  }

  // Step 3: realpath — resolves symlinks. ENOENT ordering (S1, REQ-PRC-07.2): a missing
  // target may be classified source-not-found ONLY AFTER the location it would resolve TO
  // is proven in-ceiling. Two distinct ENOENT shapes, both resolved into REAL space (the
  // ceiling side of this comparison is `realCeiling` — never compare a lexical candidate
  // against it):
  //  (a) `lexicalAbs` itself is a BROKEN SYMLINK (its own entry exists, lstat succeeds,
  //      but the target it points to does not) — the target's real-space nearest existing
  //      ancestor is checked against the ceiling.
  //  (b) `lexicalAbs` does not exist AT ALL (no symlink indirection) — walk up to the
  //      nearest EXISTING ancestor and check ITS realpath against the ceiling.
  // Either way: out-of-ceiling ⇒ source-outside-package (never differentiates existence
  // beyond the boundary, REQ-PRC-07.1); in-ceiling ⇒ source-not-found.
  let realAbs: string;
  try {
    realAbs = realpathSync(lexicalAbs);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") {
      let selfIsBrokenSymlink = false;
      try {
        selfIsBrokenSymlink = lstatSync(lexicalAbs).isSymbolicLink();
      } catch {
        selfIsBrokenSymlink = false; // lexicalAbs itself doesn't exist — case (b)
      }

      const resolvedRealAncestor = selfIsBrokenSymlink
        ? resolveBrokenSymlinkTargetRealAncestor(lexicalAbs)
        : nearestExistingAncestorRealpath(lexicalAbs);

      if (!isWithinCeiling(resolvedRealAncestor, realCeiling)) {
        throw sourceRejection("source-outside-package", relPath);
      }
      throw sourceRejection("source-not-found", relPath);
    }
    throw sourceRejection("source-unreadable", relPath);
  }

  if (!isWithinCeiling(realAbs, realCeiling)) {
    throw sourceRejection("source-outside-package", relPath);
  }

  // Step 4 (REQ-PRC-04): lstat ALLOW-LIST — isFile() only, never a directory-blacklist
  // (PRC-04.4's FIFO kill: a FIFO/socket/device is equally ineligible).
  let stat: Stats;
  try {
    stat = lstatSync(realAbs);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") {
      // TOCTOU: existed for realpath, vanished before lstat — treat as not-found rather
      // than leaking a raw Node error.
      throw sourceRejection("source-not-found", relPath);
    }
    throw sourceRejection("source-unreadable", relPath);
  }

  if (!stat.isFile()) {
    throw sourceRejection("source-not-regular-file", relPath);
  }

  return { absPath: realAbs, stat };
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
 * REQ-PRC-09). Applied post-rename, post-token-translation, immediately pre-emit.
 * Rejects with the EXISTING `invalid-input` reason (scaffold-family author misuse,
 * REQ-AEC-12) — never a `source-*` reason, which is reserved for source READS. The
 * engine's own post-render check (REQ-PRC-06/BRC-08) remains the real control for
 * rendered forms the SDK cannot evaluate.
 */
export function validateDestinationLexical(relPath: string): void {
  if (isLexicallyEscaping(relPath)) {
    throw invalidInput(destinationEscapeMessage(relPath));
  }
}
