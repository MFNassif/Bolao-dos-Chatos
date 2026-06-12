import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';

export function subscribeRanking(callback) {
  const q = query(
    collection(db, 'users'),
    orderBy('totalPoints', 'desc'),
    orderBy('exactScores', 'desc'),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}
