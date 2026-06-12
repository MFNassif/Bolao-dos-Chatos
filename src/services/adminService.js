/**
 * Ações administrativas executadas direto pelo navegador.
 *
 * Funciona porque os usuários com role="admin" têm permissão de escrita
 * no Firestore (ver firestore.rules). A sincronização com a API externa NÃO
 * acontece aqui — roda no GitHub Actions com a FOOTBALL_API_KEY em Secrets.
 *
 * Aqui ficam:
 *   - corrigir resultado/status manualmente de um jogo;
 *   - recalcular pontuação (live + finished);
 *   - alterar role de outro usuário.
 *
 * IMPORTANTE: A pontuação `points` no palpite representa o estado ATUAL.
 * Quando o jogo está `live` ela varia; quando `finished`, congela.
 * Sempre há um único campo de pontuação no usuário: `totalPoints`.
 */
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { scorePrediction } from '../utils/scoring';

/**
 * Salva um placar/status manualmente e recalcula a pontuação daquele jogo.
 */
export async function setGameResult({ gameId, homeScore, awayScore, status }) {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Jogo não encontrado.');

  const payload = { lastUpdatedAt: serverTimestamp() };
  payload.homeScore = (homeScore === null || homeScore === undefined || homeScore === '')
    ? null : Number(homeScore);
  payload.awayScore = (awayScore === null || awayScore === undefined || awayScore === '')
    ? null : Number(awayScore);
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
  }

  await writeBatch(db).set(gameRef, payload, { merge: true }).commit();
  await recalculateGameScores(gameId);

  const logRef = doc(collection(db, 'syncLogs'));
  await writeBatch(db).set(logRef, {
    type: 'setGameResult',
    success: true,
    message: `Resultado ajustado para ${gameId}: ${payload.homeScore ?? '-'} x ${payload.awayScore ?? '-'} (${payload.status || '-'})`,
    createdAt: serverTimestamp()
  }).commit();
}

/**
 * Remove a conta do bolao no Firestore: perfil, username reservado e palpites.
 * O Firebase Auth exige Admin SDK/back-end para excluir outro usuario de login.
 */
export async function deleteUserAccount({ uid, username }) {
  if (!uid) throw new Error('Usuario invalido.');

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('userId', '==', uid)));
  let batch = writeBatch(db);
  let ops = 0;

  async function addDelete(ref) {
    batch.delete(ref);
    ops += 1;
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  for (const pred of predsSnap.docs) {
    await addDelete(pred.ref);
  }

  if (username) await addDelete(doc(db, 'usernames', String(username).toLowerCase()));
  await addDelete(doc(db, 'users', uid));

  const logRef = doc(collection(db, 'syncLogs'));
  batch.set(logRef, {
    type: 'deleteUserAccount',
    success: true,
    message: `Conta ${uid} removida do Firestore (${predsSnap.size} palpites).`,
    createdAt: serverTimestamp()
  });
  await batch.commit();

  return { predictions: predsSnap.size };
}

/**
 * Recalcula pontuação dos palpites de UM jogo e atualiza agregados dos
 * usuários envolvidos. Vale tanto para live quanto para finished.
 */
export async function recalculateGameScores(gameId) {
  const gameSnap = await getDoc(doc(db, 'games', gameId));
  if (!gameSnap.exists()) throw new Error('Jogo não encontrado.');
  const game = gameSnap.data();

  const hasScore = Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore);
  const isLive = game.status === 'live';
  const isFinished = game.status === 'finished';

  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('gameId', '==', gameId)));

  const batch = writeBatch(db);
  const touched = new Set();
  for (const p of predsSnap.docs) {
    const pd = p.data();
    let result = { points: 0, exactScoreHit: false, resultHit: false };
    if (hasScore && (isLive || isFinished)) {
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
    touched.add(pd.userId);
  }
  await batch.commit();

  for (const uid of touched) {
    await recalculateUserAggregates(uid);
  }
  return { predictions: predsSnap.size, users: touched.size };
}

/**
 * Atualiza agregados de um usuário a partir dos próprios palpites.
 */
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
}

/**
 * Recalcula pontuação de TODOS os jogos live + finished e dos agregados de todos os usuários.
 */
export async function recalculateAllScores() {
  const gamesSnap = await getDocs(
    query(collection(db, 'games'), where('status', 'in', ['live', 'finished']))
  );
  let totalPreds = 0;
  for (const g of gamesSnap.docs) {
    const r = await recalculateGameScores(g.id);
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
    message: `Recálculo total: ${totalPreds} palpites, ${usersSnap.size} usuários.`,
    createdAt: serverTimestamp()
  }).commit();

  return { predictions: totalPreds, users: usersSnap.size };
}

/**
 * Promove/rebaixa um usuário.
 */
export async function setUserRole(uid, role) {
  if (!['user', 'admin'].includes(role)) throw new Error('Role inválida.');
  await writeBatch(db).set(doc(db, 'users', uid), { role }, { merge: true }).commit();

  const logRef = doc(collection(db, 'syncLogs'));
  await writeBatch(db).set(logRef, {
    type: 'setUserRole',
    success: true,
    message: `Usuário ${uid} agora é ${role}.`,
    createdAt: serverTimestamp()
  }).commit();
}
