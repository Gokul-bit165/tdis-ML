#!/usr/bin/env node
// Checks the published Drainage Monitoring files the way the portal reads them (including CORS).
//   node verify_drainage.mjs [data url] [origin]
//   node verify_drainage.mjs https://datatexas.blob.core.windows.net/drainage-data/current https://wonderful-moss-0963acc10.2.azurestaticapps.net
// Exits non-zero on the first failure.

const [base = 'http://localhost:8003', origin = 'http://localhost:5173'] = process.argv.slice(2);
const root = base.replace(/\/+$/, '');
let failures = 0;

async function check(label, url, validate) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { Origin: origin } });
    const cors = res.headers.get('access-control-allow-origin');
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    if (cors !== '*' && cors !== origin) throw new Error(`CORS header is ${cors ?? 'missing'} for origin ${origin}`);
    const body = await res.json();
    const kb = Number(res.headers.get('content-length') || 0) / 1024;
    console.log(`ok   ${label.padEnd(9)} ${String(Math.round(performance.now() - t0)).padStart(5)} ms ${kb.toFixed(0).padStart(5)} KB  ${validate(body)}`);
    return body;
  } catch (e) {
    failures += 1;
    console.log(`FAIL ${label.padEnd(9)} ${url}: ${e.message}`);
    return null;
  }
}

const fc = (b) => {
  if (b.type !== 'FeatureCollection' || !Array.isArray(b.features)) throw new Error('not a FeatureCollection');
  return `${b.features.length} features`;
};

const manifest = await check('manifest', `${root}/manifest.json`, (b) => `survey ${b.run_id}, ${b.n_defects} defects, ${b.cells.length} outline tiles`);
if (manifest) {
  const v = `?v=${encodeURIComponent(manifest.version)}`;
  await check('points', `${root}/points.geojson${v}`, fc);
  const [x, y] = manifest.cells[0] ?? [];
  if (x !== undefined) await check('outlines', `${root}/polygons_${x}_${y}.geojson${v}`, fc);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
