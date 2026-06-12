import { useEffect, useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { getMyPools, joinPoolWithPassword, setActivePool } from '../services/poolService';

export default function PoolSwitcher() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [pools, setPools] = useState([]);
  const [poolName, setPoolName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!open || !user?.uid) return;
    refreshPools();
  }, [open, user?.uid]);

  async function refreshPools() {
    if (!user?.uid) return;
    try {
      setPools(await getMyPools(user.uid));
    } catch {
      setPools([]);
    }
  }

  async function choosePool(pool) {
    setBusy(true);
    setMsg(null);
    try {
      await setActivePool({ user, pool });
      setOpen(false);
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Nao foi possivel trocar de bolao.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await joinPoolWithPassword({ user, profile, poolName, password });
      await refreshPools();
      setPoolName('');
      setPassword('');
      setMsg({ type: 'success', text: 'Bolao adicionado.' });
      setTimeout(() => setOpen(false), 500);
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Nao foi possivel entrar no bolao.' });
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="max-w-[110px] sm:max-w-none px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 hover:bg-white/10 transition text-xs font-bold text-slate truncate"
        title="Trocar bolao"
      >
        {profile.activePoolName || 'Bolao'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] card bg-surface-2 p-3 shadow-2xl z-50 space-y-3">
          <div>
            <p className="text-[11px] text-slate font-bold uppercase tracking-wider mb-2">Meus boloes</p>
            {pools.length === 0 ? (
              <p className="text-xs text-slate">Nenhum bolao associado.</p>
            ) : (
              <div className="space-y-1">
                {pools.map(pool => (
                  <button
                    key={pool.id}
                    type="button"
                    disabled={busy || pool.poolId === profile.activePoolId}
                    onClick={() => choosePool(pool)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      pool.poolId === profile.activePoolId
                        ? 'bg-green/20 text-green-light'
                        : 'bg-white/6 text-white hover:bg-white/10'
                    }`}
                  >
                    {pool.poolName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-2 pt-2 border-t border-white/8">
            <p className="text-[11px] text-slate font-bold uppercase tracking-wider">Entrar em outro</p>
            <input className="input !py-2" value={poolName} onChange={e => setPoolName(e.target.value)} placeholder="Nome do bolao" required />
            <input type="password" className="input !py-2" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" required />
            <button className="btn-primary w-full text-xs" disabled={busy} type="submit">
              {busy ? 'Entrando...' : 'Entrar'}
            </button>
            {msg && (
              <p className={`text-xs font-semibold ${msg.type === 'success' ? 'text-green-light' : 'text-red-400'}`}>
                {msg.text}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
