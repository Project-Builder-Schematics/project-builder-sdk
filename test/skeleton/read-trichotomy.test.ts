/**
 * REQ-RD-01.6 — read trichotomy END-TO-END through find(p).read() over a REAL Session
 * and an UNMOCKED ContractFake (no mock/spy on read — the cross-boundary path is the point).
 *
 * The author-facing branch is `if (c === undefined) … else if (c === "") … else …`. Each branch
 * must be reachable and hit by its corresponding fixture: absent → undefined, empty → "",
 * content → the string. NEVER `if (!content)` — that falsy form re-merges undefined/""/"0"/"false".
 */
import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import { ContractFake } from "../support/contract-fake.ts";
import { find } from "../../src/commons/index.ts";

type Branch = "absent" | "empty" | "content";

/** The trichotomy branch under test, expressed exactly as an author would write it. */
function classify(c: string | undefined): Branch {
  if (c === undefined) return "absent";
  else if (c === "") return "empty";
  else return "content";
}

describe("read trichotomy — end-to-end through Session + unmocked fake (REQ-RD-01.6)", () => {
  it("absent branch — find(missing).read() resolves undefined → 'absent'", async () => {
    const fake = new ContractFake({ seed: {} });
    const run = defineFactory<void>(async () => {
      const c = await find("src/missing.ts").read();
      expect(c).toBeUndefined();
      expect(classify(c)).toBe("absent");
    });
    await run(undefined, { client: fake });
  });

  it("empty branch — find(blank).read() resolves \"\" → 'empty'", async () => {
    const fake = new ContractFake({ seed: { "src/blank.ts": "" } });
    const run = defineFactory<void>(async () => {
      const c = await find("src/blank.ts").read();
      expect(c).toBe("");
      expect(classify(c)).toBe("empty");
    });
    await run(undefined, { client: fake });
  });

  it("content branch — find(file).read() resolves its string → 'content'", async () => {
    const fake = new ContractFake({ seed: { "src/a.ts": "export const x = 1;" } });
    const run = defineFactory<void>(async () => {
      const c = await find("src/a.ts").read();
      expect(c).toBe("export const x = 1;");
      expect(classify(c)).toBe("content");
    });
    await run(undefined, { client: fake });
  });

  it("all three branches are reachable across the trichotomy fixtures", async () => {
    const fake = new ContractFake({ seed: { "src/blank.ts": "", "src/a.ts": "body" } });
    const hits = new Set<Branch>();
    const run = defineFactory<void>(async () => {
      hits.add(classify(await find("src/missing.ts").read()));
      hits.add(classify(await find("src/blank.ts").read()));
      hits.add(classify(await find("src/a.ts").read()));
    });
    await run(undefined, { client: fake });
    expect(hits).toEqual(new Set<Branch>(["absent", "empty", "content"]));
  });
});
