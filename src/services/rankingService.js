import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';

export function subscribeRanking(poolId, callback) {
  if (!poolId) return () => {};
  const q = query(
    collection(db, 'poolMembers'),
    where('poolId', '==', poolId),
    orderBy('totalPoints', 'desc'),
    orderBy('exactScores', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  }, (err) => {
    console.warn('Falha ao carregar ranking.', err);
    callback([]);
  });
}
