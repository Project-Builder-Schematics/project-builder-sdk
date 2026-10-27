// Planted violation for A-11's extension rule. [permanent-fixture]
// The published `find` declares whatever extension it is handed, so it accepts every path
// while the fixture's dialect declares only `.ts`.
import { extname } from "node:path";
import { defineDialect } from "../../../src/core/define-dialect.ts";
import { parse, print } from "../../../src/dialects/typescript/ast.ts";
import { DIALECT_MODULES } from "../../support/dialect-modules.ts";

const typescript = DIALECT_MODULES[0];

export const undeclaredExtensionViolationFixture = {
  ...typescript,
  samples: [...typescript.samples],
  module: {
    ...typescript.module,
    find: (path: string) => defineDialect({ extensions: [extname(path)], ast: { parse, print }, ops: {} }).find(path),
  },
};
