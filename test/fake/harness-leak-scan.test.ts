/**
 * REQ-ATH-12 (S-002): the no-engine-text leak scan (REQ-AEC-05, FIT-11) extended to cover
 * `result.error`'s object graph — same structurally-derived dictionary
 * (`rejection-messages.ts` values), scoped to ENGINE-INTERNAL fragments only. Author-provided
 * content (seed values, options, tree paths/content) echoing back through `result.error` is
 * expected and is NOT a leak (SEC-m2). Independently falsifiable from REQ-ATH-11 (in-memory-
 * only) — the two are separate tests.
 *
 * `scanForLeaks` here is an intentional near-duplicate of
 * `test/fitness/fit-11-whole-object-leak-scan.test.ts`'s traversal (same technique: own
 * enumerable + non-enumerable properties via `Object.getOwnPropertyNames`, bounded `.cause`
 * depth + cycle guard) — kept local rather than extracted into a shared module, mirroring the
 * S-001 precedent (documented near-duplicate over widening a neighbour file outside this
 * slice's scope). FIT-11 scans raw `AuthoringError`/`EmitRejection` values built directly;
 * this file scans `result.error` as OBSERVED THROUGH the harness's public entry, proving the
 * facade's own wrapping introduces no new leak.
 */
import { describe, it, expect } from "bun:test";
import { runFactoryForTest } from "../../src/testing/index.ts";
import { create, find, AuthoringError } from "../../src/commons/index.ts";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";
import type { JsonValue } from "../../src/core/wire.ts";
import * as rejectionMessages from "../../src/testing/rejection-messages.ts";

const LEAK_DICTIONARY: readonly string[] = Object.values(rejectionMessages).filter(
  (value) => typeof value === "string"
);

const MAX_CAUSE_DEPTH = 20;

/**
 * Recursively scans a value's own properties — enumerable AND non-enumerable, via
 * `Object.getOwnPropertyNames` — plus its `.cause` chain (bounded depth + an
 * object-identity cycle guard) for any dictionary fragment appearing inside a string value.
 */
function scanForLeaks(value: unknown, dictionary: readonly string[]): string[] {
  const violations: string[] = [];
  const visited = new Set<unknown>();
  let current: unknown = value;
  let depth = 0;

  while (
    current !== null &&
    (typeof current === "object" || typeof current === "function") &&
    !visited.has(current) &&
    depth <= MAX_CAUSE_DEPTH
  ) {
    visited.add(current);

    for (const key of Object.getOwnPropertyNames(current)) {
      if (key === "cause") continue; // walked separately below, with its own depth/cycle guard
      const propValue = (current as Record<string, unknown>)[key];
      if (typeof propValue !== "string") continue;
      for (const fragment of dictionary) {
        if (propValue.includes(fragment)) {
          violations.push(`property "${key}" leaks fragment "${fragment}"`);
        }
      }
    }

    current = (current as { cause?: unknown }).cause;
    depth++;
  }

  return violations;
}

describe("REQ-ATH-12 — dictionary derivation sanity", () => {
  it("the structurally-derived dictionary is non-empty (an empty dictionary would false-green every scan)", () => {
    expect(LEAK_DICTIONARY.length).toBeGreaterThan(0);
  });
});

describe("REQ-ATH-12 — scan mechanism red-proof", () => {
  it("[permanent-fixture][red-proof] a planted dictionary fragment on a non-enumerable own property is caught", () => {
    const err = new Error("clean message");
    Object.defineProperty(err, "diagnosticDetail", {
      value: `planted: ${LEAK_DICTIONARY[0]}`,
      enumerable: false,
      configurable: true,
    });

    expect(Object.keys(err)).not.toContain("diagnosticDetail");
    expect(scanForLeaks(err, LEAK_DICTIONARY).length).toBeGreaterThan(0);
  });
});

describe("REQ-ATH-12.1 — harness result carries no leaked fragment", () => {
  it("collision rejection (REQ-ATH-03) leaks nothing", async () => {
    const run = (): void => {
      create("a.ts", { template: "new", options: {} });
    };
    const result = await runFactoryForTest(run, undefined, { seed: { "a.ts": "old" } });

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect(scanForLeaks(result.error, LEAK_DICTIONARY)).toEqual([]);
  });

  it("factory throw (REQ-ATH-06) leaks nothing", async () => {
    const thrown = new Error("boom");
    const run = (): void => {
      throw thrown;
    };
    const result = await runFactoryForTest(run, undefined);

    expect(result.error).toBe(thrown);
    expect(scanForLeaks(result.error, LEAK_DICTIONARY)).toEqual([]);
  });

  it("batch-cap rejection (REQ-ATH-09) leaks nothing", async () => {
    const overTemplate = "a".repeat(BATCH_CAP_BYTES + 1);
    const run = (): void => {
      create("cap.ts", { template: overTemplate, options: {} });
    };
    const result = await runFactoryForTest(run, undefined);

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("changes-too-large");
    expect(scanForLeaks(result.error, LEAK_DICTIONARY)).toEqual([]);
  });

  it("unrepresentable-content rejection (REQ-ATH-09.1) leaks nothing", async () => {
    const run = (): void => {
      create("bad.ts", { template: "x", options: { fn: () => {} } as unknown as JsonValue });
    };
    const result = await runFactoryForTest(run, undefined);

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).reason).toEqual("unrepresentable-content");
    expect(scanForLeaks(result.error, LEAK_DICTIONARY)).toEqual([]);
  });
});

describe("REQ-ATH-12.2 — author-provided content is not mistaken for a leak", () => {
  it("an author-chosen colliding path echoed in the message is not flagged", async () => {
    const authorPath = "author-owned-path-marker.ts";
    expect(LEAK_DICTIONARY.some((fragment) => authorPath.includes(fragment))).toBe(false);

    const run = (): void => {
      create(authorPath, { template: "new", options: {} });
    };
    const result = await runFactoryForTest(run, undefined, { seed: { [authorPath]: "old" } });

    expect(result.error).toBeInstanceOf(AuthoringError);
    expect((result.error as AuthoringError).message).toContain(authorPath);
    expect(scanForLeaks(result.error, LEAK_DICTIONARY)).toEqual([]);
  });

  it("author-supplied seed content containing an unrelated substring is not flagged, even alongside an unrelated rejection", async () => {
    const authorMarker = "totally-author-owned-marker-xyz";
    expect(LEAK_DICTIONARY.some((fragment) => authorMarker.includes(fragment) || fragment.includes(authorMarker))).toBe(
      false
    );

    // The seed is read by the factory (author-supplied content genuinely flowing through
    // the harness) alongside an unrelated ATH-03 collision that produces `result.error` —
    // scoping this scenario's scan to `result.error` per REQ-ATH-12's own stated scope
    // (the "report string" surface it also mentions does not exist, TW-m2).
    let seededContent: string | undefined;
    const run = async (): Promise<void> => {
      seededContent = await find("seeded.ts").read();
      create("colliding.ts", { template: "new", options: {} });
    };
    const result = await runFactoryForTest(run, undefined, {
      seed: { "seeded.ts": authorMarker, "colliding.ts": "old" },
    });

    expect(seededContent).toEqual(authorMarker);
    expect(result.error).toBeInstanceOf(AuthoringError);
    expect(scanForLeaks(result.error, LEAK_DICTIONARY)).toEqual([]);
    // Direct proof (independent of internal wiring): scanning the author marker itself,
    // as a bare value, is not flagged — only dictionary fragments are.
    expect(scanForLeaks(new Error(authorMarker), LEAK_DICTIONARY)).toEqual([]);
  });
});
