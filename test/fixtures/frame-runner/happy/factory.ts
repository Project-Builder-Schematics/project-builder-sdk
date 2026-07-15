// Walking-skeleton fixture factory (S-000): one tree.read whose VALUE is embedded in the
// created file's content, so the e2e can assert the read round-tripped by value, not by
// call-count. Bare export — the runner wraps it via defineFactory (RUN-05).
import { find, create } from "../../../../src/index.ts";

export default async function frameRunnerHappyFactory(_input: Record<string, never>): Promise<void> {
  const seeded = await find("seed.txt").read();
  create("out.txt", { template: `read:${seeded ?? "<missing>"}`, options: {} });
}
