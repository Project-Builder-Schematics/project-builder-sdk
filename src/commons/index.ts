// Author surface: positional + trailing options, frozen public API (KIT-03/SKEL-01/KIT-04).
// No AST imports. All handle write-ops wired (S-003).

import type { JsonValue } from "../core/wire.ts";
import { currentContext } from "../core/context.ts";
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

// Pure factory for WritableHandle. Returned by every write verb.
function buildWritableHandle(path: string): WritableHandle {
  return {
    read(): Promise<string> {
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
      session.buffer(factory.rename({ path, newName, ...(opts?.force !== undefined ? { force: opts.force } : {}) }));
      return buildWritableHandle(newName);
    },
    move(toDir: string): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.move({ path, toDir }));
      return buildWritableHandle(path);
    },
    copy(to: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.copy({ from: path, to, ...(opts?.force !== undefined ? { force: opts.force } : {}) }));
      return buildWritableHandle(to);
    },
  };
}

// FoundHandle factory. Returned exclusively by find(). Has remove().
function buildFoundHandle(path: string): FoundHandle {
  return {
    read(): Promise<string> {
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
      session.buffer(factory.rename({ path, newName, ...(opts?.force !== undefined ? { force: opts.force } : {}) }));
      return buildWritableHandle(newName);
    },
    move(toDir: string): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.move({ path, toDir }));
      return buildWritableHandle(path);
    },
    copy(to: string, opts?: { force?: boolean }): WritableHandle {
      const { session, factory } = currentContext();
      session.buffer(factory.copy({ from: path, to, ...(opts?.force !== undefined ? { force: opts.force } : {}) }));
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
 * @example
 * const handle = find("src/config.ts");
 * const content = await handle.read();
 */
export function find(path: string): FoundHandle {
  return buildFoundHandle(path);
}

/**
 * Schedules a file-creation directive and returns a `WritableHandle` for chaining.
 * The file is written when the session flushes (on the next `read` or at run end).
 *
 * @example
 * create("src/index.ts", {
 *   template: "export const version = '{{version}}';",
 *   options: { version: "1.0.0" },
 * });
 */
export function create(path: string, opts: CreateOptions): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.create({
    pathTemplate: path,
    template: opts.template,
    options: opts.options,
    ...(opts.force !== undefined ? { force: opts.force } : {}),
  }));
  return buildWritableHandle(path);
}

/**
 * Schedules an in-place content replacement for an existing file and returns a `WritableHandle`.
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
 *
 * @example
 * rename("src/foo.ts", "bar.ts");
 */
export function rename(path: string, newName: string, opts?: { force?: boolean }): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.rename({ path, newName, ...(opts?.force !== undefined ? { force: opts.force } : {}) }));
  return buildWritableHandle(newName);
}

/**
 * Schedules a file move to a different directory and returns a `WritableHandle`.
 *
 * @example
 * move("src/utils/helper.ts", "src/shared");
 */
export function move(path: string, toDir: string): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.move({ path, toDir }));
  return buildWritableHandle(path);
}

/**
 * Schedules a file copy to a new path and returns a `WritableHandle` for the destination.
 *
 * @example
 * copy("src/template.ts", "src/generated/output.ts");
 */
export function copy(from: string, to: string, opts?: { force?: boolean }): WritableHandle {
  const { session, factory } = currentContext();
  session.buffer(factory.copy({ from, to, ...(opts?.force !== undefined ? { force: opts.force } : {}) }));
  return buildWritableHandle(to);
}
