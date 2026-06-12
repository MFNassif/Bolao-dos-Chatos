import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, validateUsername, isUsernameAvailable } from '../services/authService';
import { AuthShell } from './Login';

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [poolName, setPoolName] = useState('');
  const [poolPassword, setPoolPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleUsernameBlur() {
    const err = validateUsername(username);
    if (err) { setAvailable(null); return; }
    setChecking(true);
    try { setAvailable(await isUsernameAvailable(username)); }
    catch { setAvailable(null); }
    finally { setChecking(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await registerUser({ username, password, displayName, poolName, poolPassword });
      navigate('/', { replace: true });
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('email-already-in-use')) setError('Nome de usuário já em uso.');
      else if (code.includes('weak-password')) setError('Senha fraca. Use ao menos 6 caracteres.');
      else setError(err.message || 'Erro ao cadastrar.');
    } finally { setLoading(false); }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Só usuário e senha. Sem e-mail.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Usuário</label>
          <input className="input mt-1" value={username} onChange={e => { setUsername(e.target.value); setAvailable(null); }} onBlur={handleUsernameBlur} autoComplete="username" placeholder="ex: joao_silva" required />
          <p className="text-[11px] mt-1 text-slate">3–20 caracteres. Letras minúsculas, números e _.</p>
          {checking && <p className="text-[11px] text-slate mt-0.5">verificando...</p>}
          {available === true && <p className="text-[11px] text-green-light font-bold mt-0.5">Disponível ✓</p>}
          {available === false && <p className="text-[11px] text-red-400 font-bold mt-0.5">Já está em uso</p>}
        </div>
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Nome exibido</label>
          <input className="input mt-1" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como aparecer no ranking" required />
        </div>
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Senha</label>
          <input type="password" className="input mt-1" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="mín. 6 caracteres" required />
        </div>
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Confirmar senha</label>
          <input type="password" className="input mt-1" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
        </div>
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Bolão</label>
          <input className="input mt-1" value={poolName} onChange={e => setPoolName(e.target.value)} autoComplete="off" placeholder="ex: Nassifs" required />
        </div>
        <div>
          <label className="text-xs font-bold text-slate uppercase tracking-wider">Senha do bolão</label>
          <input type="password" className="input mt-1" value={poolPassword} onChange={e => setPoolPassword(e.target.value)} autoComplete="new-password" required />
        </div>
        {error && <div className="bg-red-900/40 text-red-300 text-sm px-3 py-2 rounded-xl border border-red-700/40">{error}</div>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">{loading ? 'Criando...' : 'Cadastrar'}</button>
      </form>
      <p className="text-sm text-slate text-center mt-5">Já tem conta? <Link to="/login" className="text-green-light font-semibold">Entrar</Link></p>
    </AuthShell>
  );
}
