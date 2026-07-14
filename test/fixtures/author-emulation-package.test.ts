// Static shape checks for the author-emulation fixture package (REQ-AEG-04.1/05.1). No
// factory execution here — that is S-003's e2e territory (matrix rows M-04..M-08 etc). This
// only asserts the COMMITTED fixture content itself: a chained multi-filter token filename
// exists in the template tree, and the binary assets are `.gitattributes`-marked so git
// never attempts a text diff on them.

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dir, "author-emulation");
const FILES_DIR = join(FIXTURE_DIR, "files");

// D3: 2+ chained `@filter` segments inside a double-underscore token, e.g.
// `__name@singular@dasherize__`.
const CHAINED_TOKEN_RE = /__[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+){2,}__/;

function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFilesRecursive(full) : [full];
  });
}

describe("author-emulation fixture package — static shape (REQ-AEG-04.1/05.1)", () => {
  it("REQ-AEG-05.1 — the files/ tree ships a chained multi-filter token filename", () => {
    const names = listFilesRecursive(FILES_DIR).map((p) => p.slice(FILES_DIR.length + 1));
    const chained = names.filter((name) => CHAINED_TOKEN_RE.test(name));
    expect(chained.length).toBeGreaterThan(0);
  });

  it("REQ-AEG-04.1 — .gitattributes marks the binary asset patterns as binary", () => {
    const gitattributes = readFileSync(join(FIXTURE_DIR, ".gitattributes"), "utf-8");
    expect(gitattributes).toContain("*.png binary");
    expect(gitattributes).toContain("*.bin.template binary");
  });

  it("REQ-AEG-04.1 — the binary asset itself is real (non-UTF-8) content, not text", () => {
    const bytes = readFileSync(join(FIXTURE_DIR, "assets", "logo.png"));
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });
});
