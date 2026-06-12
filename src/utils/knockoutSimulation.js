const GROUPS = 'ABCDEFGHIJKL'.split('');
const EPS = 0.000001;

const THIRD_PLACE_COLUMNS = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'];

// FIFA World Cup 26 Regulations, Annexe C. Each token maps to columns:
// 1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L.
const THIRD_PLACE_ASSIGNMENTS = `EJIFHGLK HGIDJFLK EJIDHGLK EJIDHFLK EGIDJFLK EGJDHFLK EGIDHFLK EGJDHFLI EGJDHFIK HGICJFLK EJICHGLK EJICHFLK
EGICJFLK EGJCHFLK EGICHFLK EGJCHFLI EGJCHFIK HGICJDLK CJIDHFLK CGIDJFLK CGJDHFLK CGIDHFLK CGJDHFLI CGJDHFIK
EJICHDLK EGICJDLK EGJCHDLK EGICHDLK EGJCHDLI EGJCHDIK CJEDIFLK CJEDHFLK CEIDHFLK CJEDHFLI CJEDHFIK CGEDJFLK
CGEDIFLK CGEDJFLI CGEDJFIK CGEDHFLK CGJDHFLE CGJDHFEK CGEDHFLI CGEDHFIK CGJDHFEI HJBFIGLK EJIBHGLK EJBFIHLK
EJBFIGLK EJBFHGLK EGBFIHLK EJBFHGLI EJBFHGIK HJBDIGLK HJBDIFLK IGBDJFLK HGBDJFLK HGBDIFLK HGBDJFLI HGBDJFIK
EJBDIHLK EJBDIGLK EJBDHGLK EGBDIHLK EJBDHGLI EJBDHGIK EJBDIFLK EJBDHFLK EIBDHFLK EJBDHFLI EJBDHFIK EGBDJFLK
EGBDIFLK EGBDJFLI EGBDJFIK EGBDHFLK HGBDJFLE HGBDJFEK EGBDHFLI EGBDHFIK HGBDJFEI HJBCIGLK HJBCIFLK IGBCJFLK
HGBCJFLK HGBCIFLK HGBCJFLI HGBCJFIK EJBCIHLK EJBCIGLK EJBCHGLK EGBCIHLK EJBCHGLI EJBCHGIK EJBCIFLK EJBCHFLK
EIBCHFLK EJBCHFLI EJBCHFIK EGBCJFLK EGBCIFLK EGBCJFLI EGBCJFIK EGBCHFLK HGBCJFLE HGBCJFEK EGBCHFLI EGBCHFIK
HGBCJFEI HJBCIDLK IGBCJDLK HGBCJDLK HGBCIDLK HGBCJDLI HGBCJDIK CJBDIFLK CJBDHFLK CIBDHFLK CJBDHFLI CJBDHFIK
CGBDJFLK CGBDIFLK CGBDJFLI CGBDJFIK CGBDHFLK CGBDHFLJ HGBCJFDK CGBDHFLI CGBDHFIK HGBCJFDI EJBCIDLK EJBCHDLK
EIBCHDLK EJBCHDLI EJBCHDIK EGBCJDLK EGBCIDLK EGBCJDLI EGBCJDIK EGBCHDLK HGBCJDLE HGBCJDEK EGBCHDLI EGBCHDIK
HGBCJDEI CJBDEFLK CEBDIFLK CJBDEFLI CJBDEFIK CEBDHFLK CJBDHFLE CJBDHFEK CEBDHFLI CEBDHFIK CJBDHFEI CGBDEFLK
CGBDJFLE CGBDJFEK CGBDEFLI CGBDEFIK CGBDJFEI CGBDHFLE CGBDHFEK HGBCJFDE CGBDHFEI HJIFAGLK EJIAHGLK EJIFAHLK
EJIFAGLK EGJFAHLK EGIFAHLK EGJFAHLI EGJFAHIK HJIDAGLK HJIDAFLK IGJDAFLK HGJDAFLK HGIDAFLK HGJDAFLI HGJDAFIK
EJIDAHLK EJIDAGLK EGJDAHLK EGIDAHLK EGJDAHLI EGJDAHIK EJIDAFLK HJEDAFLK HEIDAFLK HJEDAFLI HJEDAFIK EGJDAFLK
EGIDAFLK EGJDAFLI EGJDAFIK HGEDAFLK HGJDAFLE HGJDAFEK HGEDAFLI HGEDAFIK HGJDAFEI HJICAGLK HJICAFLK IGJCAFLK
HGJCAFLK HGICAFLK HGJCAFLI HGJCAFIK EJICAHLK EJICAGLK EGJCAHLK EGICAHLK EGJCAHLI EGJCAHIK EJICAFLK HJECAFLK
HEICAFLK HJECAFLI HJECAFIK EGJCAFLK EGICAFLK EGJCAFLI EGJCAFIK HGECAFLK HGJCAFLE HGJCAFEK HGECAFLI HGECAFIK
HGJCAFEI HJICADLK IGJCADLK HGJCADLK HGICADLK HGJCADLI HGJCADIK CJIDAFLK HJFCADLK HFICADLK HJFCADLI HJFCADIK
CGJDAFLK CGIDAFLK CGJDAFLI CGJDAFIK HGFCADLK CGJDAFLH HGJCAFDK HGFCADLI HGFCADIK HGJCAFDI EJICADLK HJECADLK
HEICADLK HJECADLI HJECADIK EGJCADLK EGICADLK EGJCADLI EGJCADIK HGECADLK HGJCADLE HGJCADEK HGECADLI HGECADIK
HGJCADEI CJEDAFLK CEIDAFLK CJEDAFLI CJEDAFIK HEFCADLK HJFCADLE HJECAFDK HEFCADLI HEFCADIK HJECAFDI CGEDAFLK
CGJDAFLE CGJDAFEK CGEDAFLI CGEDAFIK CGJDAFEI HGFCADLE HGECAFDK HGJCAFDE HGECAFDI HJBAIGLK HJBAIFLK IJBFAGLK
HJBFAGLK HGBAIFLK HJBFAGLI HJBFAGIK EJBAIHLK EJBAIGLK EJBAHGLK EGBAIHLK EJBAHGLI EJBAHGIK EJBAIFLK EJBFAHLK
EIBFAHLK EJBFAHLI EJBFAHIK EJBFAGLK EGBAIFLK EJBFAGLI EJBFAGIK EGBFAHLK HJBFAGLE HJBFAGEK EGBFAHLI EGBFAHIK
HJBFAGEI IJBDAHLK IJBDAGLK HJBDAGLK IGBDAHLK HJBDAGLI HJBDAGIK IJBDAFLK HJBDAFLK HIBDAFLK HJBDAFLI HJBDAFIK
FJBDAGLK IGBDAFLK FJBDAGLI FJBDAGIK HGBDAFLK HGBDAFLJ HGBDAFJK HGBDAFLI HGBDAFIK HGBDAFIJ EJBAIDLK EJBDAHLK
EIBDAHLK EJBDAHLI EJBDAHIK EJBDAGLK EGBAIDLK EJBDAGLI EJBDAGIK EGBDAHLK HJBDAGLE HJBDAGEK EGBDAHLI EGBDAHIK
HJBDAGEI EJBDAFLK EIBDAFLK EJBDAFLI EJBDAFIK HEBDAFLK HJBDAFLE HJBDAFEK HEBDAFLI HEBDAFIK HJBDAFEI EGBDAFLK
EGBDAFLJ EGBDAFJK EGBDAFLI EGBDAFIK EGBDAFIJ HGBDAFLE HGBDAFEK HGBDAFEJ HGBDAFEI IJBCAHLK IJBCAGLK HJBCAGLK
IGBCAHLK HJBCAGLI HJBCAGIK IJBCAFLK HJBCAFLK HIBCAFLK HJBCAFLI HJBCAFIK CJBFAGLK IGBCAFLK CJBFAGLI CJBFAGIK
HGBCAFLK HGBCAFLJ HGBCAFJK HGBCAFLI HGBCAFIK HGBCAFIJ EJBAICLK EJBCAHLK EIBCAHLK EJBCAHLI EJBCAHIK EJBCAGLK
EGBAICLK EJBCAGLI EJBCAGIK EGBCAHLK HJBCAGLE HJBCAGEK EGBCAHLI EGBCAHIK HJBCAGEI EJBCAFLK EIBCAFLK EJBCAFLI
EJBCAFIK HEBCAFLK HJBCAFLE HJBCAFEK HEBCAFLI HEBCAFIK HJBCAFEI EGBCAFLK EGBCAFLJ EGBCAFJK EGBCAFLI EGBCAFIK
EGBCAFIJ HGBCAFLE HGBCAFEK HGBCAFEJ HGBCAFEI IJBCADLK HJBCADLK HIBCADLK HJBCADLI HJBCADIK CJBDAGLK IGBCADLK
CJBDAGLI CJBDAGIK HGBCADLK HGBCADLJ HGBCADJK HGBCADLI HGBCADIK HGBCADIJ CJBDAFLK CIBDAFLK CJBDAFLI CJBDAFIK
HFBCADLK CJBDAFLH HJBCAFDK HFBCADLI HFBCADIK HJBCAFDI CGBDAFLK CGBDAFLJ CGBDAFJK CGBDAFLI CGBDAFIK CGBDAFIJ
CGBDAFLH HGBCAFDK HGBCAFDJ HGBCAFDI EJBCADLK EIBCADLK EJBCADLI EJBCADIK HEBCADLK HJBCADLE HJBCADEK HEBCADLI
HEBCADIK HJBCADEI EGBCADLK EGBCADLJ EGBCADJK EGBCADLI EGBCADIK EGBCADIJ HGBCADLE HGBCADEK HGBCADEJ HGBCADEI
CEBDAFLK CJBDAFLE CJBDAFEK CEBDAFLI CEBDAFIK CJBDAFEI HFBCADLE HEBCAFDK HJBCAFDE HEBCAFDI CGBDAFLE CGBDAFEK
CGBDAFEJ CGBDAFEI HGBCAFDE`;

const THIRD_PLACE_MAP = new Map(
  THIRD_PLACE_ASSIGNMENTS.trim().split(/\s+/).map((row) => [
    row.split('').sort().join(''),
    row
  ])
);

const ROUND_32_DEFS = [
  { id: 'M73', a: '2A', b: '2B' },
  { id: 'M74', a: '1E', thirdFor: 'E' },
  { id: 'M75', a: '1F', b: '2C' },
  { id: 'M76', a: '1C', b: '2F' },
  { id: 'M77', a: '1I', thirdFor: 'I' },
  { id: 'M78', a: '2E', b: '2I' },
  { id: 'M79', a: '1A', thirdFor: 'A' },
  { id: 'M80', a: '1L', thirdFor: 'L' },
  { id: 'M81', a: '1D', thirdFor: 'D' },
  { id: 'M82', a: '1G', thirdFor: 'G' },
  { id: 'M83', a: '2K', b: '2L' },
  { id: 'M84', a: '1H', b: '2J' },
  { id: 'M85', a: '1B', thirdFor: 'B' },
  { id: 'M86', a: '1J', b: '2H' },
  { id: 'M87', a: '1K', thirdFor: 'K' },
  { id: 'M88', a: '2D', b: '2G' }
];

const NEXT_ROUNDS = [
  {
    key: 'r16',
    title: 'Oitavas',
    matches: [
      { id: 'M89', aFrom: 'M74', bFrom: 'M77' },
      { id: 'M90', aFrom: 'M73', bFrom: 'M75' },
      { id: 'M91', aFrom: 'M76', bFrom: 'M78' },
      { id: 'M92', aFrom: 'M79', bFrom: 'M80' },
      { id: 'M93', aFrom: 'M83', bFrom: 'M84' },
      { id: 'M94', aFrom: 'M81', bFrom: 'M82' },
      { id: 'M95', aFrom: 'M86', bFrom: 'M88' },
      { id: 'M96', aFrom: 'M85', bFrom: 'M87' }
    ]
  },
  {
    key: 'quarters',
    title: 'Quartas',
    matches: [
      { id: 'M97', aFrom: 'M89', bFrom: 'M90' },
      { id: 'M98', aFrom: 'M93', bFrom: 'M94' },
      { id: 'M99', aFrom: 'M91', bFrom: 'M92' },
      { id: 'M100', aFrom: 'M95', bFrom: 'M96' }
    ]
  },
  {
    key: 'semis',
    title: 'Semis',
    matches: [
      { id: 'M101', aFrom: 'M97', bFrom: 'M98' },
      { id: 'M102', aFrom: 'M99', bFrom: 'M100' }
    ]
  },
  {
    key: 'final',
    title: 'Final',
    matches: [
      { id: 'M104', aFrom: 'M101', bFrom: 'M102' }
    ]
  }
];

export function getGroupGames(games = []) {
  return games
    .filter((g) => g.group && GROUPS.includes(String(g.group).toUpperCase()))
    .slice()
    .sort((a, b) => String(a.group).localeCompare(String(b.group)) || toMillis(a.startTime) - toMillis(b.startTime));
}

export function countCompleteGroupPredictions(groupGames, predictions) {
  const predMap = new Map(
    (predictions || [])
      .filter(hasPredictionScore)
      .map((p) => [p.gameId, p])
  );
  return groupGames.filter((g) => predMap.has(g.id)).length;
}

export function buildSimulation({ games, predictions, mode }) {
  const groupGames = getGroupGames(games);
  const scores = buildScores(groupGames, predictions, mode);
  const missingGames = groupGames.filter((g) => !scores.has(g.id));

  if (missingGames.length) {
    return {
      complete: false,
      groupGames,
      missingGames,
      completedGames: groupGames.length - missingGames.length
    };
  }

  const standings = buildStandings(groupGames, scores);
  const thirdPlaced = standings.map((g) => g.rows[2]).filter(Boolean);
  const bestThirds = rankThirdPlaced(thirdPlaced).slice(0, 8);
  const thirdAssignment = getThirdPlaceAssignment(bestThirds.map((row) => row.group));
  const round32 = buildRound32(standings, bestThirds, thirdAssignment);

  return {
    complete: true,
    groupGames,
    standings,
    bestThirds,
    thirdAssignment,
    round32,
    scores
  };
}

export function buildKnockoutRounds(round32, picks = {}) {
  const matchesById = new Map();
  const rounds = [
    { key: 'r32', title: 'Rodada de 32', matches: round32 || [] }
  ];

  for (const match of round32 || []) matchesById.set(match.id, match);

  function winnerOf(matchId) {
    const match = matchesById.get(matchId);
    if (!match) return null;
    const picked = picks[matchId];
    return [match.teamA, match.teamB].find((team) => team?.id === picked) || null;
  }

  for (const roundDef of NEXT_ROUNDS) {
    const matches = roundDef.matches.map((def) => {
      const match = {
        id: def.id,
        teamA: winnerOf(def.aFrom),
        teamB: winnerOf(def.bFrom),
        sourceA: `Vencedor ${def.aFrom}`,
        sourceB: `Vencedor ${def.bFrom}`
      };
      matchesById.set(match.id, match);
      return match;
    });
    rounds.push({ ...roundDef, matches });
  }

  return rounds;
}

export function getChampion(rounds, picks = {}) {
  const finalMatch = rounds?.find((r) => r.key === 'final')?.matches?.[0];
  if (!finalMatch) return null;
  return [finalMatch.teamA, finalMatch.teamB].find((team) => team?.id === picks.M104) || null;
}

export function pruneInvalidPicks(round32, picks) {
  let next = { ...picks };
  let changed = true;

  while (changed) {
    changed = false;
    const rounds = buildKnockoutRounds(round32, next);
    for (const round of rounds) {
      for (const match of round.matches) {
        const picked = next[match.id];
        if (!picked) continue;
        const valid = [match.teamA, match.teamB].some((team) => team?.id === picked);
        if (!valid) {
          delete next[match.id];
          changed = true;
        }
      }
    }
  }

  return next;
}

export function formatScoreValue(value) {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value - Math.round(value)) < EPS) return String(Math.round(value));
  return value.toFixed(1).replace('.', ',');
}

function buildScores(groupGames, predictions, mode) {
  const byGame = new Map();

  if (mode === 'general') {
    for (const pred of predictions || []) {
      if (!hasPredictionScore(pred)) continue;
      if (!byGame.has(pred.gameId)) byGame.set(pred.gameId, []);
      byGame.get(pred.gameId).push(pred);
    }

    return new Map(
      groupGames
        .map((game) => {
          const list = byGame.get(game.id) || [];
          if (!list.length) return null;
          return [game.id, {
            home: average(list.map((p) => Number(p.homePrediction))),
            away: average(list.map((p) => Number(p.awayPrediction))),
            count: list.length
          }];
        })
        .filter(Boolean)
    );
  }

  const predMap = new Map(
    (predictions || [])
      .filter(hasPredictionScore)
      .map((p) => [p.gameId, p])
  );

  return new Map(
    groupGames
      .map((game) => {
        const pred = predMap.get(game.id);
        if (!pred) return null;
        return [game.id, {
          home: Number(pred.homePrediction),
          away: Number(pred.awayPrediction),
          count: 1
        }];
      })
      .filter(Boolean)
  );
}

function buildStandings(groupGames, scores) {
  const byGroup = new Map();

  for (const game of groupGames) {
    const group = String(game.group).toUpperCase();
    if (!byGroup.has(group)) byGroup.set(group, { teams: new Map(), matches: [] });
    const bucket = byGroup.get(group);
    const home = teamFromGame(game, 'home', group);
    const away = teamFromGame(game, 'away', group);
    if (!bucket.teams.has(home.id)) bucket.teams.set(home.id, createRow(home, group));
    if (!bucket.teams.has(away.id)) bucket.teams.set(away.id, createRow(away, group));

    const score = scores.get(game.id);
    const homeRow = bucket.teams.get(home.id);
    const awayRow = bucket.teams.get(away.id);
    applyResult(homeRow, awayRow, score.home, score.away);
    bucket.matches.push({
      gameId: game.id,
      homeId: home.id,
      awayId: away.id,
      home: score.home,
      away: score.away,
      count: score.count
    });
  }

  return GROUPS
    .filter((group) => byGroup.has(group))
    .map((group) => {
      const bucket = byGroup.get(group);
      return {
        group,
        rows: rankGroup(Array.from(bucket.teams.values()), bucket.matches),
        matches: bucket.matches
      };
    });
}

function rankGroup(rows, matches) {
  const pointGroups = groupBy(rows, (row) => String(row.points));
  const pointKeys = Array.from(pointGroups.keys()).sort((a, b) => Number(b) - Number(a));

  return pointKeys.flatMap((key) => {
    const tied = pointGroups.get(key);
    if (tied.length === 1) return tied;
    return rankTiedRows(tied, matches);
  }).map((row, index) => ({ ...row, position: index + 1 }));
}

function rankTiedRows(rows, matches) {
  if (rows.length <= 1) return rows;

  const ids = new Set(rows.map((row) => row.team.id));
  const h2h = new Map(rows.map((row) => [row.team.id, createMiniRow(row)]));

  for (const match of matches) {
    if (!ids.has(match.homeId) || !ids.has(match.awayId)) continue;
    applyResult(h2h.get(match.homeId), h2h.get(match.awayId), match.home, match.away);
  }

  const keyed = groupBy(rows, (row) => {
    const mini = h2h.get(row.team.id);
    return `${mini.points}|${round(mini.gd)}|${round(mini.gf)}`;
  });

  if (keyed.size > 1) {
    const keys = Array.from(keyed.keys()).sort((a, b) => {
      const aa = a.split('|').map(Number);
      const bb = b.split('|').map(Number);
      return compareNumbers(bb[0], aa[0]) || compareNumbers(bb[1], aa[1]) || compareNumbers(bb[2], aa[2]);
    });
    return keys.flatMap((key) => rankTiedRows(keyed.get(key), matches));
  }

  return rows.slice().sort(compareOverallRows);
}

function compareOverallRows(a, b) {
  return (
    compareNumbers(b.points, a.points) ||
    compareNumbers(b.gd, a.gd) ||
    compareNumbers(b.gf, a.gf) ||
    compareNumbers(b.wins, a.wins) ||
    String(a.team.name || a.team.code).localeCompare(String(b.team.name || b.team.code))
  );
}

function rankThirdPlaced(rows) {
  return rows.slice().sort((a, b) => (
    compareNumbers(b.points, a.points) ||
    compareNumbers(b.gd, a.gd) ||
    compareNumbers(b.gf, a.gf) ||
    String(a.group).localeCompare(String(b.group))
  ));
}

function getThirdPlaceAssignment(groups) {
  const key = groups.slice().sort().join('');
  const row = THIRD_PLACE_MAP.get(key);
  if (!row) return null;
  return Object.fromEntries(THIRD_PLACE_COLUMNS.map((group, index) => [group, row[index]]));
}

function buildRound32(standings, bestThirds, thirdAssignment) {
  const standingsByGroup = new Map(standings.map((item) => [item.group, item.rows]));
  const thirdsByGroup = new Map(bestThirds.map((row) => [row.group, row]));

  function resolve(slot) {
    const position = Number(slot[0]);
    const group = slot[1];
    return standingsByGroup.get(group)?.[position - 1]?.team || null;
  }

  function resolveThird(winnerGroup) {
    const thirdGroup = thirdAssignment?.[winnerGroup];
    return thirdGroup ? thirdsByGroup.get(thirdGroup)?.team || null : null;
  }

  return ROUND_32_DEFS.map((def) => ({
    id: def.id,
    teamA: resolve(def.a),
    teamB: def.thirdFor ? resolveThird(def.thirdFor) : resolve(def.b),
    sourceA: def.a,
    sourceB: def.thirdFor ? `3${thirdAssignment?.[def.thirdFor] || '?'}` : def.b
  }));
}

function teamFromGame(game, side, group) {
  const prefix = side === 'home' ? 'home' : 'away';
  const code = game[`${prefix}TeamCode`] || '';
  const name = game[`${prefix}Team`] || code;
  const id = (code || name).toString().trim().toUpperCase();
  return {
    id,
    code,
    name,
    flag: game[`${prefix}TeamFlag`] || '',
    group
  };
}

function createRow(team, group) {
  return {
    team,
    group,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    gf: 0,
    ga: 0,
    gd: 0
  };
}

function createMiniRow(row) {
  return createRow(row.team, row.group);
}

function applyResult(homeRow, awayRow, homeScore, awayScore) {
  homeRow.played += 1;
  awayRow.played += 1;
  homeRow.gf += homeScore;
  homeRow.ga += awayScore;
  awayRow.gf += awayScore;
  awayRow.ga += homeScore;
  homeRow.gd = homeRow.gf - homeRow.ga;
  awayRow.gd = awayRow.gf - awayRow.ga;

  if (homeScore > awayScore + EPS) {
    homeRow.wins += 1;
    awayRow.losses += 1;
    homeRow.points += 3;
  } else if (awayScore > homeScore + EPS) {
    awayRow.wins += 1;
    homeRow.losses += 1;
    awayRow.points += 3;
  } else {
    homeRow.draws += 1;
    awayRow.draws += 1;
    homeRow.points += 1;
    awayRow.points += 1;
  }
}

function hasPredictionScore(pred) {
  return Number.isFinite(Number(pred?.homePrediction)) && Number.isFinite(Number(pred?.awayPrediction));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function compareNumbers(a, b) {
  const diff = a - b;
  return Math.abs(diff) < EPS ? 0 : diff;
}

function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime();
}
