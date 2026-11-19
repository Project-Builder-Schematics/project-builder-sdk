// What a driving adapter in another context needs from the run-factory use case besides
// defineFactory: it reaches Authoring through this application layer, never its domain
// (CODE-LAYOUT:131).

import { AuthoringError, type AuthoringOrigin } from "../../../domain/valueobjects/authoring-error.ts";
import { locateFirstJsonSyntaxError } from "../../../domain/services/schema/schema-locate.ts";
import { formatLocator } from "../../../domain/services/schema/schema-parse.ts";

/** The origin of an Authoring rejection, or `undefined` for any other error. */
export function authoringOrigin(err: unknown): AuthoringOrigin | undefined {
  return err instanceof AuthoringError ? err.origin : undefined;
}

/** Where `raw`, already rejected by `JSON.parse`, breaks: "(line L, column C)" or "(position unknown)". */
export function describeJsonSyntaxError(raw: string): string {
  const locator = locateFirstJsonSyntaxError(raw);
  return formatLocator(locator?.line, locator?.column);
}
