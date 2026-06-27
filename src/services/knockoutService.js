import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isKnockoutLocked } from '../utils/knockout';

// Lê o chaveamento de outro participante (liberado só após o prazo pelas rules).
export async function getKnockoutPicks(uid) {
  if (!uid) return {};
  const snap = await getDoc(doc(db, 'knockoutPredictions', uid));
  return snap.exists() ? (snap.data().picks || {}) : {};
}

// Um documento por usuário: knockoutPredictions/{uid} = { uid, picks, updatedAt }
// picks = { [slotId]: { homeScore, awayScore, advance: 'home'|'away' } }

export function subscribeMyKnockout(uid, callback) {
  if (!uid) { callback(null); return () => {}; }
  return onSnapshot(doc(db, 'knockoutPredictions', uid), (snap) => {
    callback(snap.exists() ? snap.data() : { uid, picks: {} });
  }, (err) => {
    console.warn('Falha ao carregar palpites do mata-mata.', err);
    callback({ uid, picks: {} });
  });
}

function sanitizePicks(picks) {
  const out = {};
  for (const [slot, p] of Object.entries(picks || {})) {
    if (!p) continue;
    const h = p.homeScore;
    const a = p.awayScore;
    const clean = {};
    if (Number.isInteger(h) && h >= 0 && h <= 30) clean.homeScore = h;
    if (Number.isInteger(a) && a >= 0 && a <= 30) clean.awayScore = a;
    if (p.advance === 'home' || p.advance === 'away') clean.advance = p.advance;
    // Só guarda o slot se tiver ao menos um dado preenchido.
    if (Object.keys(clean).length) out[slot] = clean;
  }
  return out;
}

export async function saveMyKnockout(uid, picks) {
  if (!uid) throw new Error('Usuário não autenticado.');
  if (isKnockoutLocked()) throw new Error('Os palpites do Mata-Mata estão encerrados.');
  await setDoc(doc(db, 'knockoutPredictions', uid), {
    uid,
    picks: sanitizePicks(picks),
    updatedAt: serverTimestamp()
  });
}
