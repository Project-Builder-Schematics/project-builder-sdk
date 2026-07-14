// [red-proof] FIT-25 (S-001): a second module wrapping `runFactoryForTest` — exactly the
// duplicate capture path FIT-25 exists to catch (REQ-FTG-03 / REQ-ITC-02). Never
// imported/executed — FIT-25's red-proof calls the capture-module-detection function
// directly against this fixture's presence. Excluded from tsconfig (test/fixtures/red/**,
// repo FIT-21 idiom).
import { runFactoryForTest } from "../../../../src/testing/index.ts";

export function decoyCaptureRun(run: unknown, input: unknown) {
  return runFactoryForTest(run as never, input);
}
