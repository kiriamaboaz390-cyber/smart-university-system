import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";

interface Params {
  id: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(user, ["ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const termConfig = await prisma.termConfig.findUnique({
      where: { id },
      include: {
        holidays: true,
        examWindows: true,
      },
    });

    if (!termConfig) {
      return NextResponse.json({ error: "Term config not found" }, { status: 404 });
    }

    return NextResponse.json(termConfig);
  } catch (e) {
    console.error("Error fetching term config:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(user, ["ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      termName,
      startDate,
      endDate,
      businessHourStart,
      businessHourEnd,
      maxSessionsPerWeek,
      maxUnitsPerSemester,
    } = body;

    const termConfig = await prisma.termConfig.update({
      where: { id },
      data: {
        ...(termName && { termName }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(businessHourStart !== undefined && { businessHourStart }),
        ...(businessHourEnd !== undefined && { businessHourEnd }),
        ...(maxSessionsPerWeek && { maxSessionsPerWeek }),
        ...(maxUnitsPerSemester && { maxUnitsPerSemester }),
      },
      include: {
        holidays: true,
        examWindows: true,
      },
    });

    return NextResponse.json(termConfig);
  } catch (e) {
    console.error("Error updating term config:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(user, ["SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.termConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Error deleting term config:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
