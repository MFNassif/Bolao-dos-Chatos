import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, usernameToEmail } from './firebase';
import {
  normalizePoolName,
  poolMemberId,
  poolSecretId,
  validatePoolName,
  validatePoolPassword
} from '../utils/pools';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateUsername(username) {
  if (!username) return 'Informe um nome de usuário.';
  const lower = username.toLowerCase().trim();
  if (!USERNAME_RE.test(lower)) {
    return 'Use 3 a 20 caracteres: letras minúsculas, números e _ apenas.';
  }
  return null;
}

export async function isUsernameAvailable(username) {
  const lower = username.toLowerCase().trim();
  const snap = await getDoc(doc(db, 'usernames', lower));
  return !snap.exists();
}

export async function registerUser({ username, password, displayName, poolName, poolPassword }) {
  const err = validateUsername(username);
  if (err) throw new Error(err);
  if (!password || password.length < 6)
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  if (!displayName || displayName.trim().length < 2)
    throw new Error('Informe um nome exibido válido.');
  const poolNameErr = validatePoolName(poolName);
  if (poolNameErr) throw new Error(poolNameErr);
  const poolPassErr = validatePoolPassword(poolPassword);
  if (poolPassErr) throw new Error(poolPassErr);

  const lower = username.toLowerCase().trim();
  const cleanPoolName = poolName.trim();
  const poolId = normalizePoolName(cleanPoolName);
  const secretId = await poolSecretId(poolId, poolPassword);

  const available = await isUsernameAvailable(lower);
  if (!available) throw new Error('Este nome de usuário já está em uso.');

  const email = usernameToEmail(lower);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  // Grava username + user em transação para evitar inconsistências.
  try {
    await runTransaction(db, async (tx) => {
      const uref = doc(db, 'usernames', lower);
      const existing = await tx.get(uref);
      if (existing.exists()) {
        throw new Error('Este nome de usuário acabou de ser registrado por outra pessoa.');
      }
      tx.set(uref, { uid, createdAt: serverTimestamp() });
      tx.set(doc(db, 'users', uid), {
        uid,
        username: lower,
        displayName: displayName.trim(),
        role: 'user',
        totalPoints: 0,
        exactScores: 0,
        correctResults: 0,
        predictionsCount: 0,
        activePoolId: poolId,
        activePoolName: cleanPoolName,
        lastPoolAccessAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      tx.set(doc(db, 'poolAccess', poolMemberId(poolId, uid)), {
        poolId,
        uid,
        joinSecretId: secretId,
        updatedAt: serverTimestamp()
      });
      tx.set(doc(db, 'poolMembers', poolMemberId(poolId, uid)), {
        poolId,
        poolName: cleanPoolName,
        uid,
        username: lower,
        displayName: displayName.trim(),
        role: 'user',
        totalPoints: 0,
        exactScores: 0,
        correctResults: 0,
        predictionsCount: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
  } catch (e) {
    try { await cred.user.delete(); } catch (_) { /* noop */ }
    if (e?.code === 'permission-denied') {
      throw new Error('Bolão não encontrado ou senha do bolão incorreta.');
    }
    throw e;
  }

  return cred.user;
}

export async function loginWithUsername(username, password) {
  const err = validateUsername(username);
  if (err) throw new Error(err);
  const email = usernameToEmail(username);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}
