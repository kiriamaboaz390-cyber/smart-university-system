export type ScheduleEntry = {
  id: string;
  day: string;
  start: number;
  end: number;
  roomId: string;
  lecturerId: string;
  courseId?: string;
  studentIds?: string[];
};

export type CourseInput = {
  id: string;
  lecturerId: string;
  studentIds: string[];
  duration: number; // duration in hours; for semester slots we enforce 2
};

export function checkForScheduleConflict(sessions: Array<{ id?: string; lecturerId: string; day: string; start: number; end: number }>): boolean {
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      const current = sessions[i];
      const next = sessions[j];

      if (current.lecturerId !== next.lecturerId) continue;
      if (current.day !== next.day) continue;
      if (current.start < next.end && next.start < current.end) {
        return true;
      }
    }
  }

  return false;
}

export function allocateRoom(
  existingSchedule: Array<{ roomId: string; day: string; start: number; end: number; lecturerId: string }>,
  roomId: string,
  day: string,
  start: number,
  end: number,
): boolean {
  return !existingSchedule.some(
    (entry) =>
      entry.roomId === roomId &&
      entry.day === day &&
      start < entry.end &&
      entry.start < end,
  );
}

export type RoomLike = { id: string; capacity: number };

export function generateSemesterTimetable(courses: CourseInput[], roomIds: Array<string | RoomLike>): ScheduleEntry[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const timetable: ScheduleEntry[] = [];

  // allowed start slots for 2-hour sessions between 7:00 and 19:00
  const allowedStarts = [7, 9, 11, 13, 15, 17];

  courses.forEach((course, index) => {
    const day = days[index % days.length];

    // enforce 2-hour slots for semester timetable
    const duration = 2;

    // pick start based on index cycling allowed starts
    const start = allowedStarts[index % allowedStarts.length];
    const end = start + duration;

    // select a room that fits capacity if room objects provided
    let roomId: string;
    const courseSize = course.studentIds?.length ?? 0;
    const roomObj = roomIds.find(
      (r): r is RoomLike => typeof r !== "string" && r.capacity >= courseSize,
    );
    if (roomObj) roomId = roomObj.id;
    else {
      const pick = roomIds[index % roomIds.length];
      roomId = typeof pick === "string" ? pick : pick?.id ?? `R-${index + 1}`;
    }

    timetable.push({
      id: `${course.id}-slot`,
      day,
      start,
      end,
      roomId,
      lecturerId: course.lecturerId,
      courseId: course.id,
      studentIds: course.studentIds,
    });
  });

  return timetable;
}

/**
 * Constraint helpers for the timetable engine (§10.3, §10.6).
 * All functions are pure and unit-testable.
 */

export type RoomCapacityCheck = { fits: boolean; error?: string };

/** Room capacity is strict: a room fits only when studentCount <= capacity (§10.6). */
export function checkRoomCapacity(
  room: { id: string; capacity: number },
  input: { studentCount: number },
): RoomCapacityCheck {
  if (input.studentCount > room.capacity) {
    return { fits: false, error: "room_over_capacity" };
  }
  return { fits: true };
}

export type ContiguousBlock = { found: boolean; start?: number; end?: number };

/**
 * Finds the earliest contiguous free block of `hours` length for a room on a
 * day, scanning from businessHourStart to businessHourEnd. Adjacent bookings
 * never split contiguity: a block is free when no booking overlaps it.
 */
export function findContiguousBlock(
  existingSchedule: Array<{ roomId: string; day: string; start: number; end: number }>,
  roomId: string,
  day: string,
  hours: number,
  businessHourStart: number,
  businessHourEnd: number,
): ContiguousBlock {
  const bookings = existingSchedule.filter((b) => b.roomId === roomId && b.day === day);
  for (let start = businessHourStart; start + hours <= businessHourEnd; start += 1) {
    const end = start + hours;
    const overlaps = bookings.some((b) => start < b.end && b.start < end);
    if (!overlaps) return { found: true, start, end };
  }
  return { found: false };
}

export type GroupConflict = { conflict: boolean; conflictingId?: string };

/** Detects student-group time conflicts: same group, same day, overlapping. */
export function checkGroupTimeConflict(
  groupBookings: Array<{ id: string; groupId: string; day: string; start: number; end: number }>,
  proposed: { groupId: string; day: string; start: number; end: number },
): GroupConflict {
  for (const booking of groupBookings) {
    if (
      booking.groupId === proposed.groupId &&
      booking.day === proposed.day &&
      proposed.start < booking.end &&
      booking.start < proposed.end
    ) {
      return { conflict: true, conflictingId: booking.id };
    }
  }
  return { conflict: false };
}

/** True when the date falls inside any exam window (inclusive). */
export function isDateInExamWindows(
  date: Date,
  examWindows: Array<{ examStartDate: Date; examEndDate: Date }>,
): boolean {
  return examWindows.some((w) => date >= w.examStartDate && date <= w.examEndDate);
}

/** True when the date falls on a single-day holiday or inside a multi-day range (inclusive). */
export function isDateOnHoliday(
  date: Date,
  holidays: Array<{ date: Date; endDate?: Date | null }>,
): boolean {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);
  return holidays.some((h) => {
    const rangeStart = new Date(h.date);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = h.endDate ? new Date(h.endDate) : new Date(h.date);
    rangeEnd.setUTCHours(23, 59, 59, 999);
    return dayStart <= rangeEnd && dayEnd >= rangeStart;
  });
}

export type SchedulableCheck = { schedulable: boolean; reason?: "exam_window" | "holiday" };

/**
 * Regular sessions are schedulable only outside exam windows and holidays.
 * Exam windows and holidays are checked in that order.
 */
export function isDateSchedulable(
  date: Date,
  term: {
    examWindows: Array<{ examStartDate: Date; examEndDate: Date }>;
    holidays: Array<{ date: Date; endDate?: Date | null }>;
  },
): SchedulableCheck {
  if (isDateInExamWindows(date, term.examWindows)) {
    return { schedulable: false, reason: "exam_window" };
  }
  if (isDateOnHoliday(date, term.holidays)) {
    return { schedulable: false, reason: "holiday" };
  }
  return { schedulable: true };
}

export type WeeklyCapsCheck = { valid: boolean; errors: string[] };

/**
 * Validates a student group's sessions against the term policy caps already
 * modeled in src/lib/scheduling.ts: maxSessionsPerWeek (session count per
 * group) and maxUnitsPerSemester (unique course credits per group).
 */
export function validateWeeklyCaps(
  sessions: Array<{ groupId: string; courseId: string }>,
  courseCredits: Record<string, number>,
  policy: { maxSessionsPerWeek: number; maxUnitsPerSemester: number },
): WeeklyCapsCheck {
  const errors: string[] = [];
  const byGroup = new Map<string, Array<{ courseId: string }>>();
  for (const session of sessions) {
    const list = byGroup.get(session.groupId) ?? [];
    list.push({ courseId: session.courseId });
    byGroup.set(session.groupId, list);
  }

  for (const [groupId, groupSessions] of byGroup) {
    if (groupSessions.length > policy.maxSessionsPerWeek) {
      errors.push(`group_${groupId}_exceeds_weekly_cap_${policy.maxSessionsPerWeek}`);
    }
    const uniqueCourseIds = Array.from(new Set(groupSessions.map((s) => s.courseId)));
    const units = uniqueCourseIds.reduce((sum, courseId) => sum + (courseCredits[courseId] ?? 0), 0);
    if (units > policy.maxUnitsPerSemester) {
      errors.push(`group_${groupId}_exceeds_unit_cap_${policy.maxUnitsPerSemester}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function generateExamTimetable(
  exams: Array<{ id: string; lecturerId: string; roomId: string; day: string; start: number; end: number }>,
  roomIds: string[],
): Array<{ id: string; lecturerId: string; roomId: string; day: string; start: number; end: number }> {
  return exams.map((exam, index) => {
    const roomId = roomIds[index % roomIds.length];

    return {
      ...exam,
      roomId,
      day: exam.day || ["Mon", "Tue", "Wed", "Thu", "Fri"][index % 5],
      start: exam.start || 9,
      end: exam.end || exam.start + 2 || 11,
    };
  });
}
