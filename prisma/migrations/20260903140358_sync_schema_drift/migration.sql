/*
  Warnings:

  - You are about to drop the column `year` on the `StudentGroup` table. All the data in the column will be lost.
  - You are about to drop the column `examEnd` on the `TermConfig` table. All the data in the column will be lost.
  - You are about to drop the column `examStart` on the `TermConfig` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `TermConfig` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `StudentGroup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yearLevel` to the `StudentGroup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termName` to the `TermConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TermConfig` table without a default value. This is not possible if the table is not empty.
  - Made the column `campusId` on table `TermConfig` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "ExamWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "termConfigId" TEXT NOT NULL,
    "examStartDate" DATETIME NOT NULL,
    "examEndDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamWindow_termConfigId_fkey" FOREIGN KEY ("termConfigId") REFERENCES "TermConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "termConfigId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "endDate" DATETIME,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holiday_termConfigId_fkey" FOREIGN KEY ("termConfigId") REFERENCES "TermConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "proposedRoomId" TEXT,
    "proposedStartTime" INTEGER,
    "proposedEndTime" INTEGER,
    "proposedDay" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "requiresManualApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleChangeRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChangeRequest_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "LecturerProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChangeRequest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OverrideApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "superAdminId" TEXT NOT NULL,
    "proposedChangeDescription" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "hrDecision" TEXT,
    "hrRespondedAt" DATETIME,
    "autoApprovedAt" DATETIME,
    "autoApprovalReason" TEXT NOT NULL DEFAULT 'No response from Human Resource',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OverrideApprovalRequest_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campusId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Building_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Building" ("campusId", "code", "id", "name") SELECT "campusId", "code", "id", "name" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
CREATE UNIQUE INDEX "Building_code_key" ON "Building"("code");
CREATE TABLE "new_Campus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Campus" ("code", "createdAt", "id", "name") SELECT "code", "createdAt", "id", "name" FROM "Campus";
DROP TABLE "Campus";
ALTER TABLE "new_Campus" RENAME TO "Campus";
CREATE UNIQUE INDEX "Campus_code_key" ON "Campus"("code");
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Course_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("code", "credits", "department", "id", "title") SELECT "code", "credits", "department", "id", "title" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");
CREATE TABLE "new_LecturerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LecturerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LecturerProfile" ("department", "id", "title", "userId") SELECT "department", "id", "title", "userId" FROM "LecturerProfile";
DROP TABLE "LecturerProfile";
ALTER TABLE "new_LecturerProfile" RENAME TO "LecturerProfile";
CREATE UNIQUE INDEX "LecturerProfile_userId_key" ON "LecturerProfile"("userId");
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "equipment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("buildingId", "capacity", "code", "equipment", "id", "name", "status") SELECT "buildingId", "capacity", "code", "equipment", "id", "name", "status" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");
CREATE TABLE "new_StudentGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programme" TEXT NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StudentGroup" ("createdAt", "id", "name", "programme") SELECT "createdAt", "id", "name", "programme" FROM "StudentGroup";
DROP TABLE "StudentGroup";
ALTER TABLE "new_StudentGroup" RENAME TO "StudentGroup";
CREATE TABLE "new_StudentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "programme" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudentProfile" ("groupId", "id", "programme", "studentCode", "userId", "yearLevel") SELECT "groupId", "id", "programme", "studentCode", "userId", "yearLevel" FROM "StudentProfile";
DROP TABLE "StudentProfile";
ALTER TABLE "new_StudentProfile" RENAME TO "StudentProfile";
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
CREATE UNIQUE INDEX "StudentProfile_studentCode_key" ON "StudentProfile"("studentCode");
CREATE TABLE "new_TermConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campusId" TEXT NOT NULL,
    "termName" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "businessHourStart" INTEGER NOT NULL DEFAULT 7,
    "businessHourEnd" INTEGER NOT NULL DEFAULT 19,
    "maxSessionsPerWeek" INTEGER NOT NULL DEFAULT 18,
    "maxUnitsPerSemester" INTEGER NOT NULL DEFAULT 8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TermConfig_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TermConfig" ("campusId", "createdAt", "endDate", "id", "startDate") SELECT "campusId", "createdAt", "endDate", "id", "startDate" FROM "TermConfig";
DROP TABLE "TermConfig";
ALTER TABLE "new_TermConfig" RENAME TO "TermConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
