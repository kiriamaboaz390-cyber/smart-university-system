CSV templates for bulk import into the Smart University System.

Placement: `docs/templates/`

Each CSV contains a header row and a sample row. Use UTF-8 without BOM. Time fields (startTime/endTime) are hour integers in 24h format (e.g., 7, 9, 13). Sessions should conform to the 2-hour slot rule (endTime = startTime + 2).

Templates included:
- users.csv
- students.csv
- lecturers.csv
- rooms.csv
- courses.csv
- sessions.csv

Import notes:
- `userEmail` is used to link `Student`/`Lecturer` rows to existing or new `User` records.
- Role must be one of: SUPER_ADMIN, HR_ADMIN, ADMIN, LECTURER, STUDENT
- Room `code` must be unique and `capacity` is a positive integer.
- For sessions, `day` should be one of: Mon,Tue,Wed,Thu,Fri and `type` one of: LECTURE,TUTORIAL,LAB,SEMINAR,EXAM
- CSV import endpoints will validate strict room capacity and enforce optimistic conflict checks.
