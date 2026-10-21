/* Shared calculation engine. Amounts are allocated in cents before settlement. */
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.BbetiaCoverage = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const resultKeys = ['h', 'd', 'a'];
  const mixedKeys = [...resultKeys, 'qh', 'qa'];

  function budgetInCents(total) {
    const cents = Math.round(total * 100);
    if (!Number.isFinite(total) || total <= 0 || !Number.isSafeInteger(cents) || cents < 1) {
      throw new Error('Ingresá un monto válido mayor a cero.');
    }
    return cents;
  }

  function validateOdds(odds, keys) {
    if (!keys.every(key => Number.isFinite(odds[key]) && odds[key] > 1)) {
      throw new Error('Ingresá cuotas decimales mayores a 1 en todos los campos visibles.');
    }
  }

  function evaluate(cents, odds, stakesInCents, scenarios) {
    const stakes = Object.fromEntries(Object.entries(stakesInCents).map(([key, value]) => [key, value / 100]));
    return {
      total: cents / 100,
      stakes,
      scenarios: scenarios.map(scenario => {
        const payout = scenario.winners.reduce((sum, key) => sum + Math.round((stakesInCents[key] || 0) * odds[key]), 0);
        if (!Number.isSafeInteger(payout)) throw new Error('El monto y las cuotas exceden el rango de cálculo.');
        return { ...scenario, payout: payout / 100, net: (payout - cents) / 100 };
      })
    };
  }

  function standard({ total, odds, first, second, mode = 'recovery' }) {
    const cents = budgetInCents(total);
    validateOdds(odds, resultKeys);
    if (!resultKeys.includes(first) || !resultKeys.includes(second) || first === second) {
      throw new Error('Elegí dos resultados diferentes para cubrir.');
    }
    const firstShare = mode === 'balanced'
      ? odds[second] / (odds[first] + odds[second])
      : 1 / odds[first];
    const stakes = { h: 0, d: 0, a: 0 };
    stakes[first] = Math.round(cents * firstShare);
    stakes[second] = cents - stakes[first];
    return evaluate(cents, odds, stakes, resultKeys.map(key => ({
      id: key, result: key, qualifier: null, winners: [key], accepted: ![first, second].includes(key)
    })));
  }

  function mixedScenarios(favorite, format = 'single') {
    if (!['h', 'a'].includes(favorite)) throw new Error('Elegí tu equipo.');
    if (!['single', 'tie'].includes(format)) throw new Error('Elegí un formato válido.');
    const outcomes = format === 'tie'
      ? [['h', 'h'], ['h', 'a'], ['d', 'h'], ['d', 'a'], ['a', 'h'], ['a', 'a']]
      : [['h', 'h'], ['d', 'h'], ['d', 'a'], ['a', 'a']];
    return outcomes.map(([result, qualifier]) => ({
      id: result + ':' + qualifier,
      result,
      qualifier,
      winners: [result, 'q' + qualifier],
      // The user's explicit criterion is "wins OR advances", also in two-leg ties.
      accepted: result === favorite || qualifier === favorite
    }));
  }

  function mixed({ total, odds, favorite, format = 'single' }) {
    const cents = budgetInCents(total);
    validateOdds(odds, mixedKeys);
    const scenarios = mixedScenarios(favorite, format);
    const opponent = favorite === 'h' ? 'a' : 'h';
    const qualification = 'q' + opponent;
    const empty = () => ({ h: 0, d: 0, a: 0, qh: 0, qa: 0 });

    // Only these two states require compensation: opponent wins and advances,
    // or draw and opponent advances. Favorite-win and favorite-qualification
    // bets pay neither of them. Let z be the qualification stake. For a fixed z,
    // equalizing the other two payouts gives the maximum minimum payout:
    //   z * qualificationOdds + (budget - z) / (1/opponentOdds + 1/drawOdds).
    // This is linear in z, so a continuous optimum is at one of the endpoints:
    // qualification only, or the opponent-win/draw pair. There is no benefit
    // from forcing all five bets into the allocation. Compare the rounded pair
    // on both adjacent cents and the qualification endpoint for actual display.
    const qualifyStakes = empty();
    qualifyStakes[qualification] = cents;
    const candidates = [{ ...evaluate(cents, odds, qualifyStakes, scenarios), allocationType: 'qualification' }];
    const split = cents * odds.d / (odds[opponent] + odds.d);
    for (const first of new Set([Math.floor(split), Math.ceil(split)])) {
      const stakes = empty();
      stakes[opponent] = first;
      stakes.d = cents - first;
      candidates.push({ ...evaluate(cents, odds, stakes, scenarios), allocationType: 'result' });
    }
    const score = candidate => Math.min(...candidate.scenarios.filter(scenario => !scenario.accepted).map(scenario => scenario.net));
    const best = candidates.reduce((current, candidate) => score(candidate) > score(current) + 0.0001 ? candidate : current);
    return {
      ...best,
      favorite,
      format,
      minimumCoveredNet: score(best),
      maximumAcceptedLoss: Math.max(0, -Math.min(...best.scenarios.filter(scenario => scenario.accepted).map(scenario => scenario.net)))
    };
  }

  return { standard, mixed, mixedScenarios };
});
