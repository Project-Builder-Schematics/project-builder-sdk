import type { Batch } from "./wire.ts";
/**
 * The author-vocabulary verb of the operation whose rejection produced this
 * `AuthoringError` — `"remove"`, never the wire op `"delete"` (REQ-10.2).
 * `undefined` for batch-level rejections (`unrepresentable-content`,
 * `changes-too-large`, `unknown`), which have no single offending directive.
 *
 * `schematic-local-files` S-003 (A1): extended from six to seven — `copyIn` added,
 * forced by the `Directive["op"]` union gaining the `copyIn` wire op (ADR-0043); a
 * `copyIn` collision attributes `verb: "copyIn"` (the author never called `copy`).
 *
 * @example
 * if (err instanceof AuthoringError && err.verb !== undefined) {
 *   console.error(`${err.verb} was rejected at ${err.path}`);
 * }
 */
export type AuthoringVerb = "create" | "modify" | "remove" | "rename" | "move" | "copy" | "copyIn";
/**
 * The closed, author-vocabulary cause of an `AuthoringError` (★D2, ADR-0020). Exactly
 * twelve values — adding a thirteenth is a MAJOR change: authors are expected to write
 * exhaustive `switch(reason)` blocks, and TypeScript's exhaustiveness check breaks such
 * a switch on a new member even though nothing breaks at runtime. (V2 → V3 amendment,
 * 2026-07-10, coordinated with `stage-4-typed-options`: extended from six to eight —
 * `invalid-input` and `reserved-name` added, REQ-AEC-07/08. `schematic-local-files`
 * S-002, REQ-AEC-10: extended from eight to twelve — `source-not-found`,
 * `source-outside-package`, `source-not-regular-file`, `source-unreadable` added, all
 * four covering the SDK's own pre-emit read/stat of a package-local source for
 * `scaffold`/`copyIn`/`create({templateFile})`.)
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
 *   case "invalid-input":
 *   case "reserved-name":
 *   case "source-not-found":
 *   case "source-outside-package":
 *   case "source-not-regular-file":
 *   case "source-unreadable":
 *     console.error(err.message);
 *     break;
 * }
 */
export type AuthoringReason = "path-collision" | "path-not-found" | "unrepresentable-content" | "changes-too-large" | "outside-run" | "unknown" | "invalid-input" | "reserved-name" | "source-not-found" | "source-outside-package" | "source-not-regular-file" | "source-unreadable";
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
        /**
         * Overrides the derived message. REQUIRED for `reason: "invalid-input"` /
         * `"reserved-name"` (REQ-AEC-09) — their templates interpolate caller-known data
         * (`{field}`, `{expectedType}`, `{name}`) `messageFor` cannot derive from `verb`/`path`
         * alone. Optional for every other reason, which derive their message from `reason` +
         * `verb` + `path` as before.
         */
        message?: string;
    });
}
export declare function toAuthoringError(raw: unknown, batch: Batch): AuthoringError;
//# sourceMappingURL=authoring-error.d.ts.map