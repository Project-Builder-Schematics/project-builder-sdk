/**
 * REQ-RD-01/02/03 — read trichotomy at the CONTRACT level (the fake, driven directly).
 * No Session / commons / context — this asserts the EngineClient.read seam behaviour:
 *   content → the exact string · not-found → undefined (no throw) · empty → "".
 *
 * Strict assertions only: `=== "<literal>"`, `toBeUndefined()`, `=== ""`. NEVER toBeFalsy/toBeTruthy
 * — the falsy-but-present trio ("   \n", "0", "false") is the load-bearing mutant-killer: a
 * `content || undefined` mutant would coalesce them to undefined and these cases would catch it.
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";

describe("read trichotomy — contract level (fake driven directly)", () => {
  // REQ-RD-01.1
  it("REQ-RD-01.1 — existing file returns its exact content", async () => {
    const fake = new ContractFake({ seed: { "src/a.ts": "export const x = 1;" } });
    const result = await fake.read("src/a.ts");
    expect(result).toBe("export const x = 1;");
  });

  // REQ-RD-01.2 + REQ-RD-02.1 — not-found is undefined, strictly, with NO throw
  it("REQ-RD-01.2 / RD-02.1 — not-found returns undefined and does not throw", async () => {
    const fake = new ContractFake({ seed: {} });
    let result: string | undefined;
    let threw = false;
    try {
      result = await fake.read("src/missing.ts");
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result).toBeUndefined();
  });

  // REQ-RD-02.1 — the #deleted path (deleted via op) also resolves undefined, no throw
  it("REQ-RD-02.1 — a deleted path resolves undefined (not a throw)", async () => {
    const fake = new ContractFake({ seed: { "src/gone.ts": "old" } });
    await fake.emit({
      protocolVersion: 1,
      force: false,
      instructions: [{ op: "delete", delete: { path: "src/gone.ts" } }],
    });
    let result: string | undefined;
    let threw = false;
    try {
      result = await fake.read("src/gone.ts");
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result).toBeUndefined();
  });

  // REQ-RD-01.3 — empty file is "" AND distinct from not-found
  it("REQ-RD-01.3 — empty file returns \"\", distinct from undefined", async () => {
    const fake = new ContractFake({ seed: { "src/blank.ts": "" } });
    const result = await fake.read("src/blank.ts");
    expect(result).toBe("");
    expect(result).not.toBeUndefined();
  });

  // REQ-RD-01.4 — whitespace-only content preserved verbatim
  it("REQ-RD-01.4 — whitespace-only content is preserved verbatim (not trimmed)", async () => {
    const fake = new ContractFake({ seed: { "src/w.ts": "   \n" } });
    const result = await fake.read("src/w.ts");
    expect(result).toBe("   \n");
    expect(result).not.toBe("");
    expect(result).not.toBeUndefined();
  });

  // REQ-RD-01.5 — falsy-string content preserved verbatim (kills the truthiness-collapse mutant)
  it("REQ-RD-01.5 — falsy-string content \"0\" / \"false\" preserved verbatim", async () => {
    const fake = new ContractFake({ seed: { "src/z.ts": "0", "src/f.ts": "false" } });
    const zero = await fake.read("src/z.ts");
    const fls = await fake.read("src/f.ts");
    expect(zero).toBe("0");
    expect(fls).toBe("false");
    expect(zero).not.toBeUndefined();
    expect(fls).not.toBeUndefined();
  });

  // REQ-RD-03.2 — absence by KEY MEMBERSHIP: seeded "" → "" vs absent → undefined
  it("REQ-RD-03.2 — fake models absence by membership: seeded \"\" → \"\", absent → undefined", async () => {
    const fake = new ContractFake({ seed: { "src/e.ts": "" } });
    const seededEmpty = await fake.read("src/e.ts");
    const absent = await fake.read("src/x.ts");
    expect(seededEmpty).toBe("");
    expect(absent).toBeUndefined();
  });
});
