/**
 * fit-41 (design §4.7 "Predicate-parity", ADR-01 — ts-addimport-collision S-005; renumbered
 * from the design's FIT-39 slot per slices.md's drift note: 39/40 were taken by unrelated
 * changes since design landed): a shared `(seed, name, from) → verdict` battery run through
 * BOTH `@pbuilder/sdk/typescript` and `@pbuilder/sdk/react`'s `addImport`, asserting their
 * VERDICTS — no-op / merge / create / reject — agree on every row, EXCEPT the self-alias row
 * (REQ-TSD-01.15), which is a POSITIVE expected-divergence assertion (ADR-01 N1: TS no-ops on
 * `{ X as X }`, React rejects it — an owner-ratified deviation), never a row exclusion.
 *
 * This is arm a's mandatory drift guard (ADR-01): the collision/idempotency predicate family
 * is mirrored, not hoisted, into the TS leaf (react stays byte-sealed) — FIT-41 substitutes for
 * arm b's single-point-of-maintenance benefit with a drift-DETECTION benefit instead. It checks
 * VERDICTS ONLY, never message text (design §4.4 F14 — the two dialects' collision wording
 * legitimately diverges by house style).
 *
 * Battery buckets, cross-referenced to the REQ-TSD-01.5–.33 corpus (design §4.7, one row per
 * shape family, N2/N6): merge (.5/.22/.23/.28/.29), idempotency no-op (.10/.13/.30/.31),
 * create/separate (.7/.9/.11/.12/.18/.19), type-only collision (.6/.8/.26/.27), cross-module +
 * value-namespace collision (.16/.17), plus the standalone self-alias divergence row (.15).
 *
 * Verdict classification is structural, not byte-exact (parity is about AGREEMENT on outcome
 * KIND, not on either dialect's own message/formatting text): `reject` = the op threw;
 * `no-op` = zero directives emitted; `merge`/`create` = one directive emitted, distinguished by
 * whether the emitted content's declaration-count for `from` grew (create) or stayed the same
 * (merge, i.e. a specifier was added to an existing declaration).
 */
import { describe, it, expect } from "bun:test";
import * as ts from "../../src/dialects/typescript/index.ts";
import * as react from "../../src/dialects/react/index.ts";
import { defineFactory } from "../../src/core/context.ts";
import { makeSpyClient, collectModifies } from "../support/spy-client.ts";
import { IMPORT_SPECIFIER_RE, stripComments } from "../support/import-scan.ts";

type Verdict = "no-op" | "reject" | "merge" | "create";
type Modify = { modify: { content: string } };

// Counts how many import declarations target `from` in `content`, via the shared
// `IMPORT_SPECIFIER_RE` (FIT-15/21/25/27's precompiled, comment-aware specifier scanner) —
// counts matches whose captured module specifier (group 1) equals `from`, rather than
// hand-rolling escaping + a fresh RegExp per call.
function countDeclarationsFor(content: string, from: string): number {
  let count = 0;
  for (const match of stripComments(content).matchAll(IMPORT_SPECIFIER_RE)) {
    if (match[1] === from) count++;
  }
  return count;
}

// The classification engine itself, pure and I/O-free — separated from the two dialect
// runners below so it can be red-proofed directly (see the dedicated describe block).
function classifyOutcome(threw: boolean, modifies: readonly Modify[], before: string, from: string): Verdict {
  if (threw) return "reject";
  if (modifies.length === 0) return "no-op";
  const after = modifies[0]!.modify.content;
  const beforeCount = countDeclarationsFor(before, from);
  const afterCount = countDeclarationsFor(after, from);
  return afterCount > beforeCount ? "create" : "merge";
}

async function tsVerdict(seed: string, name: string, from: string): Promise<Verdict> {
  const { client, emitted } = makeSpyClient({ "a.ts": seed });
  const run = defineFactory<void>(async () => {
    await ts.find("a.ts").addImport(name, from);
  });
  let threw = false;
  try {
    await run(undefined, { client });
  } catch {
    threw = true;
  }
  return classifyOutcome(threw, collectModifies(emitted), seed, from);
}

async function reactVerdict(seed: string, name: string, from: string): Promise<Verdict> {
  // react.find() requires a `.tsx` path (REQ-RXD-02) — the fixtures below are plain import
  // statements, no JSX required, so a bare `.tsx` extension is sufficient to route into the
  // React dialect's own `addImport` (written fresh, not shared code — see react/ops.ts header).
  const { client, emitted } = makeSpyClient({ "a.tsx": seed });
  const run = defineFactory<void>(async () => {
    await react.find("a.tsx").addImport(name, from);
  });
  let threw = false;
  try {
    await run(undefined, { client });
  } catch {
    threw = true;
  }
  return classifyOutcome(threw, collectModifies(emitted), seed, from);
}

interface BatteryRow {
  reqId: string;
  bucket: "merge" | "idempotency" | "create" | "type-only-collision" | "cross-module-collision";
  description: string;
  seed: string;
  name: string;
  from: string;
}

const PARITY_ROWS: BatteryRow[] = [
  // merge (.5/.22/.23/.28/.29)
  {
    reqId: "01.5",
    bucket: "merge",
    description: "merges into an existing non-type-only named clause",
    seed: 'import { other } from "node:fs";\n',
    name: "readFileSync",
    from: "node:fs",
  },
  {
    reqId: "01.22",
    bucket: "merge",
    description: "multi-declaration module — merges into the FIRST declaration",
    seed: 'import { a } from "m";\nimport { b } from "m";\n',
    name: "c",
    from: "m",
  },
  {
    reqId: "01.23",
    bucket: "merge",
    description: "an empty `{}` named clause is a valid merge target",
    seed: 'import {} from "m";\n',
    name: "x",
    from: "m",
  },
  {
    reqId: "01.28",
    bucket: "merge",
    description: "aliased-underlying merge — local-name keying, unrelated to the alias's exported name",
    seed: 'import { a as b } from "m";\n',
    name: "c",
    from: "m",
  },
  {
    reqId: "01.29",
    bucket: "merge",
    description: "mixed default+named declaration — merges into the named clause",
    seed: 'import Def, { a } from "m";\n',
    name: "b",
    from: "m",
  },
  // idempotency no-op (.10/.13/.30/.31) — .15 (self-alias) is the standalone divergence row below
  {
    reqId: "01.10",
    bucket: "idempotency",
    description: "default import, SAME local name — idempotent no-op",
    seed: 'import Def from "m";\n',
    name: "Def",
    from: "m",
  },
  {
    reqId: "01.13",
    bucket: "idempotency",
    description: "namespace import, SAME local name — idempotent no-op",
    seed: 'import * as ns from "m";\n',
    name: "ns",
    from: "m",
  },
  {
    reqId: "01.30",
    bucket: "idempotency",
    description: "mixed default+named declaration — SAME default local name is idempotent no-op",
    seed: 'import Def, { a } from "m";\n',
    name: "Def",
    from: "m",
  },
  {
    reqId: "01.31",
    bucket: "idempotency",
    description: "unaliased named import, SAME local name — idempotent no-op",
    seed: 'import { x } from "m";\n',
    name: "x",
    from: "m",
  },
  // create/separate (.7/.9/.11/.12/.18/.19)
  {
    reqId: "01.19",
    bucket: "create",
    description: "no prior declaration for `from` — fresh create",
    seed: "",
    name: "x",
    from: "m",
  },
  {
    reqId: "01.11",
    bucket: "create",
    description: "default import, DIFFERENT name — separate named decl inserted, default untouched",
    seed: 'import Def from "m";\n',
    name: "Other",
    from: "m",
  },
  {
    reqId: "01.12",
    bucket: "create",
    description: "namespace import, DIFFERENT name — separate named decl inserted, namespace untouched",
    seed: 'import * as ns from "m";\n',
    name: "X",
    from: "m",
  },
  {
    reqId: "01.7",
    bucket: "create",
    description: "type-only declaration, DIFFERENT name — never claimed, separate create",
    seed: 'import type { X } from "m";\n',
    name: "Y",
    from: "m",
  },
  {
    reqId: "01.9",
    bucket: "create",
    description: "type-only declaration, ALIASED (local name XT, not X) — X was never claimed, separate create",
    seed: 'import type { X as XT } from "m";\n',
    name: "X",
    from: "m",
  },
  {
    reqId: "01.18",
    bucket: "create",
    description: "a same-name `type` alias is exempt (ADR-0039 carve-out) — separate create, no collision",
    seed: "type Foo = string;\n",
    name: "Foo",
    from: "m",
  },
  // type-only collision (.6/.8/.26/.27)
  {
    reqId: "01.6",
    bucket: "type-only-collision",
    description: "type-only named declaration claims its name — reject",
    seed: 'import type { X } from "m";\n',
    name: "X",
    from: "other",
  },
  {
    reqId: "01.8",
    bucket: "type-only-collision",
    description: "inline `{ type X }` specifier claims its name — reject",
    seed: 'import { type X } from "m";\n',
    name: "X",
    from: "other",
  },
  {
    reqId: "01.26",
    bucket: "type-only-collision",
    description: "type-only default specifier claims its name — reject",
    seed: 'import type Def from "m";\n',
    name: "Def",
    from: "other",
  },
  {
    reqId: "01.27",
    bucket: "type-only-collision",
    description: "type-only namespace specifier claims its name — reject",
    seed: 'import type * as ns from "m";\n',
    name: "ns",
    from: "other",
  },
  // cross-module + value-namespace collision (.16/.17)
  {
    reqId: "01.16",
    bucket: "cross-module-collision",
    description: "cross-module collision — same name bound by a DIFFERENT module's import",
    seed: 'import { readFileSync } from "node:fs";\n',
    name: "readFileSync",
    from: "node:other",
  },
  {
    reqId: "01.17",
    bucket: "cross-module-collision",
    description: "value-namespace collision — a top-level function declaration claims the name",
    seed: "function Foo() {}\n",
    name: "Foo",
    from: "m",
  },
  {
    reqId: "01.17",
    bucket: "cross-module-collision",
    description: "value-namespace collision — a top-level const declaration claims the name",
    seed: "const Foo = 1;\n",
    name: "Foo",
    from: "m",
  },
  {
    reqId: "01.17",
    bucket: "cross-module-collision",
    description: "value-namespace collision — a top-level class declaration claims the name",
    seed: "class Foo {}\n",
    name: "Foo",
    from: "m",
  },
];

const BUCKETS = ["merge", "idempotency", "create", "type-only-collision", "cross-module-collision"] as const;

describe("fit-41 — predicate-parity (TS vs React addImport verdict agreement, ADR-01)", () => {
  it("the battery is non-vacuous and covers every bucket (sanity)", () => {
    expect(PARITY_ROWS.length).toBeGreaterThan(0);
    for (const bucket of BUCKETS) {
      expect(PARITY_ROWS.some((row) => row.bucket === bucket)).toBe(true);
    }
  });

  describe.each(PARITY_ROWS)("$reqId ($bucket): $description", (row) => {
    it("TS and React verdicts agree", async () => {
      const [tsResult, reactResult] = await Promise.all([
        tsVerdict(row.seed, row.name, row.from),
        reactVerdict(row.seed, row.name, row.from),
      ]);
      expect(reactResult).toBe(tsResult);
    });
  });

  // ADR-01 N1 — the self-alias row is a POSITIVE expected-divergence assertion, NEVER excluded
  // or skipped from this file. Any FUTURE drift on this pair (e.g. a react twin fix landing
  // that also accepts self-alias) fails this test RED, rather than being silently masked by an
  // exclusion — that is the entire point of asserting the pair explicitly instead of omitting
  // the row.
  describe("REQ-TSD-01.15 (ADR-01 N1) — self-alias `{ X as X }` is a KNOWN, ratified divergence", () => {
    const seed = 'import { X as X } from "m";\n';

    it("TS no-ops on self-alias (S-003 deliberate deviation)", async () => {
      expect(await tsVerdict(seed, "X", "m")).toBe("no-op");
    });

    it("React rejects self-alias (its idempotency predicate has no self-alias carve-out)", async () => {
      expect(await reactVerdict(seed, "X", "m")).toBe("reject");
    });
  });

  // Red-proof group (fit-10/fit-29/fit-30/fit-32/fit-39's established no-fixture-file pattern):
  // proves the classification engine ITSELF can distinguish every verdict kind, and would
  // therefore actually fail a row where the two dialects genuinely disagreed — the mechanism
  // this whole fitness function rests on, exercised directly rather than only indirectly
  // through real dialect runs.
  describe("[red-proof] classifyOutcome distinguishes every verdict kind", () => {
    it("a thrown op classifies as reject, regardless of any modifies present", () => {
      expect(classifyOutcome(true, [{ modify: { content: "anything" } }], "before", "m")).toBe("reject");
    });

    it("zero emitted modifies classifies as no-op", () => {
      expect(classifyOutcome(false, [], "import { x } from \"m\";\n", "m")).toBe("no-op");
    });

    it("one modify with an UNCHANGED declaration-count for `from` classifies as merge", () => {
      const before = 'import { a } from "m";\n';
      const after = 'import { a, b } from "m";\n';
      expect(classifyOutcome(false, [{ modify: { content: after } }], before, "m")).toBe("merge");
    });

    it("one modify with an INCREASED declaration-count for `from` classifies as create", () => {
      const before = 'import Def from "m";\n';
      const after = 'import Def from "m";\nimport { b } from "m";\n';
      expect(classifyOutcome(false, [{ modify: { content: after } }], before, "m")).toBe("create");
    });

    // RED-PROOF (no false positive): a DIFFERENT module's declaration count never confuses the
    // count for `from` — countDeclarationsFor keys on the literal `from "{from}"` substring.
    it("a declaration count change for an UNRELATED module does not affect classification", () => {
      const before = 'import { a } from "m";\n';
      const after = 'import { a } from "m";\nimport { z } from "other";\n';
      expect(classifyOutcome(false, [{ modify: { content: after } }], before, "m")).toBe("merge");
    });
  });
});
