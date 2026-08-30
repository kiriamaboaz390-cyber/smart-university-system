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
