// RUN-05 parity fixture (S-000.7): schema-carrying package, so schema-derived validation
// anchored at packageDir is the observable consequence compared between the runner's
// defineFactory wrap and runFactoryForTest — never a defineFactory-argument spy (RUN-05.1).
import { find, create } from "../../../../src/index.ts";

export default async function frameRunnerSchemaFactory(input: { name: string }): Promise<void> {
  const seeded = await find("seed.txt").read();
  create("out.txt", { template: `read:${seeded ?? "<missing>"}:name:${input.name}`, options: {} });
}
