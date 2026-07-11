import { afterEach } from "bun:test";
import { mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Registers an afterEach hook (call once per test file, at module scope) that best-effort
// chmods each scratch dir back to writable — a test may have locked one down as part of a
// permission-fixture — before recursively removing it.
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
