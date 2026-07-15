/**
 * fit-34 (design § 4.7, BATCH_CAP drift — S-005, stdio-engine-client change, REQ-FEH-06/
 * REQ-WPS-06): the SDK's exported `BATCH_CAP_BYTES` MUST equal the literal pinned in the
 * normative wire-spec doc's Frame-Cap Constant (WPS-06) section (`4194304`) — a change to
 * either side that breaks the equality fails THIS test at build/test time, never a runtime
 * desync against a live engine (AC-TRACE).
 *
 * Red-proof: inline planted fixtures (fit-10/fit-29/fit-30/fit-32/fit-33's established
 * no-fixture-file pattern).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BATCH_CAP_BYTES } from "../../src/core/wire.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const WIRE_SPEC_DOC_PATH = join(PROJECT_ROOT, "docs/engine-sdk-wire-spec.md");

// Deliberately NOT `/m` + a `^`/`$` line-anchor pair: under `/m`, `$` matches before EVERY
// line's newline (not just end-of-string), which truncates the lazy capture at the section
// heading's own first line. `(?:^|\n)` substitutes for a multiline `^`; the bare (non-`/m`)
// `$` correctly means end-of-string (or just before a trailing newline).
function extractCapSection(text: string): string | undefined {
  const match = /(?:^|\n)#{1,4}\s.*\(WPS-06\)\s*\n([\s\S]*?)(?=\n#{1,4}\s|$)/.exec(text);
  return match?.[1];
}

function extractDocDeclaredCap(text: string): number | undefined {
  const section = extractCapSection(text);
  if (section === undefined) return undefined;
  const match = /BATCH_CAP_BYTES\s*=\s*(\d+)/.exec(section);
  return match ? Number(match[1]) : undefined;
}

describe("fit-34 — BATCH_CAP drift (REQ-FEH-06/REQ-WPS-06: SDK export vs doc-pinned literal)", () => {
  it("REQ-WPS-06.1: the SDK's BATCH_CAP_BYTES is exactly 4194304 (4 MiB)", () => {
    expect(BATCH_CAP_BYTES).toEqual(4194304);
  });

  it("REQ-FEH-06.1: the wire-spec doc's Frame-Cap Constant section pins the SAME literal the SDK exports", () => {
    const docValue = extractDocDeclaredCap(readFileSync(WIRE_SPEC_DOC_PATH, "utf-8"));
    expect(docValue).toEqual(BATCH_CAP_BYTES);
  });

  it("[red-proof] a doc-declared cap that drifts from the SDK export is caught, not silently passed", () => {
    const fixture = "## Frame-Cap Constant (WPS-06)\n\n```ts\nconst BATCH_CAP_BYTES = 4194305;\n```\n";
    expect(extractDocDeclaredCap(fixture)).not.toEqual(BATCH_CAP_BYTES);
  });

  it("[red-proof] a doc with no Frame-Cap Constant section yields undefined, never a false pass", () => {
    const fixture = "## Bridge Contract (BRB-01)\n\nsome text\n";
    expect(extractDocDeclaredCap(fixture)).toBeUndefined();
  });
});
