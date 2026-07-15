// REQ-FEH-02: the ONE scenario-definitions module for the fake-engine conformance harness —
// consumed by BOTH the in-process suite (runFactoryForTest against ContractFake directly)
// and the process-boundary suite (spawned real process, `serveSpawnedRunner`) in
// `harness.test.ts`, from this SAME module path. A corpus edit here changes both runners'
// behavior identically (REQ-FEH-02.1) — never two independently-maintained scenario sets.
//
// Each entry's `run` (bare factory fn, in-process leg) and `pointer` (file:// URL, spawned
// leg) are two views of the SAME fixture file under test/fixtures/frame-runner/ — not two
// independent definitions of "the same" scenario.

import happyFactory from "../fixtures/frame-runner/happy/factory.ts";
import collideFactory from "../fixtures/frame-runner/collide/factory.ts";
import capBoundaryFactory from "../fixtures/frame-runner/cap-boundary/factory.ts";
import type { AuthoringReason } from "../../src/core/authoring-error.ts";

function pointerFor(dir: string): string {
  return `file://${new URL(`../fixtures/frame-runner/${dir}/`, import.meta.url).pathname}factory.ts`;
}

export interface ConformanceScenario {
  id: string;
  /** Bare author factory — the in-process leg (`runFactoryForTest`). */
  run: (input: Record<string, never>) => void | Promise<void>;
  /** `file://` pointer to the SAME fixture's factory.ts — the spawned leg (`--factory`). */
  pointer: string;
  seed: Record<string, string>;
  outcome: "committed" | "rejected";
  /** rejected only: the expected AuthoringError.reason (identical on both legs) plus how
   * the rejection travels — `wire` names the ir.emit error envelope's emitRejectionCode the
   * host answered with; `local` means the client refused BEFORE writing, so the spawned
   * session must show NO ir.emit request at all. */
  rejection?: { reason: AuthoringReason; via: { wireCode: string } | "local" };
}

export const CONFORMANCE_CORPUS: readonly ConformanceScenario[] = [
  {
    id: "happy",
    run: happyFactory,
    pointer: pointerFor("happy"),
    seed: { "seed.txt": "feh-01" },
    outcome: "committed",
  },
  {
    id: "collide",
    run: collideFactory,
    pointer: pointerFor("collide"),
    seed: {},
    outcome: "rejected",
    rejection: { reason: "path-collision", via: { wireCode: "collision" } },
  },
  // Judgment-day R2 divergence killer (REQ-WPS-04.1/FEH-01.1): a batch serialized exactly
  // at BATCH_CAP_BYTES — the pre-R2 fake accepted it while the client rejected it. Both
  // legs must agree it is over the deterministic emit budget; the spawned leg must refuse
  // LOCALLY (no ir.emit frame ever crosses the wire).
  {
    id: "cap-boundary",
    run: capBoundaryFactory,
    pointer: pointerFor("cap-boundary"),
    seed: {},
    outcome: "rejected",
    rejection: { reason: "changes-too-large", via: "local" },
  },
];
