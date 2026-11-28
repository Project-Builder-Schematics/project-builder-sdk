import type { JsonValue } from "../../../domain/valueobjects/wire.ts";
import type { FoundHandle, WritableHandle } from "../../../domain/entities/handle-state.ts";
import { AuthoringError } from "../../../domain/valueobjects/authoring-error.ts";
import type { AuthoringVerb, AuthoringReason, AuthoringOrigin } from "../../../domain/valueobjects/authoring-error.ts";
import type { ScaffoldArgs } from "../../../application/usecases/scaffold/index.ts";
export type { FoundHandle, WritableHandle };
export type { GlobOptions } from "../../../domain/services/define-dialect.ts";
export { AuthoringError };
export type { AuthoringVerb, AuthoringReason, AuthoringOrigin };
export { classifyContent } from "../../../domain/services/classify-content.ts";
export type { ContentState } from "../../../domain/services/classify-content.ts";
export { find, glob, replaceContent, remove, rename, move, copy, pendingDirectives } from "../../../application/usecases/authoring-verbs/index.ts";
/**
 * Options for the `create` author verb.
 *
 * @example
 * const opts: CreateOptions = {
 *   template: "export const {= .name =} = '{= .value =}';",
 *   options: { name: "greeting", value: "hello" },
 * };
 */
export interface CreateOptions {
    template: string;
    options: JsonValue;
    force?: boolean;
}
/**
 * Options for the `create({ templateFile })` render request — an explicit, package-local
 * alternative to an inline `template` string (REQ-FEH-01). `templateFile` is a
 * package-relative path (resolved against the active Session's `packageDir`), read at
 * emission time; its content becomes the `create` directive's `template` field —
 * the existing `create` IR, zero wire change. `templateFile` REQUESTS a render: a binary
 * or oversized source fails loud (`invalid-input`), it never silently falls back to a
 * by-reference copy (REQ-FEH-02).
 *
 * @example
 * const opts: CreateFromTemplateFileOptions = {
 *   templateFile: "tpl.ts.template",
 *   options: { name: "greeting" },
 * };
 */
export interface CreateFromTemplateFileOptions {
    templateFile: string;
    options: JsonValue;
    force?: boolean;
}
/**
 * Schedules a file-creation directive and returns a `WritableHandle` for chaining.
 * The file is written when the session flushes — on the next `read()` call (REQ-KIT-02)
 * or at run end (REQ-KIT-05). A factory that never calls `read()` still emits all
 * buffered directives when the runner resolves.
 *
 * SEAM-01 (REQ-01): a generic type parameter `S` narrows `options` from the bare
 * `JsonValue` to the schema's keys at the type level only — the runtime body is unchanged.
 *
 * Creating over an existing file is rejected at the engine seam unless
 * `{ force: true }` is passed (overwrite-on-collision, ADR-0017 fail-closed) — a
 * rejected Session throws `AuthoringError`.
 *
 * `templateFile` is a THIRD overload (REQ-FEH-01): pass a package-local path instead of an
 * inline `template` string — its content is read at emission time and becomes the
 * directive's `template` field. `template` and `templateFile` are mutually exclusive forms;
 * only usable inside a factory invocation started with packageDir (there is no resolution anchor
 * to read a package-local file against otherwise — `invalid-input`, never a cwd fallback).
 * `templateFile`'s VALUE is a literal package-relative path, read verbatim by CONTENT —
 * it is NOT run through `scaffold`'s filename pipeline (no rename remap, no `__x__` token
 * translation, no `.template`-suffix strip applied to the path itself); this is an
 * explicit REQUEST to render one named file, unlike `scaffold`'s per-entry filename
 * processing. Because `templateFile` REQUESTS a render, it has no silent by-reference
 * fallback (REQ-FEH-02): a binary file (a null byte or invalid UTF-8 anywhere in the
 * whole file) or a file too large to render inline (over the 4 MiB limit) both reject
 * fail-loud with reason `invalid-input` — never a silent copy.
 *
 * @example
 * create("src/index.ts", {
 *   template: "export const version = '{= .version =}';",
 *   options: { version: "1.0.0" },
 * });
 * @example
 * create("src/index.ts", {
 *   templateFile: "index.ts.template",
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
export declare function create(path: string, opts: CreateFromTemplateFileOptions): WritableHandle;
/**
 * Author-facing options for the `scaffold` verb — walks a package-local folder and mirrors
 * it into the target tree. `from`/`to` are mandatory. `options` defaults `{}`, `include`
 * defaults to matching everything, `exclude` defaults to matching nothing (`exclude` wins
 * on overlap), `rename` defaults to no remap, `force` defaults `false`.
 *
 * @example
 * const opts: ScaffoldOptions = {
 *   from: "files",
 *   to: "src/generated",
 *   options: { name: "Widget" },
 *   exclude: ["*.spec.ts"],
 * };
 */
export type ScaffoldOptions = ScaffoldArgs;
/**
 * Walks a package-local folder (`from`, resolved against the active Session's `packageDir`)
 * and mirrors every entry into `to`, applying the rename → filename-token-translation →
 * `.template`-strip pipeline (REQ-FSC-05) and include/exclude glob filtering (REQ-FSC-03,
 * `exclude` wins on overlap). A source matching one of the `binary` globs (against the same
 * original path) is copied byte for byte (`copyIn`); every other source renders through a
 * `create` directive. A source that cannot render rejects naming it, never falling back to a
 * copy: one that is not valid UTF-8 text (with a `binary: [...]` suggestion), one too large
 * for one emit frame (naming its size), or one both `.template`-marked and declared binary. A `from` folder with zero entries
 * no-ops silently; `include`/`exclude` eliminating every entry rejects fail-loud, naming
 * the filters (REQ-FSC-04 — two distinct outcomes, never collapsed). `force` (default
 * `false`) passes through unchanged to every emitted directive, no per-file override
 * (REQ-FSC-06). Two or more sources collapsing to the same destination reject fail-loud,
 * naming every offending source (REQ-FSC-08). Only usable inside a
 * factory invocation started with packageDir — there is no resolution anchor to walk a
 * package-local folder against otherwise (`invalid-input`, never a cwd fallback).
 *
 * `rename` is a static REMAP TABLE (`Record<originalSourceRelativePath,
 * newDestinationRelativePath>`), matched against the ORIGINAL (pre-token-translation)
 * source path — distinct from the `rename()` verb, which renames one already-targeted
 * file's basename at emit time, not a folder-walk's per-entry destination.
 *
 * A NESTED symlinked directory is never descended, regardless of where its target
 * resolves — skipped silently, no error; enumeration determinism and cycle-safety are the
 * rationale (a symlinked directory could point anywhere, including into a cycle — never
 * descending is the simplest invariant that is safe under all targets, REQ-FSC-09). The
 * walk ROOT (`from` itself) is held to a stricter standard: a symlinked root REJECTS
 * (`invalid-input`) rather than being followed or silently skipped (owner ruling 16) — but
 * this check inspects only `from`'s FINAL path component; a symlink at a MID-path segment
 * (e.g. `from: "link/sub"`) is not detected and the walk proceeds through it, the same
 * documented residual SECURITY.md covers for `create`/`copyIn` reads. The walk is capped
 * at 10,000 enumerated entries per call, failing loud and naming the bound past that
 * (REQ-FSC-09) — a loop-safety/DoS resource guard no real schematic collection should
 * approach.
 *
 * **Packaging caveat**: the empty-folder no-op (above) depends on `from` existing ON
 * DISK at run time — npm tarball packaging commonly DROPS empty directories, so an
 * empty `from` folder that relies on this no-op may not survive `npm publish` at all
 * (REQ-FSC-04). Ship at least a placeholder file if the folder's presence matters.
 *
 * Returns `void` (REQ-FSC-07) — fire-and-forget, no chainable handle group.
 *
 * @example
 * scaffold({ from: "files", to: "src/generated", options: { name: "Widget" } });
 */
export declare function scaffold(args: ScaffoldOptions): void;
/**
 * Emits a by-reference copy of ONE package-local file (`from`, resolved against the active
 * run's `packageDir`) to `to` — ALWAYS by-reference, NEVER classified or rendered
 * (REQ-FEH-03), regardless of the source's own text-vs-binary shape: a text asset
 * containing `{= =}`-like sequences (that `scaffold` would otherwise render as tokens)
 * travels verbatim — the documented escape from `scaffold`'s by-value classification
 * (`content-classification` REQ-CCL-04). Contrast with tree→tree `copy`: `copyIn`'s source
 * is a PACKAGE-LOCAL path read at emission time, not an existing tree entry.
 *
 * `from`/`to` are mandatory; `force` defaults `false`. A missing `from`/`to` rejects
 * fail-loud before any emission (REQ-FEH-04.1/.2). Collision without `force` rejects;
 * `force: true` overwrites (`by-reference-copy-wire` REQ-BRC-05). Only usable inside a
 * factory invocation started with packageDir — there is no resolution anchor to read a
 * package-local file against otherwise (`invalid-input`, never a cwd fallback).
 *
 * Returns `void` (REQ-FEH-04.3) — NOT a `WritableHandle`, unlike `copy`: a by-reference
 * destination's bytes exist only after the ENGINE applies the directive (the fake never
 * materializes them, `author-test-harness` REQ-ATH-15) — a handle chaining over tree
 * CONTENT would lie about content that was never staged. This asymmetry with `copy`
 * (which DOES stage tree→tree content the fake can chain over) is deliberate.
 *
 * @example
 * copyIn("assets/logo.svg", "src/generated/logo.svg");
 */
export declare function copyIn(from: string, to: string, opts?: {
    force?: boolean;
}): void;
import type { PendingDirective } from "../../../application/usecases/pending-directives/render.ts";
export type { PendingDirective };
