// m1-vehicle (handshake, REQ-CFX-05): ONE factory serves BOTH cases unmodified — the
// engine flips greetingVersion, never this file. `read()` proves the tree-read round trip
// before the modify (REQ-CFX-13's tree.read-only-here fact); the schematic pre-stages
// out.txt = "v1" (see schematic/files/out.txt), this factory rewrites it to "v2".
import { find } from "../../src/index.ts";

export default async function m1VehicleFactory(_input: Record<string, never>): Promise<void> {
  await find("out.txt").read();
  find("out.txt").replaceContent("v2");
}
