import test from "node:test";
import assert from "node:assert/strict";

import { canAccess, Role } from "./access-control";

test("super admin can access everything", () => {
  assert.equal(canAccess(Role.SUPER_ADMIN, Role.ADMIN), true);
  assert.equal(canAccess(Role.SUPER_ADMIN, Role.LECTURER), true);
});

test("student cannot access admin-only academic workflows", () => {
  assert.equal(canAccess(Role.STUDENT, Role.ADMIN), false);
  assert.equal(canAccess(Role.STUDENT, Role.STUDENT), true);
});

test("hr admin can manage users but not alter academic timetable creation", () => {
  assert.equal(canAccess(Role.HR_ADMIN, Role.HR_ADMIN), true);
  assert.equal(canAccess(Role.HR_ADMIN, Role.ADMIN), false);
});
