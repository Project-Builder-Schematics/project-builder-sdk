import { describe, it, expect } from "bun:test";
import { schemaPathFor, SCHEMA_FILENAME } from "../../../../../../src/bounded-contexts/authoring/domain/services/schema/schema-files.ts";

describe("schemaPathFor", () => {
  it("puts schema.json directly inside the package folder", () => {
    expect(SCHEMA_FILENAME).toEqual("schema.json");
    expect(schemaPathFor("/repo/factories/greeter")).toEqual("/repo/factories/greeter/schema.json");
  });
});
