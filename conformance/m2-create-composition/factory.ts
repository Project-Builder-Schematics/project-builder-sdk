// m2-create-composition (composition, REQ-CFX-09): default export composes the
// schematic-lowered generated.txt (staged by the engine before spawn) with an in-place
// modify of the seeded existing.txt; createRejectProbe (wire-create-reject-twin,
// ADR-0065 case-level factory override) authors a deliberate reject probe; createComposite
// (create-composite case) authors this corpus's positive wire create — both are the
// corpus's ONE sanctioned quarantined create-authoring site, see DO-NOT-COPY below.
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
// (d) the engine refuses this batch at emit BECAUSE it carries `force: true` — `unrepresentable`,
//     exit 2 (ADR-0064, frozen; ADR-0078, force-triggered cause).
// (e) to author a new fixture, copy the default export's modify/delete/rename/move/copy/copyIn
//     pattern above instead — or, if the new fixture genuinely needs a wire create, copy
//     this file's createComposite export's pattern, never this probe's.
export function createRejectProbe(_input: Record<string, never>): void {
  create("wire-create-reject-probe.txt", { template: "unrepresentable", options: {}, force: true });
}

// create-composite (REQ-CFX-09.4): the corpus's first POSITIVE wire create, quarantined
// in this file's second named-export block. Composite `tags` array option exercises
// encodeOptions's JSON-stringify branch (REQ-TOE-01); the engine's v1 promotion rule
// restores it to a real array before the `range` below renders it (docs/create-templates.md).
export function createComposite(_input: Record<string, never>): void {
  create("create-composite.txt", { template: "composite: {= range .tags =}[{= . =}]{= end =}", options: { tags: ["x", "y"] } });
}
