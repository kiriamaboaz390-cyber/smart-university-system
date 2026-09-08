import * as assert from "node:assert/strict";

import { canAccess, Role } from "../src/lib/access-control";
import { findAvailableRooms, createSessionToken } from "../src/lib/room-operations";
import { allocateRoom, checkForScheduleConflict, generateSemesterTimetable, generateExamTimetable } from "../src/lib/timetable";
import { validateScheduleChangeRequest, validateWeeklySessionCap, validateUnitsPerSemester } from "../src/lib/scheduling";
import { buildSessionQrPayload, parseQrPayload, isSessionActiveNow } from "../src/lib/qr";

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

function runQrPayloadTests() {
  console.log("Running QR payload tests...");

  // build: room code preferred, deterministic format
  const payload = buildSessionQrPayload({
    sessionId: "sess-1",
    roomId: "room-9",
    roomCode: "R-204",
    lecturerId: "lec-3",
    startTime: 9,
    endTime: 11,
  });
  assert.equal(
    payload,
    "smart-university:session=sess-1;room=R-204;lecturer=lec-3;start=9;end=11"
  );

  // build: falls back to room id when no code
  const payloadNoCode = buildSessionQrPayload({
    sessionId: "sess-1",
    roomId: "room-9",
    lecturerId: "lec-3",
    startTime: 9,
    endTime: 11,
  });
  assert.equal(
    payloadNoCode,
    "smart-university:session=sess-1;room=room-9;lecturer=lec-3;start=9;end=11"
  );

  // parse: round-trip
  const parsed = parseQrPayload(payload);
  assert.ok(parsed, "parseQrPayload should parse a built payload");
  assert.equal(parsed?.session, "sess-1");
  assert.equal(parsed?.room, "R-204");
  assert.equal(parsed?.lecturer, "lec-3");
  assert.equal(parsed?.start, "9");
  assert.equal(parsed?.end, "11");

  // parse: prefix optional and whitespace tolerated
  const parsedLenient = parseQrPayload("  session=abc;room=R-1  ");
  assert.ok(parsedLenient, "prefix is optional");
  assert.equal(parsedLenient?.session, "abc");
  assert.equal(parsedLenient?.room, "R-1");

  // parse: value containing '=' keeps everything after the first '='
  const parsedEquals = parseQrPayload("session=abc==;room=R-1");
  assert.equal(parsedEquals?.session, "abc==");

  // parse: dashboard-style payload (no prefix, no start/end)
  const parsedDashboard = parseQrPayload("session=s1;lecturer=user-1;room=R-1");
  assert.ok(parsedDashboard, "dashboard-style payload should parse");
  assert.equal(parsedDashboard?.session, "s1");
  assert.equal(parsedDashboard?.lecturer, "user-1");

  // parse: invalid payloads rejected
  assert.equal(parseQrPayload("garbage"), null, "no key=value pairs");
  assert.equal(parseQrPayload("smart-university:"), null, "prefix only");
  assert.equal(parseQrPayload("room=R-1"), null, "missing session key");
  assert.equal(parseQrPayload("session="), null, "empty session value");
  assert.equal(parseQrPayload(""), null, "empty string");

  console.log("QR payload: OK");
}

function runQrActiveWindowTests() {
  console.log("Running QR active window tests...");

  // 2026-09-07 is a Monday (UTC).
  const mondayMorning = new Date("2026-09-07T09:30:00Z"); // Mon 09:30 UTC
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 9, endTime: 11 }, mondayMorning),
    true,
    "within the session window"
  );
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 9, endTime: 12 }, mondayMorning),
    true,
    "session spans current time"
  );
  assert.equal(
    isSessionActiveNow({ day: "Tue", startTime: 9, endTime: 11 }, mondayMorning),
    false,
    "wrong day"
  );
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 12, endTime: 14 }, mondayMorning),
    false,
    "before start"
  );
  assert.equal(
    isSessionActiveNow({ day: "Funday", startTime: 9, endTime: 11 }, mondayMorning),
    false,
    "unknown day name"
  );

  const rightAfterStart = new Date("2026-09-07T09:00:00Z");
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 9, endTime: 11 }, rightAfterStart),
    true,
    "exact start boundary accepted"
  );

  const justBeforeStart = new Date("2026-09-07T08:59:00Z");
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 9, endTime: 11 }, justBeforeStart),
    false,
    "one minute before start rejected"
  );

  // grace: up to 15 minutes after the end time is still accepted
  const withinGrace = new Date("2026-09-07T11:15:00Z");
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 9, endTime: 11 }, withinGrace),
    true,
    "within 15-minute grace after end"
  );

  const outsideGrace = new Date("2026-09-07T11:16:00Z");
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 9, endTime: 11 }, outsideGrace),
    false,
    "beyond 15-minute grace after end"
  );

  // custom grace of 0 disables late scans
  assert.equal(
    isSessionActiveNow({ day: "Mon", startTime: 9, endTime: 11 }, withinGrace, 0),
    false,
    "grace of 0 rejects post-end scans"
  );

  console.log("QR active window: OK");
}

async function main() {
  try {
    runAccessControlTests();
    runRoomOperationsTests();
    runTimetableTests();
    runSchedulingTests();
    runQrPayloadTests();
    runQrActiveWindowTests();
    console.log("\n✅ All tests passed.");
  } catch (e) {
    console.error("\n❌ Test failure:", e);
    process.exitCode = 1;
  }
}

main();
