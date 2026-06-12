/**
 * Atualiza placares dos jogos a partir da API externa.
 *
 * Sempre que detectar mudança no placar OU no status (live/finished),
 * dispara o recálculo da pontuação daquele jogo. Isso faz o ranking
 * "pulsar" em tempo real conforme os gols saem.
 */
const { admin, db } = require('./firebase');
const { fetchFixtures, mapFixtureToGame } = require('./footballApi');
const { recalculateGame } = require('./scoringEngine');

async function updateResults() {
  const firestore = db();
  const start = Date.now();
  let updated = 0;
  let recalculated = 0;
  let success = true;
  let message = '';

  try {
    const fixtures = await fetchFixtures();
    const existingSnap = await firestore.collection('games').get();
    const byExt = new Map();
    const existingGames = [];
    existingSnap.forEach((d) => {
      const data = d.data();
      existingGames.push({ id: d.id, data });
      if (data.externalId) byExt.set(String(data.externalId), { id: d.id, data });
    });

    for (const fx of fixtures) {
      const game = mapFixtureToGame(fx);
      const existing = byExt.get(game.externalId) || findExistingGame(game, existingGames);
      if (!existing) continue;
      const cur = existing.data;

      const statusChanged = cur.status !== game.status;
      const scoreChanged = cur.homeScore !== game.homeScore || cur.awayScore !== game.awayScore;
      if (!statusChanged && !scoreChanged) continue;

      await firestore.collection('games').doc(existing.id).set({
        status: game.status,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        winner: game.winner,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      updated += 1;

      // Recalcular sempre que houver placar e estiver live OU finished.
      // Também recalcular se um jogo regrediu (live -> scheduled, por exemplo)
      // para zerar pontos parciais antigos.
      const shouldRecalculate =
        game.status === 'live' ||
        game.status === 'finished' ||
        cur.status === 'live'; // saiu de live: zera os pontos parciais

      if (shouldRecalculate) {
        await recalculateGame(existing.id);
        recalculated += 1;
      }
    }

    message = `Atualizados ${updated} jogos. ${recalculated} recálculos disparados.`;
  } catch (err) {
    success = false;
    message = err.message || String(err);
    console.error('[updateResults] erro:', err);
  }

  await firestore.collection('syncLogs').add({
    type: 'updateResults',
    success,
    message,
    updated,
    recalculated,
    durationMs: Date.now() - start,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success, updated, recalculated, message };
}

module.exports = { updateResults };

function findExistingGame(game, existingGames) {
  const targetTime = toMillis(game.startTime);
  if (!targetTime) return null;

  let best = null;
  let bestScore = 0;
  for (const existing of existingGames) {
    const data = existing.data;
    const existingTime = toMillis(data.startTime);
    if (!existingTime || Math.abs(existingTime - targetTime) > 3 * 60 * 60 * 1000) continue;

    const score =
      sameTeam(game.homeTeamCode, game.homeTeam, data.homeTeamCode, data.homeTeam) &&
      sameTeam(game.awayTeamCode, game.awayTeam, data.awayTeamCode, data.awayTeam)
        ? 3
        : 0;
    if (score > bestScore) {
      best = existing;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

function sameTeam(codeA, nameA, codeB, nameB) {
  const aCode = normalize(codeA);
  const bCode = normalize(codeB);
  if (aCode && bCode && aCode === bCode) return true;

  const aName = normalize(nameA);
  const bName = normalize(nameB);
  if (!aName || !bName) return false;
  return aName === bName || aName.includes(bName) || bName.includes(aName);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
