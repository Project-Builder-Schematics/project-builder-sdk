// The code that took over src/transport's role, src-relative, for the guards whose scope was
// src/transport/**. Folders count whole, so a file added to one later is still scanned; platform/
// is shared by every context, so there only the file that left src/transport counts.
import { join } from "node:path";
import { collectTsFiles } from "./import-scan.ts";

export const TRANSPORT_SCOPE_FOLDERS: readonly string[] = [
  "bounded-contexts/runner-hosting/infrastructure/in",
  "acl/irwire",
  "shared-kernel",
];

export const TRANSPORT_SCOPE_FILES: readonly string[] = ["platform/error-text.ts"];

/** Absolute paths of every .ts file under the scope folders, plus the scope files. */
export function transportScopeFiles(projectRoot: string): string[] {
  const src = join(projectRoot, "src");
  return [
    ...TRANSPORT_SCOPE_FOLDERS.flatMap((folder) => collectTsFiles(join(src, folder))),
    ...TRANSPORT_SCOPE_FILES.map((file) => join(src, file)),
  ];
}
