import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Cache persistente (IndexedDB): listeners reabertos pagam leitura apenas dos
// documentos que mudaram, em vez de reler tudo a cada navegacao — essencial
// para caber no limite gratuito do Firestore.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
  .catch((err) => {
    console.warn('Nao foi possivel configurar persistencia local do Auth.', err);
  });

export const AUTH_EMAIL_DOMAIN =
  import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'bolao.local';

export function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}@${AUTH_EMAIL_DOMAIN}`;
}
