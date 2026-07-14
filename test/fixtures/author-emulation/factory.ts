// REQ-AEG-01/02 (design §4.2, slices.md S-003.2): the realistic CRUD-shaped
// author-emulation fixture — one package (`defineFactory({packageDir})` throughout, D2:
// not a faithful `crud-graphql-mongo` port, bounded to this SDK's own capabilities) with
// per-matrix-scenario runner VARIANTS the scenario registry (`../../e2e/author-emulation/
// scenarios.ts`) drives through `captureRun`. Zero `modify` directives anywhere (AEG-02)
// — every variant below emits only `create`/`copyIn`.
//
// Git-hostile/oversized scenarios (M-07/M-09/M-14/M-19, REQ-AEG-07) materialize their OWN
// scratch package directory per invocation via `scratchFactoryRunner` below — never inside
// this committed fixture package — torn down in a `finally` after the inner run settles.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { EngineClient } from "../../../src/core/engine-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { create, copyIn, scaffold } from "../../../src/commons/index.ts";
import type { ScaffoldOptions } from "../../../src/commons/index.ts";
import { BATCH_CAP_BYTES, serializedBatchSize } from "../../../src/core/wire.ts";
import type { Directive } from "../../../src/core/wire.ts";
import { materializeByteFill, materializeGitHostileFixtures } from "../../support/author-emulation-setup.ts";
import type { Input } from "./schema.generated.ts";

export const PACKAGE_DIR = import.meta.dir;

/**
 * Every `scaffold()` call this fixture makes, in the exact args object passed —
 * collected verbatim (never re-derived) so the AEG-01.2 coverage test in the e2e file
 * asserts against what ACTUALLY ran, never a hand-maintained duplicate list.
 */
export const SCAFFOLD_CALL_ARGS: ScaffoldOptions[] = [];

function recordedScaffold(args: ScaffoldOptions): void {
  SCAFFOLD_CALL_ARGS.push(args);
  scaffold(args);
}

// --- M-01: happy-path full generator (D2, FSC-01.2, FEH-01.1, FEH-03.1) — one run
// exercising all three scaffold-family verbs (AEG-01.1). The `create({templateFile})`
// destination path embeds a RAW `{= name =}` token directly in `path` — proving that
// verb never runs scaffold's OWN filename pipeline (path passes through verbatim,
// commons/index.ts's own doc comment) — this IS the M-01 "token appears verbatim in the
// emitted pathTemplate" assertion.
export const runM01 = defineFactory<Input>(
  (input) => {
    recordedScaffold({
      from: "files",
      to: "generated",
      // `options` is typed `JsonValue` (untyped at the wire) — coalesce the schema's
      // OPTIONAL fields to concrete values so the literal type-checks as JSON-safe
      // (`boolean | undefined` is not itself a valid JsonValue member).
      options: { name: input.name, withTests: input.withTests ?? false, visibility: input.visibility ?? "public" },
    });
    copyIn("assets/logo.png", "generated/assets/logo.png");
    create("{= name =}.index.ts", {
      templateFile: "templates/index.ts.template",
      options: { name: input.name },
    });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-02: ScaffoldArgs defaults hold (FSC-01.1/.2/.3) — the corpus captures the
// DEFAULTS-ONLY half (this scaffold call has no `options`, `include`, `exclude`,
// `rename`, or `force` — every optional field omitted). The two mandatory-arg
// rejections are asserted separately in the e2e file (not corpus-captured — a
// zero-directive rejection carries nothing worth diffing byte-for-byte).
export const runM02Defaults = defineFactory<Input>(
  () => {
    recordedScaffold({ from: "files", to: "m02-out" });
  },
  { packageDir: PACKAGE_DIR }
);

export const runM02MissingFrom = defineFactory<Input>(
  () => {
    scaffold({ to: "m02-missing-from" } as ScaffoldOptions);
  },
  { packageDir: PACKAGE_DIR }
);

export const runM02MissingTo = defineFactory<Input>(
  () => {
    scaffold({ from: "files" } as ScaffoldOptions);
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-03: include/exclude, exclude wins on overlap (FSC-03.1) — `include` matches
// every `.template` file; `exclude` removes the README specifically, proving exclude's
// priority on the overlapping match rather than either filter applied in isolation.
export const runM03 = defineFactory<Input>(
  (input) => {
    recordedScaffold({
      from: "files",
      to: "m03-out",
      options: { name: input.name },
      include: ["*.template"],
      exclude: ["README.md.template"],
    });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-04: rename remap + chained-token translation + `.template` strip, PINNED order
// (FSC-05.1) — ONE scaffold call, TWO fixtures, TWO assertions (M-04 clarification,
// verify-plan-2 gap 4): the controller fixture is RENAMED first (proves rename ->
// translate -> strip order, mirroring the spec's own `.service.` -> `.svc.` worked
// example); the chained entity fixture is left un-renamed (proves multi-filter chaining
// against the SCM-03.1 hardcoded literal — the e2e assertion never reads this from the
// corpus, per REQ-SCM-03's anti-green-by-capture rule).
export const runM04 = defineFactory<Input>(
  (input) => {
    recordedScaffold({
      from: "files",
      to: "m04-out",
      options: { name: input.name },
      rename: {
        "__name@dasherize__.controller.ts.template": "__name@dasherize__.svc.ts.template",
      },
    });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-05: mixed by-value/by-reference SUCCESS in ONE scaffold (CCL-01.1/.2, BRC-01.1)
// — also the fixture-wide `force` field carrier (AEG-01.2): `force: true` has no
// colliding destination here (a fresh `to` prefix every run), so it exercises the
// pass-through cleanly, with nothing to overwrite.
export const runM05 = defineFactory<Input>(
  (input) => {
    recordedScaffold({
      from: "files-mixed",
      to: "m05-out",
      options: { name: input.name },
      force: true,
    });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-06: binary asset classifies by-reference (CCL-01.2, BRC-01.2) — `include`
// narrows the walk to the one non-`.template` binary asset, skipping
// `assets/blob.bin.template` (that fixture's fail-loud case belongs to M-08, S-004's
// own row, never triggered here).
export const runM06 = defineFactory<Input>(
  (input) => {
    recordedScaffold({
      from: "assets",
      to: "m06-out",
      options: { name: input.name },
      include: ["logo.png"],
    });
  },
  { packageDir: PACKAGE_DIR }
);

/**
 * Wraps a scenario body in a FRESH scratch package directory — materialized (with the
 * mandatory `collection.json` containment-ceiling marker, REQ-PRC-02/03) immediately
 * before the run and torn down in a `finally` immediately after, regardless of outcome
 * (REQ-AEG-07: never committed to the repo). `setup` receives the scratch dir's absolute
 * path to place whatever git-hostile/oversized content the scenario needs; `body` is the
 * factory logic, run with `packageDir` bound to that same scratch dir. An optional
 * `teardown` runs BEFORE the scratch dir's own `rmSync` — for scenarios (M-17's existing
 * out-of-ceiling sibling) that also plant fixture content OUTSIDE the scratch dir itself.
 */
function scratchFactoryRunner(
  setup: (dir: string) => void,
  body: (input: Input) => void | Promise<void>,
  teardown?: (dir: string) => void
): (input: Input, deps: { client: EngineClient }) => Promise<void> {
  return async (input, deps) => {
    const dir = mkdtempSync(join(tmpdir(), "author-emulation-scratch-"));
    writeFileSync(join(dir, "collection.json"), "{}", "utf-8");
    try {
      setup(dir);
      const inner = defineFactory<Input>(body, { packageDir: dir });
      await inner(input, deps);
    } finally {
      teardown?.(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

// --- M-07: oversized-by-stat file classifies by-reference, ZERO content reads
// (CCL-06.1, ATH-14.1) — a file whose stat size alone exceeds the frame budget
// (BATCH_CAP_BYTES). The zero-content-read proof lives in the e2e file, wrapping this
// SAME runner in `instrumentHarnessIO()`.
export const M07_HUGE_FILE_NAME = "huge.bin";

export const runM07 = scratchFactoryRunner(
  (dir) => {
    mkdirSync(join(dir, "files"));
    materializeByteFill(join(dir, "files", M07_HUGE_FILE_NAME), BATCH_CAP_BYTES + 1);
  },
  () => {
    scaffold({ from: "files", to: "out" });
  }
);

// --- M-09: aggregate-over-cap chunking succeeds completely (batch-cap REQ-04.1) —
// design.md Rev 3 Ruling R-G: 6 files x ~0.8 MiB deterministic ASCII fill (aggregate
// ~4.8 MiB > the 4 MiB cap -> exactly 2 chunks); each file's `create.template` exceeds
// `CONTENT_EMBED_BUDGET` (4096 bytes), so the corpus record embeds a content-digest
// placeholder instead of the literal bytes (never a multi-MiB committed blob).
export const M09_FILE_COUNT = 6;
export const M09_FILE_SIZE_BYTES = Math.floor(0.8 * 1024 * 1024);

export const runM09 = scratchFactoryRunner(
  (dir) => {
    mkdirSync(join(dir, "files"));
    for (let i = 0; i < M09_FILE_COUNT; i++) {
      materializeByteFill(join(dir, "files", `big-${i}.txt`), M09_FILE_SIZE_BYTES);
    }
  },
  () => {
    scaffold({ from: "files", to: "out" });
  }
);

// --- M-14: truly empty source folder no-ops (FSC-04.1) — `materializeGitHostileFixtures`
// creates the empty dir (plus symlink infra this scenario ignores) directly under the
// scratch root; scaffolding JUST the empty dir yields zero directives, no error.
export const runM14 = scratchFactoryRunner(
  (dir) => {
    materializeGitHostileFixtures(dir);
  },
  () => {
    scaffold({ from: "empty-dir", to: "out" });
  }
);

// --- M-19: symlinked directory is skipped, not traversed (FSC-09.1) — a regular file
// alongside a symlinked directory in the SAME walked folder; only the regular file
// emits. `materializeGitHostileFixtures` may skip symlink creation on an unsupporting
// platform (M-19 note) — the walk still completes cleanly in that case (there is simply
// nothing to skip), so this scenario never hard-fails on a symlink-less host; the skip
// is recorded via the console warning below.
export const runM19 = scratchFactoryRunner(
  (dir) => {
    const target = join(dir, "files19");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "a.ts"), "export const a = 1;\n", "utf-8");
    const fixtures = materializeGitHostileFixtures(target);
    if (fixtures.symlinkSkipped) {
      console.warn(
        `[author-emulation M-19] symlink creation unavailable on this platform (${fixtures.symlinkSkipReason}) — ` +
          "the walk still runs, but the skip-a-symlinked-directory behaviour is not exercised on this host."
      );
    }
  },
  () => {
    scaffold({ from: "files19", to: "out" });
  }
);

// --- GCC-07.1 discriminator (design §4.6 "e2e M-01 (sorted-order assert)"): files are
// CREATED in a deliberately non-alphabetical order (b, then a, then c) so the walk's
// SORTED enumeration (walk.ts `readdirSync().sort()`) is distinguishable from creation
// order — the e2e assert pins the sorted sequence against a hardcoded expected list.
// Not a corpus scenario (no SCENARIOS entry): a discriminator over walk-order semantics,
// not a new matrix row (REQ-SCM-01's count stays 21).
export const WALK_ORDER_CREATION_SEQUENCE = ["b.ts", "a.ts", "c.ts"] as const;

export const runWalkOrderDiscriminator = scratchFactoryRunner(
  (dir) => {
    mkdirSync(join(dir, "files"));
    for (const name of WALK_ORDER_CREATION_SEQUENCE) {
      writeFileSync(join(dir, "files", name), `export const marker = "${name}";\n`, "utf-8");
    }
  },
  () => {
    scaffold({ from: "files", to: "out" });
  }
);

// --- M-20: ContractFake <-> conformance-vehicle parity on THIS change's OWN
// by-reference fixture set (ATH-16.1) — the corpus captures the single VALID copyIn run;
// the parity comparison itself (fake vs conformance vehicle, across valid/missing-source/
// collision fixtures) lives in `test/e2e/author-emulation/m20-conformance-parity.test.ts`.
export const runM20Valid = defineFactory<Input>(
  () => {
    copyIn("assets/logo.png", "m20-out/logo.png");
  },
  { packageDir: PACKAGE_DIR }
);

// =====================================================================================
// S-004 — Batch-Cap, Containment & Rejection Boundaries (M-08, M-10, M-11, M-12, M-13,
// M-15, M-16, M-17, M-18, M-21). Every rejection here passes through `AuthoringError`'s
// `verb`/`path` VERBATIM (design.md R-F) — several producer sites (`invalidInput`, S-004
// discovery) mint BOTH as `undefined`, serializing `null`/`null` in the corpus; SCM-05
// still requires the full triple to be asserted EXPLICITLY at each of those `null`s, never
// skipped (see the e2e file's per-row assertions).
// =====================================================================================

// --- M-08: binary `.template` in a scaffold walk fails loud (CCL-05.1) — `include`
// isolates the ONE binary `.template` asset (`assets/blob.bin.template`, shipped S-002);
// the walk rejects `invalid-input` before any directive is emitted (verb/path both
// undefined — `classifyTransport`'s render-fail carve-out never attributes a directive).
export const runM08 = defineFactory<Input>(
  () => {
    scaffold({ from: "assets", to: "m08-out", include: ["blob.bin.template"] });
  },
  { packageDir: PACKAGE_DIR }
);

/**
 * The exact `template` STRING LENGTH that makes a solo `create` directive at
 * `pathTemplate` serialize — inside its own one-directive batch, matching
 * `Session.flush()`'s envelope (`{protocolVersion:1, force:false, instructions:[...]}`)
 * byte-for-byte — to `targetBytes`. Uses the SAME `serializedBatchSize` the fake's own cap
 * check and the expander's chunk heuristic both consume (`core/wire.ts`), so this can
 * never drift from the real REQ-04.2/04.3 boundary (M-10/M-11). The filler is a plain
 * ASCII character (`a`) — one JSON-serialized byte per character, no escaping — so the
 * arithmetic (`targetBytes - overhead`) is exact, never approximate.
 */
function fillTemplateForBatchSize(pathTemplate: string, targetBytes: number): string {
  const probe: Directive = { op: "create", create: { pathTemplate, template: "", options: {} } };
  const overhead = serializedBatchSize([probe]);
  return "a".repeat(targetBytes - overhead);
}

// --- M-10: a single group's own batch exceeds cap — still rejects (batch-cap REQ-04.2).
// `scaffold`'s OWN by-value classifier (`classify-transport.ts` CCL-02) auto-downgrades any
// oversized non-`.template` file to by-reference rather than ever emitting an over-cap
// `create` — so the over-cap batch here is NOT one of scaffold's own walked files; it is a
// PRECEDING direct `create()` call (bypassing that classifier entirely, exactly the
// pre-existing REQ-01 per-batch cap check REQ-04.2 says stays "unchanged"). The scaffold
// call that follows is what forces the expander's pending-size accumulator to notice the
// already-oversized pending directive and flush it (design.md R-G "an over-cap SINGLE
// directive still flushes alone and rejects at the fake's emit").
export const M10_GIANT_PATH = "m10-giant.txt";

export const runM10 = defineFactory<Input>(
  () => {
    create(M10_GIANT_PATH, { template: fillTemplateForBatchSize(M10_GIANT_PATH, BATCH_CAP_BYTES + 1024), options: {} });
    scaffold({ from: "files", to: "m10-out", include: ["README.md.template"] });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-11: exactly-at-cap passes; one-byte-over rejects (batch-cap REQ-04.3, pins `>` not
// `>=`). Same mechanical constraint as M-10 (scaffold's own classifier cannot produce an
// at/over-cap `create` for ordinary content) — both variants are direct `create()` calls.
// The AT-CAP variant is this row's corpus-committed scenario (SUCCESS); the ONE-BYTE-OVER
// variant is an e2e-inline-only assertion (never corpus-captured — mirrors the M-02
// mandatory-arg pattern: a second input variant of the SAME reason, asserted directly).
export const M11_AT_CAP_PATH = "m11-at-cap.txt";
export const M11_OVER_CAP_PATH = "m11-over-cap.txt";

export const runM11AtCap = defineFactory<Input>(
  () => {
    create(M11_AT_CAP_PATH, { template: fillTemplateForBatchSize(M11_AT_CAP_PATH, BATCH_CAP_BYTES), options: {} });
    scaffold({ from: "files", to: "m11-out", include: ["README.md.template"] });
  },
  { packageDir: PACKAGE_DIR }
);

export const runM11OverCap = defineFactory<Input>(
  () => {
    create(M11_OVER_CAP_PATH, { template: fillTemplateForBatchSize(M11_OVER_CAP_PATH, BATCH_CAP_BYTES + 1), options: {} });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-12: `templateFile` binary/oversized fails loud, never silently copies (FEH-02.1/.2).
// `readTemplateFile` always passes `failMessages` (a render REQUEST never falls back to
// by-reference, regardless of the source's own filename suffix) — the committed
// `assets/logo.png` (a real binary, S-002) proves the BINARY variant with zero new fixture
// content. The OVERSIZED variant is e2e-inline-only (mirrors M-11's over-cap split).
export const runM12Binary = defineFactory<Input>(
  () => {
    create("m12-out/rendered.ts", { templateFile: "assets/logo.png", options: {} });
  },
  { packageDir: PACKAGE_DIR }
);

export const runM12Oversized = scratchFactoryRunner(
  (dir) => {
    mkdirSync(join(dir, "files"));
    materializeByteFill(join(dir, "files", "huge-template.txt"), BATCH_CAP_BYTES + 1);
  },
  () => {
    create("m12-out/rendered.ts", { templateFile: "files/huge-template.txt", options: {} });
  }
);

// --- M-13: filters eliminate every entry — fail loud naming filters (FSC-04.2). `include`
// matches none of `files/`'s three `.template` entries.
export const runM13 = defineFactory<Input>(
  () => {
    scaffold({ from: "files", to: "m13-out", include: ["*.nonexistent-ext"] });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-15: intra-scaffold destination collision — fail loud naming both sources (FSC-08.1).
// `rename` remaps two DISTINCT `files/` originals onto the SAME literal name (no tokens, so
// translation is a no-op) — both collapse to `collide.ts` post-`.template`-strip, colliding
// BEFORE any file is classified or emitted (`detectDestinationCollisions` runs pre-loop).
export const runM15 = defineFactory<Input>(
  () => {
    scaffold({
      from: "files",
      to: "m15-out",
      rename: {
        "__name@dasherize__.controller.ts.template": "collide.ts.template",
        "README.md.template": "collide.ts.template",
      },
    });
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-16: traversal / absolute source path rejected (PRC-04.1/.6). `copyIn`'s
// containment check screens BOTH forms lexically (`isLexicallyEscaping`), before any
// realpath/existence probe. The TRAVERSAL (`../`) variant is this row's corpus-committed
// scenario — its echoed `path` is a relative string, never absolute (corpus purity, FIT-24
// holds). The ABSOLUTE-path variant (`/etc/passwd`, PRC-04.6's own worked example) is
// e2e-inline-only: verbatim pass-through (R-F) would embed a genuine absolute-path-shaped
// string in a committed record, which FIT-24 exists to catch — so this variant is asserted
// directly against the caught error, never serialized to the corpus (same split discipline
// as M-11/M-12's inline-only companion variants).
export const runM16Traversal = defineFactory<Input>(
  () => {
    copyIn("../m16-traversal-outside.txt", "m16-out/file.txt");
  },
  { packageDir: PACKAGE_DIR }
);

export const runM16Absolute = defineFactory<Input>(
  () => {
    copyIn("/etc/passwd", "m16-abs-out/file.txt");
  },
  { packageDir: PACKAGE_DIR }
);

// --- M-17: no-existence-oracle for out-of-ceiling paths (PRC-07.1). Containment's lexical
// `../`-screen (`resolveContainedRealpath` step 1, `isLexicallyEscaping`) rejects a
// traversal candidate on STRING ARITHMETIC ALONE — no `existsSync`/`realpathSync` call for
// that candidate happens before the verdict — so an existing and a non-existing
// out-of-ceiling target are provably indistinguishable (the same property REQ-PRC-07.2's
// realpath-ENOENT ordering pins one layer deeper, for a candidate that only escapes AFTER
// symlink resolution — out of this row's scope, M-16 already covers the lexical form).
// The NON-EXISTING variant (nothing ever materializes at the referenced sibling path) is
// this row's corpus-committed scenario; the EXISTING variant (a real sibling file one
// level above the scratch package root) is e2e-inline-only, asserted to carry the
// IDENTICAL `reason`.
export const runM17NonExisting = scratchFactoryRunner(
  () => {
    // Deliberately empty: `m17-nonexistent-outside.txt` is never created anywhere.
  },
  () => {
    copyIn("../m17-nonexistent-outside.txt", "m17-out/file.txt");
  }
);

// The sibling path lives one level ABOVE the scratch dir (out-of-ceiling by construction)
// — recomputed identically in `setup` and `teardown` since it is a pure function of `dir`.
function m17SiblingPath(dir: string): string {
  return join(dirname(dir), "m17-existing-outside.txt");
}

export const runM17Existing = scratchFactoryRunner(
  (dir) => {
    writeFileSync(m17SiblingPath(dir), "outside content, out-of-ceiling regardless of existence.\n", "utf-8");
  },
  () => {
    copyIn("../m17-existing-outside.txt", "m17-out/file.txt");
  },
  (dir) => {
    rmSync(m17SiblingPath(dir), { force: true });
  }
);

// --- M-18: missing in-ceiling source surfaces `source-not-found` (BRC-06.1). `missing.txt`
// is lexically in-ceiling (no traversal) but never materialized.
export const runM18 = scratchFactoryRunner(
  () => {
    // Deliberately empty: `missing.txt` is never created — genuinely absent, in-ceiling.
  },
  () => {
    copyIn("missing.txt", "m18-out/file.txt");
  }
);

// --- M-21: cross-chunk atomicity — later flush rejects, nothing commits (batch-cap
// REQ-05.1). Reuses M-09's exact aggregate-over-cap sizing (6 files, ~0.8 MiB each — 2
// flushes, the 6th/last-sorted file alone in the second) so the SAME scaffold call that
// proves successful chunking (M-09) also proves atomicity when the SECOND flush's lone
// directive collides against a SEEDED destination (`captureRun`'s `seed` param, wired via
// this scenario's `SCENARIOS` entry) — a collision the first flush's own files never hit.
export const runM21 = scratchFactoryRunner(
  (dir) => {
    mkdirSync(join(dir, "files"));
    for (let i = 0; i < M09_FILE_COUNT; i++) {
      materializeByteFill(join(dir, "files", `big-${i}.txt`), M09_FILE_SIZE_BYTES);
    }
  },
  () => {
    scaffold({ from: "files", to: "out" });
  }
);

/** The destination path M-21 seeds a pre-existing collision at (the LAST/6th file in
 * `walk.ts`'s sorted order — landing in the second flush, per M-09's own established
 * 4-then-2 chunking split recorded in the committed batchGrouping). */
export const M21_COLLISION_SEED_PATH = "out/big-5.txt";
