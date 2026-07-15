/**
 * fit-33 (design § 4.7, bridge-version pin — S-005, stdio-engine-client change):
 * `BRIDGE_CONTRACT_VERSION` (`src/transport/wire-protocol.ts`) MUST equal the value declared
 * in the normative wire-spec doc's Bridge Contract (BRB-01) section — co-versioned with, but
 * tracked INDEPENDENTLY of, `WIRE_PROTOCOL_VERSION` (BRB-01 independence).
 *
 * Red-proof: inline planted fixtures (fit-10/fit-29/fit-30/fit-32's established no-fixture-file
 * pattern).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRIDGE_CONTRACT_VERSION, WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const WIRE_SPEC_DOC_PATH = join(PROJECT_ROOT, "docs/engine-sdk-wire-spec.md");

// Deliberately NOT `/m` + a `^`/`$` line-anchor pair: under `/m`, `$` matches before EVERY
// line's newline (not just end-of-string), which truncates the lazy capture at the section
// heading's own first line. `(?:^|\n)` substitutes for a multiline `^`; the bare (non-`/m`)
// `$` correctly means end-of-string (or just before a trailing newline).
function extractBridgeSection(text: string): string | undefined {
  const match = /(?:^|\n)#{1,4}\s.*\(BRB-01\)\s*\n([\s\S]*?)(?=\n#{1,4}\s|$)/.exec(text);
  return match?.[1];
}

function extractDocDeclaredBridgeVersion(text: string): number | undefined {
  const section = extractBridgeSection(text);
  if (section === undefined) return undefined;
  const match = /BRIDGE_CONTRACT_VERSION\s*=\s*(\d+)/.exec(section);
  return match ? Number(match[1]) : undefined;
}

describe("fit-33 — bridge-version pin (BRIDGE_CONTRACT_VERSION against the doc-declared bridge section)", () => {
  it("the wire-spec doc declares a BRIDGE_CONTRACT_VERSION inside its Bridge Contract (BRB-01) section", () => {
    const docValue = extractDocDeclaredBridgeVersion(readFileSync(WIRE_SPEC_DOC_PATH, "utf-8"));
    expect(docValue).toEqual(BRIDGE_CONTRACT_VERSION);
  });

  it("BRIDGE_CONTRACT_VERSION is tracked INDEPENDENTLY of WIRE_PROTOCOL_VERSION (BRB-01 independence)", () => {
    // Not a claim that the two values must differ forever — a claim that this test suite
    // reads them from two DISTINCT exported constants, never one value doing double duty.
    expect(BRIDGE_CONTRACT_VERSION).toEqual(1);
    expect(WIRE_PROTOCOL_VERSION).toEqual(1);
    expect(Object.is(BRIDGE_CONTRACT_VERSION, WIRE_PROTOCOL_VERSION)).toBe(true); // same VALUE today, distinct constants
  });

  it("[red-proof] a doc-declared bridge version that drifts from the SDK export is caught", () => {
    const fixture = "## Bridge Contract (BRB-01)\n\n```ts\nconst BRIDGE_CONTRACT_VERSION = 2;\n```\n";
    expect(extractDocDeclaredBridgeVersion(fixture)).not.toEqual(BRIDGE_CONTRACT_VERSION);
  });

  it("[red-proof] a doc with no Bridge Contract section yields undefined, never a false pass", () => {
    const fixture = "## Frame Grammar (WPS-01)\n\nsome text\n";
    expect(extractDocDeclaredBridgeVersion(fixture)).toBeUndefined();
  });

  it("[red-proof] a bridge-section reference OUTSIDE (WPS-06) is not mistaken for the bridge version", () => {
    const fixture = "## Frame-Cap Constant (WPS-06)\n\n```ts\nconst BRIDGE_CONTRACT_VERSION = 99;\n```\n\n## Bridge Contract (BRB-01)\n\n```ts\nconst BRIDGE_CONTRACT_VERSION = 1;\n```\n";
    expect(extractDocDeclaredBridgeVersion(fixture)).toEqual(1);
  });
});
