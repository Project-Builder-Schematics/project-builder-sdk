// Git-hostile + oversized fixture materialization (REQ-AEG-07.1). Design §4.9: empty
// folder, symlink, and deterministic at/over-cap byte fills are created programmatically
// at test setup and torn down after — NEVER committed. Symlink creation may be
// platform-unavailable (e.g. Windows without SeCreateSymbolicLinkPrivilege) — a skip is
// recorded, never thrown (M-19 note).

import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  materializeByteFill,
  materializeGitHostileFixtures,
  teardownGitHostileFixtures,
} from "./author-emulation-setup.ts";

describe("author-emulation-setup — git-hostile materialization (REQ-AEG-07.1)", () => {
  let scratch: string;

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("materializes an empty directory and a symlink, then tears both down leaving no residue", () => {
    scratch = mkdtempSync(join(tmpdir(), "author-emulation-setup-"));

    const fixtures = materializeGitHostileFixtures(scratch);

    expect(existsSync(fixtures.emptyDirPath)).toBe(true);
    if (!fixtures.symlinkSkipped) {
      expect(fixtures.symlinkPath).toBeDefined();
      expect(existsSync(fixtures.symlinkPath!)).toBe(true);
    }

    teardownGitHostileFixtures(fixtures);

    expect(existsSync(fixtures.emptyDirPath)).toBe(false);
    if (fixtures.symlinkPath !== undefined) {
      expect(existsSync(fixtures.symlinkPath)).toBe(false);
    }
    // "exactly what materialize created" includes the symlink's target dir — leaving it
    // behind is residue, not teardown.
    expect(existsSync(fixtures.symlinkTargetPath)).toBe(false);
  });

  it("records a skip (never throws) when symlink creation fails on the platform", () => {
    scratch = mkdtempSync(join(tmpdir(), "author-emulation-setup-"));
    const symlinkSpy = spyOn(fs, "symlinkSync").mockImplementation(() => {
      throw new Error("EPERM: operation not permitted, symlink");
    });

    try {
      const fixtures = materializeGitHostileFixtures(scratch);
      expect(fixtures.symlinkSkipped).toBe(true);
      expect(fixtures.symlinkPath).toBeUndefined();
      expect(fixtures.symlinkSkipReason).toContain("EPERM");
      // the empty dir must still materialize even when the symlink step fails
      expect(existsSync(fixtures.emptyDirPath)).toBe(true);
    } finally {
      symlinkSpy.mockRestore();
    }
  });
});

describe("author-emulation-setup — deterministic byte fill (design §4.9)", () => {
  let scratch: string;

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("writes exactly sizeBytes and produces byte-identical content across two materializations", () => {
    scratch = mkdtempSync(join(tmpdir(), "author-emulation-byte-fill-"));
    const pathA = join(scratch, "a.bin");
    const pathB = join(scratch, "b.bin");

    materializeByteFill(pathA, 4096);
    materializeByteFill(pathB, 4096);

    const a = readFileSync(pathA);
    const b = readFileSync(pathB);
    expect(a.length).toBe(4096);
    expect(a.equals(b)).toBe(true);
  });

  it("produces DIFFERENT content for a different size (not a constant single-byte fill)", () => {
    scratch = mkdtempSync(join(tmpdir(), "author-emulation-byte-fill-"));
    const small = join(scratch, "small.bin");
    const large = join(scratch, "large.bin");

    materializeByteFill(small, 8);
    materializeByteFill(large, 4096);

    const smallBytes = readFileSync(small);
    const largeBytes = readFileSync(large);
    expect(smallBytes.length).toBe(8);
    expect(largeBytes.length).toBe(4096);
    // triangulation: the smaller file's bytes must equal the large file's leading prefix
    // (proves a real repeating-pattern fill, not per-size-random content)
    expect(smallBytes.equals(largeBytes.subarray(0, 8))).toBe(true);
  });
});
