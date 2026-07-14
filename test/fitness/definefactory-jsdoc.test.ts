/**
 * FPS-05.2/.3/.4 — dedicated doc-assertion (design §4.2/§4.6, Gap 5, S-005). Reads
 * `src/core/context.ts` and asserts `defineFactory`'s JSDoc carries `@example` (the
 * bin-invocation-to-typed-call workflow, REQ-FPS-05.2) and `@remarks` naming BOTH reserved
 * lifecycle tokens (REQ-FPS-05.3). `fit-06-example-jsdoc.test.ts` is LEFT UNTOUCHED — its
 * `PUBLIC_PATHS` scans only `src/commons`/`src/conformance`, and `defineFactory` is exported
 * from the internal-kit root `src/core/index.ts` (ADR-0009); broadening FIT-06 would wrongly
 * impose `@example` on every internal-kit export, so this dedicated, symbol-targeted
 * assertion is the pin instead. Also carries REQ-FPS-05.4 (README qualifying line,
 * byte-for-byte, Gap 13) — same discoverability REQ family, same slice, no dedicated home
 * named by design so it lands here alongside its sibling scenarios.
 *
 * Same static-text-scan convention as doc-discoverability.test.ts/FIT-06/FIT-08/FIT-09:
 * readFileSync + regex, no markdown/TS-AST parser dependency.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsDocBefore, PROJECT_ROOT } from "../support/jsdoc-scan.ts";

const CONTEXT_SOURCE = readFileSync(join(PROJECT_ROOT, "src/core/context.ts"), "utf-8");
const DEFINE_FACTORY_DOC = jsDocBefore(CONTEXT_SOURCE, /^export function defineFactory<O>\($/);

describe("REQ-FPS-05.2 — defineFactory's JSDoc @example demonstrates the full bin-to-typed workflow", () => {
  it("shows the bin invocation against schema.json, then a typed defineFactory<O> call using the generated type", () => {
    expect(DEFINE_FACTORY_DOC).toContain("@example");
    expect(DEFINE_FACTORY_DOC).toContain("pbuilder-codegen");
    expect(DEFINE_FACTORY_DOC).toContain("schema.json");
    expect(DEFINE_FACTORY_DOC).toMatch(/defineFactory<\w+>/);
    expect(DEFINE_FACTORY_DOC).toContain("schema.generated");
  });
});

describe("REQ-FPS-05.3 — reserved lifecycle names are documented at defineFactory's doc-comment surface", () => {
  it("@remarks names both pre-execute and post-execute, independent of triggering a rejection", () => {
    expect(DEFINE_FACTORY_DOC).toContain("@remarks");
    expect(DEFINE_FACTORY_DOC).toContain("pre-execute");
    expect(DEFINE_FACTORY_DOC).toContain("post-execute");
  });
});

describe("REQ-FPS-05.2 (re-aim, bare-factory-migration) — defineFactory's JSDoc is marked @internal with a sanctioned-callers note", () => {
  it("carries a literal @internal tag", () => {
    expect(DEFINE_FACTORY_DOC).toMatch(/(?:^|\*|\s)@internal(?:\s|$)/m);
  });

  it("names the three sanctioned caller roots (enforced by FIT-29)", () => {
    expect(DEFINE_FACTORY_DOC).toContain("src/core/");
    expect(DEFINE_FACTORY_DOC).toContain("src/testing/");
    expect(DEFINE_FACTORY_DOC).toContain("src/conformance/");
  });

  it("still carries a valid @example even though marked @internal (FIT-06's cascade obligation survives)", () => {
    expect(DEFINE_FACTORY_DOC).toContain("@example");
  });

  it("the @example no longer frames defineFactory as the author's own path", () => {
    expect(DEFINE_FACTORY_DOC).not.toMatch(/Author against/);
  });

  it("the @example shows the internal wrap+drive pattern — a runner driven with a client", () => {
    expect(DEFINE_FACTORY_DOC).toContain("{ client }");
  });
});

describe("REQ-FPS-05.4 — README incremental-shipping qualifying line (reverted by stage-4b REQ-TSD-03)", () => {
  // The scenario's own text anticipated this flip: "this line is REVERTED when
  // stage-4b-testing-harness lands (temporary, stage-scoped qualifier)". `stage-4b`'s
  // REQ-TSD-03 owns the revert (openspec/changes/stage-4b-testing-harness); this permanent
  // regression guard stays here so a future change can never silently reintroduce the
  // stale qualifier once the API this note qualified is real.
  const README_QUALIFYING_LINE =
    '> **Note**: shipping incrementally — the external-author API (installable `defineFactory` + testing harness) lands with stage-4b.';

  it("README.md no longer contains the qualifying line — the external-author API it qualified now ships", () => {
    const readme = readFileSync(join(PROJECT_ROOT, "README.md"), "utf-8");
    expect(readme).not.toContain(README_QUALIFYING_LINE);
  });
});
