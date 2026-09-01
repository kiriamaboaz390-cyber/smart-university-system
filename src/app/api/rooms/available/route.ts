import { NextRequest, NextResponse } from "next/server";

import { findAvailableRooms, type Room } from "@/lib/room-operations";

const rooms: Room[] = [
  { id: "R-101", bookings: [{ day: "Mon", start: 9, end: 11 }] },
  { id: "R-102", bookings: [{ day: "Mon", start: 12, end: 14 }] },
  { id: "R-103", bookings: [{ day: "Mon", start: 9, end: 10 }] },
  { id: "R-204", bookings: [{ day: "Tue", start: 10, end: 12 }] },
  { id: "R-305", bookings: [{ day: "Wed", start: 13, end: 15 }] },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day") ?? "Mon";
  const start = Number(searchParams.get("start") ?? 10);
  const end = Number(searchParams.get("end") ?? 12);

  const availableRooms = findAvailableRooms(rooms, day, start, end);

  return NextResponse.json({
    day,
    start,
    end,
    availableRooms,
    total: availableRooms.length,
  });
}
