// Handle state types (KIT-04 / ADR-0004 amended by ADR-0010).
// The handle is OPEN — ops are composed at the value level, not via sealed subclasses.
// The State discriminant is retained: FoundHandle has `remove`; WritableHandle does not.

import type { ReadOps, WriteOps } from "./base-handle.ts";

// WritableHandle: returned by every write op (create, modify, rename, move, copy).
// No `remove` — a write makes remove incoherent (ADR-0004 chaining table).
export interface WritableHandle extends ReadOps, WriteOps {}

// FoundHandle: returned exclusively by find().
// Has `remove()` because an unmodified found file may be deleted.
// `remove` is absent from WritableHandle so `create().remove` does not typecheck.
export interface FoundHandle extends ReadOps, WriteOps {
  remove(): void;
}
