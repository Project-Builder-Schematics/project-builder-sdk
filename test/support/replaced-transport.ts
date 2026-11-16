// The files that moved out of src/transport into the target layout, src-relative. A guard whose
// scope is src/transport keeps that scope over these files too, by exact path: nothing else
// under src/acl/, src/shared-kernel/ or src/platform/ counts as transport.
import { join } from "node:path";
import { collectTsFiles } from "./import-scan.ts";

export const REPLACED_TRANSPORT_FILES: readonly string[] = [
  "acl/irwire/stdio-engine-client.ts",
  "acl/irwire/frame-reader.ts",
  "shared-kernel/framing.ts",
  "shared-kernel/wire-protocol.ts",
  "platform/error-text.ts",
];

/** Absolute paths of src/transport/** plus the files that moved out of it. */
export function transportScopeFiles(projectRoot: string): string[] {
  const src = join(projectRoot, "src");
  return [...collectTsFiles(join(src, "transport")), ...REPLACED_TRANSPORT_FILES.map((file) => join(src, file))];
}
