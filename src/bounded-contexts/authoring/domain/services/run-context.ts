// The run a call belongs to, shared by every copy of the SDK loaded in one process. A Dialect
// handle looks it up at each step, never when it is made, so `find()` at module top level and a
// handle reused across runs both keep working. `T` is the store `defineFactory` puts in it.

import { AsyncLocalStorage } from "node:async_hooks";
import { AuthoringError } from "../valueobjects/authoring-error.ts";

// context-singleton-fix (REQ-MIS-01/02, design §4.3): a module-scope `als` is realm-local —
// when `dist/bin/pbuilder-runner.js` and a src-relative `.ts` factory co-execute in one Bun
// process, each resolves its OWN copy of this module and its OWN `als`, so a Session entered in
// one realm is invisible to `currentContext()` in the other. The store is therefore parked at
// `globalThis[Symbol.for(SESSION_ALS_REGISTRY_KEY)]` — a process-singleton every realm resolving
// this file reaches via the SAME well-known key — lazily installed on first access.
export const SESSION_ALS_REGISTRY_KEY = "@pbuilder/sdk:core/context#session-als";

function isAsyncLocalStorageLike<T>(value: unknown): value is AsyncLocalStorage<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { run?: unknown }).run === "function" &&
    typeof (value as { getStore?: unknown }).getStore === "function"
  );
}

// PURE 3-state decision (design §4.3, rev 3 purity split) — no globalThis, no side effects.
// `undefined` (slot absent) -> fresh ALS; a duck-valid ALS-shaped value (cross-realm reuse)
// -> returned verbatim, SAME instance; anything else -> fail LOUD (occupied-slot contract,
// ADR-01 addendum): a foreign/corrupted occupant under this well-known key must never be
// trusted or silently clobbered. Plain `Error` (NOT AuthoringError) — this is
// environment/integration corruption, not author-input misuse; the closed reason enum has no
// member for it (mirrors `validateAtRunBoundary`'s read-path posture).
export function resolveSessionAls<T>(slotValue: unknown): AsyncLocalStorage<T> {
  if (slotValue === undefined) {
    return new AsyncLocalStorage<T>();
  }
  if (isAsyncLocalStorageLike<T>(slotValue)) {
    return slotValue;
  }
  throw new Error(
    `[pbuilder] run-context registry slot Symbol.for("${SESSION_ALS_REGISTRY_KEY}") is occupied by an ` +
      `incompatible value (expected an AsyncLocalStorage, got ${typeof slotValue}) — another module ` +
      "may have polluted globalThis"
  );
}

// IMPURE thin shell: reads the shared slot, delegates the 3-state decision to the pure
// `resolveSessionAls`, and installs the resolved ALS ONLY when the slot was absent — a frozen
// descriptor (non-enumerable, non-configurable, non-writable) so REQ-MIS-01.2's no-pollution
// guarantee holds and the slot can never be silently reassigned after first install.
export function getSessionAls<T>(): AsyncLocalStorage<T> {
  const registryKey = Symbol.for(SESSION_ALS_REGISTRY_KEY);
  const slot = (globalThis as Record<symbol, unknown>)[registryKey];
  const resolved = resolveSessionAls<T>(slot);
  if (slot === undefined) {
    Object.defineProperty(globalThis, registryKey, {
      value: resolved,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  return resolved;
}

// REQ-AEC-02.1 (2.4): a verb called outside any defineFactory Session is SDK-side misuse,
// independent of any engine round-trip — an AuthoringError{authoring-rejected,outside-session},
// not a plain Error. The prose lives in authoring-error.ts's outside-session message template
// (the third template, REQ-AEC-06); this is the one call site that reaches it.
export function currentRun<T>(): T {
  const ctx = getSessionAls<T>().getStore();
  if (ctx === undefined) {
    throw new AuthoringError({
      verb: undefined,
      path: undefined,
      reason: "outside-session",
      appliedCount: 0,
    });
  }
  return ctx;
}
