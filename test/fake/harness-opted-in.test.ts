/**
 * REQ-ATH-11.2 + REQ-ATH-13(.1,.2) (S-006, GATED): a `packageDir`-opted-in factory
 * (`defineFactory(fn, { packageDir })`, stage-4 ADR-0029) run through `runFactoryForTest`
 * AS-IS — the harness needs ZERO code change (design §4.3's explicit claim). Verified at
 * this slice's build: neither `src/testing/index.ts` nor `src/core/context.ts` required
 * any edit for these scenarios to pass.
 *
 * **Executor note — ATH-11.2 predicate widened beyond the design §4.6b literal text**:
 * §4.6b's event-allowlist predicate names only "the `node:fs` read events whose resolved
 * target path equals `<packageDir>/schema.json`" as observed-not-flagged. Investigating the
 * ACTUAL merged discovery surface (this slice's gate — `stage-4-typed-options` archived)
 * shows `defineFactory`'s opted-in branch (`src/core/context.ts` lines ~202-206) makes TWO
 * unconditional `node:fs` reads, in order, both BEFORE `als.run`: `checkReservedNames` ->
 * `findReservedSibling` -> `readdirSync(packageDir)` (`src/core/schema/schema-discovery.ts`),
 * THEN `validateAtRunBoundary` -> `readFileSync(<packageDir>/schema.json)`. Both are the
 * factory's own declared opted-in behaviour (REQ-ATH-11's carve-out) — neither is harness
 * machinery, neither is optional, and an author cannot opt out of one without the other
 * (`options.packageDir !== undefined` gates both calls identically). The predicate below
 * therefore allows BOTH resolved paths (`<packageDir>` via `readdirSync`, and
 * `<packageDir>/schema.json` via `readFileSync`) rather than the single path §4.6b's prose
 * names — proven necessary by RED (see the "must-fail-first" note on the test below): the
 * literal single-path predicate fails this run for the wrong-classified `readdirSync` event
 * before any implementation change, confirming the widening is required, not cosmetic.
 * Every OTHER surface (net, Bun I/O, fetch, env/argv gets, and any OTHER fs call) still
 * fails closed, per the design's fail-closed guarantee.
 *
 * **Executor note — ATH-13 interim-shape reinterpretation (spec staleness, licensed)**:
 * REQ-ATH-13's card text describes an "interim" window where a schema-invalid rejection is
 * a plain `Error` (typed `unknown`) "until stage-4's S-006 lands," with scenarios
 * re-verifying against the `AuthoringError` shape "at that time." That time is NOW: this
 * gate's own verification confirms `stage-4-typed-options` has ARCHIVED, and
 * `src/core/schema/input-rejection.ts`'s header comment + implementation (git history:
 * `6bbd9f2 feat(schema): stage-4 S-006 — AuthoringError finalization for typed-input
 * rejections`) show `rejectionFor`/`rejectionForReservedName` already construct a full
 * `AuthoringError{origin:"authoring-rejected", reason}` — not a plain `Error`. This is
 * independently confirmed by the ALREADY-GREEN `test/skeleton/run-boundary-validation.test.ts`
 * REQ-RBV-01.2 case (same `PORT_SCHEMA`, same message, direct `defineFactory` call). The
 * interim window described by the card's literal text has therefore already closed on this
 * build's merge base — ATH-13.1/.2 below assert the `AuthoringError` shape REQ-ATH-13's own
 * text anticipates post-S-006, not the stale plain-Error/`unknown` interim. Both are
 * [characterization]: the underlying production behaviour predates this slice (it shipped
 * with stage-4's own now-archived S-006), so RED-first is waived per the slices RED-posture
 * taxonomy — these tests pin already-intended behaviour reached through a NEW entry point
 * (the harness facade), not drive new production logic.
 */
import { describe, it, expect, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import { join } from "node:path";
import { defineFactory, runFactoryForTest } from "../../src/testing/index.ts";
import { create, AuthoringError } from "../../src/commons/index.ts";

const FIXTURE_DIR = join(import.meta.dir, "../fixtures/harness-opted-in");
const SCHEMA_PATH = join(FIXTURE_DIR, "schema.json");
// ADR-0046 (schematic-local-files, S-000): the new pre-`als.run` packageRoot ceiling walk
// (`resolvePackageRoot`, `src/core/context.ts`) adds a THIRD unconditional, factory-own
// declared read — `existsSync(<packageDir>/collection.json)` — between the two reads this
// file's header comment already documents. The fixture's own `collection.json` marker
// (added alongside `schema.json`, S-000.3 migration) means the walk resolves on its FIRST
// probe, at `packageDir` itself.
const COLLECTION_JSON_PATH = join(FIXTURE_DIR, "collection.json");

interface IoEvent {
  surface: string;
  key: string;
  arg: unknown;
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
    if (/^[A-Z]/.test(key)) continue;
    if (typeof moduleNamespace[key] !== "function") continue;
    entries.push({ surface, key, spy: spyOn(moduleNamespace, key) });
  }
  return entries;
}

interface HarnessIoInstrumentation {
  events(): IoEvent[];
  envGets: number;
  argvGets: number;
  restore(): void;
}

/** Near-duplicate of harness-in-memory-invariant.test.ts's rig (S-002 precedent: kept
 * local rather than extracted — this file additionally records each call's first argument,
 * needed by the event-allowlist predicate below). */
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

// The widened predicate (executor note above): the ONLY node:fs events an opted-in
// factory's OWN declared behaviour is allowed to produce — the reserved-lifecycle-name
// directory scan of `<packageDir>` itself, and the schema read of `<packageDir>/schema.json`.
function isDeclaredOptedInRead(event: IoEvent): boolean {
  if (event.surface !== "node:fs") return false;
  if (event.key === "readdirSync") return event.arg === FIXTURE_DIR;
  if (event.key === "readFileSync") return event.arg === SCHEMA_PATH;
  if (event.key === "existsSync") return event.arg === COLLECTION_JSON_PATH;
  return false;
}

describe("REQ-ATH-11.2 — opted-in factory's own declared reads are observed, not flagged", () => {
  it(
    "[must-fail-first] REQ-ATH-11.2: only the declared opted-in reads are allowed; every other surface stays zero",
    async () => {
      const instrumentation = instrumentHarnessIO();
      try {
        const run = defineFactory<{ port: number }>(() => {
          create("server.config.ts", { template: "static content", options: {} });
        }, { packageDir: FIXTURE_DIR });

        const result = await runFactoryForTest(run, { port: 8080 });

        expect(result.error).toBeUndefined();

        const undeclaredFsEvents = instrumentation.events().filter(
          (event) => event.surface === "node:fs" && !isDeclaredOptedInRead(event)
        );
        expect(undeclaredFsEvents).toEqual([]);

        const declaredFsEvents = instrumentation.events().filter(isDeclaredOptedInRead);
        expect(declaredFsEvents.map((event) => event.key).sort()).toEqual([
          "existsSync",
          "readFileSync",
          "readdirSync",
        ]);

        const otherSurfaceEvents = instrumentation.events().filter((event) => event.surface !== "node:fs");
        expect(otherSurfaceEvents).toEqual([]);
        expect(instrumentation.envGets).toEqual(0);
        expect(instrumentation.argvGets).toEqual(0);
      } finally {
        instrumentation.restore();
      }
    }
  );
});

describe("REQ-ATH-13 — opted-in factory support through the harness", () => {
  it("[characterization] REQ-ATH-13.1: schema-invalid input rejects all-or-nothing via result.error", async () => {
    const run = defineFactory<{ port?: number }>(() => {
      create("server.config.ts", { template: "static content", options: {} });
    }, { packageDir: FIXTURE_DIR });

    const result = await runFactoryForTest(run, {});

    expect(result.tree.size).toEqual(0);
    expect(result.emitted).toEqual([]);
    expect(result.error).toBeInstanceOf(AuthoringError);
    const err = result.error as AuthoringError;
    expect(err.reason).toEqual("invalid-input");
    expect(err.origin).toEqual("authoring-rejected");
    expect(err.message).toEqual("invalid input: port must be number");
  });

  it("[characterization] REQ-ATH-13.2: schema-valid input runs the opted-in factory normally", async () => {
    const run = defineFactory<{ port: number }>((input) => {
      create("server.config.ts", {
        template: "export const port = {{port}};",
        options: { port: input.port },
      });
    }, { packageDir: FIXTURE_DIR });

    const result = await runFactoryForTest(run, { port: 8080 });

    // Template placeholders survive unrendered (REQ-ATH-10) — this asserts the run
    // COMMITTED, indistinguishable from REQ-ATH-01.1's non-opted-in happy path, not that
    // the SDK interpolates `{{port}}` itself (it never does; the engine renders templates).
    expect(result.tree.get("server.config.ts")).toEqual("export const port = {{port}};");
    expect(result.error).toBeUndefined();
  });
});
