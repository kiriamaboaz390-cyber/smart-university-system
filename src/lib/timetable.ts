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
  duration: number;
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

  courses.forEach((course, index) => {
    const day = days[index % days.length];
    const roomId = roomIds[index % roomIds.length];
    const start = 9 + ((index * 2) % 6);
    const end = start + course.duration;

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
