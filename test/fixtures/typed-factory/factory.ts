// Reference schematic (REQ-FPS-04.1) — schema-derived typed BARE factory, wrapped and run
// end-to-end against ContractFake in test/e2e/typed-factory.e2e.test.ts (the e2e test
// performs the core wrap primitive's `<Input>` wrap itself — this file exports the bare
// export the migration's runner/harness-internal audience wraps, never the wrapped
// runner). No `./testing` dependency (out of scope, stage-4b).

import { create } from "../../../src/commons/index.ts";
import type { Input } from "./schema.generated.ts";

export const PACKAGE_DIR = import.meta.dir;

export const run = (input: Input): void => {
  create("server.config.ts", {
    template: "export const port = {{port}};",
    options: { port: input.port },
  });
};
