# Smart University System — Living Design and Delivery Document

## 1. Context and reason for building

This project is being created from a blank state in a repository that previously contained only a placeholder README. The goal is to design and implement a practical smart university platform starting from a clear core: room allocation, deallocation and live tracking with QR-based attendance, and a timetable engine that handles semester and exam scheduling with conflict prevention.

The team is moving from an initial discovery phase into a working prototype that proves the architecture, role model, scheduling logic, and user workflows without overbuilding too early. The near-term objective is to create a usable baseline that can evolve into a production system with real database persistence, authentication, and operational workflows.

## 2. Current project direction

### Product goal
An institution-grade system for:
- smart room allocation and tracking in real time
- QR-based class and room check-in/check-out
- role-based institutional workflows
- timetable generation for semester and exam periods
- conflict mitigation for lecturers, students, rooms, and courses

### Initial scope
- SuperAdmin: oversight and audit visibility across system actions
- HR Admin: people and onboarding workflows
- Admin: academic configuration and operational controls
- Lecturer: sessions, attendance, and class management
- Student: timetable, learning details, QR attendance, room visibility

## 3. Requirements and agreed decisions

### Decisions captured from the discovery session
- Stack: Next.js + TypeScript + Postgres + Prisma
- Institution model: multi-campus / multi-institution capable system
- Role model: full RBAC with approval-based provisioning
- QR flow: hybrid model using both room and lesson/session QR triggers
- Scheduling scope: semester timetable + exam timetable + conflict detection
- Deployment target: local development-first and cloud deployable

## 4. Constraints we intentionally will not do at this stage

These are design constraints we are intentionally not solving in the initial build, with reasons:

1. We will not attempt a full multi-tenant production deployment on day one.
   Reason: the prototype must first validate the core domain logic and workflows before scaling infrastructure.

2. We will not build full biometric identity validation in the first version.
   Reason: this introduces privacy, legal, and compliance complexity that should be handled after core user workflows are stable.

3. We will not integrate payment or fee collection features yet.
   Reason: finance and billing are separate domain concerns and not required for the core academic operations being validated.

4. We will not implement a complete offline/mobile app experience in the first release.
   Reason: the first milestone is to prove the scheduling and room-tracking logic, not to overinvest in platform-specific mobile engineering.

5. We will not rely on hard-coded production data as if it were live system state.
   Reason: all key business logic must be validated through testable domain rules, not static assumptions.

## 5. Engineering principles followed

- Test-Driven Development (TDD): write a failing test, make it pass, then refactor.
- Evidence-based validation: every claim about completion is backed by a fresh command result.
- Small iterative delivery: build a functioning slice first, then extend it.
- Explicit RBAC: every workflow must be role-aware and auditable.
- Security by default: user actions and access boundaries must be clear and constrained.
- Documentation as code: project decisions and status updates are captured in this living document.
- Simplicity before complexity: prioritize the critical flows before advanced automation.

## 6. Current implementation status

### Implemented
- Next.js project scaffold is live
- initial design direction and requirements are captured
- scheduling logic for room conflicts and timetable generation is being created with tests
- project documentation is in place

### In progress
- timetable engine with semester and exam conflict handling
- room allocation and deallocation logic
- QR attendance payload design
- dashboard and role-based view shell

### Planned next
- add persistence layer with Prisma and Postgres
- add authentication and role gating
- add admin workflows and campus/room management
- expose end-to-end lesson attendance and timetable editing flows

## 7. Technical design notes

### Scheduling assumptions
The prototype uses a practical rule set:
- a room cannot host overlapping classes
- a lecturer cannot be booked for overlapping sessions
- a student cannot be assigned to conflicting courses in the same time slot
- a session must fit within a valid day and time range
- exam blocks must respect room and lecturer availability constraints

### QR system assumptions
- QR payloads carry session identifiers and room identifiers
- scans can be validated against active time windows
- attendance is recorded as check-in/check-out events
- a valid lecture session should generate a unique QR code linked to the schedule

## 8. Change log

- 2026-08-30: initial project scaffold created
- 2026-08-30: requirements clarified with six discovery questions
- 2026-08-30: documented project context, constraints, and engineering principles
- 2026-08-30: TDD workflow started with failing scheduling tests

This document should be updated whenever architecture, constraints, or implementation status changes.

## 9. Action plan, open questions, hard constraints, and commit pattern

### 9.1 Immediate open questions (please answer these)
- Q1: Do you want email/password auth only for MVP, or also invite-based onboarding for staff? (Recommended: both, start with email/password + invite)
- Q2: For CSV imports, which CSVs must be supported first? (Users, Students, Lecturers, Rooms, Courses, Sessions — pick mandatory subset)
- Q3: Acceptable business hours and time resolution? (e.g., 07:00–20:00, slots in 30-minute increments)
- Q4: Room capacity enforcement — strictly enforced or advisory for automated allocation?
- Q5: Audit retention policy for attendance and logs (e.g., 1 year, 5 years, indefinite)?
- Q6: Do lecturers need the ability to manually mark attendance in addition to QR scans?
- Q7: Do you prefer optimistic or pessimistic locking for concurrent room allocations? (optimistic with conflict detection recommended)

### 9.2 Additional clarifying questions (optional but helpful)
- Q8: Preferred time zone handling — store UTC and present in local campus timezone? (recommended)
- Q9: Any third-party calendar integrations (Google Calendar, Outlook) required initially?
- Q10: Should students see only their enrolled sessions or the full course schedule?

### 9.3 Hard constraints (things we will NOT do) and rationale
- No secrets or credentials in the repository — prevents accidental leaks and enforces secure deployment.
- No destructive DB migrations without explicit approval and a migration plan — prevents data loss during development.
- No native mobile app for MVP — single web/PWA QR experience is sufficient and faster to deliver.
- No direct production deployment or cloud credential changes without your approval — ensures control over production.

### 9.4 Coding and process principles (TDD + complementary principles)
- Test-Driven Development (TDD): write unit and integration tests before implementing features; maintain a failing->passing workflow.
- Type safety & linting: strict TypeScript checks, `tsconfig` strict mode, and `eslint` enforced in CI.
- Modular services: separate modules for `auth`, `rooms`, `timetable`, `attendance`, `csv-import`, and `audit`.
- Single source of truth: `Prisma` schema as canonical model; migrations via Prisma Migrate.
- RBAC middleware: centralize authorization checks via a middleware layer used by API routes and server components.
- CI automation: tests, lint, and migration checks run on every PR.
- Incremental delivery: ship small vertical slices (API, DB, UI) with tests per slice.

### 9.5 Execution plan (systematic, parallel tracks)
We will run parallel tracks that converge each sprint (2-week cadence):

- Track A — Core infra & auth
   1. Set up Postgres dev instance and Prisma migrations skeleton.
   2. Implement simple email/password auth + invite flow and RBAC scaffolding.
   3. Add `User`, `LecturerProfile`, `StudentProfile` CRUD APIs and CSV import endpoints.

- Track B — Room allocation & QR attendance
   1. Implement room CRUD and availability API (`findAvailableRooms` exists; add persistence).
   2. Implement QR generator for sessions and server-side QR validation endpoint.
   3. Implement attendance recording with audit logs and concurrency checks.

- Track C — Timetabling engine
   1. Expand `src/lib/timetable.ts` with constraint rules (capacity, contiguous slots, student conflicts).
   2. Add exam timetable generator that respects multi-day exam windows and lecturer constraints.
   3. Provide API endpoints for generating and validating suggested timetables.

- Track D — UI and role-based flows
   1. Add pages for SuperAdmin/HR/Admin/Lecturer/Student shells.
   2. Integrate QR scan UI using browser camera (WebRTC) and QR payload validation.
   3. Add timetable visualizer with drag/drop (future) and conflict highlighting.

Each sprint we will merge one small vertical slice from these tracks, run tests, and update this document.

### 9.6 Commit and branching pattern (enforced via CI)
- Branching: `main` protected, `develop` for daily integration, feature branches `feature/<short-desc>` off `develop`.
- Commits: atomic and scoped; use Conventional Commits format: `feat:`, `fix:`, `chore:`, `docs:`, `test:`. Example: `feat(timetable): add semester slot generator`.
- PRs: open PRs from `feature/*` to `develop` with linked ticket and at least one reviewer. Include test results and a short manual QA checklist.
- Reviews: require 1 review and passing CI (tests + lint) before merge.
- Releases: `main` receives release merges from `develop` only; tags follow `vMAJOR.MINOR.PATCH`.
- Enforce via CI: `pre-merge` checks for lint, tests, schema drift, and commit message linting.

### 9.7 Next immediate actions (I'll perform after your answers)
1. Run the test suite and report failures.  
2. Add a baseline `auth` scaffold (email/password + invite) and RBAC middleware.  
3. Persist `findAvailableRooms` to Prisma and implement CSV import endpoints for `rooms` and `users`.  
4. Implement QR generation endpoint and a simple scanner page that writes `AttendanceRecord` entries.  
5. Extend `src/lib/timetable.ts` with more constraints and add tests.

