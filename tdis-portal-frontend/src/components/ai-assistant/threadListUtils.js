/**
 * @param {string|undefined|null} value — ISO date or similar
 * @returns {Date|null}
 */
function parseThreadDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {string|undefined|null} value
 * @returns {string}
 */
export function formatLastActive(value) {
  if (!value) return 'Recently';
  const date = parseThreadDate(value);
  if (!date) return 'Recently';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * @param {Date} date
 * @param {Date} now
 * @returns {'today'|'yesterday'|'older'}
 */
function bucketForDate(date, now) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  return 'older';
}

/**
 * @param {Array<{ last_active_at?: string, title?: string, id?: string }>} threads
 * @returns {Array<{ id: string, label: string, threads: typeof threads }>}
 */
export function groupThreadsByDate(threads) {
  const now = new Date();
  const buckets = { today: [], yesterday: [], older: [] };

  for (const thread of threads) {
    const d = parseThreadDate(thread.last_active_at) ?? now;
    buckets[bucketForDate(d, now)].push(thread);
  }

  return [
    { id: 'today', label: 'Today', threads: buckets.today },
    { id: 'yesterday', label: 'Yesterday', threads: buckets.yesterday },
    { id: 'older', label: 'Older', threads: buckets.older },
  ].filter((g) => g.threads.length > 0);
}

/**
 * @param {Array<{ title?: string }>} threads
 * @param {string} query
 * @returns {typeof threads}
 */
export function filterThreadsBySearch(threads, query) {
  const q = query.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter((t) => {
    const title = (t.title || 'Untitled conversation').toLowerCase();
    return title.includes(q);
  });
}
