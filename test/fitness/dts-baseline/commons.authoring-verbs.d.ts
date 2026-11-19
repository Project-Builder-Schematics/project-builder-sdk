import type { JsonValue } from "../../../domain/valueobjects/wire.ts";
import type { FoundHandle, WritableHandle } from "../../../domain/entities/handle-state.ts";
import type { PendingDirective } from "../pending-directives/render.ts";
/**
 * Locates an existing file and returns a `FoundHandle` for reading or removing it.
 *
 * `read()` resolves `string | undefined`: the content, `undefined` when the path does not
 * exist, or `""` when the file exists but is empty. Branch on the three outcomes with strict
 * `=== undefined` / `=== ""` — NEVER `if (!content)`, which would merge `undefined`, `""`,
 * `"0"` and `"false"` and reintroduce the absent-vs-empty bug. Prefer `classifyContent()`
 * over manual comparisons — it names the trichotomy and gives exhaustive-switch parity.
 *
 * @example
 * const c = await find("src/config.ts").read();
 * if (c === undefined) create("src/config.ts", { template, options });
 * else if (c === "") replaceContent("src/config.ts", seedContent);
 * else replaceContent("src/config.ts", patch(c));
 */
export declare function find(path: string): FoundHandle;
export declare function create(path: string, opts: {
    options: JsonValue | undefined;
    force?: boolean;
}, template: (options: JsonValue) => string): WritableHandle;
/**
 * Schedules an in-place content replacement for an existing file and returns a `WritableHandle`.
 * A rejected Session (e.g. the target does not exist) throws `AuthoringError`.
 *
 * @example
 * replaceContent("src/config.json", '{ "version": "2.0.0" }');
 */
export declare function replaceContent(path: string, content: string): WritableHandle;
/**
 * Schedules a file deletion. Idempotent — deleting an absent file is not an error.
 *
 * @example
 * remove("src/legacy.ts");
 */
export declare function remove(path: string): void;
/**
 * Schedules a file rename (basename only) and returns a `WritableHandle` for the new path.
 * Renaming onto an existing path is rejected at the engine seam unless
 * `{ force: true }` is passed (overwrite-on-collision, ADR-0017 fail-closed) — a
 * rejected Session throws `AuthoringError`.
 *
 * @example
 * rename("src/foo.ts", "bar.ts");
 */
export declare function rename(path: string, newName: string, opts?: {
    force?: boolean;
}): WritableHandle;
/**
 * Schedules a file move to a different directory and returns a `WritableHandle`.
 * Moving onto an existing destination is rejected at the engine seam unless
 * `{ force: true }` is passed (overwrite-on-collision, ADR-0017 fail-closed) — a
 * rejected Session throws `AuthoringError`.
 * A move whose destination equals its source is a no-op, never a collision
 * (ADR-0017 self-move amendment).
 *
 * @example
 * move("src/utils/helper.ts", "src/shared");
 */
export declare function move(path: string, toDir: string, opts?: {
    force?: boolean;
}): WritableHandle;
/**
 * Schedules a file copy to a new path and returns a `WritableHandle` for the destination.
 * Copying onto an existing destination is rejected at the engine seam unless
 * `{ force: true }` is passed (overwrite-on-collision, ADR-0017 fail-closed) — a
 * rejected Session throws `AuthoringError`.
 *
 * @example
 * copy("src/template.ts", "src/generated/output.ts");
 */
export declare function copy(from: string, to: string, opts?: {
    force?: boolean;
}): WritableHandle;
/**
 * Returns the Directives still pending in the active Session's buffer, rendered in
 * author vocabulary.
 *
 * Only what is still pending appears — the honest answer to "what will this Session
 * still emit", not "what has this Session emitted in total." A `read()` (or any flush)
 * drains the pending buffer, so Directives already sent no longer appear.
 *
 * Entries carry verb and path — no content or byte preview — plus an optional `kind`
 * (`"rendered" | "copied"`) present only on the package-local-read verbs whose transport
 * is classified: `create` (inline or `templateFile`, `kind: "rendered"`) and `copyIn`
 * (`kind: "copied"`). The tree→tree `copy` verb also materializes content but predates
 * this axis and is never package-local-read/classified, so it carries no `kind`.
 *
 * Call it inside an active factory invocation, like every other `./commons` verb.
 *
 * @example
 * const run = () => {
 *   create("src/index.ts", { template: "export const version = '1.0.0';", options: {} });
 *   find("src/legacy.ts").remove();
 *   for (const entry of pendingDirectives()) {
 *     console.log(entry.verb, entry.path); // "create src/index.ts", then "remove src/legacy.ts"
 *   }
 * };
 *
 * @throws When called outside an active factory invocation, propagates the standard
 * error — authoring verbs "can only be used while a schematic is running" (ADR-0026: the
 * message no longer enumerates individual verbs, so it covers `pendingDirectives` too).
 */
export declare function pendingDirectives(): PendingDirective[];
