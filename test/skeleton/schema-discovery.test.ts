/**
 * schema-discovery.ts unit coverage — locates the adjacent schema.json (REQ-FPS-01.1,
 * ADR-0031: canonical shape, no path argument/configuration), and (S-004) the reserved-
 * lifecycle-name sibling scan (REQ-RLN-01, ADR-0028: kebab, case-insensitive, dir-form).
 */
import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schemaPathFor, findReservedSibling } from "../../src/core/schema/schema-discovery.ts";

describe("schemaPathFor", () => {
  it("resolves schema.json adjacent to the given package directory", () => {
    expect(schemaPathFor("/repo/factories/greeter")).toEqual(
      "/repo/factories/greeter/schema.json"
    );
  });
});

describe("findReservedSibling", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) {
      try {
        chmodSync(dir, 0o755);
      } catch {
        // best-effort
      }
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it("returns undefined for a clean package (no reserved siblings)", () => {
    dir = mkdtempSync(join(tmpdir(), "reserved-scan-"));
    writeFileSync(join(dir, "factory.ts"), "export {};", "utf-8");

    expect(findReservedSibling(dir)).toBeUndefined();
  });

  it("REQ-RLN-01.1: finds a pre-execute.ts sibling, naming pre-execute", () => {
    dir = mkdtempSync(join(tmpdir(), "reserved-scan-"));
    writeFileSync(join(dir, "pre-execute.ts"), "export {};", "utf-8");

    expect(findReservedSibling(dir)).toEqual("pre-execute");
  });

  it("REQ-RLN-01.3: finds a post-execute.ts sibling independently, naming post-execute", () => {
    dir = mkdtempSync(join(tmpdir(), "reserved-scan-"));
    writeFileSync(join(dir, "post-execute.ts"), "export {};", "utf-8");

    expect(findReservedSibling(dir)).toEqual("post-execute");
  });

  it("dir-form: a pre-execute/ directory sibling is found (ADR-0028)", () => {
    dir = mkdtempSync(join(tmpdir(), "reserved-scan-"));
    mkdirSync(join(dir, "pre-execute"));
    writeFileSync(join(dir, "pre-execute", "index.ts"), "export {};", "utf-8");

    expect(findReservedSibling(dir)).toEqual("pre-execute");
  });

  it("case-insensitive: a PRE-EXECUTE.TS sibling is found (TW-M2)", () => {
    dir = mkdtempSync(join(tmpdir(), "reserved-scan-"));
    writeFileSync(join(dir, "PRE-EXECUTE.TS"), "export {};", "utf-8");

    expect(findReservedSibling(dir)).toEqual("pre-execute");
  });

  it("a schema.json declaring a property named pre-execute does NOT trigger this scan (module structure only, REQ-RLN-01.4)", () => {
    dir = mkdtempSync(join(tmpdir(), "reserved-scan-"));
    writeFileSync(
      join(dir, "schema.json"),
      JSON.stringify({ properties: { "pre-execute": { type: "string", label: "x", required: false } } }),
      "utf-8"
    );

    expect(findReservedSibling(dir)).toBeUndefined();
  });

  it("a non-existent package directory (ENOENT) returns undefined — not a failure", () => {
    expect(findReservedSibling(join(tmpdir(), "reserved-scan-does-not-exist"))).toBeUndefined();
  });

  it("constraint 4: a non-ENOENT unreadable directory fails closed (throws, never silently 'no reserved siblings')", () => {
    if (process.getuid?.() === 0) {
      throw new Error(
        "must run as non-root: chmod-000 fixtures are bypassed by root, invalidating the non-ENOENT fail-closed proof"
      );
    }
    dir = mkdtempSync(join(tmpdir(), "reserved-scan-"));
    chmodSync(dir, 0o000);

    expect(() => findReservedSibling(dir!)).toThrow();
  });
});
