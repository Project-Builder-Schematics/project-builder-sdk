// Author surface: positional + trailing options, frozen public API (KIT-03/SKEL-01/KIT-04).
// No AST imports. All handle write-ops wired (S-003).

import { posix } from "node:path";
import type { JsonValue } from "../core/wire.ts";
import { currentContext } from "../core/context.ts";
import { forceEntry } from "../core/directive-factory.ts";
import type { FoundHandle, WritableHandle } from "../core/handle-state.ts";
import { AuthoringError } from "../core/authoring-error.ts";
import type { AuthoringVerb, AuthoringReason, AuthoringOrigin } from "../core/authoring-error.ts";
import { readTemplateFile, runScaffold, runCopyIn } from "../scaffold/index.ts";
import type { ScaffoldArgs } from "../scaffold/index.ts";

export type { FoundHandle, WritableHandle };
// ADR-0023: AuthoringError (+ its supporting types) is an author-facing DATA type, not
// kit MACHINERY (the port, the session, the directive factory stay unexported) — it
// legitimately crosses the ADR-0009 boundary via the same two-step pattern
// FoundHandle/WritableHandle already use.
export { AuthoringError };
export type { AuthoringVerb, AuthoringReason, AuthoringOrigin };

// 2.3 (CQ-1, droppable): classifyContent + ContentState give authors a named,
// branchable read-result classification (see find()'s JSDoc pointer below). Severable
// from the AuthoringError cluster above — no other component references it.
export { classifyContent } from "./classify-content.ts";
export type { ContentState } from "./classify-content.ts";

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
 * Options for the `create({ templateFile })` render request — an explicit, package-local
 * alternative to an inline `template` string (REQ-FEH-01). `templateFile` is a
 * package-relative path (resolved against the active run's `packageDir`), read at
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

// Pure factory for WritableHandle. Returned by every write verb.
function buildWritableHandle(path: string): WritableHandle {
  return {
    read(): Promise<string | undefined> {
      const { session } = currentContext();
      return session.read(path);
    },
    modify(content: string): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.modify({ path, content }));
      return buildWritableHandle(path);
    },
    rename(newName: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.rename({ path, newName, ...forceEntry(opts?.force) }));
      const dir = posix.dirname(path);
      return buildWritableHandle(dir === "." ? newName : posix.join(dir, newName));
    },
    move(toDir: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.move({ path, toDir, ...forceEntry(opts?.force) }));
      return buildWritableHandle(posix.join(toDir, posix.basename(path)));
    },
    copy(to: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.copy({ from: path, to, ...forceEntry(opts?.force) }));
      return buildWritableHandle(to);
    },
  };
}

// FoundHandle factory. Returned exclusively by find(). Has remove().
function buildFoundHandle(path: string): FoundHandle {
  return {
    read(): Promise<string | undefined> {
      const { session } = currentContext();
      return session.read(path);
    },
    modify(content: string): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.modify({ path, content }));
      return buildWritableHandle(path);
    },
    rename(newName: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.rename({ path, newName, ...forceEntry(opts?.force) }));
      const dir = posix.dirname(path);
      return buildWritableHandle(dir === "." ? newName : posix.join(dir, newName));
    },
    move(toDir: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.move({ path, toDir, ...forceEntry(opts?.force) }));
      return buildWritableHandle(posix.join(toDir, posix.basename(path)));
    },
    copy(to: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.copy({ from: path, to, ...forceEntry(opts?.force) }));
      return buildWritableHandle(to);
    },
    remove(): void {
      const { session, factory } = currentContext();
      session.buffer(factory.remove({ path }));
    },
  };
}

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
 * else if (c === "") modify("src/config.ts", seedContent);
 * else modify("src/config.ts", patch(c));
 */
export function find(path: string): FoundHandle {
  return buildFoundHandle(path);
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
 * rejected run throws `AuthoringError`.
 *
 * `templateFile` is a THIRD overload (REQ-FEH-01): pass a package-local path instead of an
 * inline `template` string — its content is read at emission time and becomes the
 * directive's `template` field. `template` and `templateFile` are mutually exclusive forms;
 * only usable inside a factory run started with packageDir (there is no resolution anchor
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
 *   template: "export const version = '{{version}}';",
 *   options: { version: "1.0.0" },
 * });
 * @example
 * create("src/index.ts", {
 *   templateFile: "index.ts.template",
 *   options: { version: "1.0.0" },
 * });
 */
export function create<S>(
  path: string,
  opts: { template: string; options: { [K in keyof S]: S[K] }; force?: boolean }
): WritableHandle;
export function create(path: string, opts: CreateOptions): WritableHandle;
export function create(path: string, opts: CreateFromTemplateFileOptions): WritableHandle;
export function create(path: string, opts: CreateOptions | CreateFromTemplateFileOptions): WritableHandle {
  const { session, factory } = currentContext();
  const template =
    "templateFile" in opts ? readTemplateFile(opts.templateFile, path, opts.options, opts.force) : opts.template;
  session.buffer(factory.create({
    pathTemplate: path,
    template,
    options: opts.options,
    ...forceEntry(opts.force),
  }));
  return buildWritableHandle(path);
}

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
 * Walks a package-local folder (`from`, resolved against the active run's `packageDir`)
 * and mirrors every entry into `to`, applying the rename → filename-token-translation →
 * `.template`-strip pipeline (REQ-FSC-05) and include/exclude glob filtering (REQ-FSC-03,
 * `exclude` wins on overlap). Each source classifies by-value or by-reference
 * (`content-classification`, entirely sniffed — never author-declared); by-value sources
 * emit a `create` directive through the existing IR. A `from` folder with zero entries
 * no-ops silently; `include`/`exclude` eliminating every entry rejects fail-loud, naming
 * the filters (REQ-FSC-04 — two distinct outcomes, never collapsed). `force` (default
 * `false`) passes through unchanged to every emitted directive, no per-file override
 * (REQ-FSC-06). Two or more sources collapsing to the same destination reject fail-loud,
 * naming every offending source (REQ-FSC-08). Only usable inside a
 * factory run started with packageDir — there is no resolution anchor to walk a
 * package-local folder against otherwise (`invalid-input`, never a cwd fallback).
 *
 * `rename` is a static REMAP TABLE (`Record<originalSourceRelativePath,
 * newDestinationRelativePath>`), matched against the ORIGINAL (pre-token-translation)
 * source path — distinct from the `rename()` verb, which renames one already-targeted
 * file's basename at emit time, not a folder-walk's per-entry destination.
 *
 * The walk never descends into a symlinked directory, even when its target resolves
 * INSIDE the package boundary (skipped silently, no error — uniform with
 * `package-root-containment`'s no-descent rule) and is capped at 10,000 enumerated
 * entries per call, failing loud and naming the bound past that (REQ-FSC-09) — a
 * resource guard no real schematic collection should approach.
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
export function scaffold(args: ScaffoldOptions): void {
  runScaffold(args);
}

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
 * factory run started with packageDir — there is no resolution anchor to read a
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
export function copyIn(from: string, to: string, opts?: { force?: boolean }): void {
  runCopyIn({ from, to, force: opts?.force });
}

/**
 * Schedules an in-place content replacement for an existing file and returns a `WritableHandle`.
 * A rejected run (e.g. the target does not exist) throws `AuthoringError`.
 *
 * @example
 * modify("src/config.json", '{ "version": "2.0.0" }');
 */
export function modify(path: string, content: string): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.modify({ path, content }));
  return buildWritableHandle(path);
}

/**
 * Schedules a file deletion. Idempotent — deleting an absent file is not an error.
 *
 * @example
 * remove("src/legacy.ts");
 */
export function remove(path: string): void {
  const { session, factory } = currentContext();
  session.buffer(factory.remove({ path }));
}

/**
 * Schedules a file rename (basename only) and returns a `WritableHandle` for the new path.
 * Renaming onto an existing path is rejected at the engine seam unless
 * `{ force: true }` is passed (overwrite-on-collision, ADR-0017 fail-closed) — a
 * rejected run throws `AuthoringError`.
 *
 * @example
 * rename("src/foo.ts", "bar.ts");
 */
export function rename(path: string, newName: string, opts?: { force?: boolean }): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.rename({ path, newName, ...forceEntry(opts?.force) }));
  const dir = posix.dirname(path);
  return buildWritableHandle(dir === "." ? newName : posix.join(dir, newName));
}

/**
 * Schedules a file move to a different directory and returns a `WritableHandle`.
 * Moving onto an existing destination is rejected at the engine seam unless
 * `{ force: true }` is passed (overwrite-on-collision, ADR-0017 fail-closed) — a
 * rejected run throws `AuthoringError`.
 * A move whose destination equals its source is a no-op, never a collision
 * (ADR-0017 self-move amendment).
 *
 * @example
 * move("src/utils/helper.ts", "src/shared");
 */
export function move(path: string, toDir: string, opts?: { force?: boolean }): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.move({ path, toDir, ...forceEntry(opts?.force) }));
  return buildWritableHandle(posix.join(toDir, posix.basename(path)));
}

/**
 * Schedules a file copy to a new path and returns a `WritableHandle` for the destination.
 * Copying onto an existing destination is rejected at the engine seam unless
 * `{ force: true }` is passed (overwrite-on-collision, ADR-0017 fail-closed) — a
 * rejected run throws `AuthoringError`.
 *
 * @example
 * copy("src/template.ts", "src/generated/output.ts");
 */
export function copy(from: string, to: string, opts?: { force?: boolean }): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.copy({ from, to, ...forceEntry(opts?.force) }));
  return buildWritableHandle(to);
}

// --- Stage 3: dry-run plan exposure (REQ-DRE-01..04) ---
import { dryRunPlan } from "../dry-run/index.ts";
import type { DryRunEntry, DryRunVerb } from "../dry-run/plan.ts";

export type { DryRunEntry, DryRunVerb };

/**
 * Returns the plan of directives still pending in the active run's buffer, rendered
 * in author vocabulary.
 *
 * The plan reflects only what is still pending — the honest answer to "what will this
 * run still emit", not "what has this run emitted in total." A `read()` (or any flush)
 * empties the pending buffer, so directives already flushed no longer appear.
 *
 * Entries carry verb and path — no content or byte preview — plus an optional `kind`
 * (`"rendered" | "copied"`) present only on the package-local-read verbs whose transport
 * is classified: `create` (inline or `templateFile`, `kind: "rendered"`) and `copyIn`
 * (`kind: "copied"`). The tree→tree `copy` verb also materializes content but predates
 * this axis and is never package-local-read/classified, so it carries no `kind`.
 *
 * Call it inside an active factory run, like every other `./commons` verb.
 *
 * @example
 * const run = () => {
 *   create("src/index.ts", { template: "export const version = '1.0.0';", options: {} });
 *   find("src/legacy.ts").remove();
 *   for (const entry of dryRun()) {
 *     console.log(entry.verb, entry.path); // "create src/index.ts", then "remove src/legacy.ts"
 *   }
 * };
 *
 * @throws When called outside an active factory run, propagates the standard
 * error — authoring verbs "can only be used while a schematic is running" (ADR-0026: the
 * message no longer enumerates individual verbs, so it covers `dryRun` too).
 */
export function dryRun(): DryRunEntry[] {
  return dryRunPlan(currentContext().session.pendingSnapshot());
}
