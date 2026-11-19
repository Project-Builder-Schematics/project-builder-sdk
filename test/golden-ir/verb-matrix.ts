// P-IR's verb matrix: one factory that calls every public commons verb and every handle
// method, through proxies that record what was actually called, so the coverage guard in
// batch-goldens.test.ts checks real calls rather than a hand-kept list.
import * as commons from "../../src/commons/index.ts";

export const VERB_MATRIX_PACKAGE_DIR = new URL("./fixtures/verb-matrix/", import.meta.url).pathname;

// Function exports that are not authoring verbs: they emit no directive.
export const NOT_VERBS: Readonly<Record<string, string>> = {
  AuthoringError: "the error class",
  classifyContent: "a pure content classifier",
};

export const VERB_MATRIX_SEED: Record<string, string> = Object.fromEntries(
  ["replace", "remove", "rename", "move", "copy", "f-read", "f-replace", "f-rename", "f-move", "f-copy", "f-remove"]
    .map((name) => [`seed/${name}.txt`, `seeded ${name}`])
    .concat([["root-rename.txt", "seeded root rename"]]),
);

type HandleKind = "found" | "writable";

export const calledVerbs = new Set<string>();
export const calledHandleMethods: Record<HandleKind, Set<string>> = { found: new Set(), writable: new Set() };
export const handleMethods: Record<HandleKind, Set<string>> = { found: new Set(), writable: new Set() };
export const observed: unknown[] = [];

function track<T>(value: T): T {
  if (typeof value !== "object" || value === null || !("read" in value)) return value;
  const kind: HandleKind = "remove" in value ? "found" : "writable";
  for (const key of Object.keys(value)) handleMethods[kind].add(key);
  return new Proxy(value, {
    get(target, key) {
      const member = Reflect.get(target, key) as unknown;
      if (typeof member !== "function" || typeof key !== "string") return member;
      return (...args: unknown[]) => {
        calledHandleMethods[kind].add(key);
        return track((member as (...a: unknown[]) => unknown).apply(target, args));
      };
    },
  });
}

const verbs = new Proxy(commons, {
  get(target, key) {
    const member = Reflect.get(target, key) as unknown;
    if (typeof member !== "function" || typeof key !== "string" || key in NOT_VERBS) return member;
    return (...args: unknown[]) => {
      calledVerbs.add(key);
      return track((member as (...a: unknown[]) => unknown)(...args));
    };
  },
}) as typeof commons;

export async function verbMatrix(input: { name: string }): Promise<void> {
  // Every returned handle writes once more, so the path it points at is part of the golden.
  verbs.create("created/plain.ts", { template: "export const name = '{= .name =}';", options: { name: input.name } }).replaceContent("plain returned");
  verbs.create("created/forced.ts", { template: "forced", options: {}, force: true }).replaceContent("forced returned");
  verbs.create("created/no-options.ts", { template: "no options" } as unknown as { template: string; options: object }).replaceContent("no options returned");
  verbs.create("created/from-file.ts", { templateFile: "templates/greeting.ts.template", options: { name: input.name } }).replaceContent("from file returned");
  verbs.scaffold({ from: "files", to: "scaffolded", options: { name: input.name } });
  verbs.copyIn("assets/note.txt", "copied/note.txt");

  verbs.replaceContent("seed/replace.txt", "replaced").replaceContent("replace returned");
  verbs.remove("seed/remove.txt");
  verbs.rename("root-rename.txt", "root-renamed.txt").replaceContent("root rename returned");
  verbs.rename("seed/rename.txt", "renamed.txt", { force: true }).replaceContent("rename returned");
  verbs.move("seed/move.txt", "moved", { force: true }).replaceContent("move returned");
  verbs.copy("seed/copy.txt", "copied/copy.txt", { force: true }).replaceContent("copy returned");

  observed.push(await verbs.find("seed/f-read.txt").read());
  verbs.find("seed/f-replace.txt").replaceContent("found replaced").replaceContent("found replace returned");
  verbs.find("seed/f-rename.txt").rename("f-renamed.txt", { force: true }).replaceContent("found rename returned");
  verbs.find("seed/f-move.txt").move("found-moved", { force: true }).replaceContent("found move returned");
  verbs.find("seed/f-copy.txt").copy("found-copied/f-copy.txt", { force: true }).replaceContent("found copy returned");
  verbs.find("seed/f-remove.txt").remove();

  const written = verbs.create("chain/start.txt", { template: "start", options: {} });
  observed.push(await written.read());
  written
    .replaceContent("chained")
    .rename("renamed.txt", { force: true })
    .move("chain-moved", { force: true })
    .copy("chain-copied/renamed.txt", { force: true })
    .replaceContent("chain returned");

  observed.push(verbs.pendingDirectives());
}
