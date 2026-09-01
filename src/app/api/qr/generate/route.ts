import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";

export async function POST(req: Request) {
  try {
    const user = getUserFromAuthHeader(req.headers.get("authorization") ?? undefined);
    if (!hasRole(user, ["SUPER_ADMIN", "ADMIN"])) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });

    const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { room: true, lecturer: true } });
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    // payload is a compact string to be encoded in QR
    const payload = `smart-university:session=${session.id};room=${session.room?.code || session.roomId};lecturer=${session.lecturerId};start=${session.startTime};end=${session.endTime}`;
    return NextResponse.json({ payload });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
