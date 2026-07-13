// [red-proof] FIT-23/FIT-24 companion (S-000): a factory that embeds a FRESH value on
// every run — exactly the shape FIT-23's double-run comparison and FIT-24's purity scan
// exist to catch. Never used by a real scenario (SCENARIOS never references it); imported
// only by the fit-23/fit-24 red-proof tests. Excluded from tsconfig (test/fixtures/red/**,
// repo FIT-21 idiom).
import { randomUUID } from "node:crypto";
import { defineFactory } from "../../../../src/core/context.ts";
import { create } from "../../../../src/commons/index.ts";

export const run = defineFactory<{ tag: string }>((input) => {
  create("nondeterministic.txt", {
    template: "{{nonce}}",
    options: { tag: input.tag, nonce: randomUUID() },
  });
});
