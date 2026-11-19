import { afterEach } from "bun:test";
import { mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Registers an afterEach hook (call once per test file, at module scope) that best-effort
// chmods each scratch dir back to writable — a test may have locked one down as part of a
// permission-fixture — before recursively removing it.
//
// ADR-0077: `packageDir` is the sole run anchor — there is no ancestor marker to seed.
// This factory used to fabricate a `collection.json` marker directly inside every
// returned dir (the retired `package-root-containment` ancestor walk required one); that
// fabrication is removed. A test whose fixture happens to plant a static, on-disk
// `collection.json` for an unrelated purpose does so itself, explicitly.
export function scratchDirFactory(prefix: string): () => string {
  let dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      try {
        chmodSync(dir, 0o755);
      } catch {
        // best-effort
      }
      rmSync(dir, { recursive: true, force: true });
    }
    dirs = [];
  });

  return () => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };
}

// Root bypasses permission bits, so a chmod fixture proves nothing there; fail loud rather
// than skip, so a bypassed proof can never read as green.
export function requireNonRoot(): void {
  if (process.getuid?.() === 0) throw new Error("must run as non-root: chmod fixtures are bypassed by root");
}
