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
    existingSnap.forEach((d) => {
      const data = d.data();
      if (data.externalId) byExt.set(String(data.externalId), { id: d.id, data });
    });

    for (const fx of fixtures) {
      const game = mapFixtureToGame(fx);
      const existing = byExt.get(game.externalId);
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
