/**
 * REQ-FSC-03/05/08 (S-001, design §Test Derivation): the pure filename pipeline —
 * rename → token translation → `.template` strip (pinned order), include/exclude glob
 * filtering (exclude wins), and intra-scaffold destination-collision detection. Unit level,
 * pure functions — no I/O, no defineFactory run.
 */
import { describe, it, expect } from "bun:test";
import {
  translateTokens,
  stripTemplateSuffix,
  runFilenamePipeline,
  isIncluded,
  detectDestinationCollisions,
  type PipelineResult,
} from "../../src/scaffold/filename-pipeline.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";

describe("translateTokens — REQ-FSC-05 step 2", () => {
  it("__name@dasherize__ translates to {= name | dasherize =} (the spec-pinned example)", () => {
    expect(translateTokens("__name@dasherize__.svc.ts")).toEqual("{= name | dasherize =}.svc.ts");
  });

  it("a bare __name__ (no pipe) translates to {= name =}", () => {
    expect(translateTokens("__name__.ts")).toEqual("{= name =}.ts");
  });

  it("a path with no token markers is returned unchanged", () => {
    expect(translateTokens("plain/path.ts")).toEqual("plain/path.ts");
  });
});

describe("stripTemplateSuffix — REQ-FSC-05 step 3", () => {
  it("strips a trailing .template suffix and reports wasTemplate: true", () => {
    expect(stripTemplateSuffix("dest.ts.template")).toEqual({ stripped: "dest.ts", wasTemplate: true });
  });

  it("a path without .template is returned unchanged, wasTemplate: false", () => {
    expect(stripTemplateSuffix("dest.ts")).toEqual({ stripped: "dest.ts", wasTemplate: false });
  });
});

describe("REQ-FSC-05.1 — compound: rename + token translation + .template strip, pinned order", () => {
  it("renames by the ORIGINAL name, THEN translates tokens, THEN strips .template last", () => {
    const source = "__name@dasherize__.service.ts.template";
    const rename = { [source]: "__name@dasherize__.svc.ts.template" };

    const result = runFilenamePipeline(source, rename);

    expect(result).toEqual({
      sourceRelPath: source,
      destRelPath: "{= name | dasherize =}.svc.ts",
      isTemplateMarked: true,
    });
  });

  it("a source with no rename rule passes through the original name into the pipeline", () => {
    const result = runFilenamePipeline("plain.ts", undefined);
    expect(result).toEqual({ sourceRelPath: "plain.ts", destRelPath: "plain.ts", isTemplateMarked: false });
  });
});

describe("REQ-FSC-03 — include/exclude glob dialect (the spec's own table)", () => {
  it("*.txt matches a.txt but not nested/a.txt", () => {
    expect(isIncluded("a.txt", ["*.txt"], undefined)).toBe(true);
    expect(isIncluded("nested/a.txt", ["*.txt"], undefined)).toBe(false);
  });

  it("**/*.txt matches both a.txt and nested/a.txt but not a.ts", () => {
    expect(isIncluded("a.txt", ["**/*.txt"], undefined)).toBe(true);
    expect(isIncluded("nested/a.txt", ["**/*.txt"], undefined)).toBe(true);
    expect(isIncluded("a.ts", ["**/*.txt"], undefined)).toBe(false);
  });

  it("nested/** matches nested/a.txt and nested/b/c.ts but not a.txt", () => {
    expect(isIncluded("nested/a.txt", ["nested/**"], undefined)).toBe(true);
    expect(isIncluded("nested/b/c.ts", ["nested/**"], undefined)).toBe(true);
    expect(isIncluded("a.txt", ["nested/**"], undefined)).toBe(false);
  });

  it("REQ-FSC-03.1: exclude wins over include on overlap", () => {
    expect(isIncluded("a.txt", ["*.txt"], ["a.txt"])).toBe(false);
    expect(isIncluded("b.txt", ["*.txt"], ["a.txt"])).toBe(true);
  });

  it("REQ-FSC-03.2: a pattern without ** does not cross a segment boundary", () => {
    expect(isIncluded("nested/a.txt", ["*.txt"], undefined)).toBe(false);
  });

  it("default include (undefined) matches everything; default exclude (undefined) matches nothing", () => {
    expect(isIncluded("anything/at/all.ts", undefined, undefined)).toBe(true);
  });
});

describe("REQ-FSC-08.1 — intra-scaffold destination collision names both offending sources", () => {
  it("two sources collapsing to one destination reject, naming both", () => {
    const results: PipelineResult[] = [
      { sourceRelPath: "a.ts", destRelPath: "a.ts", isTemplateMarked: false },
      { sourceRelPath: "a.ts.template", destRelPath: "a.ts", isTemplateMarked: true },
    ];

    let caught: unknown;
    try {
      detectDestinationCollisions(results);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AuthoringError);
    expect((caught as AuthoringError).reason).toEqual("invalid-input");
    const message = (caught as Error).message;
    expect(message).toContain("a.ts");
    expect(message).toContain("a.ts.template");
  });

  it("no collision when every destination is unique — does not throw", () => {
    const results: PipelineResult[] = [
      { sourceRelPath: "a.ts", destRelPath: "a.ts", isTemplateMarked: false },
      { sourceRelPath: "b.ts", destRelPath: "b.ts", isTemplateMarked: false },
    ];

    expect(() => detectDestinationCollisions(results)).not.toThrow();
  });
});
