// A-14 fixture: a package declaring a string Result. `kind: "number"` returns a value that
// does not match it, so the runner must fail the run before anything is written.
import { create } from "../../../../src/index.ts";

export default function frameRunnerResultFactory(input: { kind: "string" | "number" }): string | number {
  create("r.txt", { template: "root", options: {} });
  return input.kind === "number" ? 7 : "hello";
}
