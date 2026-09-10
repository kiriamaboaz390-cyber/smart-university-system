"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export default function UsersPage() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "STUDENT",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check authorization (derived, not set in an effect)
  const permissionError =
    user && !["HR_ADMIN", "SUPER_ADMIN"].includes(user.role)
      ? "You do not have permission to access this page"
      : null;

  // Fetch users
  useEffect(() => {
    if (!token) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch users");
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Not authenticated");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }

      const newUser = await res.json();
      setUsers([...users, newUser]);
      setFormData({ email: "", password: "", fullName: "", role: "STUDENT" });
      setShowForm(false);
      setSuccess("User created successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating user");
    }
  };

  if (permissionError) {
    return <div className={styles.error}>{permissionError}</div>;
  }

  return (
    <div className={styles.container}>
      <h1>User Management</h1>

      {error && <div className={styles.alert + " " + styles.error}>{error}</div>}
      {success && <div className={styles.alert + " " + styles.success}>{success}</div>}

      {loading ? (
        <div>Loading users...</div>
      ) : (
        <>
          <button onClick={() => setShowForm(!showForm)} className={styles.primaryBtn}>
            {showForm ? "Cancel" : "Create New User"}
          </button>

          {showForm && (
            <form onSubmit={handleCreateUser} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="HR_ADMIN">HR Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="LECTURER">Lecturer</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>

              <button type="submit" className={styles.primaryBtn}>
                Create User
              </button>
            </form>
          )}

          <h2>Users</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Full Name</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.fullName}</td>
                  <td>{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
