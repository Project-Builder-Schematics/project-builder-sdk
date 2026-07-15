// REQ-WPS-04.1/REQ-FEH-01 fixture (judgment-day R2): a batch whose serialized size lands
// EXACTLY at BATCH_CAP_BYTES — inside the historical divergence window where the pre-R2
// ContractFake (bare-batch cap) accepted what StdioEngineClient (frame-body cap) rejected.
// Both legs of the conformance harness must now agree: rejected, `changes-too-large`,
// with the emit refused LOCALLY on the spawned path (nothing ever written to the wire).
// Deterministic by construction: the filler is plain ASCII, sized by measuring the probe
// directive's own serialized envelope — no randomness, no environment dependence.
import { create } from "../../../../src/index.ts";
import { BATCH_CAP_BYTES, serializedBatchSize, type Directive } from "../../../../src/core/wire.ts";

const PATH = "boundary.txt";

export default function frameRunnerCapBoundaryFactory(): void {
  const probe: Directive = { op: "create", create: { pathTemplate: PATH, template: "", options: {} } };
  const overhead = serializedBatchSize([probe]);
  create(PATH, { template: "a".repeat(BATCH_CAP_BYTES - overhead), options: {} });
}
