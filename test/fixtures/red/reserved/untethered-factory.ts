// Deliberately-red fixture (FIT-16 3rd signal, Gap 10, SEC-2c) — a defineFactory call whose
// options argument is never supplied, so the runtime reserved-name/schema-validation throw
// would silently never fire even if this package shipped a schema.json. Never walked by the
// always-on gates; driven by a direct hasUntetheredDefineFactory(source) call in
// test/fitness/fit-16-reserved-name-scan.test.ts. NOTE: this comment block must never
// contain the literal opt-in token itself (the substring check the test drives) — that
// would defeat the fixture's own purpose.
import { defineFactory } from "../../../src/core/context.ts";

export const run = defineFactory<{ port: number }>((input) => {
  void input;
});
