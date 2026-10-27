import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installPlugin } from '../src/cli/install.mjs';
import { uninstallPlugin } from '../src/cli/uninstall.mjs';
import { resolveTargets } from '../src/cli/targets.mjs';

function makePlugin(root) {
  const dir = path.join(root, 'bundle', 'demo');
  mkdirSync(path.join(dir, 'skills', 'demo'), { recursive: true });
  writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), '# demo');
  return dir;
}

function setup(t, scope = 'project') {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'agents-rock-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project');
  mkdirSync(project, { recursive: true });
  const targets = resolveTargets({ scope, root: project, home: root, env: {} });
  return { pluginDir: makePlugin(root), targets };
}

test('uninstalling last agent removes canonical too', (t) => {
  const { pluginDir, targets } = setup(t);
  installPlugin({ pluginDir, targets, agents: ['claude'] });
  const result = uninstallPlugin({ pluginDir, targets, agents: ['claude'] });
  assert.deepEqual(result.removed, [{ skill: 'demo', agent: 'claude' }]);
  assert.deepEqual(result.canonicalRemoved, ['demo']);
  assert.ok(!existsSync(path.join(targets.agentDirs.claude, 'demo')));
  assert.ok(!existsSync(path.join(targets.canonical, 'demo')));
});

test('canonical kept while another agent still references skill', (t) => {
  const { pluginDir, targets } = setup(t);
  installPlugin({ pluginDir, targets, agents: ['claude', 'codex'] });
  const result = uninstallPlugin({ pluginDir, targets, agents: ['codex'] });
  assert.deepEqual(result.canonicalRemoved, []);
  assert.ok(existsSync(path.join(targets.canonical, 'demo')));
  assert.ok(existsSync(path.join(targets.agentDirs.claude, 'demo')));
});

test('user scope uninstall removes home symlinks and canonical', (t) => {
  const { pluginDir, targets } = setup(t, 'user');
  installPlugin({ pluginDir, targets, agents: ['claude', 'codex'] });
  const result = uninstallPlugin({ pluginDir, targets, agents: ['claude', 'codex'] });
  assert.equal(result.removed.length, 2);
  assert.deepEqual(result.canonicalRemoved, ['demo']);
  assert.ok(!existsSync(path.join(targets.canonical, 'demo')));
});

test('project scope uninstall leaves a user scope install alone', (t) => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'agents-rock-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project');
  mkdirSync(project, { recursive: true });
  const pluginDir = makePlugin(root);
  const opts = { root: project, home: root, env: {} };
  const projectTargets = resolveTargets({ scope: 'project', ...opts });
  const userTargets = resolveTargets({ scope: 'user', ...opts });
  installPlugin({ pluginDir, targets: projectTargets, agents: ['claude'] });
  installPlugin({ pluginDir, targets: userTargets, agents: ['claude'] });
  uninstallPlugin({ pluginDir, targets: projectTargets, agents: ['claude', 'codex'] });
  assert.ok(!existsSync(path.join(projectTargets.canonical, 'demo')));
  assert.ok(existsSync(path.join(userTargets.canonical, 'demo')));
  assert.ok(existsSync(path.join(userTargets.agentDirs.claude, 'demo')));
});

test('non-symlink at agent path skipped without force', (t) => {
  const { pluginDir, targets } = setup(t);
  const realDir = path.join(targets.agentDirs.claude, 'demo');
  mkdirSync(realDir, { recursive: true });
  const result = uninstallPlugin({ pluginDir, targets, agents: ['claude'] });
  assert.equal(result.skipped.length, 1);
  assert.ok(existsSync(realDir));
});

test('non-symlink removed with force', (t) => {
  const { pluginDir, targets } = setup(t);
  const realDir = path.join(targets.agentDirs.claude, 'demo');
  mkdirSync(realDir, { recursive: true });
  const result = uninstallPlugin({ pluginDir, targets, agents: ['claude'], force: true });
  assert.equal(result.skipped.length, 0);
  assert.ok(!existsSync(realDir));
});

test('uninstalling when nothing installed is a silent no-op', (t) => {
  const { pluginDir, targets } = setup(t);
  const result = uninstallPlugin({ pluginDir, targets, agents: ['claude', 'codex'] });
  assert.deepEqual(result, { removed: [], canonicalRemoved: [], skipped: [] });
});

test('uninstalling claude removes the plugin workflows', (t) => {
  const { pluginDir, targets } = setup(t);
  mkdirSync(path.join(pluginDir, 'workflows'), { recursive: true });
  writeFileSync(path.join(pluginDir, 'workflows', 'review.js'), 'x');
  installPlugin({ pluginDir, targets, agents: ['claude'] });
  const result = uninstallPlugin({ pluginDir, targets, agents: ['claude'] });
  assert.ok(!existsSync(path.join(targets.workflows, 'review.js')));
  assert.ok(result.removed.some((r) => r.skill === 'workflows/review.js'));
});
