/**
 * schema-digest.ts unit coverage — SHA-256 of schema bytes (design §4.2). The bin embeds
 * this in the generated header comment; FIT-12 (S-002) recomputes it for the parity gate.
 */
import { describe, it, expect } from "bun:test";
import { computeSchemaDigest } from "../../src/core/schema/schema-digest.ts";

describe("computeSchemaDigest", () => {
  it("returns the SHA-256 hex digest of the schema bytes", () => {
    const raw = '{"properties":{"port":{"type":"number"}}}';

    expect(computeSchemaDigest(raw)).toEqual(
      "3f48103c79385319299b7b51af267ae110c3dbd5076091cf50392a91a5ead4be"
    );
  });

  it("is deterministic for identical bytes and differs on any byte change", () => {
    const a = computeSchemaDigest("same bytes");
    const b = computeSchemaDigest("same bytes");
    const c = computeSchemaDigest("different bytes");

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
