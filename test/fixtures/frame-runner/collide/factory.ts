// REQ-EXC-01.2 fixture (item b): a write collision — two `create()` calls at the SAME
// path in one batch — so the host's `ir.emit` rejects with `code:"collision"`, which
// `Session.flush()` translates to `AuthoringError{origin:"write-rejected"}` (exit 2).
import { create } from "../../../../src/index.ts";

export default function frameRunnerCollideFactory(): void {
  create("out.txt", { template: "first", options: {} });
  create("out.txt", { template: "second", options: {} });
}
