/**
 * Lightweight API client for the TDIS Portal FastAPI backend (`VITE_API_URL`).
 */

import { buildPortalApiHeaders, getPortalApiUrl } from '../config/portalApiConfig';

async function httpGet(path, params) {
  const url = getPortalApiUrl(path, params);
  const res = await fetch(url, { headers: buildPortalApiHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${new URL(url).pathname} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getEvents(fromIso, toIso) {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 20;
  let page = 1;
  let totalPages = 1;
  const all = [];

  do {
    const params = {
      page,
      page_size: PAGE_SIZE,
      start_date: fromIso,
      end_date: toIso,
    };

    const data = await httpGet('/events/', params);
    const events = Array.isArray(data?.events) ? data.events : [];
    all.push(...events);
    totalPages = Number(data?.total_pages || 1);
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return all;
}

export async function getCountsByType(fromIso, toIso) {
  return httpGet('/events/analytics/count-by-type', {
    start_date: fromIso,
    end_date: toIso,
  });
}

export async function getLatestEndTime() {
  const data = await httpGet('/batch-jobs/metrics/latest-end-time');
  return { latestEndTime: data?.latest_end_time, timestamp: data?.timestamp };
}
