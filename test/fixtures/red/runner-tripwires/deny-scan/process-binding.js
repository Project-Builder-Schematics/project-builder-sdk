// REQ-CST-04.2.5 / REQ-PRM-01: `process.binding` is a denied capability primitive
// (member-path-shaped register member reached off the ADMITTED `process` global —
// REQ-CAP-04.6/.7's default-deny-one-level-down proof).
process.binding("fs");
