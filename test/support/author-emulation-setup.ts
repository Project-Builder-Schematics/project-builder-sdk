// Git-hostile + oversized fixture materialization (REQ-AEG-07, design §4.9). These fixture
// states — empty directories, symlinks, and multi-MiB byte fills — cannot be faithfully
// committed to the repository (git drops empty dirs, symlinks are platform-dependent, and
// large blobs bloat the repo). They are created programmatically at test setup and torn
// down after, mirroring the repo's existing scratch-dir convention
// (test/support/scratch-dir.ts) rather than living inside the committed fixture package.

import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface GitHostileFixtures {
  emptyDirPath: string;
  symlinkPath: string | undefined;
  /** The symlink's target directory — created unconditionally (even when the symlink
   * itself is skipped), so teardown must always remove it. */
  symlinkTargetPath: string;
  symlinkSkipped: boolean;
  symlinkSkipReason: string | undefined;
}

const EMPTY_DIR_NAME = "empty-dir";
const SYMLINK_NAME = "linked-dir";
const SYMLINK_TARGET_NAME = "link-target";

/**
 * Materializes an empty directory (M-14) and a symlinked directory (M-19) under `baseDir`
 * (caller-provided — typically a scratch dir from `mkdtempSync`, never inside the committed
 * fixture package). Symlink creation may be unavailable on the host platform (e.g. Windows
 * without `SeCreateSymbolicLinkPrivilege`) — that failure is recorded as a skip, never
 * thrown (M-19 note); the empty directory still materializes independently.
 */
export function materializeGitHostileFixtures(baseDir: string): GitHostileFixtures {
  const emptyDirPath = join(baseDir, EMPTY_DIR_NAME);
  mkdirSync(emptyDirPath, { recursive: true });

  const targetPath = join(baseDir, SYMLINK_TARGET_NAME);
  mkdirSync(targetPath, { recursive: true });
  const symlinkPath = join(baseDir, SYMLINK_NAME);

  try {
    symlinkSync(targetPath, symlinkPath, "dir");
    return {
      emptyDirPath,
      symlinkPath,
      symlinkTargetPath: targetPath,
      symlinkSkipped: false,
      symlinkSkipReason: undefined,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      emptyDirPath,
      symlinkPath: undefined,
      symlinkTargetPath: targetPath,
      symlinkSkipped: true,
      symlinkSkipReason: reason,
    };
  }
}

/** Tears down exactly what `materializeGitHostileFixtures` created — the empty dir, the
 * symlink (when created), and the symlink's target dir. Idempotent (force). The symlink
 * is removed BEFORE its target so no rm ever dereferences a live link. */
export function teardownGitHostileFixtures(fixtures: GitHostileFixtures): void {
  rmSync(fixtures.emptyDirPath, { recursive: true, force: true });
  if (fixtures.symlinkPath !== undefined && existsSync(fixtures.symlinkPath)) {
    rmSync(fixtures.symlinkPath, { force: true });
  }
  rmSync(fixtures.symlinkTargetPath, { recursive: true, force: true });
}

// A fixed repeating byte sequence (never random/clock-derived) so two materializations at
// the same size are byte-identical, and a smaller size is always a prefix of a larger one
// — the property M-09/M-10/M-11's content-digest corpus records rely on for a stable
// sha256 across regenerations (design §4.3 R-G).
const FILL_PATTERN = Buffer.from("PBUILDER-FIXTURE-FILL-", "utf-8");

/** Writes a deterministic, size-parameterized byte fill to `path` (M-09/M-10/M-11, never committed). */
export function materializeByteFill(path: string, sizeBytes: number): void {
  const buf = Buffer.alloc(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) {
    buf[i] = FILL_PATTERN[i % FILL_PATTERN.length]!;
  }
  writeFileSync(path, buf);
}
