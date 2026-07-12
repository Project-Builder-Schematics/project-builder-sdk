// Quarantined RED-PROOF fixture (REQ-DG-06.2) — a named op literal whose returned promise
// REJECTS after a delay. Proves `runOp`'s containment `await`s a returned thenable INSIDE
// the wrap (mirrors `.raw()`'s existing async containment, ADR-0037) — never floating an
// unhandled rejection, never committing a false success. Not part of any shipped op-pack.
export async function asyncRejectingOp(_ast: unknown): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  throw new Error("planted native async rejection");
}
