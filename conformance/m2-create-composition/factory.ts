// m2-create-composition (composition, REQ-CFX-09): default export composes the
// schematic-lowered generated.txt (staged by the engine before spawn) with an in-place
// modify of the seeded existing.txt; createRejectProbe (wire-create-reject-twin,
// ADR-0065 case-level factory override) authors the corpus's sole raw wire create — a
// deliberate reject probe, see DO-NOT-COPY below.
import { replaceContent, create } from "../../src/index.ts";

export default function m2CreateCompositionFactory(_input: Record<string, never>): void {
  replaceContent("existing.txt", "composed");
}

// DO-NOT-COPY: this is the corpus's ONE sanctioned wire `create` authoring site
// (REQ-CFX-02's sole exception), not a template for future fixtures.
// (a) authoring a second `create()` anywhere else in this corpus violates the
//     one-create-corpus-wide invariant (REQ-CFX-02) and fails fit-40.
// (b) this is a REJECT PROBE, not a demonstration of a working `create` flow.
// (c) do NOT imitate this pattern when authoring a new fixture.
// (d) the engine refuses this batch at emit — `unrepresentable`, exit 2 (ADR-0064, frozen).
// (e) to author a new fixture, copy the default export's modify/delete/rename/move/copy
//     pattern above instead.
export function createRejectProbe(_input: Record<string, never>): void {
  create("wire-create-reject-probe.txt", { template: "unrepresentable", options: {} });
}
