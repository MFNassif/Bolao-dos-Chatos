const { admin, db } = require('./firebase');
const { scorePrediction } = require('./scoring');

const DEFAULT_POOL_SETTINGS = {
  betAmount: 50,
  currency: 'R$',
  prize1: 70,
  prize2: 20,
  prize3: 10,
  exactScorePoints: 5,
  correctResultPoints: 1
};

/**
 * Recalcula um jogo de forma INCREMENTAL:
 *  - so escreve nos palpites cujo resultado mudou;
 *  - aplica deltas (FieldValue.increment) nos agregados de users e poolMembers.
 *
 * Isso evita reler todos os palpites de todos os usuarios a cada gol
 * (o que estourava o limite gratuito do Firestore em dias de jogo).
 * O recalculo completo (recalculateAll) continua disponivel para true-up.
 */
async function recalculateGame(gameId, { recalculateUsers = true } = {}) {
  const firestore = db();
  const gameSnap = await firestore.collection('games').doc(gameId).get();
  if (!gameSnap.exists) throw new Error(`Jogo ${gameId} nao encontrado.`);
  const game = gameSnap.data();

  const hasScore = Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore);
  const isLive = game.status === 'live';
  const isFinished = game.status === 'finished';
  const preds = await firestore.collection('predictions').where('gameId', '==', gameId).get();

  const batch = firestore.batch();
  let writes = 0;
  const deltas = new Map(); // uid -> { points, exact, result }

  for (const p of preds.docs) {
    const pd = p.data();
    let result = { points: 0, exactScoreHit: false, resultHit: false };
    if (hasScore && (isLive || isFinished)) {
      result = scorePrediction(
        { home: pd.homePrediction, away: pd.awayPrediction },
        { home: game.homeScore, away: game.awayScore }
      );
    }

    const changed =
      (pd.points || 0) !== result.points ||
      !!pd.exactScoreHit !== result.exactScoreHit ||
      !!pd.resultHit !== result.resultHit ||
      !!pd.isFinalized !== isFinished;
    if (!changed) continue;

    const update = {
      points: result.points,
      exactScoreHit: result.exactScoreHit,
      resultHit: result.resultHit,
      isFinalized: isFinished
    };
    if (isFinished) {
      update.lockedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    batch.set(p.ref, update, { merge: true });
    writes += 1;

    if (pd.userId) {
      const d = deltas.get(pd.userId) || { points: 0, exact: 0, result: 0 };
      d.points += result.points - (pd.points || 0);
      d.exact += (result.exactScoreHit ? 1 : 0) - (pd.exactScoreHit ? 1 : 0);
      d.result += (result.resultHit ? 1 : 0) - (pd.resultHit ? 1 : 0);
      deltas.set(pd.userId, d);
    }
  }
  if (writes > 0) await batch.commit();

  if (recalculateUsers && deltas.size > 0) {
    await applyAggregateDeltas(deltas);
  }
  return { predictions: preds.size, users: deltas.size, changed: writes };
}

async function applyAggregateDeltas(deltas) {
  const firestore = db();
  const inc = admin.firestore.FieldValue.increment;
  const settingsCache = new Map();

  for (const [uid, d] of deltas.entries()) {
    if (!d.points && !d.exact && !d.result) continue;

    await firestore.collection('users').doc(uid).set({
      totalPoints: inc(d.points),
      exactScores: inc(d.exact),
      correctResults: inc(d.result),
      lastScoreUpdate: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const members = await firestore.collection('poolMembers').where('uid', '==', uid).get();
    for (const member of members.docs) {
      const poolId = member.data().poolId;
      if (!poolId) continue;
      const settings = await getPoolSettings(poolId, settingsCache);
      const exactPts = toNumber(settings.exactScorePoints, DEFAULT_POOL_SETTINGS.exactScorePoints);
      const resultPts = toNumber(settings.correctResultPoints, DEFAULT_POOL_SETTINGS.correctResultPoints);
      // totalPoints do bolao deriva dos contadores: cravada vale exactPts,
      // acerto de resultado nao cravado vale resultPts.
      const dTotal = d.exact * exactPts + (d.result - d.exact) * resultPts;
      await member.ref.set({
        totalPoints: inc(dTotal),
        exactScores: inc(d.exact),
        correctResults: inc(d.result),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
}

/**
 * Recalculo ABSOLUTO dos agregados de um usuario (users + poolMembers).
 * Usado pelo recalculateAll (true-up) e apos ajustes manuais.
 */
async function recalculateUserAggregates(uid, caches = {}) {
  const firestore = db();
  const gameCache = caches.gameCache || new Map();
  const settingsCache = caches.settingsCache || new Map();
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

  await recalculateUserPoolMemberships(uid, snap.docs, { gameCache, settingsCache });
}

async function recalculateAll() {
  const firestore = db();
  // Caches compartilhados entre todos os usuarios: cada jogo e cada bolao
  // sao lidos uma unica vez no recalculo completo.
  const gameCache = new Map();
  const settingsCache = new Map();

  const games = await firestore.collection('games')
    .where('status', 'in', ['live', 'finished']).get();
  let predictions = 0;
  for (const g of games.docs) {
    gameCache.set(g.id, g.data());
    const r = await recalculateGame(g.id, { recalculateUsers: false });
    predictions += r.predictions;
  }
  const users = await firestore.collection('users').get();
  for (const u of users.docs) {
    await recalculateUserAggregates(u.id, { gameCache, settingsCache });
  }
  return { predictions, users: users.size };
}

async function recalculateUserPoolMemberships(uid, predDocs, caches) {
  const firestore = db();
  const members = await firestore.collection('poolMembers').where('uid', '==', uid).get();
  for (const member of members.docs) {
    await recalculatePoolMemberAggregate(member, predDocs, caches);
  }
}

async function recalculatePoolMemberAggregate(memberDoc, predDocs, caches) {
  const member = memberDoc.data();
  if (!member.uid || !member.poolId) return;

  const settings = await getPoolSettings(member.poolId, caches.settingsCache);

  let totalPoints = 0;
  let exactScores = 0;
  let correctResults = 0;

  for (const p of predDocs) {
    const pred = p.data();
    const game = await getGameForPrediction(pred.gameId, caches.gameCache);
    if (!game || !isScoreableGame(game)) continue;
    const result = scorePrediction(
      { home: pred.homePrediction, away: pred.awayPrediction },
      { home: game.homeScore, away: game.awayScore },
      settings
    );
    totalPoints += result.points || 0;
    if (result.exactScoreHit) exactScores += 1;
    if (result.resultHit) correctResults += 1;
  }

  await memberDoc.ref.set({
    totalPoints,
    exactScores,
    correctResults,
    predictionsCount: predDocs.length,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function getPoolSettings(poolId, cache) {
  if (cache && cache.has(poolId)) return cache.get(poolId);
  const snap = await db().collection('pools').doc(poolId).get();
  const settings = snap.exists
    ? { ...DEFAULT_POOL_SETTINGS, ...snap.data() }
    : DEFAULT_POOL_SETTINGS;
  if (cache) cache.set(poolId, settings);
  return settings;
}

async function getGameForPrediction(gameId, cache) {
  if (!gameId) return null;
  if (!cache.has(gameId)) {
    const snap = await db().collection('games').doc(gameId).get();
    cache.set(gameId, snap.exists ? snap.data() : null);
  }
  return cache.get(gameId);
}

function isScoreableGame(game) {
  return (game.status === 'live' || game.status === 'finished') &&
    Number.isInteger(game.homeScore) &&
    Number.isInteger(game.awayScore);
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = { recalculateGame, recalculateAll, recalculateUserAggregates };
