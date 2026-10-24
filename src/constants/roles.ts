/** Roles visibles y asignables desde la UI de administración */
export const ASSIGNABLE_ROLES = [
  'admin',
  'manager',
  'employee',
  'viewer',
  'gerencia',
  'ventas',
  'logistica',
  'finanzas',
] as const;

/** Rol oculto: solo para desarrolladores, no asignable desde la UI */
export const HIDDEN_ROLES = ['superadmin'] as const;

export const ALL_ROLES = [...ASSIGNABLE_ROLES, ...HIDDEN_ROLES] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export type HiddenRole = (typeof HIDDEN_ROLES)[number];
export type UserRole = AssignableRole | HiddenRole;

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export function isHiddenRole(role: string): role is HiddenRole {
  return (HIDDEN_ROLES as readonly string[]).includes(role);
}
