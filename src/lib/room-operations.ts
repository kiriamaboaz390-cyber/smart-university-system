export type Room = {
  id: string;
  name?: string;
  capacity?: number;
  bookings: Array<{ day: string; start: number; end: number }>;
};

export function findAvailableRooms(rooms: Room[], day: string, start: number, end: number): string[] {
  return rooms
    .filter((room) =>
      room.bookings.every(
        (booking) => booking.day !== day || start >= booking.end || booking.start >= end,
      ),
    )
    .map((room) => room.id);
}

export function createSessionToken(payload: {
  sessionId: string;
  roomId: string;
  lecturerId: string;
  studentId: string;
}): string {
  return JSON.stringify({
    sessionId: payload.sessionId,
    roomId: payload.roomId,
    lecturerId: payload.lecturerId,
    studentId: payload.studentId,
    generatedAt: new Date().toISOString(),
  });
}
