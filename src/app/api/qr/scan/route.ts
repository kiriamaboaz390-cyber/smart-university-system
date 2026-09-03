import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";

function parsePayload(payload: string) {
  // expected format: key=val;key=val
  const parts = payload.split(";").map((p) => p.trim());
  const obj: Record<string,string> = {};
  for (const p of parts) {
    const [k, v] = p.split("="); if (!k) continue; obj[k] = v || "";
  }
  return obj;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { payload, studentId, action } = body;
    const user = getUserFromAuthHeader(req.headers.get("authorization") ?? undefined);
    if (!payload) return NextResponse.json({ error: "missing_payload" }, { status: 400 });

    const parsed = parsePayload(payload.replace(/^smart-university:/, ""));
    const sessionId = parsed.session;
    if (!sessionId) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    if (action === "start") {
      // only lecturers can start sessions
      if (!hasRole(user, ["LECTURER"])) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      // mark room occupied and create audit log
      if (session.roomId) {
        await prisma.room.update({ where: { id: session.roomId }, data: { status: "OCCUPIED" } });
      }
      await prisma.auditLog.create({ data: { actorId: parsed.lecturer || null, action: "session_start", entityType: "Session", entityId: session.id, details: "Lecturer started session via QR" } });
      return NextResponse.json({ status: "started" });
    }

    if (!studentId) return NextResponse.json({ error: "missing_studentId" }, { status: 400 });

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

    // optimistic check: ensure no overlapping attendance
    const existing = await prisma.attendanceRecord.findFirst({ where: { sessionId: session.id, studentId: student.id } });
    if (existing) return NextResponse.json({ status: "already_recorded" });

    const record = await prisma.attendanceRecord.create({ data: { sessionId: session.id, studentId: student.id, status: "PRESENT", scannedAt: new Date() } });
    await prisma.auditLog.create({ data: { actorId: student.id, action: "attendance_scan", entityType: "AttendanceRecord", entityId: record.id, details: `Scanned QR for session ${session.id}` } });

    return NextResponse.json({ status: "recorded", record });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
