// Ties §4 Solution Strategy to §13's top-3 quality goals: every decision names
// a goal it serves, every goal is served by some decision. A set written before
// top-3 goals existed (§13 with no Goal column, §4 as bullets) warns instead of
// failing, so a rewrite the user declined never blocks the viewer.
import {
  sectionBody, sectionTable, goalCells, isGivesWay, isNotProvided, nameOf,
} from './strategy-sections.mjs';

const fail = (message) => ({ check: 'strategy', message });

// `tables` is ignored: tables are read from archMd so a table under a ###
// subheading of §4 or §13 is found.
export function validateStrategy({ archMd }) {
  const goals = sectionTable(archMd, /Quality Requirements/i, /^goal$/i);
  const strategy = sectionTable(archMd, /Solution Strategy/i, /^serves$/i);
  const cells = goalCells(goals);
  const real = (cells ?? []).filter((c) => !isNotProvided(c));
  return [
    ...checkGoals(goals, cells),
    ...checkStrategyShape(strategy, sectionBody(archMd, /Solution Strategy/i)),
    ...(real.length && strategy ? checkServes(real, strategy) : []),
  ];
}

function checkGoals(t, cells) {
  if (!t) return [];
  if (!cells) return [{ ...fail('§13 predates top-3 goals (no Goal column); rewrite as Goal · Target · Brief says · src'), level: 'warn' }];
  const out = cells.length === 3 ? [] : [fail(`§13 has ${cells.length} goal rows, expected 3`)];
  const marked = cells.filter(isGivesWay).length;
  const needOne = cells.filter((c) => !isNotProvided(c)).length >= 2;
  if (needOne ? marked !== 1 : marked > 1) {
    out.push(fail(`§13 marks ${marked} goals "(gives way first)", expected ${needOne ? 'exactly 1' : 'at most 1'}`));
  }
  return out;
}

function checkStrategyShape(strategy, body) {
  if (strategy || !/^\s*[-*] /m.test(body)) return [];
  return [{ ...fail('§4 is a list; rewrite as a Decision · Serves · ADR · src table'), level: 'warn' }];
}

function checkServes(real, strategy) {
  const col = strategy.headers.findIndex((h) => /^serves$/i.test(h));
  if (col === -1) return [fail('§4 table has no Serves column')];
  const goals = real.map(nameOf);
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
