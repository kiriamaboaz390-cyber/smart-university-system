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

### 9.8 Answers provided by stakeholder
- Timetable visualizer: combine calendar week view + Gantt timeline features (both).  
- CSV imports: all templates mandatory; HR-managed user creation and groups required before student assignment.  
- Student groups: defined by `programme + year`, editable only by HR.  
- Term configuration: Admin UI should be built to set term start/end, holidays, and exam timelines.  
- Lecturer change requests: auto-approve if no conflicts; require Admin approval if conflicts.  
- Notifications: both in-app and email (SMTP details provided later).  
- Overrides: SuperAdmin cannot unilaterally override immediately — must wait 48 hours for HR response; if no response, SuperAdmin may override and an audit entry noting "No response from Human Resource" is recorded.  
- Exam timelines: configured as part of TermConfig by Admin.  
- Rooms: capacity plus equipment labels; room naming tied to building.  
- Timetable generation cadence: both on-demand and batch (nightly) supported.  
- Timezone handling: store timestamps in UTC and display in campus-local timezone.  
- Bulk change requests: HR Admin can upload CSVs of change requests for review.  
- Accessibility: visualizer must be keyboard-navigable and screen-reader friendly.  
- Single-person operation: Admin can create full semester timetable from CSVs and a guided form.

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


## 10. Confirmed decisions on architecture and workflows (responses to 14 clarifying questions)

### 10.1 UI and visualization
- Timetable visualizer combines week calendar and Gantt timeline views with unified conflict highlighting.
- Visualizer is keyboard-navigable and screen-reader friendly (WCAG 2.1 AA).
- Lecturer drag/drop room/time changes initiate proposal workflow (auto-approve if no conflicts, require Admin approval if conflicts).

### 10.2 User onboarding and roles
- HR Admin form captures: name, email, role, department (minimum). Students must belong to pre-created group.
- Student groups defined by programme+year, editable by HR Admin only after creation.
- No self-registration except Student (HR Admin creates all staff); SuperAdmin creates the first HR Admin.
- SuperAdmin can edit details, but role changes require HR Admin + SuperAdmin approval (48-hour timeout with auto-fallback).

### 10.3 Scheduling constraints and term configuration
- Business hours: 07:00–19:00, Mon–Fri only (configurable per campus in TermConfig).
- Session slots: fixed 2-hour increments; students max 18 sessions/week; max 8 units/semester per group.
- Term configuration built via Admin UI: term start/end dates, holiday blackout dates, exam windows per campus.
- Exams are part of TermConfig; Admin sets exam timeline windows and room allocations per course.

### 10.4 Change workflows and approvals
- Lecturer-initiated room/time changes: auto-approve if no conflicts; require Admin approval if conflicts exist.
- SuperAdmin overrides require HR approval workflow with 48-hour timeout. If HR declines, reason provided. If no response for 48h, auto-grant with "No response from Human Resource" reason.
- HR Admin can bulk upload change requests via CSV for review.

### 10.5 Notifications and audit
- Notifications: in-app + email (SMTP credentials provided separately for production).
- All changes logged in AuditLog with actor, timestamp, details, and retention policy of 1 year.
- Approval workflow notifications sent to relevant roles (Admin, HR, SuperAdmin).

### 10.6 Rooms and equipment
- Rooms have capacity (enforced strictly) and equipment labels (e.g., "Projector, Lab Benches").
- Room names include building prefix (e.g., "Main Building - R-204").
- Rooms created via import CSV or admin UI with building/equipment assignment.

### 10.7 Timetable generation performance
- On-demand generation when Admin submits form or changes occur.
- Nightly batch generation via cron (scheduling, conflict detection, exam allocation).
- Optimistic locking prevents race conditions on concurrent allocation requests.

### 10.8 Timezone handling and bulk operations
- All timestamps stored in UTC; UI displays campus-local time based on user's campus.
- HR Admin can upload CSV of change requests for bulk review before applying.

### 10.9 Single-person workflow
- One Admin user can create a full semester timetable from CSVs (courses, lecturers, students, rooms) and a guided form (term dates, constraints).
- Guided form walks Admin through: import CSVs → set business hours → define holidays → set exam windows → generate timetable → review conflicts → approve.

This document should be updated whenever architecture, constraints, or implementation status changes.
