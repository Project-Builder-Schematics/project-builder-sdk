/**
 * fit-31 (design § 4.7 — S-005, stdio-engine-client change). Scope note (executor ruling,
 * `slices.md` Executor Context, plan-verify iteration 2 numbering resolution): the
 * AUTHORITATIVE scope of fit-31 is the REQ-WPS-11 doc-scan leg (superseded-term scan + header
 * stamp + WPS-11.3 section-presence), plus the single-owner-of-framing ENCODE-side code check
 * design.md's own bullet names (`framing.ts`'s header comment already references "fit-31
 * (single-owner-of-framing)"). This file does NOT scan for `readUInt32BE` (the raw length-
 * prefix READ): `frame-reader.ts` legitimately reads the declared length itself as part of
 * streaming reassembly (its own header comment documents delegating body-decode + the cap
 * check to `framing.ts`, never the byte-count read) — scanning reads too would either be
 * vacuous or falsely flag that pre-existing, already-audited S-000 code. The scan below is
 * scoped to frame ENCODING (`writeUInt32BE`, the construction half of the codec), which
 * `framing.ts`'s `encodeFrame` is genuinely the sole owner of.
 *
 * Also carries REQ-LED-01's "fit-31-style ledger-presence scan" (spec.md's own attribution) —
 * bundled here rather than as a 7th numbered check, since slices.md's Executor Context ruling
 * fixes the new-check count at exactly six (fit-30..35).
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectTsFiles } from "../support/import-scan.ts";
import { WIRE_PROTOCOL_VERSION } from "../../src/transport/wire-protocol.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const TRANSPORT_DIR = join(PROJECT_ROOT, "src/transport");
const FRAMING_FILE = join(TRANSPORT_DIR, "framing.ts");
const DESIGN_DOC_PATH = join(PROJECT_ROOT, "docs/engine-sdk-wire-design.md");
const WIRE_SPEC_DOC_PATH = join(PROJECT_ROOT, "docs/engine-sdk-wire-spec.md");
const PENDING_CHANGES_PATH = join(PROJECT_ROOT, "openspec/pending-changes.md");

const DESIGN_DOC_TEXT = readFileSync(DESIGN_DOC_PATH, "utf-8");
const PENDING_CHANGES_TEXT = readFileSync(PENDING_CHANGES_PATH, "utf-8");

// ---------------------------------------------------------------------------------------
// single-owner-of-framing (design § 4.7): only framing.ts constructs a frame's length prefix.
// ---------------------------------------------------------------------------------------

function frameEncodeViolations(source: string, absPath: string): string[] {
  if (absPath === FRAMING_FILE) return [];
  if (/\.writeUInt32BE\(/.test(source)) {
    return [`re-implements frame length-prefix ENCODING outside framing.ts: ${absPath.replace(PROJECT_ROOT, "")}`];
  }
  return [];
}

// ---------------------------------------------------------------------------------------
// REQ-WPS-11.1: zero live references to the superseded design outside a section headed
// "superseded"/"historical".
// ---------------------------------------------------------------------------------------

const SUPERSEDED_TERMS: readonly RegExp[] = [/NDJSON/, /single-initiator/, /session\.init/];

function supersededTermViolations(text: string): string[] {
  const lines = text.split("\n");
  const headingStack: { level: number; superseded: boolean }[] = [];
  const violations: string[] = [];
  for (const line of lines) {
    const heading = /^(#+)\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      while (headingStack.length > 0 && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, superseded: /superseded|historical/i.test(heading[2]!) });
      continue;
    }
    if (headingStack.some((h) => h.superseded)) continue;
    for (const term of SUPERSEDED_TERMS) {
      if (term.test(line)) {
        violations.push(`live reference outside a superseded/historical section (${term.source}): "${line.trim()}"`);
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------------------
// REQ-WPS-11.2: the design doc's header stamps a wire-spec version identifier.
// ---------------------------------------------------------------------------------------

function extractHeaderStamp(text: string): number | undefined {
  const firstHeadingIndex = text.indexOf("\n## ");
  const header = firstHeadingIndex === -1 ? text : text.slice(0, firstHeadingIndex);
  const match = /wire-spec version\**:\s*(\d+)/i.exec(header);
  return match ? Number(match[1]) : undefined;
}

// ---------------------------------------------------------------------------------------
// REQ-WPS-11.3: the normative wire-spec doc carries every mandated section.
// ---------------------------------------------------------------------------------------

const MANDATED_SECTIONS: readonly { label: string; pattern: RegExp }[] = [
  { label: "frame grammar (WPS-01)", pattern: /^#{1,4}\s.*\(WPS-01\)/m },
  { label: "ready handshake + protocolVersion (WPS-02)", pattern: /^#{1,4}\s.*\(WPS-02\)/m },
  { label: "reverse-callback method schemas (WPS-05/WPS-10)", pattern: /^#{1,4}\s.*\(WPS-05,\s*WPS-10\)/m },
  { label: "error shapes (WPS-08)", pattern: /^#{1,4}\s*Error Shapes.*\(WPS-08\)/m },
  { label: "factory-pointer grammar (WPS-08)", pattern: /^#{1,4}\s*Factory-Pointer Grammar.*\(WPS-08\)/m },
  { label: "exit-code taxonomy (EXC-01)", pattern: /^#{1,4}\s.*\(EXC-01\)/m },
  { label: "bridge contract naming BRIDGE_CONTRACT_VERSION (BRB-01)", pattern: /^#{1,4}\s.*\(BRB-01\)/m },
  { label: "cap constant contract BATCH_CAP_BYTES (WPS-06)", pattern: /^#{1,4}\s.*\(WPS-06\)/m },
];

function missingMandatedSections(text: string): string[] {
  return MANDATED_SECTIONS.filter(({ pattern }) => !pattern.test(text)).map(({ label }) => label);
}

// ---------------------------------------------------------------------------------------
// REQ-LED-01 ("fit-31-style ledger-presence scan", spec.md's own attribution): the pending-
// changes ledger names the cross-repo tether + Windows/macOS-pins rows, and the closed
// StdioEngineClient row carries a supersession note naming all three superseded decisions.
// ---------------------------------------------------------------------------------------

function ledgerTetherViolations(text: string): string[] {
  const violations: string[] = [];
  const tetherLine = text
    .split("\n")
    .find((line) => /PC-PROTO-01/.test(line) && /MUST build against/i.test(line) && /rev.?3/i.test(line) && /wire-spec/i.test(line));
  if (tetherLine === undefined) {
    violations.push("no cross-repo tether row naming 'engine PC-PROTO-01 MUST build against rev-3 + wire-spec v{N}'");
  }
  const windowsMacosLine = text.split("\n").find((line) => /Windows/.test(line) && /macOS/.test(line) && /(pins|deferred)/i.test(line));
  if (windowsMacosLine === undefined) {
    violations.push("no deferred Windows/macOS-pins row");
  }
  return violations;
}

// Table rows in this ledger are single (very long) lines — scanning per-LINE for a row that
// names BOTH the row's subject and its closure marker avoids matching an unrelated line that
// merely mentions "StdioEngineClient" in passing (e.g. a cross-reference in a DIFFERENT row).
function ledgerSupersessionViolations(text: string): string[] {
  const violations: string[] = [];
  const closedLine = text.split("\n").find((line) => line.includes("StdioEngineClient") && /CLOSED/.test(line));
  if (closedLine === undefined) {
    violations.push("no CLOSED StdioEngineClient row found");
    return violations;
  }
  if (!/NDJSON/.test(closedLine)) violations.push("closed row's supersession note omits NDJSON");
  if (!/session\.init/.test(closedLine)) violations.push("closed row's supersession note omits session.init");
  if (!/(argv|bridge)/i.test(closedLine)) violations.push("closed row's supersession note omits the argv/bridge bootstrap mechanism");
  return violations;
}

describe("fit-31 — single-owner-of-framing (encode) + REQ-WPS-11 doc reconciliation + REQ-LED-01 ledger scan", () => {
  describe("single-owner-of-framing — only framing.ts constructs a length-prefix frame", () => {
    it("the walk reaches the real transport modules (non-vacuous)", () => {
      const files = collectTsFiles(TRANSPORT_DIR);
      expect(files).toContain(FRAMING_FILE);
      expect(files).toContain(join(TRANSPORT_DIR, "frame-reader.ts"));
    });

    for (const file of collectTsFiles(TRANSPORT_DIR)) {
      it(`${file.replace(PROJECT_ROOT, "")} holds no re-implemented frame-encode length prefix`, () => {
        expect(frameEncodeViolations(readFileSync(file, "utf-8"), file)).toEqual([]);
      });
    }

    it("[red-proof] a planted writeUInt32BE outside framing.ts is flagged", () => {
      const fixture = `export function sneaky(b: Buffer, n: number) { b.writeUInt32BE(n, 0); }`;
      expect(frameEncodeViolations(fixture, join(TRANSPORT_DIR, "sneaky-codec.ts")).length).toBeGreaterThan(0);
    });

    it("[red-proof] frame-reader.ts's legitimate readUInt32BE length-prefix peek is NOT flagged", () => {
      const source = readFileSync(join(TRANSPORT_DIR, "frame-reader.ts"), "utf-8");
      expect(source).toContain("readUInt32BE");
      expect(frameEncodeViolations(source, join(TRANSPORT_DIR, "frame-reader.ts"))).toEqual([]);
    });
  });

  describe("REQ-WPS-11.1 — zero live references to the superseded design outside a superseded section", () => {
    it("docs/engine-sdk-wire-design.md holds no live NDJSON/single-initiator/session.init reference outside its Superseded section", () => {
      expect(supersededTermViolations(DESIGN_DOC_TEXT)).toEqual([]);
    });

    it("[red-proof] a live reference OUTSIDE a superseded section is caught", () => {
      const fixture = "# Doc\n\n## Current\n\nWe use NDJSON here.\n";
      expect(supersededTermViolations(fixture).length).toBeGreaterThan(0);
    });

    it("[red-proof] the SAME reference INSIDE a section headed Superseded (historical) is not flagged", () => {
      const fixture = "# Doc\n\n## Superseded (historical)\n\nWe used to use NDJSON here.\n";
      expect(supersededTermViolations(fixture)).toEqual([]);
    });

    it("[red-proof] a reference nested under a sub-heading of a superseded section stays exempt", () => {
      const fixture = "# Doc\n\n## Superseded (historical)\n\n### Rejected alternatives\n\nsession.init was considered.\n";
      expect(supersededTermViolations(fixture)).toEqual([]);
    });
  });

  describe("REQ-WPS-11.2 — header stamps the wire-spec version target", () => {
    it("docs/engine-sdk-wire-design.md's header stamps a version matching WIRE_PROTOCOL_VERSION", () => {
      expect(extractHeaderStamp(DESIGN_DOC_TEXT)).toEqual(WIRE_PROTOCOL_VERSION);
    });

    it("[red-proof] a header with no stamp is caught", () => {
      expect(extractHeaderStamp("# Doc\n\nNo stamp here.\n\n## Section\n")).toBeUndefined();
    });
  });

  describe("REQ-WPS-11.3 — the normative wire-spec doc carries every mandated section", () => {
    it("docs/engine-sdk-wire-spec.md is missing zero mandated sections", () => {
      expect(missingMandatedSections(readFileSync(WIRE_SPEC_DOC_PATH, "utf-8"))).toEqual([]);
    });

    it("[red-proof] a doc missing one mandated section is caught", () => {
      const fixture = "# Doc\n\n## Frame Grammar (WPS-01)\n\n## Ready Handshake (WPS-02)\n";
      const missing = missingMandatedSections(fixture);
      expect(missing).toContain("exit-code taxonomy (EXC-01)");
    });
  });

  describe("REQ-LED-01 — pending-changes ledger reconciled (fit-31-style ledger-presence scan)", () => {
    it("openspec/pending-changes.md names the cross-repo tether row and the Windows/macOS-pins row", () => {
      expect(ledgerTetherViolations(PENDING_CHANGES_TEXT)).toEqual([]);
    });

    it("openspec/pending-changes.md's closed StdioEngineClient row carries a full supersession note", () => {
      expect(ledgerSupersessionViolations(PENDING_CHANGES_TEXT)).toEqual([]);
    });

    it("[red-proof] a ledger with no tether/Windows rows is caught", () => {
      expect(ledgerTetherViolations("# Pending\n\nnothing here\n").length).toBeGreaterThan(0);
    });

    it("[red-proof] a closed row missing one superseded decision is caught", () => {
      const fixture = "CLOSED — StdioEngineClient row: superseded NDJSON and session.init.";
      expect(ledgerSupersessionViolations(fixture).length).toBeGreaterThan(0);
    });
  });
});
