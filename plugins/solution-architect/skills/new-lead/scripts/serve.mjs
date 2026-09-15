// scripts/serve.mjs
// new-lead-dashboard v4
import { createServer } from 'node:http';
import { readFile, writeFile, realpath, stat, lstat } from 'node:fs/promises';
import { join, resolve, sep, extname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { findLeadsRoot, readRegistry, writeRegistry, leadDir, STATUSES, ID_RE } from './lib/registry.mjs';
import { enrichLead } from './lib/enrich.mjs';
import { buildLeadMap } from './lib/map.mjs';
import { findFreePort } from './lib/port.mjs';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8',
};
const ID = ID_RE.source.slice(1, -1);
const DIST_RE = new RegExp(`^/leads/(${ID})/dist/`);
// Documents at the lead root (requirements.md, rfp.md, a client PDF, ...) are
// viewable in the browser: one path segment deep, doc extensions only.
const DOC_RE = new RegExp(`^/leads/(${ID})/[^/]+\\.(?:md|txt|csv|json|pdf)$`);
const SCRIPTS_DIR = 'scripts';
const DEFAULT_PORT = 4600;

const ROUTES = [
  ['GET', /^\/$/, ({ root }, req, res) => serveFile(root, res, join(SCRIPTS_DIR, 'index.html'))],
  ['GET', new RegExp(`^/detail/(${ID})$`), ({ root }, req, res) => serveFile(root, res, join(SCRIPTS_DIR, 'detail.html'))],
  ['GET', /^\/api\/leads$/, apiLeads],
  ['GET', new RegExp(`^/api/leads/(${ID})/map$`), async ({ root, id }, req, res) => send(res, 200, await buildLeadMap(root, id))],
  ['POST', new RegExp(`^/api/leads/(${ID})/notes$`), apiNotes],
  ['POST', new RegExp(`^/api/leads/(${ID})$`), apiUpdate],
];

export async function startServer(root, port) {
  root = await realpath(resolve(root));
  const server = createServer((req, res) => route(root, req, res).catch((err) => {
    console.error(err);
    if (res.headersSent) return res.destroy();
    send(res, 500, { error: 'internal error' });
  }));
  return new Promise((ok, fail) => {
    server.once('error', (err) => fail(err.code === 'EADDRINUSE' ? new Error(`port ${port} in use`) : err));
    server.listen(port, '127.0.0.1', () => ok(server));
  });
}

async function route(root, req, res) {
  const url = new URL(req.url, 'http://internal');
  for (const [method, re, handler] of ROUTES) {
    if (method !== req.method) continue;
    const found = re.exec(url.pathname);
    if (found) return handler({ root, id: found[1] }, req, res);
  }
  if (req.method !== 'GET') return send(res, 404, { error: 'not found' });
  return serveStatic(root, url.pathname, res);
}

async function serveFile(root, res, name) {
  const target = join(root, name);
  let real;
  try { real = await realpath(target); } catch { return send(res, 404, { error: 'not found' }); }
  // name is a fixed literal (index.html/detail.html), so unlike serveStatic there's no
  // pattern to match: the only file this route may ever serve is target itself. If a
  // symlink swapped it for something else, realpath resolves to a different identity.
  if (real !== target) return send(res, 403);
  let data;
  try {
    data = await readFile(real);
  } catch {
    return send(res, 404, { error: 'not found' });
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(data);
}

async function apiLeads({ root }, req, res) {
  const registry = await readRegistry(root);
  const leads = await Promise.all(registry.leads.map((l) => enrichLead(root, l)));
  send(res, 200, { version: registry.version, leads });
}

async function apiUpdate({ root, id }, req, res) {
  const body = await readJsonBody(req);
  if (!body || !STATUSES.has(body.status)) return send(res, 400, { error: 'invalid status' });
  const registry = await readRegistry(root);
  const lead = registry.leads.find((l) => l.id === id);
  if (!lead) return send(res, 404, { error: 'not found' });
  lead.status = body.status;
  lead.closed = body.status === 'active' ? null : (body.closed ?? new Date().toISOString().slice(0, 10));
  try {
    await writeRegistry(root, registry);
  } catch (err) {
    return send(res, 409, { error: err.message });
  }
  send(res, 200, lead);
}

async function apiNotes({ root, id }, req, res) {
  // The only write path into a lead dir, held to the same bar as the read paths:
  // realpath resolves every component and every symlink hop of the directory, and
  // lstat refuses a final component that is a symlink (or any non-regular file).
  // notes.md usually does not exist yet, and an absent lstat is that normal case.
  let dir;
  try { dir = await realpath(leadDir(root, id)); } catch { return send(res, 404, { error: 'not found' }); }
  if (dir !== root && !dir.startsWith(root + sep)) return send(res, 403);
  const target = join(dir, 'notes.md');
  const st = await lstat(target).catch(() => null);
  if (st && !st.isFile()) return send(res, 403);
  const body = await readJsonBody(req);
  if (typeof body?.content !== 'string') return send(res, 400, { error: 'invalid content' });
  await writeFile(target, body.content);
  send(res, 200, { ok: true });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return null;
  }
}

function send(res, status, body) {
  if (body === undefined) { res.writeHead(status); return res.end(); }
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function isAllowlisted(decoded) {
  return decoded === '/scripts/stats.mjs'
    || decoded.startsWith('/scripts/vendor/')
    || DIST_RE.test(decoded)
    || DOC_RE.test(decoded);
}

async function serveStatic(root, pathname, res) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return send(res, 403); }
  if (decoded.split('/').some((s) => s.startsWith('.'))) return send(res, 403);
  const p = resolve(root, '.' + decoded);
  if (p !== root && !p.startsWith(root + sep)) return send(res, 403);
  if (!isAllowlisted(decoded)) return send(res, 404);
  let real;
  try { real = await realpath(p); } catch { return send(res, 404); }
  if (real !== root && !real.startsWith(root + sep)) return send(res, 403);
  // Re-check the allowlist against the resolved path: a symlink can stay inside root
  // (containment above) yet land on a file the URL-path check refused, e.g.
  // dist/link.json -> ../../leads.json. Side effect: a directory GET on an allowlisted
  // prefix now 403s here (no trailing slash post-realpath) instead of 404 below.
  const realDecoded = real === root ? '' : real.slice(root.length).split(sep).join('/');
  if (!isAllowlisted(realDecoded)) return send(res, 403);
  const st = await stat(real);
  if (!st.isFile()) return send(res, 404);
  res.writeHead(200, { 'content-type': MIME[extname(real)] ?? 'application/octet-stream' });
  res.end(await readFile(real));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { root: { type: 'string' }, port: { type: 'string' } } });
  const root = values.root ?? findLeadsRoot(process.cwd());
  if (!root) { console.error('usage: serve.mjs [--root <dir>] [--port <n>]'); process.exit(2); }
  const port = values.port ? Number(values.port) : await findFreePort(DEFAULT_PORT);
  const server = await startServer(root, port);
  console.log(`dashboard: http://127.0.0.1:${server.address().port}`);
}
