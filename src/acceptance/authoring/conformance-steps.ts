import { expect } from "bun:test";
import { extname } from "node:path";
import * as jsonc from "jsonc-parser";
// Until sdk#103 makes the dialect kit public, these three internal modules are the only way to
// build a `Dialect`; fit-49 allows acceptance/ exactly these.
import { defineDialect, defineOpPack, withOps } from "../../bounded-contexts/authoring/domain/services/define-dialect.ts";
import { parse, print, type JsonDocument } from "../../bounded-contexts/authoring/infrastructure/out/dialects/json/ast.ts";
import * as jsonOps from "../../bounded-contexts/authoring/infrastructure/out/dialects/json/ops.ts";
import { testDialect, testOpPack, type DialectFixture, type OpExercise, type OpPackFixture } from "../../conformance/index.ts";
import * as json from "../../dialects/json/index.ts";
import type { JsonPath } from "../../dialects/json/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";

/** The dialect a scenario runs the fixture on: what running it means, and the rejection a planted defect must cause. */
interface Subject {
  readonly run: () => Promise<void>;
  readonly rejection?: RegExp;
  outcome?: { readonly rejection: unknown } | { readonly accepted: true };
}

const SUBJECT = "conformanceSubject";

const jsonDialect = defineDialect({ extensions: [".json", ".jsonc"], ast: { parse, print }, ops: {} });

const dialectFixture: DialectFixture<typeof jsonc> = {
  dialect: jsonDialect,
  samples: ['{\n  // comment\n  "a": [1, 2,],\n}\n', '{\r\n  "crlf": true\r\n}\r\n', "{}"],
  module: json,
  expectedAstLibrary: jsonc,
  libraryExercise: {
    path: "library.json",
    seed: '{\n  "name": "app"\n}\n',
    expect: '{\n  "name": "app",\n  "private": true\n}\n',
    modify(ast, library) {
      const doc = ast as JsonDocument;
      doc.text = library.applyEdits(doc.text, library.modify(doc.text, ["private"], true, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
    },
  },
};

const setTwice: OpExercise = {
  seed: '{\n  "name": "app"\n}\n',
  chain: [
    { op: "setValue", args: [["private"], true] },
    { op: "setValue", args: [["version"], "1.0.0"] },
  ],
  expect: '{\n  "name": "app",\n  "private": true,\n  "version": "1.0.0"\n}\n',
};

const FILES_A = '{\n  "files": [\n    "a"\n  ]\n}\n';
const FILES_AB = '{\n  "files": [\n    "a",\n    "b"\n  ]\n}\n';
const FILES_ABC = '{\n  "files": [\n    "a",\n    "b",\n    "c"\n  ]\n}\n';

function opFixture(ops: Record<string, unknown>, exercises: readonly OpExercise[], baseFind?: OpPackFixture["baseDialect"]["find"]): OpPackFixture {
  const opPack = defineOpPack(ops as OpPackFixture["opPack"]);
  const baseDialect = withOps(jsonDialect, opPack);
  return { opPack, baseDialect: baseFind === undefined ? baseDialect : { ...baseDialect, find: baseFind }, exercises };
}

// Every op call reads the file right after it, so one chain is flushed as several content writes.
function readingAfterEveryOp(fixture: OpPackFixture): OpPackFixture["baseDialect"]["find"] {
  const ops = new Set(Object.keys(fixture.opPack));
  return (path) => {
    const handle = fixture.baseDialect.find(path);
    const proxy: typeof handle = new Proxy(handle, {
      get(target, key) {
        const value = Reflect.get(target, key) as unknown;
        if (typeof key === "string" && ops.has(key) && typeof value === "function") {
          return (...args: unknown[]) => {
            value.apply(target, args);
            void target.read();
            return proxy;
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return proxy;
  };
}

const realOpFixture = opFixture({ setValue: jsonOps.setValue }, [setTwice]);

const PLANTED: Record<string, () => Subject> = {
  "print changes the bytes of an unedited file": () => ({
    run: () => testDialect({ ...dialectFixture, dialect: defineDialect({ extensions: [".json"], ast: { parse, print: (doc) => `${print(doc)} ` }, ops: {} }) }),
    rejection: /REQ-DC-01/,
  }),
  "chain of ops is sent as several content writes": () => ({
    run: () => testOpPack(opFixture({ setValue: jsonOps.setValue }, [setTwice], readingAfterEveryOp(realOpFixture))),
    rejection: /REQ-DC-02\/03 — expected exactly ONE modify directive/,
  }),
  "find accepts a file with an extension it does not declare": () => ({
    run: () =>
      testDialect({
        ...dialectFixture,
        module: { ...json, find: (path: string) => defineDialect({ extensions: [extname(path)], ast: { parse, print }, ops: {} }).find(path) },
      }),
    rejection: /undeclared extension/,
  }),
  "op applied to a file that already has its effect changes the file again": () => ({
    // A fresh function, so the op is not the JSON dialect's appendItem, which is declared repeatable.
    run: () =>
      testOpPack(
        opFixture(
          {
            setValue: jsonOps.setValue,
            appendAgain: (doc: JsonDocument, path: JsonPath, value: string) => jsonOps.appendItem(doc, path, value),
          },
          [setTwice, { seed: FILES_A, chain: [{ op: "appendAgain", args: [["files"], "b"] }], expect: FILES_AB }]
        )
      ),
    rejection: /A-11 idempotency/,
  }),
};

// The JSON dialect's own repeatable ops (A-11): appendItem without `unique` adds again, and
// removeItem at an index reaches another element.
const REPEATABLE: Record<string, OpExercise[]> = {
  "adds again on every application": [
    {
      seed: FILES_A,
      chain: [
        { op: "appendItem", args: [["files"], "b"] },
        { op: "appendItem", args: [["files"], "c"] },
      ],
      expect: FILES_ABC,
    },
  ],
  "acts on a position and reaches another element": [
    {
      seed: FILES_ABC,
      chain: [
        { op: "removeItem", args: [["files"], 0] },
        { op: "removeItem", args: [["files"], 0] },
      ],
      expect: '{\n  "files": [\n    "c"\n  ]\n}\n',
    },
  ],
};

function subject(world: World): Subject {
  const found = world[SUBJECT] as Subject | undefined;
  if (found === undefined) throw new Error("no dialect was given to the conformance fixture");
  return found;
}

function outcome(world: World): NonNullable<Subject["outcome"]> {
  const ran = subject(world).outcome;
  if (ran === undefined) throw new Error("the conformance fixture was not run on the dialect");
  return ran;
}

export const CONFORMANCE_STEPS: readonly StepDefinition[] = [
  {
    phrase: "a conforming dialect",
    run: (world) => {
      world[SUBJECT] = {
        run: async () => {
          await testDialect(dialectFixture);
          await testOpPack(realOpFixture);
        },
      } satisfies Subject;
    },
  },
  {
    phrase: 'a dialect whose "{defect}" is planted',
    run: (world, [defect]) => {
      const planted = PLANTED[defect as string];
      if (planted === undefined) throw new Error(`no dialect plants the defect "${String(defect)}"`);
      world[SUBJECT] = planted();
    },
  },
  {
    phrase: 'a conforming dialect with an op that "{effect}", declared repeatable',
    run: (world, [effect]) => {
      const exercises = REPEATABLE[effect as string];
      if (exercises === undefined) throw new Error(`no repeatable op has the effect "${String(effect)}"`);
      const op = (exercises[0]!.chain[0] as { op: string }).op;
      world[SUBJECT] = { run: () => testOpPack(opFixture({ [op]: jsonOps[op as keyof typeof jsonOps] }, [...exercises])) } satisfies Subject;
    },
  },
  {
    phrase: "the conformance fixture is run on the dialect",
    run: async (world) => {
      const dialect = subject(world);
      try {
        await dialect.run();
        dialect.outcome = { accepted: true };
      } catch (rejection) {
        dialect.outcome = { rejection };
      }
    },
  },
  {
    phrase: "the conformance fixture accepts the dialect",
    run: (world) => {
      const ran = outcome(world);
      if ("rejection" in ran) throw new Error(`the conformance fixture rejected the dialect: ${String(ran.rejection)}`);
    },
  },
  {
    phrase: "the conformance fixture rejects the dialect",
    run: (world) => {
      const ran = outcome(world);
      expect("rejection" in ran).toBe(true);
      // It says which part of the contract the dialect broke.
      const expected = subject(world).rejection;
      if (expected !== undefined && "rejection" in ran) expect(String(ran.rejection)).toMatch(expected);
    },
  },
];
