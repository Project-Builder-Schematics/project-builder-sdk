import { describe, it, expect } from "bun:test";
import * as angular from "../../../src/dialects/angular/index.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../../support/spy-client.ts";

const PATH = "src/app/counter.ts";

async function run(seed: string, apply: () => PromiseLike<void>) {
  const { client, emitted } = makeSpyClient({ [PATH]: seed });
  let caught: unknown;
  try {
    await defineFactory<void>(async () => {
      await apply();
    })(undefined, { client });
  } catch (err) {
    caught = err;
  }
  return { caught, modifies: collectModifies(emitted), content: await client.read(PATH) };
}

const COMPONENT = "@Component({})\nexport class Counter {\n  readonly step = input(1);\n\n  reset() {}\n}\n";

describe("angular addSignal / addComputed", () => {
  it("addSignal adds a protected readonly signal and imports signal", async () => {
    const { caught, modifies } = await run(COMPONENT, () => angular.find(PATH).addSignal("count", "0"));
    expect(caught).toBeUndefined();
    expect(modifies[0]?.modify.content).toBe(
      'import { signal } from "@angular/core";\n\n@Component({})\nexport class Counter {\n  readonly step = input(1);\n' +
        "  protected readonly count = signal(0);\n\n  reset() {}\n}\n"
    );
  });

  it("addSignal takes a type, a scope and the imports the type needs", async () => {
    const { modifies } = await run(COMPONENT, () =>
      angular.find(PATH).addSignal("user", "null", { type: "User | null", scope: "private", imports: [{ name: "User", from: "./user" }] })
    );
    expect(modifies[0]?.modify.content).toContain('import { User } from "./user";');
    expect(modifies[0]?.modify.content).toContain("  private readonly user = signal<User | null>(null);\n");
  });

  it("addComputed wraps the expression in an arrow function and imports computed", async () => {
    const { modifies } = await run(COMPONENT, () => angular.find(PATH).addComputed("double", "this.step() * 2"));
    expect(modifies[0]?.modify.content).toContain('import { computed } from "@angular/core";');
    expect(modifies[0]?.modify.content).toContain("  protected readonly double = computed(() => this.step() * 2);\n");
  });

  it("addComputed parenthesizes an object literal so it is not read as a block", async () => {
    const { modifies } = await run(COMPONENT, () => angular.find(PATH).addComputed("view", "{ step: this.step() }", { type: "{ step: number }" }));
    expect(modifies[0]?.modify.content).toContain("  protected readonly view = computed<{ step: number }>(() => ({ step: this.step() }));\n");
  });

  it("is a no-op when the same signal is already there", async () => {
    const seed = 'import { signal } from "@angular/core";\n\n@Component({})\nexport class Counter {\n  protected readonly count = signal(0);\n}\n';
    const { caught, modifies } = await run(seed, () => angular.find(PATH).addSignal("count", "0"));
    expect(caught).toBeUndefined();
    expect(modifies).toHaveLength(0);
  });

  it("rejects an expression that is not exactly one expression, leaving the file unchanged", async () => {
    const { caught, modifies, content } = await run(COMPONENT, () => angular.find(PATH).addComputed("x", "1); evil(("));
    expect((caught as Error).message).toContain("must be exactly one JavaScript expression");
    expect(modifies).toHaveLength(0);
    expect(content).toBe(COMPONENT);
  });

  it("rejects a class that is not a component or directive", async () => {
    const seed = "@Injectable()\nexport class Store {}\n";
    const { caught } = await run(seed, () => angular.find(PATH).addSignal("count", "0"));
    expect((caught as Error).message).toBe(
      `dialect operation failed: addSignal("count") on "${PATH}" — no class decorated with @Component or @Directive was found. Edit it with .modify().`
    );
  });
});
