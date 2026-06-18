import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';

// Erro de gols faltante (membro ainda nao recalculado) conta como o pior caso,
// para nao ganhar desempate de proximidade sem ter o dado calculado.
function goalErrorOf(row) {
  const v = Number(row?.goalError);
  return Number.isFinite(v) ? v : Infinity;
}

/**
 * Ordem oficial do ranking (vale para premiacao). Criterios de desempate:
 *  1) mais pontos
 *  2) mais cravadas (placar exato)
 *  3) menor erro de gols (palpite mais perto do placar real)
 *  4) mais palpites feitos (participacao)
 * Se ainda assim empatar, sao considerados realmente empatados (dividem o premio).
 */
export function compareRanking(a, b) {
  return (
    (b.totalPoints || 0) - (a.totalPoints || 0) ||
    (b.exactScores || 0) - (a.exactScores || 0) ||
    goalErrorOf(a) - goalErrorOf(b) ||
    (b.predictionsCount || 0) - (a.predictionsCount || 0)
  );
}

// true se a e b estao realmente empatados em TODOS os criterios (dividem premio).
export function isRankingTie(a, b) {
  return compareRanking(a, b) === 0;
}

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
