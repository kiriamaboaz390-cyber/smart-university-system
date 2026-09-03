import * as assert from "node:assert/strict";

import { canAccess, Role } from "../src/lib/access-control";
import { findAvailableRooms, createSessionToken } from "../src/lib/room-operations";
import { allocateRoom, checkForScheduleConflict, generateSemesterTimetable, generateExamTimetable } from "../src/lib/timetable";
import { validateScheduleChangeRequest, validateWeeklySessionCap, validateUnitsPerSemester } from "../src/lib/scheduling";

function runAccessControlTests() {
  console.log("Running access-control tests...");
  assert.equal(canAccess(Role.SUPER_ADMIN, Role.ADMIN), true);
  assert.equal(canAccess(Role.SUPER_ADMIN, Role.LECTURER), true);
  assert.equal(canAccess(Role.STUDENT, Role.ADMIN), false);
  assert.equal(canAccess(Role.STUDENT, Role.STUDENT), true);
  assert.equal(canAccess(Role.HR_ADMIN, Role.HR_ADMIN), true);
  assert.equal(canAccess(Role.HR_ADMIN, Role.ADMIN), false);
  console.log("access-control: OK");
}

function runRoomOperationsTests() {
  console.log("Running room-operations tests...");
  const rooms = [
    { id: "R-101", bookings: [{ day: "Mon", start: 9, end: 11 }] },
    { id: "R-102", bookings: [{ day: "Mon", start: 12, end: 14 }] },
    { id: "R-103", bookings: [{ day: "Mon", start: 9, end: 10 }] },
  ];
  const available = findAvailableRooms(rooms as any, "Mon", 10, 12);
  assert.deepEqual(available, ["R-102", "R-103"]);

  const token = createSessionToken({ sessionId: "CS101-1", roomId: "R-204", lecturerId: "L-7", studentId: "S-12" });
  assert.equal(token.includes("CS101-1"), true);
  assert.equal(token.includes("R-204"), true);
  assert.equal(token.includes("L-7"), true);
  assert.equal(token.includes("S-12"), true);
  console.log("room-operations: OK");
}

function runTimetableTests() {
  console.log("Running timetable tests...");
  const sessions = [
    { id: "L1", lecturerId: "lect-1", day: "Mon", start: 9, end: 11 },
    { id: "L2", lecturerId: "lect-1", day: "Mon", start: 10, end: 12 },
  ];
  assert.equal(checkForScheduleConflict(sessions as any), true);

  const schedule = [ { roomId: "R-101", day: "Tue", start: 8, end: 10, lecturerId: "lect-2" } ];
  assert.equal(allocateRoom(schedule as any, "R-101", "Tue", 9, 11), false);
  assert.equal(allocateRoom(schedule as any, "R-102", "Tue", 9, 11), true);

  const courses = [
    { id: "CS101", lecturerId: "lect-1", studentIds: ["stu-1", "stu-2"], duration: 2 },
    { id: "CS102", lecturerId: "lect-2", studentIds: ["stu-2", "stu-3"], duration: 2 },
    { id: "CS103", lecturerId: "lect-3", studentIds: ["stu-1", "stu-3"], duration: 2 },
  ];
  const timetable = generateSemesterTimetable(courses as any, ["R-101", "R-102", "R-103"]);
  assert.equal(timetable.length, 3);
  assert.equal(timetable.some((entry) => entry.roomId === "R-101"), true);
  assert.equal(timetable.every((entry) => entry.day && entry.start >= 7 && entry.end <= 19), true);

  const exams = [
    { id: "E-1", lecturerId: "lect-1", roomId: "R-101", day: "Wed", start: 9, end: 11 },
    { id: "E-2", lecturerId: "lect-2", roomId: "R-101", day: "Wed", start: 10, end: 12 },
  ];
  const examTimetable = generateExamTimetable(exams as any, ["R-101", "R-102"]);
  assert.equal(examTimetable.length, 2);
  assert.equal(examTimetable[0].roomId !== examTimetable[1].roomId || examTimetable[0].day !== examTimetable[1].day, true);

  console.log("timetable: OK");
}

function runSchedulingTests() {
  console.log("Running scheduling constraints tests...");

  // Import scheduling functions
  const {
    validateSessionTiming,
    validateWeeklySessionCap,
    validateUnitsPerSemester,
    checkStudentTimeConflict,
    checkLecturerTimeConflict,
    checkRoomConflict,
    validateScheduleChangeRequest,
    calculateWeeklySessionCount,
    calculateGroupUnits,
  } = require("../src/lib/scheduling") as any;

  // Test 1: Session timing validation
  const policy = { businessHourStart: 7, businessHourEnd: 19, maxSessionsPerWeek: 18, maxUnitsPerSemester: 8, sessionDurationHours: 2 };
  let result = validateSessionTiming("Mon", 9, 11, policy);
  assert.equal(result.valid, true);

  result = validateSessionTiming("Sat", 9, 11, policy);
  assert.equal(result.valid, false);

  result = validateSessionTiming("Mon", 6, 8, policy);
  assert.equal(result.valid, false, "session outside business hours");

  result = validateSessionTiming("Mon", 9, 12, policy);
  assert.equal(result.valid, false, "session not 2 hours");

  // Test 2: Weekly session cap
  let load = { studentId: "s-1", weeklySessionsCount: 18, unitsThisSemester: 7 };
  let session = { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" };
  result = validateWeeklySessionCap(load, session, policy);
  assert.equal(result.valid, false, "should reject student at weekly cap");

  load = { studentId: "s-1", weeklySessionsCount: 17, unitsThisSemester: 7 };
  result = validateWeeklySessionCap(load, session, policy);
  assert.equal(result.valid, true);

  // Test 3: Units per semester
  result = validateUnitsPerSemester(6, 3, policy);
  assert.equal(result.valid, false, "should reject group exceeding unit cap");

  result = validateUnitsPerSemester(5, 3, policy);
  assert.equal(result.valid, true);

  // Test 4: Student time conflicts
  let studentSessions = [
    { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" },
  ];
  let proposed = { sessionId: "s2", courseId: "CS102", groupId: "g1", day: "Mon", startTime: 10, endTime: 12, roomId: "R-102" };
  result = checkStudentTimeConflict(studentSessions, proposed);
  assert.equal(result.conflict, true, "should detect overlap");

  proposed = { sessionId: "s2", courseId: "CS102", groupId: "g1", day: "Tue", startTime: 9, endTime: 11, roomId: "R-102" };
  result = checkStudentTimeConflict(studentSessions, proposed);
  assert.equal(result.conflict, false);

  // Test 5: Lecturer time conflicts
  let lecturerSessions = [
    { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" },
  ];
  result = checkLecturerTimeConflict(lecturerSessions, proposed);
  assert.equal(result.conflict, false);

  // Test 6: Room conflicts
  let roomBookings = [
    { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" },
  ];
  proposed = { sessionId: "s2", courseId: "CS102", groupId: "g1", day: "Mon", startTime: 10, endTime: 12, roomId: "R-101" };
  result = checkRoomConflict(roomBookings, proposed);
  assert.equal(result.conflict, true, "should detect room overlap");

  // Test 7: Schedule change request with auto-approve (no conflicts)
  let changeReq = {
    sessionId: "s1",
    proposedRoomId: "R-102",
    changedAt: new Date(),
    sessionDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
  };
  let originalSess = { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" };
  result = validateScheduleChangeRequest(changeReq as any, [], [], [], policy, originalSess);
  assert.equal(result.autoApprove, true, "should auto-approve room change with no conflicts");

  console.log("scheduling constraints: OK");
}

async function main() {
  try {
    runAccessControlTests();
    runRoomOperationsTests();
    runTimetableTests();
    runSchedulingTests();
    console.log("\n✅ All tests passed.");
  } catch (e) {
    console.error("\n❌ Test failure:", e);
    process.exitCode = 1;
  }
}

main();
