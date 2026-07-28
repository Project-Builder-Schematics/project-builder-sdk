import { AsyncLocalStorage } from "node:async_hooks";
import type { EngineClient } from "./engine-client.ts";
import { DirectiveFactory } from "./directive-factory.ts";
import { Session } from "./session.ts";
export interface DialectRegistry {
    register(handle: {
        readonly settle: () => Promise<void>;
    }): void;
    drain(): Promise<void>;
}
export interface RunContext {
    session: Session;
    factory: DirectiveFactory;
    dialects: DialectRegistry;
    runFailure?: {
        reason: unknown;
    };
    packageAnchors?: {
        packageDir: string;
    };
}
export declare const RUN_ALS_REGISTRY_KEY = "@pbuilder/sdk:core/context#run-als";
export declare function resolveRunAls(slotValue: unknown): AsyncLocalStorage<RunContext>;
export declare function isDefineFactoryWrapped(value: unknown): boolean;
export declare function currentContext(): RunContext;
export declare function requirePackageAnchors(missingAnchorMessage: string): {
    packageDir: string;
};
/**
 * Builds a run-context and runs the factory inside it, flushing buffered
 * directives at run end (REQ-KIT-05) — a write-only factory still emits.
 *
 * All-or-nothing contract (ADR-01): on success the full directive batch is committed;
 * if `fn` throws (or the run-end flush rejects), the staged set is discarded and the
 * engine commits NOTHING. The original (or attributed) error propagates to the caller —
 * a thrown factory never leaves a partial set of mutations committed.
 *
 * `options.packageDir` (pass `import.meta.dir`, never `import.meta.url`) opts a factory
 * into schema-derived run-boundary validation against its adjacent `schema.json`; a bare
 * `defineFactory(fn)` call is the untyped opt-out and runs exactly as before this option
 * existed (REQ-TFO-02).
 *
 * @internal Sanctioned callers only — `src/core/**`, `src/testing/**`, and
 * `src/conformance/**` (enforced by `test/fitness/fit-29-sanctioned-definefactory-caller.test.ts`).
 * Author code never imports this directly; it calls `runFactoryForTest` (test-time) or the
 * future production runner instead — both wrap this SAME seam internally.
 *
 * @param fn - the authoring logic; receives the resolved, schema-validated input.
 * @param options.packageDir - opts into schema-derived input validation and reserved-name
 * enforcement (both structural checks against this package's `schema.json`/sibling files).
 * Pass `import.meta.dir` (a directory) — NOT `import.meta.url` (a file URL; a common
 * misuse). Two opt-out tiers: omit `options` entirely for the untyped, unvalidated escape
 * hatch (REQ-TFO-02); pass `{ packageDir }` with no adjacent `schema.json` to opt into the
 * flow loudly-schemaless (a warning fires on every run, REQ-RBV-03).
 *
 * @remarks
 * A factory package must never declare a sibling module named `pre-execute` or
 * `post-execute` (file or directory form, case-insensitive) — these are reserved lifecycle
 * names for future SDK use and are rejected at this boundary (the `reserved-lifecycle-names`
 * domain). `add`/`remove` are NOT reserved by this check (collection-level naming, deferred
 * to a future L2 scope).
 *
 * @example
 * // 1. Generate the typed Input from schema.json:
 * //      pbuilder-codegen <package-dir>
 * import type { Input } from "./schema.generated.ts";
 *
 * // 2. Internal: wrap a bare author fn into a client-driven runner:
 * const bareFactory = (input: Input) => {
 *   create("server.config.ts", {
 *     template: "export const port = {{port}};",
 *     options: { port: input.port },
 *   });
 * };
 *
 * const runner = defineFactory<Input>(bareFactory, { packageDir: import.meta.dir });
 * await runner(input, { client });
 */
export declare function defineFactory<O>(fn: (o: O) => void | Promise<void>, options?: {
    packageDir?: string | URL;
}): (o: O, deps: {
    client: EngineClient;
}) => Promise<void>;
