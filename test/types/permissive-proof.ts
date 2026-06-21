// Permissive-Handle mutation proof (KIT-04 acceptance criterion).
//
// PURPOSE: Demonstrate the @ts-expect-error negatives in handle-types.test.ts are REAL,
// not vacuous. If the type-negative tests used @ts-expect-error on code that was
// already invalid for a different reason, the tests would give false confidence.
//
// PROOF MECHANISM:
//   1. Define `PermissiveWritableHandle` — identical to WritableHandle but WITH `remove()`.
//   2. Re-run the same negative assertions against PermissiveWritableHandle.
//   3. Because PermissiveWritableHandle has `remove`, the @ts-expect-error directives below
//      become UNUSED — tsc would fail here if this file were included in the normal tsconfig.
//   4. This file is therefore excluded from tsconfig.json (see `exclude` or is not in src/).
//      To run the proof: `bunx tsc --noEmit -p tsconfig.permissive-proof.json`
//      Expected output: error TS2578 (unused @ts-expect-error) on each annotated line.
//      That error means: "the negative we guard in the real suite is reachable and real."
//
// HOW TO VERIFY (from repo root):
//   bun run typecheck:permissive-proof
//   → Should EXIT NON-ZERO with: "Unused '@ts-expect-error' directive" on the lines below.
//   If it exits 0: the proof is broken (either PermissiveWritableHandle lost `remove`,
//   or tsc's @ts-expect-error detection regressed).

import type { ReadOps, WriteOps } from "../../src/core/base-handle.ts";

// PermissiveWritableHandle: WritableHandle + remove() — the mutation that real WritableHandle forbids.
interface PermissiveWritableHandle extends ReadOps, WriteOps {
  remove(): void;
}

// The following @ts-expect-error directives are INTENTIONALLY UNUSED when PermissiveWritableHandle
// has `remove`. tsc reports TS2578 for each — that is the expected proof output.

const _negativeWouldBeUnused = (_h: PermissiveWritableHandle) => {
  // @ts-expect-error — this line is expected to be FLAGGED by tsc as "unused @ts-expect-error"
  // because PermissiveWritableHandle DOES have `remove`. That is the proof.
  _h.remove();
};
void _negativeWouldBeUnused;

// Assignability: PermissiveWritableHandle IS assignable to FoundHandle (it has remove).
// In the real suite, WritableHandle is NOT assignable to FoundHandle — that's what we protect.
import type { FoundHandle } from "../../src/core/handle-state.ts";
type _PermissiveAssignable = PermissiveWritableHandle extends FoundHandle ? true : false;
// This should be `true` (unlike the real WritableHandle which resolves to `false`).
// Asserting it: if this becomes false, the proof fixture is broken.
const _assertAssignable: _PermissiveAssignable = true;
void _assertAssignable;
