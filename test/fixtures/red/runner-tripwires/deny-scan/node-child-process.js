// REQ-CST-04.2.6 / REQ-CAP-04.1 / REQ-PRM-01: `node:child_process` — RULED-IN PRIMITIVE
// (ruling 3). Spawning `node -e` is the arbitrary-code-execution bypass Constraint 4 names.
import { spawn } from "node:child_process";

