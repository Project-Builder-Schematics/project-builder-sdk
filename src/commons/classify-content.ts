// REQ-RT-01/-02/-03 (droppable, CQ-1): `find(path).read()` resolves `string | undefined`
// and authors branch manually with strict `=== undefined` / `=== ""` comparisons —
// truthiness-coalescing (`if (!content)`) silently merges `undefined`, `""`, `"0"`, and
// `"false"` and reintroduces the absent-vs-empty bug ADR-0016 fixed at the port level.
// This is a success-path helper only: it never throws and is not part of the
// error-attribution contract (REQ-ERM/-AEC families).

/**
 * The trichotomy of a `find(path).read()` result: `"absent"` (the path does not exist),
 * `"empty"` (the file exists but its content is the exact empty string), or `"present"`
 * (any other string — including falsy-looking ones like `"0"`, `"false"`, or
 * whitespace-only content).
 *
 * @example
 * switch (classifyContent(await find("src/config.ts").read())) {
 *   case "absent":
 *     create("src/config.ts", { template, options });
 *     break;
 *   case "empty":
 *     replaceContent("src/config.ts", seedContent);
 *     break;
 *   case "present":
 *     replaceContent("src/config.ts", patch(content));
 *     break;
 * }
 */
export type ContentState = "absent" | "empty" | "present";

/**
 * Classifies a `find(path).read()` result into the {@link ContentState} trichotomy.
 * Never throws. Uses strict equality only — `"0"`, `"false"`, and whitespace-only
 * strings all classify as `"present"`; a truthiness check (`if (!content)`) would wrongly
 * merge them with `"absent"`/`"empty"` (ADR-0016).
 *
 * @example
 * switch (classifyContent(await find("src/config.ts").read())) {
 *   case "absent":
 *     console.log("no such file yet");
 *     break;
 *   case "empty":
 *     console.log("file exists, no content");
 *     break;
 *   case "present":
 *     console.log("has content");
 *     break;
 * }
 */
export function classifyContent(content: string | undefined): ContentState {
  if (content === undefined) return "absent";
  if (content === "") return "empty";
  return "present";
}
