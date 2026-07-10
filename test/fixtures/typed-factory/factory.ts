// Reference schematic (REQ-FPS-04.1) — schema-derived typed defineFactory<Input>, run
// end-to-end against ContractFake in test/e2e/typed-factory.e2e.test.ts. No `./testing`
// dependency (out of scope, stage-4b).

import { defineFactory } from "../../../src/core/context.ts";
import { create } from "../../../src/commons/index.ts";
import type { Input } from "./schema.generated.ts";

export const run = defineFactory<Input>(
  (input) => {
    create("server.config.ts", {
      template: "export const port = {{port}};",
      options: { port: input.port },
    });
  },
  { packageDir: import.meta.dir }
);
