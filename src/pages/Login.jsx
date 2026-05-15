import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginWithUsername } from '../services/authService';

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{background:'radial-gradient(ellipse at top,#1a2f1a 0%,#0d0f14 60%)'}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Bolão dos Chatos" className="w-24 h-24 mx-auto rounded-3xl object-cover mb-4 shadow-2xl" />
          <h1 className="font-display text-3xl text-white tracking-widest">BOLÃO DOS CHATOS</h1>
          <p className="text-slate text-sm mt-1">Palpite. Torça. Dispute em família.</p>
        </div>
        <div className="card bg-surface p-6 shadow-2xl">
          <h2 className="font-display text-xl text-white tracking-wide mb-1">{title}</h2>
          {subtitle && <p className="text-slate text-sm mb-5">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithUsername(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) {
        setError('Usuário ou senha incorretos.');
      } else if (code.includes('too-many-requests')) {
        setError('Muitas tentativas. Tente em alguns minutos.');
      } else {
        setError(err.message || 'Erro ao entrar.');
      }
    } finally { setLoading(false); }
  }

  return (
    <AuthShell title="Entrar" subtitle="Use seu nome de usuário e senha.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Usuário</label>
          <input className="input mt-1" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="ex: joao_silva" required />
        </div>
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Senha</label>
          <input type="password" className="input mt-1" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" required />
        </div>
        {error && <div className="bg-red-900/40 text-red-300 text-sm font-medium px-3 py-2 rounded-xl border border-red-700/40">{error}</div>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="text-sm text-slate text-center mt-5">Não tem conta? <Link to="/register" className="text-green-light font-semibold">Cadastre-se</Link></p>
    </AuthShell>
  );
}
