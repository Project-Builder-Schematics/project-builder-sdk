/**
 * REQ-PRC-01..09 (S-002, design §Test Derivation): the dual-anchor containment model —
 * realpath-based, segment-aware, case-fold ceiling check + regular-file allow-list for a
 * SOURCE path, plus the lexical-only destination guard (PRC-09). Unit level —
 * `validateSourceContainment`/`isWithinCeiling`/`validateDestinationLexical` are called
 * directly against real scratch files/symlinks; no `defineFactory` run needed.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import {
  isWithinCeiling,
  validateSourceContainment,
  validateDestinationLexical,
} from "../../src/scaffold/containment.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const scratchDir = scratchDirFactory("containment-");

function expectReason(fn: () => unknown, reason: AuthoringError["reason"]): AuthoringError {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(AuthoringError);
  expect((caught as AuthoringError).reason).toEqual(reason);
  expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
  return caught as AuthoringError;
}

describe("REQ-PRC-01.1 — resolution anchor and containment ceiling are distinct", () => {
  it("a source under a nested packageDir passes both resolution (packageDir) and containment (packageRoot, an ancestor)", () => {
    const root = scratchDir(); // marker seeded directly at root — root IS the ceiling
    const packageDir = join(root, "packages", "foo");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "a.ts"), "content", "utf-8");

    const { absPath } = validateSourceContainment({ packageDir, packageRoot: root, relPath: "a.ts" });

    // absPath is the REALPATH'd form — may differ lexically from `join(packageDir, ...)`
    // on platforms with a symlinked tmp root (e.g. macOS's `/var` → `/private/var`).
    expect(absPath).toEqual(realpathSync(join(packageDir, "a.ts")));
  });
});

describe("REQ-PRC-04 — source containment (realpath, segment-aware, regular-file allow-list)", () => {
  it("REQ-PRC-04.1: a traversal string ('..' segment) rejects source-outside-package before any read", () => {
    const dir = scratchDir();
    expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "../../etc/passwd" }),
      "source-outside-package"
    );
  });

  it("REQ-PRC-04.2/.7: a symlink lexically inside the ceiling whose realpath resolves outside it rejects source-outside-package", () => {
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "containment-external-"));
    try {
      writeFileSync(join(external, "secret.txt"), "outside", "utf-8");
      symlinkSync(join(external, "secret.txt"), join(dir, "link.txt"));

      expectReason(
        () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "link.txt" }),
        "source-outside-package"
      );
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("REQ-PRC-04.3: a directory presented as a source rejects source-not-regular-file", () => {
    const dir = scratchDir();
    mkdirSync(join(dir, "adir"));

    expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "adir" }),
      "source-not-regular-file"
    );
  });

  it("REQ-PRC-04.4: a non-regular, non-directory source (FIFO, stubbed lstat — unfixturable in CI) rejects source-not-regular-file via the allow-list branch", () => {
    const dir = scratchDir();
    const path = join(dir, "fifo-stub");
    writeFileSync(path, "", "utf-8"); // a real file so realpath succeeds; only lstat is stubbed
    const realPath = realpathSync(path); // containment.ts lstats the REALPATH'd form, not the lexical one
    const originalLstatSync = fs.lstatSync;
    const lstatSpy = spyOn(fs, "lstatSync").mockImplementation(((...args: Parameters<typeof fs.lstatSync>) => {
      if (args[0] === realPath) {
        return {
          isFile: () => false,
          isDirectory: () => false,
          isSymbolicLink: () => false,
        } as unknown as ReturnType<typeof fs.lstatSync>;
      }
      return originalLstatSync(...args);
    }) as typeof fs.lstatSync);

    try {
      expectReason(
        () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "fifo-stub" }),
        "source-not-regular-file"
      );
    } finally {
      lstatSpy.mockRestore();
    }
  });

  it("REQ-PRC-04.5: sibling-prefix path rejected — segment-aware comparison kills the bare-startsWith mutant", () => {
    expect(isWithinCeiling("/pkg-evil/x", "/pkg")).toBe(false);
    expect(isWithinCeiling("/pkg/x", "/pkg")).toBe(true);
    expect(isWithinCeiling("/pkg", "/pkg")).toBe(true);
  });

  it("Q24 case-folding: a case-mismatched candidate/ceiling pair folds on case-insensitive platforms ONLY (win32/darwin), never on case-sensitive ones", () => {
    // Product ruling Q24 (design S4): segment comparison case-folds on case-insensitive
    // platforms only. Both directions asserted per the CURRENT platform, so this test is
    // meaningful wherever the suite runs — on darwin/win32 the folded pair is WITHIN
    // (killing a fold-removal mutant); on linux it is OUTSIDE (killing an
    // unconditional-fold mutant).
    const foldsHere = process.platform === "darwin" || process.platform === "win32";
    expect(isWithinCeiling("/PKG/x", "/pkg")).toBe(foldsHere);
    expect(isWithinCeiling("/pkg/Sub/File.ts", "/PKG")).toBe(foldsHere);
    // Case-identical pairs are within regardless of platform (fold is a no-op on them).
    expect(isWithinCeiling("/pkg/x", "/pkg")).toBe(true);
  });

  it("REQ-PRC-04.6: an absolute-path source with no '..' segment rejects source-outside-package", () => {
    const dir = scratchDir();
    expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "/etc/passwd" }),
      "source-outside-package"
    );
  });
});

describe("REQ-PRC-05.1 — rejection messages are package-relative, never an absolute filesystem path", () => {
  it("a source-outside-package rejection names the relPath, not an absolute path", () => {
    const dir = scratchDir();
    const err = expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "../outside.txt" }),
      "source-outside-package"
    );
    expect(err.message).toContain("../outside.txt");
    expect(err.message).not.toContain(dir);
  });
});

describe("REQ-PRC-07 — no existence oracle for out-of-ceiling paths", () => {
  it("REQ-PRC-07.1: an existing and a non-existing out-of-ceiling target are indistinguishable (same reason + message shape)", () => {
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "containment-external-"));
    try {
      writeFileSync(join(external, "real.txt"), "content", "utf-8");
      const existingRel = relative(dir, join(external, "real.txt"));
      const missingRel = relative(dir, join(external, "does-not-exist.txt"));

      const errExisting = expectReason(
        () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: existingRel }),
        "source-outside-package"
      );
      const errMissing = expectReason(
        () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: missingRel }),
        "source-outside-package"
      );

      expect(errExisting.reason).toEqual(errMissing.reason);
      expect(errExisting.origin).toEqual(errMissing.origin);
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("REQ-PRC-07.2 (S1 ENOENT ordering): a broken symlink to an out-of-ceiling target rejects source-outside-package, never source-not-found", () => {
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "containment-external-"));
    try {
      // Target never created — the symlink is broken by construction.
      symlinkSync(join(external, "never-created.txt"), join(dir, "broken-link.txt"));

      expectReason(
        () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "broken-link.txt" }),
        "source-outside-package"
      );
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("REQ-PRC-07.2 positive control (verify-in-loop-4 CRITICAL regression): a broken symlink whose ABSOLUTE target is lexically IN-ceiling classifies source-not-found, never source-outside-package", () => {
    // The evaluator's repro: the symlink's raw absolute target text is in LEXICAL space
    // (/var/... on macOS), while the ceiling comparison operates in REAL space
    // (/private/var/...) — a branch that returns the raw target un-realpath'd
    // false-rejects this in-ceiling case as source-outside-package.
    const dir = scratchDir();
    symlinkSync(join(dir, "sub", "never-created.txt"), join(dir, "broken-inside.txt"));

    expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "broken-inside.txt" }),
      "source-not-found"
    );
  });

  it("REQ-PRC-07.2 positive control (relative-target sibling branch): a broken symlink whose RELATIVE target is in-ceiling classifies source-not-found", () => {
    const dir = scratchDir();
    symlinkSync(join("sub", "never-created.txt"), join(dir, "broken-inside-rel.txt"));

    expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "broken-inside-rel.txt" }),
      "source-not-found"
    );
  });

  it("S1 ENOENT ordering — plain (non-symlink) case: a missing in-ceiling source classifies source-not-found", () => {
    const dir = scratchDir();

    expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "missing.ts" }),
      "source-not-found"
    );
  });

  it("a missing in-ceiling source nested under a missing directory still classifies source-not-found (ancestor walk climbs past a missing dir too)", () => {
    const dir = scratchDir();

    expectReason(
      () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "nonexistent-dir/file.ts" }),
      "source-not-found"
    );
  });
});

describe("REQ-PRC-08.1 — containment completes before any content read", () => {
  it("zero readFileSync calls for an out-of-ceiling source", () => {
    const dir = scratchDir();
    const readSpy = spyOn(fs, "readFileSync");
    try {
      expectReason(
        () => validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "../../etc/passwd" }),
        "source-outside-package"
      );
      expect(readSpy).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
    }
  });

  it("returns the lstat Stats alongside absPath for a valid in-ceiling regular file — no content read performed by this module", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "a.ts"), "hello", "utf-8");
    const readSpy = spyOn(fs, "readFileSync");

    try {
      const { absPath, stat } = validateSourceContainment({ packageDir: dir, packageRoot: dir, relPath: "a.ts" });
      expect(absPath).toEqual(realpathSync(join(dir, "a.ts")));
      expect(stat.isFile()).toBe(true);
      expect(readSpy).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
      // sanity: the file is still readable through the untouched real fs
      expect(readFileSync(join(dir, "a.ts"), "utf-8")).toEqual("hello");
    }
  });
});

describe("REQ-PRC-09.1 — destination lexical guard (literal '../' or absolute 'to' rejected pre-emit)", () => {
  it("a literal '..' segment in the computed destination rejects invalid-input", () => {
    let caught: unknown;
    try {
      validateDestinationLexical("../escape.svg");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    expect((caught as AuthoringError).origin).toEqual("authoring-rejected");
  });

  it("an absolute computed destination rejects invalid-input", () => {
    let caught: unknown;
    try {
      validateDestinationLexical("/abs/path");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
  });

  it("a well-formed relative destination passes silently", () => {
    expect(() => validateDestinationLexical("out/nested/file.ts")).not.toThrow();
  });
});
