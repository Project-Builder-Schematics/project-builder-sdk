import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CucumberExpression, ParameterTypeRegistry } from "@cucumber/cucumber-expressions";
import { ARCHITECTURE_ROOT } from "./features.ts";

const PHRASE_ROW = /^\| `([^`]+)` \|/;
const QUOTED_PARAMETER = /"\{[^}]+\}"/;
// Cucumber expression syntax: `(` and `)` mark optional text, `/` alternation, `{` `}` a parameter.
const EXPRESSION_SYNTAX = /[(){}/\\]/g;

/** Every phrase of `steps/CATALOG.md`, as written in its tables' first column. */
export function catalogPhrases(root: string = ARCHITECTURE_ROOT): string[] {
  const phrases: string[] = [];
  for (const line of readFileSync(join(root, "steps", "CATALOG.md"), "utf-8").split("\n")) {
    const match = PHRASE_ROW.exec(line);
    if (match) phrases.push(match[1]!);
  }
  return phrases;
}

/**
 * A catalog phrase as a Cucumber expression: each quoted `"{name}"` parameter becomes `{string}`,
 * and every other character matches literally (`"../"` in a phrase is text, not a parameter).
 */
export function phraseToExpression(phrase: string): string {
  return phrase
    .split(QUOTED_PARAMETER)
    .map((literal) => literal.replace(EXPRESSION_SYNTAX, (char) => `\\${char}`))
    .join("{string}");
}

const registry = new ParameterTypeRegistry();

export function compilePhrase(phrase: string): CucumberExpression {
  return new CucumberExpression(phraseToExpression(phrase), registry);
}
