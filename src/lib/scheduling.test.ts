import test from "node:test";
import assert from "node:assert/strict";
import { StudentGroup, canStudentTakeAllocation } from "./scheduling";

test("group unit limits enforced", () => {
  const group: StudentGroup = { id: "g1", programme: "CS", year: 2, maxUnits: 8 };
  const allocations = [
    { studentId: "s1", day: "Mon", start: 9, end: 11, units: 3 },
    { studentId: "s1", day: "Tue", start: 9, end: 11, units: 3 },
  ];

  const candidate = { studentId: "s1", day: "Wed", start: 9, end: 11, units: 3 };
  const res = canStudentTakeAllocation(allocations as any, candidate as any, group);
  assert.equal(res.ok, false);
});

test("student overlap prevented", () => {
  const group: StudentGroup = { id: "g1", programme: "CS", year: 2 };
  const allocations = [ { studentId: "s2", day: "Thu", start: 9, end: 11, units: 2 } ];
  const candidate = { studentId: "s2", day: "Thu", start: 10, end: 12, units: 2 };
  const res = canStudentTakeAllocation(allocations as any, candidate as any, group);
  assert.equal(res.ok, false);
});

test("weekly cap enforced", () => {
  const group: StudentGroup = { id: "g1", programme: "CS", year: 2, maxWeeklySessions: 2 };
  const allocations = [
    { studentId: "s3", day: "Mon", start: 7, end: 9, units: 1 },
    { studentId: "s3", day: "Tue", start: 9, end: 11, units: 1 },
  ];
  const candidate = { studentId: "s3", day: "Wed", start: 11, end: 13, units: 1 };
  const res = canStudentTakeAllocation(allocations as any, candidate as any, group);
  assert.equal(res.ok, false);
});
