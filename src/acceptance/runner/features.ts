import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { generateMessages } from "@cucumber/gherkin";
import { IdGenerator, SourceMediaType, type PickleStep } from "@cucumber/messages";

/** The pinned checkout of project-builder-architecture (a git submodule). */
export const ARCHITECTURE_ROOT = join(import.meta.dir, "../../../third_party/project-builder-architecture");

export interface RulePickle {
  /** Feature file path relative to the architecture root. */
  readonly feature: string;
  readonly name: string;
  /** Tags inherited from the Feature, Rule, Scenario and Examples, as Cucumber defines. */
  readonly tags: readonly string[];
  readonly steps: readonly PickleStep[];
}

export function architectureAvailable(root: string = ARCHITECTURE_ROOT): boolean {
  return existsSync(join(root, "steps", "CATALOG.md"));
}

/**
 * True when the checkout is there. Otherwise the rule suites are skipped with a notice, as the
 * architecture README asks, unless `RULES_REQUIRE_ARCHITECTURE=1`: CI sets it where the
 * checkout must exist, so a missing checkout there fails instead of passing silently.
 */
export function requireArchitecture(root: string = ARCHITECTURE_ROOT): boolean {
  if (architectureAvailable(root)) return true;
  const message = `project-builder-architecture is not checked out at ${root}; run git submodule update --init`;
  if (process.env.RULES_REQUIRE_ARCHITECTURE === "1") throw new Error(message);
  console.log(`::notice::${message}. The rule suites are skipped.`);
  return false;
}

/** Compiles one feature into pickles: one per Scenario, one per Examples row of an Outline. */
export function compileFeature(source: string, feature: string): RulePickle[] {
  const envelopes = generateMessages(source, feature, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, {
    includeGherkinDocument: false,
    includePickles: true,
    includeSource: false,
    newId: IdGenerator.incrementing(),
  });
  const pickles: RulePickle[] = [];
  for (const envelope of envelopes) {
    if (envelope.parseError) throw new Error(`${feature}: ${envelope.parseError.message}`);
    const pickle = envelope.pickle;
    if (pickle) pickles.push({ feature, name: pickle.name, tags: pickle.tags.map((tag) => tag.name), steps: pickle.steps });
  }
  return pickles;
}

function featureFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...featureFiles(path));
    else if (entry.name.endsWith(".feature")) files.push(path);
  }
  return files.sort();
}

export function loadPickles(root: string = ARCHITECTURE_ROOT): RulePickle[] {
  return featureFiles(root).flatMap((path) => compileFeature(readFileSync(path, "utf-8"), relative(root, path)));
}
