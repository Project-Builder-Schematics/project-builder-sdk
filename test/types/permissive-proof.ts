// Permissive-Handle mutation proof (KIT-04 acceptance criterion).
//
// PURPOSE: Demonstrate the @ts-expect-error negatives in handle-types.test.ts are REAL,
// not vacuous. If the type-negative tests used @ts-expect-error on code that was
// already invalid for a different reason, the tests would give false confidence.
//
// TWO IDIOMS share this file, distinguished by an inline marker on each directive:
//   - [idiom-1]  @ts-expect-error on VALID code (`PermissiveWritableHandle` HAS `remove`).
//                tsc raises TS2578 (unused directive) — its PRESENCE is the proof.
//   - [idiom-2]  @ts-expect-error suppressing a REAL error (excess / missing-required / wrong-type
//                rejected by the homomorphic mapped type). The directive is USED, so TS2578 is
//                ABSENT on its line. If the create<S> overload regresses (the negative becomes
//                legal), the directive turns unused → TS2578 appears → the regression is caught.
//
// CI ASSERTION lives in `permissive-proof.guard.test.ts` (a `bun test`), which pins the EXACT
// expected diagnostic set by error code + directive region (it scans the [idiom-1]/[idiom-2]
// markers below — never hard-coded line numbers). The old inverted-exit `ci.yml` step that only
// asserted "exited non-zero" is retired (it was blind to WHICH negative held).
//
// DEV CONVENIENCE: `bun run typecheck:permissive-proof` still runs tsc against
// `tsconfig.permissive-proof.json`; expect TS2578 on the [idiom-1] line and none on [idiom-2] lines.

import type { ReadOps, WriteOps } from "../../src/core/base-handle.ts";
import { create } from "../../src/commons/index.ts";

// PermissiveWritableHandle: WritableHandle + remove() — the mutation that real WritableHandle forbids.
interface PermissiveWritableHandle extends ReadOps, WriteOps {
  remove(): void;
}

// The following @ts-expect-error directives are INTENTIONALLY UNUSED when PermissiveWritableHandle
// has `remove`. tsc reports TS2578 for each — that is the expected proof output.

const _negativeWouldBeUnused = (_h: PermissiveWritableHandle) => {
  // @ts-expect-error [idiom-1] — this line is expected to be FLAGGED by tsc as "unused @ts-expect-error"
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

// REQ-01.2 — excess-field NEGATIVE proof for the create<S> generic overload (SEAM-01).
// When create<S> narrows `options` to the mapped type { [K in keyof S]: S[K] }, an EXTRA
// field is rejected by excess-property checking. The @ts-expect-error below is then USED
// (a real error is suppressed), so it does NOT raise TS2578. If the overload ever stops
// narrowing (the excess field becomes legal again), the directive becomes unused and tsc
// raises TS2578 here — the proof catches the regression.
const _excessFieldRejected = () => {
  // @ts-expect-error [idiom-2] — `extra` is not a key of S = { name: string }; the mapped-type narrowing must reject it.
  create<{ name: string }>("dst.ts", { template: "t", options: { name: "x", extra: 1 } });
};
void _excessFieldRejected;

// REQ-01.6 — missing-required NEGATIVE proof. The homomorphic mapped type preserves required-ness,
// so omitting a non-`?` key is rejected (TS2741). The @ts-expect-error below is USED (a real error is
// suppressed) → no TS2578 here. If the overload ever stops requiring `count`, the directive becomes
// unused and tsc raises TS2578 — the guard (S-03) catches the regression.
const _missingRequiredRejected = () => {
  // @ts-expect-error [idiom-2] — `count` is a required key of S; omitting it must be rejected (TS2741).
  create<{ name: string; count: number }>("dst.ts", { template: "t", options: { name: "x" } });
};
void _missingRequiredRejected;

// REQ-01.7 — wrong-type NEGATIVE proof. The homomorphic mapped type preserves per-key value types,
// so a string where `number` is required is rejected (TS2322). USED directive → no TS2578 here.
const _wrongTypeRejected = () => {
  // @ts-expect-error [idiom-2] — `count` must be a number; a string value must be rejected (TS2322).
  create<{ count: number }>("dst.ts", { template: "t", options: { count: "five" } });
};
void _wrongTypeRejected;
