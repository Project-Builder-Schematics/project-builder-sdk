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
import { join } from "node:path";
import type { EngineClient } from "../../../src/core/engine-client.ts";
import { defineFactory } from "../../../src/core/context.ts";
import { create, copyIn, scaffold } from "../../../src/commons/index.ts";
import type { ScaffoldOptions } from "../../../src/commons/index.ts";
import { BATCH_CAP_BYTES } from "../../../src/core/wire.ts";
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
 * factory logic, run with `packageDir` bound to that same scratch dir.
 */
function scratchFactoryRunner(
  setup: (dir: string) => void,
  body: (input: Input) => void | Promise<void>
): (input: Input, deps: { client: EngineClient }) => Promise<void> {
  return async (input, deps) => {
    const dir = mkdtempSync(join(tmpdir(), "author-emulation-scratch-"));
    writeFileSync(join(dir, "collection.json"), "{}", "utf-8");
    try {
      setup(dir);
      const inner = defineFactory<Input>(body, { packageDir: dir });
      await inner(input, deps);
    } finally {
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
