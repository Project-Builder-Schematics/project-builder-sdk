// REQ-CST-04.2.9 (first of the split pair) / REQ-PRM-01: `module.register` — RULED-IN
// PRIMITIVE (ruling 3). Distinct fixture from module-register-hooks.js: PRM-01.2 demands a
// per-member bijection, not a per-row one.
import * as module from "node:module";
module.register("./loader.js", import.meta.url);
