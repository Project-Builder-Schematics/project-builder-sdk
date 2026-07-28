/**
 * S-001 (path-guards TOTAL hardening, design §4's error-mapping table + ADR-0077 §F/§G):
 * module-level unit coverage for `src/scaffold/path-guards.ts`'s three guards, called
 * DIRECTLY — an ADDITION to, never a substitute for, the per-verb integration rows
 * `test/e2e/scaffold.e2e.test.ts` / `test/scaffold/expander.test.ts` /
 * `test/conformance/copyin-parity.test.ts` re-verify (owned by S-003, which re-flips
 * those files' currently-red ceiling/marker expectations). Because all three read verbs
 * share this ONE module (ADR-0077 §G — one shared predicate, not three per-site copies),
 * proving the guard's behaviour here proves it for every verb that calls it.
 *
 * Scope note (S-001.4): the "no absolute path on the wire" half of REQ-IPF-03.1 is a
 * structural CONSEQUENCE of `validateSourceLexical`/`validateDestinationLexical` rejecting
 * every absolute-looking form before any directive is built (design §4) — proven here at
 * the guard level; the emitted-directive-scan proof itself lives in
 * `test/scaffold/expander.test.ts` (S-003, design §7 Test Derivation).
 *
 * Some rows below (plain missing-source, directory-as-source) already have a fixture at
 * `test/core/authoring-error-source.test.ts` via `classifyTransport` — not repeated here.
 * This file's rows are the ones with no existing coverage anywhere: broken-symlink,
 * ELOOP, embedded NUL, the resource-exhaustion errno collapse, FIFO, the degenerate
 * source strings, both symlink-accept scenarios, and the lexical screens themselves.
 */
import { describe, it, expect, spyOn } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { statSourceForRead, validateSourceLexical, validateDestinationLexical } from "../../src/scaffold/path-guards.ts";
import { expectReason } from "../support/expect-reason.ts";
import { scratchDirFactory } from "../support/scratch-dir.ts";

const originalStatSync = fs.statSync;

const scratchDir = scratchDirFactory("path-guards-");

describe("statSourceForRead — TOTAL guard, design §4 mapping row 0", () => {
  it("row 0: a non-string relPath rejects invalid-input before any fs call", () => {
    const dir = scratchDir();
    const statSpy = spyOn(fs, "statSync");
    try {
      expectReason(() => statSourceForRead({ packageDir: dir, relPath: 42 as unknown as string }), "invalid-input");
      expect(statSpy).not.toHaveBeenCalled();
    } finally {
      statSpy.mockRestore();
    }
  });
});

describe("statSourceForRead — TOTAL guard, design §4 mapping row 1 (existence)", () => {
  it("row 1: a broken symlink (target does not exist) rejects source-not-found, same as a plain missing path", () => {
    const dir = scratchDir();
    symlinkSync(join(dir, "never-created.txt"), join(dir, "broken.txt"));

    const err = expectReason(() => statSourceForRead({ packageDir: dir, relPath: "broken.txt" }), "source-not-found");

    expect(err.message).toEqual("source file not found: broken.txt does not exist in the package");
    expect(err.message).not.toContain(dir);
  });
});

describe("statSourceForRead — TOTAL guard, design §4 mapping row 2a (ELOOP)", () => {
  it("row 2a: a symlink cycle rejects source-unreadable, detail 'symlink cycle', no-echo", () => {
    const dir = scratchDir();
    symlinkSync("loop", join(dir, "loop")); // self-referential — statSync throws ELOOP

    const err = expectReason(() => statSourceForRead({ packageDir: dir, relPath: "loop" }), "source-unreadable");

    expect(err.message).toEqual("source file unreadable: loop could not be read (symlink cycle)");
    expect(err.message).not.toContain(dir);
  });
});

describe("statSourceForRead — TOTAL guard, design §4 mapping row 2b (embedded NUL)", () => {
  it("row 2b: an embedded NUL byte rejects source-unreadable with the fixed unprintable-path placeholder, never the raw bytes", () => {
    const dir = scratchDir();
    const relPath = "a\0b";

    const err = expectReason(() => statSourceForRead({ packageDir: dir, relPath }), "source-unreadable");

    expect(err.message).toEqual(
      "source file unreadable: <unprintable source path> could not be read (path contains an invalid character)"
    );
    // The `.path` field is the programmatic locator, not the human-readable surface — it
    // still carries the real relPath (design §4's comment on `sourceRejection`).
    expect(err.path).toEqual(relPath);
  });
});

describe("statSourceForRead — TOTAL guard, design §4 mapping row 2c (resource-exhaustion / permission errnos collapse)", () => {
  it("EACCES/EPERM/EMFILE/ENFILE/EINTR each map to source-unreadable, detail 'permission or I/O error' — the errno itself never interpolated", () => {
    const dir = scratchDir();
    const target = join(dir, "target.ts");
    writeFileSync(target, "content", "utf-8");

    for (const code of ["EACCES", "EPERM", "EMFILE", "ENFILE", "EINTR"]) {
      const statSpy = spyOn(fs, "statSync").mockImplementation(((...args: Parameters<typeof fs.statSync>) => {
        if (args[0] === target) {
          throw Object.assign(new Error(`${code}: simulated`), { code });
        }
        return originalStatSync(...(args as Parameters<typeof originalStatSync>));
      }) as typeof fs.statSync);

      try {
        const err = expectReason(() => statSourceForRead({ packageDir: dir, relPath: "target.ts" }), "source-unreadable");
        expect(err.message).toEqual("source file unreadable: target.ts could not be read (permission or I/O error)");
        expect(err.message).not.toContain(code);
      } finally {
        statSpy.mockRestore();
      }
    }
  });

  it("an unclassifiable failure with no `.code` at all still degrades to the same generic category, never a raw error", () => {
    const dir = scratchDir();
    const target = join(dir, "target.ts");
    writeFileSync(target, "content", "utf-8");
    const statSpy = spyOn(fs, "statSync").mockImplementation(((...args: Parameters<typeof fs.statSync>) => {
      if (args[0] === target) {
        throw new Error("no code on this one");
      }
      return originalStatSync(...(args as Parameters<typeof originalStatSync>));
    }) as typeof fs.statSync);

    try {
      const err = expectReason(() => statSourceForRead({ packageDir: dir, relPath: "target.ts" }), "source-unreadable");
      expect(err.message).toEqual("source file unreadable: target.ts could not be read (permission or I/O error)");
    } finally {
      statSpy.mockRestore();
    }
  });
});

describe("REQ-PSH-01.1 — FIFO (non-regular, non-directory) rejects via the allow-list branch, zero content-read calls [preservation-pin]", () => {
  it("a real named pipe (mkfifo) rejects source-not-regular-file, generic form, zero readFileSync calls", () => {
    const dir = scratchDir();
    const fifoPath = join(dir, "pipe");
    execFileSync("mkfifo", [fifoPath]);
    const readSpy = spyOn(fs, "readFileSync");

    try {
      const err = expectReason(() => statSourceForRead({ packageDir: dir, relPath: "pipe" }), "source-not-regular-file");
      expect(err.message).toEqual("source file invalid: pipe is not a regular file");
      expect(readSpy).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
    }
  });
});

describe("REQ-PSH-01.3 — degenerate source strings resolve to packageDir itself, rejected as non-regular [red-today]", () => {
  for (const relPath of ["", ".", "./"]) {
    it(`relPath ${JSON.stringify(relPath)} resolves to packageDir and rejects source-not-regular-file (directory), never a crash`, () => {
      const dir = scratchDir();

      const err = expectReason(() => statSourceForRead({ packageDir: dir, relPath }), "source-not-regular-file");

      expect(err.message).toContain("is a directory, not a regular file");
      expect(err.message).not.toContain(dir);
    });
  }
});

describe("REQ-PSH-03 — symlink resolution follows targets, in-package accepted", () => {
  it("REQ-PSH-03.1: an in-package symlink to an in-package regular file is accepted — statSync follows it, isFile true", () => {
    const dir = scratchDir();
    writeFileSync(join(dir, "real.txt"), "hello", "utf-8");
    symlinkSync(join(dir, "real.txt"), join(dir, "link.txt"));

    const { absPath, stat } = statSourceForRead({ packageDir: dir, relPath: "link.txt" });

    expect(stat.isFile()).toBe(true);
    expect(readFileSync(absPath, "utf-8")).toEqual("hello");
  });
});

describe("REQ-PSH-04.1 — in-package symlink to an OUTSIDE regular file is accepted — the residual, asserted positively [red-today]", () => {
  it("the read succeeds, returning the outside file's content — retiring this acceptance requires a deliberate, reviewed scenario change", () => {
    const dir = scratchDir();
    const external = mkdtempSync(join(tmpdir(), "path-guards-external-"));
    try {
      writeFileSync(join(external, "secret.txt"), "outside-content", "utf-8");
      symlinkSync(join(external, "secret.txt"), join(dir, "escape.txt"));

      const { absPath, stat } = statSourceForRead({ packageDir: dir, relPath: "escape.txt" });

      // Regression tripwire (design §4): a regrown realpath-based containment check would
      // fail this exact assertion — its own pass IS the residual's proof.
      expect(stat.isFile()).toBe(true);
      expect(readFileSync(absPath, "utf-8")).toEqual("outside-content");
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });
});

describe("REQ-IPF-01 — validateSourceLexical: ruling-5 unified lexical source screen, segment-aware over both separators", () => {
  const escaping = ["../x", "/abs/x", "..", "sub/..", "..\\x", "a/../../x", "./a/../../x"];

  for (const relPath of escaping) {
    it(`rejects ${JSON.stringify(relPath)} as invalid-input, zero stat/read calls recorded`, () => {
      const statSpy = spyOn(fs, "statSync");
      const readSpy = spyOn(fs, "readFileSync");
      try {
        const err = expectReason(() => validateSourceLexical(relPath), "invalid-input");
        expect(err.message).toContain(relPath);
        expect(statSpy).not.toHaveBeenCalled();
        expect(readSpy).not.toHaveBeenCalled();
      } finally {
        statSpy.mockRestore();
        readSpy.mockRestore();
      }
    });
  }

  it("a Windows drive-letter absolute path (C:\\x) rejects invalid-input — the predicate is not POSIX-only", () => {
    expectReason(() => validateSourceLexical("C:\\x"), "invalid-input");
  });

  it("REQ-IPF-01.4 preservation-pin: a plain non-escaping relative path never rejects", () => {
    expect(() => validateSourceLexical("shared/base.txt")).not.toThrow();
  });

  it("a substring that merely CONTAINS '..' without forming a whole segment ('..foo', 'foo..') is NOT rejected — segment-aware, never a substring test", () => {
    expect(() => validateSourceLexical("..foo")).not.toThrow();
    expect(() => validateSourceLexical("foo..")).not.toThrow();
  });
});

describe("REQ-IPF-02 — validateDestinationLexical: SDK emit-time lexical destination guard", () => {
  it("REQ-IPF-02.1: a literal '../' destination rejects invalid-input pre-emit", () => {
    expectReason(() => validateDestinationLexical("../escape.svg"), "invalid-input");
  });

  it("REQ-IPF-02.1: an absolute destination rejects invalid-input pre-emit", () => {
    expectReason(() => validateDestinationLexical("/abs/path"), "invalid-input");
  });

  it("a well-formed relative destination passes silently", () => {
    expect(() => validateDestinationLexical("out/nested/file.ts")).not.toThrow();
  });
});
