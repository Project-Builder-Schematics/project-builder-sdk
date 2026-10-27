/**
 * FIT-48: the `project-builder.json` schema ships at the path `builder init` writes (SDK #76).
 *
 * The CLI writes `"$schema": "./node_modules/@pbuilder/sdk/schemas/project-builder.schema.json"`,
 * so that exact package-relative path must be in the publishable tarball, and the file must
 * keep the config's forward-compat invariant: unknown top-level keys and unknown `sdk` keys
 * are preserved by the CLI, so the schema must not reject them.
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ensureTscBuild } from "../support/shared-build.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SCHEMA_PATH = "schemas/project-builder.schema.json";

interface ObjectSchema {
  type?: string;
  properties?: Record<string, ObjectSchema>;
  additionalProperties?: unknown;
  $schema?: string;
}

describe("FIT-48 — project-builder.json schema is published", () => {
  let packed: string[] = [];
  beforeAll(() => {
    ensureTscBuild();
    const result = spawnSync("bun", ["pm", "pack", "--dry-run"], { cwd: PROJECT_ROOT, encoding: "utf-8" });
    if (result.status !== 0) {
      throw new Error(`FIT-48: bun pm pack --dry-run failed.\nstderr: ${result.stderr}`);
    }
    packed = result.stdout
      .split("\n")
      .filter((line) => line.startsWith("packed "))
      .map((line) => line.replace(/^packed\s+\S+\s+/, "").trim());
  });

  it("the tarball contains the schema at the path builder init references", () => {
    expect(packed).toContain(SCHEMA_PATH);
  });

  it("the schema describes every top-level key the CLI reads or writes", () => {
    const schema = JSON.parse(readFileSync(join(PROJECT_ROOT, SCHEMA_PATH), "utf-8")) as ObjectSchema;
    expect(schema.$schema).toBeString();
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      ["$schema", "collections", "dependencies", "sdk", "settings", "skill", "version"].sort()
    );
  });

  it("the schema allows unknown keys at the top level and inside sdk", () => {
    const schema = JSON.parse(readFileSync(join(PROJECT_ROOT, SCHEMA_PATH), "utf-8")) as ObjectSchema;
    expect(schema.additionalProperties).not.toBe(false);
    expect(schema.properties?.sdk?.additionalProperties).not.toBe(false);
  });
});
