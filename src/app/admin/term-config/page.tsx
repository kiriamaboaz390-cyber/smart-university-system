"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

interface Holiday {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface ExamWindow {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface TermConfig {
  id: string;
  termName: string;
  startDate: string;
  endDate: string;
  businessHourStart: number;
  businessHourEnd: number;
  maxSessionsPerWeek: number;
  maxUnitsPerSemester: number;
  holidays: Holiday[];
  examWindows: ExamWindow[];
}

export default function TermConfigPage() {
  const { user, token } = useAuth();
  const [configs, setConfigs] = useState<TermConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    termName: "",
    startDate: "",
    endDate: "",
    businessHourStart: 7,
    businessHourEnd: 19,
    maxSessionsPerWeek: 18,
    maxUnitsPerSemester: 8,
    holidays: [] as Holiday[],
    examWindows: [] as ExamWindow[],
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Permission check is derived during render instead of an effect so the
  // message updates with `user` without a cascading render.
  const permissionError =
    user && !["ADMIN", "SUPER_ADMIN"].includes(user.role)
      ? "You do not have permission to access this page"
      : null;

  useEffect(() => {
    if (!token) return;

    const fetchConfigs = async () => {
      try {
        const res = await fetch("/api/term-config", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch term configs");
        const data: Array<{
          id: string;
          termName: string;
          startDate: string;
          endDate: string;
          businessHourStart: number;
          businessHourEnd: number;
          maxSessionsPerWeek: number;
          maxUnitsPerSemester: number;
          holidays: Array<{ id?: string; name: string; date: string; endDate: string | null }>;
          examWindows: Array<{ id?: string; name: string; examStartDate: string; examEndDate: string }>;
        }> = await res.json();
        setConfigs(data.map((c) => ({
          ...c,
          startDate: new Date(c.startDate).toISOString().split("T")[0],
          endDate: new Date(c.endDate).toISOString().split("T")[0],
          holidays: c.holidays.map((h) => ({
            id: h.id,
            name: h.name,
            startDate: new Date(h.date).toISOString().split("T")[0],
            endDate: new Date(h.endDate ?? h.date).toISOString().split("T")[0],
          })),
          examWindows: c.examWindows.map((e) => ({
            id: e.id,
            name: e.name,
            startDate: new Date(e.examStartDate).toISOString().split("T")[0],
            endDate: new Date(e.examEndDate).toISOString().split("T")[0],
          })),
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading configs");
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, [token]);

  const handleAddHoliday = () => {
    setFormData({
      ...formData,
      holidays: [...formData.holidays, { name: "", startDate: "", endDate: "" }],
    });
  };

  const handleAddExamWindow = () => {
    setFormData({
      ...formData,
      examWindows: [...formData.examWindows, { name: "", startDate: "", endDate: "" }],
    });
  };

  const handleRemoveHoliday = (index: number) => {
    setFormData({
      ...formData,
      holidays: formData.holidays.filter((_, i) => i !== index),
    });
  };

  const handleRemoveExamWindow = (index: number) => {
    setFormData({
      ...formData,
      examWindows: formData.examWindows.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Not authenticated");
      return;
    }

    if (!formData.termName || !formData.startDate || !formData.endDate) {
      setError("Missing required fields");
      return;
    }

    try {
      const url = editingId ? `/api/term-config/${editingId}` : "/api/term-config";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          holidays: formData.holidays.filter((h) => h.name && h.startDate && h.endDate),
          examWindows: formData.examWindows.filter((e) => e.name && e.startDate && e.endDate),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save term config");
      }

      const saved = await res.json();
      if (editingId) {
        setConfigs(configs.map((c) => (c.id === editingId ? saved : c)));
      } else {
        setConfigs([...configs, saved]);
      }

      setFormData({
        termName: "",
        startDate: "",
        endDate: "",
        businessHourStart: 7,
        businessHourEnd: 19,
        maxSessionsPerWeek: 18,
        maxUnitsPerSemester: 8,
        holidays: [],
        examWindows: [],
      });
      setEditingId(null);
      setShowForm(false);
      setSuccess("Term config saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving term config");
    }
  };

  if (permissionError) {
    return <div className={styles.error}>{permissionError}</div>;
  }

  return (
    <div className={styles.container}>
      <h1>Term Configuration</h1>

      {error && <div className={styles.alert + " " + styles.error}>{error}</div>}
      {success && <div className={styles.alert + " " + styles.success}>{success}</div>}

      {loading ? (
        <div>Loading term configs...</div>
      ) : (
        <>
          <button onClick={() => setShowForm(!showForm)} className={styles.primaryBtn}>
            {showForm ? "Cancel" : "Create New Term"}
          </button>

          {showForm && (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="termName">Term Name</label>
                <input
                  id="termName"
                  type="text"
                  required
                  value={formData.termName}
                  onChange={(e) => setFormData({ ...formData, termName: e.target.value })}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="startDate">Start Date</label>
                  <input
                    id="startDate"
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="endDate">End Date</label>
                  <input
                    id="endDate"
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="businessHourStart">Business Hour Start</label>
                  <input
                    id="businessHourStart"
                    type="number"
                    min="0"
                    max="23"
                    value={formData.businessHourStart}
                    onChange={(e) => setFormData({ ...formData, businessHourStart: parseInt(e.target.value) })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="businessHourEnd">Business Hour End</label>
                  <input
                    id="businessHourEnd"
                    type="number"
                    min="0"
                    max="23"
                    value={formData.businessHourEnd}
                    onChange={(e) => setFormData({ ...formData, businessHourEnd: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="maxSessionsPerWeek">Max Sessions Per Week</label>
                  <input
                    id="maxSessionsPerWeek"
                    type="number"
                    min="1"
                    value={formData.maxSessionsPerWeek}
                    onChange={(e) => setFormData({ ...formData, maxSessionsPerWeek: parseInt(e.target.value) })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="maxUnitsPerSemester">Max Units Per Semester</label>
                  <input
                    id="maxUnitsPerSemester"
                    type="number"
                    min="1"
                    value={formData.maxUnitsPerSemester}
                    onChange={(e) => setFormData({ ...formData, maxUnitsPerSemester: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <h3>Holidays</h3>
              {formData.holidays.map((holiday, idx) => (
                <div key={idx} className={styles.subForm}>
                  <input
                    type="text"
                    placeholder="Holiday name"
                    value={holiday.name}
                    onChange={(e) => {
                      const updated = [...formData.holidays];
                      updated[idx].name = e.target.value;
                      setFormData({ ...formData, holidays: updated });
                    }}
                  />
                  <input
                    type="date"
                    value={holiday.startDate}
                    onChange={(e) => {
                      const updated = [...formData.holidays];
                      updated[idx].startDate = e.target.value;
                      setFormData({ ...formData, holidays: updated });
                    }}
                  />
                  <input
                    type="date"
                    value={holiday.endDate}
                    onChange={(e) => {
                      const updated = [...formData.holidays];
                      updated[idx].endDate = e.target.value;
                      setFormData({ ...formData, holidays: updated });
                    }}
                  />
                  <button type="button" onClick={() => handleRemoveHoliday(idx)} className={styles.removeBtn}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={handleAddHoliday} className={styles.secondaryBtn}>
                Add Holiday
              </button>

              <h3>Exam Windows</h3>
              {formData.examWindows.map((exam, idx) => (
                <div key={idx} className={styles.subForm}>
                  <input
                    type="text"
                    placeholder="Exam window name"
                    value={exam.name}
                    onChange={(e) => {
                      const updated = [...formData.examWindows];
                      updated[idx].name = e.target.value;
                      setFormData({ ...formData, examWindows: updated });
                    }}
                  />
                  <input
                    type="date"
                    value={exam.startDate}
                    onChange={(e) => {
                      const updated = [...formData.examWindows];
                      updated[idx].startDate = e.target.value;
                      setFormData({ ...formData, examWindows: updated });
                    }}
                  />
                  <input
                    type="date"
                    value={exam.endDate}
                    onChange={(e) => {
                      const updated = [...formData.examWindows];
                      updated[idx].endDate = e.target.value;
                      setFormData({ ...formData, examWindows: updated });
                    }}
                  />
                  <button type="button" onClick={() => handleRemoveExamWindow(idx)} className={styles.removeBtn}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={handleAddExamWindow} className={styles.secondaryBtn}>
                Add Exam Window
              </button>

              <button type="submit" className={styles.primaryBtn}>
                {editingId ? "Update Term Config" : "Create Term Config"}
              </button>
            </form>
          )}

          <h2>Term Configurations</h2>
          <div className={styles.configsList}>
            {configs.map((config) => (
              <div key={config.id} className={styles.configCard}>
                <h3>{config.termName}</h3>
                <p>
                  <strong>Period:</strong> {config.startDate} to {config.endDate}
                </p>
                <p>
                  <strong>Business Hours:</strong> {config.businessHourStart}:00 - {config.businessHourEnd}:00
                </p>
                <p>
                  <strong>Max Sessions/Week:</strong> {config.maxSessionsPerWeek}
                </p>
                <p>
                  <strong>Max Units/Semester:</strong> {config.maxUnitsPerSemester}
                </p>
                <div className={styles.details}>
                  <p>
                    <strong>Holidays:</strong> {config.holidays.length}
                  </p>
                  <p>
                    <strong>Exam Windows:</strong> {config.examWindows.length}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
