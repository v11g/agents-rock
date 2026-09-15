import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pert, projectBuffer, tierFor, aiAdjust, riskBufferHours, effectiveCapacity,
  scenarioRollup, taskHours, SENIORITY_FACTOR, roadmapBands, dominantSeniority,
} from '../lib/estimate-math.mjs';

const close = (got, want) => assert.ok(Math.abs(got - want) < 1e-9, `${got} !~ ${want}`);

test('pert: E=(O+4M+P)/6, sigma=(P-O)/6', () => {
  const { e, sigma } = pert({ o: 16, m: 24, p: 40 });
  close(e, 152 / 6);
  close(sigma, 4);
});

test('project buffer is sqrt of summed squares, not a naive sum', () => {
  close(projectBuffer([4, 3]), 5);
  close(projectBuffer([]), 0);
});

test('factor scores map to tiers at the documented breaks', () => {
  // user's real example: 2+3+5+3+4 = 17 → M
  assert.deepEqual(tierFor({ complexity: 2, size: 3, dependencies: 5, uncertainty: 3, risk: 4 }),
    { total: 17, tier: 'M' });
  assert.equal(tierFor({ complexity: 1, size: 1, dependencies: 2, uncertainty: 3, risk: 3 }).tier, 'S');
  assert.equal(tierFor({ complexity: 5, size: 4, dependencies: 4, uncertainty: 3, risk: 2 }).tier, 'L');
});

test('tier breaks are the workbook scale: S ≤ 11, M ≤ 17, L ≤ 22, XL above', () => {
  const at = (total) => tierFor({ a: total }).tier;
  assert.equal(at(11), 'S');
  assert.equal(at(12), 'M');
  assert.equal(at(17), 'M');
  assert.equal(at(18), 'L');
  assert.equal(at(22), 'L');
  assert.equal(at(23), 'XL');
});

test('aiAdjust applies (AO + 2AR + TR)/4 plus verification overhead', () => {
  const e = 152 / 6; // boilerplate: red=0.65, redMax=0.8 — category only, no seniority term
  const want = ((e * 0.2 + 2 * (e * 0.35) + e) / 4) * 1.12;
  close(aiAdjust({ e, category: 'boilerplate', verificationPct: 0.12, scale: 1 }), want);
});

test('aiAdjust clamps reduction at 0.9 for outsized scale', () => {
  const got = aiAdjust({ e: 100, category: 'boilerplate', verificationPct: 0, scale: 1.5 });
  const red = 0.9; // 0.65 × 1.5 = 0.975 → clamped
  close(got, (100 * (1 - red) * 3 + 100) / 4); // redMax also clamps to 0.9 so ao == ar
});

test('taskHours: seniority scales base effort on the traditional path', () => {
  const base = { e: 100, aiAssisted: false, category: 'logic', verificationPct: 0.12 };
  close(taskHours({ ...base, seniority: 'senior' }), 85);
  close(taskHours({ ...base, seniority: 'mid' }), 100);
  close(taskHours({ ...base, seniority: 'junior' }), 115);
});

test('taskHours: a senior is never slower than a junior, with or without AI', () => {
  for (const aiAssisted of [false, true]) {
    for (const category of ['boilerplate', 'logic', 'novel']) {
      const at = (seniority) => taskHours({ e: 100, seniority, aiAssisted, category, verificationPct: 0.12 });
      assert.ok(at('senior') < at('mid') && at('mid') < at('junior'),
        `${aiAssisted}/${category}: ${at('senior')} < ${at('mid')} < ${at('junior')} violated`);
    }
  }
});

test('taskHours: AI assistance reduces hours versus the same seniority unaided', () => {
  for (const seniority of Object.keys(SENIORITY_FACTOR)) {
    const at = (aiAssisted) => taskHours({ e: 100, seniority, aiAssisted, category: 'boilerplate', verificationPct: 0.12 });
    assert.ok(at(true) < at(false), `${seniority}: AI ${at(true)} !< ${at(false)}`);
  }
});

// The what-if rail's roster needs the same dominant-seniority rule the
// committed rollup uses — shipping it in the inlined math bundle is what
// keeps the page copy and the Node copy one function.
test('dominantSeniority ships with the math bundle: count wins, ties go senior', () => {
  assert.equal(dominantSeniority([
    { seniority: 'junior' }, { seniority: 'junior' }, { seniority: 'senior' },
  ]), 'junior');
  assert.equal(dominantSeniority([{ seniority: 'senior' }, { seniority: 'junior' }]), 'senior');
});

test('risk buffer is probability times impact, summed', () => {
  close(riskBufferHours([{ probability: 0.3, impactHours: 40 }, { probability: 0.5, impactHours: 16 }]), 20);
});

test('capacity pays a coordination tax per added engineer, floored at one', () => {
  close(effectiveCapacity(1), 1);
  close(effectiveCapacity(2), 1.8);
  close(effectiveCapacity(3), 2.4);
  close(effectiveCapacity(12), 1); // raw formula goes negative past 10 — floor holds
});

test('scenarioRollup: 1008h, 2 mid @45, $100/seat tooling → 4.0mo, $51,200', () => {
  const team = [{ seniority: 'mid', rate: 45 }, { seniority: 'mid', rate: 45 }];
  const got = scenarioRollup({ hours: 1008, team, toolingCostPerSeat: 100 });
  close(got.months, 4);
  close(got.laborCost, 50400);
  close(got.toolingCost, 800);
  close(got.totalCost, 51200);
});

// A null seat cost is an open gap, not free tooling — it prices as zero and
// the interview records the assumption; the math must not turn null into NaN.
test('scenarioRollup: null toolingCostPerSeat prices tooling at zero', () => {
  const team = [{ seniority: 'mid', rate: 45 }];
  const got = scenarioRollup({ hours: 140, team, toolingCostPerSeat: null });
  close(got.toolingCost, 0);
  close(got.totalCost, got.laborCost);
});

test('roadmapBands tiles [0, months] proportionally to hours, in order', () => {
  const bands = roadmapBands({
    milestones: [{ name: 'M1', hours: 60 }, { name: 'M2', hours: 40 }],
    months: 5,
  });
  assert.deepEqual(bands.map((b) => b.name), ['M1', 'M2']);
  close(bands[0].startMonths, 0);
  close(bands[0].endMonths, 3);
  close(bands[1].startMonths, 3);   // no gap: starts where M1 ends
  close(bands[1].endMonths, 5);     // last band ends at total months
});

test('roadmapBands: single milestone spans the whole project', () => {
  const bands = roadmapBands({ milestones: [{ name: 'All', hours: 90 }], months: 4.2 });
  assert.equal(bands.length, 1);
  close(bands[0].startMonths, 0);
  close(bands[0].endMonths, 4.2);
});
