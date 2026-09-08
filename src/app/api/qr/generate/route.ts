import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";
import { buildSessionQrPayload } from "@/lib/qr";

export async function POST(req: Request) {
  try {
    const user = getUserFromAuthHeader(req.headers.get("authorization") ?? undefined);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { sessionId } = await req.json().catch(() => ({}));
    if (!sessionId) return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { room: true, lecturer: true },
    });
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    // Admins and SuperAdmins can generate any session's QR. Lecturers may
    // generate the QR for their own sessions so it can be shown in class.
    const isStaff = hasRole(user, ["SUPER_ADMIN", "ADMIN"]);
    const isOwningLecturer =
      hasRole(user, ["LECTURER"]) && session.lecturer?.userId === user.userId;
    if (!isStaff && !isOwningLecturer) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // payload is a compact string to be encoded in QR
    const payload = buildSessionQrPayload({
      sessionId: session.id,
      roomId: session.roomId,
      roomCode: session.room?.code ?? null,
      lecturerId: session.lecturerId,
      startTime: session.startTime,
      endTime: session.endTime,
    });
    return NextResponse.json({ payload });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}

