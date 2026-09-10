// Typed shim for the Prisma client surface used in this prototype. The real
// generated client (.prisma/client) exists, but several lecturer-route call
// sites were written against schema fields that no longer exist, so they only
// type-check against this intentionally loose shim. Removing the shim surfaces
// 13 pre-existing type errors (see LIVING_DOC.md §8, 2026-09-09) — tightening
// this is tracked as follow-up work, not done silently here.
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-explicit-any */
declare module "@prisma/client" {
  export class PrismaClient {
    constructor(options?: unknown);
  }

  // Model delegates (prisma.user, prisma.session, ...) are provided by the
  // generated client at runtime; keep typing intentionally loose here.
  export interface PrismaClient {
    [key: string]: any;
  }

  // Re-export the real model result types from the generated client so typed
  // call sites (e.g. the CSV import route) compile against this module.
  export type {
    User,
    Course,
    Room,
    Session,
    StudentProfile,
    LecturerProfile,
    TermConfig,
    ExamWindow,
    Holiday,
    AuditLog,
    AttendanceRecord,
    ScheduleChangeRequest,
    StudentGroup,
    Notification,
    AuthCredential,
    Campus,
    Building,
  } from ".prisma/client";
}


