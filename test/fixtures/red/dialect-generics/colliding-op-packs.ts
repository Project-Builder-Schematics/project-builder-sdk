// Quarantined RED-PROOF fixture (REQ-DG-02.4) — two op-packs, BOTH typed over the REAL
// SourceFile Ast, that deliberately declare the SAME op name (`annotate`). Proves `withOps`'s
// eager cross-pack collision check (ADR-0010 amendment, design §4.5) — never shipped, never
// inside `src/conformance/**` (ADR-0012 amendment: no toy-dialect fixture in conformance
// code). `annotate` is chosen deliberately NOT in `RESERVED_HANDLE_NAMES` — this fixture
// isolates the cross-pack-duplicate path from the reserved-name path (REQ-DG-02.5, tested
// separately).
import type { SourceFile } from "ts-morph";
import { defineOpPack } from "../../../../src/core/define-dialect.ts";

export const packA = defineOpPack<SourceFile, { annotate: (ast: SourceFile, note: string) => void }>({
  annotate(_ast, _note) {
    // never invoked — composition throws before any run exists.
  },
});

export const packB = defineOpPack<SourceFile, { annotate: (ast: SourceFile, note: string) => void }>({
  annotate(_ast, _note) {
    // never invoked — composition throws before any run exists.
  },
});
