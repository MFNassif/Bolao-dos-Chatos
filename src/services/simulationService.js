import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from './firebase';

export function subscribeAllPredictions(callback, onError) {
  const q = query(collection(db, 'predictions'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}
