import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_SETTINGS = {
  betAmount: 50,       // valor em R$ por participante
  currency: 'R$',
  prize1: 70,          // % para 1º lugar
  prize2: 20,          // % para 2º lugar
  prize3: 10,          // % para 3º lugar
  appName: 'Bolão dos Chatos'
};

export function subscribeSettings(callback) {
  const ref = doc(db, 'settings', 'app');
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : DEFAULT_SETTINGS);
  });
}

export async function saveSettings(data) {
  await setDoc(doc(db, 'settings', 'app'), {
    ...data,
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
