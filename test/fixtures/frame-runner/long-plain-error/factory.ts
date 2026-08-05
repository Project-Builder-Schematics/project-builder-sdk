// REQ-RUN-09.4 fixture: a plain Error whose message alone exceeds MESSAGE_CEILING_CHARS —
// proves the composed note's cap discipline (boundMessage) still applies to an uncurated,
// scrubbed message, not just curated-class text.
import { MESSAGE_CEILING_CHARS } from "../../../../src/transport/error-text.ts";

export default function frameRunnerLongPlainErrorFactory(): void {
  throw new Error("x".repeat(MESSAGE_CEILING_CHARS + 500));
}
