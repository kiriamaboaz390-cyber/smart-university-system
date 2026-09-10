# Handoff Prompt: Design of Manual Attendance, Calendar Integration, Student Schedule Visibility, and Late-Attendance Status Policy

> Give this document (or its full text) to the design agent. It contains everything that agent
> needs: project context, hard rules, the exact decisions it must make, the deliverable format,
> and the post-design steps that keep this repository continuous with its established workflow.

---

## 1. Who you are and what you must do

You are designing four features for the **Smart University System** — a Next.js 16.3.3
(App Router, Turbopack) + TypeScript + Prisma (SQLite for dev) prototype. Your job in this
session is **DESIGN ONLY**: produce a decision document and an implementation-ready task
breakdown. Do not modify code, schema, or migrations in this phase. The implementation steps
you write are for the execution agent that will receive your document.

The four features to design (outstanding stakeholder questions from `docs/LIVING_DOC.md`
§9.1 / §8, entry 2026-09-09):

1. **F1 — Manual attendance marking** (stakeholder question Q6)
2. **F2 — Calendar integration** (stakeholder question Q9)
3. **F3 — Student schedule visibility** (stakeholder question Q10)
4. **F4 — Late attendance-status policy** (QR scans currently always record `PRESENT`)

For each feature, your deliverable must contain: the design (data model changes, API surface,
UI surface, permission model, edge cases), a **decision list of ambiguities with a
recommended default** for each (so the stakeholder can veto defaults without answering
everything from scratch), and an ordered, TDD-shaped implementation plan that the execution
agent can follow verbatim.


---

## 2. Read these first (mandatory, in order)

1. `docs/LIVING_DOC.md` — especially: §8 change log (what exists and why), §9.1 open
   questions, §10 (§10.3 scheduling constraints, §10.6 room capacity is strict), §11
   (handover, run/seed/verify commands, §11.4 rules).
2. `AGENTS.md` — Next.js 16 differs from older Next.js. Read the relevant guides under
   `node_modules/next/dist/docs/` before proposing any route handler or server component.
   Route handlers MUST use the Next 16 convention:
   `(req, { params }: { params: Promise<{ id: string }> })` with `const { id } = await params;`.
3. Source of truth for existing patterns you MUST stay consistent with:
   - `prisma/schema.prisma` — note `Session`, `AttendanceRecord` (`sessionId`, `studentId`,
     `status`, `scannedAt`), `TermConfig`, `Holiday` (`date`, optional `endDate`),
     `ExamWindow` (`examStartDate`, `examEndDate`), `AuditLog`, `Notification`,
     `ScheduleChangeRequest`.
   - `src/lib/rbac.ts` — `getUserFromAuthHeader` + `hasRole`. Identity always comes from the
     verified JWT (`user.userId`, `user.role`), never from request bodies.
   - `src/lib/qr.ts` — `buildSessionQrPayload`, `parseQrPayload`,
     `isSessionActiveNow(session, now?, graceMinutes?)` (already supports a grace window
     after the end hour; default grace 15, `0` disables late scans).
   - `src/app/api/qr/scan/route.ts` — the hardened scan endpoint you are extending for F1/F4
     (student-only attendance, duplicate check, audit log on every state change).
   - `src/app/api/qr/generate/route.ts` — lecturer-owned QR generation.
   - `src/app/lecturer/dashboard/page.tsx` and `src/app/student/scanner/` — current UI patterns.
   - `scripts/run-tests.ts` — the test battery style (plain TS assertion suites, no test
     framework). All new pure logic gets a suite here.
   - `src/lib/timetable.ts` and `src/lib/scheduling.ts` — the pure-function constraint style
     to imitate: typed inputs/outputs, no `any`, no I/O, fully unit-testable.

---

## 3. Hard rules the design must obey (LIVING_DOC §11.4, §5, §9.3–§9.6)

- **TDD with evidence**: every feature slice starts with failing tests added to
  `scripts/run-tests.ts` (or a new pure-logic module tested there), captured RED output,
  then implementation, then GREEN. Paste real command results; never claim success without one.
- **Verification battery before any commit** (all four must pass):
  `npx tsx scripts/run-tests.ts && npx tsc --noEmit && npx eslint . && npm run build`
  (`npx eslint .` currently exits 0 with exactly one intentional `<img>` warning in
  `src/components/qr-panel.tsx` — do not "fix" it silently; leave it).

---

## 4. Feature briefs — what to design

### F1 — Manual attendance marking (Q6)

Context today: attendance rows are created ONLY by QR scans
(`src/app/api/qr/scan/route.ts`, action `attend`, student-only, always `status: "PRESENT"`).
There is no way for a lecturer to mark, correct, or backfill attendance.

Design must cover:
- **Who may mark**: the exact permission rule (e.g. lecturer may mark only for their own
  sessions; ADMIN/SUPER_ADMIN may mark for any session; students may never mark).
- **Operations**: create a record for a student who never scanned; correct an existing record
  (change status or scan time); delete an erroneous record. Specify request/response shapes
  and error codes matching existing route style (`missing_fields`, `forbidden`, ...).
- **Status vocabulary**: the schema stores `status` as a free-text string (SQLite
  compatibility). Define the closed set (e.g. `PRESENT`, `ABSENT`, `EXCUSED`, `LATE` —
  `LATE` only if F4 adopts it) as code constants in a new `src/lib/attendance.ts`, not
  scattered literals.
- **Distinguish manual from scans**: recommend additive columns
  `recordedBy String?` (User id) and `recordSource String @default("QR_SCAN")`
  (values `QR_SCAN | MANUAL`). Additive migration is allowed; audit every manual action.
- **UI**: a lecturer-dashboard section to mark attendance for a session's student list,
  consistent with `src/app/lecturer/dashboard/page.tsx` patterns and CSS modules.
- **Enrollment source of truth**: define how "students who should attend" is derived
  (course → studentIds or student-group membership — inspect `schema.prisma`; there is no
  dedicated enrollment table today; flag this as a decision with a recommended default).

### F2 — Calendar integration (Q9)

Context: term structure exists (`TermConfig` with `businessHourStart/End`,
`maxSessionsPerWeek`, `maxUnitsPerSemester`, nested `Holiday` (`date`/`endDate`) and
`ExamWindow` (`examStartDate`/`examEndDate`)); pure helpers `isDateSchedulable`,
`isDateInExamWindows`, `isDateOnHoliday` exist in `src/lib/timetable.ts`.

Design a phased plan:
- **Phase A (no new deps, implement first)**: an ICS feed export, e.g. `GET /api/calendar/ical`
  (Bearer auth; a student gets their own schedule, a lecturer theirs) rendering sessions and
  term dates as an ICS text response. Pure builder `buildIcsCalendar(...)` in a new
  `src/lib/calendar.ts`, TDD-tested in `scripts/run-tests.ts`.
- **Phase B (stakeholder-approval items only, do not implement)**: inbound/outbound sync with
  Google/Microsoft calendars — provider choice, OAuth vs service account, webhook vs polling,
  conflict resolution between external events and internal sessions, rate limits. Written plan
  only.
- Specify: which TermConfig/Session/Holiday/ExamWindow fields feed the calendar; timezone
  strategy (hours are ints 7–19 in schema; `Campus.timezone` exists — recommend UTC storage +
  campus-timezone rendering and note where this surfaces in ICS `DTSTART;TZID=`); and
  change propagation (what a subscribed calendar shows after a schedule change is approved).

### F3 — Student schedule visibility (Q10)

Design must cover:
- **What a student sees**: weekly timetable (day/hours from `Session` rows for the student's
  courses or student group), today's schedule with room/building, upcoming exam windows and
  holidays (reuse `isDateSchedulable` for "is my class on today?").
- **API**: e.g. `GET /api/student/schedule` — student-only via JWT, returns the current
  week's sessions; state explicitly whether read access is audited (recommend: no audit for
  reads unless the stakeholder wants access tracking).
- **UI**: a `/student/schedule` page consistent with `/student/scanner` patterns.
- **Visibility rules**: whether students see lecturer names, other students, or only
  room/time; session `status` filtering (only scheduled sessions; if a "cancelled" concept
  does not exist today, flag it as a decision with a default).

### F4 — Late attendance-status policy

Current behavior: `isSessionActiveNow` accepts scans up to a grace period (default 15 min)

---

## 5. Required deliverable format (write this back, in full)

1. **`docs/LIVING_DOC.md` updates** (do these last):
   - A new §9.x subsection "Feature designs: manual attendance, calendar integration,
     student schedule visibility, late-status policy" containing the four designs.
   - An §8 change-log entry describing the design decisions and their defaults.
   - §11.3 rewritten: the ordered implementation steps for the execution agent, referencing
     the exact test-first steps per slice.
2. **Design decisions table**: for every ambiguity, `Decision | Default chosen | Veto point
   (stakeholder question)`. The execution agent must be able to implement every default
   without asking you anything.
3. **Implementation plan**: ordered vertical slices, each with: failing tests to add (name
   the file, describe the assertions), the implementation files/functions, RBAC and audit-log
   requirements, the verification commands (§3 battery), and the exact commit message.
4. **Explicit "NOT doing" list** to protect scope (no Postgres move, no new dependencies
   without approval, no biometric identity, no payments — per LIVING_DOC §4).

## 6. Working style for the design session

- Ground every design statement in the actual schema and code paths listed in §2; quote file
  paths. Do not invent tables/columns that conflict with `schema.prisma`; where a new
  column/table is needed, mark it clearly as an **additive migration** with the Prisma
  model/field names.
- Design the four features independently but consistently: F4's status vocabulary is what
  F1's manual marking uses; F3's schedule API is what F2's calendar export reads from.
- End the design session by committing ONLY documentation (one `docs:` commit with the
  updated `docs/LIVING_DOC.md` and any new `docs/*.md` design appendix), leaving a clean tree
  for the execution agent.

## 7. Current continuation point (so the design starts from the right place)

- `main` is at `4184588` with a clean tree (only untracked `.vscode/`).
- Delivered and verified: fullName bug fix in user routes; all pre-existing eslint errors
  cleared; timetable constraints in `src/lib/timetable.ts` (`checkRoomCapacity`,
  `findContiguousBlock`, `checkGroupTimeConflict`, `isDateInExamWindows`, `isDateOnHoliday`,
  `isDateSchedulable`, `validateWeeklyCaps`) with 9/9 test suites green; full battery green
  (`tsx tests`, `tsc`, `eslint`, `next build` all exit 0).
- Next implementation work after this design session: wire the constraint functions into API
  endpoints, fix the 13 shim-surfaced lecturer-route type errors and the seed-vs-RBAC admin
  mismatch (see LIVING_DOC §11.3).

after the end hour, and the scan endpoint always writes `status: "PRESENT"`.

Design must cover:
- **D1 — late-classification**: what status a scan recorded after the session's start gets.
  Recommended default to present to the stakeholder: scans after
  `startTime + lateEntryGraceMinutes` (e.g. 10 min after START) record `LATE`; scans later
  than that but within the active window still record and are classified per stakeholder
  choice. Every default is vetoable.
- **D2 — semantics**: whether manual marking (F1) can set `LATE`, and whether `LATE` counts
  as present for reporting (define pure function `isAttendanceCountedPresent(status)`).
- Implementation order: pure logic first (`resolveAttendanceStatus(session, scannedAt,
  graceMinutes)` in `src/lib/`), TDD tests, then wire into `/api/qr/scan` and F1's manual
  endpoint; audit `details` must include the resolved status and the reason.

- **RBAC on every new/changed endpoint** via `src/lib/rbac.ts` (`getUserFromAuthHeader` +
  `hasRole`); identity from the JWT only.
- **Auditability**: every state change (manual mark, status override, calendar sync, visibility
  change, late-scan classification) writes to `prisma.auditLog` with `actorId` from the JWT
  (`user.userId`), an action string, `entityType`, `entityId`, and a JSON `details` string.
- **No secrets in the repo**; `.env` is untracked. Calendar integrations (F2) read credentials
  from env vars only; the design must state exactly which env vars are needed (added to local
  `.env` only, never committed).
- **Database**: SQLite via Prisma, `prisma/dev.db` (gitignored). Schema changes are allowed as
  **additive** columns/tables/indexes; no destructive migrations without explicit stakeholder
  approval. Postgres is explicitly out of scope until the stakeholder asks. Keep the existing
  SQLite-compatibility pattern: string fields instead of enums.
- **No new dependencies** without explicit stakeholder approval. Current deps: next 16.3.3,
  react 19, @prisma/client 5.22, prisma 5.22, bcryptjs 3, jsonwebtoken 9, jsqr 1.4,
  qrcode 1.5, tsx, typescript 5, eslint 9. If a calendar SDK seems unavoidable for F2, design
  against plain HTTPS endpoints with `fetch` first and list the SDK as an approval item.
- **Commits**: atomic Conventional Commits on `main` (`feat:`/`fix:`/`docs:`/`test:`/`chore:`),
  one slice at a time; update `docs/LIVING_DOC.md` (§6 status, §8 change log, §11 handover)
  with each slice. Do not modify the agent-rules block in `AGENTS.md`.
- **Pure-function preference**: all policy logic (late thresholds, status transitions,
  visibility rules) lives in pure exported functions in `src/lib/` with tests, mirroring
  `src/lib/timetable.ts` / `src/lib/scheduling.ts` / `src/lib/qr.ts`.
