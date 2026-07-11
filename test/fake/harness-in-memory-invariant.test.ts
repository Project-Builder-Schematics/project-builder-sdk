/**
 * REQ-ATH-11.1 (S-002): the in-memory-only invariant, scoped to HARNESS MACHINERY —
 * `runFactoryForTest` itself, the fake, the spy-recording wrapper, and the seeding path —
 * which MUST NEVER touch the filesystem, network, environment variables, or `process.argv`.
 *
 * Concrete instrumentation (design §4.6b): call-interception spies on `node:fs`, `node:net`,
 * Bun-native I/O (`Bun.write`/`file`/`spawn`/`$`/`connect`), and global `fetch`; Proxy GET
 * traps on `process.env`/`process.argv`. Spies stay armed for the run's FULL duration and
 * call through to the real implementation (pass-through) — this test observes, never
 * disables, the platform.
 *
 * `node:fs`/`node:net` are instrumented BLANKET (every function-typed export), not a
 * curated name subset — the invariant governs "any I/O", and a hand-picked list would
 * silently stop covering a method nobody remembered to add. Bun-native I/O and `fetch`
 * are named individually, matching design §4.6b's own enumeration.
 *
 * ATH-11.2 (opted-in factory's own schema.json read, observed-not-flagged) is S-006 scope
 * (STAGE-4-MERGED-DEPENDENT, gated) — not built here. Investigated at S-002 build time
 * (executor note, design rev 3): stage-4's merged discovery surface
 * (`src/core/schema/schema-discovery.ts`'s `readdirSync`, `src/core/context.ts`'s
 * `readFileSync`) only fires when `defineFactory` is called with `options.packageDir` —
 * confirmed via `src/core/context.ts` lines ~197-206 (both reads are inside the
 * `if (options?.packageDir !== undefined)` branch). REQ-ATH-11.1's factories below never
 * opt in, so this floor needs no allowlist predicate — strict zero-events is correct as
 * written. The predicate itself is S-006 scope.
 */
import { describe, it, expect, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import { defineFactory, runFactoryForTest } from "../../src/testing/index.ts";
import { create, modify, find, remove, rename, move, copy } from "../../src/commons/index.ts";

interface IoEvent {
  surface: string;
  key: string;
}

interface HarnessIoInstrumentation {
  events: IoEvent[];
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
function instrumentHarnessIO(): HarnessIoInstrumentation {
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
    get events(): IoEvent[] {
      return spyEntries.flatMap(({ surface, key, spy }) => spy.mock.calls.map(() => ({ surface, key })));
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

describe("REQ-ATH-11.1 — in-memory-only invariant (harness machinery)", () => {
  it("[permanent-fixture][red-proof] a planted fs read during the run is detected by the instrumentation", async () => {
    const instrumentation = instrumentHarnessIO();
    try {
      // Plants a real node:fs call INSIDE the factory — proves the instrumentation is not
      // vacuous (a broken/no-op spy setup would let this slide through undetected).
      const run = defineFactory<void>(() => {
        fs.readFileSync(import.meta.path, "utf-8");
        create("planted.ts", { template: "x", options: {} });
      });

      await runFactoryForTest(run, undefined);

      const fsEvents = instrumentation.events.filter((event) => event.surface === "node:fs");
      expect(fsEvents.length).toBeGreaterThan(0);
      expect(fsEvents.some((event) => event.key === "readFileSync")).toBe(true);
    } finally {
      instrumentation.restore();
    }
  });

  it("REQ-ATH-11.1: every verb against a non-trivial seed touches zero instrumented I/O surfaces and zero env/argv gets", async () => {
    const instrumentation = instrumentHarnessIO();
    try {
      const run = defineFactory<void>(async () => {
        create("created.ts", { template: "new-content", options: {} });
        const seeded = await find("seeded.ts").read();
        modify("seeded.ts", `${seeded}-modified`);
        remove("to-delete.ts");
        rename("to-rename.ts", "renamed.ts");
        move("to-move.ts", "moved-dir");
        copy("to-copy.ts", "copied.ts");
      });

      const result = await runFactoryForTest(run, undefined, {
        "seeded.ts": "seed-content",
        "to-delete.ts": "x",
        "to-rename.ts": "x",
        "to-move.ts": "x",
        "to-copy.ts": "x",
      });

      expect(result.error).toBeUndefined();
      expect(instrumentation.events).toEqual([]);
      expect(instrumentation.envGets).toEqual(0);
      expect(instrumentation.argvGets).toEqual(0);
    } finally {
      instrumentation.restore();
    }
  });
});
