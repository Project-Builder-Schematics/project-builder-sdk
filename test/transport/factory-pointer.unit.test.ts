// REQ-WPS-08.1: the factory pointer grammar is `<url>#<export>` — `<export>` is an
// OPTIONAL fragment naming a non-default export; an absent fragment means the module's
// default export. S-001 owns only the pure grammar parse; RUN-02's URL-scheme validation
// and RUN-03's actual export resolution land in S-002 on top of this same file.

import { describe, it, expect } from "bun:test";
import { parseFactoryPointer } from "../../src/transport/factory-pointer.ts";

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
