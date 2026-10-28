# The CSS dialect

`@pbuilder/sdk/css` sets and removes declarations in `.css` files. It is built for files that
mix generated values with hand-written CSS, such as a design-token file synced from a JSON
export: the ops edit only the declaration they address, and everything else keeps its bytes.

```ts
import * as css from "@pbuilder/sdk/css";

// tokens.css: a hand-written header, then the tokens.
// @import "tailwindcss";
// @custom-variant dark (&:where(.dark, .dark *));
//
// @theme {
//   --color-primary: #0b254d;
// }
export const run = async () => {
  await css
    .find("tokens.css")
    .setDeclaration({ atRule: "theme" }, "--color-primary", "#1974f9")
    .setDeclaration({ selector: "html[data-theme='nylon']" }, "--color-primary", "#0b254d");
};
```

Ops chained on one handle coalesce into one pending directive for the file. Turning token JSON
into property names and values (aliases, modes) is the schematic's job; the dialect takes the
resolved strings.

## Targets

A target names one top-level block:

| Target | Block |
|---|---|
| `{ selector: ":root" }` | the top-level rule `:root { }` |
| `{ atRule: "theme" }` | the body of `@theme { }` |
| `{ atRule: "media", params: "(prefers-color-scheme: dark)", selector: ":root" }` | the `:root` rule inside that `@media` |

- The selector and params match after trimming whitespace, as written: `[data-theme='a']` and
  `[data-theme="a"]` are different targets. The at-rule name is written without `@` and matches
  case-insensitively.
- An at-rule statement with no body (`@layer base;`, `@import`) is never a target.
- A target that matches more than one block is rejected rather than guessed.

## Placement

- A missing block is created at the **end of the file**, so it always lands after `@import`
  (which must precede every other rule) and after any hand-written header. A rule inside an
  at-rule is created at the end of that at-rule.
- A new block follows the file's newline (`\n` or `\r\n`) and the indentation of its first
  top-level declaration, two spaces when there is none.
- A new declaration goes last in its block, or next to an existing one with `{ before }` or
  `{ after }`. An existing declaration is updated where it is and the anchor is ignored, so a
  second run never reorders the block.

## Property names and values

- Regular property names compare case-insensitively (`COLOR` is `color`); custom properties
  (`--color`) compare case-sensitively, as CSS does.
- A value is raw CSS (`#1974f9`, `var(--blue-500)`, `calc(1rem + 2px)`) and must be exactly one
  declaration value. `;` and `}` are fine inside strings (`content: ";"`).
- `!important` is the `important` option, never part of the value.
- The dialect does not reason about shorthands: setting `margin-top` leaves `margin` alone.

## Rejections

Every rejection throws before the file changes, with the `dialect operation failed: ` prefix:

- a property name that is not a CSS identifier or `--` custom property;
- a value that would close the declaration or add another one (`red; color: blue`, `red}`),
  carries `!important`, or is empty, and a regular property value that carries a comment
  (a custom property keeps a comment as part of its value);
- a target that is not `{ selector }`, `{ atRule, params? }`, or both, or whose selector or
  params would add another block;
- a target that matches more than one block;
- a property declared more than once in the block (a fallback such as
  `display: -webkit-box; display: flex;` is left for `.modify(fn)`);
- an anchor that is not declared in the block, or both `before` and `after`.

## Named ops

### `setDeclaration(target, property, value, options?)`

Sets `property` to `value` in the target block. An existing declaration is updated in place; a
new one goes last in the block or next to `options.before` / `options.after`; a missing block
is created at the end of the file. `options.important: true` writes `!important`, and leaving it
out removes it. Setting the value a declaration already has changes nothing.

```ts
css.find("tokens.css").setDeclaration({ atRule: "theme" }, "--color-accent", "#ff0", { after: "--color-primary" });
// @theme {
//   --color-primary: #0b254d;
//   --color-accent: #ff0;
// }
```

### `removeDeclaration(target, property)`

Removes `property` from the target block. A missing block or declaration is a no-op, so a sync
can remove tokens that may already be gone. The block stays, even when it ends up empty.

```ts
css.find("tokens.css").removeDeclaration({ atRule: "theme" }, "--color-accent");
```

## Format preservation

The dialect parses with [PostCSS](https://postcss.org/), which keeps every whitespace, comment,
and BOM byte. A file no op touched prints byte-identical, and an edited file changes only the
declarations and blocks the ops addressed.

## The escape hatch: `.modify(fn)` and reading values

`.modify(fn)` hands `fn` the live PostCSS `Root`, and `astLibrary` is the `postcss` package
itself, for anything the ops do not cover:

```ts
import * as css from "@pbuilder/sdk/css";

await css.find("app.css").modify((root) => {
  root.walkRules(".legacy", (rule) => rule.remove());
});
```

### `getDeclaration(root, target, property)`

Ops do not return values, so reading is a plain function the module exports. It takes a parsed
`Root` and returns `{ value, important }`, or `undefined` when the block or declaration is
missing, with the same target, name, ambiguity, and duplicate rules as the ops. Call it inside
`.modify(fn)` to decide what to change:

```ts
await css.find("tokens.css").modify((root) => {
  if (css.getDeclaration(root, { atRule: "theme" }, "--color-primary")?.value === "#0b254d") {
    // Scope the edit to @theme: a bare root.walkDecls would also rewrite the mode blocks.
    root.walkAtRules("theme", (theme) =>
      theme.walkDecls("--color-primary", (decl) => {
        decl.value = "#1974f9";
      })
    );
  }
});
```

or on a file you read yourself:

```ts
const root = css.astLibrary.parse((await css.find("tokens.css").read()) ?? "");
css.getDeclaration(root, { selector: ":root" }, "--radius"); // { value: "4px", important: false }
```
