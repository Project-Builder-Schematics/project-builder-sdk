// REQ-CST-04.2.2 / REQ-PRM-01: `Function` direct construction is a denied capability primitive.
const body = "return 1";
export const r = new Function(body);
