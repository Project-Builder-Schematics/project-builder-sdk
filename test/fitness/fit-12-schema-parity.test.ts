/**
 * FIT-12: schema<->type parity / drift gate (REQ-SCP-01). A CONTENT-DIGEST comparison, not
 * a compiled-output text diff (QA-B1): the bin embeds a `// @schema-digest sha256:<...>`
 * line into `schema.generated.ts` at generation time; this check recomputes the adjacent
 * `schema.json`'s digest and compares it against the embedded one — ANY difference fails,
 * independent of whether the change is TypeScript-visible (catches label-only drift that a
 * compiled-output diff cannot, REQ-SCP-01.3). Read-only: never writes to a package dir it
 * checks, so "regenerating restores green" and "non-destructive" both hold trivially.
 *
 * Always-on walk covers ONLY `ALWAYS_ON_SCAN_ROOTS` (design §4.6a) — the reference
 * schematic. Deliberately-red fixtures live under `test/fixtures/red/**`, never walked;
 * their red-proofs call `checkParity` directly (constraint 9).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeSchemaDigest } from "../../src/core/schema/schema-digest.ts";
import { generateSchema } from "../../bin/pbuilder-codegen.ts";
import { ALWAYS_ON_SCAN_ROOTS } from "../support/scan-roots.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const STALED_DIGEST_FIXTURE = join(PROJECT_ROOT, "test/fixtures/red/schema/staled-digest");
const LABEL_ONLY_DRIFT_FIXTURE = join(PROJECT_ROOT, "test/fixtures/red/schema/label-only-drift");

const SCHEMA_DIGEST_RE = /@schema-digest sha256:([0-9a-f]+)/;

function extractEmbeddedDigest(generatedTs: string): string | undefined {
  return SCHEMA_DIGEST_RE.exec(generatedTs)?.[1];
}

interface ParityResult {
  ok: boolean;
  reason?: string;
}

// The check itself: read-only, never regenerates or mutates the package it checks
// (REQ-SCP-01.4) — a pure digest comparison is trivially non-destructive.
function checkParity(packageDir: string): ParityResult {
  const schemaRaw = readFileSync(join(packageDir, "schema.json"), "utf-8");
  const generatedTs = readFileSync(join(packageDir, "schema.generated.ts"), "utf-8");
  const embedded = extractEmbeddedDigest(generatedTs);
  const actual = computeSchemaDigest(schemaRaw);

  if (embedded === undefined) {
    return { ok: false, reason: `${packageDir}: schema.generated.ts has no embedded @schema-digest line` };
  }
  if (embedded !== actual) {
    return {
      ok: false,
      reason: `${packageDir}: schema.generated.ts is stale relative to schema.json (embedded ${embedded}, current ${actual})`,
    };
  }
  return { ok: true };
}

describe("FIT-12 — schema<->type parity (always-on walk over ALWAYS_ON_SCAN_ROOTS)", () => {
  for (const root of ALWAYS_ON_SCAN_ROOTS) {
    it(`${root}: committed schema.generated.ts matches its schema.json (green)`, () => {
      const result = checkParity(join(PROJECT_ROOT, root));
      expect(result).toEqual({ ok: true });
    });
  }
});

describe("FIT-12 — red-proofs (direct check-function call against test/fixtures/red/**, never walked)", () => {
  it("REQ-SCP-01.1: a staled digest FAILS, naming the package", () => {
    const result = checkParity(STALED_DIGEST_FIXTURE);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain(STALED_DIGEST_FIXTURE);
  });

  it("REQ-SCP-01.3: a label-only schema.json edit (no TS-visible type-shape change) still FAILS", () => {
    const result = checkParity(LABEL_ONLY_DRIFT_FIXTURE);

    expect(result.ok).toBe(false);
  });

  it("REQ-SCP-01.2: regenerating (in a scratch copy — the permanent red fixture stays red) restores green", () => {
    const scratch = mkdtempSync(join(tmpdir(), "fit-12-regen-"));
    try {
      const schemaRaw = readFileSync(join(STALED_DIGEST_FIXTURE, "schema.json"), "utf-8");
      writeFileSync(join(scratch, "schema.json"), schemaRaw, "utf-8");

      generateSchema(scratch);

      expect(checkParity(scratch)).toEqual({ ok: true });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("REQ-SCP-01.4: the check never mutates the committed generated file it verifies", () => {
    const before = readFileSync(join(STALED_DIGEST_FIXTURE, "schema.generated.ts"), "utf-8");

    checkParity(STALED_DIGEST_FIXTURE);

    const after = readFileSync(join(STALED_DIGEST_FIXTURE, "schema.generated.ts"), "utf-8");
    expect(after).toEqual(before);
  });
});
