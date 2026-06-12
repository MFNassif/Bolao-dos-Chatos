import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_POOL_SETTINGS = {
  betAmount: 50,
  currency: 'R$',
  prize1: 70,
  prize2: 20,
  prize3: 10,
  exactScorePoints: 5,
  correctResultPoints: 1
};

export function subscribePoolSettings(poolId, callback) {
  if (!poolId) {
    callback(DEFAULT_POOL_SETTINGS);
    return () => {};
  }
  const ref = doc(db, 'pools', poolId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...DEFAULT_POOL_SETTINGS, ...snap.data() } : DEFAULT_POOL_SETTINGS);
  }, (err) => {
    console.warn('Falha ao carregar configuracoes do bolao.', err);
    callback(DEFAULT_POOL_SETTINGS);
  });
}

export async function savePoolSettings(poolId, data) {
  if (!poolId) throw new Error('Bolao ativo nao encontrado.');
  await setDoc(doc(db, 'pools', poolId), {
    ...pickPoolSettings(data),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function calcPrizes(settings, totalParticipants) {
  const total = (settings.betAmount || 0) * totalParticipants;
  return {
    total,
    first:  Math.round(total * (settings.prize1 || 70) / 100),
    second: Math.round(total * (settings.prize2 || 20) / 100),
    third:  Math.round(total * (settings.prize3 || 10) / 100),
    currency: settings.currency || 'R$'
  };
}

function pickPoolSettings(data) {
  return {
    betAmount: toNumber(data.betAmount, DEFAULT_POOL_SETTINGS.betAmount),
    currency: data.currency || DEFAULT_POOL_SETTINGS.currency,
    prize1: toNumber(data.prize1, DEFAULT_POOL_SETTINGS.prize1),
    prize2: toNumber(data.prize2, DEFAULT_POOL_SETTINGS.prize2),
    prize3: toNumber(data.prize3, DEFAULT_POOL_SETTINGS.prize3),
    exactScorePoints: toNumber(data.exactScorePoints, DEFAULT_POOL_SETTINGS.exactScorePoints),
    correctResultPoints: toNumber(data.correctResultPoints, DEFAULT_POOL_SETTINGS.correctResultPoints)
  };
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
