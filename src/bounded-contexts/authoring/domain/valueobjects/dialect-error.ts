// S-000: kit-internal contained-error module (ADR-0037 clause 0, no public symbol, out of
// every barrel/subpath). Sibling of ./deep-equal.ts — same kit-internal-shared-in-core
// pattern (ADR-0012 amendment clause 4 folds both under one decision, no separate ADR).
//
// F1 (BLOCKING, ADR-0037 amendment): the containment discriminator is this module-private
// WeakSet brand, NEVER a `message.startsWith(prefix)` match — a buggy op interpolating a
// caught foreign error into a message that happens to start with the frozen prefix would
// otherwise be rethrown verbatim (bypassing leak sanitisation), and a coincidental foreign
// prefix would misclassify. The WeakSet is unforgeable, non-enumerable, and carries no class
// name into the error (leak budget).

const ERROR_PREFIX = "dialect operation failed: ";

const contained = new WeakSet<Error>();

/**
 * Mints a fresh, WeakSet-branded contained error with the frozen presentation prefix. A
 * fresh `Error` is constructed at the call site (stack cleanliness by construction) —
 * `.cause` is always absent; the caller's own tail is the ONLY variable content.
 */
export function dialectError(tail: string): Error {
  const err = new Error(ERROR_PREFIX + tail);
  contained.add(err);
  return err;
}

/** WeakSet membership test — the sole containment discriminator (see F1 above). */
export function isContained(err: unknown): boolean {
  return err instanceof Error && contained.has(err);
}
