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
 *     modify("src/config.ts", seedContent);
 *     break;
 *   case "present":
 *     modify("src/config.ts", patch(content));
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
export declare function classifyContent(content: string | undefined): ContentState;
//# sourceMappingURL=classify-content.d.ts.map