import type { JsonValue } from "../core/wire.ts";
import type { FoundHandle, WritableHandle } from "../core/handle-state.ts";
export type { FoundHandle, WritableHandle };
/**
 * Options for the `create` author verb.
 *
 * @example
 * const opts: CreateOptions = {
 *   template: "export const {{name}} = '{{value}}';",
 *   options: { name: "greeting", value: "hello" },
 * };
 */
export interface CreateOptions {
    template: string;
    options: JsonValue;
    force?: boolean;
}
/**
 * Locates an existing file and returns a `FoundHandle` for reading or removing it.
 *
 * @example
 * const handle = find("src/config.ts");
 * const content = await handle.read();
 */
export declare function find(path: string): FoundHandle;
/**
 * Schedules a file-creation directive and returns a `WritableHandle` for chaining.
 * The file is written when the session flushes — on the next `read()` call (REQ-KIT-02)
 * or at run end (REQ-KIT-05). A factory that never calls `read()` still emits all
 * buffered directives when the runner resolves.
 *
 * @example
 * create("src/index.ts", {
 *   template: "export const version = '{{version}}';",
 *   options: { version: "1.0.0" },
 * });
 */
export declare function create(path: string, opts: CreateOptions): WritableHandle;
/**
 * Schedules an in-place content replacement for an existing file and returns a `WritableHandle`.
 *
 * @example
 * modify("src/config.json", '{ "version": "2.0.0" }');
 */
export declare function modify(path: string, content: string): WritableHandle;
/**
 * Schedules a file deletion. Idempotent — deleting an absent file is not an error.
 *
 * @example
 * remove("src/legacy.ts");
 */
export declare function remove(path: string): void;
/**
 * Schedules a file rename (basename only) and returns a `WritableHandle` for the new path.
 *
 * @example
 * rename("src/foo.ts", "bar.ts");
 */
export declare function rename(path: string, newName: string, opts?: {
    force?: boolean;
}): WritableHandle;
/**
 * Schedules a file move to a different directory and returns a `WritableHandle`.
 *
 * @example
 * move("src/utils/helper.ts", "src/shared");
 */
export declare function move(path: string, toDir: string): WritableHandle;
/**
 * Schedules a file copy to a new path and returns a `WritableHandle` for the destination.
 *
 * @example
 * copy("src/template.ts", "src/generated/output.ts");
 */
export declare function copy(from: string, to: string, opts?: {
    force?: boolean;
}): WritableHandle;
