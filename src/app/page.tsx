import QRAttendancePanel from "@/components/qr-panel";

const roleCards = [
  { role: "SuperAdmin", summary: "Oversee activities, audits, and platform health." },
  { role: "HR Admin", summary: "Manage staff onboarding, profiles, and user governance." },
  { role: "Admin", summary: "Handle academic operations, rooms, and scheduling." },
  { role: "Lecturer", summary: "Start sessions, end sessions, and mark attendance." },
  { role: "Student", summary: "View timetable, scan QR, and check available rooms." },
];

const metrics = [
  { label: "Active rooms", value: "24" },
  { label: "Lecturers", value: "118" },
  { label: "Students", value: "4,280" },
  { label: "Live sessions", value: "19" },
];

const timetable = [
  { day: "Mon", time: "09:00 - 11:00", course: "CS101", room: "R-204", lecturer: "Dr. Kibet" },
  { day: "Tue", time: "11:00 - 13:00", course: "BUS202", room: "R-101", lecturer: "Prof. Achieng" },
  { day: "Wed", time: "13:00 - 15:00", course: "MTH210", room: "R-305", lecturer: "Dr. Limo" },
  { day: "Thu", time: "15:00 - 17:00", course: "ENG110", room: "R-118", lecturer: "Mr. Otieno" },
];

export default function Home() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Smart University System</p>
          <h1>Academic operations, room tracking, and timetabling in one place</h1>
        </div>
        <button type="button" className="primary-button">Open dashboard</button>
      </header>

      <section className="hero-grid">
        <div className="hero-card">
          <p className="eyebrow">Operational overview</p>
          <h2>Institution intelligence for live academic management</h2>
          <p>
            Smart room allocation, live deallocation tracking, QR-based attendance, and conflict-aware
            timetabling all work together to keep a semester fully organized.
          </p>
        </div>

        <div className="stats-grid">
          {metrics.map((metric) => (
            <div className="stat-card" key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="roles-section">
        <div className="section-heading">
          <p className="eyebrow">Role model</p>
          <h3>Institution roles and responsibilities</h3>
        </div>

        <div className="role-grid">
          {roleCards.map((card) => (
            <article className="role-card" key={card.role}>
              <span className="role-badge">{card.role}</span>
              <p>{card.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <div className="panel timetable-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Timetable</p>
              <h3>Semester overview</h3>
            </div>
            <span className="status-pill info">Conflict-aware</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Room</th>
                <th>Lecturer</th>
              </tr>
            </thead>
            <tbody>
              {timetable.map((entry) => (
                <tr key={`${entry.day}-${entry.course}`}>
                  <td>{entry.day}</td>
                  <td>{entry.time}</td>
                  <td>{entry.course}</td>
                  <td>{entry.room}</td>
                  <td>{entry.lecturer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <QRAttendancePanel />
      </section>
    </main>
  );
}
