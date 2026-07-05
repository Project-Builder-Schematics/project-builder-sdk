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
 * `read()` resolves `string | undefined`: the content, `undefined` when the path does not
 * exist, or `""` when the file exists but is empty. Branch on the three outcomes with strict
 * `=== undefined` / `=== ""` — NEVER `if (!content)`, which would merge `undefined`, `""`,
 * `"0"` and `"false"` and reintroduce the absent-vs-empty bug.
 *
 * @example
 * const c = await find("src/config.ts").read();
 * if (c === undefined) create("src/config.ts", { template, options });
 * else if (c === "") modify("src/config.ts", seedContent);
 * else modify("src/config.ts", patch(c));
 */
export declare function find(path: string): FoundHandle;
/**
 * Schedules a file-creation directive and returns a `WritableHandle` for chaining.
 * The file is written when the session flushes — on the next `read()` call (REQ-KIT-02)
 * or at run end (REQ-KIT-05). A factory that never calls `read()` still emits all
 * buffered directives when the runner resolves.
 *
 * SEAM-01 (REQ-01): a generic type parameter `S` narrows `options` from the bare
 * `JsonValue` to the schema's keys at the type level only — the runtime body is unchanged.
 *
 * @example
 * create("src/index.ts", {
 *   template: "export const version = '{{version}}';",
 *   options: { version: "1.0.0" },
 * });
 */
export declare function create<S>(path: string, opts: {
    template: string;
    options: {
        [K in keyof S]: S[K];
    };
    force?: boolean;
}): WritableHandle;
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
export declare function move(path: string, toDir: string, opts?: {
    force?: boolean;
}): WritableHandle;
/**
 * Schedules a file copy to a new path and returns a `WritableHandle` for the destination.
 *
 * @example
 * copy("src/template.ts", "src/generated/output.ts");
 */
export declare function copy(from: string, to: string, opts?: {
    force?: boolean;
}): WritableHandle;
//# sourceMappingURL=index.d.ts.map