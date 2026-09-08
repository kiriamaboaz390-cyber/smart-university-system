/**
 * QR payload helpers for the attendance flow.
 *
 * A session QR payload is a compact, human-readable string that encodes the
 * identifiers a scanner needs to record attendance:
 *
 *   smart-university:session=<sessionId>;room=<roomCode|roomId>;lecturer=<lecturerId>;start=<hour>;end=<hour>
 *
 * Parsing is intentionally lenient (prefix optional, whitespace tolerated) so
 * payloads produced by the API, the lecturer dashboard, or typed manually all
 * resolve to the same shape.
 */

export const QR_PAYLOAD_PREFIX = "smart-university:";

export interface SessionQrInput {
  sessionId: string;
  roomId: string;
  roomCode?: string | null;
  lecturerId: string;
  startTime: number;
  endTime: number;
}


export function buildSessionQrPayload(input: SessionQrInput): string {
  const room =
    input.roomCode && input.roomCode.trim() !== "" ? input.roomCode : input.roomId;
  return (
    `${QR_PAYLOAD_PREFIX}session=${input.sessionId}` +
    `;room=${room}` +
    `;lecturer=${input.lecturerId}` +
    `;start=${input.startTime}` +
    `;end=${input.endTime}`
  );
}

export function parseQrPayload(payload: string): Record<string, string> | null {
  const trimmed = payload.trim();
  const withoutPrefix = trimmed.startsWith(QR_PAYLOAD_PREFIX)
    ? trimmed.slice(QR_PAYLOAD_PREFIX.length)
    : trimmed;
  if (withoutPrefix === "") return null;

  const fields: Record<string, string> = {};
  for (const part of withoutPrefix.split(";")) {
    const chunk = part.trim();
    if (chunk === "") continue;
    const eq = chunk.indexOf("=");
    if (eq <= 0) continue; // no separator, or empty key
    const key = chunk.slice(0, eq).trim();
    const value = chunk.slice(eq + 1).trim();
    if (key === "") continue;
    fields[key] = value;
  }

  // `session` is the one required field for any attendance payload.
  if (!fields.session) return null;
  return fields;
}

const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface ActiveWindowSession {
  day: string;
  startTime: number;
  endTime: number;
}

/** Minutes after the end time during which a scan is still accepted. */
export const SCAN_GRACE_MINUTES = 15;

/**
 * Whether the session's weekly slot covers `now` (UTC), with a small grace
 * period after the end hour so students scanning at the door as class wraps up
 * are not rejected. Hours are whole hours (07-19) per the scheduling model.
 */
export function isSessionActiveNow(
  session: ActiveWindowSession,
  now: Date = new Date(),
  graceMinutes: number = SCAN_GRACE_MINUTES
): boolean {
  const dayIndex = DAY_INDEX[session.day];
  if (dayIndex === undefined) return false;
  if (now.getUTCDay() !== dayIndex) return false;

  const currentMinuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMinute = session.startTime * 60;
  const endMinute = session.endTime * 60 + graceMinutes;
  return currentMinuteOfDay >= startMinute && currentMinuteOfDay <= endMinute;
}
