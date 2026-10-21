const { test } = require('node:test');
const assert = require('node:assert/strict');
const { standard, mixed, mixedScenarios } = require('../coverage.js');

const screenshotOdds = { h: 1.37, d: 4.4, a: 9, qh: 1.2, qa: 4.4 };
const cents = value => Math.round(value * 100);
const near = (actual, expected, tolerance = .005) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('the existing recovery strategy still recovers the first selected outcome', () => {
  const result = standard({ total: 60000, odds: { h: 2.4, d: 3, a: 3.1 }, first: 'd', second: 'a' });
  assert.deepEqual(result.stakes, { h: 0, d: 20000, a: 40000 });
  assert.deepEqual(result.scenarios.map(s => s.net), [-60000, 0, 64000]);
});

test('the existing balanced strategy preserves the budget with cent rounding', () => {
  const result = standard({ total: 60000, odds: { h: 2.4, d: 3, a: 3.1 }, first: 'd', second: 'a', mode: 'balanced' });
  assert.equal(cents(result.stakes.d) + cents(result.stakes.a), 6000000);
  near(result.scenarios[1].net, result.scenarios[2].net, .03);
  assert.equal(result.scenarios[0].net, -60000);
});

test('screenshot: qualification covers elimination, and penalty qualification is an accepted loss', () => {
  const result = mixed({ total: 10000, odds: screenshotOdds, favorite: 'a' });
  assert.equal(result.allocationType, 'qualification');
  assert.deepEqual(result.stakes, { h: 0, d: 0, a: 0, qh: 10000, qa: 0 });
  assert.equal(result.minimumCoveredNet, 2000);
  assert.equal(result.maximumAcceptedLoss, 10000);
  const outcomes = Object.fromEntries(result.scenarios.map(s => [s.id, s]));
  assert.equal(outcomes['d:a'].net, -10000);
  assert.equal(outcomes['d:a'].accepted, true);
  assert.equal(outcomes['d:h'].net, 2000);
  assert.equal(outcomes['d:h'].accepted, false);
});

test('better match odds can make the opponent-win/draw pair the preferred allocation', () => {
  const result = mixed({ total: 10000, odds: { h: 4, d: 4, a: 2, qh: 1.5, qa: 2 }, favorite: 'a' });
  assert.equal(result.allocationType, 'result');
  assert.deepEqual(result.stakes, { h: 5000, d: 5000, a: 0, qh: 0, qa: 0 });
  assert.equal(result.minimumCoveredNet, 10000);
  assert.equal(result.scenarios.find(s => s.id === 'd:a').net, 10000);
  assert.equal(result.scenarios.find(s => s.id === 'a:a').net, -10000);
});

test('choosing the home team reverses the coverage correctly', () => {
  const result = mixed({ total: 10000, odds: screenshotOdds, favorite: 'h' });
  assert.equal(result.stakes.qa, 10000);
  assert.equal(result.stakes.qh, 0);
  assert.equal(result.minimumCoveredNet, 34000);
  assert.equal(result.scenarios.find(s => s.id === 'h:h').accepted, true);
  assert.equal(result.scenarios.find(s => s.id === 'a:a').accepted, false);
});

test('single-leg scenarios exclude a team winning at 90 minutes and its opponent qualifying', () => {
  assert.deepEqual(mixedScenarios('a').map(s => s.id), ['h:h', 'd:h', 'd:a', 'a:a']);
});

test('two-leg ties accept winning OR qualifying, including opposite match and tie winners', () => {
  const scenarios = mixedScenarios('a', 'tie');
  assert.equal(scenarios.length, 6);
  assert.equal(scenarios.find(s => s.id === 'a:h').accepted, true);
  assert.equal(scenarios.find(s => s.id === 'h:a').accepted, true);
  assert.deepEqual(scenarios.filter(s => !s.accepted).map(s => s.id), ['h:h', 'd:h']);
});

test('the two-leg display adds scenarios without falsely changing the coverage target', () => {
  const single = mixed({ total: 10001, odds: screenshotOdds, favorite: 'a' });
  const tie = mixed({ total: 10001, odds: screenshotOdds, favorite: 'a', format: 'tie' });
  assert.deepEqual(single.stakes, tie.stakes);
  assert.equal(single.minimumCoveredNet, tie.minimumCoveredNet);
  assert.equal(tie.scenarios.find(s => s.id === 'a:h').net, 2000.2);
});

test('equal continuous returns prefer a single qualification bet', () => {
  const result = mixed({ total: 10000, odds: { h: 4, d: 4, a: 2, qh: 2, qa: 2 }, favorite: 'a' });
  assert.equal(result.allocationType, 'qualification');
});

test('small budgets remain nonnegative and the full cent budget is conserved', () => {
  for (const total of [.01, .02, .03, 1.01, 999.99]) {
    const result = mixed({ total, odds: { h: 6, d: 4, a: 2, qh: 1.01, qa: 2 }, favorite: 'a' });
    assert.equal(Object.values(result.stakes).reduce((sum, stake) => sum + cents(stake), 0), cents(total));
    assert.ok(Object.values(result.stakes).every(stake => stake >= 0));
    assert.ok(result.scenarios.every(s => Number.isFinite(s.net) && s.net >= -total));
  }
});

test('varied odds match the analytical maximum minimum payout within cent rounding', () => {
  let seed = 79317;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let iteration = 0; iteration < 500; iteration++) {
    const odds = Object.fromEntries(['h', 'd', 'a', 'qh', 'qa'].map(key => [key, 1.01 + Math.floor(random() * 2000) / 100]));
    const favorite = iteration % 2 ? 'h' : 'a';
    const opponent = favorite === 'h' ? 'a' : 'h';
    const total = (1 + Math.floor(random() * 10000000)) / 100;
    const result = mixed({ total, odds, favorite, format: iteration % 3 ? 'single' : 'tie' });
    const effectiveOdds = 1 / (1 / odds[opponent] + 1 / odds.d);
    const analyticalNet = total * (Math.max(odds['q' + opponent], effectiveOdds) - 1);
    near(result.minimumCoveredNet, analyticalNet, Math.max(...Object.values(odds)) / 100 + .02);
    assert.equal(Object.values(result.stakes).reduce((sum, stake) => sum + cents(stake), 0), cents(total));
    assert.equal(result.stakes[favorite], 0);
    assert.equal(result.stakes['q' + favorite], 0);
    for (const scenario of result.scenarios) {
      const payout = scenario.winners.reduce((sum, key) => sum + Math.round(cents(result.stakes[key]) * odds[key]), 0);
      assert.equal(cents(scenario.net), payout - cents(total));
    }
  }
});

test('invalid and unrepresentable money or odds cannot produce a recommendation', () => {
  for (const total of [NaN, Infinity, 0, -.01, .001, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => mixed({ total, odds: screenshotOdds, favorite: 'a' }));
  }
  for (const bad of [NaN, Infinity, -1, 0, 1]) {
    assert.throws(() => mixed({ total: 10000, odds: { ...screenshotOdds, qh: bad }, favorite: 'a' }));
  }
  assert.throws(() => mixed({ total: 10000, odds: { ...screenshotOdds, qh: 1e300 }, favorite: 'a' }));
  assert.throws(() => mixed({ total: 10000, odds: screenshotOdds, favorite: 'd' }));
  assert.throws(() => mixed({ total: 10000, odds: screenshotOdds, favorite: 'a', format: 'unknown' }));
});

test('qualification requires both prices, while standard mode ignores hidden qualification inputs', () => {
  const odds = { h: 2.4, d: 3, a: 3.1, qh: NaN, qa: NaN };
  assert.throws(() => mixed({ total: 60000, odds, favorite: 'a' }));
  assert.doesNotThrow(() => standard({ total: 60000, odds, first: 'd', second: 'a' }));
  assert.throws(() => standard({ total: 60000, odds, first: 'd', second: 'd' }));
});

test('mixed recovery restores break-even on the selected scenario and differs from balancing', () => {
  const recovery = mixed({ total: 10000, odds: screenshotOdds, favorite: 'a', mode: 'recovery', first: 'd' });
  const balanced = mixed({ total: 10000, odds: screenshotOdds, favorite: 'a', mode: 'balanced' });
  assert.deepEqual(recovery.stakes, { h: 1666.67, d: 0, a: 0, qh: 8333.33, qa: 0 });
  assert.equal(recovery.mode, 'recovery');
  assert.equal(recovery.scenarios.find(s => s.id === 'd:h').net, 0);
  assert.equal(recovery.scenarios.find(s => s.id === 'h:h').net, 2283.34);
  assert.equal(recovery.scenarios.find(s => s.id === 'd:a').net, -10000);
  assert.equal(balanced.scenarios.find(s => s.id === 'd:h').net, 2000);
  assert.equal(balanced.scenarios.find(s => s.id === 'h:h').net, 2000);
});

test('mixed recovery can reverse which elimination outcome recovers the budget first', () => {
  const result = mixed({ total: 10000, odds: screenshotOdds, favorite: 'a', mode: 'recovery', first: 'h' });
  assert.deepEqual(result.stakes, { h: 0, d: 1666.67, a: 0, qh: 8333.33, qa: 0 });
  assert.equal(result.first, 'h');
  assert.equal(result.second, 'd');
  assert.equal(result.scenarios.find(s => s.id === 'h:h').net, 0);
  assert.equal(result.scenarios.find(s => s.id === 'd:h').net, 7333.35);
});

test('mixed recovery uses match results when they leave a higher secondary payout', () => {
  const result = mixed({ total: 10000, odds: { h: 4, d: 4, a: 2, qh: 1.5, qa: 2 }, favorite: 'a', mode: 'recovery', first: 'd' });
  assert.deepEqual(result.stakes, { h: 7500, d: 2500, a: 0, qh: 0, qa: 0 });
  assert.equal(result.scenarios.find(s => s.id === 'd:h').net, 0);
  assert.equal(result.scenarios.find(s => s.id === 'h:h').net, 20000);
});

test('mixed recovery conserves small budgets and covers the selected outcome for either team', () => {
  for (const favorite of ['h', 'a']) {
    const opponent = favorite === 'h' ? 'a' : 'h';
    for (const first of ['d', opponent]) {
      for (const total of [.01, .02, .03, 1.01, 10000.01]) {
        const result = mixed({ total, odds: screenshotOdds, favorite, first, mode: 'recovery', format: 'tie' });
        assert.equal(Object.values(result.stakes).reduce((sum, stake) => sum + cents(stake), 0), cents(total));
        assert.ok(Object.values(result.stakes).every(stake => stake >= 0));
        assert.ok(result.scenarios.find(s => s.id === first + ':' + opponent).net >= 0);
        assert.ok(result.minimumCoveredNet >= 0);
      }
    }
  }
});

test('mixed recovery respects its target and the analytical secondary payout across varied odds', () => {
  let seed = 8871;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let iteration = 0; iteration < 200; iteration++) {
    const odds = Object.fromEntries(['h', 'd', 'a', 'qh', 'qa'].map(key => [key, 1.01 + Math.floor(random() * 2000) / 100]));
    const favorite = iteration % 2 ? 'h' : 'a';
    const opponent = favorite === 'h' ? 'a' : 'h';
    const first = iteration % 3 ? 'd' : opponent;
    const second = first === 'd' ? opponent : 'd';
    const total = (1 + Math.floor(random() * 10000000)) / 100;
    const result = mixed({ total, odds, favorite, first, mode: 'recovery' });
    const firstResultNet = total * (1 - 1 / odds[first]) * odds[second] - total;
    const firstQualificationNet = total * (1 - 1 / odds['q' + opponent]) * odds[second];
    const secondaryNet = result.scenarios.find(s => s.id === second + ':' + opponent).net;
    near(secondaryNet, Math.max(firstResultNet, firstQualificationNet), Math.max(...Object.values(odds)) / 100 + .02);
    assert.ok(result.scenarios.find(s => s.id === first + ':' + opponent).net >= 0);
    assert.equal(Object.values(result.stakes).reduce((sum, stake) => sum + cents(stake), 0), cents(total));
  }
});

test('mixed recovery rejects a favorable outcome as the recovery target or an unknown strategy', () => {
  assert.throws(() => mixed({ total: 10000, odds: screenshotOdds, favorite: 'a', mode: 'recovery', first: 'a' }));
  assert.throws(() => mixed({ total: 10000, odds: screenshotOdds, favorite: 'a', mode: 'other' }));
});
