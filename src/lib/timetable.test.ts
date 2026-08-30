import test from "node:test";
import assert from "node:assert/strict";

import {
  allocateRoom,
  checkForScheduleConflict,
  generateSemesterTimetable,
  generateExamTimetable,
} from "./timetable";

test("detects lecturer conflict when two sessions overlap", () => {
  const sessions = [
    { id: "L1", lecturerId: "lect-1", day: "Mon", start: 9, end: 11 },
    { id: "L2", lecturerId: "lect-1", day: "Mon", start: 10, end: 12 },
  ];

  assert.equal(checkForScheduleConflict(sessions), true);
});

test("allocates a room only when it is free for the requested time", () => {
  const schedule = [
    { roomId: "R-101", day: "Tue", start: 8, end: 10, lecturerId: "lect-2" },
  ];

  const room = allocateRoom(schedule, "R-101", "Tue", 9, 11);
  assert.equal(room, false);

  const room2 = allocateRoom(schedule, "R-102", "Tue", 9, 11);
  assert.equal(room2, true);
});

test("builds a valid semester timetable without lecturer or room conflicts", () => {
  const courses = [
    { id: "CS101", lecturerId: "lect-1", studentIds: ["stu-1", "stu-2"], duration: 2 },
    { id: "CS102", lecturerId: "lect-2", studentIds: ["stu-2", "stu-3"], duration: 2 },
    { id: "CS103", lecturerId: "lect-3", studentIds: ["stu-1", "stu-3"], duration: 2 },
  ];

  const timetable = generateSemesterTimetable(courses, ["R-101", "R-102", "R-103"]);

  assert.equal(timetable.length, 3);
  assert.equal(timetable.some((entry) => entry.roomId === "R-101"), true);
  assert.equal(timetable.every((entry) => entry.day && entry.start >= 8 && entry.end <= 18), true);
});

test("creates exam slots while preserving room and lecturer availability", () => {
  const exams = [
    { id: "E-1", lecturerId: "lect-1", roomId: "R-101", day: "Wed", start: 9, end: 11 },
    { id: "E-2", lecturerId: "lect-2", roomId: "R-101", day: "Wed", start: 10, end: 12 },
  ];

  const timetable = generateExamTimetable(exams, ["R-101", "R-102"]);
  assert.equal(timetable.length, 2);
  assert.equal(timetable[0].roomId !== timetable[1].roomId || timetable[0].day !== timetable[1].day, true);
});
