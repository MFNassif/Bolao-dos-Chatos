import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { isLocked, LOCK_OFFSET_MS } from '../utils/locks';

export function predictionId(gameId, userId) {
  return `${gameId}_${userId}`;
}

export function poolPredictionId(poolId, gameId, userId) {
  return `${poolId}_${gameId}_${userId}`;
}

export function subscribeMyPredictions(userId, callback) {
  const q = query(collection(db, 'predictions'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  }, (err) => {
    console.warn('Falha ao carregar meus palpites.', err);
    callback([]);
  });
}

export function subscribePoolPredictionsForGame(poolId, gameId, callback) {
  if (!poolId || !gameId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'poolPredictions'),
    where('poolId', '==', poolId),
    where('gameId', '==', gameId)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  }, (err) => {
    console.warn('Falha ao carregar palpites do bolao.', err);
    callback([]);
  });
}

export async function savePrediction({ user, profile, game, home, away, existingPrediction = null }) {
  if (!game) throw new Error('Jogo inválido.');
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!profile?.username) throw new Error('Perfil ainda não carregou. Tente novamente em alguns segundos.');
  if (isLocked(game.startTime)) throw new Error('Palpite bloqueado.');

  const h = Number(home);
  const a = Number(away);
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 30 || a > 30) {
    throw new Error('Placar inválido. Use números inteiros entre 0 e 30.');
  }

  const id = predictionId(game.id, user.uid);
  const ref = doc(db, 'predictions', id);
  const pools = await getMyPoolMemberships(user.uid);
  const displayName = profile.displayName || profile.username;
  const updatePayload = {
    homePrediction: h,
    awayPrediction: a,
    username: profile.username,
    displayName,
    updatedAt: serverTimestamp()
  };
  const createPayload = {
    userId: user.uid,
    username: profile.username,
    displayName,
    gameId: game.id,
    homePrediction: h,
    awayPrediction: a,
    points: 0,
    exactScoreHit: false,
    resultHit: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lockedAt: null
  };

  if (existingPrediction?.id) {
    await updateDoc(ref, updatePayload);
  } else {
    try {
      await setDoc(ref, createPayload);
    } catch (err) {
      // Se a lista de palpites ainda nao carregou, o documento pode ja existir.
      // Nesse caso, uma atualizacao pontual evita sobrescrever pontos calculados.
      if (err?.code !== 'permission-denied' && err?.code !== 'already-exists') throw err;
      await updateDoc(ref, updatePayload);
    }
  }

  await syncPredictionToPools({
    user,
    profile,
    game,
    sourcePredictionId: id,
    homePrediction: h,
    awayPrediction: a,
    pools
  });
}

export async function syncMyPredictionsToPool({ user, poolId, poolName }) {
  if (!user?.uid || !poolId) return;
  const snap = await getDocs(query(collection(db, 'predictions'), where('userId', '==', user.uid)));
  if (snap.empty) return;

  for (const predDoc of snap.docs) {
    const pred = predDoc.data();
    await setDoc(doc(db, 'poolPredictions', poolPredictionId(poolId, pred.gameId, user.uid)), {
      poolId,
      poolName: poolName || poolId,
      sourcePredictionId: predDoc.id,
      userId: user.uid,
      username: pred.username,
      displayName: pred.displayName || pred.username,
      gameId: pred.gameId,
      homePrediction: pred.homePrediction,
      awayPrediction: pred.awayPrediction,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function getMyPoolMemberships(uid) {
  const snap = await getDocs(query(collection(db, 'poolMembers'), where('uid', '==', uid)));
  return snap.docs.map(d => d.data()).filter(p => p.poolId);
}

async function syncPredictionToPools({ user, profile, game, sourcePredictionId, homePrediction, awayPrediction, pools }) {
  const displayName = profile.displayName || profile.username;
  const activePoolId = profile.activePoolId;
  const orderedPools = [...pools].sort((a, b) => {
    if (a.poolId === activePoolId) return -1;
    if (b.poolId === activePoolId) return 1;
    return 0;
  });

  for (const pool of orderedPools) {
    try {
      await setDoc(doc(db, 'poolPredictions', poolPredictionId(pool.poolId, game.id, user.uid)), {
        poolId: pool.poolId,
        poolName: pool.poolName || pool.poolId,
        sourcePredictionId,
        userId: user.uid,
        username: profile.username,
        displayName,
        gameId: game.id,
        homePrediction,
        awayPrediction,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      if (pool.poolId === activePoolId) throw err;
      console.warn('Nao foi possivel sincronizar palpite em bolao secundario.', pool.poolId, err);
    }
  }
}

export { LOCK_OFFSET_MS };
