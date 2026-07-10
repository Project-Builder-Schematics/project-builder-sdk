// Shared canary helper (SEC-5, design §4.2): token generation, schema-fixture seeding, and
// a subprocess stdout/stderr capture helper. Established here (S-001, the first slice that
// needs process-level capture for the CLI e2e) and consumed by the rejection-domain suites
// (S-003/S-004) and the cross-domain no-echo scan (S-005) — same pattern as the existing
// `rejection-messages.ts` shared dictionary.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// A canary token is deliberately distinctive — never a plausible real value — so its
// presence on any error surface (message, .stack, stdout, stderr) is unambiguous and can
// never be confused with legitimate user content.
export function canaryToken(label: string): string {
  return `CANARY-${label}-${Math.random().toString(36).slice(2)}`;
}

// Writes a `schema.json` (and any additional sibling files) into `dir`, creating it if
// needed — the common fixture-seeding step every rejection-domain test starts from.
export function seedSchema(dir: string, schema: unknown, siblings: Record<string, string> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "schema.json"), JSON.stringify(schema, null, 2), "utf-8");
  for (const [name, content] of Object.entries(siblings)) {
    writeFileSync(join(dir, name), content, "utf-8");
  }
}

export interface SpawnCapture {
  status: number | null;
  stdout: string;
  stderr: string;
}

// Spawns a subprocess and captures stdout/stderr SEPARATELY (never merged) — the
// channel-split assertions (TFO-04.3, and later the RBV/RLN error-surface scans) depend on
// the two streams staying distinguishable.
export function spawnCapture(command: string, args: string[], options?: { cwd?: string }): SpawnCapture {
  const result = spawnSync(command, args, { cwd: options?.cwd, encoding: "utf-8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
