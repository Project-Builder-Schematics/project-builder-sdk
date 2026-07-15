// REQ-WPS-08.1: the factory pointer grammar is `<url>#<export>` — `<export>` is an
// OPTIONAL fragment naming a non-default export; an absent fragment means the module's
// default export. S-001 owns only the pure grammar parse; RUN-02's URL-scheme validation
// and RUN-03's actual export resolution + RUN-06's double-wrap check land in S-002 on top
// of this same file.

import { describe, it, expect } from "bun:test";
import { defineFactory } from "../../src/core/context.ts";
import {
  parseFactoryPointer,
  validateFactoryUrl,
  resolveFactoryExport,
} from "../../src/transport/factory-pointer.ts";

describe("REQ-WPS-08 — factory-pointer syntax", () => {
  describe("Scenario REQ-WPS-08.1: pointer grammar parses both forms", () => {
    it("a pointer with a fragment splits into the url and the named export", () => {
      const parsed = parseFactoryPointer("file:///abs/path/factory.ts#namedExport");
      expect(parsed).toEqual({ url: "file:///abs/path/factory.ts", exportName: "namedExport" });
    });

    it("a pointer with no fragment resolves to the module's default export (exportName undefined)", () => {
      const parsed = parseFactoryPointer("file:///abs/path/factory.ts");
      expect(parsed).toEqual({ url: "file:///abs/path/factory.ts", exportName: undefined });
    });

    it("only the FIRST '#' delimits the fragment — a url containing a literal '#' in a later position is not mis-split", () => {
      const parsed = parseFactoryPointer("file:///abs/path/weird%23name.ts#namedExport");
      expect(parsed).toEqual({ url: "file:///abs/path/weird%23name.ts", exportName: "namedExport" });
    });

    it("an empty fragment (trailing '#' with nothing after it) is treated as no fragment (default export)", () => {
      const parsed = parseFactoryPointer("file:///abs/path/factory.ts#");
      expect(parsed).toEqual({ url: "file:///abs/path/factory.ts", exportName: undefined });
    });
  });
});

describe("REQ-RUN-02 — factory URL scheme + host allowlist", () => {
  it("Scenario REQ-RUN-02.1: file:// scheme with empty host is accepted", () => {
    expect(validateFactoryUrl("file:///workspace/factory.ts")).toEqual({ ok: true });
  });

  it("Scenario REQ-RUN-02.2: a non-file scheme is rejected", () => {
    const result = validateFactoryUrl("https://evil.example/factory.ts");
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("file:");
  });

  it("Scenario REQ-RUN-02.2: data:/node: schemes are also rejected", () => {
    expect(validateFactoryUrl("data:text/plain,x").ok).toBe(false);
    expect(validateFactoryUrl("node:fs").ok).toBe(false);
  });

  it("Scenario REQ-RUN-02.3: file:// with a non-empty host is rejected, even though the scheme is file:", () => {
    const result = validateFactoryUrl("file://host/workspace/factory.ts");
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain("host");
  });

  it("a structurally unparseable URL is rejected with a message, never throws", () => {
    const result = validateFactoryUrl("not a url at all");
    expect(result.ok).toBe(false);
  });
});

describe("REQ-RUN-03 — factory fragment/export validation, three distinct forms", () => {
  it("Scenario REQ-RUN-03.1: missing default export (no fragment, no default in the module)", () => {
    const result = resolveFactoryExport({ named: () => {} }, undefined);
    expect(result).toEqual({ ok: false, kind: "missing-default-export" });
  });

  it("Scenario REQ-RUN-03.2: missing named export (fragment names an export that does not exist)", () => {
    const result = resolveFactoryExport({ default: () => {} }, "makeThing");
    expect(result).toEqual({ ok: false, kind: "missing-named-export", exportName: "makeThing" });
  });

  it("Scenario REQ-RUN-03.3: malformed (non-function) export — resolved but not callable", () => {
    const result = resolveFactoryExport({ config: { port: 3000 } }, "config");
    expect(result).toEqual({ ok: false, kind: "not-callable", exportName: "config" });
  });

  it("the three failure forms are mutually distinct kinds (SC-9)", () => {
    const kinds = new Set([
      resolveFactoryExport({}, undefined),
      resolveFactoryExport({ default: () => {} }, "missing"),
      resolveFactoryExport({ bad: 42 }, "bad"),
    ].map((r) => (r.ok ? "ok" : r.kind)));
    expect(kinds.size).toEqual(3);
  });

  it("a bare default export resolves successfully", () => {
    const fn = () => {};
    const result = resolveFactoryExport({ default: fn }, undefined);
    expect(result).toEqual({ ok: true, fn });
  });

  it("a bare named export resolves successfully", () => {
    const fn = () => {};
    const result = resolveFactoryExport({ makeThing: fn }, "makeThing");
    expect(result).toEqual({ ok: true, fn });
  });
});

describe("REQ-RUN-06 — double-wrap detection", () => {
  it("Scenario REQ-RUN-06.1: an already-defineFactory-wrapped export is rejected at load time, distinct from RUN-03's forms", () => {
    const wrapped = defineFactory<void>(() => {});
    const result = resolveFactoryExport({ default: wrapped }, undefined);
    expect(result).toEqual({ ok: false, kind: "double-wrapped" });
  });

  it("Scenario REQ-RUN-06.1 (named export form): a wrapped export reached via a fragment is also rejected", () => {
    const wrapped = defineFactory<void>(() => {});
    const result = resolveFactoryExport({ makeThing: wrapped }, "makeThing");
    expect(result).toEqual({ ok: false, kind: "double-wrapped" });
  });

  it("Scenario REQ-RUN-06.2 (M12 negative triangulation): a bare arity-1 factory is NOT misclassified as wrapped", () => {
    const bare = (_o: unknown) => {};
    const result = resolveFactoryExport({ default: bare }, undefined);
    expect(result).toEqual({ ok: true, fn: bare });
  });

  it("Scenario REQ-RUN-06.2 (M12 negative triangulation): a bare factory with an unused second parameter is NOT misclassified as wrapped", () => {
    // Genuinely arity-2 at runtime (`.length === 2`) — proves the check is brand-based,
    // not arity-based. Asserted by identity rather than a full toEqual literal: a real
    // 2-required-param function is not structurally assignable to BareFactoryFn's 1-arg
    // signature (TS strict parameter-count checking), even though calling it with one
    // argument is runtime-safe (the JS calling convention this spec scenario relies on).
    const bareArityTwo = (_o: unknown, _unused: unknown) => {};
    expect(bareArityTwo.length).toEqual(2);
    const result = resolveFactoryExport({ default: bareArityTwo }, undefined);
    expect(result.ok).toBe(true);
    // Widened to `unknown` on both sides for a pure identity comparison — bareArityTwo's
    // real 2-required-param signature is not structurally assignable to BareFactoryFn
    // (see the comment above), so `.toBe(bareArityTwo)` directly would fail to typecheck.
    expect(result.ok ? (result.fn as unknown) : undefined).toBe(bareArityTwo as unknown);
  });
});
