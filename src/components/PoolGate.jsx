import { useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { joinPoolWithPassword } from '../services/poolService';

export default function PoolGate() {
  const { user, profile } = useAuth();
  const [poolName, setPoolName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await joinPoolWithPassword({ user, profile, poolName, password });
    } catch (err) {
      setError(err?.message || 'Nao foi possivel entrar no bolao.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card bg-surface-2 p-6 w-full max-w-sm">
        <h2 className="font-display text-2xl text-white tracking-wider">ENTRAR NO BOLAO</h2>
        <p className="text-sm text-slate mt-1 mb-5">Informe o nome e a senha do grupo.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate uppercase tracking-wider">Bolao</label>
            <input className="input mt-1" value={poolName} onChange={e => setPoolName(e.target.value)} placeholder="ex: Nassifs" required />
          </div>
          <div>
            <label className="text-xs font-bold text-slate uppercase tracking-wider">Senha do bolao</label>
            <input type="password" className="input mt-1" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="bg-red-900/40 text-red-300 text-sm px-3 py-2 rounded-xl border border-red-700/40">{error}</div>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
