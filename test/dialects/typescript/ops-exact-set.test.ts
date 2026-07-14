/**
 * S-003 — REQ-TSD-01.1 (V5): the dialect's shipped op-pack is EXACTLY the sorted five-op
 * allow-list. `toEqual`, never `toContain`/subset — an extra op fails RED (anti-smuggle) and
 * a missing op fails RED (honest cut-lever tracking, slices.md S-003 Cuttable clause).
 *
 * Mechanism: diffs the handle's own enumerable keys against the base surface every dialect
 * handle carries regardless of op-pack — the same mechanism the retired REQ-TSD-01.1 V4 test
 * used (test/dialects/typescript/dialect.test.ts, commit bc073d2) — rather than requiring a
 * new `dialect.ops` export the design's File Changes row for index.ts does not call for.
 *
 * [cut-lever coupling] — if REQ-TSD-10/11 are cut, this array is EDITED (not deleted) to the
 * reduced three-op set `["addFunction", "addImport", "removeImport"]` in the SAME commit as
 * the cut (spec REQ-TSD-01.1's own cut-lever coupling note).
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../../src/dialects/typescript/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";

const BASE_HANDLE_KEYS = new Set([
  "read",
  "raw",
  "modify",
  "replaceContent",
  "rename",
  "move",
  "copy",
  "remove",
  "then",
]);

describe("REQ-TSD-01.1 — exact shipped op-set", () => {
  it("sorted Object.keys of the dialect's op-pack surface EQUALS the exact five-op allow-list", async () => {
    const { client } = makeSpyClient({ "a.ts": "" });

    let opKeys: string[] = [];
    const run = defineFactory<void>(async () => {
      const handle = ts.find("a.ts");
      opKeys = Object.keys(handle)
        .filter((k) => !BASE_HANDLE_KEYS.has(k))
        .sort();
    });
    await run(undefined, { client });

    expect(opKeys).toEqual(["addClass", "addFunction", "addImport", "addVariable", "removeImport"]);
  });
});
