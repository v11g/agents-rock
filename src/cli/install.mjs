import { cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { listSkills } from './registry.mjs';

export function installPlugin({ pluginDir, targets, agents, force = false }) {
  const result = { installed: [], skipped: [], reused: [] };
  for (const skill of listSkills(pluginDir)) {
    const canonical = copyCanonical({ skill, targets, force, result });
    for (const agent of agents) {
      linkAgent({ skill: skill.name, canonical, agent, targets, force, result });
    }
  }
  return result;
}

const NOT_SHIPPED = new Set(['evals']);

function shipsToUsers(src) {
  return !NOT_SHIPPED.has(path.basename(src));
}

function copyCanonical({ skill, targets, force, result }) {
  const dest = path.join(targets.canonical, skill.name);
  if (existsSync(dest) && !force) {
    result.reused.push({ skill: skill.name, path: dest });
    return dest;
  }
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(skill.dir, dest, { recursive: true, filter: shipsToUsers });
  return dest;
}

function linkAgent({ skill, canonical, agent, targets, force, result }) {
  const linkPath = path.join(targets.agentDirs[agent], skill);
  const status = inspectLink(linkPath, canonical);
  if (status === 'correct') return result.installed.push({ skill, agent, mode: 'linked' });
  if (status === 'occupied' && !force) {
    return result.skipped.push({ skill, agent, path: linkPath, reason: 'exists (use --force)' });
  }
  if (status !== 'missing') rmSync(linkPath, { recursive: true, force: true });
  mkdirSync(path.dirname(linkPath), { recursive: true });
  result.installed.push({ skill, agent, mode: createLink(canonical, linkPath) });
}

function inspectLink(linkPath, canonical) {
  let stat;
  try { stat = lstatSync(linkPath); } catch { return 'missing'; }
  if (!stat.isSymbolicLink()) return 'occupied';
  const target = path.resolve(path.dirname(linkPath), readlinkSync(linkPath));
  return target === path.resolve(canonical) ? 'correct' : 'occupied';
}

function createLink(canonical, linkPath) {
  const relTarget = path.relative(path.dirname(linkPath), canonical);
  try {
    symlinkSync(relTarget, linkPath, 'dir');
    return 'symlink';
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EACCES') throw err;
    return fallbackLink(canonical, linkPath);
  }
}

function fallbackLink(canonical, linkPath) {
  try {
    symlinkSync(path.resolve(canonical), linkPath, 'junction');
    return 'junction';
  } catch {
    cpSync(canonical, linkPath, { recursive: true });
    return 'copy';
  }
}
