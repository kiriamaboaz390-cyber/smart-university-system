export type StudentGroup = {
  id: string;
  programme: string;
  year: number;
  maxUnits?: number; // default 8
  maxWeeklySessions?: number; // default 18
};

export type Allocation = {
  studentId: string;
  day: string; // Mon..Fri
  start: number; // hour
  end: number; // hour
  units: number; // units for that session
  courseId?: string;
};

export function validateGroupUnits(group: StudentGroup, allocatedUnits: number): { ok: boolean; message?: string } {
  const max = group.maxUnits ?? 8;
  if (allocatedUnits > max) return { ok: false, message: `group_exceeds_units:${allocatedUnits}>${max}` };
  return { ok: true };
}

export function validateWeeklySessionCap(group: StudentGroup, weeklySessions: number): { ok: boolean; message?: string } {
  const cap = group.maxWeeklySessions ?? 18;
  if (weeklySessions > cap) return { ok: false, message: `group_exceeds_weekly_sessions:${weeklySessions}>${cap}` };
  return { ok: true };
}

export function countStudentWeeklySessions(allocations: Allocation[], studentId: string) {
  return allocations.filter((a) => a.studentId === studentId).length;
}

export function canStudentTakeAllocation(allocations: Allocation[], candidate: Allocation, group: StudentGroup) {
  // check same-day weekly cap per student
  const studentSessions = allocations.filter((a) => a.studentId === candidate.studentId);
  const weekly = studentSessions.length + 1;
  const weeklyCheck = validateWeeklySessionCap(group, weekly);
  if (!weeklyCheck.ok) return weeklyCheck;

  // check overlapping sessions for the student
  const overlap = studentSessions.some((s) => s.day === candidate.day && s.start < candidate.end && candidate.start < s.end);
  if (overlap) return { ok: false, message: "student_conflict" };

  // units check: sum units across student's allocations plus candidate
  const unitSum = studentSessions.reduce((sum, s) => sum + (s.units || 0), 0) + (candidate.units || 0);
  const unitsCheck = validateGroupUnits(group, unitSum);
  if (!unitsCheck.ok) return unitsCheck;

  return { ok: true };
}
