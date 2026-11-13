import { describe, it } from "bun:test";
import { expectFile } from "./harness.ts";

describe("a comment above the first entry of a nested block collection belongs to that entry", () => {
  it("setComment is idempotent and replaces it", async () => {
    await expectFile("a:\n  # c\n  b: 1\n", (h) => h.setComment(["a", "b"], "c"), "a:\n  # c\n  b: 1\n");
    await expectFile("a:\n  # old\n  b: 1\n", (h) => h.setComment(["a", "b"], "new"), "a:\n  # new\n  b: 1\n");
  });

  it("re-running the docs quickstart does not duplicate the comment", async () => {
    const once = "services:\n  # Frontend\n  web:\n    image: node\n    ports:\n      - 3000:3000\n";
    await expectFile(
      once,
      (h) => h.setValue(["services", "web", "ports"], ["3000:3000"]).setComment(["services", "web"], "Frontend"),
      once
    );
  });

  it("removeComment removes it, for mapping keys and sequence items", async () => {
    await expectFile("a:\n  # c\n  b: 1\n", (h) => h.removeComment(["a", "b"]), "a:\n  b: 1\n");
    await expectFile("x:\n  # c\n  - 1\n", (h) => h.removeComment(["x", 0]), "x:\n  - 1\n");
    await expectFile("x:\n  # c\n  - 1\n", (h) => h.setComment(["x", 0], "c"), "x:\n  # c\n  - 1\n");
  });

  it("removeKey takes the comment with the key", async () => {
    await expectFile("a:\n  # about b\n  b: 1\n  c: 2\n", (h) => h.removeKey(["a", "b"]), "a:\n  c: 2\n");
  });

  it("sortKeys moves each comment with its key", async () => {
    await expectFile(
      "a:\n  # about z\n  z: 1\n  # about b\n  b: 2\n",
      (h) => h.sortKeys(["a"]),
      "a:\n  # about b\n  b: 2\n  # about z\n  z: 1\n"
    );
  });

  it("moveValue carries the leading comment of the moved key", async () => {
    await expectFile(
      "a:\n  y: 2\n  # about x\n  x: 1 # in\nb:\n  z: 3\n",
      (h) => h.moveValue(["a", "x"], ["b", "x"]),
      "a:\n  y: 2\nb:\n  z: 3\n  # about x\n  x: 1 # in\n"
    );
    await expectFile(
      "a:\n  # about x\n  x: 1\n  y: 2\nb:\n  z: 3\n",
      (h) => h.moveValue(["a", "x"], ["b", "x"]),
      "a:\n  y: 2\nb:\n  z: 3\n  # about x\n  x: 1\n"
    );
  });
});

describe("tagged scalars keep their style in a touched document", () => {
  it("an untouched tagged scalar is not re-quoted by an edit elsewhere", async () => {
    await expectFile("Port: !Ref 8080\nb: 1\n", (h) => h.setValue(["b"], 2), "Port: !Ref 8080\nb: 2\n");
    await expectFile("a: !T 1\nb: 1\n", (h) => h.setValue(["b"], 2), "a: !T 1\nb: 2\n");
  });

  it("moveValue keeps an anchored tagged scalar plain", async () => {
    await expectFile("x: &anc !T 1\n", (h) => h.moveValue(["x"], ["y"]), "y: &anc !T 1\n");
  });
});
