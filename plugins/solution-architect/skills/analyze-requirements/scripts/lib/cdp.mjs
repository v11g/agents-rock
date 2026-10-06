// A browser, with no dependency added to reach one.
//
// Everything about the viewer had been verified by reading the template as text.
// That catches a missing rule; it cannot catch a rule that is present and loses,
// a script that throws on boot, or a font that is embedded and never applied —
// and those are the failures a single-file offline viewer actually has.
//
// Node 22+ ships a global WebSocket and fetch, and Chrome speaks DevTools over
// both, so the whole driver is this file plus chrome.mjs. `npm ls` still reports
// zero dependencies, which is the property that made shipping the viewer as one
// file worth doing in the first place.
import { launch, waitFor } from './chrome.mjs';

function connect(url) {
  return new Promise((ok, no) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ok(ws), { once: true });
    ws.addEventListener('error', () => no(new Error('devtools socket refused')), { once: true });
  });
}

// One socket carries every command and every event, correlated by id. A message
// with no id is an event, which the console collector below subscribes to.
function sender(ws, onEvent) {
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id === undefined) return onEvent(msg);
    const slot = waiting.get(msg.id);
    waiting.delete(msg.id);
    return slot && (msg.error ? slot.no(new Error(msg.error.message)) : slot.ok(msg.result));
  });
  return (method, params) => new Promise((ok, no) => {
    id += 1;
    waiting.set(id, { ok, no });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function evaluator(send) {
  return async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? 'page threw');
    }
    return r.result.value;
  };
}

// Errors are collected from the moment Runtime is enabled, so a throw during boot
// is caught rather than missed by a check that runs once the page has settled.
function collector() {
  const errors = [];
  const onEvent = (msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description ?? 'uncaught');
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };
  return { errors, onEvent };
}

export async function openPage(fileUrl) {
  const chrome = await launch(fileUrl);
  const ws = await connect(chrome.wsUrl);
  const { errors, onEvent } = collector();
  const send = sender(ws, onEvent);
  await send('Runtime.enable');
  const evaluate = evaluator(send);
  // A fresh tab can report a complete about:blank before it navigates to the
  // file; on a slow runner the checks then read an empty page.
  await waitFor(() => evaluate('location.href !== "about:blank" && document.readyState === "complete"'),
    'a loaded document');
  return { eval: evaluate, errors, send, close() { ws.close(); chrome.kill(); } };
}
