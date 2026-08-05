// REQ-RUN-09.3 fixture: throws IntentRejectedError directly from the factory body — pins
// the terminal catch's curated-class branch (byte-identical, unscrubbed note), independent
// of the host-refusal path that raises IntentRejectedError in production (REQ-EXC-01).
import { IntentRejectedError } from "../../../../src/transport/stdio-engine-client.ts";

export default function frameRunnerCuratedIntentFactory(): void {
  throw new IntentRejectedError("curated-intent fixture: known IntentRejectedError message");
}
