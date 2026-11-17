#!/usr/bin/env node
// Serve a folder made by prepare_drainage.py on http://localhost:8003 (with CORS), so `npm run dev` can show the
// Drainage Monitoring tab without Azure. Local development only.
//   node serve_local.mjs <folder> [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const [folder, port = '8003'] = process.argv.slice(2);
if (!folder) {
  console.error('usage: node serve_local.mjs <folder made by prepare_drainage.py> [port]');
  process.exit(1);
}
const root = resolve(folder);

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Flat folder: only plain file names, so nothing outside it can be read.
  const name = basename(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    const body = await readFile(join(root, name));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} on http://localhost:${port}`));
