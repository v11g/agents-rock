// Finding, starting and addressing a headless Chrome. The DevTools protocol
// itself is cdp.mjs' business; this file only gets a socket URL to hand it.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CANDIDATES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

// Returns null rather than throwing: a machine without Chrome should skip the
// browser checks, not fail a suite that has nothing to do with it.
export function findChrome() {
  for (const bin of CANDIDATES) {
    try {
      return execFileSync('which', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { /* try the next name */ }
  }
  return null;
}

// --remote-debugging-port=0 lets the OS choose and Chrome writes the chosen port
// into the profile directory. A hard-coded port makes two runs on one machine
// collide, which in a test suite reads as a flake rather than as a conflict.
const FLAGS = [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run',
  '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
  '--hide-scrollbars', '--window-size=1440,900',
];

export async function waitFor(read, what) {
  for (let i = 0; i < 150; i += 1) {
    const got = await read();
    if (got) return got;
    await sleep(100);
  }
  throw new Error(`chrome never produced ${what}`);
}

function portFile(dir) {
  const file = join(dir, 'DevToolsActivePort');
  if (!existsSync(file)) return null;
  return Number(readFileSync(file, 'utf8').split('\n')[0]) || null;
}

async function pageSocket(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
}

export async function launch(fileUrl) {
  const chrome = findChrome();
  if (!chrome) throw new Error('no chrome on PATH');
  const dir = mkdtempSync(join(tmpdir(), 'analyze-requirements-chrome-'));
  const proc = spawn(chrome, [...FLAGS, `--user-data-dir=${dir}`, fileUrl], { stdio: 'ignore' });
  const port = await waitFor(() => portFile(dir), 'a devtools port');
  const wsUrl = await waitFor(() => pageSocket(port), 'a page target');
  return {
    wsUrl,
    kill() {
      proc.kill('SIGKILL');
      // SIGKILL is asynchronous: Chrome can still be flushing its profile dir
      // when rm starts, which surfaces as ENOTEMPTY in CI. Node retries
      // ENOTEMPTY/EBUSY when maxRetries is set.
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}
