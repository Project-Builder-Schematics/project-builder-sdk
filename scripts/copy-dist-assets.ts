// Copies the files tsc does not emit (DIST_ASSETS, DIST_NOTICES) from src/ to the same dist/ path.
//
// usage: bun scripts/copy-dist-assets.ts [packageRoot]
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DIST_ASSETS, DIST_DIR_NAME, DIST_NOTICES, SRC_DIR_NAME } from "./derive-runner-closure.ts";

const packageRoot = process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url));

for (const path of [...DIST_ASSETS, ...DIST_NOTICES]) {
  const target = join(packageRoot, DIST_DIR_NAME, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(packageRoot, SRC_DIR_NAME, path), target);
}
process.stdout.write(`dist-assets: ${DIST_ASSETS.length + DIST_NOTICES.length} files copied\n`);
