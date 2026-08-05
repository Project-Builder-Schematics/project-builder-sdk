// REQ-WPS-07: bounded, no-echo, project-relative error text. Any error text crossing the
// wire or written to stderr is bounded to a documented ceiling, never echoes raw
// host/engine internals verbatim, and expresses paths project-relative — never absolute.

import { describe, it, expect } from "bun:test";
import {
  MESSAGE_CEILING_CHARS,
  TOKEN_CEILING_CHARS,
  OUTSIDE_PROJECT_TOKEN,
  boundMessage,
  truncateToken,
  toProjectRelativePath,
  formatRelativeCandidate,
  composeWithToken,
  scrubAbsolutePaths,
} from "../../src/transport/error-text.ts";

describe("REQ-WPS-07 — bounded, no-echo, project-relative error text", () => {
  describe("Scenario REQ-WPS-07.1: error text is bounded under the documented ceiling", () => {
    it("a message under the ceiling passes through unchanged", () => {
      expect(boundMessage("short message")).toEqual("short message");
    });

    it("a message over the 2000-character ceiling is truncated to exactly the ceiling", () => {
      const huge = "x".repeat(MESSAGE_CEILING_CHARS + 500);
      const bounded = boundMessage(huge);
      expect(bounded.length).toEqual(MESSAGE_CEILING_CHARS);
    });

    it("a message at EXACTLY the ceiling is not truncated further", () => {
      const exact = "y".repeat(MESSAGE_CEILING_CHARS);
      expect(boundMessage(exact)).toEqual(exact);
      expect(boundMessage(exact).length).toEqual(MESSAGE_CEILING_CHARS);
    });
  });

  describe("Scenario REQ-WPS-07.2: a path outside the project root never falls back to absolute (B4)", () => {
    it("a path inside the project root is expressed relative, no leading slash", () => {
      expect(toProjectRelativePath("/repo/src/foo.ts", "/repo")).toEqual("src/foo.ts");
    });

    it("a path outside the project root is expressed as a ../-relative path, never absolute", () => {
      const rel = toProjectRelativePath("/elsewhere/secret.ts", "/repo/nested/project");
      expect(rel.startsWith("..")).toBe(true);
      expect(rel.startsWith("/")).toBe(false);
    });

    it("when no relative form can be constructed, the documented <outside-project> placeholder substitutes for an absolute result — never the absolute path itself", () => {
      // A synthetic "still absolute" relative-path result (e.g. what a cross-drive
      // Windows comparison would yield) — proves the substitution rule directly,
      // independent of this environment's actual filesystem layout.
      expect(formatRelativeCandidate("/still/absolute/after/relativize")).toEqual(OUTSIDE_PROJECT_TOKEN);
    });
  });

  describe("Scenario REQ-WPS-07.3: an echoed identifier is truncated within the ceiling", () => {
    it("a token under the 200-character cap passes through unchanged", () => {
      expect(truncateToken("--unknown-flag")).toEqual("--unknown-flag");
    });

    it("a token over the 200-character cap is truncated to exactly the cap", () => {
      const longToken = "a".repeat(TOKEN_CEILING_CHARS + 50);
      expect(truncateToken(longToken).length).toEqual(TOKEN_CEILING_CHARS);
    });

    it("composeWithToken truncates the echoed token AND keeps the total message under the message ceiling", () => {
      const longToken = "z".repeat(TOKEN_CEILING_CHARS + 500);
      const composed = composeWithToken("pbuilder-runner: unrecognized flag: ", longToken);

      expect(composed.length).toBeLessThanOrEqual(MESSAGE_CEILING_CHARS);
      // The token portion embedded in the composed message is itself capped.
      expect(composed).not.toContain(longToken);
    });
  });

  describe("Scenario REQ-WPS-07.4/.6: scrubAbsolutePaths recognizes real absolute-path shapes across platforms", () => {
    it("a POSIX absolute path inside the project root resolves via toProjectRelativePath", () => {
      const message = "ENOENT: no such file, open '/repo/src/missing.json'";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual("ENOENT: no such file, open 'src/missing.json'");
    });

    it("a POSIX absolute path outside the project root resolves to a ../-relative form, never absolute", () => {
      const message = "ENOENT: no such file, open '/elsewhere/secret.json'";
      const scrubbed = scrubAbsolutePaths(message, "/repo");
      expect(scrubbed).toEqual("ENOENT: no such file, open '../elsewhere/secret.json'");
      expect(scrubbed).not.toContain("open '/elsewhere");
    });

    it("a Windows drive-letter path with backslashes resolves unconditionally to the outside-project placeholder", () => {
      const message = "ENOENT: no such file, open 'C:\\Users\\dev\\project\\missing.json'";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(`ENOENT: no such file, open '${OUTSIDE_PROJECT_TOKEN}'`);
    });

    it("a Windows drive-letter path with forward slashes resolves unconditionally to the outside-project placeholder, not a computed relative form (ordering proof)", () => {
      const message = "ENOENT: no such file, open 'C:/Users/dev/project/missing.json'";
      const scrubbed = scrubAbsolutePaths(message, "/repo");
      expect(scrubbed).toEqual(`ENOENT: no such file, open '${OUTSIDE_PROJECT_TOKEN}'`);
      expect(scrubbed).not.toContain("Users/dev/project/missing.json");
    });

    it("a UNC path resolves unconditionally to the outside-project placeholder", () => {
      const message = "EACCES: permission denied, open '\\\\server\\share\\project\\config.json'";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(`EACCES: permission denied, open '${OUTSIDE_PROJECT_TOKEN}'`);
    });

    it("a wsl.localhost WSL-interop path resolves unconditionally to the outside-project placeholder", () => {
      const message = "ENOENT: no such file, open '\\\\wsl.localhost\\Ubuntu\\home\\user\\project\\file.ts'";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(`ENOENT: no such file, open '${OUTSIDE_PROJECT_TOKEN}'`);
    });

    it("a wsl$ WSL-interop path resolves unconditionally to the outside-project placeholder", () => {
      const message = "ENOENT: no such file, open '\\\\wsl$\\Ubuntu\\home\\user\\project\\file.ts'";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(`ENOENT: no such file, open '${OUTSIDE_PROJECT_TOKEN}'`);
    });

    it("a file://-embedded absolute path is scrubbed via the existing POSIX pass — the embedded segment never survives", () => {
      const message = "config resolved from file:///home/user/project/x.json";
      expect(scrubAbsolutePaths(message, "/home/user/project")).not.toContain("/home/user/project/x.json");
    });

    it("ordinary prose with a single slash is never mistaken for a path root", () => {
      const message = "retry with strict mode and/or increase the timeout; support runs 24/7";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(message);
    });

    it("a message with no path-shaped content passes through unchanged", () => {
      const message = "Could not locate the imports array closing in src/app.module.ts";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(message);
    });
  });
});
