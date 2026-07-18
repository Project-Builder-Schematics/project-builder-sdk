// KIT-03: pure args→Directive; never renders templates, never touches AST.

import type { Directive, JsonValue } from "./wire.ts";

export interface CreateArgs {
  pathTemplate: string;
  template: string;
  options: JsonValue;
  force?: boolean;
}

export interface ModifyArgs {
  path: string;
  content: string;
}

export interface RemoveArgs {
  path: string;
}

export interface RenameArgs {
  path: string;
  newName: string;
  force?: boolean;
}

export interface MoveArgs {
  path: string;
  toDir: string;
  force?: boolean;
}

export interface CopyArgs {
  from: string;
  to: string;
  force?: boolean;
}

export interface CopyInArgs {
  from: string;
  to: string;
  force?: boolean;
}

// Key-omission semantics are spec-pinned: `"force" in directive === false` when undefined —
// never emit `force: undefined`.
export function forceEntry(force: boolean | undefined): { force?: boolean } {
  return force !== undefined ? { force } : {};
}

// REQ-TOE-01: shallow top-level composite (array/plain-object) -> JSON string; everything
// else passes through verbatim. Assembly uses Object.defineProperty (never spread/`result[k]=`)
// per REQ-TOE-05 — enumerable:true is load-bearing, defineProperty defaults it to false and an
// unenumerable key silently drops from JSON.stringify at the wire boundary.
function isPlainObject(v: unknown): v is { [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

export function encodeOptions(options: JsonValue): JsonValue {
  if (!isPlainObject(options)) return options;

  const result: { [key: string]: JsonValue } = {};
  for (const [key, value] of Object.entries(options)) {
    const encoded: JsonValue = Array.isArray(value) || isPlainObject(value) ? JSON.stringify(value) : value;
    Object.defineProperty(result, key, { value: encoded, enumerable: true, writable: true, configurable: true });
  }
  return result;
}

export class DirectiveFactory {
  create(a: CreateArgs): Directive {
    return {
      op: "create",
      create: {
        pathTemplate: a.pathTemplate,
        template: a.template,
        options: encodeOptions(a.options),
        ...forceEntry(a.force),
      },
    };
  }

  modify(a: ModifyArgs): Directive {
    return { op: "modify", modify: { path: a.path, content: a.content } };
  }

  // Author verb `remove` lowers to wire op `delete` — ADR-0013 vocabulary; they deliberately differ.
  remove(a: RemoveArgs): Directive {
    return { op: "delete", delete: { path: a.path } };
  }

  rename(a: RenameArgs): Directive {
    return {
      op: "rename",
      rename: {
        path: a.path,
        newName: a.newName,
        ...forceEntry(a.force),
      },
    };
  }

  move(a: MoveArgs): Directive {
    return {
      op: "move",
      move: {
        path: a.path,
        toDir: a.toDir,
        ...forceEntry(a.force),
      },
    };
  }

  // `copy` emits the ADR-0013 shape only — apply behaviour is deferred to vNext.
  copy(a: CopyArgs): Directive {
    return {
      op: "copy",
      copy: {
        from: a.from,
        to: a.to,
        ...forceEntry(a.force),
      },
    };
  }

  // `copyIn` mirrors `copy` exactly (ADR-0043) — the distinction is entirely in the `op`
  // name (package-read trust domain, REQ-BRC-02) and what the engine does with `from` at
  // apply time (resolves against packageDir, not tree-relative).
  copyIn(a: CopyInArgs): Directive {
    return {
      op: "copyIn",
      copyIn: {
        from: a.from,
        to: a.to,
        ...forceEntry(a.force),
      },
    };
  }
}
