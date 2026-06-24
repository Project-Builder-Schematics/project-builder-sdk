/**
 * FAKE-01/02/03 (minimal for S-000): ContractFake eager apply, Tree-first read,
 * flush-before-read round-trip.
 */
import { describe, it, expect } from "bun:test";
import { ContractFake } from "../support/contract-fake.ts";

describe("ContractFake (S-000 minimal)", () => {
  describe("FAKE-01 — eager apply in array order", () => {
    it("applies create before any read", async () => {
      const fake = new ContractFake({ seed: {} });
      await fake.emit({
        protocolVersion: 1,
        force: false,
        instructions: [{ op: "create", create: { pathTemplate: "a.ts", template: "content-A", options: {} } }],
      });

      const result = await fake.read("a.ts");
      expect(result).toEqual("content-A");
    });
  });

  describe("FAKE-02 — Tree-first read + served-from tag", () => {
    it("returns staged content when path was written (served:tree)", async () => {
      const fake = new ContractFake({ seed: { "a.ts": "seed-content" } });
      // force:true on the op — required by FAKE-04 (fail-closed) when the path already exists.
      await fake.emit({
        protocolVersion: 1,
        force: false,
        instructions: [{ op: "create", create: { pathTemplate: "a.ts", template: "staged-content", options: {}, force: true } }],
      });

      const result = await fake.read("a.ts");
      expect(result).toEqual("staged-content");
      expect(fake.lastServed).toEqual("tree");
    });

    it("returns seed content for untouched paths (served:disk)", async () => {
      const fake = new ContractFake({ seed: { "b.ts": "disk-content" } });

      const result = await fake.read("b.ts");
      expect(result).toEqual("disk-content");
      expect(fake.lastServed).toEqual("disk");
    });

    // ADR-01: not-found resolves undefined (not a throw) — absence is by key membership.
    it("returns undefined when path is not in tree or seed", async () => {
      const fake = new ContractFake({ seed: {} });
      expect(await fake.read("missing.ts")).toBeUndefined();
    });
  });

  describe("FAKE-03 — flush-before-read round-trip", () => {
    it("reads staged content after emit (no SDK shadow)", async () => {
      const fake = new ContractFake({ seed: {} });
      const path = "src/greeting.ts";
      const content = "export const greet = () => 'hi';";

      await fake.emit({
        protocolVersion: 1,
        force: false,
        instructions: [{ op: "create", create: { pathTemplate: path, template: content, options: {} } }],
      });

      expect(await fake.read(path)).toEqual(content);
    });
  });
});
