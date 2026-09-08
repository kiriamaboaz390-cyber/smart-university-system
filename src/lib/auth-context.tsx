"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "SUPER_ADMIN" | "HR_ADMIN" | "ADMIN" | "LECTURER" | "STUDENT";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

const KNOWN_ROLES: User["role"][] = [
  "SUPER_ADMIN",
  "HR_ADMIN",
  "ADMIN",
  "LECTURER",
  "STUDENT",
];

/**
 * Normalize a raw user object (from the login API response or localStorage)
 * into the canonical User shape. Returns null when the object is unusable.
 */
function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.id !== "string" || candidate.id === "") return null;
  if (typeof candidate.role !== "string" || !KNOWN_ROLES.includes(candidate.role as User["role"])) {
    return null;
  }
  const fullName =
    typeof candidate.fullName === "string" && candidate.fullName.trim() !== ""
      ? candidate.fullName
      : [candidate.firstName, candidate.lastName]
          .filter((part): part is string => typeof part === "string")
          .join(" ")
          .trim();
  return {
    id: candidate.id,
    email: typeof candidate.email === "string" ? candidate.email : "",
    fullName,
    role: candidate.role as User["role"],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Restore an existing session on first load. The stored user object is the
  // source of truth; if it is missing we reconstruct a minimal user (id + role)
  // from the JWT payload so pages keep working after a refresh.
  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
      try {
        const payload = JSON.parse(atob(storedToken.split(".")[1]));

        let restored: User | null = null;
        const storedUser = localStorage.getItem(AUTH_USER_KEY);
        if (storedUser) {
          try {
            restored = normalizeUser(JSON.parse(storedUser));
          } catch {
            restored = null;
          }
        }
        if (!restored && payload && typeof payload === "object") {
          restored = normalizeUser({ id: payload.userId, role: payload.role });
        }

        if (restored) {
          setUser(restored);
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          setToken(null);
        }
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        setToken(null);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      throw new Error("Login failed");
    }

    const data = await res.json();
    const normalized = normalizeUser(data.user);

    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setToken(data.token);

    if (normalized) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalized));
      setUser(normalized);
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

