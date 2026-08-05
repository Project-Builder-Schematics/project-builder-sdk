// REQ-CST-04.2.8 / REQ-PRM-01: `WebAssembly` — RULED-IN PRIMITIVE (ruling 3).
const bytes = Buffer.alloc(0);
export const r = WebAssembly.instantiate(bytes);
