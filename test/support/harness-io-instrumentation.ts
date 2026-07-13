// Shared REQ-ATH-11 I/O instrumentation rig (extracted from the two harness invariant
// files that used to carry near-duplicate copies): call-interception spies on `node:fs`,
// `node:net`, Bun-native I/O (`Bun.write`/`file`/`spawn`/`$`/`connect`), and global
// `fetch`; Proxy GET traps on `process.env`/`process.argv`. Spies stay armed between
// `instrumentHarnessIO()` and `.restore()` and call through to the real implementation
// (pass-through) — the rig observes, never disables, the platform. Every event records
// the call's FIRST argument, which the per-file allow-list predicates match on.
//
// `node:fs`/`node:net` are instrumented BLANKET (every function-typed export), not a
// curated name subset — the invariant governs "any I/O", and a hand-picked list would
// silently stop covering a method nobody remembered to add. Bun-native I/O and `fetch`
// are named individually, matching design §4.6b's own enumeration.

import { spyOn } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";

export interface IoEvent {
  surface: string;
  key: string;
  arg: unknown;
}

export interface HarnessIoInstrumentation {
  events(): IoEvent[];
  envGets: number;
  argvGets: number;
  restore(): void;
}

interface SpyEntry {
  surface: string;
  key: string;
  spy: ReturnType<typeof spyOn>;
}

const BUN_IO_MEMBERS = ["write", "file", "spawn", "$", "connect"] as const;

/** Pass-through spies on every function-typed, non-constructor export of a module namespace. */
function spyOnModuleFunctions(moduleNamespace: Record<string, unknown>, surface: string): SpyEntry[] {
  const entries: SpyEntry[] = [];
  for (const key of Object.keys(moduleNamespace)) {
    // Skip PascalCase exports (classes/constructors, e.g. fs.Stats, net.Socket) — the
    // invariant concerns CALL SITES (operations), not construction of unused value types.
    if (/^[A-Z]/.test(key)) continue;
    if (typeof moduleNamespace[key] !== "function") continue;
    entries.push({ surface, key, spy: spyOn(moduleNamespace, key) });
  }
  return entries;
}

/**
 * Arms call-interception spies across every I/O surface REQ-ATH-11 enumerates, for the
 * duration between this call and `.restore()`.
 */
export function instrumentHarnessIO(): HarnessIoInstrumentation {
  const spyEntries: SpyEntry[] = [
    ...spyOnModuleFunctions(fs as unknown as Record<string, unknown>, "node:fs"),
    ...spyOnModuleFunctions(net as unknown as Record<string, unknown>, "node:net"),
    ...BUN_IO_MEMBERS.map((member) => ({ surface: "Bun", key: member, spy: spyOn(Bun, member as never) })),
    { surface: "global", key: "fetch", spy: spyOn(globalThis, "fetch") },
  ];

  let envGets = 0;
  let argvGets = 0;
  const realEnv = process.env;
  const realArgv = process.argv;
  const envProxy = new Proxy(realEnv, {
    get(target, prop, receiver) {
      envGets++;
      return Reflect.get(target, prop, receiver);
    },
  });
  const argvProxy = new Proxy(realArgv, {
    get(target, prop, receiver) {
      argvGets++;
      return Reflect.get(target, prop, receiver);
    },
  });
  (process as unknown as { env: typeof realEnv }).env = envProxy;
  (process as unknown as { argv: typeof realArgv }).argv = argvProxy;

  return {
    events(): IoEvent[] {
      return spyEntries.flatMap(({ surface, key, spy }) =>
        spy.mock.calls.map((call: unknown[]) => ({ surface, key, arg: call[0] }))
      );
    },
    get envGets() {
      return envGets;
    },
    get argvGets() {
      return argvGets;
    },
    restore() {
      for (const { spy } of spyEntries) spy.mockRestore();
      (process as unknown as { env: typeof realEnv }).env = realEnv;
      (process as unknown as { argv: typeof realArgv }).argv = realArgv;
    },
  };
}
