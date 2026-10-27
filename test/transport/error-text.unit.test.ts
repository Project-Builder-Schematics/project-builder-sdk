// REQ-WPS-07: bounded, no-echo, project-relative error text. Any error text crossing the
// wire or written to stderr is bounded to a documented ceiling, never echoes raw
// host/engine internals verbatim, and expresses paths project-relative — never absolute.

import { describe, it, expect } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
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
  hostAnchors,
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
    it("a POSIX absolute path inside the project root is anchored to the <project-root> token", () => {
      const message = "ENOENT: no such file, open '/repo/src/missing.json'";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual("ENOENT: no such file, open '<project-root>/src/missing.json'");
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

    it("a single-segment POSIX absolute path ('/root', no second '/'-delimited segment) is still recognized as absolute", () => {
      const message = "mkdir '/root': permission denied";
      const expectedRelative = relative("/repo", "/root");
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(`mkdir '${expectedRelative}': permission denied`);
    });

    it("a second single-segment POSIX absolute path ('/etc') is also recognized — not a one-off pin on '/root'", () => {
      const message = "cat '/etc': is a directory";
      const expectedRelative = relative("/repo", "/etc");
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(`cat '${expectedRelative}': is a directory`);
    });

    it("a space inside a POSIX directory segment does not end the match — the whole path, tail included, is scrubbed as one unit", () => {
      const absolutePath = "/home/alice/Application Support/CANARY/file.ts";
      const message = `ENOENT: no such file, open '${absolutePath}'`;
      const expectedRelative = relative("/repo", absolutePath);
      const scrubbed = scrubAbsolutePaths(message, "/repo");
      expect(scrubbed).toEqual(`ENOENT: no such file, open '${expectedRelative}'`);
      // The raw absolute form (leading slash, space intact) never appears un-relativized.
      expect(scrubbed).not.toContain(`'${absolutePath}'`);
    });

    it("a space in the FIRST path segment, with the filename directly after the space, is still recognized — no leading complete segment exists for a partial match to latch onto, so the old shape either total-bypasses or misses this differently than the mid-path case above", () => {
      const absolutePath = "/Shared Files/report.pdf";
      const message = `ENOENT: no such file, open '${absolutePath}'`;
      const expectedRelative = relative("/repo", absolutePath);
      const scrubbed = scrubAbsolutePaths(message, "/repo");
      expect(scrubbed).toEqual(`ENOENT: no such file, open '${expectedRelative}'`);
      expect(scrubbed).not.toContain(`'${absolutePath}'`);
    });

    it("a Windows drive-letter path with a space in a directory segment ('Program Files'-style) resolves unconditionally to the outside-project placeholder — nothing past the space survives", () => {
      const message = "ENOENT: no such file, open 'C:\\Users\\dev\\Program Files\\CANARY\\file.ts'";
      const scrubbed = scrubAbsolutePaths(message, "/repo");
      expect(scrubbed).toEqual(`ENOENT: no such file, open '${OUTSIDE_PROJECT_TOKEN}'`);
      expect(scrubbed).not.toContain("CANARY");
    });

    it("a UNC path with a space in a share-name segment ('Shared Drive'-style) resolves unconditionally to the outside-project placeholder — nothing past the space survives", () => {
      const message = "EACCES: permission denied, open '\\\\server\\Shared Drive\\CANARY\\x.ts'";
      const scrubbed = scrubAbsolutePaths(message, "/repo");
      expect(scrubbed).toEqual(`EACCES: permission denied, open '${OUTSIDE_PROJECT_TOKEN}'`);
      expect(scrubbed).not.toContain("CANARY");
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

    it("disclosure decision (REQ-WPS-07's own ../-relative mandate, pinned): a POSIX path outside a REALISTICALLY DEEP project root reveals its full ../ depth and filename tail — this is the spec's specified outcome, not an accidental leak", () => {
      // The shallow case above (`/repo` vs `/elsewhere/secret.json`) hides how long the
      // chain gets with a project root nested several directories deep — a realistic shape
      // for e.g. a worktree checkout. Computed via the SAME `relative()` the production
      // code calls, so this assertion is self-verifying rather than a hand-counted guess.
      const deepRoot = "/home/dev/workspaces/org/monorepo/packages/sdk/.claude/worktrees/build-1";
      const outsidePath = "/home/dev/secret-dir/app.module.ts";
      const message = `ENOENT: no such file, open '${outsidePath}'`;
      const expectedRelative = relative(deepRoot, outsidePath);

      const scrubbed = scrubAbsolutePaths(message, deepRoot);

      expect(scrubbed).toEqual(`ENOENT: no such file, open '${expectedRelative}'`);
      // Depth survives: more than one "../" segment, unlike the shallow case above.
      expect(expectedRelative.split("/").filter((seg) => seg === "..").length).toBeGreaterThan(1);
      // The tail below the common ancestor survives verbatim.
      expect(expectedRelative).toContain("secret-dir/app.module.ts");
    });
  });

  describe("Scenario REQ-WPS-07.5: secret-shaped non-path content passes through bounded, unscrubbed (documented residual)", () => {
    it("secret-shaped content with no path-shaped substring is unchanged by scrubAbsolutePaths — a pin, not a new-behavior proof: an identity function satisfies this trivially too, same as the prose-survival cases above", () => {
      const message = "configuration rejected: DB_PASSWORD=hunter2 failed validation";
      expect(scrubAbsolutePaths(message, "/repo")).toEqual(message);
    });
  });

  describe("Scenario REQ-WPS-07.7-.9: known absolute prefixes are anchored before any shape is guessed", () => {
    const ROOT = "/home/user/project";
    const ANCHORS = [
      { token: "<project-root>", path: ROOT },
      { token: "<sdk>", path: "/home/user/project/node_modules/@pbuilder/sdk" },
    ];

    it("an absolute path glued to the preceding word is still scrubbed (the round-1 regression)", () => {
      const message = "loaderror/home/user/project/secret.json";
      expect(scrubAbsolutePaths(message, ROOT, ANCHORS)).toEqual("loaderror<project-root>/secret.json");
    });

    it("each known prefix maps to its own token, the longest prefix winning, and a spaced tail survives intact", () => {
      expect(scrubAbsolutePaths("at /home/user/project/node_modules/@pbuilder/sdk/dist/index.js", ROOT, ANCHORS)).toEqual(
        "at <sdk>/dist/index.js"
      );
      expect(scrubAbsolutePaths("open '/home/user/project/Application Support/x/file.ts'", ROOT, ANCHORS)).toEqual(
        "open '<project-root>/Application Support/x/file.ts'"
      );
    });

    it("a prefix only matches a whole path segment, so a sibling directory falls through to the shape pass", () => {
      const message = "open '/home/user/project-old/x.json'";
      const expectedRelative = relative(ROOT, "/home/user/project-old/x.json");
      expect(scrubAbsolutePaths(message, ROOT, ANCHORS)).toEqual(`open '${expectedRelative}'`);
    });

    it("a root-only anchor ('/') is ignored instead of swallowing every slash", () => {
      expect(scrubAbsolutePaths("cat '/etc/hosts'", "/", [{ token: "<project-root>", path: "/" }])).toEqual("cat 'etc/hosts'");
    });

    it("hostAnchors also anchors the realpath of a symlinked project root", () => {
      const scratch = mkdtempSync(join(tmpdir(), "scrub-anchor-"));
      try {
        const real = join(scratch, "real");
        const link = join(scratch, "link");
        mkdirSync(real);
        symlinkSync(real, link);
        expect(scrubAbsolutePaths(`open '${join(real, "x.json")}'`, link, hostAnchors(link))).toEqual(
          "open '<project-root>/x.json'"
        );
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    });

    it("a non-file URL passes through unchanged", () => {
      const message = "fetch failed for https://api.example.com/v1/users";
      expect(scrubAbsolutePaths(message, ROOT, ANCHORS)).toEqual(message);
    });

    it("a file:// URL keeps its scheme intact while its path is scrubbed", () => {
      expect(
        scrubAbsolutePaths("Cannot find module '/home/user/project/x.js' imported from file:///home/user/project/src/factory.ts", ROOT, ANCHORS)
      ).toEqual("Cannot find module '<project-root>/x.js' imported from file://<project-root>/src/factory.ts");
      expect(scrubAbsolutePaths("imported from file:///srv/app/x.ts", ROOT, ANCHORS)).toEqual(
        `imported from file://${relative(ROOT, "/srv/app/x.ts")}`
      );
    });

    it("a file:// URL carrying a Windows drive path routes the drive path to the outside-project placeholder", () => {
      expect(scrubAbsolutePaths("Cannot find module file:///C:/Users/dev/secret.json", ROOT, ANCHORS)).toEqual(
        `Cannot find module file://${OUTSIDE_PROJECT_TOKEN}`
      );
    });

    it("a file:// URL glued to the word before it is still scrubbed outside the anchors", () => {
      expect(scrubAbsolutePaths("Cannot loadfile:///srv/app/secret.json", ROOT, ANCHORS)).toEqual(
        `Cannot loadfile://${relative(ROOT, "/srv/app/secret.json")}`
      );
    });

    it("the default anchors include the SDK root, even when its realpath cannot add a variant", () => {
      const sdkRoot = hostAnchors("/repo").find(({ token }) => token === "<sdk>");
      expect(sdkRoot?.path).not.toMatch(/\/$/);
      expect(scrubAbsolutePaths(`at ${sdkRoot?.path}/dist/index.js`, "/repo", [sdkRoot!])).toEqual("at <sdk>/dist/index.js");
    });

    it("a bare doubled backslash in prose is not mistaken for a UNC path", () => {
      for (const message of [
        "UNC paths on Windows start with \\\\ followed by the server name",
        "the pattern uses \\\\d+ to match digits",
      ]) {
        expect(scrubAbsolutePaths(message, ROOT, ANCHORS)).toEqual(message);
      }
    });
  });
});
