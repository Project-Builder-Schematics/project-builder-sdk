// The files that moved out of src/transport into the target layout, src-relative. A guard whose
// scope is src/transport keeps that scope over these files too, by exact path: nothing else
// under src/acl/, src/shared-kernel/ or src/platform/ counts as transport.
import { join } from "node:path";

export const REPLACED_TRANSPORT_FILES: readonly string[] = [
  "acl/irwire/stdio-engine-client.ts",
  "acl/irwire/frame-reader.ts",
  "shared-kernel/framing.ts",
  "shared-kernel/wire-protocol.ts",
  "platform/error-text.ts",
  "bounded-contexts/runner-hosting/infrastructure/in/runner.ts",
  "bounded-contexts/runner-hosting/infrastructure/in/factory-pointer.ts",
  "bounded-contexts/runner-hosting/infrastructure/in/exit-codes.ts",
  "bounded-contexts/runner-hosting/infrastructure/in/single-instance-probe.ts",
  "bounded-contexts/runner-hosting/infrastructure/in/bootstrap-bridge.ts",
];

/** Absolute paths of every file that moved out of src/transport, which is now empty. */
export function transportScopeFiles(projectRoot: string): string[] {
  return REPLACED_TRANSPORT_FILES.map((file) => join(projectRoot, "src", file));
}
