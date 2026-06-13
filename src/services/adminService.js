import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_POOL_SETTINGS } from './settingsService';
import { scorePrediction } from '../utils/scoring';

export async function setGameResult({ gameId, homeScore, awayScore, status }) {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Jogo nao encontrado.');

  const payload = { lastUpdatedAt: serverTimestamp() };
  payload.homeScore = (homeScore === null || homeScore === undefined || homeScore === '')
    ? null
    : Number(homeScore);
  payload.awayScore = (awayScore === null || awayScore === undefined || awayScore === '')
    ? null
    : Number(awayScore);
  if (status && ['scheduled', 'live', 'finished'].includes(status)) {
    payload.status = status;
  }
  if (
    payload.status === 'finished' &&
    Number.isInteger(payload.homeScore) &&
    Number.isInteger(payload.awayScore)
  ) {
    if (payload.homeScore > payload.awayScore) payload.winner = 'home';
    else if (payload.homeScore < payload.awayScore) payload.winner = 'away';
    else payload.winner = 'draw';
  } else {
    payload.winner = null;
  }
  // "Não começou" = sem resultado: limpa o placar para nao haver jogo
  // scheduled com placar (que apareceria e contaria de forma inconsistente).
  if (payload.status === 'scheduled') {
    payload.homeScore = null;
    payload.awayScore = null;
    payload.winner = null;
  }

  await writeBatch(db).set(gameRef, payload, { merge: true }).commit();
  // Recalcula a pontuacao deste jogo na hora: palpites -> usuarios -> ranking.
  await recalculateGameScores(gameId);

  const logRef = doc(collection(db, 'syncLogs'));
  await writeBatch(db).set(logRef, {
    type: 'setGameResult',
    success: true,
    message: `Resultado ajustado para ${gameId}: ${payload.homeScore ?? '-'} x ${payload.awayScore ?? '-'} (${payload.status || '-'})`,
    createdAt: serverTimestamp()
  }).commit();
}

export async function recalculateGameScores(gameId, { recalculateUsers = true } = {}) {
  const gameSnap = await getDoc(doc(db, 'games', gameId));
  if (!gameSnap.exists()) throw new Error('Jogo nao encontrado.');
  const game = gameSnap.data();

  const hasScore = Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore);
  const isFinished = game.status === 'finished';
  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('gameId', '==', gameId)));

  const batch = writeBatch(db);
  const touched = new Set();
  for (const p of predsSnap.docs) {
    const pd = p.data();
    let result = { points: 0, exactScoreHit: false, resultHit: false };
    // Conta sempre que houver placar (os dois numeros). O status passa a ser
    // apenas rotulo de exibicao (ao vivo/encerrado).
    if (hasScore) {
      result = scorePrediction(
        { home: pd.homePrediction, away: pd.awayPrediction },
        { home: game.homeScore, away: game.awayScore }
      );
    }
    const update = {
      points: result.points,
      exactScoreHit: result.exactScoreHit,
      resultHit: result.resultHit,
      isFinalized: isFinished
    };
    if (isFinished) update.lockedAt = serverTimestamp();
    batch.set(p.ref, update, { merge: true });
    if (pd.userId) touched.add(pd.userId);
  }
  await batch.commit();

  if (recalculateUsers) {
    for (const uid of touched) {
      await recalculateUserAggregates(uid);
    }
  }
  return { predictions: predsSnap.size, users: touched.size };
}

export async function recalculateUserAggregates(uid) {
  const snap = await getDocs(query(collection(db, 'predictions'), where('userId', '==', uid)));
  let totalPoints = 0;
  let exactScores = 0;
  let correctResults = 0;

  for (const p of snap.docs) {
    const d = p.data();
    totalPoints += d.points || 0;
    if (d.exactScoreHit) exactScores += 1;
    if (d.resultHit) correctResults += 1;
  }

  await writeBatch(db).set(doc(db, 'users', uid), {
    totalPoints,
    exactScores,
    correctResults,
    predictionsCount: snap.size,
    lastScoreUpdate: serverTimestamp()
  }, { merge: true }).commit();

  await recalculateUserPoolMemberships(uid);
}

export async function recalculateAllScores() {
  const gamesSnap = await getDocs(
    query(collection(db, 'games'), where('status', 'in', ['live', 'finished']))
  );
  let totalPreds = 0;
  for (const g of gamesSnap.docs) {
    const r = await recalculateGameScores(g.id, { recalculateUsers: false });
    totalPreds += r.predictions;
  }

  const usersSnap = await getDocs(collection(db, 'users'));
  for (const u of usersSnap.docs) {
    await recalculateUserAggregates(u.id);
  }

  const logRef = doc(collection(db, 'syncLogs'));
  await writeBatch(db).set(logRef, {
    type: 'recalculateAll',
    success: true,
    message: `Recalculo total: ${totalPreds} palpites, ${usersSnap.size} usuarios.`,
    createdAt: serverTimestamp()
  }).commit();

  return { predictions: totalPreds, users: usersSnap.size };
}

export async function recalculatePoolScores(poolId) {
  if (!poolId) throw new Error('Bolao ativo nao encontrado.');

  const settings = await getPoolSettings(poolId);
  const membersSnap = await getDocs(query(collection(db, 'poolMembers'), where('poolId', '==', poolId)));
  const memberByUid = new Map(membersSnap.docs.map(member => [member.data().uid, member]));
  const aggregates = new Map();

  membersSnap.docs.forEach(member => {
    const uid = member.data().uid;
    if (!uid) return;
    aggregates.set(uid, {
      totalPoints: 0,
      exactScores: 0,
      correctResults: 0,
      predictionsCount: 0
    });
  });

  const gamesSnap = await getDocs(
    query(collection(db, 'games'), where('status', 'in', ['live', 'finished']))
  );
  const gameById = new Map(gamesSnap.docs.map(game => [game.id, game.data()]));

  let totalPredictions = 0;
  for (const memberDoc of membersSnap.docs) {
    const uid = memberDoc.data().uid;
    const agg = aggregates.get(uid);
    if (!uid || !agg) continue;

    const predsSnap = await getDocs(query(collection(db, 'predictions'), where('userId', '==', uid)));
    totalPredictions += predsSnap.size;
    agg.predictionsCount = predsSnap.size;

    predsSnap.docs.forEach(predDoc => {
      const pred = predDoc.data();
      const game = gameById.get(pred.gameId);
      if (!game || !isScoreableGame(game)) return;

      const result = scorePrediction(
        { home: pred.homePrediction, away: pred.awayPrediction },
        { home: game.homeScore, away: game.awayScore },
        settings
      );
      agg.totalPoints += result.points || 0;
      if (result.exactScoreHit) agg.exactScores += 1;
      if (result.resultHit) agg.correctResults += 1;
    });
  }

  let batch = writeBatch(db);
  let ops = 0;
  for (const [uid, agg] of aggregates.entries()) {
    const memberDoc = memberByUid.get(uid);
    if (!memberDoc) continue;
    batch.set(memberDoc.ref, {
      ...agg,
      updatedAt: serverTimestamp()
    }, { merge: true });
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  const logRef = doc(collection(db, 'syncLogs'));
  await writeBatch(db).set(logRef, {
    type: 'recalculatePool',
    success: true,
    message: `Recalculo do bolao ${poolId}: ${totalPredictions} palpites, ${membersSnap.size} usuarios.`,
    poolId,
    predictions: totalPredictions,
    users: membersSnap.size,
    createdAt: serverTimestamp()
  }).commit();

  return { predictions: totalPredictions, users: membersSnap.size };
}

export async function setUserRole(uid, role) {
  if (!['user', 'admin'].includes(role)) throw new Error('Role invalida.');
  await writeBatch(db).set(doc(db, 'users', uid), { role }, { merge: true }).commit();

  const membersSnap = await getDocs(query(collection(db, 'poolMembers'), where('uid', '==', uid)));
  if (!membersSnap.empty) {
    const batch = writeBatch(db);
    membersSnap.docs.forEach(member => {
      batch.set(member.ref, { role, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }

  const logRef = doc(collection(db, 'syncLogs'));
  await writeBatch(db).set(logRef, {
    type: 'setUserRole',
    success: true,
    message: `Usuario ${uid} agora e ${role}.`,
    createdAt: serverTimestamp()
  }).commit();
}

export async function removeUserFromPool({ uid, poolId, currentUid }) {
  if (!uid || !poolId) throw new Error('Usuario ou bolao invalido.');
  if (uid === currentUid) throw new Error('Voce nao pode remover a si mesmo do bolao ativo.');

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : null;

  const membersSnap = await getDocs(query(collection(db, 'poolMembers'), where('uid', '==', uid)));
  const targetMember = membersSnap.docs.find(member => member.data().poolId === poolId);
  if (!targetMember) throw new Error('Usuario nao faz parte desse bolao.');

  const remainingPools = membersSnap.docs
    .map(member => ({ id: member.id, ref: member.ref, ...member.data() }))
    .filter(member => member.poolId !== poolId);

  const poolPredsSnap = await getDocs(query(collection(db, 'poolPredictions'), where('userId', '==', uid)));
  const predictionRefs = poolPredsSnap.docs
    .filter(pred => pred.data().poolId === poolId)
    .map(pred => pred.ref);

  await deleteRefsInChunks([
    targetMember.ref,
    doc(db, 'poolAccess', `${poolId}_${uid}`),
    ...predictionRefs
  ]);

  if (userData?.activePoolId === poolId) {
    const nextPool = remainingPools[0] || null;
    await writeBatch(db).set(userRef, {
      activePoolId: nextPool?.poolId || '',
      activePoolName: nextPool?.poolName || '',
      lastPoolAccessAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }).commit();
  }

  const logRef = doc(collection(db, 'syncLogs'));
  await writeBatch(db).set(logRef, {
    type: 'removeUserFromPool',
    success: true,
    message: `Usuario ${uid} removido do bolao ${poolId}. ${predictionRefs.length} palpites visiveis removidos.`,
    createdAt: serverTimestamp()
  }).commit();

  return {
    removedPredictions: predictionRefs.length,
    remainingPools: remainingPools.length
  };
}

async function recalculateUserPoolMemberships(uid) {
  const membersSnap = await getDocs(query(collection(db, 'poolMembers'), where('uid', '==', uid)));
  for (const member of membersSnap.docs) {
    await recalculatePoolMemberAggregate(member);
  }
}

async function recalculatePoolMemberAggregate(memberDoc) {
  const member = memberDoc.data();
  if (!member.uid || !member.poolId) return;

  const settings = await getPoolSettings(member.poolId);
  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('userId', '==', member.uid)));
  const gameCache = new Map();

  let totalPoints = 0;
  let exactScores = 0;
  let correctResults = 0;

  for (const p of predsSnap.docs) {
    const pred = p.data();
    const game = await getGameForPrediction(pred.gameId, gameCache);
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

  await writeBatch(db).set(memberDoc.ref, {
    totalPoints,
    exactScores,
    correctResults,
    predictionsCount: predsSnap.size,
    updatedAt: serverTimestamp()
  }, { merge: true }).commit();
}

async function getPoolSettings(poolId) {
  const snap = await getDoc(doc(db, 'pools', poolId));
  return snap.exists()
    ? { ...DEFAULT_POOL_SETTINGS, ...snap.data() }
    : DEFAULT_POOL_SETTINGS;
}

async function getGameForPrediction(gameId, cache) {
  if (!gameId) return null;
  if (!cache.has(gameId)) {
    const snap = await getDoc(doc(db, 'games', gameId));
    cache.set(gameId, snap.exists() ? snap.data() : null);
  }
  return cache.get(gameId);
}

function isScoreableGame(game) {
  // Um jogo conta pontos quando tem placar (os dois numeros). Jogos
  // "scheduled" nao tem placar (o setGameResult limpa), entao ficam de fora.
  return Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore);
}

async function deleteRefsInChunks(refs) {
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}
