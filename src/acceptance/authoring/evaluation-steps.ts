import { expect } from "bun:test";
import * as commons from "../../commons/index.ts";
import { AuthoringError } from "../../commons/index.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { endedRun, expectSuccess, factoryRun, ranRun } from "../shared/factory-run.ts";

/** The roles the scenario's Collection definition entries declare, by schematic name. */
export function declaredRoles(world: World): Map<string, string> {
  world.roles ??= new Map<string, string>();
  return world.roles as Map<string, string>;
}

function runs(world: World, schematic: string, inputs: Record<string, unknown>): void {
  const run = factoryRun(world);
  run.schematic = schematic;
  run.inputs = inputs;
  run.role = declaredRoles(world).get(schematic);
}

function reports(world: World, finding: Record<string, unknown>): void {
  const run = factoryRun(world);
  run.actions.push(() => void run.findings.push({ ...finding, message: `${finding.rule as string} reported` }));
}

/** The findings of the Reply, after checking the run succeeded. */
async function replied(world: World): Promise<Array<Record<string, unknown>>> {
  await ranRun(world);
  expectSuccess(world);
  return (endedRun(world).result as { items: Array<Record<string, unknown>> }).items;
}

async function rejectedResult(world: World): Promise<string> {
  await ranRun(world);
  factoryRun(world).failureExpected = true;
  const error = endedRun(world).error;
  expect(error).toBeInstanceOf(AuthoringError);
  expect((error as AuthoringError).reason).toBe("invalid-result");
  return (error as AuthoringError).message;
}

const SOURCE_SET = "source is set by the SDK";

export const EVALUATION_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'the schematic "{schematic}" declares the role "{role}"',
    run: (world, [schematic, role]) => void declaredRoles(world).set(schematic as string, role as string),
  },
  {
    phrase: 'the factory is the schematic "{schematic}", run with no inputs',
    run: (world, [schematic]) => runs(world, schematic as string, {}),
  },
  {
    phrase: 'the factory is the schematic "{schematic}", run with the inputs:',
    run: (world, [schematic, table]) => {
      const [, ...rows] = table as string[][];
      runs(world, schematic as string, Object.fromEntries(rows.map(([input, value]) => [input!, JSON.parse(value!) as unknown])));
    },
  },
  {
    phrase: 'the author reports the finding "{rule}" with the severity "{severity}" for the path "{path}"',
    run: (world, [rule, severity, path]) => reports(world, { rule, severity, path }),
  },
  {
    phrase: 'the author reports the finding "{rule}" with the severity "{severity}" and no path',
    run: (world, [rule, severity]) => reports(world, { rule, severity }),
  },
  {
    phrase: 'the author reports the finding "{rule}" with the severity "{severity}" for the path "{path}" and the source "{source}"',
    run: (world, [rule, severity, path, source]) => reports(world, { rule, severity, path, source }),
  },
  {
    phrase: "the factory fails because its findings do not match the Findings shape",
    run: async (world) => void expect(await rejectedResult(world)).not.toContain(SOURCE_SET),
  },
  {
    phrase: "the factory fails because a finding sets its own source",
    run: async (world) => void expect(await rejectedResult(world)).toContain(SOURCE_SET),
  },
  {
    phrase: 'the Reply carries exactly the findings "{rules}"',
    run: async (world, [rules]) => void expect((await replied(world)).map((finding) => finding.rule).join(", ")).toBe(rules as string),
  },
  {
    phrase: 'the finding "{rule}" of the Reply has the source "{source}"',
    run: async (world, [rule, source]) => {
      const sources = (await replied(world)).filter((finding) => finding.rule === rule).map((finding) => finding.source);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every((each) => each === source)).toBe(true);
    },
  },
  {
    phrase: 'the recorded outcome is the content "{text}"',
    run: async (world, [text]) => {
      await ranRun(world);
      expect(world.outcome).toEqual({ value: text });
    },
  },
  {
    // Listed inside the running factory, so the listing is what that factory is offered.
    phrase: "the surface the SDK offers the factory is listed",
    run: async (world) => {
      factoryRun(world).actions.push(() => {
        world.surface = new Set(Object.keys(commons).filter((name) => typeof (commons as Record<string, unknown>)[name] === "function"));
      });
      await ranRun(world);
      expectSuccess(world);
    },
  },
];
