/**
 * Scheduling constraints engine for the Smart University System.
 * Enforces: 2-hour fixed slots, business hours, weekly session caps, unit limits, 24-hour change notice.
 */

export interface StudentLoad {
  studentId: string;
  weeklySessionsCount: number;
  unitsThisSemester: number;
}

export interface SessionProposal {
  sessionId: string;
  courseId: string;
  groupId: string;
  day: string;
  startTime: number;
  endTime: number;
  roomId: string;
}

export interface ChangeRequest {
  sessionId: string;
  proposedDay?: string;
  proposedStartTime?: number;
  proposedEndTime?: number;
  proposedRoomId?: string;
  changedAt: Date;
  sessionDate?: Date; // original session date
}

export interface TermPolicy {
  businessHourStart: number; // e.g., 7
  businessHourEnd: number;   // e.g., 19
  maxSessionsPerWeek: number;
  maxUnitsPerSemester: number;
  sessionDurationHours: number;
}

/**
 * Validates that a session fits within business hours and uses 2-hour slots.
 */
export function validateSessionTiming(
  day: string,
  startTime: number,
  endTime: number,
  policy: TermPolicy
): { valid: boolean; error?: string } {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  if (!days.includes(day)) return { valid: false, error: "session_must_be_mon_fri" };

  if (startTime < policy.businessHourStart || endTime > policy.businessHourEnd) {
    return { valid: false, error: "session_outside_business_hours" };
  }

  if (endTime - startTime !== policy.sessionDurationHours) {
    return { valid: false, error: "session_must_be_2_hours" };
  }

  return { valid: true };
}

/**
 * Validates that a student's weekly session load does not exceed the cap.
 */
export function validateWeeklySessionCap(
  currentLoad: StudentLoad,
  newSessionToAdd: SessionProposal,
  policy: TermPolicy
): { valid: boolean; error?: string } {
  if (currentLoad.weeklySessionsCount >= policy.maxSessionsPerWeek) {
    return { valid: false, error: `student_exceeds_weekly_cap_${policy.maxSessionsPerWeek}` };
  }
  return { valid: true };
}

/**
 * Validates that a group's total units for the semester do not exceed the cap.
 */
export function validateUnitsPerSemester(
  groupUnits: number,
  courseCredits: number,
  policy: TermPolicy
): { valid: boolean; error?: string } {
  if (groupUnits + courseCredits > policy.maxUnitsPerSemester) {
    return { valid: false, error: `group_exceeds_unit_cap_${policy.maxUnitsPerSemester}` };
  }
  return { valid: true };
}

/**
 * Checks if a student already has a session allocated at the same time.
 */
export function checkStudentTimeConflict(
  studentSessions: SessionProposal[],
  proposedSession: SessionProposal
): { conflict: boolean; conflictingSessionId?: string } {
  for (const existing of studentSessions) {
    if (existing.day === proposedSession.day &&
        existing.startTime < proposedSession.endTime &&
        existing.endTime > proposedSession.startTime) {
      return { conflict: true, conflictingSessionId: existing.sessionId };
    }
  }
  return { conflict: false };
}

/**
 * Checks if a lecturer has a session at the same time.
 */
export function checkLecturerTimeConflict(
  lecturerSessions: SessionProposal[],
  proposedSession: SessionProposal
): { conflict: boolean; conflictingSessionId?: string } {
  for (const existing of lecturerSessions) {
    if (existing.day === proposedSession.day &&
        existing.startTime < proposedSession.endTime &&
        existing.endTime > proposedSession.startTime) {
      return { conflict: true, conflictingSessionId: existing.sessionId };
    }
  }
  return { conflict: false };
}

/**
 * Checks if a room is booked at the same time.
 */
export function checkRoomConflict(
  roomBookings: SessionProposal[],
  proposedSession: SessionProposal
): { conflict: boolean; conflictingSessionId?: string } {
  for (const existing of roomBookings) {
    if (existing.roomId === proposedSession.roomId &&
        existing.day === proposedSession.day &&
        existing.startTime < proposedSession.endTime &&
        existing.endTime > proposedSession.startTime) {
      return { conflict: true, conflictingSessionId: existing.sessionId };
    }
  }
  return { conflict: false };
}

/**
 * Validates a lecturer-initiated room or time change request.
 * Returns auto-approved if no conflicts; requires manual approval if conflicts exist.
 */
export function validateScheduleChangeRequest(
  changeRequest: ChangeRequest,
  studentSessions: SessionProposal[],
  lecturerSessions: SessionProposal[],
  roomBookings: SessionProposal[],
  policy: TermPolicy,
  originalSession: SessionProposal
): {
  autoApprove: boolean;
  conflict?: { type: "student" | "lecturer" | "room"; id: string };
  errors?: string[];
} {
  const errors: string[] = [];

  // If time change requested, validate 24-hour notice
  if (changeRequest.proposedDay || changeRequest.proposedStartTime) {
    const now = new Date();
    const hoursUntilSession = changeRequest.sessionDate
      ? (changeRequest.sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      : 0;
    if (hoursUntilSession < 24) {
      errors.push("time_change_requires_24_hour_notice");
    }
  }

  // Build proposed session
  const proposedSession: SessionProposal = {
    ...originalSession,
    day: changeRequest.proposedDay || originalSession.day,
    startTime: changeRequest.proposedStartTime || originalSession.startTime,
    endTime: changeRequest.proposedEndTime || originalSession.endTime,
    roomId: changeRequest.proposedRoomId || originalSession.roomId,
  };

  // Validate timing
  const timingValidation = validateSessionTiming(proposedSession.day, proposedSession.startTime, proposedSession.endTime, policy);
  if (!timingValidation.valid) errors.push(timingValidation.error!);

  // Check for conflicts (excluding the original session)
  const studentConflict = checkStudentTimeConflict(
    studentSessions.filter((s) => s.sessionId !== originalSession.sessionId),
    proposedSession
  );
  if (studentConflict.conflict) {
    return { autoApprove: false, conflict: { type: "student", id: studentConflict.conflictingSessionId! } };
  }

  const lecturerConflict = checkLecturerTimeConflict(
    lecturerSessions.filter((s) => s.sessionId !== originalSession.sessionId),
    proposedSession
  );
  if (lecturerConflict.conflict) {
    return { autoApprove: false, conflict: { type: "lecturer", id: lecturerConflict.conflictingSessionId! } };
  }

  const roomConflict = checkRoomConflict(
    roomBookings.filter((s) => s.sessionId !== originalSession.sessionId),
    proposedSession
  );
  if (roomConflict.conflict) {
    return { autoApprove: false, conflict: { type: "room", id: roomConflict.conflictingSessionId! } };
  }

  return { autoApprove: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Calculates weekly session count for a student given their sessions.
 */
export function calculateWeeklySessionCount(
  sessions: SessionProposal[]
): number {
  // Assuming each session is unique per week (no repeats modeled here)
  return sessions.length;
}

/**
 * Calculates total units for a group in the semester.
 */
export function calculateGroupUnits(
  coursesList: Array<{ credits: number }>
): number {
  return coursesList.reduce((sum, course) => sum + course.credits, 0);
}
