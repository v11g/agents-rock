import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative } from 'node:path';
import { join } from 'node:path';
import { startServer } from '../serve.mjs';

let server, base, root;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'srv-'));      // copy fixture so POSTs don't dirty it
  await cp(new URL('./fixtures/root', import.meta.url).pathname, root, { recursive: true });
  // stats.mjs and vendor/* aren't part of the shared fixture — write minimal stand-ins
  // under scripts/ so the allowlist has something to serve.
  await mkdir(join(root, 'scripts', 'vendor'), { recursive: true });
  await writeFile(join(root, 'scripts', 'stats.mjs'), 'export const x = 1;\n');
  await writeFile(join(root, 'scripts', 'vendor', 'reactflow-bundle.js'), '// stub\n');
  server = await startServer(root, 0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

test('GET /api/leads returns enriched registry', async () => {
  const body = await (await fetch(`${base}/api/leads`)).json();
  const acme = body.leads.find(l => l.id === 'acme-crm');
  assert.equal(acme.artifacts.docs, true);
  assert.equal(acme.artifacts.proposal, false);
});
test('GET /api/leads/:id/map returns nodes', async () => {
  const map = await (await fetch(`${base}/api/leads/acme-crm/map`)).json();
  assert.ok(map.nodes.some(n => n.id === 'arch'));
});
test('POST /api/leads/:id marks won and stamps closed', async () => {
  const res = await fetch(`${base}/api/leads/acme-crm`, {
    method: 'POST', body: JSON.stringify({ status: 'won' }),
    headers: { 'content-type': 'application/json' },
  });
  const lead = await res.json();
  assert.equal(lead.status, 'won');
  assert.match(lead.closed, /^\d{4}-\d{2}-\d{2}$/);
});
test('POST bad status -> 400; unknown id -> 404', async () => {
  const bad = await fetch(`${base}/api/leads/acme-crm`, { method: 'POST', body: '{"status":"maybe"}' });
  assert.equal(bad.status, 400);
  const missing = await fetch(`${base}/api/leads/nope`, { method: 'POST', body: '{"status":"won"}' });
  assert.equal(missing.status, 404);
});
test('POST notes writes notes.md and responds {ok: true}', async () => {
  const res = await fetch(`${base}/api/leads/acme-crm/notes`, { method: 'POST', body: '{"content":"call went well"}' });
  assert.deepEqual(await res.json(), { ok: true });
  assert.match(await readFile(join(root, 'leads', 'acme-crm', 'notes.md'), 'utf8'), /call went well/);
});
test('static serving with traversal guard', async () => {
  assert.equal((await fetch(`${base}/leads/acme-crm/dist/index.html`)).status, 200);
  // Plain "../../etc/passwd" and "%2e%2e" between literal slashes get collapsed by the
  // WHATWG URL parser *before* the request ever leaves fetch() -- the server never sees a
  // ".." segment for those, so they can't exercise the guard (verified empirically: req.url
  // arrives as "/etc/passwd" / "/leads.json.lock", both harmless in-bounds, non-allowlisted
  // paths that the allowlist rule alone already 404s). An encoded *slash* (%2F) is not
  // collapsed by the URL parser -- it survives to the server, where decodeURIComponent turns
  // it into a real ".." segment, which is the guard this test needs to exercise.
  assert.equal((await fetch(`${base}/leads/acme-crm/..%2F..%2Fetc%2Fpasswd`)).status, 403);
  assert.equal((await fetch(`${base}/leads/acme-crm/..%2Fleads.json.lock`)).status, 403);
});
test('static allowlist: leads.json -> 404; lead-root docs, stats.mjs, vendor -> 200', async () => {
  assert.equal((await fetch(`${base}/leads.json`)).status, 404);
  assert.equal((await fetch(`${base}/leads/acme-crm/notes.md`)).status, 200);
  assert.equal((await fetch(`${base}/leads/acme-crm/rfp.md`)).status, 200);
  assert.equal((await fetch(`${base}/leads/acme-crm/brief.md`)).status, 200);
  assert.equal((await fetch(`${base}/scripts/stats.mjs`)).status, 200);
  assert.equal((await fetch(`${base}/scripts/vendor/reactflow-bundle.js`)).status, 200);
});
test('lead-root docs: only doc extensions, only one path segment deep', async () => {
  await writeFile(join(root, 'leads', 'acme-crm', 'script.mjs'), 'export {};\n');
  assert.equal((await fetch(`${base}/leads/acme-crm/script.mjs`)).status, 404);
  await mkdir(join(root, 'leads', 'acme-crm', 'docs'), { recursive: true });
  await writeFile(join(root, 'leads', 'acme-crm', 'docs', 'nested.md'), 'nested\n');
  assert.equal((await fetch(`${base}/leads/acme-crm/docs/nested.md`)).status, 404);
  const md = await fetch(`${base}/leads/acme-crm/rfp.md`);
  assert.equal(md.headers.get('content-type'), 'text/plain; charset=utf-8');
});
test('lead-root doc symlinked out of the root is rejected, not followed', async () => {
  const outside = join(root, '..', 'outside-doc.md');
  await writeFile(outside, 'top secret');
  await symlink(outside, join(root, 'leads', 'acme-crm', 'leak.md'));
  const res = await fetch(`${base}/leads/acme-crm/leak.md`);
  assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  await rm(outside, { force: true });
});
test('static content-type and body are correct for allowlisted files', async () => {
  const stats = await fetch(`${base}/scripts/stats.mjs`);
  assert.equal(stats.headers.get('content-type'), 'text/javascript');
  assert.equal(await stats.text(), 'export const x = 1;\n');
  const doc = await fetch(`${base}/leads/acme-crm/dist/index.html`);
  assert.equal(doc.headers.get('content-type'), 'text/html');
});
test('the scripts tree is not browsable beyond the two allowlisted entries', async () => {
  assert.equal((await fetch(`${base}/scripts/serve.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/scripts/lib/registry.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/scripts/index.html`)).status, 404);
  assert.equal((await fetch(`${base}/leads.json`)).status, 404);
});
test('id validation guards every :id route before touching the lead dir or map builder', async () => {
  assert.equal((await fetch(`${base}/api/leads/-bad/map`)).status, 404);
  assert.equal((await fetch(`${base}/api/leads/-bad`, { method: 'POST', body: '{"status":"won"}' })).status, 404);
  assert.equal((await fetch(`${base}/api/leads/-bad/notes`, { method: 'POST', body: '{"content":"x"}' })).status, 404);
});
test('directory GET on an allowlisted prefix 4xxs cleanly and the server stays up', async () => {
  const distDir = await fetch(`${base}/leads/acme-crm/dist/`);
  assert.ok(distDir.status >= 400 && distDir.status < 500);
  const vendorDir = await fetch(`${base}/scripts/vendor/`);
  assert.ok(vendorDir.status >= 400 && vendorDir.status < 500);
  // server must still be listening -- this is the crash the reviewer reproduced
  const stillUp = await fetch(`${base}/api/leads`);
  assert.equal(stillUp.status, 200);
});
test('symlink inside dist/ pointing outside root is rejected, not followed', async () => {
  const outside = join(root, '..', 'outside-secret.txt');
  await writeFile(outside, 'top secret');
  await symlink(outside, join(root, 'leads', 'acme-crm', 'dist', 'link.html'));
  const res = await fetch(`${base}/leads/acme-crm/dist/link.html`);
  assert.equal(res.status, 403);
  await rm(outside, { force: true });
});
test('symlink inside dist/ escaping to leads.json is rejected, not the registry', async () => {
  await symlink(join(root, 'leads.json'), join(root, 'leads', 'acme-crm', 'dist', 'rel-escape.json'));
  const res = await fetch(`${base}/leads/acme-crm/dist/rel-escape.json`);
  assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  assert.doesNotMatch(await res.text(), /Beta Shop/);
});
test('symlink inside dist/ to a lead-root doc serves 200 — those docs are allowlisted directly now', async () => {
  await symlink(join(root, 'leads', 'acme-crm', 'rfp.md'), join(root, 'leads', 'acme-crm', 'dist', 'alias-rfp.md'));
  const res = await fetch(`${base}/leads/acme-crm/dist/alias-rfp.md`);
  assert.equal(res.status, 200);
});
test('symlinked directory inside dist/ cannot reach leads.json through it', async () => {
  await symlink(root, join(root, 'leads', 'acme-crm', 'dist', 'sub'));
  const res = await fetch(`${base}/leads/acme-crm/dist/sub/leads.json`);
  assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  assert.doesNotMatch(await res.text(), /Beta Shop/);
});
test('a two-hop symlink chain inside dist/ cannot reach leads.json either', async () => {
  await symlink(join(root, 'leads.json'), join(root, 'hop.json'));
  await symlink(join(root, 'hop.json'), join(root, 'leads', 'acme-crm', 'dist', 'chain.json'));
  const res = await fetch(`${base}/leads/acme-crm/dist/chain.json`);
  assert.ok(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  assert.doesNotMatch(await res.text(), /Beta Shop/);
});
test('symlink inside dist/ pointing at another allowlisted dist file still serves 200', async () => {
  await symlink(join(root, 'leads', 'acme-crm', 'dist', 'index.html'), join(root, 'leads', 'acme-crm', 'dist', 'alias.html'));
  const res = await fetch(`${base}/leads/acme-crm/dist/alias.html`);
  assert.equal(res.status, 200);
});
test('GET / 404s cleanly when index.html has not been built yet', async () => {
  assert.equal((await fetch(`${base}/`)).status, 404);
});
test('serveFile does not leak the registry when index.html or detail.html is symlinked to it', async () => {
  const cases = [['index.html', `${base}/`], ['detail.html', `${base}/detail/acme-crm`]];
  for (const [name, url] of cases) {
    const target = join(root, 'scripts', name);
    await symlink(join(root, 'leads.json'), target);
    const res = await fetch(url);
    assert.notEqual(res.status, 200, `${name}: unexpectedly served`);
    assert.doesNotMatch(await res.text(), /Beta Shop/);
    await rm(target, { force: true });
  }
});
test('POST to a static-only path is rejected, not served', async () => {
  const res = await fetch(`${base}/scripts/stats.mjs`, { method: 'POST', body: '' });
  assert.notEqual(res.status, 200);
});
test('POST notes does not follow a symlinked notes.md out of the root', async () => {
  const outside = join(root, '..', 'notes-write-target.txt');
  await writeFile(outside, 'ORIGINAL SECRET');
  const link = join(root, 'leads', 'acme-crm', 'notes.md');
  await rm(link, { force: true });
  await symlink(outside, link);
  const res = await fetch(`${base}/api/leads/acme-crm/notes`, {
    method: 'POST', body: '{"content":"OVERWRITTEN VIA DASHBOARD"}',
  });
  assert.notEqual(res.status, 200, 'symlinked notes.md was accepted for writing');
  assert.equal(await readFile(outside, 'utf8'), 'ORIGINAL SECRET', 'file outside the root was modified');
  await rm(link, { force: true });
  await rm(outside, { force: true });
});
test('POST notes does not follow a lead directory symlinked out of the root', async () => {
  const outsideDir = join(root, '..', 'outside-lead-dir');
  await mkdir(outsideDir, { recursive: true });
  await writeFile(join(outsideDir, 'notes.md'), 'ORIGINAL SECRET');
  await symlink(outsideDir, join(root, 'leads', 'ghost-lead'));
  const res = await fetch(`${base}/api/leads/ghost-lead/notes`, {
    method: 'POST', body: '{"content":"OVERWRITTEN VIA DASHBOARD"}',
  });
  assert.notEqual(res.status, 200, 'symlinked lead dir was accepted for writing');
  assert.equal(await readFile(join(outsideDir, 'notes.md'), 'utf8'), 'ORIGINAL SECRET',
    'file outside the root was modified');
  await rm(join(root, 'leads', 'ghost-lead'), { force: true });
  await rm(outsideDir, { recursive: true, force: true });
});
test('relative --root still resolves to real, absolute paths for static serving', async () => {
  const rel = relative(process.cwd(), root);
  const s2 = await startServer(rel, 0);
  const b2 = `http://127.0.0.1:${s2.address().port}`;
  assert.equal((await fetch(`${b2}/leads/acme-crm/dist/index.html`)).status, 200);
  await new Promise((resolve) => s2.close(resolve));
});
