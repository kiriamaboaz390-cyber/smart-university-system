import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";

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

    // Get lecturer's profile to match with sessions
    const lecturerProfile = await prisma.lecturerProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!lecturerProfile) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions = await prisma.session.findMany({
      where: { lecturerId: lecturerProfile.id },
      include: {
        room: true,
        course: true,
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ sessions });
  } catch (e) {
    console.error("Error fetching lecturer sessions:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
