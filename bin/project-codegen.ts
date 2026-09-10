import { lstatSync, statSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isErrnoException } from "../src/core/fs-errors.ts";
import { isPlainObject } from "../src/core/schema/schema-model.ts";

type ProjectEntry = { kind: "target"; label: string; directory: string }
  | { kind: "failure"; label: string; diagnostic: string };
type ProjectDiscovery = { ok: true; root: string; entries: ProjectEntry[] }
  | { ok: false; diagnostic: string };

function readObject(path: string): { [key: string]: unknown } {
  // Static nonregular inputs must not reach a blocking JSON read.
  if (!statSync(path).isFile()) throw new Error("nonregular input");
  const value: unknown = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  if (!isPlainObject(value)) throw new Error("invalid object");
  return value;
}

export function discoverProject(directory?: string): ProjectDiscovery {
  let selected = resolve(directory ?? process.cwd());
  if (directory === undefined) {
    for (;;) {
      try {
        lstatSync(join(selected, "project-builder.json"));
        break;
      } catch (error) {
        if (!isErrnoException(error) || error.code !== "ENOENT") {
          return { ok: false, diagnostic: `cannot load project configuration at ${JSON.stringify(selected)}` };
        }
      }
      const parent = dirname(selected);
      if (parent === selected) return { ok: false, diagnostic: "project-builder.json not found" };
      selected = parent;
    }
  }

  let root: string;
  let collections: { [key: string]: unknown };
  try {
    root = realpathSync(selected);
    const config = readObject(join(root, "project-builder.json"));
    const value = Object.hasOwn(config, "collections") ? config.collections : {};
    if (!isPlainObject(value)) throw new Error("invalid collections");
    collections = value;
  } catch {
    return { ok: false, diagnostic: `cannot load project configuration at ${JSON.stringify(selected)}` };
  }

  const entries: ProjectEntry[] = [];
  for (const name of Object.keys(collections).sort()) {
    const collection = collections[name];
    if (!isPlainObject(collection)) {
      entries.push({ kind: "failure", label: name, diagnostic: "collection must be an object" });
      continue;
    }
    if (typeof collection.path === "string") {
      let manifest: { [key: string]: unknown };
      const path = resolve(root, collection.path);
      try {
        const value = readObject(path);
        const schematics = Object.hasOwn(value, "schematics") ? value.schematics : {};
        if (!isPlainObject(schematics)) throw new Error("invalid schematics");
        manifest = schematics;
      } catch {
        entries.push({ kind: "failure", label: name, diagnostic: `cannot load collection manifest ${JSON.stringify(path)}` });
        continue;
      }
      for (const key of Object.keys(manifest).sort()) {
        const label = `${name}/${key}`;
        const registration = manifest[key];
        const pointer = isPlainObject(registration) ? registration.factory : undefined;
        const split = typeof pointer === "string" ? pointer.lastIndexOf("#") : -1;
        if (typeof pointer !== "string" || split <= 0 || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(pointer.slice(split + 1))) {
          entries.push({ kind: "failure", label, diagnostic: "factory must name a module and explicit export (module#export)" });
          continue;
        }
        const module = resolve(dirname(path), pointer.slice(0, split));
        try {
          if (!statSync(module).isFile()) throw new Error("nonregular module");
          entries.push({ kind: "target", label, directory: dirname(realpathSync(module)) });
        } catch {
          entries.push({ kind: "failure", label, diagnostic: `cannot resolve factory module ${JSON.stringify(module)}` });
        }
      }
      continue;
    }
    const inline = Object.hasOwn(collection, "schematics") ? collection.schematics : {};
    if (!isPlainObject(inline)) {
      entries.push({ kind: "failure", label: name, diagnostic: "inline schematics must be an object" });
      continue;
    }
    const directKeys = Object.keys(collection).filter((key) => key !== "schematics");
    for (const key of [...new Set([...directKeys, ...Object.keys(inline)])].sort()) {
      const label = `${name}/${key}`;
      if (Object.hasOwn(inline, key)) {
        entries.push({ kind: "failure", label, diagnostic: Object.hasOwn(collection, key) ? "ambiguous direct and inline registration" : "inline inputs have no file target" });
        continue;
      }
      const registration = collection[key];
      if (!isPlainObject(registration) || typeof registration.path !== "string" || registration.path.length === 0) {
        entries.push({ kind: "failure", label, diagnostic: "schematic must name a directory path" });
        continue;
      }
      const path = resolve(root, registration.path);
      try {
        if (!statSync(path).isDirectory()) throw new Error("not a directory");
        let factories = 0;
        for (const leaf of ["factory.ts", "factory.js"]) {
          try {
            if (!statSync(join(path, leaf)).isFile()) throw new Error("nonregular factory");
            factories++;
          } catch (error) {
            if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
          }
        }
        if (factories !== 1) throw new Error("ambiguous or missing factory");
        entries.push({ kind: "target", label, directory: realpathSync(path) });
      } catch {
        entries.push({ kind: "failure", label, diagnostic: `directory requires exactly one regular factory.ts or factory.js: ${JSON.stringify(path)}` });
      }
    }
  }
  return { ok: true, root, entries };
}
