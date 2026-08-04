// REQ-CST-04.2.1 / REQ-PRM-01: `eval` is a denied capability primitive.
const payload = "1+1";
export const r = eval(payload);
