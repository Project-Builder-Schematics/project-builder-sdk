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
// REQ-TOE-01.5: a null-prototype object (Object.create(null)) is a plain, dict-like data
// container and encodes like any other plain object — only a prototype OUTSIDE
// {Object.prototype, null} (Date/Map/class instances) is non-plain (REQ-TOE-04, S-002).
function isPlainObject(v: unknown): v is { [key: string]: JsonValue } {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// REQ-TOE-04: names the offending value's kind for the reject message. Date/Map get their
// own recognizable name; everything else non-plain (custom class instances) is generic.
function kindOf(value: object): string {
  if (value instanceof Date) return "Date";
  if (value instanceof Map) return "Map";
  return "a class instance";
}

// REQ-TOE-04, ADR-03: plain Error (interim — full AuthoringError attribution is a
// registered followup, ADR-03 Consequence). Message template pinned verbatim (slices.md
// Executor Context, TW-F1): names the top-level offending key, the offending kind + a
// dotted/indexed location, and echoes docs §8's allowed set for actionability. NEVER raw
// serializer text (no "Do not know how to serialize a BigInt", no "Converting circular
// structure to JSON").
function rejectOption(optionKey: string, detail: string): never {
  throw new Error(
    `option "${optionKey}" is not a plain-JSON value the engine can render (${detail}). ` +
      "Options must be strings, numbers, booleans, null, arrays, or plain objects."
  );
}

// REQ-TOE-04: recursively rejects any value (top-level or nested inside a composite) that
// is undefined, a function, a symbol, a BigInt, a circular reference, or a non-plain object
// (Date/Map/class instance) — never a silent drop (JSON.stringify's own undefined/function
// behavior) and never a raw serializer TypeError.
// ARCH-F2 (design §4.3): `ancestors` is an ANCESTOR-PATH set — added on descent, removed on
// ascent (add-recurse-delete, scoped per top-level call via the default parameter) — never a
// global "ever-visited" set. Only a value that is its own ancestor (a true cycle) rejects; an
// acyclic SHARED reference (`const s = {x:1}; {a:s,b:s}`) is revisited from a clean ancestor
// path each time and encodes normally, matching native JSON.stringify.
function assertEncodable(
  value: unknown,
  optionKey: string,
  ancestors: Set<object> = new Set(),
  path: string = optionKey
): void {
  if (value === undefined) rejectOption(optionKey, `undefined at ${path}`);
  if (typeof value === "function") rejectOption(optionKey, `function at ${path}`);
  if (typeof value === "symbol") rejectOption(optionKey, `symbol at ${path}`);
  if (typeof value === "bigint") rejectOption(optionKey, `BigInt at ${path}`);
  if (value === null || typeof value !== "object") return; // string/number/boolean/null: fine

  if (Array.isArray(value) || isPlainObject(value)) {
    if (ancestors.has(value)) rejectOption(optionKey, `a circular reference at ${path}`);
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        value.forEach((item, i) => assertEncodable(item, optionKey, ancestors, `${path}[${i}]`));
      } else {
        for (const [k, v] of Object.entries(value)) {
          assertEncodable(v, optionKey, ancestors, `${path}.${k}`);
        }
      }
    } finally {
      ancestors.delete(value);
    }
    return;
  }

  rejectOption(optionKey, `${kindOf(value)} at ${path}`);
}

export function encodeOptions(options: JsonValue): JsonValue {
  if (!isPlainObject(options)) return options;

  const result: { [key: string]: JsonValue } = {};
  for (const [key, value] of Object.entries(options)) {
    assertEncodable(value, key);
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
