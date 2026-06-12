/**
 * Atualiza placares dos jogos a partir da API externa.
 *
 * Sempre que detectar mudanca no placar OU no status (live/finished),
 * dispara o recalculo da pontuacao daquele jogo. Isso faz o ranking
 * atualizar automaticamente conforme os gols saem.
 */
const { admin, db } = require('./firebase');
const { fetchFixtures, mapFixtureToGame } = require('./footballApi');
const { recalculateGame } = require('./scoringEngine');
const { isRegressiveApiUpdate } = require('./gameUpdateGuards');

// Janela de jogos relevantes: live (sempre), scheduled prestes a comecar e
// finished recentes (correcoes tardias da API). Evita ler a colecao inteira
// de jogos a cada execucao do cron.
const UPCOMING_MINUTES = 30;
const RECENT_HOURS = 6;

async function loadRelevantGames(firestore) {
  const now = Date.now();
  const soon = new Date(now + UPCOMING_MINUTES * 60 * 1000);
  const recentStart = new Date(now - RECENT_HOURS * 60 * 60 * 1000);

  const [liveSnap, schedSnap, recentSnap] = await Promise.all([
    firestore.collection('games')
      .where('status', '==', 'live')
      .get(),
    firestore.collection('games')
      .where('status', '==', 'scheduled')
      .where('startTime', '>=', recentStart)
      .where('startTime', '<=', soon)
      .get(),
    firestore.collection('games')
      .where('status', '==', 'finished')
      .where('startTime', '>=', recentStart)
      .get()
  ]);

  const docs = new Map();
  [liveSnap, schedSnap, recentSnap].forEach((snap) => {
    snap.forEach((d) => docs.set(d.id, d));
  });
  return Array.from(docs.values());
}

async function updateResults() {
  const firestore = db();
  const start = Date.now();
  let updated = 0;
  let recalculated = 0;
  let skippedRegressions = 0;
  let success = true;
  let message = '';

  try {
    const relevantDocs = await loadRelevantGames(firestore);
    if (relevantDocs.length === 0) {
      return { success: true, updated: 0, recalculated: 0, skippedRegressions: 0, message: 'Nenhum jogo na janela ativa.' };
    }

    const fixtures = await fetchFixtures();
    const byExt = new Map();
    relevantDocs.forEach((d) => {
      const data = d.data();
      if (data.externalId) byExt.set(String(data.externalId), { id: d.id, data });
    });

    for (const fx of fixtures) {
      const game = mapFixtureToGame(fx);
      const existing = byExt.get(game.externalId);
      if (!existing) continue;
      const cur = existing.data;

      if (isRegressiveApiUpdate(cur, game)) {
        skippedRegressions += 1;
        continue;
      }

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

      // Recalcula sempre que houver placar ao vivo/finalizado.
      // Se sair de live sem placar valido, tambem recalcula para limpar pontos parciais.
      const shouldRecalculate =
        game.status === 'live' ||
        game.status === 'finished' ||
        cur.status === 'live';

      if (shouldRecalculate) {
        await recalculateGame(existing.id);
        recalculated += 1;
      }
    }

    message = `Atualizados ${updated} jogos. ${recalculated} recalculos disparados. ${skippedRegressions} regressoes ignoradas.`;
  } catch (err) {
    success = false;
    message = err.message || String(err);
    console.error('[updateResults] erro:', err);
  }

  // Em modo plantao o updateResults roda a cada ~90s; so grava log quando
  // algo mudou ou deu erro, para nao inflar syncLogs (e o limite gratuito).
  if (!success || updated > 0) {
    await firestore.collection('syncLogs').add({
      type: 'updateResults',
      success,
      message,
      updated,
      recalculated,
      skippedRegressions,
      durationMs: Date.now() - start,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return { success, updated, recalculated, skippedRegressions, message };
}

module.exports = { updateResults };
