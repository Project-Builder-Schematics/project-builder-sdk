// m2-modify (wire-mutation, REQ-CFX-06): default export replaces target.txt with fixed
// content; notFoundProbe (not-found-twin, case-level factory override, ADR-0065) targets a
// path absent from the shared seed, producing a directive-level not-found rejection.
import { replaceContent } from "../../src/index.ts";

export default function m2ModifyFactory(_input: Record<string, never>): void {
  replaceContent("target.txt", "replaced");
}

export function notFoundProbe(_input: Record<string, never>): void {
  replaceContent("missing.txt", "replaced");
}
