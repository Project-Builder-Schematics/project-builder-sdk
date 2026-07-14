/**
 * Dedicated unit pin for `embedTemplate`'s content-digest normalization branch (design.md
 * Rev 3 Ruling R-G) — carried obligation from verify: M-09's e2e path exercises this
 * branch too (via its ~0.8 MiB setup-materialized fills), but that proves the branch
 * fires, not that its SHAPE is exactly right at the boundary. This file pins the exact
 * digest object shape, its determinism, and the inclusive `<=` budget boundary directly,
 * independent of any e2e fixture size.
 */
import { describe, it, expect } from "bun:test";
import { createHash } from "node:crypto";
import { CONTENT_EMBED_BUDGET, embedTemplate, type ContentDigest } from "./corpus-format.ts";

function isContentDigest(value: unknown): value is ContentDigest {
  return typeof value === "object" && value !== null && "contentDigest" in value;
}

describe("embedTemplate — R-G content-digest normalization boundary", () => {
  it("content at or under CONTENT_EMBED_BUDGET embeds verbatim as a string", () => {
    const atBudget = "a".repeat(CONTENT_EMBED_BUDGET);
    expect(embedTemplate(atBudget)).toEqual(atBudget);
    expect(embedTemplate("short")).toEqual("short");
  });

  it("content one byte over CONTENT_EMBED_BUDGET serializes as a self-labeling sha-256 digest object", () => {
    const overBudget = "a".repeat(CONTENT_EMBED_BUDGET + 1);
    const result = embedTemplate(overBudget);

    expect(isContentDigest(result)).toBe(true);
    const digest = (result as ContentDigest).contentDigest;
    expect(digest.algo).toEqual("sha-256");
    expect(digest.bytes).toEqual(Buffer.byteLength(overBudget, "utf8"));
    expect(digest.sha256).toEqual(createHash("sha256").update(overBudget, "utf8").digest("hex"));
    // Exactly the three self-labeling keys — never a literal content fragment smuggled
    // in alongside the digest (GCC-11 posture: a digest object can never be mistaken for
    // literal content).
    expect(Object.keys(digest).sort()).toEqual(["algo", "bytes", "sha256"]);
  });

  it("is a pure function of content alone — same content, same digest, across independent calls (FIT-28 determinism)", () => {
    const content = "PBUILDER-FIXTURE-FILL-".repeat(1000); // well over budget
    const first = embedTemplate(content);
    const second = embedTemplate(content);
    expect(first).toEqual(second);
  });

  it("measures byte length, not string length, for multi-byte content crossing the boundary", () => {
    // Each "é" is 2 UTF-8 bytes — string .length undercounts vs Buffer.byteLength, so a
    // length-based (rather than byte-based) budget check would misjudge this fixture.
    const perCharBytes = 2;
    const charCount = Math.ceil((CONTENT_EMBED_BUDGET + 1) / perCharBytes) + 1;
    const content = "é".repeat(charCount);
    expect(Buffer.byteLength(content, "utf8")).toBeGreaterThan(CONTENT_EMBED_BUDGET);

    const result = embedTemplate(content);
    expect(isContentDigest(result)).toBe(true);
  });
});
