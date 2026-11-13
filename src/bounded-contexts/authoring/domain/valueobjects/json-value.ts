import { dialectError } from "./dialect-error.ts";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonPath = readonly (string | number)[];

/**
 * Renders a path for a rejection tail, e.g. `["scripts","build"]`. JSON encoding keeps a key
 * containing quotes or newlines on one unambiguous line.
 */
export function formatPath(path: JsonPath): string {
  return JSON.stringify(path);
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Rejects anything a JSON document cannot hold, before an op touches the document. Types alone
 * do not suffice: `as never`, `any`, and untyped JavaScript factories reach ops unchecked.
 */
export function assertJsonValue(value: unknown, where: JsonPath = [], seen: Set<object> = new Set()): asserts value is JsonValue {
  const fail = (what: string): never => {
    throw dialectError(`value at ${formatPath(where)} is ${what}, which JSON cannot represent.`);
  };
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(String(value));
    return;
  }
  if (typeof value !== "object") return fail(typeof value);
  if (seen.has(value)) fail("a cyclic reference");
  if (!Array.isArray(value) && !isPlainObject(value)) fail(`a ${value.constructor?.name ?? "non-plain"} instance`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, [...where, index], seen));
  } else {
    for (const [key, item] of Object.entries(value)) assertJsonValue(item, [...where, key], seen);
  }
  seen.delete(value);
}
