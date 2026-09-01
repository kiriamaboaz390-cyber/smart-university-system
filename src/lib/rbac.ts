import { verifyJwt } from "@/lib/auth";

export function getUserFromAuthHeader(authHeader?: string) {
  if (!authHeader) return null;
  const m = authHeader.match(/Bearer\s+(.+)/i);
  if (!m) return null;
  const token = m[1];
  return verifyJwt(token);
}

export function hasRole(payload: { role?: string } | null, allowed: string[]) {
  if (!payload || !payload.role) return false;
  return allowed.includes(payload.role);
}
