/**
 * S-005.9 — `package-dir-run-anchor` REQ-MFB-02.1/.3: the release-vehicle bundle, tied
 * together in ONE guard. `CHANGELOG.md` MUST carry a `## 0.2.0` heading (never `##
 * Unreleased`) containing all three S-005.7 entries by distinguishing phrase, the amended
 * preamble, `package.json#version === "0.2.0"` (from S-002.2), AND the three ADR
 * supersession/amendment headers from S-005.5 (ADR-0045/0046/0067) — a missing piece in
 * ANY of these makes the whole release-vehicle bundle incoherent (a version bump with no
 * CHANGELOG entry, or entries under the wrong heading, or superseded ADRs without their
 * dated header so the sweep allowlist in S-006.3 has nothing legitimate to point at).
 *
 * [permanent-fixture] — mirrors `test/docs/security-authoring-guard.test.ts`'s own
 * frozen-string-guard precedent.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../support/jsdoc-scan.ts";

const CHANGELOG_PATH = join(PROJECT_ROOT, "CHANGELOG.md");
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, "package.json");
const ADR_0045_PATH = join(PROJECT_ROOT, "openspec/decisions/0045-package-read-containment-boundary.md");
const ADR_0046_PATH = join(PROJECT_ROOT, "openspec/decisions/0046-runcontext-package-root-ceiling.md");
const ADR_0067_PATH = join(PROJECT_ROOT, "openspec/decisions/0067-collection-json-package-anchor-marker.md");

const changelog = () => readFileSync(CHANGELOG_PATH, "utf-8");

// Frozen distinguishing phrases — copied VERBATIM from CHANGELOG.md's own `## 0.2.0`
// entries (S-005.7). If this ever diverges from CHANGELOG.md, CHANGELOG.md wins and this
// test is wrong, not the other way around.
const HEADLINE_FIXED_PHRASE = "A schematic package no longer needs a `collection.json` ancestor to run.";
const BREAKING_UNION_NARROWING_PHRASE = "`AuthoringReason` narrows from twelve members to eleven";
const HONEST_TIMING_PHRASE = "The SDK no longer resolves package-local source paths through a disk-canonicalization pass";
// judgment-day round 2 (F3): fourth 0.2.0 entry, ruling-16 follow-through — the walk-ROOT
// symlink rejection (F1) was author-visible breaking behaviour with no CHANGELOG entry.
const ROOT_SYMLINK_REJECTION_PHRASE = "A `from` root that is itself a symlinked directory now rejects `invalid-input`";
// Reckoning closing batch (2026-07-29): fifth 0.2.0 entry — the degenerate `from`
// rejection (ruling 17, REQ-FSC-11) was author-visible breaking behaviour with no
// CHANGELOG entry.
const DEGENERATE_FROM_REJECTION_PHRASE = "walked the ENTIRE package silently";
// Reckoning closing batch (2026-07-29): sixth 0.2.0 entry (grouped) — the round-3
// error-handling hardenings (rename `..` pre-join rejection, include/exclude shape
// validation, outside-run reporting parity, normalized-path collision detection, walk
// bound counting every dirent) had no CHANGELOG entry.
const ROUND3_HARDENING_PHRASE = "round-3 error-handling hardening";
const AUDIENCE_PHRASE = "the engine repo and the conformance corpus consume this contract today";
const STALE_PREAMBLE_PHRASE = "nothing here requires one";

describe("REQ-MFB-02.1 — CHANGELOG.md carries all four 0.2.0 entries under the right heading, preamble amended", () => {
  it('has a "## 0.2.0" heading, never "## Unreleased"', () => {
    expect(changelog()).toContain("## 0.2.0");
    expect(changelog()).not.toContain("## Unreleased");
  });

  it("the 0.2.0 section contains all six entries by distinguishing phrase", () => {
    const content = changelog();
    const section = content.slice(content.indexOf("## 0.2.0"), content.indexOf("### Behaviour Changes — `@pbuilder/sdk/typescript` `addImport`"));
    expect(section).toContain(HEADLINE_FIXED_PHRASE);
    expect(section).toContain(BREAKING_UNION_NARROWING_PHRASE);
    expect(section).toContain(HONEST_TIMING_PHRASE);
    expect(section).toContain(ROOT_SYMLINK_REJECTION_PHRASE);
    expect(section).toContain(DEGENERATE_FROM_REJECTION_PHRASE);
    expect(section).toContain(ROUND3_HARDENING_PHRASE);
  });

  it("the preamble names the real audience and no longer claims no migration is needed", () => {
    const content = changelog();
    expect(content).toContain(AUDIENCE_PHRASE);
    expect(content).not.toContain(STALE_PREAMBLE_PHRASE);
  });
});

describe("REQ-MFB-02.1 — package.json#version is bumped alongside the CHANGELOG", () => {
  it("package.json version matches the CHANGELOG's topmost version heading", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8")) as { version: string };
    const topHeading = /^## (\d+\.\d+\.\d+)$/m.exec(changelog())?.[1];
    expect(pkg.version).toBe(topHeading ?? "(no version heading in CHANGELOG.md)");
  });
});

describe("REQ-MFB-02.3 — ADR-0045/0046/0067 each carry their dated supersession/amendment header", () => {
  it("ADR-0046 carries a dated 'Superseded by ADR-0077' header", () => {
    expect(readFileSync(ADR_0046_PATH, "utf-8")).toMatch(/Superseded by ADR-0077 \(\d{4}-\d{2}-\d{2}\)/);
  });

  it("ADR-0067 carries a dated 'Superseded by ADR-0077' header", () => {
    expect(readFileSync(ADR_0067_PATH, "utf-8")).toMatch(/Superseded by ADR-0077 \(\d{4}-\d{2}-\d{2}\)/);
  });

  it("ADR-0045 carries a dated 'Amended by ADR-0077' header", () => {
    expect(readFileSync(ADR_0045_PATH, "utf-8")).toMatch(/Amended by ADR-0077 \(\d{4}-\d{2}-\d{2}\)/);
  });

  it("[red-proof] a missing header on any one of the three fails this check (mutation-check via string removal)", () => {
    const adr0046WithoutHeader = readFileSync(ADR_0046_PATH, "utf-8").replace(
      />\s*\*\*Superseded by ADR-0077[\s\S]*?\*\*:.*\n/,
      ""
    );
    expect(adr0046WithoutHeader).not.toMatch(/Superseded by ADR-0077 \(\d{4}-\d{2}-\d{2}\)/);
  });
});
