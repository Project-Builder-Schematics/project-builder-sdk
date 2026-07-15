// REQ-RUN-08/REQ-BRB-02 fixture (judgment-day F10): calls captureFd1FrameWriter TWICE
// sequentially — the shape of two back-to-back enterBridge runs in one long-lived engine
// process. BOTH returned writers must reach the REAL fd 1: a non-idempotent capture would
// bind the second writer to the FIRST capture's stub, silently sending every frame of the
// second run to stderr. Spawned by framing-capture.e2e.test.ts (never imported into bun
// test's shared process — the capture mutates global process state).
import { captureFd1FrameWriter } from "../../src/transport/framing.ts";

const first = captureFd1FrameWriter();
first({ marker: "first-capture" });

const second = captureFd1FrameWriter();
second({ marker: "second-capture" });
