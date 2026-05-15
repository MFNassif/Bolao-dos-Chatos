import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { isLocked, LOCK_OFFSET_MS } from '../utils/locks';

export function predictionId(gameId, userId) {
  return `${gameId}_${userId}`;
}

export async function getMyPrediction(gameId, userId) {
  const snap = await getDoc(doc(db, 'predictions', predictionId(gameId, userId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeMyPredictions(userId, callback) {
  const q = query(collection(db, 'predictions'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export function subscribePredictionsForGame(gameId, callback) {
  const q = query(collection(db, 'predictions'), where('gameId', '==', gameId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

export async function savePrediction({ user, profile, game, home, away }) {
  if (!game) throw new Error('Jogo inválido.');
  if (isLocked(game.startTime)) throw new Error('Palpite bloqueado.');

  const h = Number(home);
  const a = Number(away);
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 30 || a > 30) {
    throw new Error('Placar inválido. Use números inteiros entre 0 e 30.');
  }

  const id = predictionId(game.id, user.uid);
  const ref = doc(db, 'predictions', id);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    await setDoc(
      ref,
      {
        homePrediction: h,
        awayPrediction: a,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } else {
    await setDoc(ref, {
      userId: user.uid,
      username: profile.username,
      displayName: profile.displayName,
      gameId: game.id,
      homePrediction: h,
      awayPrediction: a,
      points: 0,
      exactScoreHit: false,
      resultHit: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lockedAt: null
    });
  }
}

export { LOCK_OFFSET_MS };
