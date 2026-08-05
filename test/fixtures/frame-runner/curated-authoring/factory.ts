// REQ-RUN-09.3 fixture: throws AuthoringError directly from the factory body — pins the
// terminal catch's curated-class branch (byte-identical, unscrubbed note), independent of
// the engine-rejection path that raises AuthoringError in production (REQ-EXC-01).
import { invalidInput } from "../../../../src/core/authoring-error.ts";

export default function frameRunnerCuratedAuthoringFactory(): void {
  throw invalidInput("curated-authoring fixture: known AuthoringError message");
}
