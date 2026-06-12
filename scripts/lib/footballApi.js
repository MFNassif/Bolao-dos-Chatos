/**
 * Adaptador de API esportiva.
 *
 * Tenta football-data.org primeiro para manter compatibilidade com a versao
 * publicada. Se a chave configurada for da API-Football, faz fallback para
 * v3.football.api-sports.io usando a mesma FOOTBALL_API_KEY.
 */

const API_KEY  = process.env.FOOTBALL_API_KEY || '';
const API_BASE = process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4';
const SEASON   = process.env.FOOTBALL_API_SEASON || '2026';
const COMP     = normalizeFootballDataCompetition(process.env.FOOTBALL_API_COMPETITION_ID || 'WC');

function assertKey() {
  if (!API_KEY) {
    throw new Error(
      'FOOTBALL_API_KEY nao configurada. ' +
      'Defina como GitHub Secret FOOTBALL_API_KEY.'
    );
  }
}

async function fetchFixtures() {
  if (isApiFootballBase(API_BASE)) return fetchApiFootballFixtures();

  try {
    return await fetchFootballDataFixtures();
  } catch (err) {
    if (!shouldFallbackToApiFootball(err)) throw err;
    console.warn(`football-data.org falhou (${err.status || 'erro'}). Tentando API-Football.`);
    return fetchApiFootballFixtures();
  }
}

async function fetchFootballDataFixtures() {
  const data = await footballDataGet(`/competitions/${encodeURIComponent(COMP)}/matches`);
  return (data.matches || []).map((match) => ({ ...match, __provider: 'football-data' }));
}

async function footballDataGet(path) {
  assertKey();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (res.status === 429) throw makeHttpError('Rate limit atingido. Tente novamente em 1 minuto.', res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeHttpError(`football-data.org respondeu ${res.status}: ${text.slice(0, 200)}`, res.status);
  }
  return res.json();
}

async function fetchApiFootballFixtures() {
  const league = normalizeApiFootballLeague(process.env.FOOTBALL_API_COMPETITION_ID || '1');
  const base = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
  const data = await apiFootballGet(`${base}/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(SEASON)}`);
  return (data.response || []).map((fixture) => ({ ...fixture, __provider: 'api-football' }));
}

async function apiFootballGet(url) {
  assertKey();
  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY }
  });
  if (res.status === 429) throw makeHttpError('Rate limit atingido. Tente novamente em 1 minuto.', res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeHttpError(`API-Football respondeu ${res.status}: ${text.slice(0, 200)}`, res.status);
  }

  const data = await res.json();
  const errors = data.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
  if (hasErrors) {
    throw new Error(`API-Football retornou erro: ${JSON.stringify(errors).slice(0, 200)}`);
  }
  return data;
}

function mapFixtureToGame(match) {
  if (match?.__provider === 'api-football' || match?.fixture) {
    return mapApiFootballFixture(match);
  }
  return mapFootballDataFixture(match);
}

function mapFootballDataFixture(match) {
  const home = match.homeTeam || {};
  const away = match.awayTeam || {};
  const score = match.score || {};
  const full = score.fullTime || {};
  const homeScore = readScoreValue(full, 'home');
  const awayScore = readScoreValue(full, 'away');

  const statusMap = {
    SCHEDULED: 'scheduled',
    TIMED: 'scheduled',
    IN_PLAY: 'live',
    PAUSED: 'live',
    FINISHED: 'finished',
    AWARDED: 'finished',
    CANCELLED: 'scheduled',
    POSTPONED: 'scheduled',
    SUSPENDED: 'scheduled'
  };
  const status = statusMap[match.status] || 'scheduled';
  const hasScore = Number.isInteger(homeScore) && Number.isInteger(awayScore);

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
    group:         extractGroup(match.group || match.stage || ''),
    status,
    homeScore:     hasScore ? homeScore : null,
    awayScore:     hasScore ? awayScore : null,
    winner:        resolveWinner(status, homeScore, awayScore, score.winner)
  };
}

function mapApiFootballFixture(item) {
  const fixture = item.fixture || {};
  const league = item.league || {};
  const teams = item.teams || {};
  const goals = item.goals || {};
  const score = item.score || {};
  const statusShort = fixture.status?.short || '';
  const status = mapApiFootballStatus(statusShort);
  const home = teams.home || {};
  const away = teams.away || {};
  const homeScore = readApiFootballScore(goals.home, score.fulltime?.home);
  const awayScore = readApiFootballScore(goals.away, score.fulltime?.away);
  const hasScore = Number.isInteger(homeScore) && Number.isInteger(awayScore);
  const round = league.round || '';

  return {
    externalId:    `api-football:${fixture.id}`,
    homeTeam:      home.name || '',
    awayTeam:      away.name || '',
    homeTeamCode:  codeFrom(home.name) || '',
    awayTeamCode:  codeFrom(away.name) || '',
    homeTeamFlag:  home.logo || '',
    awayTeamFlag:  away.logo || '',
    startTime:     new Date(fixture.date),
    timezone:      'UTC',
    stage:         formatApiFootballStage(round),
    group:         extractGroup(round),
    status,
    homeScore:     hasScore ? homeScore : null,
    awayScore:     hasScore ? awayScore : null,
    winner:        resolveApiFootballWinner(status, homeScore, awayScore, home.winner, away.winner)
  };
}

function mapApiFootballStatus(short) {
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  return 'scheduled';
}

function readScoreValue(node, side) {
  const legacyKey = side === 'home' ? 'homeTeam' : 'awayTeam';
  const value = node?.[side] ?? node?.[legacyKey];
  return Number.isInteger(value) ? value : null;
}

function readApiFootballScore(goalValue, fulltimeValue) {
  if (Number.isInteger(goalValue)) return goalValue;
  if (Number.isInteger(fulltimeValue)) return fulltimeValue;
  return null;
}

function resolveWinner(status, homeScore, awayScore, apiWinner) {
  if (status !== 'live' && status !== 'finished') return null;
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return null;
  if (homeScore > awayScore) return 'home';
  if (homeScore < awayScore) return 'away';
  if (apiWinner === 'HOME_TEAM') return 'home';
  if (apiWinner === 'AWAY_TEAM') return 'away';
  return 'draw';
}

function resolveApiFootballWinner(status, homeScore, awayScore, homeWinner, awayWinner) {
  if (status !== 'live' && status !== 'finished') return null;
  if (homeWinner === true) return 'home';
  if (awayWinner === true) return 'away';
  return resolveWinner(status, homeScore, awayScore);
}

function normalizeFootballDataCompetition(value) {
  const text = String(value || '').trim();
  if (!text || text === '1' || /^world[_\s-]?cup$/i.test(text)) return 'WC';
  return text;
}

function normalizeApiFootballLeague(value) {
  const text = String(value || '').trim();
  if (!text || text.toUpperCase() === 'WC' || /^world[_\s-]?cup$/i.test(text)) return '1';
  return text;
}

function shouldFallbackToApiFootball(err) {
  return [401, 403, 404].includes(err?.status);
}

function isApiFootballBase(base) {
  return /api-football|api-sports/i.test(base || '');
}

function makeHttpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function codeFrom(name) {
  if (!name) return '';
  const parts = name.replace(/[^A-Za-z\u00C0-\u00FF ]/g, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]).join('').toUpperCase();
}

function extractGroup(str) {
  const m = /GROUP[_\s-]*([A-Z])/i.exec(str) || /\bGroup\s+([A-Z])\b/i.exec(str);
  return m ? m[1].toUpperCase() : null;
}

function formatStage(stage) {
  const map = {
    GROUP_STAGE: 'Fase de grupos',
    LAST_32: 'Rodada de 32',
    ROUND_OF_16: 'Oitavas de final',
    LAST_16: 'Oitavas de final',
    QUARTER_FINALS: 'Quartas de final',
    SEMI_FINALS: 'Semifinais',
    THIRD_PLACE: 'Terceiro lugar',
    FINAL: 'Final'
  };
  return map[stage] || stage || 'Fase de grupos';
}

function formatApiFootballStage(round) {
  if (/round of 32/i.test(round)) return 'Rodada de 32';
  if (/round of 16|oitavas/i.test(round)) return 'Oitavas de final';
  if (/quarter/i.test(round)) return 'Quartas de final';
  if (/semi/i.test(round)) return 'Semifinais';
  if (/third/i.test(round)) return 'Terceiro lugar';
  if (/final/i.test(round)) return 'Final';
  return 'Fase de grupos';
}

module.exports = { fetchFixtures, mapFixtureToGame };
