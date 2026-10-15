export function getOrganisationPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.organization ?? payload.organisation ?? payload.data ?? payload;
}

export function getOrganisationName(org) {
  if (!org || typeof org !== 'object') return 'N/A';
  return org.name ?? org.organization_name ?? org.organisation_name ?? org.title ?? 'N/A';
}
