/**
 * Motor de pontuação (servidor — GitHub Actions com firebase-admin).
 *
 * REGRA DE TEMPO REAL:
 * - Há UM único campo de pontuação visível: `totalPoints` no user.
 * - Quando um jogo está `live`, recalculamos `points` do palpite com base
 *   no placar parcial. O ranking já reflete esse valor.
 * - Quando o jogo termina (`finished`), o `points` permanece, agora
 *   "congelado" naquele resultado final.
 * - Se um jogo regredir de finished para scheduled (correção do admin),
 *   ou tiver placar removido, os pontos zeram.
 *
 * Em palpites guardamos também:
 * - `isFinalized`: false enquanto live; true quando finished.
 * - `exactScoreHit` / `resultHit`: reflete o estado atual (parcial ou final).
 */
const { admin, db } = require('./firebase');
const { scorePrediction } = require('./scoring');

/**
 * Recalcula pontuação dos palpites de um jogo (live ou finished).
 */
async function recalculateGame(gameId) {
  const firestore = db();
  const gameSnap = await firestore.collection('games').doc(gameId).get();
  if (!gameSnap.exists) throw new Error(`Jogo ${gameId} não encontrado.`);
  const game = gameSnap.data();

  const hasScore = Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore);
  const isLive = game.status === 'live';
  const isFinished = game.status === 'finished';

  const preds = await firestore.collection('predictions').where('gameId', '==', gameId).get();
  let batch = firestore.batch();
  let ops = 0;
  const touched = new Set();

  async function queueSet(ref, data, options) {
    batch.set(ref, data, options);
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = firestore.batch();
      ops = 0;
    }
  }

  for (const p of preds.docs) {
    const pd = p.data();
    let result = { points: 0, exactScoreHit: false, resultHit: false };
    if (hasScore && (isLive || isFinished)) {
      result = scorePrediction(
        { home: pd.homePrediction, away: pd.awayPrediction },
        { home: game.homeScore, away: game.awayScore }
      );
    }

    const prevPoints = pd.points || 0;
    const prevExact = pd.exactScoreHit ? 1 : 0;
    const prevResult = pd.resultHit ? 1 : 0;
    const nextExact = result.exactScoreHit ? 1 : 0;
    const nextResult = result.resultHit ? 1 : 0;

    const update = {
      points: result.points,
      exactScoreHit: result.exactScoreHit,
      resultHit: result.resultHit,
      isFinalized: isFinished
    };
    if (isFinished) {
      update.lockedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await queueSet(p.ref, update, { merge: true });

    if (pd.userId) {
      const deltaPoints = result.points - prevPoints;
      const deltaExact = nextExact - prevExact;
      const deltaResult = nextResult - prevResult;
      if (deltaPoints || deltaExact || deltaResult) {
        await queueSet(firestore.collection('users').doc(pd.userId), {
          totalPoints: admin.firestore.FieldValue.increment(deltaPoints),
          exactScores: admin.firestore.FieldValue.increment(deltaExact),
          correctResults: admin.firestore.FieldValue.increment(deltaResult),
          lastScoreUpdate: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      touched.add(pd.userId);
    }
  }
  if (ops > 0) await batch.commit();
  return { predictions: preds.size, users: touched.size };
}

/**
 * Recalcula agregados do usuário (soma de todos os palpites).
 * `totalPoints` inclui jogos live (pulsa) e finished (congelado).
 */
async function recalculateUserAggregates(uid) {
  const firestore = db();
  const snap = await firestore.collection('predictions').where('userId', '==', uid).get();

  let totalPoints = 0;
  let exactScores = 0;
  let correctResults = 0;
  for (const p of snap.docs) {
    const d = p.data();
    totalPoints += d.points || 0;
    if (d.exactScoreHit) exactScores += 1;
    if (d.resultHit) correctResults += 1;
  }

  await firestore.collection('users').doc(uid).set({
    totalPoints,
    exactScores,
    correctResults,
    predictionsCount: snap.size,
    lastScoreUpdate: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

/**
 * Recalcula tudo: para cada jogo live + finished, recalcula palpites.
 * Depois recalcula agregados de TODOS os usuários (zera quem não tem palpite).
 */
async function recalculateAll() {
  const firestore = db();
  const games = await firestore.collection('games')
    .where('status', 'in', ['live', 'finished']).get();
  let predictions = 0;
  for (const g of games.docs) {
    const r = await recalculateGame(g.id);
    predictions += r.predictions;
  }
  const users = await firestore.collection('users').get();
  for (const u of users.docs) {
    await recalculateUserAggregates(u.id);
  }
  return { predictions, users: users.size };
}

module.exports = { recalculateGame, recalculateAll, recalculateUserAggregates };
