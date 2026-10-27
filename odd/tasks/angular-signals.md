Objective: Angular delivery 2 — signal and DI class members (`addInjection`, `addInput`, `addOutput`, `addModel`, `addSignal`, `addComputed`), on top of a new TypeScript base op `addClassProperty`.
Branch: feat/angular-signals-01-class-property (from main 2ef6c5f). Delivery: ask-on-risk, chain strategy stacked-to-main (cached from `odd/tasks/angular-dialect.md` L8). Test runner: `bun test` (focused: `bun test test/dialects/typescript test/dialects/angular`).
Inputs: Angular v22 docs via the `angular-cli` MCP (style guide, inputs guide), summarized in `## Log`.

## Specs

S1 — TypeScript base op, class chosen by name. Owner choice, verbatim: "Si me parece" to "¿La op base de `typescript` recibe la clase por nombre, y las ops de Angular la resuelven por decorator?". `addClassProperty(className, name, initializer, options?)` adds `{scope }{readonly }name = initializer;` to the only class named `className`. `options`: `{ scope?: "public" | "protected" | "private"; readonly?: boolean }`; no modifier is written when omitted. (Option set: default — owner may override.)

S2 — Placement and layout: after the class's last property declaration, else as its first member, so properties stay before the constructor and methods (Angular style guide: "Define these and other properties before the class's methods"). The new line takes the indentation of the existing members, or the class's indentation plus two spaces in an empty class. (Default — owner may override.)

S3 — Validation and duplicates: `name` is a valid identifier; `initializer` must parse as exactly one expression (the `addArrayElement` `{ expression }` rule). An existing property with the same declaration, compared token by token, is a no-op; any other member named `name` rejects. No class or several classes named `className` reject. (Default — owner may override.)

S4 — Angular ops resolve the class by decorator: `addInput`, `addOutput`, `addModel`, `addSignal`, `addComputed` target the file's only class decorated with `@Component` or `@Directive` (Angular: "You can exclusively call input in component and directive property initializers"); `addInjection` also accepts `@Pipe`, `@Injectable` and `@Service`. Zero or several candidate classes reject. (Default — owner may override.)

S5 — `addInjection(name, token, options?)`: `private readonly name = inject(<token>);` and `import { inject } from "@angular/core"`. `token` is an identifier or `{ expression }`; `options`: `{ scope?, imports? }` (scope defaults to `private`; `imports` as in delivery 1). (Default — owner may override.)

S6 — `addInput(name, options?)` / `addModel(name, options?)`: `readonly name = input<T>(initial)` / `model<T>(initial)`, or `input.required<T>()` / `model.required<T>()`; imports `input` / `model`. `options`: `{ type?, initial?, required?, imports? }`; `required` with `initial` rejects; `type` must parse as one type. Angular style guide: "Mark component and directive properties initialized by Angular as readonly. This includes properties initialized by input, model, output". (Default — owner may override.)

S7 — `addOutput(name, options?)`: `readonly name = output<T>();`, imports `output`. `options`: `{ type?, imports? }`. (Default — owner may override.)

S8 — `addSignal(name, initial, options?)` / `addComputed(name, expression, options?)`: `protected readonly name = signal<T>(initial)` / `protected readonly name = computed(() => expression)`; imports `signal` / `computed`. `options`: `{ type?, scope?, imports? }`, scope defaults to `protected` (Angular style guide: "Prefer protected access for any members that are meant to be read from the component's template"). (Default — owner may override.)

S9 — Error tails follow the house format `<op>("<name>") on "<file>" — <reason>. Edit it with .modify().`; docs and baselines updated as for delivery 1.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1-S3, S9 | inline | done — RED 14 fail → GREEN 15 pass; full suite 3655 pass, 7 fail = the 7 failing on main | PR A |
| T2 | S4-S7, S9 | inline | done — RED 16 fail → GREEN 17 pass; full suite 3676 pass, 7 fail = the 7 failing on main | PR B |
| T3 | S4, S8, S9 | inline | pending — PR C | — |

Route evidence: one dependent chain (T2 and T3 build on T1), each unit under ~400 lines; no writer trigger fires.

## Log

L1 (2026-10-28, user, verbatim): "mergeado, que sigue?" — answered with delivery 2 (signals + DI) needing a TypeScript class-member base op first.
L2 (2026-10-28, user, verbatim): "Si me parece" — base op takes the class by name; Angular ops resolve it by decorator.
L3 (2026-10-28): Angular v22 docs — `input(initial)`, `input<T>()`, `input.required<T>()`, `model(...)`/`model.required<T>()`, `output<T>()` (https://angular.dev/guide/components/inputs); style guide: readonly for input/model/output, protected for template-only members, Angular properties grouped before methods (https://angular.dev/style-guide); `@Service` exists in v22 (https://angular.dev/reference/migrations/injectable-to-service).
L4 (2026-10-28): the TypeScript dialect has no class-member op (`addFunction`/`addVariable`/`addClass` append top-level statements only). Adding a TS op touches ops.ts, pack.ts, index.ts JSDoc, a new ops test, ops-exact-set, security-authoring-guard, README ops table, docs/authoring-a-dialect.md, and the inherited-op lists in docs/nestjs-dialect.md and docs/angular-dialect.md.
L5 (2026-10-28): Engram mirror pending — `mem_current_project` is ambiguous for this directory.
