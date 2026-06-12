import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_POOL_SETTINGS } from './settingsService';
import { syncMyPredictionsToPool } from './predictionService';
import {
  normalizePoolName,
  poolMemberId,
  poolSecretId,
  validatePoolName,
  validatePoolPassword
} from '../utils/pools';

function poolError() {
  return new Error('Bolao nao encontrado ou senha incorreta.');
}

function memberPayload({ poolId, poolName, user, profile }) {
  return {
    poolId,
    poolName,
    uid: user.uid,
    username: profile.username,
    displayName: profile.displayName || profile.username,
    role: profile.role || 'user',
    totalPoints: 0,
    exactScores: 0,
    correctResults: 0,
    predictionsCount: 0,
    updatedAt: serverTimestamp()
  };
}

function memberIdentityPayload({ poolId, poolName, user, profile }) {
  return {
    poolId,
    poolName,
    uid: user.uid,
    username: profile.username,
    displayName: profile.displayName || profile.username,
    role: profile.role || 'user',
    updatedAt: serverTimestamp()
  };
}

export async function getMyPools(uid) {
  if (!uid) return [];
  const q = query(collection(db, 'poolMembers'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.poolName || '').localeCompare(b.poolName || ''));
}

export function subscribePoolMember(poolId, uid, callback) {
  if (!poolId || !uid) return () => {};
  return onSnapshot(doc(db, 'poolMembers', poolMemberId(poolId, uid)), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, (err) => {
    console.warn('Falha ao carregar membro do bolao.', err);
    callback(null);
  });
}

export async function getPoolMemberCount(poolId) {
  if (!poolId) return 0;
  const q = query(collection(db, 'poolMembers'), where('poolId', '==', poolId));
  const snap = await getCountFromServer(q);
  return snap.data().count || 0;
}

export async function getPoolMembers(poolId) {
  if (!poolId) return [];
  const q = query(
    collection(db, 'poolMembers'),
    where('poolId', '==', poolId),
    orderBy('totalPoints', 'desc'),
    orderBy('exactScores', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPoolsForAdmin() {
  const q = query(collection(db, 'pools'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setActivePool({ user, pool }) {
  if (!user?.uid) throw new Error('Usuario nao autenticado.');
  if (!pool?.poolId) throw new Error('Bolao invalido.');
  await updateDoc(doc(db, 'users', user.uid), {
    activePoolId: pool.poolId,
    activePoolName: pool.poolName || pool.name || pool.poolId,
    lastPoolAccessAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function joinPoolWithPassword({ user, profile, poolName, password }) {
  if (!user?.uid) throw new Error('Usuario nao autenticado.');
  if (!profile?.username) throw new Error('Perfil ainda nao carregou.');

  const nameErr = validatePoolName(poolName);
  if (nameErr) throw new Error(nameErr);
  const passErr = validatePoolPassword(password);
  if (passErr) throw new Error(passErr);

  const cleanName = poolName.trim();
  const poolId = normalizePoolName(cleanName);
  const secretId = await poolSecretId(poolId, password);
  const accessRef = doc(db, 'poolAccess', poolMemberId(poolId, user.uid));
  const memberRef = doc(db, 'poolMembers', poolMemberId(poolId, user.uid));
  const userRef = doc(db, 'users', user.uid);
  // Consulta (em vez de getDoc) para checar se ja e membro: um getDoc em doc
  // inexistente e negado pelas rules, o que derrubava o join em bolao novo.
  const memberQuery = query(
    collection(db, 'poolMembers'),
    where('uid', '==', user.uid),
    where('poolId', '==', poolId)
  );
  const memberSnap = await getDocs(memberQuery);

  try {
    await runTransaction(db, async (tx) => {
      tx.set(accessRef, {
        poolId,
        uid: user.uid,
        joinSecretId: secretId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (!memberSnap.empty) {
        tx.set(memberRef, memberIdentityPayload({ poolId, poolName: cleanName, user, profile }), { merge: true });
      } else {
        tx.set(memberRef, {
          ...memberPayload({ poolId, poolName: cleanName, user, profile }),
          joinedAt: serverTimestamp()
        });
      }

      tx.set(userRef, {
        activePoolId: poolId,
        activePoolName: cleanName,
        lastPoolAccessAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  } catch (err) {
    if (err?.code === 'permission-denied') throw poolError();
    throw err;
  }

  try {
    await syncMyPredictionsToPool({ user, poolId, poolName: cleanName });
  } catch (err) {
    console.warn('Nao foi possivel sincronizar palpites antigos ao entrar no bolao.', err);
  }

  return { poolId, poolName: cleanName };
}

export async function createPool({ name, password, admin }) {
  const nameErr = validatePoolName(name);
  if (nameErr) throw new Error(nameErr);
  const passErr = validatePoolPassword(password);
  if (passErr) throw new Error(passErr);

  const cleanName = name.trim();
  const poolId = normalizePoolName(cleanName);
  const poolRef = doc(db, 'pools', poolId);
  const existing = await getDoc(poolRef);
  if (existing.exists()) throw new Error('Ja existe um bolao com esse nome.');

  const secretId = await poolSecretId(poolId, password);
  const batch = writeBatch(db);
  batch.set(poolRef, {
    ...DEFAULT_POOL_SETTINGS,
    id: poolId,
    name: cleanName,
    createdBy: admin?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(doc(db, 'poolJoinSecrets', secretId), {
    poolId,
    createdBy: admin?.uid || null,
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return { poolId, name: cleanName };
}
