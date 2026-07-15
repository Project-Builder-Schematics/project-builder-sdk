// REQ-EXC-01/EXC-02: the terminal-error classifier. Classification reads ONLY the error's
// own identity (instanceof AuthoringError / TransportFault) — never a `.cause` chain, so a
// double-fault (EXC-02) can never override the original error's (E1's) class.

import { describe, it, expect } from "bun:test";
import { classifyExitCode } from "../../src/transport/exit-codes.ts";
import { AuthoringError } from "../../src/core/authoring-error.ts";
import { TransportFault } from "../../src/transport/stdio-engine-client.ts";

describe("REQ-EXC-01 — exit code taxonomy", () => {
  describe("Scenario REQ-EXC-01.2/.3: four failure classes map to four distinct codes", () => {
    it("an authoring-rejected AuthoringError (SDK-side misuse) classifies as 1 (validation-failure)", () => {
      const err = new AuthoringError({ verb: undefined, path: undefined, reason: "outside-run", appliedCount: 0 });
      expect(err.origin).toEqual("authoring-rejected");
      expect(classifyExitCode(err)).toEqual(1);
    });

    it("a write-rejected AuthoringError (host refused the write) classifies as 2 (emit-rejection)", () => {
      const err = new AuthoringError({ verb: "create", path: "a.ts", reason: "path-collision", appliedCount: 0 });
      expect(err.origin).toEqual("write-rejected");
      expect(classifyExitCode(err)).toEqual(2);
    });

    it("a TransportFault classifies as 3 (transport-fault), regardless of its kind", () => {
      expect(classifyExitCode(new TransportFault("malformed", "bad json"))).toEqual(3);
      expect(classifyExitCode(new TransportFault("timeout", "hung"))).toEqual(3);
      expect(classifyExitCode(new TransportFault("eof", "closed early"))).toEqual(3);
    });

    it("an unclassified plain Error (an author crash) classifies as 4 (crash)", () => {
      expect(classifyExitCode(new TypeError("boom"))).toEqual(4);
    });

    it("a non-Error thrown value also classifies as 4 (crash) — never throws while classifying", () => {
      expect(classifyExitCode("a string was thrown")).toEqual(4);
      expect(classifyExitCode(undefined)).toEqual(4);
    });
  });
});

describe("REQ-EXC-02 — double-fault never overrides the original error's classification", () => {
  it("Scenario REQ-EXC-02.1: E1's class survives even when a DIFFERENT-classing E2 is attached as .cause", () => {
    // E1 is an unclassified crash (TypeError); E2 (attached as .cause, mirroring context.ts's
    // double-fault preservation) is a TransportFault — a class that would classify as 3 if
    // read directly. The classifier must read E1's OWN identity only, never `.cause`.
    const e1 = new TypeError("factory crashed mid-run");
    const e2 = new TransportFault("malformed", "discard ack itself failed");
    e1.cause = e2;

    expect(classifyExitCode(e1)).toEqual(4);
  });

  it("the inverse: E1 a TransportFault with an AuthoringError E2 as .cause still classifies as 3", () => {
    const e1 = new TransportFault("timeout", "original timeout");
    const e2 = new AuthoringError({ verb: undefined, path: undefined, reason: "unknown", appliedCount: 0 });
    e1.cause = e2;

    expect(classifyExitCode(e1)).toEqual(3);
  });
});
