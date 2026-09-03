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

    // Only ADMIN and SUPER_ADMIN can view term configs
    if (!hasRole(user, ["ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = await prisma.termConfig.findMany({
      include: {
        holidays: true,
        examWindows: true,
      },
    });

    return NextResponse.json(configs);
  } catch (e) {
    console.error("Error fetching term configs:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN and SUPER_ADMIN can create term configs
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
      holidays,
      examWindows,
      campusId,
    } = body;

    // Validate required fields
    if (!termName || !startDate || !endDate || !campusId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const termConfig = await prisma.termConfig.create({
      data: {
        termName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        businessHourStart: businessHourStart || 7,
        businessHourEnd: businessHourEnd || 19,
        maxSessionsPerWeek: maxSessionsPerWeek || 18,
        maxUnitsPerSemester: maxUnitsPerSemester || 8,
        campusId,
        holidays: holidays
          ? {
              create: holidays.map((h: any) => ({
                name: h.name,
                startDate: new Date(h.startDate),
                endDate: new Date(h.endDate),
              })),
            }
          : undefined,
        examWindows: examWindows
          ? {
              create: examWindows.map((e: any) => ({
                name: e.name,
                startDate: new Date(e.startDate),
                endDate: new Date(e.endDate),
              })),
            }
          : undefined,
      },
      include: {
        holidays: true,
        examWindows: true,
      },
    });

    return NextResponse.json(termConfig, { status: 201 });
  } catch (e) {
    console.error("Error creating term config:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
