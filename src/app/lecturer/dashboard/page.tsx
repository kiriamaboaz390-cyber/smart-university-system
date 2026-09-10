"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

interface Session {
  id: string;
  courseId: string;
  roomId: string;
  sessionDate: string;
  startTime: number;
  endTime: number;
  room?: { name: string; building?: string };
  course?: { code: string; name: string };
}

interface ChangeRequest {
  id: string;
  sessionId: string;
  status: string;
  proposedRoomId?: string;
  proposedStartTime?: number;
  proposedEndTime?: number;
  reason: string;
  createdAt: string;
  session?: Session;
}

export default function LecturerDashboard() {
  const { user, token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeFormData, setChangeFormData] = useState({
    proposedRoomId: "",
    proposedStartTime: "",
    proposedEndTime: "",
    reason: "",
  });

  // Permission check is derived during render instead of an effect.
  const permissionError =
    user && user.role !== "LECTURER" ? "Only lecturers can access this page" : null;

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [sessionsRes, requestsRes] = await Promise.all([
          fetch("/api/lecturer/sessions", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/lecturer/schedule-change-requests", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!sessionsRes.ok || !requestsRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const sessionsData = await sessionsRes.json();
        const requestsData = await requestsRes.json();

        setSessions(sessionsData.sessions || []);
        setChangeRequests(requestsData.requests || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleStartSession = async (sessionId: string) => {
    if (!token) {
      setError("Not authenticated");
      return;
    }

    try {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Create QR payload
      const payload = `session=${sessionId};lecturer=${user?.id};room=${session.roomId}`;

      // Call the QR scan endpoint with action="start"
      const res = await fetch("/api/qr/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payload,
          action: "start",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start session");
      }

      setSuccess("Session started successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error starting session");
    }
  };

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !token) return;

    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/lecturer/schedule-change-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          proposedRoomId: changeFormData.proposedRoomId || undefined,
          proposedStartTime: changeFormData.proposedStartTime ? parseInt(changeFormData.proposedStartTime) : undefined,
          proposedEndTime: changeFormData.proposedEndTime ? parseInt(changeFormData.proposedEndTime) : undefined,
          reason: changeFormData.reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit change request");
      }

      const newRequest = await res.json();
      setChangeRequests([newRequest, ...changeRequests]);
      setShowChangeForm(false);
      setSelectedSession(null);
      setChangeFormData({
        proposedRoomId: "",
        proposedStartTime: "",
        proposedEndTime: "",
        reason: "",
      });
      setSuccess("Change request submitted successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting request");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  if (permissionError) {
    return <div className={styles.error}>{permissionError}</div>;
  }

  return (
    <div className={styles.container}>
      <h1>Lecturer Dashboard</h1>

      {error && <div className={styles.alert + " " + styles.error}>{error}</div>}
      {success && <div className={styles.alert + " " + styles.success}>{success}</div>}

      {loading ? (
        <div>Loading sessions...</div>
      ) : (
        <>
          <div className={styles.section}>
            <h2>My Sessions</h2>
            {sessions.length === 0 ? (
              <p>No sessions assigned</p>
            ) : (
              <div className={styles.sessionsList}>
                {sessions.map((session) => (
                  <div key={session.id} className={styles.sessionCard}>
                    <div className={styles.sessionHeader}>
                      <h3>{session.course?.code || "Unknown Course"}</h3>
                      <span className={styles.date}>{formatDate(session.sessionDate)}</span>
                    </div>
                    <p>
                      <strong>Time:</strong> {formatTime(session.startTime)} - {formatTime(session.endTime)}
                    </p>
                    <p>
                      <strong>Room:</strong> {session.room?.name || "Unknown"}{" "}
                      {session.room?.building && `(${session.room.building})`}
                    </p>
                    <div className={styles.actions}>
                      <button
                        onClick={() => handleStartSession(session.id)}
                        className={styles.primaryBtn}
                      >
                        Start Session
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSession(session);
                          setShowChangeForm(true);
                        }}
                        className={styles.secondaryBtn}
                      >
                        Request Change
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showChangeForm && selectedSession && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <h2>Request Schedule Change</h2>
                <p>Session: {selectedSession.course?.code}</p>
                <form onSubmit={handleRequestChange}>
                  <div className={styles.formGroup}>
                    <label htmlFor="reason">Reason for Change</label>
                    <textarea
                      id="reason"
                      value={changeFormData.reason}
                      onChange={(e) => setChangeFormData({ ...changeFormData, reason: e.target.value })}
                      placeholder="Explain why you need this change"
                      rows={3}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="proposedRoomId">Proposed Room ID (optional)</label>
                    <input
                      id="proposedRoomId"
                      type="text"
                      value={changeFormData.proposedRoomId}
                      onChange={(e) => setChangeFormData({ ...changeFormData, proposedRoomId: e.target.value })}
                      placeholder="e.g., R-101"
                    />
                  </div>

                  <div className={styles.row}>
                    <div className={styles.formGroup}>
                      <label htmlFor="proposedStartTime">Proposed Start Time (hour, optional)</label>
                      <input
                        id="proposedStartTime"
                        type="number"
                        min="7"
                        max="17"
                        value={changeFormData.proposedStartTime}
                        onChange={(e) => setChangeFormData({ ...changeFormData, proposedStartTime: e.target.value })}
                        placeholder="7-17"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="proposedEndTime">Proposed End Time (hour, optional)</label>
                      <input
                        id="proposedEndTime"
                        type="number"
                        min="9"
                        max="19"
                        value={changeFormData.proposedEndTime}
                        onChange={(e) => setChangeFormData({ ...changeFormData, proposedEndTime: e.target.value })}
                        placeholder="9-19"
                      />
                    </div>
                  </div>

                  <div className={styles.formActions}>
                    <button type="submit" className={styles.primaryBtn}>
                      Submit Request
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangeForm(false);
                        setSelectedSession(null);
                      }}
                      className={styles.secondaryBtn}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h2>Schedule Change Requests</h2>
            {changeRequests.length === 0 ? (
              <p>No change requests submitted</p>
            ) : (
              <div className={styles.requestsList}>
                {changeRequests.map((request) => (
                  <div key={request.id} className={styles.requestCard}>
                    <div className={styles.requestHeader}>
                      <h3>{request.session?.course?.code || "Unknown"}</h3>
                      <span className={`${styles.status} ${styles[request.status.toLowerCase()]}`}>
                        {request.status}
                      </span>
                    </div>
                    <p>
                      <strong>Requested:</strong> {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                    {request.reason && (
                      <p>
                        <strong>Reason:</strong> {request.reason}
                      </p>
                    )}
                    {request.proposedRoomId && (
                      <p>
                        <strong>Proposed Room:</strong> {request.proposedRoomId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
