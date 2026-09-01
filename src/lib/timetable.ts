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

export function generateSemesterTimetable(courses: CourseInput[], roomIds: string[]): ScheduleEntry[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const timetable: ScheduleEntry[] = [];

  // allowed start slots for 2-hour sessions between 7:00 and 19:00
  const allowedStarts = [7, 9, 11, 13, 15, 17];

  // roomEntries can be either string ids or objects with capacity
  const rooms = roomIds as Array<string | { id: string; capacity: number }>;

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
    const roomObj = rooms.find((r) => typeof r !== "string" && (r as any).capacity >= courseSize) as any;
    if (roomObj) roomId = roomObj.id;
    else roomId = (rooms[index % rooms.length] as any) || `R-${index + 1}`;

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
