export function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateRange(start, end) {
  if (!start && !end) return 'N/A';
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start || end);
}

export function formatYesNo(value) {
  if (value === null || value === undefined) return 'N/A';
  return value ? 'Yes' : 'No';
}

export function formatMoneyCents(value, showFree = false) {
  if (value === 0 && showFree) return 'Free';
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (isNaN(num)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num / 100);
}

export function formatActor(value, fallbackSystem = false) {
  if (!value) return fallbackSystem ? 'System' : 'N/A';
  if (typeof value === 'object') {
    return value.name || value.email || value.username || (fallbackSystem ? 'System' : 'N/A');
  }
  return String(value);
}
