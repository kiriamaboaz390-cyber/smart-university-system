import assert from "node:assert/strict";

import { canAccess, Role } from "../src/lib/access-control";
import { findAvailableRooms, createSessionToken } from "../src/lib/room-operations";
import { allocateRoom, checkForScheduleConflict, generateSemesterTimetable, generateExamTimetable } from "../src/lib/timetable";

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
  assert.equal(timetable.every((entry) => entry.day && entry.start >= 8 && entry.end <= 18), true);

  const exams = [
    { id: "E-1", lecturerId: "lect-1", roomId: "R-101", day: "Wed", start: 9, end: 11 },
    { id: "E-2", lecturerId: "lect-2", roomId: "R-101", day: "Wed", start: 10, end: 12 },
  ];
  const examTimetable = generateExamTimetable(exams as any, ["R-101", "R-102"]);
  assert.equal(examTimetable.length, 2);
  assert.equal(examTimetable[0].roomId !== examTimetable[1].roomId || examTimetable[0].day !== examTimetable[1].day, true);

  console.log("timetable: OK");
}

async function main() {
  try {
    runAccessControlTests();
    runRoomOperationsTests();
    runTimetableTests();
    console.log("All tests passed.");
  } catch (e) {
    console.error("Test failure:", e);
    process.exitCode = 1;
  }
}

main();
