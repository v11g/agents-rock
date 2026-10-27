import { homedir } from 'node:os';
import path from 'node:path';
import { UsageError } from './args.mjs';
import { AGENT_HOMES, ALL_AGENTS } from './agents.mjs';

const CANONICAL = ['.agents', 'skills'];

/**
 * Resolve every path an install writes to. Both scopes share one shape —
 * a canonical skills dir, one skills dir per agent, and Claude's workflows
 * dir — so install and uninstall stay scope-agnostic.
 */
export function resolveTargets({ scope, root, home = homedir(), env = process.env }) {
  if (scope === 'project') return projectTargets(requireRoot(root));
  if (scope === 'user') return userTargets(home, env);
  throw new UsageError(`Unknown scope: ${scope}`);
}

function requireRoot(root) {
  if (!root) throw new UsageError('Project scope needs a project root.');
  return root;
}

function projectTargets(root) {
  return {
    canonical: path.join(root, ...CANONICAL),
    agentDirs: mapAgents((agent) => path.join(root, AGENT_HOMES[agent].dir, 'skills')),
    workflows: path.join(root, AGENT_HOMES.claude.dir, 'workflows'),
  };
}

function userTargets(home, env) {
  return {
    canonical: path.join(home, ...CANONICAL),
    agentDirs: mapAgents((agent) => path.join(agentHome(agent, home, env), 'skills')),
    workflows: path.join(agentHome('claude', home, env), 'workflows'),
  };
}

function agentHome(agent, home, env) {
  const { dir, env: key } = AGENT_HOMES[agent];
  return env[key]?.trim() || path.join(home, dir);
}

function mapAgents(dirFor) {
  return Object.fromEntries(ALL_AGENTS.map((agent) => [agent, dirFor(agent)]));
}
