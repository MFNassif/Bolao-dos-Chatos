import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';

export function subscribeGames(callback) {
  const q = query(collection(db, 'games'), orderBy('startTime', 'asc'));
  return onSnapshot(q, (snap) => {
    const games = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(games);
  });
}

export function subscribeLiveGames(callback) {
  const q = query(collection(db, 'games'), where('status', '==', 'live'), orderBy('startTime', 'asc'));
  return onSnapshot(q, (snap) => {
    const games = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(games);
  });
}
