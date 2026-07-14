/**
 * S-000 — REQ-TSD-04.2: a real ts-morph print failure is contained the same way as a real
 * parse failure (REQ-TSD-04.1) or a `.modify()` throw (REQ-DG-05). `sf.forget()` forces
 * `SourceFile#getFullText()` to throw against the REAL ts-morph printer (no mock) — this is
 * the mechanism the design selects to drive a live AST into a print-throwing state.
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { golden } from "../../support/golden.ts";

describe("TypeScript dialect — REQ-TSD-04.2 print failure containment", () => {
  it("a real ts-morph print failure (forgotten SourceFile) is contained with the pinned could-not-print tail", async () => {
    const { client } = makeSpyClient({ "a.ts": golden("add-import-before.txt") });

    const run = defineFactory<void>(async () => {
      await ts.find("a.ts").modify((sf) => {
        sf.forget();
      });
    });

    let caught: unknown;
    try {
      await run(undefined, { client });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error;
    expect(err.message).toBe('dialect operation failed: could not print "a.ts"');
    // Strongest proof of the no-leak guarantee: `.cause` is absent even though the
    // underlying error is a REAL ts-morph error, not a mock.
    expect(err.cause).toBeUndefined();
  });
});
