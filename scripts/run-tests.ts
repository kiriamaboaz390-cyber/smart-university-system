import * as assert from "node:assert/strict";

import { canAccess, Role } from "../src/lib/access-control";
import { findAvailableRooms, createSessionToken } from "../src/lib/room-operations";
import {
  allocateRoom,
  checkForScheduleConflict,
  generateSemesterTimetable,
  generateExamTimetable,
  checkRoomCapacity,
  findContiguousBlock,
  checkGroupTimeConflict,
  isDateInExamWindows,
  isDateOnHoliday,
  isDateSchedulable,
  validateWeeklyCaps,
} from "../src/lib/timetable";
import {
  validateSessionTiming,
  validateWeeklySessionCap,
  validateUnitsPerSemester,
  checkStudentTimeConflict,
  checkLecturerTimeConflict,
  checkRoomConflict,
  validateScheduleChangeRequest,
} from "../src/lib/scheduling";
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
  const available = findAvailableRooms(rooms, "Mon", 10, 12);
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
  assert.equal(checkForScheduleConflict(sessions), true);

  const schedule = [ { roomId: "R-101", day: "Tue", start: 8, end: 10, lecturerId: "lect-2" } ];
  assert.equal(allocateRoom(schedule, "R-101", "Tue", 9, 11), false);
  assert.equal(allocateRoom(schedule, "R-102", "Tue", 9, 11), true);

  const courses = [
    { id: "CS101", lecturerId: "lect-1", studentIds: ["stu-1", "stu-2"], duration: 2 },
    { id: "CS102", lecturerId: "lect-2", studentIds: ["stu-2", "stu-3"], duration: 2 },
    { id: "CS103", lecturerId: "lect-3", studentIds: ["stu-1", "stu-3"], duration: 2 },
  ];
  const timetable = generateSemesterTimetable(courses, ["R-101", "R-102", "R-103"]);
  assert.equal(timetable.length, 3);
  assert.equal(timetable.some((entry) => entry.roomId === "R-101"), true);
  assert.equal(timetable.every((entry) => entry.day && entry.start >= 7 && entry.end <= 19), true);

  const exams = [
    { id: "E-1", lecturerId: "lect-1", roomId: "R-101", day: "Wed", start: 9, end: 11 },
    { id: "E-2", lecturerId: "lect-2", roomId: "R-101", day: "Wed", start: 10, end: 12 },
  ];
  const examTimetable = generateExamTimetable(exams, ["R-101", "R-102"]);
  assert.equal(examTimetable.length, 2);
  assert.equal(examTimetable[0].roomId !== examTimetable[1].roomId || examTimetable[0].day !== examTimetable[1].day, true);

  console.log("timetable: OK");
}

function runTimetableConstraintsPart1Tests() {
  console.log("Running timetable constraints part 1 (capacity, contiguous) tests...");

  // --- Room capacity is strict (§10.6) ---
  const room = { id: "R-101", capacity: 30 };
  assert.equal(checkRoomCapacity(room, { studentCount: 30 }).fits, true, "exactly at capacity fits");
  assert.equal(checkRoomCapacity(room, { studentCount: 31 }).fits, false, "over capacity rejected");
  assert.equal(
    checkRoomCapacity(room, { studentCount: 31 }).error,
    "room_over_capacity",
    "over capacity error code",
  );

  // --- Contiguous-slot logic ---
  type Booking = { roomId: string; day: string; start: number; end: number };
  // 10-12 booked: earliest 2-hour free block is 7-9.
  const gapBookings: Booking[] = [{ roomId: "R-1", day: "Mon", start: 10, end: 12 }];
  const gap = findContiguousBlock(gapBookings, "R-1", "Mon", 2, 7, 19);
  assert.equal(gap.found, true, "free gap found");
  assert.equal(gap.start, 7, "earliest block starts at business hour start");
  assert.equal(gap.end, 9, "earliest block ends at start + hours");

  // Fully booked day: no contiguous block anywhere.
  const fullBookings: Booking[] = [{ roomId: "R-2", day: "Mon", start: 7, end: 19 }];
  assert.equal(
    findContiguousBlock(fullBookings, "R-2", "Mon", 2, 7, 19).found,
    false,
    "fully booked day has no contiguous block",
  );

  // 7-9 and 13-15 booked: the earliest free 2-hour block is the middle gap 9-11.
  const middleBookings: Booking[] = [
    { roomId: "R-3", day: "Mon", start: 7, end: 9 },
    { roomId: "R-3", day: "Mon", start: 13, end: 15 },
  ];
  const middle = findContiguousBlock(middleBookings, "R-3", "Mon", 2, 7, 19);
  assert.equal(middle.found, true, "middle gap found");
  assert.equal(middle.start, 9, "middle gap starts right after the first booking");
  assert.equal(middle.end, 11, "middle gap ends right before the second booking");

  // Adjacent bookings 9-11 + 11-13: earlier hours stay free, so earliest is 7-9.
  const adjacentBookings: Booking[] = [
    { roomId: "R-4", day: "Mon", start: 9, end: 11 },
    { roomId: "R-4", day: "Mon", start: 11, end: 13 },
  ];
  const afterAdjacent = findContiguousBlock(adjacentBookings, "R-4", "Mon", 2, 7, 19);
  assert.equal(afterAdjacent.found, true, "adjacent bookings keep other hours free");
  assert.equal(afterAdjacent.start, 7, "earliest free block is 7-9 before the adjacent pair");

  console.log("timetable constraints part 1: OK");
}

function runTimetableConstraintsPart2Tests() {
  console.log("Running timetable constraints part 2 (student-group) tests...");

  type GroupBooking = { id: string; groupId: string; day: string; start: number; end: number };
  type GroupProposal = { groupId: string; day: string; start: number; end: number };
  const bookings: GroupBooking[] = [{ id: "g1-s1", groupId: "cs2a", day: "Mon", start: 9, end: 11 }];
  const proposed: GroupProposal = { groupId: "cs2a", day: "Mon", start: 10, end: 12 };
  assert.equal(checkGroupTimeConflict(bookings, proposed).conflict, true, "same group overlap detected");

  const adjacent: GroupProposal = { groupId: "cs2a", day: "Mon", start: 11, end: 13 };
  assert.equal(checkGroupTimeConflict(bookings, adjacent).conflict, false, "adjacent allowed");

  const otherGroup: GroupProposal = { groupId: "cs2b", day: "Mon", start: 10, end: 12 };
  assert.equal(checkGroupTimeConflict(bookings, otherGroup).conflict, false, "different groups may share a slot");

  const exact: GroupProposal = { groupId: "cs2a", day: "Mon", start: 9, end: 11 };
  const exactResult = checkGroupTimeConflict(bookings, exact);
  assert.equal(exactResult.conflict, true, "exact overlap detected");
  assert.equal(exactResult.conflictingId, "g1-s1", "conflicting session id surfaced");

  console.log("timetable constraints part 2: OK");
}

function runTimetableConstraintsPart3Tests() {
  console.log("Running timetable constraints part 3 (exam windows, holidays, caps) tests...");

  // 2026-09-07 is a Monday; 2026-09-10 a Thursday; exam window 2026-09-14..18.
  const term = {
    examWindows: [
      {
        examStartDate: new Date("2026-09-14T00:00:00Z"),
        examEndDate: new Date("2026-09-18T23:59:59Z"),
      },
    ],
    holidays: [{ date: new Date("2026-09-10T00:00:00Z"), endDate: null as Date | null }],
  };
  assert.equal(
    isDateInExamWindows(new Date("2026-09-16T09:00:00Z"), term.examWindows),
    true,
    "date inside exam window",
  );
  assert.equal(
    isDateInExamWindows(new Date("2026-09-07T09:00:00Z"), term.examWindows),
    false,
    "date outside exam window",
  );
  assert.equal(
    isDateOnHoliday(new Date("2026-09-10T09:00:00Z"), term.holidays),
    true,
    "single-day holiday",
  );
  assert.equal(
    isDateOnHoliday(new Date("2026-09-07T09:00:00Z"), term.holidays),
    false,
    "teaching day not holiday",
  );

  // Multi-day holiday range: 2026-12-23 .. 2026-12-27 inclusive.
  const rangeTerm = {
    examWindows: [] as Array<{ examStartDate: Date; examEndDate: Date }>,
    holidays: [{ date: new Date("2026-12-23T00:00:00Z"), endDate: new Date("2026-12-27T00:00:00Z") }],
  };
  assert.equal(
    isDateOnHoliday(new Date("2026-12-25T09:00:00Z"), rangeTerm.holidays),
    true,
    "multi-day holiday covers middle days",
  );
  assert.equal(
    isDateOnHoliday(new Date("2026-12-30T09:00:00Z"), rangeTerm.holidays),
    false,
    "day after range free",
  );

  // Regular sessions must avoid exam windows and holidays.
  const free = isDateSchedulable(new Date("2026-09-07T09:00:00Z"), term);
  assert.equal(free.schedulable, true, "ordinary Monday schedulable");
  const inExam = isDateSchedulable(new Date("2026-09-16T09:00:00Z"), term);
  assert.equal(inExam.schedulable, false, "exam window blocks regular sessions");
  assert.equal(inExam.reason, "exam_window");
  const onHoliday = isDateSchedulable(new Date("2026-09-10T09:00:00Z"), term);
  assert.equal(onHoliday.schedulable, false, "holiday blocks regular sessions");
  assert.equal(onHoliday.reason, "holiday");

  // --- Weekly caps reused from scheduling.ts ---
  const capsPolicy = { maxSessionsPerWeek: 18, maxUnitsPerSemester: 8 };
  const courseCredits: Record<string, number> = { CS101: 3, CS102: 2, CS103: 2, CS104: 2 };
  type CapSession = { groupId: string; courseId: string };

  const within = validateWeeklyCaps(
    [
      { groupId: "cs2a", courseId: "CS101" },
      { groupId: "cs2a", courseId: "CS102" },
    ] as CapSession[],
    courseCredits,
    capsPolicy,
  );
  assert.equal(within.valid, true, "2 sessions / 5 credits within caps");

  const overWeekly = validateWeeklyCaps(
    Array.from({ length: 19 }, () => ({ groupId: "cs3b", courseId: "CS101" })),
    courseCredits,
    capsPolicy,
  );
  assert.equal(overWeekly.valid, false, "group above weekly cap rejected");
  assert.equal(
    overWeekly.errors.some((e) => e.includes("weekly_cap_18")),
    true,
    "weekly cap violation reported",
  );

  const overUnits = validateWeeklyCaps(
    [
      { groupId: "cs1a", courseId: "CS101" },
      { groupId: "cs1a", courseId: "CS102" },
      { groupId: "cs1a", courseId: "CS103" },
      { groupId: "cs1a", courseId: "CS104" },
    ] as CapSession[],
    courseCredits,
    capsPolicy,
  );
  assert.equal(overUnits.valid, false, "group above unit cap rejected");
  assert.equal(
    overUnits.errors.some((e) => e.includes("unit_cap_8")),
    true,
    "unit cap violation reported",
  );

  console.log("timetable constraints part 3: OK");
}

function runSchedulingTests() {
  console.log("Running scheduling constraints tests...");

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
  const session = { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" };
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
  const studentSessions = [
    { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" },
  ];
  let proposed = { sessionId: "s2", courseId: "CS102", groupId: "g1", day: "Mon", startTime: 10, endTime: 12, roomId: "R-102" };
  let conflictResult = checkStudentTimeConflict(studentSessions, proposed);
  assert.equal(conflictResult.conflict, true, "should detect overlap");

  proposed = { sessionId: "s2", courseId: "CS102", groupId: "g1", day: "Tue", startTime: 9, endTime: 11, roomId: "R-102" };
  conflictResult = checkStudentTimeConflict(studentSessions, proposed);
  assert.equal(conflictResult.conflict, false);

  // Test 5: Lecturer time conflicts
  const lecturerSessions = [
    { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" },
  ];
  conflictResult = checkLecturerTimeConflict(lecturerSessions, proposed);
  assert.equal(conflictResult.conflict, false);

  // Test 6: Room conflicts
  const roomBookings = [
    { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" },
  ];
  proposed = { sessionId: "s2", courseId: "CS102", groupId: "g1", day: "Mon", startTime: 10, endTime: 12, roomId: "R-101" };
  conflictResult = checkRoomConflict(roomBookings, proposed);
  assert.equal(conflictResult.conflict, true, "should detect room overlap");

  // Test 7: Schedule change request with auto-approve (no conflicts)
  const changeReq = {
    sessionId: "s1",
    proposedRoomId: "R-102",
    changedAt: new Date(),
    sessionDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
  };
  const originalSess = { sessionId: "s1", courseId: "CS101", groupId: "g1", day: "Mon", startTime: 9, endTime: 11, roomId: "R-101" };
  const changeResult = validateScheduleChangeRequest(changeReq, [], [], [], policy, originalSess);
  assert.equal(changeResult.autoApprove, true, "should auto-approve room change with no conflicts");

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
    runTimetableConstraintsPart1Tests();
    runTimetableConstraintsPart2Tests();
    runTimetableConstraintsPart3Tests();
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
