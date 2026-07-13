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
 *
 * REQ-ATH-14 (S-005, `author-test-harness` spec delta): widens the carve-out to
 * `scaffold`/`copyIn`/`create({templateFile})` reads performed BY an opted-in factory,
 * PROVIDED the resolved target lies within the run's resolved collection root
 * (`packageRoot`) — by RESOLVED PATH, not by call name (Executor Context §17), so a
 * per-file enumeration (like `harness-opted-in.test.ts`'s two-path predicate) would not
 * scale to `scaffold`'s arbitrary file count. Every other surface (net, Bun I/O, fetch,
 * env/argv gets, any disk touch OUTSIDE the collection root, or a read attributable to
 * harness machinery itself) still fails closed — the widened allow-list is scoped
 * EXCLUSIVELY to reads within the collection root, never a blanket exemption.
 */
import { describe, it, expect, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { defineFactory, runFactoryForTest } from "../../src/testing/index.ts";
import { create, modify, find, remove, rename, move, copy, scaffold } from "../../src/commons/index.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("harness-in-memory-invariant-");

interface IoEvent {
  surface: string;
  key: string;
  arg: unknown;
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

// The widened predicate (REQ-ATH-14, S-005): "by resolved path, not by call name" — any
// event whose first (path-shaped) argument resolves within the run's collection root is
// observed-not-flagged. Deliberately NOT an enumerated per-call-site allow-list (unlike
// `harness-opted-in.test.ts`'s two fixed paths) — `scaffold` walks an arbitrary file count,
// so only a resolved-path PREFIX check scales.
//
// TWO root representations are accepted (same macOS `/var` vs `/private/var` symlink
// distinction `containment.ts` itself has to handle) — some calls (e.g. `existsSync` on the
// `collection.json` ancestor probe) use the LEXICAL `packageDir` join, while others (e.g.
// containment's own `lstatSync`/`realpathSync`) resolve into REAL space. Never mixing a
// lexical arg against only a real root (or vice versa) would false-flag legitimate reads.
function isWithinCollectionRoot(event: IoEvent, roots: readonly string[]): boolean {
  if (typeof event.arg !== "string") return false;
  return roots.some((root) => event.arg === root || (event.arg as string).startsWith(root + sep));
}

describe("REQ-ATH-14 — in-memory-only invariant carve-out widened: package-root reads (S-005)", () => {
  it("REQ-ATH-14.1: a factory's own scaffold reads within the collection root are observed, not flagged", async () => {
    const dir = scratchDir(); // marker seeded directly at dir — dir IS the collection root
    mkdirSync(join(dir, "files"), { recursive: true });
    writeFileSync(join(dir, "files", "a.ts"), "export const a = 1;", "utf-8");
    const roots = [dir, realpathSync(dir)];

    const instrumentation = instrumentHarnessIO();
    try {
      const run = defineFactory<void>(() => {
        scaffold({ from: "files", to: "out" });
      }, { packageDir: dir });

      const result = await runFactoryForTest(run, undefined);

      expect(result.error).toBeUndefined();

      const fsEvents = instrumentation.events.filter((event) => event.surface === "node:fs");
      // Sanity: scaffold DID perform real reads — a vacuous/broken rig would pass trivially.
      expect(fsEvents.length).toBeGreaterThan(0);

      const outsideRoot = fsEvents.filter((event) => !isWithinCollectionRoot(event, roots));
      expect(outsideRoot).toEqual([]);

      const otherSurfaceEvents = instrumentation.events.filter((event) => event.surface !== "node:fs");
      expect(otherSurfaceEvents).toEqual([]);
      expect(instrumentation.envGets).toEqual(0);
      expect(instrumentation.argvGets).toEqual(0);
    } finally {
      instrumentation.restore();
    }
  });

  it("REQ-ATH-14.2: a read attributable to harness machinery outside the collection root still trips the invariant", async () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "files"), { recursive: true });
    writeFileSync(join(dir, "files", "a.ts"), "export const a = 1;", "utf-8");
    const roots = [dir, realpathSync(dir)];

    const instrumentation = instrumentHarnessIO();
    try {
      const run = defineFactory<void>(() => {
        // Simulates a read attributable to harness/test machinery, not the factory's own
        // declared scaffold/copyIn behaviour — deliberately OUTSIDE the collection root
        // (this test file's own source, unrelated to the scratch package dir).
        fs.readFileSync(import.meta.path, "utf-8");
        scaffold({ from: "files", to: "out" });
      }, { packageDir: dir });

      await runFactoryForTest(run, undefined);

      const outsideRoot = instrumentation.events.filter(
        (event) => event.surface === "node:fs" && !isWithinCollectionRoot(event, roots)
      );
      // The widened allow-list covers ONLY factory-attributable, within-collection-root
      // reads — a harness-machinery-shaped read outside the root must still surface.
      expect(outsideRoot.some((event) => event.key === "readFileSync")).toBe(true);
    } finally {
      instrumentation.restore();
    }
  });
});
