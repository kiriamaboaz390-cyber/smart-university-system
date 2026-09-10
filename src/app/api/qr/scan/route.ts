import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";
import { isSessionActiveNow, parseQrPayload } from "@/lib/qr";

export async function POST(req: Request) {
  try {
    // Identity always comes from the verified token, never from the request body.
    const user = getUserFromAuthHeader(req.headers.get("authorization") ?? undefined);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const { payload, action = "attend" } = body ?? {};
    if (!payload || typeof payload !== "string") {
      return NextResponse.json({ error: "missing_payload" }, { status: 400 });
    }

    const parsed = parseQrPayload(payload);
    const sessionId = parsed?.session;
    if (!sessionId) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    if (action === "start") {
      // only lecturers can start sessions
      if (!hasRole(user, ["LECTURER"])) return NextResponse.json({ error: "forbidden" }, { status: 403 });

      // Resolve the lecturer profile's User id so the audit trail always points
      // at a real user, regardless of what the payload contains.
      const lecturerProfile = await prisma.lecturerProfile.findUnique({
        where: { id: session.lecturerId },
      });

      // mark room occupied and create audit log
      if (session.roomId) {
        await prisma.room.update({ where: { id: session.roomId }, data: { status: "OCCUPIED" } });
      }
      await prisma.auditLog.create({
        data: {
          actorId: lecturerProfile?.userId ?? null,
          action: "session_start",
          entityType: "Session",
          entityId: session.id,
          details: "Lecturer started session via QR",
        },
      });
      return NextResponse.json({ status: "started" });
    }

    // Attendance: only students can record attendance, and only for themselves.
    if (!hasRole(user, ["STUDENT"])) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const studentId = user.userId;

    // Scans are only accepted inside the session's active weekly window
    // (with a small grace period after the end hour).
    if (!isSessionActiveNow(session)) {
      return NextResponse.json({ error: "session_not_active" }, { status: 409 });
    }

    // optimistic check: ensure no duplicate attendance for the same session
    const existing = await prisma.attendanceRecord.findFirst({
      where: { sessionId: session.id, studentId },
    });
    if (existing) return NextResponse.json({ status: "already_recorded", record: existing });

    const record = await prisma.attendanceRecord.create({
      data: { sessionId: session.id, studentId, status: "PRESENT", scannedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        actorId: studentId,
        action: "attendance_scan",
        entityType: "AttendanceRecord",
        entityId: record.id,
        details: `Scanned QR for session ${session.id}`,
      },
    });

    return NextResponse.json({ status: "recorded", record });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

