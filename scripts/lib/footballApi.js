/**
 * Adaptador para football-data.org (plano grátis, tem Copa 2026).
 *
 * Documentação: https://www.football-data.org/documentation/quickstart
 *
 * Para trocar de provedor no futuro, reescreva apenas este arquivo
 * mantendo as mesmas funções exportadas: fetchFixtures() e mapFixtureToGame().
 */

const API_KEY  = process.env.FOOTBALL_API_KEY || '';
const API_BASE = process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4';
// No football-data.org a Copa do Mundo 2026 tem código "WC"
const COMP     = process.env.FOOTBALL_API_COMPETITION_ID || 'WC';

function assertKey() {
  if (!API_KEY) {
    throw new Error(
      'FOOTBALL_API_KEY não configurada. ' +
      'Defina como GitHub Secret FOOTBALL_API_KEY.'
    );
  }
}

async function apiGet(path) {
  assertKey();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (res.status === 429) throw new Error('Rate limit atingido. Tente novamente em 1 minuto.');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`football-data.org respondeu ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Busca todos os jogos da competição.
 */
async function fetchFixtures() {
  const data = await apiGet(`/competitions/${encodeURIComponent(COMP)}/matches`);
  return data.matches || [];
}

/**
 * Converte um jogo do formato football-data.org para o formato do Firestore.
 */
function mapFixtureToGame(match) {
  const home = match.homeTeam || {};
  const away = match.awayTeam || {};
  const score = match.score || {};
  const full  = score.fullTime || {};

  // Status mapping
  const statusMap = {
    'SCHEDULED': 'scheduled',
    'TIMED':     'scheduled',
    'IN_PLAY':   'live',
    'PAUSED':    'live',
    'FINISHED':  'finished',
    'AWARDED':   'finished',
    'CANCELLED':  'scheduled',
    'POSTPONED':  'scheduled',
    'SUSPENDED':  'scheduled'
  };
  const status = statusMap[match.status] || 'scheduled';

  const hasScore = Number.isInteger(full.home) && Number.isInteger(full.away);

  let winner = null;
  if (status === 'finished' && hasScore) {
    if (full.home > full.away)      winner = 'home';
    else if (full.home < full.away) winner = 'away';
    else                            winner = 'draw';
  }

  // Extrair grupo da fase (ex: "GROUP_STAGE" + "GROUP_A" -> "A")
  const group = extractGroup(match.group || match.stage || '');

  return {
    externalId:    String(match.id),
    homeTeam:      home.name       || home.shortName || '',
    awayTeam:      away.name       || away.shortName || '',
    homeTeamCode:  home.tla        || codeFrom(home.name) || '',
    awayTeamCode:  away.tla        || codeFrom(away.name) || '',
    homeTeamFlag:  home.crest      || '',
    awayTeamFlag:  away.crest      || '',
    startTime:     new Date(match.utcDate),
    timezone:      'UTC',
    stage:         formatStage(match.stage || ''),
    group,
    status,
    homeScore:     hasScore ? full.home : null,
    awayScore:     hasScore ? full.away : null,
    winner
  };
}

function codeFrom(name) {
  if (!name) return '';
  const parts = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]).join('').toUpperCase();
}

function extractGroup(str) {
  const m = /GROUP[_\s]*([A-Z])/i.exec(str);
  return m ? m[1].toUpperCase() : null;
}

function formatStage(stage) {
  const map = {
    'GROUP_STAGE':       'Fase de grupos',
    'ROUND_OF_16':       'Oitavas de final',
    'QUARTER_FINALS':    'Quartas de final',
    'SEMI_FINALS':       'Semifinais',
    'THIRD_PLACE':       'Terceiro lugar',
    'FINAL':             'Final'
  };
  return map[stage] || stage || 'Fase de grupos';
}

module.exports = { fetchFixtures, mapFixtureToGame };
