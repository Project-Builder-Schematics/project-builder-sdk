/**
 * schema-discovery.ts unit coverage — locates the adjacent schema.json (REQ-FPS-01.1,
 * ADR-0031: canonical shape, no path argument/configuration).
 */
import { describe, it, expect } from "bun:test";
import { schemaPathFor } from "../../src/core/schema/schema-discovery.ts";

describe("schemaPathFor", () => {
  it("resolves schema.json adjacent to the given package directory", () => {
    expect(schemaPathFor("/repo/factories/greeter")).toEqual(
      "/repo/factories/greeter/schema.json"
    );
  });
});
