import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { AuthContext } from './routes/AuthContext';
import { BellaProvider } from './routes/BellaContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import Layout from './components/Layout';
import Loading from './components/Loading';
import Login from './pages/Login';
import Register from './pages/Register';
import Games from './pages/Games';
import Predictions from './pages/Predictions';
import Ranking from './pages/Ranking';
import Admin from './pages/Admin';

export default function App() {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u || null);
      setAuthReady(true);
      if (!u) { setProfile(null); setProfileReady(true); }
      else setProfileReady(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      snap => { setProfile(snap.exists() ? snap.data() : null); setProfileReady(true); },
      () => setProfileReady(true)
    );
    return unsub;
  }, [user]);

  if (!authReady || (user && !profileReady)) return <Loading fullscreen />;

  return (
    <BellaProvider>
      <AuthContext.Provider value={{ user, profile }}>
        <Routes>
          <Route path="/login"    element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/"          element={<Games />} />
              <Route path="/palpites"  element={<Predictions />} />
              <Route path="/ranking"   element={<Ranking />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthContext.Provider>
    </BellaProvider>
  );
}
