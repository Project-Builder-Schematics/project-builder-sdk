/**
 * Checks over the pinned architecture checkout itself. They skip with a notice when the submodule
 * is not checked out, and fail then when RULES_REQUIRE_ARCHITECTURE=1 (the CI rules job).
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { STEP_DEFINITIONS } from "../../../src/acceptance/step-definitions.ts";
import { catalogPhrases, compilePhrase } from "../../../src/acceptance/runner/catalog.ts";
import { ARCHITECTURE_ROOT, loadPickles, requireArchitecture } from "../../../src/acceptance/runner/features.ts";
import { DESIGNED, IMPLEMENTED, select } from "../../../src/acceptance/runner/selection.ts";

const PROJECT_ROOT = join(import.meta.dir, "../../..");

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

if (requireArchitecture()) {
  const pickles = loadPickles();
  const catalog = catalogPhrases();

  describe("the architecture pin", () => {
    const gitlink = git(PROJECT_ROOT, ["ls-tree", "HEAD", relative(PROJECT_ROOT, ARCHITECTURE_ROOT)]).split(/\s+/)[2]!;

    it("is the commit the checkout has, so the suite reads the pinned rules", () => {
      expect(git(ARCHITECTURE_ROOT, ["rev-parse", "HEAD"])).toBe(gitlink);
    });

    it("is a v* release tag of project-builder-architecture", () => {
      const tags = git(ARCHITECTURE_ROOT, ["tag", "--points-at", gitlink]).split("\n");
      expect(tags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))).not.toEqual([]);
    });
  });

  describe("the architecture rules", () => {
    it("never select one scenario for both the strict and the report-only pass", () => {
      expect(select(pickles, `(${IMPLEMENTED}) and (${DESIGNED})`).map((pickle) => pickle.name)).toEqual([]);
    });

    it("tag every @sdk scenario with a status", () => {
      expect(select(pickles, "@sdk and not @status:implemented and not @status:designed").map((p) => p.name)).toEqual([]);
    });
  });

  describe("the step catalog", () => {
    // Just under the 645 phrases at v0.18.0, so a table format change cannot empty the catalog
    // and pass the checks below vacuously.
    it("reads at least 600 phrases", () => {
      expect(catalog.length).toBeGreaterThanOrEqual(600);
    });

    it("compiles every phrase as a Cucumber expression", () => {
      expect(catalog.filter((phrase) => {
        try {
          compilePhrase(phrase);
          return false;
        } catch {
          return true;
        }
      })).toEqual([]);
    });

    it("holds every phrase a step definition uses, word for word", () => {
      expect(STEP_DEFINITIONS.map((definition) => definition.phrase).filter((phrase) => !catalog.includes(phrase))).toEqual([]);
    });
  });
}
