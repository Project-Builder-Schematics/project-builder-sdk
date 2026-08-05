// REQ-WPS-07: bounded, no-echo, project-relative error text. Any error text that crosses
// the wire or is written to stderr routes through here — bounded to a documented ceiling
// (never echoes raw host/engine internals verbatim: no stack frames, no absolute paths, no
// module source excerpts, no raw peer frame bytes), and every path is expressed
// project-relative, NEVER absolute (falling back to the `<outside-project>` placeholder
// when no relative form is meaningful, e.g. a different filesystem root).

import { isAbsolute, relative } from "node:path";

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

// REQ-WPS-07.4/.6, ADR-02: Windows-drive-letter or UNC/WSL-interop backslash-prefixed
// shapes — replaced FIRST, unconditionally, since node:path's POSIX-default
// isAbsolute/relative cannot correctly classify either shape on this SDK's POSIX hosts. The
// drive-letter branch's negative lookbehind keeps it from firing on a letter-colon-slash
// that isn't a path boundary (e.g. the "e:/" inside "file:///..." must NOT be read as a
// drive letter — that segment belongs to POSIX_ABS_PATH instead).
const WINDOWS_UNC_ABS_PATH = /(?:(?<![A-Za-z0-9_])[A-Za-z]:[\\/]|\\\\)[^\s'"<>]*/g;

// REQ-WPS-07.4: a POSIX absolute path — leading "/" plus at least one more "/"-delimited
// segment, so a lone slash inside prose ("and/or", "24/7") is never mistaken for a path
// root. Runs SECOND, after WINDOWS_UNC_ABS_PATH has already consumed any Windows/UNC/WSL
// match in full, so a forward-slash Windows path is never partially re-matched here.
const POSIX_ABS_PATH = /\/(?:[^\s'"<>]+\/)+[^\s'"<>]*/g;

// REQ-WPS-07.4/.6: scrubs absolute-path-shaped substrings embedded anywhere in a plain
// Error's free-text message — Windows/UNC/WSL shapes to the outside-project placeholder
// (ADR-02), POSIX shapes via the existing toProjectRelativePath formatter (ADR-01). Best-
// effort, not a security boundary: non-path-shaped secret content is untouched (REQ-WPS-07.5).
export function scrubAbsolutePaths(message: string, projectRoot?: string): string {
  return message
    .replace(WINDOWS_UNC_ABS_PATH, OUTSIDE_PROJECT_TOKEN)
    .replace(POSIX_ABS_PATH, (match) => toProjectRelativePath(match, projectRoot));
}
