import type { ReadOps, WriteOps } from "./base-handle.ts";
/**
 * Returned by every write verb (`create`, `modify`, `rename`, `move`, `copy`).
 * Supports chaining — each method returns a fresh `WritableHandle` for the result path.
 * Does NOT have `remove()`: a write makes remove incoherent (ADR-0004 chaining table).
 *
 * @example
 * const h = modify("src/config.ts", "export const version = '2.0.0';");
 * const content = await h.read();
 */
export interface WritableHandle extends ReadOps, WriteOps {
}
/**
 * Returned exclusively by `find(path)`.
 * Has `remove()` because an unmodified found file may be deleted.
 * `remove` is absent from `WritableHandle` so `create().remove` does not typecheck.
 *
 * @example
 * const h = find("src/legacy.ts");
 * await h.remove();
 */
export interface FoundHandle extends ReadOps, WriteOps {
    remove(): void;
}
//# sourceMappingURL=handle-state.d.ts.map
