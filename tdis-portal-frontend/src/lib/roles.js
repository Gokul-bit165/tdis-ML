export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'superadmin',
};

export function isSuperAdmin(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) =>
    ['superadmin', 'super_admin', 'tdis_superadmin'].includes(String(r).toLowerCase())
  );
}

export function isAdmin(roles) {
  if (!Array.isArray(roles)) return false;
  return (
    isSuperAdmin(roles) ||
    roles.some((r) =>
      ['admin', 'org_admin', 'tdis_admin', 'orgadmin'].includes(String(r).toLowerCase())
    )
  );
}
