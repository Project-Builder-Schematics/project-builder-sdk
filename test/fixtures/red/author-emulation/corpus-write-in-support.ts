// [red-proof] FIT-27 (S-000): a test/support-shaped module that WRITES directly to the
// corpus directory — exactly the tautology FIT-27 exists to catch (REQ-GCC-05 / REQ-FTG-05).
// Never imported/executed — scanned as text only. Excluded from tsconfig
// (test/fixtures/red/**, repo FIT-21 idiom).
import { writeFileSync } from "node:fs";

export function regenerateInsideTest(text: string): void {
  writeFileSync("test/e2e/author-emulation/corpus/tautology.transcript.json", text);
}
