/**
 * error-attribution-skeleton REQ-17.1 — the one full end-to-end rejection journey: a
 * `defineFactory` schematic → the runner → a real `ContractFake` → a rejection carrying
 * full structured metadata → the author's OWN catch block reading every public field and
 * `switch`ing on `reason` to reach a distinct branch. No mock anywhere in this path.
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { AuthoringError, create } from "../../src/commons/index.ts";
import type { AuthoringReason } from "../../src/commons/index.ts";

describe("e2e — author reads a fully-attributed error and branches on it (REQ-17.1)", () => {
  it("a collision after two successful directives is caught, fully read, and switched on", async () => {
    const fake = new ContractFake({ seed: { "c.ts": "existing" } });

    const run = defineFactory<void>(() => {
      create("a.ts", { template: "A", options: {} });
      create("b.ts", { template: "B", options: {} });
      create("c.ts", { template: "collides", options: {} }); // rejects at index 2
    });

    let caught: unknown;
    try {
      await run(undefined, { client: fake });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    const err = caught as AuthoringError;
    expect(err.reason).toEqual("path-collision");
    expect(err.origin).toEqual("write-rejected");
    expect(err.verb).toEqual("create");
    expect(err.path).toEqual("c.ts");
    expect(err.appliedCount).toEqual(2);

    // The closed enum is USABLE, not merely readable: the author's own switch must
    // demonstrably reach the "path-collision" arm — not a default/fallthrough.
    let branchTaken: AuthoringReason | "default" = "default";
    switch (err.reason) {
      case "path-collision":
        branchTaken = "path-collision";
        break;
      case "path-not-found":
      case "unrepresentable-content":
      case "changes-too-large":
      case "outside-run":
      case "unknown":
        branchTaken = "default";
        break;
    }
    expect(branchTaken).toEqual("path-collision");
  });
});
