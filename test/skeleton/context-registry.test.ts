// context-registry.test.ts (S-001, context-singleton-fix — REQ-MIS-01.2/02.1/03.2/04.1/06.1):
// Unit-level guardrails for the module-identity-safe run-context registry S-000 landed: no
// enumerable globalThis pollution, the registry key literal pinned, sequential-run isolation,
// genuine outside-run rejection still throws, the fresh-dist guard fails loud, and the two
// PURE `resolveRunAls` decision branches (occupied-slot fail-loud / valid-reuse+fresh) —
// design rev 3's purity split: passed fake slot values directly, ZERO globalThis mutation,
// suite-order-independent.

import { describe, it, expect } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";
import { defineFactory, currentContext, resolveRunAls, RUN_ALS_REGISTRY_KEY } from "../../src/core/context.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { requireDistArtifacts } from "../support/shared-build.ts";

describe("REQ-MIS-01.2 — no enumerable global pollution", () => {
  it("a run-boundary access never adds a NEW enumerable string-keyed globalThis property", () => {
    // Order-independent by construction, not by luck: other files in this same `bun test`
    // process may already have triggered the registry install before this test runs — that
    // install is symbol-keyed and enumerable:false (getRunAls()), so it can never surface in
    // Object.keys() regardless of WHEN it happened. What this asserts holds unconditionally,
    // at any point in suite order: a run-boundary access adds no STRING-keyed property.
    const before = Object.keys(globalThis);
    try {
      currentContext();
    } catch {
      // Expected outside-run throw — getRunAls() still ran (and, if this is the process's
      // first access, installed the symbol-keyed slot) before the throw.
    }
    const after = Object.keys(globalThis);
    expect(after).toEqual(before);
  });

  it("the installed slot is reachable ONLY via its well-known symbol, never a string key", () => {
    try {
      currentContext();
    } catch {
      // trigger (or confirm) install
    }
    const symbols = Object.getOwnPropertySymbols(globalThis);
    expect(symbols.some((s) => s.description === RUN_ALS_REGISTRY_KEY)).toBe(true);
    expect(Object.keys(globalThis)).not.toContain(RUN_ALS_REGISTRY_KEY);
  });
});

describe("REQ-MIS-02.1 — registry key literal is pinned", () => {
  it("RUN_ALS_REGISTRY_KEY matches the literal recorded at sign-off", () => {
    expect(RUN_ALS_REGISTRY_KEY).toEqual("@pbuilder/sdk:core/context#run-als");
  });
});

describe("REQ-MIS-03.2 — sequential runs stay isolated", () => {
  it("the second run's currentContext(), read during the second run, is the SECOND run's context — never a stale reference to the first", async () => {
    const fake1 = new ContractFake({ seed: {} });
    const fake2 = new ContractFake({ seed: {} });
    const captured: Array<ReturnType<typeof currentContext>> = [];

    const run = defineFactory<void>(() => {
      captured.push(currentContext());
    });

    await run(undefined, { client: fake1 });
    await run(undefined, { client: fake2 });

    expect(captured).toHaveLength(2);
    // Each defineFactory call builds a fresh RunContext (fresh Session per run) — reference
    // identity is the isolation proof: a leaking/cached store would collapse these to the
    // SAME object.
    expect(captured[1]).not.toBe(captured[0]);
    expect(captured[1]?.session).not.toBe(captured[0]?.session);
  });
});

describe("REQ-MIS-04.1 — genuine outside-run rejection still throws", () => {
  it("currentContext() called with no run in progress throws AuthoringError{origin:authoring-rejected, reason:outside-run} with the unchanged message", () => {
    let caught: unknown;
    try {
      currentContext();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    const authoringError = caught as AuthoringError;
    expect(authoringError.origin).toEqual("authoring-rejected");
    expect(authoringError.reason).toEqual("outside-run");
    expect(authoringError.message).toEqual(
      "@pbuilder/sdk: authoring verbs can only be used while a schematic is running — " +
        "call them inside your factory function, not at module load time."
    );
  });
});

describe("REQ-MIS-06.1 — requireDistArtifacts fails loud on a missing artifact", () => {
  it("throws naming the missing dist/bin/pbuilder-runner.js path when the directory has no build output", () => {
    const bogusDir = join(import.meta.dir, "does-not-exist-dist-dir");
    expect(() => requireDistArtifacts(bogusDir)).toThrow(
      `requireDistArtifacts: missing build artifact ${join(bogusDir, "bin/pbuilder-runner.js")} — run "bun run build" first`
    );
  });
});

// REQ-MIS-01 (accessor contract, design §4.3 rev 3): resolveRunAls is PURE — every case below
// passes a fake slot value directly, touching globalThis NOT AT ALL. No restore ceremony, no
// suite-order dependence (contrast with the getRunAls()-exercising describes above, which DO
// touch the real frozen slot and are deliberately written to be order-independent instead).
describe("REQ-MIS-01 (accessor contract) — resolveRunAls: occupied-slot fail-loud (S-001.5b)", () => {
  it("a plain object slot value throws a plain Error (NOT AuthoringError) naming the key + offending typeof", () => {
    let caught: unknown;
    try {
      resolveRunAls({});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(AuthoringError);
    expect((caught as Error).message).toEqual(
      `[pbuilder] run-context registry slot Symbol.for("${RUN_ALS_REGISTRY_KEY}") is occupied by an ` +
        "incompatible value (expected an AsyncLocalStorage, got object) — another module may have polluted globalThis"
    );
  });

  it("[triangulation] a string slot value names 'string' as the offending typeof", () => {
    expect(() => resolveRunAls("not-an-als")).toThrow(/got string\)/);
  });

  it("[triangulation] a number slot value names 'number' as the offending typeof", () => {
    expect(() => resolveRunAls(42)).toThrow(/got number\)/);
  });
});

describe("REQ-MIS-01 (accessor contract) — resolveRunAls: valid-reuse and absent-slot (S-001.5c)", () => {
  it("a real ALS slot value is returned verbatim — the SAME instance, not a copy", () => {
    const realAls = new AsyncLocalStorage<unknown>();
    expect(resolveRunAls(realAls) as unknown).toBe(realAls);
  });

  it("[design intent, ADR-01 addendum] a duck-valid but non-real-ALS object is accepted verbatim too — no brand check", () => {
    const duckAls = { run: () => {}, getStore: () => undefined };
    expect(resolveRunAls(duckAls) as unknown).toBe(duckAls);
  });

  it("an absent (undefined) slot value returns a fresh AsyncLocalStorage instance", () => {
    const resolved = resolveRunAls(undefined);
    expect(resolved).toBeInstanceOf(AsyncLocalStorage);
  });

  it("[triangulation] two absent-slot calls return DIFFERENT fresh instances — resolveRunAls itself never memoizes", () => {
    const a = resolveRunAls(undefined);
    const b = resolveRunAls(undefined);
    expect(a).not.toBe(b);
  });
});
