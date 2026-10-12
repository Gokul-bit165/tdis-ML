#!/usr/bin/env node
/**
 * Proves region SAS URLs cannot upload (PUT) or delete blobs.
 * Expects read/list SAS (sp=rl): write attempts should return 403/401.
 *
 *   cd ui/tdis-portal-frontend && node scripts/verify-sas-readonly.mjs
 *
 * Exit 0: every URL denied PUT and DELETE (no successful write/delete).
 * Exit 1: any upload/delete succeeded, or a region URL is missing.
 */

/** Full SAS URLs per region (same as REACT_APP_Region_XX). Rotate if exposed. */
const REGION_URLS = {
  '01': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-01?sp=rl&st=2026-03-26T19:26:09Z&se=2027-03-27T03:41:09Z&spr=https&sv=2024-11-04&sr=d&sig=mrlhIDd%2BkrADAq%2BvBNBCnk871%2BO1t4uwG4UoD8hBaUU%3D&sdd=2',
  '02': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-02?sp=rl&st=2026-03-26T19:30:36Z&se=2027-03-27T03:45:36Z&spr=https&sv=2024-11-04&sr=d&sig=VAyTSIwoc6R8bZP5KpIlw7LDh9NkymoYlhb290Iww%2FA%3D&sdd=2',
  '03': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-03?sp=rl&st=2026-03-26T19:31:13Z&se=2027-03-27T03:46:13Z&spr=https&sv=2024-11-04&sr=d&sig=XM0Trq%2FAXBosMskZgcSr7kMS7%2FWPe%2F5o7G29Fwv0awM%3D&sdd=2',
  '04': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-04?sp=rl&st=2026-03-26T19:32:04Z&se=2027-03-27T03:47:04Z&spr=https&sv=2024-11-04&sr=d&sig=6v11dfe54FMhAj9qp4kMzCwFOLe12rWgV1y8rmjBlO4%3D&sdd=2',
  '05': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-05?sp=rl&st=2026-03-26T19:32:48Z&se=2027-03-27T03:47:48Z&spr=https&sv=2024-11-04&sr=d&sig=Ur9YKj2PtVV72WMEXYTzy6r9vorNifpX53%2FvvS%2B%2FmKQ%3D&sdd=2',
  '06': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-06?sp=rl&st=2026-03-26T19:33:32Z&se=2027-03-27T03:48:32Z&spr=https&sv=2024-11-04&sr=b&sig=f6LtYpwHvRaYlR6IBDv1mh4nsVcYLlUlK30WmMriVNg%3D',
  '07': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-07?sp=rl&st=2026-03-26T19:34:22Z&se=2027-03-27T03:49:22Z&spr=https&sv=2024-11-04&sr=d&sig=HzfUJVa9gQQvsMh7C5EriB24u3ZaTZPbkfQR79rgTVQ%3D&sdd=2',
  '08': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-08?sp=rl&st=2026-03-26T19:35:49Z&se=2027-03-27T03:50:49Z&spr=https&sv=2024-11-04&sr=d&sig=eCFzIJsdAK%2Bq2geZWhO4nr%2F95OJ4v6SSCOOXpKmvXpU%3D&sdd=2',
  '09': 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-09?sp=rl&st=2026-03-26T19:36:15Z&se=2027-03-27T03:51:15Z&spr=https&sv=2024-11-04&sr=d&sig=4sfSaWOMalbZu7ayekG%2B14GAXtXirHw0S8TVvKsC58E%3D&sdd=2',
  10: 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-10?sp=rl&st=2026-03-26T19:36:53Z&se=2027-03-27T03:51:53Z&spr=https&sv=2024-11-04&sr=d&sig=8QPGLu%2FnokqLoTBS3uFNMudhYcQfZeA74sSfR%2FjoUDg%3D&sdd=2',
  11: 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-11?sp=rl&st=2026-03-26T19:37:20Z&se=2027-03-27T03:52:20Z&spr=https&sv=2024-11-04&sr=d&sig=lKy5AGzOS0dYCrW3fBTORQPdp%2B4Gu9HHM2XKpGmqago%3D&sdd=2',
  12: 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-12?sp=rl&st=2026-03-26T19:37:53Z&se=2027-03-27T03:52:53Z&spr=https&sv=2024-11-04&sr=d&sig=23bX0Eu9oupRltcW6RdotjQ9xk1w%2BP4cIpHYiWTo5UA%3D&sdd=2',
  13: 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-13?sp=rl&st=2026-03-26T19:40:18Z&se=2027-03-27T03:55:18Z&spr=https&sv=2024-11-04&sr=d&sig=CtpADMIILhrWOgU0NwPeBFobAZiKX0yNsHXv9T1SUw4%3D&sdd=2',
  14: 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-14?sp=rl&st=2026-03-26T19:40:52Z&se=2027-03-27T03:55:52Z&spr=https&sv=2024-11-04&sr=d&sig=iy%2Fika1fcrOw0KjpgGGQchdZSLUCbBGcDFNoo5kHTrI%3D&sdd=2',
  15: 'https://tdisproddatalakehouse.blob.core.windows.net/tdis-data-bronze/ms2-dev/twdb-region-15?sp=rl&st=2026-03-26T19:42:37Z&se=2027-03-27T03:57:37Z&spr=https&sv=2024-11-04&sr=d&sig=X4QB%2FvFU0JgSFOyLffuKtEmY0wzzXeDRtEsNzbdZLCc%3D&sdd=2',
};

const REGION_ORDER = Object.keys(REGION_URLS).sort((a, b) => Number(a) - Number(b));

function log(...args) {
  const ts = new Date().toISOString();
  // Keep format string literal so Semgrep unsafe-formatstring does not flag this logger.
  console.log('[%s]', ts, ...args);
}

/** Split "https://host/container/path/to/dir?<sas>" into base path and query. */
function splitSasUrl(full) {
  const q = full.indexOf('?');
  if (q === -1) return { path: full, query: '' };
  return { path: full.slice(0, q), query: full.slice(q + 1) };
}

function probeBlobUrl(regionUrl, fileName) {
  const { path, query } = splitSasUrl(regionUrl.trim());
  const sep = path.endsWith('/') ? '' : '/';
  const url = `${path}${sep}${fileName}${query ? `?${query}` : ''}`;
  return url;
}

/** Status codes that mean "not allowed to write/delete" (good for read-only proof). */
const DENIED = new Set([401, 403]);

/** Status codes that mean a write or delete actually happened — must never occur. */
const WRITE_SUCCESS = new Set([200, 201, 202, 204]);

async function tryPut(url) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': 'application/octet-stream',
    },
    body: Buffer.from('sas-readonly-check'),
  });
  const text = await res.text();
  return { status: res.status, bodyPreview: text.slice(0, 200) };
}

async function tryDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  const text = await res.text();
  return { status: res.status, bodyPreview: text.slice(0, 200) };
}

async function tryGetHead(regionUrl) {
  const res = await fetch(regionUrl, { method: 'HEAD' });
  return res.status;
}

async function main() {
  log('verify-sas-readonly: checking PUT/DELETE are denied for each REACT_APP_Region_XX');
  let failed = false;
  let checked = 0;

  for (const regionNum of REGION_ORDER) {
    const key = `REACT_APP_Region_${regionNum}`;
    const regionUrl = REGION_URLS[regionNum];

    if (!regionUrl) {
      log(`SKIP ${key}: no URL in REGION_URLS`);
      failed = true;
      continue;
    }

    checked += 1;
    const probeName = `sas-readonly-probe-${Date.now()}-${regionNum}.txt`;
    const blobUrl = probeBlobUrl(regionUrl, probeName);

    log(`--- ${key} ---`);

    try {
      const headStatus = await tryGetHead(regionUrl);
      log(`${key} HEAD directory/base URL: HTTP ${headStatus}`);
    } catch (e) {
      log(`${key} HEAD failed:`, e.message);
    }

    try {
      const put = await tryPut(blobUrl);
      if (WRITE_SUCCESS.has(put.status)) {
        log(`FAIL ${key} PUT: HTTP ${put.status} — upload appears to have succeeded`);
        log(`     body: ${put.bodyPreview.replace(/\s+/g, ' ').slice(0, 120)}`);
        failed = true;
      } else if (DENIED.has(put.status)) {
        log(`PASS ${key} PUT: HTTP ${put.status} (write denied as expected)`);
      } else {
        log(`WARN ${key} PUT: HTTP ${put.status} — not 403/401; verify manually`);
        log(`     body: ${put.bodyPreview.replace(/\s+/g, ' ').slice(0, 120)}`);
      }
    } catch (e) {
      log(`FAIL ${key} PUT: network error`, e.message);
      failed = true;
    }

    try {
      const del = await tryDelete(blobUrl);
      if (WRITE_SUCCESS.has(del.status)) {
        log(`FAIL ${key} DELETE: HTTP ${del.status} — delete may have succeeded`);
        log(`     body: ${del.bodyPreview.replace(/\s+/g, ' ').slice(0, 120)}`);
        failed = true;
      } else if (DENIED.has(del.status)) {
        log(`PASS ${key} DELETE: HTTP ${del.status} (delete denied as expected)`);
      } else {
        log(`WARN ${key} DELETE: HTTP ${del.status} — not 403/401; verify manually`);
        log(`     body: ${del.bodyPreview.replace(/\s+/g, ' ').slice(0, 120)}`);
      }
    } catch (e) {
      log(`FAIL ${key} DELETE: network error`, e.message);
      failed = true;
    }
  }

  log(`Done. Regions checked: ${checked}.`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
