/**
 * S-002 — REQ-RXD-01.1 (full): the React dialect's shipped op-pack is EXACTLY the sorted
 * two-op allow-list. `toEqual`, never `toContain`/subset — a third op sneaking in fails RED
 * (anti-smuggle), and a missing op fails RED (honest coverage tracking).
 *
 * Mechanism mirrors `test/dialects/typescript/ops-exact-set.test.ts`: diff the handle's own
 * enumerable keys against `RESERVED_HANDLE_NAMES` (the base surface every dialect handle
 * carries regardless of op-pack, `src/core/define-dialect.ts`) — no new `dialect.ops` export
 * needed.
 */
import { describe, it, expect } from "bun:test";
import * as react from "../../../src/dialects/react/index.ts";
import { makeSpyClient } from "../../support/spy-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { RESERVED_HANDLE_NAMES } from "../../../src/core/define-dialect.ts";

const BASE_HANDLE_KEYS: ReadonlySet<string> = new Set(RESERVED_HANDLE_NAMES);

describe("REQ-RXD-01.1 — exact shipped op-set", () => {
  it("sorted Object.keys of the React dialect's op-pack surface EQUALS the exact two-op allow-list", async () => {
    const { client } = makeSpyClient({ "a.tsx": "" });

    let opKeys: string[] = [];
    const run = defineFactory<void>(async () => {
      const handle = react.find("a.tsx");
      opKeys = Object.keys(handle)
        .filter((k) => !BASE_HANDLE_KEYS.has(k))
        .sort();
    });
    await run(undefined, { client });

    expect(opKeys).toEqual(["addImport", "setJsxProp"]);
  });
});
