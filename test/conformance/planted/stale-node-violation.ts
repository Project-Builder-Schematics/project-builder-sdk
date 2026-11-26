// Planted violation for A-11's stale-node rule. [permanent-fixture]
// The dialect's ast has no `retire`, so a node kept from a tree the handle re-parsed away from
// stays usable and edits a tree no file reflects.
import { defineDialect } from "../../../src/bounded-contexts/authoring/domain/services/define-dialect.ts";
import { parse, print } from "../../../src/bounded-contexts/authoring/infrastructure/out/dialects/typescript/ast.ts";
import { DIALECT_MODULES } from "../../support/dialect-modules.ts";

const typescript = DIALECT_MODULES[0];

export const staleNodeViolationFixture = {
  ...typescript,
  samples: [...typescript.samples],
  dialect: defineDialect({ extensions: [".ts"], ast: { parse, print }, ops: {} }),
};
