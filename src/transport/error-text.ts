// REQ-WPS-07: bounded, no-echo, project-relative error text. Any error text that crosses
// the wire or is written to stderr routes through here — bounded to a documented ceiling
// (never echoes raw host/engine internals verbatim: no stack frames, no absolute paths, no
// module source excerpts, no raw peer frame bytes), and every path is expressed
// project-relative, NEVER absolute (falling back to the `<outside-project>` placeholder
// when no relative form is meaningful, e.g. a different filesystem root).

import { realpathSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";

// SDK-chosen placeholders pending engine-side confirmation — same provenance posture as
// SEC-05's timeout bound and WPS-06's BATCH_CAP_BYTES.
export const MESSAGE_CEILING_CHARS = 2000;
export const TOKEN_CEILING_CHARS = 200;
export const OUTSIDE_PROJECT_TOKEN = "<outside-project>";

// REQ-WPS-07.3: an echoed host-controlled identifier (e.g. an unrecognized argv flag, a
// malformed export name) is truncated to this per-token max BEFORE composition — names
// surface, values never (bin/pbuilder-codegen.ts's describeSufficiencyFinding precedent).
export function truncateToken(token: string): string {
  return token.length > TOKEN_CEILING_CHARS ? token.slice(0, TOKEN_CEILING_CHARS) : token;
}

// REQ-WPS-07.1: the WHOLE message, including any embedded echoed token, is bounded to this
// ceiling.
export function boundMessage(message: string): string {
  return message.length > MESSAGE_CEILING_CHARS ? message.slice(0, MESSAGE_CEILING_CHARS) : message;
}

// REQ-WPS-07.2: applies the outside-project fallback rule to an already-computed relative
// path candidate. Split out from `toProjectRelativePath` so the fallback rule itself is
// directly testable without depending on this environment's actual filesystem layout (on
// POSIX, `path.relative` between two absolute paths can always express SOME `../`-relative
// form — there is no real "different filesystem root" case to construct here — but the
// substitution rule the fallback exists for is still a real, testable contract).
export function formatRelativeCandidate(candidate: string): string {
  return isAbsolute(candidate) ? OUTSIDE_PROJECT_TOKEN : candidate;
}

// REQ-WPS-07.2: expresses `subjectPath` relative to `projectRoot` (default: cwd) as a
// `../`-relative path, or the `<outside-project>` placeholder when no relative form can be
// constructed — NEVER the absolute path.
export function toProjectRelativePath(subjectPath: string, projectRoot: string = process.cwd()): string {
  return formatRelativeCandidate(relative(projectRoot, subjectPath));
}

// REQ-WPS-07.3: composes a prefix + a bounded echoed token + an optional suffix, then
// applies the whole-message ceiling — the echoed token never escapes its own cap even if
// the surrounding prefix/suffix is itself sizeable.
export function composeWithToken(prefix: string, token: string, suffix = ""): string {
  return boundMessage(`${prefix}${truncateToken(token)}${suffix}`);
}

// REQ-WPS-07.7: an absolute prefix this host is known to own, and the token that replaces it.
export interface ScrubAnchor {
  token: string;
  path: string;
}

// This module sits at <sdk>/src/transport/ in source and <sdk>/dist/transport/ in the build.
const SDK_ROOT = fileURLToPath(new URL("../..", import.meta.url));

// REQ-WPS-07.7: the prefixes whose disclosure says something about THIS machine, each also
// under its realpath (a symlinked checkout reports either). Home and temp directories are not
// anchored: reading them needs node:os or process.env, neither admitted in the runner closure
// (scripts/capability-admission.ts).
export function hostAnchors(projectRoot: string = process.cwd()): ScrubAnchor[] {
  const anchors: ScrubAnchor[] = [];
  const known: [string, string][] = [
    ["<project-root>", projectRoot],
    ["<sdk>", SDK_ROOT],
  ];
  for (const [token, path] of known) {
    anchors.push({ token, path });
    try {
      const real = realpathSync(path);
      if (real !== path) anchors.push({ token, path: real });
    } catch {
      // A prefix that does not exist on disk has no realpath form to add.
    }
  }
  return anchors;
}

// REQ-WPS-07.7: exact substring replacement — no left boundary, so a path glued to the word
// before it ("loaderror/home/...") is still caught. The right side must end the segment, so
// "/repo" never claims "/repo-old". Longest prefix first: the SDK root usually sits under the
// project root. "/" is skipped: it would claim every slash in the message. A plain scan rather
// than a built RegExp: the runner closure admits regex literals only.
const CONTINUES_SEGMENT = /[^\s'"<>\\/]/;

function anchorKnownPrefixes(message: string, anchors: readonly ScrubAnchor[]): string {
  const ordered = anchors.filter(({ path }) => path.length > 1).sort((a, b) => b.path.length - a.path.length);
  let scrubbed = "";
  let index = 0;
  while (index < message.length) {
    const anchor = ordered.find(
      ({ path }) => message.startsWith(path, index) && !CONTINUES_SEGMENT.test(message.charAt(index + path.length))
    );
    if (anchor === undefined) {
      scrubbed += message.charAt(index);
      index += 1;
    } else {
      scrubbed += anchor.token;
      index += anchor.path.length;
    }
  }
  return scrubbed;
}

// One alternation, so every position is claimed by exactly one shape and a URL's path or a
// token's tail is never re-scanned by the groups after it:
//
// 1. What the prefix pass left behind: a token plus its tail, already safe.
// 2. REQ-WPS-07.8: a URL, recognised whole so its "scheme:" never reads as a path boundary
//    before "//authority/...". The two-character scheme minimum leaves "C://x" to group 3.
// 3. REQ-WPS-07.4/.6, ADR-02: a Windows-drive-letter or UNC/WSL-interop path — replaced
//    unconditionally, since node:path's POSIX-default isAbsolute/relative cannot classify
//    either on this SDK's POSIX hosts. The drive-letter lookbehind keeps a letter-colon-slash
//    after a word character from reading as a drive. A UNC path needs a server name and its
//    closing backslash (REQ-WPS-07.9), so a bare "\\" in prose survives.
// 4. REQ-WPS-07.4: a POSIX path. The lookbehind on "/" keeps prose ("and/or", "24/7") from
//    reading as a root while a real boundary (start, space, quote, paren, "=", ":") does not,
//    which is what lets a single segment ("/root", "/etc") count as absolute.
//
// In groups 3 and 4 a literal space does not end the match: it's consumed ONLY when a
// lookahead proves the path keeps going — more non-terminator characters followed by a
// separator ("Program Files\x", "Application Support/x"). A space with no further separator
// ahead is NOT consumed, so prose is never swallowed past the actual path boundary.
const SHAPES =
  /(<(?:project-root|sdk)>[^\s'"<>]*)|([A-Za-z][A-Za-z0-9+.-]+:\/\/[^\s'"<>]*)|((?:(?<![A-Za-z0-9_])[A-Za-z]:[\\/]|\\\\[A-Za-z0-9._$-]+\\)(?:[^\s'"<>]|[ ](?=[^\s'"<>]*[\\/]))*)|(?<![A-Za-z0-9_])\/(?:[^\s'"<>]|[ ](?=[^\s'"<>]*\/))+/g;
const FILE_URL_SCHEME = /^file:\/\//i;

function scrubShapes(text: string, projectRoot: string | undefined): string {
  return text.replace(SHAPES, (match, anchored?: string, url?: string, windows?: string) => {
    if (anchored !== undefined) return match;
    if (url !== undefined) {
      return FILE_URL_SCHEME.test(match) ? `file://${scrubShapes(match.slice("file://".length), projectRoot)}` : match;
    }
    if (windows !== undefined) return OUTSIDE_PROJECT_TOKEN;
    return toProjectRelativePath(match, projectRoot);
  });
}

// REQ-WPS-07.4/.6/.7: scrubs absolute paths embedded anywhere in a plain Error's free-text
// message. Known host prefixes are replaced first, by exact substring; whatever is left is
// matched by shape — Windows/UNC/WSL to the outside-project placeholder (ADR-02), POSIX via
// toProjectRelativePath (ADR-01). Best-effort, not a security boundary: non-path-shaped secret
// content is untouched (REQ-WPS-07.5).
export function scrubAbsolutePaths(
  message: string,
  projectRoot?: string,
  anchors: readonly ScrubAnchor[] = hostAnchors(projectRoot)
): string {
  return scrubShapes(anchorKnownPrefixes(message, anchors), projectRoot);
}
