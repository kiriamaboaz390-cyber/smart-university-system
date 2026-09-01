import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
    return obj;
  });
}

async function importUsers(rows: Record<string, string>[]) {
  const created: any[] = [];
  for (const r of rows) {
    const email = r.email;
    if (!email) continue;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      created.push(existing);
      continue;
    }

    const user = await prisma.user.create({ data: {
      email,
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      role: r.role || "STUDENT",
      status: r.status || "ACTIVE",
    }});
    created.push(user);
  }
  return created;
}

async function importStudents(rows: Record<string, string>[]) {
  const created: any[] = [];
  for (const r of rows) {
    const userEmail = r.userEmail;
    if (!userEmail) continue;
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) continue;
    const existing = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (existing) { created.push(existing); continue; }
    const sp = await prisma.studentProfile.create({ data: {
      userId: user.id,
      studentCode: r.studentCode || `${user.id}-S`,
      yearLevel: parseInt(r.yearLevel || "1", 10),
      programme: r.programme || "",
    }});
    created.push(sp);
  }
  return created;
}

async function importLecturers(rows: Record<string, string>[]) {
  const created: any[] = [];
  for (const r of rows) {
    const userEmail = r.userEmail;
    if (!userEmail) continue;
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) continue;
    const existing = await prisma.lecturerProfile.findUnique({ where: { userId: user.id } });
    if (existing) { created.push(existing); continue; }
    const lp = await prisma.lecturerProfile.create({ data: {
      userId: user.id,
      title: r.title || "",
      department: r.department || "",
    }});
    created.push(lp);
  }
  return created;
}

async function importRooms(rows: Record<string, string>[]) {
  const created: any[] = [];
  // ensure default campus exists
  let campus = await prisma.campus.findUnique({ where: { code: "DEFAULT" } });
  if (!campus) {
    campus = await prisma.campus.create({ data: { name: "Default Campus", code: "DEFAULT" } });
  }

  for (const r of rows) {
    const code = r.code;
    if (!code) continue;
    const existing = await prisma.room.findUnique({ where: { code } });
    if (existing) { created.push(existing); continue; }

    // find or create building
    const buildingCode = r.buildingCode || r.buildingId || "MAIN";
    let building = await prisma.building.findUnique({ where: { code: buildingCode } });
    if (!building) {
      building = await prisma.building.create({ data: { campusId: campus.id, name: buildingCode, code: buildingCode } });
    }

    const room = await prisma.room.create({ data: {
      buildingId: building.id,
      name: r.name || code,
      code,
      capacity: parseInt(r.capacity || "0", 10),
      status: r.status || "AVAILABLE",
    }});
    created.push(room);
  }
  return created;
}

async function importCourses(rows: Record<string, string>[]) {
  const created: any[] = [];
  for (const r of rows) {
    const code = r.code; if (!code) continue;
    const existing = await prisma.course.findUnique({ where: { code } });
    if (existing) { created.push(existing); continue; }
    const course = await prisma.course.create({ data: {
      code,
      title: r.title || "",
      credits: parseInt(r.credits || "0", 10),
      department: r.department || "",
    }});
    created.push(course);
  }
  return created;
}

async function importSessions(rows: Record<string, string>[]) {
  const created: any[] = [];
  for (const r of rows) {
    const courseCode = r.courseCode; if (!courseCode) continue;
    const course = await prisma.course.findUnique({ where: { code: courseCode } });
    if (!course) continue;

    const lecturerEmail = r.lecturerEmail;
    const lecturerUser = lecturerEmail ? await prisma.user.findUnique({ where: { email: lecturerEmail } }) : null;
    const lecturer = lecturerUser ? await prisma.lecturerProfile.findUnique({ where: { userId: lecturerUser.id } }) : null;

    const room = r.roomCode ? await prisma.room.findUnique({ where: { code: r.roomCode } }) : null;
    const session = await prisma.session.create({ data: {
      courseId: course.id,
      lecturerId: lecturer ? lecturer.id : "",
      roomId: room ? room.id : "",
      day: r.day || "Mon",
      startTime: parseInt(r.startTime || "9", 10),
      endTime: parseInt(r.endTime || "11", 10),
      type: r.type || "LECTURE",
    }});
    created.push(session);
  }
  return created;
}

export async function POST(req: Request) {
  try {
    const user = getUserFromAuthHeader(req.headers.get("authorization") ?? undefined);
    if (!hasRole(user, ["SUPER_ADMIN", "HR_ADMIN"])) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { type, csv } = body;
    if (!type || !csv) return NextResponse.json({ error: "missing_type_or_csv" }, { status: 400 });
    const rows = parseCsv(csv);

    let result;
    switch (type) {
      case "users": result = await importUsers(rows); break;
      case "students": result = await importStudents(rows); break;
      case "lecturers": result = await importLecturers(rows); break;
      case "rooms": result = await importRooms(rows); break;
      case "courses": result = await importCourses(rows); break;
      case "sessions": result = await importSessions(rows); break;
      default: return NextResponse.json({ error: "unknown_type" }, { status: 400 });
    }

    return NextResponse.json({ imported: result.length, sample: result.slice(0, 5) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
