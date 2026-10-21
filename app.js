(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const engine = globalThis.BbetiaCoverage;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Math.abs(value) < .005 ? 0 : value);
  const signedMoney = value => (value > .005 ? '+' : '') + money(value);
  const oddsLabel = value => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value);
  const netClass = value => value > .005 ? 'win' : value < -.005 ? 'loss' : 'neutral';
  const decimalValue = value => {
    const raw = String(value ?? '').trim().replace(/\s/g, '');
    return /^[0-9]+(?:[.,][0-9]*)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  };
  const amountValue = value => {
    const raw = String(value ?? '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return /^[0-9]+(?:\.[0-9]*)?$/.test(raw) ? Number(raw) : NaN;
  };
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const leagueSources = [['arg.1', 'Argentina'], ['bol.1', 'Bolivia'], ['bra.1', 'Brasil'], ['chi.1', 'Chile'], ['col.1', 'Colombia'], ['ecu.1', 'Ecuador'], ['par.1', 'Paraguay'], ['per.1', 'Perú'], ['uru.1', 'Uruguay'], ['ven.1', 'Venezuela']];
  const fallbackClubs = ['Aldosivi', 'Argentinos Juniors', 'Atlético Tucumán', 'Banfield', 'Barracas Central', 'Belgrano', 'Boca Juniors', 'Central Córdoba (SdE)', 'Defensa y Justicia', 'Deportivo Riestra', 'Estudiantes (LP)', 'Estudiantes (RC)', 'Gimnasia (LP)', 'Gimnasia (Mza)', 'Huracán', 'Independiente', 'Independiente Rivadavia', 'Instituto', 'Lanús', 'Newell’s', 'Platense', 'Racing Club', 'River Plate', 'Rosario Central', 'San Lorenzo', 'Sarmiento', 'Talleres', 'Tigre', 'Unión', 'Vélez Sarsfield'];
  const teamAliases = { 'Gimnasia (LP)': 'Gimnasia La Plata', 'Estudiantes (LP)': 'Estudiantes de La Plata', 'Central Córdoba (SdE)': 'Central Córdoba (Santiago del Estero)', 'Newell’s': "Newell's Old Boys" };
  const ids = ['home', 'away', 'customh', 'customa', 'oh', 'od', 'oa', 'qh', 'qa', 'total', 'pick1', 'pick2', 'favorite', 'format', 'mixedFirst'];
  let mode = 'recovery';
  let bets = [];
  let currentCalculation = null;
  let pendingTeamValues = {};
  const logos = {};
  let teamRecords = fallbackClubs.map(name => ({ code: 'arg.1', key: 'arg.1:' + norm(name), name }));

  function isMixed() { return $('includeQualification').checked; }
  function labelFor(key) {
    const select = $(key === 'h' ? 'home' : 'away');
    if (select.value === '__custom') return $(key === 'h' ? 'customh' : 'customa').value.trim() || 'Otro equipo';
    return select.selectedOptions[0]?.dataset.name || select.selectedOptions[0]?.textContent || 'Equipo';
  }
  function marketName(key, names) {
    if (key === 'd') return 'Empate';
    if (key === 'qh' || key === 'qa') return names[key.slice(1)] + ' clasifica';
    return names[key] + ' gana';
  }
  function resultName(names, result) { return result === 'd' ? 'Empate' : 'Gana ' + names[result]; }
  function selectByValueOrName(select, raw) {
    const target = teamAliases[raw] || raw;
    const match = [...select.options].find(option => option.value === raw)
      || [...select.options].find(option => option.dataset.name === raw || option.dataset.name === target || norm(option.dataset.name) === norm(raw) || norm(option.dataset.name) === norm(target));
    if (!match) return false;
    select.value = match.value;
    return true;
  }
  function buildTeamSelects(records, preserve = false) {
    const previous = preserve ? { home: { value: $('home').value, name: labelFor('h') }, away: { value: $('away').value, name: labelFor('a') } } : null;
    for (const id of ['home', 'away']) {
      const select = $(id);
      select.innerHTML = '';
      for (const [code, label] of leagueSources) {
        const teams = records.filter(team => team.code === code).sort((a, b) => a.name.localeCompare(b.name, 'es'));
        if (!teams.length) continue;
        const group = document.createElement('optgroup');
        group.label = label;
        for (const team of teams) {
          const option = document.createElement('option');
          option.value = team.key;
          option.dataset.name = team.name;
          option.textContent = team.name;
          group.append(option);
        }
        select.append(group);
      }
      const custom = document.createElement('option');
      custom.value = '__custom';
      custom.textContent = 'Otro equipo…';
      select.append(custom);
      const matched = previous && (selectByValueOrName(select, previous[id].value) || selectByValueOrName(select, previous[id].name));
      if (!matched) selectByValueOrName(select, id === 'home' ? 'Huracán' : 'Gimnasia (LP)');
    }
  }
  function updateTeams() {
    for (const [key, id] of [['h', 'home'], ['a', 'away']]) {
      const select = $(id);
      $(key === 'h' ? 'customh' : 'customa').hidden = select.value !== '__custom';
      const name = labelFor(key);
      $('name' + key).textContent = name;
      const logo = logos[select.value];
      const img = $('crest' + key);
      const fallback = $('initial' + key);
      fallback.textContent = name.slice(0, 2).toUpperCase();
      img.hidden = !logo;
      fallback.hidden = !!logo;
      if (logo) img.src = logo;
      else img.removeAttribute('src');
    }
    for (const option of $('favorite').options) option.textContent = labelFor(option.value);
    calc();
  }
  function save() {
    try {
      localStorage.setItem('cobertura-v4', JSON.stringify({ mode, includeQualification: isMixed(), values: Object.fromEntries(ids.map(id => [id, $(id).value])) }));
    } catch (_) { /* The calculator also works without browser storage. */ }
  }
  function formatTotal() {
    const digits = $('total').value.replace(/\D/g, '');
    $('total').value = digits ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(digits)) : '';
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem('cobertura-v4') || localStorage.getItem('cobertura-v3') || localStorage.getItem('cobertura-v2'));
      if (!data) return;
      for (const id of ids) {
        if (data.values?.[id] === undefined) continue;
        if (id === 'home' || id === 'away') {
          if (!selectByValueOrName($(id), data.values[id])) pendingTeamValues[id] = data.values[id];
        } else $(id).value = data.values[id];
      }
      mode = data.mode === 'balanced' ? 'balanced' : 'recovery';
      $('includeQualification').checked = data.includeQualification === true;
      if (!['h', 'a'].includes($('favorite').value)) $('favorite').value = 'a';
      if (!['single', 'tie'].includes($('format').value)) $('format').value = 'single';
      if (!['d', 'r'].includes($('mixedFirst').value)) $('mixedFirst').value = 'd';
      formatTotal();
    } catch (_) { /* Ignore damaged saved form data. */ }
  }
  function loadHistory() {
    try {
      const value = JSON.parse(localStorage.getItem('cobertura-history-v1') || '[]');
      bets = Array.isArray(value) ? value.filter(bet => bet && typeof bet.id === 'string' && bet.nets && typeof bet.nets === 'object') : [];
    } catch (_) { bets = []; }
  }
  function saveHistory() {
    try {
      localStorage.setItem('cobertura-history-v1', JSON.stringify(bets));
      return true;
    } catch (_) { return false; }
  }
  function dateLabel(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  }
  function outcomeName(bet, key) {
    if (bet.coverageType === 'mixed') {
      const scenario = bet.scenarios.find(item => item.id === key);
      if (!scenario) return 'Resultado no disponible';
      const names = { h: bet.home, a: bet.away };
      return resultName(names, scenario.result) + ' · pasa ' + names[scenario.qualifier];
    }
    return key === 'h' ? bet.home : key === 'a' ? bet.away : 'Empate';
  }
  function renderHistory() {
    const closed = bets.filter(bet => bet.status !== 'pending' && bet.net !== null && Number.isFinite(Number(bet.net)));
    const won = closed.filter(bet => Number(bet.net) > .005).length;
    const lost = closed.filter(bet => Number(bet.net) < -.005).length;
    const invested = closed.reduce((sum, bet) => sum + (Number(bet.total) || 0), 0);
    const balance = closed.reduce((sum, bet) => sum + (Number(bet.net) || 0), 0);
    const yieldPct = invested ? balance / invested * 100 : 0;
    $('stats').innerHTML = `<div class="stat"><small>Finalizadas</small><strong>${closed.length}</strong></div><div class="stat"><small>Ganadas / perdidas</small><strong>${won} / ${lost}</strong></div><div class="stat"><small>Balance neto</small><strong class="${netClass(balance)}">${signedMoney(balance)}</strong></div><div class="stat"><small>Rendimiento</small><strong class="${netClass(yieldPct)}">${yieldPct > 0 ? '+' : ''}${yieldPct.toFixed(1).replace('.', ',')}%</strong></div>`;
    if (!bets.length) {
      $('history').innerHTML = '<div class="history-empty">Todavía no guardaste apuestas.</div>';
      return;
    }
    $('history').innerHTML = bets.map(bet => {
      const safeId = escapeHTML(bet.id);
      const pending = bet.status === 'pending';
      const net = Number(bet.net) || 0;
      const statusClass = pending ? 'pending' : net > .005 ? 'won' : net < -.005 ? 'lost' : 'push';
      const statusText = pending ? 'Pendiente' : statusClass === 'won' ? 'Ganada' : statusClass === 'lost' ? 'Perdida' : 'Recuperada';
      // Mixed bets saved before strategy selection was restored used balancing,
      // even though their legacy `mode` field held the standard-form setting.
      const strategyMode = bet.coverageType === 'mixed' ? bet.strategyMode || 'balanced' : bet.mode;
      const strategy = (bet.coverageType === 'mixed' ? 'Resultado + clasificación · ' : '') + (strategyMode === 'balanced' ? 'Equilibrar' : 'Recuperar');
      const options = bet.coverageType === 'mixed' ? bet.scenarios.map(scenario => [scenario.id, outcomeName(bet, scenario.id)]) : [['h', bet.home], ['d', 'Empate'], ['a', bet.away]];
      const stakes = bet.coverageType === 'mixed' ? `<div class="bet-meta">${Object.entries(bet.stakes).filter(([, stake]) => stake > 0).map(([key, stake]) => escapeHTML(marketName(key, { h: bet.home, a: bet.away })) + ': ' + money(stake)).join(' · ')}</div>` : '';
      return `<article class="bet-item"><div class="bet-head"><div class="bet-match">${escapeHTML(bet.home)} vs. ${escapeHTML(bet.away)}</div><span class="badge ${statusClass}">${statusText}</span></div><div class="bet-meta">${dateLabel(bet.createdAt)} · ${strategy} · Apostado ${money(Number(bet.total) || 0)}</div>${stakes}${pending ? `<div class="settle"><select data-result-for="${safeId}" aria-label="Resultado de ${escapeHTML(bet.home)} contra ${escapeHTML(bet.away)}"><option value="">Resultado real…</option>${options.map(([key, label]) => `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`).join('')}</select><button type="button" data-close-bet="${safeId}" disabled>Cerrar</button></div>` : `<div class="settled-line"><span>${escapeHTML(outcomeName(bet, bet.outcome))}</span><strong class="${netClass(net)}">${signedMoney(net)}</strong></div>`}<div class="bet-actions"><button type="button" class="delete-bet" data-delete-bet="${safeId}">Eliminar apuesta</button></div></article>`;
    }).join('');
  }
  function updateCoverageUI() {
    const mixed = isMixed();
    $('qualificationFields').hidden = !mixed;
    $('standardPicks').hidden = mixed;
    $('mixedPicks').hidden = !mixed;
    $('standardStrategy').hidden = false;
    $('mixedStrategy').hidden = !mixed;
    $('mixedPriority').hidden = !mixed || mode !== 'recovery';
    $('strategyTitle').textContent = '3. Estrategia';
    $('scenarioHelp').hidden = !mixed;
    $('formatHint').textContent = $('format').value === 'tie'
      ? 'Se contemplan ambos clasificados para cada resultado, sin cargar el global. Aceptás perder si tu equipo gana el partido o pasa de ronda.'
      : 'Si un equipo gana en los 90 minutos, clasifica. Si empatan, se contemplan ambos clasificados.';
    const favorite = labelFor($('favorite').value);
    $('mixedHint').textContent = `La pérdida queda aceptada si ${favorite} gana o clasifica. La estrategia elegida cubre los demás desenlaces.`;
    for (const [id, active] of [['recovery', mode === 'recovery'], ['balanced', mode === 'balanced']]) {
      $(id).classList.toggle('active', active);
      $(id).setAttribute('aria-pressed', String(active));
    }
    if (mixed) {
      const first = $('mixedFirst').value === 'd' ? 'hay empate y clasifica el rival' : 'el rival gana y clasifica';
      const second = $('mixedFirst').value === 'd' ? 'el rival gana y clasifica' : 'hay empate y clasifica el rival';
      $('strategyhint').textContent = mode === 'recovery'
        ? `Primero recuperás lo apostado si ${first}. El resto busca una mayor compensación si ${second}.`
        : 'Buscás el mismo saldo si el rival gana o empata y, en ambos casos, clasifica. Se comparan las cuotas de resultado y clasificación.';
    } else {
      $('strategyhint').textContent = mode === 'recovery'
        ? 'Primer resultado: buscás recuperar el total apostado, con redondeo a centavos. El resto va al segundo resultado.'
        : 'Repartís la inversión para cobrar lo mismo si ocurre cualquiera de los dos resultados cubiertos. Puede haber ganancia o pérdida.';
    }
  }
  function readCalculation() {
    const total = amountValue($('total').value);
    const odds = { h: decimalValue($('oh').value), d: decimalValue($('od').value), a: decimalValue($('oa').value) };
    if (isMixed()) {
      odds.qh = decimalValue($('qh').value);
      odds.qa = decimalValue($('qa').value);
    }
    const names = { h: labelFor('h'), a: labelFor('a') };
    if (norm(names.h) === norm(names.a)) throw new Error('Elegí dos equipos diferentes.');
    const result = isMixed()
      ? engine.mixed({ total, odds, favorite: $('favorite').value, format: $('format').value, mode, first: $('mixedFirst').value === 'd' ? 'd' : $('favorite').value === 'h' ? 'a' : 'h' })
      : engine.standard({ total, odds, first: $('pick1').value, second: $('pick2').value, mode });
    return { ...result, odds, names, coverageType: isMixed() ? 'mixed' : 'standard' };
  }
  function calc() {
    updateCoverageUI();
    try {
      currentCalculation = readCalculation();
    } catch (error) {
      currentCalculation = null;
      $('alloc').innerHTML = '';
      $('results').innerHTML = '';
      $('warning').innerHTML = `<div class="notice" role="status">${escapeHTML(error.message)}</div>`;
      $('savebet').disabled = true;
      save();
      return;
    }
    const calculation = currentCalculation;
    const { names, odds, scenarios } = calculation;
    const activeStakes = Object.entries(calculation.stakes).filter(([, stake]) => stake > 0);
    $('savebet').disabled = false;
    $('alloc').classList.toggle('single-allocation', activeStakes.length === 1);
    $('alloc').innerHTML = activeStakes.map(([key, stake]) => {
      const label = marketName(key, names);
      return `<div><small title="${escapeHTML(label)}">${escapeHTML(label)} · ${oddsLabel(odds[key])}</small><strong>${money(stake)}</strong></div>`;
    }).join('');
    $('results').innerHTML = scenarios.map(scenario => {
      const title = resultName(names, scenario.result);
      const qualifier = scenario.qualifier ? `Clasifica ${names[scenario.qualifier]}` : '';
      const accepted = calculation.coverageType === 'mixed' ? `<span class="scenario-tag ${scenario.accepted ? 'accepted' : 'covered'}">${scenario.accepted ? 'Aceptás perder' : 'A cubrir'}</span>` : '';
      return `<div class="result"><div><div class="name" title="${escapeHTML(title)}">${escapeHTML(title)}</div>${qualifier ? `<div class="muted scenario-qualifier" title="${escapeHTML(qualifier)}">${escapeHTML(qualifier)}</div>` : ''}<div class="muted">Cobrás ${money(scenario.payout)}</div>${accepted}</div><strong class="${netClass(scenario.net)}">${signedMoney(scenario.net)}</strong></div>`;
    }).join('');
    if (calculation.coverageType === 'mixed') {
      const minimum = calculation.minimumCoveredNet;
      const chosen = calculation.mode === 'recovery'
        ? `Recuperás con «${escapeHTML(marketName(calculation.primaryMarket, names))}» y destinás el resto a «${escapeHTML(marketName(calculation.second, names))}».`
        : calculation.allocationType === 'qualification'
          ? 'Con estas cuotas, apostar a la clasificación del rival equilibra mejor ambos desenlaces.'
          : 'Con estas cuotas, repartir entre el triunfo del rival y el empate equilibra mejor ambos desenlaces.';
      const netFor = result => scenarios.find(scenario => !scenario.accepted && scenario.result === result).net;
      const coveredSummary = calculation.mode === 'recovery'
        ? `Primer desenlace cubierto: saldo <strong>${signedMoney(netFor(calculation.first))}</strong>.<br>Segundo desenlace cubierto: saldo <strong>${signedMoney(netFor(calculation.second))}</strong>.`
        : `Si tu equipo no gana y queda eliminado: saldo mínimo <strong>${signedMoney(minimum)}</strong>.`;
      $('warning').innerHTML = `<div class="notice ${minimum >= -.005 ? 'ok' : ''}">${chosen}<br>${coveredSummary}<br>Si gana o clasifica: pérdida máxima <strong>${money(calculation.maximumAcceptedLoss)}</strong>.</div>`;
    } else {
      const protectedScenarios = scenarios.filter(scenario => !scenario.accepted);
      const covered = protectedScenarios.every(scenario => scenario.net >= -.005);
      $('warning').innerHTML = `<div class="notice ${covered ? 'ok' : ''}">${covered ? 'El tercer resultado no está cubierto: si sucede, perdés toda la inversión.' : 'Con estas cuotas, al menos uno de los resultados cubiertos genera una pérdida.'}</div>`;
    }
    save();
  }
  function betSnapshot() {
    if (!currentCalculation) return null;
    const calculation = currentCalculation;
    const now = new Date().toISOString();
    return {
      id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),
      schemaVersion: 3, createdAt: now, updatedAt: now,
      home: calculation.names.h, away: calculation.names.a,
      total: calculation.total, odds: { ...calculation.odds }, stakes: { ...calculation.stakes },
      nets: Object.fromEntries(calculation.scenarios.map(scenario => [scenario.id, scenario.net])),
      scenarios: calculation.scenarios.map(scenario => ({ ...scenario })),
      coverageType: calculation.coverageType, favorite: calculation.favorite || null, format: calculation.format || null,
      mode, strategyMode: mode, priority: calculation.first || null,
      picks: calculation.coverageType === 'mixed' ? Object.keys(calculation.stakes).filter(key => calculation.stakes[key] > 0) : [$('pick1').value, $('pick2').value],
      status: 'pending', outcome: null, net: null
    };
  }
  function addCurrentBet() {
    const bet = betSnapshot();
    if (!bet) return;
    bets.unshift(bet);
    if (!saveHistory()) {
      bets.shift();
      $('warning').innerHTML = '<div class="notice" role="status">No se pudo guardar la apuesta en este navegador. La calculadora sigue disponible.</div>';
      return;
    }
    renderHistory();
    const button = $('savebet');
    button.textContent = 'Apuesta guardada ✓';
    button.disabled = true;
    setTimeout(() => { button.textContent = 'Guardar esta apuesta'; calc(); }, 1200);
  }
  function resetApp() {
    pendingTeamValues = {};
    const defaults = { home: 'Huracán', away: 'Gimnasia (LP)', customh: '', customa: '', oh: '2.40', od: '3.00', oa: '3.10', qh: '', qa: '', total: '60.000', pick1: 'd', pick2: 'a', favorite: 'a', format: 'single', mixedFirst: 'd' };
    for (const [id, value] of Object.entries(defaults)) {
      if (id === 'home' || id === 'away') selectByValueOrName($(id), value);
      else $(id).value = value;
    }
    $('includeQualification').checked = false;
    mode = 'recovery';
    updateTeams();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function hardRefresh() {
    const url = new URL(location.href);
    url.searchParams.set('_actualizar', Date.now().toString());
    location.replace(url.toString());
  }

  buildTeamSelects(teamRecords);
  for (const id of ids) {
    const handler = ['home', 'away', 'customh', 'customa'].includes(id) ? updateTeams : id === 'total' ? () => { formatTotal(); calc(); } : calc;
    $(id).addEventListener('input', handler);
    $(id).addEventListener('change', handler);
  }
  $('includeQualification').addEventListener('change', calc);
  for (const id of ['pick1', 'pick2']) {
    $(id).addEventListener('change', () => {
      if ($('pick1').value === $('pick2').value) {
        $(id === 'pick1' ? 'pick2' : 'pick1').value = ['h', 'd', 'a'].find(key => key !== $(id).value);
      }
      calc();
    });
  }
  for (const next of ['recovery', 'balanced']) $(next).addEventListener('click', () => { mode = next; calc(); });
  $('history').addEventListener('change', event => {
    const select = event.target.closest('[data-result-for]');
    if (!select) return;
    const button = $('history').querySelector(`[data-close-bet="${CSS.escape(select.dataset.resultFor)}"]`);
    if (button) button.disabled = !select.value;
  });
  $('history').addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-delete-bet]');
    if (deleteButton) {
      const bet = bets.find(item => item.id === deleteButton.dataset.deleteBet);
      if (!bet || !confirm(`¿Eliminar la apuesta ${bet.home} vs. ${bet.away}?`)) return;
      const previous = bets;
      bets = bets.filter(item => item.id !== bet.id);
      if (!saveHistory()) { bets = previous; alert('No se pudo eliminar la apuesta.'); return; }
      renderHistory();
      return;
    }
    const button = event.target.closest('[data-close-bet]');
    if (!button) return;
    const bet = bets.find(item => item.id === button.dataset.closeBet);
    const select = $('history').querySelector(`[data-result-for="${CSS.escape(button.dataset.closeBet)}"]`);
    if (!bet || !select?.value || !Object.hasOwn(bet.nets, select.value)) return;
    const net = Number(bet.nets[select.value]);
    if (!Number.isFinite(net)) return;
    const previous = { ...bet };
    bet.outcome = select.value;
    bet.net = net;
    bet.status = net > .005 ? 'won' : net < -.005 ? 'lost' : 'push';
    bet.updatedAt = new Date().toISOString();
    if (!saveHistory()) { Object.assign(bet, previous); alert('No se pudo guardar el resultado.'); return; }
    renderHistory();
  });
  $('savebet').addEventListener('click', addCurrentBet);
  $('reset').addEventListener('click', resetApp);
  $('refresh').addEventListener('click', hardRefresh);
  for (const key of ['h', 'a']) $('crest' + key).addEventListener('error', () => {
    $('crest' + key).hidden = true;
    $('initial' + key).hidden = false;
    delete logos[$(key === 'h' ? 'home' : 'away').value];
  });
  loadHistory();
  renderHistory();
  load();
  formatTotal();
  updateTeams();

  async function fetchConmebolTeams() {
    try {
      const response = await fetch('teams.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Catalog unavailable');
      const leagues = await response.json();
      const loaded = leagues.flatMap(league => (league.teams || []).filter(team => team.name).map(team => {
        const key = league.code + ':' + (team.id || norm(team.name));
        if (team.logo) logos[key] = team.logo;
        return { code: league.code, key, name: team.name };
      }));
      if (!loaded.length) return;
      teamRecords = loaded;
      buildTeamSelects(teamRecords, true);
      for (const id of ['home', 'away']) if (pendingTeamValues[id]) selectByValueOrName($(id), pendingTeamValues[id]);
      pendingTeamValues = {};
      updateTeams();
    } catch (_) { /* Keep the local club list when the catalogue is unavailable. */ }
  }
  fetchConmebolTeams();
})();
