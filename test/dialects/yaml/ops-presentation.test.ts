import { describe, it } from "bun:test";
import * as yaml from "../../../src/dialects/yaml/index.ts";
import { expectFile, expectReject } from "./harness.ts";

describe("REQ-YMD-03 — comments", () => {
  it("Scenario REQ-YMD-03.1: setComment adds a leading comment", async () => {
    await expectFile("port: 80\n", (h) => h.setComment(["port"], "HTTP port"), "# HTTP port\nport: 80\n");
  });

  it("setComment replaces, writes one # line per line, and is a no-op when identical", async () => {
    await expectFile("# old\nport: 80\n", (h) => h.setComment(["port"], "one\ntwo"), "# one\n# two\nport: 80\n");
    await expectFile("a: 1\n#  HTTP port\nport:   80\n", (h) => h.setComment(["port"], " HTTP port"), "a: 1\n#  HTTP port\nport:   80\n");
  });

  it("inline comments go on the same line", async () => {
    await expectFile("port: 80\n", (h) => h.setComment(["port"], "http", { position: "inline" }), "port: 80 # http\n");
    await expectFile("x:\n  - a\n", (h) => h.setComment(["x", 0], "first", { position: "inline" }), "x:\n  - a # first\n");
    await expectFile("x:\n  k: 1\n", (h) => h.setComment(["x"], "map", { position: "inline" }), "x: # map\n  k: 1\n");
  });

  it("[] addresses the document's leading comment", async () => {
    await expectFile("a: 1\n", (h) => h.setComment([], "file header"), "# file header\n\na: 1\n");
    await expectFile("# header\n\na: 1\n", (h) => h.removeComment([]), "a: 1\n");
  });

  it("removeComment removes and is a no-op without a comment", async () => {
    await expectFile("# lead\nport: 80 # http\n", (h) => h.removeComment(["port"], { position: "inline" }), "# lead\nport: 80\n");
    await expectFile("# lead\nport: 80\n", (h) => h.removeComment(["port"]), "port: 80\n");
    await expectFile("port:  80\n", (h) => h.removeComment(["port"]), "port:  80\n");
  });

  it("rejects a missing target and an invalid position", async () => {
    await expectReject("a: 1\n", (h) => h.setComment(["b"], "x"), '["b"]');
    await expectReject("a: 1\n", (h) => h.setComment(["a"], "x", { position: "after" as never }), "position");
  });
});

describe("REQ-YMD-04 — anchors, aliases, and merge keys", () => {
  it("Scenario REQ-YMD-04.1: setAnchor and setAlias share a value", async () => {
    await expectFile(
      "base:\n  image: node\nweb: {}\n",
      (h) => h.setAnchor(["base"], "base").setAlias(["web"], "base"),
      "base: &base\n  image: node\nweb: *base\n"
    );
  });

  it("setAnchor rejects an invalid or taken name and is a no-op when already set", async () => {
    await expectReject("a: 1\n", (h) => h.setAnchor(["a"], "bad name"), "bad name");
    await expectReject("a: 1\n", (h) => h.setAnchor(["a"], "x,y"), "x,y");
    await expectReject("a: &x 1\nb: 2\n", (h) => h.setAnchor(["b"], "x"), "&x");
    await expectFile("a:  &x 1\n", (h) => h.setAnchor(["a"], "x"), "a:  &x 1\n");
  });

  it("renaming an anchor re-points its aliases", async () => {
    await expectFile("a: &x 1\nb: *x\n", (h) => h.setAnchor(["a"], "y"), "a: &y 1\nb: *y\n");
  });

  it("setAlias rejects an unknown anchor and an alias before its anchor", async () => {
    await expectReject("a: 1\nb: 2\n", (h) => h.setAlias(["b"], "nope"), "nope");
    await expectReject("a: 1\nb: &x 2\n", (h) => h.setAlias(["a"], "x"), "*x");
  });

  it("removeAnchor replaces every alias with a copy so the data is unchanged", async () => {
    await expectFile(
      "base: &base\n  image: node\nweb: *base\nm:\n  <<: *base\n  port: 80\n",
      (h) => h.removeAnchor(["base"]),
      "base:\n  image: node\nweb:\n  image: node\nm:\n  <<:\n    image: node\n  port: 80\n"
    );
    await expectFile("a: 1\n", (h) => h.removeAnchor(["a"]), "a: 1\n");
  });

  it("Scenario REQ-YMD-04.2: addMergeKey extends a mapping", async () => {
    await expectFile(
      "base: &base\n  image: node\nweb:\n  port: 80\n",
      (h) => h.addMergeKey(["web"], "base"),
      "base: &base\n  image: node\nweb:\n  <<: *base\n  port: 80\n"
    );
  });

  it("a second merge source turns the merge key into a sequence", async () => {
    await expectFile(
      "a: &a\n  x: 1\nb: &b\n  y: 2\nc:\n  <<: *a\n",
      (h) => h.addMergeKey(["c"], "b"),
      "a: &a\n  x: 1\nb: &b\n  y: 2\nc:\n  <<: [ *a, *b ]\n"
    );
  });

  it("the escape hatch can set values and directives with astLibrary", async () => {
    await expectFile(
      "a: 1\n",
      (h) =>
        h.modify((stream) => {
          const document = stream.documents[0]!;
          document.set("updated", new yaml.astLibrary.Scalar("2026-10-27"));
          document.directives!.yaml.explicit = true;
        }),
      "%YAML 1.2\n---\na: 1\nupdated: 2026-10-27\n"
    );
  });

  it("addMergeKey is a no-op when present and rejects a non-mapping anchor", async () => {
    await expectFile("base: &base\n  i: n\nweb:\n  <<: *base\n", (h) => h.addMergeKey(["web"], "base"), "base: &base\n  i: n\nweb:\n  <<: *base\n");
    await expectReject("base: &base 1\nweb:\n  port: 80\n", (h) => h.addMergeKey(["web"], "base"), "not a mapping");
    await expectReject("web:\n  port: 80\n", (h) => h.addMergeKey(["web"], "base"), "base");
  });
});

describe("REQ-YMD-05 — style", () => {
  it("switches collections between block and flow", async () => {
    await expectFile("x:\n  - 1\n  - 2\n", (h) => h.setStyle(["x"], "flow"), "x: [ 1, 2 ]\n");
    await expectFile("x: {a: 1}\n", (h) => h.setStyle(["x"], "block"), "x:\n  a: 1\n");
  });

  it("switches scalar styles and is a no-op for the current style", async () => {
    await expectFile("a: hi\n", (h) => h.setStyle(["a"], "double"), 'a: "hi"\n');
    await expectFile("a: 'hi'\n", (h) => h.setStyle(["a"], "plain"), "a: hi\n");
    await expectFile("a: hi\n", (h) => h.setStyle(["a"], "literal"), "a: |-\n  hi\n");
    await expectFile("a:  'hi'\n", (h) => h.setStyle(["a"], "single"), "a:  'hi'\n");
  });

  it("rejects mismatched styles and an unsafe plain", async () => {
    await expectReject("a: hi\n", (h) => h.setStyle(["a"], "flow"), "scalar");
    await expectReject("a: [1]\n", (h) => h.setStyle(["a"], "double"), "collection");
    await expectReject("a: '123'\n", (h) => h.setStyle(["a"], "plain"), "plain");
    await expectReject("a: 'x: y'\n", (h) => h.setStyle(["a"], "plain"), "plain");
    await expectReject("a: 80\n", (h) => h.setStyle(["a"], "double"), "double");
  });
});

describe("REQ-YMD-09 — tags", () => {
  it("Scenario REQ-YMD-09.1: setTag adds a custom tag", async () => {
    await expectFile("bucket: my-bucket\n", (h) => h.setTag(["bucket"], "!Ref"), "bucket: !Ref my-bucket\n");
  });

  it("setTag removes with null, is a no-op for the current tag, and rejects an invalid tag", async () => {
    await expectFile("a: !Ref  x\n", (h) => h.setTag(["a"], "!Ref"), "a: !Ref  x\n");
    await expectFile("a: !Ref x\n", (h) => h.setTag(["a"], null), "a: x\n");
    await expectFile("a: x\n", (h) => h.setTag(["a"], "!!str"), "a: !!str x\n");
    await expectReject("a: x\n", (h) => h.setTag(["a"], "Ref"), "Ref");
    await expectReject("a: x\n", (h) => h.setTag(["a"], "!e!x"), "!e!x");
  });
});
