// [red-proof] FIT-27 (S-003, verify-in-loop-5 finding #1): a corpus self-heal whose write
// call never mentions the corpus path LITERAL in its own arguments — the path arrives
// through a chain of plain declarations instead. This is the NATURAL shape of a corpus
// writer (scripts/regen-corpus.ts itself builds its paths exactly this way), so a scan
// matching only the literal inside the call's argument list misses it. Never
// imported/executed — scanned as text only. Excluded from tsconfig (test/fixtures/red/**,
// repo FIT-21 idiom).
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CORPUS_DIR = "test/e2e/author-emulation/corpus";

export function selfHealThroughVariable(name: string, text: string): void {
  const dir = CORPUS_DIR;
  writeFileSync(join(dir, name), text);
}
