import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, lstatSync, readlinkSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installPlugin } from '../src/cli/install.mjs';
import { resolveTargets } from '../src/cli/targets.mjs';

function makePlugin(root) {
  const dir = path.join(root, 'bundle', 'demo');
  mkdirSync(path.join(dir, 'skills', 'demo', 'assets'), { recursive: true });
  writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), '# demo v1');
  writeFileSync(path.join(dir, 'skills', 'demo', 'assets', 'a.txt'), 'asset');
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

test('installs canonical copy plus relative symlinks per agent', (t) => {
  const { pluginDir, targets } = setup(t);
  const result = installPlugin({ pluginDir, targets, agents: ['claude', 'codex'] });
  const canonical = path.join(targets.canonical, 'demo');
  assert.equal(readFileSync(path.join(canonical, 'SKILL.md'), 'utf8'), '# demo v1');
  for (const agent of ['claude', 'codex']) {
    const link = path.join(targets.agentDirs[agent], 'demo');
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.equal(readlinkSync(link), path.join('..', '..', '.agents', 'skills', 'demo'));
  }
  assert.equal(result.installed.length, 2);
  assert.equal(result.skipped.length, 0);
});

test('user scope uses the same canonical-plus-symlink layout under home', (t) => {
  const { pluginDir, targets } = setup(t, 'user');
  const result = installPlugin({ pluginDir, targets, agents: ['claude', 'codex'] });
  assert.equal(readFileSync(path.join(targets.canonical, 'demo', 'SKILL.md'), 'utf8'), '# demo v1');
  for (const agent of ['claude', 'codex']) {
    const link = path.join(targets.agentDirs[agent], 'demo');
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.equal(realpathSync(link), path.join(targets.canonical, 'demo'));
  }
  assert.equal(result.skipped.length, 0);
});

test('re-install is idempotent (mode linked, nothing skipped)', (t) => {
  const { pluginDir, targets } = setup(t);
  installPlugin({ pluginDir, targets, agents: ['claude'] });
  const result = installPlugin({ pluginDir, targets, agents: ['claude'] });
  assert.deepEqual(result.installed.map((i) => i.mode), ['linked']);
  assert.equal(result.reused.length, 1);
  assert.equal(result.skipped.length, 0);
});

test('adding a second agent reuses existing canonical', (t) => {
  const { pluginDir, targets } = setup(t);
  installPlugin({ pluginDir, targets, agents: ['claude'] });
  const result = installPlugin({ pluginDir, targets, agents: ['codex'] });
  assert.equal(result.installed[0].agent, 'codex');
  assert.equal(result.reused.length, 1);
});

test('real dir at agent path is skipped without force', (t) => {
  const { pluginDir, targets } = setup(t);
  const blocker = path.join(targets.agentDirs.claude, 'demo');
  mkdirSync(blocker, { recursive: true });
  const result = installPlugin({ pluginDir, targets, agents: ['claude'] });
  assert.equal(result.skipped.length, 1);
  assert.ok(!lstatSync(blocker).isSymbolicLink());
});

test('force replaces blocker and stale canonical', (t) => {
  const { pluginDir, targets } = setup(t);
  const blocker = path.join(targets.agentDirs.claude, 'demo');
  mkdirSync(blocker, { recursive: true });
  const canonical = path.join(targets.canonical, 'demo');
  mkdirSync(canonical, { recursive: true });
  writeFileSync(path.join(canonical, 'SKILL.md'), 'stale');
  const result = installPlugin({ pluginDir, targets, agents: ['claude'], force: true });
  assert.equal(result.skipped.length, 0);
  assert.equal(readFileSync(path.join(canonical, 'SKILL.md'), 'utf8'), '# demo v1');
  assert.ok(lstatSync(blocker).isSymbolicLink());
});

test('does not install eval suites into the canonical copy', (t) => {
  const { pluginDir, targets } = setup(t);
  const skillDir = path.join(pluginDir, 'skills', 'demo');
  mkdirSync(path.join(skillDir, 'evals', 'fixtures', 'acme'), { recursive: true });
  writeFileSync(path.join(skillDir, 'evals', 'evals.json'), '{"skill_name":"demo","evals":[]}');
  writeFileSync(path.join(skillDir, 'evals', 'fixtures', 'acme', 'brief.md'), 'fixture');

  installPlugin({ pluginDir, targets, agents: ['claude'] });

  const canonical = path.join(targets.canonical, 'demo');
  assert.equal(existsSync(path.join(canonical, 'evals')), false, 'evals/ must not ship to users');
  assert.equal(readFileSync(path.join(canonical, 'SKILL.md'), 'utf8'), '# demo v1');
  assert.equal(readFileSync(path.join(canonical, 'assets', 'a.txt'), 'utf8'), 'asset');
});
