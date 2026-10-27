import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function loadRegistry(pluginsDir) {
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readPlugin(path.join(pluginsDir, entry.name)))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readPlugin(dir) {
  const manifest = path.join(dir, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifest)) return null;
  const meta = JSON.parse(readFileSync(manifest, 'utf8'));
  return { name: meta.name, description: meta.description ?? '', version: meta.version ?? '', dir };
}

export function listSkills(pluginDir) {
  const skillsDir = path.join(pluginDir, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, dir: path.join(skillsDir, entry.name) }));
}

export function listWorkflows(pluginDir) {
  const workflowsDir = path.join(pluginDir, 'workflows');
  if (!existsSync(workflowsDir)) return [];
  return readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => ({ name: entry.name, file: path.join(workflowsDir, entry.name) }));
}
