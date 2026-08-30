import test from "node:test";
import assert from "node:assert/strict";

import { findAvailableRooms, createSessionToken } from "./room-operations";

test("finds rooms available for a requested time window", () => {
  const rooms = [
    { id: "R-101", bookings: [{ day: "Mon", start: 9, end: 11 }] },
    { id: "R-102", bookings: [{ day: "Mon", start: 12, end: 14 }] },
    { id: "R-103", bookings: [{ day: "Mon", start: 9, end: 10 }] },
  ];

  const available = findAvailableRooms(rooms, "Mon", 10, 12);
  assert.deepEqual(available, ["R-102", "R-103"]);
});

test("creates a token payload that includes session and room metadata", () => {
  const token = createSessionToken({ sessionId: "CS101-1", roomId: "R-204", lecturerId: "L-7", studentId: "S-12" });

  assert.equal(token.includes("CS101-1"), true);
  assert.equal(token.includes("R-204"), true);
  assert.equal(token.includes("L-7"), true);
  assert.equal(token.includes("S-12"), true);
});
