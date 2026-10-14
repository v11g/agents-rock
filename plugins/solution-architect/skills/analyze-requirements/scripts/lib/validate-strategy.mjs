// Ties §4 Solution Strategy to §13's top-3 quality goals: every decision names
// a goal it serves, every goal is served by some decision. A set written before
// top-3 goals existed (§13 with no Goal column, §4 as bullets) warns instead of
// failing, so a rewrite the user declined never blocks the viewer.
const GIVES_WAY = /\(gives way first\)/i;
const NOT_PROVIDED = /^Not provided/i;

const fail = (message) => ({ check: 'strategy', message });
const nameOf = (cell) => cell.replace(GIVES_WAY, '').trim().toLowerCase();

export function validateStrategy({ tables, archMd }) {
  const goals = tables.find((t) => /Quality Requirements/i.test(t.section));
  const strategy = tables.find((t) => /Solution Strategy/i.test(t.section));
  const cells = goalCells(goals);
  return [
    ...checkGoals(goals, cells),
    ...checkStrategyShape(strategy, sectionBody(archMd, /Solution Strategy/i)),
    ...(cells && strategy ? checkServes(cells, strategy) : []),
  ];
}

// `^## ` never matches `### `, so a subheading stays inside its section.
function sectionBody(md, title) {
  const chunk = md.split(/^## /m).find((c) => title.test(c.split('\n')[0]));
  return chunk ? chunk.slice(chunk.indexOf('\n') + 1) : '';
}

function goalCells(t) {
  const col = (t?.headers ?? []).findIndex((h) => /^goal$/i.test(h));
  return col === -1 ? null : t.rows.map((r) => r[col] ?? '');
}

function checkGoals(t, cells) {
  if (!t) return [];
  if (!cells) return [{ ...fail('§13 predates top-3 goals (no Goal column); rewrite as Goal · Target · Brief says · src'), level: 'warn' }];
  const out = cells.length === 3 ? [] : [fail(`§13 has ${cells.length} goal rows, expected 3`)];
  const marked = cells.filter((c) => GIVES_WAY.test(c)).length;
  const needOne = cells.filter((c) => !NOT_PROVIDED.test(c)).length >= 2;
  if (needOne ? marked !== 1 : marked > 1) {
    out.push(fail(`§13 marks ${marked} goals "(gives way first)", expected ${needOne ? 'exactly 1' : 'at most 1'}`));
  }
  return out;
}

function checkStrategyShape(strategy, body) {
  if (strategy || !/^\s*[-*] /m.test(body)) return [];
  return [{ ...fail('§4 is a list; rewrite as a Decision · Serves · ADR · src table'), level: 'warn' }];
}

function checkServes(cells, strategy) {
  const col = strategy.headers.findIndex((h) => /^serves$/i.test(h));
  if (col === -1) return [fail('§4 table has no Serves column')];
  const goals = cells.filter((c) => !NOT_PROVIDED.test(c)).map(nameOf);
  const rows = strategy.rows.map((r) => ({
    decision: r[0],
    serves: (r[col] ?? '').split(',').map(nameOf).filter(Boolean),
  }));
  return [...rowFindings(rows, goals), ...unservedFindings(rows, goals)];
}

function rowFindings(rows, goals) {
  return rows.flatMap(({ decision, serves }) => {
    if (!serves.length) return [fail(`§4 "${decision}" serves no goal`)];
    return serves.filter((s) => !goals.includes(s))
      .map((s) => fail(`§4 "${decision}" serves "${s}", not a §13 goal`));
  });
}

function unservedFindings(rows, goals) {
  const served = new Set(rows.flatMap((r) => r.serves));
  return goals.filter((g) => !served.has(g))
    .map((g) => fail(`§13 goal "${g}" is served by no §4 decision`));
}
