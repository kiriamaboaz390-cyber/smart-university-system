export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  HR_ADMIN = "HR_ADMIN",
  ADMIN = "ADMIN",
  LECTURER = "LECTURER",
  STUDENT = "STUDENT",
}

const roleHierarchy: Record<Role, Role[]> = {
  [Role.SUPER_ADMIN]: [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.ADMIN, Role.LECTURER, Role.STUDENT],
  [Role.HR_ADMIN]: [Role.HR_ADMIN],
  [Role.ADMIN]: [Role.ADMIN, Role.LECTURER, Role.STUDENT],
  [Role.LECTURER]: [Role.LECTURER, Role.STUDENT],
  [Role.STUDENT]: [Role.STUDENT],
};

export function canAccess(currentRole: Role, targetRole: Role): boolean {
  return roleHierarchy[currentRole]?.includes(targetRole) ?? false;
}
