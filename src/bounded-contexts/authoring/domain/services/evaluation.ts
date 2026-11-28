// The run-boundary side of the role `evaluation`: the scope its inputs name (A-122, A-123) and
// the Findings it hands on, each with the `source` the SDK sets (A-121) and inside the scope (A-124).

import { isPlainObject } from "../valueobjects/schema-model.ts";
import { globMatcher } from "./glob-match.ts";

/** Whether a workspace-relative path is in the scope. */
export type InScope = (path: string) => boolean;

function globsOf(record: { [key: string]: unknown }, name: string): Array<(path: string) => boolean> | string | undefined {
  const value = Object.hasOwn(record, name) ? record[name] : undefined;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    return `invalid input: ${name} must be an array of strings`;
  }
  return value.map(globMatcher);
}

/**
 * The scope `include` less `exclude` names, or no scope when neither is given. A problem names the
 * scope input that is not an array of strings.
 */
export function scopeOf(input: unknown): { readonly inScope?: InScope } | { readonly problem: string } {
  const record = isPlainObject(input) ? input : {};
  const include = globsOf(record, "include");
  if (typeof include === "string") return { problem: include };
  const exclude = globsOf(record, "exclude");
  if (typeof exclude === "string") return { problem: exclude };
  if (include === undefined && exclude === undefined) return {};
  return {
    inScope: (path) => (include === undefined || include.some((matches) => matches(path))) && !(exclude ?? []).some((matches) => matches(path)),
  };
}

type Finding = { [key: string]: unknown };

/**
 * The Findings a factory returned, already checked against SOURCED_FINDINGS: each kept finding
 * gets `source`, and one whose `path` falls outside the scope is dropped. A problem names the first
 * finding whose author set `source`.
 */
export function handedOnFindings(
  findings: { readonly items: readonly Finding[] },
  source: string,
  inScope: InScope | undefined
): { readonly result: { items: Finding[] } } | { readonly problem: string } {
  const sourced = findings.items.findIndex((finding) => Object.hasOwn(finding, "source"));
  if (sourced !== -1) return { problem: `Result.items[${sourced}].source is set by the SDK, and a finding may not set it` };
  const kept = findings.items.filter((finding) => inScope === undefined || typeof finding.path !== "string" || inScope(finding.path));
  return { result: { items: kept.map((finding) => ({ ...finding, source })) } };
}
