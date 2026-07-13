import { afterEach } from "bun:test";
import { mkdtempSync, rmSync, chmodSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Registers an afterEach hook (call once per test file, at module scope) that best-effort
// chmods each scratch dir back to writable — a test may have locked one down as part of a
// permission-fixture — before recursively removing it.
//
// ADR-0046 migration (schematic-local-files, S-000): every returned dir also seeds a
// `collection.json` marker directly inside it — `defineFactory({ packageDir })`'s new
// pre-`als.run` ancestor walk (REQ-PRC-03) now fails loud on ANY packageDir with no
// collection.json ancestor, including callers of this factory that never call
// `seedSchema` (e.g. the schema-opt-out case in run-boundary-validation.test.ts). A test
// that needs to exercise the missing-ancestor path removes the marker itself
// (`rmSync(join(dir, "collection.json"))`).
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
    writeFileSync(join(dir, "collection.json"), "{}", "utf-8");
    dirs.push(dir);
    return dir;
  };
}
