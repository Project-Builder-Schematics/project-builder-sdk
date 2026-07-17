# Authoring `create` templates

A guide to the template language you use inside `create()`: how to turn one set of options
into real, multi-section source files on disk.

> **Audience.** Schematic authors using `@pbuilder/sdk`. You write templates and options; the
> **engine** renders them and writes the files. The SDK never renders anything — it carries
> your template and options to the engine verbatim (see
> [What the SDK does — and does not — do](#what-the-sdk-does--and-does-not--do)).
>
> **Coming from JavaScript?** The template syntax is *not* JavaScript — loops and conditionals
> in particular look different enough that guessing from JS habits will mislead you. If you read
> only one section, read [section 4](#4-loops-and-conditionals--read-this-if-you-know-javascript).
>
> **Status.** This covers the v1 template surface. Everything below is guaranteed behavior.
> Features noted as *blocked* or *not available in v1* are called out explicitly.

---

## 1. The `create` surface

```ts
import { create } from "@pbuilder/sdk/commons";

create("src/{= .name | dasherize =}.ts", {
  template: "export const {= .name | classify =} = 1;\n",
  options: { name: "myThing" },
});
```

renders to path `src/my-thing.ts` with content:

```ts
export const MyThing = 1;
```

Three pieces are in play:

| You pass | What it does |
|---|---|
| `path` (first argument) | A **template string**, rendered to produce the output file path. |
| `template` | A template string, rendered to produce the **file's byte content**. |
| `options` | The **data context** — the single set of values shared by both renders. |

The path and the content are rendered against the **same** `options` object, and they are
rendered **independently**: neither can see the other's output, and there is no ordering
dependency between them.

The `templateFile` overload — `create(path, { templateFile, options })` — reads a
package-local file at emission time instead of an inline `template` string; the file's text
is the template, and everything in this guide applies to it unchanged.

### One options object drives both fields

This is the core idea — the same `options` feeds the path and the content at once:

```ts
create("src/{= .name | dasherize =}/{= .name | dasherize =}.component.ts", {
  template:
    "export class {= .name | classify =}Component {\n" +
    "{= range .methods =}  {= .name =}() {}\n{= end =}}\n",
  options: {
    name: "userProfile",
    methods: JSON.stringify([{ name: "load" }, { name: "save" }]),
  },
});
```

The path reads `.name`; `template` reads both `.name` and `.methods`. Result:

Path — `src/user-profile/user-profile.component.ts`

```ts
export class UserProfileComponent {
  load() {}
  save() {}
}
```

(Why the `JSON.stringify` around the array — see
[the appendix](#appendix-passing-arrays-and-objects-in-v1).)

### Overwrite behavior (`force`)

`force` is **not** part of a template — it's a flag that controls what happens when the target
file already exists:

- **Default (no force):** a collision is an error. Zero files written, the existing file is
  untouched.
- **Per-operation force:** pass `{ force: true }` to that `create()` and that file is
  overwritten.

The engine wire also carries a run-wide force ("overwrite everything"), but the v1 author
surface does not expose it — in v1, force is always a per-operation decision.

### What the SDK does — and does not — do

The SDK **schedules** the directive and forwards `path`, `template`, and `options` to the
engine byte-for-byte. It never parses, validates, or renders a template. Two practical
consequences:

- **Template errors surface at run time, from the engine** — not when `create()` is called.
  A typo'd option name is invisible until the engine renders (see
  [Errors](#9-when-something-goes-wrong)).
- **The contract fake does not render either.** In tests, the fake stores your raw template
  text as the file's content — asserting on a fake tree shows `{= .name =}` literally, not
  `myThing`. Rendered output is the engine's concern and is covered by the engine's own test
  suite; your tests assert that the right directive was scheduled with the right template and
  options.

---

## 2. Delimiters, fields, and comments

Templates use the delimiters `{=` and `=}` — **not** the more familiar `{{ }}`. Inside the
delimiters you reference your options through a leading dot:

| You write | It means |
|---|---|
| `{= .name =}` | the `name` option |
| `{= .user.address.city =}` | walk nested objects: `user` → `address` → `city` |
| `{= . =}` | the current context itself (useful inside `range`/`with`) |

**Emit a literal `{=`.** There is no backslash escape. To print the delimiter itself, wrap it in
a quoted string action: `{= "{=" =}` renders the literal text `{=`.

**Comments.** `{= /* a note to yourself */ =}` never produces output. On a line by itself it is
removed cleanly (see [Whitespace](#7-whitespace-clean-by-default)).

### Numbers render as plain digits

A JSON number always interpolates as ordinary digits — never scientific notation:

| Option value | Renders as |
|---|---|
| `42` | `42` |
| `1000000` | `1000000` (never `1e+06`) |
| `3.14` | `3.14` |

A key that is **present but `null`** does not render as blank — it fails with a typed error
(see [Errors](#9-when-something-goes-wrong)). This is deliberate: a null in your output is almost
always a mistake, so the engine stops rather than writing `<no value>`.

---

## 3. The 7 pipes

Pipes transform a **string** value. You apply one with `|`:

| Pipe | `"userProfile"` becomes | Rule |
|---|---|---|
| `upper` | `USERPROFILE` | uppercase every letter |
| `lower` | `userprofile` | lowercase every letter |
| `capitalize` | `UserProfile` | uppercase the first letter only |
| `dasherize` | `user-profile` | split into words, lowercase, join with `-` |
| `underscore` | `user_profile` | split into words, lowercase, join with `_` |
| `camelize` | `userProfile` | PascalCase, first word lowercased |
| `classify` | `UserProfile` | PascalCase including the first word |

**`classify` does not singularize.** Unlike the `classify` in Rails or Angular, a plural stays
plural — `users` becomes `Users`, not `User`. If you need the singular, pass the singular in your
options.

**Chain pipes left to right** — order is observable:

```
{= .name | underscore | upper =}
```

`"MyComponent"` → `my_component` → `MY_COMPONENT`.

**Pipes take strings only.** Applying a pipe to a number (or any non-string) is an error naming
the pipe and the offending kind — the engine never silently stringifies a value for you.

---

## 4. Loops and conditionals — read this if you know JavaScript

This is the section where the template language will surprise you. The syntax comes from Go's
`text/template`, **not** JavaScript — loops and conditionals look different enough that guessing
from JS habits will lead you wrong. This section maps every JS pattern to its template form.

Two rules up front, because they cause the most confusion:

1. **Blocks are opened by a keyword and closed by `{= end =}` — there are no braces `{}`.**
2. **Comparisons and logic are function calls written _operator-first_ (`eq a b`), not infix
   (`a === b`).** JavaScript's `===`, `&&`, `||`, `!`, `<`, `>` **do not exist** in a template.

### Loops: `range`, not `for` or `.map()`

There is no `for`, no `.map()`, no `.forEach()`, no arrow function. You write `range`, then the
block body, then `{= end =}`.

```js
// JavaScript
methods.map(m => `  ${m.name}() {}\n`).join("")
```

```
{= range .methods =}  {= .name =}() {}
{= end =}
```

with `methods: [{ "name": "load" }, { "name": "save" }]` this emits one line per element. Array
order is preserved exactly — the engine never reorders your list.

**Inside the block, the dot `.` _becomes_ the current element.** There is no parameter name unless
you ask for one — `.` is the item, and `.name` reads the `name` field of the current item:

```
{= range .items =}[{= . =}]{= end =}
```
over `["x", "y"]` → `[x][y]`.

**Want the index and the value** (like `for (const [i, v] of items.entries())`)? Declare them with
`$` variables and `:=`:

```
{= range $i, $v := .items =}{= $i =}:{= $v =} {= end =}
```
over `["a", "b"]` → `0:a 1:b `.

| JavaScript | Template |
|---|---|
| `for (const m of methods) { … }` | `{= range .methods =} … {= end =}` (item is `.`) |
| `items.map(x => …)` | `{= range .items =} … {= end =}` |
| `items.forEach((v, i) => …)` | `{= range $i, $v := .items =} … {= end =}` |
| `Object.entries(obj).map(([k, v]) => …)` | `{= range $k, $v := .obj =} … {= end =}` |

Ranging over an **object** iterates its keys in **sorted order** (deterministic); ranging over an
**array** keeps the array's own order.

### Conditionals: `if`, but the operators come first

The single biggest surprise. A comparison is a **function call with the operator name first**,
then its operands — the opposite of JavaScript's infix style:

| JavaScript | Template |
|---|---|
| `a === b` | `eq a b` |
| `a !== b` | `ne a b` |
| `a < b` | `lt a b` |
| `a > b` | `gt a b` |
| `a <= b` | `le a b` † |
| `a >= b` | `ge a b` † |
| `a && b` | `and a b` |
| `a \|\| b` | `or a b` |
| `!a` | `not a` |

† `le` and `ge` work but are not part of the guaranteed core set — see the note in
[section 5](#5-operator-reference). If you want a stable guarantee, invert with `not (gt …)` /
`not (lt …)`.

So an equality check is:

```js
if (kind === "primary") { … }              // JavaScript
```
```
{= if eq .kind "primary" =}…{= end =}       // template — "eq" first, then the two operands
```

**Combine conditions by nesting the calls in parentheses** — there is no `&&` / `||`:

```js
if (a > 1 && b < 5) { … }                            // JavaScript
```
```
{= if and (gt .a 1.0) (lt .b 5.0) =}…{= end =}       // template
```

**`else` and `else if`:**

```
{= if eq .kind "primary" =}main
{= else if eq .kind "secondary" =}alt
{= else =}other
{= end =}
```

### Truthiness — almost JS-falsy, with one trap

`{= if .x =}` with no operator tests whether `.x` is "empty":

| Value | `{= if .x =}` sees | Same as JS? |
|---|---|---|
| `false` | falsy | ✅ |
| `0` | falsy | ✅ |
| `""` (empty string) | falsy | ✅ |
| `null` | falsy | ✅ |
| `[]` (empty array) | **falsy** | ❌ — in JS `[]` is **truthy** |
| `{}` (empty object) | **falsy** | ❌ — in JS `{}` is **truthy** |
| any non-empty value | truthy | ✅ |

The trap: an **empty array or object is falsy here**. That's actually convenient — to check "does
this list have items" you write `{= if .items =}` directly, with no `.length`. In JavaScript you'd
need `items.length > 0` precisely because `[]` is truthy.

### The number-type trap (important)

Number literals must match the numeric type of what you compare against, or the render **errors**:

- **Option values that are JSON numbers arrive as decimals.** Compare them with a **decimal
  literal**: `eq .count 2.0` works; `eq .count 2` **errors**.
- **`len` returns an integer.** Compare it with a **whole-number literal**: `gt (len .items) 0`
  works; `gt (len .items) 0.0` **errors**.

In JavaScript `2 === 2.0` is `true` and you never think about it. Here the two literal forms are
distinct types and mixing them across a comparison is an error. Rule of thumb: **decimal literal
for an option value, whole number for `len`.**

### `with` — narrow the context (no direct JS equivalent)

```
{= with .user =}{= .name =} ({= .email =}){= end =}
```

`with` rebinds the dot `.` to `.user` for the block, so inside you write `.name` and `.email`
instead of `.user.name` / `.user.email`. The closest JavaScript analogy is destructuring an object
into local scope, but mechanically it's "set the data context to this object for this block."

### Variables — assign once, reuse

```
{= $base := .name | dasherize =}
{= $base =}.component.ts
{= $base =}.component.spec.ts
```

`$name` declares a variable with `:=` (same as a `range` index/value). Assign a piped value once
and reuse it instead of repeating the pipe.

> **Not available in v1: sub-templates.** `define`, `template`, and `block` are **blocked at
> parse time** — a template using them fails with a typed error and writes nothing. This is a
> deliberate safety limit, not an oversight.

---

## 5. Operator reference

The comparison and logic operators from [section 4](#4-loops-and-conditionals--read-this-if-you-know-javascript),
plus the two data helpers, in one table. All are written operator-first as function calls, never
piped:

| Operator | Meaning | JS equivalent |
|---|---|---|
| `eq` / `ne` | equal / not equal | `===` / `!==` |
| `lt` / `gt` | less-than / greater-than | `<` / `>` |
| `le` / `ge` † | less-or-equal / greater-or-equal | `<=` / `>=` |
| `and` / `or` / `not` | logical and / or / not | `&&` / `\|\|` / `!` |
| `len` | length of a string, array, or object | `.length` / `Object.keys().length` |
| `index` | element or key lookup | `arr[0]` / `obj["k"]` |

```
{= if eq .kind "primary" =}…{= end =}
{= if gt (len .items) 0 =}has items{= end =}
{= index .items 0 =}
```

The **guaranteed core** is `eq`, `ne`, `lt`, `gt`, `and`, `or`, `not`, `len`, `index`. Build every
condition from these and it will keep working across engine versions.

> **† Available but not guaranteed.** `le`, `ge`, `html`, `js`, and `urlquery` render today but are
> outside the guaranteed core — treat them as convenience, not contract. `printf`, `print`,
> `println`, and `call` are restricted for safety and behave differently from their standard
> versions — avoid relying on them.
>
> Pipes and operators are different tools: `dasherize` is a **pipe** (`.name | dasherize`); `eq`
> is an **operator** (`eq .kind "primary"`). This guide never calls an operator a "pipe."

---

## 6. Templating the output path

The `path` argument uses the **same** language as `template` — the same fields, pipes, and
sandbox. That's how you get a cased directory and filename from one option:

```ts
create("src/{= .name | dasherize =}/{= .name | classify =}.ts", { template, options });
```

with `name: "userProfile"` → `src/user-profile/UserProfile.ts`.

The rendered path is checked for containment: a path that tries to escape the workspace (for
example via `../`) is rejected with a typed error and **zero files are written**.

---

## 7. Whitespace: clean by default

A line that contains **only** a control directive — `range`, `if`, `else`, `end`, `with`, an
assignment, or a comment — is removed whole (its indentation and trailing newline) before
rendering. You do not need to hug delimiters or add trim markers to avoid blank-line gaps.

| The `{= =}` on a line holds… | Trimmed? |
|---|---|
| `range` / `if` / `else` / `end` / `with` | yes |
| `$x := …` (assignment) | yes |
| `/* comment */` | yes |
| a field or pipe expression (`.name`, `.x \| upper`) | **never** |

So this template:

```
{= range .methods =}
  {= .name =}
{= end =}
```

produces one clean line per method, with no blank lines from the `range`/`end` lines.

**Keeping a blank line.** The cleaner only touches lines that hold a `{= =}` directive. A
genuinely empty line — no directive on it — is always preserved:

```
before

{= if .x =}
after
{= end =}
```

The blank line between `before` and the `if` survives.

---

## 8. Sandbox limits

Rendering runs inside a sandbox. As an author, these are the boundaries you'll notice:

- **Options must be plain JSON** — strings, numbers, booleans, null, arrays, and objects. That's
  the whole data model.
- **Output is size-bounded.** A render that produces more than the output budget aborts mid-way
  with a typed error rather than writing a truncated file.
- **The path is gated after rendering** — see [section 6](#6-templating-the-output-path).
- **Pipes are a closed set** — the 7 in [section 3](#3-the-7-pipes) and no others; an unknown
  pipe name is an error that lists the valid names.

These limits exist so a template can't exhaust memory, escape the workspace, or reach outside its
data. You won't hit them in normal authoring.

---

## 9. When something goes wrong

Every failure is a **typed, positioned** error (it names a `File:Line:Column`) and, on failure,
**no files are written**. The engine fails the whole render closed rather than producing a
partial or surprising file.

Because the SDK never renders (see
[section 1](#what-the-sdk-does--and-does-not--do)), all of these surface **at run time**, when
the engine renders — never at the moment `create()` is called.

| What happened | Trigger |
|---|---|
| **Undefined key** | You referenced a field that isn't in `options` (usually a typo). Names the key; does not list valid keys. |
| **Null value** | A field is present but its value is `null`, and you interpolated it. |
| **Parse error** | Malformed action syntax, or a blocked `define`/`template`/`block`. Fires before anything renders. |
| **Unknown pipe** | A pipe name that isn't one of the 7. Lists the valid names. |
| **Pipe coercion** | A pipe applied to a non-string value. Names the pipe and the value's kind. |
| **Output budget** | The render exceeded the size cap. Aborts mid-render; never truncates-and-succeeds. |
| **Path traversal** | The rendered path tried to escape the workspace. |

A mistyped option name gives you the exact line and column of the reference — so fixing it is a
matter of reading the position, not hunting.

---

## Glossary

- **template** — the raw text you pass as `template` (or the file behind `templateFile`), and
  the `path` argument, before rendering.
- **action** — anything inside `{= … =}`: an interpolation, a control directive, an assignment,
  or a comment.
- **option** — a single key in the `options` object.
- **data context** — the whole `options` object as one render sees it.
- **pipe** — one of the 7 case/word transforms. Built-in operators (`eq`, `len`, …) are not
  pipes, even though they look similar.
- **force** — the overwrite flag; not part of the template language.

---

## Appendix: passing arrays and objects in v1

The SDK forwards `options` to the engine verbatim, and the engine's v1 wire expects array- and
object-valued options as **JSON-encoded strings** — it promotes a string value that begins with
`[` or `{` into a real array/object before rendering. So to `range` over a list today, encode it:

```ts
create("src/{= .name | dasherize =}.component.ts", {
  template: "export class {= .name | classify =}Component {\n{= range .methods =}  {= .name =}() {}\n{= end =}}\n",
  options: {
    name: "userProfile",
    methods: JSON.stringify([{ name: "load" }, { name: "save" }]),
  },
});
```

Inside the template the promoted value behaves as a real array — `range`, `len`, `index`, and
nested field access all work as documented above. A typed feeder that accepts native arrays and
objects is planned; until then, `JSON.stringify` at the call site is the v1 mechanism.
