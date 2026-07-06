import type { Batch } from "./wire.ts";
/**
 * The author-vocabulary verb of the operation whose rejection produced this
 * `AuthoringError` — `"remove"`, never the wire op `"delete"` (REQ-10.2).
 * `undefined` for batch-level rejections (`unrepresentable-content`,
 * `changes-too-large`, `unknown`), which have no single offending directive.
 *
 * @example
 * if (err instanceof AuthoringError && err.verb !== undefined) {
 *   console.error(`${err.verb} was rejected at ${err.path}`);
 * }
 */
export type AuthoringVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy";
/**
 * The closed, author-vocabulary cause of an `AuthoringError` (★D2, ADR-0020). Exactly
 * six values — adding a seventh is a MAJOR change: authors are expected to write
 * exhaustive `switch(reason)` blocks, and TypeScript's exhaustiveness check breaks such
 * a switch on a new member even though nothing breaks at runtime.
 *
 * @example
 * switch (err.reason) {
 *   case "path-collision":
 *     console.error(`${err.verb} collided at ${err.path}`);
 *     break;
 *   case "path-not-found":
 *   case "unrepresentable-content":
 *   case "changes-too-large":
 *   case "outside-run":
 *   case "unknown":
 *     console.error(err.message);
 *     break;
 * }
 */
export type AuthoringReason = "path-collision" | "path-not-found" | "unrepresentable-content" | "changes-too-large" | "outside-run" | "unknown";
/**
 * Distinguishes an engine-refused write from an SDK-side misuse (2.4, ADR-0021) —
 * DERIVED from `reason`, never producer-set.
 *
 * @example
 * if (err.origin === "write-rejected") console.error("the engine refused the write");
 * else console.error("the schematic itself was used incorrectly");
 */
export type AuthoringOrigin = "write-rejected" | "authoring-rejected";
/**
 * Thrown when an author's schematic run is rejected — by the engine (a refused write)
 * or by the SDK itself (a misuse detected before any engine round-trip). Catch it,
 * `switch` on `.reason`, and recover.
 *
 * @example
 * import { AuthoringError } from "@pbuilder/sdk/commons";
 *
 * try {
 *   await run(options, { client });
 * } catch (err) {
 *   if (err instanceof AuthoringError) {
 *     switch (err.reason) {
 *       case "path-collision":
 *         console.error(`${err.verb} collided at ${err.path}`);
 *         break;
 *       default:
 *         console.error(err.message);
 *     }
 *   }
 * }
 */
export declare class AuthoringError extends Error {
    readonly verb: AuthoringVerb | undefined;
    readonly path: string | undefined;
    readonly reason: AuthoringReason;
    readonly origin: AuthoringOrigin;
    /**
     * Counts directives applied within the failing flush before the offender — a
     * diagnostic for locating progress, NOT a persistence promise (a rejected run
     * discards everything, ADR-0015).
     */
    readonly appliedCount: number;
    constructor(fields: {
        verb: AuthoringVerb | undefined;
        path: string | undefined;
        reason: AuthoringReason;
        appliedCount: number;
    });
}
export declare function toAuthoringError(raw: unknown, batch: Batch): AuthoringError;
//# sourceMappingURL=authoring-error.d.ts.map