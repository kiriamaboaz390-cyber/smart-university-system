/**
 * Idempotent development seed for the SQLite dev database.
 *
 * Creates a minimal but complete slice of data so the QR attendance flow can
 * be exercised end to end:
 *   campus -> building -> room -> course -> users (admin/lecturer/student)
 *   -> one session that is active RIGHT NOW (day/hour derived from the clock)
 *   -> one inactive session (tomorrow) for negative testing.
 *
 * Run with:  npx tsx scripts/seed-dev.ts
 * Login with: admin@dev.local / lecturer@dev.local / student@dev.local
 *             (password for all: Password123!)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { buildSessionQrPayload } from "../src/lib/qr";

const prisma = new PrismaClient();

const DEV_PASSWORD = "Password123!";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

async function upsertUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { role: input.role },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    },
  });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const existingCredential = await prisma.authCredential.findUnique({
    where: { userId: user.id },
  });
  if (existingCredential) {
    await prisma.authCredential.update({
      where: { userId: user.id },
      data: { passwordHash },
    });
  } else {
    await prisma.authCredential.create({ data: { userId: user.id, passwordHash } });
  }

  return user;
}

async function main() {
  const campus = await prisma.campus.upsert({
    where: { code: "MC" },
    update: {},
    create: { name: "Main Campus", code: "MC", timezone: "UTC" },
  });

  const building = await prisma.building.upsert({
    where: { code: "MB" },
    update: {},
    create: { campusId: campus.id, name: "Main Building", code: "MB" },
  });

  const room = await prisma.room.upsert({
    where: { code: "R-204" },
    update: {},
    create: {
      buildingId: building.id,
      name: "Main Building - R-204",
      code: "R-204",
      capacity: 40,
      equipment: "Projector",
    },
  });

  const course = await prisma.course.upsert({
    where: { code: "CS101" },
    update: {},
    create: {
      code: "CS101",
      title: "Introduction to Computer Science",
      credits: 3,
      department: "Computing",
    },
  });

  const admin = await upsertUser({
    email: "admin@dev.local",
    firstName: "Ada",
    lastName: "Admin",
    role: "ADMIN",
  });

  const lecturerUser = await upsertUser({
    email: "lecturer@dev.local",
    firstName: "Grace",
    lastName: "Lecturer",
    role: "LECTURER",
  });
  const lecturerProfile = await prisma.lecturerProfile.upsert({
    where: { userId: lecturerUser.id },
    update: {},
    create: { userId: lecturerUser.id, title: "Dr", department: "Computing" },
  });

  const studentUser = await upsertUser({
    email: "student@dev.local",
    firstName: "Sam",
    lastName: "Student",
    role: "STUDENT",
  });
  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: { userId: studentUser.id, studentCode: "ST-0001", yearLevel: 2, programme: "Computer Science" },
  });

  // Active session: today's weekday, started at (or clamped into) the current
  // UTC hour so there is always a scannable session right after seeding.
  const now = new Date();
  const todayName = WEEKDAY_NAMES[now.getUTCDay()];
  const tomorrowName = WEEKDAY_NAMES[(now.getUTCDay() + 1) % 7];
  const startHour = Math.min(Math.max(now.getUTCHours(), 7), 17);

  let activeSession = await prisma.session.findFirst({
    where: { courseId: course.id, day: todayName },
  });
  if (!activeSession) {
    activeSession = await prisma.session.create({
      data: {
        courseId: course.id,
        lecturerId: lecturerProfile.id,
        roomId: room.id,
        day: todayName,
        startTime: startHour,
        endTime: Math.min(startHour + 2, 19),
      },
    });
  }

  let inactiveSession = await prisma.session.findFirst({
    where: { courseId: course.id, day: tomorrowName },
  });
  if (!inactiveSession) {
    inactiveSession = await prisma.session.create({
      data: {
        courseId: course.id,
        lecturerId: lecturerProfile.id,
        roomId: room.id,
        day: tomorrowName,
        startTime: 9,
        endTime: 11,
      },
    });
  }

  const activePayload = buildSessionQrPayload({
    sessionId: activeSession.id,
    roomId: activeSession.roomId,
    roomCode: room.code,
    lecturerId: activeSession.lecturerId,
    startTime: activeSession.startTime,
    endTime: activeSession.endTime,
  });

  console.log("\n✅ Dev seed complete.");
  console.log(`   Admin login:    admin@dev.local / ${DEV_PASSWORD} (id=${admin.id})`);
  console.log(`   Lecturer login: lecturer@dev.local / ${DEV_PASSWORD} (profile id=${lecturerProfile.id})`);
  console.log(`   Student login:  student@dev.local / ${DEV_PASSWORD} (id=${studentUser.id})`);
  console.log(`\n   ACTIVE session  (${todayName} ${activeSession.startTime}:00-${activeSession.endTime}:00 UTC):`);
  console.log(`     id=${activeSession.id}`);
  console.log(`     QR payload: ${activePayload}`);
  console.log(`   INACTIVE session (${tomorrowName} 09:00-11:00 UTC): id=${inactiveSession.id}`);
  console.log(`   Student profile: ${studentProfile.studentCode}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
