import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { homedir } from 'node:os';
import { resolveTargets } from '../src/cli/targets.mjs';

const HOME = path.join(path.sep, 'home', 'dev');
const ROOT = path.join(path.sep, 'work', 'myapp');

test('project scope keeps every path under the project root', () => {
  const t = resolveTargets({ scope: 'project', root: ROOT, home: HOME, env: {} });
  assert.equal(t.canonical, path.join(ROOT, '.agents', 'skills'));
  assert.equal(t.agentDirs.claude, path.join(ROOT, '.claude', 'skills'));
  assert.equal(t.agentDirs.codex, path.join(ROOT, '.codex', 'skills'));
});

test('user scope keeps every path under the home dir', () => {
  const t = resolveTargets({ scope: 'user', root: ROOT, home: HOME, env: {} });
  assert.equal(t.canonical, path.join(HOME, '.agents', 'skills'));
  assert.equal(t.agentDirs.claude, path.join(HOME, '.claude', 'skills'));
  assert.equal(t.agentDirs.codex, path.join(HOME, '.codex', 'skills'));
});

test('user scope honors CLAUDE_CONFIG_DIR and CODEX_HOME', () => {
  const env = { CLAUDE_CONFIG_DIR: '/cfg/claude', CODEX_HOME: '/cfg/codex' };
  const t = resolveTargets({ scope: 'user', root: ROOT, home: HOME, env });
  assert.equal(t.agentDirs.claude, path.join('/cfg/claude', 'skills'));
  assert.equal(t.agentDirs.codex, path.join('/cfg/codex', 'skills'));
  assert.equal(t.canonical, path.join(HOME, '.agents', 'skills'), 'canonical ignores agent env vars');
});

test('user scope ignores blank or whitespace-only env overrides', () => {
  const env = { CLAUDE_CONFIG_DIR: '   ', CODEX_HOME: '' };
  const t = resolveTargets({ scope: 'user', root: ROOT, home: HOME, env });
  assert.equal(t.agentDirs.claude, path.join(HOME, '.claude', 'skills'));
  assert.equal(t.agentDirs.codex, path.join(HOME, '.codex', 'skills'));
});

test('project scope ignores the agent env vars entirely', () => {
  const env = { CLAUDE_CONFIG_DIR: '/cfg/claude', CODEX_HOME: '/cfg/codex' };
  const t = resolveTargets({ scope: 'project', root: ROOT, home: HOME, env });
  assert.equal(t.agentDirs.claude, path.join(ROOT, '.claude', 'skills'));
  assert.equal(t.agentDirs.codex, path.join(ROOT, '.codex', 'skills'));
});

test('defaults home and env from the process when omitted', () => {
  const t = resolveTargets({ scope: 'user' });
  assert.equal(t.canonical, path.join(homedir(), '.agents', 'skills'));
});

test('rejects an unknown scope', () => {
  assert.throws(() => resolveTargets({ scope: 'sideways', root: ROOT }), /sideways/);
});

test('project scope requires a root', () => {
  assert.throws(() => resolveTargets({ scope: 'project' }), /root/);
});

test('exposes a dir for every supported agent', () => {
  const t = resolveTargets({ scope: 'project', root: ROOT, home: HOME, env: {} });
  assert.deepEqual(Object.keys(t.agentDirs).sort(), ['claude', 'codex']);
});

test('workflows dir sits under the claude home for both scopes', () => {
  const env = { CLAUDE_CONFIG_DIR: '/cfg/claude' };
  const project = resolveTargets({ scope: 'project', root: ROOT, home: HOME, env });
  const user = resolveTargets({ scope: 'user', root: ROOT, home: HOME, env });
  assert.equal(project.workflows, path.join(ROOT, '.claude', 'workflows'));
  assert.equal(user.workflows, path.join('/cfg/claude', 'workflows'));
});
