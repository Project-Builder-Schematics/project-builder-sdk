// The authoring verbs behind the commons facade: each buffers its directive on the active
// run's Session and returns the handle for the path it leaves behind.

import { posix } from "node:path";
import type { JsonValue } from "../../../domain/valueobjects/wire.ts";
import { currentContext } from "../run-factory/context.ts";
import { forceEntry } from "../../../domain/services/directive-factory.ts";
import type { FoundHandle, WritableHandle } from "../../../domain/entities/handle-state.ts";
import { renderPendingDirectives } from "../pending-directives/index.ts";
import type { PendingDirective } from "../pending-directives/render.ts";
import type { GlobOptions } from "../../../domain/services/define-dialect.ts";

// Pure factory for WritableHandle. Returned by every write verb.
function buildWritableHandle(path: string): WritableHandle {
  return {
    read(): Promise<string | undefined> {
      const { session } = currentContext();
      return session.read(path);
    },
    replaceContent(content: string): WritableHandle {
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
    replaceContent(content: string): WritableHandle {
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
 * else if (c === "") replaceContent("src/config.ts", seedContent);
 * else replaceContent("src/config.ts", patch(c));
 */
export function find(path: string): FoundHandle {
  return buildFoundHandle(path);
}

/**
 * Opens every file `pattern` matches as a `FoundHandle`, ordered by path, leaving out every file
 * an `ignore` pattern matches; resolves `[]` when none matches (A-130). `*` matches within one
 * path segment, `?` one character, `**` any number of segments and `{a,b}` either alternative;
 * every other character is literal, so `ignore` is the only way to leave files out. It sees the
 * run (A-131): a file created earlier is listed, one removed earlier is not. Unlike `find`, it
 * is asynchronous, because it lists files first.
 *
 * @example
 * for (const file of await glob("src/domain/**", { ignore: ["**\/*.test.ts"] })) {
 *   const content = await file.read();
 * }
 */
export async function glob(pattern: string, options?: GlobOptions): Promise<FoundHandle[]> {
  const paths = await currentContext().session.list(pattern, options?.ignore);
  return paths.map(buildFoundHandle);
}

// `template` receives the defaulted options and runs after the active run is resolved, so a
// call outside a run fails before any template file is read.
export function create(
  path: string,
  opts: { options: JsonValue | undefined; force?: boolean },
  template: (options: JsonValue) => string
): WritableHandle {
  const { session, factory } = currentContext();
  // The wire requires `options`, and an omitted bag (untyped callers) would vanish in JSON and
  // fail the batch's round-trip check as unrepresentable content.
  const options = opts.options === undefined ? {} : opts.options;
  session.buffer(factory.create({
    pathTemplate: path,
    template: template(options),
    options,
    ...forceEntry(opts.force),
  }));
  return buildWritableHandle(path);
}

/**
 * Schedules an in-place content replacement for an existing file and returns a `WritableHandle`.
 * A rejected Session (e.g. the target does not exist) throws `AuthoringError`.
 *
 * @example
 * replaceContent("src/config.json", '{ "version": "2.0.0" }');
 */
export function replaceContent(path: string, content: string): WritableHandle {
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
 * rejected Session throws `AuthoringError`.
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
 * rejected Session throws `AuthoringError`.
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
 * rejected Session throws `AuthoringError`.
 *
 * @example
 * copy("src/template.ts", "src/generated/output.ts");
 */
export function copy(from: string, to: string, opts?: { force?: boolean }): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.copy({ from, to, ...forceEntry(opts?.force) }));
  return buildWritableHandle(to);
}

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
export function pendingDirectives(): PendingDirective[] {
  return renderPendingDirectives(currentContext().session.pendingDirectives());
}
