/**
 * FIT-NEW-B (`fitness-guards` REQ-FTG-07): every surviving `AuthoringReason` member must be
 * mintable from `src/**` through the UNION of `CODE_TO_REASON`'s value set and direct
 * `AuthoringError` construction sites — EXCLUDING the `AuthoringReason` union declaration
 * and `originFor`'s switch arms (both list every member by definition; crediting them would
 * make the check vacuous). Both patterns this scan credits (`reason: "value"` properties,
 * `sourceRejection("value"...)`/`rejection("value"...)` minting-helper calls) are naturally
 * blind to the union's `| "value"` syntax and `originFor`'s `case "value":` syntax, so no
 * separate exclusion step is needed — verified by the red-proof below, which plants BOTH
 * excluded shapes for an otherwise-unreachable reason and confirms the scan still flags it.
 */
import { describe, it, expect } from "bun:test";
import { collectFiles } from "../support/import-scan.ts";
import { readScanFiles, scanMintedReasons, parseCodeToReasonValues } from "../support/src-invariant-scans.ts";

const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;
const SRC_DIR = `${PROJECT_ROOT}src`;
const RED_ROOT = `${PROJECT_ROOT}test/fixtures/red/src-invariant-scans`;

// The 11 surviving members (authoring-error.ts, ADR-0077 §E) — `source-outside-package`
// retired.
const SURVIVING_REASONS = [
  "path-collision",
  "path-not-found",
  "unrepresentable-content",
  "changes-too-large",
  "outside-run",
  "unknown",
  "invalid-input",
  "reserved-name",
  "source-not-found",
  "source-not-regular-file",
  "source-unreadable",
];

function realSrcFiles() {
  return readScanFiles(collectFiles(SRC_DIR, ".ts"));
}

describe("FIT-NEW-B (fit-44) — every surviving AuthoringReason is mintable", () => {
  it("all 11 surviving reasons are reachable through CODE_TO_REASON or a direct construction site", () => {
    const reachable = scanMintedReasons(realSrcFiles());
    for (const reason of SURVIVING_REASONS) {
      expect(reachable.has(reason)).toBe(true);
    }
  });

  it("the retired source-outside-package reason is NOT reachable (it should no longer exist anywhere as a construction site)", () => {
    const reachable = scanMintedReasons(realSrcFiles());
    expect(reachable.has("source-outside-package")).toBe(false);
  });

  it("[red-proof] REQ-FTG-07.1 — a reason present ONLY in the union declaration and originFor's switch (both excluded shapes) is flagged unreachable", () => {
    const fixture = readScanFiles([`${RED_ROOT}/reason-unreachable.ts`]);
    const reachable = scanMintedReasons(fixture);
    // "unreachable-reason" appears in the union (`| "unreachable-reason"`) and in
    // originFor's switch (`case "unreachable-reason":`) — NEITHER shape is credited.
    expect(reachable.has("unreachable-reason")).toBe(false);
    // The OTHER two fixture reasons ARE reachable — proving the scan isn't simply blind to
    // everything in this file, only to the two excluded syntactic shapes.
    expect(reachable.has("path-collision")).toBe(true); // via the fixture's CODE_TO_REASON
    expect(reachable.has("invalid-input")).toBe(true); // via the fixture's rejection("invalid-input", ...) call
  });

  describe("REQ-FTG-07.2 — CODE_TO_REASON's value set contains zero source-* reasons", () => {
    it("the real CODE_TO_REASON mints no source-* value", () => {
      const values = parseCodeToReasonValues(realSrcFiles());
      expect(values.length).toBeGreaterThan(0);
      expect(values.some((v) => v.startsWith("source-"))).toBe(false);
    });
  });
});
