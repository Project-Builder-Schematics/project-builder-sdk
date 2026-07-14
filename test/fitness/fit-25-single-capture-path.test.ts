/**
 * FIT-25 (REQ-FTG-03): single capture path — the corpus writer (`scripts/regen-corpus.ts`),
 * the report renderer (`test/support/run-report-render.ts`), and the e2e file
 * (`test/e2e/author-emulation-scaffold.e2e.test.ts`) must never diverge onto a SECOND
 * module wrapping `runFactoryForTest` (`ir-transcript-capture` REQ-ITC-02) — exactly one
 * capture module (`test/support/ir-transcript.ts`) may exist reachable from any of them.
 *
 * The report renderer (R-D) takes an ALREADY-captured `{record, rawDirectives}` as input —
 * it never itself calls `runFactoryForTest` — so its reachable graph legitimately contains
 * ZERO capture modules; that is not a violation, it is the design (a second capture module
 * would be).
 *
 * Failure-message taxonomy (design §4.4): guard id + broken invariant + named offender +
 * rule cite.
 *
 * Red-proof: `test/fixtures/red/author-emulation/second-capture-module.ts` — a module
 * shaped like `ir-transcript.ts` that also wraps `runFactoryForTest`. Never imported by
 * anything real; the red-proof simulates it joining the e2e file's reachable set.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { specifiersResolvingInto, walkReachable } from "../support/import-scan.ts";

const REGEN_SCRIPT = new URL("../../scripts/regen-corpus.ts", import.meta.url).pathname;
const REPORT_RENDERER = new URL("../support/run-report-render.ts", import.meta.url).pathname;
const E2E_FILE = new URL("../e2e/author-emulation-scaffold.e2e.test.ts", import.meta.url).pathname;
const IR_TRANSCRIPT = new URL("../support/ir-transcript.ts", import.meta.url).pathname;
const TESTING_INDEX = new URL("../../src/testing/index.ts", import.meta.url).pathname;
const RED_FIXTURE = new URL("../fixtures/red/author-emulation/second-capture-module.ts", import.meta.url).pathname;

/** A "capture module" = a file whose source imports from `src/testing/index.ts` — the
 * only module exporting `runFactoryForTest`. */
function isCaptureModule(file: string): boolean {
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return false;
  }
  return specifiersResolvingInto(source, dirname(file), TESTING_INDEX).length > 0;
}

function findCaptureModules(files: Iterable<string>): string[] {
  const found: string[] = [];
  for (const file of files) {
    if (isCaptureModule(file)) found.push(file);
  }
  return found;
}

describe("FIT-25 — single capture path (REQ-FTG-03)", () => {
  it("the corpus writer resolves to exactly the canonical capture module, no other", () => {
    const graph = walkReachable([REGEN_SCRIPT]);
    expect({ consumer: "regen-corpus.ts", captureModules: findCaptureModules(graph) }).toEqual({
      consumer: "regen-corpus.ts",
      captureModules: [IR_TRANSCRIPT],
    });
  });

  it("the e2e file resolves to exactly the canonical capture module, no other", () => {
    const graph = walkReachable([E2E_FILE]);
    expect({ consumer: "author-emulation-scaffold.e2e.test.ts", captureModules: findCaptureModules(graph) }).toEqual({
      consumer: "author-emulation-scaffold.e2e.test.ts",
      captureModules: [IR_TRANSCRIPT],
    });
  });

  it("the report renderer introduces no capture module of its own (R-D: it renders already-captured input)", () => {
    const graph = walkReachable([REPORT_RENDERER]);
    expect({ consumer: "run-report-render.ts", captureModules: findCaptureModules(graph) }).toEqual({
      consumer: "run-report-render.ts",
      captureModules: [],
    });
  });

  it("no second capture module exists across all three consumers' combined reachable graph", () => {
    const combined = new Set<string>([
      ...walkReachable([REGEN_SCRIPT]),
      ...walkReachable([REPORT_RENDERER]),
      ...walkReachable([E2E_FILE]),
    ]);
    expect(findCaptureModules(combined)).toEqual([IR_TRANSCRIPT]);
  });

  // RED-PROOF: a second module wrapping runFactoryForTest, joining a consumer's reachable
  // set, is caught — proves the check is a real, discriminating guard.
  it("[red-proof] a second module wrapping runFactoryForTest is detected", () => {
    const combined = new Set<string>([...walkReachable([E2E_FILE]), RED_FIXTURE]);
    const captureModules = findCaptureModules(combined).sort();
    expect(captureModules).toEqual([IR_TRANSCRIPT, RED_FIXTURE].sort());
  });
});
