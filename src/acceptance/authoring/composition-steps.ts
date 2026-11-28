import { byExtension, defineDialect, withOps, type Dialect, type OpPack } from "../../bounded-contexts/authoring/domain/services/define-dialect.ts";
import type { StepDefinition, World } from "../runner/steps.ts";
import { AUTHOR_DIALECTS } from "../shared/factory-run.ts";

/** The plain-text AST of a dialect implementer's base dialect (CATALOG). */
type Text = { text: string };
const TEXT_AST = { parse: (text: string): Text => ({ text }), print: (tree: Text): string => tree.text };

/**
 * What a scenario built, as runtime values and as TypeScript source, so a type step can compile
 * the same composition. Base dialects and op packs are kept apart from the Dialects authors open.
 */
interface Composition {
  readonly bases: Map<string, Dialect<Text>>;
  readonly packs: Map<string, OpPack<Text>>;
  /** One `const` declaration per base dialect, op pack and Dialect, in the order the steps ran. */
  readonly source: string[];
  failure?: unknown;
}

export function composition(world: World): Composition {
  world.composition ??= { bases: new Map(), packs: new Map(), source: [] } satisfies Composition;
  return world.composition as Composition;
}

function dialects(world: World): Map<string, unknown> {
  return (world[AUTHOR_DIALECTS] ??= new Map()) as Map<string, unknown>;
}

/** A TypeScript identifier for a name the scenario gives. */
export const identifier = (name: string): string => `_${name.replace(/[^A-Za-z0-9]/g, "_")}`;

function opPack(world: World, pack: string, op: string, transform: "as is" | "upper case"): void {
  const write = transform === "upper case" ? (line: string) => line.toUpperCase() : (line: string) => line;
  composition(world).packs.set(pack, { [op]: (ast: Text, line: string) => void (ast.text += `${write(line)}\n`) });
  const written = transform === "upper case" ? "line.toUpperCase()" : "line";
  composition(world).source.push(
    `const ${identifier(pack)} = { ${JSON.stringify(op)}: (ast: Text, line: string) => void (ast.text += \`\${${written}}\\n\`) };`
  );
}

/** A failed composition is recorded for the outcome steps (CATALOG); a later step on the Dialect then finds none. */
function compose(world: World, name: string, build: () => unknown, source: string): void {
  try {
    dialects(world).set(name, build());
    composition(world).source.push(`const ${identifier(name)} = ${source};`);
  } catch (failure) {
    composition(world).failure = failure;
  }
}

function listed(names: string): string[] {
  return names === "none" ? [] : names.split(",").map((name) => name.trim());
}

export const COMPOSITION_STEPS: readonly StepDefinition[] = [
  {
    phrase: 'a base dialect "{dialect}" for the extension "{extension}"',
    run: (world, [name, extension]) => {
      composition(world).bases.set(name as string, defineDialect({ extensions: [extension as string], ast: TEXT_AST, ops: {} }));
      composition(world).source.push(
        `const ${identifier(name as string)} = defineDialect({ extensions: [${JSON.stringify(extension)}], ast: TEXT_AST, ops: {} });`
      );
    },
  },
  {
    phrase: 'an op pack "{pack}" whose op "{op}" appends its argument as a new line',
    run: (world, [pack, op]) => opPack(world, pack as string, op as string, "as is"),
  },
  {
    phrase: 'an op pack "{pack}" whose op "{op}" appends its argument in upper case as a new line',
    run: (world, [pack, op]) => opPack(world, pack as string, op as string, "upper case"),
  },
  {
    phrase: 'the dialect implementer composes the dialect "{dialect}" from the base dialect "{base}" and the op packs "{packs}"',
    run: (world, [name, base, packs]) => {
      const names = listed(packs as string);
      compose(
        world,
        name as string,
        () => {
          const dialect = composition(world).bases.get(base as string);
          if (dialect === undefined) throw new Error(`no base dialect "${base as string}"`);
          const packs = names.map((pack) => {
            const ops = composition(world).packs.get(pack);
            if (ops === undefined) throw new Error(`no op pack "${pack}"`);
            return ops;
          });
          return withOps(dialect, ...packs);
        },
        `withOps(${[base as string, ...names].map(identifier).join(", ")})`
      );
    },
  },
  {
    phrase: 'the dialect implementer routes the extensions "{routes}" as the dialect "{dialect}"',
    run: (world, [routes, name]) => {
      const pairs = (routes as string).split(",").map((route) => route.trim().split(" to ") as [string, string]);
      compose(
        world,
        name as string,
        () => byExtension(Object.fromEntries(pairs.map(([extension, dialect]) => [extension, dialects(world).get(dialect) as Dialect]))),
        `byExtension({ ${pairs.map(([extension, dialect]) => `${JSON.stringify(extension)}: ${identifier(dialect)}`).join(", ")} })`
      );
    },
  },
];
