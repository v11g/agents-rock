// The facts on a workflow proposal page are rendered from data; what the
// agent writes is sentences (proposal-inputs.json). These checks hold the
// sentences to the client rules: complete, no prices (the price comes only
// from the estimate), no internal IDs, no jargon for a non-tech reader.
import { milestoneView } from '../../../estimate/workflow-based/scripts/lib/page-view.mjs';
import { JARGON } from './jargon.mjs';
import { escapeRegExp } from './sections.mjs';

const TECH_LEVELS = ['non-tech', 'low-tech', 'technical'];
const CODES = 'USD|SGD|EUR|GBP|AUD|NZD|CAD|CHF|JPY|CNY|RMB|HKD|MYR|RM|IDR|INR|THB|VND|KRW|TWD';
const WORDS = 'dollars?|euros?|pounds?|ringgit|yen|rupees?|baht|dong';
const NUM = '\\d[\\d,.]*\\s?(?:k|m|mn|bn|million|thousand|billion)?';
const MONEY = new RegExp(`\\p{Sc}\\s?${NUM}|\\b(?:${CODES})\\s?${NUM}|${NUM}\\s?(?:${CODES}|${WORDS})\\b`, 'iu');
// Engineer milestone names ("M1 - Walking skeleton") never reach the client (P6).
const ID = /\b(?:FEAT|FR|NFR|SYS|WF|BR|ASM|INT|SC|Q)-\d+|\bM\d+ - /;
const filled = (v) => typeof v === 'string' && v.trim() !== '';

function checkRequired(inputs, out) {
  for (const key of ['client', 'title', 'firm', 'scopeIntro']) {
    if (!filled(inputs[key])) out.push(`proposal-inputs.json: missing "${key}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inputs.date ?? '') || Number.isNaN(Date.parse(inputs.date))) {
    out.push('proposal-inputs.json: "date" must be an ISO date (YYYY-MM-DD)');
  }
  if (!TECH_LEVELS.includes(inputs.techLevel)) out.push(`proposal-inputs.json: "techLevel" must be ${TECH_LEVELS.join(' | ')}`);
}

function checkKeys({ inputs, est, req }, out) {
  const used = milestoneView(est).map((m) => m.name);
  const ms = inputs.milestones ?? {};
  for (const name of used) {
    if (!filled(ms[name]?.name) || !filled(ms[name]?.demonstrates)) out.push(`milestone "${name}": needs a client "name" and "demonstrates"`);
  }
  for (const key of Object.keys(ms)) if (!used.includes(key)) out.push(`milestones: "${key}" is not a milestone of this estimate`);
  for (const [key, text] of Object.entries(inputs.systems ?? {})) {
    if (!req.systemById[key]) out.push(`systems: "${key}" is not a system in requirements.json`);
    else if (!filled(text)) out.push(`systems: "${key}" needs a sentence or no entry`);
  }
}

export function sentences(inputs) {
  const out = [['title', inputs.title], ['scopeIntro', inputs.scopeIntro]];
  for (const [id, text] of Object.entries(inputs.systems ?? {})) out.push([`systems.${id}`, text]);
  for (const [id, m] of Object.entries(inputs.milestones ?? {})) {
    out.push([`milestones.${id}.name`, m?.name], [`milestones.${id}.demonstrates`, m?.demonstrates]);
  }
  return out.filter(([, text]) => filled(text));
}

const jargonIn = (text, allow) => JARGON.filter((t) => !allow.has(t)
  && new RegExp(`(?<![\\w/])${escapeRegExp(t)}(?:e?s)?(?![\\w/])`, 'i').test(text));

function checkSentences(inputs, out) {
  const allow = new Set((Array.isArray(inputs.jargonAllow) ? inputs.jargonAllow : []).map((w) => String(w).toLowerCase()));
  for (const [where, text] of sentences(inputs)) {
    const money = MONEY.exec(text);
    if (money) out.push(`${where}: price "${money[0]}" — prices come only from the estimate`);
    const id = ID.exec(text);
    if (id) out.push(`${where}: internal ID "${id[0]}" — name the thing in words`);
    if (inputs.techLevel !== 'non-tech') continue;
    for (const term of jargonIn(text, allow)) out.push(`${where}: jargon for a non-tech client: "${term}" (rewrite plainly or add to jargonAllow)`);
  }
}

export function checkProposalInputs({ inputs, est, req }) {
  const out = [];
  checkRequired(inputs, out);
  checkKeys({ inputs, est, req }, out);
  checkSentences(inputs, out);
  return out;
}
