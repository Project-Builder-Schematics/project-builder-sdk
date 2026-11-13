/**
 * The run lookup a Dialect handle uses (run-context.ts): looked up at each step from the
 * process-global run store, never captured when the handle is made and never bound by the
 * module that starts runs. Three behaviors pinned here:
 * - outside any run, an op rejects with the same AuthoringError{authoring-rejected,
 *   outside-session} even when only a dialect subpath was imported;
 * - a handle made at module top level, and one handle reused across two runs, keep working;
 * - a handle from one copy of the SDK joins a run started by another copy.
 */
import { afterAll, describe, it, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineFactory } from "../../../../../src/core/context.ts";
import { AuthoringError } from "../../../../../src/core/authoring-error.ts";
import { buildGraph } from "../../../../support/layering/graph.ts";
import { makeSpyClient, collectModifies } from "../../../../support/spy-client.ts";
import { toyDialect } from "../../../../fixtures/toy-dialect/index.ts";

const ROOT = new URL("../../../../../", import.meta.url).pathname;

function runChild(script: string): { stdout: string; stderr: string; status: number | null } {
  const child = spawnSync(process.execPath, ["-e", script], { cwd: ROOT, encoding: "utf-8" });
  return { stdout: child.stdout, stderr: child.stderr, status: child.status };
}

const fields = (e: AuthoringError): Record<string, unknown> => ({
  name: e.name,
  message: e.message,
  verb: e.verb,
  path: e.path,
  reason: e.reason,
  appliedCount: e.appliedCount,
});

describe("run-context — outside any run", () => {
  it("importing only a dialect subpath loads no module that starts runs", () => {
    const { edges } = buildGraph(ROOT);
    const reached = new Set<string>();
    const queue = ["src/dialects/typescript/index.ts"];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (reached.has(file) || !file.startsWith("src/")) continue;
      reached.add(file);
      for (const e of edges) if (e.from === file) queue.push(e.to);
    }
    expect(reached.size).toBeGreaterThan(5);
    expect(reached).not.toContain("src/core/context.ts");
  });

  it("an op rejects with AuthoringError{outside-session}, the same error as before", () => {
    const expected = fields(new AuthoringError({ verb: undefined, path: undefined, reason: "outside-session", appliedCount: 0 }));
    const { stdout, stderr, status } = runChild(`
      const ts = await import(${JSON.stringify(join(ROOT, "src/dialects/typescript/index.ts"))});
      try {
        await ts.find("a.ts").modify(() => {});
        console.log(JSON.stringify({ resolved: true }));
      } catch (e) {
        console.log(JSON.stringify({ name: e.name, message: e.message, verb: e.verb, path: e.path, reason: e.reason, appliedCount: e.appliedCount }));
      }
    `);
    expect({ stderr, status }).toEqual({ stderr: "", status: 0 });
    expect(JSON.parse(stdout)).toEqual(JSON.parse(JSON.stringify(expected)));
  });
});

describe("run-context — the lookup happens at each step", () => {
  // Made at module top level, outside any run.
  const topLevel = toyDialect.find("a.toy");

  it("a handle made at module top level works inside a later run", async () => {
    const { client, emitted } = makeSpyClient({ "a.toy": "seed" });
    await defineFactory<void>(async () => {
      await topLevel.push("line");
    })(undefined, { client });
    expect(collectModifies(emitted).map((m) => m.modify.content)).toEqual(["seed\nline"]);
  });

  it("one handle reused across two runs emits into each run", async () => {
    const handle = toyDialect.find("b.toy");
    const first = makeSpyClient({ "b.toy": "seed" });
    await defineFactory<void>(async () => {
      await handle.push("one");
    })(undefined, { client: first.client });
    const second = makeSpyClient({ "b.toy": "seed" });
    await defineFactory<void>(async () => {
      await handle.push("two");
    })(undefined, { client: second.client });
    expect(collectModifies(first.emitted).map((m) => m.modify.content)).toEqual(["seed\none"]);
    expect(collectModifies(second.emitted).map((m) => m.modify.content)).toEqual(["seed\none\ntwo"]);
  });
});

describe("run-context — two copies of the SDK in one process", () => {
  const copy = mkdtempSync(join(tmpdir(), "pbuilder-run-context-"));
  cpSync(join(ROOT, "src"), join(copy, "src"), { recursive: true });
  symlinkSync(join(ROOT, "node_modules"), join(copy, "node_modules"));
  afterAll(() => rmSync(copy, { recursive: true, force: true }));

  it("a handle from copy A joins a run that copy B started", () => {
    // Copy A provides only the dialect handle (the toy fixture over this repo's kit); copy B
    // provides only defineFactory. Neither copy's other half is ever imported.
    const { stdout, stderr, status } = runChild(`
      const { defineFactory } = await import(${JSON.stringify(join(copy, "src/core/context.ts"))});
      const { toyDialect } = await import(${JSON.stringify(join(ROOT, "test/fixtures/toy-dialect/index.ts"))});
      const emitted = [];
      const client = {
        async emit(batch) { emitted.push(batch); },
        async read(path) { return path === "a.toy" ? "seed" : undefined; },
        async commit() {},
        async discard() {},
      };
      await defineFactory(async () => { await toyDialect.find("a.toy").push("line"); })(undefined, { client });
      console.log(JSON.stringify(emitted.flatMap((b) => b.instructions).filter((d) => d.op === "modify").map((d) => d.modify.content)));
    `);
    expect({ stderr, status }).toEqual({ stderr: "", status: 0 });
    expect(JSON.parse(stdout)).toEqual(["seed\nline"]);
  });
});
