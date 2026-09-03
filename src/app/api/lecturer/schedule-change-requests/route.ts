import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(user, ["LECTURER"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { sessionId, proposedRoomId, proposedStartTime, proposedEndTime, reason } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Get the session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { lecturer: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify lecturer owns this session
    if (session.lecturer?.userId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if requesting time change - needs 24-hour notice
    if (proposedStartTime || proposedEndTime) {
      const now = new Date();
      const sessionDate = new Date(session.sessionDate);
      const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilSession < 24) {
        return NextResponse.json(
          { error: "Time changes require 24-hour notice" },
          { status: 400 }
        );
      }
    }

    // Create schedule change request
    const changeRequest = await prisma.scheduleChangeRequest.create({
      data: {
        sessionId,
        lecturerId: session.lecturer!.id,
        proposedRoomId: proposedRoomId || session.roomId,
        proposedStartTime: proposedStartTime || session.startTime,
        proposedEndTime: proposedEndTime || session.endTime,
        reason: reason || "",
        status: "PENDING",
        createdAt: new Date(),
      },
    });

    return NextResponse.json(changeRequest, { status: 201 });
  } catch (e) {
    console.error("Error creating schedule change request:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(user, ["LECTURER"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lecturerProfile = await prisma.lecturerProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!lecturerProfile) {
      return NextResponse.json({ requests: [] });
    }

    const requests = await prisma.scheduleChangeRequest.findMany({
      where: { lecturerId: lecturerProfile.id },
      include: {
        session: true,
        proposedRoom: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (e) {
    console.error("Error fetching schedule change requests:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
